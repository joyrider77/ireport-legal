import Common "../types/common";
import KlientenTypes "../types/klienten";
import KanzleiTypes "../types/kanzlei";
import LeistungTypes "../types/leistungen";
import Types "../types/rechnungen";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Principal "mo:core/Principal";

module {

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /// Parse "yyyy-mm-dd" → (year, month, day) as Nat
  func parseDate(d : Text) : ?(Nat, Nat, Nat) {
    let parts = d.split(#char '-');
    var arr : [Text] = [];
    for (p in parts) { arr := arr.concat([p]) };
    if (arr.size() != 3) return null;
    let y = switch (Nat.fromText(arr[0])) { case (?v) v; case null return null };
    let m = switch (Nat.fromText(arr[1])) { case (?v) v; case null return null };
    let day = switch (Nat.fromText(arr[2])) { case (?v) v; case null return null };
    ?(y, m, day)
  };

  /// Days per month (non-leap-year; good enough for +30-day math)
  func daysInMonth(month : Nat, year : Nat) : Nat {
    if (month == 2) {
      let leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0);
      if (leap) 29 else 28
    } else if (month == 4 or month == 6 or month == 9 or month == 11) {
      30
    } else { 31 }
  };

  /// Pad a Nat with leading zeros to `width` digits
  func padLeft(n : Nat, width : Nat) : Text {
    var s = n.toText();
    while (s.size() < width) { s := "0" # s };
    s
  };

  /// Add exactly `days` days to a "yyyy-mm-dd" date string.
  func addDays(date : Text, days : Nat) : Text {
    switch (parseDate(date)) {
      case (null) date; // fallback: return unchanged
      case (?(y, m, d)) {
        var year = y;
        var month = m;
        var day = d + days;
        // Normalise the day overflow
        var keepGoing = true;
        while (keepGoing) {
          let dim = daysInMonth(month, year);
          if (day > dim) {
            day := day - dim;
            month := month + 1;
            if (month > 12) { month := 1; year := year + 1 };
          } else {
            keepGoing := false;
          };
        };
        year.toText() # "-" # padLeft(month, 2) # "-" # padLeft(day, 2)
      };
    }
  };

  /// Parse die Anzahl Tage aus einem Zahlungsbedingungen-Text.
  ///
  /// Workstream D — Fälligkeitsdatum fachlich korrekt:
  /// Extrahiert die erste zusammenhängende Ziffernfolge aus dem Text und
  /// interpretiert sie als Anzahl Tage. In der Praxis steht in
  /// Zahlungsbedingungen wie "30 Tage netto", "Zahlbar innert 14 Tagen",
  /// "10 days" oder "Netto 30" genau eine Zahl, die die Tagesanzahl angibt.
  /// Daher reicht ein simpler Scanner, der die erste Ziffernsequenz liest.
  ///
  /// Fallback 30 wird NUR zurückgegeben, wenn keine Ziffernfolge gefunden
  /// wird (z.B. bei leerem Text oder Texten wie "sofort" / "bei Erhalt").
  /// Der Fallback ist bewusst konservativ: ist ein Mandatswert vorhanden,
  /// enthält er in der Praxis eine Zahl; der Fallback greift nur bei
  /// unbrauchbaren/leeren Mandatswerten.
  ///
  /// Beispiele:
  ///   "30 Tage netto"        → 30
  ///   "Zahlbar innert 14 Tagen" → 14
  ///   "10 days"               → 10
  ///   "Netto 30"              → 30
  ///   ""                      → 30 (Fallback)
  ///   "sofort"                → 30 (Fallback)
  func parseZahlungsbedingungenTage(zahlungsbedingungen : Text) : Nat {
    var value : Nat = 0;
    var inNumber = false;
    var found = false;
    for (c in zahlungsbedingungen.toIter()) {
      let isDigit = c >= '0' and c <= '9';
      if (isDigit) {
        let digit : Nat = switch (c) {
          case '0' 0; case '1' 1; case '2' 2; case '3' 3; case '4' 4;
          case '5' 5; case '6' 6; case '7' 7; case '8' 8; case '9' 9;
          case _ 0; // unreachable given the guard above
        };
        value := value * 10 + digit;
        inNumber := true;
      } else {
        if (inNumber) {
          // End of the first digit run — we have our number.
          found := true;
          break;
        };
      };
    };
    if (found or inNumber) value else 30
  };

  /// Zentrale Resolver-Funktion für das Fälligkeitsdatum.
  ///
  /// Berechnet faelligkeitsdatum = rechnungsdatum + tage, wobei `tage` aus dem
  /// übergebenen zahlungsbedingungen-Text via parseZahlungsbedingungenTage
  /// geparst wird. Es wird KEINE zweite Parsing-Logik und KEIN Hardcode "+30"
  /// verwendet — ausschliesslich der bestehende Parser.
  ///
  /// Fallback-Verhalten (transparent, dokumentiert):
  /// Enthält der zahlungsbedingungen-Text keine Ziffernfolge (z.B. leer,
  /// "sofort", "bei Erhalt"), greift der bestehende Default von
  /// parseZahlungsbedingungenTage = 30 Tage. Dieser Default ist bewusst
  /// konservativ und wird hier unverändert übernommen — es gibt keinen
  /// Fallback auf das rechnungsdatum selbst.
  ///
  /// Diese Funktion ist die EINZIGE Stelle, an der ein Fälligkeitsdatum ohne
  /// bereits persistierten Wert berechnet werden soll. Sie wird verwendet von:
  ///   - createRechnung (definitive Rechnungserstellung)
  ///   - Vorschau-/Word-Vorschau-Pfade (keine Seiteneffekte, nur Berechnung)
  ///   - sonstigen Rechnungsdarstellungen ohne persistiertes Fälligkeitsdatum
  ///
  /// Für historische, bereits definitiv erstellte Rechnungen gilt: das
  /// gespeicherte faelligkeitsdatum ist führend und darf NICHT durch diese
  /// Funktion neu berechnet werden (siehe getRechnung/getRechnungen — dort wird
  /// ausschliesslich der persistierte Wert gelesen).
  public func resolveFaelligkeitsdatum(
    rechnungsdatum : Text,
    zahlungsbedingungen : Text,
  ) : Text {
    let tage = parseZahlungsbedingungenTage(zahlungsbedingungen);
    addDays(rechnungsdatum, tage)
  };

  /// Generate invoice number "RE-yyyy-nnnn"
  func makeRechnungsnummer(counter : Nat, date : Text) : Text {
    let year = switch (parseDate(date)) {
      case (?(y, _, _)) y.toText();
      case null "0000";
    };
    "RE-" # year # "-" # padLeft(counter, 4)
  };

  /// Unique id from timestamp + counter
  func newId(prefix : Text, ts : Int, salt : Nat) : Text {
    prefix # "-" # ts.toText() # "-" # salt.toText()
  };

  /// Normalisiert das waehrung-Feld einer Rechnung für den Lesezugriff.
  ///
  /// Fix 12 — Historische Rechnungswährung erhalten:
  /// Diese Funktion darf NIEMALS eine gespeicherte nicht-leere Währung
  /// überschreiben. Sie normalisiert ausschliesslich "" → "CHF" für
  /// historische Rechnungen, die vor Einführung des waehrung-Feldes
  /// erstellt wurden und beim Deserialisieren zu "" (Motoko-Default für
  /// Text) werden. Eine gespeicherte Währung wie "EUR" oder "USD" bleibt
  /// unverändert erhalten, auch wenn die Mandatswährung später auf "CHF"
  /// geändert wird.
  ///
  /// Root Cause (hypothetisch, hier verhindert): Würde diese Funktion die
  /// Währung aus dem aktuellen Mandat neu ableiten (z.B. durch Nachschlagen
  /// von mandate.get(r.mandatId).waehrung), würde jede spätere Änderung der
  /// Mandatswährung alle historischen Rechnungen dieses Mandats stillschweigend
  /// umwerten — ein Verstoß gegen Fix 12. Rechnung.waehrung ist pro Rechnung
  /// persistiert und bleibt führend für diese Rechnung.
  func normalizeWaehrung(w : Text) : Text {
    if (w == "") "CHF" else w
  };

  /// Wendet normalizeWaehrung auf eine Rechnung an (Record-Spread, da
  /// Rechnung ein rein immutabler Record ist).
  ///
  /// Fix 12: Der Record-Spread `{ r with waehrung = ... } ersetzt waehrung
  /// nur durch normalizeWaehrung(r.waehrung) — d.h. nur "" → "CHF". Eine
  /// vorhandene nicht-leere Währung wird identisch wiederhergestellt und
  /// nicht aus dem Mandat neu abgeleitet. Kein Lesezugriff (getRechnungen,
  /// getRechnung) darf hier eine mandatsabhängige Währung einsetzen.
  func withNormalizedWaehrung(r : Types.Rechnung) : Types.Rechnung {
    { r with waehrung = normalizeWaehrung(r.waehrung) }
  };

  // -----------------------------------------------------------------------
  // createRechnung
  // -----------------------------------------------------------------------

  public func createRechnung(
    rechnungen : Map.Map<Common.RechnungId, Types.Rechnung>,
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    nextRechnungsnummer : Nat,
    user : KanzleiTypes.Leistungserbringer,
    mandatId : Common.MandatId,
    leistungsIds : [Common.LeistungId],
    auslageIds : [Common.AuslageId],
    rechnungsdatum : Text,
    zahlungsbedingungen : Text,
    leistungszeitraumVon : Text,
    leistungszeitraumBis : Text,
    mwstSatz : Nat,
    waehrung : Text,
  ) : Common.Result<Types.Rechnung, Text> {

    // Verify and accumulate Leistungen
    var leistungenSubtotal : Nat = 0;
    for (lid in leistungsIds.values()) {
      switch (leistungen.get(lid)) {
        case null return #err("Leistung nicht gefunden: " # lid);
        case (?l) {
          if (l.kanzleiId != user.kanzleiId) return #err("Leistung gehört nicht zur Kanzlei");
          switch (l.status) {
            case (#offen) {};
            case (#verrechnet) return #err("Leistung bereits verrechnet: " # lid);
          };
          leistungenSubtotal += l.honorar;
        };
      }
    };

    // Verify and accumulate Auslagen
    var auslagenSubtotal : Nat = 0;
    for (aid in auslageIds.values()) {
      switch (auslagen.get(aid)) {
        case null return #err("Auslage nicht gefunden: " # aid);
        case (?a) {
          if (a.kanzleiId != user.kanzleiId) return #err("Auslage gehört nicht zur Kanzlei");
          switch (a.status) {
            case (#offen) {};
            case (#verrechnet) return #err("Auslage bereits verrechnet: " # aid);
          };
          auslagenSubtotal += a.betrag;
        };
      }
    };

    let subtotal = leistungenSubtotal + auslagenSubtotal;
    let mwstBetrag = subtotal * mwstSatz / 10000;
    let total = subtotal + mwstBetrag;

    let now = Time.now();
    let rechnungId = newId("R", now, nextRechnungsnummer);
    let rechnungsnummer = makeRechnungsnummer(nextRechnungsnummer, rechnungsdatum);
    // Workstream D — Fälligkeitsdatum fachlich korrekt:
    // Fälligkeitsdatum = Rechnungsdatum + Mandats-Zahlungsbedingungen (als
    // Anzahl Tage). Der Hardcode "+30" wurde entfernt; die Tageszahl wird
    // nun aus dem übergebenen zahlungsbedingungen-Parameter (der aus dem
    // zur Rechnung gehörenden Mandat stammt) geparst. Fallback 30 greift
    // nur, wenn der Text keine Ziffern enthält (z.B. leer oder "sofort").
    //
    // Die Berechnung erfolgt zentral über resolveFaelligkeitsdatum, die
    // ebenfalls von Vorschau-/Word-Vorschau-Pfaden verwendet wird — Vorschau
    // und definitive Rechnung verwenden dieselbe Business-Logik. Der einzige
    // Unterschied der Vorschau ist das Fehlen von Seiteneffekten (kein
    // Persistieren, kein Reservieren, kein Verrechnet-Marken, keine
    // Rechnungsnummer-Generierung); die Fälligkeitsberechnung ist identisch.
    //
    // Persistenz: faelligkeitsdatum wird hier berechnet und unten im
    // Rechnungs-Record dauerhaft gespeichert. Spätere Änderungen der
    // Mandats-Zahlungsbedingungen berühren diese Rechnung nicht mehr
    // (Wert wird bei Erstellung kopiert) — historische Rechnungen bleiben
    // unverändert. Wird createRechnung mit einem geänderten rechnungsdatum
    // aufgerufen (z.B. Datumskorrektur vor finaler Erstellung), wird das
    // Fälligkeitsdatum automatisch neu berechnet.
    let faelligkeitsdatum = resolveFaelligkeitsdatum(rechnungsdatum, zahlungsbedingungen);

    let rechnung : Types.Rechnung = {
      id = rechnungId;
      rechnungsnummer = rechnungsnummer;
      kanzleiId = user.kanzleiId;
      mandatId = mandatId;
      leistungserbringerId = user.id;
      rechnungsdatum = rechnungsdatum;
      leistungszeitraumVon = leistungszeitraumVon;
      leistungszeitraumBis = leistungszeitraumBis;
      leistungspositionen = leistungsIds;
      auslageIds = auslageIds;
      subtotal = subtotal;
      mwstBetrag = mwstBetrag;
      total = total;
      waehrung = normalizeWaehrung(waehrung); // Fix 12: Währung wird bei Erstellung dauerhaft persistiert. normalizeWaehrung setzt nur "" → "CHF"; ein vom Mandat übergebener nicht-leerer Wert (z.B. "EUR") bleibt erhalten. Spätere Mandatsänderungen berühren diese Rechnung nicht mehr.
      zahlungsbedingungen = zahlungsbedingungen;
      zahlungsstatus = #offen;
      faelligkeitsdatum = faelligkeitsdatum;
      createdAt = now;
    };

    // Mark Leistungen as verrechnet
    for (lid in leistungsIds.values()) {
      switch (leistungen.get(lid)) {
        case (?l) {
          leistungen.add(lid, { l with status = #verrechnet; rechnungId = ?rechnungId });
        };
        case null {};
      }
    };

    // Mark Auslagen as verrechnet
    for (aid in auslageIds.values()) {
      switch (auslagen.get(aid)) {
        case (?a) {
          auslagen.add(aid, { a with status = #verrechnet; rechnungId = ?rechnungId });
        };
        case null {};
      }
    };

    rechnungen.add(rechnungId, rechnung);
    #ok(rechnung)
  };

  // -----------------------------------------------------------------------
  // getRechnungen
  // -----------------------------------------------------------------------

  public func getRechnungen(
    rechnungen : Map.Map<Common.RechnungId, Types.Rechnung>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    filter : Types.RechnungFilter,
  ) : [Types.Rechnung] {
    let result = rechnungen.values()
      .filter(func(r : Types.Rechnung) : Bool {
        // Always restrict to caller's Kanzlei
        if (r.kanzleiId != user.kanzleiId) return false;

        // mandatId filter
        switch (filter.mandatId) {
          case (?mid) { if (r.mandatId != mid) return false };
          case null {};
        };

        // zahlungsstatus filter
        switch (filter.zahlungsstatus) {
          case (?zs) {
            switch (zs, r.zahlungsstatus) {
              case (#offen, #offen) {};
              case (#bezahlt, #bezahlt) {};
              case (#ueberfaellig, #ueberfaellig) {};
              case _ return false;
            }
          };
          case null {};
        };

        // datumVon filter
        switch (filter.datumVon) {
          case (?von) { if (r.rechnungsdatum.less(von)) return false };
          case null {};
        };

        // datumBis filter
        switch (filter.datumBis) {
          case (?bis) { if (r.rechnungsdatum.greater(bis)) return false };
          case null {};
        };

        // akquisiteurId filter — look up mandat
        switch (filter.akquisiteurId) {
          case (?akqId) {
            switch (mandate.get(r.mandatId)) {
              case (?m) {
                if (not Principal.equal(m.akquisiteurId, akqId)) return false
              };
              case null return false;
            }
          };
          case null {};
        };

        true
      })
      .toArray();

    // Sort descending by createdAt, dann waehrung normalisieren.
    //
    // Fix 12 — Historische Rechnungswährung erhalten:
    // withNormalizedWaehrung normalisiert nur "" → "CHF" und leitet die
    // Währung NICHT aus dem aktuellen Mandat ab. Spätere Änderungen der
    // Mandatswährung beeinflussen bestehende Rechnungen nicht — waehrung ist
    // pro Rechnung dauerhaft persistiert und bleibt führend für diese Rechnung.
    //
    // Root Cause (hier verhindert): Ein Lesezugriff, der mandate.get(r.mandatId)
    // bemüht, um r.waehrung zur Anzeigezeit neu zu setzen, würde historische
    // Rechnungen nachträglich umwerten, sobald das Mandat auf eine andere
    // Währung geändert wird. Dieser Pfad verwendet bewusst nur die gespeicherte
    // Rechnung.waehrung.
    result
      .sort(func(a : Types.Rechnung, b : Types.Rechnung) : { #less; #equal; #greater } {
        if (a.createdAt > b.createdAt) #less
        else if (a.createdAt < b.createdAt) #greater
        else #equal
      })
      .map(func(r : Types.Rechnung) : Types.Rechnung {
        withNormalizedWaehrung(r)
      })
  };

  // -----------------------------------------------------------------------
  // getRechnung
  // -----------------------------------------------------------------------

  public func getRechnung(
    rechnungen : Map.Map<Common.RechnungId, Types.Rechnung>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.RechnungId,
  ) : ?Types.Rechnung {
    // Fix 12: withNormalizedWaehrung leitet die Währung NICHT aus dem Mandat
    // ab, sondern verwendet ausschliesslich die gespeicherte r.waehrung
    // (mit "" → "CHF"-Normalisierung für historische Rechnungen). Eine spätere
    // Änderung der Mandatswährung wirkt sich nicht auf diese historische
    // Rechnung aus.
    switch (rechnungen.get(id)) {
      case (?r) {
        if (r.kanzleiId == user.kanzleiId) ?(withNormalizedWaehrung(r)) else null
      };
      case null null;
    }
  };

  // -----------------------------------------------------------------------
  // updateZahlungsstatus
  // -----------------------------------------------------------------------

  public func updateZahlungsstatus(
    rechnungen : Map.Map<Common.RechnungId, Types.Rechnung>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.RechnungId,
    status : Types.ZahlungsStatus,
  ) : Common.Result<(), Text> {
    switch (rechnungen.get(id)) {
      case null #err("Rechnung nicht gefunden");
      case (?r) {
        if (r.kanzleiId != user.kanzleiId) return #err("Kein Zugriff");
        rechnungen.add(id, { r with zahlungsstatus = status });
        #ok(())
      };
    }
  };

  // -----------------------------------------------------------------------
  // addZahlung
  // -----------------------------------------------------------------------

  public func addZahlung(
    zahlungen : Map.Map<Common.ZahlungId, Types.Zahlung>,
    rechnungen : Map.Map<Common.RechnungId, Types.Rechnung>,
    user : KanzleiTypes.Leistungserbringer,
    rechnungId : Common.RechnungId,
    datum : Text,
    betrag : Nat,
  ) : Common.Result<Types.Zahlung, Text> {
    switch (rechnungen.get(rechnungId)) {
      case null #err("Rechnung nicht gefunden");
      case (?r) {
        if (r.kanzleiId != user.kanzleiId) return #err("Kein Zugriff");

        let now = Time.now();
        let zahlungId = newId("Z", now, zahlungen.size());
        let zahlung : Types.Zahlung = {
          id = zahlungId;
          rechnungId = rechnungId;
          kanzleiId = user.kanzleiId;
          datum = datum;
          betrag = betrag;
          status = #eingegangen;
          createdAt = now;
        };

        // Auto-mark rechnung as bezahlt when payment covers full total
        if (betrag >= r.total) {
          rechnungen.add(rechnungId, { r with zahlungsstatus = #bezahlt });
        };

        zahlungen.add(zahlungId, zahlung);
        #ok(zahlung)
      };
    }
  };

  // -----------------------------------------------------------------------
  // getZahlungen
  // -----------------------------------------------------------------------

  public func getZahlungen(
    zahlungen : Map.Map<Common.ZahlungId, Types.Zahlung>,
    user : KanzleiTypes.Leistungserbringer,
  ) : [Types.Zahlung] {
    zahlungen.values()
      .filter(func(z : Types.Zahlung) : Bool { z.kanzleiId == user.kanzleiId })
      .toArray()
  };
};
