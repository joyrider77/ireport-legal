import KanzleiTypes "../types/kanzlei";
import PermissionsTypes "../types/permissions";

module {
  // ─── rolePermissions ───────────────────────────────────────────────────────
  //
  // Liefert die Menge der erlaubten Ressourcen (PermissionSet) für eine
  // gegebene Rolle. Die Zuordnung folgt der Anforderung:
  //
  //   #plattform_admin: alle Kanzleien, Plattform-Admin-Seite,
  //     alle-Kanzleien-Übersicht, CSV/PDF-Export aller Kanzleien,
  //     Super-Admin-Whitelist-Verwaltung, Rollen-Migration, sowie alle
  //     Ressourcen eines Kanzlei-Admins (Benutzerverwaltung eigene Kanzlei,
  //     Rechnungsvorlagen, Datenschutz-Dashboard, Aktive-Benutzer-Ansicht
  //     eigene Kanzlei, Rollenänderungen innerhalb Kanzlei ausser
  //     Plattform-Admin, Klienten, Leistungen, Rechnungen, Auswertungen,
  //     eigene Benutzerdaten).
  //
  //   #admin: Benutzerverwaltung eigene Kanzlei, Rechnungsvorlagen,
  //     Datenschutz-Dashboard, Aktive-Benutzer-Ansicht eigene Kanzlei,
  //     Rollenänderungen innerhalb Kanzlei (ausser Plattform-Admin),
  //     Klienten, Leistungen, Rechnungen, Auswertungen, eigene Benutzerdaten.
  //
  //   #anwalt: Klienten, Leistungen, Rechnungen, Auswertungen eigene
  //     Kanzlei; eigene Benutzerdaten einsehbar; keine Benutzerverwaltung.
  //
  //   #mitarbeiter: Klienten, Leistungen, Rechnungen eigene Kanzlei; keine
  //     Admin-/Datenschutz-Seiten.
  //
  //   #mandant: nur für Mandanten freigegebene Ansichten; keine
  //     Kanzlei-internen Verwaltungsseiten.
  public func rolePermissions(
    role : KanzleiTypes.Role,
  ) : PermissionsTypes.PermissionSet {
    switch (role) {
      case (#plattform_admin) {
        // Plattform-Admin: alle Ressourcen (Plattform-Admin-spezifische +
        // alle Admin-Ressourcen + anwalt/mitarbeiter/mandant Ressourcen).
        [
          #plattform_admin_page,
          #all_kanzleien_overview,
          #export_all_kanzleien,
          #super_admin_whitelist_management,
          #role_migration,
          #user_management_own_kanzlei,
          #rechnungsvorlagen,
          #datenschutz_dashboard,
          #active_users_own_kanzlei,
          #role_changes_own_kanzlei,
          #klienten,
          #leistungen,
          #rechnungen,
          #auswertungen,
          #own_user_data,
          #mandant_views,
        ];
      };
      case (#admin) {
        [
          #user_management_own_kanzlei,
          #rechnungsvorlagen,
          #datenschutz_dashboard,
          #active_users_own_kanzlei,
          #role_changes_own_kanzlei,
          #klienten,
          #leistungen,
          #rechnungen,
          #auswertungen,
          #own_user_data,
        ];
      };
      case (#anwalt) {
        [
          #klienten,
          #leistungen,
          #rechnungen,
          #auswertungen,
          #own_user_data,
        ];
      };
      case (#mitarbeiter) {
        [
          #klienten,
          #leistungen,
          #rechnungen,
          #own_user_data,
        ];
      };
      case (#mandant) {
        [
          #mandant_views,
          #own_user_data,
        ];
      };
    };
  };

  // ─── canAccess ──────────────────────────────────────────────────────────────
  //
  // Prüft, ob eine Rolle auf eine Ressource zugreifen darf. Verwendet
  // rolePermissions(role) und prüft, ob die Ressource in der Menge enthalten
  // ist. Wird von den Mixins für die rollenbasierte Durchsetzung verwendet
  // (zusätzlich zur kanzlei-scoped Prüfung).
  public func canAccess(
    role : KanzleiTypes.Role,
    resource : PermissionsTypes.Resource,
  ) : Bool {
    let perms = rolePermissions(role);
    var i : Nat = 0;
    while (i < perms.size()) {
      if (perms[i] == resource) { return true };
      i += 1;
    };
    false;
  };
};
