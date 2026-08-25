import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import KlientenTypes "../types/klienten";
import LeistungTypes "../types/leistungen";
import Types "../types/stopwatch-budget";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";

module {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  /// Nanoseconds per minute — used to convert elapsed nanoseconds to minutes.
  let NS_PER_MINUTE : Int = 60_000_000_000;

  /// Ceiling division of `a` by `b` for non-negative Ints (b > 0).
  /// Returns `ceil(a / b)`. Used to round partial minutes UP per the spec.
  func ceilDiv(a : Int, b : Int) : Nat {
    if (a <= 0) return 0;
    let q = a / b;
    let r = a % b;
    if (r == 0) Int.abs(q) else Int.abs(q) + 1;
  };

  // ─── Timer functions ────────────────────────────────────────────────────────

  /// Start (or replace) a running timer for a Leistung.
  ///
  /// Validates the caller owns the Leistung (same kanzlei + is the
  /// leistungserbringer), validates no timer is already running for this
  /// leistungId, records `startTime = Time.now()` and `baseDauer`, and
  /// returns the TimerState.
  public func startTimer(
    timers : Map.Map<Common.LeistungId, Types.TimerState>,
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    leistungId : Common.LeistungId,
    baseDauer : Nat,
  ) : Common.Result<Types.TimerState, Text> {
    // Look up the Leistung
    let leistung = switch (leistungen.get(leistungId)) {
      case (?l) l;
      case null return #err("Leistung nicht gefunden");
    };
    // Kanzlei isolation
    if (leistung.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    // Caller must own the Leistung (be its leistungserbringer)
    if (not Principal.equal(leistung.leistungserbringerId, user.id)) {
      return #err("Zugriff verweigert: nicht der Leistungserbringer");
    };
    // No timer already running for this leistungId
    switch (timers.get(leistungId)) {
      case (?_) return #err("Für diese Leistung läuft bereits eine Stoppuhr");
      case null {};
    };
    let timer : Types.TimerState = {
      leistungId;
      userId = user.id;
      startTime = Time.now();
      baseDauer;
    };
    timers.add(leistungId, timer);
    #ok(timer);
  };

  /// Stop a running timer for a Leistung and return the elapsed minutes.
  ///
  /// Elapsed minutes = `baseDauer + ceil((Time.now() - startTime) / 60_000_000_000)`.
  /// Validates the caller owns the timer, removes the timer, and returns the
  /// total minutes as Nat. Returns `#err` if no timer is running for the
  /// given `leistungId` or the caller does not own it.
  public func stopTimer(
    timers : Map.Map<Common.LeistungId, Types.TimerState>,
    user : KanzleiTypes.Leistungserbringer,
    leistungId : Common.LeistungId,
  ) : Common.Result<Nat, Text> {
    let timer = switch (timers.get(leistungId)) {
      case (?t) t;
      case null return #err("Keine laufende Stoppuhr für diese Leistung");
    };
    // Caller must own the timer
    if (not Principal.equal(timer.userId, user.id)) {
      return #err("Zugriff verweigert: nicht der Timer-Eigentümer");
    };
    let elapsedNs = Time.now() - timer.startTime;
    let elapsedMin = ceilDiv(elapsedNs, NS_PER_MINUTE);
    let totalMin = timer.baseDauer + elapsedMin;
    timers.remove(leistungId);
    #ok(totalMin);
  };

  /// Get the running timer for a single Leistung, if any.
  ///
  /// Enforces kanzlei isolation: returns `null` if the Leistung belongs to a
  /// different kanzlei than `user`, or if no timer is running, or if the
  /// running timer is owned by a different user.
  public func getTimer(
    timers : Map.Map<Common.LeistungId, Types.TimerState>,
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    user : KanzleiTypes.Leistungserbringer,
    leistungId : Common.LeistungId,
  ) : ?Types.TimerState {
    let leistung = switch (leistungen.get(leistungId)) {
      case (?l) l;
      case null return null;
    };
    if (leistung.kanzleiId != user.kanzleiId) return null;
    let timer = switch (timers.get(leistungId)) {
      case (?t) t;
      case null return null;
    };
    if (not Principal.equal(timer.userId, user.id)) return null;
    ?timer;
  };

  /// List all running timers for the current user.
  ///
  /// Returns every `TimerState` whose `userId` matches `user.id`, restricted
  /// to the user's kanzlei.
  public func listTimers(
    timers : Map.Map<Common.LeistungId, Types.TimerState>,
    user : KanzleiTypes.Leistungserbringer,
  ) : [Types.TimerState] {
    let results = timers.entries()
      |> _.filter(func((_, t) : (Common.LeistungId, Types.TimerState)) : Bool {
        Principal.equal(t.userId, user.id);
      })
      |> _.map(func((_, t) : (Common.LeistungId, Types.TimerState)) : Types.TimerState { t })
      |> _.toArray();
    results;
  };

  // ─── Budget functions ──────────────────────────────────────────────────────

  /// Compute the remaining budget for a single Mandat.
  ///
  /// Validates the caller owns the Mandat (same kanzlei), sums all
  /// `Leistung.honorar` and all `Auslage.betrag` for the given `mandatId`
  /// (kanzlei-isolated), reads `Mandat.budget`, and returns
  /// `restbudget = totalBudget - totalHonorar - totalAuslagen` (Int, may be
  /// negative if budget is exceeded).
  public func getBudgetSummary(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    mandatId : Common.MandatId,
  ) : Common.Result<Types.BudgetSummary, Text> {
    let mandat = switch (mandate.get(mandatId)) {
      case (?m) m;
      case null return #err("Mandat nicht gefunden");
    };
    if (mandat.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    let totalHonorar = leistungen.entries()
      |> _.filter(func((_, l) : (Common.LeistungId, LeistungTypes.Leistung)) : Bool {
        l.mandatId == mandatId and l.kanzleiId == user.kanzleiId;
      })
      |> _.map(func((_, l) : (Common.LeistungId, LeistungTypes.Leistung)) : Nat { l.honorar })
      |> _.foldLeft(0, func(acc : Nat, h : Nat) : Nat { acc + h });
    let totalAuslagen = auslagen.entries()
      |> _.filter(func((_, a) : (Common.AuslageId, LeistungTypes.Auslage)) : Bool {
        a.mandatId == mandatId and a.kanzleiId == user.kanzleiId;
      })
      |> _.map(func((_, a) : (Common.AuslageId, LeistungTypes.Auslage)) : Nat { a.betrag })
      |> _.foldLeft(0, func(acc : Nat, b : Nat) : Nat { acc + b });
    let totalBudget = mandat.budget;
    let restbudget = Int.fromNat(totalBudget) - Int.fromNat(totalHonorar) - Int.fromNat(totalAuslagen);
    #ok({
      mandatId;
      totalBudget;
      totalHonorar;
      totalAuslagen;
      restbudget;
    });
  };

  /// Get remaining budgets for all Mandate of the current user in one call.
  ///
  /// Iterates every Mandat in the user's kanzlei and returns one
  /// `BudgetSummary` per Mandat.
  public func getBudgetSummaries(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
  ) : [Types.BudgetSummary] {
    mandate.entries()
      |> _.filter(func((_, m) : (Common.MandatId, KlientenTypes.Mandat)) : Bool {
        m.kanzleiId == user.kanzleiId;
      })
      |> _.map(func((mid, m) : (Common.MandatId, KlientenTypes.Mandat)) : Types.BudgetSummary {
        let totalHonorar = leistungen.entries()
          |> _.filter(func((_, l) : (Common.LeistungId, LeistungTypes.Leistung)) : Bool {
            l.mandatId == mid and l.kanzleiId == user.kanzleiId;
          })
          |> _.map(func((_, l) : (Common.LeistungId, LeistungTypes.Leistung)) : Nat { l.honorar })
          |> _.foldLeft(0, func(acc : Nat, h : Nat) : Nat { acc + h });
        let totalAuslagen = auslagen.entries()
          |> _.filter(func((_, a) : (Common.AuslageId, LeistungTypes.Auslage)) : Bool {
            a.mandatId == mid and a.kanzleiId == user.kanzleiId;
          })
          |> _.map(func((_, a) : (Common.AuslageId, LeistungTypes.Auslage)) : Nat { a.betrag })
          |> _.foldLeft(0, func(acc : Nat, b : Nat) : Nat { acc + b });
        let totalBudget = m.budget;
        let restbudget = Int.fromNat(totalBudget) - Int.fromNat(totalHonorar) - Int.fromNat(totalAuslagen);
        {
          mandatId = mid;
          totalBudget;
          totalHonorar;
          totalAuslagen;
          restbudget;
        };
      })
      |> _.toArray();
  };
};
