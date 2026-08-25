// Migration: macht nextAuditId, dataAccessLogs und nextDataAccessId
// upgrade-sicher (transient → stable).
//
// Hintergrund:
//   - nextAuditId war transient (main.mo:79) → reset auf 1 bei Upgrade →
//     post-upgrade logAuditEntry generiert kollidierende Audit-IDs, die
//     bestehende Audit-Einträge überschreiben.
//   - dataAccessLogs war transient (main.mo:73) → alle Zugriffsprotokolle
//     gehen bei Upgrade verloren (relevante Datenschutz-Audit-Daten).
//   - nextDataAccessId war transient (main.mo:82) → reset bei Upgrade.
//
// Diese Migration:
//   - Führt die drei Felder als stable ein (initialwerte aus der Migration,
//     keine Inline-Initialisierer im Actor).
//   - nextAuditId.count = 1 (sicherer Default — bestehende auditLogs bleiben
//     erhalten, neue IDs beginnen bei 1; da IDs "AUD-<kanzleiId>-<count>"
//     formatiert sind, ist eine Kollision nur möglich, wenn bereits Einträge
//     mit count=1 existieren. In diesem Fall würde der nächste Eintrag den
//     bestehenden überschreiben. Die develop-Phase MUSS sicherstellen, dass
//     nextAuditId.count auf max(bestehende count) + 1 initialisiert wird,
//     falls bestehende auditLogs vorhanden sind — dies ist in der Migration
//     durch Scannen von auditLogs zu implementieren.)
//   - dataAccessLogs = leeres Map (bestehende transient-Daten gehen verloren —
//     akzeptiert, da sie vorher ohnehin nicht upgrade-sicher waren).
//   - nextDataAccessId.count = 1.
//
// OldActor entspricht der NewActor des Vorgänger-Files
// (20260727_000000.mo) — d.h. die aktuell deployed State-Shape OHNE die
// drei neuen stable Felder (sie waren transient, also nicht in stable state).
//
// Self-contained: nur mo:core-Imports, keine Projekt-Imports. Die Typen sind
// inline kopiert (die Migration darf keine Projekt-Module importieren — siehe
// migrating-motoko-actors Skill).

import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Text "mo:core/Text";

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

  type NewKanzlei = {
    id : KanzleiId;
    name : Text;
    defaultStundensatz : Nat;
    zahlungsmodalitaet : ?Zahlungsmodalitaet;
    status : Text;
    createdAt : Timestamp;
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

  type Rechnungsvorlage = {
    kanzleiId : KanzleiId;
    layout : VorlageLayout;
    standardtexte : Standardtexte;
    logoBlob : ?Blob;
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

  // OldActor: State-Shape VOR dieser Migration (entspricht der NewActor des
  // Vorgänger-Files 20260727_000000.mo). Enthält KEINE der drei neuen
  // stable Felder (nextAuditId, dataAccessLogs, nextDataAccessId waren
  // transient und damit nicht Teil des stable state).
  type OldActor = {
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
  };

  // NewActor: State-Shape NACH dieser Migration. Fügt die drei neuen stable
  // Felder hinzu:
  //   - nextAuditId : { var count : Nat } — initial max(bestehende count)+1
  //   - dataAccessLogs : Map.Map<DatenschutzId, DataAccessLog> — initial leer
  //   - nextDataAccessId : { var count : Nat } — initial 1
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

  // Migration:
  //   - Alle bestehenden Collections unverändert durchreichen.
  //   - nextAuditId.count = max(bestehende Audit-Log-Count) + 1, gescannt
  //     aus auditLogs (IDs haben Format "AUD-<kanzleiId>-<count>"). Fallback 1,
  //     falls auditLogs leer ist oder kein Eintrag geparst werden konnte.
  //   - dataAccessLogs = leeres Map (bestehende transient-Daten verloren).
  //   - nextDataAccessId.count = 1.
  //
  // Der Scan stellt sicher, dass nach einem Upgrade keine Audit-ID-Kollision
  // auftritt: der nächste vergebene Count liegt strikt über dem höchsten
  // bereits vergebenen Count über ALLE Kanzleien hinweg (IDs sind global
  // eindeutig über "AUD-<kanzleiId>-<count>").
  public func migration(old : OldActor) : NewActor {
    // Scan bestehender auditLogs: extrahiere den count-Teil aus jeder ID
    // (Format "AUD-<kanzleiId>-<count>", wobei kanzleiId selbst '-' enthalten
    // kann — daher der LETZTE '-' ist der Trenner vor count).
    var maxCount : Nat = 0;
    for (entry in old.auditLogs.values()) {
      // Letztes Segment nach '-' extrahieren.
      var lastSegment : ?Text = null;
      for (segment in entry.id.split(#char '-')) {
        lastSegment := ?segment;
      };
      switch (lastSegment) {
        case null {};
        case (?seg) {
          switch (Nat.fromText(seg)) {
            case null {};
            case (?n) {
              if (n > maxCount) { maxCount := n };
            };
          };
        };
      };
    };
    // nextAuditId.count = maxCount + 1 (bei leerem auditLogs: 0 + 1 = 1).
    {
      kanzleien = old.kanzleien;
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
      nextAuditId = { var count = maxCount + 1 };
      dataAccessLogs = Map.empty();
      nextDataAccessId = { var count = 1 };
    };
  };
};
