import { c as createLucideIcon, r as reactExports, A as A4_PAGE_WIDTH_MM, a as A4_PAGE_HEIGHT_MM, j as jsxRuntimeExports, m as mmToPx, l as layoutElementIdToString, P as Position, p as pxToMm, f as fontStack, L as LayoutElementId, S as SCHLUSSTEXT_ELEMENT_ID, g as getRechnungsmetadaten, b as getAbsenderadresse, d as computePxPerMm, e as formatCHFRounded, u as useControllableState, h as Primitive, i as useId, k as composeEventHandlers, n as Presence, o as useComposedRefs, q as useLayoutEffect2, s as createContextScope, R as React, t as createCollection, v as useDirection, w as cn, C as ChevronDown, x as useCallbackRef, y as Root2$3, z as Anchor, B as Portal$1, D as createPopperScope, E as createRovingFocusGroupScope, F as hideOthers, I as Item$1, G as dispatchDiscreteCustomEvent, H as useFocusGuards, J as ReactRemoveScroll, K as FocusScope, M as DismissableLayer, N as Root$1, O as Content$1, Q as createSlot, T as Arrow, U as composeRefs, V as cva, W as useRechnungsvorlage, X as useKanzlei, Y as useSaveRechnungsvorlage, Z as useUploadLogo, _ as useRemoveLogo, $ as useGetLogo, a0 as useGetKanzleiStammdaten, a1 as DEFAULT_VORLAGE, a2 as Skeleton, a3 as Button, a4 as LoaderCircle, a5 as Plus, a6 as FileText, a7 as Trash2, a8 as ChevronRight, a9 as Pencil, aa as Label$1, ab as Input, ac as Textarea, ad as DEFAULT_LAYOUT_V2, ae as ue, af as Card, ag as CardContent, ah as Select, ai as SelectTrigger, aj as SelectValue, ak as SelectContent, al as SelectItem, am as ALLOWED_FONT_FAMILIES, an as ALLOWED_FONT_SIZES, ao as CircleAlert, ap as Check } from "./index-DHJUCbX-.js";
import { S as Save, I as Image, U as Upload } from "./upload-EMtQ2-Aw.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$5 = [
  ["path", { d: "M17 12H7", key: "16if0g" }],
  ["path", { d: "M19 18H5", key: "18s9l3" }],
  ["path", { d: "M21 6H3", key: "1jwq7v" }]
];
const AlignCenter = createLucideIcon("align-center", __iconNode$5);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$4 = [
  ["path", { d: "M15 12H3", key: "6jk70r" }],
  ["path", { d: "M17 18H3", key: "1amg6g" }],
  ["path", { d: "M21 6H3", key: "1jwq7v" }]
];
const AlignLeft = createLucideIcon("align-left", __iconNode$4);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$3 = [
  ["path", { d: "M21 12H9", key: "dn1m92" }],
  ["path", { d: "M21 18H7", key: "1ygte8" }],
  ["path", { d: "M21 6H3", key: "1jwq7v" }]
];
const AlignRight = createLucideIcon("align-right", __iconNode$3);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$2 = [
  [
    "path",
    {
      d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49",
      key: "ct8e1f"
    }
  ],
  ["path", { d: "M14.084 14.158a3 3 0 0 1-4.242-4.242", key: "151rxh" }],
  [
    "path",
    {
      d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143",
      key: "13bj9a"
    }
  ],
  ["path", { d: "m2 2 20 20", key: "1ooewy" }]
];
const EyeOff = createLucideIcon("eye-off", __iconNode$2);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode$1 = [
  [
    "path",
    {
      d: "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0",
      key: "1nclc0"
    }
  ],
  ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]
];
const Eye = createLucideIcon("eye", __iconNode$1);
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  ["circle", { cx: "9", cy: "12", r: "1", key: "1vctgf" }],
  ["circle", { cx: "9", cy: "5", r: "1", key: "hp0tcf" }],
  ["circle", { cx: "9", cy: "19", r: "1", key: "fkjjf6" }],
  ["circle", { cx: "15", cy: "12", r: "1", key: "1tmaij" }],
  ["circle", { cx: "15", cy: "5", r: "1", key: "19l28e" }],
  ["circle", { cx: "15", cy: "19", r: "1", key: "f4zoj3" }]
];
const GripVertical = createLucideIcon("grip-vertical", __iconNode);
function snapToCellIndex(pixelOffset, cellSize, maxIndex) {
  if (cellSize <= 0) return 0;
  const idx = Math.round(pixelOffset / cellSize);
  return Math.max(0, Math.min(idx, maxIndex));
}
function clampToRange(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
const MIN_ROW_SPAN = 1;
const MIN_COL_SPAN = 1;
function computeResizedArea(state, grid) {
  const cellWidth = grid.cols > 0 ? grid.containerWidth / grid.cols : 0;
  const cellHeight = grid.rows > 0 ? grid.containerHeight / grid.rows : 0;
  if (cellWidth <= 0 || cellHeight <= 0) return null;
  const dx = state.currentX - state.startX;
  const dy = state.currentY - state.startY;
  const dxCells = Math.round(dx / cellWidth);
  const dyCells = Math.round(dy / cellHeight);
  const oRow = Number(state.origin.row);
  const oCol = Number(state.origin.col);
  const oRowSpan = Number(state.origin.rowSpan);
  const oColSpan = Number(state.origin.colSpan);
  let newRow = oRow;
  let newCol = oCol;
  let newRowSpan = oRowSpan;
  let newColSpan = oColSpan;
  const handle = state.handle;
  if (handle.includes("e")) {
    newColSpan = clampToRange(
      oColSpan + dxCells,
      MIN_COL_SPAN,
      grid.cols - oCol
    );
  }
  if (handle.includes("w")) {
    const maxColShift = oColSpan - MIN_COL_SPAN;
    const proposedCol = clampToRange(oCol + dxCells, 0, oCol + maxColShift);
    const colDelta = proposedCol - oCol;
    newCol = proposedCol;
    newColSpan = clampToRange(
      oColSpan - colDelta,
      MIN_COL_SPAN,
      grid.cols - newCol
    );
  }
  if (handle.includes("s")) {
    newRowSpan = clampToRange(
      oRowSpan + dyCells,
      MIN_ROW_SPAN,
      grid.rows - oRow
    );
  }
  if (handle.includes("n")) {
    const maxRowShift = oRowSpan - MIN_ROW_SPAN;
    const proposedRow = clampToRange(oRow + dyCells, 0, oRow + maxRowShift);
    const rowDelta = proposedRow - oRow;
    newRow = proposedRow;
    newRowSpan = clampToRange(
      oRowSpan - rowDelta,
      MIN_ROW_SPAN,
      grid.rows - newRow
    );
  }
  return {
    row: BigInt(newRow),
    col: BigInt(newCol),
    rowSpan: BigInt(newRowSpan),
    colSpan: BigInt(newColSpan)
  };
}
function computeResizedAreaImpl(state, grid) {
  return computeResizedArea(state, grid);
}
function useDragDrop(grid, getCanvasRect) {
  const [dragState, setDragState] = reactExports.useState(null);
  const [resizeState, setResizeState] = reactExports.useState(null);
  const dragRef = reactExports.useRef(null);
  const resizeRef = reactExports.useRef(null);
  const cellWidth = grid.cols > 0 ? grid.containerWidth / grid.cols : 0;
  const cellHeight = grid.rows > 0 ? grid.containerHeight / grid.rows : 0;
  const computeSnappedArea = reactExports.useCallback(
    (state) => {
      if (cellWidth <= 0 || cellHeight <= 0) return null;
      const dx = state.currentX - state.startX;
      const dy = state.currentY - state.startY;
      const originColPx = Number(state.origin.col) * cellWidth;
      const originRowPx = Number(state.origin.row) * cellHeight;
      const newCol = snapToCellIndex(
        originColPx + dx,
        cellWidth,
        Math.max(0, grid.cols - Number(state.origin.colSpan))
      );
      const newRow = snapToCellIndex(
        originRowPx + dy,
        cellHeight,
        Math.max(0, grid.rows - Number(state.origin.rowSpan))
      );
      return {
        row: BigInt(newRow),
        col: BigInt(newCol),
        rowSpan: state.origin.rowSpan,
        colSpan: state.origin.colSpan
      };
    },
    [cellWidth, cellHeight, grid.cols, grid.rows]
  );
  const computeResizedArea2 = reactExports.useCallback(
    (state) => computeResizedAreaImpl(state, grid),
    [grid]
  );
  const onPointerDown = reactExports.useCallback(
    (elementId, origin, event) => {
      var _a;
      if (event.button !== void 0 && event.button !== 0) return;
      const rect = getCanvasRect ? getCanvasRect() : (_a = event.currentTarget.parentElement) == null ? void 0 : _a.getBoundingClientRect();
      if (!rect) return;
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      const next = {
        elementId,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        origin
      };
      dragRef.current = next;
      setDragState(next);
      resizeRef.current = null;
      setResizeState(null);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
      }
    },
    [getCanvasRect]
  );
  const onResizeStart = reactExports.useCallback(
    (elementId, handle, origin, event) => {
      var _a, _b;
      if (event.button !== void 0 && event.button !== 0) return;
      event.stopPropagation();
      const rect = getCanvasRect ? getCanvasRect() : (_b = (_a = event.currentTarget.parentElement) == null ? void 0 : _a.parentElement) == null ? void 0 : _b.getBoundingClientRect();
      if (!rect) return;
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      const next = {
        elementId,
        handle,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        origin
      };
      resizeRef.current = next;
      setResizeState(next);
      dragRef.current = null;
      setDragState(null);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
      }
    },
    [getCanvasRect]
  );
  const onPointerMove = reactExports.useCallback(
    (event) => {
      const dragS = dragRef.current;
      const resizeS = resizeRef.current;
      if (!dragS && !resizeS) return;
      const rect = getCanvasRect ? getCanvasRect() : event.currentTarget.getBoundingClientRect();
      if (!rect) return;
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      if (dragS) {
        const next = { ...dragS, currentX: cx, currentY: cy };
        dragRef.current = next;
        setDragState(next);
      } else if (resizeS) {
        const next = { ...resizeS, currentX: cx, currentY: cy };
        resizeRef.current = next;
        setResizeState(next);
      }
    },
    [getCanvasRect]
  );
  const onPointerUp = reactExports.useCallback((event) => {
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
    }
    dragRef.current = null;
    resizeRef.current = null;
    setDragState(null);
    setResizeState(null);
  }, []);
  const cancelDrag = reactExports.useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
    setDragState(null);
    setResizeState(null);
  }, []);
  const snappedArea = dragState ? computeSnappedArea(dragState) : null;
  const resizedArea = resizeState ? computeResizedArea2(resizeState) : null;
  return {
    dragState,
    snappedArea,
    resizeState,
    resizedArea,
    onPointerDown,
    onResizeStart,
    onPointerMove,
    onPointerUp,
    cancelDrag
  };
}
const RESIZE_HANDLES = [
  {
    dir: "n",
    cls: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
    cursor: "ns-resize"
  },
  {
    dir: "s",
    cls: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
    cursor: "ns-resize"
  },
  {
    dir: "e",
    cls: "top-1/2 right-0 -translate-y-1/2 translate-x-1/2",
    cursor: "ew-resize"
  },
  {
    dir: "w",
    cls: "top-1/2 left-0 -translate-y-1/2 -translate-x-1/2",
    cursor: "ew-resize"
  },
  {
    dir: "ne",
    cls: "top-0 right-0 translate-x-1/2 -translate-y-1/2",
    cursor: "nesw-resize"
  },
  {
    dir: "nw",
    cls: "top-0 left-0 -translate-x-1/2 -translate-y-1/2",
    cursor: "nwse-resize"
  },
  {
    dir: "se",
    cls: "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
    cursor: "nwse-resize"
  },
  {
    dir: "sw",
    cls: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    cursor: "nesw-resize"
  }
];
function alignClass(pos) {
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
function justifyClass(pos) {
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
const PREVIEW_CURRENCY_DEFAULT = "CHF";
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
  zahlungsbedingungen: "Zahlbar innerhalb 30 Tagen"
};
const PREVIEW_POSITIONS = [
  {
    taetigkeit: "Beratung Gesellschaftsrecht",
    dauer: "1.5 h",
    honorar: `${PREVIEW_CURRENCY_DEFAULT} 525.00`
  },
  {
    taetigkeit: "Schriftsatz Klageentwurf",
    dauer: "3.0 h",
    honorar: `${PREVIEW_CURRENCY_DEFAULT} 1'050.00`
  },
  {
    taetigkeit: "Telefonkonferenz Mandant",
    dauer: "0.5 h",
    honorar: `${PREVIEW_CURRENCY_DEFAULT} 175.00`
  }
];
const PREVIEW_AUSLAGEN = [
  {
    datum: "15.07.2026",
    beschreibung: "Porto B-Post",
    betrag: `${PREVIEW_CURRENCY_DEFAULT} 8.50`
  },
  {
    datum: "18.07.2026",
    beschreibung: "Kopien Akte",
    betrag: `${PREVIEW_CURRENCY_DEFAULT} 12.00`
  }
];
function resolvePlaceholders(text) {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in PREVIEW_VALUES) {
      return PREVIEW_VALUES[key];
    }
    return match;
  });
}
function renderElementContent(el, vorlage, logoUrl, stammdaten) {
  const align = alignClass(el.alignment);
  const resolvedTitel = resolvePlaceholders(
    vorlage.standardtexte.rechnungstitel
  );
  const resolvedEinleitung = resolvePlaceholders(
    vorlage.standardtexte.einleitung
  );
  const resolvedZahlungshinweis = resolvePlaceholders(
    vorlage.standardtexte.zahlungshinweis
  );
  const resolvedSchluss = resolvePlaceholders(
    vorlage.standardtexte.schlusstext
  );
  const typographyStyle = {
    fontFamily: fontStack(el.fontFamily),
    fontSize: el.fontSize ? `${el.fontSize}pt` : void 0,
    fontWeight: el.bold ? "bold" : void 0,
    fontStyle: el.italic ? "italic" : void 0
  };
  const wrap = (content) => /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: typographyStyle, className: "h-full overflow-hidden", children: content });
  switch (el.id) {
    case LayoutElementId.absenderadresse:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: align, children: (() => {
          const lines = getAbsenderadresse(stammdaten);
          if (lines.length === 0) {
            return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-neutral-400 italic text-[9px]", children: "Kanzleidaten in Einstellungen > Kanzleidaten erfassen" });
          }
          return lines.map((line, idx) => /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: idx === 0 && line.length > 0 ? "font-semibold text-neutral-900" : line.length > 0 ? "text-neutral-600" : "",
              style: line.length === 0 ? { height: "1em" } : void 0,
              children: line
            },
            `${idx}-${line}`
          ));
        })() })
      );
    case LayoutElementId.empfaengeradresse:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: align, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-semibold text-neutral-900", children: PREVIEW_VALUES.empfaenger_name }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-neutral-600", children: PREVIEW_VALUES.empfaenger_adresse })
        ] })
      );
    case LayoutElementId.logo:
      return wrap(
        logoUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `flex ${justifyClass(el.alignment)}`, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          "img",
          {
            src: logoUrl,
            alt: "Logo-Vorschau",
            className: "inline-block max-h-16 max-w-[180px] object-contain"
          }
        ) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `${align} text-neutral-400 italic text-[9px]`, children: "Kein Logo" })
      );
    case LayoutElementId.rechnungsmetadaten:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: align, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-display text-base font-bold text-neutral-900", children: resolvedTitel || "Rechnung" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 space-y-0.5 text-neutral-700", children: getRechnungsmetadaten({
            rechnungsnummer: PREVIEW_VALUES.rechnungsnummer,
            rechnungsdatum: PREVIEW_VALUES.rechnungsdatum,
            leistungszeitraum: PREVIEW_VALUES.leistungszeitraum
          }).map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-neutral-500", children: [
              m.label,
              ": "
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: m.value })
          ] }, m.label)) })
        ] })
      );
    case LayoutElementId.mandatsinfo:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: align, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-neutral-500", children: "Mandat: " }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: PREVIEW_VALUES.mandat_bezeichnung })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-neutral-500", children: "Leistungserbringer: " }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: PREVIEW_VALUES.leistungserbringer })
          ] })
        ] })
      );
    case LayoutElementId.einleitung:
      return wrap(
        resolvedEinleitung ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: `${align} text-neutral-800 whitespace-pre-wrap`, children: resolvedEinleitung }) : null
      );
    case LayoutElementId.leistungspositionen:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-hidden rounded border border-neutral-200", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-[10px]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "bg-neutral-100 text-neutral-600", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-2 py-1.5 text-left font-medium", children: "Tätigkeit" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-2 py-1.5 text-right font-medium", children: "Dauer" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-2 py-1.5 text-right font-medium", children: "Honorar" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: PREVIEW_POSITIONS.map((pos) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "tr",
            {
              className: "border-t border-neutral-200",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-2 py-1.5 text-neutral-800", children: pos.taetigkeit }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-2 py-1.5 text-right text-neutral-700", children: pos.dauer }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-2 py-1.5 text-right text-neutral-800 tabular-nums", children: pos.honorar })
              ]
            },
            pos.taetigkeit
          )) })
        ] }) })
      );
    case LayoutElementId.summenblock:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `flex ${justifyClass(el.alignment)} w-full`, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-48 space-y-1 text-[10px]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between text-neutral-700", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Subtotal" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tabular-nums", children: PREVIEW_VALUES.subtotal })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between text-neutral-700", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "MWST ",
              PREVIEW_VALUES.mwst_satz
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tabular-nums", children: PREVIEW_VALUES.mwst_betrag })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "my-1 h-px bg-neutral-300" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex justify-between font-semibold text-neutral-900", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Total" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "tabular-nums", children: PREVIEW_VALUES.total })
          ] })
        ] }) })
      );
    case LayoutElementId.zahlungsinformationen:
      return wrap(
        resolvedZahlungshinweis ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: `${align} text-neutral-800 whitespace-pre-wrap`, children: resolvedZahlungshinweis }) : null
      );
    case SCHLUSSTEXT_ELEMENT_ID:
      return wrap(
        resolvedSchluss ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: `${align} text-neutral-800 whitespace-pre-wrap`, children: resolvedSchluss }) : null
      );
    case LayoutElementId.fusszeile:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "h-full flex flex-col justify-end", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2 h-px bg-neutral-200" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "p",
            {
              className: `${alignClass(
                el.alignment ?? Position.zentriert
              )} text-[9px] text-neutral-500`,
              children: vorlage.layout.fusszeile || "Fusszeile — hier Kanzlei- und Kontodaten erfassen"
            }
          )
        ] })
      );
    case LayoutElementId.spesenAuslagen:
      return wrap(
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-hidden rounded border border-neutral-200", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-[10px]", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "bg-neutral-100 text-neutral-600", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-2 py-1.5 text-left font-medium", children: "Datum" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-2 py-1.5 text-left font-medium", children: "Beschreibung" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "px-2 py-1.5 text-right font-medium", children: "Betrag" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: PREVIEW_AUSLAGEN.map((aus) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "tr",
            {
              className: "border-t border-neutral-200",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-2 py-1.5 text-neutral-700", children: aus.datum }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-2 py-1.5 text-neutral-800", children: aus.beschreibung }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "px-2 py-1.5 text-right text-neutral-800 tabular-nums", children: aus.betrag })
              ]
            },
            `${aus.datum}-${aus.beschreibung}`
          )) })
        ] }) })
      );
    default:
      return null;
  }
}
function LayoutCanvas({
  layoutV2,
  selectedId,
  onSelect,
  onCommitDrag,
  onCommitResize,
  vorlage,
  logoUrl,
  zoom,
  preview = false,
  stammdaten
}) {
  const containerRef = reactExports.useRef(null);
  const canvasRef = reactExports.useRef(null);
  const [containerWidth, setContainerWidth] = reactExports.useState(0);
  reactExports.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pageWidthMm = layoutV2.pageWidthMm ?? A4_PAGE_WIDTH_MM;
  const pageHeightMm = layoutV2.pageHeightMm ?? A4_PAGE_HEIGHT_MM;
  const marginTopMm = layoutV2.marginTopMm ?? 20;
  const marginBottomMm = layoutV2.marginBottomMm ?? 20;
  const marginLeftMm = layoutV2.marginLeftMm ?? 20;
  const marginRightMm = layoutV2.marginRightMm ?? 20;
  const fitWidthPx = containerWidth > 0 ? containerWidth : 600;
  const zoomFactor = zoom === "fit" ? 1 : zoom === "50" ? 0.5 : zoom === "75" ? 0.75 : zoom === "100" ? 1 : 1;
  const canvasWidthPx = fitWidthPx * zoomFactor;
  const pxPerMm = computePxPerMm(canvasWidthPx, pageWidthMm);
  const canvasHeightPx = mmToPx(pageHeightMm, pxPerMm);
  const safeAreaMm = {
    x: marginLeftMm,
    y: marginTopMm,
    width: pageWidthMm - marginLeftMm - marginRightMm,
    height: pageHeightMm - marginTopMm - marginBottomMm
  };
  const {
    dragState,
    resizeState,
    onPointerDown,
    onResizeStart,
    onPointerMove,
    onPointerUp
  } = useDragDrop(
    {
      cols: 1,
      rows: 1,
      containerWidth: canvasWidthPx,
      containerHeight: canvasHeightPx
    },
    () => {
      var _a;
      return ((_a = canvasRef.current) == null ? void 0 : _a.getBoundingClientRect()) ?? null;
    }
  );
  const sortedElements = reactExports.useMemo(
    () => [...layoutV2.elements].filter((el) => el.visible).sort((a, b) => Number((a.zOrder ?? a.order) - (b.zOrder ?? b.order))),
    [layoutV2.elements]
  );
  function handlePointerUp(e) {
    if (dragState) {
      const dxPx = dragState.currentX - dragState.startX;
      const dyPx = dragState.currentY - dragState.startY;
      const dxMm = pxToMm(dxPx, pxPerMm);
      const dyMm = pxToMm(dyPx, pxPerMm);
      const el = layoutV2.elements.find((x) => x.id === dragState.elementId);
      if (el) {
        const newX = Math.max(
          safeAreaMm.x,
          Math.min(
            (el.xMm ?? 0) + dxMm,
            safeAreaMm.x + safeAreaMm.width - (el.widthMm ?? 50)
          )
        );
        const newY = Math.max(
          safeAreaMm.y,
          Math.min(
            (el.yMm ?? 0) + dyMm,
            safeAreaMm.y + safeAreaMm.height - (el.heightMm ?? 25)
          )
        );
        onCommitDrag(el.id, { xMm: newX, yMm: newY });
      }
    } else if (resizeState) {
      const dxPx = resizeState.currentX - resizeState.startX;
      const dyPx = resizeState.currentY - resizeState.startY;
      const dxMm = pxToMm(dxPx, pxPerMm);
      const dyMm = pxToMm(dyPx, pxPerMm);
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
        newX = Math.max(
          safeAreaMm.x,
          Math.min(newX, safeAreaMm.x + safeAreaMm.width - newW)
        );
        newY = Math.max(
          safeAreaMm.y,
          Math.min(newY, safeAreaMm.y + safeAreaMm.height - newH)
        );
        newW = Math.min(newW, safeAreaMm.x + safeAreaMm.width - newX);
        newH = Math.min(newH, safeAreaMm.y + safeAreaMm.height - newY);
        onCommitResize(el.id, {
          xMm: newX,
          yMm: newY,
          widthMm: newW,
          heightMm: newH
        });
      }
    }
    onPointerUp(e);
  }
  function getLiveOffset(el) {
    const base = {
      x: el.xMm ?? 0,
      y: el.yMm ?? 0,
      w: el.widthMm ?? 50,
      h: el.heightMm ?? 25
    };
    if (dragState && dragState.elementId === el.id) {
      return {
        ...base,
        x: base.x + pxToMm(dragState.currentX - dragState.startX, pxPerMm),
        y: base.y + pxToMm(dragState.currentY - dragState.startY, pxPerMm)
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
  const canvasStyle = {
    width: `${canvasWidthPx}px`,
    height: `${canvasHeightPx}px`,
    aspectRatio: "210 / 297"
  };
  const safeAreaStyle = {
    left: `${mmToPx(safeAreaMm.x, pxPerMm)}px`,
    top: `${mmToPx(safeAreaMm.y, pxPerMm)}px`,
    width: `${mmToPx(safeAreaMm.width, pxPerMm)}px`,
    height: `${mmToPx(safeAreaMm.height, pxPerMm)}px`
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      ref: containerRef,
      "data-ocid": "rechnungsvorlagen.canvas",
      className: "w-full flex justify-center",
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          ref: canvasRef,
          className: "relative bg-white rounded-sm shadow-md ring-1 ring-border overflow-hidden",
          style: canvasStyle,
          onPointerMove: preview ? void 0 : onPointerMove,
          onPointerUp: preview ? void 0 : handlePointerUp,
          children: [
            !preview && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  className: "pointer-events-none absolute border-2 border-dashed border-primary/40 rounded-sm",
                  style: safeAreaStyle,
                  "aria-hidden": "true",
                  "data-ocid": "rechnungsvorlagen.canvas_safe_area"
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "div",
                {
                  className: "pointer-events-none absolute text-[9px] font-medium text-primary/60 select-none",
                  style: {
                    left: `${mmToPx(safeAreaMm.x, pxPerMm)}px`,
                    top: `${mmToPx(safeAreaMm.y, pxPerMm)}px`,
                    transform: "translate(2px, -12px)"
                  },
                  "aria-hidden": "true",
                  children: [
                    "Druckbereich (",
                    safeAreaMm.width.toFixed(0),
                    "×",
                    safeAreaMm.height.toFixed(0),
                    " mm)"
                  ]
                }
              )
            ] }),
            sortedElements.map((el) => {
              const isDragging = (dragState == null ? void 0 : dragState.elementId) === el.id;
              const isResizing = (resizeState == null ? void 0 : resizeState.elementId) === el.id;
              const isSelected = selectedId === el.id;
              const live = getLiveOffset(el);
              const itemStyle = {
                position: "absolute",
                left: `${mmToPx(live.x, pxPerMm)}px`,
                top: `${mmToPx(live.y, pxPerMm)}px`,
                width: `${mmToPx(live.w, pxPerMm)}px`,
                height: `${mmToPx(live.h, pxPerMm)}px`,
                zIndex: isDragging || isResizing ? 50 : Number(el.zOrder ?? el.order) + 1
              };
              if (preview) {
                return /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "div",
                  {
                    style: itemStyle,
                    className: "p-1 overflow-hidden",
                    children: renderElementContent(el, vorlage, logoUrl, stammdaten)
                  },
                  el.id
                );
              }
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "button",
                {
                  type: "button",
                  "data-ocid": `rechnungsvorlagen.canvas_element.${el.id}`,
                  style: itemStyle,
                  className: `group relative m-0 rounded-md border p-1 cursor-pointer select-none text-left w-full ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-primary/30 bg-white/60 hover:border-primary/60 hover:ring-1 hover:ring-primary/20"} ${isDragging || isResizing ? "opacity-90 shadow-lg" : ""}`,
                  onClick: () => onSelect(el.id),
                  "aria-label": `${layoutElementIdToString(el.id)} auswählen`,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pointer-events-none w-full h-full overflow-hidden", children: renderElementContent(el, vorlage, logoUrl, stammdaten) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "div",
                      {
                        className: `absolute top-0 left-0 right-0 flex items-center justify-between gap-1 px-1 py-0.5 rounded-t-md bg-primary/90 text-primary-foreground text-[9px] font-medium leading-none transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-90"}`,
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: layoutElementIdToString(el.id) }),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "tabular-nums shrink-0 flex items-center gap-1", children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                              "X: ",
                              live.x.toFixed(0),
                              "mm"
                            ] }),
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                              "Y: ",
                              live.y.toFixed(0),
                              "mm"
                            ] }),
                            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
                              "· ",
                              live.w.toFixed(0),
                              "×",
                              live.h.toFixed(0)
                            ] })
                          ] })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        "aria-label": `${layoutElementIdToString(el.id)} verschieben`,
                        "data-ocid": `rechnungsvorlagen.drag_handle.${el.id}`,
                        className: `absolute top-4 left-1 flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-white/80 shadow-sm transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`,
                        style: { touchAction: "none" },
                        onPointerDown: (e) => {
                          e.stopPropagation();
                          onPointerDown(el.id, el.gridArea, e);
                        },
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx(GripVertical, { size: 14 })
                      }
                    ),
                    el.alignment && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      "div",
                      {
                        className: `absolute top-4 right-1 flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`,
                        children: [
                          el.alignment === Position.links && /* @__PURE__ */ jsxRuntimeExports.jsx(AlignLeft, { size: 10 }),
                          el.alignment === Position.zentriert && /* @__PURE__ */ jsxRuntimeExports.jsx(AlignCenter, { size: 10 }),
                          el.alignment === Position.rechts && /* @__PURE__ */ jsxRuntimeExports.jsx(AlignRight, { size: 10 })
                        ]
                      }
                    ),
                    isSelected && RESIZE_HANDLES.map((h) => /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "button",
                      {
                        type: "button",
                        "aria-label": `${layoutElementIdToString(el.id)} Grösse ändern (${h.dir})`,
                        "data-ocid": `rechnungsvorlagen.resize_handle.${el.id}.${h.dir}`,
                        className: `absolute flex h-6 w-6 items-center justify-center rounded-full border border-primary bg-white text-primary shadow-sm hover:bg-primary hover:text-primary-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${h.cls}`,
                        style: { touchAction: "none", cursor: h.cursor },
                        onPointerDown: (e) => {
                          e.stopPropagation();
                          onResizeStart(el.id, h.dir, el.gridArea, e);
                        },
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                          "span",
                          {
                            className: "block h-2 w-2 rounded-full bg-current",
                            "aria-hidden": "true"
                          }
                        )
                      },
                      h.dir
                    ))
                  ]
                },
                el.id
              );
            }),
            !preview && sortedElements.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute inset-0 flex items-center justify-center text-center p-8", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Alle Elemente sind ausgeblendet." }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Blenden Sie Elemente über die Palette wieder ein." })
            ] }) })
          ]
        }
      )
    }
  );
}
function ZoomControl({ zoom, onChange }) {
  const options = [
    { value: "fit", label: "Einpassen" },
    { value: "50", label: "50%" },
    { value: "75", label: "75%" },
    { value: "100", label: "100%" }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "fieldset",
    {
      className: "inline-flex items-center rounded-md border border-border bg-card p-0.5",
      "data-ocid": "rechnungsvorlagen.zoom_control",
      "aria-label": "Zoom-Stufe",
      children: options.map((opt) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          "data-ocid": `rechnungsvorlagen.zoom_${opt.value}`,
          onClick: () => onChange(opt.value),
          "aria-pressed": zoom === opt.value,
          className: `px-2.5 py-1 text-xs rounded transition-smooth ${zoom === opt.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`,
          children: opt.label
        },
        opt.value
      ))
    }
  );
}
function MarginsControl({ layoutV2, onChange }) {
  const fields = [
    { key: "marginTopMm", label: "Oben" },
    { key: "marginBottomMm", label: "Unten" },
    { key: "marginLeftMm", label: "Links" },
    { key: "marginRightMm", label: "Rechts" }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      className: "grid grid-cols-2 gap-3",
      "data-ocid": "rechnungsvorlagen.margins",
      children: [
        fields.map((f) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "label",
            {
              className: "text-xs text-muted-foreground",
              htmlFor: `margin-${f.key}`,
              children: [
                f.label,
                " (mm)"
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              id: `margin-${f.key}`,
              type: "number",
              min: 5,
              max: 40,
              step: 1,
              value: layoutV2[f.key] ?? 20,
              "data-ocid": `rechnungsvorlagen.margin_${f.key}`,
              onChange: (e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(n)) return;
                const clamped = Math.max(5, Math.min(40, n));
                onChange({ [f.key]: clamped });
              },
              className: "h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            }
          )
        ] }, f.key)),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "col-span-2 text-xs text-muted-foreground", children: "Seitenränder in mm. Standard 20 mm, Min/Max 5–40 mm. Der Druckbereich auf der Leinwand wird entsprechend markiert." })
      ]
    }
  );
}
var COLLAPSIBLE_NAME = "Collapsible";
var [createCollapsibleContext, createCollapsibleScope] = createContextScope(COLLAPSIBLE_NAME);
var [CollapsibleProvider, useCollapsibleContext] = createCollapsibleContext(COLLAPSIBLE_NAME);
var Collapsible$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeCollapsible,
      open: openProp,
      defaultOpen,
      disabled,
      onOpenChange,
      ...collapsibleProps
    } = props;
    const [open, setOpen] = useControllableState({
      prop: openProp,
      defaultProp: defaultOpen ?? false,
      onChange: onOpenChange,
      caller: COLLAPSIBLE_NAME
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      CollapsibleProvider,
      {
        scope: __scopeCollapsible,
        disabled,
        contentId: useId(),
        open,
        onOpenToggle: reactExports.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen]),
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.div,
          {
            "data-state": getState$1(open),
            "data-disabled": disabled ? "" : void 0,
            ...collapsibleProps,
            ref: forwardedRef
          }
        )
      }
    );
  }
);
Collapsible$1.displayName = COLLAPSIBLE_NAME;
var TRIGGER_NAME$2 = "CollapsibleTrigger";
var CollapsibleTrigger$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeCollapsible, ...triggerProps } = props;
    const context = useCollapsibleContext(TRIGGER_NAME$2, __scopeCollapsible);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.button,
      {
        type: "button",
        "aria-controls": context.contentId,
        "aria-expanded": context.open || false,
        "data-state": getState$1(context.open),
        "data-disabled": context.disabled ? "" : void 0,
        disabled: context.disabled,
        ...triggerProps,
        ref: forwardedRef,
        onClick: composeEventHandlers(props.onClick, context.onOpenToggle)
      }
    );
  }
);
CollapsibleTrigger$1.displayName = TRIGGER_NAME$2;
var CONTENT_NAME$3 = "CollapsibleContent";
var CollapsibleContent$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { forceMount, ...contentProps } = props;
    const context = useCollapsibleContext(CONTENT_NAME$3, props.__scopeCollapsible);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Presence, { present: forceMount || context.open, children: ({ present }) => /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleContentImpl, { ...contentProps, ref: forwardedRef, present }) });
  }
);
CollapsibleContent$1.displayName = CONTENT_NAME$3;
var CollapsibleContentImpl = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeCollapsible, present, children, ...contentProps } = props;
  const context = useCollapsibleContext(CONTENT_NAME$3, __scopeCollapsible);
  const [isPresent, setIsPresent] = reactExports.useState(present);
  const ref = reactExports.useRef(null);
  const composedRefs = useComposedRefs(forwardedRef, ref);
  const heightRef = reactExports.useRef(0);
  const height = heightRef.current;
  const widthRef = reactExports.useRef(0);
  const width = widthRef.current;
  const isOpen = context.open || isPresent;
  const isMountAnimationPreventedRef = reactExports.useRef(isOpen);
  const originalStylesRef = reactExports.useRef(void 0);
  reactExports.useEffect(() => {
    const rAF = requestAnimationFrame(() => isMountAnimationPreventedRef.current = false);
    return () => cancelAnimationFrame(rAF);
  }, []);
  useLayoutEffect2(() => {
    const node = ref.current;
    if (node) {
      originalStylesRef.current = originalStylesRef.current || {
        transitionDuration: node.style.transitionDuration,
        animationName: node.style.animationName
      };
      node.style.transitionDuration = "0s";
      node.style.animationName = "none";
      const rect = node.getBoundingClientRect();
      heightRef.current = rect.height;
      widthRef.current = rect.width;
      if (!isMountAnimationPreventedRef.current) {
        node.style.transitionDuration = originalStylesRef.current.transitionDuration;
        node.style.animationName = originalStylesRef.current.animationName;
      }
      setIsPresent(present);
    }
  }, [context.open, present]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Primitive.div,
    {
      "data-state": getState$1(context.open),
      "data-disabled": context.disabled ? "" : void 0,
      id: context.contentId,
      hidden: !isOpen,
      ...contentProps,
      ref: composedRefs,
      style: {
        [`--radix-collapsible-content-height`]: height ? `${height}px` : void 0,
        [`--radix-collapsible-content-width`]: width ? `${width}px` : void 0,
        ...props.style
      },
      children: isOpen && children
    }
  );
});
function getState$1(open) {
  return open ? "open" : "closed";
}
var Root = Collapsible$1;
var Trigger$1 = CollapsibleTrigger$1;
var Content = CollapsibleContent$1;
var ACCORDION_NAME = "Accordion";
var ACCORDION_KEYS = ["Home", "End", "ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"];
var [Collection$1, useCollection$1, createCollectionScope$1] = createCollection(ACCORDION_NAME);
var [createAccordionContext] = createContextScope(ACCORDION_NAME, [
  createCollectionScope$1,
  createCollapsibleScope
]);
var useCollapsibleScope = createCollapsibleScope();
var Accordion$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { type, ...accordionProps } = props;
    const singleProps = accordionProps;
    const multipleProps = accordionProps;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Collection$1.Provider, { scope: props.__scopeAccordion, children: type === "multiple" ? /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionImplMultiple, { ...multipleProps, ref: forwardedRef }) : /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionImplSingle, { ...singleProps, ref: forwardedRef }) });
  }
);
Accordion$1.displayName = ACCORDION_NAME;
var [AccordionValueProvider, useAccordionValueContext] = createAccordionContext(ACCORDION_NAME);
var [AccordionCollapsibleProvider, useAccordionCollapsibleContext] = createAccordionContext(
  ACCORDION_NAME,
  { collapsible: false }
);
var AccordionImplSingle = React.forwardRef(
  (props, forwardedRef) => {
    const {
      value: valueProp,
      defaultValue,
      onValueChange = () => {
      },
      collapsible = false,
      ...accordionSingleProps
    } = props;
    const [value, setValue] = useControllableState({
      prop: valueProp,
      defaultProp: defaultValue ?? "",
      onChange: onValueChange,
      caller: ACCORDION_NAME
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      AccordionValueProvider,
      {
        scope: props.__scopeAccordion,
        value: React.useMemo(() => value ? [value] : [], [value]),
        onItemOpen: setValue,
        onItemClose: React.useCallback(() => collapsible && setValue(""), [collapsible, setValue]),
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionCollapsibleProvider, { scope: props.__scopeAccordion, collapsible, children: /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionImpl, { ...accordionSingleProps, ref: forwardedRef }) })
      }
    );
  }
);
var AccordionImplMultiple = React.forwardRef((props, forwardedRef) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange = () => {
    },
    ...accordionMultipleProps
  } = props;
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? [],
    onChange: onValueChange,
    caller: ACCORDION_NAME
  });
  const handleItemOpen = React.useCallback(
    (itemValue) => setValue((prevValue = []) => [...prevValue, itemValue]),
    [setValue]
  );
  const handleItemClose = React.useCallback(
    (itemValue) => setValue((prevValue = []) => prevValue.filter((value2) => value2 !== itemValue)),
    [setValue]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    AccordionValueProvider,
    {
      scope: props.__scopeAccordion,
      value,
      onItemOpen: handleItemOpen,
      onItemClose: handleItemClose,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionCollapsibleProvider, { scope: props.__scopeAccordion, collapsible: true, children: /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionImpl, { ...accordionMultipleProps, ref: forwardedRef }) })
    }
  );
});
var [AccordionImplProvider, useAccordionContext] = createAccordionContext(ACCORDION_NAME);
var AccordionImpl = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAccordion, disabled, dir, orientation = "vertical", ...accordionProps } = props;
    const accordionRef = React.useRef(null);
    const composedRefs = useComposedRefs(accordionRef, forwardedRef);
    const getItems = useCollection$1(__scopeAccordion);
    const direction = useDirection(dir);
    const isDirectionLTR = direction === "ltr";
    const handleKeyDown = composeEventHandlers(props.onKeyDown, (event) => {
      var _a;
      if (!ACCORDION_KEYS.includes(event.key)) return;
      const target = event.target;
      const triggerCollection = getItems().filter((item) => {
        var _a2;
        return !((_a2 = item.ref.current) == null ? void 0 : _a2.disabled);
      });
      const triggerIndex = triggerCollection.findIndex((item) => item.ref.current === target);
      const triggerCount = triggerCollection.length;
      if (triggerIndex === -1) return;
      event.preventDefault();
      let nextIndex = triggerIndex;
      const homeIndex = 0;
      const endIndex = triggerCount - 1;
      const moveNext = () => {
        nextIndex = triggerIndex + 1;
        if (nextIndex > endIndex) {
          nextIndex = homeIndex;
        }
      };
      const movePrev = () => {
        nextIndex = triggerIndex - 1;
        if (nextIndex < homeIndex) {
          nextIndex = endIndex;
        }
      };
      switch (event.key) {
        case "Home":
          nextIndex = homeIndex;
          break;
        case "End":
          nextIndex = endIndex;
          break;
        case "ArrowRight":
          if (orientation === "horizontal") {
            if (isDirectionLTR) {
              moveNext();
            } else {
              movePrev();
            }
          }
          break;
        case "ArrowDown":
          if (orientation === "vertical") {
            moveNext();
          }
          break;
        case "ArrowLeft":
          if (orientation === "horizontal") {
            if (isDirectionLTR) {
              movePrev();
            } else {
              moveNext();
            }
          }
          break;
        case "ArrowUp":
          if (orientation === "vertical") {
            movePrev();
          }
          break;
      }
      const clampedIndex = nextIndex % triggerCount;
      (_a = triggerCollection[clampedIndex].ref.current) == null ? void 0 : _a.focus();
    });
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      AccordionImplProvider,
      {
        scope: __scopeAccordion,
        disabled,
        direction: dir,
        orientation,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Collection$1.Slot, { scope: __scopeAccordion, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.div,
          {
            ...accordionProps,
            "data-orientation": orientation,
            ref: composedRefs,
            onKeyDown: disabled ? void 0 : handleKeyDown
          }
        ) })
      }
    );
  }
);
var ITEM_NAME$3 = "AccordionItem";
var [AccordionItemProvider, useAccordionItemContext] = createAccordionContext(ITEM_NAME$3);
var AccordionItem$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAccordion, value, ...accordionItemProps } = props;
    const accordionContext = useAccordionContext(ITEM_NAME$3, __scopeAccordion);
    const valueContext = useAccordionValueContext(ITEM_NAME$3, __scopeAccordion);
    const collapsibleScope = useCollapsibleScope(__scopeAccordion);
    const triggerId = useId();
    const open = value && valueContext.value.includes(value) || false;
    const disabled = accordionContext.disabled || props.disabled;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      AccordionItemProvider,
      {
        scope: __scopeAccordion,
        open,
        disabled,
        triggerId,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Root,
          {
            "data-orientation": accordionContext.orientation,
            "data-state": getState(open),
            ...collapsibleScope,
            ...accordionItemProps,
            ref: forwardedRef,
            disabled,
            open,
            onOpenChange: (open2) => {
              if (open2) {
                valueContext.onItemOpen(value);
              } else {
                valueContext.onItemClose(value);
              }
            }
          }
        )
      }
    );
  }
);
AccordionItem$1.displayName = ITEM_NAME$3;
var HEADER_NAME = "AccordionHeader";
var AccordionHeader = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAccordion, ...headerProps } = props;
    const accordionContext = useAccordionContext(ACCORDION_NAME, __scopeAccordion);
    const itemContext = useAccordionItemContext(HEADER_NAME, __scopeAccordion);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.h3,
      {
        "data-orientation": accordionContext.orientation,
        "data-state": getState(itemContext.open),
        "data-disabled": itemContext.disabled ? "" : void 0,
        ...headerProps,
        ref: forwardedRef
      }
    );
  }
);
AccordionHeader.displayName = HEADER_NAME;
var TRIGGER_NAME$1 = "AccordionTrigger";
var AccordionTrigger$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAccordion, ...triggerProps } = props;
    const accordionContext = useAccordionContext(ACCORDION_NAME, __scopeAccordion);
    const itemContext = useAccordionItemContext(TRIGGER_NAME$1, __scopeAccordion);
    const collapsibleContext = useAccordionCollapsibleContext(TRIGGER_NAME$1, __scopeAccordion);
    const collapsibleScope = useCollapsibleScope(__scopeAccordion);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Collection$1.ItemSlot, { scope: __scopeAccordion, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Trigger$1,
      {
        "aria-disabled": itemContext.open && !collapsibleContext.collapsible || void 0,
        "data-orientation": accordionContext.orientation,
        id: itemContext.triggerId,
        ...collapsibleScope,
        ...triggerProps,
        ref: forwardedRef
      }
    ) });
  }
);
AccordionTrigger$1.displayName = TRIGGER_NAME$1;
var CONTENT_NAME$2 = "AccordionContent";
var AccordionContent$1 = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeAccordion, ...contentProps } = props;
    const accordionContext = useAccordionContext(ACCORDION_NAME, __scopeAccordion);
    const itemContext = useAccordionItemContext(CONTENT_NAME$2, __scopeAccordion);
    const collapsibleScope = useCollapsibleScope(__scopeAccordion);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Content,
      {
        role: "region",
        "aria-labelledby": itemContext.triggerId,
        "data-orientation": accordionContext.orientation,
        ...collapsibleScope,
        ...contentProps,
        ref: forwardedRef,
        style: {
          ["--radix-accordion-content-height"]: "var(--radix-collapsible-content-height)",
          ["--radix-accordion-content-width"]: "var(--radix-collapsible-content-width)",
          ...props.style
        }
      }
    );
  }
);
AccordionContent$1.displayName = CONTENT_NAME$2;
function getState(open) {
  return open ? "open" : "closed";
}
var Root2$2 = Accordion$1;
var Item = AccordionItem$1;
var Header = AccordionHeader;
var Trigger2 = AccordionTrigger$1;
var Content2$2 = AccordionContent$1;
function Accordion({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Root2$2, { "data-slot": "accordion", ...props });
}
function AccordionItem({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Item,
    {
      "data-slot": "accordion-item",
      className: cn("border-b last:border-b-0", className),
      ...props
    }
  );
}
function AccordionTrigger({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Header, { className: "flex", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
    Trigger2,
    {
      "data-slot": "accordion-trigger",
      className: cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
        className
      ),
      ...props,
      children: [
        children,
        /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" })
      ]
    }
  ) });
}
function AccordionContent({
  className,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Content2$2,
    {
      "data-slot": "accordion-content",
      className: "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm",
      ...props,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("pt-0 pb-4", className), children })
    }
  );
}
function Collapsible({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Root, { "data-slot": "collapsible", ...props });
}
function CollapsibleTrigger({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    CollapsibleTrigger$1,
    {
      "data-slot": "collapsible-trigger",
      ...props
    }
  );
}
function CollapsibleContent({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    CollapsibleContent$1,
    {
      "data-slot": "collapsible-content",
      ...props
    }
  );
}
var SELECTION_KEYS = ["Enter", " "];
var FIRST_KEYS = ["ArrowDown", "PageUp", "Home"];
var LAST_KEYS = ["ArrowUp", "PageDown", "End"];
var FIRST_LAST_KEYS = [...FIRST_KEYS, ...LAST_KEYS];
var SUB_OPEN_KEYS = {
  ltr: [...SELECTION_KEYS, "ArrowRight"],
  rtl: [...SELECTION_KEYS, "ArrowLeft"]
};
var SUB_CLOSE_KEYS = {
  ltr: ["ArrowLeft"],
  rtl: ["ArrowRight"]
};
var MENU_NAME = "Menu";
var [Collection, useCollection, createCollectionScope] = createCollection(MENU_NAME);
var [createMenuContext, createMenuScope] = createContextScope(MENU_NAME, [
  createCollectionScope,
  createPopperScope,
  createRovingFocusGroupScope
]);
var usePopperScope = createPopperScope();
var useRovingFocusGroupScope$1 = createRovingFocusGroupScope();
var [MenuProvider, useMenuContext] = createMenuContext(MENU_NAME);
var [MenuRootProvider, useMenuRootContext] = createMenuContext(MENU_NAME);
var Menu = (props) => {
  const { __scopeMenu, open = false, children, dir, onOpenChange, modal = true } = props;
  const popperScope = usePopperScope(__scopeMenu);
  const [content, setContent] = reactExports.useState(null);
  const isUsingKeyboardRef = reactExports.useRef(false);
  const handleOpenChange = useCallbackRef(onOpenChange);
  const direction = useDirection(dir);
  reactExports.useEffect(() => {
    const handleKeyDown = () => {
      isUsingKeyboardRef.current = true;
      document.addEventListener("pointerdown", handlePointer, { capture: true, once: true });
      document.addEventListener("pointermove", handlePointer, { capture: true, once: true });
    };
    const handlePointer = () => isUsingKeyboardRef.current = false;
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
      document.removeEventListener("pointerdown", handlePointer, { capture: true });
      document.removeEventListener("pointermove", handlePointer, { capture: true });
    };
  }, []);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Root2$3, { ...popperScope, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    MenuProvider,
    {
      scope: __scopeMenu,
      open,
      onOpenChange: handleOpenChange,
      content,
      onContentChange: setContent,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        MenuRootProvider,
        {
          scope: __scopeMenu,
          onClose: reactExports.useCallback(() => handleOpenChange(false), [handleOpenChange]),
          isUsingKeyboardRef,
          dir: direction,
          modal,
          children
        }
      )
    }
  ) });
};
Menu.displayName = MENU_NAME;
var ANCHOR_NAME = "MenuAnchor";
var MenuAnchor = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeMenu, ...anchorProps } = props;
    const popperScope = usePopperScope(__scopeMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Anchor, { ...popperScope, ...anchorProps, ref: forwardedRef });
  }
);
MenuAnchor.displayName = ANCHOR_NAME;
var PORTAL_NAME$1 = "MenuPortal";
var [PortalProvider, usePortalContext] = createMenuContext(PORTAL_NAME$1, {
  forceMount: void 0
});
var MenuPortal = (props) => {
  const { __scopeMenu, forceMount, children, container } = props;
  const context = useMenuContext(PORTAL_NAME$1, __scopeMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(PortalProvider, { scope: __scopeMenu, forceMount, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Portal$1, { asChild: true, container, children }) }) });
};
MenuPortal.displayName = PORTAL_NAME$1;
var CONTENT_NAME$1 = "MenuContent";
var [MenuContentProvider, useMenuContentContext] = createMenuContext(CONTENT_NAME$1);
var MenuContent = reactExports.forwardRef(
  (props, forwardedRef) => {
    const portalContext = usePortalContext(CONTENT_NAME$1, props.__scopeMenu);
    const { forceMount = portalContext.forceMount, ...contentProps } = props;
    const context = useMenuContext(CONTENT_NAME$1, props.__scopeMenu);
    const rootContext = useMenuRootContext(CONTENT_NAME$1, props.__scopeMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Collection.Provider, { scope: props.__scopeMenu, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Collection.Slot, { scope: props.__scopeMenu, children: rootContext.modal ? /* @__PURE__ */ jsxRuntimeExports.jsx(MenuRootContentModal, { ...contentProps, ref: forwardedRef }) : /* @__PURE__ */ jsxRuntimeExports.jsx(MenuRootContentNonModal, { ...contentProps, ref: forwardedRef }) }) }) });
  }
);
var MenuRootContentModal = reactExports.forwardRef(
  (props, forwardedRef) => {
    const context = useMenuContext(CONTENT_NAME$1, props.__scopeMenu);
    const ref = reactExports.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    reactExports.useEffect(() => {
      const content = ref.current;
      if (content) return hideOthers(content);
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      MenuContentImpl,
      {
        ...props,
        ref: composedRefs,
        trapFocus: context.open,
        disableOutsidePointerEvents: context.open,
        disableOutsideScroll: true,
        onFocusOutside: composeEventHandlers(
          props.onFocusOutside,
          (event) => event.preventDefault(),
          { checkForDefaultPrevented: false }
        ),
        onDismiss: () => context.onOpenChange(false)
      }
    );
  }
);
var MenuRootContentNonModal = reactExports.forwardRef((props, forwardedRef) => {
  const context = useMenuContext(CONTENT_NAME$1, props.__scopeMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    MenuContentImpl,
    {
      ...props,
      ref: forwardedRef,
      trapFocus: false,
      disableOutsidePointerEvents: false,
      disableOutsideScroll: false,
      onDismiss: () => context.onOpenChange(false)
    }
  );
});
var Slot = createSlot("MenuContent.ScrollLock");
var MenuContentImpl = reactExports.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeMenu,
      loop = false,
      trapFocus,
      onOpenAutoFocus,
      onCloseAutoFocus,
      disableOutsidePointerEvents,
      onEntryFocus,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      onDismiss,
      disableOutsideScroll,
      ...contentProps
    } = props;
    const context = useMenuContext(CONTENT_NAME$1, __scopeMenu);
    const rootContext = useMenuRootContext(CONTENT_NAME$1, __scopeMenu);
    const popperScope = usePopperScope(__scopeMenu);
    const rovingFocusGroupScope = useRovingFocusGroupScope$1(__scopeMenu);
    const getItems = useCollection(__scopeMenu);
    const [currentItemId, setCurrentItemId] = reactExports.useState(null);
    const contentRef = reactExports.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef, context.onContentChange);
    const timerRef = reactExports.useRef(0);
    const searchRef = reactExports.useRef("");
    const pointerGraceTimerRef = reactExports.useRef(0);
    const pointerGraceIntentRef = reactExports.useRef(null);
    const pointerDirRef = reactExports.useRef("right");
    const lastPointerXRef = reactExports.useRef(0);
    const ScrollLockWrapper = disableOutsideScroll ? ReactRemoveScroll : reactExports.Fragment;
    const scrollLockWrapperProps = disableOutsideScroll ? { as: Slot, allowPinchZoom: true } : void 0;
    const handleTypeaheadSearch = (key) => {
      var _a, _b;
      const search = searchRef.current + key;
      const items = getItems().filter((item) => !item.disabled);
      const currentItem = document.activeElement;
      const currentMatch = (_a = items.find((item) => item.ref.current === currentItem)) == null ? void 0 : _a.textValue;
      const values = items.map((item) => item.textValue);
      const nextMatch = getNextMatch(values, search, currentMatch);
      const newItem = (_b = items.find((item) => item.textValue === nextMatch)) == null ? void 0 : _b.ref.current;
      (function updateSearch(value) {
        searchRef.current = value;
        window.clearTimeout(timerRef.current);
        if (value !== "") timerRef.current = window.setTimeout(() => updateSearch(""), 1e3);
      })(search);
      if (newItem) {
        setTimeout(() => newItem.focus());
      }
    };
    reactExports.useEffect(() => {
      return () => window.clearTimeout(timerRef.current);
    }, []);
    useFocusGuards();
    const isPointerMovingToSubmenu = reactExports.useCallback((event) => {
      var _a, _b;
      const isMovingTowards = pointerDirRef.current === ((_a = pointerGraceIntentRef.current) == null ? void 0 : _a.side);
      return isMovingTowards && isPointerInGraceArea(event, (_b = pointerGraceIntentRef.current) == null ? void 0 : _b.area);
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      MenuContentProvider,
      {
        scope: __scopeMenu,
        searchRef,
        onItemEnter: reactExports.useCallback(
          (event) => {
            if (isPointerMovingToSubmenu(event)) event.preventDefault();
          },
          [isPointerMovingToSubmenu]
        ),
        onItemLeave: reactExports.useCallback(
          (event) => {
            var _a;
            if (isPointerMovingToSubmenu(event)) return;
            (_a = contentRef.current) == null ? void 0 : _a.focus();
            setCurrentItemId(null);
          },
          [isPointerMovingToSubmenu]
        ),
        onTriggerLeave: reactExports.useCallback(
          (event) => {
            if (isPointerMovingToSubmenu(event)) event.preventDefault();
          },
          [isPointerMovingToSubmenu]
        ),
        pointerGraceTimerRef,
        onPointerGraceIntentChange: reactExports.useCallback((intent) => {
          pointerGraceIntentRef.current = intent;
        }, []),
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(ScrollLockWrapper, { ...scrollLockWrapperProps, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          FocusScope,
          {
            asChild: true,
            trapped: trapFocus,
            onMountAutoFocus: composeEventHandlers(onOpenAutoFocus, (event) => {
              var _a;
              event.preventDefault();
              (_a = contentRef.current) == null ? void 0 : _a.focus({ preventScroll: true });
            }),
            onUnmountAutoFocus: onCloseAutoFocus,
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(
              DismissableLayer,
              {
                asChild: true,
                disableOutsidePointerEvents,
                onEscapeKeyDown,
                onPointerDownOutside,
                onFocusOutside,
                onInteractOutside,
                onDismiss,
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  Root$1,
                  {
                    asChild: true,
                    ...rovingFocusGroupScope,
                    dir: rootContext.dir,
                    orientation: "vertical",
                    loop,
                    currentTabStopId: currentItemId,
                    onCurrentTabStopIdChange: setCurrentItemId,
                    onEntryFocus: composeEventHandlers(onEntryFocus, (event) => {
                      if (!rootContext.isUsingKeyboardRef.current) event.preventDefault();
                    }),
                    preventScrollOnEntryFocus: true,
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                      Content$1,
                      {
                        role: "menu",
                        "aria-orientation": "vertical",
                        "data-state": getOpenState(context.open),
                        "data-radix-menu-content": "",
                        dir: rootContext.dir,
                        ...popperScope,
                        ...contentProps,
                        ref: composedRefs,
                        style: { outline: "none", ...contentProps.style },
                        onKeyDown: composeEventHandlers(contentProps.onKeyDown, (event) => {
                          const target = event.target;
                          const isKeyDownInside = target.closest("[data-radix-menu-content]") === event.currentTarget;
                          const isModifierKey = event.ctrlKey || event.altKey || event.metaKey;
                          const isCharacterKey = event.key.length === 1;
                          if (isKeyDownInside) {
                            if (event.key === "Tab") event.preventDefault();
                            if (!isModifierKey && isCharacterKey) handleTypeaheadSearch(event.key);
                          }
                          const content = contentRef.current;
                          if (event.target !== content) return;
                          if (!FIRST_LAST_KEYS.includes(event.key)) return;
                          event.preventDefault();
                          const items = getItems().filter((item) => !item.disabled);
                          const candidateNodes = items.map((item) => item.ref.current);
                          if (LAST_KEYS.includes(event.key)) candidateNodes.reverse();
                          focusFirst(candidateNodes);
                        }),
                        onBlur: composeEventHandlers(props.onBlur, (event) => {
                          if (!event.currentTarget.contains(event.target)) {
                            window.clearTimeout(timerRef.current);
                            searchRef.current = "";
                          }
                        }),
                        onPointerMove: composeEventHandlers(
                          props.onPointerMove,
                          whenMouse((event) => {
                            const target = event.target;
                            const pointerXHasChanged = lastPointerXRef.current !== event.clientX;
                            if (event.currentTarget.contains(target) && pointerXHasChanged) {
                              const newDir = event.clientX > lastPointerXRef.current ? "right" : "left";
                              pointerDirRef.current = newDir;
                              lastPointerXRef.current = event.clientX;
                            }
                          })
                        )
                      }
                    )
                  }
                )
              }
            )
          }
        ) })
      }
    );
  }
);
MenuContent.displayName = CONTENT_NAME$1;
var GROUP_NAME$1 = "MenuGroup";
var MenuGroup = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeMenu, ...groupProps } = props;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Primitive.div, { role: "group", ...groupProps, ref: forwardedRef });
  }
);
MenuGroup.displayName = GROUP_NAME$1;
var LABEL_NAME$1 = "MenuLabel";
var MenuLabel = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeMenu, ...labelProps } = props;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Primitive.div, { ...labelProps, ref: forwardedRef });
  }
);
MenuLabel.displayName = LABEL_NAME$1;
var ITEM_NAME$2 = "MenuItem";
var ITEM_SELECT = "menu.itemSelect";
var MenuItem = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { disabled = false, onSelect, ...itemProps } = props;
    const ref = reactExports.useRef(null);
    const rootContext = useMenuRootContext(ITEM_NAME$2, props.__scopeMenu);
    const contentContext = useMenuContentContext(ITEM_NAME$2, props.__scopeMenu);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const isPointerDownRef = reactExports.useRef(false);
    const handleSelect = () => {
      const menuItem = ref.current;
      if (!disabled && menuItem) {
        const itemSelectEvent = new CustomEvent(ITEM_SELECT, { bubbles: true, cancelable: true });
        menuItem.addEventListener(ITEM_SELECT, (event) => onSelect == null ? void 0 : onSelect(event), { once: true });
        dispatchDiscreteCustomEvent(menuItem, itemSelectEvent);
        if (itemSelectEvent.defaultPrevented) {
          isPointerDownRef.current = false;
        } else {
          rootContext.onClose();
        }
      }
    };
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      MenuItemImpl,
      {
        ...itemProps,
        ref: composedRefs,
        disabled,
        onClick: composeEventHandlers(props.onClick, handleSelect),
        onPointerDown: (event) => {
          var _a;
          (_a = props.onPointerDown) == null ? void 0 : _a.call(props, event);
          isPointerDownRef.current = true;
        },
        onPointerUp: composeEventHandlers(props.onPointerUp, (event) => {
          var _a;
          if (!isPointerDownRef.current) (_a = event.currentTarget) == null ? void 0 : _a.click();
        }),
        onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
          const isTypingAhead = contentContext.searchRef.current !== "";
          if (disabled || isTypingAhead && event.key === " ") return;
          if (SELECTION_KEYS.includes(event.key)) {
            event.currentTarget.click();
            event.preventDefault();
          }
        })
      }
    );
  }
);
MenuItem.displayName = ITEM_NAME$2;
var MenuItemImpl = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeMenu, disabled = false, textValue, ...itemProps } = props;
    const contentContext = useMenuContentContext(ITEM_NAME$2, __scopeMenu);
    const rovingFocusGroupScope = useRovingFocusGroupScope$1(__scopeMenu);
    const ref = reactExports.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    const [isFocused, setIsFocused] = reactExports.useState(false);
    const [textContent, setTextContent] = reactExports.useState("");
    reactExports.useEffect(() => {
      const menuItem = ref.current;
      if (menuItem) {
        setTextContent((menuItem.textContent ?? "").trim());
      }
    }, [itemProps.children]);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Collection.ItemSlot,
      {
        scope: __scopeMenu,
        disabled,
        textValue: textValue ?? textContent,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Item$1, { asChild: true, ...rovingFocusGroupScope, focusable: !disabled, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.div,
          {
            role: "menuitem",
            "data-highlighted": isFocused ? "" : void 0,
            "aria-disabled": disabled || void 0,
            "data-disabled": disabled ? "" : void 0,
            ...itemProps,
            ref: composedRefs,
            onPointerMove: composeEventHandlers(
              props.onPointerMove,
              whenMouse((event) => {
                if (disabled) {
                  contentContext.onItemLeave(event);
                } else {
                  contentContext.onItemEnter(event);
                  if (!event.defaultPrevented) {
                    const item = event.currentTarget;
                    item.focus({ preventScroll: true });
                  }
                }
              })
            ),
            onPointerLeave: composeEventHandlers(
              props.onPointerLeave,
              whenMouse((event) => contentContext.onItemLeave(event))
            ),
            onFocus: composeEventHandlers(props.onFocus, () => setIsFocused(true)),
            onBlur: composeEventHandlers(props.onBlur, () => setIsFocused(false))
          }
        ) })
      }
    );
  }
);
var CHECKBOX_ITEM_NAME$1 = "MenuCheckboxItem";
var MenuCheckboxItem = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { checked = false, onCheckedChange, ...checkboxItemProps } = props;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(ItemIndicatorProvider, { scope: props.__scopeMenu, checked, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      MenuItem,
      {
        role: "menuitemcheckbox",
        "aria-checked": isIndeterminate(checked) ? "mixed" : checked,
        ...checkboxItemProps,
        ref: forwardedRef,
        "data-state": getCheckedState(checked),
        onSelect: composeEventHandlers(
          checkboxItemProps.onSelect,
          () => onCheckedChange == null ? void 0 : onCheckedChange(isIndeterminate(checked) ? true : !checked),
          { checkForDefaultPrevented: false }
        )
      }
    ) });
  }
);
MenuCheckboxItem.displayName = CHECKBOX_ITEM_NAME$1;
var RADIO_GROUP_NAME$1 = "MenuRadioGroup";
var [RadioGroupProvider, useRadioGroupContext] = createMenuContext(
  RADIO_GROUP_NAME$1,
  { value: void 0, onValueChange: () => {
  } }
);
var MenuRadioGroup = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { value, onValueChange, ...groupProps } = props;
    const handleValueChange = useCallbackRef(onValueChange);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(RadioGroupProvider, { scope: props.__scopeMenu, value, onValueChange: handleValueChange, children: /* @__PURE__ */ jsxRuntimeExports.jsx(MenuGroup, { ...groupProps, ref: forwardedRef }) });
  }
);
MenuRadioGroup.displayName = RADIO_GROUP_NAME$1;
var RADIO_ITEM_NAME$1 = "MenuRadioItem";
var MenuRadioItem = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { value, ...radioItemProps } = props;
    const context = useRadioGroupContext(RADIO_ITEM_NAME$1, props.__scopeMenu);
    const checked = value === context.value;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(ItemIndicatorProvider, { scope: props.__scopeMenu, checked, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      MenuItem,
      {
        role: "menuitemradio",
        "aria-checked": checked,
        ...radioItemProps,
        ref: forwardedRef,
        "data-state": getCheckedState(checked),
        onSelect: composeEventHandlers(
          radioItemProps.onSelect,
          () => {
            var _a;
            return (_a = context.onValueChange) == null ? void 0 : _a.call(context, value);
          },
          { checkForDefaultPrevented: false }
        )
      }
    ) });
  }
);
MenuRadioItem.displayName = RADIO_ITEM_NAME$1;
var ITEM_INDICATOR_NAME = "MenuItemIndicator";
var [ItemIndicatorProvider, useItemIndicatorContext] = createMenuContext(
  ITEM_INDICATOR_NAME,
  { checked: false }
);
var MenuItemIndicator = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeMenu, forceMount, ...itemIndicatorProps } = props;
    const indicatorContext = useItemIndicatorContext(ITEM_INDICATOR_NAME, __scopeMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Presence,
      {
        present: forceMount || isIndeterminate(indicatorContext.checked) || indicatorContext.checked === true,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          Primitive.span,
          {
            ...itemIndicatorProps,
            ref: forwardedRef,
            "data-state": getCheckedState(indicatorContext.checked)
          }
        )
      }
    );
  }
);
MenuItemIndicator.displayName = ITEM_INDICATOR_NAME;
var SEPARATOR_NAME$1 = "MenuSeparator";
var MenuSeparator = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeMenu, ...separatorProps } = props;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.div,
      {
        role: "separator",
        "aria-orientation": "horizontal",
        ...separatorProps,
        ref: forwardedRef
      }
    );
  }
);
MenuSeparator.displayName = SEPARATOR_NAME$1;
var ARROW_NAME$1 = "MenuArrow";
var MenuArrow = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeMenu, ...arrowProps } = props;
    const popperScope = usePopperScope(__scopeMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Arrow, { ...popperScope, ...arrowProps, ref: forwardedRef });
  }
);
MenuArrow.displayName = ARROW_NAME$1;
var SUB_NAME = "MenuSub";
var [MenuSubProvider, useMenuSubContext] = createMenuContext(SUB_NAME);
var SUB_TRIGGER_NAME$1 = "MenuSubTrigger";
var MenuSubTrigger = reactExports.forwardRef(
  (props, forwardedRef) => {
    const context = useMenuContext(SUB_TRIGGER_NAME$1, props.__scopeMenu);
    const rootContext = useMenuRootContext(SUB_TRIGGER_NAME$1, props.__scopeMenu);
    const subContext = useMenuSubContext(SUB_TRIGGER_NAME$1, props.__scopeMenu);
    const contentContext = useMenuContentContext(SUB_TRIGGER_NAME$1, props.__scopeMenu);
    const openTimerRef = reactExports.useRef(null);
    const { pointerGraceTimerRef, onPointerGraceIntentChange } = contentContext;
    const scope = { __scopeMenu: props.__scopeMenu };
    const clearOpenTimer = reactExports.useCallback(() => {
      if (openTimerRef.current) window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }, []);
    reactExports.useEffect(() => clearOpenTimer, [clearOpenTimer]);
    reactExports.useEffect(() => {
      const pointerGraceTimer = pointerGraceTimerRef.current;
      return () => {
        window.clearTimeout(pointerGraceTimer);
        onPointerGraceIntentChange(null);
      };
    }, [pointerGraceTimerRef, onPointerGraceIntentChange]);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(MenuAnchor, { asChild: true, ...scope, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      MenuItemImpl,
      {
        id: subContext.triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": context.open,
        "aria-controls": subContext.contentId,
        "data-state": getOpenState(context.open),
        ...props,
        ref: composeRefs(forwardedRef, subContext.onTriggerChange),
        onClick: (event) => {
          var _a;
          (_a = props.onClick) == null ? void 0 : _a.call(props, event);
          if (props.disabled || event.defaultPrevented) return;
          event.currentTarget.focus();
          if (!context.open) context.onOpenChange(true);
        },
        onPointerMove: composeEventHandlers(
          props.onPointerMove,
          whenMouse((event) => {
            contentContext.onItemEnter(event);
            if (event.defaultPrevented) return;
            if (!props.disabled && !context.open && !openTimerRef.current) {
              contentContext.onPointerGraceIntentChange(null);
              openTimerRef.current = window.setTimeout(() => {
                context.onOpenChange(true);
                clearOpenTimer();
              }, 100);
            }
          })
        ),
        onPointerLeave: composeEventHandlers(
          props.onPointerLeave,
          whenMouse((event) => {
            var _a, _b;
            clearOpenTimer();
            const contentRect = (_a = context.content) == null ? void 0 : _a.getBoundingClientRect();
            if (contentRect) {
              const side = (_b = context.content) == null ? void 0 : _b.dataset.side;
              const rightSide = side === "right";
              const bleed = rightSide ? -5 : 5;
              const contentNearEdge = contentRect[rightSide ? "left" : "right"];
              const contentFarEdge = contentRect[rightSide ? "right" : "left"];
              contentContext.onPointerGraceIntentChange({
                area: [
                  // Apply a bleed on clientX to ensure that our exit point is
                  // consistently within polygon bounds
                  { x: event.clientX + bleed, y: event.clientY },
                  { x: contentNearEdge, y: contentRect.top },
                  { x: contentFarEdge, y: contentRect.top },
                  { x: contentFarEdge, y: contentRect.bottom },
                  { x: contentNearEdge, y: contentRect.bottom }
                ],
                side
              });
              window.clearTimeout(pointerGraceTimerRef.current);
              pointerGraceTimerRef.current = window.setTimeout(
                () => contentContext.onPointerGraceIntentChange(null),
                300
              );
            } else {
              contentContext.onTriggerLeave(event);
              if (event.defaultPrevented) return;
              contentContext.onPointerGraceIntentChange(null);
            }
          })
        ),
        onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
          var _a;
          const isTypingAhead = contentContext.searchRef.current !== "";
          if (props.disabled || isTypingAhead && event.key === " ") return;
          if (SUB_OPEN_KEYS[rootContext.dir].includes(event.key)) {
            context.onOpenChange(true);
            (_a = context.content) == null ? void 0 : _a.focus();
            event.preventDefault();
          }
        })
      }
    ) });
  }
);
MenuSubTrigger.displayName = SUB_TRIGGER_NAME$1;
var SUB_CONTENT_NAME$1 = "MenuSubContent";
var MenuSubContent = reactExports.forwardRef(
  (props, forwardedRef) => {
    const portalContext = usePortalContext(CONTENT_NAME$1, props.__scopeMenu);
    const { forceMount = portalContext.forceMount, ...subContentProps } = props;
    const context = useMenuContext(CONTENT_NAME$1, props.__scopeMenu);
    const rootContext = useMenuRootContext(CONTENT_NAME$1, props.__scopeMenu);
    const subContext = useMenuSubContext(SUB_CONTENT_NAME$1, props.__scopeMenu);
    const ref = reactExports.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, ref);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Collection.Provider, { scope: props.__scopeMenu, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Presence, { present: forceMount || context.open, children: /* @__PURE__ */ jsxRuntimeExports.jsx(Collection.Slot, { scope: props.__scopeMenu, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      MenuContentImpl,
      {
        id: subContext.contentId,
        "aria-labelledby": subContext.triggerId,
        ...subContentProps,
        ref: composedRefs,
        align: "start",
        side: rootContext.dir === "rtl" ? "left" : "right",
        disableOutsidePointerEvents: false,
        disableOutsideScroll: false,
        trapFocus: false,
        onOpenAutoFocus: (event) => {
          var _a;
          if (rootContext.isUsingKeyboardRef.current) (_a = ref.current) == null ? void 0 : _a.focus();
          event.preventDefault();
        },
        onCloseAutoFocus: (event) => event.preventDefault(),
        onFocusOutside: composeEventHandlers(props.onFocusOutside, (event) => {
          if (event.target !== subContext.trigger) context.onOpenChange(false);
        }),
        onEscapeKeyDown: composeEventHandlers(props.onEscapeKeyDown, (event) => {
          rootContext.onClose();
          event.preventDefault();
        }),
        onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
          var _a;
          const isKeyDownInside = event.currentTarget.contains(event.target);
          const isCloseKey = SUB_CLOSE_KEYS[rootContext.dir].includes(event.key);
          if (isKeyDownInside && isCloseKey) {
            context.onOpenChange(false);
            (_a = subContext.trigger) == null ? void 0 : _a.focus();
            event.preventDefault();
          }
        })
      }
    ) }) }) });
  }
);
MenuSubContent.displayName = SUB_CONTENT_NAME$1;
function getOpenState(open) {
  return open ? "open" : "closed";
}
function isIndeterminate(checked) {
  return checked === "indeterminate";
}
function getCheckedState(checked) {
  return isIndeterminate(checked) ? "indeterminate" : checked ? "checked" : "unchecked";
}
function focusFirst(candidates) {
  const PREVIOUSLY_FOCUSED_ELEMENT = document.activeElement;
  for (const candidate of candidates) {
    if (candidate === PREVIOUSLY_FOCUSED_ELEMENT) return;
    candidate.focus();
    if (document.activeElement !== PREVIOUSLY_FOCUSED_ELEMENT) return;
  }
}
function wrapArray(array, startIndex) {
  return array.map((_, index) => array[(startIndex + index) % array.length]);
}
function getNextMatch(values, search, currentMatch) {
  const isRepeated = search.length > 1 && Array.from(search).every((char) => char === search[0]);
  const normalizedSearch = isRepeated ? search[0] : search;
  const currentMatchIndex = currentMatch ? values.indexOf(currentMatch) : -1;
  let wrappedValues = wrapArray(values, Math.max(currentMatchIndex, 0));
  const excludeCurrentMatch = normalizedSearch.length === 1;
  if (excludeCurrentMatch) wrappedValues = wrappedValues.filter((v) => v !== currentMatch);
  const nextMatch = wrappedValues.find(
    (value) => value.toLowerCase().startsWith(normalizedSearch.toLowerCase())
  );
  return nextMatch !== currentMatch ? nextMatch : void 0;
}
function isPointInPolygon(point, polygon) {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const ii = polygon[i];
    const jj = polygon[j];
    const xi = ii.x;
    const yi = ii.y;
    const xj = jj.x;
    const yj = jj.y;
    const intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
function isPointerInGraceArea(event, area) {
  if (!area) return false;
  const cursorPos = { x: event.clientX, y: event.clientY };
  return isPointInPolygon(cursorPos, area);
}
function whenMouse(handler) {
  return (event) => event.pointerType === "mouse" ? handler(event) : void 0;
}
var Root3 = Menu;
var Anchor2 = MenuAnchor;
var Portal = MenuPortal;
var Content2$1 = MenuContent;
var Group = MenuGroup;
var Label = MenuLabel;
var Item2$2 = MenuItem;
var CheckboxItem = MenuCheckboxItem;
var RadioGroup = MenuRadioGroup;
var RadioItem = MenuRadioItem;
var ItemIndicator = MenuItemIndicator;
var Separator = MenuSeparator;
var Arrow2 = MenuArrow;
var SubTrigger = MenuSubTrigger;
var SubContent = MenuSubContent;
var DROPDOWN_MENU_NAME = "DropdownMenu";
var [createDropdownMenuContext] = createContextScope(
  DROPDOWN_MENU_NAME,
  [createMenuScope]
);
var useMenuScope = createMenuScope();
var [DropdownMenuProvider, useDropdownMenuContext] = createDropdownMenuContext(DROPDOWN_MENU_NAME);
var DropdownMenu$1 = (props) => {
  const {
    __scopeDropdownMenu,
    children,
    dir,
    open: openProp,
    defaultOpen,
    onOpenChange,
    modal = true
  } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  const triggerRef = reactExports.useRef(null);
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
    caller: DROPDOWN_MENU_NAME
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    DropdownMenuProvider,
    {
      scope: __scopeDropdownMenu,
      triggerId: useId(),
      triggerRef,
      contentId: useId(),
      open,
      onOpenChange: setOpen,
      onOpenToggle: reactExports.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen]),
      modal,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(Root3, { ...menuScope, open, onOpenChange: setOpen, dir, modal, children })
    }
  );
};
DropdownMenu$1.displayName = DROPDOWN_MENU_NAME;
var TRIGGER_NAME = "DropdownMenuTrigger";
var DropdownMenuTrigger$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDropdownMenu, disabled = false, ...triggerProps } = props;
    const context = useDropdownMenuContext(TRIGGER_NAME, __scopeDropdownMenu);
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Anchor2, { asChild: true, ...menuScope, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Primitive.button,
      {
        type: "button",
        id: context.triggerId,
        "aria-haspopup": "menu",
        "aria-expanded": context.open,
        "aria-controls": context.open ? context.contentId : void 0,
        "data-state": context.open ? "open" : "closed",
        "data-disabled": disabled ? "" : void 0,
        disabled,
        ...triggerProps,
        ref: composeRefs(forwardedRef, context.triggerRef),
        onPointerDown: composeEventHandlers(props.onPointerDown, (event) => {
          if (!disabled && event.button === 0 && event.ctrlKey === false) {
            context.onOpenToggle();
            if (!context.open) event.preventDefault();
          }
        }),
        onKeyDown: composeEventHandlers(props.onKeyDown, (event) => {
          if (disabled) return;
          if (["Enter", " "].includes(event.key)) context.onOpenToggle();
          if (event.key === "ArrowDown") context.onOpenChange(true);
          if (["Enter", " ", "ArrowDown"].includes(event.key)) event.preventDefault();
        })
      }
    ) });
  }
);
DropdownMenuTrigger$1.displayName = TRIGGER_NAME;
var PORTAL_NAME = "DropdownMenuPortal";
var DropdownMenuPortal = (props) => {
  const { __scopeDropdownMenu, ...portalProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Portal, { ...menuScope, ...portalProps });
};
DropdownMenuPortal.displayName = PORTAL_NAME;
var CONTENT_NAME = "DropdownMenuContent";
var DropdownMenuContent$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDropdownMenu, ...contentProps } = props;
    const context = useDropdownMenuContext(CONTENT_NAME, __scopeDropdownMenu);
    const menuScope = useMenuScope(__scopeDropdownMenu);
    const hasInteractedOutsideRef = reactExports.useRef(false);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Content2$1,
      {
        id: context.contentId,
        "aria-labelledby": context.triggerId,
        ...menuScope,
        ...contentProps,
        ref: forwardedRef,
        onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
          var _a;
          if (!hasInteractedOutsideRef.current) (_a = context.triggerRef.current) == null ? void 0 : _a.focus();
          hasInteractedOutsideRef.current = false;
          event.preventDefault();
        }),
        onInteractOutside: composeEventHandlers(props.onInteractOutside, (event) => {
          const originalEvent = event.detail.originalEvent;
          const ctrlLeftClick = originalEvent.button === 0 && originalEvent.ctrlKey === true;
          const isRightClick = originalEvent.button === 2 || ctrlLeftClick;
          if (!context.modal || isRightClick) hasInteractedOutsideRef.current = true;
        }),
        style: {
          ...props.style,
          // re-namespace exposed content custom properties
          ...{
            "--radix-dropdown-menu-content-transform-origin": "var(--radix-popper-transform-origin)",
            "--radix-dropdown-menu-content-available-width": "var(--radix-popper-available-width)",
            "--radix-dropdown-menu-content-available-height": "var(--radix-popper-available-height)",
            "--radix-dropdown-menu-trigger-width": "var(--radix-popper-anchor-width)",
            "--radix-dropdown-menu-trigger-height": "var(--radix-popper-anchor-height)"
          }
        }
      }
    );
  }
);
DropdownMenuContent$1.displayName = CONTENT_NAME;
var GROUP_NAME = "DropdownMenuGroup";
var DropdownMenuGroup = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDropdownMenu, ...groupProps } = props;
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Group, { ...menuScope, ...groupProps, ref: forwardedRef });
  }
);
DropdownMenuGroup.displayName = GROUP_NAME;
var LABEL_NAME = "DropdownMenuLabel";
var DropdownMenuLabel$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDropdownMenu, ...labelProps } = props;
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { ...menuScope, ...labelProps, ref: forwardedRef });
  }
);
DropdownMenuLabel$1.displayName = LABEL_NAME;
var ITEM_NAME$1 = "DropdownMenuItem";
var DropdownMenuItem$1 = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDropdownMenu, ...itemProps } = props;
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Item2$2, { ...menuScope, ...itemProps, ref: forwardedRef });
  }
);
DropdownMenuItem$1.displayName = ITEM_NAME$1;
var CHECKBOX_ITEM_NAME = "DropdownMenuCheckboxItem";
var DropdownMenuCheckboxItem = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeDropdownMenu, ...checkboxItemProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(CheckboxItem, { ...menuScope, ...checkboxItemProps, ref: forwardedRef });
});
DropdownMenuCheckboxItem.displayName = CHECKBOX_ITEM_NAME;
var RADIO_GROUP_NAME = "DropdownMenuRadioGroup";
var DropdownMenuRadioGroup = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeDropdownMenu, ...radioGroupProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(RadioGroup, { ...menuScope, ...radioGroupProps, ref: forwardedRef });
});
DropdownMenuRadioGroup.displayName = RADIO_GROUP_NAME;
var RADIO_ITEM_NAME = "DropdownMenuRadioItem";
var DropdownMenuRadioItem = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeDropdownMenu, ...radioItemProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(RadioItem, { ...menuScope, ...radioItemProps, ref: forwardedRef });
});
DropdownMenuRadioItem.displayName = RADIO_ITEM_NAME;
var INDICATOR_NAME = "DropdownMenuItemIndicator";
var DropdownMenuItemIndicator = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeDropdownMenu, ...itemIndicatorProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(ItemIndicator, { ...menuScope, ...itemIndicatorProps, ref: forwardedRef });
});
DropdownMenuItemIndicator.displayName = INDICATOR_NAME;
var SEPARATOR_NAME = "DropdownMenuSeparator";
var DropdownMenuSeparator$1 = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeDropdownMenu, ...separatorProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Separator, { ...menuScope, ...separatorProps, ref: forwardedRef });
});
DropdownMenuSeparator$1.displayName = SEPARATOR_NAME;
var ARROW_NAME = "DropdownMenuArrow";
var DropdownMenuArrow = reactExports.forwardRef(
  (props, forwardedRef) => {
    const { __scopeDropdownMenu, ...arrowProps } = props;
    const menuScope = useMenuScope(__scopeDropdownMenu);
    return /* @__PURE__ */ jsxRuntimeExports.jsx(Arrow2, { ...menuScope, ...arrowProps, ref: forwardedRef });
  }
);
DropdownMenuArrow.displayName = ARROW_NAME;
var SUB_TRIGGER_NAME = "DropdownMenuSubTrigger";
var DropdownMenuSubTrigger = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeDropdownMenu, ...subTriggerProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(SubTrigger, { ...menuScope, ...subTriggerProps, ref: forwardedRef });
});
DropdownMenuSubTrigger.displayName = SUB_TRIGGER_NAME;
var SUB_CONTENT_NAME = "DropdownMenuSubContent";
var DropdownMenuSubContent = reactExports.forwardRef((props, forwardedRef) => {
  const { __scopeDropdownMenu, ...subContentProps } = props;
  const menuScope = useMenuScope(__scopeDropdownMenu);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    SubContent,
    {
      ...menuScope,
      ...subContentProps,
      ref: forwardedRef,
      style: {
        ...props.style,
        // re-namespace exposed content custom properties
        ...{
          "--radix-dropdown-menu-content-transform-origin": "var(--radix-popper-transform-origin)",
          "--radix-dropdown-menu-content-available-width": "var(--radix-popper-available-width)",
          "--radix-dropdown-menu-content-available-height": "var(--radix-popper-available-height)",
          "--radix-dropdown-menu-trigger-width": "var(--radix-popper-anchor-width)",
          "--radix-dropdown-menu-trigger-height": "var(--radix-popper-anchor-height)"
        }
      }
    }
  );
});
DropdownMenuSubContent.displayName = SUB_CONTENT_NAME;
var Root2$1 = DropdownMenu$1;
var Trigger = DropdownMenuTrigger$1;
var Portal2 = DropdownMenuPortal;
var Content2 = DropdownMenuContent$1;
var Label2 = DropdownMenuLabel$1;
var Item2$1 = DropdownMenuItem$1;
var Separator2 = DropdownMenuSeparator$1;
function DropdownMenu({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Root2$1, { "data-slot": "dropdown-menu", ...props });
}
function DropdownMenuTrigger({
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Trigger,
    {
      "data-slot": "dropdown-menu-trigger",
      ...props
    }
  );
}
function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Portal2, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
    Content2,
    {
      "data-slot": "dropdown-menu-content",
      sideOffset,
      className: cn(
        "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
        className
      ),
      ...props
    }
  ) });
}
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Item2$1,
    {
      "data-slot": "dropdown-menu-item",
      "data-inset": inset,
      "data-variant": variant,
      className: cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      ),
      ...props
    }
  );
}
function DropdownMenuLabel({
  className,
  inset,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Label2,
    {
      "data-slot": "dropdown-menu-label",
      "data-inset": inset,
      className: cn(
        "px-2 py-1.5 text-sm font-medium data-[inset]:pl-8",
        className
      ),
      ...props
    }
  );
}
function DropdownMenuSeparator({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Separator2,
    {
      "data-slot": "dropdown-menu-separator",
      className: cn("bg-border -mx-1 my-1 h-px", className),
      ...props
    }
  );
}
var NAME = "Toggle";
var Toggle = reactExports.forwardRef((props, forwardedRef) => {
  const { pressed: pressedProp, defaultPressed, onPressedChange, ...buttonProps } = props;
  const [pressed, setPressed] = useControllableState({
    prop: pressedProp,
    onChange: onPressedChange,
    defaultProp: defaultPressed ?? false,
    caller: NAME
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Primitive.button,
    {
      type: "button",
      "aria-pressed": pressed,
      "data-state": pressed ? "on" : "off",
      "data-disabled": props.disabled ? "" : void 0,
      ...buttonProps,
      ref: forwardedRef,
      onClick: composeEventHandlers(props.onClick, () => {
        if (!props.disabled) {
          setPressed(!pressed);
        }
      })
    }
  );
});
Toggle.displayName = NAME;
var TOGGLE_GROUP_NAME = "ToggleGroup";
var [createToggleGroupContext] = createContextScope(TOGGLE_GROUP_NAME, [
  createRovingFocusGroupScope
]);
var useRovingFocusGroupScope = createRovingFocusGroupScope();
var ToggleGroup$1 = React.forwardRef((props, forwardedRef) => {
  const { type, ...toggleGroupProps } = props;
  if (type === "single") {
    const singleProps = toggleGroupProps;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupImplSingle, { ...singleProps, ref: forwardedRef });
  }
  if (type === "multiple") {
    const multipleProps = toggleGroupProps;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupImplMultiple, { ...multipleProps, ref: forwardedRef });
  }
  throw new Error(`Missing prop \`type\` expected on \`${TOGGLE_GROUP_NAME}\``);
});
ToggleGroup$1.displayName = TOGGLE_GROUP_NAME;
var [ToggleGroupValueProvider, useToggleGroupValueContext] = createToggleGroupContext(TOGGLE_GROUP_NAME);
var ToggleGroupImplSingle = React.forwardRef((props, forwardedRef) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange = () => {
    },
    ...toggleGroupSingleProps
  } = props;
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
    onChange: onValueChange,
    caller: TOGGLE_GROUP_NAME
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    ToggleGroupValueProvider,
    {
      scope: props.__scopeToggleGroup,
      type: "single",
      value: React.useMemo(() => value ? [value] : [], [value]),
      onItemActivate: setValue,
      onItemDeactivate: React.useCallback(() => setValue(""), [setValue]),
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupImpl, { ...toggleGroupSingleProps, ref: forwardedRef })
    }
  );
});
var ToggleGroupImplMultiple = React.forwardRef((props, forwardedRef) => {
  const {
    value: valueProp,
    defaultValue,
    onValueChange = () => {
    },
    ...toggleGroupMultipleProps
  } = props;
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? [],
    onChange: onValueChange,
    caller: TOGGLE_GROUP_NAME
  });
  const handleButtonActivate = React.useCallback(
    (itemValue) => setValue((prevValue = []) => [...prevValue, itemValue]),
    [setValue]
  );
  const handleButtonDeactivate = React.useCallback(
    (itemValue) => setValue((prevValue = []) => prevValue.filter((value2) => value2 !== itemValue)),
    [setValue]
  );
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    ToggleGroupValueProvider,
    {
      scope: props.__scopeToggleGroup,
      type: "multiple",
      value,
      onItemActivate: handleButtonActivate,
      onItemDeactivate: handleButtonDeactivate,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupImpl, { ...toggleGroupMultipleProps, ref: forwardedRef })
    }
  );
});
ToggleGroup$1.displayName = TOGGLE_GROUP_NAME;
var [ToggleGroupContext$1, useToggleGroupContext] = createToggleGroupContext(TOGGLE_GROUP_NAME);
var ToggleGroupImpl = React.forwardRef(
  (props, forwardedRef) => {
    const {
      __scopeToggleGroup,
      disabled = false,
      rovingFocus = true,
      orientation,
      dir,
      loop = true,
      ...toggleGroupProps
    } = props;
    const rovingFocusGroupScope = useRovingFocusGroupScope(__scopeToggleGroup);
    const direction = useDirection(dir);
    const commonProps = { role: "group", dir: direction, ...toggleGroupProps };
    return /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupContext$1, { scope: __scopeToggleGroup, rovingFocus, disabled, children: rovingFocus ? /* @__PURE__ */ jsxRuntimeExports.jsx(
      Root$1,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        orientation,
        dir: direction,
        loop,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(Primitive.div, { ...commonProps, ref: forwardedRef })
      }
    ) : /* @__PURE__ */ jsxRuntimeExports.jsx(Primitive.div, { ...commonProps, ref: forwardedRef }) });
  }
);
var ITEM_NAME = "ToggleGroupItem";
var ToggleGroupItem$1 = React.forwardRef(
  (props, forwardedRef) => {
    const valueContext = useToggleGroupValueContext(ITEM_NAME, props.__scopeToggleGroup);
    const context = useToggleGroupContext(ITEM_NAME, props.__scopeToggleGroup);
    const rovingFocusGroupScope = useRovingFocusGroupScope(props.__scopeToggleGroup);
    const pressed = valueContext.value.includes(props.value);
    const disabled = context.disabled || props.disabled;
    const commonProps = { ...props, pressed, disabled };
    const ref = React.useRef(null);
    return context.rovingFocus ? /* @__PURE__ */ jsxRuntimeExports.jsx(
      Item$1,
      {
        asChild: true,
        ...rovingFocusGroupScope,
        focusable: !disabled,
        active: pressed,
        ref,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupItemImpl, { ...commonProps, ref: forwardedRef })
      }
    ) : /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupItemImpl, { ...commonProps, ref: forwardedRef });
  }
);
ToggleGroupItem$1.displayName = ITEM_NAME;
var ToggleGroupItemImpl = React.forwardRef(
  (props, forwardedRef) => {
    const { __scopeToggleGroup, value, ...itemProps } = props;
    const valueContext = useToggleGroupValueContext(ITEM_NAME, __scopeToggleGroup);
    const singleProps = { role: "radio", "aria-checked": props.pressed, "aria-pressed": void 0 };
    const typeProps = valueContext.type === "single" ? singleProps : void 0;
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      Toggle,
      {
        ...typeProps,
        ...itemProps,
        ref: forwardedRef,
        onPressedChange: (pressed) => {
          if (pressed) {
            valueContext.onItemActivate(value);
          } else {
            valueContext.onItemDeactivate(value);
          }
        }
      }
    );
  }
);
var Root2 = ToggleGroup$1;
var Item2 = ToggleGroupItem$1;
const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
const ToggleGroupContext = reactExports.createContext({
  size: "default",
  variant: "default"
});
function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Root2,
    {
      "data-slot": "toggle-group",
      "data-variant": variant,
      "data-size": size,
      className: cn(
        "group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs",
        className
      ),
      ...props,
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(ToggleGroupContext.Provider, { value: { variant, size }, children })
    }
  );
}
function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}) {
  const context = reactExports.useContext(ToggleGroupContext);
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Item2,
    {
      "data-slot": "toggle-group-item",
      "data-variant": context.variant || variant,
      "data-size": context.size || size,
      className: cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size
        }),
        "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        className
      ),
      ...props,
      children
    }
  );
}
const PLACEHOLDERS = [
  {
    token: "{{rechnungsnummer}}",
    label: "Rechnungsnummer",
    description: "Eindeutige Rechnungsnummer (z. B. RE-2026-0001)"
  },
  {
    token: "{{rechnungsdatum}}",
    label: "Rechnungsdatum",
    description: "Datum der Rechnungsausstellung (dd.mm.yyyy)"
  },
  {
    token: "{{leistungszeitraum}}",
    label: "Leistungszeitraum",
    description: "Zeitraum der abgerechneten Leistungen (von – bis)"
  },
  {
    token: "{{kanzlei_name}}",
    label: "Kanzleiname",
    description: "Name der Kanzlei (Absender)"
  },
  {
    token: "{{kanzlei_adresse}}",
    label: "Kanzleiadresse",
    description: "Adresse der Kanzlei (Absender)"
  },
  {
    token: "{{empfaenger_name}}",
    label: "Empfängername",
    description: "Name des Mandanten / Empfänger"
  },
  {
    token: "{{empfaenger_adresse}}",
    label: "Empfängeradresse",
    description: "Adresse des Mandanten / Empfänger"
  },
  {
    token: "{{mandat_bezeichnung}}",
    label: "Mandatsbezeichnung",
    description: "Bezeichnung des Mandats"
  },
  {
    token: "{{leistungserbringer}}",
    label: "Leistungserbringer",
    description: "Name des leistungserbringers (Anwalt)"
  },
  {
    token: "{{zahlungsbedingungen}}",
    label: "Zahlungsbedingungen",
    description: "Zahlungsbedingungen des Mandats"
  },
  {
    token: "{{subtotal}}",
    label: "Subtotal",
    description: "Subtotal vor MWST (5-Rappen-gerundet)"
  },
  {
    token: "{{mwst_satz}}",
    label: "MWST-Satz",
    description: "Angewendeter MWST-Satz in Prozent"
  },
  {
    token: "{{mwst_betrag}}",
    label: "MWST-Betrag",
    description: "MWST-Betrag (5-Rappen-gerundet)"
  },
  {
    token: "{{total}}",
    label: "Total",
    description: "Rechnungstotal inkl. MWST (5-Rappen-gerundet)"
  }
];
const POSITION_OPTIONS = [
  { value: Position.links, label: "Links", icon: /* @__PURE__ */ jsxRuntimeExports.jsx(AlignLeft, { size: 14 }) },
  {
    value: Position.zentriert,
    label: "Zentriert",
    icon: /* @__PURE__ */ jsxRuntimeExports.jsx(AlignCenter, { size: 14 })
  },
  { value: Position.rechts, label: "Rechts", icon: /* @__PURE__ */ jsxRuntimeExports.jsx(AlignRight, { size: 14 }) }
];
function cloneLayoutV2(layout) {
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
      zOrder: el.zOrder
    }))
  };
}
function ensureLayoutV2(vorlage) {
  if (vorlage.layoutV2) {
    const cloned = cloneLayoutV2(vorlage.layoutV2);
    if (!cloned.elements.some((el) => el.id === SCHLUSSTEXT_ELEMENT_ID)) {
      const defaultSchluss = DEFAULT_LAYOUT_V2.elements.find(
        (el) => el.id === SCHLUSSTEXT_ELEMENT_ID
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
            zOrder: defaultSchluss.zOrder
          }
        ];
      }
    }
    return cloned;
  }
  return cloneLayoutV2(DEFAULT_LAYOUT_V2);
}
function normalizeLayoutV2ForSave(layout) {
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
      alignment: el.alignment || void 0,
      fontFamily: el.fontFamily || void 0,
      fontSize: el.fontSize || void 0,
      bold: el.bold || void 0,
      italic: el.italic || void 0,
      xMm: el.xMm || void 0,
      yMm: el.yMm || void 0,
      widthMm: el.widthMm || void 0,
      heightMm: el.heightMm || void 0,
      zOrder: el.zOrder || void 0
    }))
  };
}
function SectionCard({
  title,
  description,
  ocid,
  icon,
  children,
  action
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": ocid, className: "gap-0 py-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3 px-5 py-4 border-b border-border", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3 min-w-0", children: [
        icon && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", children: icon }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display font-semibold text-foreground text-base leading-tight", children: title }),
          description && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: description })
        ] })
      ] }),
      action && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "shrink-0", children: action })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "px-5 py-5", children })
  ] });
}
function ElementCombobox({
  layoutV2,
  onToggleVisible,
  onSelect,
  selectedId
}) {
  const sorted = reactExports.useMemo(
    () => [...layoutV2.elements].sort((a, b) => Number(a.order) - Number(b.order)),
    [layoutV2.elements]
  );
  const selected = sorted.find((el) => el.id === selectedId) ?? null;
  const selectedLabel = selected ? layoutElementIdToString(selected.id) : "Element auswählen";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      Label$1,
      {
        htmlFor: "element-combobox",
        className: "text-xs font-medium text-foreground uppercase tracking-wide",
        children: "Element"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Select,
        {
          value: selectedId ?? "",
          onValueChange: (v) => {
            if (v) onSelect(v);
          },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              SelectTrigger,
              {
                id: "element-combobox",
                "data-ocid": "rechnungsvorlagen.element_combobox",
                className: "h-9 flex-1 text-sm",
                "aria-label": "Element auswählen",
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Element auswählen", children: selectedLabel })
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { "data-ocid": "rechnungsvorlagen.element_combobox_list", children: sorted.map((el) => {
              const label = layoutElementIdToString(el.id);
              return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                SelectItem,
                {
                  value: el.id,
                  "data-ocid": `rechnungsvorlagen.element_combobox_item.${el.id}`,
                  className: "flex items-center justify-between gap-2",
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-2 min-w-0", children: [
                      !el.visible && /* @__PURE__ */ jsxRuntimeExports.jsx(
                        Eye,
                        {
                          size: 12,
                          className: "shrink-0 text-muted-foreground/60",
                          "aria-hidden": true
                        }
                      ),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "truncate", children: label })
                    ] }),
                    !el.visible && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70", children: "ausgeblendet" })
                  ]
                },
                el.id
              );
            }) })
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        Button,
        {
          type: "button",
          variant: "outline",
          size: "sm",
          className: "h-9 shrink-0 px-2.5",
          disabled: !selected,
          "data-ocid": selected ? `rechnungsvorlagen.toggle_visible.${selected.id}` : "rechnungsvorlagen.toggle_visible.disabled",
          "aria-label": selected ? selected.visible ? `${layoutElementIdToString(selected.id)} ausblenden` : `${layoutElementIdToString(selected.id)} einblenden` : "Sichtbarkeit umschalten",
          "aria-pressed": selected ? selected.visible : false,
          onClick: () => {
            if (selected) onToggleVisible(selected.id);
          },
          children: (selected == null ? void 0 : selected.visible) ? /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { size: 15 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(EyeOff, { size: 15 })
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground leading-snug", children: selected ? selected.visible ? "Aktives Element ist sichtbar. Auge blendet es aus." : "Aktives Element ist ausgeblendet. Auge blendet es ein." : "Wählen Sie ein Element aus der Liste oder auf der Leinwand." })
  ] });
}
const GEOMETRY_FIELDS = [
  { key: "xMm", label: "X (mm)", ocid: "element_xmm" },
  { key: "yMm", label: "Y (mm)", ocid: "element_ymm" },
  { key: "widthMm", label: "Breite (mm)", ocid: "element_widthmm" },
  { key: "heightMm", label: "Höhe (mm)", ocid: "element_heightmm" }
];
function LayoutPositionControls({
  element,
  onUpdateAlignment,
  onMoveOrder,
  onUpdateGeometry
}) {
  if (!element) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Kein Element ausgewählt — Ausrichtung und Reihenfolge erst nach Auswahl verfügbar." });
  }
  const label = layoutElementIdToString(element.id);
  const currentAlignment = element.alignment ?? Position.links;
  const geometryValues = {
    xMm: element.xMm ?? 0,
    yMm: element.yMm ?? 0,
    widthMm: element.widthMm ?? 0,
    heightMm: element.heightMm ?? 0
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Label$1, { className: "text-sm font-medium text-foreground", children: "Position & Grösse" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-2 gap-3", children: GEOMETRY_FIELDS.map((f) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Label$1,
          {
            htmlFor: `prop-${f.key}-${element.id}`,
            className: "text-xs text-muted-foreground",
            children: f.label
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Input,
          {
            id: `prop-${f.key}-${element.id}`,
            type: "number",
            inputMode: "decimal",
            step: 0.1,
            min: 0,
            value: geometryValues[f.key],
            "data-ocid": `rechnungsvorlagen.${f.ocid}.${element.id}`,
            onChange: (e) => {
              const n = Number.parseFloat(e.target.value);
              if (!Number.isFinite(n)) return;
              const clamped = Math.max(0, n);
              onUpdateGeometry(element.id, { [f.key]: clamped });
            },
            className: "h-9 text-sm tabular-nums",
            "aria-label": `${f.label} für ${label}`
          }
        )
      ] }, f.key)) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Position (X, Y) und Grösse (Breite, Höhe) in Millimetern. Live synchron mit Drag & Drop auf der Leinwand — beide Quellen zeigen denselben Wert." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Label$1, { className: "text-sm font-medium text-foreground", children: "Ausrichtung" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        ToggleGroup,
        {
          type: "single",
          value: currentAlignment,
          onValueChange: (v) => {
            if (v) onUpdateAlignment(element.id, v);
          },
          variant: "outline",
          className: "w-full",
          "data-ocid": `rechnungsvorlagen.element_alignment.${element.id}`,
          "aria-label": `Ausrichtung für ${label}`,
          children: POSITION_OPTIONS.map((opt) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
            ToggleGroupItem,
            {
              value: opt.value,
              className: "flex-1 gap-1.5",
              "aria-label": opt.label,
              children: [
                opt.icon,
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", children: opt.label })
              ]
            },
            opt.value
          ))
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Steuert die Textausrichtung innerhalb des Elements." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Label$1, { className: "text-sm font-medium text-foreground", children: "Reihenfolge" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            className: "gap-1.5",
            "data-ocid": `rechnungsvorlagen.element_order_up.${element.id}`,
            onClick: () => onMoveOrder(element.id, "up"),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(AlignLeft, { size: 14, className: "rotate-90" }),
              "Früher"
            ]
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            className: "gap-1.5",
            "data-ocid": `rechnungsvorlagen.element_order_down.${element.id}`,
            onClick: () => onMoveOrder(element.id, "down"),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(AlignLeft, { size: 14, className: "-rotate-90" }),
              "Später"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Bestimmt die Stapelreihenfolge (z-index) und den Dokumentfluss." })
    ] })
  ] });
}
function TypographyControls({
  element,
  onUpdateTypography
}) {
  if (!element) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Kein Element ausgewählt — Typografie erst nach Auswahl verfügbar." });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Label$1,
          {
            htmlFor: `prop-fontfamily-${element.id}`,
            className: "text-xs text-muted-foreground",
            children: "Schriftart"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Select,
          {
            value: element.fontFamily ?? "",
            onValueChange: (v) => onUpdateTypography(element.id, {
              fontFamily: v || void 0
            }),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                SelectTrigger,
                {
                  id: `prop-fontfamily-${element.id}`,
                  "data-ocid": `rechnungsvorlagen.element_fontfamily.${element.id}`,
                  className: "h-8 text-sm",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Standard" })
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: ALLOWED_FONT_FAMILIES.map((fam) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: fam, children: fam }, fam)) })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Label$1,
          {
            htmlFor: `prop-fontsize-${element.id}`,
            className: "text-xs text-muted-foreground",
            children: "Schriftgrösse"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Select,
          {
            value: element.fontSize ? String(Number(element.fontSize)) : "",
            onValueChange: (v) => onUpdateTypography(element.id, { fontSize: BigInt(v) }),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                SelectTrigger,
                {
                  id: `prop-fontsize-${element.id}`,
                  "data-ocid": `rechnungsvorlagen.element_fontsize.${element.id}`,
                  className: "h-8 text-sm",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, { placeholder: "Standard" })
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: ALLOWED_FONT_SIZES.map((sz) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: String(sz), children: `${sz} pt` }, sz)) })
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          type: "button",
          variant: element.bold ? "default" : "outline",
          size: "sm",
          className: "gap-1.5",
          "data-ocid": `rechnungsvorlagen.element_bold.${element.id}`,
          "aria-pressed": element.bold ?? false,
          onClick: () => onUpdateTypography(element.id, { bold: !element.bold }),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-bold", children: "F" }),
            "Fett"
          ]
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Button,
        {
          type: "button",
          variant: element.italic ? "default" : "outline",
          size: "sm",
          className: "gap-1.5",
          "data-ocid": `rechnungsvorlagen.element_italic.${element.id}`,
          "aria-pressed": element.italic ?? false,
          onClick: () => onUpdateTypography(element.id, { italic: !element.italic }),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "italic", children: "I" }),
            "Kursiv"
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Schriftart, -grösse und Schnitt für dieses Element. Leer = Standard (Arial, 12 pt, regulär). Die Live-Vorschau aktualisiert sich sofort." })
  ] });
}
function PlaceholderInsert({
  onInsert,
  ocid,
  disabled
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      Button,
      {
        type: "button",
        variant: "outline",
        size: "sm",
        className: "gap-1.5 h-8",
        disabled,
        "data-ocid": ocid,
        "aria-label": "Platzhalter einfügen",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { size: 14 }),
          "Platzhalter einfügen"
        ]
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "start", className: "w-72", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuLabel, { children: "Platzhalter auswählen" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
      PLACEHOLDERS.map((ph) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        DropdownMenuItem,
        {
          "data-ocid": `rechnungsvorlagen.placeholder_item.${ph.token.replace(/[{}]/g, "")}`,
          onClick: () => onInsert(ph.token),
          className: "flex items-start gap-2 py-2",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: "shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary", children: ph.token }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground leading-snug", children: ph.label })
          ]
        },
        ph.token
      ))
    ] })
  ] });
}
function SaveStatusBadge({ status }) {
  const config = {
    idle: {
      label: "Bereit",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { size: 14 }),
      cls: "bg-muted text-muted-foreground"
    },
    dirty: {
      label: "Ungespeicherte Änderungen",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { size: 14 }),
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
    },
    saving: {
      label: "Speichern…",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { size: 14, className: "animate-spin" }),
      cls: "bg-info/10 text-info"
    },
    saved: {
      label: "Vorlage gespeichert",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { size: 14 }),
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
    },
    error: {
      label: "Speichern fehlgeschlagen",
      icon: /* @__PURE__ */ jsxRuntimeExports.jsx(CircleAlert, { size: 14 }),
      cls: "bg-destructive/10 text-destructive"
    }
  };
  const c = config[status];
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "output",
    {
      "data-ocid": "rechnungsvorlagen.save_status",
      className: `inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${c.cls}`,
      children: [
        c.icon,
        c.label
      ]
    }
  );
}
function RechnungsvorlagenPage() {
  const { data: savedVorlage, isLoading } = useRechnungsvorlage();
  const { data: kanzlei } = useKanzlei();
  const saveMut = useSaveRechnungsvorlage();
  const uploadMut = useUploadLogo();
  const removeMut = useRemoveLogo();
  const { data: logoBlob } = useGetLogo();
  const { data: stammdaten } = useGetKanzleiStammdaten();
  const [vorlage, setVorlage] = reactExports.useState(DEFAULT_VORLAGE);
  const [layoutV2, setLayoutV2] = reactExports.useState(
    cloneLayoutV2(DEFAULT_LAYOUT_V2)
  );
  const [logoUrl, setLogoUrl] = reactExports.useState(null);
  const [logoFileName, setLogoFileName] = reactExports.useState(null);
  const [uploadError, setUploadError] = reactExports.useState(null);
  const [selectedElementId, setSelectedElementId] = reactExports.useState(null);
  const [zoom, setZoom] = reactExports.useState("fit");
  const [preview, setPreview] = reactExports.useState(false);
  const [saveStatus, setSaveStatus] = reactExports.useState("idle");
  const [activeField, setActiveField] = reactExports.useState(
    null
  );
  const fieldRefs = reactExports.useRef({
    rechnungstitel: null,
    einleitung: null,
    zahlungshinweis: null,
    schlusstext: null
  });
  reactExports.useEffect(() => {
    if (savedVorlage) {
      setVorlage(savedVorlage);
      setLayoutV2(ensureLayoutV2(savedVorlage));
    } else if (!isLoading) {
      setVorlage(DEFAULT_VORLAGE);
      setLayoutV2(cloneLayoutV2(DEFAULT_LAYOUT_V2));
    }
  }, [savedVorlage, isLoading]);
  reactExports.useEffect(() => {
    if (!logoBlob) {
      return;
    }
    let revoked = false;
    let createdUrl = null;
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
  function updateLayout(patch) {
    setVorlage((v) => ({ ...v, layout: { ...v.layout, ...patch } }));
    setSaveStatus("dirty");
  }
  function updateText(field, value) {
    setVorlage((v) => ({
      ...v,
      standardtexte: { ...v.standardtexte, [field]: value }
    }));
    setSaveStatus("dirty");
  }
  function updateElement(id, patch) {
    setLayoutV2((prev) => ({
      ...prev,
      elements: prev.elements.map(
        (el) => el.id === id ? { ...el, ...patch } : el
      )
    }));
    setSaveStatus("dirty");
  }
  function updateMargins(patch) {
    setLayoutV2((prev) => ({ ...prev, ...patch }));
    setSaveStatus("dirty");
  }
  function handleCommitDrag(id, patch) {
    updateElement(id, patch);
  }
  function handleCommitResize(id, patch) {
    updateElement(id, patch);
  }
  function handleToggleVisible(id) {
    setLayoutV2((prev) => ({
      ...prev,
      elements: prev.elements.map(
        (el) => el.id === id ? { ...el, visible: !el.visible } : el
      )
    }));
    setSaveStatus("dirty");
  }
  function handleUpdateAlignment(id, alignment) {
    updateElement(id, { alignment });
  }
  function handleUpdateTypography(id, patch) {
    updateElement(id, patch);
  }
  function handleUpdateGeometry(id, patch) {
    updateElement(id, patch);
  }
  function handleMoveOrder(id, direction) {
    setLayoutV2((prev) => {
      const sorted = [...prev.elements].sort(
        (a2, b2) => Number(a2.order) - Number(b2.order)
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
        })
      };
    });
    setSaveStatus("dirty");
  }
  function handleSave() {
    const authoritativeKanzleiId = (kanzlei == null ? void 0 : kanzlei.id) ?? vorlage.kanzleiId ?? "";
    if (!authoritativeKanzleiId) {
      const msg = "Kanzlei konnte nicht geladen werden — Speichern nicht möglich. Bitte Seite neu laden.";
      setSaveStatus("error");
      console.error("[RechnungsvorlagenPage] Save aborted: kanzleiId missing");
      ue.error(msg);
      return;
    }
    const toSave = {
      ...vorlage,
      kanzleiId: authoritativeKanzleiId,
      layoutV2: normalizeLayoutV2ForSave(layoutV2)
    };
    setSaveStatus("saving");
    saveMut.mutate(toSave, {
      onSuccess: (res) => {
        if (res && typeof res === "object" && "__kind__" in res && res.__kind__ === "err") {
          const errMsg = res.err || "Speichern fehlgeschlagen";
          setSaveStatus("error");
          console.error(
            "[RechnungsvorlagenPage] saveRechnungsvorlage returned #err:",
            errMsg
          );
          ue.error(errMsg);
        } else {
          setSaveStatus("saved");
          ue.success("Vorlage gespeichert");
        }
      },
      onError: (e) => {
        const errMsg = e.message || "Speichern fehlgeschlagen";
        setSaveStatus("error");
        console.error(
          "[RechnungsvorlagenPage] saveRechnungsvorlage threw:",
          errMsg
        );
        ue.error(errMsg);
      }
    });
  }
  async function handleLogoUpload(e) {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Bitte eine Bilddatei auswählen (PNG, JPG, SVG).");
      ue.error("Ungültiger Dateityp");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setLogoUrl(localUrl);
    setLogoFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await uploadMut.mutateAsync(bytes);
      ue.success("Logo hochgeladen");
      setSaveStatus("dirty");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Upload fehlgeschlagen"
      );
      setLogoUrl(null);
      setLogoFileName(null);
      ue.error("Logo-Upload fehlgeschlagen");
    }
    e.target.value = "";
  }
  function handleRemoveLogo() {
    removeMut.mutate(void 0, {
      onSuccess: (res) => {
        if (res && typeof res === "object" && "__kind__" in res && res.__kind__ === "err") {
          ue.error(
            res.err || "Entfernen fehlgeschlagen"
          );
        } else {
          setLogoUrl(null);
          setLogoFileName(null);
          setVorlage((v) => ({ ...v, logoBlob: void 0 }));
          setSaveStatus("dirty");
          ue.success("Logo entfernt");
        }
      },
      onError: (e) => ue.error(e.message || "Entfernen fehlgeschlagen")
    });
  }
  function insertPlaceholder(token) {
    if (!activeField) {
      updateText("einleitung", `${vorlage.standardtexte.einleitung} ${token}`);
      ue.info(`Platzhalter ${token} zur Einleitung hinzugefügt`);
      return;
    }
    const el = fieldRefs.current[activeField];
    if (el && (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) {
      const start = el.selectionStart ?? vorlage.standardtexte[activeField].length;
      const end = el.selectionEnd ?? start;
      const current = vorlage.standardtexte[activeField];
      const next = current.slice(0, start) + token + current.slice(end);
      updateText(activeField, next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      updateText(activeField, `${vorlage.standardtexte[activeField]} ${token}`);
    }
  }
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        "data-ocid": "rechnungsvorlagen.loading_state",
        className: "p-6 space-y-6 max-w-7xl mx-auto",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-10 w-64" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-40 w-full" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-32 w-full" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-48 w-full" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-[600px] w-full" })
          ] })
        ]
      }
    );
  }
  const hasLogo = !!logoBlob || !!logoUrl;
  const isSaving = saveMut.isPending;
  const isUploading = uploadMut.isPending;
  const isRemoving = removeMut.isPending;
  const selectedElement = layoutV2.elements.find((el) => el.id === selectedElementId) ?? null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      "data-ocid": "rechnungsvorlagen.page",
      className: "p-4 sm:p-6 space-y-6 max-w-7xl mx-auto",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-7xl mx-auto", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display font-bold text-foreground text-xl tracking-tight", children: "Rechnungsvorlage" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Gestalten Sie das Layout Ihrer Rechnungen — Elemente per Drag & Drop anordnen, Logo und Texte pflegen. Pro Kanzlei existiert genau eine Vorlage." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 shrink-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(SaveStatusBadge, { status: saveStatus }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                "data-ocid": "rechnungsvorlagen.save_button",
                className: "btn-primary gap-2",
                onClick: handleSave,
                disabled: isSaving,
                children: [
                  isSaving ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { size: 16, className: "animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { size: 16 }),
                  "Vorlage speichern"
                ]
              }
            )
          ] })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3 flex-wrap", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            ToggleGroup,
            {
              type: "single",
              value: preview ? "vorschau" : "bearbeiten",
              onValueChange: (v) => setPreview(v === "vorschau"),
              variant: "outline",
              className: "w-auto",
              "data-ocid": "rechnungsvorlagen.mode_toggle",
              "aria-label": "Bearbeiten oder Vorschau",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  ToggleGroupItem,
                  {
                    value: "bearbeiten",
                    className: "gap-1.5",
                    "aria-label": "Bearbeiten",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(AlignLeft, { size: 14 }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", children: "Bearbeiten" })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  ToggleGroupItem,
                  {
                    value: "vorschau",
                    className: "gap-1.5",
                    "aria-label": "Vorschau",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Eye, { size: 14 }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs", children: "Vorschau" })
                    ]
                  }
                )
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: preview ? "Vorschau — realistische Rechnung ohne Bearbeitungs-Handles." : "Bearbeiten — Elemente per Drag & Drop verschieben und in der Grösse ändern." })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
            SectionCard,
            {
              ocid: "rechnungsvorlagen.canvas_section",
              title: "A4-Leinwand",
              description: preview ? "Realistische Rechnungsvorschau — keine Bearbeitungs-Handles." : "Elemente per Drag & Drop verschieben und in der Grösse ändern. mm-genau.",
              icon: /* @__PURE__ */ jsxRuntimeExports.jsx(AlignLeft, { size: 16 }),
              action: /* @__PURE__ */ jsxRuntimeExports.jsx(ZoomControl, { zoom, onChange: setZoom }),
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  LayoutCanvas,
                  {
                    layoutV2,
                    selectedId: selectedElementId,
                    onSelect: setSelectedElementId,
                    onCommitDrag: handleCommitDrag,
                    onCommitResize: handleCommitResize,
                    vorlage,
                    logoUrl,
                    zoom,
                    preview,
                    stammdaten: stammdaten ?? null
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-xs text-muted-foreground", children: preview ? "Die Vorschau zeigt das zu erwartende PDF-/Word-Layout gemäss der aktuellen V2-Konfiguration. Wechseln Sie zu „Bearbeiten“, um Elemente zu verschieben." : "Tipp: Greifen Sie den Griff oben links, um ein Element zu verschieben. Tippen Sie auf ein Element, um es auszuwählen — dann erscheinen 8 Anfasser an den Rändern zum Ändern der Grösse. Der gestrichelte Rahmen markiert den Druckbereich (Safe Area)." })
              ]
            }
          ) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4 xl:sticky xl:top-24", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              SectionCard,
              {
                ocid: "rechnungsvorlagen.elements_section",
                title: "Element",
                description: "Aktives Element auswählen — Sichtbarkeit über das Auge.",
                icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { size: 16 }),
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  ElementCombobox,
                  {
                    layoutV2,
                    onToggleVisible: handleToggleVisible,
                    onSelect: setSelectedElementId,
                    selectedId: selectedElementId
                  }
                )
              }
            ),
            selectedElement ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Accordion,
              {
                type: "multiple",
                defaultValue: ["inspector-layout"],
                className: "space-y-3",
                "data-ocid": "rechnungsvorlagen.inspector_properties",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    AccordionItem,
                    {
                      value: "inspector-layout",
                      "data-ocid": "rechnungsvorlagen.layout_position_section",
                      className: "rounded-lg border border-border bg-card px-0",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionTrigger, { className: "px-4 py-3 hover:no-underline", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AlignRight, { size: 15 }) }),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-left min-w-0", children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display font-semibold text-foreground text-sm leading-tight", children: "Layout & Position" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5 leading-snug", children: "Ausrichtung und Reihenfolge." })
                          ] })
                        ] }) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionContent, { className: "px-4 pb-4 pt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                          LayoutPositionControls,
                          {
                            element: selectedElement,
                            onUpdateAlignment: handleUpdateAlignment,
                            onMoveOrder: handleMoveOrder,
                            onUpdateGeometry: handleUpdateGeometry
                          }
                        ) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    AccordionItem,
                    {
                      value: "inspector-typography",
                      "data-ocid": "rechnungsvorlagen.typography_section",
                      className: "rounded-lg border border-border bg-card px-0",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionTrigger, { className: "px-4 py-3 hover:no-underline", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", children: /* @__PURE__ */ jsxRuntimeExports.jsx(FileText, { size: 15 }) }),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-left min-w-0", children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display font-semibold text-foreground text-sm leading-tight", children: "Typografie" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5 leading-snug", children: "Schriftart, Schriftgrösse und Stil." })
                          ] })
                        ] }) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionContent, { className: "px-4 pb-4 pt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                          TypographyControls,
                          {
                            element: selectedElement,
                            onUpdateTypography: handleUpdateTypography
                          }
                        ) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                    AccordionItem,
                    {
                      value: "inspector-content",
                      "data-ocid": "rechnungsvorlagen.content_section",
                      className: "rounded-lg border border-border bg-card px-0",
                      children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionTrigger, { className: "px-4 py-3 hover:no-underline", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Image, { size: 15 }) }),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-left min-w-0", children: [
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display font-semibold text-foreground text-sm leading-tight", children: "Inhalte" }),
                            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5 leading-snug", children: "Logo & Absender, Rechnungstexte, Platzhalter." })
                          ] })
                        ] }) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionContent, { className: "px-4 pb-4 pt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsxs(
                            "div",
                            {
                              "data-ocid": "rechnungsvorlagen.logo_section",
                              className: "rounded-md border border-border bg-muted/20 p-3",
                              children: [
                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
                                  hasLogo && logoUrl ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                                    "img",
                                    {
                                      src: logoUrl,
                                      alt: "Logo-Vorschau",
                                      "data-ocid": "rechnungsvorlagen.logo_preview",
                                      className: "h-10 w-10 shrink-0 object-contain rounded border border-border bg-white"
                                    }
                                  ) : hasLogo ? /* @__PURE__ */ jsxRuntimeExports.jsx(
                                    "div",
                                    {
                                      "data-ocid": "rechnungsvorlagen.logo_preview",
                                      className: "flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-white",
                                      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                                        Image,
                                        {
                                          size: 16,
                                          className: "text-muted-foreground"
                                        }
                                      )
                                    }
                                  ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-border bg-card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                                    Image,
                                    {
                                      size: 16,
                                      className: "text-muted-foreground"
                                    }
                                  ) }),
                                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
                                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground truncate", children: hasLogo ? logoFileName ?? "Gespeichertes Logo" : "Kein Logo" }),
                                    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground truncate", children: hasLogo ? "Gemäss Layout-Position platziert." : "PNG, JPG, SVG — max. 180×60 px." })
                                  ] })
                                ] }),
                                isUploading && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                  "div",
                                  {
                                    "data-ocid": "rechnungsvorlagen.upload_progress",
                                    className: "mt-2 flex items-center gap-2 rounded bg-info/10 px-2.5 py-1.5 text-xs text-info",
                                    children: [
                                      /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { size: 12, className: "animate-spin" }),
                                      "Logo wird hochgeladen…"
                                    ]
                                  }
                                ),
                                uploadError && /* @__PURE__ */ jsxRuntimeExports.jsx(
                                  "div",
                                  {
                                    "data-ocid": "rechnungsvorlagen.upload_error",
                                    className: "mt-2 rounded bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive",
                                    role: "alert",
                                    children: uploadError
                                  }
                                ),
                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2.5 flex flex-wrap items-center gap-2", children: [
                                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    "label",
                                    {
                                      htmlFor: "logo-upload-input",
                                      className: "inline-flex",
                                      children: [
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(
                                          "input",
                                          {
                                            id: "logo-upload-input",
                                            type: "file",
                                            accept: "image/*",
                                            onChange: handleLogoUpload,
                                            disabled: isUploading,
                                            className: "sr-only",
                                            "data-ocid": "rechnungsvorlagen.logo_file_input"
                                          }
                                        ),
                                        /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                          Button,
                                          {
                                            type: "button",
                                            variant: "outline",
                                            size: "sm",
                                            className: "gap-1.5 h-8 cursor-pointer",
                                            disabled: isUploading,
                                            "data-ocid": "rechnungsvorlagen.upload_logo_button",
                                            onClick: () => {
                                              var _a;
                                              return (_a = document.getElementById("logo-upload-input")) == null ? void 0 : _a.click();
                                            },
                                            children: [
                                              isUploading ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { size: 13, className: "animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Upload, { size: 13 }),
                                              hasLogo ? "Logo ändern" : "Logo hochladen"
                                            ]
                                          }
                                        )
                                      ]
                                    }
                                  ),
                                  hasLogo && /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    Button,
                                    {
                                      type: "button",
                                      variant: "outline",
                                      size: "sm",
                                      className: "gap-1.5 h-8 text-destructive hover:bg-destructive/10 hover:text-destructive",
                                      onClick: handleRemoveLogo,
                                      disabled: isRemoving,
                                      "data-ocid": "rechnungsvorlagen.remove_logo_button",
                                      children: [
                                        isRemoving ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { size: 13, className: "animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { size: 13 }),
                                        "Entfernen"
                                      ]
                                    }
                                  )
                                ] })
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsxs(
                            "div",
                            {
                              "data-ocid": "rechnungsvorlagen.standardtexte_section",
                              className: "rounded-md border border-border bg-muted/20 p-3",
                              children: [
                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [
                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs font-medium text-foreground uppercase tracking-wide", children: "Rechnungstexte" }),
                                  /* @__PURE__ */ jsxRuntimeExports.jsx(
                                    PlaceholderInsert,
                                    {
                                      onInsert: insertPlaceholder,
                                      ocid: "rechnungsvorlagen.placeholder_insert_global"
                                    }
                                  )
                                ] }),
                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
                                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    Collapsible,
                                    {
                                      "data-ocid": "rechnungsvorlagen.text_rechnungstitel_row",
                                      className: "rounded border border-border bg-card",
                                      children: [
                                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 px-2.5 py-2", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                            "button",
                                            {
                                              type: "button",
                                              className: "flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity",
                                              "aria-label": "Rechnungstitel bearbeiten",
                                              children: [
                                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                                  ChevronRight,
                                                  {
                                                    size: 14,
                                                    className: "shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                                  }
                                                ),
                                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground truncate", children: "Rechnungstitel" }),
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground truncate", children: vorlage.standardtexte.rechnungstitel ? vorlage.standardtexte.rechnungstitel.slice(
                                                    0,
                                                    40
                                                  ) : "— leer —" })
                                                ] })
                                              ]
                                            }
                                          ) }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Pencil,
                                            {
                                              size: 13,
                                              className: "shrink-0 text-muted-foreground"
                                            }
                                          )
                                        ] }),
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 pt-2", children: [
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              Label$1,
                                              {
                                                htmlFor: "text-rechnungstitel",
                                                className: "text-xs font-medium text-foreground",
                                                children: "Rechnungstitel"
                                              }
                                            ),
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              PlaceholderInsert,
                                              {
                                                onInsert: insertPlaceholder,
                                                ocid: "rechnungsvorlagen.placeholder_insert_rechnungstitel"
                                              }
                                            )
                                          ] }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Input,
                                            {
                                              id: "text-rechnungstitel",
                                              ref: (el) => {
                                                fieldRefs.current.rechnungstitel = el;
                                              },
                                              "data-ocid": "rechnungsvorlagen.rechnungstitel_input",
                                              placeholder: "z. B. Rechnung {{rechnungsnummer}}",
                                              value: vorlage.standardtexte.rechnungstitel,
                                              onChange: (e) => updateText("rechnungstitel", e.target.value),
                                              onFocus: () => setActiveField("rechnungstitel"),
                                              onBlur: () => setActiveField(null),
                                              className: "text-sm"
                                            }
                                          )
                                        ] }) })
                                      ]
                                    }
                                  ),
                                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    Collapsible,
                                    {
                                      "data-ocid": "rechnungsvorlagen.text_einleitung_row",
                                      className: "rounded border border-border bg-card",
                                      children: [
                                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 px-2.5 py-2", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                            "button",
                                            {
                                              type: "button",
                                              className: "flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity",
                                              "aria-label": "Einleitung bearbeiten",
                                              children: [
                                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                                  ChevronRight,
                                                  {
                                                    size: 14,
                                                    className: "shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                                  }
                                                ),
                                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground truncate", children: "Einleitung" }),
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground truncate", children: vorlage.standardtexte.einleitung ? vorlage.standardtexte.einleitung.slice(
                                                    0,
                                                    40
                                                  ) : "— leer —" })
                                                ] })
                                              ]
                                            }
                                          ) }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Pencil,
                                            {
                                              size: 13,
                                              className: "shrink-0 text-muted-foreground"
                                            }
                                          )
                                        ] }),
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 pt-2", children: [
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              Label$1,
                                              {
                                                htmlFor: "text-einleitung",
                                                className: "text-xs font-medium text-foreground",
                                                children: "Einleitung"
                                              }
                                            ),
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              PlaceholderInsert,
                                              {
                                                onInsert: insertPlaceholder,
                                                ocid: "rechnungsvorlagen.placeholder_insert_einleitung"
                                              }
                                            )
                                          ] }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Textarea,
                                            {
                                              id: "text-einleitung",
                                              ref: (el) => {
                                                fieldRefs.current.einleitung = el;
                                              },
                                              "data-ocid": "rechnungsvorlagen.einleitung_input",
                                              placeholder: "z. B. Wir danken Ihnen für Ihren Auftrag zum Mandat {{mandat_bezeichnung}}…",
                                              value: vorlage.standardtexte.einleitung,
                                              onChange: (e) => updateText("einleitung", e.target.value),
                                              onFocus: () => setActiveField("einleitung"),
                                              onBlur: () => setActiveField(null),
                                              className: "min-h-20 text-sm",
                                              rows: 3
                                            }
                                          )
                                        ] }) })
                                      ]
                                    }
                                  ),
                                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    Collapsible,
                                    {
                                      "data-ocid": "rechnungsvorlagen.text_zahlungshinweis_row",
                                      className: "rounded border border-border bg-card",
                                      children: [
                                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 px-2.5 py-2", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                            "button",
                                            {
                                              type: "button",
                                              className: "flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity",
                                              "aria-label": "Zahlungsinformationen bearbeiten",
                                              children: [
                                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                                  ChevronRight,
                                                  {
                                                    size: 14,
                                                    className: "shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                                  }
                                                ),
                                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground truncate", children: "Zahlungsinformationen" }),
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground truncate", children: vorlage.standardtexte.zahlungshinweis ? vorlage.standardtexte.zahlungshinweis.slice(
                                                    0,
                                                    40
                                                  ) : "— leer —" })
                                                ] })
                                              ]
                                            }
                                          ) }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Pencil,
                                            {
                                              size: 13,
                                              className: "shrink-0 text-muted-foreground"
                                            }
                                          )
                                        ] }),
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 pt-2", children: [
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              Label$1,
                                              {
                                                htmlFor: "text-zahlungshinweis",
                                                className: "text-xs font-medium text-foreground",
                                                children: "Zahlungsinformationen"
                                              }
                                            ),
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              PlaceholderInsert,
                                              {
                                                onInsert: insertPlaceholder,
                                                ocid: "rechnungsvorlagen.placeholder_insert_zahlungshinweis"
                                              }
                                            )
                                          ] }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Textarea,
                                            {
                                              id: "text-zahlungshinweis",
                                              ref: (el) => {
                                                fieldRefs.current.zahlungshinweis = el;
                                              },
                                              "data-ocid": "rechnungsvorlagen.zahlungshinweis_input",
                                              placeholder: "z. B. {{zahlungsbedingungen}} auf das unten angegebene Konto.",
                                              value: vorlage.standardtexte.zahlungshinweis,
                                              onChange: (e) => updateText("zahlungshinweis", e.target.value),
                                              onFocus: () => setActiveField("zahlungshinweis"),
                                              onBlur: () => setActiveField(null),
                                              className: "min-h-20 text-sm",
                                              rows: 3
                                            }
                                          )
                                        ] }) })
                                      ]
                                    }
                                  ),
                                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    Collapsible,
                                    {
                                      "data-ocid": "rechnungsvorlagen.text_schlusstext_row",
                                      className: "rounded border border-border bg-card",
                                      children: [
                                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 px-2.5 py-2", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                            "button",
                                            {
                                              type: "button",
                                              className: "flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity",
                                              "aria-label": "Schlusstext bearbeiten",
                                              children: [
                                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                                  ChevronRight,
                                                  {
                                                    size: 14,
                                                    className: "shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                                  }
                                                ),
                                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground truncate", children: "Schlusstext" }),
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground truncate", children: vorlage.standardtexte.schlusstext ? vorlage.standardtexte.schlusstext.slice(
                                                    0,
                                                    40
                                                  ) : "— leer —" })
                                                ] })
                                              ]
                                            }
                                          ) }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Pencil,
                                            {
                                              size: 13,
                                              className: "shrink-0 text-muted-foreground"
                                            }
                                          )
                                        ] }),
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 pt-2", children: [
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              Label$1,
                                              {
                                                htmlFor: "text-schlusstext",
                                                className: "text-xs font-medium text-foreground",
                                                children: "Schlusstext"
                                              }
                                            ),
                                            /* @__PURE__ */ jsxRuntimeExports.jsx(
                                              PlaceholderInsert,
                                              {
                                                onInsert: insertPlaceholder,
                                                ocid: "rechnungsvorlagen.placeholder_insert_schlusstext"
                                              }
                                            )
                                          ] }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Textarea,
                                            {
                                              id: "text-schlusstext",
                                              ref: (el) => {
                                                fieldRefs.current.schlusstext = el;
                                              },
                                              "data-ocid": "rechnungsvorlagen.schlusstext_input",
                                              placeholder: "z. B. Für Rückfragen stehen wir Ihnen gerne zur Verfügung. Mit freundlichen Grüssen, {{leistungserbringer}}",
                                              value: vorlage.standardtexte.schlusstext,
                                              onChange: (e) => updateText("schlusstext", e.target.value),
                                              onFocus: () => setActiveField("schlusstext"),
                                              onBlur: () => setActiveField(null),
                                              className: "min-h-20 text-sm",
                                              rows: 3
                                            }
                                          )
                                        ] }) })
                                      ]
                                    }
                                  ),
                                  /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                    Collapsible,
                                    {
                                      "data-ocid": "rechnungsvorlagen.text_fusszeile_row",
                                      className: "rounded border border-border bg-card",
                                      children: [
                                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2 px-2.5 py-2", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                                            "button",
                                            {
                                              type: "button",
                                              className: "flex items-center gap-2 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity",
                                              "aria-label": "Fusszeile bearbeiten",
                                              children: [
                                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                                  ChevronRight,
                                                  {
                                                    size: 14,
                                                    className: "shrink-0 text-muted-foreground [[data-state=open]>&]:rotate-90 transition-transform"
                                                  }
                                                ),
                                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground truncate", children: "Fusszeile" }),
                                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground truncate", children: vorlage.layout.fusszeile ? vorlage.layout.fusszeile.slice(0, 40) : "— leer —" })
                                                ] })
                                              ]
                                            }
                                          ) }),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Pencil,
                                            {
                                              size: 13,
                                              className: "shrink-0 text-muted-foreground"
                                            }
                                          )
                                        ] }),
                                        /* @__PURE__ */ jsxRuntimeExports.jsx(CollapsibleContent, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2 px-2.5 pb-2.5 pt-1 border-t border-border", children: [
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Label$1,
                                            {
                                              htmlFor: "fusszeile",
                                              className: "pt-2 text-xs font-medium text-foreground",
                                              children: "Fusszeile"
                                            }
                                          ),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                                            Textarea,
                                            {
                                              id: "fusszeile",
                                              "data-ocid": "rechnungsvorlagen.fusszeile_input",
                                              placeholder: "z. B. Kanzlei Mustermann · IBAN CH00 0000 0000 0000 0000 0 · UID CHE-000.000.000",
                                              value: vorlage.layout.fusszeile,
                                              onChange: (e) => updateLayout({ fusszeile: e.target.value }),
                                              className: "min-h-20 text-sm",
                                              rows: 3
                                            }
                                          ),
                                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Wird unten auf jeder Rechnungsseite angezeigt." })
                                        ] }) })
                                      ]
                                    }
                                  )
                                ] })
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsxRuntimeExports.jsx(
                            "div",
                            {
                              "data-ocid": "rechnungsvorlagen.placeholders_section",
                              className: "rounded-md border border-border bg-muted/20 p-3",
                              children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-2", children: [
                                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: "Platzhalter" }),
                                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground leading-snug", children: "Tokens für Rechnungstexte — beim Export ersetzt." })
                                ] }),
                                /* @__PURE__ */ jsxRuntimeExports.jsx(
                                  PlaceholderInsert,
                                  {
                                    onInsert: insertPlaceholder,
                                    ocid: "rechnungsvorlagen.placeholder_insert_button"
                                  }
                                )
                              ] })
                            }
                          )
                        ] }) })
                      ]
                    }
                  )
                ]
              }
            ) : (
              /* Hinweis wenn kein Element ausgewählt ist — kompakt. Seitenränder
                 bleiben darunter trotzdem verfügbar (nicht vom Element abhängig). */
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "div",
                {
                  "data-ocid": "rechnungsvorlagen.no_selection_hint",
                  className: "rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Wählen Sie ein Element in der Combobox oder auf der Leinwand, um Layout, Typografie und Inhalte zu bearbeiten." })
                }
              )
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Accordion,
              {
                type: "multiple",
                className: "space-y-3",
                "data-ocid": "rechnungsvorlagen.inspector_page",
                children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  AccordionItem,
                  {
                    value: "inspector-margins",
                    "data-ocid": "rechnungsvorlagen.margins_section",
                    className: "rounded-lg border border-border bg-card px-0",
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionTrigger, { className: "px-4 py-3 hover:no-underline", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2.5 min-w-0", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", children: /* @__PURE__ */ jsxRuntimeExports.jsx(AlignRight, { size: 15 }) }),
                        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-left min-w-0", children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-display font-semibold text-foreground text-sm leading-tight", children: "Seitenränder" }),
                          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5 leading-snug", children: "A4-Seitenränder in mm (Standard 20 mm, 5–40 mm)." })
                        ] })
                      ] }) }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(AccordionContent, { className: "px-4 pb-4 pt-1", children: /* @__PURE__ */ jsxRuntimeExports.jsx(MarginsControl, { layoutV2, onChange: updateMargins }) })
                    ]
                  }
                )
              }
            )
          ] })
        ] })
      ]
    }
  );
}
export {
  RechnungsvorlagenPage
};
