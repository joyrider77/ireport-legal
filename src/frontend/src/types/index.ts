// ─── Utility Types ─────────────────────────────────────────────────────────
import type { AuslagenStatus, Role, StatusHistoryEntry } from "@/backend";

export type CHFAmount = bigint; // stored in Rappen (1 CHF = 100 Rappen)
export type DateStr = string; // "dd.mm.yyyy"

// ─── Enums ─────────────────────────────────────────────────────────────────
export type MandatStatus = "aktiv" | "archiviert" | "abgeschlossen";
export type LeistungStatus = "offen" | "verrechnet" | "bezahlt";
export type AuslagenKategorie = "porto" | "kopien" | "reise" | "andere";
export type Auslagenregelung = "Keine" | "Effektiv" | "Pauschal";
export type ZahlungsStatus =
  | "ausstehend"
  | "teilbezahlt"
  | "bezahlt"
  | "ueberfaellig";
export type AdminTitel =
  | "Dr."
  | "LL.M."
  | "Rechtsanwalt"
  | "Rechtsanwältin"
  | "Prof.";

// ─── Core Entities ──────────────────────────────────────────────────────────
// `status` und `zahlungsmodalitaet` spiegeln das Backend-Kanzlei-Record
// (backend.d.ts: Kanzlei). `status` ist ein String ("aktiv"/"inaktiv"), die
// optionale `zahlungsmodalitaet` steuert das Abo-Modell (#jahres/#monats/null→#keine).
export type KanzleiStatus = "aktiv" | "inaktiv";
export type Zahlungsmodalitaet = "jahres" | "monats";

export interface Kanzlei {
  id: string;
  name: string;
  defaultStundensatz: CHFAmount;
  status: KanzleiStatus;
  zahlungsmodalitaet?: Zahlungsmodalitaet;
  stammdaten?: KanzleiStammdaten;
  createdAt: bigint;
}

// ─── Kanzlei-Stammdaten (Einstellungen > Kanzleidaten) ──────────────────────
// Spiegelt das Backend-Record KanzleiStammdaten (backend.d.ts). Pflichtfelder
// sind kanzleiname, strasseHausnummer, plz, ort, land; alle weiteren Felder
// sind optional. kanzleiLogoBlob ist ein optionales Byte-Array und STRICT
// GETRENNT vom Rechnungslogo (Rechnungsvorlage.logoBlob / useUploadLogo) —
// das Kanzlei-Logo wird über updateKanzleiStammdaten persistiert, nicht über
// die Rechnungslogo-Hooks.
export interface KanzleiStammdaten {
  kanzleiname: string;
  strasseHausnummer: string;
  plz: string;
  ort: string;
  land: string;
  telefon?: string;
  email?: string;
  website?: string;
  uid?: string;
  mwstNr?: string;
  kanzleiLogoBlob?: Uint8Array;
}

// ─── Status-Historisierung ──────────────────────────────────────────────────
// StatusHistoryEntry wird aus @/backend re-exportiert (siehe unten im
// Datenschutz-Block). Pro Eintrag wird der Benutzerstatus (z.B. "aktiv" /
// "inaktiv") für einen konkreten Monat (Jahr, Monat 1–12) festgehalten. Das
// Backend berechnet daraus den pro-Monat isActive-Flag in ActiveUserEntry —
// das Frontend rechnet NICHT selbst nach.

export interface Leistungserbringer {
  id: string;
  kanzleiId: string;
  vorname: string;
  nachname: string;
  titel: string;
  email: string;
  isAdmin: boolean;
  role?: Role;
  status: string;
  statusHistory: StatusHistoryEntry[];
  registeredAt: bigint;
}

// ─── Super-Admin / Plattform-Admin Types ─────────────────────────────────────
// These mirror the backend types in types/super-admin.mo and types/roles.mo.
//
// AboModell is a string-valued TypeScript enum in the generated bindings
// (backend.d.ts: `export enum AboModell { jahres = "jahres", ... }`). The
// Candid decoder (backend.ts from_candid_AboModell_n82) returns the enum
// value AboModell.jahres / .monats / .keine at runtime — NOT a
// { __kind__: "jahres" } discriminated-union object. We re-export the enum
// (value + type) from @/backend so frontend code can use AboModell.jahres as
// a runtime value and as a type, mirroring the LayoutElementId pattern
// (see line 307 below).
//
// BillingStatus is NOT exported as an enum by the generated bindings — it
// appears only as a field type (backend.d.ts line 86). The Candid decoder
// (backend.ts from_candid_BillingStatus_n81) delegates to the same variant
// decoder as ZahlungsStatus (from_candid_variant_n67), which returns a
// plain string enum value ("offen" / "bezahlt" / "ueberfaellig") at runtime.
// We therefore define BillingStatus as a local string-union type that
// mirrors the actual runtime shape, consistent with the regression-test
// harness (harness/types.ts line 18). Using a { __kind__: ... } union here
// would be wrong: the runtime value is a bare string, so abo.__kind__ /
// status.__kind__ would be undefined and badges would always fall to the
// default branch.
import type { AboModell } from "@/backend";
export { AboModell } from "@/backend";

