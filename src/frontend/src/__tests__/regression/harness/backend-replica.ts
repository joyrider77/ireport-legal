// TypeScript-Replik aller iReport Legal Backend-Funktionen.
//
// Diese Datei spiegelt die reine Backend-Logik aus src/backend/lib/*.mo als
// TypeScript-Funktionen. Alle Funktionen sind PURE — sie nehmen State-Maps
// und Counter als explizite Parameter, mutieren nur die übergebenen Container
// (Map.set, Counter.count+=1) und werfen bei Guard-Verletzungen Error mit
// den exakten deutschen Trap-Messages.
//
// Principals werden als Strings repräsentiert (Principal.toText()). Der
// String-Vergleich entspricht Principal.equal im Backend.
//
// Konventionen:
//   - Guards werfen `new Error(message)` mit exaktem deutschen Wortlaut
//     (entspricht Runtime.trap im Motoko-Backend).
//   - Result<T, Text> wird als Result<T, string> zurückgegeben.
//   - Counter sind mutable { count: number }-Objekte (Pass-by-Reference).
//   - Zeitstempel `now` werden als number (Int in Motoko) übergeben.

import type {
  AboModell,
  AuditLogEntry,
  Auslage,
  BillingStatus,
  ConsentRecord,
  Counter,
  DataFlowEntry,
  DataInventoryEntry,
  DsrRequest,
  GridArea,
  HarnessState,
  InviteToken,
  Kanzlei,
  KanzleiOverview,
  Klient,
  LayoutElement,
  LayoutElementId,
  Leistung,
  Leistungserbringer,
  Mandat,
  Rechnung,
  Rechnungsvorlage,
  Result,
  RetentionPolicy,
  Role,
  SuperAdminWhitelistEntry,
  VorlageLayoutV2,
  Zahlung,
  Zahlungsmodalitaet,
} from "./types";

// ── Trap-Messages (exakt wie im Backend) ────────────────────────────────────
export const TRAP_MESSAGES = {
  USER_NOT_REGISTERED: "Benutzer nicht registriert",
  USER_DEACTIVATED: "Benutzer ist deaktiviert",
  KANZLEI_NOT_FOUND: "Kanzlei nicht gefunden",
  KANZLEI_DEACTIVATED: "Kanzlei ist deaktiviert",
  SUPER_ADMIN_ONLY: "Nur Super-Admins dürfen diese Aktion ausführen",
  SUPER_ADMIN_ONLY_USERS_BY_KANZLEI:
    "Nur Super-Admins dürfen Benutzer beliebiger Kanzleien abfragen",
} as const;

// ── Hilfsfunktion: aktuelles Jahr/Monat ────────────────────────────────────
//
// Im Backend via Time.now() + Calendar-Module. Im Harness übernimmt der
// Aufrufer den `now`-Parameter; diese Hilfsfunktion extrahiert Jahr/Monat
// für statusHistory-Einträge.
function yearOf(now: number): number {
  return new Date(now).getUTCFullYear();
}

function monthOf(now: number): number {
  return new Date(now).getUTCMonth() + 1; // 1..12
}

// ── isSuperAdmin ────────────────────────────────────────────────────────────
//
// whitelist.get(caller) != null
export function isSuperAdmin(
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
): boolean {
  return whitelist.get(caller) !== undefined;
}

// ── autoPromoteFirstSuperAdmin ───────────────────────────────────────────────
//
// false, wenn caller bereits in whitelist ODER whitelist nicht leer.
// Sonst: caller zur whitelist hinzufügen, returns true.
export function autoPromoteFirstSuperAdmin(
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  now: number,
): boolean {
  if (whitelist.get(caller) !== undefined) return false;
  if (whitelist.size > 0) return false;
  whitelist.set(caller, { principal: caller, addedAt: now });
  return true;
}

// ── deriveRole ───────────────────────────────────────────────────────────────
//
// ?r → r; null → (isAdmin ? #admin : #anwalt)
export function deriveRole(isAdmin: boolean, role: Role | null): Role {
  if (role !== null) return role;
  return isAdmin ? "admin" : "anwalt";
}

// ── deriveAboModell ─────────────────────────────────────────────────────────
//
// ?#jahres → #jahres, ?#monats → #monats, null → #keine
export function deriveAboModell(
  zahlungsmodalitaet: Zahlungsmodalitaet | null,
): AboModell {
  if (zahlungsmodalitaet === "jahres") return "jahres";
  if (zahlungsmodalitaet === "monats") return "monats";
  return "keine";
}

// ── deriveBillingStatus ─────────────────────────────────────────────────────
//
// ?_ → #bezahlt, null → #offen
export function deriveBillingStatus(
  zahlungsmodalitaet: Zahlungsmodalitaet | null,
): BillingStatus {
  if (zahlungsmodalitaet === null) return "offen";
  return "bezahlt";
}

