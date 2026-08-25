// Teil 2 — Security-Regression (Tests 2.1–2.5).
//
// Diese Tests verifizieren die serverseitige Durchsetzung der Guards für:
//   - Cross-Tenant-Isolation (removeLeistungserbringer)
//   - Rollenprüfung (nur admin/plattform_admin dürfen deaktivieren)
//   - Deaktivierter Benutzer (READ getKlienten + WRITE createKlient trappen)
//   - Deaktivierte Kanzlei (READ getKlienten + WRITE createKlient trappen)
//   - Plattform-Admin-Rechte (deactivate/reactivate/delete Kanzlei uneingeschränkt)
//
// Jeder Testfall protokolliert über console.log die Felder TESTFALL,
// ERGEBNIS (PASS/FAIL/PARTIAL/NOT TESTABLE), BEOBACHTET (konkretes
// Ergebnis) und METHODE (echter Backend-Call-Replik).
//
// Die Tests nutzen den PURE Backend-Replikations-Harness
// (harness/backend-replica.ts), der die Backend-Logik aus
// src/backend/lib/*.mo als reine TypeScript-Funktionen nachbildet.

import { describe, expect, it } from "vitest";
import {
  TRAP_MESSAGES,
  canDeactivateLeistungserbringer,
  createFreshState,
  createKlient,
  deactivateKanzlei,
  deleteKanzlei,
  reactivateKanzlei,
  registerKanzlei,
  removeLeistungserbringer,
  requireActiveUserAndKanzlei,
} from "./harness/backend-replica";
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
// Reihenfolge (wie in der Dispatch-Setup-Vorgabe):
//   1. TEST-PLATTFORM-ADMIN registrieren (leere Whitelist → auto-promote
//      zum Super-Admin, role='plattform_admin').
//   2. TEST-TENANT-A via registerKanzlei (TEST_TENANT_A_ADMIN wird Admin,
//      role='admin', kanzleiId=TEST_TENANT_A_ADMIN).
//   3. TEST-TENANT-B via registerKanzlei (TEST_TENANT_B_ADMIN wird Admin,
//      role='admin', kanzleiId=TEST_TENANT_B_ADMIN).
//   4. Zusätzliche Benutzer (TEST_TENANT_A_USER, TEST_TENANT_B_USER) via
//      direktes Setzen in state.users mit korrekter kanzleiId, role='anwalt',
//      status='aktiv'.
//
// Jeder Testfall erhält eine FRISCHE Kopie dieses Setups, damit Mutationen
// aus einem Testfall keine anderen Testfälle beeinflussen.
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
  //     TEST_TENANT_A_USER: normaler Anwalt in Tenant A.
  const tenantAUser: Leistungserbringer = {
    id: TEST_IDS.TENANT_A_USER,
    kanzleiId: TEST_IDS.TENANT_A_ADMIN, // kanzleiId == Admin-Principal
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

  //     TEST_TENANT_B_USER: normaler Anwalt in Tenant B.
  const tenantBUser: Leistungserbringer = {
    id: TEST_IDS.TENANT_B_USER,
    kanzleiId: TEST_IDS.TENANT_B_ADMIN, // kanzleiId == Admin-Principal
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

// ── Hilfsfunktion: Trap abfangen und Message extrahieren ─────────────────────
//
// requireActiveUserAndKanzlei wirft Error bei Guard-Verletzung. Wir fangen
// den Trap ab und geben { trapped, message } zurück, damit der Testfall
// sowohl den Trap-Fakt als auch die exakte Message verifizieren kann.
function captureTrap(fn: () => unknown): { trapped: boolean; message: string } {
  try {
    fn();
    return { trapped: false, message: "" };
  } catch (e) {
    return {
      trapped: true,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

describe("Teil 2 — Security-Regression", () => {
  // ── Test 2.1: Cross-Tenant-Isolation ────────────────────────────────────────
  //
  // TEST-TENANT-A-ADMIN versucht TEST-TENANT-B-USER via
  // removeLeistungserbringer zu deaktivieren. Der Guard
  // canDeactivateLeistungserbringer muss false zurückgeben (caller.kanzleiId
  // != target.kanzleiId) ODER removeLeistungserbringer muss #err
  // zurückgeben. Der target.status muss unverändert 'aktiv' bleiben.
  it("Test 2.1 — Cross-Tenant: Tenant-A-Admin kann Tenant-B-User nicht deaktivieren", () => {
    const testfall = "2.1-CROSS-TENANT";
    const methode =
      "echter Backend-Call-Replik (canDeactivateLeistungserbringer + removeLeistungserbringer)";

    const state = setupFullLandscape();

    const targetBefore = state.users.get(TEST_IDS.TENANT_B_USER);
    expect(targetBefore).toBeDefined();
    expect(targetBefore?.status).toBe("aktiv");

    // (a) canDeactivateLeistungserbringer muss false zurückgeben.
    const canDeactivate = canDeactivateLeistungserbringer(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
      targetBefore!.kanzleiId, // target.kanzleiId == TEST_TENANT_B_ADMIN
    );
    const checkGuard = canDeactivate === false;

    // (b) removeLeistungserbringer muss #err zurückgeben.
    const result = removeLeistungserbringer(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
      TEST_IDS.TENANT_B_USER,
      NOW,
    );
    const checkResult = result.err !== undefined;

    // (c) target.status muss unverändert 'aktiv' bleiben.
    const targetAfter = state.users.get(TEST_IDS.TENANT_B_USER);
    const checkStatus = targetAfter?.status === "aktiv";

    // Assertions (Vitest).
    expect(canDeactivate).toBe(false);
    expect(result.err).toBeDefined();
    expect(result.ok).toBeUndefined();
    expect(targetAfter?.status).toBe("aktiv");

    // Ergebnis-Protokoll.
    const allPass = checkGuard && checkResult && checkStatus;
    const ergebnis = allPass ? "PASS" : "FAIL";
    const beobachtet =
      `canDeactivate=${canDeactivate}, ` +
      `removeLeistungserbringer.err=${String(result.err)}, ` +
      `target.status=${String(targetAfter?.status)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test 2.2: Rollenprüfung ─────────────────────────────────────────────────
  //
  // (a) TEST-TENANT-A-USER (role='anwalt') versucht TEST-TENANT-A-ADMIN zu
  //     deaktivieren → muss abgewiesen werden (deriveRole nicht in
  //     {plattform_admin, admin}).
  // (b) TEST-TENANT-A-ADMIN darf TEST-TENANT-A-USER deaktivieren → success,
  //     target.status='inaktiv'.
  it("Test 2.2 — Rollencheck: nur admin/plattform_admin dürfen deaktivieren", () => {
    const testfall = "2.2-ROLLENCHECK";
    const methode =
      "echter Backend-Call-Replik (canDeactivateLeistungserbringer + removeLeistungserbringer)";

    const state = setupFullLandscape();

    // (a) TEST-TENANT-A-USER (anwalt) versucht TEST-TENANT-A-ADMIN zu
    //     deaktivieren → Guard muss false, removeLeistungserbringer muss
    //     #err, target.status unverändert 'aktiv'.
    const targetAdminBefore = state.users.get(TEST_IDS.TENANT_A_ADMIN);
    expect(targetAdminBefore).toBeDefined();
    expect(targetAdminBefore?.status).toBe("aktiv");

    const canA = canDeactivateLeistungserbringer(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_USER,
      targetAdminBefore!.kanzleiId,
    );
    const resultA = removeLeistungserbringer(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_USER,
      TEST_IDS.TENANT_A_ADMIN,
      NOW,
    );
    const targetAdminAfter = state.users.get(TEST_IDS.TENANT_A_ADMIN);
    const checkA =
      canA === false &&
      resultA.err !== undefined &&
      targetAdminAfter?.status === "aktiv";

    // (b) TEST-TENANT-A-ADMIN darf TEST-TENANT-A-USER deaktivieren →
    //     success, target.status='inaktiv'.
    const targetUserBefore = state.users.get(TEST_IDS.TENANT_A_USER);
    expect(targetUserBefore).toBeDefined();
    expect(targetUserBefore?.status).toBe("aktiv");

    const canB = canDeactivateLeistungserbringer(
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
      targetUserBefore!.kanzleiId,
    );
    const resultB = removeLeistungserbringer(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
      TEST_IDS.TENANT_A_USER,
      NOW,
    );
    const targetUserAfter = state.users.get(TEST_IDS.TENANT_A_USER);
    const checkB =
      canB === true &&
      resultB.ok !== undefined &&
      targetUserAfter?.status === "inaktiv";

    // Assertions (Vitest).
    expect(canA).toBe(false);
    expect(resultA.err).toBeDefined();
    expect(targetAdminAfter?.status).toBe("aktiv");
    expect(canB).toBe(true);
    expect(resultB.ok).toBeDefined();
    expect(resultB.err).toBeUndefined();
    expect(targetUserAfter?.status).toBe("inaktiv");

    // Ergebnis-Protokoll.
    const allPass = checkA && checkB;
    const ergebnis = allPass ? "PASS" : checkA || checkB ? "PARTIAL" : "FAIL";
    const beobachtet =
      `(a) anwalt→admin: canDeactivate=${canA}, err=${String(resultA.err)}, ` +
      `admin.status=${String(targetAdminAfter?.status)}; ` +
      `(b) admin→anwalt: canDeactivate=${canB}, ok=${String(resultB.ok)}, ` +
      `user.status=${String(targetUserAfter?.status)}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test 2.3: Deaktivierter Benutzer (READ + WRITE) ─────────────────────────
  //
  // Vorbedingung: TEST-TENANT-A-USER wird durch TEST-TENANT-A-ADMIN via
  // removeLeistungserbringer deaktiviert (status='inaktiv').
  // (a) getKlienten (READ) muss trappen ('Benutzer ist deaktiviert').
  // (b) createKlient (WRITE) muss trappen ('Benutzer ist deaktiviert').
  //
  // Beide Aufrufe gehen durch requireActiveUserAndKanzlei, das den
  // User-Status prüft (außer Super-Admin).
  it("Test 2.3 — Deaktivierter Benutzer: READ + WRITE trappen", () => {
    const testfall = "2.3-USER-DEACTIVATED";
    const methode =
      "echter Backend-Call-Replik (removeLeistungserbringer + requireActiveUserAndKanzlei via createKlient)";

    const state = setupFullLandscape();

    // Vorbedingung: TEST-TENANT-A-USER durch TEST-TENANT-A-ADMIN
    // deaktivieren.
    const deact = removeLeistungserbringer(
      state.kanzleien,
      state.users,
      state.superAdminWhitelist,
      TEST_IDS.TENANT_A_ADMIN,
      TEST_IDS.TENANT_A_USER,
      NOW,
    );
    expect(deact.ok).toBeDefined();
    const deactivatedUser = state.users.get(TEST_IDS.TENANT_A_USER);
    expect(deactivatedUser?.status).toBe("inaktiv");

    // (a) READ: requireActiveUserAndKanzlei (genutzt von getKlienten-Pfad)
    //     muss trappen mit 'Benutzer ist deaktiviert'.
    const readTrap = captureTrap(() =>
      requireActiveUserAndKanzlei(
        state.users,
        state.kanzleien,
        state.superAdminWhitelist,
        TEST_IDS.TENANT_A_USER,
      ),
    );
    const checkRead =
      readTrap.trapped && readTrap.message === TRAP_MESSAGES.USER_DEACTIVATED;

    // (b) WRITE: createKlient muss trappen mit 'Benutzer ist deaktiviert'.
    const writeTrap = captureTrap(() =>
      createKlient(
        state.klienten,
        state.users,
        state.kanzleien,
        state.superAdminWhitelist,
        TEST_IDS.TENANT_A_USER,
        "Test-Klient",
        "Test-Strasse 1",
        "12345 Teststadt",
        "0301234567",
        "klient@example.com",
        NOW,
      ),
    );
    const checkWrite =
      writeTrap.trapped && writeTrap.message === TRAP_MESSAGES.USER_DEACTIVATED;

    // Assertions (Vitest).
    expect(readTrap.trapped).toBe(true);
    expect(readTrap.message).toBe(TRAP_MESSAGES.USER_DEACTIVATED);
    expect(writeTrap.trapped).toBe(true);
    expect(writeTrap.message).toBe(TRAP_MESSAGES.USER_DEACTIVATED);

    // Ergebnis-Protokoll.
    const allPass = checkRead && checkWrite;
    const ergebnis = allPass
      ? "PASS"
      : checkRead || checkWrite
        ? "PARTIAL"
        : "FAIL";
    const beobachtet =
      `(a) READ getKlienten-Pfad: trapped=${readTrap.trapped}, ` +
      `message='${readTrap.message}'; ` +
      `(b) WRITE createKlient: trapped=${writeTrap.trapped}, ` +
      `message='${writeTrap.message}'`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test 2.4: Deaktivierte Kanzlei (READ + WRITE) ───────────────────────────
  //
  // Vorbedingung: TEST-PLATTFORM-ADMIN deaktiviert TEST-TENANT-A via
  // deactivateKanzlei (status='inaktiv').
  // Danach mit TEST-TENANT-A-ADMIN:
  // (a) getKlienten (READ) muss trappen ('Kanzlei ist deaktiviert').
  // (b) createKlient (WRITE) muss trappen ('Kanzlei ist deaktiviert').
  //
  // Beide Aufrufe gehen durch requireActiveUserAndKanzlei, das den
  // Kanzlei-Status prüft (außer Super-Admin). Der User selbst ist noch
  // 'aktiv' — der Trap kommt ausschliesslich vom Kanzlei-Status.
  it("Test 2.4 — Deaktivierte Kanzlei: READ + WRITE trappen", () => {
    const testfall = "2.4-KANZLEI-DEACTIVATED";
    const methode =
      "echter Backend-Call-Replik (deactivateKanzlei + requireActiveUserAndKanzlei via createKlient)";

    const state = setupFullLandscape();

    // Vorbedingung: TEST-PLATTFORM-ADMIN deaktiviert TEST-TENANT-A.
    // kanzleiId == TEST_TENANT_A_ADMIN (Principal der registrierenden
    // Kanzlei).
    const deact = deactivateKanzlei(
      state.kanzleien,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_A_ADMIN,
    );
    expect(deact.ok).toBeDefined();
    const kanzleiA = state.kanzleien.get(TEST_IDS.TENANT_A_ADMIN);
    expect(kanzleiA?.status).toBe("inaktiv");

    // Der Tenant-A-Admin ist noch 'aktiv' — der Trap muss vom
    // Kanzlei-Status kommen, nicht vom User-Status.
    const adminUser = state.users.get(TEST_IDS.TENANT_A_ADMIN);
    expect(adminUser?.status).toBe("aktiv");

    // (a) READ: requireActiveUserAndKanzlei muss trappen mit
    //     'Kanzlei ist deaktiviert'.
    const readTrap = captureTrap(() =>
      requireActiveUserAndKanzlei(
        state.users,
        state.kanzleien,
        state.superAdminWhitelist,
        TEST_IDS.TENANT_A_ADMIN,
      ),
    );
    const checkRead =
      readTrap.trapped &&
      readTrap.message === TRAP_MESSAGES.KANZLEI_DEACTIVATED;

    // (b) WRITE: createKlient muss trappen mit 'Kanzlei ist deaktiviert'.
    const writeTrap = captureTrap(() =>
      createKlient(
        state.klienten,
        state.users,
        state.kanzleien,
        state.superAdminWhitelist,
        TEST_IDS.TENANT_A_ADMIN,
        "Test-Klient",
        "Test-Strasse 1",
        "12345 Teststadt",
        "0301234567",
        "klient@example.com",
        NOW,
      ),
    );
    const checkWrite =
      writeTrap.trapped &&
      writeTrap.message === TRAP_MESSAGES.KANZLEI_DEACTIVATED;

    // Assertions (Vitest).
    expect(readTrap.trapped).toBe(true);
    expect(readTrap.message).toBe(TRAP_MESSAGES.KANZLEI_DEACTIVATED);
    expect(writeTrap.trapped).toBe(true);
    expect(writeTrap.message).toBe(TRAP_MESSAGES.KANZLEI_DEACTIVATED);

    // Ergebnis-Protokoll.
    const allPass = checkRead && checkWrite;
    const ergebnis = allPass
      ? "PASS"
      : checkRead || checkWrite
        ? "PARTIAL"
        : "FAIL";
    const beobachtet =
      `kanzlei.status=${String(kanzleiA?.status)}, ` +
      `user.status=${String(adminUser?.status)}; ` +
      `(a) READ getKlienten-Pfad: trapped=${readTrap.trapped}, ` +
      `message='${readTrap.message}'; ` +
      `(b) WRITE createKlient: trapped=${writeTrap.trapped}, ` +
      `message='${writeTrap.message}'`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });

  // ── Test 2.5: Plattform-Admin-Rechte ────────────────────────────────────────
  //
  // TEST-PLATTFORM-ADMIN kann:
  // (a) TEST-TENANT-A deaktivieren (deactivateKanzlei → #ok).
  // (b) TEST-TENANT-A reaktivieren (reactivateKanzlei → #ok).
  // (c) TEST-TENANT-B löschen (deleteKanzlei → #ok).
  //
  // Keine Guard-Blockade. Nach deleteKanzlei darf die Kanzlei nicht mehr
  // in state.kanzleien existieren.
  it("Test 2.5 — Plattform-Admin: deactivate/reactivate/delete ohne Guard-Blockade", () => {
    const testfall = "2.5-PLATTFORM-ADMIN";
    const methode =
      "echter Backend-Call-Replik (deactivateKanzlei + reactivateKanzlei + deleteKanzlei)";

    const state = setupFullLandscape();

    // (a) TEST-TENANT-A deaktivieren.
    //
    // WICHTIG: state.kanzleien.get(...) liefert eine OBJEKT-REFERENZ auf die
    // Kanzlei (keine Kopie). reactivateKanzlei mutiert dasselbe Objekt im
    // folgenden Schritt (b). Daher müssen wir den status-Wert als primitive
    // String-Snapshot unmittelbar nach deactivateKanzlei erfassen — sonst
    // würde eine spätere Assertion den bereits reaktivierten Wert lesen.
    const deactA = deactivateKanzlei(
      state.kanzleien,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_A_ADMIN,
    );
    const statusAAfterDeact = state.kanzleien.get(
      TEST_IDS.TENANT_A_ADMIN,
    )?.status;
    const checkA =
      deactA.ok !== undefined &&
      deactA.err === undefined &&
      statusAAfterDeact === "inaktiv";

    // (b) TEST-TENANT-A reaktivieren.
    const reactA = reactivateKanzlei(
      state.kanzleien,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_A_ADMIN,
    );
    const statusAAfterReact = state.kanzleien.get(
      TEST_IDS.TENANT_A_ADMIN,
    )?.status;
    const checkB =
      reactA.ok !== undefined &&
      reactA.err === undefined &&
      statusAAfterReact === "aktiv";

    // (c) TEST-TENANT-B löschen.
    const delB = deleteKanzlei(
      state,
      state.superAdminWhitelist,
      TEST_IDS.PLATTFORM_ADMIN,
      TEST_IDS.TENANT_B_ADMIN,
    );
    const kanzleiBAfterDelete = state.kanzleien.get(TEST_IDS.TENANT_B_ADMIN);
    const checkC =
      delB.ok !== undefined &&
      delB.err === undefined &&
      kanzleiBAfterDelete === undefined;

    // Assertions (Vitest).
    expect(deactA.ok).toBeDefined();
    expect(deactA.err).toBeUndefined();
    expect(statusAAfterDeact).toBe("inaktiv");
    expect(reactA.ok).toBeDefined();
    expect(reactA.err).toBeUndefined();
    expect(statusAAfterReact).toBe("aktiv");
    expect(delB.ok).toBeDefined();
    expect(delB.err).toBeUndefined();
    expect(kanzleiBAfterDelete).toBeUndefined();

    // Ergebnis-Protokoll.
    const allPass = checkA && checkB && checkC;
    const ergebnis = allPass
      ? "PASS"
      : checkA || checkB || checkC
        ? "PARTIAL"
        : "FAIL";
    const beobachtet =
      `(a) deactivateKanzlei(A): ok=${String(deactA.ok)}, ` +
      `status=${String(statusAAfterDeact)}; ` +
      `(b) reactivateKanzlei(A): ok=${String(reactA.ok)}, ` +
      `status=${String(statusAAfterReact)}; ` +
      `(c) deleteKanzlei(B): ok=${String(delB.ok)}, ` +
      `exists=${kanzleiBAfterDelete !== undefined}`;
    logResult(testfall, ergebnis, beobachtet, methode);

    expect(allPass).toBe(true);
  });
});
