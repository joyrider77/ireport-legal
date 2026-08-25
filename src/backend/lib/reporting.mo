import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import LeistungTypes "../types/leistungen";
import KlientenTypes "../types/klienten";
import RechnungTypes "../types/rechnungen";
import Types "../types/reporting";
import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Principal "mo:core/Principal";

module {

  // ---------------------------------------------------------------------------
  // Date helpers — parse "dd.mm.yyyy" inline
  // ---------------------------------------------------------------------------

  func parseDate(dateStr : Text) : (Nat, Nat, Nat) {
    let parts = dateStr.split(#char '.');
    let arr = parts.toArray();
    if (arr.size() < 3) { return (0, 0, 0) };
    let day = switch (Nat.fromText(arr[0])) { case (?n) n; case null 0 };
    let month = switch (Nat.fromText(arr[1])) { case (?n) n; case null 0 };
    let year = switch (Nat.fromText(arr[2])) { case (?n) n; case null 0 };
    (day, month, year)
  };

  func getYear(dateStr : Text) : Nat {
    let (_, _, y) = parseDate(dateStr);
    y
  };

  func getMonth(dateStr : Text) : Nat {
    let (_, m, _) = parseDate(dateStr);
    m
  };

  func isInYear(dateStr : Text, year : Nat) : Bool {
    getYear(dateStr) == year
  };

  func isInMonth(dateStr : Text, year : Nat, month : Nat) : Bool {
    let (_, m, y) = parseDate(dateStr);
    y == year and m == month
  };

  // ---------------------------------------------------------------------------
  // Monthly aggregation helpers
  // ---------------------------------------------------------------------------

  /// Build a MonthlyTotal for a given month by summing leistungen + auslagen
  /// that belong to the kanzlei (and optionally a specific provider).
  func buildMonthlyTotal(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    callerKanzleiId : Common.KanzleiId,
    year : Nat,
    month : Nat,
    providerIdFilter : ?Principal,
  ) : Types.MonthlyTotal {
    var honorar : Nat = 0;
    var auslagenSum : Nat = 0;
    var verrechnete : Nat = 0;

    for ((_, l) in leistungen.entries()) {
      if (
        l.kanzleiId == callerKanzleiId
        and isInMonth(l.datum, year, month)
        and (switch (providerIdFilter) {
          case null true;
          case (?pid) Principal.equal(l.leistungserbringerId, pid);
        })
      ) {
        honorar += l.honorar;
        switch (l.status) {
          case (#verrechnet) { verrechnete += l.honorar };
          case (#offen) {};
        };
      };
    };

    for ((_, a) in auslagen.entries()) {
      if (
        a.kanzleiId == callerKanzleiId
        and isInMonth(a.datum, year, month)
        and (switch (providerIdFilter) {
          case null true;
          case (?pid) Principal.equal(a.leistungserbringerId, pid);
        })
      ) {
        auslagenSum += a.betrag;
        switch (a.status) {
          case (#verrechnet) { verrechnete += a.betrag };
          case (#offen) {};
        };
      };
    };

    {
      month;
      year;
      honorar;
      auslagen = auslagenSum;
      total = honorar + auslagenSum;
      verrechnete;
    }
  };

  /// Aggregate a list of MonthlyTotal into a single combined total (month = 0).
  func aggregateTotals(breakdown : [Types.MonthlyTotal], year : Nat) : Types.MonthlyTotal {
    var honorar : Nat = 0;
    var auslagen : Nat = 0;
    var verrechnete : Nat = 0;
    for (mt in breakdown.values()) {
      honorar += mt.honorar;
      auslagen += mt.auslagen;
      verrechnete += mt.verrechnete;
    };
    {
      month = 0;
      year;
      honorar;
      auslagen;
      total = honorar + auslagen;
      verrechnete;
    }
  };

  // ---------------------------------------------------------------------------
  // Public functions
  // ---------------------------------------------------------------------------

  public func getLeistungserbringerReport(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    _mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    caller : Principal,
    callerKanzleiId : Common.KanzleiId,
    providerId : ?Principal,
    year : Nat,
    _period : Types.ReportPeriod,
  ) : Types.ProviderReport {
    // Determine which provider to report on
    let targetId : Principal = switch (providerId) {
      case (?pid) pid;
      case null caller;
    };

    // Build monthly breakdown for target provider
    let breakdown = Array.tabulate(
      12,
      func(i) { buildMonthlyTotal(leistungen, auslagen, callerKanzleiId, year, i + 1, ?targetId) },
    );

    let totals = aggregateTotals(breakdown, year);

    // Build comparison data: all providers in the same kanzlei
    let comparisons = List.empty<Types.ProviderComparison>();
    for ((_, provider) in users.entries()) {
      if (provider.kanzleiId == callerKanzleiId) {
        var provTotal : Nat = 0;
        for ((_, l) in leistungen.entries()) {
          if (l.kanzleiId == callerKanzleiId and isInYear(l.datum, year) and Principal.equal(l.leistungserbringerId, provider.id)) {
            provTotal += l.honorar;
          };
        };
        for ((_, a) in auslagen.entries()) {
          if (a.kanzleiId == callerKanzleiId and isInYear(a.datum, year) and Principal.equal(a.leistungserbringerId, provider.id)) {
            provTotal += a.betrag;
          };
        };
        comparisons.add({ provider; total = provTotal });
      };
    };

    // Sort comparison data descending by total
    let sortedComparisons = comparisons.sort(func(a, b) {
      if (a.total > b.total) #less
      else if (a.total < b.total) #greater
      else #equal
    });

    {
      totals;
      monthlyBreakdown = breakdown;
      comparisonData = sortedComparisons.toArray();
    }
  };

  public func getKanzleiReport(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    callerKanzleiId : Common.KanzleiId,
    year : Nat,
    _period : Types.ReportPeriod,
  ) : Types.FirmReport {
    let breakdown = Array.tabulate(
      12,
      func(i) { buildMonthlyTotal(leistungen, auslagen, callerKanzleiId, year, i + 1, null) },
    );

    let totals = aggregateTotals(breakdown, year);

    { totals; monthlyBreakdown = breakdown }
  };

  public func getGehaltReport(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    _auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    rechnungen : Map.Map<Common.RechnungId, RechnungTypes.Rechnung>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    callerKanzleiId : Common.KanzleiId,
    year : Nat,
    month : ?Nat,
  ) : [Types.GehaltInfo] {
    let results = List.empty<Types.GehaltInfo>();

    for ((_, provider) in users.entries()) {
      if (provider.kanzleiId == callerKanzleiId) {
        // Leistungsbasiert: sum honorar for period
        var leistungsbasiert : Nat = 0;
        for ((_, l) in leistungen.entries()) {
          if (Principal.equal(l.leistungserbringerId, provider.id) and l.kanzleiId == callerKanzleiId) {
            let inPeriod = switch (month) {
              case null isInYear(l.datum, year);
              case (?m) isInMonth(l.datum, year, m);
            };
            if (inPeriod) { leistungsbasiert += l.honorar };
          };
        };

        // Akquisitionsboni: sum Rechnung.total * Mandat.akquisitionsbonus / 10000
        // for rechnungen where Mandat.akquisiteurId = this provider
        var akquisitionsboni : Nat = 0;
        for ((_, rechnung) in rechnungen.entries()) {
          if (rechnung.kanzleiId == callerKanzleiId) {
            let inPeriod = switch (month) {
              case null isInYear(rechnung.rechnungsdatum, year);
              case (?m) isInMonth(rechnung.rechnungsdatum, year, m);
            };
            if (inPeriod) {
              switch (mandate.get(rechnung.mandatId)) {
                case (?mandat) {
                  if (Principal.equal(mandat.akquisiteurId, provider.id)) {
                    akquisitionsboni += rechnung.total * mandat.akquisitionsbonus / 10000;
                  };
                };
                case null {};
              };
            };
          };
        };

        let gesamtgehalt = leistungsbasiert + akquisitionsboni;

        results.add({
          provider;
          leistungsbasiert;
          akquisitionsboni;
          gesamtgehalt;
          kanzleianteil = 0;
        });
      };
    };

    // Sort by nachname ascending
    let sorted = results.sort(func(a, b) { Text.compare(a.provider.nachname, b.provider.nachname) });
    sorted.toArray()
  };
};