// ── maskRoleForCaller ────────────────────────────────────────────────────────
//
// Spiegelt lib/roles.mo maskRoleForCaller: #plattform_admin wird für
// Nicht-Super-Admin-Viewer als #admin zurückgegeben. Super-Admin-Viewer
// sehen die echte Rolle. Andere Rollen bleiben unverändert.
export function maskRoleForCaller(
  role: Role,
  callerIsSuperAdmin: boolean,
): Role {
  if (role === "plattform_admin" && !callerIsSuperAdmin) {
    return "admin";
  }
  return role;
}

// ── getCurrentUser ───────────────────────────────────────────────────────────
//
// Spiegelt lib/kanzlei.mo getCurrentUser: liefert null wenn caller nicht
// registriert (users-Map enthält den Principal nicht mehr — z.B. nach
// Cascade-Delete der Kanzlei). Sonst den Benutzer mit maskierter Rolle.
export function getCurrentUser(
  users: Map<string, Leistungserbringer>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
): Leistungserbringer | null {
  const user = users.get(caller);
  if (user === undefined) return null;
  const callerIsSuperAdmin = isSuperAdmin(whitelist, caller);
  const maskedRole =
    user.role !== null
      ? maskRoleForCaller(user.role, callerIsSuperAdmin)
      : null;
  return { ...user, role: maskedRole };
}

// ── getOrCreateUser ──────────────────────────────────────────────────────────
//
// Spiegelt lib/kanzlei.mo getOrCreateUser: liefert #err wenn caller nicht
// registriert (users-Map enthält den Principal nicht mehr — z.B. nach
// Cascade-Delete der Kanzlei). Kein Auto-Anlegen.
export function getOrCreateUser(
  _kanzleien: Map<string, Kanzlei>,
  users: Map<string, Leistungserbringer>,
  caller: string,
): Result<Leistungserbringer, string> {
  const user = users.get(caller);
  if (user === undefined) {
    return {
      err: "Benutzer nicht registriert — bitte registrieren Sie eine Kanzlei oder lösen Sie einen Einladungslink ein",
    };
  }
  return { ok: user };
}

// ── requireActiveUser ───────────────────────────────────────────────────────
//
// Traps 'Benutzer nicht registriert' / 'Benutzer ist deaktiviert'
// (außer für isSuperAdmin — dieser bypassed die Status-Prüfung).
export function requireActiveUser(
  users: Map<string, Leistungserbringer>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
): Leistungserbringer {
  const user = users.get(caller);
  if (user === undefined) {
    throw new Error(TRAP_MESSAGES.USER_NOT_REGISTERED);
  }
  // Super-Admin bypassed die Status-Prüfung
  if (!isSuperAdmin(whitelist, caller) && user.status !== "aktiv") {
    throw new Error(TRAP_MESSAGES.USER_DEACTIVATED);
  }
  return user;
}

// ── requireActiveUserAndKanzlei ─────────────────────────────────────────────
//
// Same user check + traps 'Kanzlei nicht gefunden' / 'Kanzlei ist deaktiviert'
// (außer für isSuperAdmin).
export function requireActiveUserAndKanzlei(
  users: Map<string, Leistungserbringer>,
  kanzleien: Map<string, Kanzlei>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
): Leistungserbringer {
  const user = requireActiveUser(users, whitelist, caller);
  const kanzlei = kanzleien.get(user.kanzleiId);
  if (kanzlei === undefined) {
    throw new Error(TRAP_MESSAGES.KANZLEI_NOT_FOUND);
  }
  // Super-Admin bypassed die Kanzlei-Status-Prüfung
  if (!isSuperAdmin(whitelist, caller) && kanzlei.status !== "aktiv") {
    throw new Error(TRAP_MESSAGES.KANZLEI_DEACTIVATED);
  }
  return user;
}

// ── isAdminOfKanzlei ────────────────────────────────────────────────────────
//
// super-admin → true; sonst caller.kanzleiId == kanzleiId AND
// deriveRole in {#plattform_admin, #admin}
export function isAdminOfKanzlei(
  users: Map<string, Leistungserbringer>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  kanzleiId: string,
): boolean {
  if (isSuperAdmin(whitelist, caller)) return true;
  const user = users.get(caller);
  if (user === undefined) return false;
  if (user.kanzleiId !== kanzleiId) return false;
  const role = deriveRole(user.isAdmin, user.role);
  return role === "plattform_admin" || role === "admin";
}

// ── canDeactivateLeistungserbringer ──────────────────────────────────────────
//
// super-admin → true; sonst caller registriert,
// caller.kanzleiId == targetKanzleiId, AND deriveRole in
// {#plattform_admin, #admin}
export function canDeactivateLeistungserbringer(
  users: Map<string, Leistungserbringer>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  targetKanzleiId: string,
): boolean {
  if (isSuperAdmin(whitelist, caller)) return true;
  const user = users.get(caller);
  if (user === undefined) return false;
  if (user.kanzleiId !== targetKanzleiId) return false;
  const role = deriveRole(user.isAdmin, user.role);
  return role === "plattform_admin" || role === "admin";
}

