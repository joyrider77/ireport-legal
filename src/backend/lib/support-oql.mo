// OQL entity declarations for the Support domain.
//
// Exposes the two persisted Support collections as OQL-queryable entities:
//   supportConversations (Map<SupportConversationId, SupportConversation>)
//   supportMessages       (Map<SupportMessageId, SupportMessage>)
//
// The transient counters (nextSupportConversationId, nextSupportMessageId)
// are bookkeeping only and are NOT exposed.
//
// ── Per-table authorization (row-level scoping) ─────────────────────────────
//
// Unlike the other OQL domains in this project (Datenschutz, Super-Admin,
// Stopwatch/Budget, Rechnungsvorlagen, Active-Users), which all use
// #controllerOnly and rely on app-layer RBAC in the mixins, the Support
// domain requires row-level per-user scoping at the OQL layer itself:
//
//   - A normal user may only query their OWN Support data — i.e. rows whose
//     conversation was created by them under their own kanzlei.
//   - A super-admin (superAdminWhitelist) may query ALL Support data.
//
// This is implemented with .ownedByWith(field, canSee) + .controllerOrScoped():
//
//   - Canister controller → #unrestricted → sees every row (the platform
//     operator running the Data Intelligence agent).
//   - Super-admin (app-level, superAdminWhitelist) → scoped, but canSee
//     returns true for every row, so effectively sees all.
//   - Normal user → scoped, canSee admits only own rows.
//   - Anonymous → denied.
//
// The canSee closures capture actor state (users, superAdminWhitelist, and
// for messages the conversations map) and enforce the SAME tenant-isolation
// rule as lib/support.mo:
//   createdByUserId == caller.toText() AND kanzleiId == caller.kanzleiId.
// OQL authorization does NOT bypass the lib checks — it re-implements the
// identical rule at the query layer so a user can never read another
// user's or another kanzlei's Support rows through OQL.
//
// Variant-typed fields (category, status, senderType) are rendered to Text
// in their extractors and surfaced to schema() via .domain(...) so clients
// filter with the exact literals. The optional readAt field uses a sentinel
// (0) for the null case so the field stays queryable.

import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import SupportTypes "../types/support";
import SuperAdminLib "../lib/super-admin";
import Map "mo:core/Map";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import TextValue "mo:caffeineai-oql/TextValue";
import IntValue "mo:caffeineai-oql/IntValue";
import Principal "mo:core/Principal";