export type BillingStatus = "offen" | "bezahlt" | "ueberfaellig";

export interface KanzleiOverview {
  id: string;
  name: string;
  userCount: bigint;
  aboModell: AboModell;
  billingStatus: BillingStatus;
  status: string;
  createdAt: bigint;
}

export interface SuperAdminWhitelistEntry {
  principal: string; // Principal.toText() in the frontend boundary
  addedAt: bigint;
}

// ─── Active Users Types ──────────────────────────────────────────────────────
// Re-exported from backend.d.ts (already generated for getActiveUsersPerMonth
// and getAllActiveUsersPerMonth).
export type {
  ActiveUserEntry,
  ActiveUserMonth,
  ActiveUsersYearReport,
  AllKanzleienActiveUsersReport,
} from "@/backend";

// ─── Role Migration Types ─────────────────────────────────────────────────────
export interface RoleMigrationResult {
  principal: string; // Principal.toText() in the frontend boundary
  previousRole: Role;
  newRole: Role;
  changed: boolean;
}

export interface MigrationSummary {
  results: RoleMigrationResult[];
  convertedCount: bigint;
  unchangedCount: bigint;
}

export interface InviteToken {
  token: string;
  kanzleiId: string;
  email: string;
  createdBy: string;
  createdAt: bigint;
  redeemedBy?: string;
}

export interface Klient {
  id: string;
  kanzleiId: string;
  name: string;
  strasse: string;
  plzOrt: string;
  telefon: string;
  email: string;
  createdAt: bigint;
}

export interface Mandat {
  id: string;
  klientId: string;
  kanzleiId: string;
  bezeichnung: string;
  status: MandatStatus;
  akquisiteurId: string;
  akquisitionsbonus: CHFAmount;
  mwstSatz: CHFAmount; // stored as integer * 100 (e.g., 810 = 8.1%)
  budget: CHFAmount;
  rundungAktiv: boolean;
  auslagenregelung: Auslagenregelung;
  pauschalBetrag: CHFAmount; // Pauschalbetrag in Rappen (nur bei Auslagenregelung "Pauschal")
  zahlungsbedingungen: string;
  waehrung: string;
  standardStundensatz: CHFAmount;
  kostenProKopie: number;
  kostenProScan: number;
  portoAPost: number;
  portoBPost: number;
  portoEinschreiben: number;
  autokilometer: number;
  leistungenAusweisen: boolean;
  createdAt: bigint;
}

export interface Leistung {
  id: string;
  mandatId: string;
  kanzleiId: string;
  leistungserbringerId: string;
  datum: DateStr;
  taetigkeit: string;
  dauer: bigint;
  honorar: bigint;
  status: string;
  rechnungId?: string;
  createdAt: bigint;
}

export interface Auslage {
  id: string;
  mandatId: string;
  kanzleiId: string;
  leistungserbringerId: string;
  datum: DateStr;
  kategorie: AuslagenKategorie;
  beschreibung: string;
  betrag: CHFAmount;
  status: string;
  rechnungId?: string;
  createdAt: bigint;
}

export interface Rechnung {
  id: string;
  rechnungsnummer: string;
  mandatId: string;
  kanzleiId: string;
  leistungserbringerId: string;
  rechnungsdatum: DateStr;
  faelligkeitsdatum: DateStr;
  leistungspositionen: string[];
  auslageIds: string[];
  subtotal: CHFAmount;
  mwstBetrag: CHFAmount;
  total: CHFAmount;
  waehrung: string;
  zahlungsstatus: string;
  zahlungsbedingungen: string;
  leistungszeitraumVon: DateStr;
  leistungszeitraumBis: DateStr;
  createdAt: bigint;
}

export interface Zahlung {
  id: string;
  rechnungId: string;
  datum: DateStr;
  betrag: CHFAmount;
  status: string;
  kanzleiId: string;
  createdAt: bigint;
}

// ─── Filter Types ────────────────────────────────────────────────────────────
export interface LeistungFilter {
  leistungserbringerId?: string;
  mandatId?: string;
  status?: string;
  datumVon?: DateStr;
  datumBis?: DateStr;
}

export interface AuslagenFilter {
  leistungserbringerId?: string;
  mandatId?: string;
  status?: AuslagenStatus;
  datumVon?: DateStr;
  datumBis?: DateStr;
}

export interface RechnungFilter {
  leistungserbringerId?: string;
  mandatId?: string;
  zahlungsstatus?: string;
  datumVon?: DateStr;
  datumBis?: DateStr;
}

