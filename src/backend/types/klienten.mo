import Common "common";

module {
  public type Klient = {
    id : Common.KlientId;
    kanzleiId : Common.KanzleiId;
    name : Text;
    strasse : Text;
    plzOrt : Text;
    telefon : Text;
    email : Text;
    createdAt : Common.Timestamp;
  };

  public type MandatStatus = { #aktiv; #archiviert };

  public type Auslagenregelung = { #Keine; #Effektiv; #Pauschal };

  public type Mandat = {
    id : Common.MandatId;
    klientId : Common.KlientId;
    kanzleiId : Common.KanzleiId;
    bezeichnung : Text;
    akquisiteurId : Principal;
    akquisitionsbonus : Nat;
    mwstSatz : Nat;
    budget : Nat;
    rundungAktiv : Bool;
    // New auslagenregelung as variant (replaces old Text field)
    auslagenregelung : Auslagenregelung;
    // Pauschalbetrag in Rappen (analog honorar/standardStundensatz); default 0.
    // Wird nur bei auslagenregelung = #Pauschal ausgewertet.
    pauschalBetrag : Nat;
    zahlungsbedingungen : Text;
    status : MandatStatus;
    // New fields
    waehrung : Text;               // e.g. "CHF"
    standardStundensatz : Nat;    // 0 = use firm default
    kostenProKopie : Float;        // CHF per copy
    kostenProScan : Float;         // CHF per scan
    portoAPost : Float;            // CHF
    portoBPost : Float;            // CHF
    portoEinschreiben : Float;     // CHF
    autokilometer : Float;         // CHF per km
    leistungenAusweisen : Bool;    // show services on invoice
    createdAt : Common.Timestamp;
  };
};
