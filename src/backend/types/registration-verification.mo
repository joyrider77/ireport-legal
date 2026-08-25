import Common "common";
import KanzleiTypes "kanzlei";

module {
  // Eindeutige ID einer PendingRegistration (temporäres Objekt zwischen
  // Schritt 1 und vollständiger Registrierung). Keine produktive Kanzlei.
  public type PendingRegistrationId = Text;

  // Temporäres Registrierungsobjekt, das zwischen Schritt 1 (Daten erfassen)
  // und Schritt 3 (Internet Identity verbinden & abschliessen) existiert.
  //
  // Es ist KEINE produktive Kanzlei und KEIN definitiver Benutzer — erst
  // completeRegistration legt nach erfolgreicher E-Mail-Verifizierung und
  // II-Verknüpfung genau eine Kanzlei und einen Benutzer an und entfernt
  // dieses Objekt.
  //
  // Security: verificationCodeHash speichert NUR den Hash des 6-stelligen
  // Einmalcodes, niemals den Klartext. Der Code ist 15 Minuten gültig,
  // maximal 5 Fehlversuche (verificationAttempts), Neuversand frühestens
  // nach 60 Sekunden (lastCodeSentAt). PendingRegistrations laufen nach
  // 24 Stunden ab und werden bei Zugriff bereinigt.
  public type PendingRegistration = {
    id : PendingRegistrationId;
    kanzleiName : Text;
    titel : Text;
    vorname : Text;
    nachname : Text;
    email : Text;
    zahlungsmodalitaet : ?KanzleiTypes.Zahlungsmodalitaet;
    // Hash des 6-stelligen numerischen Einmalcodes (niemals Klartext).
    verificationCodeHash : Text;
    verificationExpiresAt : Common.Timestamp;
    verificationAttempts : Nat;
    lastCodeSentAt : Common.Timestamp;
    emailVerified : Bool;
    // Zeitstempel der erfolgreichen Verifizierung (null, solange nicht
    // bestätigt). Wird bei erfolgreicher Verifizierung gesetzt.
    verifiedAt : ?Common.Timestamp;
    createdAt : Common.Timestamp;
  };

  // Sicherheitsbereinigte Sicht auf eine PendingRegistration für die
  // Reload-Wiederherstellung (getPendingRegistration). Enthält NIE den
  // verificationCodeHash — der 6-stellige Code ist offline trivial
  // brute-forcebar, daher darf sein Hash nicht öffentlich exponiert werden.
  // Die Frontend braucht nur emailVerified, email und Personendaten.
  public type PendingRegistrationView = {
    id : PendingRegistrationId;
    kanzleiName : Text;
    titel : Text;
    vorname : Text;
    nachname : Text;
    email : Text;
    zahlungsmodalitaet : ?KanzleiTypes.Zahlungsmodalitaet;
    emailVerified : Bool;
    verifiedAt : ?Common.Timestamp;
    createdAt : Common.Timestamp;
  };

  // Saubere, nicht-technische Fehlermeldungen für das UI. Es werden KEINE
  // Backend-Fehlerdetails an den Aufrufer durchgereicht.
  public type VerificationError = {
    #invalidCode; // "Der Bestätigungscode ist nicht korrekt."
    #codeExpired; // "Der Bestätigungscode ist abgelaufen. Bitte fordern Sie einen neuen Code an."
    #tooManyAttempts; // "Zu viele Fehlversuche. Bitte fordern Sie einen neuen Code an."
    #resendTooSoon; // "Bitte warten Sie, bevor Sie einen neuen Code anfordern."
    #sendFailed; // "Der Bestätigungscode konnte nicht gesendet werden. Bitte versuchen Sie es später erneut."
    #notFound; // PendingRegistration nicht (mehr) vorhanden / abgelaufen
    #alreadyRegistered; // E-Mail-Adresse bereits registriert
    #principalAlreadyUsed; // Internet Identity / Principal bereits verwendet
    #emailAlreadyVerified; // E-Mail bereits bestätigt — Änderung erfordert neuen Code
    #invalidInput; // Eingaben ungültig (z.B. syntaktisch ungültige E-Mail)
  };
};