// ─── Report Types ─────────────────────────────────────────────────────────
export interface MonthlyTotal {
  month: bigint;
  year: bigint;
  honorar: bigint;
  auslagen: bigint;
  verrechnete: bigint;
  total: bigint;
}

export interface ProviderComparison {
  provider: Leistungserbringer;
  total: bigint;
}

export interface ProviderReport {
  totals: MonthlyTotal;
  monthlyBreakdown: MonthlyTotal[];
  comparisonData: ProviderComparison[];
}

export interface FirmReport {
  totals: MonthlyTotal;
  monthlyBreakdown: MonthlyTotal[];
}

export interface GehaltInfo {
  provider: Leistungserbringer;
  leistungsbasiert: bigint;
  akquisitionsboni: bigint;
  kanzleianteil: bigint;
  gesamtgehalt: bigint;
}

// ─── Rechnungsvorlagen Types ──────────────────────────────────────────────────
// Re-exported from backend.d.ts (the source of truth). Rechnungsvorlage backs
// the per-kanzlei invoice template editor (one vorlage per kanzlei). Position
// is the Motoko #links/#rechts/#zentriert variant, exposed as a TS enum by the
// generated bindings.
//
// V2 layout types (LayoutElementId, GridArea, LayoutElement, VorlageLayoutV2)
// are ALSO re-exported from @/backend. The generated bindings represent the
// Motoko #tag variant LayoutElementId as a string-valued TypeScript enum
// (e.g. LayoutElementId.absenderadresse === "absenderadresse"), NOT as a
// __kind__ discriminated union. We re-export that enum directly so frontend
// code stays compatible with the actor's candid (de)serialization. The
// Rechnungsvorlage type already includes the optional `layoutV2` field in the
// generated bindings, so useSaveRechnungsvorlage accepts the extended shape
// without any signature change.
export type {
  Rechnungsvorlage,
  VorlageLayout,
  Standardtexte,
  Position,
  VorlageLayoutV2,
  LayoutElement,
  GridArea,
} from "@/backend";

// LayoutElementId is a string enum in the generated bindings — re-export it as
// a value (not just a type) so callers can use `LayoutElementId.absenderadresse`
// as a runtime value and as a type.
export { LayoutElementId } from "@/backend";

// ─── Frontend-only Schlusstext-Element (Fix 4) ────────────────────────────────
// Das Backend-LayoutElementId-Enum hat KEIN schlusstext-Mitglied (siehe
// backend.d.ts: nur absenderadresse, empfaengeradresse, logo,
// rechnungsmetadaten, mandatsinfo, einleitung, leistungspositionen,
// spesenAuslagen, summenblock, zahlungsinformationen, fusszeile). Der Editor
// (LayoutCanvas + RechnungsvorlagenPage) soll 'Schlusstext' aber als eigenes
// wählbares/verschiebbares/resizbares Element anbieten, ohne das Backend-Enum
// erweitern zu müssen.
//
// Lösung: Ein FRONTEND-ONLY Schlusstext-Element-Typ. Wir führen eine eigene
// Konstante SCHLUSSTEXT_ELEMENT_ID = "schlusstext" und einen geweiteten
// FrontendLayoutElementId-Typ ein, der die Backend-Enum-Werte ODER
// "schlusstext" zulässt. FrontendLayoutElement / FrontendVorlageLayoutV2
// spiegeln die Backend-Typen, aber mit dem geweiteten id-Feld.
//
// Persistenz: Das Schlusstext-Element wird VOR dem Speichern an das Backend
// aus dem elements-Array entfernt (normalizeLayoutV2ForSave in
// RechnungsvorlagenPage filtert id === "schlusstext" heraus). Der eigentliche
// Schlusstext-Text bleibt im legacy-Feld standardtexte.schlusstext gespeichert,
// das der Backend bereits kennt. Der Word-Export (export.ts) rendert den
// Schlusstext als eigenständigen Absatz-Komplex NACH den Zahlungsinformationen,
// nicht in einer gemeinsamen Zelle/einem gemeinsamen Container mit dem
// Zahlungshinweis (Fix 4 DOCX-seitige Trennung).
//
// Abwärtskompatibilität: Alte Vorlagen ohne Schlusstext-Element (alle Vorlagen,
// die vor diesem Fix gespeichert wurden) laden ohne Schlusstext-Element. Der
// Editor fügt beim Laden kein Schlusstext-Element automatisch ein — nur
// DEFAULT_LAYOUT_V2 (neue Vorlagen) enthält es. Der Word-Export fällt in
// diesem Fall auf das Legacy-Verhalten zurück: der Schlusstext wird als
// eigenständiger Block nach den Zahlungsinformationen gerendert (Textquelle:
// standardtexte.schlusstext), unabhängig davon, ob ein Schlusstext-Element im
// Layout existiert oder nicht. Kein Crash, kein Datenverlust.
export const SCHLUSSTEXT_ELEMENT_ID = "schlusstext" as const;

