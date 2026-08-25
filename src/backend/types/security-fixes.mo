// security-fixes domain types
//
// Dieser Contract definiert die Typen für den gezielten Sicherheits-/
// Bugfix-Build von iReport Legal. Er führt KEINE neuen persistenten Typen
// ein — alle bestehenden Typen (Kanzlei, Leistungserbringer, AuditLogEntry,
// DataAccessLog, etc.) bleiben unverändert in ihren bestehenden
// types/<domain>.mo-Dateien. Dieses Modul definiert ausschliesslich
// Hilfs-Typen für die neuen Guard-Helper und die Reactivate-Signatur.
//
// Siehe auch:
//   - lib/security-fixes.mo        (Guard-Helper + reactivateKanzlei)
//   - mixins/security-fixes-api.mo  (öffentliche reactivateKanzlei-Endpoint)
//   - migrations/20260809_000000.mo (nextAuditId/dataAccessLogs/nextDataAccessId stable)

module {
  // Guard-Ergebnis-Typ für die neuen zentralen Guards. Liefert bei Erfolg
  // den aufgelösten Leistungserbringer (caller) UND die zugehörige Kanzlei,
  // damit nachfolgende Fach-Logik beide Werte ohne erneutes Lookup verwenden
  // kann. Bei Fehlern liefert der Guard eine deutsche Meldung (trap).
  //
  // Dieser Typ wird NUR intern in lib/security-fixes.mo verwendet und ist
  // nicht Teil der öffentlichen API.
  public type GuardedUser = {
    user : Principal;        // caller-Principal (für Audit-Logs)
    kanzleiId : Text;        // kanzleiId des callers (Tenant-Isolation)
  };
};
