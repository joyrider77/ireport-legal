import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import DatenschutzTypes "../types/datenschutz";
import SuperAdminTypes "../types/super-admin";
import Types "../types/rechnungsvorlagen";
import VorlagenLib "../lib/rechnungsvorlagen";
import DatenschutzLib "../lib/datenschutz";
import SecurityFixesLib "../lib/security-fixes";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Blob "mo:core/Blob";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Storage "mo:caffeineai-object-storage/Storage";

mixin (
  vorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  auditLogs : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>,
  dataAccessLogs : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>,
  nextAuditId : { var count : Nat },
  nextDataAccessId : { var count : Nat },
) {
  // ─── Audit-Trail-Helper (intern) ────────────────────────────────────────────

  func appendAuditEntryVorlagen(
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

  func logAccessVorlagen(
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

  // ─── Lese-Guard (intern) ────────────────────────────────────────────────────
  //
  // Liefert den Leistungserbringer des callers. Trap, falls nicht
  // registriert. Super-Admins (superAdminWhitelist) umgehen die
  // Registrierungsprüfung nicht — sie müssen ebenfalls registriert sein,
  // damit ihre kanzleiId aufgelöst werden kann. Die Vorlage ist
  // kanzlei-scoped, daher benötigt jeder Leser eine auflösbare kanzleiId.
  //
  // ROUTET durch den zentralen SecurityFixesLib.requireActiveUser-Guard,
  // damit der Canister-Owner (Controller) bzw. der erste authentifizierte
  // Benutzer beim ersten Zugriff auto-registriert wird (siehe
  // lib/security-fixes.mo autoRegisterController). Ohne diese Routing
  // würde der Owner beim Abruf der Rechnungsvorlage mit IC0503
  // "Benutzer nicht registriert" trappen, obwohl die anderen Domain-Mixins
  // (rechnungen/klienten/leistungen) ihn bereits auto-registriert haben.
  // Der Guard ist idempotent — ist der caller bereits registriert, tut er
  // nichts. requireActiveUser hat keinen kanzleien-Parameter (Contract aus
  // lib/support.mo); die Default-Kanzlei wird beim ersten
  // requireActiveUserAndKanzlei-Aufruf (z.B. getRechnungen) angelegt, falls
  // der Owner über diesen Vorlagen-Pfad zuerst registriert wurde.

  func requireUserVorlagen(caller : Principal) : KanzleiTypes.Leistungserbringer {
    SecurityFixesLib.requireActiveUser(users, superAdminWhitelist, caller);
  };

  // Liefert die Vorlage der Kanzlei des callers (eine pro Kanzlei).
  // Lesezugriff für alle registrierten Benutzer der Kanzlei — die
  // Vorlage steuert nur den PDF/Word-Export, nicht die on-screen-Ansicht.
  //
  // Gibt den VOLLSTÄNDIGEN Record inkl. layoutV2 (mit allen mm-Positionen,
  // Typografie, Sichtbarkeit, Reihenfolge, Seitenrändern) zurück, damit
  // der Frontend-Handler und der Word-Export die vollständige V2-Vorlage
  // erhalten und bei gültiger V2-Vorlage nicht auf V1 zurückfallen.
  public query ({ caller }) func getRechnungsvorlage() : async ?Types.Rechnungsvorlage {
    let user = requireUserVorlagen(caller);
    let result = VorlagenLib.getRechnungsvorlage(vorlagen, user.kanzleiId);
    // Lesezugriff protokollieren (query-Kontext: logAccessVorlagen
    // schreibt in dataAccessLogs, was in einer query-Funktion nicht
    // erlaubt ist — daher wird der Lesezugriff hier NICHT protokolliert).
    // Die Protokollierung von Lesezugriffen erfolgt in den update-
    // Funktionen (saveRechnungsvorlage, uploadLogo, removeLogo).
    result;
  };

  // Speichert/aktualisiert die Vorlage der Kanzlei des callers (Upsert,
  // eine pro Kanzlei). Admin-gated — nur Kanzlei-Admins (role #admin)
  // dürfen speichern. Bestehendes logoBlob bleibt erhalten, sofern
  // im Record nicht überschrieben.
  //
  // Persistiert das VOLLSTÄNDIGE layoutV2 (alle Elemente mit mm-Positionen,
  // Typografie, Sichtbarkeit, Reihenfolge, Seitenränder). Validiert vor
  // dem Speichern die neuen Felder (siehe VorlagenLib.saveRechnungsvorlage).
  //
  // Response-Shape (exakt, für Frontend-Decode):
  //   Common.Result<Types.Rechnungsvorlage, Text>
  //   = { #ok : Rechnungsvorlage; #err : Text }
  //
  // Der Frontend-Handler muss diesen Shape dekodieren — der __kind__-Fehler
  // (siehe AGENTS.md Learnings) entsteht, wenn der Handler einen anderen
  // Shape erwartet. Der exakte Shape ist in contracts dokumentiert.
  public shared ({ caller }) func saveRechnungsvorlage(
    vorlage : Types.Rechnungsvorlage,
  ) : async Common.Result<Types.Rechnungsvorlage, Text> {
    // Admin-Gating via requireKanzleiAdmin — liefert die autorisierte
    // kanzleiId des callers (Tenant-Isolation). Bei Nicht-Admin #err.
    switch (VorlagenLib.requireKanzleiAdmin(users, superAdminWhitelist, caller)) {
      case (#err msg) return #err msg;
      case (#ok kanzleiId) {
        // beforeValue für Audit-Trail (vorhandene Vorlage, falls vorhanden).
        let beforeValue : ?Text = switch (vorlagen.get(kanzleiId)) {
          case (?existing) ?("updatedAt=" # existing.updatedAt.toText());
          case null null;
        };
        // Vorlage persistieren (Tenant-Check + V2-Validierung + logoBlob
        // preservation + updatedAt-Setzung erfolgen in der Lib).
        switch (VorlagenLib.saveRechnungsvorlage(vorlagen, kanzleiId, vorlage)) {
          case (#ok saved) {
            // Audit-Trail: Speichern protokollieren.
            appendAuditEntryVorlagen(
              switch (users.get(caller)) {
                case (?u) u;
                case null Runtime.trap("Benutzer nicht registriert");
              },
              "save",
              "rechnungsvorlage",
              kanzleiId,
              beforeValue,
              ?("updatedAt=" # saved.updatedAt.toText()),
            );
            // Lesezugriff protokollieren (update-Kontext).
            logAccessVorlagen(
              switch (users.get(caller)) {
                case (?u) u;
                case null Runtime.trap("Benutzer nicht registriert");
              },
              "rechnungsvorlage",
              kanzleiId,
              #schreiben,
            );
            #ok saved;
          };
          case (#err msg) #err msg;
        };
      };
    };
  };

  // Lädt ein Logo als Bild-Datei hoch via object-storage (ExternalBlob).
  // Admin-gated. Akzeptiert die ExternalBlob-Referenz (der eigentliche
  // Gateway-Upload erfolgt im Frontend via _uploadFile in backend.ts),
  // speichert die Referenz in der Vorlage der Kanzlei und liefert () zurück.
  // Ersetzt ein bestehendes Logo.
  public shared ({ caller }) func uploadLogo(blob : Storage.ExternalBlob) : async Common.Result<(), Text> {
    switch (VorlagenLib.requireKanzleiAdmin(users, superAdminWhitelist, caller)) {
      case (#err msg) return #err msg;
      case (#ok kanzleiId) {
        VorlagenLib.saveLogo(vorlagen, kanzleiId, blob);
        let user = switch (users.get(caller)) {
          case (?u) u;
          case null Runtime.trap("Benutzer nicht registriert");
        };
        appendAuditEntryVorlagen(user, "upload", "rechnungsvorlage-logo", kanzleiId, null, ?"Logo hochgeladen");
        logAccessVorlagen(user, "rechnungsvorlage-logo", kanzleiId, #schreiben);
        #ok ();
      };
    };
  };

  // Liefert das Logo (ExternalBlob) der Kanzlei des callers, falls
  // vorhanden. Lesezugriff für alle registrierten Benutzer der Kanzlei —
  // der eigentliche Download erfolgt im Frontend via _downloadFile.
  public query ({ caller }) func getLogo() : async ?Storage.ExternalBlob {
    let user = requireUserVorlagen(caller);
    VorlagenLib.getLogo(vorlagen, user.kanzleiId);
  };

  // Entfernt das Logo der Kanzlei (setzt logoBlob auf null).
  // Admin-gated. Kein Fehler, wenn kein Logo vorhanden.
  public shared ({ caller }) func removeLogo() : async Common.Result<(), Text> {
    switch (VorlagenLib.requireKanzleiAdmin(users, superAdminWhitelist, caller)) {
      case (#err msg) return #err msg;
      case (#ok kanzleiId) {
        let user = switch (users.get(caller)) {
          case (?u) u;
          case null Runtime.trap("Benutzer nicht registriert");
        };
        let beforeValue : ?Text = switch (vorlagen.get(kanzleiId)) {
          case (?existing) switch (existing.logoBlob) {
            case (?_) ?"Logo vorhanden";
            case null null;
          };
          case null null;
        };
        VorlagenLib.removeLogo(vorlagen, kanzleiId);
        appendAuditEntryVorlagen(user, "remove", "rechnungsvorlage-logo", kanzleiId, beforeValue, ?"Logo entfernt");
        logAccessVorlagen(user, "rechnungsvorlage-logo", kanzleiId, #loeschen);
        #ok ();
      };
    };
  };
};
