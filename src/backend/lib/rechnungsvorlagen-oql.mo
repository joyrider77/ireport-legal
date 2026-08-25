// OQL entity declarations for the Rechnungsvorlagen domain.
//
// Exposes the persisted rechnungsvorlagen collection
// (Map<KanzleiId, Rechnungsvorlage>) as an OQL-queryable entity.
//
// Authorization: #controllerOnly (the most restrictive built-in TableAuth
// level — only the canister controller can query), matching the existing
// Datenschutz, Super-Admin and Stopwatch/Budget entities. App-level
// admin-role enforcement is handled separately at the application layer
// (RechnungsvorlagenApi mixin: requireKanzleiAdmin on save/upload/remove,
// kanzlei-membership on read). OQL is an additional read surface for the
// controller, not a replacement for the mixin's RBAC.
//
// Variant-typed fields (absenderPosition, empfaengerPosition, logoPosition)
// are rendered to Text in their _toRow extractors and surfaced to schema()
// via .domain(...) so clients filter with the exact literals.
// Nested record fields (layout, standardtexte) are inlined as individual
// .payload(...) columns so each field is individually queryable.

import Common "../types/common";
import Types "../types/rechnungsvorlagen";
import Map "mo:core/Map";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import TextValue "mo:caffeineai-oql/TextValue";
import IntValue "mo:caffeineai-oql/IntValue";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  type Decl = OQL.Decl;

  // ─── Variant → Text renderers ──────────────────────────────────────────────

  func positionToText(p : Types.Position) : Text = switch p {
    case (#links) "links";
    case (#rechts) "rechts";
    case (#zentriert) "zentriert";
  };

  func logoBlobToText(b : ?Storage.ExternalBlob) : Text = switch b {
    case null "kein Logo";
    case (?_) "Logo vorhanden";
  };

  // ─── Optional → primitive helpers ──────────────────────────────────────────

  func optTextToText(v : ?Text) : Text = switch v {
    case (?t) t;
    case null "";
  };

  // ─── Entity builder ────────────────────────────────────────────────────────
  //
  // rechnungsvorlagen: Rechnungsvorlage — keyed by kanzleiId (Text).
  // The value record carries kanzleiId as a field, so iterating values via
  // .toEntityManual is sufficient (no key promotion needed). Nested record
  // fields (layout, standardtexte) are inlined as individual .payload(...)
  // columns (matching the datenschutz-oql.mo pattern, which uses only
  // .payload — .flatten requires a flat record and an implicit
  // FlatLayout -> Entity.Row instance that the package does not provide).
  // Variant position fields are rendered to Text and surfaced to schema()
  // via .domain(...) so clients filter with the exact literals.

  public func rechnungsvorlageEntity(
    rechnungsvorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
  ) : Decl {
    rechnungsvorlagen.toEntityManual(
      "rechnungsvorlagen",
      "Rechnungsvorlage",
      "kanzleiId",
    )
      .payload("kanzleiId", func (e : Types.Rechnungsvorlage) : Text = e.kanzleiId)
      .payload("absenderPosition", func (e : Types.Rechnungsvorlage) : Text = positionToText(e.layout.absenderPosition))
      .payload("empfaengerPosition", func (e : Types.Rechnungsvorlage) : Text = positionToText(e.layout.empfaengerPosition))
      .payload("logoPosition", func (e : Types.Rechnungsvorlage) : Text = positionToText(e.layout.logoPosition))
      .payload("fusszeile", func (e : Types.Rechnungsvorlage) : Text = e.layout.fusszeile)
      .payload("rechnungstitel", func (e : Types.Rechnungsvorlage) : Text = e.standardtexte.rechnungstitel)
      .payload("einleitung", func (e : Types.Rechnungsvorlage) : Text = e.standardtexte.einleitung)
      .payload("zahlungshinweis", func (e : Types.Rechnungsvorlage) : Text = e.standardtexte.zahlungshinweis)
      .payload("schlusstext", func (e : Types.Rechnungsvorlage) : Text = e.standardtexte.schlusstext)
      .payload("logoBlob", func (e : Types.Rechnungsvorlage) : Text = logoBlobToText(e.logoBlob))
      .payload("updatedAt", func (e : Types.Rechnungsvorlage) : Common.Timestamp = e.updatedAt)
      .domain("absenderPosition", [#text "links", #text "rechts", #text "zentriert"])
      .domain("empfaengerPosition", [#text "links", #text "rechts", #text "zentriert"])
      .domain("logoPosition", [#text "links", #text "rechts", #text "zentriert"])
      .controllerOnly()
      .build();
  };

  // ─── Aggregate entity list ─────────────────────────────────────────────────
  //
  // Returns the Rechnungsvorlagen OQL entities for inclusion in
  // Expose({ entities = [...] }) in main.mo.

  public func allEntities(
    rechnungsvorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
  ) : [Decl] = [
    rechnungsvorlageEntity(rechnungsvorlagen),
  ];
};
