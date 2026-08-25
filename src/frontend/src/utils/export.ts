import type { Position } from "@/backend";
import { LayoutElementId as LayoutElementIdEnum } from "@/backend";
import { DEFAULT_LAYOUT_V2, SCHLUSSTEXT_ELEMENT_ID } from "@/types";
import type {
  ActiveUserMonth,
  ActiveUsersYearReport,
  AllKanzleienActiveUsersReport,
  FrontendLayoutElementId,
  KanzleiStammdaten,
  LayoutElement,
  LayoutElementId,
  Rechnungsvorlage,
  VorlageLayoutV2,
} from "@/types";
/**
 * Export utilities — generate PDF, DOCX, and XLSX downloads in the browser.
 *
 * Library versions (already installed in package.json):
 *   - jspdf ^4.2.1
 *   - jspdf-autotable ^5.0.8  (functional autoTable(doc, options) API)
 *   - docx ^9.7.1             (Document, Packer, Paragraph, TextRun)
 *   - exceljs ^4.4.0          (Workbook API)
 *
 * Formatting helpers come from @/utils/format (Swiss conventions):
 *   - formatCHF(rappen)  → "CHF 1'234.50"
 *   - formatDate(str)    → "dd.mm.yyyy"
 *   - formatDuration(min)→ "hh:mm"
 */

// ─── Architektur-Audit: Floating Textboxes / DOCX-Shape-Rendering ─────────────
//
// Dieser Block dokumentiert die Recherche-Ergebnisse zum DOCX-Shape-Rendering
// (Floating Textboxes) für den POC, echte absolut positionierte Textfelder in
// den Word-Export einzuführen. POC-STATUS: UMGESETZT für die beiden Elemente
// `empfaengeradresse` (siehe Render-Case weiter unten, WpsShapeRun) und
// `rechnungsmetadaten` (ebenfalls WpsShapeRun). Alle übrigen statischen
// Elemente (absenderadresse, mandatsinfo, einleitung, zahlung, schlusstext,
// freier Text) verwenden weiterhin FIXED-Tabellen und sind Kandidaten für die
// spätere Voll-Migration. Echte Tabellen (Leistungsübersicht/Auslagen/
// Summenblock) und die echte Word-Fusszeile bleiben unverändert.
//
// (a) DOCX-Library + Version
//     docx 9.7.1 (in package.json verifiziert, installiert). Alle folgenden
//     API-Namen beziehen sich auf diese Version.
//
// (b) Verfügbare APIs für Textbox/Floating Shapes
//     - WpsShapeRun (DrawingML/WPS, extends Run) — primäres Shape-Run-Konstrukt
//       für DrawingML-basierte Textboxen (w:drawing → wp:anchor → wps:txbx).
//       Wird im POC für `empfaengeradresse` und `rechnungsmetadaten` verwendet.
//     - Textbox (VML, extends FileChild) — VML-Fallback-Textbox (v:shape/v:textbox).
//     - IFloating — { horizontalPosition, verticalPosition, wrap?, behindDocument?,
//       allowOverlap? } steuert absolute Positionierung und Z-Order.
//     - CoreShapeOptions — { floating?: IFloating } an Shape-Optionen anhängbar.
//     - IHorizontalPositionOptions / IVerticalPositionOptions — je mit
//       `relative` (HorizontalPositionRelativeFrom / VerticalPositionRelativeFrom)
//       und `offset` (EMU). relative-Werte: page | margin | column.
//     - HorizontalPositionRelativeFrom / VerticalPositionRelativeFrom — Enums
//       mit den Membern page, margin, column (und ggf. further).
//     - ITextboxOptions — Omit<IParagraphOptions,'style'> & {...} & CoreShapeOptions;
//     Paragraph-Optionen für den Textinbox-Inhalt plus Shape-Geometrie.
//
// (c) DrawingML vs. VML
//     DrawingML (w:drawing, wp:anchor, wps:txbx) wird primär von Word Desktop
//     verwendet und ist dort robust. VML (v:shape, v:textbox) dient als Fallback
//     für ältere/andere Renderer. docx 9.7.1 legt beide APIs offen; für den POC
//     wird DrawingML (WpsShapeRun) bevorzugt, VML bleibt als Fallback-Option
//     dokumentiert.
//
// (d) Absolute Positionen in EMU
//     1 mm = 36000 EMU. Absolute Positionen werden via
//     horizontalPosition.offset / verticalPosition.offset (EMU) sowie
//     transformation.width / transformation.height (Shape-Grösse in EMU) gesetzt.
//     Für relative:page sind xMm/yMm bereits PAGE-ABSOLUT (A4 210×297 mm,
//     Ursprung oben-links) — KEINE Druckbereich-Offset-Subtraktion (kein
//     marginLeftMm-Abzug). Siehe editorMmToWordEmu() unten.
//
// (e) Word Desktop
//     DrawingML ist in Word Desktop robust und zuverlässig; Floating Textboxes
//     mit relative:page + EMU-Offsets werden treu positioniert.
//
// (f) LibreOffice / Browser
//     Bekannte Einschränkungen bei Shape-Text-Rendering; das Weblayout kann
//     abweichen. Risiko dokumentiert — der POC validiert nur gegen Word
//     Desktop, nicht gegen LibreOffice/Browser-Weblayout. Ein automatisierter
//     visueller DOCX-Regressionstest ist bewusst NICHT Teil dieses POC.
//
// (g) HEIGHT / TEXT-OVERFLOW
//     AutoGrow (spAutoFit) ist NICHT direkt über WpsShapeRun / IWpsShapeOptions
//     konfigurierbar — die IWpsShapeOptions (discriminated union mit type:"wps")
//     legt nur floating, transformation (width/height in EMU), children und
//     shape-spezifische Eigenschaften fest; es gibt kein autofit/autoGrow-Feld.
//     Word wendet sein Default-Shape-Verhalten an: bei fester
//     transformation.height kann Text, der mehr Platz braucht, über die
//     Shape-Höhe hinauslaufen (Overflow). widthMm wird strikt respektiert
//     (feste Shape-Breite); heightMm dient als initiale Höhe. Für echtes
//     vertikales Mitwachsen müsste auf VML-Textbox (Textbox-Run) mit
//     autoGrow-Option oder ein höheres Shape-Modell ausgewichen werden —
//     bewusst NICHT Teil dieses POC.
//
// (h) Z-ORDER / ÜBERLAPPUNG
//     zIndex / behindDocument / allowOverlap steuern die Z-Order. Textfelder
//     können Tabellen/Shapes überdecken; Word speichert die Reihenfolge stabil.
//     Für den POC werden KEINE überlappenden Elemente angelegt — jedes
//     Floating Textbox bekommt eine eigene, nicht-kollidierende Bandbox.
//
// (i) SPÄTERE ZIELARCHITEKTUR (nur dokumentiert, NICHT voll umsetzen)
//     - Floating Textboxes für: Absenderadresse, Empfängeradresse,
//       Rechnungsmetadaten, Mandatsinformationen, Einleitung,
//       Zahlungsinformationen, Schlusstext, freier Text.
//       POC-STATUS: Empfängeradresse + Rechnungsmetadaten UMGESETZT (WpsShapeRun);
//       alle übrigen noch FIXED-Tabellen.
//     - Echte Word-Tabellen für: Leistungsübersicht, Auslagen, Summenblock
//       (bleiben im sequenziellen Dokumentfluss, wachsen vertikal).
//     - Logo als eigenes absolut positioniertes Bild / Floating Image.
//     - Footer bleibt eine echte Word-Fusszeile (kein Floating Shape).
//
// (j) ENTSCHEIDUNG
//     Native und robuste Unterstützung für Floating Textboxes ist in docx 9.7.1
//     vorhanden → POC mit echten Floating Textboxes für Empfängeradresse +
//     Rechnungsmetadaten UMGESETZT (WpsShapeRun, DrawingML/WPS). Die
//     FIXED-Tabellen-Renderer für diese beiden Elemente wurden durch die
//     Floating-Textbox-Render-Cases ersetzt; alle übrigen statischen Elemente
//     bleiben unverändert auf FIXED-Tabellen. Regression-Risiko ist auf die
//     beiden umgestellten Cases beschränkt.

import {
  formatAmount,
  formatCHF,
  formatDate,
  formatDuration,
  roundTo5Rappen,
} from "@/utils/format";
import {
  getAbsenderadresse,
  getRechnungsmetadaten,
} from "@/utils/staticResolvers";
import type { Principal } from "@icp-sdk/core/principal";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

// ─── OOXML-Post-Processing: wps:nvSpPr-Wrapper-Reparatur ─────────────────────
//
// ROOT-CAUSE: docx 9.7.1 generiert <wps:wsp> mit <wps:cNvSpPr txBox="textbox"/>
// DIREKT als child — OHNE <wps:nvSpPr>-Wrapper und OHNE <wps:cNvPr id name>.
// INonVisualShapePropertiesOptions = { txBox: string } legt nur txBox fest;
// cNvPr (id+name) wird nicht emittiert. ECMA-376 verlangt aber <wps:nvSpPr>
// als Container mit <wps:cNvPr id name> (required) VOR <wps:cNvSpPr>. Word
// Desktop lehnt die Datei ohne diesen Wrapper ab ("Fehler beim Öffnen").
//
// FIX: XML-Post-Processing nach Packer.toBlob. Entpackt das .docx via fflate,
// parst word/document.xml, konsumiert das existierende <wps:cNvSpPr .../> und
// wickelt es in ein neues <wps:nvSpPr> ein (mit <wps:cNvPr id name> davor —
// ECMA-376-Reihenfolge cNvPr VOR cNvSpPr). So entsteht KEIN Duplikat: es
// bleibt genau EIN cNvSpPr pro wsp, dessen txBox-Attribut erhalten bleibt.
// floating/transformation-XML (WYSIWYG-Geometrie) steht ausserhalb des nvSpPr
// und wird NICHT angetastet. document.xml zurück ins ZIP, neu zippen.
//
// Logo (ImageRun) und Tabellen sind nicht betroffen: ImageRun erzeugt kein
// wps:wsp (nutzt wp:docPr), Tabellen enthalten gar keine Shapes.

/**
 * Repariert das von docx 9.7.1 generierte OOXML: konsumiert das direkt unter
 * <wps:wsp> stehende <wps:cNvSpPr .../> und wickelt es in ein neues
 * <wps:nvSpPr> mit <wps:cNvPr id name> (davor) ein. Umgeht den docx-Bug ohne
 * Library-Patch, erhält die Floating-Shape-Geometrie und erzeugt kein
 * cNvSpPr-Duplikat.
 *
 * @param blob  Roh-Blob aus Packer.toBlob (mit defektem OOXML).
 * @returns     Reparierter Blob mit gültigem <wps:nvSpPr>-Wrapper pro Shape.
 */

// ─── XML-Wohlgeformtheitsprüfung (environment-agnostisch) ───────────────────
//
// DOMParser ist eine Browser-API. In der node-basierten vitest-Testumgebung
// (vitest.config.ts: environment "node", KEIN jsdom) ist `DOMParser`
// undefined — ein direkter Aufruf würde werfen und ALLE Tests fehlschlagen
// lassen, die patchDocxXml aufrufen.
//
// validateXmlWellFormed ist daher ENVIRONMENT-AGNOSTISCH:
//   1. Wenn `DOMParser` verfügbar ist (Browser-Produktion ODER jsdom), wird
//      der native Parser verwendet: parseFromString(xml,'application/xml')
//      erzeugt bei nicht-wohlgeformtem XML ein Dokument mit einem
//      <parsererror>-Element statt zu werfen. Wir prüfen auf dessen
//      Abwesenheit.
//   2. Wenn `DOMParser` NICHT verfügbar ist (node-Testumgebung), fällt die
//      Funktion auf eine reine String-/Regex-basierte Wohlgeformtheitsprüfung
//      zurück. Diese prüft:
//        - Nicht-leerer Eingabe-String.
//        - Genau EIN Wurzel-Element (äußerstes öffnendes/schließendes Tag
//          stimmen überein).
//        - Alle öffnenden Tags haben eine passende Schließung (self-closing
//          Tags `<x .../>` zählen nicht als öffnend).
//        - Keine doppelten schließenden Tags ohne Öffnung.
//      Diese Prüfung ist KEIN vollständiger XML-Parser — sie fängt aber die
//      hier relevanten Regex-Post-Processing-Regressionsklassen ab
//      (unclosed tags, stray closing tags, broken self-closing forms).
//
// Beide Pfade werfen bei Fehlschlag einen Error mit aussagekräftiger
// Meldung. patchDocxXml fängt nicht ab — der Error propagiert zum Aufrufer
// (exportDocx/exportRechnungDocx) und verhindert den Download.
export function validateXmlWellFormed(xml: string): void {
  // Pfad 1 — nativer DOMParser (Browser / jsdom).
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(xml, "application/xml");
    const parseError = parsed.querySelector("parsererror");
    if (parseError) {
      const message = parseError.textContent ?? "(keine Fehlermeldung)";
      console.error(
        "DOCX export aborted: word/document.xml is not well-formed XML.",
        message,
      );
      throw new Error(
        "DOCX export aborted: word/document.xml is not well-formed XML.",
      );
    }
    return;
  }

  // Pfad 2 — String-/Regex-Fallback (node-Testumgebung ohne DOMParser).
  if (!xml || xml.trim().length === 0) {
    throw new Error(
      "DOCX export aborted: word/document.xml is empty (not well-formed XML).",
    );
  }

  // Wurzel-Element ermitteln: erstes öffnendes Tag, das NICHT self-closing
  // ist, und dessen schließendes Pendant muss das letzte schließende Tag
  // sein. Wir extrahieren den Tag-Namen des ersten nicht-self-closing
  // öffnenden Tags.
  const openTagRe = /<([a-zA-Z_:][a-zA-Z0-9_:.\-]*)(\s[^>]*?)?[^/]>/;
  const rootMatch = openTagRe.exec(xml);
  if (!rootMatch) {
    throw new Error(
      "DOCX export aborted: word/document.xml has no root element (not well-formed XML).",
    );
  }
  const rootName = rootMatch[1];
  // Das letzte schließende Tag muss denselben Namen tragen.
  const closeTagRe = new RegExp(
    `</${rootName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}>\\s*$`,
  );
  if (!closeTagRe.test(xml.trim())) {
    throw new Error(
      `DOCX export aborted: word/document.xml root element <${rootName}> is not closed (not well-formed XML).`,
    );
  }

  // Tag-Balance: zähle öffnende (nicht self-closing) und schließende Tags.
  // Self-closing Tags `<x .../>` werden von beiden Zählungen ausgeschlossen.
  // Processing instructions `<?...?>` und Kommentare `<!--...-->` werden
  // vor der Zählung entfernt, damit sie das Ergebnis nicht verfälschen.
  let cleaned = xml;
  // Kommentare entfernen.
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  // Processing instructions und CDATA entfernen.
  cleaned = cleaned.replace(/<\?[\s\S]*?\?>/g, "");
  cleaned = cleaned.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  // Öffnende Tags (nicht self-closing): `<name ...>` OHNE abschliessendes `/`
  // direkt vor dem `>`. Wir matchen alle Tags und filtern self-closing.
  const allTagsRe = /<([a-zA-Z_:][a-zA-Z0-9_:.\-]*)(\s[^>]*?)?(\/?)>/g;
  let openCount = 0;
  let closeCount = 0;
  let m: RegExpExecArray | null = allTagsRe.exec(cleaned);
  while (m !== null) {
    const selfClosing = m[3] === "/";
    if (!selfClosing) {
      openCount++;
    }
    m = allTagsRe.exec(cleaned);
  }
  // Schließende Tags: `</name>`.
  const closingTagRe = /<\/([a-zA-Z_:][a-zA-Z0-9_:.\-]*)>/g;
  m = closingTagRe.exec(cleaned);
  while (m !== null) {
    closeCount++;
    m = closingTagRe.exec(cleaned);
  }

  if (openCount !== closeCount) {
    throw new Error(
      `DOCX export aborted: word/document.xml tag mismatch (open=${openCount}, close=${closeCount}, not well-formed XML).`,
    );
  }
}

