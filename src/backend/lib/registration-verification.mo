import Map "mo:core/Map";
import Debug "mo:core/Debug";
import Common "../types/common";
import Types "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import VorlagenTypes "../types/rechnungsvorlagen";
import RegTypes "../types/registration-verification";
import EmailClient "mo:caffeineai-email/emailClient";
import Sha256 "mo:sha2/Sha256";
import Random "mo:core/Random";
import Time "mo:core/Time";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Blob "mo:core/Blob";
import Nat8 "mo:core/Nat8";
import Char "mo:core/Char";
import Nat32 "mo:core/Nat32";
import Principal "mo:core/Principal";
import KanzleiLib "../lib/kanzlei";

module {
  // ── Konstanten ─────────────────────────────────────────────────────────────
  // 60 Sekunden Neuversand-Cooldown (in Nanosekunden).
  let RESEND_COOLDOWN_NS : Int = 60_000_000_000;
  // 15 Minuten Code-Gültigkeit.
  let CODE_TTL_NS : Int = 900_000_000_000;
  // 24 Stunden PendingRegistration-Lebensdauer.
  let PENDING_TTL_NS : Int = 86_400_000_000_000;
  // Maximal 5 Fehlversuche pro Code.
  let MAX_ATTEMPTS : Nat = 5;

  // ── Hilfsfunktionen ────────────────────────────────────────────────────────

  // Prüft die E-Mail-Syntax: enthält genau ein '@' mit nicht-leerem
  // Local-Part und nicht-leerem Domain-Part.
  func isValidEmail(email : Text) : Bool {
    let parts = email.split(#char '@').toArray();
    parts.size() == 2 and parts[0] != "" and parts[1] != "";
  };

  // Wandelt ein Nibble (0–15) in das zugehörige Hex-Zeichen um.
  func nibbleToChar(n : Nat) : Char {
    if (n < 10) {
      Char.fromNat32(Nat32.fromNat(48 + n));
    } else {
      Char.fromNat32(Nat32.fromNat(87 + n));
    };
  };

  // Wandelt einen Blob in seine Hex-Text-Repräsentation um.
  func toHex(blob : Blob) : Text {
    let bytes = blob.toArray();
    var result = "";
    for (b in bytes.values()) {
      let n = b.toNat();
      result := result # Text.fromChar(nibbleToChar(n / 16)) # Text.fromChar(nibbleToChar(n % 16));
    };
    result;
  };

  // ── E-Mail-Verifizierung per Einmalcode ────────────────────────────────────
  //
  // Erzeugt/aktualisiert eine PendingRegistration, generiert einen zufälligen
  // 6-stelligen numerischen Einmalcode, speichert NUR dessen Hash
  // (verificationCodeHash), setzt Ablauf (15 Min), Fehlversuche (0),
  // lastCodeSentAt und erzwingt den 60-Sekunden-Neuversand-Cooldown sowie
  // Rate-Limiting pro E-Mail-Adresse und pro PendingRegistration. Sendet den
  // Code über die bestehende E-Mail-Infrastruktur (caffeineai-email,
  // transaktionales sendServiceEmail) mit Betreff 'iReport Legal –
  // E-Mail-Adresse bestätigen' und Hinweis 'Der Code ist 15 Minuten gültig'.
  // Legt noch KEINE definitive Kanzlei und KEINEN definitiven Benutzer an.
  public func sendVerificationCode(
    pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
    caller : Principal,
    kanzleiName : Text,
    titel : Text,
    vorname : Text,
    nachname : Text,
    email : Text,
    zahlungsmodalitaet : ?Types.Zahlungsmodalitaet,
  ) : async Common.Result<RegTypes.PendingRegistrationId, RegTypes.VerificationError> {
    // 1. Pflichtfelder + E-Mail-Syntax validieren.
    if (kanzleiName == "" or vorname == "" or nachname == "" or not isValidEmail(email)) {
      return #err (#invalidInput);
    };

    let now = Time.now();

    // 2. Per-E-Mail-Rate-Limit: bestehende PendingRegistration zur E-Mail suchen.
    var existing : ?RegTypes.PendingRegistration = null;
    for (p in pendingRegistrations.values()) {
      if (p.email == email) {
        existing := ?p;
      };
    };

    // 3. 60-Sekunden-Neuversand-Cooldown + Ablauf-Handling.
    var targetId : RegTypes.PendingRegistrationId = caller.toText() # "-" # now.toText();
    switch (existing) {
      case (?p) {
        if (now - p.createdAt >= PENDING_TTL_NS) {
          // Abgelaufene PendingRegistration (24h) bereinigen, neue erzeugen.
          pendingRegistrations.remove(p.id);
        } else {
          // Gültige PendingRegistration: 60s-Cooldown erzwingen.
          if (now - p.lastCodeSentAt < RESEND_COOLDOWN_NS) {
            return #err (#resendTooSoon);
          };
          // Bestehende ID wiederverwenden (Resend im selben Flow).
          targetId := p.id;
        };
      };
      case null {};
    };

    // 4. Zufälligen 6-stelligen numerischen Code generieren (100000–999999).
    let r = Random.crypto();
    let code = await* r.natRange(100000, 1000000);

    // 5. NUR den Hash des Codes speichern (niemals Klartext).
    let codeHash = toHex(Sha256.fromBlob(#sha256, code.toText().encodeUtf8()));

    // 6. E-Mail transaktional senden (keine sensiblen Kanzlei-/Mandatsdaten).
    // Verwendet sendServiceEmail (BroadcastEmailType #Service) — die für
    // transaktionale Service-Benachrichtigungen vorgesehene Methode des
    // caffeineai-email Pakets. sendVerificationEmail (#Verification) ist nur
    // für Click-to-Verify-Magic-Links gedacht und erfordert einen
    // Verifizierungs-Link-Platzhalter im HTML-Body; für den 6-stelligen
    // Einmalcode ist sendServiceEmail die korrekte Variante.
    let subject = "iReport Legal – E-Mail-Adresse bestätigen";
    let htmlBody = "<html><body>"
      # "<p>Ihr Bestätigungscode für iReport Legal lautet:</p>"
      # "<h2>" # code.toText() # "</h2>"
      # "<p>Der Code ist 15 Minuten gültig.</p>"
      # "<p>Falls Sie diese Registrierung nicht gestartet haben, können Sie diese Nachricht ignorieren.</p>"
      # "</body></html>";
    switch (await EmailClient.sendServiceEmail("no-reply", [email], subject, htmlBody)) {
      case (#err errMsg) {
        // Konkreten Provider-Fehler für die Diagnose loggen (Debug-/Preview-
        // Builds), ohne die öffentliche Fehlermeldung (#sendFailed) zu ändern.
        Debug.print("[registration-verification] sendVerificationCode: E-Mail-Versand fehlgeschlagen für " # email # ": " # errMsg);
        return #err (#sendFailed);
      };
      case (#ok) {};
    };

    // 7. PendingRegistration NUR bei Send-Erfolg persistieren.
    let pending : RegTypes.PendingRegistration = {
      id = targetId;
      kanzleiName;
      titel;
      vorname;
      nachname;
      email;
      zahlungsmodalitaet;
      verificationCodeHash = codeHash;
      verificationExpiresAt = now + CODE_TTL_NS;
      verificationAttempts = 0;
      lastCodeSentAt = now;
      emailVerified = false;
      verifiedAt = null;
      createdAt = now;
    };
    pendingRegistrations.add(targetId, pending);

    #ok targetId;
  };

  // Prüft den eingegebenen Code gegen den gespeicherten Hash, die 15-Minuten-
  // Gültigkeit und das Maximum von 5 Fehlversuchen. Bei korrektem Code:
  // emailVerified = true, verifiedAt setzen, Code sofort ungültig machen.
  public func verifyEmail(
    pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
    pendingId : RegTypes.PendingRegistrationId,
    code : Text,
  ) : Common.Result<(), RegTypes.VerificationError> {
    switch (pendingRegistrations.get(pendingId)) {
      case null { #err (#notFound) };
      case (?p) {
        let now = Time.now();
        // Abgelaufener Code (15 Min).
        if (now > p.verificationExpiresAt) {
          return #err (#codeExpired);
        };
        // Zu viele Fehlversuche.
        if (p.verificationAttempts >= MAX_ATTEMPTS) {
          return #err (#tooManyAttempts);
        };
        // Hash vergleichen.
        let inputHash = toHex(Sha256.fromBlob(#sha256, code.encodeUtf8()));
        if (inputHash != p.verificationCodeHash) {
          // Fehlversuch inkrementieren.
          let updated : RegTypes.PendingRegistration = {
            p with verificationAttempts = p.verificationAttempts + 1;
          };
          pendingRegistrations.add(pendingId, updated);
          return #err (#invalidCode);
        };
        // Erfolg: emailVerified = true, verifiedAt setzen, Code sofort ungültig.
        let verified : RegTypes.PendingRegistration = {
          p with
          emailVerified = true;
          verifiedAt = ?now;
          verificationCodeHash = "";
          verificationExpiresAt = 0;
        };
        pendingRegistrations.add(pendingId, verified);
        #ok ();
      };
    };
  };

  // Liefert eine sicherheitsbereinigte Sicht auf die PendingRegistration für
  // die Reload-Wiederherstellung (Registrierungsfortsetzung). Die Sicht
  // enthält NIE den verificationCodeHash, damit der offline brute-forcebare
  // 6-stellige Code-Hash nicht öffentlich exponiert wird. Abgelaufene
  // PendingRegistrations werden bei Zugriff bereinigt und als null
  // zurückgegeben.
  public func getPendingRegistration(
    pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
    pendingId : RegTypes.PendingRegistrationId,
  ) : ?RegTypes.PendingRegistrationView {
    switch (pendingRegistrations.get(pendingId)) {
      case null null;
      case (?p) {
        let now = Time.now();
        // Abgelaufen (24h) → bereinigen und null zurückgeben.
        if (now - p.createdAt >= PENDING_TTL_NS) {
          pendingRegistrations.remove(pendingId);
          null;
        } else {
          ?{
            id = p.id;
            kanzleiName = p.kanzleiName;
            titel = p.titel;
            vorname = p.vorname;
            nachname = p.nachname;
            email = p.email;
            zahlungsmodalitaet = p.zahlungsmodalitaet;
            emailVerified = p.emailVerified;
            verifiedAt = p.verifiedAt;
            createdAt = p.createdAt;
          };
        };
      };
    };
  };

  // Ändert die E-Mail-Adresse im selben Pending-Flow. Setzt emailVerified
  // zurück und erfordert einen neuen Verifizierungscode. Eine bereits
  // bestätigte E-Mail kann nicht still geändert werden.
  public func changeEmail(
    pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
    pendingId : RegTypes.PendingRegistrationId,
    newEmail : Text,
  ) : Common.Result<(), RegTypes.VerificationError> {
    // Neue E-Mail syntaktisch prüfen.
    if (not isValidEmail(newEmail)) {
      return #err (#invalidInput);
    };
    switch (pendingRegistrations.get(pendingId)) {
      case null { #err (#notFound) };
      case (?p) {
        // E-Mail ändern: emailVerified zurücksetzen, neuer Code erforderlich.
        let updated : RegTypes.PendingRegistration = {
          p with
          email = newEmail;
          emailVerified = false;
          verifiedAt = null;
          verificationCodeHash = "";
          verificationExpiresAt = 0;
          verificationAttempts = 0;
        };
        pendingRegistrations.add(pendingId, updated);
        #ok ();
      };
    };
  };

  // Schliesst die Registrierung ab: verknüpft die Internet-Identity-Identität
  // (caller) mit der PendingRegistration, legt erst dann genau eine definitive
  // Kanzlei und einen Benutzer mit bestehender Rolle und gewählter
  // Zahlungsmodalität an (Reuse von registerKanzlei/getOrCreateUser-Logik) und
  // entfernt die PendingRegistration. Idempotent und gegen Double Submit
  // geschützt: bereits registrierte E-Mail-Adressen und bereits verwendete
  // Principals werden abgelehnt.
  public func completeRegistration(
    pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
    kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
    users : Map.Map<Principal, Types.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    rechnungsvorlagen : Map.Map<Common.KanzleiId, VorlagenTypes.Rechnungsvorlage>,
    caller : Principal,
    pendingId : RegTypes.PendingRegistrationId,
  ) : Common.Result<Common.KanzleiId, RegTypes.VerificationError> {
    switch (pendingRegistrations.get(pendingId)) {
      case null { #err (#notFound) };
      case (?p) {
        // E-Mail muss bestätigt sein.
        if (not p.emailVerified) {
          return #err (#invalidInput);
        };

        let kanzleiId : Common.KanzleiId = caller.toText();

        // Idempotenz / Double-Submit-Schutz: falls für diesen caller bereits
        // eine Kanzlei existiert (z.B. durch parallelen Abschluss), die
        // bestehende zurückgeben statt eine zweite anzulegen.
        switch (kanzleien.get(kanzleiId)) {
          case (?_) {
            pendingRegistrations.remove(pendingId);
            return #ok kanzleiId;
          };
          case null {};
        };

        // Bereits verwendete Internet Identity / Principal ablehnen.
        if (users.get(caller) != null) {
          return #err (#principalAlreadyUsed);
        };

        // Bereits registrierte E-Mail-Adresse ablehnen.
        var emailAlreadyUsed = false;
        for (u in users.values()) {
          if (u.email == p.email) {
            emailAlreadyUsed := true;
          };
        };
        if (emailAlreadyUsed) {
          return #err (#alreadyRegistered);
        };

        // Genau eine Kanzlei + Benutzer anlegen (Reuse registerKanzlei).
        switch (KanzleiLib.registerKanzlei(
          kanzleien,
          users,
          superAdminWhitelist,
          rechnungsvorlagen,
          caller,
          p.kanzleiName,
          p.titel,
          p.vorname,
          p.nachname,
          p.email,
          p.zahlungsmodalitaet,
        )) {
          case (#err _) { #err (#invalidInput) };
          case (#ok id) {
            pendingRegistrations.remove(pendingId);
            #ok id;
          };
        };
      };
    };
  };
};
