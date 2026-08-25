// OQL entity declarations for the Datenschutz domain.
//
// Exposes the 7 persisted Datenschutz collections as OQL-queryable entities:
//   auditLogs, consentRecords, dsrRequests, retentionPolicies,
//   dataAccessLogs, dataInventory, dataFlows.
//
// Authorization: every entity uses #controllerOnly (the most restrictive
// built-in TableAuth level — only the canister controller can query).
// App-level admin-role enforcement is handled separately at the
// application layer: the DatenschutzApi mixin endpoints already enforce
// admin-only access via requireAdmin / requireAnwaltOrAdmin before any
// read or write. OQL is an additional read surface for the controller,
// not a replacement for the mixin's RBAC.
//
// Variant-typed fields (dsrType, status, action, accessRole) are
// rendered to Text in their _toRow extractors and surfaced to schema()
// via .domain(...) so clients filter with the exact literals.

import Common "../types/common";
import DatenschutzTypes "../types/datenschutz";
import KanzleiTypes "../types/kanzlei";
import Map "mo:core/Map";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import TextValue "mo:caffeineai-oql/TextValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import IntValue "mo:caffeineai-oql/IntValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import NatValue "mo:caffeineai-oql/NatValue";
import Principal "mo:core/Principal";

module {
  type Row = Entity.Row;
  type Decl = OQL.Decl;

  // ─── Variant → Text renderers ──────────────────────────────────────────────

  func dsrTypeToText(t : DatenschutzTypes.DsrType) : Text = switch t {
    case (#auskunft) "auskunft";
    case (#berichtigung) "berichtigung";
    case (#loeschung) "loeschung";
  };

  func dsrStatusToText(s : DatenschutzTypes.DsrStatus) : Text = switch s {
    case (#erfasst) "erfasst";
    case (#inBearbeitung) "inBearbeitung";
    case (#abgeschlossen) "abgeschlossen";
  };

  func dataAccessActionToText(a : DatenschutzTypes.DataAccessAction) : Text = switch a {
    case (#lesen) "lesen";
    case (#schreiben) "schreiben";
    case (#loeschen) "loeschen";
  };

  func roleToText(r : KanzleiTypes.Role) : Text = switch r {
    case (#plattform_admin) "plattform_admin";
    case (#admin) "admin";
    case (#anwalt) "anwalt";
    case (#mitarbeiter) "mitarbeiter";
    case (#mandant) "mandant";
  };

  // ─── Optional → primitive helpers ──────────────────────────────────────────
  //
  // OQL's .payload(name, extract, _toRow) requires an implicit V -> Value
  // instance. The package provides instances for primitives (Text, Nat, Int,
  // Bool, Principal) but NOT for Value -> Value or option types. We therefore
  // render optionals to primitives (empty Text / anonymous Principal / 0 Int)
  // so the existing implicit instances apply.

  func optTextToText(v : ?Text) : Text = switch v {
    case (?t) t;
    case null "";
  };

  func optKlientIdToText(v : ?Common.KlientId) : Text = switch v {
    case (?t) t;
    case null "";
  };

  func optTimestampToInt(v : ?Common.Timestamp) : Int = switch v {
    case (?t) t;
    case null 0;
  };

  func optPrincipalToPrincipal(v : ?Principal) : Principal = switch v {
    case (?p) p;
    case null Principal.fromText("aaaaa-aa");
  };

  // ─── Entity builders ───────────────────────────────────────────────────────
  //
  // Each collection uses Entity.manual + .payload(...) because the stored
  // records contain variant-typed fields (dsrType, status, action,
  // accessRole) which the auto-deriving _toRow cannot handle. Manual
  // declaration also lets us render variants as Text and declare their
  // domain values so schema() reports the exact literals.

  // auditLogs: AuditLogEntry — all flat fields, no variants.
  public func auditLogEntity(
    auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
  ) : Decl {
    auditLogs.toEntityManual(
      "auditLogs",
      "AuditLogEntry",
      "id",
    )
      .payload("id", func (e : DatenschutzTypes.AuditLogEntry) : Text = e.id)
      .payload("kanzleiId", func (e : DatenschutzTypes.AuditLogEntry) : Text = e.kanzleiId)
      .payload("actorPrincipal", func (e : DatenschutzTypes.AuditLogEntry) : Principal = e.actorPrincipal)
      .payload("action", func (e : DatenschutzTypes.AuditLogEntry) : Text = e.action)
      .payload("entityType", func (e : DatenschutzTypes.AuditLogEntry) : Text = e.entityType)
      .payload("entityId", func (e : DatenschutzTypes.AuditLogEntry) : Text = e.entityId)
      .payload("timestamp", func (e : DatenschutzTypes.AuditLogEntry) : Common.Timestamp = e.timestamp)
      .payload("beforeValue", func (e : DatenschutzTypes.AuditLogEntry) : Text = optTextToText(e.beforeValue))
      .payload("afterValue", func (e : DatenschutzTypes.AuditLogEntry) : Text = optTextToText(e.afterValue))
      .controllerOnly()
      .build();
  };

  // consentRecords: ConsentRecord — all flat fields, no variants.
  public func consentRecordEntity(
    consentRecords : Map.Map<Common.ConsentId, DatenschutzTypes.ConsentRecord>,
  ) : Decl {
    consentRecords.toEntityManual(
      "consentRecords",
      "ConsentRecord",
      "id",
    )
      .payload("id", func (e : DatenschutzTypes.ConsentRecord) : Text = e.id)
      .payload("kanzleiId", func (e : DatenschutzTypes.ConsentRecord) : Text = e.kanzleiId)
      .payload("klientId", func (e : DatenschutzTypes.ConsentRecord) : Text = e.klientId)
      .payload("consentGiven", func (e : DatenschutzTypes.ConsentRecord) : Bool = e.consentGiven)
      .payload("timestamp", func (e : DatenschutzTypes.ConsentRecord) : Common.Timestamp = e.timestamp)
      .payload("dsgVersion", func (e : DatenschutzTypes.ConsentRecord) : Text = e.dsgVersion)
      .payload("principal", func (e : DatenschutzTypes.ConsentRecord) : Principal = e.principal)
      .controllerOnly()
      .build();
  };

  // dsrRequests: DsrRequest — variant fields dsrType, status.
  public func dsrRequestEntity(
    dsrRequests : Map.Map<Common.DsrId, DatenschutzTypes.DsrRequest>,
  ) : Decl {
    dsrRequests.toEntityManual(
      "dsrRequests",
      "DsrRequest",
      "id",
    )
      .payload("id", func (e : DatenschutzTypes.DsrRequest) : Text = e.id)
      .payload("kanzleiId", func (e : DatenschutzTypes.DsrRequest) : Text = e.kanzleiId)
      .payload("dsrType", func (e : DatenschutzTypes.DsrRequest) : Text = dsrTypeToText(e.dsrType))
      .payload("requesterName", func (e : DatenschutzTypes.DsrRequest) : Text = e.requesterName)
      .payload("requesterEmail", func (e : DatenschutzTypes.DsrRequest) : Text = e.requesterEmail)
      .payload("requesterId", func (e : DatenschutzTypes.DsrRequest) : Text = optKlientIdToText(e.requesterId))
      .payload("status", func (e : DatenschutzTypes.DsrRequest) : Text = dsrStatusToText(e.status))
      .payload("assignedTo", func (e : DatenschutzTypes.DsrRequest) : Principal = optPrincipalToPrincipal(e.assignedTo))
      .payload("createdAt", func (e : DatenschutzTypes.DsrRequest) : Common.Timestamp = e.createdAt)
      .payload("updatedAt", func (e : DatenschutzTypes.DsrRequest) : Common.Timestamp = e.updatedAt)
      .payload("completedAt", func (e : DatenschutzTypes.DsrRequest) : Int = optTimestampToInt(e.completedAt))
      .payload("notes", func (e : DatenschutzTypes.DsrRequest) : Text = optTextToText(e.notes))
      .domain("dsrType", [#text "auskunft", #text "berichtigung", #text "loeschung"])
      .domain("status", [#text "erfasst", #text "inBearbeitung", #text "abgeschlossen"])
      .controllerOnly()
      .build();
  };

  // retentionPolicies: RetentionPolicy — all flat fields, no variants.
  public func retentionPolicyEntity(
    retentionPolicies : Map.Map<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>,
  ) : Decl {
    retentionPolicies.toEntityManual(
      "retentionPolicies",
      "RetentionPolicy",
      "id",
    )
      .payload("id", func (e : DatenschutzTypes.RetentionPolicy) : Text = e.id)
      .payload("kanzleiId", func (e : DatenschutzTypes.RetentionPolicy) : Text = e.kanzleiId)
      .payload("categoryName", func (e : DatenschutzTypes.RetentionPolicy) : Text = e.categoryName)
      .payload("retentionYears", func (e : DatenschutzTypes.RetentionPolicy) : Nat = e.retentionYears)
      .payload("legalBasis", func (e : DatenschutzTypes.RetentionPolicy) : Text = optTextToText(e.legalBasis))
      .payload("isLocked", func (e : DatenschutzTypes.RetentionPolicy) : Bool = e.isLocked)
      .payload("createdAt", func (e : DatenschutzTypes.RetentionPolicy) : Common.Timestamp = e.createdAt)
      .payload("updatedAt", func (e : DatenschutzTypes.RetentionPolicy) : Common.Timestamp = e.updatedAt)
      .controllerOnly()
      .build();
  };

  // dataAccessLogs: DataAccessLog — variant field action.
  public func dataAccessLogEntity(
    dataAccessLogs : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>,
  ) : Decl {
    dataAccessLogs.toEntityManual(
      "dataAccessLogs",
      "DataAccessLog",
      "id",
    )
      .payload("id", func (e : DatenschutzTypes.DataAccessLog) : Text = e.id)
      .payload("kanzleiId", func (e : DatenschutzTypes.DataAccessLog) : Text = e.kanzleiId)
      .payload("actorPrincipal", func (e : DatenschutzTypes.DataAccessLog) : Principal = e.actorPrincipal)
      .payload("dataType", func (e : DatenschutzTypes.DataAccessLog) : Text = e.dataType)
      .payload("entityId", func (e : DatenschutzTypes.DataAccessLog) : Text = e.entityId)
      .payload("action", func (e : DatenschutzTypes.DataAccessLog) : Text = dataAccessActionToText(e.action))
      .payload("timestamp", func (e : DatenschutzTypes.DataAccessLog) : Common.Timestamp = e.timestamp)
      .domain("action", [#text "lesen", #text "schreiben", #text "loeschen"])
      .controllerOnly()
      .build();
  };

  // dataInventory: DataInventoryEntry — variant field accessRole.
  public func dataInventoryEntity(
    dataInventory : Map.Map<Common.DataInventoryId, DatenschutzTypes.DataInventoryEntry>,
  ) : Decl {
    dataInventory.toEntityManual(
      "dataInventory",
      "DataInventoryEntry",
      "id",
    )
      .payload("id", func (e : DatenschutzTypes.DataInventoryEntry) : Text = e.id)
      .payload("kanzleiId", func (e : DatenschutzTypes.DataInventoryEntry) : Text = e.kanzleiId)
      .payload("categoryName", func (e : DatenschutzTypes.DataInventoryEntry) : Text = e.categoryName)
      .payload("storageLocation", func (e : DatenschutzTypes.DataInventoryEntry) : Text = e.storageLocation)
      .payload("storageDuration", func (e : DatenschutzTypes.DataInventoryEntry) : Text = e.storageDuration)
      .payload("accessRole", func (e : DatenschutzTypes.DataInventoryEntry) : Text = roleToText(e.accessRole))
      .payload("description", func (e : DatenschutzTypes.DataInventoryEntry) : Text = optTextToText(e.description))
      .domain("accessRole", [#text "plattform_admin", #text "admin", #text "anwalt", #text "mitarbeiter", #text "mandant"])
      .controllerOnly()
      .build();
  };

  // dataFlows: DataFlowEntry — all flat fields, no variants.
  public func dataFlowEntity(
    dataFlows : Map.Map<Common.DataFlowId, DatenschutzTypes.DataFlowEntry>,
  ) : Decl {
    dataFlows.toEntityManual(
      "dataFlows",
      "DataFlowEntry",
      "id",
    )
      .payload("id", func (e : DatenschutzTypes.DataFlowEntry) : Text = e.id)
      .payload("kanzleiId", func (e : DatenschutzTypes.DataFlowEntry) : Text = e.kanzleiId)
      .payload("flowName", func (e : DatenschutzTypes.DataFlowEntry) : Text = e.flowName)
      .payload("what", func (e : DatenschutzTypes.DataFlowEntry) : Text = e.what)
      .payload("destination", func (e : DatenschutzTypes.DataFlowEntry) : Text = e.destination)
      .payload("purpose", func (e : DatenschutzTypes.DataFlowEntry) : Text = e.purpose)
      .payload("legalBasis", func (e : DatenschutzTypes.DataFlowEntry) : Text = e.legalBasis)
      .payload("isExternal", func (e : DatenschutzTypes.DataFlowEntry) : Bool = e.isExternal)
      .controllerOnly()
      .build();
  };

  // ─── Aggregate entity list ─────────────────────────────────────────────────
  //
  // Returns all 7 Datenschutz OQL entities for inclusion in
  // Expose({ entities = [...] }) in main.mo.

  public func allEntities(
    auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
    consentRecords : Map.Map<Common.ConsentId, DatenschutzTypes.ConsentRecord>,
    dsrRequests : Map.Map<Common.DsrId, DatenschutzTypes.DsrRequest>,
    retentionPolicies : Map.Map<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>,
    dataAccessLogs : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>,
    dataInventory : Map.Map<Common.DataInventoryId, DatenschutzTypes.DataInventoryEntry>,
    dataFlows : Map.Map<Common.DataFlowId, DatenschutzTypes.DataFlowEntry>,
  ) : [Decl] = [
    auditLogEntity(auditLogs),
    consentRecordEntity(consentRecords),
    dsrRequestEntity(dsrRequests),
    retentionPolicyEntity(retentionPolicies),
    dataAccessLogEntity(dataAccessLogs),
    dataInventoryEntity(dataInventory),
    dataFlowEntity(dataFlows),
  ];
};
