// TypeScript-Replik der iReport Legal Backend-Typen.
//
// Diese Typen spiegeln die Motoko-Typen aus src/backend/types/*.mo als
// TypeScript-Äquivalente. Der Harness verwendet Map<string, T> + { count: number }
// State-Objekte anstelle der Motoko Map.Map<K,V> + { var count: Nat }.
//
// WICHTIG: Principals werden im Harness als Strings repräsentiert
// (Principal.toText()). Das vereinfacht den Vergleich und vermeidet eine
// Abhängigkeit von @dfinity/principal in den reinen Logik-Tests. Die
// Backend-Logik vergleicht Principals via Principal.equal — im Harness
// entspricht das einem String-Vergleich.

// ── Zahlungsmodalität & Abo-Modell ──────────────────────────────────────────
export type Zahlungsmodalitaet = "jahres" | "monats";

export type AboModell = "jahres" | "monats" | "keine";

export type BillingStatus = "offen" | "bezahlt" | "ueberfaellig";

// ── Rollen ──────────────────────────────────────────────────────────────────
export type Role =
  | "plattform_admin"
  | "admin"
  | "anwalt"
  | "mitarbeiter"
  | "mandant";

// ── Status-Historie ─────────────────────────────────────────────────────────
export interface StatusHistoryEntry {
  year: number;
  month: number; // 1..12
  status: string; // "aktiv" | "inaktiv"
}

// ── Kanzlei ─────────────────────────────────────────────────────────────────
export interface Kanzlei {
  id: string;
  name: string;
  defaultStundensatz: number;
  zahlungsmodalitaet: Zahlungsmodalitaet | null;
  status: string; // "aktiv" | "inaktiv"
  createdAt: number; // Timestamp (Int in Motoko → number in TS)
}

// ── Leistungserbringer (Benutzer) ──────────────────────────────────────────
export interface Leistungserbringer {
  id: string; // Principal als Text
  kanzleiId: string;
  vorname: string;
  nachname: string;
  titel: string;
  email: string;
  isAdmin: boolean;
  role: Role | null; // null = legacy, via deriveRole ableiten
  status: string; // "aktiv" | "inaktiv"
  registeredAt: number;
  statusHistory: StatusHistoryEntry[];
}

// ── Super-Admin-Whitelist ──────────────────────────────────────────────────
export interface SuperAdminWhitelistEntry {
  principal: string; // Principal als Text
  addedAt: number;
}

// ── Kanzlei-Übersicht (Super-Admin) ─────────────────────────────────────────
export interface KanzleiOverview {
  id: string;
  name: string;
  userCount: number;
  aboModell: AboModell;
  billingStatus: BillingStatus;
  createdAt: number;
  status: string;
}

// ── Klient ─────────────────────────────────────────────────────────────────
export interface Klient {
  id: string;
  kanzleiId: string;
  name: string;
  strasse: string;
  plzOrt: string;
  telefon: string;
  email: string;
  createdAt: number;
}

// ── Mandat ─────────────────────────────────────────────────────────────────
export type MandatStatus = "aktiv" | "archiviert";
export type Auslagenregelung = "Keine" | "Effektiv" | "Pauschal";

export interface Mandat {
  id: string;
  klientId: string;
  kanzleiId: string;
  bezeichnung: string;
  akquisiteurId: string;
  akquisitionsbonus: number;
  mwstSatz: number;
  budget: number;
  rundungAktiv: boolean;
  auslagenregelung: Auslagenregelung;
  pauschalBetrag: number;
  zahlungsbedingungen: string;
  status: MandatStatus;
  waehrung: string;
  standardStundensatz: number;
  kostenProKopie: number;
  kostenProScan: number;
  portoAPost: number;
  portoBPost: number;
  portoEinschreiben: number;
  autokilometer: number;
  leistungenAusweisen: boolean;
  createdAt: number;
}

// ── Leistung ───────────────────────────────────────────────────────────────
export type LeistungStatus = "offen" | "verrechnet";

export interface Leistung {
  id: string;
  mandatId: string;
  kanzleiId: string;
  leistungserbringerId: string;
  taetigkeit: string;
  datum: string;
  dauer: number;
  honorar: number;
  status: LeistungStatus;
  rechnungId: string | null;
  createdAt: number;
}

