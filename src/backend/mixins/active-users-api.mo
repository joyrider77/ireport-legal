import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import ActiveUsersTypes "../types/active-users";
import ActiveUsersLib "../lib/active-users";
import SuperAdminLib "../lib/super-admin";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";

mixin (
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
) {
  // Admin-gated: nur Admins der Kanzlei (oder Super-Admin) können abfragen.
  // Strikte Daten-Trennung: nur Benutzer der angegebenen kanzleiId werden
  // zurückgegeben. Die Autorisierung wird über ActiveUsersLib.isAdminOfKanzlei
  // geprüft (Admin der Kanzlei ODER Super-Admin).
  //
  // Rollendes 12-Monate-Fenster: das Fenster endet mit dem aktuellen
  // Kalendermonat des gewählten Jahres (12 Monate rückwärts). Jeder
  // Monats-Eintrag im Bericht trägt sein absolutes (year, month), damit
  // das Frontend dynamische Monatsnamen aus dem gewählten Fenster rendern
  // kann (nicht fix Jan..Dez).
  //
  // Verwendet die historisierte isUserActiveInMonth-Logik: ein Benutzer gilt
  // in einem Monat nur als aktiv, wenn sein status in DIESEM konkreten Monat
  // 'aktiv' war (statusHistory). ActiveUserMonth.total = Summe der in diesem
  // Monat aktiven Benutzer. yearTotal = DISTINCT aktiver Benutzer über die
  // 12 angezeigten Monate.
  public query ({ caller }) func getActiveUsersPerMonth(
    kanzleiId : Common.KanzleiId,
    year : Nat,
  ) : async ActiveUsersTypes.ActiveUsersYearReport {
    // Autorisierung: Admin der Kanzlei ODER Super-Admin.
    if (not ActiveUsersLib.isAdminOfKanzlei(users, superAdminWhitelist, caller, kanzleiId)) {
      Runtime.trap("Keine Berechtigung: nur Admins der Kanzlei oder Super-Admins dürfen die aktiven Benutzer abfragen");
    };
    ActiveUsersLib.getActiveUsersPerMonth(users, kanzleiId, year, Time.now());
  };

  // Super-Admin-gated: nur Super-Admins dürfen den Gesamtbericht über alle
  // Kanzleien abrufen. Liefert für jede Kanzlei einen rollenden 12-Monate-
  // Bericht der aktiven Benutzer inkl. Kanzlei-Name
  // (AllKanzleienActiveUsersReport). Verwendet die historisierte
  // isUserActiveInMonth-Logik (über getActiveUsersPerMonth). Die korrigierte
  // Logik gilt sowohl für die Plattform-Admin-Ansicht (alle Kanzleien) als
  // auch für die Kanzlei-Admin-Ansicht (nur eigene Kanzlei).
  //
  // Rollendes 12-Monate-Fenster: das Fenster endet mit dem aktuellen
  // Kalendermonat des gewählten Jahres. yearTotal pro Kanzlei = DISTINCT
  // aktiver Benutzer über die 12 angezeigten Monate.
  public query ({ caller }) func getAllActiveUsersPerMonth(
    year : Nat,
  ) : async [ActiveUsersTypes.AllKanzleienActiveUsersReport] {
    // Super-Admin-Gating.
    if (not SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      Runtime.trap("Keine Berechtigung: nur Super-Admins dürfen den Gesamtbericht über alle Kanzleien abfragen");
    };
    ActiveUsersLib.getAllActiveUsersPerMonth(kanzleien, users, year, Time.now());
  };
};
