import Common "common";
import KanzleiTypes "kanzlei";

module {
  // Abo-Modell, derived from existing Kanzlei.zahlungsmodalitaet field.
  // #jahres → Jahres-Abonnement, #monats → Monats-Abonnement,
  // #keine when zahlungsmodalitaet is null.
  public type AboModell = {
    #jahres;
    #monats;
    #keine;
  };

  // Billing-Status der Kanzlei. Derived from existing data — no new billing
  // storage is added (excluded by doNotBuild). #offen / #bezahlt / #ueberfaellig
  // are placeholders for future billing integration; for now derived as #bezahlt
  // when zahlungsmodalitaet is set, else #offen.
  public type BillingStatus = {
    #offen;
    #bezahlt;
    #ueberfaellig;
  };

  // Übersicht einer Kanzlei aus Sicht des Super-Admin-Moduls.
  // userCount = Anzahl Leistungserbringer dieser Kanzlei (status='aktiv' is
  // defined at the application layer; here we count all registered users of
  // the kanzlei since active-status filtering is owned by the kanzlei domain).
  //
  // Workstream A: erweitert um die Abo-Billing-relevanten Kanzlei-Stammdaten
  // (kanzleiname, uid, mwstNr, adresse). Diese Felder sind optional (Text,
  // "" = nicht gesetzt), da nicht jede Kanzlei bereits Stammdaten erfasst
  // hat. Der Plattform-Admin sieht NUR diese Billing-relevanten Felder —
  // KEINE zusätzlichen fachlichen Mandats-/Klientendaten. Die Felder werden
  // aus kanzlei.stammdaten (KanzleiStammdaten) abgeleitet, falls vorhanden.
  public type KanzleiOverview = {
    id : Common.KanzleiId;
    name : Text;
    userCount : Nat;
    aboModell : AboModell;
    billingStatus : BillingStatus;
    createdAt : Common.Timestamp;
    status : Text;
    // Billing-relevante Kanzlei-Stammdaten (aus kanzlei.stammdaten abgeleitet,
    // "" falls keine Stammdaten erfasst). Der Plattform-Admin sieht nur diese
    // Felder — keine Mandats-/Klientendaten.
    stammdatenKanzleiname : Text;
    stammdatenUid : Text;
    stammdatenMwstNr : Text;
    stammdatenAdresse : Text; // "strasseHausnummer, plz ort, land"
  };

  // Super-Admin whitelist entry. The first Internet Identity registration
  // (when the whitelist is empty) is automatically added as Super-Admin.
  public type SuperAdminWhitelistEntry = {
    principal : Principal;
    addedAt : Common.Timestamp;
  };
};
