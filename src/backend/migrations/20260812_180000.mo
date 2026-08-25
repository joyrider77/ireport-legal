// Migration: erweitert den stabilen `Kanzlei`-Record um das neue optionale
// Feld `stammdaten : ?KanzleiStammdaten` (Workstream A: Einstellungen >
// Kanzleidaten).
//
// Hintergrund: Bisher gab es keine persistente Ablage für
// Kanzlei-Stammdaten (Kanzleiname, Strasse/Hausnummer, PLZ, Ort, Land,
// Telefon, E-Mail, Website, UID, MWST-Nr., allgemeines Kanzlei-Logo).
// Diese werden künftig pro Kanzlei tenant-isoliert gespeichert und über
// die Endpunkte getKanzleiStammdaten (query) / updateKanzleiStammdaten
// (admin-gated update) exponiert. kanzleiLogoBlob ist STRIKT GETRENNT
// vom Rechnungslogo (logoBlob in rechnungsvorlagen) — diese Migration
// berührt rechnungsvorlagen NICHT.
//
// Änderung an der stable-Shape:
//   - `Kanzlei` erhält das neue optionale Feld `stammdaten : ?KanzleiStammdaten`.
//   - Der neue Typ `KanzleiStammdaten` wird inline definiert (self-contained).
//   - Für bestehende Kanzlei-Einträge wird `stammdaten = null` gesetzt
//     (noch keine Stammdaten erfasst — der Admin kann sie später via
//     updateKanzleiStammdaten erfassen).
//   - Alle anderen Collections bleiben 1:1 unverändert durchgereicht.
//
// OldActor entspricht der NewActor des Vorgänger-Files
// (20260812_162245.mo) — d.h. die aktuell deployte State-Shape MIT
// `#schlusstext`-Variante in `LayoutElementId`, aber OHNE `stammdaten`-
// Feld auf `Kanzlei`.
//
// Self-contained: nur mo:core-Imports, keine Projekt-Imports. Die Typen
// sind inline kopiert (die Migration darf keine Projekt-Module
// importieren — siehe migrating-motoko-actors Skill).

import Map "mo:core/Map";

