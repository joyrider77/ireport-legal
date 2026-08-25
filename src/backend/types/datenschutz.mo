import Common "common";
import KanzleiTypes "kanzlei";

module {
  // Unveränderlicher Audit-Trail pro Änderung an Mandantendaten/Dokumenten/Rapporten/Rechnungen
  public type AuditLogEntry = {
    id : Common.AuditLogId;
    kanzleiId : Common.KanzleiId;
    actorPrincipal : Principal;
    action : Text;
    entityType : Text;
    entityId : Text;
    timestamp : Common.Timestamp;
    beforeValue : ?Text;
    afterValue : ?Text;
  };

  // Einwilligung zur Datenverarbeitung bei Mandantenregistrierung
  public type ConsentRecord = {
    id : Common.ConsentId;
    kanzleiId : Common.KanzleiId;
    klientId : Common.KlientId;
    consentGiven : Bool;
    timestamp : Common.Timestamp;
    dsgVersion : Text;
    principal : Principal;
  };

  // Art des Auskunfts-/Berichtigungs-/Löschbegehrens (DSR)
  public type DsrType = {
    #auskunft;
    #berichtigung;
    #loeschung;
  };

  public type DsrStatus = {
    #erfasst;
    #inBearbeitung;
    #abgeschlossen;
  };

  // DSR-Antrag einer betroffenen Person
  public type DsrRequest = {
    id : Common.DsrId;
    kanzleiId : Common.KanzleiId;
    dsrType : DsrType;
    requesterName : Text;
    requesterEmail : Text;
    requesterId : ?Common.KlientId;
    status : DsrStatus;
    assignedTo : ?Principal;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
    completedAt : ?Common.Timestamp;
    notes : ?Text;
  };

  // Konfigurierbare Aufbewahrungsfrist pro Datenkategorie
  public type RetentionPolicy = {
    id : Common.RetentionPolicyId;
    kanzleiId : Common.KanzleiId;
    categoryName : Text;
    retentionYears : Nat;
    legalBasis : ?Text;
    isLocked : Bool;
    createdAt : Common.Timestamp;
    updatedAt : Common.Timestamp;
  };

  // Protokollierung von Zugriffen auf sensible Mandantendaten
  public type DataAccessAction = {
    #lesen;
    #schreiben;
    #loeschen;
  };

  public type DataAccessLog = {
    id : Common.DatenschutzId;
    kanzleiId : Common.KanzleiId;
    actorPrincipal : Principal;
    dataType : Text;
    entityId : Text;
    action : DataAccessAction;
    timestamp : Common.Timestamp;
  };

  // Dateninventar: Speicherort, Speicherdauer, Zugriffsberechtigung
  public type DataInventoryEntry = {
    id : Common.DataInventoryId;
    kanzleiId : Common.KanzleiId;
    categoryName : Text;
    storageLocation : Text;
    storageDuration : Text;
    accessRole : KanzleiTypes.Role;
    description : ?Text;
  };

  // Datenfluss-Eintrag (intern oder extern, z. B. OpenAI, Bexio, E-Mail, Caffeine File Storage)
  public type DataFlowEntry = {
    id : Common.DataFlowId;
    kanzleiId : Common.KanzleiId;
    flowName : Text;
    what : Text;
    destination : Text;
    purpose : Text;
    legalBasis : Text;
    isExternal : Bool;
  };

  // Version der Datenschutzerklärung
  public type DsgVersion = {
    version : Text;
    publishedAt : Common.Timestamp;
    content : ?Text;
  };

  // Dashboard-Statistiken für Datenschutz-Übersicht im Admin-Bereich
  public type DashboardStats = {
    totalRecordsByCategory : [(Text, Nat)];
    pendingDeletions : Nat;
    openDsrRequests : Nat;
    auditExports : Nat;
    missingConsents : Nat;
  };

  // Filter für Audit-Trail-Abfragen und -Exporte
  public type AuditTrailFilter = {
    kanzleiId : Common.KanzleiId;
    entityType : ?Text;
    entityId : ?Text;
    actorPrincipal : ?Principal;
    fromTimestamp : ?Common.Timestamp;
    toTimestamp : ?Common.Timestamp;
  };
};