/**
 * FrontendLayoutElementId — die Backend-LayoutElementId-Enum erweitert um den
 * frontend-only Wert "schlusstext". Wird im Editor (LayoutCanvas,
 * RechnungsvorlagenPage) verwendet; das Backend sieht diesen Wert nie (er wird
 * vor dem Speichern herausgefiltert).
 */
export type FrontendLayoutElementId =
  | LayoutElementIdT
  | typeof SCHLUSSTEXT_ELEMENT_ID;

/**
 * FrontendLayoutElement — wie LayoutElement, aber id ist
 * FrontendLayoutElementId (erlaubt "schlusstext"). Alle anderen Felder
 * identisch zum Backend-Typ.
 *
 * Implementiert als Omit<LayoutElement, "id"> & { id: FrontendLayoutElementId }
 * (nicht als `extends LayoutElement`), weil FrontendLayoutElementId die
 * Backend-LayoutElementId um "schlusstext" weitet und damit NICHT zu
 * LayoutElementId assignable ist — `extends LayoutElement` wäre strukturell
 * ungültig (TS2430). Die Omit+Intersection-Form tauscht gezielt das id-Feld
 * aus und lässt alle anderen Felder identisch.
 */
export type FrontendLayoutElement = Omit<LayoutElementT, "id"> & {
  id: FrontendLayoutElementId;
};

/**
 * FrontendVorlageLayoutV2 — wie VorlageLayoutV2, aber elements ist
 * FrontendLayoutElement[] (erlaubt schlusstext-Elemente im Editor).
 */
export interface FrontendVorlageLayoutV2
  extends Omit<VorlageLayoutV2T, "elements"> {
  elements: FrontendLayoutElement[];
}

import type {
  LayoutElementId as LayoutElementIdT,
  LayoutElement as LayoutElementT,
  Position as PositionT,
  Rechnungsvorlage as RechnungsvorlageT,
  Standardtexte as StandardtexteT,
  VorlageLayout as VorlageLayoutT,
  VorlageLayoutV2 as VorlageLayoutV2T,
} from "@/backend";
import { LayoutElementId as LayoutElementIdEnum } from "@/backend";

/**
 * DEFAULT_VORLAGE — sensible starting values for a new kanzlei vorlage.
 * Used by the editor when no vorlage has been saved yet. The backend stores
 * one vorlage per kanzlei; this default mirrors the Swiss legal invoicing
 * conventions (Rechnungstitel, 30-Tage-Zahlungsziel, etc.).
 */
export const DEFAULT_VORLAGE: RechnungsvorlageT = {
  kanzleiId: "",
  layout: {
    absenderPosition: "links" as PositionT,
    empfaengerPosition: "links" as PositionT,
    logoPosition: "links" as PositionT,
    fusszeile: "",
  } as VorlageLayoutT,
  standardtexte: {
    rechnungstitel: "Rechnung",
    einleitung:
      "Wir danken Ihnen für Ihren Auftrag und stellen Ihnen für die erbrachten Leistungen in Rechnung:",
    zahlungshinweis:
      "Zahlbar innerhalb von 30 Tagen ab Rechnungsdatum auf das unten angegebene Konto.",
    schlusstext:
      "Für Rückfragen stehen wir Ihnen gerne zur Verfügung. Mit freundlichen Grüssen",
  } as StandardtexteT,
  logoBlob: undefined,
  updatedAt: BigInt(0),
};

// ─── V2-Layout Defaults & Helpers ────────────────────────────────────────────
// DEFAULT_LAYOUT_V2 mirrors the backend defaultLayoutV2() in
// types/rechnungsvorlagen.mo: a 12×24 grid with all 10 Rechnungselemente
// visible, sensible default grid positions (Logo oben rechts, Absender/Empfänger
// oben links, Leistungspositionen volle Breite, Fusszeile unten zentriert), and
// the `order` field reflecting the top-to-bottom render order (0..9). The
// editor falls back to this when a kanzlei has no layoutV2 saved yet.
//
// P2.7/P2.8/P2.9 — Die VorlageLayoutV2 speichert die Seitenränder in mm
// (marginTopMm, marginBottomMm, marginLeftMm, marginRightMm) und die
// Dokumentgeometrie (pageWidthMm=210, pageHeightMm=297 für A4 Hochformat).
// Jedes LayoutElement hat optionale mm-Felder (xMm, yMm, widthMm, heightMm)
// sowie zOrder für die Stapelreihenfolge. Die gridArea bleibt als
// Raster-Referenz erhalten; die mm-Felder sind die persistente
// Dokumentgeometrie, die der Word-Export verwendet.
//
// NOTE: the generated bindings use `bigint` for Nat fields (order, gridCols,
// gridRows, col, row, rowSpan, colSpan, zOrder) and the string enum
// LayoutElementId / Position for the Motoko #tag variants. alignment is
// optional (undefined = renderer default), matching the `?Position` Motoko
// option. Die mm-Felder sind `number` (Float) gemäss backend.d.ts.

