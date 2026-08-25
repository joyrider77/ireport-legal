module {
  public type KanzleiId = Text;
  public type KlientId = Text;
  public type MandatId = Text;
  public type LeistungId = Text;
  public type AuslageId = Text;
  public type RechnungId = Text;
  public type ZahlungId = Text;
  public type Timestamp = Int;

  // Datenschutz domain IDs
  public type DatenschutzId = Text;
  public type DsrId = Text;
  public type AuditLogId = Text;
  public type ConsentId = Text;
  public type RetentionPolicyId = Text;
  public type DataInventoryId = Text;
  public type DataFlowId = Text;

  public type Result<T, E> = { #ok : T; #err : E };
};