// ── registerKanzlei ──────────────────────────────────────────────────────────
//
// kanzleiId = caller.toText(); kanzlei.status = 'aktiv';
// autoPromoteFirstSuperAdmin wenn whitelist leer (role = 'plattform_admin'),
// sonst role = 'admin'. Admin user: isAdmin = true, status = 'aktiv',
// statusHistory = [{year, month, 'aktiv'}].
export function registerKanzlei(
  kanzleien: Map<string, Kanzlei>,
  users: Map<string, Leistungserbringer>,
  superAdminWhitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  name: string,
  adminTitel: string,
  adminVorname: string,
  adminNachname: string,
  adminEmail: string,
  zahlungsmodalitaet: Zahlungsmodalitaet | null,
  now: number,
): Result<string, string> {
  const kanzleiId = caller;

  // Idempotenz: bereits registrierte Kanzlei nicht überschreiben
  if (kanzleien.get(kanzleiId) !== undefined) {
    return { err: "Kanzlei bereits registriert" };
  }

  // autoPromoteFirstSuperAdmin zuerst ausführen
  const promoted = autoPromoteFirstSuperAdmin(superAdminWhitelist, caller, now);
  const role: Role = promoted ? "plattform_admin" : "admin";

  // Kanzlei anlegen
  const kanzlei: Kanzlei = {
    id: kanzleiId,
    name,
    defaultStundensatz: 0,
    zahlungsmodalitaet,
    status: "aktiv",
    createdAt: now,
  };
  kanzleien.set(kanzleiId, kanzlei);

  // Admin-User anlegen
  const adminUser: Leistungserbringer = {
    id: caller,
    kanzleiId,
    vorname: adminVorname,
    nachname: adminNachname,
    titel: adminTitel,
    email: adminEmail,
    isAdmin: true,
    role,
    status: "aktiv",
    registeredAt: now,
    statusHistory: [
      { year: yearOf(now), month: monthOf(now), status: "aktiv" },
    ],
  };
  users.set(caller, adminUser);

  return { ok: kanzleiId };
}

// ── getAllKanzleienOverview ──────────────────────────────────────────────────
//
// Traps 'Nur Super-Admins...' wenn nicht super-admin; maps each kanzlei with
// deriveAboModell + deriveBillingStatus + userCount.
export function getAllKanzleienOverview(
  kanzleien: Map<string, Kanzlei>,
  users: Map<string, Leistungserbringer>,
  caller: string,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
): KanzleiOverview[] {
  if (!isSuperAdmin(whitelist, caller)) {
    throw new Error(TRAP_MESSAGES.SUPER_ADMIN_ONLY);
  }

  const overviews: KanzleiOverview[] = [];
  for (const kanzlei of kanzleien.values()) {
    // userCount: Anzahl Leistungserbringer mit kanzleiId == kanzlei.id
    let userCount = 0;
    for (const user of users.values()) {
      if (user.kanzleiId === kanzlei.id) userCount += 1;
    }
    overviews.push({
      id: kanzlei.id,
      name: kanzlei.name,
      userCount,
      aboModell: deriveAboModell(kanzlei.zahlungsmodalitaet),
      billingStatus: deriveBillingStatus(kanzlei.zahlungsmodalitaet),
      createdAt: kanzlei.createdAt,
      status: kanzlei.status,
    });
  }
  return overviews;
}

// ── getLeistungserbringer ────────────────────────────────────────────────────
//
// Spiegelt lib/kanzlei.mo getLeistungserbringer: liefert alle Benutzer der
// Kanzlei des Callers — IMMER gefiltert nach caller.kanzleiId. Es gibt KEINEN
// Super-Admin-Bypass, der alle Benutzer aller Kanzleien zurückgibt. Ein
// Plattform-Admin sieht hier nur die Benutzer seiner EIGENEN Kanzlei.
//
// Die cross-tenant Plattform-Admin-Sicht wird separat über
// getLeistungserbringerByKanzlei bereitgestellt.
//
// Nicht registrierte Caller (z.B. ehemaliger B-Principal nach Cascade-Delete)
// liefern eine leere Liste — requireActiveUser würde trappen, aber die
// Lese-Sicht soll defensiv leer bleiben, damit die Benutzerverwaltungs-UI
// keine fremden Daten zeigt.
export function getLeistungserbringer(
  users: Map<string, Leistungserbringer>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
): Leistungserbringer[] {
  const callerUser = users.get(caller);
  if (callerUser === undefined) {
    return [];
  }
  const callerKanzleiId = callerUser.kanzleiId;
  const callerIsSuperAdmin = isSuperAdmin(whitelist, caller);

  const result: Leistungserbringer[] = [];
  for (const user of users.values()) {
    if (user.kanzleiId === callerKanzleiId) {
      const maskedRole =
        user.role !== null
          ? maskRoleForCaller(user.role, callerIsSuperAdmin)
          : null;
      result.push({ ...user, role: maskedRole });
    }
  }
  return result;
}

