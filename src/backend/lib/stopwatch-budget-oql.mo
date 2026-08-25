// OQL entity declarations for the Stopwatch/Budget domain.
//
// Exposes 4 collections as OQL-queryable entities:
//   timers (transient running stopwatch state),
//   leistungen (persisted Leistungen),
//   auslagen (persisted Auslagen),
//   mandate (persisted Mandate).
//
// Authorization: every entity uses #controllerOnly (the most restrictive
// built-in TableAuth level — only the canister controller can query),
// matching the existing Datenschutz and Super-Admin entities. App-level
// kanzlei-isolation and RBAC are enforced separately at the application
// layer by the StopwatchBudgetApi / LeistungenApi / KlientenApi mixins
// before any read or write. OQL is an additional read surface for the
// controller, not a replacement for the mixin's RBAC.
//
// Variant-typed fields (LeistungStatus, AuslagenKategorie, Auslagenregelung,
// MandatStatus) are rendered to Text in their _toRow extractors and surfaced
// to schema() via .domain(...) so clients filter with the exact literals.
// Float-typed fields on Mandat are rendered to Text (no OQL Float value
// instance is available) so they remain queryable as text-equality filters.

import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import KlientenTypes "../types/klienten";
import LeistungTypes "../types/leistungen";
import StopwatchBudgetTypes "../types/stopwatch-budget";
import Map "mo:core/Map";
import OQL "mo:caffeineai-oql";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import TextValue "mo:caffeineai-oql/TextValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import IntValue "mo:caffeineai-oql/IntValue";
import BoolValue "mo:caffeineai-oql/BoolValue";
import NatValue "mo:caffeineai-oql/NatValue";
import Principal "mo:core/Principal";