// A4 Hochformat: 210 × 297 mm (DIN ISO 216). Diese Konstanten sind die
// persistente Dokumentgeometrie — die UI-Skalierung (Zoom) verändert nur die
// Bildschirmdarstellung, niemals diese Werte.
export const A4_PAGE_WIDTH_MM = 210;
export const A4_PAGE_HEIGHT_MM = 297;

// Standard-Seitenränder in mm. Default 20 mm (P2.9), Min/Max 5–40 mm.
export const DEFAULT_MARGIN_MM = 20;
export const MIN_MARGIN_MM = 5;
export const MAX_MARGIN_MM = 40;

export const DEFAULT_LAYOUT_V2: FrontendVorlageLayoutV2 = {
  gridCols: BigInt(12),
  gridRows: BigInt(24),
  // P2.9 — Seitenränder in mm, persistent in layoutV2.
  marginTopMm: DEFAULT_MARGIN_MM,
  marginBottomMm: DEFAULT_MARGIN_MM,
  marginLeftMm: DEFAULT_MARGIN_MM,
  marginRightMm: DEFAULT_MARGIN_MM,
  // P2.7 — A4 Hochformat Dokumentgeometrie.
  pageWidthMm: A4_PAGE_WIDTH_MM,
  pageHeightMm: A4_PAGE_HEIGHT_MM,
  elements: [
    // 0 — Absenderadresse: oben links (row 0, col 0, 3×4)
    {
      id: LayoutElementIdEnum.absenderadresse,
      visible: true,
      order: BigInt(0),
      gridArea: {
        row: BigInt(0),
        col: BigInt(0),
        rowSpan: BigInt(3),
        colSpan: BigInt(4),
      },
      alignment: "links" as PositionT,
      // P2.8 — mm-Koordinaten (persistent, UI-Skalierung ändert diese nicht).
      xMm: 20,
      yMm: 20,
      widthMm: 70,
      heightMm: 37,
      zOrder: BigInt(0),
    },
    // 1 — Empfängeradresse: unter der Absenderadresse (row 3, col 0, 3×4)
    {
      id: LayoutElementIdEnum.empfaengeradresse,
      visible: true,
      order: BigInt(1),
      gridArea: {
        row: BigInt(3),
        col: BigInt(0),
        rowSpan: BigInt(3),
        colSpan: BigInt(4),
      },
      alignment: "links" as PositionT,
      xMm: 20,
      yMm: 57,
      widthMm: 70,
      heightMm: 37,
      zOrder: BigInt(1),
    },
    // 2 — Logo: oben rechts (row 0, col 8, 2×4)
    {
      id: LayoutElementIdEnum.logo,
      visible: true,
      order: BigInt(2),
      gridArea: {
        row: BigInt(0),
        col: BigInt(8),
        rowSpan: BigInt(2),
        colSpan: BigInt(4),
      },
      alignment: undefined,
      xMm: 120,
      yMm: 20,
      widthMm: 70,
      heightMm: 25,
      zOrder: BigInt(2),
    },
    // 3 — Rechnungsmetadaten: oben mitte (row 0, col 4, 3×4)
    {
      id: LayoutElementIdEnum.rechnungsmetadaten,
      visible: true,
      order: BigInt(3),
      gridArea: {
        row: BigInt(0),
        col: BigInt(4),
        rowSpan: BigInt(3),
        colSpan: BigInt(4),
      },
      alignment: undefined,
      xMm: 90,
      yMm: 20,
      widthMm: 30,
      heightMm: 37,
      zOrder: BigInt(3),
    },
    // 4 — Mandatsinfo: mitte (row 3, col 4, 2×4)
    {
      id: LayoutElementIdEnum.mandatsinfo,
      visible: true,
      order: BigInt(4),
      gridArea: {
        row: BigInt(3),
        col: BigInt(4),
        rowSpan: BigInt(2),
        colSpan: BigInt(4),
      },
      alignment: undefined,
      xMm: 90,
      yMm: 57,
      widthMm: 30,
      heightMm: 25,
      zOrder: BigInt(4),
    },
    // 5 — Einleitung: volle Breite (row 6, col 0, 2×12)
    {
      id: LayoutElementIdEnum.einleitung,
      visible: true,
      order: BigInt(5),
      gridArea: {
        row: BigInt(6),
        col: BigInt(0),
        rowSpan: BigInt(2),
        colSpan: BigInt(12),
      },
      alignment: undefined,
      xMm: 20,
      yMm: 94,
      widthMm: 170,
      heightMm: 25,
      zOrder: BigInt(5),
    },
    // 6 — Leistungspositionen: volle Breite (row 8, col 0, 6×12)
    {
      id: LayoutElementIdEnum.leistungspositionen,
      visible: true,
      order: BigInt(6),
      gridArea: {
        row: BigInt(8),
        col: BigInt(0),
        rowSpan: BigInt(4),
        colSpan: BigInt(12),
      },
      alignment: undefined,
      xMm: 20,
      yMm: 119,
      widthMm: 170,
      heightMm: 50,
      zOrder: BigInt(6),
    },
    // 7 — Spesen/Auslagen: volle Breite, zwischen Leistungspositionen und
    // Summenblock (row 12, col 0, 2×12). Zeigt die Auslagen der Rechnung
    // (Datum, Beschreibung/Art, Betrag). Enthält keine eigene Berechnungslogik.
    {
      id: LayoutElementIdEnum.spesenAuslagen,
      visible: true,
      order: BigInt(7),
      gridArea: {
        row: BigInt(12),
        col: BigInt(0),
        rowSpan: BigInt(2),
        colSpan: BigInt(12),
      },
      alignment: undefined,
      xMm: 20,
      yMm: 169,
      widthMm: 170,
      heightMm: 25,
      zOrder: BigInt(7),
    },
    // 8 — Summenblock: volle Breite, rechts ausgerichtet (row 14, col 0, 3×12)
    {
      id: LayoutElementIdEnum.summenblock,
      visible: true,
      order: BigInt(8),
      gridArea: {
        row: BigInt(14),
        col: BigInt(0),
        rowSpan: BigInt(3),
        colSpan: BigInt(12),
      },
      alignment: "rechts" as PositionT,
      xMm: 20,
      yMm: 194,
      widthMm: 170,
      heightMm: 37,
      zOrder: BigInt(8),
    },
    // 9 — Zahlungsinformationen: volle Breite (row 17, col 0, 3×12)
    {
      id: LayoutElementIdEnum.zahlungsinformationen,
      visible: true,
      order: BigInt(9),
      gridArea: {
        row: BigInt(17),
        col: BigInt(0),
        rowSpan: BigInt(3),
        colSpan: BigInt(12),
      },
      alignment: undefined,
      xMm: 20,
      yMm: 231,
      widthMm: 170,
      heightMm: 37,
      zOrder: BigInt(9),
    },
    // 10 — Schlusstext: frontend-only Element (Fix 4). Eigenes, separat
    // verschiebbares/resizbares Element im Editor, NACH den
    // Zahlungsinformationen. Der Text kommt aus dem legacy-Feld
    // standardtexte.schlusstext (vom Backend bereits gekannt); das Element
    // selbst wird vor dem Speichern an das Backend herausgefiltert
    // (normalizeLayoutV2ForSave in RechnungsvorlagenPage). Alte Vorlagen
    // ohne dieses Element laden ohne Schlusstext-Element — der Word-Export
    // fällt in diesem Fall auf das Legacy-Verhalten zurück (Schlusstext als
    // eigenständiger Block nach Zahlungsinformationen, Textquelle
    // standardtexte.schlusstext). Default-Geometrie: gleiche Breite/xMm wie
    // Zahlungsinformationen, darunter (yMm 268 → verschoben auf 268, Höhe 25).
    {
      id: SCHLUSSTEXT_ELEMENT_ID,
      visible: true,
      order: BigInt(10),
      gridArea: {
        row: BigInt(20),
        col: BigInt(0),
        rowSpan: BigInt(2),
        colSpan: BigInt(12),
      },
      alignment: undefined,
      xMm: 20,
      yMm: 268,
      widthMm: 170,
      heightMm: 25,
      zOrder: BigInt(10),
    },
    // 11 — Fusszeile: unten, zentriert (row 21, col 0, 3×12)
    {
      id: LayoutElementIdEnum.fusszeile,
      visible: true,
      order: BigInt(11),
      gridArea: {
        row: BigInt(21),
        col: BigInt(0),
        rowSpan: BigInt(3),
        colSpan: BigInt(12),
      },
      alignment: "zentriert" as PositionT,
      xMm: 20,
      yMm: 293,
      widthMm: 170,
      heightMm: 25,
      zOrder: BigInt(11),
    },
  ],
};

