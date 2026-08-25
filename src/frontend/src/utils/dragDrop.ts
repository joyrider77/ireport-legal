import type { GridArea } from "@/backend";
import { useCallback, useRef, useState } from "react";

// ─── Pointer-based Drag & Drop utility (mouse + touch + pen) ────────────────────
// The V2 layout editor positions Rechnungselemente on a snap-to-grid raster.
// This module provides the shared drag AND resize mechanics that the page task
// consumes.
//
// Design constraints (from the dispatch):
//   - Must work with BOTH mouse and touch — uses the Pointer Events API
//     (pointerdown / pointermove / pointerup), NOT separate mouse/touch
//     handlers. This is critical for iPad/tablet support.
//   - Snap-to-grid instead of uncontrolled pixel-precise free positioning.
//   - Draggable elements need `touch-action: none` CSS to prevent the browser
//     from scrolling/panning while dragging on touch devices.
//   - Resize handles (FIX 2.3) use the SAME Pointer Events API so touch
//     resizing works on iPad. Handles must be at least 24px (touch target).
//
// The hook is grid-aware: it accepts the grid configuration (cols, rows) and
// the drag container's pixel dimensions, and computes the dragged/resized
// element's snapped GridArea (row/col/rowSpan/colSpan as bigint, matching the
// generated backend bindings) on every pointer move.

/**
 * snapToGrid — rounds a pixel/position value to the nearest grid line.
 * `value` is the raw pixel offset; `gridSize` is the pixel size of one grid
 * cell (or grid line spacing). Returns the snapped pixel value.
 *
 * Example: snapToGrid(37, 20) → 40 (nearest multiple of 20).
 */
export function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

/**
 * snapToCellIndex — converts a pixel offset to a 0-based grid cell index by
 * snapping to the nearest cell. Clamps the result to [0, maxIndex] so the
 * element cannot be dragged outside the grid.
 */
export function snapToCellIndex(
  pixelOffset: number,
  cellSize: number,
  maxIndex: number,
): number {
  if (cellSize <= 0) return 0;
  const idx = Math.round(pixelOffset / cellSize);
  return Math.max(0, Math.min(idx, maxIndex));
}

/**
 * clampToRange — clamps a number to [min, max]. Used for resize span limits.
 */
export function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// ─── DragState ────────────────────────────────────────────────────────────────
// Tracks the active drag: which element id is being dragged, the pointer's
// start and current pixel positions (relative to the drag container), and the
// element's original grid area (so the page can render a ghost/preview while
// the drag is in progress and commit the snapped area on pointerup).

export interface DragState {
  /** The LayoutElementId (enum string value) of the element being dragged. */
  elementId: string;
  /** Pointer position at drag start, in pixels relative to the container. */
  startX: number;
  startY: number;
  /** Current pointer position, in pixels relative to the container. */
  currentX: number;
  currentY: number;
  /** The element's grid area before the drag started (for delta computation). */
  origin: GridArea;
}

// ─── ResizeState ──────────────────────────────────────────────────────────────
// Tracks an active resize operation. `handle` indicates which corner/edge is
// being dragged (n, s, e, w, ne, nw, se, sw). The resize computes a new
// GridArea by adjusting row/col/rowSpan/colSpan relative to the origin, with
// snap-to-grid and min/max span clamping.

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface ResizeState {
  /** The LayoutElementId (enum string value) of the element being resized. */
  elementId: string;
  /** Which handle is being dragged. */
  handle: ResizeHandle;
  /** Pointer position at resize start, in pixels relative to the container. */
  startX: number;
  startY: number;
  /** Current pointer position, in pixels relative to the container. */
  currentX: number;
  currentY: number;
  /** The element's grid area before the resize started. */
  origin: GridArea;
}

// ─── GridConfig ───────────────────────────────────────────────────────────────
// Describes the raster the drag/resize operates on. `cols`/`rows` are the grid
// dimensions (matching VorlageLayoutV2.gridCols/gridRows); `containerWidth`/
// `containerHeight` are the pixel dimensions of the drag surface so the hook
// can convert pixel offsets to cell indices.