export async function patchDocxXml(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const unzipped = unzipSync(bytes);
  const docPath = "word/document.xml";
  const docBytes = unzipped[docPath];
  if (!docBytes) {
    // Kein document.xml (sollte nie vorkommen) — Blob unverändert zurückgeben.
    return blob;
  }
  let xml = strFromU8(docBytes);

  // ROOT-CAUSE (verifiziert an der echten v21 .docx): docx 9.7.1 emittiert für
  // jede Floating-Textbox-Shape einen INVALIDEN <wps:nvSpPr>-Wrapper:
  //
  //   <wps:wsp><wps:nvSpPr><wps:cNvPr id=... name=.../><wps:cNvSpPr txBox='textbox'/></wps:nvSpPr>...
  //
  // Per ECMA-376 CT_WordprocessingShape sind die Kinder von <wps:wsp> direkt
  // wps:cNvSpPr, wps:spPr, wps:bodyPr, wps:txbx — es gibt KEIN nvSpPr-Container
  // und KEIN wps:cNvPr innerhalb von wps:wsp. Word Desktop lehnt die Datei mit
  // diesem Wrapper ab ("Fehler beim Öffnen der Datei").
  //
  // FIX: Ein einziger Remove-Wrapper-Repair. Er matcht den kompletten
  // <wps:nvSpPr>...</wps:nvSpPr>-Block und ersetzt ihn durch den inneren
  // <wps:cNvSpPr .../> (txBox-Attribut bleibt erhalten). Robust gegenüber
  // descr=''/title=''-Attributen, variierendem Whitespace, self-closing ODER
  // non-self-closing cNvPr/cNvSpPr und beliebiger Attributreihenfolge.
  //
  // WYSIWYG-Geometrie (floating/transformation, xEmu/yEmu/widthPx/heightPx)
  // steht in wp:anchor AUSSERHALB von wps:wsp und wird NICHT angetastet.
  const nvSpPrRemoveRe = /<wps:nvSpPr>([\s\S]*?)<\/wps:nvSpPr>/g;
  xml = xml.replace(nvSpPrRemoveRe, (_match, inner: string) => {
    // Extrahiere das <wps:cNvSpPr .../> aus dem inneren Inhalt — self-closing
    // ODER non-self-closing (mit optionalem Inhalt und schließendem Tag).
    const cNvSpPr =
      /<wps:cNvSpPr\b[^>]*?\/>|<wps:cNvSpPr\b[^>]*>[\s\S]*?<\/wps:cNvSpPr>/.exec(
        inner,
      )?.[0] ?? "";
    // Ersetze den gesamten nvSpPr-Block durch das nackte cNvSpPr als erstes
    // Kind von wps:wsp (ECMA-376-valid). cNvPr wird entfernt.
    return cNvSpPr;
  });

  // DEFECT 2 + 5 — wp:docPr und pic:cNvPr reparieren (echte .docx-Forensik).
  //
  // FORENSIK an der echten angehängten rechnung-vorschau-heureka_ag_18 .docx
  // (August 2026) hat 5 konkrete OOXML-Verstöße gefunden, die Word Desktop
  // dazu bringen, die Datei abzulehnen ("Fehler beim Öffnen der Datei"):
  //
  //   VERSTOSS 1 — wp:docPr name="" (leer) — 8× in allen wp:anchor-Blöcken.
  //                ECHTES Muster: <wp:docPr id="1" name="" descr="" title=""/>
  //                ECMA-376 §20.4.2.5: name ist required ST_NonEmptyString.
  //   VERSTOSS 2 — wp:docPr id="1" (alle 8 gleich) — nicht eindeutig.
  //                ECMA-376 §20.4.2.5: id muss eindeutige positive Ganzzahl.
  //   VERSTOSS 4 — pic:cNvPr name="" (leer) — 1× im Logo-Bild.
  //                ECHTES Muster: <pic:cNvPr id="0" name="" descr=""/>
  //                ECMA-376 §20.2.2.1: name required, nicht-leer.
  //   VERSTOSS 5 — pic:cNvPr id="0" — 1× im Logo-Bild.
  //                ECMA-376: id muss > 0 sein.
  //
  // Die echten Muster tragen ZUSÄTZLICHE Attribute (descr="", title=""), die
  // die ursprünglichen name-only-Regexe nicht erwarteten. Die neue Logik
  // parst das gesamte Tag, behält descr/title, und setzt eine kanonische
  // Form: eindeutige id (running counter ab 1, fortlaufend über wp:docPr und
  // pic:cNvPr gemeinsam) + nicht-leerer name ("Bild N").
  //
  // IDEMPOTENZ: Die kanonische Form ist deterministisch (id=Position im
  // Dokument, name="Bild N"). Eine zweite Anwendung erzeugt die gleiche
  // kanonische Form → keine Änderung. Zusätzlich prüft jeder Replace-Callback
  // defensiv: wenn name schon nicht-leer UND id schon eindeutig ist, wird
  // das Tag nicht angetastet (früher Ausstieg). So bleibt die Funktion
  // idempotent auch bei gemischten Eingaben (teilweise repariert).
  //
  // WYSIWYG-Geometrie (floating/transformation, xEmu/yEmu/widthPx/heightPx)
  // steht ausserhalb von wp:docPr/pic:cNvPr und wird NICHT angetastet.
  let docPrPicCounter = 1;
  // wp:docPr: gesamtes Tag ersetzen — eindeutige id + nicht-leerer name,
  // descr/title bleiben erhalten. Matcht das ECHTE Muster mit descr/title.
  // [^>]*? ist non-greedy und erfasst alle Attribute bis zum self-closing />.
  const docPrFullRe = /<wp:docPr\b([^>]*?)\/>/g;
  xml = xml.replace(docPrFullRe, (_m, attrs: string) => {
    const id = docPrPicCounter++;
    const name = `Bild ${id}`;
    // descr/title extrahieren (falls vorhanden) und beibehalten.
    const descr = /\bdescr="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const title = /\btitle="([^"]*)"/.exec(attrs)?.[1] ?? "";
    return `<wp:docPr id="${id}" name="${name}" descr="${descr}" title="${title}"/>`;
  });
  // pic:cNvPr: gesamtes Tag ersetzen — id > 0 (fortlaufend nach wp:docPr) +
  // nicht-leerer name, descr bleibt erhalten. Matcht das ECHTE Muster mit
  // descr.
  const picCnvPrFullRe = /<pic:cNvPr\b([^>]*?)\/>/g;
  xml = xml.replace(picCnvPrFullRe, (_m, attrs: string) => {
    const id = docPrPicCounter++;
    const name = `Bild ${id}`;
    const descr = /\bdescr="([^"]*)"/.exec(attrs)?.[1] ?? "";
    return `<pic:cNvPr id="${id}" name="${name}" descr="${descr}"/>`;
  });

  // DEFECT 3 — effectExtent-Attributreihenfolge. docx 9.7.1 emittiert
  // <wp:effectExtent t="X" r="Y" b="Z" l="W"/> (t/r/b/l). ECMA-376 verlangt
  // die Reihenfolge l/t/r/b (CT_EffectExtent). Word Desktop ist tolerant,
  // aber strenge Validatoren lehnen die falsche Reihenfolge ab. Idempotent:
  // nur umschreiben, wenn die Reihenfolge NICHT l/t/r/b entspricht.
  // Erkennt alle <wp:effectExtent .../> (self-closing) mit beliebigen
  // Attributwerten und sortiert die Attribute nach l/t/r/b.
  const effectExtentRe = /<wp:effectExtent\b([^>]*?)\/>/g;
  xml = xml.replace(effectExtentRe, (_m, attrs: string) => {
    const l = /\bl="([^"]*)"/.exec(attrs)?.[1];
    const t = /\bt="([^"]*)"/.exec(attrs)?.[1];
    const r = /\br="([^"]*)"/.exec(attrs)?.[1];
    const b = /\bb="([^"]*)"/.exec(attrs)?.[1];
    // Wenn nicht alle vier Attribute vorhanden sind, nicht anfassen
    // (defensiv — nie kaputt machen).
    if (
      l === undefined ||
      t === undefined ||
      r === undefined ||
      b === undefined
    ) {
      return _m;
    }
    return `<wp:effectExtent l="${l}" t="${t}" r="${r}" b="${b}"/>`;
  });

  // FIX 3 — Alle internen Ränder (Left/Right/Top/Bottom) jedes Textfelds /
  // Textbox auf 0.00 cm setzen. docx 9.7.1 emittiert <wps:bodyPr> ohne
  // lIns/rIns/tIns/bIns, sodass Word die Standard-Innenränder (0.1" ≈ 0.25cm)
  // anwendet und der Text nicht WYSIWYG sitzt. Idempotent: nur injizieren,
  // wenn das jeweilige Attribut fehlt; vorhandene Attribute (vert/rot/...)
  // bleiben unangetastet.
  //
  // WICHTIG — Korrekte OOXML-Attributnamen sind lIns/rIns/tIns/bIns (ECMA-376
  // CT_TextBodyPropertyBag). Die frühere Draft-Version injizierte fälschlich
  // insL/insR/insT/insB — diese Attributnamen existieren im OOXML-Schema NICHT
  // und Word ignoriert sie still, sodass die Standard-Innenränder aktiv
  // blieben. Jetzt korrekt als lIns/rIns/tIns/bIns.
  //
  // BUGFIX (DOCX-Export-Fix): wps:bodyPr muss IMMER selbstschliessend
  // (<wps:bodyPr .../>) ausgegeben werden, da bodyPr in diesem Kontext KEINE
  // Kindelemente hat. Die frühere Ersetzung gab `<wps:bodyPr${out}>` (offen)
  // zurück — wenn docx 9.7.1 die selbstschliessende Form emittiert, zerstörte
  // die Regex den Self-Closing-Slash und erzeugte ein offenes Tag OHNE
  // schliessendes </wps:bodyPr>. word/document.xml wurde dadurch NICHT
  // wohlgeformt, Word Desktop lehnte die Datei ab. Jetzt: immer
  // selbstschliessend via `<wps:bodyPr${out}/>`.
  //
  // Regex deckt alle drei Formen ab:
  //   - selbstschliessend:  <wps:bodyPr .../>
  //   - paired-empty:       <wps:bodyPr></wps:bodyPr>
  //   - paired-with-children: <wps:bodyPr ...>...</wps:bodyPr>
  // Für self-closing und paired-empty wird das Tag direkt ersetzt. Für
  // paired-with-children wird nur das öffnende Tag angereichert (Kindelemente
  // bleiben erhalten). Idempotent: vorhandene lIns/rIns/tIns/bIns werden nicht
  // dupliziert.
  const bodyPrSelfClosingRe = /<wps:bodyPr\b([^>]*?)\/>/g;
  xml = xml.replace(bodyPrSelfClosingRe, (_m, attrs: string) => {
    let out = attrs;
    const inject = (name: string) => {
      if (!new RegExp(`\\b${name}=`).test(out)) {
        out = `${out} ${name}="0"`;
      }
    };
    inject("lIns");
    inject("rIns");
    inject("tIns");
    inject("bIns");
    return `<wps:bodyPr${out}/>`;
  });
  // paired-empty: <wps:bodyPr></wps:bodyPr> → self-closing mit Margins.
  const bodyPrPairedEmptyRe = /<wps:bodyPr\b([^>]*?)>\s*<\/wps:bodyPr>/g;
  xml = xml.replace(bodyPrPairedEmptyRe, (_m, attrs: string) => {
    let out = attrs;
    const inject = (name: string) => {
      if (!new RegExp(`\\b${name}=`).test(out)) {
        out = `${out} ${name}="0"`;
      }
    };
    inject("lIns");
    inject("rIns");
    inject("tIns");
    inject("bIns");
    return `<wps:bodyPr${out}/>`;
  });
  // paired-with-children: nur öffnendes Tag anreichern, Kindelemente bleiben.
  // Negativer Lookahead schliesst self-closing und paired-empty aus (die oben
  // schon behandelt wurden), damit hier nur echte öffnende Tags matchen.
  const bodyPrPairedChildrenRe =
    /<wps:bodyPr\b([^>]*?)(?<!\/)>(?!\s*<\/wps:bodyPr>)/g;
  xml = xml.replace(bodyPrPairedChildrenRe, (_m, attrs: string) => {
    let out = attrs;
    const inject = (name: string) => {
      if (!new RegExp(`\\b${name}=`).test(out)) {
        out = `${out} ${name}="0"`;
      }
    };
    inject("lIns");
    inject("rIns");
    inject("tIns");
    inject("bIns");
    return `<wps:bodyPr${out}>`;
  });

  // XML-Wohlgeformtheitsvalidierung VOR dem finalen Re-Zip/Download.
  // Schlägt die Validierung fehl (nicht-wohlgeformtes XML), wird KEIN
  // scheinbar erfolgreicher .docx-Blob ausgeliefert — stattdessen Fehler-Log
  // + Throw. So kann kein kaputtes OOXML mehr den Weg in eine heruntergeladene
  // Datei finden (Defensive-Depth gegen künftige Regex-Post-Processing-
  // Regressionen).
  //
  // ENVIRONMENT-AGNOSTISCH: DOMParser ist eine Browser-API und in der
  // node-basierten vitest-Testumgebung (environment: "node", KEIN jsdom)
  // undefined. validateXmlWellFormed prüft daher zur Laufzeit, ob DOMParser
  // verfügbar ist, und fällt sonst auf eine reine String-/Regex-basierte
  // Wohlgeformtheitsprüfung zurück. Beide Pfade funktionieren in Browser
  // (Produktion) und node (vitest) — siehe validateXmlWellFormed-Doku.
  validateXmlWellFormed(xml);

  // document.xml zurück ins ZIP, neu zippen.
  const newFiles: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries(unzipped)) {
    newFiles[path] = path === docPath ? strToU8(xml) : data;
  }
  const zipped = zipSync(newFiles);
  return new Blob([zipped], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// Type-only imports for docx class types (used in annotations only).
import type {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TextRun as DocxTextRun,
} from "docx";

// ─── Placeholder resolution ──────────────────────────────────────────────────
// Replaces {{placeholder}} tokens in template text with the actual invoice
// values. Used by the PDF/Word export when a Rechnungsvorlage is applied so
// that the kanzlei's standardtexte (rechnungstitel, einleitung, zahlungshinweis,
// schlusstext) and fusszeile can reference the real rechnung data.
//
// Supported tokens: {{rechnungsnummer}}, {{rechnungsdatum}}, {{leistungszeitraum}},
// {{kanzlei_name}}, {{kanzlei_adresse}}, {{empfaenger_name}}, {{empfaenger_adresse}},
// {{subtotal}}, {{mwst_betrag}}, {{mwst_satz}}, {{total}}, {{mandat_bezeichnung}},
// {{leistungserbringer}}, {{zahlungsbedingungen}}.
//
// Unknown tokens are left untouched (no error) so vorlagen can include
// literal {{...}} text without breaking the export.
export function resolvePlaceholders(
  text: string,
  values: Record<string, string>,
): string {
  let result = text;
  for (const [key, value] of Object.entries(values)) {
    // Escape regex special characters in the key (placeholders are simple
    // identifiers, but be safe) and replace {{key}} with the value.
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g"),
      value,
    );
  }
  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfColumn {
  header: string;
  dataKey: string;
}

export interface PdfSection {
  title: string;
  columns: PdfColumn[];
  rows: Record<string, string | number>[];
  /**
   * Optional total row appended at the bottom of this section's table.
   * `totalLabel` is rendered in the first column, `totalValue` in the last
   * column (right-aligned). Both are pre-formatted strings (e.g. CHF).
   */
  totalLabel?: string;
  totalValue?: string;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: Record<string, string | number>[];
  filename: string;
}

/**
 * Kopfzeile für den PDF-Export: Kanzlei-Name, Ersteller, Erstellungsdatum
 * sowie die aktiven Filtereinstellungen (Leistungserbringer, Status).
 * Wird oben im PDF-Dokument angezeigt, vor dem Titel und den Tabellen.
 */
export interface PdfKopfzeile {
  kanzleiName?: string;
  ersteller?: string;
  erstellungsdatum?: string;
  filterLeistungserbringer?: string;
  filterStatus?: string;
}

/**
 * Multi-section PDF export: renders several tables (e.g. Leistungen + Auslagen)
 * in a single PDF document, one after another with a section heading each.
 * Falls back to a single section when `sections` is omitted.
 *
 * Optionale Kopfzeile (`kopfzeile`) wird ganz oben gerendert, vor dem Titel.
 * Optionale `grandTotalLabel` / `grandTotalValue` erzeugen eine
 * Gesamttotal-Zeile am Ende (Summe aller Sektion-Totale).
 */
export interface PdfMultiSectionExportOptions {
  title: string;
  subtitle?: string;
  kopfzeile?: PdfKopfzeile;
  sections: PdfSection[];
  /**
   * Optional grand-total row rendered after the last section.
   * `grandTotalLabel` in the first column, `grandTotalValue` in the last
   * column (right-aligned). Pre-formatted strings (e.g. CHF).
   */
  grandTotalLabel?: string;
  grandTotalValue?: string;
  filename: string;
}

export interface DocxExportOptions {
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  table?: {
    headers: string[];
    rows: string[][];
  };
  filename: string;
}

export interface XlsxColumn {
  header: string;
  key: string;
  width?: number;
}

export interface XlsxSheet {
  sheetName: string;
  columns: XlsxColumn[];
  rows: Record<string, string | number | bigint>[];
}

export interface XlsxExportOptions {
  sheetName: string;
  columns: XlsxColumn[];
  rows: Record<string, string | number | bigint>[];
  filename: string;
}

/**
 * Multi-sheet XLSX export: writes several worksheets (e.g. Leistungen + Auslagen)
 * into a single .xlsx workbook. Falls back to a single sheet when `sheets` is omitted.
 */
export interface XlsxMultiSheetExportOptions {
  sheets: XlsxSheet[];
  filename: string;
}

// ─── Browser download helper ─────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has time to register.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ─── PDF export (jspdf + jspdf-autotable v5 functional API) ──────────────────
//
// Supports two modes:
//   1. Single-section: pass `columns` + `rows` (legacy PdfExportOptions).
//   2. Multi-section: pass `sections` (PdfMultiSectionExportOptions) to render
//      several tables (e.g. Leistungen + Auslagen) in one PDF, each preceded
//      by a section heading. The first table starts after the title block;
//      subsequent tables are placed below the previous one via didDrawPage.

export async function exportPdf(
  opts: PdfExportOptions | PdfMultiSectionExportOptions,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  // ── Kopfzeile (optional, ganz oben vor dem Titel) ──────────────────────────
  // Wird nur für Multi-Section-Exports ausgewertet (LeistungenPage). Enthält
  // Kanzlei-Name, Ersteller, Erstellungsdatum und die Filtereinstellungen.
  let cursorY = 40;
  const multiOpts =
    "sections" in opts && Array.isArray(opts.sections)
      ? (opts as PdfMultiSectionExportOptions)
      : null;
  if (multiOpts?.kopfzeile) {
    const k = multiOpts.kopfzeile;
    doc.setFontSize(11);
    if (k.kanzleiName) {
      doc.setFont("helvetica", "bold");
      doc.text(k.kanzleiName, 40, cursorY);
      doc.setFont("helvetica", "normal");
      cursorY += 16;
    }
    doc.setFontSize(9);
    if (k.ersteller) {
      doc.text(`Ersteller: ${k.ersteller}`, 40, cursorY);
      cursorY += 13;
    }
    if (k.erstellungsdatum) {
      doc.text(`Erstellungsdatum: ${k.erstellungsdatum}`, 40, cursorY);
      cursorY += 13;
    }
    const filterParts: string[] = [];
    if (k.filterLeistungserbringer) {
      filterParts.push(`Leistungserbringer: ${k.filterLeistungserbringer}`);
    }
    if (k.filterStatus) {
      filterParts.push(`Status: ${k.filterStatus}`);
    }
    if (filterParts.length > 0) {
      doc.text(`Filter: ${filterParts.join("  ·  ")}`, 40, cursorY);
      cursorY += 13;
    }
    // Trennlinie unter der Kopfzeile
    doc.setDrawColor(62, 53, 108);
    doc.setLineWidth(0.75);
    doc.line(40, cursorY, 555, cursorY);
    cursorY += 14;
  }

  // Title block
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, 40, cursorY);
  doc.setFont("helvetica", "normal");
  let titleY = cursorY + 18;
  if (opts.subtitle) {
    doc.setFontSize(10);
    doc.text(opts.subtitle, 40, titleY);
    titleY += 14;
  }

  const isMulti = multiOpts !== null;
  if (isMulti && multiOpts) {
    let nextY = titleY + 4;
    for (const section of multiOpts.sections) {
      // Section heading
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(section.title, 40, nextY);
      doc.setFont("helvetica", "normal");
      nextY += 14;
      const hasTotal =
        section.totalLabel !== undefined && section.totalValue !== undefined;
      autoTable(doc, {
        startY: nextY,
        head: [section.columns.map((c) => c.header)],
        body: section.rows.map((row) =>
          section.columns.map((c) => String(row[c.dataKey] ?? "")),
        ),
        ...(hasTotal
          ? {
              foot: [
                section.columns.map((_c, i) =>
                  i === 0
                    ? (section.totalLabel as string)
                    : i === section.columns.length - 1
                      ? (section.totalValue as string)
                      : "",
                ),
              ],
            }
          : {}),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [62, 53, 108] }, // matches --primary purple
        footStyles: {
          fillColor: [240, 238, 246],
          textColor: [62, 53, 108],
          fontStyle: "bold",
          halign: "right" as const,
        },
        columnStyles: hasTotal
          ? {
              [section.columns.length - 1]: { halign: "right" as const },
            }
          : undefined,
        margin: { left: 40, right: 40 },
      });
      // autoTable updates doc.lastAutoTable.finalY
      const lastY =
        // @ts-expect-error jspdf-autotable attaches lastAutoTable to the doc
        (doc.lastAutoTable?.finalY as number | undefined) ?? nextY;
      nextY = lastY + 28;
    }

    // ── Gesamttotal-Zeile am Ende (optional) ────────────────────────────────
    if (
      multiOpts.grandTotalLabel !== undefined &&
      multiOpts.grandTotalValue !== undefined
    ) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      // Linie über dem Gesamttotal
      doc.setDrawColor(62, 53, 108);
      doc.setLineWidth(0.5);
      doc.line(40, nextY - 6, 555, nextY - 6);
      doc.text(multiOpts.grandTotalLabel, 40, nextY + 6);
      doc.text(multiOpts.grandTotalValue, 555, nextY + 6, {
        align: "right",
      });
      doc.setFont("helvetica", "normal");
    }
  } else {
    const single = opts as PdfExportOptions;
    autoTable(doc, {
      startY: titleY,
      head: [single.columns.map((c) => c.header)],
      body: single.rows.map((row) =>
        single.columns.map((c) => String(row[c.dataKey] ?? "")),
      ),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [62, 53, 108] }, // matches --primary purple
      margin: { left: 40, right: 40 },
    });
  }

  doc.save(opts.filename);
}

// ─── DOCX export (docx v9) ────────────────────────────────────────────────────

export async function exportDocx(opts: DocxExportOptions): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = await import("docx");

  const children: DocxParagraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: "Heading1",
      children: [new TextRun({ text: opts.title, bold: true, size: 32 })],
    }),
  );

  if (opts.subtitle) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: opts.subtitle, size: 22 })],
        spacing: { after: 200 },
      }),
    );
  }

  // Free-text paragraphs
  if (opts.paragraphs) {
    for (const p of opts.paragraphs) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: p, size: 22 })] }),
      );
    }
  }

  const docBlocks: (DocxParagraph | DocxTable)[] = [...children];

  // Optional table
  if (opts.table) {
    const headerRow = new TableRow({
      tableHeader: true,
      children: opts.table.headers.map(
        (h) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true })],
              }),
            ],
          }),
      ),
    });
    const bodyRows = opts.table.rows.map(
      (cells) =>
        new TableRow({
          children: cells.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({ children: [new TextRun({ text: cell })] }),
                ],
              }),
          ),
        }),
    );
    docBlocks.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [headerRow, ...bodyRows],
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: buildPageProperties(false),
        },
        children: docBlocks,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  // OOXML-Post-Processing: fehlendes <wps:cNvPr id name> in jedem
  // <wps:nvSpPr> ergänzen (docx 9.7.1 Bug). WYSIWYG-Geometrie bleibt
  // erhalten — nur cNvPr wird hinzugefügt.
  const patchedBlob = await patchDocxXml(blob);
  triggerDownload(patchedBlob, opts.filename);
}

// ─── Rechnung DOCX export (true Office Open XML .docx) ───────────────────────
//
// Generates a formatted invoice document matching the on-screen layout:
// kanzlei header, klient address block, rechnung metadata, leistungen + auslagen
// table, subtotal / MWST / total rows, and zahlungsbedingungen footer.
//
// mwstSatz is stored as basis points on the Mandat (810 = 8.1%). The displayed
// percentage is computed as mwstSatz / 100.

export interface RechnungDocxParams {
  rechnung: {
    rechnungsnummer: string;
    rechnungsdatum: string;
    faelligkeitsdatum: string;
    leistungszeitraumVon: string;
    leistungszeitraumBis: string;
    subtotal: bigint;
    mwstBetrag: bigint;
    total: bigint;
    zahlungsbedingungen: string;
    /**
     * Optionale Währung der Rechnung (z.B. "CHF", "EUR", "USD"). Ein paralleler
     * Backend-Task fügt `waehrung` dem Rechnung-Record hinzu; bis dahin ist
     * das Feld hier optional und der Renderer fällt auf mandat.waehrung bzw.
     * "CHF" zurück.
     */
    waehrung?: string;
  };
  klient: {
    name: string;
    strasse: string;
    plzOrt: string;
  } | null;
  mandat: {
    bezeichnung: string;
    mwstSatz: bigint;
    zahlungsbedingungen: string;
    auslagenregelung?: "Keine" | "Effektiv" | "Pauschal";
    pauschalBetrag?: bigint; // Rappen (nur bei Auslagenregelung "Pauschal")
    waehrung?: string;
  } | null;
  leistungen: Array<{
    datum: string;
    taetigkeit: string;
    dauer: bigint;
    honorar: bigint;
    /**
     * Principal des Leistungserbringers dieser Position. Akzeptiert wird
     * sowohl ein `Principal` (wie er aus den backend Leistung[]/Auslage[]
     * Bindings kommt) als auch dessen String-Repräsentation
     * (Principal.toText()). Wird verwendet, um den LE-Namen pro Position
     * über den `leistungsErbringerProPosition`-Lookup aufzulösen und bei
     * mehreren eindeutigen LE eine zusätzliche LE-Spalte zu rendern.
     * Fehlt dieser Wert (Datenintegritätsfehler), wird ein Platzhalter
     * ("—") gerendert — KEIN Fallback aus Mandat/Kanzlei/User.
     */
    leistungserbringerId?: Principal | string;
  }>;
  auslagen: Array<{
    datum: string;
    beschreibung: string;
    betrag: bigint;
    /**
     * Principal des Leistungserbringers dieser Auslage.
     * Siehe `leistungen[].leistungserbringerId` für Semantik.
     */
    leistungserbringerId?: Principal | string;
  }>;
  /**
   * Kanzlei-Name für die Platzhalter-Substitution ({{kanzlei_name}}). P1-Fix
   * WYSIWYG: Für den absenderadresse-Case wird kanzleiName NICHT mehr
   * verwendet — die Absenderadresse kommt ausschliesslich aus den
   * Kanzlei-Stammdaten via getAbsenderadresse(stammdaten). kanzleiName ist
   * daher optional; Aufrufer, die nur stammdaten haben, können es weglassen.
   */
  kanzleiName?: string;
  kanzleiAdresse?: string;
  /**
   * Kanzlei-Stammdaten (Einstellungen > Kanzleidaten). P1-Fix WYSIWYG: Die
   * Absenderadresse wird JETZT ausschliesslich aus diesen Stammdaten via
   * getAbsenderadresse(stammdaten) aufgebaut — KEIN Fallback auf kanzleiName
   * (currentUser) oder kanzleiAdresse. kanzleiName/kanzleiAdresse bleiben
   * für die Platzhalter-Substitution ({{kanzlei_name}}/{{kanzlei_adresse}})
   * erhalten, werden für den absenderadresse-Case aber NICHT mehr verwendet.
   */
  stammdaten?: KanzleiStammdaten | null;
  leistungserbringerName?: string;
  /**
   * Lookup Principal-als-String → LE-Name, aufgelöst im Frontend
   * (RechnungenPage.tsx) aus den geladenen Leistungserbringern der
   * Kanzlei. Wird verwendet, um pro fakturierter Position (Leistung
   * oder Auslage) den LE-Namen zu ermitteln. Die eindeutigen LE-Namen
   * aus den tatsächlich fakturierten Positionen steuern, ob der
   * mandatsinfo-Block einen einzelnen LE zeigt (1 eindeutiger LE) oder
   * ob Leistungsübersicht/Auslagen eine zusätzliche LE-Spalte erhalten
   * (mehrere eindeutige LE). Bleibt der Lookup leer, fällt der Renderer
   * auf `leistungserbringerName` (1-LE-Fallback) bzw. Platzhalter "—"
   * zurück — niemals auf Mandat/Kanzlei/User.
   *
   * Kanonischer Name: `leistungsErbringerProPosition` (RechnungenPage.tsx
   * verwendet diesen Namen an allen 3 Call-Sites).
   */
  leistungsErbringerProPosition?: Record<string, string>;
  /**
   * Explizit übergebene Währung (überschreibt rechnung.waehrung / mandat.waehrung).
   * Wenn nicht gesetzt, ermittelt der Renderer die Währung aus rechnung.waehrung
   * → mandat.waehrung → "CHF" (Fallback). Erlaubt Aufrufern, die Währung
   * zentral zu steuern, ohne die Rechnungsdaten zu mutieren.
   */
  currency?: string;
  filename: string;
}

