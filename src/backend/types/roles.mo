import Common "common";
import KanzleiTypes "kanzlei";

module {
  // The assignable roles. Re-exported from KanzleiTypes.Role so the
  // roles domain owns a single canonical alias; the underlying variant lives
  // in types/kanzlei.mo (now {#plattform_admin,#admin,#anwalt,
  // #mitarbeiter,#mandant}) and is reused across domains.
  //
  // #plattform_admin ist eine separate, höhere Rolle, die NUR für den
  // Plattform-Admin selbst gesetzt wird und für andere Kanzleien maskiert
  // bleibt (siehe lib/roles.mo maskRoleForCaller).
  public type Role = KanzleiTypes.Role;

  // Result of a single user's role migration. Reports the principal, the
  // previous effective role (derived from the old isAdmin/role pair), and the
  // new role assigned by the migration. Used by migrateRoles() to give the
  // caller a per-user audit of what changed — without persisting an audit
  // log (audit logging for role changes is excluded by the build contract).
  public type RoleMigrationResult = {
    principal : Principal;
    previousRole : Role;
    newRole : Role;
    changed : Bool; // false when the user already had role=#admin (no-op)
  };

  // Aggregate result of migrateRoles(). Counts how many users were
  // converted from isAdmin=true to role=#admin and how many were already
  // in the new shape (no-op).
  public type MigrationSummary = {
    results : [RoleMigrationResult];
    convertedCount : Nat; // users whose role was actually set/changed
    unchangedCount : Nat; // users already matching the new model
  };

  // Result der einmaligen Joao-Marques-Hard-Promotion. Liefert den
  // Principal des beförderten Benutzers (sofern gefunden), ob die Rolle
  // tatsächlich geändert wurde (changed = false, wenn bereits
  // #plattform_admin), und ob der Whitelist-Eintrag hinzugefügt wurde
  // (whitelistAdded = false, wenn bereits eingetragen). Idempotent — ein
  // erneuter Aufruf ändert nichts und liefert changed=false,
  // whitelistAdded=false.
  public type PromotionResult = {
    principal : ?Principal; // None, wenn kein Benutzer mit der E-Mail gefunden
    email : Text; // die gesuchte E-Mail (joao.marques@iservices.ch)
    changed : Bool; // true, wenn role auf ?#plattform_admin gesetzt wurde
    whitelistAdded : Bool; // true, wenn zur superAdminWhitelist hinzugefügt
  };
};
