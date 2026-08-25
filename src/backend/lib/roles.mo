import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import RolesTypes "../types/roles";
import SuperAdminTypes "../types/super-admin";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Principal "mo:core/Principal";
import Text "mo:core/Text";

module {
  // ─── Role derivation ───────────────────────────────────────────────────────
  //
  // The `role` field is the source of truth and takes precedence over the
  // legacy `isAdmin` boolean. When `role` is set, it is returned directly
  // (including ?#plattform_admin → #plattform_admin). When `role` is null
  // (legacy users not yet migrated), `isAdmin=true` maps to #admin and
  // `isAdmin=false` maps to the default #anwalt.
  //
  // #plattform_admin-Regel: deriveRole gibt #plattform_admin zurück, wenn
  // role = ?#plattform_admin gesetzt ist. Die isAdmin-Sync-Logik in
  // updateUserRole setzt isAdmin NICHT auf true für #plattform_admin — es
  // ist eine separate, höhere Rolle. Die autoritative Super-Admin-Prüfung
  // bleibt die superAdminWhitelist (isSuperAdmin).

  public func deriveRole(
    isAdmin : Bool,
    role : ?KanzleiTypes.Role,
  ) : KanzleiTypes.Role {
    switch (role) {
      case (?r) r;
      case null if (isAdmin) { #admin } else { #anwalt };
    };
  };

  // ─── Migration ─────────────────────────────────────────────────────────────
  //
  // Konvertiert bestehende Benutzer ins neue Rollenmodell:
  //   - isAdmin=true → role=#admin (isAdmin bleibt für Backward-Compat).
  //   - isAdmin=false & role=null → role=#anwalt (Default).
  //   - Bereits gesetzte role bleibt unangetastet (idempotent).
  //
  // WICHTIG: migrateRoles darf KEINEN Admin zu #plattform_admin konvertieren.
  // #plattform_admin wird ausschliesslich durch die Auto-Beförderung der
  // allerersten Registrierung (lib/kanzlei.registerKanzlei) ODER durch die
  // einmalige promoteJoaoMarques-Hard-Promotion gesetzt. Diese Funktion
  // lässt bestehende #admin-Benutzer unangetastet.

  public func migrateRoles(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  ) : RolesTypes.MigrationSummary {
    var convertedCount : Nat = 0;
    var unchangedCount : Nat = 0;
    // Snapshot der Einträge, damit tabulate sie indiziert abrufen kann.
    // (Array.init / Array.freeze existieren in mo:core/Array nicht —
    // tabulate berechnet jeden Wert direkt.)
    let entries : [(Principal, KanzleiTypes.Leistungserbringer)] = users.entries().toArray();
    let results : [RolesTypes.RoleMigrationResult] = Array.tabulate(
      entries.size(),
      func(i : Nat) : RolesTypes.RoleMigrationResult {
        let (p, u) = entries[i];
        let previousRole : KanzleiTypes.Role = deriveRole(u.isAdmin, u.role);
        let (newRole : KanzleiTypes.Role, changed : Bool) = switch (u.role) {
          // Bereits eine Rolle gesetzt → unangetastet (idempotent).
          case (?r) { (r, false) };
          // Keine Rolle gesetzt → aus isAdmin ableiten.
          case null {
            if (u.isAdmin) {
              // isAdmin=true → #admin. Rolle setzen.
              (#admin, true);
            } else {
              // isAdmin=false → Default #anwalt. Rolle setzen.
              (#anwalt, true);
            };
          };
        };
        if (changed) {
          // Leistungserbringer-Felder sind immutable — ganzen Record ersetzen.
          users.add(p, { u with role = ?newRole });
          convertedCount += 1;
        } else {
          unchangedCount += 1;
        };
        {
          principal = p;
          previousRole;
          newRole;
          changed;
        };
      },
    );
    {
      results;
      convertedCount;
      unchangedCount;
    };
  };

  // ─── Role updates ─────────────────────────────────────────────────────────
  //
  // Ändert die Rolle eines Benutzers auf eine der vier regulären Rollen
  // (Admin, Anwalt, Mitarbeiter, Mandant). isAdmin wird synchron gehalten
  // (true gdw. newRole == #admin) — für #plattform_admin wird isAdmin NICHT
  // true gesetzt (separate, höhere Rolle).
  //
  // #plattform_admin ist hier VERBOTEN: jeder Versuch, role via
  // updateUserRole auf #plattform_admin zu setzen, muss abgelehnt werden
  // (trap oder #err). #plattform_admin wird ausschliesslich durch die
  // Auto-Beförderung der ersten Registrierung ODER die einmalige
  // promoteJoaoMarques-Hard-Promotion gesetzt.

  public func updateUserRole(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    userId : Principal,
    newRole : KanzleiTypes.Role,
  ) : Common.Result<KanzleiTypes.Leistungserbringer, Text> {
    // #plattform_admin ist über diesen Pfad VERBOTEN.
    switch (newRole) {
      case (#plattform_admin) {
        return #err "Die Rolle 'Plattform-Admin' darf nicht manuell zugewiesen werden";
      };
      case (_) {};
    };
    switch (users.get(userId)) {
      case (?u) {
        // Leistungserbringer-Felder sind immutable — ganzen Record ersetzen.
        // isAdmin synchron halten: true gdw. newRole == #admin.
        // Für #plattform_admin wird isAdmin NICHT true gesetzt — aber dieser
        // Pfad ist oben bereits abgelehnt worden.
        let updatedIsAdmin : Bool = switch (newRole) {
          case (#admin) true;
          case (_) false;
        };
        let updated : KanzleiTypes.Leistungserbringer = {
          u with role = ?newRole; isAdmin = updatedIsAdmin;
        };
        users.add(userId, updated);
        #ok updated;
      };
      case null #err "Benutzer nicht gefunden";
    };
  };

  // ─── Authorization helper ──────────────────────────────────────────────────
  //
  // Entscheidet, ob der caller die Rolle von targetUserId ändern darf, und
  // liefert die aktuelle (maskierte) Rolle des Ziels zurück — verwendet vom
  // Frontend zum Befüllen der Rollen-Auswahlliste.
  //
  // #plattform_admin-Regel: canChangeRole muss die Zuweisung von
  // #plattform_admin über den normalen updateUserRole-Pfad VERBIETEN —
  // nur die Auto-Beförderung der ersten Registrierung ODER die
  // promoteJoaoMarques-Hard-Promotion darf sie setzen.

  public func canChangeRole(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    targetUserId : Principal,
  ) : Common.Result<KanzleiTypes.Role, Text> {
    // Super-Admin darf jede Rolle ändern (innerhalb der regulären Rollen —
    // #plattform_admin wird via updateUserRole ohnehin abgelehnt).
    let callerIsSuperAdmin : Bool = superAdminWhitelist.get(caller) != null;
    if (callerIsSuperAdmin) {
      switch (users.get(targetUserId)) {
        case (?target) {
          let role : KanzleiTypes.Role = deriveRole(target.isAdmin, target.role);
          // Maskierung: Super-Admin sieht die echte Rolle.
          #ok role;
        };
        case null #err "Ziel-Benutzer nicht gefunden";
      };
    } else {
      // Kanzlei-Admin: muss Admin der gleichen Kanzlei wie das Ziel sein.
      switch (users.get(caller)) {
        case (?callerUser) {
          let callerRole : KanzleiTypes.Role = deriveRole(callerUser.isAdmin, callerUser.role);
          // Nur Admins (oder Plattform-Admin) dürfen Rollen ändern.
          let callerIsAdmin : Bool = switch (callerRole) {
            case (#plattform_admin) true;
            case (#admin) true;
            case (_) false;
          };
          if (not callerIsAdmin) {
            return #err "Nur Admins dürfen Rollen ändern";
          };
          // Ziel muss in der gleichen Kanzlei sein.
          switch (users.get(targetUserId)) {
            case (?target) {
              if (target.kanzleiId != callerUser.kanzleiId) {
                return #err "Ziel-Benutzer gehört zu einer anderen Kanzlei";
              };
              let targetRole : KanzleiTypes.Role = deriveRole(target.isAdmin, target.role);
              // Maskierung: Nicht-Super-Admin sieht #plattform_admin als #admin.
              #ok(maskRoleForCaller(targetRole, false));
            };
            case null #err "Ziel-Benutzer nicht gefunden";
          }
        };
        case null #err "Aufrufer nicht gefunden";
      };
    };
  };

  // ─── Role masking ──────────────────────────────────────────────────────────
  //
  // Maskiert #plattform_admin für Nicht-Plattform-Admin-Aufrufer. Wenn der
  // caller KEIN Super-Admin ist (callerIsSuperAdmin = false), wird
  // #plattform_admin als #admin zurückgegeben, damit die Plattform-Admin-Rolle
  // in anderen Kanzleien weder in der Benutzerverwaltung noch in
  // Rollen-Auswahllisten sichtbar wird. Ist der caller Super-Admin, bleibt
  // die Rolle unverändert (der Plattform-Admin sieht seine eigene Rolle).
  //
  // Anzuwenden in allen Query-Rückgabepfaden, die Leistungserbringer oder
  // role an kanzlei-scoped Aufrufer zurückgeben (z.B. getLeistungserbringer,
  // getUserRole, getCurrentUser).

  public func maskRoleForCaller(
    role : KanzleiTypes.Role,
    callerIsSuperAdmin : Bool,
  ) : KanzleiTypes.Role {
    switch (role) {
      case (#plattform_admin) {
        if (callerIsSuperAdmin) { #plattform_admin } else { #admin };
      };
      case (r) r;
    };
  };

  // ─── promoteJoaoMarques (einmalige Hard-Promotion) ──────────────────────────
  //
  // Einmalige Hard-Promotion: findet den Benutzer mit der E-Mail
  // 'joao.marques@iservices.ch' und
  //   1. setzt role = ?#plattform_admin (sofern noch nicht gesetzt),
  //   2. trägt den Principal in die superAdminWhitelist ein (sofern noch
  //      nicht eingetragen).
  //
  // Idempotent: ein erneuter Aufruf ändert nichts, wenn der Benutzer bereits
  // #plattform_admin hat und/oder bereits in der Whitelist steht.
  //
  // WICHTIG: dies ist die EINZIGE Stelle neben der Auto-Beförderung der
  // allerersten Registrierung (autoPromoteFirstSuperAdmin), die
  // #plattform_admin vergibt. updateUserRole lehnt #plattform_admin ab.
  //
  // Liefert PromotionResult mit dem gefundenen Principal (None, wenn kein
  // Benutzer mit der E-Mail existiert), changed und whitelistAdded Flags.
  // Die Zugriffsprüfung (Super-Admin-only) erfolgt im Mixin.

  public func promoteJoaoMarques(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    now : Common.Timestamp,
  ) : RolesTypes.PromotionResult {
    let targetEmail : Text = "joao.marques@iservices.ch";
    // Case-insensitive, trim-normalisierter Vergleich.
    let normalizedTarget : Text = targetEmail.toLower().trim(#char ' ');
    var foundPrincipal : ?Principal = null;
    var changed : Bool = false;
    var whitelistAdded : Bool = false;
    for ((p, u) in users.entries()) {
      let normalizedEmail : Text = u.email.toLower().trim(#char ' ');
      if (normalizedEmail == normalizedTarget) {
        foundPrincipal := ?p;
        // 1. role = ?#plattform_admin setzen, sofern noch nicht gesetzt.
        let alreadyPlattformAdmin : Bool = switch (u.role) {
          case (?#plattform_admin) true;
          case (_) false;
        };
        if (not alreadyPlattformAdmin) {
          // Leistungserbringer-Felder sind immutable — ganzen Record ersetzen.
          users.add(p, { u with role = ?#plattform_admin });
          changed := true;
        };
        // 2. In superAdminWhitelist eintragen, sofern noch nicht vorhanden.
        if (superAdminWhitelist.get(p) == null) {
          let entry : SuperAdminTypes.SuperAdminWhitelistEntry = {
            principal = p;
            addedAt = now;
          };
          superAdminWhitelist.add(p, entry);
          whitelistAdded := true;
        };
        // Erster Treffer genügt (E-Mail sollte eindeutig sein).
        return {
          principal = foundPrincipal;
          email = targetEmail;
          changed;
          whitelistAdded;
        };
      };
    };
    // Kein Benutzer mit der E-Mail gefunden.
    {
      principal = null;
      email = targetEmail;
      changed = false;
      whitelistAdded = false;
    };
  };
};
