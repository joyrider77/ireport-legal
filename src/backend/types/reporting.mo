import KanzleiTypes "kanzlei";

module {
  public type ReportPeriod = { #monatlich : Nat; #jaehrlich };

  public type MonthlyTotal = {
    month : Nat;
    year : Nat;
    honorar : Nat;
    auslagen : Nat;
    total : Nat;
    verrechnete : Nat;
  };

  public type ProviderComparison = {
    provider : KanzleiTypes.Leistungserbringer;
    total : Nat;
  };

  public type ProviderReport = {
    totals : MonthlyTotal;
    monthlyBreakdown : [MonthlyTotal];
    comparisonData : [ProviderComparison];
  };

  public type FirmReport = {
    totals : MonthlyTotal;
    monthlyBreakdown : [MonthlyTotal];
  };

  public type GehaltInfo = {
    provider : KanzleiTypes.Leistungserbringer;
    leistungsbasiert : Nat;
    akquisitionsboni : Nat;
    gesamtgehalt : Nat;
    kanzleianteil : Nat;
  };
};
