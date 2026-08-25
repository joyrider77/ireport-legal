import Common "../types/common";
import KanzleiTypes "../types/kanzlei";
import SuperAdminTypes "../types/super-admin";
import Types "../types/rechnungsvorlagen";
import RolesLib "../lib/roles";
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Blob "mo:core/Blob";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  // Liefert die Vorlage der übergebenen Kanzlei (eine pro Kanzlei).
  // Gibt den VOLLSTÄNDIGEN Record inkl. layoutV2 (mit allen mm-Positionen,
  // Typografie, Sichtbarkeit, Reihenfolge, Seitenrändern) zurück, damit
  // der Frontend-Handler und der Word-Export die vollständige V2-Vorlage
  // erhalten und nicht auf V1 zurückfallen.
  public func getRechnungsvorlage(
    vorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
    kanzleiId : Common.KanzleiId,
  ) : ?Types.Rechnungsvorlage {
    vorlagen.get(kanzleiId);
  };

  // Upsert der Vorlage für eine Kanzlei (genau eine pro Kanzlei).
  // Setzt updatedAt auf Time.now(). Bestehendes logoBlob bleibt erhalten,
  // sofern im übergebenen Record nicht explizit überschrieben.
  //
  // Persistiert das VOLLSTÄNDIGE layoutV2 (alle Elemente mit mm-Positionen,
  // Typografie, Sichtbarkeit, Reihenfolge, Seitenränder). Validiert vor
  // dem Speichern:
  //   - vorlage.kanzleiId == kanzleiId (Tenant-Isolation, Aufrufer-Vertrag)
  //   - Falls layoutV2 nicht null:
  //       * Seitenränder in [MARGIN_MIN_MM, MARGIN_MAX_MM] (5.0–40.0 mm)
  //       * pageWidthMm == PAGE_WIDTH_MM (210.0), pageHeightMm == PAGE_HEIGHT_MM (297.0)
  //       * fontFamily (falls gesetzt) in ALLOWED_FONT_FAMILIES
  //       * fontSize (falls gesetzt) in ALLOWED_FONT_SIZES
  //   - Keine duplizierte Subtotal/MWST/Total-Berechnungslogik (Rechnungs-
  //     fachlogik bleibt im Rechnungen-Domain intakt).
  //
  // Liefert die gespeicherte Vorlage zurück (mit gesetztem updatedAt und
  // preserved logoBlob). Der Response-Shape ist exakt Rechnungsvorlage —
  // der Frontend-Handler dekodiert Common.Result<Rechnungsvorlage, Text>
  // als { #ok : Rechnungsvorlage; #err : Text } (siehe contracts).
  //
  // HINWEIS: Diese Funktion führt die Tenant-Validierung (vorlage.kanzleiId
  // == kanzleiId) und die V2-Feldvalidierung durch, liefert aber bei
  // Validierungsfehlern #err. Das Mixin ruft requireKanzleiAdmin VOR
  // dieser Funktion auf und übergibt die autorisierte kanzleiId des callers.
  public func saveRechnungsvorlage(
    vorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
    kanzleiId : Common.KanzleiId,
    vorlage : Types.Rechnungsvorlage,
  ) : Common.Result<Types.Rechnungsvorlage, Text> {
    // Tenant-Isolation: vorlage.kanzleiId MUSS mit der autorisierten
    // kanzleiId des callers übereinstimmen. Der Aufrufer-Vertrag
    // (requireKanzleiAdmin im Mixin) stellt sicher, dass kanzleiId die
    // echte Kanzlei des callers ist.
    if (vorlage.kanzleiId != kanzleiId) {
      return #err "Vorlage gehört zu einer anderen Kanzlei (Tenant-Isolation verletzt)";
    };
    // V2-Feldvalidierung (nur wenn layoutV2 gesetzt ist).
    switch (vorlage.layoutV2) {
      case null {};
      case (?layoutV2) {
        switch (validatePageDimensions(layoutV2)) {
          case (#err msg) return #err msg;
          case (#ok _) {};
        };
        switch (validateMargins(layoutV2)) {
          case (#err msg) return #err msg;
          case (#ok _) {};
        };
        switch (validateTypography(layoutV2)) {
          case (#err msg) return #err msg;
          case (#ok _) {};
        };
      };
    };
    // logoBlob preservation: falls die übergebene Vorlage logoBlob = null
    // hat, aber eine bestehende Vorlage ein Logo besitzt, wird das
    // bestehende Logo übernommen (der Frontend-Client sendet logoBlob
    // typischerweise nicht im save-Payload — das Logo wird via uploadLogo
    // separat verwaltet).
    let preservedLogoBlob : ?Storage.ExternalBlob = switch (vorlage.logoBlob) {
      case (?blob) ?blob;
      case null switch (vorlagen.get(kanzleiId)) {
        case (?existing) existing.logoBlob;
        case null null;
      };
    };
    let now : Common.Timestamp = Time.now();
    let toStore : Types.Rechnungsvorlage = {
      vorlage with
      logoBlob = preservedLogoBlob;
      updatedAt = now;
    };
    vorlagen.add(kanzleiId, toStore);
    #ok toStore;
  };

  // Speichert das hochgeladene Logo (ExternalBlob) in der Vorlage der
  // Kanzlei. Legt eine leere Vorlage an, falls noch keine existiert.
  // Ersetzt ein bestehendes Logo.
  public func saveLogo(
    vorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
    kanzleiId : Common.KanzleiId,
    logoBlob : Storage.ExternalBlob,
  ) : () {
    let now : Common.Timestamp = Time.now();
    switch (vorlagen.get(kanzleiId)) {
      case (?existing) {
        let updated : Types.Rechnungsvorlage = {
          existing with
          logoBlob = ?logoBlob;
          updatedAt = now;
        };
        vorlagen.add(kanzleiId, updated);
      };
      case null {
        // Keine Vorlage vorhanden — leere Vorlage mit Default-V1-Layout
        // und dem Logo anlegen. layoutV2 bleibt null (V1-Default), bis
        // der Benutzer via saveRechnungsvorlage ein V2-Layout setzt.
        let defaultLayout : Types.VorlageLayout = {
          absenderPosition = #links;
          empfaengerPosition = #links;
          logoPosition = #rechts;
          fusszeile = "";
        };
        let defaultStandardtexte : Types.Standardtexte = {
          rechnungstitel = "Rechnung";
          einleitung = "";
          zahlungshinweis = "";
          schlusstext = "";
        };
        let newVorlage : Types.Rechnungsvorlage = {
          kanzleiId;
          layout = defaultLayout;
          standardtexte = defaultStandardtexte;
          logoBlob = ?logoBlob;
          layoutV2 = null;
          updatedAt = now;
        };
        vorlagen.add(kanzleiId, newVorlage);
      };
    };
  };

  // Entfernt das Logo aus der Vorlage der Kanzlei (setzt logoBlob auf
  // null). Kein Fehler, wenn keine Vorlage oder kein Logo vorhanden.
  public func removeLogo(
    vorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
    kanzleiId : Common.KanzleiId,
  ) : () {
    switch (vorlagen.get(kanzleiId)) {
      case (?existing) {
        let updated : Types.Rechnungsvorlage = {
          existing with
          logoBlob = null;
          updatedAt = Time.now();
        };
        vorlagen.add(kanzleiId, updated);
      };
      case null {};
    };
  };

  // Liefert das Logo (ExternalBlob) der Vorlage der Kanzlei, falls
  // vorhanden. null, wenn keine Vorlage oder kein Logo existiert.
  public func getLogo(
    vorlagen : Map.Map<Common.KanzleiId, Types.Rechnungsvorlage>,
    kanzleiId : Common.KanzleiId,
  ) : ?Storage.ExternalBlob {
    switch (vorlagen.get(kanzleiId)) {
      case (?existing) existing.logoBlob;
      case null null;
    };
  };

  // Admin-Gating-Helper: prüft, ob der caller ein Kanzlei-Admin ist
  // (deriveRole == #admin) und derselben Kanzlei angehört. Liefert
  // #ok mit der KanzleiId bei Erfolg, #err mit deutscher Meldung sonst.
  // Verwendet deriveRole aus lib/roles.mo (role-Feld bevorzugt über
  // isAdmin) und berücksichtigt die Super-Admin-Whitelist.
  //
  // Tenant-Isolation bleibt strikt erhalten — KEINE Änderung an dieser
  // Logik (siehe AGENTS.md Learnings: requireKanzleiAdmin,
  // vorlage.kanzleiId != kanzleiId check, superAdminWhitelist).
  //
  // Liefert #ok(kanzleiId) — die kanzleiId des callers, die anschliessend
  // an saveRechnungsvorlage übergeben wird, damit der Tenant-Check
  // (vorlage.kanzleiId == kanzleiId) korrekt funktioniert.
  public func requireKanzleiAdmin(
    users : Map.Map<Principal, KanzleiTypes.Leistungserbringer>,
    superAdminWhitelist : Map.Map<Principal, SuperAdminTypes.SuperAdminWhitelistEntry>,
    caller : Principal,
  ) : Common.Result<Common.KanzleiId, Text> {
    // Super-Admin → immer erlaubt. Die kanzleiId des Super-Admins wird
    // aus seinem Leistungserbringer-Record gelesen (Super-Admins sind
    // ebenfalls registriert). Falls der Super-Admin keinen
    // Leistungserbringer-Record hat (sollte nicht vorkommen), trap.
    let isSuperAdmin : Bool = superAdminWhitelist.get(caller) != null;
    switch (users.get(caller)) {
      case null {
        if (isSuperAdmin) {
          // Super-Admin ohne registrierten Leistungserbringer-Record —
          // kann keine kanzleiId ableiten. Trap, da saveRechnungsvorlage
          // eine kanzleiId benötigt.
          #err "Super-Admin ohne zugeordnete Kanzlei — kann Vorlage nicht zuordnen";
        } else {
          #err "Benutzer nicht registriert";
        };
      };
      case (?u) {
        // Super-Admins umgehen die Rollenprüfung, müssen aber eine
        // kanzleiId haben (aus ihrem Leistungserbringer-Record).
        if (isSuperAdmin) {
          return #ok(u.kanzleiId);
        };
        // Rolle ableiten: role-Feld bevorzugt, isAdmin als Fallback.
        let role : KanzleiTypes.Role = RolesLib.deriveRole(u.isAdmin, u.role);
        switch (role) {
          case (#plattform_admin) #ok(u.kanzleiId);
          case (#admin) #ok(u.kanzleiId);
          case (_) #err "Nur Kanzlei-Administratoren dürfen Vorlagen speichern";
        };
      };
    };
  };

  // ── V2-Validierungs-Helper ────────────────────────────────────────────────
  //
  // Diese Helper kapseln die Validierung der neuen mm-Felder und
  // Seitenränder. Sie werden von saveRechnungsvorlage aufgerufen, bevor
  // die Vorlage persistiert wird. Bei Validierungsfehlern liefert
  // saveRechnungsvorlage #err mit deutscher Meldung.

  // Validiert die Seitenränder einer V2-Vorlage. Liefert #ok bei gültigen
  // Werten (alle in [MARGIN_MIN_MM, MARGIN_MAX_MM]), #err mit deutscher
  // Meldung sonst.
  public func validateMargins(
    layoutV2 : Types.VorlageLayoutV2,
  ) : Common.Result<(), Text> {
    if (layoutV2.marginTopMm < Types.MARGIN_MIN_MM or layoutV2.marginTopMm > Types.MARGIN_MAX_MM) {
      return #err("Seitenrand oben muss zwischen " # Types.MARGIN_MIN_MM.toText() # " und " # Types.MARGIN_MAX_MM.toText() # " mm liegen");
    };
    if (layoutV2.marginBottomMm < Types.MARGIN_MIN_MM or layoutV2.marginBottomMm > Types.MARGIN_MAX_MM) {
      return #err("Seitenrand unten muss zwischen " # Types.MARGIN_MIN_MM.toText() # " und " # Types.MARGIN_MAX_MM.toText() # " mm liegen");
    };
    if (layoutV2.marginLeftMm < Types.MARGIN_MIN_MM or layoutV2.marginLeftMm > Types.MARGIN_MAX_MM) {
      return #err("Seitenrand links muss zwischen " # Types.MARGIN_MIN_MM.toText() # " und " # Types.MARGIN_MAX_MM.toText() # " mm liegen");
    };
    if (layoutV2.marginRightMm < Types.MARGIN_MIN_MM or layoutV2.marginRightMm > Types.MARGIN_MAX_MM) {
      return #err("Seitenrand rechts muss zwischen " # Types.MARGIN_MIN_MM.toText() # " und " # Types.MARGIN_MAX_MM.toText() # " mm liegen");
    };
    #ok ();
  };

  // Validiert die Typografie-Felder (fontFamily, fontSize) aller
  // LayoutElemente einer V2-Vorlage. Liefert #ok bei gültigen Werten,
  // #err mit deutscher Meldung sonst.
  public func validateTypography(
    layoutV2 : Types.VorlageLayoutV2,
  ) : Common.Result<(), Text> {
    let allowedFonts : [Text] = Types.ALLOWED_FONT_FAMILIES;
    let allowedSizes : [Nat] = Types.ALLOWED_FONT_SIZES;
    for (element : Types.LayoutElement in layoutV2.elements.values()) {
      // fontFamily prüfen (falls gesetzt).
      switch (element.fontFamily) {
        case null {};
        case (?font) {
          let found : Bool = allowedFonts.any(func(f : Text) : Bool { f == font });
          if (not found) {
            return #err("Schriftart '" # font # "' ist nicht erlaubt. Erlaubt: Arial, Helvetica, Times New Roman");
          };
        };
      };
      // fontSize prüfen (falls gesetzt).
      switch (element.fontSize) {
        case null {};
        case (?size) {
          let found : Bool = allowedSizes.any(func(s : Nat) : Bool { s == size });
          if (not found) {
            return #err("Schriftgröße " # size.toText() # " ist nicht erlaubt");
          };
        };
      };
    };
    #ok ();
  };

  // Validiert die Seiten-Dimensionen einer V2-Vorlage. Liefert #ok, wenn
  // pageWidthMm == PAGE_WIDTH_MM und pageHeightMm == PAGE_HEIGHT_MM,
  // #err mit deutscher Meldung sonst.
  public func validatePageDimensions(
    layoutV2 : Types.VorlageLayoutV2,
  ) : Common.Result<(), Text> {
    if (layoutV2.pageWidthMm != Types.PAGE_WIDTH_MM) {
      return #err("Seitenbreite muss " # Types.PAGE_WIDTH_MM.toText() # " mm (A4 Hochformat) betragen");
    };
    if (layoutV2.pageHeightMm != Types.PAGE_HEIGHT_MM) {
      return #err("Seitenhöhe muss " # Types.PAGE_HEIGHT_MM.toText() # " mm (A4 Hochformat) betragen");
    };
    #ok ();
  };
};
