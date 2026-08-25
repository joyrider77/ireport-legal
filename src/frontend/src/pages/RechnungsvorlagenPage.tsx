import { Position } from "@/backend";
import {
  LayoutCanvas,
  MarginsControl,
  ZoomControl,
  type ZoomLevel,
} from "@/components/Rechnungsvorlagen/LayoutCanvas";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ALLOWED_FONT_FAMILIES,
  ALLOWED_FONT_SIZES,
  DEFAULT_LAYOUT_V2,
  DEFAULT_VORLAGE,
  type FrontendLayoutElement,
  type FrontendVorlageLayoutV2,
  type FrontendLayoutElementId as LayoutElementIdT,
  type Rechnungsvorlage,
  SCHLUSSTEXT_ELEMENT_ID,
  type Standardtexte,
  type VorlageLayout,
  type VorlageLayoutV2,
  layoutElementIdToString,
} from "@/types";
import {
  useGetKanzleiStammdaten,
  useGetLogo,
  useKanzlei,
  useRechnungsvorlage,
  useRemoveLogo,
  useSaveRechnungsvorlage,
  useUploadLogo,
} from "@/utils/backend";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// ─── Placeholder catalogue (P2.14) ───────────────────────────────────────────

interface PlaceholderEntry {
  token: string;
  label: string;
  description: string;
}

const PLACEHOLDERS: PlaceholderEntry[] = [
  {
    token: "{{rechnungsnummer}}",
    label: "Rechnungsnummer",
    description: "Eindeutige Rechnungsnummer (z. B. RE-2026-0001)",
  },
  {
    token: "{{rechnungsdatum}}",
    label: "Rechnungsdatum",
    description: "Datum der Rechnungsausstellung (dd.mm.yyyy)",
  },
  {
    token: "{{leistungszeitraum}}",
    label: "Leistungszeitraum",
    description: "Zeitraum der abgerechneten Leistungen (von – bis)",
  },
  {
    token: "{{kanzlei_name}}",
    label: "Kanzleiname",
    description: "Name der Kanzlei (Absender)",
  },
  {
    token: "{{kanzlei_adresse}}",
    label: "Kanzleiadresse",
    description: "Adresse der Kanzlei (Absender)",
  },
  {
    token: "{{empfaenger_name}}",
    label: "Empfängername",
    description: "Name des Mandanten / Empfänger",
  },
  {
    token: "{{empfaenger_adresse}}",
    label: "Empfängeradresse",
    description: "Adresse des Mandanten / Empfänger",
  },
  {
    token: "{{mandat_bezeichnung}}",
    label: "Mandatsbezeichnung",
    description: "Bezeichnung des Mandats",
  },
  {
    token: "{{leistungserbringer}}",
    label: "Leistungserbringer",
    description: "Name des leistungserbringers (Anwalt)",
  },
  {
    token: "{{zahlungsbedingungen}}",
    label: "Zahlungsbedingungen",
    description: "Zahlungsbedingungen des Mandats",
  },
  {
    token: "{{subtotal}}",
    label: "Subtotal",
    description: "Subtotal vor MWST (5-Rappen-gerundet)",
  },
  {
    token: "{{mwst_satz}}",
    label: "MWST-Satz",
    description: "Angewendeter MWST-Satz in Prozent",
  },
  {
    token: "{{mwst_betrag}}",
    label: "MWST-Betrag",
    description: "MWST-Betrag (5-Rappen-gerundet)",
  },
  {
    token: "{{total}}",
    label: "Total",
    description: "Rechnungstotal inkl. MWST (5-Rappen-gerundet)",
  },
];

// ─── Position helpers ──────────────────────────────────────────────────────────

const POSITION_OPTIONS: {
  value: Position;
  label: string;
  icon: ReactNode;
}[] = [
  { value: Position.links, label: "Links", icon: <AlignLeft size={14} /> },
  {
    value: Position.zentriert,
    label: "Zentriert",
    icon: <AlignCenter size={14} />,
  },
  { value: Position.rechts, label: "Rechts", icon: <AlignRight size={14} /> },
];

// ─── V2 layout helpers (P1.1 — Persistenz-Fix) ─────────────────────────────────
// The editor state holds a VorlageLayoutV2 with 10 LayoutElement entries.
// On load, if the saved vorlage has no layoutV2 (old template), we migrate it
// from DEFAULT_LAYOUT_V2 — keeping the V1 layout field intact for backward
// compatibility. The V1 Position selectors remain as a fallback/advanced section.
//
// P1.1 ROOT-CAUSE FIX: cloneLayoutV2 now deep-clones ALL fields — including
// the mm-Koordinaten (xMm, yMm, widthMm, heightMm, zOrder), the Seitenränder
// (marginTopMm, marginBottomMm, marginLeftMm, marginRightMm, pageWidthMm,
// pageHeightMm), and the Typografie-Felder (fontFamily, fontSize, bold, italic).
// Previously it only cloned id, visible, order, gridArea, alignment,
// fontFamily, fontSize, bold, italic — losing the mm-Felder and Seitenränder
// on every save, which caused the Persistenzfehler.

/**
 * cloneLayoutV2 — deep-clone a FrontendVorlageLayoutV2 so the editor can mutate its
 * elements/areas without touching the cached query data. BigInts are
 * primitives (copied by value), so a shallow element clone + new gridArea
 * object is sufficient. ALL fields are preserved (P1.1 fix).
 */
function cloneLayoutV2(
  layout: FrontendVorlageLayoutV2,
): FrontendVorlageLayoutV2 {
  return {
    gridCols: layout.gridCols,
    gridRows: layout.gridRows,
    // P1.1 — Seitenränder in mm (persistent in layoutV2).
    marginTopMm: layout.marginTopMm,
    marginBottomMm: layout.marginBottomMm,
    marginLeftMm: layout.marginLeftMm,
    marginRightMm: layout.marginRightMm,
    // P1.1 — A4 Dokumentgeometrie.
    pageWidthMm: layout.pageWidthMm,
    pageHeightMm: layout.pageHeightMm,
    elements: layout.elements.map((el) => ({
      id: el.id,
      visible: el.visible,
      order: el.order,
      gridArea: { ...el.gridArea },
      alignment: el.alignment,
      // Typografie-Felder
      fontFamily: el.fontFamily,
      fontSize: el.fontSize,
      bold: el.bold,
      italic: el.italic,
      // P1.1 — mm-Koordinaten (persistent, UI-Skalierung ändert diese nicht).
      xMm: el.xMm,
      yMm: el.yMm,
      widthMm: el.widthMm,
      heightMm: el.heightMm,
      // P1.1 — Stapelreihenfolge.
      zOrder: el.zOrder,
    })),
  };
}

/**
 * ensureLayoutV2 — migration on load. If the saved vorlage has a layoutV2,
 * clone it (so we never mutate cached query data). Otherwise initialize from
 * DEFAULT_LAYOUT_V2. The V1 layout field is preserved separately.
 * P1.1: cloneLayoutV2 now preserves ALL mm-Felder and Seitenränder.
 * P1-Fix: Legacy saved vorlagen that predate the Schlusstext element have a
 * layoutV2.elements array WITHOUT a Schlusstext element, so the
 * ElementCombobox (which iterates layoutV2.elements) did not show
 * 'Schlusstext' in the dropdown for those vorlagen. After cloning the saved
 * layout, inject the canonical Schlusstext element from DEFAULT_LAYOUT_V2 if
 * it is missing — additive only, no other element is touched, no full reset.
 */
