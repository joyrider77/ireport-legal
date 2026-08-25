// Teil 3 — Tenant-Cascade-Regression (Tests A–E).
//
// Diese Tests verifizieren die mandantenübergreifende Isolation und die
// atomare Cascade-Delete-Logik von deleteKanzlei:
//   A — Tenant-Isolation: Benutzerverwaltung von A zeigt nur A-Benutzer.
//   B — Plattform-Admin-Isolation: normaler Modus zeigt nur eigene Kanzlei,
//       Plattform-Admin-Modus zeigt beide Kanzleien getrennt.
//   C — Cascade-Delete: nach Löschen von B ist B weg, alle B-Benutzer weg,
//       ehemaliger B-Principal wird als nicht registriert abgewiesen.
//   D — Orphan-Count: Vor-/Nach-Löschung-Zählbericht je Datenbereich;
//       tenant-gebundene Counts werden 0, Audit-/Compliance-Counts bleiben.
//   E — Deaktivieren/Reaktivieren: löscht keine Daten physisch.
//
// Jeder Testfall protokolliert über console.log die Felder TESTFALL,
// ERGEBNIS (PASS/FAIL/PARTIAL/NOT TESTABLE), BEOBACHTET (konkretes
// Ergebnis) und METHODE (echter Backend-Call-Replik) — analog zu
// part2-security.test.ts.
//
// Die Tests nutzen den PURE Backend-Replikations-Harness
// (harness/backend-replica.ts), der die Backend-Logik aus
// src/backend/lib/*.mo als reine TypeScript-Funktionen nachbildet.

import { describe, expect, it } from "vitest";
import {
  TRAP_MESSAGES,
  countTenantRecords,
  createFreshState,
  deactivateKanzlei,
  deleteKanzlei,
  getAllKanzleienOverview,
  getCurrentUser,
  getLeistungserbringer,
  getLeistungserbringerByKanzlei,
  getOrCreateUser,
  reactivateKanzlei,
  registerKanzlei,
} from "./harness/backend-replica";
import type { TenantRecordCounts } from "./harness/backend-replica";
import { TEST_IDS } from "./harness/test-ids";
import type { HarnessState, Leistungserbringer } from "./harness/types";

// ── Fixter Zeitstempel für deterministische Tests ────────────────────────────
const NOW = Date.UTC(2026, 7, 9); // 2026-08-09T00:00:00Z

// ── Hilfsfunktion: einheitliches Ergebnis-Protokoll ─────────────────────────
function logResult(
  testfall: string,
  ergebnis: "PASS" | "FAIL" | "PARTIAL" | "NOT TESTABLE",
  beobachtet: string,
  methode: string,
): void {
  console.log(
    `TESTFALL=${testfall} ERGEBNIS=${ergebnis} BEOBACHTET=${beobachtet} METHODE=${methode}`,
  );
}

