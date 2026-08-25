import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import KlientenTypes "../types/klienten";
import LeistungenLib "../lib/leistungen";
import DatenschutzLib "../lib/datenschutz";
import DatenschutzTypes "../types/datenschutz";
import SuperAdminTypes "../types/super-admin";
import SecurityFixesLib "../lib/security-fixes";
import Types "../types/leistungen";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Nat "mo:core/Nat";

mixin (
  leistungen : Map.Map<Common.LeistungId, Types.Leistung>,
  auslagen : Map.Map<Common.AuslageId, Types.Auslage>,
  mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
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
  func requireUser2(caller : Principal) : KanzleiTypes.Leistungserbringer {
    SecurityFixesLib.requireActiveUserAndKanzlei(users, kanzleien, superAdminWhitelist, caller);
  };

  func kanzleiDefault(kanzleiId : Common.KanzleiId) : Nat {
    switch (kanzleien.get(kanzleiId)) {
      case (?k) k.defaultStundensatz;
      case null 0;
    };
  };

  func appendAuditEntryLeistungen(
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

  func logAccessLeistungen(
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

  // ─── Leistungen ─────────────────────────────────────────────────────────────

  public shared ({ caller }) func createLeistung(
    mandatId : Text,
    taetigkeit : Text,
    datum : Text,
    dauer : Nat,
  ) : async Common.Result<Types.Leistung, Text> {
    let user = requireUser2(caller);
    let defaultRate = kanzleiDefault(user.kanzleiId);
    let result = LeistungenLib.createLeistung(leistungen, mandate, user, mandatId, taetigkeit, datum, dauer, defaultRate);
    switch (result) {
      case (#ok l) {
        appendAuditEntryLeistungen(user, "create", "leistung", l.id, null, ?l.taetigkeit);
        logAccessLeistungen(user, "leistung", l.id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public shared ({ caller }) func updateLeistung(
    id : Text,
    taetigkeit : Text,
    dauer : Nat,
  ) : async Common.Result<Types.Leistung, Text> {
    let user = requireUser2(caller);
    let beforeTaetigkeit : ?Text = switch (leistungen.get(id)) {
      case (?l) ?l.taetigkeit;
      case null null;
    };
    let defaultRate = kanzleiDefault(user.kanzleiId);
    let result = LeistungenLib.updateLeistung(leistungen, mandate, user, id, taetigkeit, dauer, defaultRate);
    switch (result) {
      case (#ok l) {
        appendAuditEntryLeistungen(user, "update", "leistung", id, beforeTaetigkeit, ?l.taetigkeit);
        logAccessLeistungen(user, "leistung", id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public query ({ caller }) func getLeistungen(filter : Types.LeistungFilter) : async [Types.Leistung] {
    let user = requireUser2(caller);
    let result = LeistungenLib.getLeistungen(leistungen, user, filter);
    logAccessLeistungen(user, "leistung", "", #lesen);
    result;
  };

  public shared ({ caller }) func deleteLeistung(id : Text) : async Common.Result<(), Text> {
    let user = requireUser2(caller);
    let beforeTaetigkeit : ?Text = switch (leistungen.get(id)) {
      case (?l) ?l.taetigkeit;
      case null null;
    };
    let result = LeistungenLib.deleteLeistung(leistungen, user, id);
    switch (result) {
      case (#ok _) {
        appendAuditEntryLeistungen(user, "delete", "leistung", id, beforeTaetigkeit, null);
        logAccessLeistungen(user, "leistung", id, #loeschen);
      };
      case (#err _) {};
    };
    result;
  };

  // ─── Auslagen ───────────────────────────────────────────────────────────────

  public shared ({ caller }) func createAuslage(
    mandatId : Text,
    beschreibung : Text,
    kategorie : Types.AuslagenKategorie,
    betrag : Nat,
    datum : Text,
  ) : async Common.Result<Types.Auslage, Text> {
    let user = requireUser2(caller);
    let result = LeistungenLib.createAuslage(auslagen, mandate, user, mandatId, beschreibung, kategorie, betrag, datum);
    switch (result) {
      case (#ok a) {
        appendAuditEntryLeistungen(user, "create", "auslage", a.id, null, ?a.beschreibung);
        logAccessLeistungen(user, "auslage", a.id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public shared ({ caller }) func updateAuslage(
    id : Text,
    beschreibung : Text,
    betrag : Nat,
  ) : async Common.Result<Types.Auslage, Text> {
    let user = requireUser2(caller);
    let beforeBeschreibung : ?Text = switch (auslagen.get(id)) {
      case (?a) ?a.beschreibung;
      case null null;
    };
    let result = LeistungenLib.updateAuslage(auslagen, user, id, beschreibung, betrag);
    switch (result) {
      case (#ok a) {
        appendAuditEntryLeistungen(user, "update", "auslage", id, beforeBeschreibung, ?a.beschreibung);
        logAccessLeistungen(user, "auslage", id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public query ({ caller }) func getAuslagen(filter : Types.AuslagenFilter) : async [Types.Auslage] {
    let user = requireUser2(caller);
    let result = LeistungenLib.getAuslagen(auslagen, user, filter);
    logAccessLeistungen(user, "auslage", "", #lesen);
    result;
  };

  public shared ({ caller }) func deleteAuslage(id : Text) : async Common.Result<(), Text> {
    let user = requireUser2(caller);
    let beforeBeschreibung : ?Text = switch (auslagen.get(id)) {
      case (?a) ?a.beschreibung;
      case null null;
    };
    let result = LeistungenLib.deleteAuslage(auslagen, user, id);
    switch (result) {
      case (#ok _) {
        appendAuditEntryLeistungen(user, "delete", "auslage", id, beforeBeschreibung, null);
        logAccessLeistungen(user, "auslage", id, #loeschen);
      };
      case (#err _) {};
    };
    result;
  };
};
