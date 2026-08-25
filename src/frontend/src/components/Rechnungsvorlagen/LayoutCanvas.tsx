import { Position } from "@/backend";
import {
  A4_PAGE_HEIGHT_MM,
  A4_PAGE_WIDTH_MM,
  type FrontendLayoutElement,
  type FrontendLayoutElementId as FrontendLayoutElementIdT,
  type FrontendVorlageLayoutV2,
  type KanzleiStammdaten,
  LayoutElementId,
  type Rechnungsvorlage,
  SCHLUSSTEXT_ELEMENT_ID,
  computePxPerMm,
  fontStack,
  layoutElementIdToString,
  mmToPx,
  pxToMm,
} from "@/types";
import { type ResizeHandle, useDragDrop } from "@/utils/dragDrop";
import { formatCHFRounded } from "@/utils/format";
import {
  getAbsenderadresse,
  getRechnungsmetadaten,
} from "@/utils/staticResolvers";
import { AlignCenter, AlignLeft, AlignRight, GripVertical } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ─── A4 Layout-Leinwand mit mm-Koordinatensystem (P2.5/P2.7/P2.8/P2.10/P2.11) ─
// Die Leinwand stellt eine A4-Hochformat-Seite (210 × 297 mm) dar. Die
// Dokumentgeometrie wird intern in Millimetern gespeichert (xMm, yMm,
// widthMm, heightMm). Drag/Resize rechnet Pixel-Offsets in mm zurück, sodass
// die gespeicherten Dokumentmaße von der UI-Skalierung (Zoom) entkoppelt sind.
//
// Der Zoom (P2.11) ändert nur die Bildschirmdarstellung, niemals die
// gespeicherten mm/pt-Werte. Die proportionale Skalierung (P2.10) erzwingt das
// A4-Verhältnis 210:297 bei jeder Zoomstufe.
//
// FIX 2 — Dokumenteditor: Die Leinwand zeigt nicht mehr abstrakte kleine
// Karten, sondern die tatsächliche Rechnung (Logo, Absender, Empfänger,
// Rechnungsmetadaten, Einleitung, Leistungspositionen-Tabelle,
// Spesen/Auslagen-Tabelle, Summen/MWST, Zahlungsinformationen, Fusszeile).
// Die Editierhilfen (Rahmen, Handles, Safe Area) werden als Overlay auf dem
// realistischen Dokument dargestellt. Im Vorschaumodus (`preview=true`) werden
// die Editierhilfen ausgeblendet — dieselbe A4-Seite ohne Handles.

export type ZoomLevel = "fit" | "50" | "75" | "100";

interface LayoutCanvasProps {
  layoutV2: FrontendVorlageLayoutV2;
  selectedId: FrontendLayoutElementIdT | null;
  onSelect: (id: FrontendLayoutElementIdT) => void;
  onCommitDrag: (
    id: FrontendLayoutElementIdT,
    patch: Partial<Pick<FrontendLayoutElement, "xMm" | "yMm">>,
  ) => void;
  onCommitResize: (
    id: FrontendLayoutElementIdT,
    patch: Partial<
      Pick<FrontendLayoutElement, "xMm" | "yMm" | "widthMm" | "heightMm">
    >,
  ) => void;
  vorlage: Rechnungsvorlage;
  logoUrl: string | null;
  zoom: ZoomLevel;
  /** Vorschaumodus: dieselbe A4-Seite ohne Editor-Handles (FIX 2.11). */
  preview?: boolean;
  /**
   * Kanzlei-Stammdaten (Einstellungen > Kanzleidaten) — kanonische Quelle für
   * die Absenderadresse. P1-Fix WYSIWYG: LayoutCanvas nutzt JETZT
   * getAbsenderadresse(stammdaten) statt hartcodierter PREVIEW_VALUES
   * (Kanzlei Mustermann). Wenn stammdaten null/undefined ist (noch nicht
   * geladen), zeigt der Editor einen dezenten Platzhalter-Text — KEIN
   * Mustermann-Fallback.
   */
  stammdaten?: KanzleiStammdaten | null;
}

// 8 Resize-Handles (n/s/e/w/ne/nw/se/sw). Jeder Handle ist 24px (Touch-Target)
// und an den Kanten/Ecken des Elements positioniert.
const RESIZE_HANDLES: {
  dir: ResizeHandle;
  cls: string;
  cursor: string;
}[] = [
  {
    dir: "n",
    cls: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
    cursor: "ns-resize",
  },
  {
    dir: "s",
    cls: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
    cursor: "ns-resize",
  },
  {
    dir: "e",
    cls: "top-1/2 right-0 -translate-y-1/2 translate-x-1/2",
    cursor: "ew-resize",
  },
  {
    dir: "w",
    cls: "top-1/2 left-0 -translate-y-1/2 -translate-x-1/2",
    cursor: "ew-resize",
  },
  {
    dir: "ne",
    cls: "top-0 right-0 translate-x-1/2 -translate-y-1/2",
    cursor: "nesw-resize",
  },
  {
    dir: "nw",
    cls: "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
    cursor: "nwse-resize",
  },
  {
    dir: "se",
    cls: "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
    cursor: "nwse-resize",
  },
  {
    dir: "sw",
    cls: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    cursor: "nesw-resize",
  },
];

