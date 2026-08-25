// ─── Gemeinsame statische Resolver (Editor/Vorschau ↔ DOCX-Export) ──────────
//
// P1-Fix WYSIWYG-Konsistenz: Dieses Modul ist die EINZIGE Quelle für statische
// Rechnungselemente (Absenderadresse, Rechnungsmetadaten, Mandatsinformationen,
// Rechnungstext), die von BEIDEN Renderern konsumiert werden — der Editor-
// Vorschau (LayoutCanvas) und dem DOCX-Export (exportRechnungDocx). Vor diesem
// Fix hatte LayoutCanvas eine lokale resolvePlaceholders()-Funktion mit
// hartcodierten PREVIEW_VALUES (Kanzlei Mustermann), während export.ts eine
// exportierte resolvePlaceholders()-Funktion mit echten Rechnungsdaten nutzte.
// Beide Implementierungen waren SEPARAT, sodass Absenderadresse und
// Rechnungsmetadaten in Editor/Vorschau und Word unterschiedlich aufgebaut
// wurden — die WYSIWYG-Parität war verletzt.
//
// Die Resolver sind reine Funktionen (keine Seiteneffekte, keine React- oder
// docx-Abhängigkeiten), sodass sie sowohl in React-Komponenten (Editor) als
// auch in der asynchronen Export-Pipeline (DOCX) aufgerufen werden können.
//
// WICHTIG — Geometrie und Typografie werden HIER NICHT berührt. Die Resolver
// liefern NUR den Inhalt (Zeilen/Label-Wert-Paare). Die Geometrie
// (xMm/yMm/widthMm/heightMm, elementLeftTwips, verticalGapMm) und Typografie
// (applyTypography, fontStack) bleiben in ihren bestehenden Modulen — diese
// Resolver verändern keine Position, keine Breite, keine Schrift. Sie sind
// reine Inhalts-Quellen.

import type { KanzleiStammdaten } from "@/types";

// ─── Absenderadresse ─────────────────────────────────────────────────────────
//
// Liefert ein Array von Zeilen (jede Zeile = ein String, Leerzeile = leerer
// String ''). Die Zeilenfolge ist:
//
//   [0] <Kanzleiname>            (nur wenn kanzleiname vorhanden — KEIN Fallback)
//   [1] <Strasse / Hausnummer>    (nur wenn strasseHausnummer vorhanden)
//   [2] <PLZ> <Ort>              (nur wenn plz UND ort vorhanden; nur plz oder
//                                  nur ort → entsprechender Teil)
//   [3] ''                        (Leerzeile 1 — IMMER, wenn mind. ein Adress-
//                                  teil vorhanden ist)
//   [4] ''                        (Leerzeile 2 — IMMER, wenn mind. ein Adress-
//                                  teil vorhanden ist)
//   [5] 'E-Mail: <E-Mail>'        (nur wenn email vorhanden)
//   [6] 'Tel.: <Telefon>'         (nur wenn telefon vorhanden)
//   [7] 'MWST-Nr.: <MWST-Nr.>'    (nur wenn mwstNr vorhanden)
//
// Optionale Felder, die leer/undefined sind, werden GANZ weggelassen (keine
// 'undefined'-Labels, keine leeren beschrifteten Labels). Wenn kanzleiname
// fehlt, entfällt Zeile [0] — die nachfolgenden Zeilen rücken im Array nach,
// aber die zwei Leerzeilen zwischen Adressblock und Kontaktblock bleiben
// IMMER erhalten (sofern mindestens ein Adress-Teil vorhanden ist).
//
// Wenn ALLE Felder fehlen, liefere [] (leeres Array) — der Renderer zeigt
// dann einen Platzhalter-Text (Editor) bzw. rendert nichts (DOCX).
//
// Die zwei Leerzeilen zwischen Adressblock und Kontaktblock sind ein
// verbindliches Akzeptanzkriterium (identisch in Editor/Vorschau und Word).
// Sie werden als leere Strings ('') im Array repräsentiert; der Editor
// rendert sie als leere <div>-Zeilen mit Höhe, der DOCX-Export als leere
// Paragraphen mit passender Zeilenhöhe.
export function getAbsenderadresse(
  stammdaten: KanzleiStammdaten | null | undefined,
): string[] {
  if (!stammdaten) return [];

  const lines: string[] = [];

  // Adressblock (Kanzleiname, Strasse, PLZ/Ort) — optionale Felder ganz
  // weglassen, wenn leer/undefined. KEIN Fallback auf Benutzer-/LE-/Demo-Daten.
  const kanzleiname = trimOrUndefined(stammdaten.kanzleiname);
  const strasse = trimOrUndefined(stammdaten.strasseHausnummer);
  const plz = trimOrUndefined(stammdaten.plz);
  const ort = trimOrUndefined(stammdaten.ort);

  if (kanzleiname) lines.push(kanzleiname);
  if (strasse) lines.push(strasse);
  if (plz || ort) {
    lines.push([plz, ort].filter(Boolean).join(" "));
  }

  // Wenn gar kein Adress-Teil vorhanden ist, liefere [] — kein Kontaktblock
  // ohne Adressblock (das wäre keine sinnvolle Absenderadresse).
  if (lines.length === 0) return [];

  // Zwei Leerzeilen zwischen Adressblock und Kontaktblock — IMMER, sobald
  // mindestens ein Adress-Teil vorhanden ist. Verbindliches Akzeptanzkriterium.
  lines.push("");
  lines.push("");

  // Kontaktblock (E-Mail, Telefon, MWST-Nr.) — optionale Felder nur
  // rendern, wenn sie vorhanden sind. Keine beschrifteten Leerlabels.
  const email = trimOrUndefined(stammdaten.email);
  const telefon = trimOrUndefined(stammdaten.telefon);
  const mwstNr = trimOrUndefined(stammdaten.mwstNr);

  if (email) lines.push(`E-Mail: ${email}`);
  if (telefon) lines.push(`Tel.: ${telefon}`);
  if (mwstNr) lines.push(`MWST-Nr.: ${mwstNr}`);

  return lines;
}