// ── getLeistungserbringerByKanzlei ───────────────────────────────────────────
//
// Super-Admin-only: liefert alle Benutzer der angegebenen kanzleiId. Dies ist
// die cross-tenant Plattform-Admin-Sicht, die im Modul "Plattform-Admin"
// verwendet wird, um jede Kanzlei getrennt anzuzeigen.
//
// Nicht-Super-Admin-Caller werden mit TRAP_MESSAGES.SUPER_ADMIN_ONLY_USERS_BY_KANZLEI
// abgewiesen (Guard-Verletzung).
export function getLeistungserbringerByKanzlei(
  users: Map<string, Leistungserbringer>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  kanzleiId: string,
): Leistungserbringer[] {
  if (!isSuperAdmin(whitelist, caller)) {
    throw new Error(TRAP_MESSAGES.SUPER_ADMIN_ONLY_USERS_BY_KANZLEI);
  }

  const result: Leistungserbringer[] = [];
  for (const user of users.values()) {
    if (user.kanzleiId === kanzleiId) {
      // Super-Admin-Viewer sieht die echte Rolle — keine Maskierung nötig.
      result.push({ ...user });
    }
  }
  return result;
}

// ── countTenantRecords ───────────────────────────────────────────────────────
//
// Hilfsfunktion für Test D (Orphan-Detection): zählt alle tenant-gebundenen
// Datensätze je Datenbereich für die angegebene kanzleiId. Liefert zusätzlich
// die Audit-/Compliance-Counts, damit Tests verifizieren können, dass diese
// nach deleteKanzlei unverändert (historisch) erhalten bleiben.
export interface TenantRecordCounts {
  // Tenant-gebunden (werden via deleteKanzlei cascade-deleted):
  users: number;
  inviteTokens: number;
  klienten: number;
  mandate: number;
  leistungen: number;
  auslagen: number;
  rechnungen: number;
  zahlungen: number;
  rechnungsvorlagen: number;
  // Audit-/Compliance (bleiben historisch erhalten):
  auditLogs: number;
  consentRecords: number;
  dsrRequests: number;
  retentionPolicies: number;
  dataAccessLogs: number;
  dataInventory: number;
  dataFlows: number;
}

export function countTenantRecords(
  state: HarnessState,
  kanzleiId: string,
): TenantRecordCounts {
  const count = <T extends { kanzleiId: string }>(
    m: Map<string, T>,
  ): number => {
    let n = 0;
    for (const entry of m.values()) {
      if (entry.kanzleiId === kanzleiId) n += 1;
    }
    return n;
  };

  // rechnungsvorlagen ist direkt nach kanzleiId geschlüsselt — kein
  // kanzleiId-Feld im Wert, daher direkter Lookup.
  const rechnungsvorlagenCount = state.rechnungsvorlagen.has(kanzleiId) ? 1 : 0;

  // dataAccessLogs ist als Map<string, unknown> typisiert — wir casten auf
  // den bekannten DataAccessLogEntry-Typ, um kanzleiId zu lesen.
  let dataAccessLogsCount = 0;
  for (const entry of state.dataAccessLogs.values()) {
    const dal = entry as DataAccessLogEntry;
    if (dal && typeof dal === "object" && dal.kanzleiId === kanzleiId) {
      dataAccessLogsCount += 1;
    }
  }

  return {
    users: count(state.users),
    inviteTokens: count(state.inviteTokens),
    klienten: count(state.klienten),
    mandate: count(state.mandate),
    leistungen: count(state.leistungen),
    auslagen: count(state.auslagen),
    rechnungen: count(state.rechnungen),
    zahlungen: count(state.zahlungen),
    rechnungsvorlagen: rechnungsvorlagenCount,
    auditLogs: count(state.auditLogs),
    consentRecords: count(state.consentRecords),
    dsrRequests: count(state.dsrRequests),
    retentionPolicies: count(state.retentionPolicies),
    dataAccessLogs: dataAccessLogsCount,
    dataInventory: count(state.dataInventory),
    dataFlows: count(state.dataFlows),
  };
}

// ── removeLeistungserbringer ─────────────────────────────────────────────────
//
// Gated by canDeactivateLeistungserbringer; bei false return #err mit
// deutscher Message; bei success setzt target.status = 'inaktiv' und appended
// statusHistory.
export function removeLeistungserbringer(
  _kanzleien: Map<string, Kanzlei>,
  users: Map<string, Leistungserbringer>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  userId: string,
  now: number,
): Result<null, string> {
  const target = users.get(userId);
  if (target === undefined) {
    return { err: "Benutzer nicht registriert" };
  }

  if (
    !canDeactivateLeistungserbringer(users, whitelist, caller, target.kanzleiId)
  ) {
    return {
      err: "Keine Berechtigung, diesen Leistungserbringer zu deaktivieren",
    };
  }

  target.status = "inaktiv";
  target.statusHistory = [
    ...target.statusHistory,
    { year: yearOf(now), month: monthOf(now), status: "inaktiv" },
  ];
  users.set(userId, target);
  return { ok: null };
}