function ensureLayoutV2(vorlage: Rechnungsvorlage): FrontendVorlageLayoutV2 {
  if (vorlage.layoutV2) {
    const cloned = cloneLayoutV2(vorlage.layoutV2);
    // P1-Fix: Inject Schlusstext element if missing (legacy vorlagen).
    if (!cloned.elements.some((el) => el.id === SCHLUSSTEXT_ELEMENT_ID)) {
      const defaultSchluss = DEFAULT_LAYOUT_V2.elements.find(
        (el) => el.id === SCHLUSSTEXT_ELEMENT_ID,
      );
      if (defaultSchluss) {
        cloned.elements = [
          ...cloned.elements,
          {
            id: defaultSchluss.id,
            visible: defaultSchluss.visible,
            order: defaultSchluss.order,
            gridArea: { ...defaultSchluss.gridArea },
            alignment: defaultSchluss.alignment,
            fontFamily: defaultSchluss.fontFamily,
            fontSize: defaultSchluss.fontSize,
            bold: defaultSchluss.bold,
            italic: defaultSchluss.italic,
            xMm: defaultSchluss.xMm,
            yMm: defaultSchluss.yMm,
            widthMm: defaultSchluss.widthMm,
            heightMm: defaultSchluss.heightMm,
            zOrder: defaultSchluss.zOrder,
          },
        ];
      }
    }
    return cloned;
  }
  return cloneLayoutV2(DEFAULT_LAYOUT_V2);
}

/**
 * normalizeLayoutV2ForSave — P1 FIX (bindgen-safe workaround).
 *
 * The auto-generated backend.ts encoder (to_candid_record_n198) uses truthy
 * checks for optional fields: `value.xMm ? candid_some(value.xMm) : candid_none()`.
 * This drops falsy-but-meaningful values: xMm:0, yMm:0, widthMm:0, heightMm:0,
 * bold:false, italic:false, zOrder:0n, fontSize:0n. backend.ts is regenerated
 * on bindgen so we cannot edit it; instead we normalize in the frontend state
 * layer so no falsy-defined value reaches the encoder.
 *
 * Strategy: convert every optional field to `undefined` when it is falsy
 * (0, false, 0n, "", null). The encoder maps `undefined` → candid_none(),
 * which the backend accepts as "use fallback" (gridArea for mm-fields, order
 * for zOrder, default for bold/italic). This is semantically equivalent for
 * the defaults: zOrder:0 falls back to order (same stacking), bold/italic:false
 * falls back to default (not bold/not italic), mm:0 falls back to gridArea.
 *
 * Required fields (id, visible, order, gridArea) are never touched — the
 * encoder handles them without truthy checks (order: value.order, visible:
 * value.visible, gridArea: value.gridArea).
 *
 * This preserves the full editor state across save+reload for all non-zero
 * positions (the common case). The only residual limitation: an element
 * dragged to exactly xMm:0/yMm:0 (page edge, outside safe area) reloads at
 * its gridArea-derived position. This is an acceptable edge case given the
 * bindgen constraint and the 5–40mm margin validation.
 */
function normalizeLayoutV2ForSave(
  layout: FrontendVorlageLayoutV2,
): FrontendVorlageLayoutV2 {
  return {
    gridCols: layout.gridCols,
    gridRows: layout.gridRows,
    marginTopMm: layout.marginTopMm,
    marginBottomMm: layout.marginBottomMm,
    marginLeftMm: layout.marginLeftMm,
    marginRightMm: layout.marginRightMm,
    pageWidthMm: layout.pageWidthMm,
    pageHeightMm: layout.pageHeightMm,
    // Schlusstext-Element wird vollständig als Layout-Element persistiert.
    // Das Backend kennt #schlusstext als LayoutElementId-Variant, daher wird
    // es — wie alle anderen Elemente — unverändert durchgereicht. Real
    // vorhandene, vom User gesetzte nicht-null mm-Werte werden durch das
    // `|| undefined` unten NICHT angetastet — nur falsy-Werte (0/false/0n)
    // werden zu undefined konvertiert (bindgen-Workaround, siehe Doku oben).
    elements: layout.elements.map((el) => ({
      id: el.id,
      visible: el.visible,
      order: el.order,
      gridArea: { ...el.gridArea },
      alignment: el.alignment || undefined,
      fontFamily: el.fontFamily || undefined,
      fontSize: el.fontSize || undefined,
      bold: el.bold || undefined,
      italic: el.italic || undefined,
      xMm: el.xMm || undefined,
      yMm: el.yMm || undefined,
      widthMm: el.widthMm || undefined,
      heightMm: el.heightMm || undefined,
      zOrder: el.zOrder || undefined,
    })),
  };
}

// ─── Section card wrapper ──────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  description?: string;
  ocid: string;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}