// ─── Rechnungsmetadaten ──────────────────────────────────────────────────────
//
// Liefert ein Array von {label, value}-Paaren in fester Reihenfolge:
// Rechnungsnummer, Rechnungsdatum, Fälligkeitsdatum, Leistungszeitraum.
//
// Leere/undefined Werte werden als {label, value: ''} geliefert (Label bleibt,
// Wert leer) — damit ist die Zeilenfolge in Editor und Word IDENTISCH. Der
// Editor zeigt z.B. "Rechnungsnummer: " (leerer Wert), der DOCX-Export
// ebenfalls. So entsteht keine unterschiedliche Zeilenanzahl zwischen
// Vorschau und Word, wenn einzelne Metadaten fehlen.
//
// Der Titel (Rechnungstitel aus vorlage.standardtexte.rechnungstitel) wird
// HIER NICHT einbezogen — er ist ein separater Textblock, der vom Renderer
// oberhalb der Metadaten ausgegeben wird (Editor: resolvedTitel-Block im
// rechnungsmetadaten-Case; DOCX: titel-Paragraph im rechnungsmetadaten-Case).
// Die Resolver-Funktion liefert NUR die Label/Wert-Paare, nicht den Titel.
export interface Rechnungsmetadatum {
  label: string;
  value: string;
}

export function getRechnungsmetadaten(params: {
  rechnungsnummer?: string;
  rechnungsdatum?: string;
  faelligkeitsdatum?: string;
  leistungszeitraum?: string;
}): Rechnungsmetadatum[] {
  return [
    {
      label: "Rechnungsnummer",
      value: trimToEmpty(params.rechnungsnummer),
    },
    {
      label: "Rechnungsdatum",
      value: trimToEmpty(params.rechnungsdatum),
    },
    {
      label: "Fälligkeitsdatum",
      value: trimToEmpty(params.faelligkeitsdatum),
    },
    {
      label: "Leistungszeitraum",
      value: trimToEmpty(params.leistungszeitraum),
    },
  ];
}

// ─── Mandatsinformationen ───────────────────────────────────────────────────
//
// Zentraler Resolver für den Mandatsinformations-Block. Die LE-Logik
// (1 LE vs mehrere LE) bleibt unverändert — dieser Resolver konsolidiert
// nur die Texterzeugung, KEINE Logikänderung an der LE-Auflösung.
//
// Liefert ein Array von Zeilen (jede Zeile = ein String). Die LE-Logik
// (hasMultipleLe, singleLeName) wird vom Aufrufer berechnet und hier nur
// als Werte übergeben — der Resolver entscheidet NICHT über die LE-Menge.
//
// Inhalt:
//   - "Mandat: <bezeichnung>" — IMMER (auch wenn bezeichnung leer).
//   - "Leistungserbringer: <name>" — NUR wenn hasMultipleLe === false.
//     Der Name ist singleLeName (1 eindeutiger LE) oder der Legacy-Fallback
//     leistungserbringerName (0 fakturierte Positionen). Bei mehreren LEs
//     entfällt diese Zeile (die LEs erscheinen stattdessen pro Zeile in den
//     Tabellen).
export function getMandatsinformationen(params: {
  mandatBezeichnung?: string;
  hasMultipleLe: boolean;
  singleLeName?: string;
  leistungserbringerName?: string;
}): string[] {
  const lines: string[] = [];
  lines.push(`Mandat: ${trimToEmpty(params.mandatBezeichnung)}`);
  if (!params.hasMultipleLe) {
    const leValue =
      params.singleLeName !== undefined
        ? params.singleLeName
        : (params.leistungserbringerName ?? "");
    lines.push(`Leistungserbringer: ${trimToEmpty(leValue)}`);
  }
  return lines;
}