// ─── V2-Layout → DOCX Mapping ──────────────────────────────────────────────
//
// When a Rechnungsvorlage carries a non-null `layoutV2` (VorlageLayoutV2), the
// PDF/Word export consumes the V2 grid layout instead of the legacy V1
// VorlageLayout (absenderPosition/empfaengerPosition/logoPosition). The V2
// layout is a 12-column × 24-row grid; each LayoutElement has an `order`
// (document flow sequence), a `gridArea` (row/col/rowSpan/colSpan), a
// `visible` flag, and an optional `alignment` (links/zentriert/rechts).
//
// Mapping strategy (editor grid → docx document):
//   1. SORT visible elements by `order` ascending → document flow sequence.
//      Elements with visible === false are skipped entirely.
//   2. GROUP elements into "row bands" by gridArea.row. Elements sharing the
//      same row band render side-by-side; bands are ordered top-to-bottom by
//      row. This preserves the visual top-to-bottom arrangement of the editor.
//   3. HORIZONTAL placement: the 12 grid columns map to three docx thirds —
//      left third (col 0–3), middle third (col 4–7), right third (col 8–11).
//      A band with a single element spanning all 12 columns renders full-width
//      (no wrapping table). A band with multiple elements renders as a
//      borderless 3-column docx Table so the elements appear side-by-side.
//   4. ALIGNMENT: each element's optional `alignment` (links/zentriert/rechts)
//      maps via the existing positionToAlignment helper to the paragraph /
//      cell alignment. When alignment is absent, a sensible default is used
//      (left for text blocks, right for the summenblock).
//   5. PAGE BREAKS: the `leistungspositionen` element has variable height
//      (variable number of line items). It is rendered as a full-width docx
//      Table that expands naturally and pushes subsequent bands down. docx
//      handles automatic page flow for the table rows. Es wird KEIN manueller
//      pageBreakBefore mehr eingefügt — die statischen Elemente stehen an
//      ihren vorgesehenen Startpositionen, die dynamischen Bereiche
//      (Leistungspositionen, Spesen/Auslagen) wachsen vertikal ab ihrer
//      Startposition im natürlichen Dokumentfluss, der Summen-/MWST-Block
//      folgt direkt danach, und Zahlungsinformationen/Schlusstext/Fusszeile
//      schliessen sich im Fluss an. Word selbst bricht die Seite um, sobald
//      der verfügbare A4-Druckbereich ausgeschöpft ist. Eine normale Rechnung
//      (1-3 Leistungen + 1 Auslage) bleibt so auf einer A4-Seite, sofern
//      geometrisch Platz vorhanden ist; längere Rechnungen brechen sauber auf
//      Folgeseiten um. Subsequent bands (summenblock, zahlungsinformationen,
//      fusszeile) flow after the table on whatever page the table ends on —
//      they never overlap because docx lays them out sequentially.
//
// Technically unavoidable differences between editor and export:
//   - Exact pixel/grid positions cannot be reproduced in docx; only the
//     three-thirds horizontal placement and the row-band ordering are
//     preserved. The editor's free 12×24 grid is approximated by thirds.
//   - rowSpan/colSpan influence which third an element lands in and whether a
//     band is full-width or side-by-side, but exact span sizes are not
//     reproduced (docx cells size to content).
//   - The variable-height leistungspositionen table may span multiple pages;
//     the editor shows it as a fixed-height grid cell.

/**
 * A single visible V2 layout element with its grid coordinates converted to
 * numbers (GridArea fields are bigint). Used internally by the V2 export path.
 * Exported so unit tests can assert on the normalized shape.
 *
 * Typography fields (fontFamily, fontSize, bold, italic) are carried through
 * from the backend LayoutElement so the V2 renderer can apply per-element
 * font/size/weight to every TextRun. fontSize is stored in points (pt) here
 * (already converted from bigint); the renderer converts to docx half-points
 * via fontSizeToHalfPoints().
 */
// ─── mm → Twips Hilfsfunktion (P2.7/P2.9 Word-Renderer) ──────────────────────
// Word rechnet intern in Twips (1/20 Punkt). 1 Zoll = 1440 Twips, 1 Zoll =
// 25.4 mm → 1 mm = 1440 / 25.4 = 56.6929 Twips. Diese Hilfsfunktion ist die
// EINZIGE Umrechnung mm→Twips im Word-Renderer; alle Section-/Margin-/Header-/
// Footer-Distanzen leiten sich daraus ab. A4 = 210×297 mm = 11906×16838 Twips.
const TWIPS_PER_MM = 1440 / 25.4; // 56.6929...
export function mmToTwips(mm: number): number {
  return Math.round(mm * TWIPS_PER_MM);
}

// ─── Editor-mm → Word-EMU für Floating Shapes (relative:page) ─────────────────
//
// Zentraler Konverter für Floating Shapes (WpsShapeRun/Textbox mit
// IFloating), die relativ zur PAGE positioniert werden (relative:page).
//
// Koordinatensystem: xMm/yMm/widthMm/heightMm sind PAGE-ABSOLUTE mm auf einem
// A4-Blatt (210×297 mm, Ursprung oben-links) — genau das gleiche Modell, das
// der Editor für LayoutElement.xMm/yMm/widthMm/heightMm verwendet. Sie sind
// NICHT druckbereichs-relativ.
//
// WICHTIG — KEIN Druckbereich-Offset:
//   Für Floating Shapes mit relative:page darf das marginLeftMm/marginTopMm
//   NICHT subtrahiert werden. xMm/yMm sind bereits page-absolut; ein Abzug
//   würde das Shape um den Druckbereich-Offset verschieben. (Im Gegensatz dazu
//   subtrahiert elementLeftTwips() das marginLeftMm EINMAL, um page-absolute
//   mm in druckbereichs-relative Twips für Tabellen-Indents umzurechnen —
//   das ist ein anderer Use-Case und bleibt unangetastet.)
//
// Umrechnung: 1 mm = 36000 EMU (Word-DrawingML-Einheit). Alle vier Werte werden
// gerundet, da EMU ganzzahlig sein müssen.
//
// Additiv & regressionssicher: berührt KEINE bestehende Helper
// (elementLeftTwips, mmToTwips, sharedBetragRightMm), KEINE Resolver, KEINE
// Render-Cases. Wird erst vom geplanten Floating-Textbox-POC verwendet.
const EMU_PER_MM = 36000;

// DEFECT 4 (CRITICAL) — docx 9.7.1 transformation.width/height erwartet PIXEL,
// nicht EMU.
//
// ROOT-CAUSE (empirisch verifiziert via probe-units.mjs, August 2026):
// docx 9.7.1 skaliert transformation.width/height intern mit dem Faktor 9525
// (EMU pro Pixel bei 96 DPI: 914400 EMU/Zoll ÷ 96 px/Zoll = 9525 EMU/px).
// Wird EMU an transformation.width übergeben (z.B. 2'880'000 für 80mm),
// emittiert docx cx = 2'880'000 × 9525 = 27'432'000'000 EMU (= 762'000 mm —
// absurd, A4 ist 210mm breit). Word Desktop lehnt die Datei ab ("Fehler beim
// Öffnen"). Die Probe lieferte für Run A (transformation=2880000) cx=27'432'000'000,
// für Run B (transformation=80) cx=762'000 (= 80 × 9525), und für Run D
// (transformation=302.36 px = 80mm bei 96 DPI) cx=2'880'000 (korrekt!).
//
// FIX: transformation.width/height wird in PIXELN (96 DPI) übergeben:
//   mm → px via mm × (96 / 25.4) = mm × 3.779527559...
//   80mm → 302.36 px → docx × 9525 = 2'880'000 EMU (cx, korrekt)
//   18.52mm → 70 px → docx × 9525 = 666'750 EMU (cx, korrekt)
//
// floating.offset bleibt in EMU (passthrough, kein Scaling — empirisch
// bestätigt: Run A/B/D lieferten posOffset = Eingabewert unverändert).
const PX_PER_MM = 96 / 25.4; // 3.779527559... px/mm bei 96 DPI
export interface WordEmuRect {
  /** Shape-X in EMU (page-absolut, relative:page) — für floating.offset. */
  xEmu: number;
  /** Shape-Y in EMU (page-absolut, relative:page) — für floating.offset. */
  yEmu: number;
  /** Shape-Breite in EMU (legacy/Referenz — NICHT für transformation verwenden). */
  widthEmu: number;
  /** Shape-Höhe in EMU (legacy/Referenz — NICHT für transformation verwenden). */
  heightEmu: number;
  /** Shape-Breite in PIXELN (96 DPI) — für transformation.width (docx 9.7.1). */
  widthPx: number;
  /** Shape-Höhe in PIXELN (96 DPI) — für transformation.height (docx 9.7.1). */
  heightPx: number;
}

// DEFECT 1 (CRITICAL) — Defensive Guard gegen EMU-skalierte widthMm/heightMm.
//
// ROOT-CAUSE (forensisch verifiziert an der echten v18 .docx): Die gespeicherte
// Vorlage liefert widthMm/heightMm in EMU-Skala (z.B. 666750 statt 18.52),
// während xMm/yMm korrekt in mm ankommen (z.B. 20). editorMmToWordEmu
// multipliziert widthMm*36000 → 24'003'000'000 EMU (= 666'750 mm — absurd,
// A4 ist 210mm breit). Word Desktop lehnt die Datei ab ("Fehler beim Öffnen").
// Die Quelle der EMU-Skalierung liegt in der gespeicherten Vorlage (Backend /
// Editor-Save-Pfad), die ausserhalb des Scopes dieses Fixes liegt. Daher wird
// hier ein DEFENSIVER GUARD eingebaut, der robust gegen gemischte Einheiten ist:
//
//   - Schwellwert 500 mm: kein A4-Element kann legitimerweise breiter/höher als
//     297 mm sein. 500 mm als sicherer Schwellwert.
//   - Für widthMm/heightMm > 500 wird der Wert als bereits-EMU interpretiert
//     und durch 36000 geteilt, BEVOR die reguläre Multiplikation erfolgt.
//   - Idempotenz für echte mm-Eingaben: 80 mm → 80*36000 = 2'880'000 EMU
//     (unverändert, da 80 < 500). 666750 EMU-Eingabe → 666750/36000 = 18.52 mm
//     → *36000 = 666750 EMU = 18.52 mm (visuell korrekt).
//   - Der Guard gilt NUR für widthMm/heightMm — xMm/yMm sind forensisch als
//     korrekt mm bestätigt (z.B. posOffset 720000 = 20 mm) und bleiben
//     unangetastet.
//
// Der Guard verändert die visuelle Grösse KEINES korrekten mm-Elements: für
// alle legitimen Werte (< 500 mm) ist das Ergebnis identisch zur alten Formel.
const EMU_GUARD_THRESHOLD_MM = 500;
/**
 * Defensive Normalisierung eines mm-Wertes, der versehentlich in EMU-Skala
 * gespeichert wurde. Werte > EMU_GUARD_THRESHOLD_MM werden als bereits-EMU
 * interpretiert und durch EMU_PER_MM geteilt, sodass die nachfolgende
 * Multiplikation die korrekte visuelle Grösse liefert. Für echte mm-Eingaben
//  (< Schwellwert) ist die Funktion die Identität. Siehe Block-Kommentar oben.
 */
function normalizeMmOrEmu(valueMm: number): number {
  if (valueMm > EMU_GUARD_THRESHOLD_MM) {
    return valueMm / EMU_PER_MM;
  }
  return valueMm;
}
/**
 * Wandelt page-absolute Editor-mm (A4, Ursprung oben-links) in Word-EMU um für
 * Floating Shapes mit relative:page. KEIN Druckbereich-Offset — xMm/yMm sind
 * bereits page-absolut. Siehe Block-Kommentar oben für das vollständige
 * Koordinatenmodell.
 *
 * DEFECT 1 — Defensive Guard: widthMm/heightMm werden via normalizeMmOrEmu
 * normalisiert, falls sie versehentlich in EMU-Skala ankommen. xMm/yMm
 * bleiben unangetastet (forensisch als korrekt mm bestätigt).
 */
export function editorMmToWordEmu(
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
): WordEmuRect {
  const wMm = normalizeMmOrEmu(widthMm);
  const hMm = normalizeMmOrEmu(heightMm);
  return {
    xEmu: Math.round(xMm * EMU_PER_MM),
    yEmu: Math.round(yMm * EMU_PER_MM),
    widthEmu: Math.round(wMm * EMU_PER_MM),
    heightEmu: Math.round(hMm * EMU_PER_MM),
    // DEFECT 4 — transformation.width/height will in PIXELN (96 DPI) übergeben,
    // da docx 9.7.1 intern mit 9525 EMU/px multipliziert. px = mm × (96/25.4).
    // Der Guard (normalizeMmOrEmu) läuft VOR der px-Umrechnung, sodass
    // EMU-korrupte widthMm (z.B. 666750) zuerst zu 18.52mm normalisiert werden
    // und dann 70 px ergeben → cx=666'750 (korrekt).
    widthPx: wMm * PX_PER_MM,
    heightPx: hMm * PX_PER_MM,
  };
}

// A4-Default-Geometrie in mm (DIN ISO 216 Hochformat). Wird verwendet, wenn die
// Vorlage keine layoutV2-Seitengeometrie liefert (V1/Fallback-Pfad oder
// layoutV2 mit null-Werten).
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const DEFAULT_MARGIN_MM = 20;

/**
 * Baut die docx-Section-Properties (page.size + page.margin inkl. header-/
 * footer-Distanz) aus der gespeicherten Vorlagen-Geometrie. Alle Werte werden
 * EXPLIZIT gesetzt — Word-Defaults werden nie überlassen, sobald eine Vorlage
 * existiert.
 *
 * Geometrie-Quelle: vorlage?.layoutV2 (VorlageLayoutV2) mit
 * pageWidthMm/pageHeightMm/marginTopMm/marginBottomMm/marginLeftMm/marginRightMm.
 * Fallback für null/undefined: A4 210×297 mm, 20 mm Ränder.
 *
 * headerDistance / footerDistance werden aus dem Margin-Modell abgeleitet:
 *   headerDistance = marginTopMm  (Kopfzeile sitzt am oberen Rand, der
 *                                  Druckbereich beginnt darunter — Header
 *                                  überlappt nicht mit dem Body)
 *   footerDistance = marginBottomMm (Fusszeile sitzt am unteren Rand, der
 *                                    Druckbereich endet darüber)
 * In Word ist `header` der Abstand Seitenoberkante→Kopfzeile, `margin.top`
 * der Abstand Seitenoberkante→Body. Damit die Kopfzeile in der oberen
 * Randzone sitzt und der Body darunter beginnt, muss header ≤ margin.top
 * sein. Wir setzen header = margin.top (volle mm, NICHT halbiert), sodass
 * 5mm → 283 Twips → 0.5cm, 10mm → 567 Twips → 1.0cm, 20mm → 1134 Twips
 * → 2.0cm. Analog für footer. margin.top/margin.bottom selbst bleiben
 * unverändert. Der vorherige Faktor 0.5 halbierte den Wert (5mm→2.5mm Bug).
 *
 * @param vorlage  Rechnungsvorlage (optional); ohne Vorlage gelten A4-Defaults.
 * @param useV2    true für den V2-Pfad (liest layoutV2 aus); false für den
 *                 V1/Fallback-Pfad (A4 + 20 mm, keine layoutV2-Auswertung).
 */
function buildPageProperties(
  useV2: boolean,
  vorlage?: Rechnungsvorlage | null,
): {
  size: {
    width: number;
    height: number;
    orientation: "portrait" | "landscape";
  };
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    header: number;
    footer: number;
  };
} {
  // Default: A4 Hochformat, 20 mm Ränder.
  let pageWidthMm = A4_WIDTH_MM;
  let pageHeightMm = A4_HEIGHT_MM;
  let marginTopMm = DEFAULT_MARGIN_MM;
  let marginBottomMm = DEFAULT_MARGIN_MM;
  let marginLeftMm = DEFAULT_MARGIN_MM;
  let marginRightMm = DEFAULT_MARGIN_MM;

  if (useV2 && vorlage?.layoutV2) {
    const lv = vorlage.layoutV2;
    if (typeof lv.pageWidthMm === "number" && lv.pageWidthMm > 0) {
      pageWidthMm = lv.pageWidthMm;
    }
    if (typeof lv.pageHeightMm === "number" && lv.pageHeightMm > 0) {
      pageHeightMm = lv.pageHeightMm;
    }
    if (typeof lv.marginTopMm === "number") marginTopMm = lv.marginTopMm;
    if (typeof lv.marginBottomMm === "number")
      marginBottomMm = lv.marginBottomMm;
    if (typeof lv.marginLeftMm === "number") marginLeftMm = lv.marginLeftMm;
    if (typeof lv.marginRightMm === "number") marginRightMm = lv.marginRightMm;
  }

  return {
    size: {
      width: mmToTwips(pageWidthMm),
      height: mmToTwips(pageHeightMm),
      orientation: "portrait",
    },
    // header = voller oberer Rand, footer = voller unterer Rand (siehe
    // Kommentar oben): so sitzen Kopf-/Fusszeile in der Randzone und der Body
    // beginnt unter dem Header bzw. endet über dem Footer (keine Überlappung).
    // Der Wert wird NICHT halbiert — 5mm→283 Twips→0.5cm, 10mm→567→1.0cm,
    // 20mm→1134→2.0cm.
    margin: {
      top: mmToTwips(marginTopMm),
      right: mmToTwips(marginRightMm),
      bottom: mmToTwips(marginBottomMm),
      left: mmToTwips(marginLeftMm),
      header: mmToTwips(marginTopMm),
      footer: mmToTwips(marginBottomMm),
    },
  };
}

export interface V2Element {
  id: LayoutElementId;
  order: number;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  alignment: Position | undefined;
  fontFamily: string | undefined;
  fontSize: number | undefined;
  bold: boolean | undefined;
  italic: boolean | undefined;
  // P2.7/P2.8 — gespeicherte Dokumentgeometrie in mm (persistent in layoutV2).
  // Der Word-Renderer leitet daraus die Spaltenbreiten, die Header-/Footer-
  // Platzierung und die relative Region jedes Elements ab. xMm/yMm sind die
  // obere-linke Ecke, widthMm/heightMm die Ausdehnung. zOrder steuert die
  // Stapelreihenfolge (höher = vorne). Alle Felder sind optional; bei undefined
  // fällt der Renderer auf die gridArea-basierte Drittel-Logik zurück.
  xMm: number | undefined;
  yMm: number | undefined;
  widthMm: number | undefined;
  heightMm: number | undefined;
  zOrder: number | undefined;
}

/**
 * Maps a backend LayoutElement fontFamily string to a docx-compatible font
 * name. Helvetica is not installed on Windows by default, so we fall back to
 * Arial (visually near-identical). Unknown / missing families default to
 * Arial as well, matching the existing hardcoded rendering baseline.
 *
 * P1-Fix: The backend LayoutElement.fontFamily variant includes a `standard`
 * case. "Standard" must NEVER mean "leave font unset and let Word default".
 * Callers MUST resolve `standard` to the template's defined standard font
 * BEFORE calling mapFontFamily (see resolveStandardFont / applyTypography).
 * If `standard` reaches this function unchanged, it is treated as Arial
 * (the deterministic baseline) — never as "omit font".
 */
export function mapFontFamily(family: string | undefined): string {
  if (!family) return "Arial";
  const f = family.trim().toLowerCase();
  if (f === "helvetica") return "Helvetica";
  if (f === "arial") return "Arial";
  if (f === "times new roman" || f === "times") return "Times New Roman";
  // `standard` should have been resolved upstream by applyTypography; if it
  // reaches here, fall back to the deterministic Arial baseline (NOT to
  // "leave font unset" — Word would otherwise apply its own Calibri/Times
  // default and break per-element font determinism).
  if (f === "standard") return "Arial";
  return "Arial";
}

/**
 * Converts a font size in points (pt) to docx half-points (docx expects the
 * `size` TextRun option in half-points, e.g. 22pt → 44). Returns undefined
 * for undefined input so callers can fall back to hardcoded defaults.
 */
export function fontSizeToHalfPoints(
  pt: number | undefined,
): number | undefined {
  if (pt === undefined || pt === null || Number.isNaN(pt)) return undefined;
  return Math.round(pt * 2);
}

/**
 * Normalizes a VorlageLayoutV2 into a sorted list of visible V2Elements with
 * bigint grid fields converted to numbers. Returns null when layoutV2 is
 * absent or has no visible elements (caller falls back to V1).
 */
export function normalizeV2Layout(
  layoutV2: VorlageLayoutV2 | null | undefined,
): V2Element[] | null {
  if (!layoutV2 || !layoutV2.elements || layoutV2.elements.length === 0) {
    return null;
  }
  const out: V2Element[] = [];
  for (const el of layoutV2.elements as LayoutElement[]) {
    if (!el.visible) continue;
    // alignment is ?Position → in generated bindings it's `Position | undefined`
    // (the candid opt is unwrapped to undefined when absent). Guard both shapes.
    const alignment =
      el.alignment !== undefined && el.alignment !== null
        ? (el.alignment as Position)
        : undefined;
    out.push({
      id: el.id,
      order: Number(el.order),
      row: Number(el.gridArea.row),
      col: Number(el.gridArea.col),
      rowSpan: Number(el.gridArea.rowSpan),
      colSpan: Number(el.gridArea.colSpan),
      alignment,
      fontFamily: el.fontFamily,
      fontSize: el.fontSize !== undefined ? Number(el.fontSize) : undefined,
      bold: el.bold,
      italic: el.italic,
      // P2.8 — mm-Geometrie durchreichen (vorher hier verworfen). Der Word-
      // Renderer benötigt xMm/yMm/widthMm/heightMm, um Spaltenbreiten und
      // Header-/Footer-Regionen aus der gespeicherten Vorlage abzuleiten.
      xMm: el.xMm !== undefined && el.xMm !== null ? Number(el.xMm) : undefined,
      yMm: el.yMm !== undefined && el.yMm !== null ? Number(el.yMm) : undefined,
      widthMm:
        el.widthMm !== undefined && el.widthMm !== null
          ? Number(el.widthMm)
          : undefined,
      heightMm:
        el.heightMm !== undefined && el.heightMm !== null
          ? Number(el.heightMm)
          : undefined,
      zOrder: el.zOrder !== undefined ? Number(el.zOrder) : undefined,
    });
  }
  if (out.length === 0) return null;
  // Sort by order ascending (document flow sequence). Ties broken by row then
  // col so side-by-side elements in the same band have a stable order.
  out.sort((a, b) => a.order - b.order || a.row - b.row || a.col - b.col);
  return out;
}

/**
 * Groups V2Elements into "row bands" — arrays of elements that share the
 * same gridArea.row and should render side-by-side. Bands are returned in
 * ascending row order (top-to-bottom visual arrangement of the editor grid).
 *
 * IMPORTANT: The input may arrive sorted by `order` (document-flow sequence
 * from normalizeV2Layout). `order` does NOT correlate with `row` in the
 * default layout — e.g. empfaengeradresse (order=1, row=3) sits between
 * absenderadresse (order=0, row=0) and logo (order=2, row=0). Grouping
 * consecutive same-row elements in `order` sort therefore splits row 0 into
 * two separate bands and places empfaengeradresse (row 3) BEFORE
 * rechnungsmetadaten (row 0), violating the editor's vertical arrangement.
 *
 * FIX: Before grouping, sort by VERTICAL POSITION — primary key `row`
 * ascending, secondary key `yMm` ascending (falls back to row when yMm is
 * undefined), tertiary key `order` ascending for stability. Then group
 * consecutive elements with the same `row` into bands. This makes bands
 * follow vertical position so rechnungsmetadaten (row 0) comes before
 * empfaengeradresse (row 3), matching the editor. All callers benefit
 * because the sort happens inside this pure function.
 *
 * Exported so unit tests can verify the band grouping logic directly.
 */
