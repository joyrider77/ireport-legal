// OQL entity declarations for the Active-Users domain.
//
// Exposes the two persisted collections that the Active-Users reporting
// (getActiveUsersPerMonth / getAllActiveUsersPerMonth) reads from:
//   kanzleien  (Map<KanzleiId, Kanzlei>)
//   users      (Map<Principal, Leistungserbringer>)
//
// Authorization: every entity uses #controllerOnly (the most restrictive
// built-in TableAuth level — only the canister controller can query),
// matching the existing Datenschutz, Super-Admin, Stopwatch/Budget and
// Rechnungsvorlagen entities. App-level kanzlei-isolation and RBAC are
// enforced separately at the application layer by the ActiveUsersApi /
// SuperAdminApi / KanzleiApi mixins (requireAdmin / isAdminOfKanzlei /
// isSuperAdmin) before any read or write. OQL is an additional read
// surface for the controller, not a replacement for the mixin's RBAC.
//
// Variant-typed fields (Zahlungsmodalitaet, Role) are rendered to Text
// in their _toRow extractors and surfaced to schema() via .domain(...)
// so clients filter with the exact literals. The optional variant
// fields (zahlungsmodalitaet, role) use a sentinel ("") for the null
// case so the field stays queryable.
//
// #plattform_admin: roleToText rendert #plattform_admin als "plattform_admin".
// Die .domain-Aufzählung für role wird um "plattform_admin" ergänzt, sodass
// OQL-Abfragen nach dieser Rolle möglich bleiben (OQL ist controller-only —
// die Maskierung für kanzlei-scoped Aufrufer greift an der App-Schicht, nicht
// hier). statusHistory ist ein Array von Records und kann nicht direkt als
// primitives OQL-Payload exponiert werden; wir exponieren stattdessen
// `statusHistoryCount` (Nat) als queryable Feld, sodass der Controller nach
// Historisierungs-Vorhandensein filtern kann. Die historisierten Status-Daten
// sind über die berechneten Reports (getActiveUsersPerMonth /
// getAllActiveUsersPerMonth) abrufbar.

import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import Map "mo:core/Map";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import TextValue "mo:caffeineai-oql/TextValue";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import Debug "mo:core/Debug";