// ─── Font helpers for V2 layout typography ──────────────────────────────────
// The V2 layout editor lets the admin choose a font family and size per
// LayoutElement. The allowed values are constrained to a small set of
// PDF-safe fonts and standard point sizes. `fontStack` maps a chosen family
// to a CSS font-stack string (with sensible fallbacks) used both in the
// live preview and applied as inline style on canvas elements. Arial is the
// default when no family is selected (undefined).

export const ALLOWED_FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
] as const;

export const ALLOWED_FONT_SIZES = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24,
] as const;

const FONT_STACKS: Record<string, string> = {
  Helvetica: "Helvetica, Arial, sans-serif",
  "Times New Roman": "Times New Roman, Times, serif",
  Arial: "Arial, sans-serif",
};

/**
 * fontStack — map a chosen font family to a CSS font-stack string with
 * fallbacks. Returns the Arial stack for undefined/unknown families so the
 * preview always has a valid font-family.
 */
export function fontStack(family?: string): string {
  return (family != null && FONT_STACKS[family]) || "Arial, sans-serif";
}

// ─── mm-Koordinaten-Hilfsfunktionen (P2.8) ──────────────────────────────────
// Die Dokumentgeometrie wird intern in Millimetern gespeichert (xMm, yMm,
// widthMm, heightMm, marginTopMm etc.). Die UI-Skalierung (Zoom) rechnet
// Pixel-Offsets beim Drag/Resize in mm zurück, sodass die gespeicherten
// Dokumentmaße von der Bildschirmdarstellung entkoppelt sind.
//
// pxPerMm berechnet sich aus der aktuellen Leinwand-Breite in Pixeln und der
// A4-Seitenbreite in mm (pageWidthMm). Für die Höhe gilt analog
// pxPerMm = canvasHeightPx / pageHeightMm. Da A4 das Verhältnis 210:297
// erzwingt (P2.10), sind beide Skalierungen identisch, solange die Leinwand
// proportionale Skalierung verwendet.