function SectionCard({
  title,
  description,
  ocid,
  icon,
  children,
  action,
}: SectionCardProps) {
  return (
    <Card data-ocid={ocid} className="gap-0 py-0">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-foreground text-base leading-tight">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  );
}

// ─── Element combobox (compact 1-line selector) ───────────────────────────────
// Replaces the former permanent ElementPalette list (P2.6) with a compact
// Select/combobox that shows EXACTLY ONE line in the default state: the active
// element. All other elements are hidden until the dropdown opens. This keeps
// the right Inspector column short so Layout & Position / Typografie / Inhalte
// are reachable without scrolling past a long element list.
//
// The visibility (eye) toggle remains reachable as a dedicated control next to
// the combobox, acting on the currently active element. Hidden elements stay
// selectable from the dropdown so they can be re-shown via the eye toggle.

interface ElementComboboxProps {
  layoutV2: FrontendVorlageLayoutV2;
  onToggleVisible: (id: LayoutElementIdT) => void;
  onSelect: (id: LayoutElementIdT) => void;
  selectedId: LayoutElementIdT | null;
}

function ElementCombobox({
  layoutV2,
  onToggleVisible,
  onSelect,
  selectedId,
}: ElementComboboxProps) {
  // Sort by order for a stable, predictable dropdown order.
  const sorted = useMemo(
    () =>
      [...layoutV2.elements].sort((a, b) => Number(a.order) - Number(b.order)),
    [layoutV2.elements],
  );

  const selected = sorted.find((el) => el.id === selectedId) ?? null;
  const selectedLabel = selected
    ? layoutElementIdToString(selected.id)
    : "Element auswählen";

  return (
    <div className="space-y-2">
      <Label
        htmlFor="element-combobox"
        className="text-xs font-medium text-foreground uppercase tracking-wide"
      >
        Element
      </Label>
      <div className="flex items-center gap-2">
        <Select
          value={selectedId ?? ""}
          onValueChange={(v) => {
            if (v) onSelect(v as LayoutElementIdT);
          }}
        >
          <SelectTrigger
            id="element-combobox"
            data-ocid="rechnungsvorlagen.element_combobox"
            className="h-9 flex-1 text-sm"
            aria-label="Element auswählen"
          >
            <SelectValue placeholder="Element auswählen">
              {selectedLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent data-ocid="rechnungsvorlagen.element_combobox_list">
            {sorted.map((el) => {
              const label = layoutElementIdToString(el.id);
              return (
                <SelectItem
                  key={el.id}
                  value={el.id}
                  data-ocid={`rechnungsvorlagen.element_combobox_item.${el.id}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {!el.visible && (
                      <Eye
                        size={12}
                        className="shrink-0 text-muted-foreground/60"
                        aria-hidden
                      />
                    )}
                    <span className="truncate">{label}</span>
                  </span>
                  {!el.visible && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                      ausgeblendet
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Visibility toggle for the active element — remains reachable
            directly in the combobox row (requirement: eye/toggle control). */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 px-2.5"
          disabled={!selected}
          data-ocid={
            selected
              ? `rechnungsvorlagen.toggle_visible.${selected.id}`
              : "rechnungsvorlagen.toggle_visible.disabled"
          }
          aria-label={
            selected
              ? selected.visible
                ? `${layoutElementIdToString(selected.id)} ausblenden`
                : `${layoutElementIdToString(selected.id)} einblenden`
              : "Sichtbarkeit umschalten"
          }
          aria-pressed={selected ? selected.visible : false}
          onClick={() => {
            if (selected) onToggleVisible(selected.id);
          }}
        >
          {selected?.visible ? <Eye size={15} /> : <EyeOff size={15} />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-snug">
        {selected
          ? selected.visible
            ? "Aktives Element ist sichtbar. Auge blendet es aus."
            : "Aktives Element ist ausgeblendet. Auge blendet es ein."
          : "Wählen Sie ein Element aus der Liste oder auf der Leinwand."}
      </p>
    </div>
  );
}

// ─── Element properties: split into Layout & Position / Typografie ────────────

interface ElementPropertiesBaseProps {
  element: FrontendLayoutElement | null;
}

interface LayoutPositionControlsProps extends ElementPropertiesBaseProps {
  onUpdateAlignment: (
    id: LayoutElementIdT,
    alignment: Position | undefined,
  ) => void;
  onMoveOrder: (id: LayoutElementIdT, direction: "up" | "down") => void;
  /**
   * onUpdateGeometry — übernimmt manuelle mm-Eingaben (xMm, yMm, widthMm,
   * heightMm) aus den numerischen Inspector-Feldern. Dieselbe Quelle wie
   * Drag/Resize (updateElement), sodass die Felder live synchron bleiben.
   */
  onUpdateGeometry: (
    id: LayoutElementIdT,
    patch: Partial<
      Pick<FrontendLayoutElement, "xMm" | "yMm" | "widthMm" | "heightMm">
    >,
  ) => void;
}

// ─── mm-Geometrie-Felder (xMm, yMm, widthMm, heightMm) ─────────────────────────
// Beschriftete numerische Eingabefelder im Inspector-Bereich 'Layout & Position'.
// yMm wird analog zu xMm angezeigt — gleiche Platzierung, gleiche
// Aktualisierungslogik (Single Source of Truth: layoutV2-State). Drag/Resize
// aktualisieren denselben State über updateElement, sodass die Felder ohne
// Save-Verzögerung live synchron bleiben. Manuelle Eingabe verschiebt das
// Element vertikal (yMm) bzw. horizontal (xMm) auf dem Canvas und wird beim
// Speichern persistiert (normalizeLayoutV2ForSave reicht die mm-Werte durch).
//
// Konsistenz mit dem Element-Label-Overlay ('X,Y · W×H' in LayoutCanvas
// Zeilen 862-868): beide Quellen lesen denselben element.xMm/yMm/widthMm/
// heightMm-Wert aus dem layoutV2-State — sie zeigen immer denselben Wert.
//
// Touch-Editierbarkeit: die Input-Felder verwenden type="number" mit
// inputMode="decimal", sodass auf Mobile die numerische Tastatur erscheint
// (analog xMm). Die Felder sind mindestens 44px hoch (h-9 + py) für die
// Touch-Target-Anforderung.
const GEOMETRY_FIELDS: {
  key: "xMm" | "yMm" | "widthMm" | "heightMm";
  label: string;
  ocid: string;
}[] = [
  { key: "xMm", label: "X (mm)", ocid: "element_xmm" },
  { key: "yMm", label: "Y (mm)", ocid: "element_ymm" },
  { key: "widthMm", label: "Breite (mm)", ocid: "element_widthmm" },
  { key: "heightMm", label: "Höhe (mm)", ocid: "element_heightmm" },
];

function LayoutPositionControls({
  element,
  onUpdateAlignment,
  onMoveOrder,
  onUpdateGeometry,
}: LayoutPositionControlsProps) {
  if (!element) {
    return (
      <p className="text-xs text-muted-foreground">
        Kein Element ausgewählt — Ausrichtung und Reihenfolge erst nach Auswahl
        verfügbar.
      </p>
    );
  }

  const label = layoutElementIdToString(element.id);
  const currentAlignment = element.alignment ?? Position.links;

  // mm-Werte für die Eingabefelder. Fallback auf 0, wenn das Feld undefined ist
  // (z. B. bei alten Vorlagen ohne mm-Koordinaten). Die Anzeige zeigt 0, die
  // Persistierung behandelt normalizeLayoutV2ForSave (falsy → undefined).
  const geometryValues: Record<"xMm" | "yMm" | "widthMm" | "heightMm", number> =
    {
      xMm: element.xMm ?? 0,
      yMm: element.yMm ?? 0,
      widthMm: element.widthMm ?? 0,
      heightMm: element.heightMm ?? 0,
    };

  return (
    <div className="space-y-4">
      {/* Position & Grösse (mm) — beschriftete numerische Felder für xMm, yMm,
          widthMm, heightMm. yMm wird analog zu xMm angezeigt (gleiche
          Platzierung, gleiche Aktualisierungslogik). Live synchron mit
          Drag/Resize und dem Element-Label-Overlay auf der Leinwand. */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Position &amp; Grösse
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {GEOMETRY_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label
                htmlFor={`prop-${f.key}-${element.id}`}
                className="text-xs text-muted-foreground"
              >
                {f.label}
              </Label>
              <Input
                id={`prop-${f.key}-${element.id}`}
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                value={geometryValues[f.key]}
                data-ocid={`rechnungsvorlagen.${f.ocid}.${element.id}`}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const n = Number.parseFloat(e.target.value);
                  if (!Number.isFinite(n)) return;
                  // Negative Werte sind nicht erlaubt (mm-Koordinaten sind
                  // immer ≥ 0). Die Safe-Area-Klemmung beim Drag/Resize
                  // erzwingt dies ohnehin; hier wird es für manuelle Eingaben
                  // sichergestellt.
                  const clamped = Math.max(0, n);
                  onUpdateGeometry(element.id, { [f.key]: clamped });
                }}
                className="h-9 text-sm tabular-nums"
                aria-label={`${f.label} für ${label}`}
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Position (X, Y) und Grösse (Breite, Höhe) in Millimetern. Live
          synchron mit Drag &amp; Drop auf der Leinwand — beide Quellen zeigen
          denselben Wert.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Ausrichtung
        </Label>
        <ToggleGroup
          type="single"
          value={currentAlignment}
          onValueChange={(v) => {
            if (v) onUpdateAlignment(element.id, v as Position);
          }}
          variant="outline"
          className="w-full"
          data-ocid={`rechnungsvorlagen.element_alignment.${element.id}`}
          aria-label={`Ausrichtung für ${label}`}
        >
          {POSITION_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              className="flex-1 gap-1.5"
              aria-label={opt.label}
            >
              {opt.icon}
              <span className="text-xs">{opt.label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          Steuert die Textausrichtung innerhalb des Elements.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium text-foreground">
          Reihenfolge
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            data-ocid={`rechnungsvorlagen.element_order_up.${element.id}`}
            onClick={() => onMoveOrder(element.id, "up")}
          >
            <AlignLeft size={14} className="rotate-90" />
            Früher
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            data-ocid={`rechnungsvorlagen.element_order_down.${element.id}`}
            onClick={() => onMoveOrder(element.id, "down")}
          >
            <AlignLeft size={14} className="-rotate-90" />
            Später
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Bestimmt die Stapelreihenfolge (z-index) und den Dokumentfluss.
        </p>
      </div>
    </div>
  );
}

interface TypographyControlsProps extends ElementPropertiesBaseProps {
  onUpdateTypography: (
    id: LayoutElementIdT,
    patch: Partial<
      Pick<FrontendLayoutElement, "fontFamily" | "fontSize" | "bold" | "italic">
    >,
  ) => void;
}

// Typografie — Schriftart, Schriftgrösse, Fett/Kursiv pro Element (P2.12).
// Werte sind auf PDF-sichere Fonts und Standard-Punktgrössen beschränkt.
function TypographyControls({
  element,
  onUpdateTypography,
}: TypographyControlsProps) {
  if (!element) {
    return (
      <p className="text-xs text-muted-foreground">
        Kein Element ausgewählt — Typografie erst nach Auswahl verfügbar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label
            htmlFor={`prop-fontfamily-${element.id}`}
            className="text-xs text-muted-foreground"
          >
            Schriftart
          </Label>
          <Select
            value={element.fontFamily ?? ""}
            onValueChange={(v) =>
              onUpdateTypography(element.id, {
                fontFamily: v || undefined,
              })
            }
          >
            <SelectTrigger
              id={`prop-fontfamily-${element.id}`}
              data-ocid={`rechnungsvorlagen.element_fontfamily.${element.id}`}
              className="h-8 text-sm"
            >
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              {ALLOWED_FONT_FAMILIES.map((fam) => (
                <SelectItem key={fam} value={fam}>
                  {fam}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`prop-fontsize-${element.id}`}
            className="text-xs text-muted-foreground"
          >
            Schriftgrösse
          </Label>
          <Select
            value={element.fontSize ? String(Number(element.fontSize)) : ""}
            onValueChange={(v) =>
              onUpdateTypography(element.id, { fontSize: BigInt(v) })
            }
          >
            <SelectTrigger
              id={`prop-fontsize-${element.id}`}
              data-ocid={`rechnungsvorlagen.element_fontsize.${element.id}`}
              className="h-8 text-sm"
            >
              <SelectValue placeholder="Standard" />
            </SelectTrigger>
            <SelectContent>
              {ALLOWED_FONT_SIZES.map((sz) => (
                <SelectItem key={sz} value={String(sz)}>
                  {`${sz} pt`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={element.bold ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          data-ocid={`rechnungsvorlagen.element_bold.${element.id}`}
          aria-pressed={element.bold ?? false}
          onClick={() =>
            onUpdateTypography(element.id, { bold: !element.bold })
          }
        >
          <span className="font-bold">F</span>
          Fett
        </Button>
        <Button
          type="button"
          variant={element.italic ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          data-ocid={`rechnungsvorlagen.element_italic.${element.id}`}
          aria-pressed={element.italic ?? false}
          onClick={() =>
            onUpdateTypography(element.id, { italic: !element.italic })
          }
        >
          <span className="italic">I</span>
          Kursiv
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Schriftart, -grösse und Schnitt für dieses Element. Leer = Standard
        (Arial, 12 pt, regulär). Die Live-Vorschau aktualisiert sich sofort.
      </p>
    </div>
  );
}

// ─── Placeholder insert button (P2.14) ────────────────────────────────────────
// "+ Platzhalter einfügen" DropdownMenu bei relevanten Textfeldern. Auswahl
// aus dem Katalog: Rechnungsnummer, Rechnungsdatum, Leistungszeitraum, etc.

interface PlaceholderInsertProps {
  onInsert: (token: string) => void;
  ocid: string;
  disabled?: boolean;
}

function PlaceholderInsert({
  onInsert,
  ocid,
  disabled,
}: PlaceholderInsertProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-8"
          disabled={disabled}
          data-ocid={ocid}
          aria-label="Platzhalter einfügen"
        >
          <Plus size={14} />
          Platzhalter einfügen
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Platzhalter auswählen</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PLACEHOLDERS.map((ph) => (
          <DropdownMenuItem
            key={ph.token}
            data-ocid={`rechnungsvorlagen.placeholder_item.${ph.token.replace(/[{}]/g, "")}`}
            onClick={() => onInsert(ph.token)}
            className="flex items-start gap-2 py-2"
          >
            <code className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary">
              {ph.token}
            </code>
            <span className="text-xs text-muted-foreground leading-snug">
              {ph.label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Save status badge (P2.16) ────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error" | "dirty";

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  const config: Record<
    SaveStatus,
    { label: string; icon: ReactNode; cls: string }
  > = {
    idle: {
      label: "Bereit",
      icon: <Check size={14} />,
      cls: "bg-muted text-muted-foreground",
    },
    dirty: {
      label: "Ungespeicherte Änderungen",
      icon: <CircleAlert size={14} />,
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    },
    saving: {
      label: "Speichern…",
      icon: <Loader2 size={14} className="animate-spin" />,
      cls: "bg-info/10 text-info",
    },
    saved: {
      label: "Vorlage gespeichert",
      icon: <Check size={14} />,
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    error: {
      label: "Speichern fehlgeschlagen",
      icon: <CircleAlert size={14} />,
      cls: "bg-destructive/10 text-destructive",
    },
  };
  const c = config[status];
  return (
    <output
      data-ocid="rechnungsvorlagen.save_status"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </output>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export function RechnungsvorlagenPage() {
  const { data: savedVorlage, isLoading } = useRechnungsvorlage();
  // P1 FIX — fetch the real, server-authoritative kanzleiId. The backend's
  // getKanzlei() is caller-authenticated and returns the caller's own Kanzlei.
  // We use kanzlei.id as the authoritative kanzleiId for the save payload and
  // NEVER trust vorlage.kanzleiId from client state (DEFAULT_VORLAGE has
  // kanzleiId:"" which fails the backend tenant-isolation check
  // vorlage.kanzleiId != kanzleiId → #err).
  const { data: kanzlei } = useKanzlei();
  const saveMut = useSaveRechnungsvorlage();
  const uploadMut = useUploadLogo();
  const removeMut = useRemoveLogo();
  // Hydrate a previously saved logo on page load. useGetLogo returns the
  // ExternalBlob stored for the current Kanzlei (or null when none saved).
  const { data: logoBlob } = useGetLogo();
  // P1-Fix WYSIWYG: Kanzlei-Stammdaten (Einstellungen > Kanzleidaten) sind
  // die kanonische Quelle für die Absenderadresse in der Editor-Vorschau.
  // LayoutCanvas nutzt getAbsenderadresse(stammdaten) — KEIN Mustermann-
  // Fallback. Während des Ladens (undefined) übergeben wir null, sodass
  // LayoutCanvas den Platzhalter-Text zeigt.
  const { data: stammdaten } = useGetKanzleiStammdaten();

  // Local editable state — initialized from saved vorlage or DEFAULT_VORLAGE.
  const [vorlage, setVorlage] = useState<Rechnungsvorlage>(DEFAULT_VORLAGE);
  // V2 layout editor state — migrated from DEFAULT_LAYOUT_V2 on load when the
  // saved vorlage has no layoutV2 (old template). Kept as a separate state so
  // the editor can mutate it freely without touching the cached query data.
  // P1.1: cloneLayoutV2 now preserves ALL mm-Felder and Seitenränder.
  const [layoutV2, setLayoutV2] = useState<FrontendVorlageLayoutV2>(
    cloneLayoutV2(DEFAULT_LAYOUT_V2),
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] =
    useState<LayoutElementIdT | null>(null);
  // P2.11 — Zoom-Stufe für die Leinwand (nur Bildschirmdarstellung).
  const [zoom, setZoom] = useState<ZoomLevel>("fit");
  // Bearbeiten | Vorschau Umschalter — steuert die preview-Prop der Leinwand.
  // preview=false = Edit-Modus mit Handles, preview=true = realistische
  // Rechnung ohne Handles (keine separate Live-Vorschau-Spalte mehr).
  const [preview, setPreview] = useState<boolean>(false);
  // P2.16 — Speichern-Status.
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Track which text field is focused so placeholder clicks insert at cursor.
  const [activeField, setActiveField] = useState<keyof Standardtexte | null>(
    null,
  );
  const fieldRefs = useRef<
    Record<keyof Standardtexte, HTMLTextAreaElement | HTMLInputElement | null>
  >({
    rechnungstitel: null,
    einleitung: null,
    zahlungshinweis: null,
    schlusstext: null,
  });

  // ── Initialize from saved vorlage on load (with V2 migration) ──────────────
  // P1.1: ensureLayoutV2 now loads ALL mm-Koordinaten, Typografie-Felder and
  // Seitenränder correctly into state.
  useEffect(() => {
    if (savedVorlage) {
      setVorlage(savedVorlage);
      setLayoutV2(ensureLayoutV2(savedVorlage));
    } else if (!isLoading) {
      setVorlage(DEFAULT_VORLAGE);
      setLayoutV2(cloneLayoutV2(DEFAULT_LAYOUT_V2));
    }
  }, [savedVorlage, isLoading]);

  // ── Hydrate logo from backend on load ──────────────────────────────────────
  // When a logo is already saved server-side, fetch its bytes via the
  // ExternalBlob from useGetLogo and create an object URL so the editor canvas
  // and the Logo & Absender section show it immediately. We do NOT touch
  // vorlage.logoBlob here — saving other vorlage values must never lose the
  // stored logo (the backend preserves logoBlob when the client omits it).
  // A user upload (handleLogoUpload) overrides this hydrated URL.
  useEffect(() => {
    if (!logoBlob) {
      return;
    }
    let revoked = false;
    let createdUrl: string | null = null;
    (async () => {
      try {
        const bytes = await logoBlob.getBytes();
        if (revoked) return;
        const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
        createdUrl = URL.createObjectURL(blob);
        if (revoked) {
          URL.revokeObjectURL(createdUrl);
          return;
        }
        setLogoUrl(createdUrl);
      } catch {
        if (createdUrl) URL.revokeObjectURL(createdUrl);
      }
    })();
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [logoBlob]);

  // ── Layout + text update helpers ───────────────────────────────────────────
  function updateLayout(patch: Partial<VorlageLayout>) {
    setVorlage((v) => ({ ...v, layout: { ...v.layout, ...patch } }));
    setSaveStatus("dirty");
  }

  function updateText(field: keyof Standardtexte, value: string) {
    setVorlage((v) => ({
      ...v,
      standardtexte: { ...v.standardtexte, [field]: value },
    }));
    setSaveStatus("dirty");
  }

  // ── V2 layout mutation helpers ─────────────────────────────────────────────
  function updateElement(
    id: LayoutElementIdT,
    patch: Partial<FrontendLayoutElement>,
  ) {
    setLayoutV2((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, ...patch } : el,
      ),
    }));
    setSaveStatus("dirty");
  }

  // P2.9 — Seitenränder aktualisieren (persistent in layoutV2).
  function updateMargins(
    patch: Partial<
      Pick<
        FrontendVorlageLayoutV2,
        "marginTopMm" | "marginBottomMm" | "marginLeftMm" | "marginRightMm"
      >
    >,
  ) {
    setLayoutV2((prev) => ({ ...prev, ...patch }));
    setSaveStatus("dirty");
  }

  // P2.8 — Drag-Commit: mm-Koordinaten aktualisieren.
  function handleCommitDrag(
    id: LayoutElementIdT,
    patch: Partial<Pick<FrontendLayoutElement, "xMm" | "yMm">>,
  ) {
    updateElement(id, patch);
  }

  // P2.8 — Resize-Commit: mm-Koordinaten aktualisieren.
  function handleCommitResize(
    id: LayoutElementIdT,
    patch: Partial<
      Pick<FrontendLayoutElement, "xMm" | "yMm" | "widthMm" | "heightMm">
    >,
  ) {
    updateElement(id, patch);
  }

  function handleToggleVisible(id: LayoutElementIdT) {
    setLayoutV2((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        el.id === id ? { ...el, visible: !el.visible } : el,
      ),
    }));
    setSaveStatus("dirty");
  }

  function handleUpdateAlignment(
    id: LayoutElementIdT,
    alignment: Position | undefined,
  ) {
    updateElement(id, { alignment });
  }

  function handleUpdateTypography(
    id: LayoutElementIdT,
    patch: Partial<
      Pick<FrontendLayoutElement, "fontFamily" | "fontSize" | "bold" | "italic">
    >,
  ) {
    updateElement(id, patch);
  }

  // yMm-Anzeige — manuelle mm-Eingaben aus dem Inspector-Bereich 'Layout &
  // Position'. Dieselbe Quelle wie Drag/Resize (updateElement), sodass die
  // Felder live synchron bleiben. Manuelle yMm-Eingabe verschiebt das Element
  // vertikal auf dem Canvas und wird beim Speichern persistiert.
  function handleUpdateGeometry(
    id: LayoutElementIdT,
    patch: Partial<
      Pick<FrontendLayoutElement, "xMm" | "yMm" | "widthMm" | "heightMm">
    >,
  ) {
    updateElement(id, patch);
  }

  function handleMoveOrder(id: LayoutElementIdT, direction: "up" | "down") {
    setLayoutV2((prev) => {
      const sorted = [...prev.elements].sort(
        (a, b) => Number(a.order) - Number(b.order),
      );
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swapIdx];
      const aOrder = a.order;
      const bOrder = b.order;
      return {
        ...prev,
        elements: prev.elements.map((el) => {
          if (el.id === a.id) return { ...el, order: bOrder };
          if (el.id === b.id) return { ...el, order: aOrder };
          return el;
        }),
      };
    });
    setSaveStatus("dirty");
  }

  // ── Save handler (P1 FIX — kanzleiId + layoutV2 normalization) ──────────
  // P1 ROOT-CAUSE FIX: The previous handleSave sent `vorlage.kanzleiId` which
  // was "" (from DEFAULT_VORLAGE) when no vorlage was saved yet. The backend
  // tenant-isolation check (vorlage.kanzleiId != kanzleiId) rejected it with
  // #err "Vorlage gehört zu einer anderen Kanzlei" — visible as
  // "Speichern fehlgeschlagen" but with no console error (handled #err, not a
  // thrown exception). Now we always set toSave.kanzleiId to the server-
  // authoritative kanzleiId from useKanzlei(), so the tenant check passes.
  //
  // P1 FIX (encoder): normalizeLayoutV2ForSave converts falsy optional
  // values (0/false/0n) to undefined so the auto-generated truthy encoder
  // in backend.ts (to_candid_record_n198) encodes them as candid_none()
  // instead of silently dropping them. See normalizeLayoutV2ForSave docs.
  //
  // P1 FIX (error visibility): console.error in both #err and onError
  // branches so save failures are diagnosable in the browser console without
  // exposing sensitive data (only the German error message is logged).
  // P2.16: Status-Meldungen 'Vorlage gespeichert' / 'Speichern fehlgeschlagen'.
  function handleSave() {
    // Tenant-safe: use the server-authoritative kanzleiId, never the client
    // state's vorlage.kanzleiId (which may be "" from DEFAULT_VORLAGE).
    const authoritativeKanzleiId = kanzlei?.id ?? vorlage.kanzleiId ?? "";
    if (!authoritativeKanzleiId) {
      const msg =
        "Kanzlei konnte nicht geladen werden — Speichern nicht möglich. Bitte Seite neu laden.";
      setSaveStatus("error");
      console.error("[RechnungsvorlagenPage] Save aborted: kanzleiId missing");
      toast.error(msg);
      return;
    }
    const toSave: Rechnungsvorlage = {
      ...vorlage,
      kanzleiId: authoritativeKanzleiId,
      layoutV2: normalizeLayoutV2ForSave(layoutV2) as VorlageLayoutV2,
    };
    setSaveStatus("saving");
    saveMut.mutate(toSave, {
      onSuccess: (res) => {
        if (
          res &&
          typeof res === "object" &&
          "__kind__" in res &&
          res.__kind__ === "err"
        ) {
          const errMsg =
            (res as { err: string }).err || "Speichern fehlgeschlagen";
          setSaveStatus("error");
          // Log to console for diagnosability without exposing sensitive data.
          console.error(
            "[RechnungsvorlagenPage] saveRechnungsvorlage returned #err:",
            errMsg,
          );
          toast.error(errMsg);
        } else {
          setSaveStatus("saved");
          toast.success("Vorlage gespeichert");
        }
      },
      onError: (e: Error) => {
        const errMsg = e.message || "Speichern fehlgeschlagen";
        setSaveStatus("error");
        console.error(
          "[RechnungsvorlagenPage] saveRechnungsvorlage threw:",
          errMsg,
        );
        toast.error(errMsg);
      },
    });
  }

  // ── Logo upload ────────────────────────────────────────────────────────────
  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Bitte eine Bilddatei auswählen (PNG, JPG, SVG).");
      toast.error("Ungültiger Dateityp");
      return;
    }

    // Show local preview immediately for live feedback
    const localUrl = URL.createObjectURL(file);
    setLogoUrl(localUrl);
    setLogoFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await uploadMut.mutateAsync(bytes);
      toast.success("Logo hochgeladen");
      setSaveStatus("dirty");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload fehlgeschlagen",
      );
      setLogoUrl(null);
      setLogoFileName(null);
      toast.error("Logo-Upload fehlgeschlagen");
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function handleRemoveLogo() {
    removeMut.mutate(undefined, {
      onSuccess: (res) => {
        if (
          res &&
          typeof res === "object" &&
          "__kind__" in res &&
          res.__kind__ === "err"
        ) {
          toast.error(
            (res as { err: string }).err || "Entfernen fehlgeschlagen",
          );
        } else {
          setLogoUrl(null);
          setLogoFileName(null);
          setVorlage((v) => ({ ...v, logoBlob: undefined }));
          setSaveStatus("dirty");
          toast.success("Logo entfernt");
        }
      },
      onError: (e: Error) =>
        toast.error(e.message || "Entfernen fehlgeschlagen"),
    });
  }

  // ── Placeholder insertion (P2.14) ──────────────────────────────────────────
  function insertPlaceholder(token: string) {
    if (!activeField) {
      // Fallback: append to einleitung if no field is focused
      updateText("einleitung", `${vorlage.standardtexte.einleitung} ${token}`);
      toast.info(`Platzhalter ${token} zur Einleitung hinzugefügt`);
      return;
    }

    const el = fieldRefs.current[activeField];
    if (
      el &&
      (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
    ) {
      const start =
        el.selectionStart ?? vorlage.standardtexte[activeField].length;
      const end = el.selectionEnd ?? start;
      const current = vorlage.standardtexte[activeField];
      const next = current.slice(0, start) + token + current.slice(end);
      updateText(activeField, next);
      // Restore cursor after the inserted token
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      updateText(activeField, `${vorlage.standardtexte[activeField]} ${token}`);
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        data-ocid="rechnungsvorlagen.loading_state"
        className="p-6 space-y-6 max-w-7xl mx-auto"
      >
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <Skeleton className="h-[600px] w-full" />
        </div>
      </div>
    );
  }

  // hasLogo reflects whether a logo is actually available to display: either a
  // freshly uploaded one (logoUrl) or one already saved server-side (logoBlob
  // from useGetLogo). It must NOT be based on vorlage.logoBlob, because that
  // field is only populated on the very first save that uploads a logo and is
  // otherwise empty — basing hasLogo on it would wrongly show "Kein Logo" for
  // any template that has a stored logo but was saved without re-sending it.
  const hasLogo = !!logoBlob || !!logoUrl;
  const isSaving = saveMut.isPending;
  const isUploading = uploadMut.isPending;
  const isRemoving = removeMut.isPending;
  const selectedElement =
    layoutV2.elements.find((el) => el.id === selectedElementId) ?? null;

  return (
    <div
      data-ocid="rechnungsvorlagen.page"
      className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Sticky page header with title + save button + status (P2.4/P2.16) ── */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-7xl mx-auto">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-foreground text-xl tracking-tight">
              Rechnungsvorlage
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gestalten Sie das Layout Ihrer Rechnungen — Elemente per Drag
              &amp; Drop anordnen, Logo und Texte pflegen. Pro Kanzlei existiert
              genau eine Vorlage.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <SaveStatusBadge status={saveStatus} />
            <Button
              data-ocid="rechnungsvorlagen.save_button"
              className="btn-primary gap-2"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Vorlage speichern
            </Button>
          </div>
        </div>
      </div>

      {/* ── Bearbeiten | Vorschau Umschalter (über der Leinwand) ──────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ToggleGroup
          type="single"
          value={preview ? "vorschau" : "bearbeiten"}
          onValueChange={(v) => setPreview(v === "vorschau")}
          variant="outline"
          className="w-auto"
          data-ocid="rechnungsvorlagen.mode_toggle"
          aria-label="Bearbeiten oder Vorschau"
        >
          <ToggleGroupItem
            value="bearbeiten"
            className="gap-1.5"
            aria-label="Bearbeiten"
          >
            <AlignLeft size={14} />
            <span className="text-xs">Bearbeiten</span>
          </ToggleGroupItem>
          <ToggleGroupItem
            value="vorschau"
            className="gap-1.5"
            aria-label="Vorschau"
          >
            <Eye size={14} />
            <span className="text-xs">Vorschau</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">
          {preview
            ? "Vorschau — realistische Rechnung ohne Bearbeitungs-Handles."
            : "Bearbeiten — Elemente per Drag & Drop verschieben und in der Grösse ändern."}
        </p>
      </div>

      {/* ── 2-Spalten Layout: A4-Dokument | Inspector ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* ── Links: grosse A4-Dokumentflaeche (LayoutCanvas + ZoomControl) ────── */}
        <div className="space-y-6">
          <SectionCard
            ocid="rechnungsvorlagen.canvas_section"
            title="A4-Leinwand"
            description={
              preview
                ? "Realistische Rechnungsvorschau — keine Bearbeitungs-Handles."
                : "Elemente per Drag & Drop verschieben und in der Grösse ändern. mm-genau."
            }
            icon={<AlignLeft size={16} />}
            action={<ZoomControl zoom={zoom} onChange={setZoom} />}
          >
            <LayoutCanvas
              layoutV2={layoutV2}
              selectedId={selectedElementId}
              onSelect={setSelectedElementId}
              onCommitDrag={handleCommitDrag}
              onCommitResize={handleCommitResize}
              vorlage={vorlage}
              logoUrl={logoUrl}
              zoom={zoom}
              preview={preview}
              stammdaten={stammdaten ?? null}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {preview
                ? "Die Vorschau zeigt das zu erwartende PDF-/Word-Layout gemäss der aktuellen V2-Konfiguration. Wechseln Sie zu „Bearbeiten“, um Elemente zu verschieben."
                : "Tipp: Greifen Sie den Griff oben links, um ein Element zu verschieben. Tippen Sie auf ein Element, um es auszuwählen — dann erscheinen 8 Anfasser an den Rändern zum Ändern der Grösse. Der gestrichelte Rahmen markiert den Druckbereich (Safe Area)."}
            </p>
          </SectionCard>
        </div>

        {/* ── Rechts: Inspector (kompakt gruppiert) ──────────────────────────────── */}
        <div className="space-y-4 xl:sticky xl:top-24">
          {/* Element-Auswahl — kompakte Combobox (1 Zeile im Standardzustand).
              Ersetzt die frühere permanente ElementPalette-Liste, damit die
              rechte Spalte deutlich kürzer wird und Layout/Typografie/Inhalte
              ohne Scrollen erreichbar sind. Sichtbarkeit (Auge) bleibt als
              direktes Control neben der Combobox erreichbar. */}
          <SectionCard
            ocid="rechnungsvorlagen.elements_section"
            title="Element"
            description="Aktives Element auswählen — Sichtbarkeit über das Auge."
            icon={<Plus size={16} />}
          >
            <ElementCombobox
              layoutV2={layoutV2}
              onToggleVisible={handleToggleVisible}
              onSelect={setSelectedElementId}
              selectedId={selectedElementId}
            />
          </SectionCard>

          {/* Kontextabhängige Eigenschaften — nur bei ausgewähltem Element.
              Reihenfolge: Layout & Position (default offen), Typografie,
              Inhalte (Logo, Rechnungstexte, Platzhalter). Seitenränder sind
              separat weiter unten, da sie nicht vom Element abhängen. */}
          {selectedElement ? (
            <Accordion
              type="multiple"
              defaultValue={["inspector-layout"]}
              className="space-y-3"
              data-ocid="rechnungsvorlagen.inspector_properties"
            >
              {/* Layout & Position — default offen, da häufigste Bearbeitung */}
              <AccordionItem
                value="inspector-layout"
                data-ocid="rechnungsvorlagen.layout_position_section"
                className="rounded-lg border border-border bg-card px-0"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <AlignRight size={15} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-display font-semibold text-foreground text-sm leading-tight">
                        Layout &amp; Position
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        Ausrichtung und Reihenfolge.
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1">
                  <LayoutPositionControls
                    element={selectedElement}
                    onUpdateAlignment={handleUpdateAlignment}
                    onMoveOrder={handleMoveOrder}
                    onUpdateGeometry={handleUpdateGeometry}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Typografie — default eingeklappt (max. 1 Klick erreichbar) */}
              <AccordionItem
                value="inspector-typography"
                data-ocid="rechnungsvorlagen.typography_section"
                className="rounded-lg border border-border bg-card px-0"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileText size={15} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-display font-semibold text-foreground text-sm leading-tight">
                        Typografie
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        Schriftart, Schriftgrösse und Stil.
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1">
                  <TypographyControls
                    element={selectedElement}
                    onUpdateTypography={handleUpdateTypography}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Inhalte — Logo & Absender, Rechnungstexte, Platzhalter.
                  Default eingeklappt, da diese selten gleichzeitig bearbeitet
                  werden. Nur kontextbezogen sichtbar (nur bei ausgewähltem
                  Element). */}
              <AccordionItem
                value="inspector-content"
                data-ocid="rechnungsvorlagen.content_section"
                className="rounded-lg border border-border bg-card px-0"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <ImageIcon size={15} />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-display font-semibold text-foreground text-sm leading-tight">
                        Inhalte
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        Logo &amp; Absender, Rechnungstexte, Platzhalter.
                      </p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-1">
                  <div className="space-y-4">
                    {/* Logo & Absender — kompakt mit Mini-Vorschau + Aktion */}
                    <div
                      data-ocid="rechnungsvorlagen.logo_section"
                      className="rounded-md border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-center gap-3">
                        {hasLogo && logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo-Vorschau"
                            data-ocid="rechnungsvorlagen.logo_preview"
                            className="h-10 w-10 shrink-0 object-contain rounded border border-border bg-white"
                          />
                        ) : hasLogo ? (
                          <div
                            data-ocid="rechnungsvorlagen.logo_preview"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-white"
                          >
                            <ImageIcon
                              size={16}
                              className="text-muted-foreground"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-border bg-card">
                            <ImageIcon
                              size={16}
                              className="text-muted-foreground"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {hasLogo
                              ? (logoFileName ?? "Gespeichertes Logo")
                              : "Kein Logo"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hasLogo
                              ? "Gemäss Layout-Position platziert."
                              : "PNG, JPG, SVG — max. 180×60 px."}
                          </p>
                        </div>
                      </div>

                      {/* Upload feedback (kompakt) */}
                      {isUploading && (
                        <div
                          data-ocid="rechnungsvorlagen.upload_progress"
                          className="mt-2 flex items-center gap-2 rounded bg-info/10 px-2.5 py-1.5 text-xs text-info"
                        >
                          <Loader2 size={12} className="animate-spin" />
                          Logo wird hochgeladen…
                        </div>
                      )}
                      {uploadError && (
                        <div
                          data-ocid="rechnungsvorlagen.upload_error"
                          className="mt-2 rounded bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                          role="alert"
                        >
                          {uploadError}
                        </div>
                      )}

                      {/* Aktionen — kompakt */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <label
                          htmlFor="logo-upload-input"
                          className="inline-flex"
                        >
                          <input
                            id="logo-upload-input"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={isUploading}
                            className="sr-only"
                            data-ocid="rechnungsvorlagen.logo_file_input"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 cursor-pointer"
                            disabled={isUploading}
                            data-ocid="rechnungsvorlagen.upload_logo_button"
                            onClick={() =>
                              document
                                .getElementById("logo-upload-input")
                                ?.click()
                            }
                          >
                            {isUploading ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Upload size={13} />
                            )}
                            {hasLogo ? "Logo ändern" : "Logo hochladen"}
                          </Button>
                        </label>

                        {hasLogo && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleRemoveLogo}
                            disabled={isRemoving}
                            data-ocid="rechnungsvorlagen.remove_logo_button"
                          >
                            {isRemoving ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            Entfernen
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Rechnungstexte — kompakte Liste mit Titel + Vorschau +
                        Bearbeiten-Button. Textareas öffnen sich pro Text
                        inline (Collapsible), nicht alle dauerhaft offen. */}
                    <div
                      data-ocid="rechnungsvorlagen.standardtexte_section"
                      className="rounded-md border border-border bg-muted/20 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground uppercase tracking-wide">
                          Rechnungstexte
                        </p>
                        <PlaceholderInsert
                          onInsert={insertPlaceholder}
                          ocid="rechnungsvorlagen.placeholder_insert_global"
                        />
                      </div>

                      <div className="space-y-2">
                        {/* Rechnungstitel */}
                        <Collapsible
                          data-ocid="rechnungsvorlagen.text_rechnungstitel_row"
                          className="rounded border border-border bg-card"
                        >
                          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                aria-label="Rechnungstitel bearbeiten"
                              >
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    Rechnungstitel
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {vorlage.standardtexte.rechnungstitel
                                      ? vorlage.standardtexte.rechnungstitel.slice(
                                          0,
                                          40,
                                        )
                                      : "— leer —"}
                                  </p>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <Pencil
                              size={13}
                              className="shrink-0 text-muted-foreground"
                            />
                          </div>
                          <CollapsibleContent>
                            <div className="space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border">
                              <div className="flex items-center justify-between gap-2 pt-2">
                                <Label
                                  htmlFor="text-rechnungstitel"
                                  className="text-xs font-medium text-foreground"
                                >
                                  Rechnungstitel
                                </Label>
                                <PlaceholderInsert
                                  onInsert={insertPlaceholder}
                                  ocid="rechnungsvorlagen.placeholder_insert_rechnungstitel"
                                />
                              </div>
                              <Input
                                id="text-rechnungstitel"
                                ref={(el) => {
                                  fieldRefs.current.rechnungstitel = el;
                                }}
                                data-ocid="rechnungsvorlagen.rechnungstitel_input"
                                placeholder="z. B. Rechnung {{rechnungsnummer}}"
                                value={vorlage.standardtexte.rechnungstitel}
                                onChange={(e) =>
                                  updateText("rechnungstitel", e.target.value)
                                }
                                onFocus={() => setActiveField("rechnungstitel")}
                                onBlur={() => setActiveField(null)}
                                className="text-sm"
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Einleitung */}
                        <Collapsible
                          data-ocid="rechnungsvorlagen.text_einleitung_row"
                          className="rounded border border-border bg-card"
                        >
                          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                aria-label="Einleitung bearbeiten"
                              >
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    Einleitung
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {vorlage.standardtexte.einleitung
                                      ? vorlage.standardtexte.einleitung.slice(
                                          0,
                                          40,
                                        )
                                      : "— leer —"}
                                  </p>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <Pencil
                              size={13}
                              className="shrink-0 text-muted-foreground"
                            />
                          </div>
                          <CollapsibleContent>
                            <div className="space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border">
                              <div className="flex items-center justify-between gap-2 pt-2">
                                <Label
                                  htmlFor="text-einleitung"
                                  className="text-xs font-medium text-foreground"
                                >
                                  Einleitung
                                </Label>
                                <PlaceholderInsert
                                  onInsert={insertPlaceholder}
                                  ocid="rechnungsvorlagen.placeholder_insert_einleitung"
                                />
                              </div>
                              <Textarea
                                id="text-einleitung"
                                ref={(el) => {
                                  fieldRefs.current.einleitung = el;
                                }}
                                data-ocid="rechnungsvorlagen.einleitung_input"
                                placeholder="z. B. Wir danken Ihnen für Ihren Auftrag zum Mandat {{mandat_bezeichnung}}…"
                                value={vorlage.standardtexte.einleitung}
                                onChange={(e) =>
                                  updateText("einleitung", e.target.value)
                                }
                                onFocus={() => setActiveField("einleitung")}
                                onBlur={() => setActiveField(null)}
                                className="min-h-20 text-sm"
                                rows={3}
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Zahlungsinformationen */}
                        <Collapsible
                          data-ocid="rechnungsvorlagen.text_zahlungshinweis_row"
                          className="rounded border border-border bg-card"
                        >
                          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                aria-label="Zahlungsinformationen bearbeiten"
                              >
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    Zahlungsinformationen
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {vorlage.standardtexte.zahlungshinweis
                                      ? vorlage.standardtexte.zahlungshinweis.slice(
                                          0,
                                          40,
                                        )
                                      : "— leer —"}
                                  </p>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <Pencil
                              size={13}
                              className="shrink-0 text-muted-foreground"
                            />
                          </div>
                          <CollapsibleContent>
                            <div className="space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border">
                              <div className="flex items-center justify-between gap-2 pt-2">
                                <Label
                                  htmlFor="text-zahlungshinweis"
                                  className="text-xs font-medium text-foreground"
                                >
                                  Zahlungsinformationen
                                </Label>
                                <PlaceholderInsert
                                  onInsert={insertPlaceholder}
                                  ocid="rechnungsvorlagen.placeholder_insert_zahlungshinweis"
                                />
                              </div>
                              <Textarea
                                id="text-zahlungshinweis"
                                ref={(el) => {
                                  fieldRefs.current.zahlungshinweis = el;
                                }}
                                data-ocid="rechnungsvorlagen.zahlungshinweis_input"
                                placeholder="z. B. {{zahlungsbedingungen}} auf das unten angegebene Konto."
                                value={vorlage.standardtexte.zahlungshinweis}
                                onChange={(e) =>
                                  updateText("zahlungshinweis", e.target.value)
                                }
                                onFocus={() =>
                                  setActiveField("zahlungshinweis")
                                }
                                onBlur={() => setActiveField(null)}
                                className="min-h-20 text-sm"
                                rows={3}
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Schlusstext */}
                        <Collapsible
                          data-ocid="rechnungsvorlagen.text_schlusstext_row"
                          className="rounded border border-border bg-card"
                        >
                          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                aria-label="Schlusstext bearbeiten"
                              >
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    Schlusstext
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {vorlage.standardtexte.schlusstext
                                      ? vorlage.standardtexte.schlusstext.slice(
                                          0,
                                          40,
                                        )
                                      : "— leer —"}
                                  </p>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <Pencil
                              size={13}
                              className="shrink-0 text-muted-foreground"
                            />
                          </div>
                          <CollapsibleContent>
                            <div className="space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border">
                              <div className="flex items-center justify-between gap-2 pt-2">
                                <Label
                                  htmlFor="text-schlusstext"
                                  className="text-xs font-medium text-foreground"
                                >
                                  Schlusstext
                                </Label>
                                <PlaceholderInsert
                                  onInsert={insertPlaceholder}
                                  ocid="rechnungsvorlagen.placeholder_insert_schlusstext"
                                />
                              </div>
                              <Textarea
                                id="text-schlusstext"
                                ref={(el) => {
                                  fieldRefs.current.schlusstext = el;
                                }}
                                data-ocid="rechnungsvorlagen.schlusstext_input"
                                placeholder="z. B. Für Rückfragen stehen wir Ihnen gerne zur Verfügung. Mit freundlichen Grüssen, {{leistungserbringer}}"
                                value={vorlage.standardtexte.schlusstext}
                                onChange={(e) =>
                                  updateText("schlusstext", e.target.value)
                                }
                                onFocus={() => setActiveField("schlusstext")}
                                onBlur={() => setActiveField(null)}
                                className="min-h-20 text-sm"
                                rows={3}
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        {/* Fusszeile */}
                        <Collapsible
                          data-ocid="rechnungsvorlagen.text_fusszeile_row"
                          className="rounded border border-border bg-card"
                        >
                          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                                aria-label="Fusszeile bearbeiten"
                              >
                                <ChevronRight
                                  size={14}
                                  className="shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    Fusszeile
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {vorlage.layout.fusszeile
                                      ? vorlage.layout.fusszeile.slice(0, 40)
                                      : "— leer —"}
                                  </p>
                                </div>
                              </button>
                            </CollapsibleTrigger>
                            <Pencil
                              size={13}
                              className="shrink-0 text-muted-foreground"
                            />
                          </div>
                          <CollapsibleContent>
                            <div className="space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border">
                              <Label
                                htmlFor="fusszeile"
                                className="pt-2 text-xs font-medium text-foreground"
                              >
                                Fusszeile
                              </Label>
                              <Textarea
                                id="fusszeile"
                                data-ocid="rechnungsvorlagen.fusszeile_input"
                                placeholder="z. B. Kanzlei Mustermann · IBAN CH00 0000 0000 0000 0000 0 · UID CHE-000.000.000"
                                value={vorlage.layout.fusszeile}
                                onChange={(e) =>
                                  updateLayout({ fusszeile: e.target.value })
                                }
                                className="min-h-20 text-sm"
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                Wird unten auf jeder Rechnungsseite angezeigt.
                              </p>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>

                    {/* Platzhalter — kompakter Button statt langer Liste.
                        Verwendet die vorhandene PlaceholderInsert-Komponente
                        (DropdownMenu), die bei Bedarf alle Tokens zeigt. */}
                    <div
                      data-ocid="rechnungsvorlagen.placeholders_section"
                      className="rounded-md border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            Platzhalter
                          </p>
                          <p className="text-xs text-muted-foreground leading-snug">
                            Tokens für Rechnungstexte — beim Export ersetzt.
                          </p>
                        </div>
                        <PlaceholderInsert
                          onInsert={insertPlaceholder}
                          ocid="rechnungsvorlagen.placeholder_insert_button"
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : (
            /* Hinweis wenn kein Element ausgewählt ist — kompakt. Seitenränder
               bleiben darunter trotzdem verfügbar (nicht vom Element abhängig). */
            <div
              data-ocid="rechnungsvorlagen.no_selection_hint"
              className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center"
            >
              <p className="text-sm text-muted-foreground">
                Wählen Sie ein Element in der Combobox oder auf der Leinwand, um
                Layout, Typografie und Inhalte zu bearbeiten.
              </p>
            </div>
          )}

          {/* Seitenränder — kompakter separater Bereich, NICHT abhängig von der
              Elementauswahl. Immer verfügbar, da die Ränder das ganze A4-Blatt
              betreffen. Default eingeklappt. */}
          <Accordion
            type="multiple"
            className="space-y-3"
            data-ocid="rechnungsvorlagen.inspector_page"
          >
            <AccordionItem
              value="inspector-margins"
              data-ocid="rechnungsvorlagen.margins_section"
              className="rounded-lg border border-border bg-card px-0"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <AlignRight size={15} />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-display font-semibold text-foreground text-sm leading-tight">
                      Seitenränder
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      A4-Seitenränder in mm (Standard 20 mm, 5–40 mm).
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-1">
                <MarginsControl layoutV2={layoutV2} onChange={updateMargins} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
