import Common "types/common";
import KanzleiTypes "types/kanzlei";
import KlientenTypes "types/klienten";
import LeistungTypes "types/leistungen";
import RechnungTypes "types/rechnungen";
import RechnungsvorlagenTypes "types/rechnungsvorlagen";
import DatenschutzTypes "types/datenschutz";
import SuperAdminTypes "types/super-admin";
import SupportTypes "types/support";
import KanzleiApi "mixins/kanzlei-api";
import KlientenApi "mixins/klienten-api";
import LeistungenApi "mixins/leistungen-api";
import RechnungenApi "mixins/rechnungen-api";
import RechnungsvorlagenApi "mixins/rechnungsvorlagen-api";
import ReportingApi "mixins/reporting-api";
import DatenschutzApi "mixins/datenschutz-api";
import DatenschutzOql "lib/datenschutz-oql";
import SuperAdminOql "lib/super-admin-oql";
import StopwatchBudgetOql "lib/stopwatch-budget-oql";
import RechnungsvorlagenOql "lib/rechnungsvorlagen-oql";
import ActiveUsersOql "lib/active-users-oql";
import SupportOql "lib/support-oql";
import ActiveUsersApi "mixins/active-users-api";
import RolesApi "mixins/roles-api";
import SuperAdminApi "mixins/super-admin-api";
import StopwatchBudgetApi "mixins/stopwatch-budget-api";
import StopwatchBudgetTypes "types/stopwatch-budget";
import SupportApi "mixins/support-api";
import SecurityFixesApi "mixins/security-fixes-api";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import RegTypes "types/registration-verification";
import RegistrationVerificationOql "lib/registration-verification-oql";
import RegistrationVerificationApi "mixins/registration-verification-api";



import Map "mo:core/Map";
import Array "mo:core/Array";
import Expose "mo:caffeineai-oql/Expose";