/**
 * mmToPx — rechnet Millimeter in Bildschirm-Pixel um, gegeben eine
 * pxPerMm-Skala (Leinwand-Pixel pro mm). Wird für die Darstellung verwendet.
 */
export function mmToPx(mm: number, pxPerMm: number): number {
  return mm * pxPerMm;
}

/**
 * pxToMm — rechnet Bildschirm-Pixel in Millimeter um. Wird beim Drag/Resize
 * verwendet, um Pixel-Offsets in persistente mm-Koordinaten zurückzurechnen.
 * Rundet auf 0.1 mm Genauigkeit.
 */
export function pxToMm(px: number, pxPerMm: number): number {
  if (pxPerMm <= 0) return 0;
  return Math.round((px / pxPerMm) * 10) / 10;
}

/**
 * computePxPerMm — berechnet die pxPerMm-Skala aus der Leinwand-Breite in
 * Pixeln und der A4-Seitenbreite in mm. Für proportionale A4-Darstellung
 * (P2.10) ist dies die einheitliche Skala für X und Y.
 */
export function computePxPerMm(
  canvasWidthPx: number,
  pageWidthMm: number,
): number {
  if (pageWidthMm <= 0) return 1;
  return canvasWidthPx / pageWidthMm;
}

/**
 * ptToPx — rechnet Punkt (Schriftgrösse) in Bildschirm-Pixel um, gegeben
 * eine pxPerMm-Skala. 1 pt = 1/72 inch, 1 inch = 25.4 mm. Die visuelle
 * Darstellung folgt dem Dokumentmassstab (P2.10), sodass Schriftgrössen bei
 * jeder UI-Zoomstufe proportional korrekt dargestellt werden.
 */
export function ptToPx(pt: number, pxPerMm: number): number {
  const mmPerPt = 25.4 / 72;
  return pt * mmPerPt * pxPerMm;
}

// Human-readable German labels for each LayoutElementId, used by the element
// palette and the live preview in the V2 layout editor. The keys are the
// string enum values from the generated bindings (e.g. "absenderadresse")
// plus the frontend-only "schlusstext" id (Fix 4).
const LAYOUT_ELEMENT_ID_LABELS: Record<FrontendLayoutElementId, string> = {
  [LayoutElementIdEnum.absenderadresse]: "Absenderadresse",
  [LayoutElementIdEnum.empfaengeradresse]: "Empfängeradresse",
  [LayoutElementIdEnum.logo]: "Logo",
  [LayoutElementIdEnum.rechnungsmetadaten]: "Rechnungsmetadaten",
  [LayoutElementIdEnum.mandatsinfo]: "Mandatsinformationen",
  [LayoutElementIdEnum.einleitung]: "Einleitung",
  [LayoutElementIdEnum.leistungspositionen]: "Leistungspositionen",
  [LayoutElementIdEnum.spesenAuslagen]: "Spesen/Auslagen",
  [LayoutElementIdEnum.summenblock]: "Summen-/MWST-Block",
  [LayoutElementIdEnum.zahlungsinformationen]: "Zahlungsinformationen",
  [LayoutElementIdEnum.fusszeile]: "Fusszeile",
  [SCHLUSSTEXT_ELEMENT_ID]: "Schlusstext",
};