// ── deactivateKanzlei ────────────────────────────────────────────────────────
//
// Super-admin guard; sets status = 'inaktiv'.
export function deactivateKanzlei(
  kanzleien: Map<string, Kanzlei>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  kanzleiId: string,
): Result<null, string> {
  if (!isSuperAdmin(whitelist, caller)) {
    throw new Error(TRAP_MESSAGES.SUPER_ADMIN_ONLY);
  }
  const kanzlei = kanzleien.get(kanzleiId);
  if (kanzlei === undefined) {
    return { err: "Kanzlei nicht gefunden" };
  }
  kanzlei.status = "inaktiv";
  kanzleien.set(kanzleiId, kanzlei);
  return { ok: null };
}

// ── reactivateKanzlei ────────────────────────────────────────────────────────
//
// Super-admin guard; sets status = 'aktiv'.
export function reactivateKanzlei(
  kanzleien: Map<string, Kanzlei>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  kanzleiId: string,
): Result<null, string> {
  if (!isSuperAdmin(whitelist, caller)) {
    throw new Error(TRAP_MESSAGES.SUPER_ADMIN_ONLY);
  }
  const kanzlei = kanzleien.get(kanzleiId);
  if (kanzlei === undefined) {
    return { err: "Kanzlei nicht gefunden" };
  }
  kanzlei.status = "aktiv";
  kanzleien.set(kanzleiId, kanzlei);
  return { ok: null };
}

// ── deleteKanzlei ────────────────────────────────────────────────────────────
//
// Super-admin guard; atomische Cascade-Delete aller tenant-gebundenen Maps
// (users, inviteTokens, klienten, mandate, leistungen, auslagen, rechnungen,
// zahlungen, rechnungsvorlagen) deren kanzleiId == kanzleiId entspricht.
// kanzleien.remove(kanzleiId) wird ZULETZT ausgeführt (damit ein Fehler
// während der Cascade die Kanzlei nicht teilweise-ohne-Daten hinterlässt).
//
// Audit-/Compliance-Maps (auditLogs, consentRecords, dsrRequests,
// retentionPolicies, dataAccessLogs, dataInventory, dataFlows) bleiben
// HISTORISCH erhalten — kein Cascade-Delete.
export function deleteKanzlei(
  state: HarnessState,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  kanzleiId: string,
): Result<null, string> {
  if (!isSuperAdmin(whitelist, caller)) {
    throw new Error(TRAP_MESSAGES.SUPER_ADMIN_ONLY);
  }
  if (state.kanzleien.get(kanzleiId) === undefined) {
    return { err: "Kanzlei nicht gefunden" };
  }

  // (1) users — alle Leistungserbringer mit kanzleiId == kanzleiId entfernen.
  for (const [id, user] of [...state.users.entries()]) {
    if (user.kanzleiId === kanzleiId) {
      state.users.delete(id);
    }
  }

  // (2) inviteTokens — alle Tokens mit kanzleiId == kanzleiId entfernen.
  for (const [token, invite] of [...state.inviteTokens.entries()]) {
    if (invite.kanzleiId === kanzleiId) {
      state.inviteTokens.delete(token);
    }
  }

  // (3) klienten — alle Klienten mit kanzleiId == kanzleiId entfernen.
  for (const [id, klient] of [...state.klienten.entries()]) {
    if (klient.kanzleiId === kanzleiId) {
      state.klienten.delete(id);
    }
  }

  // (4) mandate — alle Mandate mit kanzleiId == kanzleiId entfernen.
  for (const [id, mandat] of [...state.mandate.entries()]) {
    if (mandat.kanzleiId === kanzleiId) {
      state.mandate.delete(id);
    }
  }

  // (5) leistungen — alle Leistungen mit kanzleiId == kanzleiId entfernen.
  for (const [id, leistung] of [...state.leistungen.entries()]) {
    if (leistung.kanzleiId === kanzleiId) {
      state.leistungen.delete(id);
    }
  }

  // (6) auslagen — alle Auslagen mit kanzleiId == kanzleiId entfernen.
  for (const [id, auslage] of [...state.auslagen.entries()]) {
    if (auslage.kanzleiId === kanzleiId) {
      state.auslagen.delete(id);
    }
  }

  // (7) rechnungen — alle Rechnungen mit kanzleiId == kanzleiId entfernen.
  for (const [id, rechnung] of [...state.rechnungen.entries()]) {
    if (rechnung.kanzleiId === kanzleiId) {
      state.rechnungen.delete(id);
    }
  }

  // (8) zahlungen — alle Zahlungen mit kanzleiId == kanzleiId entfernen.
  for (const [id, zahlung] of [...state.zahlungen.entries()]) {
    if (zahlung.kanzleiId === kanzleiId) {
      state.zahlungen.delete(id);
    }
  }

  // (9) rechnungsvorlagen — direkt nach kanzleiId geschlüsselt.
  state.rechnungsvorlagen.delete(kanzleiId);

  // (10) kanzleien — ZULETZT entfernen.
  state.kanzleien.delete(kanzleiId);

  return { ok: null };
}