export function groupIntoBands(elements: V2Element[]): V2Element[][] {
  // Sort by vertical position: row → yMm → order (stable tie-breaker).
  // yMm is the stored mm geometry; when absent we fall back to row so the
  // row key dominates. `order` only breaks ties within the same row so
  // side-by-side elements keep a stable, deterministic order.
  const sorted = [...elements].sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row;
    const ay = a.yMm ?? a.row;
    const by = b.yMm ?? b.row;
    if (ay !== by) return ay - by;
    return a.order - b.order;
  });
  const bands: V2Element[][] = [];
  let currentRow: number | null = null;
  let currentBand: V2Element[] = [];
  for (const el of sorted) {
    if (currentRow === null || el.row === currentRow) {
      currentBand.push(el);
      currentRow = currentRow === null ? el.row : currentRow;
    } else {
      bands.push(currentBand);
      currentBand = [el];
      currentRow = el.row;
    }
  }
  if (currentBand.length > 0) bands.push(currentBand);
  return bands;
}

export function pushStaticBandTable(): void {
  /* Preserved for contract stability — zone renderer replaces the band system. */
}

// ─── V2-Renderer-Hilfsfunktionen (mm-geometrisch, DXA-Twips) ────────────────
// Diese Helfer kapseln die Geometrie-Berechnungen, die der V2-Word-Renderer
// benötigt, um jedes Layoutelement exakt an seiner gespeicherten xMm/widthMm
// zu platzieren. Alle Berechnungen laufen in mm und werden am Ende via
// mmToTwips in DXA-Twips (1/20 Punkt) umgerechnet — die Einheit, die docx für
// `columnWidths`, `indent` und Zellbreiten erwartet. Word-Defaults werden nie
// als Layoutquelle herangezogen.

// (usableWidthMm removed — sharedBetragRightMm is computed inline from the
// leistungspositionen element's xMm + widthMm; no separate helper needed.)

/**
 * ZENTRALER KONVERTER für die linke Word-Position ALLER statischen und
 * dynamischen Layout-Elemente (P1-Fix WYSIWYG-Geometrie). Liefert den DXA-
 * Twips-Tabellen-Indent, den docx-Tabellen als `indent` erhalten.
 *
 * KOORDINATENMODELL (verbindlich, verifiziert gegen LayoutCanvas.tsx):
 *   el.xMm ist SEITEN-ABSOLUT (Ursprung = linke Kante der A4-Seite, 0 = linker
 *   Seitenrand). Der Editor (LayoutCanvas) rendert die Leinwand als volles A4
 *   210×297mm-Blatt (pageWidthMm, aspectRatio "210/297") und platziert jedes
 *   Element direkt bei left=mmToPx(el.xMm) — OHNE marginLeftMm-Offset. Der
 *   Drag-Clamp klemmt xMm auf safeAreaMm.x (=marginLeftMm) … safeAreaMm.x+
 *   safeAreaMm.width, d.h. der Druckbereich beginnt bei xMm=marginLeftMm.
 *   DEFAULT_LAYOUT_V2 bestätigt das: absenderadresse/empfaengeradresse/einleitung
 *   haben xMm=20 (=marginLeftMm) und widthMm=70/170 — xMm=20 ist der linke
 *   DRUCKRAND, gemessen vom Seitenrand, NICHT vom Druckbereich. Wäre xMm
 *   Druckbereich-relativ, müssten diese xMm=0 sein. Sie sind es nicht.
 *
 * INVARIANT — EINMALIGER Druckbereich-Offset (KEIN doppelter, KEIN fehlender):
 *   Word platziert Tabellen relativ zum linken SEITENRAND. buildPageProperties
 *   setzt section.margin.left = mmToTwips(marginLeftMm), sodass Word den
 *   Druckbereich-Offset (marginLeftMm) GENAU EINMAL über den Seitenrand
 *   anwendet. Damit Word-X absolut = xMm wird (seiten-absolut, wie im Editor),
 *   muss der Tabellen-Indent = (xMm - marginLeftMm) sein. Dann ist:
 *     Word-X absolut = marginLeftMm (via page margin) + (xMm - marginLeftMm)
 *                     (via table indent) = xMm  (seiten-absolut, WYSIWYG-exakt).
 *
 *   Ergebnis (DEFAULT_LAYOUT_V2, marginLeftMm=20):
 *     Absenderadresse  xMm=20  → indent=0   → Word-X = 20 + 0  = 20mm  (linker Druckrand)
 *     Empfängeradresse xMm=20  → indent=0   → Word-X = 20 + 0  = 20mm  (linker Druckrand)
 *     Rechnungsmeta.   xMm=90  → indent=70  → Word-X = 20 + 70 = 90mm
 *     Einleitung       xMm=20  → indent=0   → Word-X = 20 + 0  = 20mm  (volle 170mm Druckbreite)
 *
 * ROOT CAUSE des behobenen Bugs (Vor-Vorgänger-Version + Vorgänger-Versions-
 *   Verwirrung): Die Vor-Vorgänger-Version subtrahierte marginLeftMm EINMAL
 *   (indent = mmToTwips(xMm - marginLeftMm)) — das war für das SEITEN-ABSOLUTE
 *   Modell KORREKT. Die +32mm/-18.5mm-Abweichungen, die den Vorgänger-Agent
 *   motivierten, stammten NICHT von dieser Formel, sondern von einem
 *   ABWEICHENDEN Inline-Pfad in der Band-Assemblierung (ehemals
 *   `mmToTwips(bandLeftMm - ml)` mit anderer ml-Auflösung pro Elementtyp) und
 *   von Zell-Margins/Clamp-Interaktionen in einzelnen Render-Cases. Der
 *   Vorgänger-Agent hat (korrekt) die Band-Assemblierung vereinheitlicht, sodass
 *   sie JETZT über diesen EINEN Konverter läuft (siehe bandAnchorEl weiter
 *   unten) — das beseitigt die abweichenden Pfade. Er hat aber ZUSÄTZLICH
 *   (fälschlich) die marginLeftMm-Subtraktion aus elementLeftTwips ENTFERNT,
 *   weil er xMm fälschlich als Druckbereich-relativ annahm. Das erzeugte einen
 *   DOPPELTEN Offset (Word-X = marginLeftMm + xMm = xMm + 20mm) und würde
 *   Absender/Empfänger um +20mm und Metadaten um +20mm verschieben. Fix:
 *   Subtraktion WIEDERHERSTELLEN (indent = mmToTwips(xMm - marginLeftMm)),
 *   Band-Vereinheitlichung BEHALTEN. So gibt es EINEN Konverter mit EINEM
 *   korrekten Offset für alle statischen und dynamischen Elemente.
 *
 * KLEMMUNG:
 *   Der Tabellen-Indent wird auf ≥0 geklemmt (negative Indents sind in Word
 *   ungültig; ein Element am linken Druckrand xMm=marginLeftMm ergibt indent=0).
 *   Es gibt KEINE rechte-Kanten-Klemmung des Indents (ehemals FIX 10): die
 *   verbindliche WYSIWYG-Anforderung verlangt, dass jede xMm-Verschiebung im
 *   Editor exakt im Word-Dokument nachvollzogen wird. Eine rechte-Kanten-
 *   Klemmung würde xMm-Werte nahe am rechten Druckrand abschneiden und die
 *   exakte Position verfälschen. Eine rechte-Kanten-Klemmung der Breite
 *   entfällt ebenfalls — die verbindliche WYSIWYG-Anforderung verlangt, dass
 *   jede widthMm-Angabe im Editor exakt im Word-Dokument nachvollzogen wird.
 *
 * FIX 1/2 (bleiben erhalten): elementLeftTwips ist weiterhin die EINZIGE
 *   Quelle für die linke Position — keine festen Breiten, keine versteckten
 *   leftIndent/firstLineIndent, keine asymmetrischen Cell-Margins, die die
 *   linke Kante verschieben.
 */
/** Wandert ein Array von mm-Spaltenbreiten in DXA-Twips um. */
function columnWidthsFromMm(widthsMm: number[]): number[] {
  return widthsMm.map((w) => mmToTwips(Math.max(0, w)));
}

/**
 * Explizite Zell-Innenabstände in Twips — niemals Word-Defaults überlassen.
 * Oben/Unten 0.5mm, Links/Rechts 1.5mm. docx erwartet Twips für
 * TableCell.margins {top,bottom,left,right}.
 *
 * FIX 2 (Root Cause: versteckte Cell-Margins): Bisher waren die Cell-Margins
 * asymmetrisch oder zu gross, sodass sie die effektive linke Position eines
 * Elements verschoben haben. Jetzt sind sie symmetrisch (links = rechts) und
 * minimal, sodass die linke Kante eines Elements exakt an element.xMm
 * beginnt. Die Margins werden auf ALLE Tabellen (Leistungsübersicht, Auslagen,
 * Summenblock, Band-Tabellen) angewendet, sodass kein Element durch
 * unterschiedliche Cell-Margins verschoben wird.
 */
function cellMarginsTwips(): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  return {
    top: mmToTwips(0.5),
    bottom: mmToTwips(0.5),
    left: mmToTwips(1.5),
    right: mmToTwips(1.5),
  };
}

/**
 * Vertikaler Abstand zwischen zwei Elementen in mm, berechnet als
 * nextElement.yMm - (currentElement.yMm + currentElement.heightMm).
 * Negative Werte (Überlappung in der Vorlage) werden auf 0 geklemmt.
 * Das Folgeelement erhält diesen Abstand als spacing.before in Twips.
 *
 * FIX 3 (Root Cause: Einleitung→Leistungsübersicht kollabiert): Bisher wurde
 * der verticalGap NUR zwischen statischen Text-Blöcken angewendet, aber bei
 * Übergängen Text→Tabelle, Tabelle→Tabelle, Tabelle→Summenblock,
 * Summenblock→Zahlungsinfos, Zahlungsinfos→Schlusstext wurde der Gap
 * übersprungen oder auf 0 gesetzt, weil die Band-Assemblierung für Tabellen-
 * Bänder kein spacing.before berechnete. Dadurch kollabierte z.B. die
 * Einleitung direkt auf die Leistungsübersicht (beide starteten am gleichen
 * Y ohne Abstand). Fix: verticalGapMm wird jetzt für JEDEN Band-Übergang
 * berechnet — unabhängig davon, ob der Vorgänger oder Nachfolger ein Text-
 * Block oder eine Tabelle ist. Die Band-Assemblierung (siehe weiter unten)
 * wendet den Gap als spacing.before auf das erste Block-Element des Bands
 * an (bei Tabellen via vorgelagerter leerer Paragraph mit spacing.before).
 * Das gilt für alle Übergänge: Text→Tabelle, Tabelle→Tabelle,
 * Tabelle→Summenblock, Summenblock→Zahlungsinfos, Zahlungsinfos→Schlusstext.
 */
function verticalGapMm(current: V2Element, next: V2Element): number {
  const cy = typeof current.yMm === "number" ? current.yMm : 0;
  const ch = typeof current.heightMm === "number" ? current.heightMm : 0;
  const ny = typeof next.yMm === "number" ? next.yMm : cy + ch;
  return Math.max(0, ny - (cy + ch));
}

/**
 * Ermittelt die definierte Standard-Schriftart der Vorlage: scannt alle
 * sichtbaren V2Elements und liefert die erste nicht-"standard" fontFamily.
 * Wenn alle Elemente "standard" (oder undefined) sind, fällt die Funktion auf
 * "Arial" zurück — die deterministische Baseline. Das Ergebnis wird an
 * applyTypography als `standardFont` übergeben, damit fontFamily="standard"
 * niemals als "Font weglassen" interpretiert wird.
 *
 * FIX 6 (Root Cause: Word-Default-Fonts in Tabellen): Bisher wurde
 * fontFamily="standard" in Tabellen-Runs (Leistungsübersicht, Auslagen,
 * Summenblock) nicht explizit aufgelöst, sodass Word seinen eigenen Default
 * (Calibri) anwand. resolveStandardFont war bereits korrekt implementiert,
 * aber die Tabellen-Builder haben standardFont nicht konsistent durchgereicht
 * — das ist jetzt behoben (alle Tabellen-Builder rufen applyTypography mit
 * standardFont auf). Diese Funktion bleibt die deterministische Quelle: sie
 * liefert IMMER einen konkreten Font-Namen (nie undefined), sodass
 * applyTypography `font` immer setzen kann.
 */
function resolveStandardFont(elements: V2Element[]): string {
  for (const el of elements) {
    const f = el.fontFamily;
    if (f && f.trim().toLowerCase() !== "standard") {
      return mapFontFamily(f);
    }
  }
  return "Arial";
}

/**
 * Geschätzte Zeilenhöhe in mm für eine gegebene Schriftgrösse in pt.
 * Berechnung: fontSize * 1.2 (Zeilenhöhe-Faktor) / 72 (Punkte pro Zoll) * 25.4
 * (mm pro Zoll). Wird verwendet, um das vertikale Wachstum von
 * Leistungs-/Auslagen-Tabellen abzuschätzen, wenn die Anzahl Zeilen die
 * gespeicherte heightMm überschreitet. Da docx die gerenderte Höhe zur
 * Build-Zeit nicht exponiert, ist dies eine Schätzung; das Ziel ist kein
 * Overlap und ein erhaltener Vorlagen-Folgeabstand.
 */
function estimateRowHeightMm(fontSizePt: number): number {
  return ((fontSizePt * 1.2) / 72) * 25.4;
}

