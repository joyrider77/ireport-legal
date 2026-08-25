import KanzleiTypes "kanzlei";

module {
  // Ressourcen/Seiten, die durch die rollenbasierte Zugriffskontrolle
  // geschützt sind. Jede Ressource entspricht einer Seite oder einer
  // Aktion im Frontend. Die Permissions-Logik (lib/permissions.mo) liefert
  // pro Rolle die Menge der erlaubten Ressourcen.
  //
  // Die Ressourcen-Enumeration deckt die in der Anforderung genannten
  // Seiten/Aktionen ab:
  //   - Plattform-Admin-Seite, alle-Kanzleien-Übersicht, CSV/PDF-Export
  //     aller Kanzleien, Super-Admin-Whitelist-Verwaltung, Rollen-Migration
  //   - Benutzerverwaltung eigene Kanzlei, Rechnungsvorlagen,
  //     Datenschutz-Dashboard, Aktive-Benutzer-Ansicht eigene Kanzlei,
  //     Rollenänderungen innerhalb Kanzlei (ausser Plattform-Admin)
  //   - Klienten, Leistungen, Rechnungen, Auswertungen eigene Kanzlei
  //   - Eigene Benutzerdaten einsehbar
  //   - Für Mandanten freigegebene Ansichten
  public type Resource = {
    #plattform_admin_page; // Plattform-Admin-Seite (Super-Admin only)
    #all_kanzleien_overview; // alle-Kanzleien-Übersicht
    #export_all_kanzleien; // CSV/PDF-Export aller Kanzleien
    #super_admin_whitelist_management; // Super-Admin-Whitelist-Verwaltung
    #role_migration; // Rollen-Migration (migrateRoles)
    #user_management_own_kanzlei; // Benutzerverwaltung eigene Kanzlei
    #rechnungsvorlagen; // Rechnungsvorlagen
    #datenschutz_dashboard; // Datenschutz-Dashboard
    #active_users_own_kanzlei; // Aktive-Benutzer-Ansicht eigene Kanzlei
    #role_changes_own_kanzlei; // Rollenänderungen innerhalb Kanzlei (ausser Plattform-Admin)
    #klienten; // Klienten eigene Kanzlei
    #leistungen; // Leistungen eigene Kanzlei
    #rechnungen; // Rechnungen eigene Kanzlei
    #auswertungen; // Auswertungen eigene Kanzlei
    #own_user_data; // eigene Benutzerdaten einsehbar
    #mandant_views; // für Mandanten freigegebene Ansichten
  };

  // Menge der erlaubten Ressourcen pro Rolle. Wird von
  // lib/permissions.rolePermissions(role) zurückgegeben und von den Mixins
  // für die Durchsetzung verwendet (lib/permissions.canAccess(role, resource)).
  public type PermissionSet = [Resource];
};
