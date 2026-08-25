import Common "common";

module {
  // ── IDs (Text-Aliase, wie im bestehenden Common-Pattern) ────────────────────
  public type SupportConversationId = Text;
  public type SupportMessageId = Text;

  // ── Kategorie (vom Benutzer beim Anlegen gewählt) ───────────────────────────
  public type SupportCategory = {
    #feedback;
    #frage;
    #fehler;
    #verbesserungsvorschlag;
  };

  // ── Status (vom Plattform-Admin gesetzt; #neu ist Default) ──────────────────
  public type SupportStatus = {
    #neu;
    #in_bearbeitung;
    #erledigt;
    #archiviert;
  };

  // ── Absender-Typ einer SupportMessage ──────────────────────────────────────
  public type SupportSenderType = {
    #user;
    #platformAdmin;
  };

  // ── SupportConversation (Thread-Kopf) ───────────────────────────────────────
  //
  // Tenant-isoliert: kanzleiId wird vom Backend aus dem caller-Record
  // abgeleitet (nie vom Client gesendet), createdByUserId ist der Principal
  // des Erstellers als Text. appRoute / appVersion sind technische Metadaten
  // (keine fachlichen Klienten-/Mandats-/Rechnungsdaten).
  public type SupportConversation = {
    id : SupportConversationId;
    kanzleiId : Common.KanzleiId;
    createdByUserId : Text;
    createdByUserName : Text;
    category : SupportCategory;
    subject : Text;
    status : SupportStatus;
    appRoute : Text;
    appVersion : Text;
    createdAt : Int;
    updatedAt : Int;
  };

  // ── SupportMessage (einzelner Beitrag im Thread) ────────────────────────────
  //
  // readAt ist optional — null, solange die Nachricht vom Gegenüber noch
  // nicht gelesen wurde. Wird von markSupportMessageRead gesetzt.
  public type SupportMessage = {
    id : SupportMessageId;
    conversationId : SupportConversationId;
    senderType : SupportSenderType;
    senderUserId : Text;
    senderUserName : Text;
    message : Text;
    createdAt : Int;
    readAt : ?Int;
  };

  // ── Aggregat für Detailansicht (Conversation + chronologische Nachrichten) ──
  public type SupportConversationWithMessages = {
    conversation : SupportConversation;
    messages : [SupportMessage];
  };
};