export async function exportRechnungDocx(
  params: RechnungDocxParams,
  vorlage?: Rechnungsvorlage | null,
  logoBytes?: Uint8Array | null,
): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    ImageRun,
    Footer,
    TableLayoutType,
    // WYSIWYG-Floating-Shapes: statische Textelemente als DrawingML-Floating-
    // Shapes mit absoluter X/Y-Position (relative:page). WpsShapeRun extends
    // Run und wird als Kind einer Paragraph gerendert. HorizontalPositionRelativeFrom.PAGE
    // / VerticalPositionRelativeFrom.PAGE liefern seiten-absolute Koordinaten
    // (Ursprung oben-links), passend zum Editor-Koordinatenmodell.
    WpsShapeRun,
    HorizontalPositionRelativeFrom,
    VerticalPositionRelativeFrom,
  } = await import("docx");

  const {
    rechnung,
    klient,
    mandat,
    leistungen,
    auslagen,
    kanzleiName,
    filename,
  } = params;

  // ── Währung ermitteln (P1-Fix: dynamische Währung statt hartcodiert CHF) ──
  // Priorität: params.currency (Aufrufer) → rechnung.waehrung → mandat.waehrung
  // → "CHF" (Fallback). Wird durch den gesamten Renderer-Body gefädelt:
  // placeholderValues, Leistungs-/Auslagen-Tabellen, Summenblock, Footer.
  const currency =
    params.currency ||
    (params.rechnung as { waehrung?: string }).waehrung ||
    params.mandat?.waehrung ||
    "CHF";

  const mwstSatzBp = Number(mandat?.mwstSatz ?? 0);
  const mwstPct = (mwstSatzBp / 100).toFixed(1);
  const zahlungsbedingungen =
    rechnung.zahlungsbedingungen ||
    mandat?.zahlungsbedingungen ||
    "Zahlbar innert 30 Tagen.";

  // ── LE-Logik aus fakturierten Positionen ────────────────────────────────
  // Ermittle die eindeutigen LEs ausschliesslich aus den tatsächlich
  // fakturierten Positionen (leistungen[] + auslagen[]). NICHT aus
  // rechnung.leistungserbringerId, Mandat, Kanzlei, Akquisiteur, Benutzer-
  // Fallback oder MWST-Daten. Jede leistungserbringerId wird über den
  // leistungsErbringerProPosition-Lookup zu einem Namen aufgelöst. Fehlt
  // der Lookup-Eintrag (leere ID oder nicht im Lookup), wird der
  // Platzhalter "—" verwendet — KEIN Fallback aus Mandat/Kanzlei/User.
  //
  // Die Menge der eindeutigen LE-Namen (case-sensitive, trimmed) steuert:
  //   - 1 eindeutiger LE  → mandatsinfo-Block zeigt "Leistungserbringer: <Name>",
  //                         Tabellen behalten ihre Struktur (keine LE-Spalte).
  //   - mehrere eindeutige LE → mandatsinfo-Block zeigt NUR "Mandat: …",
  //                         Leistungsübersicht + Auslagen erhalten eine
  //                         zusätzliche LE-Spalte.
  const leLookup = params.leistungsErbringerProPosition ?? {};
  // resolveLeName akzeptiert sowohl `Principal` (aus backend Bindings) als
  // auch `string`. Beide werden vor dem Lookup via String(...) in ihre
  // kanonische String-Repräsentation überführt — Principal.toString()
  // liefert denselben Text wie Principal.toText(), den buildLeLookup in
  // RechnungenPage.tsx als Key verwendet. So bleibt der Lookup robust,
  // unabhängig davon, ob der Aufrufer Principale oder Strings übergibt.
  const resolveLeName = (id: Principal | string | undefined): string => {
    if (id === undefined || id === null) return "—";
    const idStr = typeof id === "string" ? id : id.toString();
    if (idStr.trim() === "") return "—";
    const name = leLookup[idStr];
    if (!name || name.trim() === "") return "—";
    return name.trim();
  };
  // Eindeutige LE-Namen aus fakturierten Positionen sammeln (case-sensitive,
  // trimmed). "—" (fehlender LE) zählt als eigener eindeutiger Wert, sodass
  // ein Mix aus benannten LEs und fehlenden LEs den Mehrfach-LE-Pfad triggert
  // (Datenintegritätsfehler werden sichtbar, nicht versteckt).
  const uniqueLeNames = new Set<string>();
  for (const l of leistungen) {
    uniqueLeNames.add(resolveLeName(l.leistungserbringerId));
  }
  for (const a of auslagen) {
    uniqueLeNames.add(resolveLeName(a.leistungserbringerId));
  }
  const leCount = uniqueLeNames.size;
  const hasMultipleLe = leCount > 1;
  // Bei genau 1 eindeutigem LE: der Name für die mandatsinfo-Zeile. Bei
  // mehreren LEs bleibt singleLeName ungenutzt (mandatsinfo zeigt nur Mandat).
  // Bei 0 LEs (keine fakturierten Positionen) fällt leCount auf 0 → der
  // mandatsinfo-Block zeigt den Legacy-Fallback params.leistungserbringerName
  // (siehe mandatsinfo-Case), keine LE-Spalten.
  const singleLeName = leCount === 1 ? Array.from(uniqueLeNames)[0] : undefined;

  // Schweizer 5-Rappen-Rundung NUR für die Anzeige im Export.
  // Die gespeicherten Rappen-Werte (rechnung.subtotal/mwstBetrag/total)
  // bleiben im Backend unverändert; hier wird nur die gerundete Darstellung
  // für das PDF/Word-Dokument erzeugt, konsistent mit dem Modal.
  const subtotalRounded = roundTo5Rappen(rechnung.subtotal);
  const mwstBetragRounded = roundTo5Rappen(rechnung.mwstBetrag);
  const totalRounded = roundTo5Rappen(rechnung.total);

  // ── Vorlage anwenden (optional) ──────────────────────────────────────────
  // Wenn eine Rechnungsvorlage übergeben wird, steuert diese ausschliesslich
  // den PDF-/Word-Export: Standardtexte (rechnungstitel, einleitung,
  // zahlungshinweis, schlusstext), Fusszeile, Layout-Positionen (absender /
  // empfaenger / logo) und ein optionales Logo. Die on-screen-Ansicht im
  // Rechnungs-Modal wird dadurch NICHT verändert.
  // Ohne Vorlage gilt der bestehende hartcodierte Layout-Fallback.
  const leistungszeitraum = `${formatDate(rechnung.leistungszeitraumVon)} – ${formatDate(rechnung.leistungszeitraumBis)}`;
  const mwstSatzPct = mwstPct; // already computed above as (mwstSatzBp / 100).toFixed(1)

  // Map Position enum (links/rechts/zentriert) → docx AlignmentType.
  const positionToAlignment = (pos: Position | undefined) => {
    if (pos === "rechts") return AlignmentType.RIGHT;
    if (pos === "zentriert") return AlignmentType.CENTER;
    return AlignmentType.LEFT;
  };

  // Platzhalter-Werte aus den Rechnungsdaten aufbauen. Die Beträge werden
  // mit roundTo5Rappen gerundet und mit formatCHF formatiert, konsistent
  // mit der on-screen-Ansicht im Modal. Die Werte werden sowohl im
  // Vorlagen-Header-Block als auch im Closing-Block (zahlungsbedingungen /
  // schlusstext / fusszeile) verwendet, deshalb hier im weiteren Scope
  // definiert — ausserhalb des `if (vorlage)`-Zweigs.
  const placeholderValues: Record<string, string> = {
    rechnungsnummer: rechnung.rechnungsnummer,
    rechnungsdatum: formatDate(rechnung.rechnungsdatum),
    leistungszeitraum,
    kanzlei_name: kanzleiName ?? "",
    kanzlei_adresse: params.kanzleiAdresse ?? params.kanzleiName ?? "",
    empfaenger_name: klient?.name ?? "",
    empfaenger_adresse: klient
      ? [klient.strasse, klient.plzOrt].filter(Boolean).join(", ")
      : "",
    subtotal: formatCHF(roundTo5Rappen(rechnung.subtotal), currency),
    mwst_betrag: formatCHF(roundTo5Rappen(rechnung.mwstBetrag), currency),
    mwst_satz: `${mwstSatzPct}%`,
    total: formatCHF(roundTo5Rappen(rechnung.total), currency),
    mandat_bezeichnung: mandat?.bezeichnung ?? "",
    leistungserbringer: params.leistungserbringerName ?? "",
    zahlungsbedingungen,
  };

  const resolve = (text: string) =>
    resolvePlaceholders(text, placeholderValues);

  const splitLines = (text: string): string[] => {
    if (!text) return [""];
    return text.split(/\r\n|\n/);
  };

  // ── V2-Layout-Pfad (zone-based) ────────────────────────────────────────────
  // Der Word-Renderer leitet layout-Zonen aus der gespeicherten mm-Geometrie
  // ab (Zone A Kopf links/logo, Zone B Kopf rechts/absender, Zone C Empfänger,
  // Zone D Rechnung, Zone E Mandat, Zone F Einleitung, Zone G Leistungspositionen,
  // Zone H Spesen/Auslagen, Zone I Summen/MWST, Zone J Schlusstext,
  // Zone K Fusszeile als echter Word-Footer). Kanzleien ohne layoutV2
  // (z.B. vor der V2-Migration) fallen auf DEFAULT_LAYOUT_V2 zurück, sodass
  // der Export weiterhin funktioniert — kein harter Fehler mehr.
  const layoutV2 = (vorlage?.layoutV2 ?? DEFAULT_LAYOUT_V2) as VorlageLayoutV2;
  const v2Elements = normalizeV2Layout(layoutV2);
  if (!v2Elements) {
    // Sollte nie eintreten, da DEFAULT_LAYOUT_V2 sichtbare Elemente enthält —
    // defensiver Guard, falls eine ungültige layoutV2 explizit gespeichert wurde.
    throw new Error(
      "Keine gültige V2-Rechnungsvorlage vorhanden — layoutV2 fehlt oder enthält keine sichtbaren Elemente.",
    );
  }

  // ── Shared content builders (reuse V1 logic verbatim) ─────────────────
  // Diese Builder kapseln die Rendering-Logik pro LayoutElementId, sodass
  // die Zonen-Struktur sie wiederverwenden kann, OHNE die Berechnungen
  // (MWST, Totale, Platzhalter) zu verändern. Jeder Builder gibt ein Array
  // von docx-Blöcken (Paragraph | Table) zurück.

  // spesenSeparate: true, wenn ein sichtbares spesenAuslagen-Element im
  // V2-Layout existiert. In diesem Fall rendert das spesenAuslagen-Element
  // die Auslagen in einer separaten Tabelle, und buildLeistungspositionenTable
  // lässt die Auslagen weg (kein Doppelzählung). Ohne sichtbares
  // spesenAuslagen-Element bleiben die Auslagen in die Leistungspositionen
  // eingemischt.
  const spesenSeparate = v2Elements.some(
    (el) => el.id === LayoutElementIdEnum.spesenAuslagen,
  );

  // Definierte Standard-Schriftart der Vorlage — einmalig ermittelt und an
  // applyTypography sowie die Tabellen-Builder durchgereicht. "standard" wird
  // damit nie als "Font weglassen" interpretiert.
  const standardFont = resolveStandardFont(v2Elements);

  // Gemeinsame rechte Kante der Betragsspalte (Leistungsübersicht, Auslagen,
  // Summenblock) in absoluten mm: xMm + widthMm des leistungspositionen-
  // Elements. Alle drei Tabellen richten ihre Betragsspalte rechts an derselben
  // Achse aus.
  //
  // FIX 7 (Root Cause: 190mm-Hardcode): Bisher war der Default fest auf
  // `20 + 170 = 190` mm codiert — das entsprach der DEFAULT_LAYOUT_V2-
  // Konfiguration (marginLeftMm=20, leistungspositionen.widthMm=170). Wenn
  // eine Kanzlei die Vorlage aber auf eine schmalere Druckbreite änderte
  // (z.B. widthMm=150 oder xMm=30), blieb die Betragsachse stur bei 190mm,
  // sodass die Betragsspalte ausserhalb des Druckbereichs rutschte oder nicht
  // mehr mit der Leistungsübersicht fluchtete. Fix: sharedBetragRightMm wird
  // JETZT ausschliesslich aus dem gespeicherten leistungspositionen-Element
  // abgeleitet (xMm + widthMm). Der Fallback (20 + 170 = 190) greift NUR,
  // wenn die Vorlage tatsächlich kein leistungspositionen-Element enthält
  // (z.B. eine leere/defekte layoutV2) — das ist der einzige legitime Default.
  const leistEl = v2Elements.find(
    (el) => el.id === LayoutElementIdEnum.leistungspositionen,
  );
  const sharedBetragRightMm =
    (typeof leistEl?.xMm === "number" ? leistEl.xMm : 20) +
    (typeof leistEl?.widthMm === "number" ? leistEl.widthMm : 170);

  // Positionen table — columns: Datum | Typ | Beschreibung | Dauer | Betrag
  // (1 LE) bzw. Datum | Typ | Beschreibung | Leistungserbringer | Dauer | Betrag
  // (mehrere LE). P1-Fix: FIXED layout + DXA-Twips columnWidths, damit Word die
  // Spaltenbreiten exakt einhält (PERCENTAGE allein lässt Word auto-size). Die
  // Betragsspalte endet rechts an der gemeinsamen Betrag-Kante
  // (sharedBetragRightMm). Vertikale Zelllinien = NIL (kein Vollgitter);
  // horizontale Trennlinien: Kopfzeile unten = dick (Trennlinie Kopf/Daten),
  // Datenzeilen = keine Linien zwischen den Zeilen (Vorlage zeigt keine).
  // Aussenrahmen: nur oben an der Kopfzeile (dünn) — Vorlage zeigt keinen
  // geschlossenen Rahmen. Jeder TextRun bekommt explizit fontFamily/fontSize/
  // bold/italic aus dem leistungspositionen-Element via applyTypography.
  //
  // LE-Spalte bei mehreren eindeutigen LE: Die LE-Spalte wird zwischen
  // Beschreibung und Dauer eingefügt (6 Spalten). Die Betragsspalte behält
  // ihre 28mm rechts an sharedBetragRightMm; Datum (22), Typ (18), Dauer (22)
  // bleiben fix; die LE-Spalte bekommt eine feste 30mm; Beschreibung erhält
  // den verbleibenden Rest. So bleibt die Betragsachse unverändert
  // (sharedBetragRightMm), und die LE-Spalte nimmt ihren Platz aus dem
  // Beschreibungs-Rest — elementLeftTwips/elementWidthTwips bleiben die
  // SINGLE source für Element-Geometrie (Fix 1/2 nicht regressieren).
  //
  // FIX 8 (Root Cause: falsche Rahmen in Leistungs-/Auslagentabellen): Bisher
  // wurden vertikale Linien (links/rechts der Zellen) und ein Word-Gitter
  // (insideVertical) sowie ein Aussenrahmen gerendert, die die Vorlage nicht
  // zeigt. Fix: vertikale Zellränder = NIL (kein Vollgitter, keine vertikalen
  // Linien), Aussenrahmen nur als dünne Linie oben an der Kopfzeile und unten
  // an der letzten Datenzeile (wie im Editor). Horizontale Trennlinie Kopf/
  // Daten = dick. Keine Linien zwischen Datenzeilen. Das entspricht der
  // Vorlage: nur horizontale Linien, keine vertikalen, kein Gitter.
  const buildLeistungspositionenTable = (
    spesenSeparateFlag: boolean,
    currency: string,
  ): (DocxParagraph | DocxTable)[] => {
    const leistElement = v2Elements.find(
      (el) => el.id === LayoutElementIdEnum.leistungspositionen,
    );
    const elW =
      typeof leistElement?.widthMm === "number" ? leistElement.widthMm : 170;
    // Spaltenbreiten in mm. Bei mehreren LE kommt eine LE-Spalte (30mm) zwischen
    // Beschreibung und Dauer; Beschreibung erhält den Rest, sodass die Summe
    // genau elW ergibt und die Betragsspalte rechts bei sharedBetragRightMm
    // endet. Die Betragsachse (28mm rechts) bleibt in beiden Fällen identisch.
    const colDatum = 22;
    const colTyp = 18;
    const colDauer = 22;
    const colBetrag = 28;
    const colLe = 30; // LE-Spalte bei mehreren LE
    const colBeschr = hasMultipleLe
      ? Math.max(20, elW - colDatum - colTyp - colLe - colDauer - colBetrag)
      : Math.max(20, elW - colDatum - colTyp - colDauer - colBetrag);
    const colWidthsMm = hasMultipleLe
      ? [colDatum, colTyp, colBeschr, colLe, colDauer, colBetrag]
      : [colDatum, colTyp, colBeschr, colDauer, colBetrag];
    const colWidthsTw = columnWidthsFromMm(colWidthsMm);
    const margins = cellMarginsTwips();
    // Vertikale (links/rechts) Zellränder = NIL — keine vertikalen Linien,
    // kein Vollgitter. Horizontale Linien pro Vorlage:
    //   - Kopfzeile: oben dünn (optionaler Aussenrand oben), unten dick
    //     (Trennlinie Kopf/Daten).
    //   - Datenzeilen: keine Linien zwischen den Zeilen; die letzte Datenzeile
    //     erhält unten eine dünne Linie als Abschluss, falls die Vorlage einen
    //     Aussenrahmen andeutet (hier: ja, dünne Abschlusslinie).
    const nilBorder = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
    const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
    const thickBorder = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
    const headerCellBorders = {
      top: thinBorder,
      bottom: thickBorder,
      left: nilBorder,
      right: nilBorder,
    };
    const bodyCellBorders = {
      top: nilBorder,
      bottom: nilBorder,
      left: nilBorder,
      right: nilBorder,
    };
    const lastBodyCellBorders = {
      top: nilBorder,
      bottom: thinBorder,
      left: nilBorder,
      right: nilBorder,
    };
    // Index der Betragsspalte (rechtsbündig) — bei mehreren LE ist es die
    // letzte Spalte (Index 5), sonst Index 4.
    const betragIdx = hasMultipleLe ? 5 : 4;
    const headerCells = hasMultipleLe
      ? [
          "Datum",
          "Typ",
          "Beschreibung",
          "Leistungserbringer",
          "Dauer",
          `Betrag (${currency})`,
        ]
      : ["Datum", "Typ", "Beschreibung", "Dauer", `Betrag (${currency})`];
    // Body-Zeilen aufbauen. Bei mehreren LE wird pro Leistung/Auslage der
    // LE-Name (via resolveLeName) zwischen Beschreibung und Dauer eingefügt.
    const bodyRows: string[][] = [];
    for (const l of leistungen) {
      const row = hasMultipleLe
        ? [
            formatDate(l.datum),
            "Honorar",
            l.taetigkeit,
            resolveLeName(l.leistungserbringerId),
            formatDuration(Number(l.dauer)),
            formatAmount(l.honorar),
          ]
        : [
            formatDate(l.datum),
            "Honorar",
            l.taetigkeit,
            formatDuration(Number(l.dauer)),
            formatAmount(l.honorar),
          ];
      bodyRows.push(row);
    }
    if (!spesenSeparateFlag) {
      if (mandat?.auslagenregelung === "Pauschal") {
        const row = hasMultipleLe
          ? [
              formatDate(rechnung.rechnungsdatum),
              "Auslage",
              "Pauschal-Spesen",
              "—",
              "",
              formatAmount(mandat?.pauschalBetrag ?? 0n),
            ]
          : [
              formatDate(rechnung.rechnungsdatum),
              "Auslage",
              "Pauschal-Spesen",
              "",
              formatAmount(mandat?.pauschalBetrag ?? 0n),
            ];
        bodyRows.push(row);
      } else if (
        mandat?.auslagenregelung === "Effektiv" ||
        auslagen.length > 0
      ) {
        for (const a of auslagen) {
          const row = hasMultipleLe
            ? [
                formatDate(a.datum),
                "Auslage",
                a.beschreibung,
                resolveLeName(a.leistungserbringerId),
                "",
                formatAmount(a.betrag),
              ]
            : [
                formatDate(a.datum),
                "Auslage",
                a.beschreibung,
                "",
                formatAmount(a.betrag),
              ];
          bodyRows.push(row);
        }
      }
    }
    const rows: DocxTableRow[] = [
      new TableRow({
        tableHeader: true,
        children: headerCells.map(
          (h, i) =>
            new TableCell({
              borders: headerCellBorders,
              margins,
              width: { size: colWidthsTw[i], type: WidthType.DXA },
              children: [
                new Paragraph({
                  alignment: i === betragIdx ? AlignmentType.RIGHT : undefined,
                  children: [
                    new TextRun({
                      text: h,
                      ...applyTypography(
                        leistElement ?? ({} as V2Element),
                        { bold: true },
                        standardFont,
                      ),
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
      ...bodyRows.map(
        (cells, rowIdx) =>
          new TableRow({
            children: cells.map((cell, i) => {
              const isLast = rowIdx === bodyRows.length - 1;
              return new TableCell({
                borders: isLast ? lastBodyCellBorders : bodyCellBorders,
                margins,
                width: { size: colWidthsTw[i], type: WidthType.DXA },
                children: [
                  new Paragraph({
                    alignment:
                      i === betragIdx ? AlignmentType.RIGHT : undefined,
                    children: [
                      new TextRun({
                        text: cell,
                        ...applyTypography(
                          leistElement ?? ({} as V2Element),
                          {},
                          standardFont,
                        ),
                      }),
                    ],
                  }),
                ],
              });
            }),
          }),
      ),
    ];
    return [
      buildFloatingHeading(
        leistElement ?? ({} as V2Element),
        "Leistungsübersicht",
        standardFont,
      ),
      buildFloatingTable(
        leistElement ?? ({} as V2Element),
        new Table({
          layout: TableLayoutType.FIXED,
          width: { size: mmToTwips(elW), type: WidthType.DXA },
          columnWidths: colWidthsTw,
          rows,
        }),
      ),
    ];
  };

  // Summenblock (Subtotal / MWST / Total) — eigene rechts ausgerichtete
  // Tabelle, nicht in die Positionen-Tabelle integriert.
  // P1-Fix: FIXED layout + DXA-Twips columnWidths. Die Betragsspalte endet
  // rechts an der gemeinsamen Betrag-Kante (sharedBetragRightMm). Alle
  // Zellränder = NIL ausser der EINEN Trennlinie oberhalb Total (dick SINGLE).
  // Keine Linie unter Total, keine vertikalen Linien, kein Aussenrahmen, keine
  // Zellrahmen auf Subtotal/MWST-Zeilen. Total-Zeile fett, andere nicht.
  // Währung dynamisch (currency-Argument), nie hartcodiert CHF.
  //
  // FIX 8 (Root Cause: falsche Summenblock-Rahmen): Bisher gab es vertikale
  // Linien, einen Aussenrahmen und Zellrahmen auf allen Zeilen, sowie eine
  // Linie UNTER Total. Die Vorlage zeigt aber: keine vertikalen Linien, kein
  // Aussenrahmen, keine Zellrahmen, genau EINE horizontale Trennlinie direkt
  // oberhalb Total, keine Linie unter Total. Fix: alle Zellränder = NIL
  // ausser der Total-Zeile, die oben eine dicke Trennlinie erhält
  // (totalTopBorders). Subtotal/MWST-Zeilen haben keine Ränder. Total-Zeile
  // ist fett (labelCell/valueCell mit bold=true). Keine Linie unter Total.
  const buildSummenblockTable = (
    alignment: Position | undefined,
    widthMm: number | undefined,
    currency = "CHF",
  ): DocxTable => {
    const sumElement = v2Elements.find(
      (el) => el.id === LayoutElementIdEnum.summenblock,
    );
    const align = positionToAlignment(alignment);
    const nilBorder = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
    const thickBorder = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
    const margins = cellMarginsTwips();
    // Spalten: 3 Füll-Spalten links (damit Label/Betrag rechtsbündig auf der
    // gemeinsamen Betrag-Kante landen), dann Label-Spalte, dann Betrag-Spalte.
    // 5 Spalten: 3 Füller + Label + Betrag. Betrag-Spalte rechts = 28mm,
    // Label = 32mm, Filler teilen sich den Rest.
    const colBetrag = 28;
    const colLabel = 32;
    //
    // P1-Fix WYSIWYG (Workstream D — right edge from stored template): Die
    // rechte Kante des Summenblocks wird aus dem gespeicherten Template
    // abgeleitet (sharedBetragRightMm = leistungspositionen.xMm + widthMm),
    // NICHT aus einer globalen/absoluten 190mm-Position. Die Block-Breite
    // ergibt sich aus sharedBetragRightMm - el.xMm, sodass die Betragsspalte
    // rechts exakt auf derselben Achse endet wie leistungspositionen und
    // spesenAuslagen (shared betrag axis). el.xMm kommt direkt aus der
    // gespeicherten Vorlage (kein doppelter xMm/Margin-Offset —
    // elementLeftTwips wendet den Druckbereich-Offset genau einmal an).
    // Fallback: wenn el.xMm fehlt, wird 20mm (Default-Druckrand) angenommen.
    // Die Breite ist mindestens colBetrag + colLabel (60mm), damit die
    // Label/Betrag-Spalten Platz haben.
    const sumX = typeof sumElement?.xMm === "number" ? sumElement.xMm : 20;
    const sumW = Math.max(colBetrag + colLabel, sharedBetragRightMm - sumX);
    void widthMm; // Breite aus sharedBetragRightMm abgeleitet, nicht aus el.widthMm
    const fillerTotal = Math.max(0, sumW - colBetrag - colLabel);
    const colFiller = fillerTotal / 3;
    const colWidthsMm = [colFiller, colFiller, colFiller, colLabel, colBetrag];
    const colWidthsTw = columnWidthsFromMm(colWidthsMm);
    const nilBorders = {
      top: nilBorder,
      bottom: nilBorder,
      left: nilBorder,
      right: nilBorder,
    };
    const totalTopBorders = {
      top: thickBorder,
      bottom: nilBorder,
      left: nilBorder,
      right: nilBorder,
    };
    const empty = () =>
      new TableCell({
        borders: nilBorders,
        margins,
        width: { size: colWidthsTw[0], type: WidthType.DXA },
        children: [new Paragraph({ children: [] })],
      });
    const labelCell = (text: string, bold = false) =>
      new TableCell({
        borders: nilBorders,
        margins,
        width: { size: colWidthsTw[3], type: WidthType.DXA },
        children: [
          new Paragraph({
            alignment: align,
            children: [
              new TextRun({
                text,
                // `bold` (Parameter) wird bewusst NICHT explizit gesetzt —
                // applyTypography gibt bereits `bold` zurück und überschreibt
                // es via Spread. Ein explizites `bold` hier wäre ein Duplicate
                // (TS2783) und ohnehin tot (Spread gewinnt). Für die Total-
                // Zeile wird totalLabelCell mit defaults { bold: true } verwendet.
                ...(bold
                  ? applyTypography(
                      sumElement ?? ({} as V2Element),
                      { bold: true },
                      standardFont,
                    )
                  : applyTypography(
                      sumElement ?? ({} as V2Element),
                      {},
                      standardFont,
                    )),
              }),
            ],
          }),
        ],
      });
    const valueCell = (text: string, bold = false) =>
      new TableCell({
        borders: nilBorders,
        margins,
        width: { size: colWidthsTw[4], type: WidthType.DXA },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text,
                // `bold` (Parameter) wird bewusst NICHT explizit gesetzt —
                // applyTypography gibt bereits `bold` zurück und überschreibt
                // es via Spread. Ein explizites `bold` hier wäre ein Duplicate
                // (TS2783) und ohnehin tot (Spread gewinnt). Für die Total-
                // Zeile wird totalValueCell mit defaults { bold: true } verwendet.
                ...(bold
                  ? applyTypography(
                      sumElement ?? ({} as V2Element),
                      { bold: true },
                      standardFont,
                    )
                  : applyTypography(
                      sumElement ?? ({} as V2Element),
                      {},
                      standardFont,
                    )),
              }),
            ],
          }),
        ],
      });
    const totalEmpty = () =>
      new TableCell({
        borders: totalTopBorders,
        margins,
        width: { size: colWidthsTw[0], type: WidthType.DXA },
        children: [new Paragraph({ children: [] })],
      });
    const totalLabelCell = (text: string) =>
      new TableCell({
        borders: totalTopBorders,
        margins,
        width: { size: colWidthsTw[3], type: WidthType.DXA },
        children: [
          new Paragraph({
            alignment: align,
            children: [
              new TextRun({
                text,
                // `bold: true` wird bewusst NICHT explizit gesetzt —
                // applyTypography gibt bereits `bold` zurück und überschreibt
                // es via Spread. Ein explizites `bold: true` hier wäre ein
                // Duplicate (TS2783) und ohnehin tot (Spread gewinnt).
                ...applyTypography(
                  sumElement ?? ({} as V2Element),
                  { bold: true },
                  standardFont,
                ),
              }),
            ],
          }),
        ],
      });
    const totalValueCell = (text: string) =>
      new TableCell({
        borders: totalTopBorders,
        margins,
        width: { size: colWidthsTw[4], type: WidthType.DXA },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text,
                // `bold: true` wird bewusst NICHT explizit gesetzt —
                // applyTypography gibt bereits `bold` zurück und überschreibt
                // es via Spread. Ein explizites `bold: true` hier wäre ein
                // Duplicate (TS2783) und ohnehin tot (Spread gewinnt).
                ...applyTypography(
                  sumElement ?? ({} as V2Element),
                  { bold: true },
                  standardFont,
                ),
              }),
            ],
          }),
        ],
      });
    const rows: DocxTableRow[] = [
      new TableRow({
        children: [
          empty(),
          empty(),
          empty(),
          labelCell("Subtotal"),
          valueCell(formatCHF(subtotalRounded, currency)),
        ],
      }),
      new TableRow({
        children: [
          empty(),
          empty(),
          empty(),
          labelCell(`MWST ${mwstPct} %`),
          valueCell(formatCHF(mwstBetragRounded, currency)),
        ],
      }),
      new TableRow({
        children: [
          totalEmpty(),
          totalEmpty(),
          totalEmpty(),
          totalLabelCell("Total"),
          totalValueCell(formatCHF(totalRounded, currency)),
        ],
      }),
    ];
    // P1-Fix WYSIWYG (Workstream D — summenblock in same coordinate basis as
    // leistungen/auslagen): Die Tabelle wird NICHT über `alignment: RIGHT`
    // innerhalb des Word-Content-Bereichs rechts ausgerichtet — das würde den
    // `indent` (elementLeftTwips) übersteuern und den Block an den rechten
    // Rand des Content-Bereichs drücken (ausserhalb des Rechnungs-Rasters).
    // Stattdessen wird die Tabelle ausschliesslich über `indent` positioniert
    // (elementLeftTwips = xMm relativ zum Druckbereich) und über `width`
    // dimensioniert (elementWidthTwips = widthMm). Die rechte Kante ergibt sich
    // aus xMm + widthMm und fällt damit auf dieselbe Betrag-Achse wie
    // leistungspositionen und spesenAuslagen (sharedBetragRightMm). Kein
    // doppelter xMm/Margin-Offset, kein globaler/absoluter 190mm-Bezug, kein
    // Aussenrahmen, genau eine Trennlinie oberhalb Total, Beträge rechts-
    // ausgerichtet (valueCell mit AlignmentType.RIGHT). Der Block bleibt
    // damit IM Rechnungs-Raster, nicht weit rechts ausserhalb des Layouts.
    return buildFloatingTable(
      sumElement ?? ({} as V2Element),
      new Table({
        layout: TableLayoutType.FIXED,
        width: { size: mmToTwips(sumW), type: WidthType.DXA },
        columnWidths: colWidthsTw,
        rows,
      }),
    );
  };

  // applyTypography: per-element Typografie. Übernimmt fontFamily, fontSize,
  // bold und italic aus dem V2Element und fällt bei undefined auf die
  // bestehenden hardcoded Defaults zurück. Wird in jeden TextRun gespreadet.
  //
  // P1-Fix (FIX 5 + FIX 6): fontFamily = "standard" wird hier explizit auf
  // die definierte Standard-Schriftart der Vorlage (standardFont-Argument)
  // aufgelöst und IMMER als `font` im Ergebnis gesetzt — niemals
  // undefined/omitted. Word würde sonst seinen eigenen Default
  // (Calibri/Times) anwenden und die per-Element-Font-Determinismus brechen.
  // "Standard" bedeutet also nie "Font nicht setzen", sondern "die Vorlagen-
  // Standardschrift explizit setzen". Helvetica bleibt Helvetica, Arial
  // bleibt Arial, Times New Roman bleibt Times New Roman.
  //
  // FIX 5 (Root Cause: italic-leak): Bisher wurden `bold` und `italics` nur
  // gesetzt, wenn el.bold/el.italic definiert war — bei undefined fiel der
  // Wert auf `defaults.bold`/`defaults.italics`, und wenn auch der undefined
  // war, wurde die Eigenschaft im Ergebnis-Objekt weggelassen. Word übernimmt
  // dann den Default des übergeordneten Absatz- oder Dokument-Styles, was zu
  // einem Style-Leak zwischen Elementen führte (z.B. Schlusstext wurde
  // ungefragt kursiv, weil ein vorheriger Block italics:true gesetzt hatte
  // und der Absatz-Style vererbt wurde). Fix: bold/italics werden JETZT
  // explizit als boolean gesetzt — auch false. `bold: el.bold ?? defaults.bold
  // ?? false` und `italics: el.italic ?? defaults.italics ?? false`. So gibt
  // es kein "weglassen" mehr, das Word als "vererben" interpretieren könnte.
  // Das gilt für JEDEN TextRun, inklusive Schlusstext mit italic=false.
  //
  // FIX 6 (Root Cause: Word-Default-Fonts in Tabellen): Bisher wurde
  // fontFamily="standard" in Tabellen-Runs (Leistungsübersicht, Auslagen,
  // Summenblock) nicht explizit aufgelöst, sodass Word seinen eigenen Default
  // (Calibri) anwand. Jetzt wird `standardFont` (aus resolveStandardFont)
  // deterministisch ermittelt und als `font` gesetzt — für alle Runs in
  // Leistungsübersicht, Auslagen und Summenblock. Kein Word-Default-Font mehr.
  const applyTypography = (
    el: V2Element,
    defaults: { size?: number; bold?: boolean; italics?: boolean },
    standardFont?: string,
  ): { font: string; size?: number; bold: boolean; italics: boolean } => {
    const fam = el.fontFamily?.trim().toLowerCase();
    const font =
      fam === "standard" || fam === undefined || fam === ""
        ? (standardFont ?? "Arial")
        : mapFontFamily(el.fontFamily);
    // FIX 5: bold/italics IMMER explizit als boolean (auch false), niemals
    // undefined/omitted — verhindert Style-Leak zwischen Elementen.
    const bold = el.bold ?? defaults.bold ?? false;
    const italics = el.italic ?? defaults.italics ?? false;
    return {
      font,
      size: fontSizeToHalfPoints(el.fontSize) ?? defaults.size,
      bold,
      italics,
    };
  };

  // Statisches Element als DrawingML-Floating-Shape mit absoluter X/Y-Position
  // (WYSIWYG). relative:page = Ursprung oben-links, passend zum Editor-
  // Koordinatenmodell.
  function buildFloatingShape(
    el: V2Element,
    children: DocxParagraph[],
  ): DocxParagraph {
    const emu = editorMmToWordEmu(
      el.xMm ?? 0,
      el.yMm ?? 0,
      el.widthMm ?? 0,
      el.heightMm ?? 0,
    );
    // DEFECT 2(a) — altText mit nicht-leerem name, damit wp:docPr einen
    // echten Namen erhält (docx 9.7.1 ignoriert altText für wps:cNvPr, aber
    // wp:docPr profitiert davon). patchDocxXml ist die echte Garantie für
    // wps:cNvPr (siehe Defect 2c). name aus el.id (fallback "Textfeld").
    const shapeName = el.id ?? "Textfeld";
    return new Paragraph({
      children: [
        new WpsShapeRun({
          type: "wps",
          // PFLICHTFELD laut docx 9.7.1 INonVisualShapePropertiesOptions:
          // txBox ist ein zwingendes String-Feld (kein ?). Ohne es entsteht
          // unvollständige <wps:txbx>-Struktur → Word Desktop lehnt Datei ab.
          // Wert: txBox ist ein OOXML-Boolean (ST_OnOff) — "1" (wahr), NICHT
          // der freie String "textbox". docx 9.7.1 serialisiert den Wert direkt
          // als Attribut, also entsteht <wps:cNvSpPr txBox="1"/>.
          nonVisualProperties: { txBox: "1" },
          altText: { name: shapeName, description: "" },
          children,
          // Innenränder des Textfelds auf 0.00 cm (0 EMU) setzen, damit der
          // Text WYSIWYG sitzt (sonst zieht Word 0.25cm L/R und 0.13cm T/B
          // Standard-Innenrand ab). docx 9.7.1 serialisiert
          // bodyProperties.margins als lIns/rIns/tIns/bIns (EMU).
          bodyProperties: { margins: { top: 0, bottom: 0, left: 0, right: 0 } },
          // DEFECT 4 — transformation.width/height in PIXELN (96 DPI), NICHT EMU.
          // docx 9.7.1 multipliziert transformation-Werte intern mit 9525
          // (EMU/px). emu.widthPx/heightPx sind bereits mm→px umgerechnet
          // (inkl. Guard), sodass docx daraus die korrekte EMU-Grösse erzeugt:
          // 80mm → 302.36px → 2'880'000 EMU (cx). floating.offset bleibt EMU.
          transformation: { width: emu.widthPx, height: emu.heightPx },
          floating: {
            horizontalPosition: {
              relative: HorizontalPositionRelativeFrom.PAGE,
              offset: emu.xEmu,
            },
            verticalPosition: {
              relative: VerticalPositionRelativeFrom.PAGE,
              offset: emu.yEmu,
            },
            behindDocument: false,
            allowOverlap: true,
          },
        }),
      ],
    }) as unknown as DocxParagraph;
  }

  // Tabelle als DrawingML-Floating-Shape mit absoluter X/Y-Position (WYSIWYG),
  // identisch zum Muster von buildFloatingShape für statische Textelemente.
  // relative:page = Ursprung oben-links, passend zum Editor-Koordinatenmodell.
  // Die Tabelle wird in einen WpsShapeRun gewrappt; da docx 9.7.1 den
  // children-Typ des WpsShapeRun nur für Paragraphen deklariert, wird das
  // Ergebnis wie bei buildFloatingShape gecastet (as unknown as DocxTable).
  // FIX 2 — yOffsetMm (optional): verschiebt die Floating-Tabelle vertikal um
  // diesen Betrag (in mm) nach unten. Wird genutzt, um die Auslagen-Tabelle
  // um den growthShift der Leistungen-Tabelle nach unten zu verschieben,
  // damit der Abstand zwischen den beiden TABELLEN der Vorlage entspricht.
  // Floating-Shapes sind absolut positioniert (relative:page), daher wird der
  // Offset direkt auf die yMm addiert, bevor editorMmToWordEmu sie in EMU
  // umrechnet. Standard 0 = unverändertes Verhalten (Summenblock, Leistungen).
  function buildFloatingTable(
    el: V2Element,
    table: DocxTable,
    yOffsetMm = 0,
  ): DocxTable {
    const emu = editorMmToWordEmu(
      el.xMm ?? 0,
      (el.yMm ?? 0) + yOffsetMm,
      el.widthMm ?? 0,
      el.heightMm ?? 0,
    );
    const shapeName = el.id ?? "Tabelle";
    return new Paragraph({
      children: [
        new WpsShapeRun({
          type: "wps",
          nonVisualProperties: { txBox: "1" },
          altText: { name: shapeName, description: "" },
          children: [table as unknown as DocxParagraph],
          // Innenränder des Textfelds auf 0.00 cm (0 EMU) — siehe
          // buildFloatingShape für Begründung. Wichtig für Tabellen-Wrapper,
          // damit die Tabelle WYSIWYG im Textfeld sitzt ohne Standard-Abstand.
          bodyProperties: { margins: { top: 0, bottom: 0, left: 0, right: 0 } },
          transformation: { width: emu.widthPx, height: emu.heightPx },
          floating: {
            horizontalPosition: {
              relative: HorizontalPositionRelativeFrom.PAGE,
              offset: emu.xEmu,
            },
            verticalPosition: {
              relative: VerticalPositionRelativeFrom.PAGE,
              offset: emu.yEmu,
            },
            behindDocument: false,
            allowOverlap: true,
          },
        }),
      ],
    }) as unknown as DocxTable;
  }

  // FIX 1 — Fettgedruckte Überschrift als DrawingML-Floating-Shape, positioniert
  // ÜBER der zugehörigen Tabelle (WYSIWYG). Nutzt dasselbe WpsShapeRun-Muster
  // wie buildFloatingShape/buildFloatingTable (nonVisualProperties txBox:"1",
  // transformation via editorMmToWordEmu, floating relative:page). Die
  // Überschrift sitzt bei el.xMm/el.widthMm und einer yMm knapp über der
  // Tabellen-yMm (headingHeightMm = 8mm), sodass sie nicht mehr am Anfang des
  // Dokumentflusses klebt, sondern exakt über ihrer Tabelle erscheint.
  function buildFloatingHeading(
    el: V2Element,
    text: string,
    standardFont: string,
  ): DocxParagraph {
    const headingHeightMm = 8;
    const tableY = el.yMm ?? 0;
    const headingY = Math.max(0, tableY - headingHeightMm);
    const emu = editorMmToWordEmu(
      el.xMm ?? 0,
      headingY,
      el.widthMm ?? 0,
      headingHeightMm,
    );
    const shapeName = `${el.id ?? "Textfeld"}-heading`;
    return new Paragraph({
      children: [
        new WpsShapeRun({
          type: "wps",
          nonVisualProperties: { txBox: "1" },
          altText: { name: shapeName, description: "" },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  ...applyTypography(el, { bold: true }, standardFont),
                }),
              ],
              spacing: { before: 0, after: 0 },
            }),
          ],
          // Innenränder des Textfelds auf 0.00 cm (0 EMU) — siehe
          // buildFloatingShape für Begründung. Verhindert Standard-Innenrand
          // unter der Überschrift.
          bodyProperties: { margins: { top: 0, bottom: 0, left: 0, right: 0 } },
          transformation: { width: emu.widthPx, height: emu.heightPx },
          floating: {
            horizontalPosition: {
              relative: HorizontalPositionRelativeFrom.PAGE,
              offset: emu.xEmu,
            },
            verticalPosition: {
              relative: VerticalPositionRelativeFrom.PAGE,
              offset: emu.yEmu,
            },
            behindDocument: false,
            allowOverlap: true,
          },
        }),
      ],
    }) as unknown as DocxParagraph;
  }

  // Rendert den Inhalt für ein einzelnes V2-LayoutElement. Gibt ein Array
  // von docx-Blöcken zurück (Paragraph | Table). alignment steuert die
  // Absatzausrichtung für Text-Blöcke; für Tabellen wird die Ausrichtung
  // innerhalb der Zellen angewendet.
  // FIX 2 — yOffsetMm (optional): vertikaler Versatz (in mm), der an die
  // Floating-Tabelle des Elements weitergegeben wird (siehe buildFloatingTable).
  // Wird im Band-Assembly-Loop gesetzt, um die Auslagen-Tabelle um den
  // growthShift des Leistungen-Bands nach unten zu verschieben. Statische
  // Textelemente und der Summenblock ignorieren den Offset (Standard 0).
  const renderElementContent = (
    el: V2Element,
    yOffsetMm = 0,
  ): (DocxParagraph | DocxTable)[] => {
    const align = positionToAlignment(el.alignment);
    // Statische Einzelelement-Textbänder (absenderadresse, empfaengeradresse,
    // rechnungsmetadaten) werden über einen 1-zelligen randlosen FIXED-Tabellen-
    // Wrapper positioniert, dessen indent=elementLeftTwips die EINZIGE Quelle
    // für die X-Position ist (WYSIWYG: Word-X = marginLeftMm + xMm). Würde hier
    // zusätzlich der el.alignment-Override (positionToAlignment) auf die inneren
    // Paragraphen angewendet, würde der Text innerhalb der korrekt positionierten
    // Zelle rechts-/mitte-bündig ausgerichtet und die visuelle X-Position
    // verschoben — el.alignment='rechts' sähe dann aus wie eine falsche Position,
    // obwohl die Tabellen-Geometrie stimmt. Daher wird für diese drei statischen
    // Elemente der innere Paragraphen-Alignment konsequent auf LEFT gesetzt,
    // sodass die Tabellen-Geometrie die X-Position dominiert. Leistungs-/
    // Auslagentabellen und Summenblock nutzen weiterhin `align` (Betragsspalten-
    // Rechtsbündigkeit bleibt erhalten).
    const staticAlign = AlignmentType.LEFT;
    // Cast auf FrontendLayoutElementId, damit der frontend-only case
    // "schlusstext" (nicht Teil der Backend-LayoutElementId-Enum) vom Switch
    // akzeptiert wird (TS2678). el.id ist zur Laufzeit ein String, der auch
    // "schlusstext" sein kann — der Cast ist zur Build-Zeit nötig, ändert aber
    // kein Laufzeitverhalten.
    switch (el.id as FrontendLayoutElementId) {
      case "absenderadresse": {
        // P1-Fix WYSIWYG: Absenderadresse ausschliesslich aus KanzleiStammdaten
        // (Einstellungen > Kanzleidaten) via getAbsenderadresse(stammdaten).
        // KEIN Fallback auf kanzleiName (currentUser) oder kanzleiAdresse, KEIN
        // hartcodiertes Literal 'Rechtsanwaltskanzlei'. Die Typografie
        // (fontFamily, fontSize, bold, italic, alignment) kommt aus dem
        // V2Element via applyTypography — NICHT hartcodiert size 32. Die erste
        // Zeile (Kanzleiname) wird bold, wenn das Element bold=true hat; sonst
        // normal (applyTypography wendet el.bold ?? defaults.bold ?? false an).
        // Leerzeilen ('' im Array) werden als leere Paragraphen mit passender
        // Zeilenhöhe gerendert (spacing.line: 240), identisch zum Editor
        // (LayoutCanvas).
        //
        // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-Floating-
        // Shape mit absoluter X/Y-Position (relative:page), xMm/yMm/widthMm/
        // heightMm aus dem V2Element via editorMmToWordEmu. KEIN Tabellen-
        // Wrapper mehr — die absolute Positionierung ersetzt indent/width.
        const zeilen = getAbsenderadresse(params.stammdaten);
        if (zeilen.length === 0) {
          // stammdaten null/undefined oder alle Felder leer → Platzhalter-
          // Paragraph in normaler Typografie (KEIN bold, KEIN hartcodierter
          // size 32). applyTypography mit defaults {} liefert Standard-Font,
          // size undefined (Word-Default des Elements), bold=false, italic=false.
          return [
            buildFloatingShape(el, [
              new Paragraph({
                alignment: staticAlign,
                children: [
                  new TextRun({
                    text: "Kanzleidaten in Einstellungen > Kanzleidaten erfassen",
                    ...applyTypography(el, {}, standardFont),
                  }),
                ],
                spacing: { after: 0, line: 240 },
              }),
            ]),
          ];
        }
        // Jede Zeile als eigene Paragraph. Leerzeile ('') → leerer Paragraph
        // mit passender Zeilenhöhe (line: 240 = einfacher Zeilenabstand).
        // Die erste Zeile (Kanzleiname) erhält defaults { bold: true }, sodass
        // applyTypography bold=true liefert, WENN el.bold undefined ist; wenn
        // el.bold explizit false ist, wird die erste Zeile normal gerendert
        // (User-Entscheidung im Editor hat Vorrang). Alle weiteren Zeilen
        // erhalten defaults {} (normal).
        return [
          buildFloatingShape(
            el,
            zeilen.map((zeile, i) => {
              const isFirst = i === 0;
              return new Paragraph({
                alignment: staticAlign,
                children: [
                  new TextRun({
                    text: zeile,
                    ...applyTypography(
                      el,
                      isFirst ? { bold: true } : {},
                      standardFont,
                    ),
                  }),
                ],
                spacing: { after: 0, line: 240 },
              });
            }),
          ),
        ];
      }
      case "empfaengeradresse": {
        // P1-Fix WYSIWYG: Empfängeradresse aus klient (name bold, strasse,
        // plzOrt) via applyTypography — identisch zum Editor (LayoutCanvas).
        //
        // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-Floating-
        // Shape mit absoluter X/Y-Position (relative:page), xMm/yMm/widthMm/
        // heightMm aus dem V2Element via editorMmToWordEmu. KEIN Tabellen-
        // Wrapper mehr — die absolute Positionierung ersetzt indent/width.
        // Inhalt (Text, Typografie, alignment, spacing) bleibt UNVERÄNDERT —
        // nur die Geometrie-Hülle wurde auf Floating-Shape umgestellt.
        if (!klient) return [];
        const empfaengerParagraphs: DocxParagraph[] = [
          new Paragraph({
            alignment: staticAlign,
            children: [
              new TextRun({
                text: klient.name,
                ...applyTypography(el, { bold: true }, standardFont),
              }),
            ],
            spacing: { after: 0, line: 240 },
          }),
          new Paragraph({
            alignment: staticAlign,
            children: [
              new TextRun({
                text: klient.strasse,
                ...applyTypography(el, {}, standardFont),
              }),
            ],
            spacing: { after: 0, line: 240 },
          }),
          new Paragraph({
            alignment: staticAlign,
            children: [
              new TextRun({
                text: klient.plzOrt,
                ...applyTypography(el, {}, standardFont),
              }),
            ],
            spacing: { after: 0, line: 240 },
          }),
        ];
        return [buildFloatingShape(el, empfaengerParagraphs)];
      }
      case "logo": {
        if (!logoBytes || logoBytes.length === 0) return [];
        try {
          // EDIT 3.8 — WYSIWYG-Floating-Shape für das Logo: ImageRun mit
          // eigener floating?-Option (KEIN WpsShapeRun-Wrapper, da ImageRun
          // bereits native floating-Unterstützung bietet). Geometrie aus
          // dem V2Element via editorMmToWordEmu(el.xMm??0, el.yMm??0,
          // el.widthMm??0, el.heightMm??0):
          //   - transformation.width/height aus emu.widthEmu/emu.heightEmu
          //     (NICHT hardcoded 180/60 — WYSIWYG aus el.widthMm/el.heightMm)
          //   - floating.horizontalPosition.offset = emu.xEmu
          //   - floating.verticalPosition.offset   = emu.yEmu
          // relative:PAGE liefert seiten-absolute Koordinaten (Ursprung
          // oben-links), passend zum Editor-Koordinatenmodell.
          // behindDocument:false (Logo im Vordergrund), allowOverlap:true
          // (konsistent mit den Text-Floating-Shapes).
          const emu = editorMmToWordEmu(
            el.xMm ?? 0,
            el.yMm ?? 0,
            el.widthMm ?? 0,
            el.heightMm ?? 0,
          );
          return [
            new Paragraph({
              alignment: align,
              children: [
                new ImageRun({
                  data: logoBytes,
                  type: "png",
                  // DEFECT 2(b) — altText mit nicht-leerem name, damit
                  // pic:cNvPr und wp:docPr einen echten Namen erhalten.
                  altText: { name: "Logo", description: "" },
                  // DEFECT 4 — transformation.width/height in PIXELN (96 DPI),
                  // NICHT EMU. ImageRun nutzt dieselbe transformation-Semantik
                  // wie WpsShapeRun: docx 9.7.1 multipliziert mit 9525 EMU/px.
                  // emu.widthPx/heightPx → korrekte EMU-Grösse via docx-Scaling.
                  transformation: {
                    width: emu.widthPx,
                    height: emu.heightPx,
                  },
                  floating: {
                    horizontalPosition: {
                      relative: HorizontalPositionRelativeFrom.PAGE,
                      offset: emu.xEmu,
                    },
                    verticalPosition: {
                      relative: VerticalPositionRelativeFrom.PAGE,
                      offset: emu.yEmu,
                    },
                    behindDocument: false,
                    allowOverlap: true,
                  },
                }),
              ],
              spacing: { after: 0 },
            }),
          ];
        } catch {
          return [];
        }
      }
      case "rechnungsmetadaten": {
        // P1-Fix WYSIWYG: Rechnungsmetadaten über denselben Resolver
        // (getRechnungsmetadaten) wie der Editor (LayoutCanvas). Liefert
        // {label, value}-Paare in fester Reihenfolge (Rechnungsnummer,
        // Rechnungsdatum, Fälligkeitsdatum, Leistungszeitraum). Leere Werte
        // werden als {label, value: ''} geliefert (Label bleibt, Wert leer),
        // sodass die Zeilenfolge in Editor und Word IDENTISCH ist.
        //
        // Der Titel (rechnungstitel aus vorlage.standardtexte.rechnungstitel)
        // bleibt ein SEPARATER Textblock oberhalb der Metadaten — er wird
        // HIER NICHT über getRechnungsmetadaten geliefert (siehe
        // staticResolvers.ts Kommentar). Der Titel-Paragraph behält die
        // bestehende Typografie (size 28, bold) als Überschrift.
        //
        // Typografie via applyTypography aus dem V2Element.
        //
        // Geometrie über denselben 1-zelligen randlosen fixen Tabellen-Wrapper
        // wie absenderadresse/empfaengeradresse: indent aus
        // elementLeftTwips(el, layoutV2), width aus elementWidthTwips(el).
        // KEIN WpsShapeRun / Floating Textbox mehr — dieser Pfad erzeugte
        // malformedes OOXML, das Word Desktop nicht öffnet (Draft v85
        // Regression). KEINE Änderung an resolveFaelligkeitsdatum oder
        // getRechnungsmetadaten. Inhalt (Text, Typografie, alignment,
        // spacing) bleibt UNVERÄNDERT — nur die Geometrie-Hülle wurde
        // repariert.
        // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-Floating-
        // Shape mit absoluter X/Y-Position (relative:page), xMm/yMm/widthMm/
        // heightMm aus dem V2Element via editorMmToWordEmu. KEIN Tabellen-
        // Wrapper mehr — die absolute Positionierung ersetzt indent/width.
        // Inhalt (Text, Typografie, alignment, spacing) bleibt UNVERÄNDERT —
        // nur die Geometrie-Hülle wurde auf Floating-Shape umgestellt.
        const titel =
          resolve(vorlage?.standardtexte.rechnungstitel ?? "") || "Rechnung";
        const metadaten = getRechnungsmetadaten({
          rechnungsnummer: rechnung.rechnungsnummer,
          rechnungsdatum: formatDate(rechnung.rechnungsdatum),
          faelligkeitsdatum: formatDate(rechnung.faelligkeitsdatum),
          leistungszeitraum,
        });
        const blocks: DocxParagraph[] = [
          // Titel-Paragraph (Überschrift) — separate Typografie (size 28,
          // bold), nicht Teil der Metadaten-Paare.
          new Paragraph({
            alignment: staticAlign,
            children: [
              new TextRun({
                text: `${titel}`,
                ...applyTypography(el, { size: 28, bold: true }, standardFont),
              }),
            ],
            spacing: { after: 0, line: 240 },
          }),
        ];
        // Jedes {label, value}-Paar als eigene Zeile: "${label}: ${value}"
        // (wenn value nicht leer) oder nur "${label}:" (wenn value leer).
        // Label bold, Wert normal — konsistent mit der bisherigen Darstellung.
        for (const { label, value } of metadaten) {
          const lineText =
            value.length > 0 ? `${label}: ${value}` : `${label}:`;
          blocks.push(
            new Paragraph({
              alignment: staticAlign,
              children: [
                new TextRun({
                  text: lineText,
                  ...applyTypography(el, {}, standardFont),
                }),
              ],
              spacing: { after: 0, line: 240 },
            }),
          );
        }
        if (blocks.length === 0) return [];
        return [buildFloatingShape(el, blocks)];
      }
      case "mandatsinfo": {
        // P1-Fix: Mandatsblock zeigt NUR Mandat + (bei 1 LE) Leistungserbringer.
        // MWST-Satz erscheint ausschliesslich im Summen-/MWST-Block, nie hier.
        //
        // LE-Logik aus fakturierten Positionen (siehe Berechnung weiter oben):
        //   - 1 eindeutiger LE  → "Leistungserbringer: <singleLeName>"
        //                          (singleLeName aus uniqueLeNames, bereits
        //                          über Lookup aufgelöst; "—" bei fehlendem LE).
        //   - mehrere eindeutige LE → NUR "Mandat: …", keine einzelne LE-Zeile
        //                          oben (die LEs erscheinen stattdessen pro
        //                          Zeile in den Tabellen).
        //   - 0 fakturierte Positionen (leCount === 0) → Legacy-Fallback auf
        //                          params.leistungserbringerName (kann "" sein).
        //
        // FIX 9 (Root Cause: Leistungserbringer-Zeile still verschwindet):
        // Bei 1 LE wird die "Leistungserbringer:"-Zeile IMMER gerendert, wenn
        // der mandatsinfo-Block sichtbar ist — mit singleLeName als Wert
        // (bereits "—" bei fehlendem LE), niemals still unterschlagen.
        // MWST-Satz bleibt aussen vor (nur im Summenblock).
        const blocks: DocxParagraph[] = [
          new Paragraph({
            alignment: align,
            children: [
              new TextRun({
                text: "Mandat: ",
                ...applyTypography(el, { bold: true }, standardFont),
              }),
              new TextRun({
                text: mandat?.bezeichnung ?? "",
                ...applyTypography(el, {}, standardFont),
              }),
            ],
          }),
        ];
        if (hasMultipleLe) {
          // Mehrere eindeutige LE → keine einzelne LE-Zeile oben; die LEs
          // erscheinen pro Zeile in Leistungsübersicht und Auslagen.
          // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-
          // Floating-Shape mit absoluter X/Y-Position (relative:page).
          return [buildFloatingShape(el, blocks)];
        }
        // 1 eindeutiger LE (oder 0 Positionen → Legacy-Fallback): LE-Zeile
        // rendern. Bei 1 LE ist singleLeName gesetzt; bei 0 Positionen
        // (leCount === 0) fällt singleLeName auf undefined → Legacy-Fallback
        // params.leistungserbringerName ?? "".
        const leValue =
          singleLeName !== undefined
            ? singleLeName
            : (params.leistungserbringerName ?? "");
        blocks.push(
          new Paragraph({
            alignment: align,
            children: [
              new TextRun({
                text: "Leistungserbringer: ",
                ...applyTypography(el, { bold: true }, standardFont),
              }),
              new TextRun({
                text: leValue,
                ...applyTypography(el, {}, standardFont),
              }),
            ],
          }),
        );
        // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-
        // Floating-Shape mit absoluter X/Y-Position (relative:page).
        return [buildFloatingShape(el, blocks)];
      }
      case "einleitung": {
        const einleitung = resolve(vorlage?.standardtexte.einleitung ?? "");
        if (!einleitung) return [];
        const lines = splitLines(einleitung);
        // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-Floating-
        // Shape mit absoluter X/Y-Position (relative:page), xMm/yMm/widthMm/
        // heightMm aus dem V2Element via editorMmToWordEmu.
        return [
          buildFloatingShape(el, [
            new Paragraph({
              alignment: align,
              children: lines.flatMap((line, i) => {
                const run = new TextRun({
                  text: line,
                  ...applyTypography(el, { size: 22 }, standardFont),
                });
                return i < lines.length - 1
                  ? [run, new TextRun({ text: "", break: 1 })]
                  : [run];
              }),
              spacing: { after: 0, line: 240 },
            }),
          ]),
        ];
      }
      case "leistungspositionen": {
        return buildLeistungspositionenTable(spesenSeparate, currency);
      }
      case "spesenAuslagen": {
        // Separate Auslagen-Tabelle. Vorhandene Auslagen-Daten werden niemals
        // still verworfen (P1-Fix). Summen werden NICHT neu berechnet — diese
        // werden aus rechnung.subtotal/mwstBetrag/total im summenblock-Element
        // angezeigt.
        //
        // P1-Fix (Rewrite): FIXED layout + DXA-Twips columnWidths, damit Word
        // die Spaltenbreiten exakt einhält. Die Betragsspalte endet rechts an
        // der gemeinsamen Betrag-Kante (sharedBetragRightMm). Vertikale
        // (links/rechts) Zellränder = NIL — kein Vollgitter, keine vertikalen
        // Linien. Horizontale Linien pro Vorlage: Kopfzeile unten = dick
        // (Trennlinie Kopf/Daten), Datenzeilen = keine Linien zwischen den
        // Zeilen, letzte Datenzeile unten = dünn (Abschluss). Jeder TextRun
        // bekommt explizit fontFamily/fontSize/bold/italic aus dem
        // spesenAuslagen-Element via applyTypography(el, {...}, standardFont).
        // Beträge via formatAmount (kein Währungssymbol pro Zeile),
        // rechtsbündig. indent = elementLeftTwips(el, layoutV2), sodass die
        // Tabelle am xMm des Elements beginnt.
        const regelung = mandat?.auslagenregelung ?? "Keine";
        if (regelung === "Keine" && auslagen.length === 0) return [];

        const elX = typeof el.xMm === "number" ? el.xMm : 20;
        const elW =
          typeof el.widthMm === "number" && el.widthMm > 0 ? el.widthMm : 170;
        const rightEdgeMm = Math.min(elX + elW, sharedBetragRightMm);
        const tableW = rightEdgeMm - elX;
        // Spaltenbreiten in mm. Bei mehreren LE kommt eine LE-Spalte (30mm)
        // zwischen Beschreibung/Art und Betrag; Beschreibung erhält den Rest,
        // sodass die Betragsspalte rechts bei rightEdgeMm endet (gemeinsame
        // Betrag-Achse mit Leistungsübersicht und Summenblock). Die LE-Spalte
        // nimmt ihren Platz aus dem Beschreibungs-Rest — sharedBetragRightMm
        // bleibt die rechte Kante, elementLeftTwips/elementWidthTwips bleiben
        // die SINGLE source für Element-Geometrie (Fix 1/2 nicht regressieren).
        const colDatum = 22;
        const colBetrag = 28;
        const colLe = 30; // LE-Spalte bei mehreren LE
        const colBeschr = hasMultipleLe
          ? Math.max(20, tableW - colDatum - colLe - colBetrag)
          : Math.max(20, tableW - colDatum - colBetrag);
        const colWidthsMm = hasMultipleLe
          ? [colDatum, colBeschr, colLe, colBetrag]
          : [colDatum, colBeschr, colBetrag];
        const colWidthsTw = columnWidthsFromMm(colWidthsMm);
        const margins = cellMarginsTwips();

        const nilBorder = { style: BorderStyle.NIL, size: 0, color: "FFFFFF" };
        const thinBorder = {
          style: BorderStyle.SINGLE,
          size: 4,
          color: "000000",
        };
        const thickBorder = {
          style: BorderStyle.SINGLE,
          size: 8,
          color: "000000",
        };
        // FIX 8 (Root Cause: spesenAuslagen-Rahmen-Konfiguration dokumentieren):
        // Diese Border-Konfiguration ist korrekt und wird hier dokumentiert.
        // Vertikale Linien (links/rechts der Zellen) sind via NIL entfernt —
        // kein Vollgitter, keine vertikalen Trennlinien zwischen den Spalten.
        // Der Word-Tabellen-Gitter-Rahmen (insideVertical) wird nicht gesetzt
        // (FIXED-Layout ohne insideVertical-Border). Ein Aussenrahmen
        // (top/bottom der Tabelle als geschlossener Rahmen) ist NICHT
        // vorhanden — nur horizontale Linien bleiben: Kopfzeile unten = dick
        // (Trennlinie Kopf/Daten), Datenzeilen = keine Linien zwischen den
        // Zeilen, letzte Datenzeile unten = dünn (Abschlusslinie). Das
        // entspricht exakt der Vorlage: nur horizontale Linien, keine
        // vertikalen, kein Gitter, kein Aussenrahmen.
        const headerCellBorders = {
          top: nilBorder,
          bottom: thickBorder,
          left: nilBorder,
          right: nilBorder,
        };
        const bodyCellBorders = {
          top: nilBorder,
          bottom: nilBorder,
          left: nilBorder,
          right: nilBorder,
        };
        const lastBodyCellBorders = {
          top: nilBorder,
          bottom: thinBorder,
          left: nilBorder,
          right: nilBorder,
        };

        const headerCells = hasMultipleLe
          ? [
              "Datum",
              "Beschreibung/Art",
              "Leistungserbringer",
              `Betrag (${currency})`,
            ]
          : ["Datum", "Beschreibung/Art", `Betrag (${currency})`];

        const betragIdx = hasMultipleLe ? 3 : 2;

        // Body-Zeilen aufbauen — Pauschal oder Effektiv/Keine-mit-Auslagen.
        let bodyRows: string[][];
        if (regelung === "Pauschal") {
          bodyRows = hasMultipleLe
            ? [
                [
                  formatDate(rechnung.rechnungsdatum),
                  "Pauschal-Spesen",
                  "—",
                  formatAmount(mandat?.pauschalBetrag ?? 0n),
                ],
              ]
            : [
                [
                  formatDate(rechnung.rechnungsdatum),
                  "Pauschal-Spesen",
                  formatAmount(mandat?.pauschalBetrag ?? 0n),
                ],
              ];
        } else {
          if (auslagen.length === 0) return [];
          bodyRows = hasMultipleLe
            ? auslagen.map((a) => [
                formatDate(a.datum),
                a.beschreibung,
                resolveLeName(a.leistungserbringerId),
                formatAmount(a.betrag),
              ])
            : auslagen.map((a) => [
                formatDate(a.datum),
                a.beschreibung,
                formatAmount(a.betrag),
              ]);
        }

        const rows: DocxTableRow[] = [
          new TableRow({
            tableHeader: true,
            children: headerCells.map(
              (h, i) =>
                new TableCell({
                  borders: headerCellBorders,
                  margins,
                  width: { size: colWidthsTw[i], type: WidthType.DXA },
                  children: [
                    new Paragraph({
                      alignment:
                        i === betragIdx ? AlignmentType.RIGHT : undefined,
                      children: [
                        new TextRun({
                          text: h,
                          ...applyTypography(el, { bold: true }, standardFont),
                        }),
                      ],
                    }),
                  ],
                }),
            ),
          }),
          ...bodyRows.map(
            (cells, rowIdx) =>
              new TableRow({
                children: cells.map((cell, i) => {
                  const isLast = rowIdx === bodyRows.length - 1;
                  return new TableCell({
                    borders: isLast ? lastBodyCellBorders : bodyCellBorders,
                    margins,
                    width: { size: colWidthsTw[i], type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        alignment:
                          i === betragIdx ? AlignmentType.RIGHT : undefined,
                        children: [
                          new TextRun({
                            text: cell,
                            ...applyTypography(el, {}, standardFont),
                          }),
                        ],
                      }),
                    ],
                  });
                }),
              }),
          ),
        ];

        return [
          buildFloatingHeading(el, "Auslagen", standardFont),
          buildFloatingTable(
            el,
            new Table({
              layout: TableLayoutType.FIXED,
              width: { size: mmToTwips(tableW), type: WidthType.DXA },
              columnWidths: colWidthsTw,
              rows,
            }),
            // FIX 2 — Auslagen-Tabelle um den growthShift des Leistungen-Bands
            // nach unten verschieben (yOffsetMm), damit der Abstand zwischen
            // den beiden TABELLEN der Vorlage entspricht. Der Offset wird im
            // Band-Assembly-Loop als prevBandGrowthShift übergeben.
            yOffsetMm,
          ),
        ];
      }
      case "summenblock": {
        return [buildSummenblockTable(el.alignment, el.widthMm, currency)];
      }
      case "zahlungsinformationen": {
        // FIX 4 (Root Cause: zahlungshinweis + schlusstext in gemeinsamer
        // Zelle/Container mit Style-Vererbung): Bisher renderte dieser case
        // BOTH zahlungshinweis UND schlusstext in EINEM gemeinsamen Block-Array
        // — beide im gleichen `el` (zahlungsinformationen-Element), mit
        // gemeinsamer alignment/spacing/typography-Quelle und gemeinsamer
        // spacing.before-Logik. Schlusstext erbte dadurch die
        // zahlungsinformationen-Geometrie (xMm/widthMm/heightMm) und
        // Typografie (fontFamily/fontSize/bold/italic), und der
        // "Zahlungsbedingungen:"-Header wurde mit dem Schlusstext in einem
        // gemeinsamen Absatz-Container verbunden. Fix: dieser case rendert
        // JETZT NUR NOCH den Zahlungshinweis (zahlungshinweis) — eigene
        // Geometrie/Typografie aus dem zahlungsinformationen-Element. Der
        // Schlusstext wird als SEPARATER eigenständiger Block gerendert
        // (siehe schlusstext-Case weiter unten): eigene xMm/widthMm/heightMm/
        // visibility/fontFamily/fontSize/bold/italic/alignment aus einem
        // separaten schlusstext-V2-Element, KEINE gemeinsame Zelle, KEIN
        // gemeinsamer Absatz-Container, KEINE Style-Vererbung mit
        // Zahlungsinformationen. Fallback: wenn das V2-Layout KEIN separates
        // schlusstext-Element enthält (alte Vorlagen), rendert der
        // schlusstext-Case den Legacy-Text aus
        // vorlage.standardtexte.schlusstext als eigenständigen Block mit
        // neutraler Standard-Typografie (kein Crash bei alten Templates).
        const zahlungshinweis = resolve(
          vorlage?.standardtexte.zahlungshinweis ?? "",
        );
        const blocks: DocxParagraph[] = [];
        if (zahlungshinweis) {
          const zhLines = splitLines(zahlungshinweis);
          blocks.push(
            new Paragraph({
              alignment: align,
              children: [
                new TextRun({
                  text: "Zahlungsbedingungen:",
                  ...applyTypography(el, { bold: true }, standardFont),
                }),
              ],
              spacing: { after: 0, line: 240 },
            }),
            new Paragraph({
              alignment: align,
              children: zhLines.flatMap((line, i) => {
                const run = new TextRun({
                  text: line,
                  ...applyTypography(el, {}, standardFont),
                });
                return i < zhLines.length - 1
                  ? [run, new TextRun({ text: "", break: 1 })]
                  : [run];
              }),
              spacing: { after: 0, line: 240 },
            }),
          );
        }
        // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-Floating-
        // Shape mit absoluter X/Y-Position (relative:page), xMm/yMm/widthMm/
        // heightMm aus dem V2Element via editorMmToWordEmu.
        if (blocks.length === 0) return [];
        return [buildFloatingShape(el, blocks)];
      }
      case "schlusstext": {
        // FIX 4 (Schlusstext als separater eigenständiger Block): Dieser case
        // rendert den Schlusstext komplett eigenständig — eigene
        // xMm/widthMm/heightMm/visibility/fontFamily/fontSize/bold/italic/
        // alignment aus DEM schlusstext-V2-Element (el), KEINE gemeinsame
        // Zelle, KEIN gemeinsamer Absatz-Container, KEINE Style-Vererbung
        // mit dem zahlungsinformationen-Block. Fallback: wenn das V2-Layout
        // KEIN separates schlusstext-Element enthält (alte Vorlagen vor der
        // V2-Trennung), wird der Legacy-Text aus
        // vorlage.standardtexte.schlusstext als eigenständiger Block mit
        // neutraler Standard-Typografie (Standard-Font, size 22, italic=false)
        // gerendert — kein Crash bei alten Templates. Der Text wird über
        // resolve() mit placeholderValues aufgelöst, sodass Token wie
        // {{rechnungsnummer}} auch im Legacy-Schlusstext funktionieren.
        const schlusstextElement = v2Elements.find(
          (e) => (e.id as FrontendLayoutElementId) === SCHLUSSTEXT_ELEMENT_ID,
        );
        const schlusstext = resolve(vorlage?.standardtexte.schlusstext ?? "");
        if (!schlusstext) return [];
        const stLines = splitLines(schlusstext);
        // Typografie-Quelle: das separate schlusstext-V2-Element, falls
        // vorhanden; sonst neutrale Standard-Typografie (Standard-Font,
        // size 22, italic=false) — KEINE Vererbung vom zahlungsinformationen-Block.
        //
        // FIX 5 Absicherung (Legacy-Fallback): Alte Vorlagen ohne separates
        // schlusstext-V2-Element (schlusstextElement === undefined) dürfen den
        // Schlusstext NICHT kursiv rendern. Die Akzeptanzkriterium verlangt
        // italic=false, wenn kein separates Element mit eigener italic-
        // Property existiert. Daher wird für den Legacy-Fallback-Pfad
        // explizit { size: 22, italics: false, bold: false } als Default
        // übergeben — applyTypography greift auf diese Defaults zurück, wenn
        // el.italic/el.bold undefined sind (was bei typoSource={} der Fall ist).
        // Der V2-Pfad (schlusstextElement vorhanden) nutzt weiterhin die
        // gespeicherte italic-Property des Elements; die Defaults hier sind
        // { size: 22, italics: false }, sodass italic nur bei explizit
        // el.italic===true kursiv rendert. Grund: defaultLayoutV2() speichert
        // italic=null, normalizeLayoutV2ForSave konvertiert italic:false zu
        // undefined (bindgen-Workaround), daher fällt applyTypography auf
        // defaults.italics zurück — mit false wird Schlusstext normal
        // gerendert, wenn der User italic nie aktiviert oder explizit
        // deaktiviert hat.
        const isLegacyFallback = schlusstextElement === undefined;
        // EDIT 3.7 — WYSIWYG-Floating-Shape: Geometrie-Quelle ist
        // schlusstextElement, falls vorhanden (separates V2-Element mit
        // eigenen xMm/yMm/widthMm/heightMm). Im Legacy-Fallback (alte
        // Vorlagen ohne separates schlusstext-Element) dient `el` als
        // Geometrie-Quelle — besser als `{} as V2Element` (das bei
        // buildFloatingShape editorMmToWordEmu(0,0,0,0) ergäbe und den
        // Shape bei (0,0) platzieren würde). `el` trägt zumindest die
        // Geometrie des zahlungsinformationen-Elements, sodass der
        // Schlusstext im Legacy-Fallback grob an der erwarteten Position
        // erscheint statt in der oberen linken Ecke.
        const typoSource: V2Element = schlusstextElement ?? ({} as V2Element);
        const geometrySource: V2Element = schlusstextElement ?? el;
        const stAlign = schlusstextElement
          ? positionToAlignment(schlusstextElement.alignment)
          : AlignmentType.LEFT;
        // WYSIWYG-Floating-Shape: statisches Textelement als DrawingML-Floating-
        // Shape mit absoluter X/Y-Position (relative:page), xMm/yMm/widthMm/
        // heightMm aus geometrySource via editorMmToWordEmu.
        const stParagraph = new Paragraph({
          alignment: stAlign,
          children: stLines.flatMap((line, i) => {
            const run = new TextRun({
              text: line,
              ...applyTypography(
                typoSource,
                isLegacyFallback
                  ? { size: 22, italics: false, bold: false }
                  : { size: 22, italics: false },
                standardFont,
              ),
            });
            return i < stLines.length - 1
              ? [run, new TextRun({ text: "", break: 1 })]
              : [run];
          }),
          spacing: { after: 0, line: 240 },
        });
        return [buildFloatingShape(geometrySource, [stParagraph])];
      }
      case "fusszeile": {
        // V2-Pfad: Die Fusszeile wird nicht im Body gerendert — sie wandert
        // in den Section-Footer (siehe v2Footer-Konstruktion weiter unten).
        return [];
      }
      default:
        return [];
    }
  };

  // ── Zone-basierte Dokument-Assemblierung ──────────────────────────────
  // Die Zonen werden aus den gespeicherten V2Element-IDs abgeleitet. Die
  // saved yMm definiert die Startposition; leistung- und auslagen-Tabellen
  // fließen und wachsen; summenblock, schlusstext folgen am tatsächlichen
  // Ende; keine Überlappungen, kein künstlicher Leerraum, keine vorzeitigen
  // Seitenumbrüche. Word bricht die Seite um, sobald der verfügbare A4-
  // Druckbereich ausgeschöpft ist.
  //
  // P1-Fix (Rewrite): Statt harter 120/200/240-Twip-Konstanten wird der
  // vertikale Abstand zwischen zwei Elementen aus verticalGapMm(prev, cur)
  // berechnet = nextElement.yMm - (currentElement.yMm + currentElement.heightMm)
  // und als spacing.before in Twips (mmToTwips) auf das Folgeelement gesetzt.
  // Jedes Element wird an seinem exakten xMm/widthMm gerendert: ein-
  // spaltige FIXED-Tabelle mit columnWidths=[elementWidthTwips(el)] und
  // indent=elementLeftTwips(el, layoutV2), randlos. Mehrere Elemente im
  // gleichen Band (gleiche yMm ± 2mm) werden in einer mehrspaltigen FIXED-
  // Tabelle nebeneinander gesetzt, columnWidths aus widthMm, indent am
  // linken xMm des Bandes.
  //
  // Dynamic growth: leistungspositionen und spesenAuslagen können mehr
  // Zeilen enthalten, als die gespeicherte heightMm Platz bietet. Der
  // Wachstums-Shift wird auf den verticalGap des Folgeelements addiert:
  //   growthShiftMm = (estimatedRows - defaultRows) * estimateRowHeightMm(fontSize)
  //   defaultRows   = Math.max(1, Math.round(el.heightMm / estimateRowHeightMm(fontSize)))
  //   estimatedRows = actualDataRows + 1 (Header)
  // Da docx die gerenderte Höhe zur Build-Zeit nicht exponiert, ist dies eine
  // Schätzung; das Ziel ist kein Overlap und ein erhaltener Folgeabstand.

  const docBlocks: (DocxParagraph | DocxTable)[] = [];

  // Sichtbare Elemente (ohne fusszeile) nach yMm sortieren.
  const TOLERANCE_MM = 2;
  const sortedElements = [...v2Elements]
    .filter((el) => el.id !== "fusszeile")
    .sort(
      (a, b) => (a.yMm ?? 0) - (b.yMm ?? 0) || (a.order ?? 0) - (b.order ?? 0),
    );

  // Bänder: gleiche yMm (±2mm) → nebeneinander; unterschiedliches yMm →
  // untereinander. Jedes Band ist ein Array von V2Elements.
  const bands: (typeof sortedElements)[] = [];
  for (const el of sortedElements) {
    const lastBand = bands[bands.length - 1];
    if (
      lastBand &&
      Math.abs((el.yMm ?? 0) - (lastBand[0].yMm ?? 0)) <= TOLERANCE_MM
    ) {
      lastBand.push(el);
    } else {
      bands.push([el]);
    }
  }

  // Schätzung der Datenzeilen für ein dynamisches Element (leistungs-
  // positionen / spesenAuslagen). Wird für den growthShift verwendet.
  const estimateDataRows = (bandEl: V2Element): number => {
    if (bandEl.id === "leistungspositionen") {
      let rows = leistungen.length;
      if (!spesenSeparate) {
        if (mandat?.auslagenregelung === "Pauschal") rows += 1;
        else if (
          mandat?.auslagenregelung === "Effektiv" ||
          auslagen.length > 0
        ) {
          rows += auslagen.length;
        }
      }
      return rows;
    }
    if (bandEl.id === "spesenAuslagen") {
      const regelung = mandat?.auslagenregelung ?? "Keine";
      if (regelung === "Pauschal") return 1;
      return auslagen.length;
    }
    return 0;
  };

  // growthShift in mm für ein dynamisches Element. 0 für nicht-dynamische.
  const growthShiftMm = (bandEl: V2Element): number => {
    if (bandEl.id !== "leistungspositionen" && bandEl.id !== "spesenAuslagen") {
      return 0;
    }
    const fontSizePt =
      typeof bandEl.fontSize === "number" ? bandEl.fontSize : 11;
    const rowH = estimateRowHeightMm(fontSizePt);
    const heightMm = typeof bandEl.heightMm === "number" ? bandEl.heightMm : 0;
    const defaultRows = Math.max(1, Math.round(heightMm / rowH));
    const dataRows = estimateDataRows(bandEl);
    const estimatedRows = dataRows + 1; // +1 Header
    if (estimatedRows <= defaultRows) return 0;
    return (estimatedRows - defaultRows) * rowH;
  };

  // EDIT 4 — Band-Assembly: Statische Textelemente werden als DrawingML-
  // Floating-Shapes mit absoluter X/Y-Position (relative:page) gerendert
  // (siehe buildFloatingShape / ImageRun-floating). Da Floating-Shapes
  // absolut positioniert sind, benötigen sie KEIN spacing.before und KEINE
  // Spacer-Paragraph-Logik — sie erscheinen exakt an ihrer yMm-Position
  // unabhängig vom Fluss. Nur Tabellen-Elemente (leistungspositionen,
  // spesenAuslagen, summenblock) verbleiben im sequenziellen Fluss und
  // durchlaufen verticalGapMm/spacing.before, da Word-Tabellen nicht
  // absolut positionierbar sind und der vertikale Abstand über
  // spacing.before realisiert werden muss.
  //
  // Identifikation statischer Cases via ID-Liste. `schlusstext` ist ein
  // frontend-only case (nicht Teil der Backend-LayoutElementId-Enum), wird
  // aber über den Cast auf FrontendLayoutElementId im Switch akzeptiert —
  // daher hier als String vergleichen.
  const STATIC_FLOATING_IDS = new Set<string>([
    "absenderadresse",
    "empfaengeradresse",
    "logo",
    "rechnungsmetadaten",
    "mandatsinfo",
    "einleitung",
    "zahlungsinformationen",
    "schlusstext",
  ]);
  const isStaticFloating = (el: V2Element): boolean =>
    STATIC_FLOATING_IDS.has(el.id as string);

  for (let bandIdx = 0; bandIdx < bands.length; bandIdx++) {
    const band = bands[bandIdx];
    const prevBand = bandIdx > 0 ? bands[bandIdx - 1] : null;

    // EDIT 4 — Statische Floating-Shape-Elemente direkt als docBlocks-
    // Children pushen OHNE Spacer-Logik. Floating-Shapes sind absolut
    // positioniert (relative:page), spacing.before ist für sie bedeutungs-
    // los und würde nur den Fluss verfälschen. Tabellen-Elemente
    // (leistungspositionen, spesenAuslagen, summenblock) verbleiben im
    // Fluss-Modell mit verticalGapMm/spacing.before.
    if (band.every(isStaticFloating)) {
      for (const el of band) {
        const blocks = renderElementContent(el);
        const children = Array.isArray(blocks)
          ? blocks
          : blocks
            ? [blocks]
            : [];
        docBlocks.push(...children);
      }
      continue;
    }

    // verticalGap aus yMm/heightMm des Vorgänger-Bands berechnen (in mm),
    // plus growthShift, falls das Vorgänger-Band ein dynamisches Element
    // enthält. Für das erste Band ist spacing.before = 0.
    let gapMm = 0;
    // FIX 2 — prevBandGrowthShift: der kumulierte growthShift des Vorgänger-
    // Bands (in mm). Wird als yOffsetMm an renderElementContent übergeben,
    // damit die Auslagen-Tabelle (spesenAuslagen) um den growthShift der
    // Leistungen-Tabelle nach unten verschoben wird und exakt bei
    // template-yMm + growthShift landet (Abstand zwischen den beiden
    // TABELLEN = Vorlage). Floating-Shapes sind absolut positioniert
    // (relative:page), daher verschiebt der Offset die Tabelle direkt;
    // der Spacer-Paragraph (gapTwips) wirkt nur auf den Fluss und stösst
    // die absolut positionierte Tabelle NICHT aus ihrer Position.
    let prevBandGrowthShift = 0;
    if (prevBand) {
      const prev = prevBand[0];
      const cur = band[0];
      gapMm = verticalGapMm(prev, cur);
      // growthShift des Vorgänger-Bands addieren (falls dynamisch).
      for (const pe of prevBand) {
        const shift = growthShiftMm(pe);
        gapMm += shift;
        prevBandGrowthShift += shift;
      }
    }
    const gapTwips = mmToTwips(Math.max(0, gapMm));

    // Band-Inhalt rendern (Tabellen-Fluss-Pfad).
    let bandBlocks: (DocxParagraph | DocxTable)[];
    if (band.length === 1) {
      const blocks = renderElementContent(band[0], prevBandGrowthShift);
      bandBlocks = Array.isArray(blocks) ? blocks : blocks ? [blocks] : [];
    } else {
      // P1-Fix WYSIWYG (Root-Cause-Bugfix): Bisher wurden Multi-Element-
      // Bänder (gleiche yMm) als ANGRENZENDE Zellen in EINER TableRow
      // gerendert — das zweite Element startete bei `bandLeftMm +
      // firstCellWidth` statt bei seinem eigenen xMm. Das verletzte das
      // WYSIWYG-Kriterium (Editor-Position ≠ Word-Position).
      //
      // LÖSUNG: Jedes Element eines Multi-Element-Bands wird UNABHÄNGIG über
      // renderElementContent gerendert. Jeder Aufruf erzeugt seine eigene
      // korrekt positionierte Wrapper-Tabelle mit dem korrekten
      // elementLeftTwips(el, layoutV2)-Indent (einmaliger Druckbereich-Offset,
      // seiten-absolut wie im Editor). Die resultierenden Blöcke werden
      // sequenziell konkateniert.
      //
      // BEGRÜNDUNG: Word-Body-Inhalt ist sequenziell (Fluss-Modell). Elemente
      // mit derselben yMm werden vertikal gestapelt — bekannte Einschränkung
      // von Word vs. absoluter Editor-Positionierung. ABER die X-Position
      // jedes Elements bleibt korrekt (jedes trägt seinen eigenen
      // elementLeftTwips-Indent). Der vertikale Abstand zwischen gleichen-
      // Band-Elementen ist 0 (kein Spacer zwischen ihnen — sie teilen sich
      // yMm). Inter-Band-Lücken werden weiterhin korrekt über die
      // Spacer-Paragraph-Logik weiter unten gehandhabt (gapTwips aus
      // verticalGapMm des Vorgänger-Bands).
      //
      // Akzeptanzkriterium E: alle statischen Elemente nutzen denselben
      // zentralen Konverter elementLeftTwips — KEIN divergierender Inline-
      // Pfad (ehemals `mmToTwips(bandLeftMm - ml)`), KEINE bandAnchorEl-/
      // bandLeftMm-/Multi-Cell-Tabellen-Logik mehr.
      bandBlocks = [];
      for (const el of band) {
        const blocks = renderElementContent(el, prevBandGrowthShift);
        const children = Array.isArray(blocks)
          ? blocks
          : blocks
            ? [blocks]
            : [];
        bandBlocks.push(...children);
      }
    }

    // spacing.before als verticalGap auf das erste Block-Element des Bands
    // anwenden. Da docx-Table spacing.before nicht direkt unterstützt und
    // Word spacing.before auf einer leeren Paragraph kollabieren lassen kann,
    // wenn sie unmittelbar vor einer Tabelle oder einer Paragraph mit
    // spacing.before:0 steht (z.B. Leistungsübersicht-Heading), wird hier ein
    // STABILER Spacer-Paragraph eingefügt: spacing.before = gapTwips (aus
    // verticalGapMm, d.h. nextElement.yMm - (currentElement.yMm +
    // currentElement.heightMm), KEINE harte Konstante) plus eine minimale
    // explizite Zeilenhöhe (line: 1 Twip) und minimale Schriftgrösse (1pt =
    // size:2 in Half-Points). Die minimale Zeilenhöhe ist ein
    // Stabilitäts-Mechanismus, damit Word den Spacer nicht auf Höhe 0
    // kollabieren lässt — sie ist KEINE Abstands-Konstante. Der Abstand
    // selbst bleibt ausschliesslich aus gapTwips (yMm/heightMm) abgeleitet.
    // Bei gapTwips === 0 (z.B. einleitung→leistungspositionen mit yMm=119,
    // einleitung yMm=94 heightMm=25 → gap=0mm) wird kein Spacer eingefügt.
    if (bandBlocks.length === 0) continue;
    if (gapTwips > 0) {
      docBlocks.push(
        new Paragraph({
          // STABILER Spacer-Paragraph: ein TextRun mit leerem Text und
          // minimaler Schriftgrösse (1pt = size 2 in Half-Points) gibt der
          // leeren Paragraph eine deterministische minimale Zeilenbox, damit
          // Word sie nicht auf Höhe 0 kollabieren lässt — selbst beim
          // Übergang Textblock → Tabelle oder vor einer Paragraph mit
          // spacing.before:0 (z.B. Leistungsübersicht-Heading). Dies ist ein
          // reiner Stabilitäts-Mechanismus, KEIN Abstand. Der Abstand kommt
          // ausschliesslich aus spacing.before (gapTwips, abgeleitet aus
          // verticalGapMm = nextElement.yMm - (currentElement.yMm +
          // currentElement.heightMm), KEINE harte Konstante). Die minimale
          // Zeilenhöhe (line: 1 Twip) verhindert zusätzlich das Kollabieren.
          // In docx v9.7.1 ist die Paragraph `style`-Option ein STRING
          // (Style-ID), kein Objekt — daher wird die minimale Schriftgrösse
          // über einen TextRun mit size:2 in children gesetzt, nicht über
          // style:{run:{size:2}} (das wäre INVALID und würde typecheck/build
          // fehlschlagen).
          children: [new TextRun({ text: "", size: 2 })],
          spacing: { before: gapTwips, after: 0, line: 1 },
        }),
      );
    }
    docBlocks.push(...bandBlocks);
  }

  // Zone K — Fusszeile als echter Word-Footer (erscheint auf allen Seiten
  // bei mehrseitigen Rechnungen). footerDistance aus saved marginBottomMm
  // wird über buildPageProperties gesetzt.
  //
  // Fusszeilen-Quelle: vorlage.layout.fusszeile (V1-Feld, das auch von V2-
  // Vorlagen weiterhin verwendet wird). Das V2-layoutV2 fusszeile-Element
  // trägt NUR Geometrie/Ausrichtung/Typografie — der eigentliche Footer-Text
  // wird nicht im V2-Element gespeichert, sondern bleibt im V1-layout.fusszeile
  // Feld. Dies ist beabsichtigt: V2 speichert Layout-Geometrie, V1-layout
  // speichert den Footer-Text. Kein Bug — Quelle ist korrekt.
  const fusszeileEl = v2Elements.find(
    (el) => el.id === LayoutElementIdEnum.fusszeile,
  );
  const fusszeileText = resolve(vorlage?.layout.fusszeile ?? "");
  const fzLines = splitLines(fusszeileText);
  const v2Footer =
    fusszeileEl && fusszeileText
      ? new Footer({
          children: [
            new Paragraph({
              alignment: positionToAlignment(fusszeileEl.alignment),
              spacing: { before: 240 },
              children: fzLines.flatMap((line, i) => {
                const run = new TextRun({
                  text: line,
                  ...applyTypography(fusszeileEl, { size: 18 }, standardFont),
                });
                return i < fzLines.length - 1
                  ? [run, new TextRun({ text: "", break: 1 })]
                  : [run];
              }),
            }),
          ],
        })
      : undefined;

  const v2Doc = new Document({
    sections: [
      {
        properties: {
          page: buildPageProperties(true, vorlage),
        },
        footers: v2Footer ? { default: v2Footer } : undefined,
        children: docBlocks,
      },
    ],
  });
  const v2Blob = await Packer.toBlob(v2Doc);
  // OOXML-Post-Processing: fehlendes <wps:cNvPr id name> in jedem
  // <wps:nvSpPr> ergänzen (docx 9.7.1 Bug). WYSIWYG-Geometrie
  // (floating/transformation) bleibt erhalten — nur cNvPr wird
  // hinzugefügt. Logo (ImageRun) und Tabellen sind nicht betroffen.
  const patchedV2Blob = await patchDocxXml(v2Blob);
  triggerDownload(patchedV2Blob, filename);
  // BorderStyle wird im V2-Pfad für randlose Zonen-Tabellen verwendet.
  void BorderStyle;
  return;
}