// ── logAuditEntry ────────────────────────────────────────────────────────────
//
// Append-only: auditLogs.set(entry.id, entry); nextAuditId.count += 1.
// Audit ID format: 'AUD-{kanzleiId}-{nextAuditId.count}'.
export function logAuditEntry(
  auditLogs: Map<string, AuditLogEntry>,
  nextAuditId: Counter,
  entry: Omit<AuditLogEntry, "id">,
): AuditLogEntry {
  const id = `AUD-${entry.kanzleiId}-${nextAuditId.count}`;
  const fullEntry: AuditLogEntry = { ...entry, id };
  auditLogs.set(id, fullEntry);
  nextAuditId.count += 1;
  return fullEntry;
}

// ── logDataAccess ────────────────────────────────────────────────────────────
//
// id = 'DAL-{kanzleiId}-{nextDataAccessId.count}'; appends; count += 1.
//
// dataAccessLogs ist im Harness als Map<string, unknown> typisiert (die
// genaue DataAccessLog-Struktur ist für die Migration nicht relevant — die
// Migration initialisiert dataAccessLogs als leer). Wir speichern hier ein
// strukturiertes Objekt, damit Tests die Einträge prüfen können.
export interface DataAccessLogEntry {
  id: string;
  kanzleiId: string;
  actorPrincipal: string;
  dataType: string;
  entityId: string;
  action: string;
  timestamp: number;
}

export function logDataAccess(
  dataAccessLogs: Map<string, unknown>,
  nextDataAccessId: Counter,
  kanzleiId: string,
  actorPrincipal: string,
  dataType: string,
  entityId: string,
  action: string,
  now: number,
): DataAccessLogEntry {
  const id = `DAL-${kanzleiId}-${nextDataAccessId.count}`;
  const entry: DataAccessLogEntry = {
    id,
    kanzleiId,
    actorPrincipal,
    dataType,
    entityId,
    action,
    timestamp: now,
  };
  dataAccessLogs.set(id, entry);
  nextDataAccessId.count += 1;
  return entry;
}

// ── createKlient ─────────────────────────────────────────────────────────────
//
// id = 'C-{now}-{size}'; kanzleiId = user.kanzleiId.
// Ruft zuerst requireActiveUserAndKanzlei auf (trappen bei inaktivem
// User/Kanzlei).
export function createKlient(
  klienten: Map<string, Klient>,
  users: Map<string, Leistungserbringer>,
  kanzleien: Map<string, Kanzlei>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  name: string,
  strasse: string,
  plzOrt: string,
  telefon: string,
  email: string,
  now: number,
): Result<Klient, string> {
  const user = requireActiveUserAndKanzlei(users, kanzleien, whitelist, caller);

  const id = `C-${now}-${klienten.size}`;
  const klient: Klient = {
    id,
    kanzleiId: user.kanzleiId,
    name,
    strasse,
    plzOrt,
    telefon,
    email,
    createdAt: now,
  };
  klienten.set(id, klient);
  return { ok: klient };
}

// ── getKlienten ──────────────────────────────────────────────────────────────
//
// filters by k.kanzleiId == user.kanzleiId.
export function getKlienten(
  klienten: Map<string, Klient>,
  user: Leistungserbringer,
): Klient[] {
  const result: Klient[] = [];
  for (const klient of klienten.values()) {
    if (klient.kanzleiId === user.kanzleiId) {
      result.push(klient);
    }
  }
  return result;
}

// ── createLeistung ───────────────────────────────────────────────────────────
//
// mandat must exist + mandat.kanzleiId == user.kanzleiId;
// id = '{kanzleiId}-L-{mandatId}-{now}'; status = #offen.
// Ruft zuerst requireActiveUserAndKanzlei auf.
export function createLeistung(
  leistungen: Map<string, Leistung>,
  mandate: Map<string, Mandat>,
  users: Map<string, Leistungserbringer>,
  kanzleien: Map<string, Kanzlei>,
  whitelist: Map<string, SuperAdminWhitelistEntry>,
  caller: string,
  mandatId: string,
  taetigkeit: string,
  datum: string,
  dauer: number,
  kanzleiDefaultStundensatz: number,
  now: number,
): Result<Leistung, string> {
  const user = requireActiveUserAndKanzlei(users, kanzleien, whitelist, caller);

  const mandat = mandate.get(mandatId);
  if (mandat === undefined) {
    return { err: "Mandat nicht gefunden" };
  }
  if (mandat.kanzleiId !== user.kanzleiId) {
    return { err: "Mandat gehört nicht zu Ihrer Kanzlei" };
  }

  const id = `${user.kanzleiId}-L-${mandatId}-${now}`;
  const honorar = dauer * kanzleiDefaultStundensatz;
  const leistung: Leistung = {
    id,
    mandatId,
    kanzleiId: user.kanzleiId,
    leistungserbringerId: caller,
    taetigkeit,
    datum,
    dauer,
    honorar,
    status: "offen",
    rechnungId: null,
    createdAt: now,
  };
  leistungen.set(id, leistung);
  return { ok: leistung };
}

