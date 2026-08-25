import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import Types "../types/support";
import SupportLib "../lib/support";
import Map "mo:core/Map";

// ── Support-API-Mixin ────────────────────────────────────────────────────────
//
// Öffentlicher Actor-Mixin für das Feedback- & Support-Postfach. Jede
// Methode delegiert an lib/support.mo. Tenant-Isolation und Rollenprüfung
// erfolgen in der Lib (Frontend-Filter allein reichen nicht).

mixin (
  users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  supportConversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
  supportMessages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
  nextSupportConversationId : { var count : Nat },
  nextSupportMessageId : { var count : Nat },
) {
  // Erstellt eine neue SupportConversation inkl. erster Benutzer-Nachricht.
  // kanzleiId, createdByUserId, createdByUserName werden aus dem caller
  // abgeleitet (nicht vom Client gesendet). appRoute / appVersion sind
  // technische Metadaten.
  public shared ({ caller }) func createSupportConversation(
    category : Types.SupportCategory,
    subject : Text,
    message : Text,
    appRoute : Text,
    appVersion : Text,
  ) : async Common.Result<Types.SupportConversation, Text> {
    SupportLib.createSupportConversation(
      users,
      superAdminWhitelist,
      supportConversations,
      supportMessages,
      nextSupportConversationId,
      caller,
      category,
      subject,
      message,
      appRoute,
      appVersion,
    )
  };

  // Liefert alle Conversations des callers (nur eigene).
  public shared ({ caller }) func getMySupportConversations() : async [Types.SupportConversation] {
    SupportLib.getMySupportConversations(
      users,
      superAdminWhitelist,
      supportConversations,
      caller,
    )
  };

  // Liefert eine Conversation inkl. chronologischer Nachrichten.
  // Benutzer sieht nur eigene; Super-Admin sieht alle.
  public shared ({ caller }) func getSupportConversation(
    conversationId : Types.SupportConversationId,
  ) : async Common.Result<Types.SupportConversationWithMessages, Text> {
    SupportLib.getSupportConversation(
      users,
      superAdminWhitelist,
      supportConversations,
      supportMessages,
      caller,
      conversationId,
    )
  };

  // Super-Admin-only: liefert alle Conversations über alle Kanzleien.
  public shared ({ caller }) func getAllSupportConversations() : async Common.Result<[Types.SupportConversation], Text> {
    SupportLib.getAllSupportConversations(
      users,
      superAdminWhitelist,
      supportConversations,
      caller,
    )
  };

  // Fügt eine Nachricht zu einer Conversation hinzu.
  // Benutzer: #user auf eigene Conversation. Super-Admin: #platformAdmin auf beliebige.
  public shared ({ caller }) func addSupportMessage(
    conversationId : Types.SupportConversationId,
    message : Text,
  ) : async Common.Result<Types.SupportMessage, Text> {
    SupportLib.addSupportMessage(
      users,
      superAdminWhitelist,
      supportConversations,
      supportMessages,
      nextSupportMessageId,
      caller,
      conversationId,
      message,
    )
  };

  // Super-Admin-only: ändert den Status einer Conversation.
  public shared ({ caller }) func updateSupportStatus(
    conversationId : Types.SupportConversationId,
    newStatus : Types.SupportStatus,
  ) : async Common.Result<Types.SupportConversation, Text> {
    SupportLib.updateSupportStatus(
      users,
      superAdminWhitelist,
      supportConversations,
      caller,
      conversationId,
      newStatus,
    )
  };

  // Markiert Nachrichten des Gegenübers in einer Conversation als gelesen.
  public shared ({ caller }) func markSupportMessageRead(
    conversationId : Types.SupportConversationId,
  ) : async Common.Result<(), Text> {
    SupportLib.markSupportMessageRead(
      users,
      superAdminWhitelist,
      supportConversations,
      supportMessages,
      caller,
      conversationId,
    )
  };

  // Anzahl eigener Conversations mit ungelesenen Admin-Antworten (Benutzer-Counter).
  public shared ({ caller }) func getUnreadSupportCountForUser() : async Nat {
    SupportLib.getUnreadSupportCountForUser(
      users,
      superAdminWhitelist,
      supportConversations,
      supportMessages,
      caller,
    )
  };

  // Super-Admin-only: Anzahl Conversations mit #neu oder ungelesenen
  // Benutzer-Nachrichten (Admin-Counter).
  public shared ({ caller }) func getUnreadSupportCountForAdmin() : async Common.Result<Nat, Text> {
    SupportLib.getUnreadSupportCountForAdmin(
      users,
      superAdminWhitelist,
      supportConversations,
      supportMessages,
      caller,
    )
  };
};
