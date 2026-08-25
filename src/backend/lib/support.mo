import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import Types "../types/support";
import SecurityLib "../lib/security-fixes";
import SuperAdminLib "../lib/super-admin";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Nat "mo:core/Nat";

module {
  // ── Support-Domain-Logik ───────────────────────────────────────────────────
  //
  // Tenant-Isolation wird serverseitig in jeder Funktion erzwungen:
  //   - Normaler Benutzer: darf nur Conversations lesen/erweitern, bei denen
  //     createdByUserId == caller principal UND kanzleiId == caller.kanzleiId.
  //     Kein Cross-Tenant-, kein Cross-User-Zugriff.
  //   - Super-Admin (isSuperAdmin): darf alle Conversations sehen, auf jede
  //     antworten und den Status ändern. getAllSupportConversations und
  //     updateSupportStatus sind Super-Admin-only.
  //
  // requireActiveUser (lib/security-fixes.mo) wird für Benutzer-Aktionen
  // verwendet (trapt bei nicht-registriertem/inaktivem Benutzer, mit Super-
  // Admin-Bypass); isSuperAdmin (lib/super-admin.mo) für Admin-Gates.
  //
  // Die Contract-Signatur von createSupportConversation enthält keine
  // `kanzleien`-Map, daher kann requireActiveUserAndKanzlei hier nicht
  // aufgerufen werden. requireActiveUser stellt sicher, dass der caller
  // registriert und (für Nicht-Super-Admins) status=="aktiv" ist. Die
  // kanzleiId wird aus dem aufgelösten Leistungserbringer-Record gelesen.

  // Baut den Anzeigenamen eines Leistungserbringers: "Vorname Nachname",
  // falls beide vorhanden, sonst Fallback auf Principal.toText.
  func deriveUserName(u : KanzleiTypes.Leistungserbringer) : Text {
    let vn = u.vorname;
    let nn = u.nachname;
    let combined = vn # " " # nn;
    if (combined == " " or combined == "") {
      u.id.toText()
    } else {
      combined
    }
  };

  // Liefert alle Nachrichten einer Conversation, aufsteigend nach createdAt
  // sortiert (chronologisch).
  func messagesForConversation(
    messages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
    conversationId : Types.SupportConversationId,
  ) : [Types.SupportMessage] {
    messages.values()
      .filter(func(m : Types.SupportMessage) : Bool {
        m.conversationId == conversationId
      })
      .toArray()
      .sort(func(a : Types.SupportMessage, b : Types.SupportMessage) : { #less; #equal; #greater } {
        if (a.createdAt < b.createdAt) #less
        else if (a.createdAt > b.createdAt) #greater
        else #equal
      })
  };

  // Erstellt eine neue SupportConversation inkl. erster Benutzer-Nachricht.
  // Setzt kanzleiId aus dem caller-Record, status = #neu, createdAt/updatedAt
  // auf Time.now(). Erzeugt die erste SupportMessage (senderType = #user).
  public func createSupportConversation(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    messages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
    nextConversationId : { var count : Nat },
    caller : Principal,
    category : Types.SupportCategory,
    subject : Text,
    message : Text,
    appRoute : Text,
    appVersion : Text,
  ) : Common.Result<Types.SupportConversation, Text> {
    // Guard: caller muss registriert und (für Nicht-Super-Admins) aktiv sein.
    // requireActiveUser trapt bei fehlendem/inaktivem Benutzer — wir fangen
    // das nicht ab, da ein Trap hier die korrekte Antwort ist (kein #err-
    // Vertrag mit dem caller über einen inaktiven Account).
    let user = SecurityLib.requireActiveUser(users, superAdminWhitelist, caller);
    let now = Time.now();
    // Conversation-Id aus dem Zähler ableiten und Zähler inkrementieren.
    nextConversationId.count += 1;
    let conversationId : Types.SupportConversationId = nextConversationId.count.toText();
    // Message-Id: wir nutzen denselben Zähler-Stil, aber die erste Nachricht
    // bekommt eine eigene Id aus dem messages-Zähler. Da createSupportConversation
    // keinen nextMessageId-Parameter hat (Contract), leiten wir die erste
    // Nachrichten-Id deterministisch aus der Conversation-Id ab.
    let firstMessageId : Types.SupportMessageId = conversationId # "-m1";
    let userName = deriveUserName(user);
    let conversation : Types.SupportConversation = {
      id = conversationId;
      kanzleiId = user.kanzleiId;
      createdByUserId = caller.toText();
      createdByUserName = userName;
      category = category;
      subject = subject;
      status = #neu;
      appRoute = appRoute;
      appVersion = appVersion;
      createdAt = now;
      updatedAt = now;
    };
    let firstMessage : Types.SupportMessage = {
      id = firstMessageId;
      conversationId = conversationId;
      senderType = #user;
      senderUserId = caller.toText();
      senderUserName = userName;
      message = message;
      createdAt = now;
      readAt = null;
    };
    conversations.add(conversationId, conversation);
    messages.add(firstMessageId, firstMessage);
    #ok(conversation)
  };

  // Liefert alle Conversations des callers (nur eigene — Tenant-Isolation:
  // createdByUserId == caller principal UND kanzleiId == caller.kanzleiId).
  // Kein Super-Admin-Bypass: ein Super-Admin als Benutzer sieht nur seine
  // eigenen Conversations (für alle Conversations gibt es
  // getAllSupportConversations).
  public func getMySupportConversations(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    caller : Principal,
  ) : [Types.SupportConversation] {
    let user = SecurityLib.requireActiveUser(users, superAdminWhitelist, caller);
    let callerIdText = caller.toText();
    conversations.values()
      .filter(func(c : Types.SupportConversation) : Bool {
        c.createdByUserId == callerIdText and c.kanzleiId == user.kanzleiId
      })
      .toArray()
      .sort(func(a : Types.SupportConversation, b : Types.SupportConversation) : { #less; #equal; #greater } {
        if (a.updatedAt > b.updatedAt) #less
        else if (a.updatedAt < b.updatedAt) #greater
        else #equal
      })
  };

  // Liefert eine Conversation inkl. chronologischer Nachrichten.
  // Benutzer sieht nur eigene Conversations; Super-Admin sieht alle.
  // Sonst #err.
  public func getSupportConversation(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    messages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
    caller : Principal,
    conversationId : Types.SupportConversationId,
  ) : Common.Result<Types.SupportConversationWithMessages, Text> {
    let user = SecurityLib.requireActiveUser(users, superAdminWhitelist, caller);
    let callerIdText = caller.toText();
    let isSuper = SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller);
    switch (conversations.get(conversationId)) {
      case null #err("Conversation nicht gefunden");
      case (?c) {
        // Tenant-Isolation: Super-Admin darf jede Conversation lesen; ein
        // normaler Benutzer nur seine eigene (createdByUserId == caller
        // UND kanzleiId == caller.kanzleiId).
        let allowed = isSuper or (c.createdByUserId == callerIdText and c.kanzleiId == user.kanzleiId);
        if (not allowed) {
          return #err("Kein Zugriff auf diese Conversation");
        };
        let msgs = messagesForConversation(messages, conversationId);
        #ok({ conversation = c; messages = msgs })
      };
    }
  };

  // Super-Admin-only: liefert alle Conversations über alle Kanzleien hinweg.
  public func getAllSupportConversations(
    _users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    caller : Principal,
  ) : Common.Result<[Types.SupportConversation], Text> {
    // Super-Admin-Gate: nur Whitelist-Principal darf alle Conversations sehen.
    if (not SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      return #err("Nur Super-Admins dürfen alle Conversations einsehen");
    };
    let all = conversations.values()
      .toArray()
      .sort(func(a : Types.SupportConversation, b : Types.SupportConversation) : { #less; #equal; #greater } {
        if (a.updatedAt > b.updatedAt) #less
        else if (a.updatedAt < b.updatedAt) #greater
        else #equal
      });
    #ok(all)
  };

  // Fügt eine Nachricht zu einer Conversation hinzu.
  // Benutzer: senderType = #user, nur eigene Conversation.
  // Super-Admin: senderType = #platformAdmin, beliebige Conversation.
  // Aktualisiert conversation.updatedAt. Reopened eine #erledigt/#archiviert
  // Conversation, wenn ein Benutzer antwortet (Status → #in_bearbeitung).
  public func addSupportMessage(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    messages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
    nextMessageId : { var count : Nat },
    caller : Principal,
    conversationId : Types.SupportConversationId,
    message : Text,
  ) : Common.Result<Types.SupportMessage, Text> {
    let user = SecurityLib.requireActiveUser(users, superAdminWhitelist, caller);
    let callerIdText = caller.toText();
    let isSuper = SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller);
    switch (conversations.get(conversationId)) {
      case null #err("Conversation nicht gefunden");
      case (?c) {
        // Autorisierung + Sender-Typ ableiten.
        //   - Super-Admin → darf auf jede Conversation antworten (#platformAdmin)
        //   - normaler Benutzer → nur eigene Conversation (#user)
        let senderType : Types.SupportSenderType = if (isSuper) {
          #platformAdmin
        } else if (c.createdByUserId == callerIdText and c.kanzleiId == user.kanzleiId) {
          #user
        } else {
          return #err("Kein Zugriff auf diese Conversation");
        };
        let now = Time.now();
        nextMessageId.count += 1;
        let msgId : Types.SupportMessageId = nextMessageId.count.toText();
        let userName = deriveUserName(user);
        let msg : Types.SupportMessage = {
          id = msgId;
          conversationId = conversationId;
          senderType = senderType;
          senderUserId = callerIdText;
          senderUserName = userName;
          message = message;
          createdAt = now;
          readAt = null;
        };
        messages.add(msgId, msg);
        // updatedAt aktualisieren. Falls ein Benutzer auf eine
        // #erledigt/#archiviert Conversation antwortet, wird sie wieder
        // auf #in_bearbeitung gesetzt (Reopen). Super-Admin-Antworten
        // reopen nicht (der Admin entscheidet selbst über den Status).
        let newStatus : Types.SupportStatus = switch (senderType, c.status) {
          case (#user, #erledigt) #in_bearbeitung;
          case (#user, #archiviert) #in_bearbeitung;
          case (_, _) c.status;
        };
        let updated : Types.SupportConversation = {
          c with
          status = newStatus;
          updatedAt = now;
        };
        conversations.add(conversationId, updated);
        #ok(msg)
      };
    }
  };

  // Super-Admin-only: ändert den Status einer Conversation.
  public func updateSupportStatus(
    _users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    caller : Principal,
    conversationId : Types.SupportConversationId,
    newStatus : Types.SupportStatus,
  ) : Common.Result<Types.SupportConversation, Text> {
    if (not SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      return #err("Nur Super-Admins dürfen den Status ändern");
    };
    switch (conversations.get(conversationId)) {
      case null #err("Conversation nicht gefunden");
      case (?c) {
        let now = Time.now();
        let updated : Types.SupportConversation = {
          c with
          status = newStatus;
          updatedAt = now;
        };
        conversations.add(conversationId, updated);
        #ok(updated)
      };
    }
  };

  // Markiert Nachrichten des Gegenübers in einer Conversation als gelesen
  // (setzt readAt). Benutzer markiert #platformAdmin-Nachrichten in eigener
  // Conversation; Super-Admin markiert #user-Nachrichten. Grundlage für
  // Unread-Counter.
  public func markSupportMessageRead(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    messages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
    caller : Principal,
    conversationId : Types.SupportConversationId,
  ) : Common.Result<(), Text> {
    let user = SecurityLib.requireActiveUser(users, superAdminWhitelist, caller);
    let callerIdText = caller.toText();
    let isSuper = SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller);
    // Conversation muss existieren und der caller muss zugriffsberechtigt
    // sein (eigene Conversation ODER Super-Admin).
    switch (conversations.get(conversationId)) {
      case null return #err("Conversation nicht gefunden");
      case (?c) {
        let allowed = isSuper or (c.createdByUserId == callerIdText and c.kanzleiId == user.kanzleiId);
        if (not allowed) {
          return #err("Kein Zugriff auf diese Conversation");
        };
      };
    };
    // Der caller markiert die Nachrichten des GEGENÜBERS als gelesen:
    //   - Benutzer-Caller → #platformAdmin-Nachrichten
    //   - Super-Admin-Caller → #user-Nachrichten
    let targetSenderType : Types.SupportSenderType = if (isSuper) #user else #platformAdmin;
    let now = Time.now();
    let entries : [(Types.SupportMessageId, Types.SupportMessage)] = messages.entries().toArray();
    for ((id, m) in entries.values()) {
      if (m.conversationId == conversationId and m.senderType == targetSenderType and m.readAt == null) {
        let updated : Types.SupportMessage = { m with readAt = ?now };
        messages.add(id, updated);
      };
    };
    #ok(())
  };

  // Anzahl eigener Conversations mit ungelesenen #platformAdmin-Nachrichten
  // (für Benutzer-Unread-Counter).
  public func getUnreadSupportCountForUser(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    messages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
    caller : Principal,
  ) : Nat {
    let user = SecurityLib.requireActiveUser(users, superAdminWhitelist, caller);
    let callerIdText = caller.toText();
    // Eigene Conversation-Ids sammeln (Tenant-Isolation).
    let ownConversationIds : [Types.SupportConversationId] = conversations.values()
      .filter(func(c : Types.SupportConversation) : Bool {
        c.createdByUserId == callerIdText and c.kanzleiId == user.kanzleiId
      })
      .map(func(c : Types.SupportConversation) : Types.SupportConversationId { c.id })
      .toArray();
    var count : Nat = 0;
    // Für jede eigene Conversation prüfen, ob mindestens eine ungelesene
    // #platformAdmin-Nachricht existiert.
    for (cid in ownConversationIds.values()) {
      var found = false;
      let msgIter = messages.values();
      for (m in msgIter) {
        if (not found and m.conversationId == cid and m.senderType == #platformAdmin and m.readAt == null) {
          found := true;
        };
      };
      if (found) { count += 1 };
    };
    count
  };

  // Super-Admin-only: Anzahl Conversations mit status #neu oder ungelesenen
  // #user-Nachrichten (für Admin-Unread-Counter).
  public func getUnreadSupportCountForAdmin(
    _users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    conversations : Map.Map<Types.SupportConversationId, Types.SupportConversation>,
    messages : Map.Map<Types.SupportMessageId, Types.SupportMessage>,
    caller : Principal,
  ) : Common.Result<Nat, Text> {
    if (not SuperAdminLib.isSuperAdmin(superAdminWhitelist, caller)) {
      return #err("Nur Super-Admins dürfen den Admin-Counter abfragen");
    };
    // Snapshot aller Conversations mit ihrer Id und ihrem Status.
    let allConversations : [(Types.SupportConversationId, Types.SupportConversation)] =
      conversations.entries().toArray();
    // Snapshot aller Nachrichten-Ids pro Conversation mit ungelesener
    // #user-Nachricht. Wir bauen ein Array der Conversation-Ids, die
    // mindestens eine ungelesene #user-Nachricht enthalten.
    let conversationIdsWithUnreadUserMsg : [Types.SupportConversationId] = messages.values()
      .filter(func(m : Types.SupportMessage) : Bool {
        m.senderType == #user and m.readAt == null
      })
      .map(func(m : Types.SupportMessage) : Types.SupportConversationId { m.conversationId })
      .toArray();
    var count : Nat = 0;
    for ((id, c) in allConversations.values()) {
      // #neu-Status zählt immer.
      if (c.status == #neu) {
        count += 1;
      } else {
        // Sonst: zählt, wenn mindestens eine ungelesene #user-Nachricht
        // in dieser Conversation existiert.
        let hasUnread = conversationIdsWithUnreadUserMsg.any(func(cid : Types.SupportConversationId) : Bool {
          cid == id
        });
        if (hasUnread) { count += 1 };
      };
    };
    #ok(count)
  };
};
