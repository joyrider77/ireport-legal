import Common "common";

module {
  /// Persisted running stopwatch state for a single Leistung.
  ///
  /// Swiss conventions: `baseDauer` is in minutes (Nat), `startTime` is the
  /// nanosecond timestamp from `Time.now()` (Int). The timer is keyed by
  /// `leistungId` in a transient HashMap — it is recoverable from `startTime`
  /// and `baseDauer` after an upgrade, so it does not need stable storage.
  public type TimerState = {
    leistungId : Common.LeistungId;
    userId : Principal;
    startTime : Int;
    baseDauer : Nat;
  };

  /// Aggregated remaining-budget summary for a single Mandat.
  ///
  /// All amounts are in Rappen/cents (Nat) and durations in minutes (Nat),
  /// per Swiss conventions. `restbudget = totalBudget - totalHonorar - totalAuslagen`.
  public type BudgetSummary = {
    mandatId : Common.MandatId;
    totalBudget : Nat;
    totalHonorar : Nat;
    totalAuslagen : Nat;
    restbudget : Int;
  };
};