export interface GridConfig {
  cols: number;
  rows: number;
  containerWidth: number;
  containerHeight: number;
}

// ─── Resize limits ────────────────────────────────────────────────────────────
// Min/max span constraints for resize operations. Min 1 cell prevents elements
// from collapsing to zero. Max is bounded by the grid dimensions so elements
// cannot exceed the A4 print area.

export const MIN_SPAN = 1;
export const MIN_ROW_SPAN = 1;
export const MIN_COL_SPAN = 1;

// ─── computeResizedArea (pure, exported for tests) ───────────────────────────
// Pure implementation of the resize math, extracted from the hook so unit
// tests can exercise it directly without rendering. The hook delegates to this
// function via a thin useCallback wrapper.
//
// Returns null when the grid has zero cells (degenerate config). Otherwise
// computes the snapped + clamped GridArea for the given ResizeState.
export function computeResizedArea(
  state: ResizeState,
  grid: GridConfig,
): GridArea | null {
  const cellWidth = grid.cols > 0 ? grid.containerWidth / grid.cols : 0;
  const cellHeight = grid.rows > 0 ? grid.containerHeight / grid.rows : 0;
  if (cellWidth <= 0 || cellHeight <= 0) return null;
  const dx = state.currentX - state.startX;
  const dy = state.currentY - state.startY;
  // Delta in cells (snapped).
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

  // Horizontal adjustments
  if (handle.includes("e")) {
    // East edge: colSpan changes, col stays.
    newColSpan = clampToRange(
      oColSpan + dxCells,
      MIN_COL_SPAN,
      grid.cols - oCol,
    );
  }
  if (handle.includes("w")) {
    // West edge: col moves, colSpan adjusts to keep right edge stable.
    // New col is clamped so the element doesn't go past its right edge.
    const maxColShift = oColSpan - MIN_COL_SPAN; // how far left edge can move right
    const proposedCol = clampToRange(oCol + dxCells, 0, oCol + maxColShift);
    const colDelta = proposedCol - oCol;
    newCol = proposedCol;
    newColSpan = clampToRange(
      oColSpan - colDelta,
      MIN_COL_SPAN,
      grid.cols - newCol,
    );
  }

  // Vertical adjustments
  if (handle.includes("s")) {
    // South edge: rowSpan changes, row stays.
    newRowSpan = clampToRange(
      oRowSpan + dyCells,
      MIN_ROW_SPAN,
      grid.rows - oRow,
    );
  }
  if (handle.includes("n")) {
    // North edge: row moves, rowSpan adjusts to keep bottom edge stable.
    const maxRowShift = oRowSpan - MIN_ROW_SPAN;
    const proposedRow = clampToRange(oRow + dyCells, 0, oRow + maxRowShift);
    const rowDelta = proposedRow - oRow;
    newRow = proposedRow;
    newRowSpan = clampToRange(
      oRowSpan - rowDelta,
      MIN_ROW_SPAN,
      grid.rows - newRow,
    );
  }

  return {
    row: BigInt(newRow),
    col: BigInt(newCol),
    rowSpan: BigInt(newRowSpan),
    colSpan: BigInt(newColSpan),
  };
}

// Internal alias used by the hook's useCallback wrapper to keep the deps
// array narrow (only `grid`).
function computeResizedAreaImpl(
  state: ResizeState,
  grid: GridConfig,
): GridArea | null {
  return computeResizedArea(state, grid);
}