module {
  type Decl = OQL.Decl;

  // ─── Variant → Text renderers ──────────────────────────────────────────────

  func leistungStatusToText(s : LeistungTypes.LeistungStatus) : Text = switch s {
    case (#offen) "offen";
    case (#verrechnet) "verrechnet";
  };

  func auslagenKategorieToText(k : LeistungTypes.AuslagenKategorie) : Text = switch k {
    case (#porto) "porto";
    case (#kopien) "kopien";
    case (#reise) "reise";
    case (#andere) "andere";
  };

  func auslagenStatusToText(s : LeistungTypes.AuslagenStatus) : Text = switch s {
    case (#offen) "offen";
    case (#verrechnet) "verrechnet";
  };

  func auslagenregelungToText(a : KlientenTypes.Auslagenregelung) : Text = switch a {
    case (#Keine) "Keine";
    case (#Effektiv) "Effektiv";
    case (#Pauschal) "Pauschal";
  };

  func mandatStatusToText(s : KlientenTypes.MandatStatus) : Text = switch s {
    case (#aktiv) "aktiv";
    case (#archiviert) "archiviert";
  };

  // ─── Optional → primitive helpers ──────────────────────────────────────────
  //
  // OQL's .payload(name, extract, _toRow) requires an implicit V -> Value
  // instance. The package provides instances for primitives (Text, Nat, Int,
  // Bool, Principal) but NOT for option types. We therefore render optionals
  // to primitives (empty Text / anonymous Principal / 0 Int) so the existing
  // implicit instances apply.

  func optTextToText(v : ?Text) : Text = switch v {
    case (?t) t;
    case null "";
  };

  func optPrincipalToPrincipal(v : ?Principal) : Principal = switch v {
    case (?p) p;
    case null Principal.fromText("aaaaa-aa");
  };

  func floatToText(f : Float) : Text = f.toText();

  // ─── Entity builders ───────────────────────────────────────────────────────

  // timers: TimerState — transient running stopwatch state.
  // Keyed by leistungId (Text). All flat fields, no variants.
  public func timerEntity(
    timers : Map.Map<Common.LeistungId, StopwatchBudgetTypes.TimerState>,
  ) : Decl {
    timers.toEntityManual(
      "timers",
      "TimerState",
      "leistungId",
    )
      .payload("leistungId", func (e : StopwatchBudgetTypes.TimerState) : Text = e.leistungId)
      .payload("userId", func (e : StopwatchBudgetTypes.TimerState) : Principal = e.userId)
      .payload("startTime", func (e : StopwatchBudgetTypes.TimerState) : Int = e.startTime)
      .payload("baseDauer", func (e : StopwatchBudgetTypes.TimerState) : Nat = e.baseDauer)
      .controllerOnly()
      .build();
  };

  // leistungen: Leistung — variant field status.
  public func leistungEntity(
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
  ) : Decl {
    leistungen.toEntityManual(
      "leistungen",
      "Leistung",
      "id",
    )
      .payload("id", func (e : LeistungTypes.Leistung) : Text = e.id)
      .payload("mandatId", func (e : LeistungTypes.Leistung) : Text = e.mandatId)
      .payload("kanzleiId", func (e : LeistungTypes.Leistung) : Text = e.kanzleiId)
      .payload("leistungserbringerId", func (e : LeistungTypes.Leistung) : Principal = e.leistungserbringerId)
      .payload("taetigkeit", func (e : LeistungTypes.Leistung) : Text = e.taetigkeit)
      .payload("datum", func (e : LeistungTypes.Leistung) : Text = e.datum)
      .payload("dauer", func (e : LeistungTypes.Leistung) : Nat = e.dauer)
      .payload("honorar", func (e : LeistungTypes.Leistung) : Nat = e.honorar)
      .payload("status", func (e : LeistungTypes.Leistung) : Text = leistungStatusToText(e.status))
      .payload("rechnungId", func (e : LeistungTypes.Leistung) : Text = optTextToText(e.rechnungId))
      .payload("createdAt", func (e : LeistungTypes.Leistung) : Common.Timestamp = e.createdAt)
      .domain("status", [#text "offen", #text "verrechnet"])
      .controllerOnly()
      .build();
  };

  // auslagen: Auslage — variant fields kategorie, status.
  public func auslageEntity(
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
  ) : Decl {
    auslagen.toEntityManual(
      "auslagen",
      "Auslage",
      "id",
    )
      .payload("id", func (e : LeistungTypes.Auslage) : Text = e.id)
      .payload("mandatId", func (e : LeistungTypes.Auslage) : Text = e.mandatId)
      .payload("kanzleiId", func (e : LeistungTypes.Auslage) : Text = e.kanzleiId)
      .payload("leistungserbringerId", func (e : LeistungTypes.Auslage) : Principal = e.leistungserbringerId)
      .payload("beschreibung", func (e : LeistungTypes.Auslage) : Text = e.beschreibung)
      .payload("kategorie", func (e : LeistungTypes.Auslage) : Text = auslagenKategorieToText(e.kategorie))
      .payload("betrag", func (e : LeistungTypes.Auslage) : Nat = e.betrag)
      .payload("datum", func (e : LeistungTypes.Auslage) : Text = e.datum)
      .payload("status", func (e : LeistungTypes.Auslage) : Text = auslagenStatusToText(e.status))
      .payload("rechnungId", func (e : LeistungTypes.Auslage) : Text = optTextToText(e.rechnungId))
      .payload("createdAt", func (e : LeistungTypes.Auslage) : Common.Timestamp = e.createdAt)
      .domain("kategorie", [#text "porto", #text "kopien", #text "reise", #text "andere"])
      .domain("status", [#text "offen", #text "verrechnet"])
      .controllerOnly()
      .build();
  };

  // mandate: Mandat — variant fields auslagenregelung, status; Float fields
  // rendered to Text (no OQL Float value instance).
  public func mandatEntity(
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
  ) : Decl {
    mandate.toEntityManual(
      "mandate",
      "Mandat",
      "id",
    )
      .payload("id", func (e : KlientenTypes.Mandat) : Text = e.id)
      .payload("klientId", func (e : KlientenTypes.Mandat) : Text = e.klientId)
      .payload("kanzleiId", func (e : KlientenTypes.Mandat) : Text = e.kanzleiId)
      .payload("bezeichnung", func (e : KlientenTypes.Mandat) : Text = e.bezeichnung)
      .payload("akquisiteurId", func (e : KlientenTypes.Mandat) : Principal = e.akquisiteurId)
      .payload("akquisitionsbonus", func (e : KlientenTypes.Mandat) : Nat = e.akquisitionsbonus)
      .payload("mwstSatz", func (e : KlientenTypes.Mandat) : Nat = e.mwstSatz)
      .payload("budget", func (e : KlientenTypes.Mandat) : Nat = e.budget)
      .payload("rundungAktiv", func (e : KlientenTypes.Mandat) : Bool = e.rundungAktiv)
      .payload("auslagenregelung", func (e : KlientenTypes.Mandat) : Text = auslagenregelungToText(e.auslagenregelung))
      .payload("zahlungsbedingungen", func (e : KlientenTypes.Mandat) : Text = e.zahlungsbedingungen)
      .payload("status", func (e : KlientenTypes.Mandat) : Text = mandatStatusToText(e.status))
      .payload("waehrung", func (e : KlientenTypes.Mandat) : Text = e.waehrung)
      .payload("standardStundensatz", func (e : KlientenTypes.Mandat) : Nat = e.standardStundensatz)
      .payload("kostenProKopie", func (e : KlientenTypes.Mandat) : Text = floatToText(e.kostenProKopie))
      .payload("kostenProScan", func (e : KlientenTypes.Mandat) : Text = floatToText(e.kostenProScan))
      .payload("portoAPost", func (e : KlientenTypes.Mandat) : Text = floatToText(e.portoAPost))
      .payload("portoBPost", func (e : KlientenTypes.Mandat) : Text = floatToText(e.portoBPost))
      .payload("portoEinschreiben", func (e : KlientenTypes.Mandat) : Text = floatToText(e.portoEinschreiben))
      .payload("autokilometer", func (e : KlientenTypes.Mandat) : Text = floatToText(e.autokilometer))
      .payload("leistungenAusweisen", func (e : KlientenTypes.Mandat) : Bool = e.leistungenAusweisen)
      .payload("createdAt", func (e : KlientenTypes.Mandat) : Common.Timestamp = e.createdAt)
      .domain("auslagenregelung", [#text "Keine", #text "Effektiv", #text "Pauschal"])
      .domain("status", [#text "aktiv", #text "archiviert"])
      .controllerOnly()
      .build();
  };

  // ─── Aggregate entity list ─────────────────────────────────────────────────
  //
  // Returns the Stopwatch/Budget OQL entities for inclusion in
  // Expose({ entities = [...] }) in main.mo.

  public func allEntities(
    timers : Map.Map<Common.LeistungId, StopwatchBudgetTypes.TimerState>,
    leistungen : Map.Map<Common.LeistungId, LeistungTypes.Leistung>,
    auslagen : Map.Map<Common.AuslageId, LeistungTypes.Auslage>,
    mandate : Map.Map<Common.MandatId, KlientenTypes.Mandat>,
  ) : [Decl] = [
    timerEntity(timers),
    leistungEntity(leistungen),
    auslageEntity(auslagen),
    mandatEntity(mandate),
  ];
};
