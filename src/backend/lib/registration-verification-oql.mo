// OQL entity declarations for the Registration-Verification domain.
//
// Exposes the persisted pendingRegistrations collection
// (Map<PendingRegistrationId, PendingRegistration>) as an OQL-queryable
// entity.
//
// Authorization: #controllerOnly (the most restrictive built-in TableAuth
// level — only the canister controller can query), matching the existing
// Datenschutz, Super-Admin, Stopwatch/Budget, Rechnungsvorlagen and
// Active-Users entities. PendingRegistrations carry sensitive verification
// state, so the controller-only surface is the appropriate per-table
// authorization. App-level RBAC is enforced separately at the application
// layer by the RegistrationVerificationApi mixin.
//
// Security: the verificationCodeHash field is deliberately NOT exposed as
// an OQL payload. It is a hash of the one-time code and must never leak to
// any caller, so it is omitted entirely from the entity. The remaining
// fields (id, kanzleiName, titel, vorname, nachname, email,
// zahlungsmodalitaet, verificationExpiresAt, verificationAttempts,
// lastCodeSentAt, emailVerified, verifiedAt, createdAt) are all queryable.
//
// Variant-typed field zahlungsmodalitaet is rendered to Text in its
// extractor and surfaced to schema() via .domain(...) so clients filter
// with the exact literals. The optional variant field uses a sentinel ("")
// for the null case so the field stays queryable. The optional verifiedAt
// (?Timestamp) uses a 0 sentinel for the null case so the field stays
// queryable.

import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import RegTypes "../types/registration-verification";
import Map "mo:core/Map";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import TextValue "mo:caffeineai-oql/TextValue";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import BoolValue "mo:caffeineai-oql/BoolValue";

module {
  type Decl = OQL.Decl;

  // ─── Variant → Text renderers ──────────────────────────────────────────────

  func zahlungsmodalitaetToText(z : KanzleiTypes.Zahlungsmodalitaet) : Text = switch z {
    case (#jahres) "jahres";
    case (#monats) "monats";
  };

  // ─── Optional → primitive helpers ──────────────────────────────────────────

  func optZahlungsmodalitaetToText(v : ?KanzleiTypes.Zahlungsmodalitaet) : Text = switch v {
    case (?z) zahlungsmodalitaetToText(z);
    case null "";
  };

  func optVerifiedAtToInt(v : ?Common.Timestamp) : Int = switch v {
    case (?t) t;
    case null 0;
  };

  // ─── Entity builders ───────────────────────────────────────────────────────

  // pendingRegistrations: PendingRegistration — keyed by id (Text).
  // #controllerOnly per-table authorization. verificationCodeHash is
  // deliberately NOT exposed (sensitive one-time-code hash).
  public func pendingRegistrationEntity(
    pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
  ) : Decl {
    pendingRegistrations.toEntityManual(
      "pendingRegistrations",
      "PendingRegistration",
      "id",
    )
      .payload("id", func (e : RegTypes.PendingRegistration) : Text = e.id)
      .payload("kanzleiName", func (e : RegTypes.PendingRegistration) : Text = e.kanzleiName)
      .payload("titel", func (e : RegTypes.PendingRegistration) : Text = e.titel)
      .payload("vorname", func (e : RegTypes.PendingRegistration) : Text = e.vorname)
      .payload("nachname", func (e : RegTypes.PendingRegistration) : Text = e.nachname)
      .payload("email", func (e : RegTypes.PendingRegistration) : Text = e.email)
      .payload("zahlungsmodalitaet", func (e : RegTypes.PendingRegistration) : Text = optZahlungsmodalitaetToText(e.zahlungsmodalitaet))
      .payload("verificationExpiresAt", func (e : RegTypes.PendingRegistration) : Int = e.verificationExpiresAt)
      .payload("verificationAttempts", func (e : RegTypes.PendingRegistration) : Nat = e.verificationAttempts)
      .payload("lastCodeSentAt", func (e : RegTypes.PendingRegistration) : Int = e.lastCodeSentAt)
      .payload("emailVerified", func (e : RegTypes.PendingRegistration) : Bool = e.emailVerified)
      .payload("verifiedAt", func (e : RegTypes.PendingRegistration) : Int = optVerifiedAtToInt(e.verifiedAt))
      .payload("createdAt", func (e : RegTypes.PendingRegistration) : Int = e.createdAt)
      .domain("zahlungsmodalitaet", [#text "jahres", #text "monats", #text ""])
      .controllerOnly()
      .build();
  };

  // ─── Aggregate entity list ─────────────────────────────────────────────────
  //
  // Returns the Registration-Verification OQL entities for inclusion in
  // Expose({ entities = [...] }) in main.mo.

  public func allEntities(
    pendingRegistrations : Map.Map<RegTypes.PendingRegistrationId, RegTypes.PendingRegistration>,
  ) : [Decl] = [
    pendingRegistrationEntity(pendingRegistrations),
  ];
};
