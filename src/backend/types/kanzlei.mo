import Common "common";

module {
  // Zahlungsmodalität bei der Kanzlei-Registrierung
  public type Zahlungsmodalitaet = {
    #jahres;
    #monats;
  };

  // ── Kanzlei-Stammdaten (Workstream A: Einstellungen > Kanzleidaten) ──────────
  //
  // Kanzlei-Stammdaten (Firm Master Data) für den Bereich
  // „Einstellungen > Kanzleidaten". Diese Daten sind TENANT-ISOLIERT pro
  // Kanzlei gespeichert (genau ein Stammdaten-Record pro Kanzlei, optional
  // — null, solange noch keine Stammdaten erfasst wurden).
  //
  // PFlichtfelder (Backend-Validierung beim Speichern, siehe
  // lib/kanzlei.mo validateStammdaten): kanzleiname, strasseHausnummer,
  // plz, ort, land. Optionale Felder: telefon, email, website, uid,
  // mwstNr, kanzleiLogoBlob.
  //
  // kanzleiLogoBlob ist das ALLGEMEINE Kanzlei-Logo und STRIKT GETRENNT
  // vom Rechnungslogo (logoBlob in rechnungsvorlagen). Es wird NICHT für
  // den Rechnungs-Export verwendet und NICHT in rechnungsvorlagen
  // gespeichert. Die Absenderadresse der Rechnung wird künftig
  // ausschliesslich aus diesen Stammdaten bezogen (Contract-Vorbereitung
  // — bestehende Rechnungslogik wird nicht gebrochen).
  //
  // Plattform-Admin-Sichtbarkeit: getAllKanzleienOverview exponiert nur
  // die Abo-Billing-relevanten Felder (kanzleiname, uid, mwstNr, Adresse)
  // — KEINE zusätzlichen fachlichen Mandats-/Klientendaten.
  public type KanzleiStammdaten = {
    kanzleiname : Text; // Pflicht
    strasseHausnummer : Text; // Pflicht
    plz : Text; // Pflicht
    ort : Text; // Pflicht
    land : Text; // Pflicht
    telefon : Text; // optional ("" = nicht gesetzt)
    email : Text; // optional ("" = nicht gesetzt)
    website : Text; // optional ("" = nicht gesetzt)
    uid : Text; // optional ("" = nicht gesetzt)
    mwstNr : Text; // optional ("" = nicht gesetzt)
    // Allgemeines Kanzlei-Logo (Blob). STRIKT GETRENNT vom Rechnungslogo
    // (logoBlob in rechnungsvorlagen). null = kein Kanzlei-Logo.
    kanzleiLogoBlob : ?Blob;
  };

  public type Kanzlei = {
    id : Common.KanzleiId;
    name : Text;
    defaultStundensatz : Nat;
    zahlungsmodalitaet : ?Zahlungsmodalitaet;
    // Status der Kanzlei: "aktiv" (Default) oder "inaktiv" (via
    // deactivateKanzlei gesetzt — Daten bleiben erhalten, nur Status ändert
    // sich). Physisches Löschen erfolgt über deleteKanzlei (Super-Admin only).
    status : Text;
    createdAt : Common.Timestamp;
    // Kanzlei-Stammdaten (Firm Master Data). Optional — null, solange noch
    // keine Stammdaten erfasst wurden. Tenant-isoliert (ein Record pro
    // Kanzlei). Siehe KanzleiStammdaten für Feld-Dokumentation.
    stammdaten : ?KanzleiStammdaten;
  };

  // Rollen für Zugriffskontrolle (revDSG / Berufsgeheimnis).
  //
  // #plattform_admin ist eine SEPARATE, höhere Rolle, die NUR für den
  // Plattform-Admin (Super-Admin) selbst auf Leistungserbringer.role
  // gesetzt wird. Sie wird NIE über updateUserRole vergeben — einzig die
  // Auto-Beförderung der allerersten Registrierung setzt sie. Für alle
  // anderen Benutzer bleibt sie unsichtbar (maskiert als #admin, siehe
  // lib/roles.mo maskRoleForCaller). Die autoritative Super-Admin-Prüfung
  // erfolgt weiterhin über die superAdminWhitelist, nicht über diese Rolle.
  public type Role = {
    #plattform_admin;
    #admin;
    #anwalt;
    #mitarbeiter;
    #mandant;
  };

  // Status-Historie-Eintrag: dokumentiert, ab welchem (year, month) ein
  // neuer status gegolten hat. Wird bei jeder Status-Änderung
  // (Aktivierung/Deaktivierung) via lib/active-users.recordStatusChange
  // angehängt. Die Historie ist die Grundlage für die korrigierte
  // isUserActiveInMonth-Logik (status zum Zeitpunkt des Monats, nicht der
  // aktuelle Status). Für Legacy-Benutzer ohne Historie greift ein Fallback
  // auf den aktuellen status + Registrierungsmonat.
  public type StatusHistoryEntry = {
    year : Nat;
    month : Nat; // 1..12
    status : Text; // z.B. "aktiv" / "inaktiv"
  };

  public type Leistungserbringer = {
    id : Principal;
    kanzleiId : Common.KanzleiId;
    vorname : Text;
    nachname : Text;
    titel : Text;
    email : Text;
    isAdmin : Bool;
    role : ?Role; // default #anwalt; ?#plattform_admin NUR für den Plattform-Admin selbst
    status : Text; // default "aktiv"; alleiniges Kriterium für aktive Benutzer
                   // "inaktiv" markiert deaktivierte/archivierte Benutzer
                   // (kein physisches Löschen — Benutzer bleiben abrufbar)
    registeredAt : Common.Timestamp;
    // Status-Historie pro Benutzer. Leer für Legacy-Benutzer, deren Status
    // vor der Historisierung gesetzt wurde (Fallback-Logik in
    // lib/active-users.isUserActiveInMonth). Bei jeder Status-Änderung wird
    // ein neuer Eintrag angehängt (siehe recordStatusChange).
    statusHistory : [StatusHistoryEntry];
  };

  // Stored invite token → target kanzleiId + optional email hint
  public type InviteToken = {
    token : Text;
    kanzleiId : Common.KanzleiId;
    createdBy : Principal;
    email : Text; // optional hint, may be ""
    createdAt : Common.Timestamp;
    redeemedBy : ?Principal;
  };
};
