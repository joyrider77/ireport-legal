import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import Types "../types/klienten";
import Map "mo:core/Map";
import Time "mo:core/Time";

module {

  public func createKlient(
    klienten : Map.Map<Common.KlientId, Types.Klient>,
    user : KanzleiTypes.Leistungserbringer,
    name : Text,
    strasse : Text,
    plzOrt : Text,
    telefon : Text,
    email : Text,
  ) : Common.Result<Types.Klient, Text> {
    let now = Time.now();
    let klient : Types.Klient = {
      id = "C-" # now.toText() # "-" # klienten.size().toText();
      kanzleiId = user.kanzleiId;
      name;
      strasse;
      plzOrt;
      telefon;
      email;
      createdAt = now;
    };
    klienten.add(klient.id, klient);
    #ok klient;
  };

  public func updateKlient(
    klienten : Map.Map<Common.KlientId, Types.Klient>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.KlientId,
    name : Text,
    strasse : Text,
    plzOrt : Text,
    telefon : Text,
    email : Text,
  ) : Common.Result<Types.Klient, Text> {
    switch (klienten.get(id)) {
      case null { #err "Klient nicht gefunden" };
      case (?klient) {
        if (klient.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff";
        };
        let updated : Types.Klient = { klient with name; strasse; plzOrt; telefon; email };
        klienten.add(id, updated);
        #ok updated;
      };
    };
  };

  public func getKlienten(
    klienten : Map.Map<Common.KlientId, Types.Klient>,
    user : KanzleiTypes.Leistungserbringer,
  ) : [Types.Klient] {
    klienten.values()
      .filter(func(k : Types.Klient) : Bool {
        k.kanzleiId == user.kanzleiId
      })
      .toArray();
  };

  public func getKlient(
    klienten : Map.Map<Common.KlientId, Types.Klient>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.KlientId,
  ) : ?Types.Klient {
    switch (klienten.get(id)) {
      case null { null };
      case (?klient) {
        if (klient.kanzleiId == user.kanzleiId) { ?klient } else { null };
      };
    };
  };

  public func deleteKlient(
    klienten : Map.Map<Common.KlientId, Types.Klient>,
    mandate : Map.Map<Common.MandatId, Types.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.KlientId,
  ) : Common.Result<(), Text> {
    switch (klienten.get(id)) {
      case null { #err "Klient nicht gefunden" };
      case (?klient) {
        if (klient.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff";
        };
        let hasMandat = mandate.values().any(func(m : Types.Mandat) : Bool {
          m.klientId == id
        });
        if (hasMandat) {
          return #err "Klient hat noch aktive Mandate. Bitte zuerst alle Mandate löschen.";
        };
        klienten.remove(id);
        #ok ();
      };
    };
  };

  public func createMandat(
    mandate : Map.Map<Common.MandatId, Types.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    klientId : Common.KlientId,
    bezeichnung : Text,
    akquisiteurId : Principal,
    akquisitionsbonus : Nat,
    mwstSatz : Nat,
    budget : Nat,
    rundungAktiv : Bool,
    auslagenregelung : Types.Auslagenregelung,
    pauschalBetrag : Nat,
    zahlungsbedingungen : Text,
    waehrung : Text,
    standardStundensatz : Nat,
    kostenProKopie : Float,
    kostenProScan : Float,
    portoAPost : Float,
    portoBPost : Float,
    portoEinschreiben : Float,
    autokilometer : Float,
    leistungenAusweisen : Bool,
  ) : Common.Result<Types.Mandat, Text> {
    let now = Time.now();
    let mandat : Types.Mandat = {
      id = "M-" # now.toText() # "-" # mandate.size().toText();
      klientId;
      kanzleiId = user.kanzleiId;
      bezeichnung;
      akquisiteurId;
      akquisitionsbonus;
      mwstSatz;
      budget;
      rundungAktiv;
      auslagenregelung;
      pauschalBetrag;
      zahlungsbedingungen;
      status = #aktiv;
      waehrung;
      standardStundensatz;
      kostenProKopie;
      kostenProScan;
      portoAPost;
      portoBPost;
      portoEinschreiben;
      autokilometer;
      leistungenAusweisen;
      createdAt = now;
    };
    mandate.add(mandat.id, mandat);
    #ok mandat;
  };

  public func updateMandat(
    mandate : Map.Map<Common.MandatId, Types.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.MandatId,
    bezeichnung : Text,
    akquisiteurId : Principal,
    akquisitionsbonus : Nat,
    mwstSatz : Nat,
    budget : Nat,
    rundungAktiv : Bool,
    auslagenregelung : Types.Auslagenregelung,
    pauschalBetrag : Nat,
    zahlungsbedingungen : Text,
    waehrung : Text,
    standardStundensatz : Nat,
    kostenProKopie : Float,
    kostenProScan : Float,
    portoAPost : Float,
    portoBPost : Float,
    portoEinschreiben : Float,
    autokilometer : Float,
    leistungenAusweisen : Bool,
  ) : Common.Result<Types.Mandat, Text> {
    switch (mandate.get(id)) {
      case null { #err "Mandat nicht gefunden" };
      case (?mandat) {
        if (mandat.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff";
        };
        let updated : Types.Mandat = {
          mandat with
          bezeichnung;
          akquisiteurId;
          akquisitionsbonus;
          mwstSatz;
          budget;
          rundungAktiv;
          auslagenregelung;
          pauschalBetrag;
          zahlungsbedingungen;
          waehrung;
          standardStundensatz;
          kostenProKopie;
          kostenProScan;
          portoAPost;
          portoBPost;
          portoEinschreiben;
          autokilometer;
          leistungenAusweisen;
        };
        mandate.add(id, updated);
        #ok updated;
      };
    };
  };

  public func getMandate(
    mandate : Map.Map<Common.MandatId, Types.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    klientId : ?Common.KlientId,
  ) : [Types.Mandat] {
    mandate.values()
      .filter(func(m : Types.Mandat) : Bool {
        if (m.kanzleiId != user.kanzleiId) { return false };
        switch (klientId) {
          case null { true };
          case (?kid) { m.klientId == kid };
        };
      })
      .toArray();
  };

  public func getMandat(
    mandate : Map.Map<Common.MandatId, Types.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.MandatId,
  ) : ?Types.Mandat {
    switch (mandate.get(id)) {
      case null { null };
      case (?mandat) {
        if (mandat.kanzleiId == user.kanzleiId) { ?mandat } else { null };
      };
    };
  };

  public func archivierMandat(
    mandate : Map.Map<Common.MandatId, Types.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.MandatId,
  ) : Common.Result<(), Text> {
    switch (mandate.get(id)) {
      case null { #err "Mandat nicht gefunden" };
      case (?mandat) {
        if (mandat.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff";
        };
        mandate.add(id, { mandat with status = #archiviert });
        #ok ();
      };
    };
  };

  public func deleteMandat(
    mandate : Map.Map<Common.MandatId, Types.Mandat>,
    user : KanzleiTypes.Leistungserbringer,
    id : Common.MandatId,
  ) : Common.Result<(), Text> {
    switch (mandate.get(id)) {
      case null { #err "Mandat nicht gefunden" };
      case (?mandat) {
        if (mandat.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff";
        };
        mandate.remove(id);
        #ok ();
      };
    };
  };
};