// ─── XLSX export (exceljs v4) ────────────────────────────────────────────────
//
// Supports two modes:
//   1. Single-sheet: pass `sheetName` + `columns` + `rows` (legacy XlsxExportOptions).
//   2. Multi-sheet: pass `sheets` (XlsxMultiSheetExportOptions) to write several
//      worksheets (e.g. Leistungen + Auslagen) into one .xlsx workbook.

function addRowsToSheet(
  sheet: {
    columns: unknown[];
    getRow: (n: number) => { font: { bold?: boolean } };
    addRow: (row: Record<string, string | number>) => void;
  },
  columns: XlsxColumn[],
  rows: Record<string, string | number | bigint>[],
): void {
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? 20,
  }));
  // Style header row
  sheet.getRow(1).font = { bold: true };
  // Add rows — bigint values are converted to number for Excel compatibility.
  for (const row of rows) {
    const normalized: Record<string, string | number> = {};
    for (const col of columns) {
      const v = row[col.key];
      normalized[col.key] = typeof v === "bigint" ? Number(v) : (v ?? "");
    }
    sheet.addRow(normalized);
  }
}

export async function exportXlsx(
  opts: XlsxExportOptions | XlsxMultiSheetExportOptions,
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const Workbook = ExcelJS.default?.Workbook ?? ExcelJS.Workbook;

  const workbook = new Workbook();

  const isMulti = "sheets" in opts && Array.isArray(opts.sheets);
  if (isMulti) {
    const multi = opts as XlsxMultiSheetExportOptions;
    for (const sheet of multi.sheets) {
      const ws = workbook.addWorksheet(sheet.sheetName);
      addRowsToSheet(ws, sheet.columns, sheet.rows);
    }
  } else {
    const single = opts as XlsxExportOptions;
    const ws = workbook.addWorksheet(single.sheetName);
    addRowsToSheet(ws, single.columns, single.rows);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, opts.filename);
}

