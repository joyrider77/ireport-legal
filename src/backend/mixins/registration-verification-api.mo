import Common "../types/common";
import Types "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import VorlagenTypes "../types/rechnungsvorlagen";
import RegTypes "../types/registration-verification";
import RegLib "../lib/registration-verification";
import Map "mo:core/Map";

mixin (
  pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
  kanzleien : Map.Map<Common.KanzleiId, Types.Kanzlei>,
  users : Map.Map<Principal, Types.Leistungserbringer>,
  superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
  rechnungsvorlagen : Map.Map<Common.KanzleiId, VorlagenTypes.Rechnungsvorlage>,
) {
  // Schritt 1 → Schritt 2: erzeugt/aktualisiert eine PendingRegistration,
  // generiert einen 6-stelligen Einmalcode, speichert nur dessen Hash und
  // sendet ihn per E-Mail. Legt noch KEINE definitive Kanzlei und KEINEN
  // definitiven Benutzer an und startet noch KEINE Internet Identity.
  public shared ({ caller }) func sendVerificationCode(
    kanzleiName : Text,
    titel : Text,
    vorname : Text,
    nachname : Text,
    email : Text,
    zahlungsmodalitaet : ?Types.Zahlungsmodalitaet,
  ) : async Common.Result<RegTypes.PendingRegistrationId, RegTypes.VerificationError> {
    await RegLib.sendVerificationCode(
      pendingRegistrations,
      caller,
      kanzleiName,
      titel,
      vorname,
      nachname,
      email,
      zahlungsmodalitaet,
    );
  };

  // Schritt 2: prüft den Einmalcode serverseitig (Hash, 15-Min-Gültigkeit,
  // max. 5 Fehlversuche). Bei Erfolg emailVerified = true und Code ungültig.
  public shared ({ caller }) func verifyEmail(
    pendingId : RegTypes.PendingRegistrationId,
    code : Text,
  ) : async Common.Result<(), RegTypes.VerificationError> {
    RegLib.verifyEmail(pendingRegistrations, pendingId, code);
  };

  // Reload-Wiederherstellung: liefert eine sicherheitsbereinigte Sicht auf die
  // PendingRegistration (ohne verificationCodeHash) für die
  // Registrierungsfortsetzung. Abgelaufene PendingRegistrations werden bei
  // Zugriff bereinigt und als null zurückgegeben.
  public query ({ caller }) func getPendingRegistration(
    pendingId : RegTypes.PendingRegistrationId,
  ) : async ?RegTypes.PendingRegistrationView {
    RegLib.getPendingRegistration(pendingRegistrations, pendingId);
  };

  // 'E-Mail-Adresse ändern': setzt emailVerified zurück und erfordert einen
  // neuen Verifizierungscode. Bereits bestätigte E-Mails können nicht still
  // geändert werden.
  public shared ({ caller }) func changeEmail(
    pendingId : RegTypes.PendingRegistrationId,
    newEmail : Text,
  ) : async Common.Result<(), RegTypes.VerificationError> {
    RegLib.changeEmail(pendingRegistrations, pendingId, newEmail);
  };

  // Schritt 3: verknüpft die Internet-Identity-Identität (caller) mit der
  // PendingRegistration, legt genau eine definitive Kanzlei und einen Benutzer
  // an und entfernt die PendingRegistration. Idempotent / Double-Submit-
  // geschützt.
  public shared ({ caller }) func completeRegistration(
    pendingId : RegTypes.PendingRegistrationId,
  ) : async Common.Result<Common.KanzleiId, RegTypes.VerificationError> {
    RegLib.completeRegistration(
      pendingRegistrations,
      kanzleien,
      users,
      superAdminWhitelist,
      rechnungsvorlagen,
      caller,
      pendingId,
    );
  };
};
