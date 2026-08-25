// Migration: automatische Joao-Marques-Hard-Promotion.
//
// Diese Migration führt die automatische, idempotente Promotion von
// Joao Marques (joao.marques@iservices.ch) auf #plattform_admin aus, sobald
// der Canister deployt/geupgradet wird — ohne manuellen API-Aufruf.
//
// Hintergrund: die Infrastruktur (promoteJoaoMarques in lib/roles.mo,
// autoPromoteFirstSuperAdmin in lib/super-admin.mo, maskRoleForCaller,
// rolePermissions) existierte bereits, wurde aber nie automatisch
// getriggert. Die erste Registrierung (autoPromoteFirstSuperAdmin) greift
// nur, wenn die Whitelist bei der Registrierung leer ist — was bei einem
// bereits deployten Canister mit bestehenden Benutzern nicht der Fall war.
// Diese Migration schliesst diese Lücke, indem sie die Promotion-Logik
// direkt in der Migrationskette ausführt (die bei jedem Deploy/Upgrade
// automatisch läuft).
//
// Was die Migration tut:
//   1. Sucht in users nach dem Benutzer mit der E-Mail
//      'joao.marques@iservices.ch' (case-insensitive, trim-normalisiert).
//   2. Setzt role = ?#plattform_admin, sofern noch nicht gesetzt.
//   3. Trägt den Principal in die superAdminWhitelist ein, sofern noch
//      nicht vorhanden (addedAt = 0 — der exakte Timestamp ist für die
//      Whitelist-Funktionalität irrelevant; isSuperAdmin prüft nur
//      Präsenz, nicht addedAt).
//   4. Idempotent: ein erneuter Aufruf ändert nichts, wenn der Benutzer
//      bereits #plattform_admin hat und/oder bereits in der Whitelist steht.
//
// OldActor entspricht der NewActor des Vorgänger-Files
// (20260724_160000.mo) — d.h. die aktuell deployed State-Shape inkl.
// statusHistory und #plattform_admin Role-Variante. NewActor ist
// typgleich (keine Schema-Änderung); die Migration transformiert nur
// Daten (users + superAdminWhitelist).
//
// Self-contained: nur mo:core-Imports, keine Projekt-Imports. Die
// Promotion-Logik ist inline kopiert (die Migration darf keine
// Projekt-Module importieren — siehe migrating-motoko-actors Skill).

import Map "mo:core/Map";
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

  type Kanzlei = {
    id : KanzleiId;
    name : Text;
    defaultStundensatz : Nat;
    zahlungsmodalitaet : ?Zahlungsmodalitaet;
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
  // Vorgänger-Files 20260724_160000.mo). Keine Schema-Änderung.
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
  };

  // NewActor: typgleich zu OldActor (keine Schema-Änderung). Die Migration
  // transformiert nur Daten (users + superAdminWhitelist).
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

  // Case-insensitive, trim-normalisierter E-Mail-Vergleich.
  // Inline-Kopie der Logik aus lib/roles.mo promoteJoaoMarques (die Migration
  // darf keine Projekt-Module importieren).
  func normalizeEmail(email : Text) : Text {
    email.toLower().trim(#char ' ');
  };

  // Prüft, ob eine Rolle bereits #plattform_admin ist.
  func isPlattformAdmin(role : ?Role) : Bool {
    switch (role) {
      case (?#plattform_admin) true;
      case (_) false;
    };
  };

  // Migration: führt die automatische Joao-Marques-Promotion aus.
  //   1. Sucht den Benutzer mit der E-Mail 'joao.marques@iservices.ch'.
  //   2. Setzt role = ?#plattform_admin (sofern noch nicht gesetzt).
  //   3. Trägt den Principal in die superAdminWhitelist ein (sofern noch
  //      nicht vorhanden; addedAt = 0).
  // Idempotent: ein erneuter Aufruf ändert nichts, wenn der Benutzer
  // bereits #plattform_admin hat und/oder bereits in der Whitelist steht.
  public func migration(old : OldActor) : NewActor {
    let targetEmail : Text = "joao.marques@iservices.ch";
    let normalizedTarget : Text = normalizeEmail(targetEmail);

    // users transformieren: Joao Marques erhält ?#plattform_admin.
    let newUsers = old.users.map<Principal, Leistungserbringer, Leistungserbringer>(
      func(principal, u) {
        let normalizedEmail : Text = normalizeEmail(u.email);
        if (normalizedEmail == normalizedTarget) {
          // Treffer: role = ?#plattform_admin setzen, sofern noch nicht gesetzt.
          if (not isPlattformAdmin(u.role)) {
            {
              u with
              role = ?#plattform_admin;
            };
          } else {
            // Bereits #plattform_admin — unangetastet (idempotent).
            u;
          };
        } else {
          // Kein Treffer — unangetastet.
          u;
        };
      },
    );

    // superAdminWhitelist: Joao Marques eintragen, sofern noch nicht vorhanden.
    // Wir klonen die bestehende Whitelist (clone liefert eine veränderbare
    // Kopie) und fügen Joao Marques hinzu, falls er noch nicht eingetragen
    // ist. addedAt = 0 (der exakte Timestamp ist für die Whitelist-
    // Funktionalität irrelevant — isSuperAdmin prüft nur Präsenz, nicht
    // addedAt).
    let newSuperAdminWhitelist = old.superAdminWhitelist.clone();
    // Joao Marques' Principal in newUsers suchen (nach der Transformation,
    // damit wir den korrekten Principal haben).
    var joaoPrincipal : ?Principal = null;
    for ((principal, u) in newUsers.entries()) {
      if (normalizeEmail(u.email) == normalizedTarget) {
        joaoPrincipal := ?principal;
      };
    };
    switch (joaoPrincipal) {
      case (?p) {
        if (newSuperAdminWhitelist.get(p) == null) {
          let entry : SuperAdminWhitelistEntry = {
              principal = p;
              addedAt = 0;
            };
          newSuperAdminWhitelist.add(p, entry);
        };
      };
      case null {
        // Kein Benutzer mit der E-Mail gefunden — Whitelist unangetastet.
        // Die Promotion wird beim nächsten Deploy/Upgrade erneut versucht
        // (idempotent), falls der Benutzer inzwischen registriert wurde.
      };
    };

    {
      kanzleien = old.kanzleien;
      users = newUsers;
      inviteTokens = old.inviteTokens;
      superAdminWhitelist = newSuperAdminWhitelist;
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
