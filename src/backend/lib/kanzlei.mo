import Common "../types/common";
import Types "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import VorlagenTypes "../types/rechnungsvorlagen";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Text "mo:core/Text";
import ActiveUsersLib "../lib/active-users";
import RolesLib "../lib/roles";
import SuperAdminLib "../lib/super-admin";
import SecurityFixesLib "../lib/security-fixes";
import VorlagenLib "../lib/rechnungsvorlagen";

module {

  // ── Kanzlei-Registrierung ──────────────────────────────────────────────────
  //
  // Die allererste Registrierung (wenn die superAdminWhitelist leer ist)
  // wird automatisch zum Plattform-Admin (Super-Admin) befördert:
  //   1. SuperAdminLib.autoPromoteFirstSuperAdmin(caller) trägt den caller
  //      in die superAdminWhitelist ein.
  //   2. Der erste Benutzer erhält role = ?#plattform_admin (sichtbar nur
  //      für den Plattform-Admin selbst — maskiert via maskRoleForCaller).
  //   3. Der erste statusHistory-Eintrag { year; month; status = "aktiv" }
  //      wird angehängt (Historisierung ab Registrierung).
  //
  // Bestehende Admins (isAdmin=true, role=?#admin) werden NICHT migriert —
  // migrateRoles in lib/roles.mo lässt #admin-Benutzer unangetastet.

  public func registerKanzlei(
    kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    rechnungsvorlagen : Map.Map<Common.KanzleiId, VorlagenTypes.Rechnungsvorlage>,
    caller : Principal,
    name : Text,
    adminTitel : Text,
    adminVorname : Text,
    adminNachname : Text,
    adminEmail : Text,
    zahlungsmodalitaet : ?Types.Zahlungsmodalitaet,
  ) : Common.Result<Text, Text> {
    // Bereits registrierte caller dürfen keine neue Kanzlei registrieren.
    if (users.get(caller) != null) {
      return #err "Sie sind bereits einer Kanzlei zugeordnet";
    };
    // Kanzlei-Name darf nicht leer sein.
    if (name == "") {
      return #err "Kanzlei-Name darf nicht leer sein";
    };
    let now = Time.now();

    // Auto-Beförderung der allerersten Registrierung zum Plattform-Admin.
    // autoPromoteFirstSuperAdmin trägt den caller in die Whitelist ein, wenn
    // die Whitelist leer ist. Gibt true zurück, wenn der caller befördert
    // wurde — in diesem Fall erhält der Benutzer role = ?#plattform_admin.
    let wasPromoted = SuperAdminLib.autoPromoteFirstSuperAdmin(superAdminWhitelist, caller, now);
    let initialRole : ?Types.Role = if (wasPromoted) {
      ?#plattform_admin;
    } else {
      ?#admin;
    };

    // Kanzlei anlegen. ID = caller-Principal als Text (eindeutig pro Admin).
    let kanzleiId : Common.KanzleiId = caller.toText();
    if (kanzleien.get(kanzleiId) != null) {
      return #err "Kanzlei existiert bereits für diesen Principal";
    };
    let kanzlei : Types.Kanzlei = {
      id = kanzleiId;
      name;
      defaultStundensatz = 0; // Default, via updateKanzleiStundensatz änderbar
      zahlungsmodalitaet;
      status = "aktiv"; // Default-Status; "inaktiv" via deactivateKanzlei
      createdAt = now;
      // Kanzlei-Stammdaten (Workstream A): neue Kanzleien starten ohne
      // erfasste Stammdaten — der Admin kann sie später via
      // updateKanzleiStammdaten erfassen. null = noch keine Stammdaten.
      stammdaten = null;
    };
    kanzleien.add(kanzleiId, kanzlei);

    // Ersten Status-Historien-Eintrag { year; month; status = "aktiv" } bauen.
    let (regYear, regMonth) = ActiveUsersLib.yearMonthFromTimestamp(now);
    let initialStatusHistory : [Types.StatusHistoryEntry] = [{
      year = regYear;
      month = regMonth;
      status = "aktiv";
    }];

    // Admin-Benutzer anlegen. isAdmin=true für Backward-Compat (Gate-Checks).
    // role = initialRole (?#plattform_admin für die erste Registrierung,
    // sonst ?#admin). status = "aktiv".
    let admin : Types.Leistungserbringer = {
      id = caller;
      kanzleiId;
      vorname = adminVorname;
      nachname = adminNachname;
      titel = adminTitel;
      email = adminEmail;
      isAdmin = true;
      role = initialRole;
      status = "aktiv";
      registeredAt = now;
      statusHistory = initialStatusHistory;
    };
    users.add(caller, admin);

    // ── Initiale Standard-Rechnungsvorlage serverseitig anlegen ────────────────
    //
    // Bei jeder Neuregistrierung einer Kanzlei wird transparent serverseitig
    // eine initiale Rechnungsvorlage für die neue Kanzlei angelegt — kein
    // zusätzlicher UI-Schritt, die RegistrierungPage bleibt aus Nutzersicht
    // unverändert. Die Vorlage verwendet:
    //   - layoutV2 = defaultLayoutV2() (alle 12 Elemente in verbindlicher
    //     Reihenfolge: Logo, Absenderadresse, Empfängeradresse,
    //     Rechnungsmetadaten, Mandatsinformationen, Einleitung,
    //     Leistungspositionen, Spesen/Auslagen, Summen-/MWST-Block,
    //     Zahlungsinformationen, Schlusstext, Fusszeile) mit Standard-
    //     Positionen (xMm/yMm/widthMm/heightMm/zOrder) und Typografie
    //     (Schriftart, Schriftgrösse, Bold/Italic) aus der Standard-Layout-
    //     Definition.
    //   - standardtexte = Standardtext-Defaults (Rechnungstitel "Rechnung",
    //     Einleitung "", Zahlungshinweis 30 Tage, Schlusstext "").
    //   - logoBlob = null (Logo wird separat via uploadLogo verwaltet).
    //
    // REGRESSIONSSCHUTZ: Die Vorlage wird NUR angelegt, falls für diese
    // kanzleiId noch keine Vorlage existiert (Map.get == null). Bestehende
    // Kanzleien und deren Vorlagen werden nie überschrieben. Da
    // registerKanzlei weiter oben bereits sichergestellt hat, dass die
    // kanzleiId neu ist (kanzleien.get(kanzleiId) == null), ist auch der
    // Vorlagen-Slot hier garantiert leer — der Guard ist dennoch idempotent
    // gehalten, um bei künftigen Aufrufpfaden sicher zu bleiben.
    if (rechnungsvorlagen.get(kanzleiId) == null) {
      let defaultLayout : VorlagenTypes.VorlageLayout = {
        absenderPosition = #links;
        empfaengerPosition = #links;
        logoPosition = #rechts;
        fusszeile = "";
      };
      let defaultStandardtexte : VorlagenTypes.Standardtexte = {
        rechnungstitel = "Rechnung";
        einleitung = "";
        zahlungshinweis = "Zahlbar innerhalb 30 Tagen.";
        schlusstext = "";
      };
      let initialVorlage : VorlagenTypes.Rechnungsvorlage = {
        kanzleiId;
        layout = defaultLayout;
        standardtexte = defaultStandardtexte;
        logoBlob = null;
        layoutV2 = ?VorlagenTypes.defaultLayoutV2();
        updatedAt = now;
      };
      rechnungsvorlagen.add(kanzleiId, initialVorlage);
    };

    #ok kanzleiId;
  };

  public func buildRegistrationEmailHtml(
    name : Text,
    adminTitel : Text,
    adminVorname : Text,
    adminNachname : Text,
    adminEmail : Text,
    zahlungsmodalitaet : ?Types.Zahlungsmodalitaet,
  ) : Text {
    let modalitaetText = switch (zahlungsmodalitaet) {
      case (?#jahres) "Jahres-Abo";
      case (?#monats) "Monats-Abo";
      case null "Keine Angabe";
    };
    "<html><body>"
    # "<h2>Willkommen bei der Kanzlei " # name # "</h2>"
    # "<p>Admin: " # adminTitel # " " # adminVorname # " " # adminNachname # "</p>"
    # "<p>E-Mail: " # adminEmail # "</p>"
    # "<p>Zahlungsmodalität: " # modalitaetText # "</p>"
    # "</body></html>";
  };

  public func buildRegistrationEmailSubject(name : Text) : Text {
    "Kanzlei-Registrierung: " # name;
  };

  // ── Benutzer-Verwaltung ────────────────────────────────────────────────────

  public func getOrCreateUser(
    kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
  ) : Common.Result<Types.Leistungserbringer, Text> {
    switch (users.get(caller)) {
      case (?u) #ok u;
      case null {
        // Kein Auto-Anlegen ohne Kanzlei-Zuordnung — ein Benutzer muss über
        // registerKanzlei (Admin) oder redeemInviteToken (Mitarbeiter) entstehen.
        #err "Benutzer nicht registriert — bitte registrieren Sie eine Kanzlei oder lösen Sie einen Einladungslink ein";
      };
    };
  };

  // Liefert den aktuellen Benutzer. Maskierung: #plattform_admin wird für
  // Nicht-Plattform-Admin-Aufrufer als #admin zurückgegeben (siehe
  // lib/roles.mo maskRoleForCaller). Der Plattform-Admin sieht seine eigene
  // Rolle #plattform_admin.
  public func getCurrentUser(
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : ?Types.Leistungserbringer {
    switch (users.get(caller)) {
      case null null;
      case (?u) {
        let callerIsSuperAdmin = superAdminWhitelist.get(caller) != null;
        let maskedRole = switch (u.role) {
          case (?r) ?RolesLib.maskRoleForCaller(r, callerIsSuperAdmin);
          case null null;
        };
        ?{ u with role = maskedRole };
      };
    };
  };

  public func updateUserProfile(
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
    vorname : Text,
    nachname : Text,
  ) : Common.Result<(), Text> {
    switch (users.get(caller)) {
      case null { #err "Benutzer nicht registriert" };
      case (?u) {
        let updated : Types.Leistungserbringer = {
          u with
          vorname;
          nachname;
        };
        users.add(caller, updated);
        #ok ();
      };
    };
  };

  // Liefert alle Leistungserbringer der Kanzlei des callers — inklusive
  // deaktivierter (status = "inaktiv"). Deaktivierte Benutzer bleiben
  // abrufbar; das Status-Feld ist alleiniges Kriterium für aktive Benutzer.
  //
  // TENANT-ISOLATION (Korrektur): filtert STRIKT nach caller.kanzleiId —
  // KEIN Super-Admin-Bypass mehr. Der Plattform-Admin sieht in seiner
  // normalen Benutzerverwaltung ausschliesslich die Benutzer seiner EIGENEN
  // Kanzlei, niemals Benutzer anderer Kanzleien. Die mandantenübergreifende
  // Sicht bleibt ausschliesslich getLeistungserbringerByKanzlei im Modul
  // Plattform-Admin (super-admin-only) vorbehalten.
  //
  // Maskierung: #plattform_admin wird für Nicht-Plattform-Admin-Aufrufer
  // als #admin zurückgegeben (siehe lib/roles.mo maskRoleForCaller). Die
  // Maskierung wird hier angewendet, damit die Kanzlei-Admin-Ansicht die
  // Plattform-Admin-Rolle nie sieht.
  public func getLeistungserbringer(
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : [Types.Leistungserbringer] {
    // TENANT-ISOLATION (Korrektur): strikt nach caller.kanzleiId filtern —
    // KEIN Super-Admin-Bypass. Der caller muss registriert sein; sein
    // kanzleiId-Feld ist der alleinige Filter. Der Plattform-Admin sieht
    // hier ausschliesslich die Benutzer seiner EIGENEN Kanzlei. Die
    // mandantenübergreifende Sicht bleibt getLeistungserbringerByKanzlei
    // (super-admin-only) vorbehalten.
    switch (users.get(caller)) {
      case null { return [] };
      case (?callerUser) {
        let callerKanzleiId = callerUser.kanzleiId;
        let callerIsSuperAdmin = superAdminWhitelist.get(caller) != null;
        // Über alle Benutzer iterieren, nur die der caller-Kanzlei behalten
        // und die Rolle für den Aufrufer maskieren (#plattform_admin wird
        // für Nicht-Plattform-Admin-Aufrufer als #admin zurückgegeben).
        users.values()
          .filter(func(u : Types.Leistungserbringer) : Bool {
            u.kanzleiId == callerKanzleiId;
          })
          .map(
            func(u : Types.Leistungserbringer) : Types.Leistungserbringer {
              let maskedRole = switch (u.role) {
                case (?r) ?RolesLib.maskRoleForCaller(r, callerIsSuperAdmin);
                case null null;
              };
              { u with role = maskedRole };
            },
          )
          .toArray();
      };
    };
  };

  // Deaktiviert/Archiviert einen Leistungserbringer, anstatt ihn physisch
  // zu löschen. Setzt status = "inaktiv" über das bestehende Status-Feld
  // UND hängt einen StatusHistoryEntry { year; month; status = "inaktiv" }
  // an (Historisierung — siehe lib/active-users.recordStatusChange).
  //
  // Tenant-Isolation (Sicherheits-Build): der caller muss berechtigt sein,
  // den Zielbenutzer zu deaktivieren. Geprüft via
  // SecurityFixesLib.canDeactivateLeistungserbringer:
  //   (a) caller ist Plattform-Admin (superAdminWhitelist) → immer erlaubt
  //       (mandantenübergreifend), ODER
  //   (b) caller ist Kanzlei-Admin (deriveRole in {#plattform_admin, #admin})
  //       UND target.kanzleiId == caller.kanzleiId (gleicher Tenant).
  // Cross-Tenant-Deaktivierung wird damit technisch ausgeschlossen. Normale
  // Benutzer (keine Admin-Rolle) werden abgewiesen.
  public func removeLeistungserbringer(
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    userId : Principal,
  ) : Common.Result<(), Text> {
    // caller muss registriert sein.
    switch (users.get(caller)) {
      case null { return #err "Aufrufer nicht registriert" };
      case (_) {};
    };
    switch (users.get(userId)) {
      case null { #err "Benutzer nicht gefunden" };
      case (?target) {
        // Tenant-Isolation + Admin-Rollen-Check. Plattform-Admins umgehen
        // die Tenant-Prüfung (mandantenübergreifende Verwaltung bleibt
        // erhalten). Normale Benutzer ohne Admin-Rolle werden abgewiesen.
        if (not SecurityFixesLib.canDeactivateLeistungserbringer(
          users,
          superAdminWhitelist,
          caller,
          target.kanzleiId,
        )) {
          return #err "Nur der Admin der Kanzlei oder ein Super-Admin darf Leistungserbringer deaktivieren";
        };
        let now = Time.now();
        // Status-Historie um "inaktiv"-Eintrag ergänzen.
        let newStatusHistory = ActiveUsersLib.recordStatusChange(target, "inaktiv", now);
        let updated : Types.Leistungserbringer = {
          target with
          status = "inaktiv";
          statusHistory = newStatusHistory;
        };
        users.add(userId, updated);
        #ok ();
      };
    };
  };

  // Aktualisiert die Profil-Felder (vorname, nachname, titel) eines
  // Leistungserbringers.
  //
  // TENANT-ISOLATION (Korrektur): erhält eine serverseitige Tenant-Prüfung
  // gegen caller.kanzleiId. Der caller darf nur Benutzer seiner EIGENEN
  // Kanzlei bearbeiten — kein mandantenübergreifendes Bearbeiten mehr,
  // auch nicht für den Plattform-Admin in seiner normalen
  // Benutzerverwaltung. Die mandantenübergreifende Verwaltung bleibt dem
  // Modul Plattform-Admin vorbehalten.
  public func updateLeistungserbringer(
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    userId : Principal,
    vorname : Text,
    nachname : Text,
    titel : Text,
  ) : Common.Result<(), Text> {
    // caller muss registriert sein.
    switch (users.get(caller)) {
      case null { return #err "Aufrufer nicht registriert" };
      case (?callerUser) {
        switch (users.get(userId)) {
          case null { #err "Benutzer nicht gefunden" };
          case (?target) {
            // TENANT-ISOLATION (Korrektur): serverseitige Tenant-Prüfung gegen
            // caller.kanzleiId. Der caller darf nur Benutzer seiner EIGENEN
            // Kanzlei bearbeiten — kein mandantenübergreifendes Bearbeiten
            // mehr, auch nicht für den Plattform-Admin in seiner normalen
            // Benutzerverwaltung. Die mandantenübergreifende Verwaltung
            // bleibt dem Modul Plattform-Admin vorbehalten. Die
            // superAdminWhitelist wird hier absichtlich NICHT als Bypass
            // verwendet — dieser Endpunkt ist ausschliesslich für die
            // own-Kanzlei-Verwaltung.
            if (target.kanzleiId != callerUser.kanzleiId) {
              return #err "Ziel-Benutzer gehört zu einer anderen Kanzlei";
            };
            // Profil-Felder aktualisieren (Leistungserbringer ist immutable —
            // Record ersetzen).
            let updated : Types.Leistungserbringer = {
              target with
              vorname;
              nachname;
              titel;
            };
            users.add(userId, updated);
            #ok ();
          };
        };
      };
    };
  };

  // Entfernt einen Leistungserbringer PHYSISCH und unwiderruflich aus dem
  // users-Map (im Gegensatz zu removeLeistungserbringer, das nur den Status
  // auf "inaktiv" setzt). Gated analog zu removeLeistungserbringer: Admin der
  // Kanzlei ODER Super-Admin (siehe lib/active-users.isAdminOfKanzlei).
  //
  // userId wird als Text übergeben (Principal-Text-Repräsentation) und vor
  // dem Lookup in den Principal konvertiert.
  public func deleteLeistungserbringer(
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    userId : Text,
  ) : Common.Result<(), Text> {
    // caller muss registriert sein.
    switch (users.get(caller)) {
      case null { return #err "Aufrufer nicht registriert" };
      case (_) {};
    };
    // userId (Text) direkt in Principal konvertieren. Eine ungültige
    // Text-Repräsentation trappt in Principal.fromText zur Laufzeit und
    // propagiert an den Aufrufer — akzeptabel für ein admin-gated,
    // destruktives Endpoint (das Frontend übergibt nur gültige Principal-Texte
    // authentifizierter Benutzer).
    let targetId : Principal = Principal.fromText(userId);
    // Selbst-Löschung verhindern.
    if (Principal.equal(caller, targetId)) {
      return #err "Sie können sich nicht selbst löschen";
    };
    switch (users.get(targetId)) {
      case null { #err "Benutzer nicht gefunden" };
      case (?target) {
        // Gating analog zu removeLeistungserbringer: Admin der Kanzlei ODER
        // Super-Admin (siehe lib/active-users.isAdminOfKanzlei).
        if (not ActiveUsersLib.isAdminOfKanzlei(users, superAdminWhitelist, caller, target.kanzleiId)) {
          return #err "Nur der Admin der Kanzlei oder ein Super-Admin darf Leistungserbringer löschen";
        };
        // Physisches Entfernen aus dem users-Map (unwiderruflich).
        users.remove(targetId);
        #ok ();
      };
    };
  };

  // ── Kanzlei-Verwaltung ─────────────────────────────────────────────────────

  public func updateKanzleiStundensatz(
    kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
    defaultStundensatz : Nat,
  ) : Common.Result<(), Text> {
    switch (users.get(caller)) {
      case null { return #err "Aufrufer nicht registriert" };
      case (?u) {
        switch (kanzleien.get(u.kanzleiId)) {
          case null { #err "Kanzlei nicht gefunden" };
          case (?k) {
            let updated : Types.Kanzlei = {
              k with
              defaultStundensatz;
            };
            kanzleien.add(u.kanzleiId, updated);
            #ok ();
          };
        };
      };
    };
  };

  public func getKanzlei(
    kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
  ) : ?Types.Kanzlei {
    switch (users.get(caller)) {
      case null null;
      case (?u) kanzleien.get(u.kanzleiId);
    };
  };

  // ── Invite link logic ──────────────────────────────────────────────────────

  public func createInviteToken(
    inviteTokens : Map.Map<Text, Types.InviteToken>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
    email : Text,
    tokenSeed : Text,
  ) : Common.Result<Text, Text> {
    switch (users.get(caller)) {
      case null { return #err "Aufrufer nicht registriert" };
      case (?u) {
        // Token = seed + caller + email + timestamp (einfach, eindeutig).
        let now = Time.now();
        let token : Text = tokenSeed # "-" # caller.toText() # "-" # now.toText();
        let invite : Types.InviteToken = {
          token;
          kanzleiId = u.kanzleiId;
          createdBy = caller;
          email;
          createdAt = now;
          redeemedBy = null;
        };
        inviteTokens.add(token, invite);
        #ok token;
      };
    };
  };

  // Löst einen Einladungslink ein und erstellt den neuen Benutzer mit
  // status = "aktiv" sowie dem ersten statusHistory-Eintrag
  // { year; month; status = "aktiv" } (Historisierung ab Registrierung).
  public func redeemInviteToken(
    inviteTokens : Map.Map<Text, Types.InviteToken>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
    token : Text,
    vorname : Text,
    nachname : Text,
    titel : Text,
    email : Text,
  ) : Common.Result<Types.Leistungserbringer, Text> {
    // caller darf noch nicht registriert sein.
    if (users.get(caller) != null) {
      return #err "Aufrufer ist bereits registriert";
    };
    switch (inviteTokens.get(token)) {
      case null { #err "Einladungslink ungültig" };
      case (?invite) {
        // Bereits eingelöst?
        switch (invite.redeemedBy) {
          case (?_) { return #err "Einladungslink wurde bereits eingelöst" };
          case null {};
        };
        let now = Time.now();
        // Ersten Status-Historien-Eintrag bauen.
        let (regYear, regMonth) = ActiveUsersLib.yearMonthFromTimestamp(now);
        let initialStatusHistory : [Types.StatusHistoryEntry] = [{
          year = regYear;
          month = regMonth;
          status = "aktiv";
        }];
        // Neuer Benutzer: kein Admin, role=null (wird via deriveRole als
        // #anwalt abgeleitet — Default für Nicht-Admins).
        let newUser : Types.Leistungserbringer = {
          id = caller;
          kanzleiId = invite.kanzleiId;
          vorname;
          nachname;
          titel;
          email;
          isAdmin = false;
          role = null;
          status = "aktiv";
          registeredAt = now;
          statusHistory = initialStatusHistory;
        };
        users.add(caller, newUser);
        // Token als eingelöst markieren.
        let redeemed : Types.InviteToken = {
          invite with
          redeemedBy = ?caller;
        };
        inviteTokens.add(token, redeemed);
        #ok newUser;
      };
    };
  };

  public func getInviteTokens(
    inviteTokens : Map.Map<Text, Types.InviteToken>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
  ) : [Types.InviteToken] {
    switch (users.get(caller)) {
      case null [];
      case (?u) {
        inviteTokens.values()
          .filter(func(t : Types.InviteToken) : Bool {
            t.kanzleiId == u.kanzleiId;
          })
          .toArray();
      };
    };
  };

  // ── Kanzlei-Stammdaten (Workstream A: Einstellungen > Kanzleidaten) ──────────
  //
  // Liefert die Kanzlei-Stammdaten des callers (seiner eigenen Kanzlei).
  // TENANT-ISOLATION: liefert ausschliesslich die Stammdaten der
  // caller-Kanzlei (users.get(caller).kanzleiId). Normale Mitarbeiter und
  // Mandanten dürfen LESEN (getKanzleiStammdaten ist eine query), aber nicht
  // schreiben (updateKanzleiStammdaten ist admin-gated).
  //
  // Liefert null, falls der caller nicht registriert ist ODER seine Kanzlei
  // noch keine Stammdaten erfasst hat.
  public func getKanzleiStammdaten(
    kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    caller : Principal,
  ) : ?Types.KanzleiStammdaten {
    // TENANT-ISOLATION: liefert ausschliesslich die Stammdaten der
    // caller-Kanzlei (users.get(caller).kanzleiId). Normale Mitarbeiter
    // und Mandanten dürfen LESEN (query), aber nicht schreiben.
    switch (users.get(caller)) {
      case null null;
      case (?u) {
        switch (kanzleien.get(u.kanzleiId)) {
          case null null;
          case (?k) k.stammdaten;
        };
      };
    };
  };

  // Aktualisiert die Kanzlei-Stammdaten des callers (seiner eigenen Kanzlei).
  // TENANT-ISOLATION + ADMIN-GATING: nur berechtigte Kanzlei-Admins (admin
  // oder plattform_admin der eigenen Kanzlei) ODER Super-Admins (via
  // superAdminWhitelist) dürfen ändern. Normale Mitarbeiter (mitarbeiter)
  // und Mandanten (mandant) werden abgewiesen. Verwendet das bestehende
  // requireKanzleiAdmin-Pattern (siehe lib/rechnungsvorlagen.mo).
  //
  // Backend-Validierung der 5 Pflichtfelder (kanzleiname, strasseHausnummer,
  // plz, ort, land) via validateStammdaten — leere/whitespace-only Werte
  // werden mit #err "<Feldname> darf nicht leer sein" abgewiesen.
  // Optionale Felder dürfen "" sein.
  //
  // kanzleiLogoBlob wird STRIKT GETRENNT vom Rechnungslogo (logoBlob in
  // rechnungsvorlagen) behandelt — es wird nur in kanzlei.stammdaten
  // gespeichert und berührt NICHT rechnungsvorlagen.
  //
  // Liefert #ok mit den gespeicherten Stammdaten bei Erfolg, #err mit
  // deutscher Meldung bei Validierungs-/Autorisierungsfehlern.
  public func updateKanzleiStammdaten(
    kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    stammdaten : Types.KanzleiStammdaten,
  ) : Common.Result<Types.KanzleiStammdaten, Text> {
    // ADMIN-GATING via requireKanzleiAdmin (siehe lib/rechnungsvorlagen.mo):
    // nur berechtigte Kanzlei-Admins (admin oder plattform_admin der
    // eigenen Kanzlei) ODER Super-Admins (via superAdminWhitelist) dürfen
    // ändern. Normale Mitarbeiter (mitarbeiter) und Mandanten (mandant)
    // werden abgewiesen. requireKanzleiAdmin liefert #ok(kanzleiId) — die
    // autorisierte kanzleiId des callers, die für den Tenant-sicheren
    // Update verwendet wird.
    switch (VorlagenLib.requireKanzleiAdmin(users, superAdminWhitelist, caller)) {
      case (#err msg) { return #err msg };
      case (#ok _) {};
    };
    // Backend-Validierung der 5 Pflichtfelder vor dem Persistieren.
    switch (validateStammdaten(stammdaten)) {
      case (#err msg) { return #err msg };
      case (#ok _) {};
    };
    // caller muss registriert sein (requireKanzleiAdmin hat das bereits
    // sichergestellt, aber wir brauchen die kanzleiId für den Lookup).
    switch (users.get(caller)) {
      case null { #err "Aufrufer nicht registriert" };
      case (?u) {
        switch (kanzleien.get(u.kanzleiId)) {
          case null { #err "Kanzlei nicht gefunden" };
          case (?k) {
            // Stammdaten in den Kanzlei-Record eintragen. kanzleiLogoBlob
            // wird STRIKT GETRENNT vom Rechnungslogo (logoBlob in
            // rechnungsvorlagen) behandelt — es wird nur in
            // kanzlei.stammdaten gespeichert und berührt NICHT
            // rechnungsvorlagen.
            let updated : Types.Kanzlei = {
              k with
              stammdaten = ?stammdaten;
            };
            kanzleien.add(u.kanzleiId, updated);
            #ok stammdaten;
          };
        };
      };
    };
  };

  // Validiert die Pflichtfelder der Kanzlei-Stammdaten. Die 5 Pflichtfelder
  // (kanzleiname, strasseHausnummer, plz, ort, land) dürfen nicht leer
  // und nicht nur-whitespace sein. Optionale Felder (telefon, email,
  // website, uid, mwstNr) dürfen "" sein und werden nicht validiert.
  // kanzleiLogoBlob wird nicht validiert (optionaler Blob).
  //
  // Liefert #ok () bei gültigen Stammdaten, #err mit deutscher Meldung
  // (z.B. "Kanzleiname darf nicht leer sein") bei Validierungsfehlern.
  public func validateStammdaten(
    stammdaten : Types.KanzleiStammdaten,
  ) : Common.Result<(), Text> {
    // Hilfsfunktion: prüft, ob ein Text leer oder nur-whitespace ist.
    // trim(#char ' ') entfernt führende/folgende Leerzeichen; das Resultat
    // ist leer genau dann, wenn der Wert leer oder nur-whitespace war.
    func isBlank(value : Text) : Bool {
      value.trim(#char ' ') == "";
    };
    // 5 Pflichtfelder prüfen (Reihenfolge gemäss Typdefinition).
    if (isBlank(stammdaten.kanzleiname)) {
      return #err "Kanzleiname darf nicht leer sein";
    };
    if (isBlank(stammdaten.strasseHausnummer)) {
      return #err "Strasse/Hausnummer darf nicht leer sein";
    };
    if (isBlank(stammdaten.plz)) {
      return #err "PLZ darf nicht leer sein";
    };
    if (isBlank(stammdaten.ort)) {
      return #err "Ort darf nicht leer sein";
    };
    if (isBlank(stammdaten.land)) {
      return #err "Land darf nicht leer sein";
    };
    // Optionale Felder (telefon, email, website, uid, mwstNr) dürfen ""
    // sein und werden nicht validiert. kanzleiLogoBlob ist ein optionaler
    // Blob und wird nicht validiert.
    #ok ();
  };
};
