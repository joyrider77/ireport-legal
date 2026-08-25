import Common "../types/common";
import KlientenTypes "../types/klienten";
import KanzleiTypes "../types/kanzlei";
import LeistungTypes "../types/leistungen";
import DatenschutzTypes "../types/datenschutz";
import SuperAdminTypes "../types/super-admin";
import Types "../types/rechnungen";
import RechnungenLib "../lib/rechnungen";
import DatenschutzLib "../lib/datenschutz";
import SecurityFixesLib "../lib/security-fixes";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Nat "mo:core/Nat";

mixin (
  rechnungen : Map.Map<Common.RechnungId, Types.Rechnung>,
  zahlungen : Map.Map<Common.ZahlungId, Types.Zahlung>,
  leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
  auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
  mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  rechnungsNummer : { var count : Nat },
  auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
  dataAccessLogs : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>,
  nextAuditId : { var count : Nat },
  nextDataAccessId : { var count : Nat },
) {
  // Zentraler Guard: prüft serverseitig den Benutzerstatus (status == "aktiv")
  // UND den Kanzleistatus (kanzlei.status == "aktiv"). Plattform-Admins
  // (superAdminWhitelist) umgehen beide Prüfungen. Trap bei deaktiviertem
  // Benutzer oder deaktivierter Kanzlei.
  func requireUserRechnungen(caller : Principal) : KanzleiTypes.Leistungserbringer {
    SecurityFixesLib.requireActiveUserAndKanzlei(users, kanzleien, superAdminWhitelist, caller);
  };
  func appendAuditEntryRechnungen(
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

  func logAccessRechnungen(
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

  // -----------------------------------------------------------------------
  // Rechnungen
  // -----------------------------------------------------------------------

  public shared ({ caller }) func createRechnung(
    mandatId : Text,
    leistungsIds : [Text],
    auslageIds : [Text],
    rechnungsdatum : Text,
    zahlungsbedingungen : Text,
    leistungszeitraumVon : Text,
    leistungszeitraumBis : Text,
  ) : async Common.Result<Types.Rechnung, Text> {
    let user = requireUserRechnungen(caller);

    // Determine mwstSatz and waehrung from mandat. Die Währung wird bei
    // Rechnungserstellung dauerhaft auf der Rechnung persistiert, sodass
    // spätere Änderungen der Mandatswährung historische Rechnungen nicht
    // verändern (Fix 12). Leere Mandatswährung → Default "CHF".
    //
    // Root Cause (hier korrekt, an anderer Stelle verhindert): Dieser Pfad
    // leitet die Währung bewusst NUR bei der Erstellung aus dem Mandat ab.
    // Würde ein Lese- oder Update-Pfad (getRechnung, updateZahlungsstatus,
    // addZahlung) dieselbe Ableitung wiederholen, würde eine spätere
    // Mandatsänderung die historische Rechnungswährung überschreiben. Alle
    // anderen Pfade in lib/rechnungen.mo verwenden ausschliesslich die
    // gespeicherte Rechnung.waehrung (mit "" → "CHF"-Normalisierung).
    let mwstSatz = switch (mandate.get(mandatId)) {
      case (?m) m.mwstSatz;
      case null return #err("Mandat nicht gefunden: " # mandatId);
    };
    let waehrung = switch (mandate.get(mandatId)) {
      case (?m) {
        if (m.waehrung == "") "CHF" else m.waehrung
      };
      case null "CHF";
    };

    let result = RechnungenLib.createRechnung(
      rechnungen, leistungen, auslagen,
      rechnungsNummer.count, user, mandatId,
      leistungsIds, auslageIds,
      rechnungsdatum, zahlungsbedingungen,
      leistungszeitraumVon, leistungszeitraumBis,
      mwstSatz,
      waehrung,
    );

    // Increment counter only on success
    switch (result) {
      case (#ok r) {
        rechnungsNummer.count += 1;
        appendAuditEntryRechnungen(user, "create", "rechnung", r.id, null, ?r.rechnungsnummer);
        logAccessRechnungen(user, "rechnung", r.id, #schreiben);
      };
      case (#err _) {};
    };

    result;
  };

  public query ({ caller }) func getRechnungen(filter : Types.RechnungFilter) : async [Types.Rechnung] {
    let user = requireUserRechnungen(caller);
    let result = RechnungenLib.getRechnungen(rechnungen, mandate, user, filter);
    logAccessRechnungen(user, "rechnung", "", #lesen);
    result;
  };

  public query ({ caller }) func getRechnung(id : Text) : async ?Types.Rechnung {
    let user = requireUserRechnungen(caller);
    let result = RechnungenLib.getRechnung(rechnungen, user, id);
    logAccessRechnungen(user, "rechnung", id, #lesen);
    result;
  };

  public shared ({ caller }) func updateZahlungsstatus(
    id : Text,
    status : Types.ZahlungsStatus,
  ) : async Common.Result<(), Text> {
    let user = requireUserRechnungen(caller);
    let beforeStatus : ?Text = switch (rechnungen.get(id)) {
      case (?r) ?(switch (r.zahlungsstatus) {
        case (#offen) "offen";
        case (#bezahlt) "bezahlt";
        case (#ueberfaellig) "ueberfaellig";
      });
      case null null;
    };
    let result = RechnungenLib.updateZahlungsstatus(rechnungen, user, id, status);
    switch (result) {
      case (#ok _) {
        let afterStatus = switch (status) {
          case (#offen) "offen";
          case (#bezahlt) "bezahlt";
          case (#ueberfaellig) "ueberfaellig";
        };
        appendAuditEntryRechnungen(user, "update", "rechnung", id, beforeStatus, ?afterStatus);
        logAccessRechnungen(user, "rechnung", id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  // -----------------------------------------------------------------------
  // Zahlungen
  // -----------------------------------------------------------------------

  public shared ({ caller }) func addZahlung(
    rechnungId : Text,
    datum : Text,
    betrag : Nat,
  ) : async Common.Result<Types.Zahlung, Text> {
    let user = requireUserRechnungen(caller);
    let result = RechnungenLib.addZahlung(zahlungen, rechnungen, user, rechnungId, datum, betrag);
    switch (result) {
      case (#ok z) {
        appendAuditEntryRechnungen(user, "create", "zahlung", z.id, null, ?z.id);
        logAccessRechnungen(user, "zahlung", z.id, #schreiben);
      };
      case (#err _) {};
    };
    result;
  };

  public query ({ caller }) func getZahlungen() : async [Types.Zahlung] {
    let user = requireUserRechnungen(caller);
    let result = RechnungenLib.getZahlungen(zahlungen, user);
    logAccessRechnungen(user, "zahlung", "", #lesen);
    result;
  };
};
