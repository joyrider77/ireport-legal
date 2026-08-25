import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import ActiveUsersTypes "../types/active-users";
import Map "mo:core/Map";
import Set "mo:core/Set";
import Array "mo:core/Array";
import Int "mo:core/Int";
import Principal "mo:core/Principal";

module {
  // ─── Monats-Helper ──────────────────────────────────────────────────────────
  //
  // registeredAt ist ein nanosekunden-Timestamp (Time.now(), Nanosekunden seit
  // der Unix-Epoch 1970-01-01 UTC). Wir leiten daraus das korrekte Kalender-
  // jahr und den Kalendermonat (1..12) ab, um zu entscheiden, ab welchem Monat
  // der Benutzer "existiert", und für die statusHistory-Einträge.
  //
  // Korrekte Gregorianische Kalenderkonvertierung (Howard Hinnant
  // civil-from-days) — KEINE 30-Tage-Monat-Näherung.

  // Reines Jahr-Monat-Paar aus einem nanosekunden-Timestamp.
  // Jahr 0 = 1970 (Unix-Epoch). Monat 1 = Januar.
  // Korrekte Gregorianische Kalenderkonvertierung — KEINE 30-Tage-Näherung.
  public func yearMonthFromTimestamp(ts : Common.Timestamp) : (Nat, Nat) {
    // ts ist in Nanosekunden seit 1970-01-01 UTC. In Tage umrechnen.
    // 1 Tag = 86_400_000_000_000 ns.
    let daysSinceEpoch : Int = ts / 86_400_000_000_000;
    // Howard Hinnant civil-from-days: days since 1970-01-01 → (year, month, day).
    // z = days + 719468
    let z : Int = daysSinceEpoch + 719468;
    let era : Int = if (z >= 0) { z / 146_097 } else { (z - 146_096) / 146_097 };
    let doe : Int = z - era * 146_097; // [0, 146096]
    let yoe : Int = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365; // [0, 399]
    let y : Int = yoe + era * 400;
    let doy : Int = doe - (365 * yoe + yoe / 4 - yoe / 100); // [0, 365]
    let mp : Int = (5 * doy + 2) / 153; // [0, 11]
    let d : Int = doy - (153 * mp + 2) / 5 + 1; // [1, 31]
    let m : Int = if (mp < 10) { mp + 3 } else { mp - 9 }; // [1, 12]
    let year : Int = if (m <= 2) { y + 1 } else { y };
    (Int.abs(year), Int.abs(m));
  };

  // ─── recordStatusChange ─────────────────────────────────────────────────────
  //
  // Hängt einen StatusHistoryEntry { year; month; status = newStatus } an die
  // statusHistory des Benutzers an. year/month werden aus `now` abgeleitet.
  // MUSS bei jeder Status-Änderung (Aktivierung/Deaktivierung) aufgerufen werden.
  //
  // Liefert die aktualisierte statusHistory (neue Liste mit angehängtem
  // Eintrag), damit der Aufrufer sie via { user with statusHistory = ... }
  // persistieren kann.

  public func recordStatusChange(
    user : KanzleiTypes.Leistungserbringer,
    newStatus : Text,
    now : Common.Timestamp,
  ) : [KanzleiTypes.StatusHistoryEntry] {
    let (year, month) = yearMonthFromTimestamp(now);
    let entry : KanzleiTypes.StatusHistoryEntry = {
      year;
      month;
      status = newStatus;
    };
    user.statusHistory.concat([entry]);
  };

  // "nicht vorhanden"-Semantik: ein Benutzer ist in Monat (year, month) nur
  // dann ÜBERHAUPT vorhanden (d.h. er taucht in der Monats-Ansicht auf), wenn
  // (year, month) >= Registrierungsmonat. Für Monate strikt vor der
  // Registrierung ist der Benutzer "nicht vorhanden" — weder "aktiv" noch
  // "inaktiv". Das Frontend interpretiert die ABWESENHEIT des Benutzers aus
  // der users-Liste des Monats als "nicht vorhanden" (null).
  public func isUserPresentInMonth(
    user : KanzleiTypes.Leistungserbringer,
    year : Nat,
    month : Nat,
  ) : Bool {
    let (regYear, regMonth) = yearMonthFromTimestamp(user.registeredAt);
    // (year, month) >= (regYear, regMonth)
    if (year > regYear) { return true };
    if (year < regYear) { return false };
    // year == regYear
    month >= regMonth;
  };

  // Historisierte Logik: ein Benutzer ist in Monat M des Jahres Y aktiv, wenn
  // der statusHistory-Eintrag mit der grössten (year, month) <= (Y, M) den
  // status "aktiv" hat. Fallback für Legacy-Benutzer ohne statusHistory:
  // aktiver Status gdw. aktueller status == "aktiv" UND (Y, M) >=
  // Registrierungsmonat.
  public func isUserActiveInMonth(
    user : KanzleiTypes.Leistungserbringer,
    year : Nat,
    month : Nat,
  ) : Bool {
    // "nicht vorhanden" → niemals aktiv
    if (not isUserPresentInMonth(user, year, month)) { return false };

    // Historisierte Logik: finde den statusHistory-Eintrag mit der grössten
    // (year, month) <= (year, month). Wenn keiner existiert (alle Einträge
    // liegen in der Zukunft bezüglich des angefragten Monats), Fallback auf
    // aktuellen status.
    var bestEntry : ?KanzleiTypes.StatusHistoryEntry = null;
    for (entry in user.statusHistory.values()) {
      // Ist dieser Eintrag <= (year, month)?
      let le : Bool = if (entry.year < year) {
        true;
      } else if (entry.year > year) {
        false;
      } else {
        entry.month <= month;
      };
      if (le) {
        switch (bestEntry) {
          case (?b) {
            // Ist entry > b (in (year, month)-Ordnung)?
            let gt : Bool = if (entry.year > b.year) {
              true;
            } else if (entry.year < b.year) {
              false;
            } else {
              entry.month > b.month;
            };
            if (gt) { bestEntry := ?entry };
          };
          case null { bestEntry := ?entry };
        };
      };
    };
    switch (bestEntry) {
      case (?e) { e.status == "aktiv" };
      case null {
        // Legacy-Fallback: aktueller status == "aktiv"
        user.status == "aktiv";
      };
    };
  };

  // ─── Rollendes 12-Monate-Fenster ────────────────────────────────────────────
  //
  // Berechnet das rollende 12-Monate-Fenster für ein gewähltes Jahr. Das
  // Fenster endet mit dem aktuellen Kalendermonat des gewählten Jahres:
  //   - gewähltes Jahr = aktuelles Jahr → Fenster endet mit aktuellem Monat.
  //   - gewähltes Jahr in der Vergangenheit → Fenster endet mit dem aktuellen
  //     Kalendermonat des gewählten Jahres (12 Monate rückwärts ab aktuellem
  //     Monat des gewählten Jahres).
  //
  // Liefert ein Array von genau 12 (year, month)-Paaren, geordnet vom ältesten
  // (Index 0) zum jüngsten (Index 11). Jedes Paar ist absolut (year, month),
  // damit das Frontend dynamische Monatsnamen rendern kann.
  public func rollingWindowMonths(
    selectedYear : Nat,
    now : Common.Timestamp,
  ) : [(Nat, Nat)] {
    let (currentYear, currentMonth) = yearMonthFromTimestamp(now);
    // End-Monat des Fensters:
    //   - selectedYear == currentYear → (selectedYear, currentMonth)
    //   - selectedYear < currentYear  → (selectedYear, currentMonth)
    //   - selectedYear > currentYear  → (selectedYear, currentMonth) (zukunft,
    //     logisch konsistent — 12 Monate rückwärts ab aktuellem Monat des
    //     gewählten Jahres)
    // In allen Fällen endet das Fenster bei (selectedYear, currentMonth).
    let endYear : Nat = selectedYear;
    let endMonth : Nat = currentMonth;

    // 12 Monate rückwärts ab (endYear, endMonth), oldest-first.
    // Wir bauen das Array von Index 0 (älteste) bis Index 11 (jüngste).
    // Index i (0..11) entspricht (endYear, endMonth) minus (11 - i) Monate.
    Array.tabulate<(Nat, Nat)>(12, func(i : Nat) : (Nat, Nat) {
      // offset = 11 - i Monate rückwärts
      let offset : Nat = 11 - i;
      // (endYear, endMonth) minus offset Monate
      let totalMonths : Int = endYear * 12 + (endMonth - 1) - offset;
      let y : Int = totalMonths / 12;
      let m : Int = totalMonths % 12 + 1;
      (Int.abs(y), Int.abs(m));
    });
  };

  // ─── getActiveUsersPerMonth ─────────────────────────────────────────────────
  //
  // Baut einen rollenden 12-Monate-Bericht pro Kanzlei für das gegebene Jahr.
  // Das rollende Fenster endet mit dem aktuellen Kalendermonat des gewählten
  // Jahres (12 Monate rückwärts). Verwendet die historisierte
  // isUserActiveInMonth-Logik für jeden der 12 Monate.
  //
  // ActiveUserMonth.total = Anzahl der in diesem konkreten (year, month) aktiven
  // Benutzer. ActiveUserMonth.year/month sind absolut (rollendes Fenster).
  //
  // yearTotal = Anzahl DISTINCT aktiver Benutzer über die 12 angezeigten
  // Monate (dedup nach userId.toString()), NICHT die Summe der Monatstotale.
  //
  // Strikte Daten-Trennung: nur Benutzer mit user.kanzleiId == kanzleiId
  // werden berücksichtigt. Die Zugriffsprüfung erfolgt im Mixin.

  public func getActiveUsersPerMonth(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    kanzleiId : Common.KanzleiId,
    year : Nat,
    now : Common.Timestamp,
  ) : ActiveUsersTypes.ActiveUsersYearReport {
    let window = rollingWindowMonths(year, now);

    // Kanzlei-scoped Benutzer (nur user.kanzleiId == kanzleiId).
    let kanzleiUsers : [KanzleiTypes.Leistungserbringer] = users.values()
      .filter(func(u : KanzleiTypes.Leistungserbringer) : Bool {
        u.kanzleiId == kanzleiId;
      })
      .toArray();

    // Distinct-Set der userIds, die in mindestens einem der 12 Monate aktiv
    // waren (für yearTotal). Dedup nach userId.toString().
    let activeUserIds : Set.Set<Text> = Set.empty();

    // Baue die 12 Monats-Einträge via tabulate (Index i → window[i]).
    let months : [ActiveUsersTypes.ActiveUserMonth] = Array.tabulate(
      12,
      func(i : Nat) : ActiveUsersTypes.ActiveUserMonth {
        let (y, m) = window[i];
        // Baue users-Array: nur Benutzer, die in diesem Monat vorhanden sind
        // (isUserPresentInMonth). isActive wird via isUserActiveInMonth bestimmt.
        let entries : [ActiveUsersTypes.ActiveUserEntry] = kanzleiUsers
          .filter(func(u : KanzleiTypes.Leistungserbringer) : Bool {
            isUserPresentInMonth(u, y, m);
          })
          .map(func(u : KanzleiTypes.Leistungserbringer) : ActiveUsersTypes.ActiveUserEntry {
            {
              userId = u.id;
              name = u.vorname # " " # u.nachname;
              isActive = isUserActiveInMonth(u, y, m);
            };
          });
        // total = Anzahl aktiver Benutzer in diesem konkreten Monat.
        let total : Int = entries.filter(func(e : ActiveUsersTypes.ActiveUserEntry) : Bool {
          e.isActive;
        }).size();
        // Distinct-Set aktualisieren: alle aktiven Benutzer dieses Monats.
        for (e in entries.values()) {
          if (e.isActive) {
            activeUserIds.add(e.userId.toText());
          };
        };
        { year = y; month = m; users = entries; total };
      },
    );

    let yearTotal : Int = activeUserIds.size();
    {
      kanzleiId;
      year;
      months;
      yearTotal;
    };
  };

  // ─── isAdminOfKanzlei ───────────────────────────────────────────────────────
  //
  // Prüft, ob der caller ein Admin der angegebenen Kanzlei ist ODER Super-Admin.
  // Die Rolle wird via deriveRole-Logik abgeleitet (role-Feld bevorzugt,
  // isAdmin als Fallback). Super-Admin-Status wird über die Whitelist geprüft.
  //
  // #plattform_admin-Regel: ein Benutzer mit role = #plattform_admin gilt
  // hier als Admin (die autoritative Super-Admin-Prüfung bleibt die
  // superAdminWhitelist, die vorab geprüft wird).

  public func isAdminOfKanzlei(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    kanzleiId : Common.KanzleiId,
  ) : Bool {
    // Super-Admin → immer erlaubt.
    if (superAdminWhitelist.get(caller) != null) { return true };
    // Sonst: caller muss ein Benutzer der Kanzlei mit Admin-Rolle sein.
    switch (users.get(caller)) {
      case (?u) {
        if (u.kanzleiId != kanzleiId) { return false };
        // Rolle ableiten: role-Feld bevorzugt, isAdmin als Fallback.
        let role : KanzleiTypes.Role = switch (u.role) {
          case (?r) r;
          case null if (u.isAdmin) { #admin } else { #anwalt };
        };
        switch (role) {
          case (#plattform_admin) true;
          case (#admin) true;
          case (_) false;
        };
      };
      case null false;
    };
  };

  // ─── getAllActiveUsersPerMonth ──────────────────────────────────────────────
  //
  // Gesamtbericht über alle Kanzleien: liefert für jede Kanzlei einen
  // rollenden 12-Monate-Bericht der aktiven Benutzer für das gegebene Jahr,
  // ergänzt um den Kanzlei-Namen (AllKanzleienActiveUsersReport). Verwendet
  // die historisierte isUserActiveInMonth-Logik (über getActiveUsersPerMonth).
  // Die Super-Admin-Gating-Prüfung erfolgt im Mixin.
  //
  // yearTotal pro Kanzlei = Anzahl DISTINCT aktiver Benutzer über die 12
  // angezeigten Monate (dedup nach userId.toString()).

  public func getAllActiveUsersPerMonth(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    year : Nat,
    now : Common.Timestamp,
  ) : [ActiveUsersTypes.AllKanzleienActiveUsersReport] {
    kanzleien.values()
      .map(func(k : KanzleiTypes.Kanzlei) : ActiveUsersTypes.AllKanzleienActiveUsersReport {
        let report = getActiveUsersPerMonth(users, k.id, year, now);
        {
          kanzleiId = report.kanzleiId;
          kanzleiName = k.name;
          year = report.year;
          months = report.months;
          yearTotal = report.yearTotal;
        };
      })
      .toArray();
  };
};