// ── migrateAuditCounters (Migration 20260809) ────────────────────────────────
//
// Scans old.auditLogs: for each entry.id, splits on '-', takes LAST segment,
// parses Nat, tracks maxCount. nextAuditId.count = maxCount + 1 (1 if empty).
// dataAccessLogs = empty. nextDataAccessId.count = 1.
//
// Begründung für LAST-Segment-Logik: kanzleiIds können selbst '-' enthalten
// (z.B. Principal-Texte). Daher ist nur das letzte Segment verlässlich die
// Count-Nummer.
export interface MigrationResult {
  nextAuditId: Counter;
  dataAccessLogs: Map<string, unknown>;
  nextDataAccessId: Counter;
}

export function migrateAuditCounters(
  auditLogs: Map<string, AuditLogEntry>,
): MigrationResult {
  let maxCount = -1;
  for (const entry of auditLogs.values()) {
    const segments = entry.id.split("-");
    const lastSegment = segments[segments.length - 1];
    const parsed = Number.parseInt(lastSegment, 10);
    if (!Number.isNaN(parsed) && parsed > maxCount) {
      maxCount = parsed;
    }
  }

  const nextAuditId: Counter = { count: maxCount < 0 ? 1 : maxCount + 1 };
  const dataAccessLogs: Map<string, unknown> = new Map();
  const nextDataAccessId: Counter = { count: 1 };

  return { nextAuditId, dataAccessLogs, nextDataAccessId };
}