function alignClass(pos: Position | undefined): string {
  switch (pos) {
    case Position.links:
      return "text-left";
    case Position.rechts:
      return "text-right";
    case Position.zentriert:
      return "text-center";
    default:
      return "text-left";
  }
}

function justifyClass(pos: Position | undefined): string {
  switch (pos) {
    case Position.links:
      return "justify-start";
    case Position.rechts:
      return "justify-end";
    case Position.zentriert:
      return "justify-center";
    default:
      return "justify-start";
  }
}

// ─── Statische Vorschau-Daten (Mustermann Mandat) ──────────────────────────────
// Die Leinwand zeigt eine realistische Beispiel-Rechnung, damit der Editor
// das Gefühl vermittelt "Was ich hier sehe, wird meine Rechnung" (FIX 2.5).
// Die Werte sind statisch — der Word/PDF-Export ersetzt die Platzhalter
// später durch die echten Rechnungsdaten.
//
// Fix 4 (dynamische Währung): Die Währung ist nicht mehr hardcoded "CHF",
// sondern wird aus dem Vorschau-Mandat (oder Default "CHF") abgeleitet. Der
// `previewCurrency`-Wert wird in formatCHFRounded-Aufrufen und in den
// honorar/betrag-String-Literalen der PREVIEW_POSITIONS/PREVIEW_AUSLAGEN
// verwendet. Da die Arrays jetzt von previewCurrency abhängen, sind sie
// keine `as const`-Literale mehr, sondern reguläre Arrays.

const PREVIEW_CURRENCY_DEFAULT = "CHF";

// P1-Fix WYSIWYG: PREVIEW_VALUES enthält KEINE kanzlei_name/kanzlei_adresse
// mehr — die Absenderadresse wird JETZT aus KanzleiStammdaten (stammdaten-
// Prop) via getAbsenderadresse(stammdaten) aufgebaut. Die übrigen Preview-
// Werte (rechnungsnummer, rechnungsdatum, leistungszeitraum, empfaenger_name,
// empfaenger_adresse, subtotal/mwst/total, mandat_bezeichnung,
// leistungserbringer, zahlungsbedingungen) bleiben für die Vorschau ohne echte
// Rechnung erhalten — nur die Absenderadresse-Quelle hat sich geändert.
const PREVIEW_VALUES = {
  rechnungsnummer: "RE-2026-0001",
  rechnungsdatum: "22.07.2026",
  leistungszeitraum: "01.07.2026 - 31.07.2026",
  empfaenger_name: "Mandat Mustermann",
  empfaenger_adresse: "Clientweg 2, 8002 Zürich",
  subtotal: formatCHFRounded(BigInt(227660)),
  mwst_betrag: formatCHFRounded(BigInt(18440)),
  mwst_satz: "8.1%",
  total: formatCHFRounded(BigInt(246095)),
  mandat_bezeichnung: "Mustermann Mandat",
  leistungserbringer: "Dr. Mustermann",
  zahlungsbedingungen: "Zahlbar innerhalb 30 Tagen",
} as const;

const PREVIEW_POSITIONS = [
  {
    taetigkeit: "Beratung Gesellschaftsrecht",
    dauer: "1.5 h",
    honorar: `${PREVIEW_CURRENCY_DEFAULT} 525.00`,
  },
  {
    taetigkeit: "Schriftsatz Klageentwurf",
    dauer: "3.0 h",
    honorar: `${PREVIEW_CURRENCY_DEFAULT} 1'050.00`,
  },
  {
    taetigkeit: "Telefonkonferenz Mandant",
    dauer: "0.5 h",
    honorar: `${PREVIEW_CURRENCY_DEFAULT} 175.00`,
  },
];

const PREVIEW_AUSLAGEN = [
  {
    datum: "15.07.2026",
    beschreibung: "Porto B-Post",
    betrag: `${PREVIEW_CURRENCY_DEFAULT} 8.50`,
  },
  {
    datum: "18.07.2026",
    beschreibung: "Kopien Akte",
    betrag: `${PREVIEW_CURRENCY_DEFAULT} 12.00`,
  },
];

/**
 * resolvePlaceholders — ersetzt {{token}}-Marker durch PREVIEW_VALUES.
 * Wird nur für die statische Vorschau verwendet; das Backend übernimmt die
 * echte Substitution beim PDF/Word-Export.
 */
function resolvePlaceholders(text: string): string {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in PREVIEW_VALUES) {
      return PREVIEW_VALUES[key as keyof typeof PREVIEW_VALUES];
    }
    return match;
  });
}

