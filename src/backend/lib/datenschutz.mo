import Common "../types/common";
import DatenschutzTypes "../types/datenschutz";
import KanzleiTypes "../types/kanzlei";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Blob "mo:core/Blob";
import Array "mo:core/Array";
import Iter "mo:core/Iter";

module {
  // ─── Helpers ───────────────────────────────────────────────────────────────

  /// Convert nanoseconds to years (approximate, 365.25 days — leap-year corrected)
  func nanosToYears(nanos : Int) : Nat {
    let seconds = nanos / 1_000_000_000;
    let days = seconds / 86_400;
    // 365.25 days/year → multiply by 100 then divide by 36525 to keep integer math
    Int.abs((days * 100) / 36_525);
  };

  /// Escape a Text value for CSV (wrap in quotes if it contains comma, quote, or newline)
  func csvEscape(value : Text) : Text {
    if (value.contains(#text ",") or value.contains(#text "\"") or value.contains(#text "\n")) {
      let escaped = value.replace(#text "\"", "\"\"");
      "\"" # escaped # "\"";
    } else {
      value;
    };
  };

  /// Format an optional Text for CSV
  func csvOpt(value : ?Text) : Text {
    switch (value) {
      case (?v) csvEscape(v);
      case null "";
    };
  };

  /// Format a Principal for CSV
  func csvPrincipal(p : Principal) : Text {
    csvEscape(p.toText());
  };

  /// Format a Timestamp for CSV
  func csvTimestamp(t : Common.Timestamp) : Text {
    csvEscape(t.toText());
  };

  /// Format a Role for CSV
  func roleToText(role : KanzleiTypes.Role) : Text {
    switch (role) {
      case (#plattform_admin) "plattform_admin";
      case (#admin) "admin";
      case (#anwalt) "anwalt";
      case (#mitarbeiter) "mitarbeiter";
      case (#mandant) "mandant";
    };
  };

  /// Format a DsrType for Text
  func dsrTypeToText(t : DatenschutzTypes.DsrType) : Text {
    switch (t) {
      case (#auskunft) "auskunft";
      case (#berichtigung) "berichtigung";
      case (#loeschung) "loeschung";
    };
  };

  /// Format a DsrStatus for Text
  func dsrStatusToText(s : DatenschutzTypes.DsrStatus) : Text {
    switch (s) {
      case (#erfasst) "erfasst";
      case (#inBearbeitung) "inBearbeitung";
      case (#abgeschlossen) "abgeschlossen";
    };
  };

  /// Format a DataAccessAction for Text
  func dataAccessActionToText(a : DatenschutzTypes.DataAccessAction) : Text {
    switch (a) {
      case (#lesen) "lesen";
      case (#schreiben) "schreiben";
      case (#loeschen) "loeschen";
    };
  };

  // ─── Audit-Trail ───────────────────────────────────────────────────────────

  public func getAuditTrail(
    auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
    filter : DatenschutzTypes.AuditTrailFilter,
  ) : [DatenschutzTypes.AuditLogEntry] {
    auditLogs.values()
      .filter(func(entry : DatenschutzTypes.AuditLogEntry) : Bool {
        // kanzleiId isolation
        if (entry.kanzleiId != filter.kanzleiId) return false;
        // entityType filter
        switch (filter.entityType) {
          case (?t) if (entry.entityType != t) return false;
          case null {};
        };
        // entityId filter
        switch (filter.entityId) {
          case (?id) if (entry.entityId != id) return false;
          case null {};
        };
        // actorPrincipal filter
        switch (filter.actorPrincipal) {
          case (?p) if (not Principal.equal(entry.actorPrincipal, p)) return false;
          case null {};
        };
        // fromTimestamp filter
        switch (filter.fromTimestamp) {
          case (?from) if (entry.timestamp < from) return false;
          case null {};
        };
        // toTimestamp filter
        switch (filter.toTimestamp) {
          case (?to) if (entry.timestamp > to) return false;
          case null {};
        };
        true;
      })
      .toArray();
  };

  public func exportAuditTrailCsv(
    auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
    filter : DatenschutzTypes.AuditTrailFilter,
  ) : Text {
    let entries = getAuditTrail(auditLogs, filter);
    let header = "id,kanzleiId,actorPrincipal,action,entityType,entityId,timestamp,beforeValue,afterValue";
    let rows = entries.map(
      func(e : DatenschutzTypes.AuditLogEntry) : Text {
        csvEscape(e.id) # "," #
        csvEscape(e.kanzleiId) # "," #
        csvPrincipal(e.actorPrincipal) # "," #
        csvEscape(e.action) # "," #
        csvEscape(e.entityType) # "," #
        csvEscape(e.entityId) # "," #
        csvTimestamp(e.timestamp) # "," #
        csvOpt(e.beforeValue) # "," #
        csvOpt(e.afterValue);
      },
    );
    let allLines = [header].concat(rows);
    Iter.fromArray(allLines).join("\n");
  };

  public func exportAuditTrailPdf(
    auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
    filter : DatenschutzTypes.AuditTrailFilter,
  ) : Blob {
    // Simple text-based PDF: minimal valid PDF structure with the CSV content as text
    let csvContent = exportAuditTrailCsv(auditLogs, filter);
    let pdfText = "%PDF-1.4\n" #
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" #
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" #
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n" #
      "4 0 obj\n<< /Length " # csvContent.size().toText() # " >>\nstream\n" #
      csvContent # "\nendstream\nendobj\n" #
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n" #
      "trailer\n<< /Root 1 0 R >>\n%%EOF";
    pdfText.encodeUtf8();
  };

  public func logAuditEntry(
    auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
    nextAuditId : { var count : Nat },
    entry : DatenschutzTypes.AuditLogEntry,
  ) : () {
    // Append-only: never mutate or delete existing entries
    auditLogs.add(entry.id, entry);
    nextAuditId.count += 1;
  };

  // ─── Einwilligung (Consent) ─────────────────────────────────────────────────

  public func getConsentRecords(
    consentRecords : Map.Map<Common.ConsentId, DatenschutzTypes.ConsentRecord>,
    kanzleiId : Common.KanzleiId,
  ) : [DatenschutzTypes.ConsentRecord] {
    consentRecords.values()
      .filter(func(c : DatenschutzTypes.ConsentRecord) : Bool {
        c.kanzleiId == kanzleiId;
      })
      .toArray();
  };

  public func recordConsent(
    consentRecords : Map.Map<Common.ConsentId, DatenschutzTypes.ConsentRecord>,
    nextConsentId : { var count : Nat },
    kanzleiId : Common.KanzleiId,
    klientId : Common.KlientId,
    dsgVersion : Text,
    actorPrincipal : Principal,
  ) : DatenschutzTypes.ConsentRecord {
    let now = Time.now();
    let id = "CON-" # kanzleiId # "-" # nextConsentId.count.toText();
    let record : DatenschutzTypes.ConsentRecord = {
      id;
      kanzleiId;
      klientId;
      consentGiven = true;
      timestamp = now;
      dsgVersion;
      principal = actorPrincipal;
    };
    consentRecords.add(id, record);
    nextConsentId.count += 1;
    record;
  };

  // ─── DSR-Anträge ───────────────────────────────────────────────────────────

  public func getDsrRequests(
    dsrRequests : Map.Map<Common.DsrId, DatenschutzTypes.DsrRequest>,
    kanzleiId : Common.KanzleiId,
  ) : [DatenschutzTypes.DsrRequest] {
    dsrRequests.values()
      .filter(func(r : DatenschutzTypes.DsrRequest) : Bool {
        r.kanzleiId == kanzleiId;
      })
      .toArray();
  };

  public func createDsrRequest(
    dsrRequests : Map.Map<Common.DsrId, DatenschutzTypes.DsrRequest>,
    nextDsrId : { var count : Nat },
    req : DatenschutzTypes.DsrRequest,
  ) : DatenschutzTypes.DsrRequest {
    // Force status to #erfasst on creation
    let now = Time.now();
    let created : DatenschutzTypes.DsrRequest = {
      req with
      id = "DSR-" # req.kanzleiId # "-" # nextDsrId.count.toText();
      status = #erfasst;
      createdAt = now;
      updatedAt = now;
      completedAt = null;
    };
    dsrRequests.add(created.id, created);
    nextDsrId.count += 1;
    created;
  };

  public func updateDsrRequest(
    dsrRequests : Map.Map<Common.DsrId, DatenschutzTypes.DsrRequest>,
    id : Common.DsrId,
    status : DatenschutzTypes.DsrStatus,
    notes : ?Text,
  ) : Common.Result<DatenschutzTypes.DsrRequest, Text> {
    switch (dsrRequests.get(id)) {
      case null { #err "DSR-Antrag nicht gefunden" };
      case (?req) {
        // Validate status transition: #erfasst -> #inBearbeitung -> #abgeschlossen
        let valid = switch (req.status, status) {
          case (#erfasst, #inBearbeitung) true;
          case (#inBearbeitung, #abgeschlossen) true;
          case (#erfasst, #erfasst) true;
          case (#inBearbeitung, #inBearbeitung) true;
          case (#abgeschlossen, #abgeschlossen) true;
          case (_) false;
        };
        if (not valid) {
          return #err "Ungültiger Statusübergang";
        };
        let now = Time.now();
        let completedAt : ?Common.Timestamp = switch (status) {
          case (#abgeschlossen) ?now;
          case (_) req.completedAt;
        };
        let updated : DatenschutzTypes.DsrRequest = {
          req with
          status;
          notes;
          updatedAt = now;
          completedAt;
        };
        dsrRequests.add(id, updated);
        #ok updated;
      };
    };
  };

  // ─── Aufbewahrungsrichtlinien (RetentionPolicy) ─────────────────────────────

  public func getRetentionPolicies(
    retentionPolicies : Map.Map<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>,
    kanzleiId : Common.KanzleiId,
  ) : [DatenschutzTypes.RetentionPolicy] {
    retentionPolicies.values()
      .filter(func(p : DatenschutzTypes.RetentionPolicy) : Bool {
        p.kanzleiId == kanzleiId;
      })
      .toArray();
  };

  public func updateRetentionPolicy(
    retentionPolicies : Map.Map<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>,
    id : Common.RetentionPolicyId,
    retentionYears : Nat,
    isLocked : Bool,
  ) : Common.Result<DatenschutzTypes.RetentionPolicy, Text> {
    switch (retentionPolicies.get(id)) {
      case null { #err "Aufbewahrungsrichtlinie nicht gefunden" };
      case (?policy) {
        // Locked policies cannot be modified (legal hold)
        if (policy.isLocked) {
          return #err "Aufbewahrungsrichtlinie ist gesperrt (gesetzliche Aufbewahrungspflicht)";
        };
        let now = Time.now();
        let updated : DatenschutzTypes.RetentionPolicy = {
          policy with
          retentionYears;
          isLocked;
          updatedAt = now;
        };
        retentionPolicies.add(id, updated);
        #ok updated;
      };
    };
  };

  // ─── Fällige Löschungen (manuelle Ausführung — keine automatische Löschung) ─

  public func getPendingDeletions(
    retentionPolicies : Map.Map<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>,
    kanzleiId : Common.KanzleiId,
    now : Common.Timestamp,
  ) : [(Text, Text, Nat)] {
    // Returns (categoryName, entityId, retentionYears) for entities whose
    // retention period has expired AND isLocked is false.
    // entityId is left empty here — actual entity matching is done by the caller
    // (dashboard / admin UI) since this lib does not have access to all entity stores.
    // We return one entry per unlocked policy whose retention period has elapsed
    // relative to the policy's createdAt.
    retentionPolicies.values()
      .filter(func(p : DatenschutzTypes.RetentionPolicy) : Bool {
        if (p.kanzleiId != kanzleiId) return false;
        if (p.isLocked) return false;
        // Compare createdAt + retentionYears to now
        let elapsedYears = nanosToYears(now - p.createdAt);
        elapsedYears >= p.retentionYears;
      })
      .map<DatenschutzTypes.RetentionPolicy, (Text, Text, Nat)>(
        func(p : DatenschutzTypes.RetentionPolicy) : (Text, Text, Nat) {
          (p.categoryName, "", p.retentionYears);
        },
      )
      .toArray();
  };

  public func executeDeletion(
    categoryName : Text,
    entityId : Text,
  ) : Common.Result<(), Text> {
    // Manual deletion marker — actual entity removal is performed by the caller
    // (admin UI) on the respective entity store. This function validates inputs
    // and signals success so the audit trail can be logged by the mixin.
    //
    // entityId == "" is a valid signal meaning "delete ALL expired records in
    // the given category" — the caller scans the relevant Map and removes every
    // record past its retention period. This keeps getPendingDeletions simple
    // (it can return entityId="" per category) and the admin can clear all
    // expired records of a category in one action.
    if (categoryName == "") {
      return #err "Kategoriename darf nicht leer sein";
    };
    // Note: actual deletion is performed by the caller; this is a validation gate.
    #ok ();
  };

  // ─── Dateninventar ─────────────────────────────────────────────────────────

  public func getDataInventory(
    dataInventory : Map.Map<Common.DataInventoryId, DatenschutzTypes.DataInventoryEntry>,
    kanzleiId : Common.KanzleiId,
  ) : [DatenschutzTypes.DataInventoryEntry] {
    dataInventory.values()
      .filter(func(e : DatenschutzTypes.DataInventoryEntry) : Bool {
        e.kanzleiId == kanzleiId;
      })
      .toArray();
  };

  public func updateDataInventoryEntry(
    dataInventory : Map.Map<Common.DataInventoryId, DatenschutzTypes.DataInventoryEntry>,
    id : Common.DataInventoryId,
    entry : DatenschutzTypes.DataInventoryEntry,
  ) : Common.Result<DatenschutzTypes.DataInventoryEntry, Text> {
    switch (dataInventory.get(id)) {
      case null { #err "Inventareintrag nicht gefunden" };
      case (?existing) {
        // Enforce kanzleiId isolation: cannot move entry to another kanzlei
        if (existing.kanzleiId != entry.kanzleiId) {
          return #err "Kanzlei-Zuordnung darf nicht geändert werden";
        };
        let updated : DatenschutzTypes.DataInventoryEntry = {
          entry with
          id = existing.id;
          kanzleiId = existing.kanzleiId;
        };
        dataInventory.add(id, updated);
        #ok updated;
      };
    };
  };

  // ─── Datenflüsse ───────────────────────────────────────────────────────────

  public func getDataFlows(
    dataFlows : Map.Map<Common.DataFlowId, DatenschutzTypes.DataFlowEntry>,
    kanzleiId : Common.KanzleiId,
  ) : [DatenschutzTypes.DataFlowEntry] {
    dataFlows.values()
      .filter(func(f : DatenschutzTypes.DataFlowEntry) : Bool {
        f.kanzleiId == kanzleiId;
      })
      .toArray();
  };

  public func updateDataFlowEntry(
    dataFlows : Map.Map<Common.DataFlowId, DatenschutzTypes.DataFlowEntry>,
    id : Common.DataFlowId,
    entry : DatenschutzTypes.DataFlowEntry,
  ) : Common.Result<DatenschutzTypes.DataFlowEntry, Text> {
    switch (dataFlows.get(id)) {
      case null { #err "Datenfluss-Eintrag nicht gefunden" };
      case (?existing) {
        if (existing.kanzleiId != entry.kanzleiId) {
          return #err "Kanzlei-Zuordnung darf nicht geändert werden";
        };
        let updated : DatenschutzTypes.DataFlowEntry = {
          entry with
          id = existing.id;
          kanzleiId = existing.kanzleiId;
        };
        dataFlows.add(id, updated);
        #ok updated;
      };
    };
  };

  // ─── DSG-Version ──────────────────────────────────────────────────────────

  public func getDsgVersion(
    dsgVersion : ?DatenschutzTypes.DsgVersion,
  ) : ?DatenschutzTypes.DsgVersion {
    dsgVersion;
  };

  public func updateDsgVersion(
    dsgVersion : { var value : ?DatenschutzTypes.DsgVersion },
    version : Text,
    content : ?Text,
    publishedAt : Common.Timestamp,
  ) : DatenschutzTypes.DsgVersion {
    let newVersion : DatenschutzTypes.DsgVersion = {
      version;
      publishedAt;
      content;
    };
    dsgVersion.value := ?newVersion;
    newVersion;
  };

  // ─── Dashboard-Statistiken ─────────────────────────────────────────────────

  public func getDashboardStats(
    auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
    consentRecords : Map.Map<Common.ConsentId, DatenschutzTypes.ConsentRecord>,
    dsrRequests : Map.Map<Common.DsrId, DatenschutzTypes.DsrRequest>,
    retentionPolicies : Map.Map<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>,
    kanzleiId : Common.KanzleiId,
    now : Common.Timestamp,
  ) : DatenschutzTypes.DashboardStats {
    // totalRecordsByCategory: count audit log entries per entityType for this kanzlei
    let categoryCounts : Map.Map<Text, Nat> = Map.empty();
    for (entry in auditLogs.values()) {
      if (entry.kanzleiId == kanzleiId) {
        switch (categoryCounts.get(entry.entityType)) {
          case (?c) categoryCounts.add(entry.entityType, c + 1);
          case null categoryCounts.add(entry.entityType, 1);
        };
      };
    };
    let totalRecordsByCategory = categoryCounts.toArray();

    // pendingDeletions: count from getPendingDeletions
    let pending = getPendingDeletions(retentionPolicies, kanzleiId, now);
    let pendingDeletions = pending.size();

    // openDsrRequests: count DSR with status != #abgeschlossen
    var openDsrCount : Nat = 0;
    for (req in dsrRequests.values()) {
      if (req.kanzleiId == kanzleiId) {
        switch (req.status) {
          case (#abgeschlossen) {};
          case (_) openDsrCount += 1;
        };
      };
    };

    // auditExports: count of audit log entries with action "export"
    var exportCount : Nat = 0;
    for (entry in auditLogs.values()) {
      if (entry.kanzleiId == kanzleiId and entry.action == "export") {
        exportCount += 1;
      };
    };

    // missingConsents: count consent records marked as not given for this kanzlei
    // (klienten without consent records — we count records where consentGiven is false)
    var missingCount : Nat = 0;
    for (c in consentRecords.values()) {
      if (c.kanzleiId == kanzleiId and not c.consentGiven) {
        missingCount += 1;
      };
    };

    {
      totalRecordsByCategory;
      pendingDeletions;
      openDsrRequests = openDsrCount;
      auditExports = exportCount;
      missingConsents = missingCount;
    };
  };

  // ─── Zugriffskontrolle: Zugriffsprotokollierung ────────────────────────────

  public func logDataAccess(
    dataAccessLogs : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>,
    nextDataAccessId : { var count : Nat },
    kanzleiId : Common.KanzleiId,
    actorPrincipal : Principal,
    dataType : Text,
    entityId : Text,
    action : DatenschutzTypes.DataAccessAction,
    now : Common.Timestamp,
  ) : () {
    let id = "DAL-" # kanzleiId # "-" # nextDataAccessId.count.toText();
    let log : DatenschutzTypes.DataAccessLog = {
      id;
      kanzleiId;
      actorPrincipal;
      dataType;
      entityId;
      action;
      timestamp = now;
    };
    dataAccessLogs.add(id, log);
    nextDataAccessId.count += 1;
  };

  // ─── Rollenableitung aus Leistungserbringer ─────────────────────────────────

  public func deriveRole(
    isAdmin : Bool,
    role : ?KanzleiTypes.Role,
  ) : KanzleiTypes.Role {
    if (isAdmin) { return #admin };
    switch (role) {
      case (?r) r;
      case null #anwalt; // default per memory learnings
    };
  };
};
