import { queryKeys, useBackend } from "@/utils/backend";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useStopwatch — manages a single-leistung running timer.
 *
 * Backend contract:
 *   actor.startTimer(leistungId, baseDauer) → Result_11 (ok: TimerState)
 *   actor.stopTimer(leistungId)             → Result_10 (ok: bigint total minutes)
 *   actor.getTimer(leistungId)             → TimerState | null
 *   actor.updateLeistung(id, taetigkeit, dauer) → Result_4
 *
 * The hook keeps a 1-second ticking `elapsedSec` for live display, derives
 * `displayMins` from baseDauer + elapsed (LIVE display only), and on stop
 * persists the backend's authoritative total minutes through updateLeistung
 * then invalidates the leistungen query.
 *
 * ADDITIVE BEHAVIOUR: stop() returns the backend's total minutes
 * (baseDauer + elapsed). Callers MUST use this returned bigint to update the
 * Dauer display and downstream state — never the locally derived displayMins,
 * which is reset to baseDauer after stop(). The leistung.dauer prop is the
 * source of truth for baseDauer; it refreshes after the leistungen query is
 * invalidated, so a subsequent start/stop uses the freshly persisted dauer.
 *
 * Per the doNotBuild contract, this is a single-mandate stopwatch — there is
 * no global multi-mandate timer orchestration here.
 */
export interface UseStopwatchArgs {
  leistungId: string;
  baseDauer: bigint;
  taetigkeit: string;
}

export interface UseStopwatchResult {
  running: boolean;
  elapsedSec: number;
  displayMins: number;
  start: () => Promise<void>;
  /**
   * Stop the running timer. Resolves to the backend's authoritative total
   * minutes (baseDauer + elapsed) — callers MUST use this returned value to
   * update their Dauer display and any downstream state, never the locally
   * derived `displayMins` (which is reset to baseDauer after stop).
   * Returns null if the timer was not running or the call failed.
   */
  stop: () => Promise<bigint | null>;
}

const NS_PER_SEC = 1_000_000_000n;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function useStopwatch({
  leistungId,
  baseDauer,
  taetigkeit,
}: UseStopwatchArgs): UseStopwatchResult {
  const { actor, isLoading } = useBackend();
  const queryClient = useQueryClient();

  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Anchor timestamp (seconds) captured when the timer starts or when a
  // pre-existing backend timer is loaded. Used to derive live elapsed time.
  const anchorSecRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const baseDauerMins = Number(baseDauer);

  // Stop the local ticker (does not touch the backend).
  const clearTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // Start the local ticker from the current anchor.
  const beginTick = useCallback(() => {
    clearTick();
    if (anchorSecRef.current === null) return;
    setElapsedSec(Math.max(0, nowSec() - anchorSecRef.current));
    tickRef.current = setInterval(() => {
      if (anchorSecRef.current === null) return;
      setElapsedSec(Math.max(0, nowSec() - anchorSecRef.current));
    }, 1000);
  }, [clearTick]);

  // On mount / when leistungId changes: ask the backend whether a timer is
  // already running for this leistung and resume the local ticker from it.
  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!actor || isLoading || !leistungId) return;
      try {
        const state = await actor.getTimer(leistungId);
        if (cancelled || !state) return;
        // state.startTime is nanoseconds since epoch (Motoko Time).
        const startSec = Number(state.startTime / NS_PER_SEC);
        anchorSecRef.current = startSec;
        setRunning(true);
        beginTick();
      } catch {
        // Ignore hydration errors — the user can still press Start.
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [actor, isLoading, leistungId, beginTick]);

  // Cleanup ticker on unmount.
  useEffect(() => clearTick, [clearTick]);

  const start = useCallback(async () => {
    if (!actor || running) return;
    try {
      const res = await actor.startTimer(leistungId, baseDauer);
      if (res.__kind__ === "err") {
        throw new Error(res.err);
      }
      const startSec = Number(res.ok.startTime / NS_PER_SEC);
      anchorSecRef.current = startSec;
      setRunning(true);
      beginTick();
      void queryClient.invalidateQueries({ queryKey: queryKeys.timers() });
    } catch (err) {
      // Surface to caller via rethrow so UI can show a toast.
      // biome-ignore lint/complexity/noUselessCatch: rethrow lets the caller's UI layer surface a toast.
      throw err;
    }
  }, [actor, running, leistungId, baseDauer, beginTick, queryClient]);

  const stop = useCallback(async (): Promise<bigint | null> => {
    if (!actor || !running) return null;
    try {
      const res = await actor.stopTimer(leistungId);
      if (res.__kind__ === "err") {
        throw new Error(res.err);
      }
      // res.ok is the authoritative total minutes (bigint) from the backend,
      // computed as baseDauer + elapsed minutes. This is the additive sum the
      // caller must use to update the Dauer display and any downstream state.
      const totalMinutes = res.ok;
      // Persist the total minutes + taetigkeit on the Leistung record.
      const updateRes = await actor.updateLeistung(
        leistungId,
        taetigkeit,
        totalMinutes,
      );
      if (updateRes.__kind__ === "err") {
        throw new Error(updateRes.err);
      }
      setRunning(false);
      clearTick();
      anchorSecRef.current = null;
      setElapsedSec(0);
      // Invalidate leistungen + timer caches so list views refresh and the
      // next start/stop uses the freshly persisted dauer as baseDauer.
      void queryClient.invalidateQueries({ queryKey: ["leistungen"] });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.timer(leistungId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.timers() });
      return totalMinutes;
    } catch (err) {
      // biome-ignore lint/complexity/noUselessCatch: rethrow lets the caller's UI layer surface a toast.
      throw err;
    }
  }, [actor, running, leistungId, taetigkeit, clearTick, queryClient]);

  // displayMins = baseDauer (minutes) + elapsed seconds converted to minutes.
  // This is a LIVE display value only — it reflects baseDauer + currently
  // elapsed seconds while the timer is running. After stop() the elapsed
  // seconds reset to 0, so displayMins falls back to baseDauer. Callers MUST
  // NOT use displayMins to set the Dauer field after stop(); use the bigint
  // total returned by stop() instead, which is the backend's authoritative
  // additive sum (baseDauer + elapsed minutes).
  const displayMins = baseDauerMins + elapsedSec / 60;

  return { running, elapsedSec, displayMins, start, stop };
}
