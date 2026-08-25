// security-fixes domain logic
//
// Dieses Modul kapselt die zentralen Guard-Helper für den Sicherheits-Build
// sowie die reactivateKanzlei-Logik.
//
// Die Guards werden von den bestehenden mixins (leistungen-api,
// klienten-api, datenschutz-api, stopwatch-budget-api, rechnungen-api,
// reporting-api) aufgerufen, um serverseitig
//   (a) den Benutzerstatus (status == "aktiv") und
//   (b) den Kanzleistatus (kanzlei.status == "aktiv")
// zu prüfen. Plattform-Admins (superAdminWhitelist) umgehen beide Prüfungen.
//
// WICHTIG: Die Guards dürfen die bestehenden Plattform-Admin-Rechte
// (deactivateKanzlei, reactivateKanzlei, deleteKanzlei) NICHT blockieren.
// Die Super-Admin-Whitelist ist der autoritative Bypass.

import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import SecurityTypes "../types/security-fixes";
import ActiveUsersLib "../lib/active-users";
import SuperAdminLib "../lib/super-admin";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";

module {

  // ── Auto-Registrierung des Canister-Controllers (Owner) ───────────────────
  //
  // Der Canister-Owner (Controller) wird bei der Installation NICHT
  // automatisch als Benutzer registriert — Registrierung erfolgt nur via
  // explizitem registerKanzlei oder redeemInviteToken. Folglich trappt jeder
  // Backend-Aufruf des Owners mit IC0503 "Benutzer nicht registriert", da
  // requireActiveUser/requireActiveUserAndKanzlei den caller nicht in der
  // users-Map finden.
  //
  // autoRegisterController behebt dies auf zwei Wegen:
  //
  //   (a) Canister-Controller: ist der caller der Controller des Canisters
  //       (Principal.isController(caller) == true) UND noch nicht in der
  //       users-Map, wird er als plattform_admin-Leistungserbringer mit einer
  //       Default-Kanzlei registriert.
  //
  //   (b) Erster authentifizierter Benutzer (Owner-Bootstrap): ist die
  //       users-Map LEER und der caller authentifiziert (nicht anonym), wird
  //       der caller ebenfalls als plattform_admin-Leistungserbringer mit
  //       Default-Kanzlei registriert. Das ist der reguläre Bootstrap-Pfad
  //       für den Owner, der sich mit seiner Internet Identity anmeldet —
  //       der II-Principal ist NICHT der Canister-Controller, daher greift
  //       Weg (a) für ihn nicht. Die "leere users-Map"-Bedingung spiegelt
  //       die autoPromoteFirstSuperAdmin-Semantik (erste Registrierung wird
  //       Super-Admin) und stellt sicher, dass nur der allererste Benutzer
  //       auto-registriert wird — alle späteren nicht-registrierten Caller
  //       trappen wie bisher mit "Benutzer nicht registriert".
  //
  // Die Funktion ist IDEMPOTENT — ist der caller bereits registriert, tut
  // sie nichts. Für nicht-registrierte Caller, die weder Controller sind noch
  // der erste Benutzer (users nicht leer), tut sie ebenfalls nichts (die
  // Guards trappen anschliessend wie bisher).
  //
  // kanzleien ist optional (?): requireActiveUser hat keinen kanzleien-Parameter
  // (Contract aus lib/support.mo), daher kann dort keine Kanzlei angelegt
  // werden. requireActiveUserAndKanzlei übergibt ?kanzleien und legt die
  // Default-Kanzlei bei Bedarf an. Wird der caller zuerst über einen
  // requireActiveUser-Pfad registriert (ohne Kanzlei), legt der nächste
  // requireActiveUserAndKanzlei-Aufruf die Kanzlei nachträglich an, bevor
  // deren Kanzlei-Status-Prüfung greift.
  //
  // Default-Kanzlei: id = caller.toText(), name = "Kanzlei", status = "aktiv".
  // Default-Leistungserbringer: role = ?#plattform_admin, isAdmin = true,
  // status = "aktiv", kanzleiId = caller.toText(), mit einem initialen
  // statusHistory-Eintrag (via ActiveUsersLib.yearMonthFromTimestamp).
  // autoPromoteFirstSuperAdmin wird aufgerufen, damit der erste Controller
  // bei leerer Whitelist automatisch Super-Admin wird.

  func autoRegisterController(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    kanzleien : ?Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : () {
    // Idempotent: bereits registriert → nichts zu tun.
    if (users.get(caller) != null) { return };
    // Auto-Registrierung nur für:
    //   (a) den Canister-Controller, ODER
    //   (b) den allerersten authentifizierten Benutzer (leere users-Map).
    // Anonyme Principale werden nie auto-registriert. Nicht-registrierte
    // Caller, die weder Controller sind noch der erste Benutzer (users
    // nicht leer), fallen durch die Guards wie bisher.
    let isController = caller.isController();
    let isFirstUser = users.isEmpty() and not caller.isAnonymous();
    if (not isController and not isFirstUser) { return };

    let now : Common.Timestamp = Time.now();
    let kanzleiId : Common.KanzleiId = caller.toText();

    // Default-Kanzlei anlegen, falls eine kanzleien-Map übergeben wurde und
    // noch keine Kanzlei unter kanzleiId existiert.
    switch (kanzleien) {
      case null {};
      case (?kMap) {
        if (kMap.get(kanzleiId) == null) {
          let kanzlei : KanzleiTypes.Kanzlei = {
            id = kanzleiId;
            name = "Kanzlei";
            defaultStundensatz = 0;
            zahlungsmodalitaet = null;
            status = "aktiv";
            createdAt = now;
            stammdaten = null;
          };
          kMap.add(kanzleiId, kanzlei);
        };
      };
    };

    // Initialen statusHistory-Eintrag aus dem aktuellen Monat ableiten.
    let (year, month) = ActiveUsersLib.yearMonthFromTimestamp(now);
    let statusHistory : [KanzleiTypes.StatusHistoryEntry] = [{
      year;
      month;
      status = "aktiv";
    }];

    // Leistungserbringer-Record für den Controller anlegen.
    let leistungserbringer : KanzleiTypes.Leistungserbringer = {
      id = caller;
      kanzleiId = kanzleiId;
      vorname = "";
      nachname = "";
      titel = "";
      email = "";
      isAdmin = true;
      role = ?#plattform_admin;
      status = "aktiv";
      registeredAt = now;
      statusHistory = statusHistory;
    };
    users.add(caller, leistungserbringer);

    // Ersten Controller bei leerer Whitelist automatisch zum Super-Admin
    // befördern (idempotent — tut nichts, wenn die Whitelist bereits
    // Einträge enthält oder der caller bereits eingetragen ist).
    ignore SuperAdminLib.autoPromoteFirstSuperAdmin(superAdminWhitelist, caller, now);
  };

  // ── Zentrale Guard-Helper ────────────────────────────────────────────────
  //
  // requireActiveUser: prüft, dass der caller registriert UND status == "aktiv"
  // ist. Plattform-Admins (superAdminWhitelist) umgehen die Status-Prüfung.
  // Trap-Meldung bei inaktivem Benutzer: "Benutzer ist deaktiviert".
  //
  // requireActiveUserAndKanzlei: prüft zusätzlich, dass die Kanzlei des callers
  // status == "aktiv" hat. Plattform-Admins umgehen auch diese Prüfung.
  // Trap-Meldung bei inaktiver Kanzlei: "Kanzlei ist deaktiviert".
  //
  // Beide Guards rufen VOR der Benutzer-Suche autoRegisterController auf,
  // damit der Canister-Owner bei der ersten Backend-Interaktion automatisch
  // als plattform_admin registriert wird, statt mit IC0503 zu trappen. Die
  // Auto-Registrierung ist idempotent und betrifft ausschliesslich den
  // Controller — alle anderen nicht-registrierten Caller trappen wie bisher.
  //
  // Beide Guards liefern den aufgelösten Leistungserbringer zurück, damit
  // nachfolgende Fach-Logik ihn ohne erneutes Lookup verwenden kann.

  public func requireActiveUser(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : KanzleiTypes.Leistungserbringer {
    // Canister-Controller bei Bedarf auto-registrieren (idempotent). Da
    // requireActiveUser keinen kanzleien-Parameter hat (Contract aus
    // lib/support.mo), wird hier keine Default-Kanzlei angelegt — das
    // übernimmt requireActiveUserAndKanzlei beim ersten Aufruf.
    autoRegisterController(users, null, superAdminWhitelist, caller);
    let isSuperAdmin = superAdminWhitelist.get(caller) != null;
    switch (users.get(caller)) {
      case null { Runtime.trap("Benutzer nicht registriert") };
      case (?u) {
        // Plattform-Admins umgehen die Status-Prüfung, damit sie weiterhin
        // mandantenübergreifend verwalten können (deactivate/reactivate/delete).
        if (not isSuperAdmin and u.status != "aktiv") {
          Runtime.trap("Benutzer ist deaktiviert");
        };
        u;
      };
    };
  };

  public func requireActiveUserAndKanzlei(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : KanzleiTypes.Leistungserbringer {
    // Canister-Controller bei Bedarf auto-registrieren (idempotent). Hier
    // wird auch die Default-Kanzlei angelegt, falls der Controller noch
    // keine hat, damit die nachfolgende Kanzlei-Status-Prüfung sie findet.
    autoRegisterController(users, ?kanzleien, superAdminWhitelist, caller);
    let isSuperAdmin = superAdminWhitelist.get(caller) != null;
    // Benutzer-Status prüfen (Plattform-Admin-Bypass bleibt erhalten).
    let user = switch (users.get(caller)) {
      case null { Runtime.trap("Benutzer nicht registriert") };
      case (?u) {
        if (not isSuperAdmin and u.status != "aktiv") {
          Runtime.trap("Benutzer ist deaktiviert");
        };
        u;
      };
    };
    // Kanzlei-Status prüfen (Plattform-Admin-Bypass bleibt erhalten).
    switch (kanzleien.get(user.kanzleiId)) {
      case null { Runtime.trap("Kanzlei nicht gefunden") };
      case (?k) {
        if (not isSuperAdmin and k.status != "aktiv") {
          Runtime.trap("Kanzlei ist deaktiviert");
        };
      };
    };
    user;
  };

  // ── Tenant-Isolation für removeLeistungserbringer ─────────────────────────
  //
  // Prüft, ob der caller berechtigt ist, den Zielbenutzer zu deaktivieren:
  //   (a) caller ist Plattform-Admin (superAdminWhitelist) → immer erlaubt
  //       (mandantenübergreifend), ODER
  //   (b) caller ist Kanzlei-Admin (deriveRole in {#plattform_admin, #admin})
  //       UND target.kanzleiId == caller.kanzleiId (gleicher Tenant).
  //
  // Spiegelt das Pattern aus deleteLeistungserbringer (lib/kanzlei.mo:324),
  // das ActiveUsersLib.isAdminOfKanzlei verwendet.
  //
  // Liefert true, wenn der caller berechtigt ist; false sonst. Der Aufrufer
  // (removeLeistungserbringer) entscheidet über trap/#err bei false.

  public func canDeactivateLeistungserbringer(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    targetKanzleiId : Common.KanzleiId,
  ) : Bool {
    // Plattform-Admin → immer erlaubt (mandantenübergreifend).
    if (superAdminWhitelist.get(caller) != null) { return true };
    // Sonst: caller muss ein registrierter Admin derselben Kanzlei sein.
    switch (users.get(caller)) {
      case null { false };
      case (?callerUser) {
        // Tenant-Isolation: caller muss derselben Kanzlei angehören wie target.
        if (callerUser.kanzleiId != targetKanzleiId) { return false };
        // Rolle ableiten: role-Feld bevorzugt, isAdmin als Fallback.
        let role : KanzleiTypes.Role = switch (callerUser.role) {
          case (?r) r;
          case null if (callerUser.isAdmin) { #admin } else { #anwalt };
        };
        switch (role) {
          case (#plattform_admin) true;
          case (#admin) true;
          case (_) false;
        };
      };
    };
  };

  // ── reactivateKanzlei ────────────────────────────────────────────────────
  //
  // Reaktiviert eine deaktivierte Kanzlei, indem der Kanzlei-Status auf
  // "aktiv" gesetzt wird (Spiegel von deactivateKanzlei in
  // lib/super-admin.mo:333, das status auf "inaktiv" setzt). Nur Super-Admins
  // dürfen reaktivieren. Physisches Löschen bleibt deleteKanzlei vorbehalten.
  //
  // Signatur ist identisch zu deactivateKanzlei:
  //   (kanzleien, superAdminWhitelist, caller, kanzleiId) -> Result<(), Text>
  //
  // Fehlermeldungen:
  //   - "Nur Super-Admins dürfen Kanzleien reaktivieren" (kein Super-Admin)
  //   - "Kanzlei nicht gefunden" (kanzleiId nicht in kanzleien)

  public func reactivateKanzlei(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    kanzleiId : Text,
  ) : Common.Result<(), Text> {
    // Nur Super-Admins dürfen eine Kanzlei reaktivieren.
    if (superAdminWhitelist.get(caller) == null) {
      return #err "Nur Super-Admins dürfen Kanzleien reaktivieren";
    };
    switch (kanzleien.get(kanzleiId)) {
      case null { #err "Kanzlei nicht gefunden" };
      case (?k) {
        // Status auf "aktiv" setzen (Spiegel von deactivateKanzlei).
        let updated : KanzleiTypes.Kanzlei = {
          k with
          status = "aktiv";
        };
        kanzleien.add(kanzleiId, updated);
        #ok ();
      };
    };
  };
};