actor {
  // ── State ──────────────────────────────────────────────────────────────────
  // Stable Felder: Typen ohne Inline-Initialisierer (enhanced migration).
  // Initialwerte werden über die migrations-Kette gesetzt.
  let kanzleien    : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>;
  let users        : Map.Map<Principal, KanzleiTypes.Leistungserbringer>;
  let inviteTokens : Map.Map<Text, KanzleiTypes.InviteToken>;
  // Super-Admin-Whitelist: erste II-Registrierung wird automatisch Super-Admin.
  // Wird von ActiveUsersApi (und künftig SuperAdminApi) für die Autorisierung
  // herangezogen — strikte Daten-Trennung pro Kanzlei bleibt gewahrt, da
  // Super-Admins alle Kanzleien sehen dürfen, reguläre Admins nur ihre eigene.
  let superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>;
  let klienten     : Map.Map<Common.KlientId, KlientenTypes.Klient>;
  let mandate      : Map.Map<Common.MandatId, KlientenTypes.Mandat>;
  let leistungen   : Map.Map<Common.LeistungId, LeistungTypes.Leistung>;
  let auslagen     : Map.Map<Common.AuslageId, LeistungTypes.Auslage>;
  let rechnungen   : Map.Map<Common.RechnungId, RechnungTypes.Rechnung>;
  let zahlungen    : Map.Map<Common.ZahlungId, RechnungTypes.Zahlung>;
  // Rechnungsvorlagen: genau eine pro Kanzlei (key = kanzleiId).
  // Steuert ausschliesslich den PDF/Word-Export, nicht die on-screen-Ansicht.
  let rechnungsvorlagen : Map.Map<Common.KanzleiId, RechnungsvorlagenTypes.Rechnungsvorlage>;
  let rechnungsNummer : { var count : Nat };

  // ── Stoppuhr/Budget-State (transient: laufende Timer) ───────────────────────
  // Laufende Stoppuhren sind transient — sie lassen sich aus `startTime` und
  // `baseDauer` nach einem Upgrade rekonstruieren, daher kein stabiler Speicher.
  transient let timers = Map.empty<Common.LeistungId, StopwatchBudgetTypes.TimerState>();

  // ── Datenschutz-State (stabil: auditLogs + consentRecords) ───────────────────
  let auditLogs       : Map.Map<Common.AuditLogId, DatenschutzTypes.AuditLogEntry>;
  let consentRecords  : Map.Map<Common.ConsentId, DatenschutzTypes.ConsentRecord>;

  // ── Datenschutz-State (transient: nicht zwingend persistierbar) ────────────
  transient let dsrRequests      = Map.empty<Common.DsrId, DatenschutzTypes.DsrRequest>();
  transient let retentionPolicies = Map.empty<Common.RetentionPolicyId, DatenschutzTypes.RetentionPolicy>();
  let dataAccessLogs   : Map.Map<Common.DatenschutzId, DatenschutzTypes.DataAccessLog>;
  transient let dataInventory    = Map.empty<Common.DataInventoryId, DatenschutzTypes.DataInventoryEntry>();
  transient let dataFlows        = Map.empty<Common.DataFlowId, DatenschutzTypes.DataFlowEntry>();
  transient let dsgVersion       = { var value : ?DatenschutzTypes.DsgVersion = null };

  // ── Support-/Feedback-Postfach-State (stabil) ───────────────────────────────
  // Support-Conversations (Threads) und Messages, tenant-isoliert pro Kanzlei.
  // createdByUserId ist der Principal des Erstellers als Text. Siehe
  // types/support.mo und lib/support.mo für Tenant-Isolation und Rollen-Prüfung.
  let supportConversations : Map.Map<SupportTypes.SupportConversationId, SupportTypes.SupportConversation>;
  let supportMessages      : Map.Map<SupportTypes.SupportMessageId, SupportTypes.SupportMessage>;

  // ── Registration-Verification-State (stabil) ────────────────────────────────
  // Temporäre PendingRegistrations zwischen Schritt 1 (Daten erfassen) und
  // Schritt 3 (Internet Identity verbinden & abschliessen). Keine produktive
  // Kanzlei und kein definitiver Benutzer. Wird über OQL (controller-only)
  // exponiert; verificationCodeHash wird dort bewusst NICHT exponiert.
  let pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>;

  // ── Zähler für IDs ──────────────────────────────────────────────────────────
  let nextAuditId        : { var count : Nat };
  transient let nextConsentId      = { var count : Nat = 1 };
  transient let nextDsrId          = { var count : Nat = 1 };
  let nextDataAccessId   : { var count : Nat };

  // ── Zähler für Support-IDs ──────────────────────────────────────────────────
  let nextSupportConversationId : { var count : Nat };
  let nextSupportMessageId      : { var count : Nat };

  // ── Mixins ─────────────────────────────────────────────────────────────────
  include KanzleiApi(kanzleien, users, inviteTokens, superAdminWhitelist, rechnungsvorlagen);
  include KlientenApi(klienten, mandate, users, kanzleien, superAdminWhitelist, auditLogs, dataAccessLogs, nextAuditId, nextDataAccessId);
  include LeistungenApi(leistungen, auslagen, mandate, users, kanzleien, superAdminWhitelist, auditLogs, dataAccessLogs, nextAuditId, nextDataAccessId);
  include RechnungenApi(rechnungen, zahlungen, leistungen, auslagen, mandate, users, kanzleien, superAdminWhitelist, rechnungsNummer, auditLogs, dataAccessLogs, nextAuditId, nextDataAccessId);
  include RechnungsvorlagenApi(rechnungsvorlagen, users, superAdminWhitelist, auditLogs, dataAccessLogs, nextAuditId, nextDataAccessId);
  include ReportingApi(leistungen, auslagen, mandate, users, rechnungen, kanzleien, superAdminWhitelist);
  include SuperAdminApi(
    kanzleien,
    users,
    inviteTokens,
    klienten,
    mandate,
    leistungen,
    auslagen,
    rechnungen,
    zahlungen,
    rechnungsvorlagen,
    superAdminWhitelist,
  );
  include SecurityFixesApi(kanzleien, superAdminWhitelist);
  include ActiveUsersApi(kanzleien, users, superAdminWhitelist);
  include RolesApi(users, superAdminWhitelist);
  include StopwatchBudgetApi(timers, leistungen, auslagen, mandate, users, kanzleien, superAdminWhitelist);
  include MixinObjectStorage();
  include DatenschutzApi(
    auditLogs,
    consentRecords,
    dsrRequests,
    retentionPolicies,
    dataAccessLogs,
    dataInventory,
    dataFlows,
    dsgVersion,
    nextAuditId,
    nextConsentId,
    nextDsrId,
    nextDataAccessId,
    users,
    kanzleien,
    superAdminWhitelist,
  );
  include SupportApi(
    users,
    superAdminWhitelist,
    supportConversations,
    supportMessages,
    nextSupportConversationId,
    nextSupportMessageId,
  );
  include RegistrationVerificationApi(pendingRegistrations, kanzleien, users, superAdminWhitelist, rechnungsvorlagen);

  // ── OQL (Data Intelligence) ────────────────────────────────────────────────
  //
  // Exposes the persisted collections as OQL-queryable entities
  // (schema() + execute(qJson)). All entities use #controllerOnly — the
  // most restrictive built-in TableAuth level — so only the canister
  // controller can run OQL queries. App-level admin-role enforcement is
  // handled at the application layer: the DatenschutzApi / ActiveUsersApi /
  // SuperAdminApi / KanzleiApi mixin endpoints already enforce admin-only
  // access via requireAdmin / requireAnwaltOrAdmin / isAdminOfKanzlei /
  // isSuperAdmin before any read or write. OQL is an additional read
  // surface for the controller, not a replacement for the mixin's RBAC.
  //
  // Covered collections:
  //   - Datenschutz:    auditLogs, consentRecords, dsrRequests,
  //                     retentionPolicies, dataAccessLogs, dataInventory,
  //                     dataFlows
  //   - Super-Admin:    superAdminWhitelist
  //   - Stopwatch/Budget: timers, leistungen, auslagen, mandate
  //   - Rechnungsvorlagen: rechnungsvorlagen
  //   - Active-Users:   kanzleien, users (back the computed
  //                     getActiveUsersPerMonth / getAllActiveUsersPerMonth
  //                     reports; no new persisted field introduced)
  //   - Support:        supportConversations, supportMessages
  //                     (per-table row-level scoping — a normal user sees
  //                     only own conversations/messages; a super-admin sees
  //                     all. See lib/support-oql.mo for the canSee rules,
  //                     which mirror lib/support.mo tenant-isolation.)
  include Expose({
    entities = Array.concat(
      Array.concat(
        Array.concat(
          Array.concat(
            Array.concat(
              DatenschutzOql.allEntities(
                auditLogs,
                consentRecords,
                dsrRequests,
                retentionPolicies,
                dataAccessLogs,
                dataInventory,
                dataFlows,
              ),
              SuperAdminOql.allEntities(superAdminWhitelist),
            ),
            StopwatchBudgetOql.allEntities(timers, leistungen, auslagen, mandate),
          ),
          RechnungsvorlagenOql.allEntities(rechnungsvorlagen),
        ),
        ActiveUsersOql.allEntities(kanzleien, users),
      ),
      Array.concat(
        SupportOql.allEntities(
          users,
          superAdminWhitelist,
          supportConversations,
          supportMessages,
        ),
        RegistrationVerificationOql.allEntities(pendingRegistrations),
      ),
    );
  });
};
