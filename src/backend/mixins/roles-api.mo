import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import RolesTypes "../types/roles";
import SuperAdminTypes "../types/super-admin";
import RolesLib "../lib/roles";
import SuperAdminLib "../lib/super-admin";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";

mixin (
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
) {
  // ─── Migration endpoint ────────────────────────────────────────────────────
  //
  // One-time migration: converts existing users with isAdmin=true to
  // role=#admin, and users with isAdmin=false and role=null to role=#anwalt.
  // Idempotent. KEIN Admin wird zu #plattform_admin konvertiert —
  // #plattform_admin wird ausschliesslich durch die Auto-Beförderung der
  // allerersten Registrierung ODER die einmalige promoteJoaoMarques-
  // Hard-Promotion gesetzt.
  //
  // Authorization: Super-Admin only.

  public shared ({ caller }) func migrateRoles() : async Common.Result<RolesTypes.MigrationSummary, Text> {
    if (not SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      return #err "Keine Berechtigung: nur Super-Admins dürfen die Rollen-Migration durchführen";
    };
    #ok(RolesLib.migrateRoles(users));
  };

  // ─── Role update endpoint ──────────────────────────────────────────────────
  //
  // Ändert die Rolle eines Benutzers auf eine der vier regulären Rollen
  // (Admin, Anwalt, Mitarbeiter, Mandant). #plattform_admin ist VERBOTEN —
  // jeder Versuch, role via updateUserRole auf #plattform_admin zu setzen,
  // wird abgelehnt (trap oder #err). #plattform_admin wird ausschliesslich
  // durch die Auto-Beförderung der ersten Registrierung ODER die einmalige
  // promoteJoaoMarques-Hard-Promotion gesetzt.
  //
  // Authorization:
  //   - Super-Admin: may change any user's role across all kanzleien.
  //   - Kanzlei admin: may change roles of users within their own kanzlei.

  public shared ({ caller }) func updateUserRole(
    userId : Principal,
    newRole : KanzleiTypes.Role,
  ) : async Common.Result<KanzleiTypes.Leistungserbringer, Text> {
    // #plattform_admin über diesen Pfad VERBOTEN — updateUserRole lehnt ab.
    switch (newRole) {
      case (#plattform_admin) {
        return #err "Die Rolle 'Plattform-Admin' darf nicht manuell zugewiesen werden";
      };
      case (_) {};
    };
    // Autorisierung: Super-Admin ODER Admin der gleichen Kanzlei wie das Ziel.
    let callerIsSuperAdmin : Bool = SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller);
    if (not callerIsSuperAdmin) {
      switch (users.get(caller)) {
        case (?callerUser) {
          let callerRole : KanzleiTypes.Role = RolesLib.deriveRole(callerUser.isAdmin, callerUser.role);
          let callerIsAdmin : Bool = switch (callerRole) {
            case (#plattform_admin) true;
            case (#admin) true;
            case (_) false;
          };
          if (not callerIsAdmin) {
            return #err "Keine Berechtigung: nur Admins dürfen Rollen ändern";
          };
          // Ziel muss in der gleichen Kanzlei sein.
          switch (users.get(userId)) {
            case (?target) {
              if (target.kanzleiId != callerUser.kanzleiId) {
                return #err "Keine Berechtigung: Ziel-Benutzer gehört zu einer anderen Kanzlei";
              };
            };
            case null return #err "Ziel-Benutzer nicht gefunden";
          };
        };
        case null return #err "Aufrufer nicht gefunden";
      };
    };
    RolesLib.updateUserRole(users, userId, newRole);
  };

  // ─── Role query endpoint ────────────────────────────────────────────────────
  //
  // Returns the effective role of the caller, derived via deriveRole.
  // Maskierung: #plattform_admin wird für Nicht-Plattform-Admin-Aufrufer
  // als #admin zurückgegeben (maskRoleForCaller). Der Plattform-Admin selbst
  // sieht #plattform_admin.

  public query ({ caller }) func getMyRole() : async ?KanzleiTypes.Role {
    switch (users.get(caller)) {
      case (?u) {
        let role : KanzleiTypes.Role = RolesLib.deriveRole(u.isAdmin, u.role);
        let callerIsSuperAdmin : Bool = SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller);
        ?RolesLib.maskRoleForCaller(role, callerIsSuperAdmin);
      };
      case null null;
    };
  };

  // ─── Role query for a specific user ─────────────────────────────────────────
  //
  // Returns the effective role of a given user. Authorization: the caller
  // must be an admin of the same kanzlei or a Super-Admin.
  // Maskierung: #plattform_admin wird für Nicht-Plattform-Admin-Aufrufer
  // als #admin zurückgegeben, damit die Plattform-Admin-Rolle für andere
  // Kanzleien unsichtbar bleibt.

  public query ({ caller }) func getUserRole(
    userId : Principal,
  ) : async Common.Result<KanzleiTypes.Role, Text> {
    RolesLib.canChangeRole(users, superAdminWhitelist, caller, userId);
  };

  // ─── promoteJoaoMarques endpoint (einmalige Hard-Promotion) ──────────────────
  //
  // Einmalige Hard-Promotion: findet den Benutzer mit der E-Mail
  // 'joao.marques@iservices.ch' und setzt role = ?#plattform_admin sowie
  // trägt den Principal in die superAdminWhitelist ein. Idempotent.
  //
  // WICHTIG: dies ist die EINZIGE Stelle neben der Auto-Beförderung der
  // allerersten Registrierung, die #plattform_admin vergibt. updateUserRole
  // lehnt #plattform_admin ab.
  //
  // Authorization: Super-Admin only. Ein Nicht-Super-Admin-Aufruf wird
  // abgelehnt (#err).

  public shared ({ caller }) func promoteJoaoMarques() : async Common.Result<RolesTypes.PromotionResult, Text> {
    if (not SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      return #err "Keine Berechtigung: nur Super-Admins dürfen die Joao-Marques-Promotion durchführen";
    };
    #ok(RolesLib.promoteJoaoMarques(users, superAdminWhitelist, Time.now()));
  };
};
