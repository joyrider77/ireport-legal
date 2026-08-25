import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import KlientenTypes "../types/klienten";
import LeistungTypes "../types/leistungen";
import RechnungTypes "../types/rechnungen";
import SuperAdminTypes "../types/super-admin";
import Types "../types/reporting";
import ReportingLib "../lib/reporting";
import SecurityFixesLib "../lib/security-fixes";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";

mixin (
  leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
  auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
  mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  rechnungen : Map.Map<Common.RechnungId, RechnungTypes.Rechnung>,
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
) {
  // Zentraler Guard: prüft serverseitig den Benutzerstatus (status == "aktiv")
  // UND den Kanzleistatus (kanzlei.status == "aktiv"). Plattform-Admins
  // (superAdminWhitelist) umgehen beide Prüfungen. Trap bei deaktiviertem
  // Benutzer oder deaktivierter Kanzlei.
  func requireUserReporting(caller : Principal) : KanzleiTypes.Leistungserbringer {
    SecurityFixesLib.requireActiveUserAndKanzlei(users, kanzleien, superAdminWhitelist, caller);
  };

  public query ({ caller }) func getLeistungserbringerReport(
    providerId : ?Principal,
    year : Nat,
    period : Types.ReportPeriod,
  ) : async Types.ProviderReport {
    let user = requireUserReporting(caller);
    ReportingLib.getLeistungserbringerReport(
      leistungen,
      auslagen,
      users,
      mandate,
      caller,
      user.kanzleiId,
      providerId,
      year,
      period,
    )
  };

  public query ({ caller }) func getKanzleiReport(
    year : Nat,
    period : Types.ReportPeriod,
  ) : async Types.FirmReport {
    let user = requireUserReporting(caller);
    ReportingLib.getKanzleiReport(leistungen, auslagen, user.kanzleiId, year, period)
  };

  public query ({ caller }) func getGehaltReport(
    year : Nat,
    month : ?Nat,
  ) : async [Types.GehaltInfo] {
    let user = requireUserReporting(caller);
    if (not user.isAdmin) Runtime.trap("Nur Admins können Gehaltsberichte abrufen");
    ReportingLib.getGehaltReport(
      leistungen,
      auslagen,
      rechnungen,
      users,
      mandate,
      user.kanzleiId,
      year,
      month,
    )
  };
};