// ─── Convenience: format helpers re-export for callers ────────────────────────
// Callers building rows can use these to format CHF / dates / durations before
// passing strings into the export options above.
export { formatCHF, formatDate, formatDuration, roundTo5Rappen };

// ─── Aktive-Benutzer-Export (12-Monate-Tabellen) ──────────────────────────────
//
// Zwei Export-Funktionen für die aktiven Benutzer pro Monat:
//   (a) exportActiveUsersCsv  — CSV-Export eines einzelnen Reports
//                                (AllKanzleienActiveUsersReport oder
//                                ActiveUsersYearReport) mit deutschem
//                                Monatsnamen und Gesamt-Spalte.
//   (b) exportActiveUsersPdf  — PDF-Export via bestehender exportPdf-
//                                Infrastruktur (jspdf + autotable). Akzeptiert
//                                einen einzelnen Report oder ein Array von
//                                Reports. Bei mehreren Reports entsteht ein
//                                mehrseitiges Dokument mit einer Sektion pro
//                                Kanzlei (Kanzlei-Name als Überschrift, 12-
//                                Monate-Tabelle darunter).
//
// Monatsnamen sind fest auf Deutsch verdrahtet (Januar … Dezember), indexiert
// ab 1 (month === 1n → "Januar"). Monate ohne Eintrag im Report werden als
// Null-Zeile gerendert, damit jede Tabelle stets 12 Zeilen hat.