// ── Audit-Log ──────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  id: string;
  kanzleiId: string;
  actorPrincipal: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: number;
  beforeValue: string | null;
  afterValue: string | null;
}

// ── Rechnungen & Zahlungen (types/rechnungen.mo) ────────────────────────────
export type ZahlungsStatus = "offen" | "bezahlt" | "ueberfaellig";
export type ZahlungEingangStatus = "eingegangen" | "bestaetigt";

export interface Rechnung {
  id: string;
  rechnungsnummer: string;
  kanzleiId: string;
  mandatId: string;
  leistungserbringerId: string;
  rechnungsdatum: string;
  leistungszeitraumVon: string;
  leistungszeitraumBis: string;
  leistungspositionen: string[];
  auslageIds: string[];
  subtotal: number;
  mwstBetrag: number;
  total: number;
  zahlungsbedingungen: string;
  zahlungsstatus: ZahlungsStatus;
  faelligkeitsdatum: string;
  createdAt: number;
}

export interface Zahlung {
  id: string;
  rechnungId: string;
  kanzleiId: string;
  datum: string;
  betrag: number;
  status: ZahlungEingangStatus;
  createdAt: number;
}

// ── Auslagen (types/leistungen.mo) ───────────────────────────────────────────
export type AuslagenKategorie = "porto" | "kopien" | "reise" | "andere";
export type AuslagenStatus = "offen" | "verrechnet";

export interface Auslage {
  id: string;
  mandatId: string;
  kanzleiId: string;
  leistungserbringerId: string;
  beschreibung: string;
  kategorie: AuslagenKategorie;
  betrag: number;
  datum: string;
  status: AuslagenStatus;
  rechnungId: string | null;
  createdAt: number;
}

// ── Rechnungsvorlagen (types/rechnungsvorlagen.mo) ───────────────────────────
// Eine Vorlage pro Kanzlei — direkt nach kanzleiId geschlüsselt.
// logoBlob ist im Harness nicht relevant (ExternalBlob) — wir speichern null.
//
// V2-Layout-Typen (VorlageLayoutV2, LayoutElement, GridArea, LayoutElementId,
// Position) spiegeln die generierten Backend-Bindings (backend.d.ts). Im
// Harness werden Nat-Felder als bigint repräsentiert (wie in den Bindings),
// LayoutElementId als String-Enum-Wert (z.B. "absenderadresse"), Position als
// "links"|"rechts"|"zentriert". alignment ist optional (undefined = Renderer-
// Default), passend zum Motoko ?Position.
export type VorlagePosition = "links" | "rechts" | "zentriert";

// LayoutElementId als String-Enum — spiegelt backend.d.ts enum LayoutElementId.
export type LayoutElementId =
  | "absenderadresse"
  | "empfaengeradresse"
  | "logo"
  | "rechnungsmetadaten"
  | "mandatsinfo"
  | "einleitung"
  | "leistungspositionen"
  | "spesenAuslagen"
  | "summenblock"
  | "zahlungsinformationen"
  | "fusszeile";

// GridArea — Nat-Felder als bigint (wie in den generierten Bindings).
export interface GridArea {
  row: bigint;
  col: bigint;
  rowSpan: bigint;
  colSpan: bigint;
}

// LayoutElement — ein positionierbares Rechnungselement im V2-Grid.
export interface LayoutElement {
  id: LayoutElementId;
  visible: boolean;
  order: bigint;
  gridArea: GridArea;
  alignment: VorlagePosition | undefined;
  fontFamily: string | undefined;
  fontSize: bigint | undefined;
  bold: boolean | undefined;
  italic: boolean | undefined;
}

// VorlageLayoutV2 — 12×24 Grid mit allen 11 Rechnungselementen.
export interface VorlageLayoutV2 {
  gridCols: bigint;
  gridRows: bigint;
  elements: LayoutElement[];
}

export interface Rechnungsvorlage {
  kanzleiId: string;
  layout: {
    absenderPosition: VorlagePosition;
    empfaengerPosition: VorlagePosition;
    logoPosition: VorlagePosition;
    fusszeile: string;
  };
  standardtexte: {
    rechnungstitel: string;
    einleitung: string;
    zahlungshinweis: string;
    schlusstext: string;
  };
  logoBlob: null;
  // V2-Layout (optional — Alt-Vorlagen vor der Migration haben layoutV2=null).
  layoutV2: VorlageLayoutV2 | null;
  updatedAt: number;
}