module {
  type Decl = OQL.Decl;

  // ─── Variant → Text renderers ──────────────────────────────────────────────

  func zahlungsmodalitaetToText(z : KanzleiTypes.Zahlungsmodalitaet) : Text = switch z {
    case (#jahres) "jahres";
    case (#monats) "monats";
  };

  // roleToText ergänzt #plattform_admin → "plattform_admin".
  func roleToText(r : KanzleiTypes.Role) : Text = switch r {
    case (#plattform_admin) "plattform_admin";
    case (#admin) "admin";
    case (#anwalt) "anwalt";
    case (#mitarbeiter) "mitarbeiter";
    case (#mandant) "mandant";
  };

  // ─── Optional → primitive helpers ──────────────────────────────────────────

  func optZahlungsmodalitaetToText(v : ?KanzleiTypes.Zahlungsmodalitaet) : Text = switch v {
    case (?z) zahlungsmodalitaetToText(z);
    case null "";
  };

  func optRoleToText(v : ?KanzleiTypes.Role) : Text = switch v {
    case (?r) roleToText(r);
    case null "";
  };

  // ─── Entity builders ───────────────────────────────────────────────────────

  // kanzleien: Kanzlei — keyed by kanzleiId (Text).
  public func kanzleiEntity(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
  ) : Decl {
    kanzleien.toEntityManual(
      "kanzleien",
      "Kanzlei",
      "id",
    )
      .payload("id", func (e : KanzleiTypes.Kanzlei) : Text = e.id)
      .payload("name", func (e : KanzleiTypes.Kanzlei) : Text = e.name)
      .payload("defaultStundensatz", func (e : KanzleiTypes.Kanzlei) : Nat = e.defaultStundensatz)
      .payload("zahlungsmodalitaet", func (e : KanzleiTypes.Kanzlei) : Text = optZahlungsmodalitaetToText(e.zahlungsmodalitaet))
      .payload("createdAt", func (e : KanzleiTypes.Kanzlei) : Common.Timestamp = e.createdAt)
      // ── Kanzlei-Stammdaten (Workstream A) ────────────────────────────────────
      // Die Stammdaten-Felder werden als Text exponiert ("" Sentinel für
      // null, passend zum bestehenden Pattern). kanzleiLogoBlob (Blob) wird
      // NICHT exponiert — OQL-Payloads sind primitive Werte, und der
      // Controller kann das Logo über die bestehende getLogo-Endpoint
      // abrufen. Die .domain-Aufzählung für land/stammdatenAdresse ist
      // nicht möglich (freie Texteingabe), daher nur .payload ohne
      // .domain. .controllerOnly() bleibt per-Table-Authorization aktiv
      // (siehe bestehender Pattern).
      .payload("stammdatenKanzleiname", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.kanzleiname })
      .payload("stammdatenStrasseHausnummer", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.strasseHausnummer })
      .payload("stammdatenPlz", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.plz })
      .payload("stammdatenOrt", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.ort })
      .payload("stammdatenLand", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.land })
      .payload("stammdatenTelefon", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.telefon })
      .payload("stammdatenEmail", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.email })
      .payload("stammdatenWebsite", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.website })
      .payload("stammdatenUid", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.uid })
      .payload("stammdatenMwstNr", func (e : KanzleiTypes.Kanzlei) : Text = switch (e.stammdaten) { case null ""; case (?s) s.mwstNr })
      .payload("stammdatenHasLogo", func (e : KanzleiTypes.Kanzlei) : Bool = switch (e.stammdaten) {
        case null false;
        case (?s) s.kanzleiLogoBlob != null;
      })
      .domain("zahlungsmodalitaet", [#text "jahres", #text "monats", #text ""])
      .controllerOnly()
      .build();
  };

  // users: Leistungserbringer — keyed by Principal. Optional variant field
  // role is rendered to Text with a "" sentinel. Die .domain-Aufzählung für
  // role wird um "plattform_admin" ergänzt. statusHistoryCount wird als
  // queryable Nat-Feld exponiert (Array-of-Records kann nicht direkt als
  // primitives OQL-Payload exponiert werden).
  public func leistungserbringerEntity(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  ) : Decl {
    users.toEntityManual(
      "users",
      "Leistungserbringer",
      "id",
    )
      .payload("id", func (e : KanzleiTypes.Leistungserbringer) : Principal = e.id)
      .payload("kanzleiId", func (e : KanzleiTypes.Leistungserbringer) : Text = e.kanzleiId)
      .payload("vorname", func (e : KanzleiTypes.Leistungserbringer) : Text = e.vorname)
      .payload("nachname", func (e : KanzleiTypes.Leistungserbringer) : Text = e.nachname)
      .payload("titel", func (e : KanzleiTypes.Leistungserbringer) : Text = e.titel)
      .payload("email", func (e : KanzleiTypes.Leistungserbringer) : Text = e.email)
      .payload("isAdmin", func (e : KanzleiTypes.Leistungserbringer) : Bool = e.isAdmin)
      .payload("role", func (e : KanzleiTypes.Leistungserbringer) : Text = optRoleToText(e.role))
      .payload("status", func (e : KanzleiTypes.Leistungserbringer) : Text = e.status)
      .payload("registeredAt", func (e : KanzleiTypes.Leistungserbringer) : Common.Timestamp = e.registeredAt)
      .payload("statusHistoryCount", func (e : KanzleiTypes.Leistungserbringer) : Nat = e.statusHistory.size())
      .domain("role", [#text "plattform_admin", #text "admin", #text "anwalt", #text "mitarbeiter", #text "mandant", #text ""])
      .domain("status", [#text "aktiv", #text "inaktiv"])
      .controllerOnly()
      .build();
  };

  // ─── Aggregate entity list ─────────────────────────────────────────────────

  public func allEntities(
    kanzleien : Map.Map<Common.KanzleiId, KanzleiTypes.Kanzlei>,
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
  ) : [Decl] = [
    kanzleiEntity(kanzleien),
    leistungserbringerEntity(users),
  ];
};