const GERMAN_MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Liefert den deutschen Monatsnamen für eine 1-basierte Monatszahl (1–12).
 * Werte ausserhalb des Bereichs fallen auf den leeren String zurück.
 */
function germanMonthName(month: bigint): string {
  const idx = Number(month) - 1;
  if (idx < 0 || idx >= GERMAN_MONTHS.length) return "";
  return GERMAN_MONTHS[idx];
}

/**
 * Normalisiert einen einzelnen Report in eine einheitliche Form mit
 * Kanzlei-Name, Jahr und months-Array. ActiveUsersYearReport hat keinen
 * kanzleiName, daher wird dort der leere String verwendet — ausser der
 * Aufrufer gibt einen expliziten kanzleiNameOverride mit (z.B. der
 * Kanzlei-Name aus der Overview-Zeile beim Einzel-Kanzlei-Export).
 */
interface NormalizedActiveUsersReport {
  kanzleiId: string;
  kanzleiName: string;
  year: bigint;
  months: ActiveUserMonth[];
}

function normalizeActiveUsersReport(
  report: AllKanzleienActiveUsersReport | ActiveUsersYearReport,
  kanzleiNameOverride?: string,
): NormalizedActiveUsersReport {
  if ("kanzleiName" in report && typeof report.kanzleiName === "string") {
    const r = report as AllKanzleienActiveUsersReport;
    return {
      kanzleiId: r.kanzleiId,
      kanzleiName: r.kanzleiName,
      year: r.year,
      months: r.months,
    };
  }
  const r = report as ActiveUsersYearReport;
  return {
    kanzleiId: r.kanzleiId,
    kanzleiName: kanzleiNameOverride !== undefined ? kanzleiNameOverride : "",
    year: r.year,
    months: r.months,
  };
}

/**
 * Baut die 12 Zeilen für einen Report auf. Fehlende Monate werden als
 * Null-Zeile eingefügt, sodass die Tabelle immer 12 Zeilen hat. Jede Zeile
 * enthält Kanzlei, Jahr, Monat (deutscher Name), Aktive Benutzer und Gesamt
 * (Summe der aktiven Benutzer über das Jahr bis zu diesem Monat — hier als
 * Monatswert, da "Gesamt" die Gesamtzahl aktiver Benutzer im Monat meint).
 *
 * Die "Gesamt"-Spalte spiegelt die `total`-Eigenschaft des Monats aus dem
 * Backend (Gesamtzahl aktiver Benutzer in diesem Monat).
 */
function buildActiveUsersRows(report: NormalizedActiveUsersReport): Array<{
  kanzlei: string;
  jahr: string;
  monat: string;
  aktiveBenutzer: string;
  gesamt: string;
}> {
  // Lookup nach Monatsindex (1-basiert).
  const byMonth = new Map<number, ActiveUserMonth>();
  for (const m of report.months) {
    byMonth.set(Number(m.month), m);
  }
  const rows: Array<{
    kanzlei: string;
    jahr: string;
    monat: string;
    aktiveBenutzer: string;
    gesamt: string;
  }> = [];
  for (let i = 1; i <= 12; i++) {
    const m = byMonth.get(i);
    const aktive = m ? Number(m.total) : 0;
    rows.push({
      kanzlei: report.kanzleiName,
      jahr: String(report.year),
      monat: germanMonthName(BigInt(i)),
      aktiveBenutzer: String(aktive),
      gesamt: String(aktive),
    });
  }
  return rows;
}

export interface ActiveUsersExportOptions {
  /** Dateiname (ohne Pfad). Endung wird automatisch gesetzt. */
  filename: string;
  /** Optionaler Titel für das PDF-Dokument. */
  title?: string;
  /** Optionaler Untertitel für das PDF-Dokument. */
  subtitle?: string;
}

/**
 * (a) CSV-Export eines einzelnen AllKanzleienActiveUsersReport oder
 * ActiveUsersYearReport. Header: Kanzlei;Jahr;Monat;Aktive Benutzer;Gesamt
 * Semikolon-getrennt, deutscher Monatsname. Die Tabelle hat stets 12 Zeilen
 * (fehlende Monate werden als 0 eingefügt).
 */
export function exportActiveUsersCsv(
  report: AllKanzleienActiveUsersReport | ActiveUsersYearReport,
  options: ActiveUsersExportOptions,
  kanzleiName?: string,
): void {
  const normalized = normalizeActiveUsersReport(report, kanzleiName);
  const rows = buildActiveUsersRows(normalized);
  const header = "Kanzlei;Jahr;Monat;Aktive Benutzer;Gesamt";
  const lines = rows.map((r) =>
    [r.kanzlei, r.jahr, r.monat, r.aktiveBenutzer, r.gesamt]
      .map((cell) => {
        // Felder mit Semikolon oder Anführungszeichen quoten.
        if (cell.includes(";") || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      })
      .join(";"),
  );
  // BOM für Excel-Kompatibilität (UTF-8 mit deutschem Umlauten).
  const csv = `\uFEFF${header}\r\n${lines.join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const filename = options.filename.endsWith(".csv")
    ? options.filename
    : `${options.filename}.csv`;
  triggerDownload(blob, filename);
}

/**
 * (b) PDF-Export via bestehender exportPdf-Infrastruktur (jspdf + autotable).
 * Akzeptiert einen einzelnen Report oder ein Array von Reports. Bei mehreren
 * Reports entsteht ein mehrseitiges Dokument mit einer Sektion pro Kanzlei
 * (Kanzlei-Name als Überschrift, 12-Monate-Tabelle darunter).
 *
 * Die Spalten sind: Monat | Aktive Benutzer | Gesamt. Die Kanzlei- und Jahr-
 * Spalten entfallen in der PDF-Tabelle, da sie als Sektionsüberschrift bzw.
 * Dokumenttitel dargestellt werden.
 */
export async function exportActiveUsersPdf(
  report:
    | AllKanzleienActiveUsersReport
    | ActiveUsersYearReport
    | Array<AllKanzleienActiveUsersReport | ActiveUsersYearReport>,
  options: ActiveUsersExportOptions,
): Promise<void> {
  const reports = Array.isArray(report) ? report : [report];
  const normalized = reports.map((r) => normalizeActiveUsersReport(r));
  const columns: PdfColumn[] = [
    { header: "Monat", dataKey: "monat" },
    { header: "Aktive Benutzer", dataKey: "aktiveBenutzer" },
    { header: "Gesamt", dataKey: "gesamt" },
  ];

  const filename = options.filename.endsWith(".pdf")
    ? options.filename
    : `${options.filename}.pdf`;

  if (normalized.length === 1) {
    // Einzelner Report → eine Tabelle.
    const r = normalized[0];
    const rows = buildActiveUsersRows(r).map((row) => ({
      monat: row.monat,
      aktiveBenutzer: row.aktiveBenutzer,
      gesamt: row.gesamt,
    }));
    const title =
      options.title ??
      (r.kanzleiName
        ? `Aktive Benutzer — ${r.kanzleiName} ${r.year}`
        : `Aktive Benutzer — ${r.year}`);
    await exportPdf({
      title,
      subtitle: options.subtitle,
      columns,
      rows,
      filename,
    });
    return;
  }

  // Mehrere Reports → mehrseitiges Dokument mit einer Sektion pro Kanzlei.
  const sections: PdfSection[] = normalized.map((r) => {
    const rows = buildActiveUsersRows(r).map((row) => ({
      monat: row.monat,
      aktiveBenutzer: row.aktiveBenutzer,
      gesamt: row.gesamt,
    }));
    return {
      title:
        r.kanzleiName || r.kanzleiId
          ? `${r.kanzleiName || r.kanzleiId} — ${r.year}`
          : `Aktive Benutzer — ${r.year}`,
      columns,
      rows,
    };
  });

  await exportPdf({
    title: options.title ?? "Aktive Benutzer pro Kanzlei",
    subtitle: options.subtitle,
    sections,
    filename,
  });
}