// ─── useDragDrop ──────────────────────────────────────────────────────────────
// A pointer-based drag AND resize hook for the V2 layout editor. Returns:
//   - dragState: null when idle, populated while a drag is in progress.
//   - snappedArea: the GridArea the dragged element would land in if dropped
//     at the current pointer position (snap-to-grid), or null when idle.
//   - resizeState: null when idle, populated while a resize is in progress.
//   - resizedArea: the GridArea the resized element would have at the current
//     pointer position (snap-to-grid + clamped), or null when idle.
//   - onPointerDown: attach to each draggable element's drag handle. Call with
//     the element id and its current grid area.
//   - onResizeStart: attach to each resize handle. Call with the element id,
//     the handle direction, and the current grid area.
//   - onPointerMove / onPointerUp: attach to the drag CONTAINER (not the
//     element) so the drag keeps tracking even when the pointer leaves the
//     element. The page should set `touch-action: none` on draggable handles.
//
// The hook uses refs to hold the active drag/resize so pointermove handlers
// attached to the container can read the latest state without re-binding
// listeners on every render.

export interface UseDragDropResult {
  dragState: DragState | null;
  snappedArea: GridArea | null;
  resizeState: ResizeState | null;
  resizedArea: GridArea | null;
  onPointerDown: (
    elementId: string,
    origin: GridArea,
    event: React.PointerEvent,
  ) => void;
  onResizeStart: (
    elementId: string,
    handle: ResizeHandle,
    origin: GridArea,
    event: React.PointerEvent,
  ) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  cancelDrag: () => void;
}

/**
 * Optional canvas-rect provider. When supplied, all three pointer handlers
 * (onPointerDown, onResizeStart, onPointerMove) measure pointer positions
 * against the SAME canvas rect — the A4 page container — so the drag/resize
 * delta (currentX - startX) is in a single coordinate system and does not
 * accumulate a position-dependent offset.
 *
 * When omitted, the handlers fall back to the legacy parentElement chain
 * (kept for backward compatibility with any other consumer of the hook).
 */
export type GetCanvasRect = () => DOMRect | null;