// ── DEFAULT_LAYOUT_V2 (V2-Layout-Default, spiegelt types/index.ts) ───────────
//
// 12×24 Grid mit allen 11 Rechnungselementen, sichtbar, mit sinnvollen
// Default-Positionen (Logo oben rechts, Absender/Empfänger oben links,
// Leistungspositionen volle Breite, Fusszeile unten zentriert). Das `order`-
// Feld spiegelt die Render-Reihenfolge 0..10. Nat-Felder als bigint (wie in
// den generierten Bindings), LayoutElementId als String-Enum-Wert, alignment
// als "links"|"rechts"|"zentriert"|undefined (entspricht Motoko ?Position).
export const DEFAULT_LAYOUT_V2: VorlageLayoutV2 = {
  gridCols: 12n,
  gridRows: 24n,
  elements: [
    // 0 — Absenderadresse: oben links (row 0, col 0, 3×4)
    {
      id: "absenderadresse",
      visible: true,
      order: 0n,
      gridArea: { row: 0n, col: 0n, rowSpan: 3n, colSpan: 4n },
      alignment: "links",
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 1 — Empfängeradresse: unter der Absenderadresse (row 3, col 0, 3×4)
    {
      id: "empfaengeradresse",
      visible: true,
      order: 1n,
      gridArea: { row: 3n, col: 0n, rowSpan: 3n, colSpan: 4n },
      alignment: "links",
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 2 — Logo: oben rechts (row 0, col 8, 2×4)
    {
      id: "logo",
      visible: true,
      order: 2n,
      gridArea: { row: 0n, col: 8n, rowSpan: 2n, colSpan: 4n },
      alignment: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 3 — Rechnungsmetadaten: oben mitte (row 0, col 4, 3×4)
    {
      id: "rechnungsmetadaten",
      visible: true,
      order: 3n,
      gridArea: { row: 0n, col: 4n, rowSpan: 3n, colSpan: 4n },
      alignment: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 4 — Mandatsinfo: mitte (row 3, col 4, 2×4)
    {
      id: "mandatsinfo",
      visible: true,
      order: 4n,
      gridArea: { row: 3n, col: 4n, rowSpan: 2n, colSpan: 4n },
      alignment: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 5 — Einleitung: volle Breite (row 6, col 0, 2×12)
    {
      id: "einleitung",
      visible: true,
      order: 5n,
      gridArea: { row: 6n, col: 0n, rowSpan: 2n, colSpan: 12n },
      alignment: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 6 — Leistungspositionen: volle Breite (row 8, col 0, 6×12)
    {
      id: "leistungspositionen",
      visible: true,
      order: 6n,
      gridArea: { row: 8n, col: 0n, rowSpan: 6n, colSpan: 12n },
      alignment: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 7 — SpesenAuslagen: volle Breite (row 12, col 0, 2×12)
    {
      id: "spesenAuslagen",
      visible: true,
      order: 7n,
      gridArea: { row: 12n, col: 0n, rowSpan: 2n, colSpan: 12n },
      alignment: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 8 — Summenblock: volle Breite, rechts ausgerichtet (row 14, col 0, 3×12)
    {
      id: "summenblock",
      visible: true,
      order: 8n,
      gridArea: { row: 14n, col: 0n, rowSpan: 3n, colSpan: 12n },
      alignment: "rechts",
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 9 — Zahlungsinformationen: volle Breite (row 17, col 0, 3×12)
    {
      id: "zahlungsinformationen",
      visible: true,
      order: 9n,
      gridArea: { row: 17n, col: 0n, rowSpan: 3n, colSpan: 12n },
      alignment: undefined,
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
    // 10 — Fusszeile: unten, zentriert (row 21, col 0, 3×12)
    {
      id: "fusszeile",
      visible: true,
      order: 10n,
      gridArea: { row: 21n, col: 0n, rowSpan: 3n, colSpan: 12n },
      alignment: "zentriert",
      fontFamily: undefined,
      fontSize: undefined,
      bold: undefined,
      italic: undefined,
    },
  ],
};

// ── VorlageStore — Tenant-isolierte Vorlagen-Speicherung ─────────────────────
//
// Spiegelt die Backend-Tenant-Isolation für Rechnungsvorlagen: jede Kanzlei
// hat genau eine Vorlage, geschlüsselt nach kanzleiId. Der Store ist eine
// dünne Hülle über Map<kanzleiId, Rechnungsvorlage>, die `get` und `save`
// anbietet. `save` validiert, dass vorlage.kanzleiId mit dem Schlüssel
// übereinstimmt (Tenant-Isolation — eine Kanzlei kann keine Vorlage einer
// anderen Kanzlei überschreiben).
export class VorlageStore {
  private readonly store = new Map<string, Rechnungsvorlage>();

  /** Liefert die Vorlage der angegebenen Kanzlei oder undefined. */
  get(kanzleiId: string): Rechnungsvorlage | undefined {
    return this.store.get(kanzleiId);
  }

  /**
   * Speichert die Vorlage unter vorlage.kanzleiId. Cross-Tenant-Schreibversuche
   * sind strukturell ausgeschlossen, da die Map nach kanzleiId geschlüsselt ist.
   */
  save(vorlage: Rechnungsvorlage): void {
    this.store.set(vorlage.kanzleiId, vorlage);
  }

  /** Anzahl gespeicherter Vorlagen (für Tests). */
  get size(): number {
    return this.store.size;
  }

  /** Prüft, ob eine Vorlage für die Kanzlei existiert. */
  has(kanzleiId: string): boolean {
    return this.store.has(kanzleiId);
  }
}

// ── migrateVorlageToV2 — V1→V2 Layout-Migration ─────────────────────────────
//
// Spiegelt die Backend-Migration: wenn eine Alt-Vorlage layoutV2 === null
// hat, wird eine neue Vorlage mit layoutV2 = DEFAULT_LAYOUT_V2 zurückgegeben,
// wobei alle V1-Felder (kanzleiId, layout, standardtexte, logoBlob,
// updatedAt) unverändert erhalten bleiben. Ist layoutV2 bereits vorhanden,
// wird die Vorlage unverändert zurückgegeben (Idempotenz).
export function migrateVorlageToV2(old: Rechnungsvorlage): Rechnungsvorlage {
  if (old.layoutV2 !== null) {
    return old;
  }
  return {
    kanzleiId: old.kanzleiId,
    layout: old.layout,
    standardtexte: old.standardtexte,
    logoBlob: old.logoBlob,
    layoutV2: DEFAULT_LAYOUT_V2,
    updatedAt: old.updatedAt,
  };
}

// ── Convenience: fresh HarnessState ──────────────────────────────────────────
//
// Hilfsfunktion für Tests, um einen leeren State zu erzeugen. Die Migration
// initialisiert nextAuditId/dataAccessLogs/nextDataAccessId — für Tests ohne
// Migration starten wir bei count=1. Alle tenant-gebundenen Maps sowie die
// Audit-/Compliance-Maps werden als leer initialisiert.
export function createFreshState(): HarnessState {
  return {
    kanzleien: new Map(),
    users: new Map(),
    superAdminWhitelist: new Map(),
    klienten: new Map(),
    mandate: new Map(),
    leistungen: new Map(),
    auditLogs: new Map(),
    nextAuditId: { count: 1 },
    dataAccessLogs: new Map(),
    nextDataAccessId: { count: 1 },
    // ── Tenant-gebundene Maps (Cascade-Delete via deleteKanzlei) ──────────────
    auslagen: new Map(),
    rechnungen: new Map(),
    zahlungen: new Map(),
    rechnungsvorlagen: new Map(),
    inviteTokens: new Map(),
    // ── Audit-/Compliance-Maps (bleiben historisch erhalten) ──────────────────
    consentRecords: new Map(),
    dsrRequests: new Map(),
    retentionPolicies: new Map(),
    dataInventory: new Map(),
    dataFlows: new Map(),
  };
}
