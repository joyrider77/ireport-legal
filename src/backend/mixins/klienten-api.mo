import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import DatenschutzTypes "../types/datenschutz";
import SuperAdminTypes "../types/super-admin";
import Types "../types/klienten";
import KlientenLib "../lib/klienten";
import DatenschutzLib "../lib/datenschutz";
import SecurityFixesLib "../lib/security-fixes";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Nat "mo:core/Nat";
import Text "mo:core/Text";

mixin (
  klienten : Map.Map<Common.KlientId, Types.Klient>,
  mandate : Map.Map<Common.MandatId, Types.Mandat>,
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
  dataAccessLogs : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>,
  nextAuditId : { var count : Nat },
  nextDataAccessId : { var count : Nat },
) {
  // Zentraler Guard: prüft serverseitig den Benutzerstatus (status == "aktiv")
  // UND den Kanzleistatus (kanzlei.status == "aktiv"). Plattform-Admins
  // (superAdminWhitelist) umgehen beide Prüfungen. Trap bei deaktiviertem
  // Benutzer oder deaktivierter Kanzlei.
  func requireUserKlienten(caller : Principal) : KanzleiTypes.Leistungserbringer {
    SecurityFixesLib.requireActiveUserAndKanzlei(users, kanzleien, superAdminWhitelist, caller);
  };

  func appendAuditEntryKlienten(
    user : KanzleiTypes.Leistungserbringer,
    action : Text,
    entityType : Text,
    entityId : Text,
    beforeValue : ?Text,
    afterValue : ?Text,
  ) : () {
    let id = "AUD-" # user.kanzleiId # "-" # nextAuditId.count.toText();
    let entry : DatenschutzTypes.AuditLogEntry = {
      id;
      kanzleiId = user.kanzleiId;
      actorPrincipal = user.id;
      action;
      entityType;
      entityId;
      timestamp = Time.now();
      beforeValue;
      afterValue;
    };
    DatenschutzLib.logAuditEntry(auditLogs, nextAuditId, entry);
  };

  func logAccessKlienten(
    user : KanzleiTypes.Leistungserbringer,
    dataType : Text,
    entityId : Text,
    action : DatenschutzTypes.DataAccessAction,
  ) : () {
    DatenschutzLib.logDataAccess(
      dataAccessLogs,
      nextDataAccessId,
      user.kanzleiId,
      user.id,
      dataType,
      entityId,
      action,
      Time.now(),
    );
  };

  public shared ({ caller }) func createKlient(
    name : Text,
    strasse : Text,
    plzOrt : Text,
    telefon : Text,
    email : Text,
  ) : async Common.Result<Types.Klient, Text> {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.createKlient(klienten, user, name, strasse, plzOrt, telefon, email);
    switch (result) {
      case (#ok k) {
        appendAuditEntryKlienten(user, "create", "klient", k.id, null, ?k.name);
        logAccessKlienten(user, "klient", k.id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public shared ({ caller }) func updateKlient(
    id : Text,
    name : Text,
    strasse : Text,
    plzOrt : Text,
    telefon : Text,
    email : Text,
  ) : async Common.Result<Types.Klient, Text> {
    let user = requireUserKlienten(caller);
    let beforeName : ?Text = switch (klienten.get(id)) {
      case (?k) ?k.name;
      case null null;
    };
    let result = KlientenLib.updateKlient(klienten, user, id, name, strasse, plzOrt, telefon, email);
    switch (result) {
      case (#ok k) {
        appendAuditEntryKlienten(user, "update", "klient", id, beforeName, ?k.name);
        logAccessKlienten(user, "klient", id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public query ({ caller }) func getKlienten() : async [Types.Klient] {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.getKlienten(klienten, user);
    logAccessKlienten(user, "klient", "", #lesen);
    result;
  };

  public query ({ caller }) func getKlient(id : Text) : async ?Types.Klient {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.getKlient(klienten, user, id);
    logAccessKlienten(user, "klient", id, #lesen);
    result;
  };

  public shared ({ caller }) func deleteKlient(id : Text) : async Common.Result<(), Text> {
    let user = requireUserKlienten(caller);
    let before = klienten.get(id);
    let result = KlientenLib.deleteKlient(klienten, mandate, user, id);
    switch (result) {
      case (#ok _) {
        appendAuditEntryKlienten(user, "delete", "klient", id, ?(switch (before) { case (?k) k.name; case null "" }), null);
        logAccessKlienten(user, "klient", id, #loeschen);
      };
      case (#err _) {};
    };
    result;
  };

  public shared ({ caller }) func createMandat(
    klientId : Text,
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
  ) : async Common.Result<Types.Mandat, Text> {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.createMandat(
      mandate, user, klientId, bezeichnung, akquisiteurId,
      akquisitionsbonus, mwstSatz, budget, rundungAktiv,
      auslagenregelung, pauschalBetrag, zahlungsbedingungen, waehrung,
      standardStundensatz, kostenProKopie, kostenProScan,
      portoAPost, portoBPost, portoEinschreiben, autokilometer,
      leistungenAusweisen,
    );
    switch (result) {
      case (#ok m) {
        appendAuditEntryKlienten(user, "create", "mandat", m.id, null, ?m.bezeichnung);
        logAccessKlienten(user, "mandat", m.id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public shared ({ caller }) func updateMandat(
    id : Text,
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
  ) : async Common.Result<Types.Mandat, Text> {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.updateMandat(
      mandate, user, id, bezeichnung, akquisiteurId,
      akquisitionsbonus, mwstSatz, budget, rundungAktiv,
      auslagenregelung, pauschalBetrag, zahlungsbedingungen, waehrung,
      standardStundensatz, kostenProKopie, kostenProScan,
      portoAPost, portoBPost, portoEinschreiben, autokilometer,
      leistungenAusweisen,
    );
    switch (result) {
      case (#ok m) {
        appendAuditEntryKlienten(user, "update", "mandat", id, null, ?m.bezeichnung);
        logAccessKlienten(user, "mandat", id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public query ({ caller }) func getMandate(klientId : ?Text) : async [Types.Mandat] {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.getMandate(mandate, user, klientId);
    logAccessKlienten(user, "mandat", "", #lesen);
    result;
  };

  public query ({ caller }) func getMandat(id : Text) : async ?Types.Mandat {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.getMandat(mandate, user, id);
    logAccessKlienten(user, "mandat", id, #lesen);
    result;
  };

  public shared ({ caller }) func archivierMandat(id : Text) : async Common.Result<(), Text> {
    let user = requireUserKlienten(caller);
    let result = KlientenLib.archivierMandat(mandate, user, id);
    switch (result) {
      case (#ok _) {
        appendAuditEntryKlienten(user, "archive", "mandat", id, null, ?"archiviert");
        logAccessKlienten(user, "mandat", id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public shared ({ caller }) func deleteMandat(id : Text) : async Common.Result<(), Text> {
    let user = requireUserKlienten(caller);
    let before = mandate.get(id);
    let result = KlientenLib.deleteMandat(mandate, user, id);
    switch (result) {
      case (#ok _) {
        appendAuditEntryKlienten(user, "delete", "mandat", id, ?(switch (before) { case (?m) m.bezeichnung; case null "" }), null);
        logAccessKlienten(user, "mandat", id, #loeschen);
      };
      case (#err _) {};
    };
    result;
  };
};