module {
  // ── Inline-Typen (self-contained) ──────────────────────────────────────────
  type Timestamp = Int;
  type KanzleiId = Text;
  type KlientId = Text;
  type MandatId = Text;
  type LeistungId = Text;
  type AuslageId = Text;
  type RechnungId = Text;
  type ZahlungId = Text;
  type AuditLogId = Text;
  type ConsentId = Text;
  type DatenschutzId = Text;

  type Zahlungsmodalitaet = { #jahres; #monats };

  type Role = {
    #plattform_admin;
    #admin;
    #anwalt;
    #mitarbeiter;
    #mandant;
  };

  type StatusHistoryEntry = {
    year : Nat;
    month : Nat;
    status : Text;
  };

  // KanzleiStammdaten: NEU in dieser Migration. Optional pro Kanzlei
  // (stammdaten : ?KanzleiStammdaten). Pflichtfelder (kanzleiname,
  // strasseHausnummer, plz, ort, land) werden beim Speichern via
  // lib/kanzlei.validateStammdaten validiert — die Migration selbst
  // legt keine Stammdaten an (stammdaten = null für bestehende Kanzleien).
  type KanzleiStammdaten = {
    kanzleiname : Text;
    strasseHausnummer : Text;
    plz : Text;
    ort : Text;
    land : Text;
    telefon : Text;
    email : Text;
    website : Text;
    uid : Text;
    mwstNr : Text;
    kanzleiLogoBlob : ?Blob;
  };

  // OldKanzlei: Shape VOR dieser Migration (ohne stammdaten-Feld).
  // Entspricht dem Kanzlei-Typ aus der Vorgänger-Migration
  // (20260812_162245.mo).
  type OldKanzlei = {
    id : KanzleiId;
    name : Text;
    defaultStundensatz : Nat;
    zahlungsmodalitaet : ?Zahlungsmodalitaet;
    status : Text;
    createdAt : Timestamp;
  };

  // NewKanzlei: Shape NACH dieser Migration (mit stammdaten-Feld).
  type NewKanzlei = {
    id : KanzleiId;
    name : Text;
    defaultStundensatz : Nat;
    zahlungsmodalitaet : ?Zahlungsmodalitaet;
    status : Text;
    createdAt : Timestamp;
    stammdaten : ?KanzleiStammdaten;
  };

  type Leistungserbringer = {
    id : Principal;
    kanzleiId : KanzleiId;
    vorname : Text;
    nachname : Text;
    titel : Text;
    email : Text;
    isAdmin : Bool;
    role : ?Role;
    status : Text;
    registeredAt : Timestamp;
    statusHistory : [StatusHistoryEntry];
  };

  type InviteToken = {
    token : Text;
    kanzleiId : KanzleiId;
    createdBy : Principal;
    email : Text;
    createdAt : Timestamp;
    redeemedBy : ?Principal;
  };

  type SuperAdminWhitelistEntry = {
    principal : Principal;
    addedAt : Timestamp;
  };

  type Klient = {
    id : KlientId;
    kanzleiId : KanzleiId;
    name : Text;
    strasse : Text;
    plzOrt : Text;
    telefon : Text;
    email : Text;
    createdAt : Timestamp;
  };

  type MandatStatus = { #aktiv; #archiviert };
  type Auslagenregelung = { #Keine; #Effektiv; #Pauschal };

  type Mandat = {
    id : MandatId;
    klientId : KlientId;
    kanzleiId : KanzleiId;
    bezeichnung : Text;
    akquisiteurId : Principal;
    akquisitionsbonus : Nat;
    mwstSatz : Nat;
    budget : Nat;
    rundungAktiv : Bool;
    auslagenregelung : Auslagenregelung;
    pauschalBetrag : Nat;
    zahlungsbedingungen : Text;
    status : MandatStatus;
    waehrung : Text;
    standardStundensatz : Nat;
    kostenProKopie : Float;
    kostenProScan : Float;
    portoAPost : Float;
    portoBPost : Float;
    portoEinschreiben : Float;
    autokilometer : Float;
    leistungenAusweisen : Bool;
    createdAt : Timestamp;
  };

  type LeistungStatus = { #offen; #verrechnet };
  type AuslagenKategorie = { #porto; #kopien; #reise; #andere };
  type AuslagenStatus = { #offen; #verrechnet };

  type Leistung = {
    id : LeistungId;
    mandatId : MandatId;
    kanzleiId : KanzleiId;
    leistungserbringerId : Principal;
    taetigkeit : Text;
    datum : Text;
    dauer : Nat;
    honorar : Nat;
    status : LeistungStatus;
    rechnungId : ?RechnungId;
    createdAt : Timestamp;
  };

  type Auslage = {
    id : AuslageId;
    mandatId : MandatId;
    kanzleiId : KanzleiId;
    leistungserbringerId : Principal;
    beschreibung : Text;
    kategorie : AuslagenKategorie;
    betrag : Nat;
    datum : Text;
    status : AuslagenStatus;
    rechnungId : ?RechnungId;
    createdAt : Timestamp;
  };

  type ZahlungsStatus = { #offen; #bezahlt; #ueberfaellig };
  type ZahlungEingangStatus = { #eingegangen; #bestaetigt };

  type Rechnung = {
    id : RechnungId;
    rechnungsnummer : Text;
    kanzleiId : KanzleiId;
    mandatId : MandatId;
    leistungserbringerId : Principal;
    rechnungsdatum : Text;
    leistungszeitraumVon : Text;
    leistungszeitraumBis : Text;
    leistungspositionen : [LeistungId];
    auslageIds : [AuslageId];
    subtotal : Nat;
    mwstBetrag : Nat;
    total : Nat;
    waehrung : Text;
    zahlungsbedingungen : Text;
    zahlungsstatus : ZahlungsStatus;
    faelligkeitsdatum : Text;
    createdAt : Timestamp;
  };

  type Zahlung = {
    id : ZahlungId;
    rechnungId : RechnungId;
    kanzleiId : KanzleiId;
    datum : Text;
    betrag : Nat;
    status : ZahlungEingangStatus;
    createdAt : Timestamp;
  };

  type Position = { #links; #rechts; #zentriert };

  type VorlageLayout = {
    absenderPosition : Position;
    empfaengerPosition : Position;
    logoPosition : Position;
    fusszeile : Text;
  };

  type Standardtexte = {
    rechnungstitel : Text;
    einleitung : Text;
    zahlungshinweis : Text;
    schlusstext : Text;
  };

  // ── V2-Layout-Typen (inline, self-contained) ───────────────────────────────
  // LayoutElementId inkl. #schlusstext (entspricht der Vorgänger-Migration).
  type LayoutElementId = {
    #absenderadresse;
    #empfaengeradresse;
    #logo;
    #rechnungsmetadaten;
    #mandatsinfo;
    #einleitung;
    #leistungspositionen;
    #spesenAuslagen;
    #summenblock;
    #zahlungsinformationen;
    #schlusstext;
    #fusszeile;
  };

  type GridArea = {
    row : Nat;
    col : Nat;
    rowSpan : Nat;
    colSpan : Nat;
  };

  type LayoutElement = {
    id : LayoutElementId;
    visible : Bool;
    order : Nat;
    gridArea : GridArea;
    alignment : ?Position;
    fontFamily : ?Text;
    fontSize : ?Nat;
    bold : ?Bool;
    italic : ?Bool;
    xMm : ?Float;
    yMm : ?Float;
    widthMm : ?Float;
    heightMm : ?Float;
    zOrder : ?Nat;
  };

  type VorlageLayoutV2 = {
    elements : [LayoutElement];
    gridCols : Nat;
    gridRows : Nat;
    marginTopMm : Float;
    marginBottomMm : Float;
    marginLeftMm : Float;
    marginRightMm : Float;
    pageWidthMm : Float;
    pageHeightMm : Float;
  };

  type Rechnungsvorlage = {
    kanzleiId : KanzleiId;
    layout : VorlageLayout;
    standardtexte : Standardtexte;
    logoBlob : ?Blob;
    layoutV2 : ?VorlageLayoutV2;
    updatedAt : Timestamp;
  };

  type AuditLogEntry = {
    id : AuditLogId;
    kanzleiId : KanzleiId;
    actorPrincipal : Principal;
    action : Text;
    entityType : Text;
    entityId : Text;
    timestamp : Timestamp;
    beforeValue : ?Text;
    afterValue : ?Text;
  };

  type ConsentRecord = {
    id : ConsentId;
    kanzleiId : KanzleiId;
    klientId : KlientId;
    consentGiven : Bool;
    timestamp : Timestamp;
    dsgVersion : Text;
    principal : Principal;
  };

  type DataAccessAction = { #lesen; #schreiben; #loeschen };

  type DataAccessLog = {
    id : DatenschutzId;
    kanzleiId : KanzleiId;
    actorPrincipal : Principal;
    dataType : Text;
    entityId : Text;
    action : DataAccessAction;
    timestamp : Timestamp;
  };

  // OldActor: State-Shape VOR dieser Migration (entspricht der NewActor
  // des Vorgänger-Files 20260812_162245.mo). Kanzlei OHNE stammdaten-Feld.
  type OldActor = {
    kanzleien : Map.Map<KanzleiId, OldKanzlei>;
    users : Map.Map<Principal, Leistungserbringer>;
    inviteTokens : Map.Map<Text, InviteToken>;
    superAdminWhitelist : Map.Map<Principal, SuperAdminWhitelistEntry>;
    klienten : Map.Map<KlientId, Klient>;
    mandate : Map.Map<MandatId, Mandat>;
    leistungen : Map.Map<LeistungId, Leistung>;
    auslagen : Map.Map<AuslageId, Auslage>;
    rechnungen : Map.Map<RechnungId, Rechnung>;
    zahlungen : Map.Map<ZahlungId, Zahlung>;
    rechnungsvorlagen : Map.Map<KanzleiId, Rechnungsvorlage>;
    rechnungsNummer : { var count : Nat };
    auditLogs : Map.Map<AuditLogId, AuditLogEntry>;
    consentRecords : Map.Map<ConsentId, ConsentRecord>;
    nextAuditId : { var count : Nat };
    dataAccessLogs : Map.Map<DatenschutzId, DataAccessLog>;
    nextDataAccessId : { var count : Nat };
  };

  // NewActor: State-Shape NACH dieser Migration. Einzig Änderung:
  //   - kanzleien : Map.Map<KanzleiId, NewKanzlei>
  //     wobei NewKanzlei das neue optionale Feld
  //     stammdaten : ?KanzleiStammdaten trägt. Für bestehende Kanzleien
  //     wird stammdaten = null gesetzt (keine Stammdaten erfasst). Alle
  //     anderen Collections bleiben unverändert.
  type NewActor = {
    kanzleien : Map.Map<KanzleiId, NewKanzlei>;
    users : Map.Map<Principal, Leistungserbringer>;
    inviteTokens : Map.Map<Text, InviteToken>;
    superAdminWhitelist : Map.Map<Principal, SuperAdminWhitelistEntry>;
    klienten : Map.Map<KlientId, Klient>;
    mandate : Map.Map<MandatId, Mandat>;
    leistungen : Map.Map<LeistungId, Leistung>;
    auslagen : Map.Map<AuslageId, Auslage>;
    rechnungen : Map.Map<RechnungId, Rechnung>;
    zahlungen : Map.Map<ZahlungId, Zahlung>;
    rechnungsvorlagen : Map.Map<KanzleiId, Rechnungsvorlage>;
    rechnungsNummer : { var count : Nat };
    auditLogs : Map.Map<AuditLogId, AuditLogEntry>;
    consentRecords : Map.Map<ConsentId, ConsentRecord>;
    nextAuditId : { var count : Nat };
    dataAccessLogs : Map.Map<DatenschutzId, DataAccessLog>;
    nextDataAccessId : { var count : Nat };
  };

  // Hilfsfunktion: wandelt eine OldKanzlei in eine NewKanzlei um, indem
  // das neue optionale Feld stammdaten = null gesetzt wird (bestehende
  // Kanzleien haben noch keine Stammdaten erfasst). Alle anderen Felder
  // bleiben 1:1 unverändert.
  func upgradeKanzlei(old : OldKanzlei) : NewKanzlei {
    {
      id = old.id;
      name = old.name;
      defaultStundensatz = old.defaultStundensatz;
      zahlungsmodalitaet = old.zahlungsmodalitaet;
      status = old.status;
      createdAt = old.createdAt;
      stammdaten = null;
    };
  };

  // Migration:
  //   - kanzleien: neues Map aufbauen, in dem jeder Eintrag eine NewKanzlei
  //     ist (mit stammdaten = null). Bestehende Kanzleien laden fehlerfrei
  //     als neuer Typ; der Admin kann später via updateKanzleiStammdaten
  //     Stammdaten erfassen.
  //   - Alle anderen Collections unverändert durchreichen.
  //   - rechnungsvorlagen (inkl. logoBlob) werden NICHT berührt — die
  //     Tenant-Isolation und die Rechnungslogo-Persistenz bleiben
  //     unangetastet (keine Regression).
  public func migration(old : OldActor) : NewActor {
    let newKanzleien = Map.empty<KanzleiId, NewKanzlei>();
    for ((kanzleiId, oldKanzlei) in old.kanzleien.entries()) {
      newKanzleien.add(kanzleiId, upgradeKanzlei(oldKanzlei));
    };
    {
      kanzleien = newKanzleien;
      users = old.users;
      inviteTokens = old.inviteTokens;
      superAdminWhitelist = old.superAdminWhitelist;
      klienten = old.klienten;
      mandate = old.mandate;
      leistungen = old.leistungen;
      auslagen = old.auslagen;
      rechnungen = old.rechnungen;
      zahlungen = old.zahlungen;
      rechnungsvorlagen = old.rechnungsvorlagen;
      rechnungsNummer = old.rechnungsNummer;
      auditLogs = old.auditLogs;
      consentRecords = old.consentRecords;
      nextAuditId = old.nextAuditId;
      dataAccessLogs = old.dataAccessLogs;
      nextDataAccessId = old.nextDataAccessId;
    };
  };
};