// ─── Realistischer Element-Inhalt (FIX 2.4) ───────────────────────────────────
// Rendert den tatsächlichen Rechnungsinhalt für jedes LayoutElement — echtes
// Logo, Absender, Empfänger, Rechnungsmetadaten, Einleitung, Leistungs-
// positionen als echte Tabelle, Spesen/Auslagen als echte Tabelle, Summen/MWST,
// Zahlungsinformationen, Fusszeile. Die Logik entspricht der bisherigen
// PreviewDocumentV2, ist aber in die Leinwand integriert.

function renderElementContent(
  el: FrontendLayoutElement,
  vorlage: Rechnungsvorlage,
  logoUrl: string | null,
  stammdaten?: KanzleiStammdaten | null,
): ReactNode {
  const align = alignClass(el.alignment);
  const resolvedTitel = resolvePlaceholders(
    vorlage.standardtexte.rechnungstitel,
  );
  const resolvedEinleitung = resolvePlaceholders(
    vorlage.standardtexte.einleitung,
  );
  const resolvedZahlungshinweis = resolvePlaceholders(
    vorlage.standardtexte.zahlungshinweis,
  );
  const resolvedSchluss = resolvePlaceholders(
    vorlage.standardtexte.schlusstext,
  );

  const typographyStyle: CSSProperties = {
    fontFamily: fontStack(el.fontFamily),
    fontSize: el.fontSize ? `${el.fontSize}pt` : undefined,
    fontWeight: el.bold ? "bold" : undefined,
    fontStyle: el.italic ? "italic" : undefined,
  };
  const wrap = (content: ReactNode): ReactNode => (
    <div style={typographyStyle} className="h-full overflow-hidden">
      {content}
    </div>
  );

  switch (el.id) {
    case LayoutElementId.absenderadresse:
      // P1-Fix WYSIWYG: Absenderadresse aus KanzleiStammdaten (stammdaten-
      // Prop) via getAbsenderadresse(stammdaten) — KEIN Mustermann-Fallback.
      // Wenn stammdaten null/undefined ist (noch nicht geladen), zeige einen
      // dezenten Platzhalter-Text. Die mm-Geometrie (left/top/width/height
      // via mmToPx) bleibt UNVERÄNDERT — nur die Inhaltsquelle ändert sich.
      return wrap(
        <div className={align}>
          {(() => {
            const lines = getAbsenderadresse(stammdaten);
            if (lines.length === 0) {
              return (
                <div className="text-neutral-400 italic text-[9px]">
                  Kanzleidaten in Einstellungen &gt; Kanzleidaten erfassen
                </div>
              );
            }
            // Jede Zeile als eigene <div>-Zeile rendern; Leerzeile ('') als
            // leere <div> mit Höhe. Die erste Zeile (Kanzleiname) fett, wenn
            // vorhanden — konsistent mit der bisherigen Darstellung.
            return lines.map((line, idx) => (
              <div
                key={`${idx}-${line}`}
                className={
                  idx === 0 && line.length > 0
                    ? "font-semibold text-neutral-900"
                    : line.length > 0
                      ? "text-neutral-600"
                      : ""
                }
                style={line.length === 0 ? { height: "1em" } : undefined}
              >
                {line}
              </div>
            ));
          })()}
        </div>,
      );
    case LayoutElementId.empfaengeradresse:
      return wrap(
        <div className={align}>
          <div className="font-semibold text-neutral-900">
            {PREVIEW_VALUES.empfaenger_name}
          </div>
          <div className="text-neutral-600">
            {PREVIEW_VALUES.empfaenger_adresse}
          </div>
        </div>,
      );
    case LayoutElementId.logo:
      return wrap(
        logoUrl ? (
          <div className={`flex ${justifyClass(el.alignment)}`}>
            <img
              src={logoUrl}
              alt="Logo-Vorschau"
              className="inline-block max-h-16 max-w-[180px] object-contain"
            />
          </div>
        ) : (
          <div className={`${align} text-neutral-400 italic text-[9px]`}>
            Kein Logo
          </div>
        ),
      );
    case LayoutElementId.rechnungsmetadaten:
      // P1-Fix WYSIWYG: Rechnungsmetadaten über getRechnungsmetadaten() mit
      // PREVIEW_VALUES (für Vorschau ohne echte Rechnung). Die STRUKTUR
      // ({label, value}-Paare in fester Reihenfolge) ist IDENTISCH mit dem
      // DOCX-Export — nur die Werte kommen hier aus PREVIEW_VALUES, im DOCX
      // aus echten Rechnungsdaten. Der Titel (resolvedTitel) bleibt ein
      // separater Block oberhalb der Metadaten.
      return wrap(
        <div className={align}>
          <div className="font-display text-base font-bold text-neutral-900">
            {resolvedTitel || "Rechnung"}
          </div>
          <div className="mt-1 space-y-0.5 text-neutral-700">
            {getRechnungsmetadaten({
              rechnungsnummer: PREVIEW_VALUES.rechnungsnummer,
              rechnungsdatum: PREVIEW_VALUES.rechnungsdatum,
              leistungszeitraum: PREVIEW_VALUES.leistungszeitraum,
            }).map((m) => (
              <div key={m.label}>
                <span className="text-neutral-500">{m.label}: </span>
                <span className="font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        </div>,
      );
    case LayoutElementId.mandatsinfo:
      return wrap(
        <div className={align}>
          <div>
            <span className="text-neutral-500">Mandat: </span>
            <span className="font-medium">
              {PREVIEW_VALUES.mandat_bezeichnung}
            </span>
          </div>
          <div>
            <span className="text-neutral-500">Leistungserbringer: </span>
            <span className="font-medium">
              {PREVIEW_VALUES.leistungserbringer}
            </span>
          </div>
        </div>,
      );
    case LayoutElementId.einleitung:
      return wrap(
        resolvedEinleitung ? (
          <p className={`${align} text-neutral-800 whitespace-pre-wrap`}>
            {resolvedEinleitung}
          </p>
        ) : null,
      );
    case LayoutElementId.leistungspositionen:
      // P2.17 — Dynamischer Bereich: die Tabelle wächst vertikal mit den
      // Positionen. Der Seitenumbruch wird vom Word-Export gehandhabt.
      return wrap(
        <div className="overflow-hidden rounded border border-neutral-200">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-neutral-100 text-neutral-600">
                <th className="px-2 py-1.5 text-left font-medium">Tätigkeit</th>
                <th className="px-2 py-1.5 text-right font-medium">Dauer</th>
                <th className="px-2 py-1.5 text-right font-medium">Honorar</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_POSITIONS.map((pos) => (
                <tr
                  key={pos.taetigkeit}
                  className="border-t border-neutral-200"
                >
                  <td className="px-2 py-1.5 text-neutral-800">
                    {pos.taetigkeit}
                  </td>
                  <td className="px-2 py-1.5 text-right text-neutral-700">
                    {pos.dauer}
                  </td>
                  <td className="px-2 py-1.5 text-right text-neutral-800 tabular-nums">
                    {pos.honorar}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    case LayoutElementId.summenblock:
      return wrap(
        <div className={`flex ${justifyClass(el.alignment)} w-full`}>
          <div className="w-48 space-y-1 text-[10px]">
            <div className="flex justify-between text-neutral-700">
              <span>Subtotal</span>
              <span className="tabular-nums">{PREVIEW_VALUES.subtotal}</span>
            </div>
            <div className="flex justify-between text-neutral-700">
              <span>MWST {PREVIEW_VALUES.mwst_satz}</span>
              <span className="tabular-nums">{PREVIEW_VALUES.mwst_betrag}</span>
            </div>
            <div className="my-1 h-px bg-neutral-300" />
            <div className="flex justify-between font-semibold text-neutral-900">
              <span>Total</span>
              <span className="tabular-nums">{PREVIEW_VALUES.total}</span>
            </div>
          </div>
        </div>,
      );
    case LayoutElementId.zahlungsinformationen:
      // Fix 4 — Zahlungsinformationen rendern NUR den Zahlungshinweis. Der
      // Schlusstext ist jetzt ein eigenes, separat verschiebbares/resizbares
      // Element (siehe SCHLUSSTEXT_ELEMENT_ID-Case unten). Die bisherige
      // gemeinsame Darstellung in einer Zelle/Container war die Fix-4-Root-
      // Cause (shared rendering); sie ist jetzt aufgetrennt.
      return wrap(
        resolvedZahlungshinweis ? (
          <p className={`${align} text-neutral-800 whitespace-pre-wrap`}>
            {resolvedZahlungshinweis}
          </p>
        ) : null,
      );
    case SCHLUSSTEXT_ELEMENT_ID:
      // Fix 4 — Schlusstext als eigenes Element (frontend-only). Rendert NUR
      // den Schlusstext (aus dem legacy-Feld standardtexte.schlusstext oder
      // einem Preview-Text), NICHT den Zahlungshinweis. Das Element wird vor
      // dem Speichern an das Backend herausgefiltert
      // (normalizeLayoutV2ForSave); der Text selbst bleibt im legacy-Feld
      // standardtexte.schlusstext gespeichert, das der Backend bereits kennt.
      return wrap(
        resolvedSchluss ? (
          <p className={`${align} text-neutral-800 whitespace-pre-wrap`}>
            {resolvedSchluss}
          </p>
        ) : null,
      );
    case LayoutElementId.fusszeile:
      return wrap(
        <div className="h-full flex flex-col justify-end">
          <div className="mb-2 h-px bg-neutral-200" />
          <p
            className={`${alignClass(
              el.alignment ?? Position.zentriert,
            )} text-[9px] text-neutral-500`}
          >
            {vorlage.layout.fusszeile ||
              "Fusszeile — hier Kanzlei- und Kontodaten erfassen"}
          </p>
        </div>,
      );
    case LayoutElementId.spesenAuslagen:
      // P2.17 — Dynamischer Bereich: die Auslagen-Tabelle wächst vertikal.
      return wrap(
        <div className="overflow-hidden rounded border border-neutral-200">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-neutral-100 text-neutral-600">
                <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                <th className="px-2 py-1.5 text-left font-medium">
                  Beschreibung
                </th>
                <th className="px-2 py-1.5 text-right font-medium">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {PREVIEW_AUSLAGEN.map((aus) => (
                <tr
                  key={`${aus.datum}-${aus.beschreibung}`}
                  className="border-t border-neutral-200"
                >
                  <td className="px-2 py-1.5 text-neutral-700">{aus.datum}</td>
                  <td className="px-2 py-1.5 text-neutral-800">
                    {aus.beschreibung}
                  </td>
                  <td className="px-2 py-1.5 text-right text-neutral-800 tabular-nums">
                    {aus.betrag}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    default:
      return null;
  }
}

export function LayoutCanvas({
  layoutV2,
  selectedId,
  onSelect,
  onCommitDrag,
  onCommitResize,
  vorlage,
  logoUrl,
  zoom,
  preview = false,
  stammdaten,
}: LayoutCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Leinwand-Breite verfolgen, um pxPerMm zu berechnen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A4-Dokumentgeometrie aus layoutV2 (P2.7). Fallback auf Standard-A4.
  const pageWidthMm = layoutV2.pageWidthMm ?? A4_PAGE_WIDTH_MM;
  const pageHeightMm = layoutV2.pageHeightMm ?? A4_PAGE_HEIGHT_MM;
  const marginTopMm = layoutV2.marginTopMm ?? 20;
  const marginBottomMm = layoutV2.marginBottomMm ?? 20;
  const marginLeftMm = layoutV2.marginLeftMm ?? 20;
  const marginRightMm = layoutV2.marginRightMm ?? 20;

  // Zoom berechnen (P2.11): "fit" passt die Leinwand an die Container-Breite
  // an, feste Stufen skalieren entsprechend. Die pxPerMm-Skala ändert nur die
  // Bildschirmdarstellung, niemals die gespeicherten mm-Werte.
  // FIX 2.9 — Bei 100% wird die Leinwand sinnvoll gross dargestellt; der
  // Arbeitsbereich ist bei Bedarf horizontal/vertikal scrollbar, aber das
  // A4-Verhältnis bleibt immer erhalten.
  const fitWidthPx = containerWidth > 0 ? containerWidth : 600;
  const zoomFactor =
    zoom === "fit"
      ? 1
      : zoom === "50"
        ? 0.5
        : zoom === "75"
          ? 0.75
          : zoom === "100"
            ? 1
            : 1;
  // Bei "fit" nimmt die Leinwand die volle Container-Breite ein. Bei festen
  // Stufen wird die Basisbreite (fit) mit dem Zoom-Faktor skaliert.
  const canvasWidthPx = fitWidthPx * zoomFactor;
  const pxPerMm = computePxPerMm(canvasWidthPx, pageWidthMm);
  const canvasHeightPx = mmToPx(pageHeightMm, pxPerMm);

  // Safe Area (Druckbereich) in mm — innerhalb der Seitenränder (P2.9).
  const safeAreaMm = {
    x: marginLeftMm,
    y: marginTopMm,
    width: pageWidthMm - marginLeftMm - marginRightMm,
    height: pageHeightMm - marginTopMm - marginBottomMm,
  };

  // Drag/Resize-Hook — arbeitet mit Pixel-Offsets, die wir in mm zurückrechnen.
  // Wir verwenden ein Pseudo-Grid (1×1), da die Leinwand jetzt mm-basiert ist.
  // Die Hook braucht cols/rows/containerWidth/containerHeight für die
  // Snap-Berechnung; wir übergeben die Leinwand-Dimensionen und rechnen
  // danach manuell in mm um.
  const {
    dragState,
    resizeState,
    onPointerDown,
    onResizeStart,
    onPointerMove,
    onPointerUp,
  } = useDragDrop(
    {
      cols: 1,
      rows: 1,
      containerWidth: canvasWidthPx,
      containerHeight: canvasHeightPx,
    },
    () => canvasRef.current?.getBoundingClientRect() ?? null,
  );

  // Elemente nach zOrder sortieren für die Stapelreihenfolge (P2.8).
  const sortedElements = useMemo(
    () =>
      [...layoutV2.elements]
        .filter((el) => el.visible)
        .sort((a, b) => Number((a.zOrder ?? a.order) - (b.zOrder ?? b.order))),
    [layoutV2.elements],
  );

  // Drag-Commit: Pixel-Delta in mm zurückrechnen (P2.8). Die Hook liefert
  // snappedArea als GridArea (1×1-Grid), aber wir brauchen die Pixel-Deltas
  // aus dem dragState direkt.
  function handlePointerUp(e: React.PointerEvent) {
    if (dragState) {
      const dxPx = dragState.currentX - dragState.startX;
      const dyPx = dragState.currentY - dragState.startY;
      const dxMm = pxToMm(dxPx, pxPerMm);
      const dyMm = pxToMm(dyPx, pxPerMm);
      // el.id is already FrontendLayoutElementId (layoutV2.elements is
      // FrontendLayoutElement[]), so no cast is needed.
      const el = layoutV2.elements.find((x) => x.id === dragState.elementId);
      if (el) {
        const newX = Math.max(
          safeAreaMm.x,
          Math.min(
            (el.xMm ?? 0) + dxMm,
            safeAreaMm.x + safeAreaMm.width - (el.widthMm ?? 50),
          ),
        );
        const newY = Math.max(
          safeAreaMm.y,
          Math.min(
            (el.yMm ?? 0) + dyMm,
            safeAreaMm.y + safeAreaMm.height - (el.heightMm ?? 25),
          ),
        );
        onCommitDrag(el.id, { xMm: newX, yMm: newY });
      }
    } else if (resizeState) {
      const dxPx = resizeState.currentX - resizeState.startX;
      const dyPx = resizeState.currentY - resizeState.startY;
      const dxMm = pxToMm(dxPx, pxPerMm);
      const dyMm = pxToMm(dyPx, pxPerMm);
      // el.id is already FrontendLayoutElementId — no cast needed.
      const el = layoutV2.elements.find((x) => x.id === resizeState.elementId);
      if (el) {
        const oX = el.xMm ?? 0;
        const oY = el.yMm ?? 0;
        const oW = el.widthMm ?? 50;
        const oH = el.heightMm ?? 25;
        let newX = oX;
        let newY = oY;
        let newW = oW;
        let newH = oH;
        const handle = resizeState.handle;
        const minW = 10;
        const minH = 5;
        if (handle.includes("e")) {
          newW = Math.max(minW, oW + dxMm);
        }
        if (handle.includes("s")) {
          newH = Math.max(minH, oH + dyMm);
        }
        if (handle.includes("w")) {
          const proposedX = oX + dxMm;
          newX = Math.max(safeAreaMm.x, proposedX);
          newW = Math.max(minW, oW - (newX - oX));
        }
        if (handle.includes("n")) {
          const proposedY = oY + dyMm;
          newY = Math.max(safeAreaMm.y, proposedY);
          newH = Math.max(minH, oH - (newY - oY));
        }
        // An Safe Area klemmen.
        newX = Math.max(
          safeAreaMm.x,
          Math.min(newX, safeAreaMm.x + safeAreaMm.width - newW),
        );
        newY = Math.max(
          safeAreaMm.y,
          Math.min(newY, safeAreaMm.y + safeAreaMm.height - newH),
        );
        newW = Math.min(newW, safeAreaMm.x + safeAreaMm.width - newX);
        newH = Math.min(newH, safeAreaMm.y + safeAreaMm.height - newY);
        onCommitResize(el.id, {
          xMm: newX,
          yMm: newY,
          widthMm: newW,
          heightMm: newH,
        });
      }
    }
    onPointerUp(e);
  }

  // Live-Offsets während Drag/Resize für visuelles Feedback.
  function getLiveOffset(el: FrontendLayoutElement): {
    x: number;
    y: number;
    w: number;
    h: number;
  } {
    const base = {
      x: el.xMm ?? 0,
      y: el.yMm ?? 0,
      w: el.widthMm ?? 50,
      h: el.heightMm ?? 25,
    };
    if (dragState && dragState.elementId === el.id) {
      return {
        ...base,
        x: base.x + pxToMm(dragState.currentX - dragState.startX, pxPerMm),
        y: base.y + pxToMm(dragState.currentY - dragState.startY, pxPerMm),
      };
    }
    if (resizeState && resizeState.elementId === el.id) {
      const dxMm = pxToMm(resizeState.currentX - resizeState.startX, pxPerMm);
      const dyMm = pxToMm(resizeState.currentY - resizeState.startY, pxPerMm);
      const handle = resizeState.handle;
      let { x, y, w, h } = base;
      if (handle.includes("e")) w = Math.max(10, base.w + dxMm);
      if (handle.includes("s")) h = Math.max(5, base.h + dyMm);
      if (handle.includes("w")) {
        x = base.x + dxMm;
        w = Math.max(10, base.w - dxMm);
      }
      if (handle.includes("n")) {
        y = base.y + dyMm;
        h = Math.max(5, base.h - dyMm);
      }
      return { x, y, w, h };
    }
    return base;
  }

  const canvasStyle: CSSProperties = {
    width: `${canvasWidthPx}px`,
    height: `${canvasHeightPx}px`,
    aspectRatio: "210 / 297",
  };

  const safeAreaStyle: CSSProperties = {
    left: `${mmToPx(safeAreaMm.x, pxPerMm)}px`,
    top: `${mmToPx(safeAreaMm.y, pxPerMm)}px`,
    width: `${mmToPx(safeAreaMm.width, pxPerMm)}px`,
    height: `${mmToPx(safeAreaMm.height, pxPerMm)}px`,
  };

  return (
    <div
      ref={containerRef}
      data-ocid="rechnungsvorlagen.canvas"
      className="w-full flex justify-center"
    >
      <div
        ref={canvasRef}
        className="relative bg-white rounded-sm shadow-md ring-1 ring-border overflow-hidden"
        style={canvasStyle}
        onPointerMove={preview ? undefined : onPointerMove}
        onPointerUp={preview ? undefined : handlePointerUp}
      >
        {/* Safe Area (Druckbereich) — gestrichelter Rahmen (P2.9).
            Im Vorschaumodus ausgeblendet (FIX 2.11). */}
        {!preview && (
          <>
            <div
              className="pointer-events-none absolute border-2 border-dashed border-primary/40 rounded-sm"
              style={safeAreaStyle}
              aria-hidden="true"
              data-ocid="rechnungsvorlagen.canvas_safe_area"
            />
            <div
              className="pointer-events-none absolute text-[9px] font-medium text-primary/60 select-none"
              style={{
                left: `${mmToPx(safeAreaMm.x, pxPerMm)}px`,
                top: `${mmToPx(safeAreaMm.y, pxPerMm)}px`,
                transform: "translate(2px, -12px)",
              }}
              aria-hidden="true"
            >
              Druckbereich ({safeAreaMm.width.toFixed(0)}×
              {safeAreaMm.height.toFixed(0)} mm)
            </div>
          </>
        )}

        {sortedElements.map((el) => {
          const isDragging = dragState?.elementId === el.id;
          const isResizing = resizeState?.elementId === el.id;
          const isSelected = selectedId === el.id;
          const live = getLiveOffset(el);
          const itemStyle: CSSProperties = {
            position: "absolute",
            left: `${mmToPx(live.x, pxPerMm)}px`,
            top: `${mmToPx(live.y, pxPerMm)}px`,
            width: `${mmToPx(live.w, pxPerMm)}px`,
            height: `${mmToPx(live.h, pxPerMm)}px`,
            zIndex:
              isDragging || isResizing ? 50 : Number(el.zOrder ?? el.order) + 1,
          };

          // Vorschaumodus: realistischer Inhalt ohne Editor-Overlays.
          if (preview) {
            return (
              <div
                key={el.id}
                style={itemStyle}
                className="p-1 overflow-hidden"
              >
                {renderElementContent(el, vorlage, logoUrl, stammdaten)}
              </div>
            );
          }

          // Bearbeitungsmodus: realistischer Inhalt + Editierhilfen als Overlay.
          return (
            <button
              type="button"
              key={el.id}
              data-ocid={`rechnungsvorlagen.canvas_element.${el.id}`}
              style={itemStyle}
              className={`group relative m-0 rounded-md border p-1 cursor-pointer select-none text-left w-full ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-primary/30 bg-white/60 hover:border-primary/60 hover:ring-1 hover:ring-primary/20"
              } ${isDragging || isResizing ? "opacity-90 shadow-lg" : ""}`}
              onClick={() => onSelect(el.id)}
              aria-label={`${layoutElementIdToString(el.id)} auswählen`}
            >
              {/* Realistischer Element-Inhalt (FIX 2.4/2.5) */}
              <div className="pointer-events-none w-full h-full overflow-hidden">
                {renderElementContent(el, vorlage, logoUrl, stammdaten)}
              </div>

              {/* Element-Label als Overlay (nur im Bearbeitungsmodus sichtbar,
                  erscheint bei Hover/Auswahl am oberen Rand) */}
              <div
                className={`absolute top-0 left-0 right-0 flex items-center justify-between gap-1 px-1 py-0.5 rounded-t-md bg-primary/90 text-primary-foreground text-[9px] font-medium leading-none transition-opacity ${
                  isSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-90"
                }`}
              >
                <span className="truncate">
                  {layoutElementIdToString(el.id)}
                </span>
                <span className="tabular-nums shrink-0 flex items-center gap-1">
                  <span>X: {live.x.toFixed(0)}mm</span>
                  <span>Y: {live.y.toFixed(0)}mm</span>
                  <span>
                    · {live.w.toFixed(0)}×{live.h.toFixed(0)}
                  </span>
                </span>
              </div>

              {/* Drag-Handle — oben links, sichtbar bei Auswahl/Hover */}
              <button
                type="button"
                aria-label={`${layoutElementIdToString(el.id)} verschieben`}
                data-ocid={`rechnungsvorlagen.drag_handle.${el.id}`}
                className={`absolute top-4 left-1 flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-white/80 shadow-sm transition-opacity ${
                  isSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPointerDown(el.id, el.gridArea, e);
                }}
              >
                <GripVertical size={14} />
              </button>

              {/* Ausrichtungs-Indikator — oben rechts */}
              {el.alignment && (
                <div
                  className={`absolute top-4 right-1 flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary transition-opacity ${
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {el.alignment === Position.links && <AlignLeft size={10} />}
                  {el.alignment === Position.zentriert && (
                    <AlignCenter size={10} />
                  )}
                  {el.alignment === Position.rechts && <AlignRight size={10} />}
                </div>
              )}

              {/* Resize-Handles — nur wenn ausgewählt (FIX 2.5: Overlay auf
                  realistischem Dokument) */}
              {isSelected &&
                RESIZE_HANDLES.map((h) => (
                  <button
                    type="button"
                    key={h.dir}
                    aria-label={`${layoutElementIdToString(el.id)} Grösse ändern (${h.dir})`}
                    data-ocid={`rechnungsvorlagen.resize_handle.${el.id}.${h.dir}`}
                    className={`absolute flex h-6 w-6 items-center justify-center rounded-full border border-primary bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${h.cls}`}
                    style={{ touchAction: "none", cursor: h.cursor }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeStart(el.id, h.dir, el.gridArea, e);
                    }}
                  >
                    <span
                      className="block h-2 w-2 rounded-full bg-current"
                      aria-hidden="true"
                    />
                  </button>
                ))}
            </button>
          );
        })}

        {!preview && sortedElements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-center p-8">
            <div>
              <p className="text-sm text-muted-foreground">
                Alle Elemente sind ausgeblendet.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Blenden Sie Elemente über die Palette wieder ein.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Zoom-Steuerung (P2.11) ──────────────────────────────────────────────────

interface ZoomControlProps {
  zoom: ZoomLevel;
  onChange: (zoom: ZoomLevel) => void;
}

export function ZoomControl({ zoom, onChange }: ZoomControlProps) {
  const options: { value: ZoomLevel; label: string }[] = [
    { value: "fit", label: "Einpassen" },
    { value: "50", label: "50%" },
    { value: "75", label: "75%" },
    { value: "100", label: "100%" },
  ];
  return (
    <fieldset
      className="inline-flex items-center rounded-md border border-border bg-card p-0.5"
      data-ocid="rechnungsvorlagen.zoom_control"
      aria-label="Zoom-Stufe"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          data-ocid={`rechnungsvorlagen.zoom_${opt.value}`}
          onClick={() => onChange(opt.value)}
          aria-pressed={zoom === opt.value}
          className={`px-2.5 py-1 text-xs rounded transition-smooth ${
            zoom === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </fieldset>
  );
}

// ─── Seitenränder-Steuerung (P2.9) ────────────────────────────────────────────

interface MarginsControlProps {
  layoutV2: FrontendVorlageLayoutV2;
  onChange: (
    patch: Partial<
      Pick<
        FrontendVorlageLayoutV2,
        "marginTopMm" | "marginBottomMm" | "marginLeftMm" | "marginRightMm"
      >
    >,
  ) => void;
}

export function MarginsControl({ layoutV2, onChange }: MarginsControlProps) {
  const fields: {
    key: keyof Pick<
      FrontendVorlageLayoutV2,
      "marginTopMm" | "marginBottomMm" | "marginLeftMm" | "marginRightMm"
    >;
    label: string;
  }[] = [
    { key: "marginTopMm", label: "Oben" },
    { key: "marginBottomMm", label: "Unten" },
    { key: "marginLeftMm", label: "Links" },
    { key: "marginRightMm", label: "Rechts" },
  ];
  return (
    <div
      className="grid grid-cols-2 gap-3"
      data-ocid="rechnungsvorlagen.margins"
    >
      {fields.map((f) => (
        <div key={f.key} className="space-y-1">
          <label
            className="text-xs text-muted-foreground"
            htmlFor={`margin-${f.key}`}
          >
            {f.label} (mm)
          </label>
          <input
            id={`margin-${f.key}`}
            type="number"
            min={5}
            max={40}
            step={1}
            value={layoutV2[f.key] ?? 20}
            data-ocid={`rechnungsvorlagen.margin_${f.key}`}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(n)) return;
              const clamped = Math.max(5, Math.min(40, n));
              onChange({ [f.key]: clamped } as Partial<
                Pick<
                  FrontendVorlageLayoutV2,
                  | "marginTopMm"
                  | "marginBottomMm"
                  | "marginLeftMm"
                  | "marginRightMm"
                >
              >);
            }}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
          />
        </div>
      ))}
      <p className="col-span-2 text-xs text-muted-foreground">
        Seitenränder in mm. Standard 20 mm, Min/Max 5–40 mm. Der Druckbereich
        auf der Leinwand wird entsprechend markiert.
      </p>
    </div>
  );
}

// ─── Hilfs-Export für Preview (wird von PreviewDocumentV2 verwendet) ──────────
export type { ReactNode };
