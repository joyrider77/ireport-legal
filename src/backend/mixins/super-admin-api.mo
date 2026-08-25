import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import KlientenTypes "../types/klienten";
import LeistungTypes "../types/leistungen";
import RechnungTypes "../types/rechnungen";
import RechnungsvorlagenTypes "../types/rechnungsvorlagen";
import SuperAdminLib "../lib/super-admin";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";

mixin (
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  inviteTokens : Map.Map<Text, KanzleiTypes.InviteToken>,
  klienten : Map.Map<Common.KlientId, KlientenTypes.Klient>,
  mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
  leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
  auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
  rechnungen : Map.Map<Common.RechnungId, RechnungTypes.Rechnung>,
  zahlungen : Map.Map<Common.ZahlungId, RechnungTypes.Zahlung>,
  rechnungsvorlagen : Map.Map<Common.KanzleiId, RechnungsvorlagenTypes.Rechnungsvorlage>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
) {
  // Prüft, ob der caller Super-Admin ist (Whitelist-Mitglied).
  // Öffentlich abfragbar — gibt nur true/false zurück, keine sensiblen Daten.
  public query ({ caller }) func isSuperAdmin() : async Bool {
    SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller);
  };

  // Liefert alle eingetragenen Super-Admins. Nur für Super-Admins.
  public query ({ caller }) func getSuperAdmins() : async [SuperAdminTypes.SuperAdminWhitelistEntry] {
    SuperAdminLib.getSuperAdmins(superAdminWhitelist, caller);
  };

  // Fügt einen Principal zur Super-Admin-Whitelist hinzu. Nur Super-Admins.
  public shared ({ caller }) func addSuperAdmin(newAdmin : Principal) : async Common.Result<(), Text> {
    SuperAdminLib.addSuperAdmin(superAdminWhitelist, caller, newAdmin, Time.now());
  };

  // Entfernt einen Principal aus der Super-Admin-Whitelist. Nur Super-Admins.
  public shared ({ caller }) func removeSuperAdmin(adminToRemove : Principal) : async Common.Result<(), Text> {
    SuperAdminLib.removeSuperAdmin(superAdminWhitelist, caller, adminToRemove);
  };

  // Übersicht aller Kanzleien (Mandanten) mit Benutzeranzahl, Abo-Modell und
  // Billing-Status. Nur für Super-Admins — strikte Daten-Trennung: Super-Admin
  // sieht ALLE Kanzleien; alle anderen Benutzer sehen diesen Bereich nicht.
  public query ({ caller }) func getAllKanzleienOverview() : async [SuperAdminTypes.KanzleiOverview] {
    SuperAdminLib.getAllKanzleienOverview(kanzleien, users, caller, superAdminWhitelist);
  };

  // Liefert alle Leistungserbringer (Benutzer) EINER bestimmten Kanzlei —
  // mit Name, E-Mail, Rolle, Status. Super-Admin-only: nur ein Super-Admin
  // darf beliebige Kanzleien abfragen. Die Rückgabe-Struktur ist identisch
  // zu getLeistungserbringer (lib/kanzlei.mo), gefiltert nach kanzleiId.
  public query ({ caller }) func getLeistungserbringerByKanzlei(kanzleiId : Common.KanzleiId) : async [KanzleiTypes.Leistungserbringer] {
    SuperAdminLib.getLeistungserbringerByKanzlei(users, superAdminWhitelist, caller, kanzleiId);
  };

  // CSV-Export der Kanzlei-Übersicht für den Download. Nur für Super-Admins.
  public query ({ caller }) func exportKanzleienCsv() : async Text {
    SuperAdminLib.exportKanzleienCsv(kanzleien, users, caller, superAdminWhitelist);
  };

  // PDF-Export der Kanzlei-Übersicht für den Download. Nur für Super-Admins.
  public query ({ caller }) func exportKanzleienPdf() : async Blob {
    SuperAdminLib.exportKanzleienPdf(kanzleien, users, caller, superAdminWhitelist);
  };

  // Deaktiviert eine Kanzlei (setzt den Kanzlei-Status auf "inaktiv" — Daten
  // bleiben erhalten). Nur Super-Admins. Physisches Löschen erfolgt über
  // deleteKanzlei.
  public shared ({ caller }) func deactivateKanzlei(kanzleiId : Text) : async Common.Result<(), Text> {
    SuperAdminLib.deactivateKanzlei(kanzleien, superAdminWhitelist, caller, kanzleiId);
  };

  // Löscht eine Kanzlei PHYSISCH und unwiderruflich — atomar/konsistent
  // kaskadierend über ALLE tenantgebundenen Datensätze der gelöschten
  // kanzleiId (Benutzer, Klienten, Mandate, Leistungen, Auslagen,
  // Rechnungen, Zahlungen, Rechnungsvorlagen inkl. Logos, Einladungen).
  // Audit-/Compliance-Daten bleiben revisionssicher als historisch erhalten.
  // Nur Super-Admins.
  public shared ({ caller }) func deleteKanzlei(kanzleiId : Text) : async Common.Result<(), Text> {
    SuperAdminLib.deleteKanzlei(
      kanzleien,
      users,
      inviteTokens,
      klienten,
      mandate,
      leistungen,
      auslagen,
      rechnungen,
      zahlungen,
      rechnungsvorlagen,
      superAdminWhitelist,
      caller,
      kanzleiId,
    );
  };
};
