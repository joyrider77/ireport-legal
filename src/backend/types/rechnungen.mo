import Common "common";

module {
  public type ZahlungsStatus = { #offen; #bezahlt; #ueberfaellig };
  public type ZahlungEingangStatus = { #eingegangen; #bestaetigt };

  public type Rechnung = {
    id : Common.RechnungId;
    rechnungsnummer : Text;
    kanzleiId : Common.KanzleiId;
    mandatId : Common.MandatId;
    leistungserbringerId : Principal;
    rechnungsdatum : Text;
    leistungszeitraumVon : Text;
    leistungszeitraumBis : Text;
    leistungspositionen : [Common.LeistungId];
    auslageIds : [Common.AuslageId];
    subtotal : Nat;
    mwstBetrag : Nat;
    total : Nat;
    // Währung der Rechnung (z.B. "CHF", "EUR", "USD"). Wird bei der
    // Rechnungserstellung aus der Mandatswährung übernommen und dauerhaft
    // gespeichert (Fix 12). Spätere Änderungen der Mandatswährung ändern
    // historische Rechnungen nicht — Rechnung.waehrung bleibt führend für
    // diese Rechnung. Historische Rechnungen ohne Feldwert deserialisieren
    // zu "" und werden im Lesezugriff ausschliesslich auf "CHF" normalisiert
    // (niemals aus dem aktuellen Mandat neu abgeleitet).
    //
    // Root Cause: Würde ein Lese- oder Update-Pfad die Währung zur Anzeige-
    // oder Bearbeitungszeit aus dem aktuellen Mandat neu ableiten, würde
    // jede spätere Mandatsänderung alle historischen Rechnungen dieses
    // Mandats stillschweigend umwerten. Die Persistenz pro Rechnung ist die
    // einzige fachlich korrekte Quelle für die Rechnungswährung.
    waehrung : Text;
    zahlungsbedingungen : Text;
    zahlungsstatus : ZahlungsStatus;
    faelligkeitsdatum : Text;
    createdAt : Common.Timestamp;
  };

  public type Zahlung = {
    id : Common.ZahlungId;
    rechnungId : Common.RechnungId;
    kanzleiId : Common.KanzleiId;
    datum : Text;
    betrag : Nat;
    status : ZahlungEingangStatus;
    createdAt : Common.Timestamp;
  };

  public type RechnungFilter = {
    mandatId : ?Common.MandatId;
    akquisiteurId : ?Principal;
    zahlungsstatus : ?ZahlungsStatus;
    datumVon : ?Text;
    datumBis : ?Text;
  };
};