/**
 * layoutElementIdToString — maps a LayoutElementId enum value (or the
 * frontend-only "schlusstext" id) to a human-readable German label for
 * display in the editor UI.
 */
export function layoutElementIdToString(id: FrontendLayoutElementId): string {
  return LAYOUT_ELEMENT_ID_LABELS[id] ?? String(id);
}

/**
 * stringToLayoutElementId — reverse mapping from a label or enum string back
 * to the LayoutElementId enum value (or the frontend-only "schlusstext" id).
 * Accepts both the German label and the raw enum string (e.g.
 * "absenderadresse", "schlusstext"). Returns null for unknown labels.
 */
export function stringToLayoutElementId(
  s: string,
): FrontendLayoutElementId | null {
  // Fast path: frontend-only "schlusstext" id (not in the backend enum).
  if (s === SCHLUSSTEXT_ELEMENT_ID) return SCHLUSSTEXT_ELEMENT_ID;
  // Then try the raw enum string (fast path for persisted values).
  const enumValues: FrontendLayoutElementId[] = [
    LayoutElementIdEnum.absenderadresse,
    LayoutElementIdEnum.empfaengeradresse,
    LayoutElementIdEnum.logo,
    LayoutElementIdEnum.rechnungsmetadaten,
    LayoutElementIdEnum.mandatsinfo,
    LayoutElementIdEnum.einleitung,
    LayoutElementIdEnum.leistungspositionen,
    LayoutElementIdEnum.spesenAuslagen,
    LayoutElementIdEnum.summenblock,
    LayoutElementIdEnum.zahlungsinformationen,
    LayoutElementIdEnum.fusszeile,
    SCHLUSSTEXT_ELEMENT_ID,
  ];
  for (const v of enumValues) {
    if (v === s) return v;
  }
  // Then try matching by German label.
  for (const v of enumValues) {
    if (LAYOUT_ELEMENT_ID_LABELS[v] === s) return v;
  }
  return null;
}

// ─── Datenschutz (revDSG) Types ──────────────────────────────────────────────
// Re-exported from backend.d.ts (the source of truth). The backend uses the
// real `Principal` type and enum variants, so frontend code that touches these
// types must convert string principals via `Principal.fromText()` at the actor
// call boundary.
export type {
  AuditLogEntry,
  ConsentRecord,
  DsrRequest,
  DsrType,
  DsrStatus,
  RetentionPolicy,
  DataAccessAction,
  DataInventoryEntry,
  DataFlowEntry,
  DsgVersion,
  DashboardStats,
  AuditTrailFilter,
  Role,
  StatusHistoryEntry,
} from "@/backend";

// ─── Timer & Budget Types ────────────────────────────────────────────────────
// Re-exported from backend.d.ts (the source of truth). TimerState backs the
// stopwatch feature (startTimer/stopTimer/getTimer/listTimers); BudgetSummary
// backs the per-mandate budget overview (getBudgetSummary/getBudgetSummaries).
export type { TimerState, BudgetSummary } from "@/backend";

// Pending deletion tuple: [categoryName, entityId, dueTimestamp]
export type PendingDeletion = [string, string, bigint];

// ─── Feedback & Support Types ───────────────────────────────────────────────
// Re-exported from backend.d.ts (the source of truth). The generated bindings
// represent the Motoko #tag variants SupportCategory / SupportSenderType /
// SupportStatus as string-valued TypeScript enums (e.g.
// SupportCategory.feedback === "feedback"), NOT as __kind__ discriminated
// unions. We re-export the enums as values (not just types) so callers can use
// SupportCategory.feedback as a runtime value and as a type, mirroring the
// AboModell / LayoutElementId pattern above.
export type {
  SupportConversation,
  SupportConversationId,
  SupportConversationWithMessages,
  SupportMessage,
  SupportMessageId,
} from "@/backend";
export {
  SupportCategory,
  SupportSenderType,
  SupportStatus,
} from "@/backend";

// ─── Registrierung / E-Mail-Verifizierung Types ──────────────────────────────
// Re-exported from backend.d.ts (the source of truth). PendingRegistrationView
// backs the 3-step registration flow (Kanzlei & Person → E-Mail bestätigen →
// Internet Identity verbinden). It is the sanitized view returned by
// getPendingRegistration — it omits the sensitive verificationCodeHash (and
// verificationExpiresAt) and only carries the emailVerified/email/person data
// the reload-recovery needs. VerificationError is a string-valued enum of the
// backend verification failure variants; we re-export it as a value (not just
// a type) so callers can switch on VerificationError.invalidCode etc.
export type {
  PendingRegistrationView,
  PendingRegistrationId,
} from "@/backend";
export { VerificationError } from "@/backend";