// ── Invite-Token (types/kanzlei.mo) ─────────────────────────────────────────
export interface InviteToken {
  token: string;
  kanzleiId: string;
  createdBy: string;
  email: string;
  createdAt: number;
  redeemedBy: string | null;
}

// ── Datenschutz: Consent / DSR / Retention / DataInventory / DataFlow ───────
// (types/datenschutz.mo) — diese Maps bleiben bei deleteKanzlei historisch
// erhalten (kein Cascade-Delete). Wir spiegeln sie hier, damit Test D die
// Unveränderlichkeit der Audit-/Compliance-Daten verifizieren kann.
export interface ConsentRecord {
  id: string;
  kanzleiId: string;
  klientId: string;
  consentGiven: boolean;
  timestamp: number;
  dsgVersion: string;
  principal: string;
}

export type DsrType = "auskunft" | "berichtigung" | "loeschung";
export type DsrStatus = "erfasst" | "inBearbeitung" | "abgeschlossen";

export interface DsrRequest {
  id: string;
  kanzleiId: string;
  dsrType: DsrType;
  requesterName: string;
  requesterEmail: string;
  requesterId: string | null;
  status: DsrStatus;
  assignedTo: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  notes: string | null;
}

export interface RetentionPolicy {
  id: string;
  kanzleiId: string;
  categoryName: string;
  retentionYears: number;
  legalBasis: string | null;
  isLocked: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DataInventoryEntry {
  id: string;
  kanzleiId: string;
  categoryName: string;
  storageLocation: string;
  storageDuration: string;
  accessRole: Role;
  description: string | null;
}

export interface DataFlowEntry {
  id: string;
  kanzleiId: string;
  flowName: string;
  what: string;
  destination: string;
  purpose: string;
  legalBasis: string;
  isExternal: boolean;
}

// ── Result<T, E> ────────────────────────────────────────────────────────────
export type Result<T, E> =
  | { ok: T; err?: undefined }
  | { ok?: undefined; err: E };

// ── State-Container ─────────────────────────────────────────────────────────
//
// Der Harness repliziert die Motoko Map.Map<K,V> als JS Map<string, V>.
// Counter ({ var count: Nat } in Motoko) werden als { count: number } mutable
// Objekte repräsentiert (JS-Pass-by-Reference entspricht Motokos var).

export interface Counter {
  count: number;
}

export interface HarnessState {
  kanzleien: Map<string, Kanzlei>;
  users: Map<string, Leistungserbringer>;
  superAdminWhitelist: Map<string, SuperAdminWhitelistEntry>;
  klienten: Map<string, Klient>;
  mandate: Map<string, Mandat>;
  leistungen: Map<string, Leistung>;
  auditLogs: Map<string, AuditLogEntry>;
  nextAuditId: Counter;
  dataAccessLogs: Map<string, unknown>;
  nextDataAccessId: Counter;
  // ── Tenant-gebundene Maps (Cascade-Delete via deleteKanzlei) ──────────────
  auslagen: Map<string, Auslage>;
  rechnungen: Map<string, Rechnung>;
  zahlungen: Map<string, Zahlung>;
  rechnungsvorlagen: Map<string, Rechnungsvorlage>; // keyed by kanzleiId
  inviteTokens: Map<string, InviteToken>; // keyed by token
  // ── Audit-/Compliance-Maps (bleiben historisch erhalten) ──────────────────
  consentRecords: Map<string, ConsentRecord>;
  dsrRequests: Map<string, DsrRequest>;
  retentionPolicies: Map<string, RetentionPolicy>;
  dataInventory: Map<string, DataInventoryEntry>;
  dataFlows: Map<string, DataFlowEntry>;
}

// ── Test-Ergebnis-Protokoll ─────────────────────────────────────────────────
export type TestOutcome = "PASS" | "FAIL" | "PARTIAL" | "NOT TESTABLE";

export interface TestResult {
  id: string;
  description: string;
  outcome: TestOutcome;
  observed: string;
  expected: string;
}