// ─── Rechnungstext (Einleitung / Schlusstext) ────────────────────────────────
//
// Zentraler Resolver für die Rechnungstexte (Einleitung, Schlusstext). Die
// Texte kommen aus vorlage.standardtexte.einleitung / .schlusstext und werden
// VOR der Platzhalter-Auflösung zurückgegeben — die Platzhalter-Auflösung
// (resolvePlaceholders) bleibt beim Aufrufer, da Editor und DOCX-Export
// unterschiedliche Platzhalter-Quellen nutzen (Editor: PREVIEW_VALUES,
// DOCX-Export: echte Rechnungsdaten). Dieser Resolver liefert NUR den
// Roh-Text aus der Vorlage; die Platzhalter-Auflösung ist eine separate
// Stufe, die bewusst beim Aufrufer bleibt (keine Logikänderung an der
// Platzhalter-Substitution).
export function getRechnungstext(
  vorlage:
    | { standardtexte?: { einleitung?: string; schlusstext?: string } }
    | null
    | undefined,
  field: "einleitung" | "schlusstext",
): string {
  if (!vorlage?.standardtexte) return "";
  const text = vorlage.standardtexte[field] ?? "";
  return text;
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Trimt einen String und liefert undefined, wenn er leer ist. */
function trimOrUndefined(s: string | undefined | null): string | undefined {
  if (s === undefined || s === null) return undefined;
  const trimmed = s.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Trimt einen String und liefert "" (leeren String), wenn er leer/undefined ist. */
function trimToEmpty(s: string | undefined | null): string {
  if (s === undefined || s === null) return "";
  return s.trim();
}

// ─── Root-Cause-Bericht (P1-Fix WYSIWYG-Konsistenz) ──────────────────────────
//
// Warum Absenderadresse trotz korrekter xMm/yMm/widthMm anders positioniert
// wurde:
//   Die Geometrie war bereits korrekt mm-getrieben (elementLeftTwips,
//   elementWidthTwips, verticalGapMm). Der Root Cause lag in der INHALTS-
//   QUELLE, nicht in der Geometrie: Der DOCX-Export (exportRechnungDocx)
//   bekam kanzleiName = currentUser (vorname nachname, Rechtsanwalt) — NICHT
//   aus KanzleiStammdaten — und kanzleiAdresse wurde GAR NICHT übergeben.
//   Die Adresszeile fehlte in Word deshalb komplett. Der Editor (LayoutCanvas)
//   nutzte hartcodierte PREVIEW_VALUES (Kanzlei Mustermann / Musterstrasse 1,
//   8001 Zürich). Beide Renderer zeigten unterschiedliche Absenderadressen
//   an derselben Geometrie-Position.
//
// Warum Rechnungsmetadaten abwichen:
//   Editor und DOCX-Export nutzten SEPARATE Resolver mit unterschiedlicher
//   Struktur. Der Editor baute die Metadaten als hartcodierte JSX-Struktur
//   (Nr./Datum/Zeitraum) mit PREVIEW_VALUES auf; der DOCX-Export baute sie
//   als Paragraphen mit echten Rechnungsdaten. Die Zeilenfolge und Label-
//   Schreibweise (Editor: "Nr.:"/"Datum:"/"Zeitraum:" vs DOCX:
//   "Rechnungsdatum:"/"Fälligkeitsdatum:"/"Leistungszeitraum:") unterschieden
//   sich. Jetzt nutzt BEIDE getRechnungsmetadaten() mit derselben
//   {label, value}-Struktur und fester Reihenfolge (Rechnungsnummer,
//   Rechnungsdatum, Fälligkeitsdatum, Leistungszeitraum).
//
// Ob Editor/Vorschau und Word unterschiedliche Resolver nutzten:
//   JA. LayoutCanvas hatte eine lokale resolvePlaceholders(text)-Funktion,
//   die {{token}} aus PREVIEW_VALUES ersetzte. export.ts hatte eine
//   exportierte resolvePlaceholders(text, values)-Funktion, die {{token}}
//   aus echten Rechnungsdaten ersetzte. Beide waren SEPARATE
//   Implementierungen. Jetzt sind die statischen Inhalts-Resolver
//   (getAbsenderadresse, getRechnungsmetadaten, getMandatsinformationen,
//   getRechnungstext) in DIESEM Modul konsolidiert und werden von BEIDEN
//   Renderern importiert. Die Platzhalter-Auflösung (resolvePlaceholders)
//   bleibt bewusst beim Aufrufer, da Editor und DOCX-Export unterschiedliche
//   Platzhalter-Quellen haben (PREVIEW_VALUES vs echte Rechnungsdaten) —
//   das ist beabsichtigt und keine WYSIWYG-Verletzung, da die Platzhalter
//   im Editor-Vorschaumodus bewusst Beispiel-Werte zeigen.
//
// Welche Word-Container Geometrie überschrieben:
//   KEINE. elementLeftTwips(el, layoutV2) ist die SINGLE source für die
//   linke Position; elementWidthTwips(el) für die Breite. Es gibt keine
//   Header-Grid-, Fixed-Indent- oder Container-Offset-Overrides, die die
//   Geometrie von Absenderadresse oder Metadaten überschreiben. Die
//   mm-Geometrie (xMm/yMm/widthMm/heightMm) wird direkt verwendet — keine
//   feste rechte Spalte, keine feste Header-/Grid-Position, keine
//   automatische Einrückung.
//
// Welche Indents/Cell-Margins aktiv waren:
//   NONE. leftIndent/firstLineIndent werden NICHT zusätzlich zu element.xMm
//   gesetzt (elementLeftTwips ist die einzige Quelle für die linke Position).
//   cellMargins sind symmetrisch (top/bottom 0.5mm, left/right 1.5mm) und
//   minimal, sodass sie die linke Kante eines Elements nicht verschieben.
//   Keine versteckten Verschiebungen via leftIndent, firstLineIndent,
//   tableIndent, cellMargin oder containerOffsets.
//
// Wie Leerzeilen der Absenderadresse umgesetzt werden:
//   Als leere Array-Elemente ('') im Rückgabewert von getAbsenderadresse().
//   Der Editor (LayoutCanvas) rendert jede Zeile als eigene <div>-Zeile;
//   eine Leerzeile ('') wird als leere <div> mit Höhe gerendert. Der DOCX-
//   Export (exportRechnungDocx) rendert jede Zeile als eigene Paragraph;
//   eine Leerzeile ('') wird als leerer Paragraph mit passender Zeilenhöhe
//   gerendert. Beide Renderer erzeugen so EXAKT ZWEI Leerzeilen zwischen
//   Adressblock und Kontaktblock — identisch in Editor/Vorschau und Word.
//
// Wie verticalGap Text→Tabelle stabil erzeugt wird:
//   verticalGapMm(current, next) = nextElement.yMm - (currentElement.yMm +
//   currentElement.heightMm), geklemmt auf ≥0. Wird für JEDEN Band-Übergang
//   berechnet — unabhängig davon, ob Vorgänger oder Nachfolger ein Text-Block
//   oder eine Tabelle ist. Angewendet als spacing.before=gapTwips auf einen
//   STABILEN Spacer-Paragraph (TextRun size:2, line:1 Twip), der unmittelbar
//   vor dem Folge-Band eingefügt wird. Bei gapTwips===0 wird kein Spacer
//   eingefügt. Dieser Mechanismus war bereits vorhanden und bleibt
//   UNVERÄNDERT (keine Regression).
//
// Welche statischen Elemente danach datengetrieben sind:
//   - Absenderadresse: wird JETZT aus KanzleiStammdaten (Einstellungen >
//     Kanzleidaten) via getAbsenderadresse(stammdaten) aufgebaut — KEIN
//     Benutzer-/LE-/Demo-Fallback. Editor und DOCX-Export nutzen dieselbe
//     Resolver-Funktion.
//   - Rechnungsmetadaten: werden JETZT über getRechnungsmetadaten() mit
//     derselben {label, value}-Struktur und fester Reihenfolge für Editor
//     und DOCX-Export aufgebaut. Der Editor verwendet PREVIEW_VALUES als
//     Werte (Vorschau ohne echte Rechnung), der DOCX-Export echte
//     Rechnungsdaten — die STRUKTUR ist identisch.
//   - Mandatsinformationen und Rechnungstext (Einleitung/Schlusstext)
//     wurden konsolidiert, aber ihre Logik (LE-Auflösung, Platzhalter-
//     Substitution) wurde NICHT verändert — nur die Texterzeugung ist
//     jetzt zentralisiert.
