import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import KlientenTypes "../types/klienten";
import Types "../types/leistungen";
import Int "mo:core/Int";
import Iter "mo:core/Iter";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Text "mo:core/Text";
import Time "mo:core/Time";

module {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  /// Round dauer UP to next multiple of 5 minutes (e.g. 7→10, 25→25, 26→30)
  func roundUp5(dauer : Nat) : Nat {
    let rem = dauer % 5;
    if (rem == 0) dauer else dauer + (5 - rem);
  };

  /// Reformat "dd.mm.yyyy" → "yyyymmdd" for lexicographic date comparison
  func reformatDate(d : Text) : Text {
    // Expected format: "dd.mm.yyyy" (length 10)
    let chars = d.toArray();
    if (chars.size() != 10) return d;
    // dd = chars[0..1], mm = chars[3..4], yyyy = chars[6..9]
    let yyyy = [chars[6], chars[7], chars[8], chars[9]];
    let mm   = [chars[3], chars[4]];
    let dd   = [chars[0], chars[1]];
    let parts : [Char] = [
      yyyy[0], yyyy[1], yyyy[2], yyyy[3],
      mm[0], mm[1],
      dd[0], dd[1],
    ];
    Text.fromArray(parts);
  };

  /// Calculate honorar: dauer (minutes) × stundensatz (Rappen/h) ÷ 60
  func calcHonorar(dauer : Nat, stundensatz : Nat) : Nat {
    dauer * stundensatz / 60;
  };

  // ─── Leistungen ─────────────────────────────────────────────────────────────

  public func createLeistung(
    leistungen : Map.Map<Common.LeistungId, Types.Leistung>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    mandatId : Common.MandatId,
    taetigkeit : Text,
    datum : Text,
    dauer : Nat,
    kanzleiDefaultStundensatz : Nat,
  ) : Common.Result<Types.Leistung, Text> {
    // Look up Mandat
    let mandat = switch (mandate.get(mandatId)) {
      case (?m) m;
      case null return #err("Mandat nicht gefunden");
    };
    // Multi-tenant isolation
    if (mandat.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    // Apply optional 5-minute rounding
    let effectiveDauer = if (mandat.rundungAktiv) roundUp5(dauer) else dauer;
    // Use mandate-level stundensatz, fall back to kanzlei default
    let stundensatz = if (mandat.standardStundensatz > 0) mandat.standardStundensatz else kanzleiDefaultStundensatz;
    let honorar = calcHonorar(effectiveDauer, stundensatz);
    let id = user.kanzleiId # "-L-" # mandatId # "-" # Time.now().toText();
    let leistung : Types.Leistung = {
      id;
      mandatId;
      kanzleiId = user.kanzleiId;
      leistungserbringerId = user.id;
      taetigkeit;
      datum;
      dauer = effectiveDauer;
      honorar;
      status = #offen;
      rechnungId = null;
      createdAt = Time.now();
    };
    leistungen.add(id, leistung);
    #ok(leistung);
  };

  public func updateLeistung(
    leistungen : Map.Map<Common.LeistungId, Types.Leistung>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.LeistungId,
    taetigkeit : Text,
    dauer : Nat,
    kanzleiDefaultStundensatz : Nat,
  ) : Common.Result<Types.Leistung, Text> {
    let leistung = switch (leistungen.get(id)) {
      case (?l) l;
      case null return #err("Leistung nicht gefunden");
    };
    if (leistung.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    switch (leistung.status) {
      case (#verrechnet) return #err("Verrechnete Leistungen können nicht bearbeitet werden");
      case (#offen) {};
    };
    // Re-apply rounding from mandat settings and use mandate-level stundensatz
    let (effectiveDauer, stundensatz) = switch (mandate.get(leistung.mandatId)) {
      case (?m) {
        let d = if (m.rundungAktiv) roundUp5(dauer) else dauer;
        let s = if (m.standardStundensatz > 0) m.standardStundensatz else kanzleiDefaultStundensatz;
        (d, s);
      };
      case null (dauer, kanzleiDefaultStundensatz);
    };
    let honorar = calcHonorar(effectiveDauer, stundensatz);
    let updated : Types.Leistung = {
      leistung with
      taetigkeit;
      dauer = effectiveDauer;
      honorar;
    };
    leistungen.add(id, updated);
    #ok(updated);
  };

  public func getLeistungen(
    leistungen : Map.Map<Common.LeistungId, Types.Leistung>,
    user : KanzleiTypes.Leistungserbringer,
    filter : Types.LeistungFilter,
  ) : [Types.Leistung] {
    let results = leistungen.entries()
      |> _.filter(func((_, l) : (Common.LeistungId, Types.Leistung)) : Bool {
        // Always enforce kanzlei isolation
        if (l.kanzleiId != user.kanzleiId) return false;
        // Optional mandatId filter
        switch (filter.mandatId) {
          case (?mid) if (l.mandatId != mid) return false;
          case null {};
        };
        // Optional leistungserbringer filter
        switch (filter.leistungserbringerId) {
          case (?pid) if (not Principal.equal(l.leistungserbringerId, pid)) return false;
          case null {};
        };
        // Optional status filter
        switch (filter.status) {
          case (?s) {
            let matches = switch (s) {
              case (#offen) switch (l.status) { case (#offen) true; case _ false };
              case (#verrechnet) switch (l.status) { case (#verrechnet) true; case _ false };
            };
            if (not matches) return false;
          };
          case null {};
        };
        // Optional date range filters (reformat dd.mm.yyyy → yyyymmdd)
        let datumKey = reformatDate(l.datum);
        switch (filter.datumVon) {
          case (?von) if (datumKey < reformatDate(von)) return false;
          case null {};
        };
        switch (filter.datumBis) {
          case (?bis) if (datumKey > reformatDate(bis)) return false;
          case null {};
        };
        true;
      })
      |> _.map(func((_, l) : (Common.LeistungId, Types.Leistung)) : Types.Leistung { l })
      |> _.toArray();
    results;
  };

  public func deleteLeistung(
    leistungen : Map.Map<Common.LeistungId, Types.Leistung>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.LeistungId,
  ) : Common.Result<(), Text> {
    let leistung = switch (leistungen.get(id)) {
      case (?l) l;
      case null return #err("Leistung nicht gefunden");
    };
    if (leistung.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    switch (leistung.status) {
      case (#verrechnet) return #err("Verrechnete Leistungen können nicht gelöscht werden");
      case (#offen) {};
    };
    leistungen.remove(id);
    #ok(());
  };

  // ─── Auslagen ───────────────────────────────────────────────────────────────

  public func createAuslage(
    auslagen : Map.Map<Common.AuslageId, Types.Auslage>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    mandatId : Common.MandatId,
    beschreibung : Text,
    kategorie : Types.AuslagenKategorie,
    betrag : Nat,
    datum : Text,
  ) : Common.Result<Types.Auslage, Text> {
    let mandat = switch (mandate.get(mandatId)) {
      case (?m) m;
      case null return #err("Mandat nicht gefunden");
    };
    if (mandat.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    let id = user.kanzleiId # "-A-" # mandatId # "-" # Time.now().toText();
    let auslage : Types.Auslage = {
      id;
      mandatId;
      kanzleiId = user.kanzleiId;
      leistungserbringerId = user.id;
      beschreibung;
      kategorie;
      betrag;
      datum;
      status = #offen;
      rechnungId = null;
      createdAt = Time.now();
    };
    auslagen.add(id, auslage);
    #ok(auslage);
  };

  public func updateAuslage(
    auslagen : Map.Map<Common.AuslageId, Types.Auslage>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.AuslageId,
    beschreibung : Text,
    betrag : Nat,
  ) : Common.Result<Types.Auslage, Text> {
    let auslage = switch (auslagen.get(id)) {
      case (?a) a;
      case null return #err("Auslage nicht gefunden");
    };
    if (auslage.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    switch (auslage.status) {
      case (#verrechnet) return #err("Verrechnete Auslagen können nicht bearbeitet werden");
      case (#offen) {};
    };
    let updated : Types.Auslage = { auslage with beschreibung; betrag };
    auslagen.add(id, updated);
    #ok(updated);
  };

  public func getAuslagen(
    auslagen : Map.Map<Common.AuslageId, Types.Auslage>,
    user : KanzleiTypes.Leistungserbringer,
    filter : Types.AuslagenFilter,
  ) : [Types.Auslage] {
    let results = auslagen.entries()
      |> _.filter(func((_, a) : (Common.AuslageId, Types.Auslage)) : Bool {
        if (a.kanzleiId != user.kanzleiId) return false;
        switch (filter.mandatId) {
          case (?mid) if (a.mandatId != mid) return false;
          case null {};
        };
        switch (filter.leistungserbringerId) {
          case (?pid) if (not Principal.equal(a.leistungserbringerId, pid)) return false;
          case null {};
        };
        switch (filter.status) {
          case (?s) {
            let matches = switch (s) {
              case (#offen) switch (a.status) { case (#offen) true; case _ false };
              case (#verrechnet) switch (a.status) { case (#verrechnet) true; case _ false };
            };
            if (not matches) return false;
          };
          case null {};
        };
        let datumKey = reformatDate(a.datum);
        switch (filter.datumVon) {
          case (?von) if (datumKey < reformatDate(von)) return false;
          case null {};
        };
        switch (filter.datumBis) {
          case (?bis) if (datumKey > reformatDate(bis)) return false;
          case null {};
        };
        true;
      })
      |> _.map(func((_, a) : (Common.AuslageId, Types.Auslage)) : Types.Auslage { a })
      |> _.toArray();
    results;
  };

  public func deleteAuslage(
    auslagen : Map.Map<Common.AuslageId, Types.Auslage>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.AuslageId,
  ) : Common.Result<(), Text> {
    let auslage = switch (auslagen.get(id)) {
      case (?a) a;
      case null return #err("Auslage nicht gefunden");
    };
    if (auslage.kanzleiId != user.kanzleiId) {
      return #err("Zugriff verweigert");
    };
    switch (auslage.status) {
      case (#verrechnet) return #err("Verrechnete Auslagen können nicht gelöscht werden");
      case (#offen) {};
    };
    auslagen.remove(id);
    #ok(());
  };
};
