import Common "common";

module {
  public type LeistungStatus = { #offen; #verrechnet };
  public type AuslagenKategorie = { #porto; #kopien; #reise; #andere };
  public type AuslagenStatus = { #offen; #verrechnet };

  public type Leistung = {
    id : Common.LeistungId;
    mandatId : Common.MandatId;
    kanzleiId : Common.KanzleiId;
    leistungserbringerId : Principal;
    taetigkeit : Text;
    datum : Text;
    dauer : Nat;
    honorar : Nat;
    status : LeistungStatus;
    rechnungId : ?Common.RechnungId;
    createdAt : Common.Timestamp;
  };

  public type Auslage = {
    id : Common.AuslageId;
    mandatId : Common.MandatId;
    kanzleiId : Common.KanzleiId;
    leistungserbringerId : Principal;
    beschreibung : Text;
    kategorie : AuslagenKategorie;
    betrag : Nat;
    datum : Text;
    status : AuslagenStatus;
    rechnungId : ?Common.RechnungId;
    createdAt : Common.Timestamp;
  };

  public type LeistungFilter = {
    mandatId : ?Common.MandatId;
    leistungserbringerId : ?Principal;
    status : ?LeistungStatus;
    datumVon : ?Text;
    datumBis : ?Text;
  };

  public type AuslagenFilter = {
    mandatId : ?Common.MandatId;
    leistungserbringerId : ?Principal;
    status : ?AuslagenStatus;
    datumVon : ?Text;
    datumBis : ?Text;
  };
};
