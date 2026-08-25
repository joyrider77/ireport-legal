// Migration: fügt die neuen stabilen Support-State-Felder hinzu
//   - supportConversations : Map.Map<SupportConversationId, SupportConversation>
//   - supportMessages : Map.Map<SupportMessageId, SupportMessage>
//   - nextSupportConversationId : { var count : Nat }
//   - nextSupportMessageId : { var count : Nat }
//
// Alle bestehenden Collections bleiben 1:1 unverändert durchgereicht.
// Die neuen Maps werden leer initialisiert (keine bestehenden Support-
// Daten — frisches Feature). Die Zähler starten bei 1.
//
// OldActor entspricht der NewActor des Vorgänger-Files
// (20260812_180000.mo) — d.h. die aktuell deployte State-Shape MIT
// `stammdaten`-Feld auf `Kanzlei`, aber OHNE Support-State.
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

  type Kanzlei = {
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

  // ── Support-Typen (NEU in dieser Migration, inline) ────────────────────────
  type SupportConversationId = Text;
  type SupportMessageId = Text;

  type SupportCategory = {
    #feedback;
    #frage;
    #fehler;
    #verbesserungsvorschlag;
  };

  type SupportStatus = {
    #neu;
    #in_bearbeitung;
    #erledigt;
    #archiviert;
  };

  type SupportSenderType = {
    #user;
    #platformAdmin;
  };

  type SupportConversation = {
    id : SupportConversationId;
    kanzleiId : KanzleiId;
    createdByUserId : Text;
    createdByUserName : Text;
    category : SupportCategory;
    subject : Text;
    status : SupportStatus;
    appRoute : Text;
    appVersion : Text;
    createdAt : Timestamp;
    updatedAt : Timestamp;
  };

  type SupportMessage = {
    id : SupportMessageId;
    conversationId : SupportConversationId;
    senderType : SupportSenderType;
    senderUserId : Text;
    senderUserName : Text;
    message : Text;
    createdAt : Timestamp;
    readAt : ?Timestamp;
  };

  // OldActor: State-Shape VOR dieser Migration (entspricht der NewActor
  // des Vorgänger-Files 20260812_180000.mo). Kanzlei MIT stammdaten-Feld,
  // aber OHNE Support-State.
  type OldActor = {
    kanzleien : Map.Map<KanzleiId, Kanzlei>;
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
  //   - supportConversations : Map.Map<SupportConversationId, SupportConversation> (NEU, leer)
  //   - supportMessages : Map.Map<SupportMessageId, SupportMessage> (NEU, leer)
  //   - nextSupportConversationId : { var count : Nat } (NEU, startet bei 1)
  //   - nextSupportMessageId : { var count : Nat } (NEU, startet bei 1)
  // Alle anderen Collections bleiben unverändert.
  type NewActor = {
    kanzleien : Map.Map<KanzleiId, Kanzlei>;
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
    supportConversations : Map.Map<SupportConversationId, SupportConversation>;
    supportMessages : Map.Map<SupportMessageId, SupportMessage>;
    nextSupportConversationId : { var count : Nat };
    nextSupportMessageId : { var count : Nat };
  };

  // Migration:
  //   - Alle bestehenden Collections 1:1 unverändert durchreichen.
  //   - supportConversations / supportMessages als leere Maps initialisieren
  //     (frisches Feature — keine bestehenden Support-Daten).
  //   - nextSupportConversationId / nextSupportMessageId starten bei 1.
  public func migration(old : OldActor) : NewActor {
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
      nextAuditId = old.nextAuditId;
      dataAccessLogs = old.dataAccessLogs;
      nextDataAccessId = old.nextDataAccessId;
      supportConversations = Map.empty();
      supportMessages = Map.empty();
      nextSupportConversationId = { var count = 1 };
      nextSupportMessageId = { var count = 1 };
    };
  };
};
