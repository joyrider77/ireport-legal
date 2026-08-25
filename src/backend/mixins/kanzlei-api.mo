import Common "../types/common";
import Types "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import VorlagenTypes "../types/rechnungsvorlagen";
import KanzleiLib "../lib/kanzlei";
import SuperAdminLib "../lib/super-admin";
import RolesLib "../lib/roles";
import Map "mo:core/Map";
import Time "mo:core/Time";
import EmailClient "mo:caffeineai-email/emailClient";

mixin (
  kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
  users : Map.Map<Principal, Types.Leistungserbringer>,
  inviteTokens : Map.Map<Text, Types.InviteToken>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  rechnungsvorlagen : Map.Map<Common.KanzleiId, VorlagenTypes.Rechnungsvorlage>,
) {
  // Registriert eine neue Kanzlei und den ersten Admin-Benutzer.
  // Die allererste Registrierung (leere superAdminWhitelist) wird automatisch
  // zum Plattform-Admin (Super-Admin) befördert — die Logik lebt in
  // KanzleiLib.registerKanzlei, das die superAdminWhitelist erhält und
  // autoPromoteFirstSuperAdmin aufruft sowie role = ?#plattform_admin setzt.
  //
  // ZUSÄTZLICH wird bei jeder Neuregistrierung transparent serverseitig eine
  // initiale Standard-Rechnungsvorlage für die neue Kanzlei angelegt (kein
  // zusätzlicher UI-Schritt — die RegistrierungPage bleibt aus Nutzersicht
  // unverändert). Die Vorlage verwendet defaultLayoutV2() mit allen 12
  // Elementen in verbindlicher Reihenfolge sowie Standardtext-Defaults.
  // Bestehende Kanzleien/Vorlagen werden nie überschrieben (Guard in
  // KanzleiLib.registerKanzlei: rechnungsvorlagen.get(kanzleiId) == null).
  public shared ({ caller }) func registerKanzlei(
    name : Text,
    adminTitel : Text,
    adminVorname : Text,
    adminNachname : Text,
    adminEmail : Text,
    zahlungsmodalitaet : ?Types.Zahlungsmodalitaet,
  ) : async Common.Result<Text, Text> {
    KanzleiLib.registerKanzlei(
      kanzleien,
      users,
      superAdminWhitelist,
      rechnungsvorlagen,
      caller,
      name,
      adminTitel,
      adminVorname,
      adminNachname,
      adminEmail,
      zahlungsmodalitaet,
    );
  };

  public shared ({ caller }) func getOrCreateUser() : async Common.Result<Types.Leistungserbringer, Text> {
    KanzleiLib.getOrCreateUser(kanzleien, users, caller);
  };

  // Liefert den aktuellen Benutzer. Maskierung: #plattform_admin wird für
  // Nicht-Plattform-Admin-Aufrufer als #admin zurückgegeben (siehe
  // lib/roles.mo maskRoleForCaller). Der Plattform-Admin sieht seine eigene
  // Rolle #plattform_admin.
  public query ({ caller }) func getCurrentUser() : async ?Types.Leistungserbringer {
    KanzleiLib.getCurrentUser(users, superAdminWhitelist, caller);
  };

  public shared ({ caller }) func updateUserProfile(
    vorname : Text,
    nachname : Text,
  ) : async Common.Result<(), Text> {
    KanzleiLib.updateUserProfile(users, caller, vorname, nachname);
  };

  // Liefert alle Leistungserbringer der Kanzlei des callers — inklusive
  // deaktivierter (status = "inaktiv"). TENANT-ISOLATION: filtert strikt
  // nach caller.kanzleiId, KEIN Super-Admin-Bypass. Maskierung:
  // #plattform_admin wird für Nicht-Plattform-Admin-Aufrufer als #admin
  // zurückgegeben, damit die Plattform-Admin-Rolle in der Kanzlei-Admin-
  // Ansicht nicht sichtbar wird.
  public query ({ caller }) func getLeistungserbringer() : async [Types.Leistungserbringer] {
    KanzleiLib.getLeistungserbringer(users, superAdminWhitelist, caller);
  };

  // Deaktiviert/Archiviert einen Leistungserbringer (status = "inaktiv") und
  // hängt einen StatusHistoryEntry an (Historisierung — siehe
  // lib/active-users.recordStatusChange). Tenant-Isolation: nur der Admin
  // der Kanzlei oder ein Super-Admin darf deaktivieren (Cross-Tenant-
  // Deaktivierung wird serverseitig ausgeschlossen).
  public shared ({ caller }) func removeLeistungserbringer(userId : Principal) : async Common.Result<(), Text> {
    KanzleiLib.removeLeistungserbringer(users, superAdminWhitelist, caller, userId);
  };

  // Löscht einen Leistungserbringer PHYSISCH und unwiderruflich aus dem
  // users-Map (im Gegensatz zu removeLeistungserbringer, das nur den Status
  // auf "inaktiv" setzt). Gated analog zu removeLeistungserbringer: Admin der
  // Kanzlei ODER Super-Admin.
  public shared ({ caller }) func deleteLeistungserbringer(userId : Text) : async Common.Result<(), Text> {
    KanzleiLib.deleteLeistungserbringer(users, superAdminWhitelist, caller, userId);
  };

  // Aktualisiert die Profil-Felder eines Leistungserbringers. TENANT-
  // ISOLATION (Korrektur): serverseitige Tenant-Prüfung gegen
  // caller.kanzleiId — der caller darf nur Benutzer seiner EIGENEN Kanzlei
  // bearbeiten.
  public shared ({ caller }) func updateLeistungserbringer(
    userId : Principal,
    vorname : Text,
    nachname : Text,
    titel : Text,
  ) : async Common.Result<(), Text> {
    KanzleiLib.updateLeistungserbringer(users, superAdminWhitelist, caller, userId, vorname, nachname, titel);
  };

  public query ({ caller }) func getKanzlei() : async ?Types.Kanzlei {
    KanzleiLib.getKanzlei(kanzleien, users, caller);
  };

  public shared ({ caller }) func updateKanzleiStundensatz(defaultStundensatz : Nat) : async Common.Result<(), Text> {
    KanzleiLib.updateKanzleiStundensatz(kanzleien, users, caller, defaultStundensatz);
  };

  // ── Invite link workflow ──────────────────────────────────────────────────

  public shared ({ caller }) func createInviteLink(email : Text) : async Common.Result<Text, Text> {
    // Token-Seed: caller-Principal + Zufallsanteil via Time.now().
    let tokenSeed = caller.toText() # "-" # Time.now().toText();
    KanzleiLib.createInviteToken(inviteTokens, users, caller, email, tokenSeed);
  };

  // Löst einen Einladungslink ein und erstellt den neuen Benutzer mit
  // status = "aktiv" sowie dem ersten statusHistory-Eintrag (Historisierung).
  public shared ({ caller }) func redeemInviteLink(
    token : Text,
    vorname : Text,
    nachname : Text,
    titel : Text,
    email : Text,
  ) : async Common.Result<Types.Leistungserbringer, Text> {
    KanzleiLib.redeemInviteToken(inviteTokens, users, caller, token, vorname, nachname, titel, email);
  };

  public query ({ caller }) func getInviteLinks() : async [Types.InviteToken] {
    KanzleiLib.getInviteTokens(inviteTokens, users, caller);
  };

  // ── Kanzlei-Stammdaten (Workstream A: Einstellungen > Kanzleidaten) ──────────
  //
  // Liefert die Kanzlei-Stammdaten des callers (seiner eigenen Kanzlei).
  // TENANT-ISOLATION: liefert ausschliesslich die Stammdaten der
  // caller-Kanzlei. Normale Mitarbeiter und Mandanten dürfen LESEN
  // (query), aber nicht schreiben (updateKanzleiStammdaten ist
  // admin-gated). Liefert null, falls keine Stammdaten erfasst sind.
  public query ({ caller }) func getKanzleiStammdaten() : async ?Types.KanzleiStammdaten {
    KanzleiLib.getKanzleiStammdaten(kanzleien, users, caller);
  };

  // Aktualisiert die Kanzlei-Stammdaten des callers (seiner eigenen Kanzlei).
  // ADMIN-GATING: nur berechtigte Kanzlei-Admins (admin oder plattform_admin
  // der eigenen Kanzlei) ODER Super-Admins dürfen ändern. Normale Mitarbeiter
  // und Mandanten werden abgewiesen. Backend-Validierung der 5 Pflichtfelder
  // (kanzleiname, strasseHausnummer, plz, ort, land). kanzleiLogoBlob wird
  // STRIKT GETRENNT vom Rechnungslogo (logoBlob in rechnungsvorlagen)
  // behandelt. Liefert #ok mit den gespeicherten Stammdaten bei Erfolg.
  public shared ({ caller }) func updateKanzleiStammdaten(
    stammdaten : Types.KanzleiStammdaten,
  ) : async Common.Result<Types.KanzleiStammdaten, Text> {
    KanzleiLib.updateKanzleiStammdaten(
      kanzleien,
      users,
      superAdminWhitelist,
      caller,
      stammdaten,
    );
  };
};