// ── Setup: vollständige Test-Landschaft ──────────────────────────────────────
//
// Reihenfolge (analog part2-security.test.ts):
//   1. TEST-PLATTFORM-ADMIN registrieren (leere Whitelist → auto-promote
//      zum Super-Admin, role='plattform_admin').
//   2. TEST-TENANT-A via registerKanzlei (TEST_TENANT_A_ADMIN wird Admin).
//   3. TEST-TENANT-B via registerKanzlei (TEST_TENANT_B_ADMIN wird Admin).
//   4. Zusätzliche Benutzer (TEST_TENANT_A_USER, TEST_TENANT_B_USER) via
//      direktes Setzen in state.users.
//
// Jeder Testfall erhält eine FRISCHE Kopie dieses Setups.
function setupFullLandscape(): HarnessState {
  const state = createFreshState();

  // (1) Plattform-Admin registrieren → auto-promote (Whitelist leer).
  const plat = registerKanzlei(
    state.kanzleien,
    state.users,
    state.superAdminWhitelist,
    TEST_IDS.PLATTFORM_ADMIN,
    "Plattform-Admin-Kanzlei",
    "Dr.",
    "Plattform",
    "Admin",
    "admin@plattform.example",
    "jahres",
    NOW,
  );
  expect(plat.ok).toBeDefined();

  // (2) Tenant A registrieren.
  const tenantA = registerKanzlei(
    state.kanzleien,
    state.users,
    state.superAdminWhitelist,
    TEST_IDS.TENANT_A_ADMIN,
    "Tenant A Kanzlei",
    "RA",
    "Tenant",
    "Admin-A",
    "admin-a@tenant-a.example",
    "jahres",
    NOW,
  );
  expect(tenantA.ok).toBeDefined();

  // (3) Tenant B registrieren.
  const tenantB = registerKanzlei(
    state.kanzleien,
    state.users,
    state.superAdminWhitelist,
    TEST_IDS.TENANT_B_ADMIN,
    "Tenant B Kanzlei",
    "RA",
    "Tenant",
    "Admin-B",
    "admin-b@tenant-b.example",
    "monats",
    NOW,
  );
  expect(tenantB.ok).toBeDefined();

  // (4) Zusätzliche Benutzer direkt in state.users anlegen.
  const tenantAUser: Leistungserbringer = {
    id: TEST_IDS.TENANT_A_USER,
    kanzleiId: TEST_IDS.TENANT_A_ADMIN,
    vorname: "Tenant-A",
    nachname: "User",
    titel: "RA",
    email: "user-a@tenant-a.example",
    isAdmin: false,
    role: "anwalt",
    status: "aktiv",
    registeredAt: NOW,
    statusHistory: [{ year: 2026, month: 8, status: "aktiv" }],
  };
  state.users.set(TEST_IDS.TENANT_A_USER, tenantAUser);

  const tenantBUser: Leistungserbringer = {
    id: TEST_IDS.TENANT_B_USER,
    kanzleiId: TEST_IDS.TENANT_B_ADMIN,
    vorname: "Tenant-B",
    nachname: "User",
    titel: "RA",
    email: "user-b@tenant-b.example",
    isAdmin: false,
    role: "anwalt",
    status: "aktiv",
    registeredAt: NOW,
    statusHistory: [{ year: 2026, month: 8, status: "aktiv" }],
  };
  state.users.set(TEST_IDS.TENANT_B_USER, tenantBUser);

  return state;
}

// ── Hilfsfunktion: Counts als kompakter String ──────────────────────────────
function countsToString(c: TenantRecordCounts): string {
  return (
    `users=${c.users}, inviteTokens=${c.inviteTokens}, ` +
    `klienten=${c.klienten}, mandate=${c.mandate}, ` +
    `leistungen=${c.leistungen}, auslagen=${c.auslagen}, ` +
    `rechnungen=${c.rechnungen}, zahlungen=${c.zahlungen}, ` +
    `rechnungsvorlagen=${c.rechnungsvorlagen}; ` +
    `auditLogs=${c.auditLogs}, consentRecords=${c.consentRecords}, ` +
    `dsrRequests=${c.dsrRequests}, retentionPolicies=${c.retentionPolicies}, ` +
    `dataAccessLogs=${c.dataAccessLogs}, dataInventory=${c.dataInventory}, ` +
    `dataFlows=${c.dataFlows}`
  );
}

// ── Hilfsfunktion: tenant-gebundene Counts alle 0? ──────────────────────────
function tenantBoundAllZero(c: TenantRecordCounts): boolean {
  return (
    c.users === 0 &&
    c.inviteTokens === 0 &&
    c.klienten === 0 &&
    c.mandate === 0 &&
    c.leistungen === 0 &&
    c.auslagen === 0 &&
    c.rechnungen === 0 &&
    c.zahlungen === 0 &&
    c.rechnungsvorlagen === 0
  );
}

