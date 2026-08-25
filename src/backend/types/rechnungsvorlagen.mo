import Common "common";
import Storage "mo:caffeineai-object-storage/Storage";

module {
  // Positionierungsoptionen für Absender-, Empfängeradresse und Logo
  public type Position = {
    #links;
    #rechts;
    #zentriert;
  };

  // Layout-Steuerung des Rechnungsvorlagen-Exports (PDF/Word)
  // Bestehendes V1-Layout — bleibt unverändert erhalten (Backward-Compat).
  // Neue Vorlagen können zusätzlich layoutV2 (Raster-basiertes Drag-&-Drop-
  // Layout) setzen; bestehende Vorlagen laden mit layoutV2 = null.
  public type VorlageLayout = {
    absenderPosition : Position;
    empfaengerPosition : Position;
    logoPosition : Position;
    fusszeile : Text;
  };

  // Editierbare Standardtexte für den Rechnungs-Export
  public type Standardtexte = {
    rechnungstitel : Text;
    einleitung : Text;
    zahlungshinweis : Text;
    schlusstext : Text;
  };

  // ── V2-Layout: Raster-basierter Drag-&-Drop-Editor ──────────────────────────
  //
  // Das V2-Layout-Modell behandelt jedes Rechnungselement als eigenständig
  // platzierbare Layout-Komponente innerhalb eines Rasters (gridCols ×
  // gridRows). Elemente lassen sich per Drag & Drop (Maus UND Touch/Pointer)
  // neu anordnen, ausblenden/entfernen und über eine Element-Palette wieder
  // hinzufügen. Das Raster mit Snap-to-Grid ersetzt unkontrollierte
  // pixelgenaue Freipositionierung und sorgt für einen robusten PDF-/Word-
  // Export (insbesondere bei variabler Anzahl Leistungspositionen und
  // Seitenumbrüchen).
  //
  // Die bestehenden Links/Zentriert/Rechts-Optionen (Position-Enum) werden
  // innerhalb einer Rasterzelle weiterverwendet (alignment-Feld im
  // LayoutElement, optional — null = Default-Ausrichtung des Renderers).

  // Identifiziert ein Rechnungselement im V2-Layout. Alle 12 Elemente
  // decken die bestehenden Rechnungsbestandteile ab:
  //   #absenderadresse      — Absenderadresse der Kanzlei
  //   #empfaengeradresse    — Empfängeradresse (Klient/Mandant)
  //   #logo                 — Kanzlei-Logo
  //   #rechnungsmetadaten   — Rechnungsüberschrift/-metadaten (Nr., Datum)
  //   #mandatsinfo          — Mandats-/Leistungserbringerinformationen
  //   #einleitung           — Einleitung/Standardtext
  //   #leistungspositionen  — Leistungspositionen (variable Anzahl)
  //   #spesenAuslagen       — Spesen/Auslagen (variable Anzahl, eigenständig)
  //   #summenblock          — Summen-/MWST-Block
  //   #zahlungsinformationen — Zahlungsinformationen
  //   #schlusstext          — Schlusstext (eigenständiges Layout-Element,
  //                          separiert von #zahlungsinformationen; der
  //                          eigentliche Text-Inhalt bleibt in
  //                          standardtexte.schlusstext gespeichert, dieses
  //                          Element steuert nur Geometrie/Sichtbarkeit/
  //                          Typografie)
  //   #fusszeile            — Fusszeile
  //
  // #spesenAuslagen ist additiv hinzugefügt — bestehende persistierte
  // Vorlagen laden ohne dieses Element (es erscheint dann nicht im
  // gerenderten Layout). Neue/migrierte Vorlagen können es setzen.
  //
  // #schlusstext ist additiv hinzugefügt — bestehende persistierte
  // Vorlagen laden ohne dieses Element. Der Text-Inhalt bleibt in
  // standardtexte.schlusstext (legacy Feld) erhalten; das neue Layout-
  // Element steuert ausschliesslich Geometrie/Sichtbarkeit/Typografie
  // und wird im Word-Export getrennt von #zahlungsinformationen
  // gerendert (keine gemeinsame Zelle, kein gemeinsamer Absatzcontainer,
  // keine Style-Vererbung).
  public type LayoutElementId = {
    #absenderadresse;
    #empfaengeradresse;
    #logo;
    #rechnungsmetadaten;
    #mandatsinfo;
    #einleitung;
    #leistungspositionen;
    #spesenAuslagen;
    #summenblock;
    #zahlungsinformationen;
    #schlusstext;
    #fusszeile;
  };

  // Raster-Zellposition und -ausdehnung eines Elements.
  // row/col sind 0-basiert. rowSpan/colSpan ≥ 1.
  // Default-Raster: gridCols = 12, gridRows = 24 (siehe VorlageLayoutV2).
  public type GridArea = {
    row : Nat;
    col : Nat;
    rowSpan : Nat;
    colSpan : Nat;
  };

  // Ein eigenständig platzierbares Rechnungselement im V2-Layout.
  //   id        — Identifiziert das Element (siehe LayoutElementId)
  //   visible   — false = ausgeblendet/entfernt (über Palette wieder
  //               hinzufügbar); true = sichtbar
  //   order     — Sortierindex für die Render-Reihenfolge innerhalb
  //               des Rasters (stabil, aufsteigend)
  //   gridArea  — Rasterposition und -ausdehnung (Snap-to-Grid)
  //   alignment — Optionale Ausrichtung INNERHALB der Rasterzelle
  //               (wiederverwendet das bestehende Position-Enum für
  //               links/zentriert/rechts); null = Renderer-Default
  //   fontFamily — Optionale Schriftart pro Element. Erlaubte Werte
  //                (als Text-Konstanten, siehe ALLOWED_FONT_FAMILIES):
  //                "Arial", "Helvetica", "Times New Roman". null =
  //                Renderer-Default. Word-Export fällt bei fehlender
  //                Helvetica sauber auf Arial zurück.
  //   fontSize  — Optionale Schriftgröße in pt. Erlaubte Werte (siehe
  //               ALLOWED_FONT_SIZES): 8, 9, 10, 11, 12, 14, 16, 18,
  //               20, 24. null = Renderer-Default.
  //   bold      — Optionale Fettdarstellung pro Element. null = Default
  //               (nicht fett).
  //   italic    — Optionale Kursivdarstellung pro Element. null =
  //               Default (nicht kursiv).
  //   xMm       — Optionale absolute X-Position in Millimetern (relativ
  //               zum linken Seitenrand). null = aus gridArea berechnet.
  //   yMm       — Optionale absolute Y-Position in Millimetern (relativ
  //               zum oberen Seitenrand). null = aus gridArea berechnet.
  //   widthMm   — Optionale Breite in Millimetern. null = aus gridArea
  //               / colSpan berechnet.
  //   heightMm  — Optionale Höhe in Millimetern. null = aus gridArea
  //               / rowSpan berechnet.
  //   zOrder    — Optionale Z-Order/Stacking-Reihenfolge. null = aus
  //               `order` abgeleitet. Höhere Werte liegen über niedrigeren.
  //
  // Alle neuen Felder sind OPTIONAL, damit bestehende persistierte
  // Vorlagen ohne Migrations-Fehler laden (siehe Migration
  // 20260810_000100.mo). Die Felder sind additiv — bestehende Felder
  // (id, visible, order, gridArea, alignment, fontFamily, fontSize,
  // bold, italic) bleiben unverändert.
  public type LayoutElement = {
    id : LayoutElementId;
    visible : Bool;
    order : Nat;
    gridArea : GridArea;
    alignment : ?Position;
    fontFamily : ?Text;
    fontSize : ?Nat;
    bold : ?Bool;
    italic : ?Bool;
    xMm : ?Float;
    yMm : ?Float;
    widthMm : ?Float;
    heightMm : ?Float;
    zOrder : ?Nat;
  };

  // Erlaubte Schriftart-Werte als Text-Konstanten. Der Typ verwendet
  // ?Text (nicht ein Enum), damit das Frontend die Werte direkt als
  // CSS font-family setzen kann. Die Validierung beim Speichern
  // erfolgt in lib/rechnungsvorlagen.mo (develop-Phase).
  // Browser-Fallbacks werden im Frontend definiert, z.B.:
  //   "Helvetica"      → "Helvetica, Arial, sans-serif"
  //   "Arial"          → "Arial, sans-serif"
  //   "Times New Roman"→ "Times New Roman, Times, serif"
  public let ALLOWED_FONT_FAMILIES : [Text] = [
    "Arial",
    "Helvetica",
    "Times New Roman",
  ];

  // Erlaubte Schriftgrößen in pt. Der Typ verwendet ?Nat, damit das
  // Frontend den Wert direkt als CSS font-size (pt) setzen kann. Die
  // Validierung beim Speichern erfolgt in lib/rechnungsvorlagen.mo
  // (develop-Phase).
  public let ALLOWED_FONT_SIZES : [Nat] = [
    8,
    9,
    10,
    11,
    12,
    14,
    16,
    18,
    20,
    24,
  ];

  // Seitenränder-Min/Max in Millimetern. Die Validierung beim Speichern
  // erfolgt in lib/rechnungsvorlagen.mo (develop-Phase). Default 20.0 mm.
  public let MARGIN_MIN_MM : Float = 5.0;
  public let MARGIN_MAX_MM : Float = 40.0;
  public let MARGIN_DEFAULT_MM : Float = 20.0;

  // Seiten-Dimensionen in Millimetern (A4 Hochformat, fest vorgegeben).
  public let PAGE_WIDTH_MM : Float = 210.0;
  public let PAGE_HEIGHT_MM : Float = 297.0;

  // V2-Layout-Modell: Raster-basiertes Drag-&-Drop-Layout mit echtem
  // mm-Koordinatensystem und benutzerdefinierten Seitenrändern.
  //   elements       — Alle 11 Rechnungselemente mit Position/Sichtbarkeit
  //                    (genau ein Eintrag pro LayoutElementId)
  //   gridCols       — Anzahl Rasterspalten (Default 12)
  //   gridRows       — Anzahl Rasterzeilen (Default 24)
  //   marginTopMm    — Seitenrand oben in mm (Default 20.0, Min 5.0, Max 40.0)
  //   marginBottomMm — Seitenrand unten in mm (Default 20.0, Min 5.0, Max 40.0)
  //   marginLeftMm   — Seitenrand links in mm (Default 20.0, Min 5.0, Max 40.0)
  //   marginRightMm  — Seitenrand rechts in mm (Default 20.0, Min 5.0, Max 40.0)
  //   pageWidthMm    — Seitenbreite in mm (Default 210.0 = A4 Hochformat)
  //   pageHeightMm   — Seitenhöhe in mm (Default 297.0 = A4 Hochformat)
  //
  // Die Seitenränder sind separat einstellbar (oben/unten/links/rechts).
  // Die Validierung beim Speichern (Min 5.0 mm, Max 40.0 mm) erfolgt in
  // lib/rechnungsvorlagen.mo (develop-Phase). Die Seiten-Dimensionen
  // sind fest auf A4 (210.0 × 297.0 mm) vorgegeben; andere Formate
  // sind nicht Teil dieses Builds.
  public type VorlageLayoutV2 = {
    elements : [LayoutElement];
    gridCols : Nat;
    gridRows : Nat;
    marginTopMm : Float;
    marginBottomMm : Float;
    marginLeftMm : Float;
    marginRightMm : Float;
    pageWidthMm : Float;
    pageHeightMm : Float;
  };

  // Eine Vorlage pro Kanzlei — steuert ausschliesslich PDF/Word-Export.
  //
  // layoutV2 ist OPTIONAL — bestehende Vorlagen (V1) laden mit layoutV2 =
  // null und werden mit ihren Default-Positionen gerendert. Neue/migrierte
  // Vorlagen können layoutV2 setzen, um den Raster-Editor zu nutzen. Das
  // bestehende layout-Feld (V1) bleibt unverändert erhalten, sodass alte
  // Daten ohne Verlust geladen werden und die Migration schrittweise
  // erfolgen kann.
  public type Rechnungsvorlage = {
    kanzleiId : Common.KanzleiId;
    layout : VorlageLayout;
    standardtexte : Standardtexte;
    // Logo-Bytes via object-storage (ExternalBlob). Der Frontend-Client
    // (_uploadFile/_downloadFile in backend.ts) übernimmt den eigentlichen
    // Gateway-Upload/Download transparent; das Backend speichert nur die
    // Blob-Referenz. null = kein Logo.
    logoBlob : ?Storage.ExternalBlob;
    // V2-Layout (Raster-basierter Drag-&-Drop-Editor). Optional — null
    // für V1-Vorlagen, die das bestehende layout-Feld verwenden. Wird
    // pro Kanzlei persistent gespeichert und tenant-sicher isoliert
    // (eine Vorlage pro kanzleiId, admin-gated via requireKanzleiAdmin).
    layoutV2 : ?VorlageLayoutV2;
    updatedAt : Common.Timestamp;
  };

  // Liefert sensible Default-Positionen für alle 12 Rechnungselemente im
  // V2-Raster (gridCols = 12, gridRows = 24), passend zur aktuellen
  // visuellen Anordnung: Logo oben, Absender/Empfänger oben, Rechnungs-
  // metadaten, Mandatsinfo, Einleitung, Leistungspositionen, Spesen/
  // Auslagen, Summenblock, Zahlungsinformationen, Schlusstext, Fusszeile
  // unten. Alle Elemente sind sichtbar (visible = true) und verwenden die
  // bestehenden Default-Positionen (links/zentriert) als alignment, sofern
  // sinnvoll.
  //
  // Das `order`-Feld spiegelt die visuelle Render-Reihenfolge von oben
  // nach unten (0..11) wider und sorgt für eine stabile Sortierung
  // innerhalb des Rasters.
  //
  // Alle Typografie-Felder (fontFamily, fontSize, bold, italic) sind
  // null im Default — der Renderer wendet seine Defaults an. Das
  // #spesenAuslagen-Element wird zwischen Leistungspositionen und
  // Summenblock platziert (volle Breite), damit Auslagen sauber
  // dargestellt werden und in Zwischensumme/MWST/Total einfliessen.
  //
  // Das #schlusstext-Element wird zwischen #zahlungsinformationen und
  // #fusszeile platziert. Es ist ein eigenständiges Layout-Element mit
  // eigener Geometrie/Typografie — der Text-Inhalt bleibt in
  // standardtexte.schlusstext (legacy Feld) gespeichert. Im Word-Export
  // wird #schlusstext getrennt von #zahlungsinformationen gerendert
  // (keine gemeinsame Zelle, kein gemeinsamer Absatzcontainer, keine
  // Style-Vererbung). Die Default-Geometrie (yMm 268, widthMm 170,
  // heightMm 25) orientiert sich an der bisherigen Frontend-Default-
  // Geometrie für den Schlusstext-Block; fontFamily/fontSize/bold/italic
  // werden hier bewusst null gesetzt, damit der Renderer seine Defaults
  // anwendet und der Editor die Werte pro Element explizit setzt
  // (verhindert Style-Vererbung im Word-Export).
  public func defaultLayoutV2() : VorlageLayoutV2 {
    {
      gridCols = 12;
      gridRows = 24;
      marginTopMm = 20.0;
      marginBottomMm = 20.0;
      marginLeftMm = 20.0;
      marginRightMm = 20.0;
      pageWidthMm = 210.0;
      pageHeightMm = 297.0;
      elements = [
        // 0 — Absenderadresse: oben links (row 0, col 0, 3×4)
        {
          id = #absenderadresse;
          visible = true;
          order = 0;
          gridArea = { row = 0; col = 0; rowSpan = 3; colSpan = 4 };
          alignment = ?#links;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?20.0;
          widthMm = ?70.0;
          heightMm = ?37.0;
          zOrder = null;
        },
        // 1 — Empfängeradresse: unter der Absenderadresse (row 3, col 0, 3×4)
        {
          id = #empfaengeradresse;
          visible = true;
          order = 1;
          gridArea = { row = 3; col = 0; rowSpan = 3; colSpan = 4 };
          alignment = ?#links;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?57.0;
          widthMm = ?70.0;
          heightMm = ?37.0;
          zOrder = null;
        },
        // 2 — Logo: oben rechts (row 0, col 8, 2×4)
        {
          id = #logo;
          visible = true;
          order = 2;
          gridArea = { row = 0; col = 8; rowSpan = 2; colSpan = 4 };
          alignment = null;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?120.0;
          yMm = ?20.0;
          widthMm = ?70.0;
          heightMm = ?25.0;
          zOrder = null;
        },
        // 3 — Rechnungsmetadaten: oben mitte (row 0, col 4, 3×4)
        {
          id = #rechnungsmetadaten;
          visible = true;
          order = 3;
          gridArea = { row = 0; col = 4; rowSpan = 3; colSpan = 4 };
          alignment = null;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?90.0;
          yMm = ?20.0;
          widthMm = ?30.0;
          heightMm = ?37.0;
          zOrder = null;
        },
        // 4 — Mandatsinfo: mitte (row 3, col 4, 2×4)
        {
          id = #mandatsinfo;
          visible = true;
          order = 4;
          gridArea = { row = 3; col = 4; rowSpan = 2; colSpan = 4 };
          alignment = null;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?90.0;
          yMm = ?57.0;
          widthMm = ?30.0;
          heightMm = ?25.0;
          zOrder = null;
        },
        // 5 — Einleitung: volle Breite (row 6, col 0, 2×12)
        {
          id = #einleitung;
          visible = true;
          order = 5;
          gridArea = { row = 6; col = 0; rowSpan = 2; colSpan = 12 };
          alignment = null;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?94.0;
          widthMm = ?170.0;
          heightMm = ?25.0;
          zOrder = null;
        },
        // 6 — Leistungspositionen: volle Breite (row 8, col 0, 4×12)
        {
          id = #leistungspositionen;
          visible = true;
          order = 6;
          gridArea = { row = 8; col = 0; rowSpan = 4; colSpan = 12 };
          alignment = null;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?119.0;
          widthMm = ?170.0;
          heightMm = ?50.0;
          zOrder = null;
        },
        // 7 — Spesen/Auslagen: volle Breite, direkt nach Leistungspositionen
        //     (row 12, col 0, 2×12). Eigenständiges Element — Auslagen
        //     werden aus den der Rechnung zugeordneten Daten geladen
        //     (Rechnung.auslageIds → Auslage-Records). Bei Rechnungen
        //     ohne Auslagen bleibt das Element sichtbar aber leer (Renderer
        //     blendet leere Bereiche aus).
        {
          id = #spesenAuslagen;
          visible = true;
          order = 7;
          gridArea = { row = 12; col = 0; rowSpan = 2; colSpan = 12 };
          alignment = null;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?169.0;
          widthMm = ?170.0;
          heightMm = ?25.0;
          zOrder = null;
        },
        // 8 — Summenblock: volle Breite, rechts ausgerichtet (row 14, col 0, 3×12)
        {
          id = #summenblock;
          visible = true;
          order = 8;
          gridArea = { row = 14; col = 0; rowSpan = 3; colSpan = 12 };
          alignment = ?#rechts;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?194.0;
          widthMm = ?170.0;
          heightMm = ?37.0;
          zOrder = null;
        },
        // 9 — Zahlungsinformationen: volle Breite (row 17, col 0, 3×12)
        {
          id = #zahlungsinformationen;
          visible = true;
          order = 9;
          gridArea = { row = 17; col = 0; rowSpan = 3; colSpan = 12 };
          alignment = null;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?231.0;
          widthMm = ?170.0;
          heightMm = ?37.0;
          zOrder = null;
        },
        // 10 — Schlusstext: eigenständiges Layout-Element, separiert von
        //      #zahlungsinformationen. Der Text-Inhalt bleibt in
        //      standardtexte.schlusstext (legacy Feld) gespeichert; dieses
        //      Element steuert nur Geometrie/Sichtbarkeit/Typografie.
        //      Default-Geometrie orientiert sich an der bisherigen Frontend-
        //      Default-Geometrie (yMm 268, widthMm 170, heightMm 25). Im
        //      Word-Export wird #schlusstext getrennt von
        //      #zahlungsinformationen gerendert (keine gemeinsame Zelle,
        //      kein gemeinsamer Absatzcontainer, keine Style-Vererbung).
        //      Typografie-Felder sind null im Default — der Renderer wendet
        //      seine Defaults an; der Editor setzt die Werte pro Element
        //      explizit (verhindert Style-Vererbung).
        {
          id = #schlusstext;
          visible = true;
          order = 10;
          gridArea = { row = 20; col = 0; rowSpan = 1; colSpan = 12 };
          alignment = ?#links;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?268.0;
          widthMm = ?170.0;
          heightMm = ?25.0;
          zOrder = null;
        },
        // 11 — Fusszeile: unten, zentriert (row 21, col 0, 3×12)
        {
          id = #fusszeile;
          visible = true;
          order = 11;
          gridArea = { row = 21; col = 0; rowSpan = 3; colSpan = 12 };
          alignment = ?#zentriert;
          fontFamily = null;
          fontSize = null;
          bold = null;
          italic = null;
          xMm = ?20.0;
          yMm = ?293.0;
          widthMm = ?170.0;
          heightMm = ?25.0;
          zOrder = null;
        },
      ];
    };
  };
};
