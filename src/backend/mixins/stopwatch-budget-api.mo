import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import KlientenTypes "../types/klienten";
import LeistungTypes "../types/leistungen";
import SuperAdminTypes "../types/super-admin";
import StopwatchBudgetLib "../lib/stopwatch-budget";
import SecurityFixesLib "../lib/security-fixes";
import Types "../types/stopwatch-budget";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";

mixin (
  timers : Map.Map<Common.LeistungId, Types.TimerState>,
  leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
  auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
  mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
) {
  /// Zentraler Guard: prüft serverseitig den Benutzerstatus (status == "aktiv")
  /// UND den Kanzleistatus (kanzlei.status == "aktiv"). Plattform-Admins
  /// (superAdminWhitelist) umgehen beide Prüfungen. Trap bei deaktiviertem
  /// Benutzer oder deaktivierter Kanzlei.
  func requireUserStopwatch(caller : Principal) : KanzleiTypes.Leistungserbringer {
    SecurityFixesLib.requireActiveUserAndKanzlei(users, kanzleien, superAdminWhitelist, caller);
  };

  /// Start a timer for a Leistung.
  ///
  /// Records `startTime` + `baseDauer` for the given `leistungId`. The caller
  /// must be a registered user and the leistungserbringer of the Leistung
  /// (same kanzlei). Returns `#err` if a timer is already running for this
  /// `leistungId`.
  public shared ({ caller }) func startTimer(
    leistungId : Common.LeistungId,
    baseDauer : Nat,
  ) : async Common.Result<Types.TimerState, Text> {
    let user = requireUserStopwatch(caller);
    StopwatchBudgetLib.startTimer(timers, leistungen, mandate, user, leistungId, baseDauer);
  };

  /// Stop a timer for a Leistung.
  ///
  /// Returns elapsed minutes = `baseDauer + ceil((Time.now() - startTime) / 60_000_000_000)`
  /// and clears the timer. Returns `#err` if no timer is running or the
  /// caller does not own it.
  public shared ({ caller }) func stopTimer(
    leistungId : Common.LeistungId,
  ) : async Common.Result<Nat, Text> {
    let user = requireUserStopwatch(caller);
    StopwatchBudgetLib.stopTimer(timers, user, leistungId);
  };

  /// Get the running timer for a single Leistung, if any.
  ///
  /// Returns `null` if no timer is running, the Leistung belongs to a
  /// different kanzlei, or the running timer is owned by another user.
  public query ({ caller }) func getTimer(
    leistungId : Common.LeistungId,
  ) : async ?Types.TimerState {
    let user = requireUserStopwatch(caller);
    StopwatchBudgetLib.getTimer(timers, leistungen, user, leistungId);
  };

  /// List all running timers for the current user.
  public query ({ caller }) func listTimers() : async [Types.TimerState] {
    let user = requireUserStopwatch(caller);
    StopwatchBudgetLib.listTimers(timers, user);
  };

  /// Compute the remaining budget for a single Mandat.
  ///
  /// Returns `mandatId`, `totalBudget`, `totalHonorar`, `totalAuslagen`, and
  /// `restbudget = totalBudget - totalHonorar - totalAuslagen` (Int, may be
  /// negative). The caller must belong to the same kanzlei as the Mandat.
  public query ({ caller }) func getBudgetSummary(
    mandatId : Common.MandatId,
  ) : async Common.Result<Types.BudgetSummary, Text> {
    let user = requireUserStopwatch(caller);
    StopwatchBudgetLib.getBudgetSummary(leistungen, auslagen, mandate, user, mandatId);
  };

  /// Get remaining budgets for all Mandate of the current user in one call.
  ///
  /// Returns one `BudgetSummary` per Mandat in the caller's kanzlei.
  public query ({ caller }) func getBudgetSummaries() : async [Types.BudgetSummary] {
    let user = requireUserStopwatch(caller);
    StopwatchBudgetLib.getBudgetSummaries(leistungen, auslagen, mandate, user);
  };
};
