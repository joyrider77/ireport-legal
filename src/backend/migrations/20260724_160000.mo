// Migration: fügt das neue Feld statusHistory: [StatusHistoryEntry] zu jedem
// Leistungserbringer hinzu und erweitert die Role-Variante um #plattform_admin.
//
// Diese Migration ist erforderlich, weil Leistungserbringer ein neues stabiles
// Feld (statusHistory) erhält — Initialwerte müssen aus der Migration kommen
// (enhanced orthogonal persistence, keine Inline-Initialisierer im Actor).
// Die Role-Varianten-Erweiterung (#plattform_admin) ist stable-kompatibel,
// wird aber zusammen mit der Feld-Erweiterung in dieser einen Migration
// abgehandelt (at most one pending migration per build).
//
// OldActor spiegelt die NewActor des Vorgänger-Migrations-Files
// (20260724_102008.mo) — d.h. die aktuell deployed State-Shape. NewActor
// enumeriert alle 14 stable Felder aus main.mo mit den neuen Typen.
//
// Pass-through-Strategie:
//   - Alle Collections werden 1:1 durchgereicht.
//   - users wird über .map transformiert: jeder Leistungserbringer erhält
//     statusHistory = [] (leere Liste — Legacy-Benutzer ohne Historie).
//     Die Fallback-Logik in lib/active-users.isUserActiveInMonth greift für
//     diese Benutzer auf den aktuellen status + Registrierungsmonat zurück.
//   - Die erste Registrierung (Joao Marques) wird NICHT hier migriert —
//     die Auto-Beförderung zum Plattform-Admin erfolgt beim Registrierungs-
//     Pffad (lib/kanzlei.registerKanzlei via autoPromoteFirstSuperAdmin).
//     Bestehende Admins (isAdmin=true, role=?#admin) bleiben Admins und
//     werden NICHT zu #plattform_admin migriert (per Anforderung).
//
// Self-contained: nur mo:core-Imports, keine Projekt-Imports.

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

  type Zahlungsmodalitaet = { #jahres; #monats };

  // NEU: Role-Variante um #plattform_admin erweitert.
  type Role = {
    #plattform_admin;
    #admin;
    #anwalt;
    #mitarbeiter;
    #mandant;
  };

  // NEU: StatusHistoryEntry für die historisierte Status-Logik.
  type StatusHistoryEntry = {
    year : Nat;
    month : Nat;
    status : Text;
  };

  type Kanzlei = {
    id : KanzleiId;
    name : Text;
    defaultStundensatz : Nat;
    zahlungsmodalitaet : ?Zahlungsmodalitaet;
    createdAt : Timestamp;
  };

  // NEU: Leistungserbringer erhält statusHistory.
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

  // OldActor: State-Shape VOR dieser Migration (entspricht der NewActor des
  // Vorgänger-Files 20260724_102008.mo). Leistungserbringer hat noch KEIN
  // statusHistory-Feld; Role hat noch kein #plattform_admin.
  type OldLeistungserbringer = {
    id : Principal;
    kanzleiId : KanzleiId;
    vorname : Text;
    nachname : Text;
    titel : Text;
    email : Text;
    isAdmin : Bool;
    role : ?OldRole;
    status : Text;
    registeredAt : Timestamp;
  };

  type OldRole = { #admin; #anwalt; #mitarbeiter; #mandant };

  type OldActor = {
    kanzleien : Map.Map<KanzleiId, Kanzlei>;
    users : Map.Map<Principal, OldLeistungserbringer>;
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

  // NewActor: State-Shape NACH dieser Migration. Leistungserbringer erhält
  // statusHistory = [] (Legacy-Benutzer ohne Historie — Fallback-Logik greift).
  // Role-Variante ist um #plattform_admin erweitert (stable-kompatibel).
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
  };

  // Migration: alle Collections durchreichen; users transformiert — jeder
  // Leistungserbringer erhält statusHistory = [] (leere Liste). Bestehende
  // Admins (role = ?#admin) bleiben unangetastet — KEINE Konvertierung zu
  // #plattform_admin. Die erste Registrierung wird beim nächsten
  // Registrierungs-Pfad automatisch befördert (autoPromoteFirstSuperAdmin).
  public func migration(old : OldActor) : NewActor {
    let newUsers = old.users.map<Principal, OldLeistungserbringer, Leistungserbringer>(
      func(principal, u) {
        {
          id = u.id;
          kanzleiId = u.kanzleiId;
          vorname = u.vorname;
          nachname = u.nachname;
          titel = u.titel;
          email = u.email;
          isAdmin = u.isAdmin;
          // role 1:1 übernehmen — OldRole ist ein Subtyp von Role
          // (zusätzlicher Variant-Konstruktor #plattform_admin ist kompatibel).
          role = u.role;
          status = u.status;
          registeredAt = u.registeredAt;
          // NEU: leere Status-Historie für Legacy-Benutzer. Die Fallback-Logik
          // in lib/active-users.isUserActiveInMonth greift auf den aktuellen
          // status + Registrierungsmonat zurück, wenn statusHistory leer ist.
          statusHistory = [];
        };
      },
    );
    {
      kanzleien = old.kanzleien;
      users = newUsers;
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
    };
  };
};
