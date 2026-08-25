import Common "common";

module {
  // Ein einzelner Benutzer-Eintrag pro Monat mit aktiv-Status.
  // isActive = true gdw. der Benutzerstatus in DIESEM konkreten Monat 'aktiv'
  // war (historisierte Status-Logik, siehe lib/active-users.isUserActiveInMonth).
  public type ActiveUserEntry = {
    userId : Principal;
    name : Text; // vorname + " " + nachname
    isActive : Bool;
  };

  // Ein Monat im rollenden 12-Monate-Bericht. Jeder Monats-Eintrag trägt
  // sein ABSOLUTES (year, month), damit das Frontend dynamische Monatsnamen
  // aus dem gewählten rollenden Fenster rendern kann (nicht fix Jan..Dez).
  //
  // Das rollende Fenster endet mit dem aktuellen Kalendermonat des gewählten
  // Jahres: letzte Spalte = (gewähltesJahr, aktuellerKalendermonat), erste
  // Spalte = (gewähltesJahr, aktuellerKalendermonat) minus 11 (mit
  // Jahresüberlauf). Die 12-Einträge-Form bleibt erhalten.
  //
  // total = Anzahl der in diesem konkreten (year, month) aktiven Benutzer
  // (historisierte Status-Logik). Monate vor der Registrierung eines
  // Benutzers schliessen diesen aus dem users-Array aus ("nicht vorhanden").
  public type ActiveUserMonth = {
    year : Nat; // absolutes Jahr dieses Monats-Eintrags
    month : Nat; // absoluter Monat 1..12 dieses Monats-Eintrags
    users : [ActiveUserEntry];
    total : Int; // Anzahl aktiver Benutzer in diesem konkreten Monat
  };

  // Rollender 12-Monate-Bericht pro Kanzlei/Mandant für ein gewähltes Jahr.
  // Das rollende Fenster endet mit dem aktuellen Kalendermonat des gewählten
  // Jahres (12 Monate rückwärts ab aktuellem Monat des gewählten Jahres).
  // months enthält genau 12 Einträge, jeder mit seinem absoluten (year, month).
  //
  // yearTotal = Anzahl DISTINCT aktiver Benutzer über die 12 angezeigten
  // Monate (dedup nach userId.toString()), NICHT die Summe der Monatstotale
  // und NICHT das Maximum eines Monats.
  public type ActiveUsersYearReport = {
    kanzleiId : Common.KanzleiId;
    year : Nat; // das gewählte Jahr (bestimmt das Ende des rollenden Fensters)
    months : [ActiveUserMonth]; // genau 12 Einträge (rollendes Fenster)
    yearTotal : Int; // DISTINCT aktiver Benutzer über die 12 Monate
  };

  // Rollender 12-Monate-Bericht pro Kanzlei inkl. Kanzlei-Name — verwendet
  // für den Gesamtbericht über alle Kanzleien (getAllActiveUsersPerMonth).
  // Der Kanzlei-Name wird zusätzlich zum bestehenden ActiveUsersYearReport
  // geführt, damit der Aufrufer die Reports ohne weitere Lookups anzeigen
  // kann. Ein separater Typ vermeidet eine Breaking-Change am bestehenden
  // ActiveUsersYearReport (Kanzlei-Admins erhalten weiterhin den Report
  // ohne kanzleiName).
  //
  // yearTotal = Anzahl DISTINCT aktiver Benutzer über die 12 angezeigten
  // Monate (dedup nach userId.toString()).
  public type AllKanzleienActiveUsersReport = {
    kanzleiId : Common.KanzleiId;
    kanzleiName : Text;
    year : Nat; // das gewählte Jahr
    months : [ActiveUserMonth]; // genau 12 Einträge (rollendes Fenster)
    yearTotal : Int; // DISTINCT aktiver Benutzer über die 12 Monate
  };
};