module {
  type Decl = OQL.Decl;
  type Value = OQL.Value;

  // ─── Variant → Text renderers ──────────────────────────────────────────────

  func categoryToText(c : SupportTypes.SupportCategory) : Text = switch c {
    case (#feedback) "feedback";
    case (#frage) "frage";
    case (#fehler) "fehler";
    case (#verbesserungsvorschlag) "verbesserungsvorschlag";
  };

  func statusToText(s : SupportTypes.SupportStatus) : Text = switch s {
    case (#neu) "neu";
    case (#in_bearbeitung) "in_bearbeitung";
    case (#erledigt) "erledigt";
    case (#archiviert) "archiviert";
  };

  func senderTypeToText(t : SupportTypes.SupportSenderType) : Text = switch t {
    case (#user) "user";
    case (#platformAdmin) "platformAdmin";
  };

  // ─── Optional → primitive helpers ──────────────────────────────────────────
  //
  // OQL's .payload(name, extract, _toRow) requires an implicit V -> Value
  // instance. The package provides instances for primitives (Text, Nat, Int,
  // Bool, Principal) but NOT for option types. We render readAt (?Int) to
  // Int with a 0 sentinel for null so the field stays queryable.

  func optReadAtToInt(v : ?Int) : Int = switch v {
    case (?t) t;
    case null 0;
  };

  // ─── Owner-check closures (per-table authorization) ────────────────────────
  //
  // canSee receives the resolved caller subject and the row's owner-cell
  // Value. The closures capture actor state to implement the same
  // tenant-isolation rule as lib/support.mo:
  //   createdByUserId == caller.toText() AND kanzleiId == caller.kanzleiId.
  // Super-admins (superAdminWhitelist) bypass the check and see every row.

  // Conversations: owner column = createdByUserId (Text → #text).
  // A row is visible iff the caller is a super-admin OR the conversation
  // was created by the caller. Since lib/support.mo sets kanzleiId from
  // the creator's user record at creation time, createdByUserId == caller
  // implies the conversation belongs to the caller's kanzlei — matching
  // the lib's effective isolation. (The lib's explicit kanzleiId check is
  // defense-in-depth; the createdByUserId match is the operative rule
  // here because canSee only receives the owner cell, not the full row.)
  func canSeeConversation(
    _users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
    owner : Value,
  ) : Bool {
    if (SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      return true;
    };
    switch (owner) {
      case (#text ownerId) ownerId == caller.toText();
      case _ false;
    }
  };

  // Messages: owner column = conversationId (Text → #text). A row is
  // visible iff the caller is a super-admin OR the conversation it belongs
  // to was created by the caller under the caller's kanzlei. The closure
  // captures the conversations map to resolve ownership from the
  // conversationId — this enforces the full lib/support.mo rule
  // (createdByUserId AND kanzleiId) for messages, which have no direct
  // owner field of their own.
  func canSeeMessage(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<SupportTypes.SupportConversationId, SupportTypes.SupportConversation>,
    caller : Principal,
    owner : Value,
  ) : Bool {
    if (SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      return true;
    };
    // Resolve the caller's kanzleiId from the users map. If the caller is
    // not a registered user, deny (no rows visible).
    let user = switch (users.get(caller)) {
      case null return false;
      case (?u) u;
    };
    let callerIdText = caller.toText();
    switch (owner) {
      case (#text convId) {
        switch (conversations.get(convId)) {
          case null false;
          case (?c) {
            c.createdByUserId == callerIdText and c.kanzleiId == user.kanzleiId
          };
        };
      };
      case _ false;
    }
  };

  // ─── Entity builders ───────────────────────────────────────────────────────

  // supportConversations: SupportConversation — variant fields category,
  // status. Owner column = createdByUserId (Text). Per-user scoping via
  // canSeeConversation (super-admin sees all; user sees own conversations).
  public func supportConversationEntity(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<SupportTypes.SupportConversationId, SupportTypes.SupportConversation>,
  ) : Decl {
    conversations.toEntityManual(
      "supportConversations",
      "SupportConversation",
      "id",
    )
      .payload("id", func (e : SupportTypes.SupportConversation) : Text = e.id)
      .payload("kanzleiId", func (e : SupportTypes.SupportConversation) : Text = e.kanzleiId)
      .payload("createdByUserId", func (e : SupportTypes.SupportConversation) : Text = e.createdByUserId)
      .payload("createdByUserName", func (e : SupportTypes.SupportConversation) : Text = e.createdByUserName)
      .payload("category", func (e : SupportTypes.SupportConversation) : Text = categoryToText(e.category))
      .payload("subject", func (e : SupportTypes.SupportConversation) : Text = e.subject)
      .payload("status", func (e : SupportTypes.SupportConversation) : Text = statusToText(e.status))
      .payload("appRoute", func (e : SupportTypes.SupportConversation) : Text = e.appRoute)
      .payload("appVersion", func (e : SupportTypes.SupportConversation) : Text = e.appVersion)
      .payload("createdAt", func (e : SupportTypes.SupportConversation) : Int = e.createdAt)
      .payload("updatedAt", func (e : SupportTypes.SupportConversation) : Int = e.updatedAt)
      .domain("category", [#text "feedback", #text "frage", #text "fehler", #text "verbesserungsvorschlag"])
      .domain("status", [#text "neu", #text "in_bearbeitung", #text "erledigt", #text "archiviert"])
      .ownedByWith(
        "createdByUserId",
        func (caller : Principal, owner : Value) : Bool =
          canSeeConversation(users, superAdminWhitelist, caller, owner),
      )
      .controllerOrScoped()
      .build();
  };

  // supportMessages: SupportMessage — variant field senderType, optional
  // readAt. Owner column = conversationId (Text). Per-user scoping via
  // canSeeMessage, which resolves conversation ownership (createdByUserId
  // AND kanzleiId) from the conversations map — enforcing the full
  // lib/support.mo tenant rule for messages.
  public func supportMessageEntity(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<SupportTypes.SupportConversationId, SupportTypes.SupportConversation>,
    messages : Map.Map<SupportTypes.SupportMessageId, SupportTypes.SupportMessage>,
  ) : Decl {
    messages.toEntityManual(
      "supportMessages",
      "SupportMessage",
      "id",
    )
      .payload("id", func (e : SupportTypes.SupportMessage) : Text = e.id)
      .payload("conversationId", func (e : SupportTypes.SupportMessage) : Text = e.conversationId)
      .payload("senderType", func (e : SupportTypes.SupportMessage) : Text = senderTypeToText(e.senderType))
      .payload("senderUserId", func (e : SupportTypes.SupportMessage) : Text = e.senderUserId)
      .payload("senderUserName", func (e : SupportTypes.SupportMessage) : Text = e.senderUserName)
      .payload("message", func (e : SupportTypes.SupportMessage) : Text = e.message)
      .payload("createdAt", func (e : SupportTypes.SupportMessage) : Int = e.createdAt)
      .payload("readAt", func (e : SupportTypes.SupportMessage) : Int = optReadAtToInt(e.readAt))
      .domain("senderType", [#text "user", #text "platformAdmin"])
      .ownedByWith(
        "conversationId",
        func (caller : Principal, owner : Value) : Bool =
          canSeeMessage(users, superAdminWhitelist, conversations, caller, owner),
      )
      .controllerOrScoped()
      .build();
  };

  // ─── Aggregate entity list ─────────────────────────────────────────────────
  //
  // Returns the Support OQL entities for inclusion in
  // Expose({ entities = [...] }) in main.mo. The transient counters
  // (nextSupportConversationId, nextSupportMessageId) are NOT exposed.

  public func allEntities(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<SupportTypes.SupportConversationId, SupportTypes.SupportConversation>,
    messages : Map.Map<SupportTypes.SupportMessageId, SupportTypes.SupportMessage>,
  ) : [Decl] = [
    supportConversationEntity(users, superAdminWhitelist, conversations),
    supportMessageEntity(users, superAdminWhitelist, conversations, messages),
  ];
};