describe("Teil 3 — Tenant-Cascade-Regression", () => {
  // ── Test A: Tenant-Isolation ────────────────────────────────────────────────
  //
  // getLeistungserbringer als TEST-TENANT-A-ADMIN liefert NUR Benutzer der
  // Kanzlei A (TENANT_A_ADMIN + TENANT_A_USER), niemals B-Benutzer
  // (TENANT_B_ADMIN, TENANT_B_USER) oder den Plattform-Admin.
  it("Test A — Tenant-Isolation: A-Admin sieht nur A-Benutzer, nie B-Benutzer", () => {
    const testfall = "A-TENANT-ISOLATION";
    const methode =
      "echter Backend-Call-Replik (getLeistungserbringer als TENANT_A_ADMIN)";

    const state = setupFullLandscape();

    const users = getLeistungserbringer(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
    );

    const ids = users.map((u) => u.id).sort();
    const hasA = ids.includes(TEST_IDS.TENANT_A_ADMIN);
    const hasAUser = ids.includes(TEST_IDS.TENANT_A_USER);
    const hasBAdmin = ids.includes(TEST_IDS.TENANT_B_ADMIN);
    const hasBUser = ids.includes(TEST_IDS.TENANT_B_USER);
    const hasPlat = ids.includes(TEST_IDS.PLATTFORM_ADMIN);

    const check =
      hasA &&
      hasAUser &&
      !hasBAdmin &&
      !hasBUser &&
      !hasPlat &&
      ids.length === 2;

    // Assertions (Vitest).
    expect(users).toHaveLength(2);
    expect(hasA).toBe(true);
    expect(hasAUser).toBe(true);
    expect(hasBAdmin).toBe(false);
    expect(hasBUser).toBe(false);
    expect(hasPlat).toBe(false);

    const ergebnis = check ? "PASS" : "FAIL";
    const beobachtet =
      `getLeistungserbringer(A-admin) = [${ids.join(", ")}]; ` +
      `hasA=${hasA}, hasAUser=${hasAUser}, hasBAdmin=${hasBAdmin}, ` +
      `hasBUser=${hasBUser}, hasPlat=${hasPlat}, count=${users.length}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(check).toBe(true);
  });

  // ── Test B: Plattform-Admin-Isolation ────────────────────────────────────────
  //
  // (a) getLeistungserbringer als PLATTFORM_ADMIN liefert NUR die Benutzer
  //     der eigenen Plattform-Admin-Kanzlei (nur PLATTFORM_ADMIN selbst),
  //     niemals B-Benutzer.
  // (b) getAllKanzleienOverview als PLATTFORM_ADMIN liefert beide Kanzleien
  //     (A und B) getrennt.
  // (c) getLeistungserbringerByKanzlei für A und für B liefern jeweils nur
  //     die Benutzer der angegebenen Kanzlei.
  it("Test B — Plattform-Admin-Isolation: normal = eigene Kanzlei, Modul = beide getrennt", () => {
    const testfall = "B-PLATTFORM-ADMIN-ISOLATION";
    const methode =
      "echter Backend-Call-Replik (getLeistungserbringer + getAllKanzleienOverview + getLeistungserbringerByKanzlei als PLATTFORM_ADMIN)";

    const state = setupFullLandscape();

    // (a) Normale Benutzerverwaltung: nur eigene Kanzlei.
    const ownUsers = getLeistungserbringer(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
    );
    const ownIds = ownUsers.map((u) => u.id).sort();
    const checkA =
      ownIds.length === 1 &&
      ownIds.includes(TEST_IDS.PLATTFORM_ADMIN) &&
      !ownIds.includes(TEST_IDS.TENANT_B_ADMIN) &&
      !ownIds.includes(TEST_IDS.TENANT_B_USER);

    // (b) Plattform-Admin-Modul: beide Kanzleien in der Übersicht.
    const overview = getAllKanzleienOverview(
      state.kanzleien,
      state.users,
      TEST_IDS.PLATTFORM_ADMIN,
      state.superAdminWhitelist,
    );
    const overviewIds = overview.map((o) => o.id).sort();
    const checkB =
      overviewIds.includes(TEST_IDS.TENANT_A_ADMIN) &&
      overviewIds.includes(TEST_IDS.TENANT_B_ADMIN) &&
      overviewIds.includes(TEST_IDS.PLATTFORM_ADMIN);

    // (c) getLeistungserbringerByKanzlei für A und B.
    const usersA = getLeistungserbringerByKanzlei(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_A_ADMIN,
    );
    const usersB = getLeistungserbringerByKanzlei(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_B_ADMIN,
    );
    const idsA = usersA.map((u) => u.id).sort();
    const idsB = usersB.map((u) => u.id).sort();
    const checkC =
      idsA.includes(TEST_IDS.TENANT_A_ADMIN) &&
      idsA.includes(TEST_IDS.TENANT_A_USER) &&
      !idsA.includes(TEST_IDS.TENANT_B_ADMIN) &&
      idsB.includes(TEST_IDS.TENANT_B_ADMIN) &&
      idsB.includes(TEST_IDS.TENANT_B_USER) &&
      !idsB.includes(TEST_IDS.TENANT_A_ADMIN);

    // Assertions (Vitest).
    expect(ownUsers).toHaveLength(1);
    expect(ownIds).toContain(TEST_IDS.PLATTFORM_ADMIN);
    expect(overviewIds).toContain(TEST_IDS.TENANT_A_ADMIN);
    expect(overviewIds).toContain(TEST_IDS.TENANT_B_ADMIN);
    expect(idsA).toContain(TEST_IDS.TENANT_A_ADMIN);
    expect(idsA).toContain(TEST_IDS.TENANT_A_USER);
    expect(idsA).not.toContain(TEST_IDS.TENANT_B_ADMIN);
    expect(idsB).toContain(TEST_IDS.TENANT_B_ADMIN);
    expect(idsB).toContain(TEST_IDS.TENANT_B_USER);
    expect(idsB).not.toContain(TEST_IDS.TENANT_A_ADMIN);

    const allPass = checkA && checkB && checkC;
    const ergebnis = allPass
      ? "PASS"
      : checkA || checkB || checkC
        ? "PARTIAL"
        : "FAIL";
    const beobachtet =
      `(a) getLeistungserbringer(PLATTFORM_ADMIN) = [${ownIds.join(", ")}]; ` +
      `(b) getAllKanzleienOverview = [${overviewIds.join(", ")}]; ` +
      `(c) getLeistungserbringerByKanzlei(A) = [${idsA.join(", ")}], ` +
      `getLeistungserbringerByKanzlei(B) = [${idsB.join(", ")}]`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test C: Cascade-Delete ──────────────────────────────────────────────────
  //
  // deleteKanzlei(B) als PLATTFORM_ADMIN:
  //   - B nicht mehr in kanzleien.
  //   - alle B-Benutzer nicht mehr in users.
  //   - getLeistungserbringer als A-admin liefert keine B-Benutzer.
  //   - getAllKanzleienOverview listet B nicht mehr.
  //   - getLeistungserbringerByKanzlei(B) liefert leer.
  //   - getCurrentUser/getOrCreateUser mit ehemaligem B-Principal liefern
  //     not-registered (null bzw. #err).
  it("Test C — Cascade-Delete: B gelöscht, B-Benutzer weg, ehemaliger B-Principal abgewiesen", () => {
    const testfall = "C-CASCADE-DELETE";
    const methode =
      "echter Backend-Call-Replik (deleteKanzlei + getLeistungserbringer + getAllKanzleienOverview + getLeistungserbringerByKanzlei + getCurrentUser + getOrCreateUser)";

    const state = setupFullLandscape();

    // Vorbedingung: B existiert mit 2 Benutzern.
    expect(state.kanzleien.has(TEST_IDS.TENANT_B_ADMIN)).toBe(true);
    expect(state.users.has(TEST_IDS.TENANT_B_ADMIN)).toBe(true);
    expect(state.users.has(TEST_IDS.TENANT_B_USER)).toBe(true);

    // deleteKanzlei(B) als PLATTFORM_ADMIN.
    const del = deleteKanzlei(
      state,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_B_ADMIN,
    );
    const checkDel = del.ok !== undefined && del.err === undefined;

    // (a) B nicht mehr in kanzleien.
    const bKanzleiGone =
      state.kanzleien.get(TEST_IDS.TENANT_B_ADMIN) === undefined;

    // (b) alle B-Benutzer nicht mehr in users.
    const bUsersGone =
      state.users.get(TEST_IDS.TENANT_B_ADMIN) === undefined &&
      state.users.get(TEST_IDS.TENANT_B_USER) === undefined;

    // (c) getLeistungserbringer als A-admin liefert keine B-Benutzer.
    const aUsers = getLeistungserbringer(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
    );
    const aIds = aUsers.map((u) => u.id);
    const checkAView =
      !aIds.includes(TEST_IDS.TENANT_B_ADMIN) &&
      !aIds.includes(TEST_IDS.TENANT_B_USER);

    // (d) getAllKanzleienOverview listet B nicht mehr.
    const overview = getAllKanzleienOverview(
      state.kanzleien,
      state.users,
      TEST_IDS.PLATTFORM_ADMIN,
      state.superAdminWhitelist,
    );
    const overviewIds = overview.map((o) => o.id);
    const checkOverview = !overviewIds.includes(TEST_IDS.TENANT_B_ADMIN);

    // (e) getLeistungserbringerByKanzlei(B) liefert leer.
    const bUsersView = getLeistungserbringerByKanzlei(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_B_ADMIN,
    );
    const checkBView = bUsersView.length === 0;

    // (f) getCurrentUser mit ehemaligem B-Principal → null.
    const currentBAdmin = getCurrentUser(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_B_ADMIN,
    );
    const currentBUser = getCurrentUser(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_B_USER,
    );
    const checkGetCurrent = currentBAdmin === null && currentBUser === null;

    // (g) getOrCreateUser mit ehemaligem B-Principal → #err.
    const getOrCreateBAdmin = getOrCreateUser(
      state.kanzleien,
      state.users,
      TEST_IDS.TENANT_B_ADMIN,
    );
    const getOrCreateBUser = getOrCreateUser(
      state.kanzleien,
      state.users,
      TEST_IDS.TENANT_B_USER,
    );
    const checkGetOrCreate =
      getOrCreateBAdmin.err !== undefined && getOrCreateBUser.err !== undefined;

    // Assertions (Vitest).
    expect(del.ok).toBeDefined();
    expect(del.err).toBeUndefined();
    expect(bKanzleiGone).toBe(true);
    expect(bUsersGone).toBe(true);
    expect(checkAView).toBe(true);
    expect(checkOverview).toBe(true);
    expect(bUsersView).toHaveLength(0);
    expect(currentBAdmin).toBeNull();
    expect(currentBUser).toBeNull();
    expect(getOrCreateBAdmin.err).toBeDefined();
    expect(getOrCreateBUser.err).toBeDefined();

    const allPass =
      checkDel &&
      bKanzleiGone &&
      bUsersGone &&
      checkAView &&
      checkOverview &&
      checkBView &&
      checkGetCurrent &&
      checkGetOrCreate;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `deleteKanzlei(B).ok=${String(del.ok)}; ` +
      `bKanzleiGone=${bKanzleiGone}, bUsersGone=${bUsersGone}; ` +
      `getLeistungserbringer(A)=[${aIds.join(", ")}]; ` +
      `overview=[${overviewIds.join(", ")}]; ` +
      `getLeistungserbringerByKanzlei(B).length=${bUsersView.length}; ` +
      `getCurrentUser(B-admin)=${String(currentBAdmin)}, ` +
      `getCurrentUser(B-user)=${String(currentBUser)}; ` +
      `getOrCreateUser(B-admin).err=${String(getOrCreateBAdmin.err)}, ` +
      `getOrCreateUser(B-user).err=${String(getOrCreateBUser.err)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test D: Orphan-Count ────────────────────────────────────────────────────
  //
  // countTenantRecords vor und nach deleteKanzlei(B):
  //   - alle tenant-gebundenen Counts für B werden 0 nach der Löschung.
  //   - Audit-/Compliance-Counts bleiben unverändert (historisch erhalten).
  it("Test D — Orphan-Count: tenant-gebunden = 0 nach Löschung, Audit/Compliance unverändert", () => {
    const testfall = "D-ORPHAN-COUNT";
    const methode =
      "echter Backend-Call-Replik (countTenantRecords vor/nach deleteKanzlei)";

    const state = setupFullLandscape();

    // Vor der Löschung: B hat 2 Benutzer (admin + user), 0 in anderen Maps.
    const before = countTenantRecords(state, TEST_IDS.TENANT_B_ADMIN);

    // Audit-/Compliance-Daten für B anlegen, damit wir verifizieren können,
    // dass sie nach der Löschung erhalten bleiben.
    state.auditLogs.set("AUD-B-1", {
      id: "AUD-B-1",
      kanzleiId: TEST_IDS.TENANT_B_ADMIN,
      actorPrincipal: TEST_IDS.TENANT_B_ADMIN,
      action: "create",
      entityType: "klient",
      entityId: "C-1",
      timestamp: NOW,
      beforeValue: null,
      afterValue: null,
    });
    state.consentRecords.set("CON-B-1", {
      id: "CON-B-1",
      kanzleiId: TEST_IDS.TENANT_B_ADMIN,
      klientId: "C-1",
      consentGiven: true,
      timestamp: NOW,
      dsgVersion: "1.0",
      principal: TEST_IDS.TENANT_B_ADMIN,
    });
    state.dsrRequests.set("DSR-B-1", {
      id: "DSR-B-1",
      kanzleiId: TEST_IDS.TENANT_B_ADMIN,
      dsrType: "auskunft",
      requesterName: "B-Client",
      requesterEmail: "b-client@example.com",
      requesterId: "C-1",
      status: "erfasst",
      assignedTo: null,
      createdAt: NOW,
      updatedAt: NOW,
      completedAt: null,
      notes: null,
    });
    state.retentionPolicies.set("RET-B-1", {
      id: "RET-B-1",
      kanzleiId: TEST_IDS.TENANT_B_ADMIN,
      categoryName: "Mandate",
      retentionYears: 10,
      legalBasis: "Art. 6 DSGVO",
      isLocked: false,
      createdAt: NOW,
      updatedAt: NOW,
    });
    state.dataInventory.set("INV-B-1", {
      id: "INV-B-1",
      kanzleiId: TEST_IDS.TENANT_B_ADMIN,
      categoryName: "Mandatsdaten",
      storageLocation: "Canister",
      storageDuration: "10 Jahre",
      accessRole: "admin",
      description: null,
    });
    state.dataFlows.set("FLOW-B-1", {
      id: "FLOW-B-1",
      kanzleiId: TEST_IDS.TENANT_B_ADMIN,
      flowName: "B-Flow",
      what: "Mandatsdaten",
      destination: "Externe Kanzlei-Software",
      purpose: "Bearbeitung",
      legalBasis: "Art. 6 DSGVO",
      isExternal: true,
    });

    // Re-Count nach Anlegen der Audit-/Compliance-Daten (vor Löschung).
    const beforeWithAudit = countTenantRecords(state, TEST_IDS.TENANT_B_ADMIN);

    // deleteKanzlei(B) als PLATTFORM_ADMIN.
    const del = deleteKanzlei(
      state,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_B_ADMIN,
    );
    expect(del.ok).toBeDefined();

    // Nach der Löschung.
    const after = countTenantRecords(state, TEST_IDS.TENANT_B_ADMIN);

    // (a) tenant-gebundene Counts alle 0 nach Löschung.
    const checkTenantZero = tenantBoundAllZero(after);

    // (b) Audit-/Compliance-Counts unverändert (vor == nach).
    const checkAuditPreserved =
      beforeWithAudit.auditLogs === after.auditLogs &&
      beforeWithAudit.consentRecords === after.consentRecords &&
      beforeWithAudit.dsrRequests === after.dsrRequests &&
      beforeWithAudit.retentionPolicies === after.retentionPolicies &&
      beforeWithAudit.dataAccessLogs === after.dataAccessLogs &&
      beforeWithAudit.dataInventory === after.dataInventory &&
      beforeWithAudit.dataFlows === after.dataFlows;

    // Assertions (Vitest).
    expect(before.users).toBe(2); // B-admin + B-user
    expect(after.users).toBe(0);
    expect(after.inviteTokens).toBe(0);
    expect(after.klienten).toBe(0);
    expect(after.mandate).toBe(0);
    expect(after.leistungen).toBe(0);
    expect(after.auslagen).toBe(0);
    expect(after.rechnungen).toBe(0);
    expect(after.zahlungen).toBe(0);
    expect(after.rechnungsvorlagen).toBe(0);
    expect(beforeWithAudit.auditLogs).toBe(1);
    expect(after.auditLogs).toBe(1);
    expect(beforeWithAudit.consentRecords).toBe(1);
    expect(after.consentRecords).toBe(1);
    expect(beforeWithAudit.dsrRequests).toBe(1);
    expect(after.dsrRequests).toBe(1);
    expect(beforeWithAudit.retentionPolicies).toBe(1);
    expect(after.retentionPolicies).toBe(1);
    expect(beforeWithAudit.dataInventory).toBe(1);
    expect(after.dataInventory).toBe(1);
    expect(beforeWithAudit.dataFlows).toBe(1);
    expect(after.dataFlows).toBe(1);

    const allPass = checkTenantZero && checkAuditPreserved;
    const ergebnis = allPass
      ? "PASS"
      : checkTenantZero || checkAuditPreserved
        ? "PARTIAL"
        : "FAIL";
    const beobachtet =
      `VOR (ohne Audit): ${countsToString(before)}; ` +
      `VOR (mit Audit): ${countsToString(beforeWithAudit)}; ` +
      `NACH: ${countsToString(after)}; ` +
      `tenantBoundAllZero=${checkTenantZero}, ` +
      `auditPreserved=${checkAuditPreserved}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test E: Deaktivieren/Reaktivieren unverändert ────────────────────────────
  //
  // deactivateKanzlei(A) dann reactivateKanzlei(A):
  //   - A bleibt in kanzleien (status toggled inaktiv → aktiv).
  //   - alle A-Benutzer noch vorhanden.
  //   - alle A tenant-gebundenen Daten-Counts unverändert.
  it("Test E — Deaktivieren/Reaktivieren: keine physische Löschung", () => {
    const testfall = "E-DEACTIVATE-UNCHANGED";
    const methode =
      "echter Backend-Call-Replik (deactivateKanzlei + reactivateKanzlei + countTenantRecords)";

    const state = setupFullLandscape();

    // Vorbedingung: A hat 2 Benutzer.
    const before = countTenantRecords(state, TEST_IDS.TENANT_A_ADMIN);
    expect(before.users).toBe(2);

    // deactivateKanzlei(A) als PLATTFORM_ADMIN.
    const deact = deactivateKanzlei(
      state.kanzleien,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_A_ADMIN,
    );
    const statusAfterDeact = state.kanzleien.get(
      TEST_IDS.TENANT_A_ADMIN,
    )?.status;
    const checkDeact =
      deact.ok !== undefined &&
      deact.err === undefined &&
      statusAfterDeact === "inaktiv";

    // reactivateKanzlei(A) als PLATTFORM_ADMIN.
    const react = reactivateKanzlei(
      state.kanzleien,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_A_ADMIN,
    );
    const statusAfterReact = state.kanzleien.get(
      TEST_IDS.TENANT_A_ADMIN,
    )?.status;
    const checkReact =
      react.ok !== undefined &&
      react.err === undefined &&
      statusAfterReact === "aktiv";

    // A noch in kanzleien.
    const aStillExists = state.kanzleien.has(TEST_IDS.TENANT_A_ADMIN);

    // Alle A-Benutzer noch vorhanden.
    const aUsersStillExist =
      state.users.has(TEST_IDS.TENANT_A_ADMIN) &&
      state.users.has(TEST_IDS.TENANT_A_USER);

    // Counts unverändert.
    const after = countTenantRecords(state, TEST_IDS.TENANT_A_ADMIN);
    const countsUnchanged =
      before.users === after.users &&
      before.inviteTokens === after.inviteTokens &&
      before.klienten === after.klienten &&
      before.mandate === after.mandate &&
      before.leistungen === after.leistungen &&
      before.auslagen === after.auslagen &&
      before.rechnungen === after.rechnungen &&
      before.zahlungen === after.zahlungen &&
      before.rechnungsvorlagen === after.rechnungsvorlagen;

    // Assertions (Vitest).
    expect(deact.ok).toBeDefined();
    expect(deact.err).toBeUndefined();
    expect(statusAfterDeact).toBe("inaktiv");
    expect(react.ok).toBeDefined();
    expect(react.err).toBeUndefined();
    expect(statusAfterReact).toBe("aktiv");
    expect(aStillExists).toBe(true);
    expect(aUsersStillExist).toBe(true);
    expect(after.users).toBe(2);
    expect(countsUnchanged).toBe(true);

    const allPass =
      checkDeact &&
      checkReact &&
      aStillExists &&
      aUsersStillExist &&
      countsUnchanged;
    const ergebnis = allPass
      ? "PASS"
      : checkDeact ||
          checkReact ||
          aStillExists ||
          aUsersStillExist ||
          countsUnchanged
        ? "PARTIAL"
        : "FAIL";
    const beobachtet =
      `deactivateKanzlei(A).ok=${String(deact.ok)}, status=${String(statusAfterDeact)}; ` +
      `reactivateKanzlei(A).ok=${String(react.ok)}, status=${String(statusAfterReact)}; ` +
      `aStillExists=${aStillExists}, aUsersStillExist=${aUsersStillExist}; ` +
      `VOR: ${countsToString(before)}; NACH: ${countsToString(after)}; ` +
      `countsUnchanged=${countsUnchanged}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });
});
