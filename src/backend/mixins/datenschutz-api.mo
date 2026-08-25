import Common "../types/common";
import DatenschutzTypes "../types/datenschutz";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import DatenschutzLib "../lib/datenschutz";
import SecurityFixesLib "../lib/security-fixes";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Text "mo:core/Text";

mixin (
  auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
  consentRecords : Map.Map<Common.ConsentId, DatenschutzTypes.ConsentRecord>,
  dsrRequests : Map.Map<Common.DsrId, DatenschutzTypes.DsrRequest>,
  retentionPolicies : Map.Map<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>,
  dataAccessLogs : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>,
  dataInventory : Map.Map<Common.DataInventoryId, DatenschutzTypes.DataInventoryEntry>,
  dataFlows : Map.Map<Common.DataFlowId, DatenschutzTypes.DataFlowEntry>,
  dsgVersion : { var value : ?DatenschutzTypes.DsgVersion },
  nextAuditId : { var count : Nat },
  nextConsentId : { var count : Nat },
  nextDsrId : { var count : Nat },
  nextDataAccessId : { var count : Nat },
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
) {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  // Zentraler Guard: prüft serverseitig den Benutzerstatus (status == "aktiv")
  // UND den Kanzleistatus (kanzlei.status == "aktiv"). Plattform-Admins
  // (superAdminWhitelist) umgehen beide Prüfungen. Trap bei deaktiviertem
  // Benutzer oder deaktivierter Kanzlei.
  func requireUserDatenschutz(caller : Principal) : KanzleiTypes.Leistungserbringer {
    SecurityFixesLib.requireActiveUserAndKanzlei(users, kanzleien, superAdminWhitelist, caller);
  };

  // ─── RBAC helpers ───────────────────────────────────────────────────────────

  func requireAdmin(caller : Principal) : KanzleiTypes.Leistungserbringer {
    let user = requireUserDatenschutz(caller);
    let role = DatenschutzLib.deriveRole(user.isAdmin, user.role);
    switch (role) {
      case (#admin) user;
      case (#plattform_admin) user;
      case (_) Runtime.trap("Nur Administratoren dürfen diese Aktion ausführen");
    };
  };

  func requireAnwaltOrAdmin(caller : Principal) : KanzleiTypes.Leistungserbringer {
    let user = requireUserDatenschutz(caller);
    let role = DatenschutzLib.deriveRole(user.isAdmin, user.role);
    switch (role) {
      case (#admin) user;
      case (#plattform_admin) user;
      case (#anwalt) user;
      case (_) Runtime.trap("Nur Anwälte oder Administratoren dürfen diese Aktion ausführen");
    };
  };

  // ─── Audit-Trail-Helper (intern) ────────────────────────────────────────────

  func appendAuditEntryDatenschutz(
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

  // ─── Seeding: Standard-Datenschutzdaten beim ersten Zugriff ─────────────────

  func seedRetentionPolicies(kanzleiId : Common.KanzleiId) : () {
    let existing = DatenschutzLib.getRetentionPolicies(retentionPolicies, kanzleiId);
    if (existing.size() > 0) { return };
    // Standard: 10 Jahre für Anwaltsdokumente gemäss OR 953a
    let now = Time.now();
    let defaultPolicies : [(Text, Nat, ?Text, Bool)] = [
      ("Anwaltsdokumente", 10, ?"OR 953a — Aufbewahrungspflicht 10 Jahre", true),
      ("Mandantenstammdaten", 10, ?"OR 953a — Aufbewahrungspflicht 10 Jahre", true),
      ("Mitarbeiterdaten", 10, ?"OR 953a — Aufbewahrungspflicht 10 Jahre", true),
      ("Rechnungen", 10, ?"OR 953a — Aufbewahrungspflicht 10 Jahre", true),
      ("Leistungen", 10, ?"OR 953a — Aufbewahrungspflicht 10 Jahre", true),
      ("Audit-Logs", 10, ?"revDSG — Nachweispflicht", true),
    ];
    for ((categoryName, retentionYears, legalBasis, isLocked) in defaultPolicies.vals()) {
      let id = "RET-" # kanzleiId # "-" # nextAuditId.count.toText();
      let policy : DatenschutzTypes.RetentionPolicy = {
        id;
        kanzleiId;
        categoryName;
        retentionYears;
        legalBasis;
        isLocked;
        createdAt = now;
        updatedAt = now;
      };
      retentionPolicies.add(id, policy);
    };
  };

  func seedDataInventory(kanzleiId : Common.KanzleiId) : () {
    let existing = DatenschutzLib.getDataInventory(dataInventory, kanzleiId);
    if (existing.size() > 0) { return };
    let defaultEntries : [(Text, Text, Text, KanzleiTypes.Role, ?Text)] = [
      ("Mandantenstammdaten", "Canister (ICP)", "10 Jahre (OR 953a)", #anwalt, ?"Stammdaten der Mandanten"),
      ("Mitarbeiterdaten", "Canister (ICP)", "10 Jahre (OR 953a)", #admin, ?"Daten der Leistungserbringer"),
      ("Dokumente", "Caffeine File Storage", "10 Jahre (OR 953a)", #anwalt, ?"Hochgeladene Mandatsdokumente"),
      ("Unterschriften", "Canister (ICP)", "10 Jahre (OR 953a)", #anwalt, ?"Digitale Unterschriften"),
      ("Zeitstempel", "Canister (ICP)", "10 Jahre (OR 953a)", #mitarbeiter, ?"Leistungs- und Audit-Zeitstempel"),
      ("Audit-Logs", "Canister (ICP)", "10 Jahre (revDSG)", #admin, ?"Unveränderliche Audit-Trail-Einträge"),
    ];
    for ((categoryName, storageLocation, storageDuration, accessRole, description) in defaultEntries.vals()) {
      let id = "INV-" # kanzleiId # "-" # nextAuditId.count.toText();
      let entry : DatenschutzTypes.DataInventoryEntry = {
        id;
        kanzleiId;
        categoryName;
        storageLocation;
        storageDuration;
        accessRole;
        description;
      };
      dataInventory.add(id, entry);
    };
  };

  func seedDataFlows(kanzleiId : Common.KanzleiId) : () {
    let existing = DatenschutzLib.getDataFlows(dataFlows, kanzleiId);
    if (existing.size() > 0) { return };
    let defaultFlows : [(Text, Text, Text, Text, Text, Bool)] = [
      ("App-Speicher (intern)", "Mandantendaten", "Canister (ICP)", "Verarbeitung der Mandatsdaten", "revDSG Art. 5 — Zweckbindung", false),
      ("OpenAI (potenziell)", "Textanalyse", "OpenAI API", "KI-gestützte Textanalyse (derzeit nicht aktiv)", "Art. 6 Abs. 1 revDSG — derzeit nicht aktiv", true),
      ("Bexio (potenziell)", "Buchhaltungsdaten", "Bexio API", "Buchhaltung (derzeit nicht aktiv)", "Art. 6 Abs. 1 revDSG — derzeit nicht aktiv", true),
      ("E-Mail-Versand (potenziell)", "Benachrichtigungen", "SMTP", "E-Mail-Versand (derzeit nicht aktiv)", "Art. 6 Abs. 1 revDSG — derzeit nicht aktiv", true),
      ("Caffeine File Storage (potenziell)", "Dokumente", "Caffeine File Storage", "Dokumentenspeicherung (derzeit nicht aktiv)", "Art. 6 Abs. 1 revDSG — derzeit nicht aktiv", true),
    ];
    for ((flowName, what, destination, purpose, legalBasis, isExternal) in defaultFlows.vals()) {
      let id = "FLOW-" # kanzleiId # "-" # nextAuditId.count.toText();
      let entry : DatenschutzTypes.DataFlowEntry = {
        id;
        kanzleiId;
        flowName;
        what;
        destination;
        purpose;
        legalBasis;
        isExternal;
      };
      dataFlows.add(id, entry);
    };
  };

  // ─── Audit-Trail ────────────────────────────────────────────────────────────

  public query ({ caller }) func getAuditTrail(filter : DatenschutzTypes.AuditTrailFilter) : async [DatenschutzTypes.AuditLogEntry] {
    let user = requireUserDatenschutz(caller);
    // Enforce kanzleiId isolation: caller's kanzleiId must match filter.kanzleiId
    if (user.kanzleiId != filter.kanzleiId) {
      return [];
    };
    DatenschutzLib.getAuditTrail(auditLogs, filter);
  };

  public query ({ caller }) func exportAuditTrailCsv(filter : DatenschutzTypes.AuditTrailFilter) : async Text {
    let user = requireAdmin(caller);
    if (user.kanzleiId != filter.kanzleiId) {
      return "";
    };
    let csv = DatenschutzLib.exportAuditTrailCsv(auditLogs, filter);
    // Log the export operation to the audit trail
    appendAuditEntryDatenschutz(user, "export", "auditTrail", filter.kanzleiId, null, ?csv);
    csv;
  };

  public query ({ caller }) func exportAuditTrailPdf(filter : DatenschutzTypes.AuditTrailFilter) : async Blob {
    let user = requireAdmin(caller);
    if (user.kanzleiId != filter.kanzleiId) {
      return Text.encodeUtf8("");
    };
    let blob = DatenschutzLib.exportAuditTrailPdf(auditLogs, filter);
    appendAuditEntryDatenschutz(user, "export", "auditTrail", filter.kanzleiId, null, ?"PDF-Export");
    blob;
  };

  public shared ({ caller }) func logAuditEntry(
    action : Text,
    entityType : Text,
    entityId : Text,
    beforeValue : ?Text,
    afterValue : ?Text,
  ) : async () {
    let user = requireUserDatenschutz(caller);
    appendAuditEntryDatenschutz(user, action, entityType, entityId, beforeValue, afterValue);
  };

  // ─── Einwilligung (Consent) ─────────────────────────────────────────────────

  public query ({ caller }) func getConsentRecords(kanzleiId : Common.KanzleiId) : async [DatenschutzTypes.ConsentRecord] {
    let user = requireUserDatenschutz(caller);
    if (user.kanzleiId != kanzleiId) {
      return [];
    };
    DatenschutzLib.getConsentRecords(consentRecords, kanzleiId);
  };

  public shared ({ caller }) func recordConsent(klientId : Common.KlientId, dsgVersion : Text) : async DatenschutzTypes.ConsentRecord {
    let user = requireUserDatenschutz(caller);
    let record = DatenschutzLib.recordConsent(
      consentRecords,
      nextConsentId,
      user.kanzleiId,
      klientId,
      dsgVersion,
      user.id,
    );
    appendAuditEntryDatenschutz(user, "create", "consent", record.id, null, ?dsgVersion);
    record;
  };

  // ─── DSR-Anträge ────────────────────────────────────────────────────────────

  public query ({ caller }) func getDsrRequests(kanzleiId : Common.KanzleiId) : async [DatenschutzTypes.DsrRequest] {
    let user = requireUserDatenschutz(caller);
    if (user.kanzleiId != kanzleiId) {
      return [];
    };
    DatenschutzLib.getDsrRequests(dsrRequests, kanzleiId);
  };

  public shared ({ caller }) func createDsrRequest(req : DatenschutzTypes.DsrRequest) : async DatenschutzTypes.DsrRequest {
    // Admin-only
    let user = requireAdmin(caller);
    // Enforce kanzleiId isolation: caller's kanzleiId must match req.kanzleiId
    if (user.kanzleiId != req.kanzleiId) {
      Runtime.trap("Kein Zugriff auf diese Kanzlei");
    };
    let created = DatenschutzLib.createDsrRequest(dsrRequests, nextDsrId, req);
    appendAuditEntryDatenschutz(user, "create", "dsrRequest", created.id, null, ?"DSR-Antrag erfasst");
    created;
  };

  public shared ({ caller }) func updateDsrRequest(
    id : Common.DsrId,
    status : DatenschutzTypes.DsrStatus,
    notes : ?Text,
  ) : async Common.Result<DatenschutzTypes.DsrRequest, Text> {
    // Admin-only
    let user = requireAdmin(caller);
    // Verify kanzleiId isolation before update
    switch (dsrRequests.get(id)) {
      case null { return #err "DSR-Antrag nicht gefunden" };
      case (?existing) {
        if (existing.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff auf diesen DSR-Antrag";
        };
      };
    };
    let result = DatenschutzLib.updateDsrRequest(dsrRequests, id, status, notes);
    switch (result) {
      case (#ok updated) {
        appendAuditEntryDatenschutz(user, "update", "dsrRequest", id, null, ?"DSR-Status aktualisiert");
      };
      case (#err _) {};
    };
    result;
  };

  // ─── Aufbewahrungsrichtlinien ───────────────────────────────────────────────

  public query ({ caller }) func getRetentionPolicies(kanzleiId : Common.KanzleiId) : async [DatenschutzTypes.RetentionPolicy] {
    let user = requireUserDatenschutz(caller);
    if (user.kanzleiId != kanzleiId) {
      return [];
    };
    // Seed defaults on first access
    seedRetentionPolicies(kanzleiId);
    DatenschutzLib.getRetentionPolicies(retentionPolicies, kanzleiId);
  };

  public shared ({ caller }) func updateRetentionPolicy(
    id : Common.RetentionPolicyId,
    retentionYears : Nat,
    isLocked : Bool,
  ) : async Common.Result<DatenschutzTypes.RetentionPolicy, Text> {
    // Admin-only
    let user = requireAdmin(caller);
    // Verify kanzleiId isolation
    switch (retentionPolicies.get(id)) {
      case null { return #err "Aufbewahrungsrichtlinie nicht gefunden" };
      case (?existing) {
        if (existing.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff auf diese Richtlinie";
        };
      };
    };
    let result = DatenschutzLib.updateRetentionPolicy(retentionPolicies, id, retentionYears, isLocked);
    switch (result) {
      case (#ok updated) {
        appendAuditEntryDatenschutz(user, "update", "retentionPolicy", id, null, ?("retentionYears=" # retentionYears.toText()));
      };
      case (#err _) {};
    };
    result;
  };

  // ─── Fällige Löschungen (manuelle Ausführung) ───────────────────────────────

  public query ({ caller }) func getPendingDeletions(kanzleiId : Common.KanzleiId) : async [(Text, Text, Nat)] {
    let user = requireUserDatenschutz(caller);
    if (user.kanzleiId != kanzleiId) {
      return [];
    };
    DatenschutzLib.getPendingDeletions(retentionPolicies, kanzleiId, Time.now());
  };

  public shared ({ caller }) func executeDeletion(categoryName : Text, entityId : Text) : async Common.Result<(), Text> {
    // Admin-only
    let user = requireAdmin(caller);
    let result = DatenschutzLib.executeDeletion(categoryName, entityId);
    switch (result) {
      case (#ok _) {
        appendAuditEntryDatenschutz(user, "delete", categoryName, entityId, null, ?"Manuelle Löschung durchgeführt");
      };
      case (#err _) {};
    };
    result;
  };

  // ─── Dateninventar ──────────────────────────────────────────────────────────

  public query ({ caller }) func getDataInventory(kanzleiId : Common.KanzleiId) : async [DatenschutzTypes.DataInventoryEntry] {
    let user = requireUserDatenschutz(caller);
    if (user.kanzleiId != kanzleiId) {
      return [];
    };
    // Seed defaults on first access
    seedDataInventory(kanzleiId);
    DatenschutzLib.getDataInventory(dataInventory, kanzleiId);
  };

  public shared ({ caller }) func updateDataInventoryEntry(
    id : Common.DataInventoryId,
    entry : DatenschutzTypes.DataInventoryEntry,
  ) : async Common.Result<DatenschutzTypes.DataInventoryEntry, Text> {
    // Admin-only
    let user = requireAdmin(caller);
    // Verify kanzleiId isolation
    switch (dataInventory.get(id)) {
      case null { return #err "Inventareintrag nicht gefunden" };
      case (?existing) {
        if (existing.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff auf diesen Inventareintrag";
        };
      };
    };
    let result = DatenschutzLib.updateDataInventoryEntry(dataInventory, id, entry);
    switch (result) {
      case (#ok updated) {
        appendAuditEntryDatenschutz(user, "update", "dataInventory", id, null, ?updated.categoryName);
      };
      case (#err _) {};
    };
    result;
  };

  // ─── Datenflüsse ────────────────────────────────────────────────────────────

  public query ({ caller }) func getDataFlows(kanzleiId : Common.KanzleiId) : async [DatenschutzTypes.DataFlowEntry] {
    let user = requireUserDatenschutz(caller);
    if (user.kanzleiId != kanzleiId) {
      return [];
    };
    // Seed defaults on first access
    seedDataFlows(kanzleiId);
    DatenschutzLib.getDataFlows(dataFlows, kanzleiId);
  };

  public shared ({ caller }) func updateDataFlowEntry(
    id : Common.DataFlowId,
    entry : DatenschutzTypes.DataFlowEntry,
  ) : async Common.Result<DatenschutzTypes.DataFlowEntry, Text> {
    // Admin-only
    let user = requireAdmin(caller);
    // Verify kanzleiId isolation
    switch (dataFlows.get(id)) {
      case null { return #err "Datenfluss-Eintrag nicht gefunden" };
      case (?existing) {
        if (existing.kanzleiId != user.kanzleiId) {
          return #err "Kein Zugriff auf diesen Datenfluss-Eintrag";
        };
      };
    };
    let result = DatenschutzLib.updateDataFlowEntry(dataFlows, id, entry);
    switch (result) {
      case (#ok updated) {
        appendAuditEntryDatenschutz(user, "update", "dataFlow", id, null, ?updated.flowName);
      };
      case (#err _) {};
    };
    result;
  };

  // ─── DSG-Version ────────────────────────────────────────────────────────────

  public query ({ caller }) func getDsgVersion() : async ?DatenschutzTypes.DsgVersion {
    let _user = requireUserDatenschutz(caller);
    DatenschutzLib.getDsgVersion(dsgVersion.value);
  };

  public shared ({ caller }) func updateDsgVersion(version : Text, content : ?Text) : async DatenschutzTypes.DsgVersion {
    // Admin-only
    let user = requireAdmin(caller);
    let now = Time.now();
    let updated = DatenschutzLib.updateDsgVersion(dsgVersion, version, content, now);
    appendAuditEntryDatenschutz(user, "update", "dsgVersion", version, null, ?version);
    updated;
  };

  // ─── Datenschutz-Dashboard ──────────────────────────────────────────────────

  public query ({ caller }) func getDashboardStats(kanzleiId : Common.KanzleiId) : async DatenschutzTypes.DashboardStats {
    // Admin-only
    let user = requireAdmin(caller);
    if (user.kanzleiId != kanzleiId) {
      return {
        totalRecordsByCategory = [];
        pendingDeletions = 0;
        openDsrRequests = 0;
        auditExports = 0;
        missingConsents = 0;
      };
    };
    // Seed defaults so dashboard reflects standard policies
    seedRetentionPolicies(kanzleiId);
    seedDataInventory(kanzleiId);
    seedDataFlows(kanzleiId);
    DatenschutzLib.getDashboardStats(
      auditLogs,
      consentRecords,
      dsrRequests,
      retentionPolicies,
      kanzleiId,
      Time.now(),
    );
  };

  // ─── Zugriffskontrolle: Zugriffsprotokollierung ─────────────────────────────

  public shared ({ caller }) func logDataAccess(
    dataType : Text,
    entityId : Text,
    action : DatenschutzTypes.DataAccessAction,
  ) : async () {
    let user = requireUserDatenschutz(caller);
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
};