export function useDragDrop(
  grid: GridConfig,
  getCanvasRect?: GetCanvasRect,
): UseDragDropResult {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  // Ref mirrors so the container-level pointermove/up handlers (which are
  // stable via useCallback) always read the latest state without re-binding.
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  const cellWidth = grid.cols > 0 ? grid.containerWidth / grid.cols : 0;
  const cellHeight = grid.rows > 0 ? grid.containerHeight / grid.rows : 0;

  /** Compute the snapped GridArea for the current drag, or null when idle. */
  const computeSnappedArea = useCallback(
    (state: DragState): GridArea | null => {
      if (cellWidth <= 0 || cellHeight <= 0) return null;
      // Delta in pixels from the drag start.
      const dx = state.currentX - state.startX;
      const dy = state.currentY - state.startY;
      // Convert the origin's top-left corner (in cells) to pixels, add the
      // pointer delta, then snap back to cell indices.
      const originColPx = Number(state.origin.col) * cellWidth;
      const originRowPx = Number(state.origin.row) * cellHeight;
      const newCol = snapToCellIndex(
        originColPx + dx,
        cellWidth,
        Math.max(0, grid.cols - Number(state.origin.colSpan)),
      );
      const newRow = snapToCellIndex(
        originRowPx + dy,
        cellHeight,
        Math.max(0, grid.rows - Number(state.origin.rowSpan)),
      );
      return {
        row: BigInt(newRow),
        col: BigInt(newCol),
        rowSpan: state.origin.rowSpan,
        colSpan: state.origin.colSpan,
      };
    },
    [cellWidth, cellHeight, grid.cols, grid.rows],
  );

  /**
   * Compute the snapped + clamped GridArea for the current resize, or null
   * when idle. The resize adjusts row/col/rowSpan/colSpan depending on which
   * handle is being dragged, while keeping the element within the grid bounds
   * and respecting min/max span limits.
   *
   * Handle semantics (origin = element's gridArea before resize):
   *   - e  (east):  grow/shrink colSpan (right edge moves)
   *   - w  (west):  move col + adjust colSpan (left edge moves)
   *   - s  (south): grow/shrink rowSpan (bottom edge moves)
   *   - n  (north): move row + adjust rowSpan (top edge moves)
   *   - ne, nw, se, sw: combine the relevant axes
   *
   * Exported as a pure function so unit tests can exercise the resize math
   * directly without rendering the hook. The hook below delegates to it.
   */
  const computeResizedArea = useCallback(
    (state: ResizeState): GridArea | null =>
      computeResizedAreaImpl(state, grid),
    [grid],
  );

  const onPointerDown = useCallback(
    (elementId: string, origin: GridArea, event: React.PointerEvent) => {
      // Only react to primary button (left mouse / touch / pen contact).
      if (event.button !== undefined && event.button !== 0) return;
      // Measure the start point against the SAME canvas rect that
      // onPointerMove uses (the A4 page container), so the delta
      // (currentX - startX) shares a single origin and does not accumulate
      // a position-dependent offset. Falls back to the legacy parentElement
      // chain when no canvas-rect provider is supplied.
      const rect = getCanvasRect
        ? getCanvasRect()
        : event.currentTarget.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      const next: DragState = {
        elementId,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        origin,
      };
      dragRef.current = next;
      setDragState(next);
      // Clear any active resize (mutual exclusion).
      resizeRef.current = null;
      setResizeState(null);
      // Capture the pointer so pointermove/up keep firing even when the
      // pointer leaves the element (essential for touch + pen).
      try {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      } catch {
        // setPointerCapture can throw if the pointer was already released;
        // ignore — the container-level handlers still work.
      }
    },
    [getCanvasRect],
  );

  const onResizeStart = useCallback(
    (
      elementId: string,
      handle: ResizeHandle,
      origin: GridArea,
      event: React.PointerEvent,
    ) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.stopPropagation();
      // Measure the start point against the SAME canvas rect that
      // onPointerMove uses (the A4 page container), so the resize delta
      // (currentX - startX) shares a single origin and does not accumulate
      // a position-dependent offset. Falls back to the legacy
      // parentElement.parentElement chain when no canvas-rect provider is
      // supplied.
      const rect = getCanvasRect
        ? getCanvasRect()
        : event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const startX = event.clientX - rect.left;
      const startY = event.clientY - rect.top;
      const next: ResizeState = {
        elementId,
        handle,
        startX,
        startY,
        currentX: startX,
        currentY: startY,
        origin,
      };
      resizeRef.current = next;
      setResizeState(next);
      // Clear any active drag (mutual exclusion).
      dragRef.current = null;
      setDragState(null);
      try {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [getCanvasRect],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const dragS = dragRef.current;
      const resizeS = resizeRef.current;
      if (!dragS && !resizeS) return;
      // Prefer the explicit canvas-rect provider so start and current share
      // the exact same origin. Fall back to the canvas element itself
      // (currentTarget, where this handler is bound) when no provider is
      // supplied — both yield the A4 page container rect.
      const rect = getCanvasRect
        ? getCanvasRect()
        : (event.currentTarget as Element).getBoundingClientRect();
      if (!rect) return;
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      if (dragS) {
        const next: DragState = { ...dragS, currentX: cx, currentY: cy };
        dragRef.current = next;
        setDragState(next);
      } else if (resizeS) {
        const next: ResizeState = { ...resizeS, currentX: cx, currentY: cy };
        resizeRef.current = next;
        setResizeState(next);
      }
    },
    [getCanvasRect],
  );

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    try {
      (event.currentTarget as Element).releasePointerCapture(event.pointerId);
    } catch {
      // releasePointerCapture can throw if capture was already lost; ignore.
    }
    dragRef.current = null;
    resizeRef.current = null;
    setDragState(null);
    setResizeState(null);
  }, []);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
    setDragState(null);
    setResizeState(null);
  }, []);

  const snappedArea = dragState ? computeSnappedArea(dragState) : null;
  const resizedArea = resizeState ? computeResizedArea(resizeState) : null;

  return {
    dragState,
    snappedArea,
    resizeState,
    resizedArea,
    onPointerDown,
    onResizeStart,
    onPointerMove,
    onPointerUp,
    cancelDrag,
  };
}
