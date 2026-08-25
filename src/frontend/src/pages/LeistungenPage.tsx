import type {
  AuslagenKategorie,
  AuslagenStatus,
  Klient,
  Leistungserbringer,
  Mandat,
} from "@/backend.d";
import { AuslagenKategorie as AuslagenKategorieEnum } from "@/backend.d";
import type { Auslage, Leistung } from "@/backend.d";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBudget } from "@/hooks/useBudget";
import { useStopwatch } from "@/hooks/useStopwatch";
import { queryKeys, useBackend, useKanzlei } from "@/utils/backend";
import { exportPdf, exportXlsx } from "@/utils/export";
import {
  currencySymbol,
  formatCHF,
  formatDate,
  formatDuration,
  parseDuration,
  todayDate,
} from "@/utils/format";
import type { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Helper: date formatting ─────────────────────────────────────────────────

function dateToDisplay(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const [y, m, d] = dateStr.substring(0, 10).split("-");
    return `${d}.${m}.${y}`;
  }
  return dateStr;
}

function ddmmyyyyToDate(s: string): Date {
  const [d, m, y] = s.split(".");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

function dateToBackend(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}.${m}.${y}`;
}

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
const GERMAN_DAYS_FULL = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];
const GERMAN_DAYS_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function formatDateHeading(dateStr: string): string {
  const d = ddmmyyyyToDate(dateStr);
  return `${GERMAN_DAYS_FULL[d.getDay()]}, ${d.getDate()}. ${GERMAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Zeitraum-Filter ──────────────────────────────────────────────────────────

type ZeitraumFilter = "tag" | "woche" | "monat" | "jahr" | "alles";

const ZEITRAUM_OPTIONS: { value: ZeitraumFilter; label: string }[] = [
  { value: "tag", label: "Tag" },
  { value: "woche", label: "Woche" },
  { value: "monat", label: "Monat" },
  { value: "jahr", label: "Jahr" },
  { value: "alles", label: "Alles" },
];

/**
 * Compute the datumVon/datumBis range (dd.mm.yyyy) for a given ZeitraumFilter
 * relative to the selected calendar date. Returns null for 'alles' (no
 * date filter).
 */
function computeDateRange(
  filter: ZeitraumFilter,
  selectedDate: string,
): { von: string; bis: string } | null {
  if (filter === "alles") return null;
  const d = ddmmyyyyToDate(selectedDate);
  if (filter === "tag") {
    return { von: selectedDate, bis: selectedDate };
  }
  if (filter === "woche") {
    // Monday = 0 in our convention (getDay(): 0=Sun → shift)
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + mondayOffset,
    );
    const sunday = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + 6,
    );
    return { von: dateToBackend(monday), bis: dateToBackend(sunday) };
  }
  if (filter === "monat") {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { von: dateToBackend(first), bis: dateToBackend(last) };
  }
  // jahr
  const first = new Date(d.getFullYear(), 0, 1);
  const last = new Date(d.getFullYear(), 11, 31);
  return { von: dateToBackend(first), bis: dateToBackend(last) };
}

/**
 * Format the date heading in the content header based on the ZeitraumFilter.
 * - tag: "Montag, 22. Juli 2026"
 * - woche: "Woche 12.07.–18.07.2026"
 * - monat: "Juli 2026"
 * - jahr: "2026"
 * - alles: "Alle Leistungen & Auslagen"
 */
function formatZeitraumHeading(
  filter: ZeitraumFilter,
  selectedDate: string,
): string {
  if (filter === "alles") return "Alle Leistungen & Auslagen";
  if (filter === "tag") return formatDateHeading(selectedDate);
  const range = computeDateRange(filter, selectedDate);
  if (!range) return formatDateHeading(selectedDate);
  if (filter === "woche") {
    const von = ddmmyyyyToDate(range.von);
    const bis = ddmmyyyyToDate(range.bis);
    const fmt = (dd: Date) =>
      `${String(dd.getDate()).padStart(2, "0")}.${String(dd.getMonth() + 1).padStart(2, "0")}.${dd.getFullYear()}`;
    return `Woche ${fmt(von)}–${fmt(bis)}`;
  }
  if (filter === "monat") {
    const d = ddmmyyyyToDate(selectedDate);
    return `${GERMAN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  // jahr
  const d = ddmmyyyyToDate(selectedDate);
  return `${d.getFullYear()}`;
}

/**
 * Determine whether a given calendar day (Date) should be highlighted as
 * "active" based on the ZeitraumFilter and the selected date.
 */
function isDayActiveForFilter(
  filter: ZeitraumFilter,
  selectedDate: string,
  day: Date,
): boolean {
  if (filter === "alles") return false;
  if (filter === "jahr") return true; // entire grid is active
  const range = computeDateRange(filter, selectedDate);
  if (!range) return false;
  const von = ddmmyyyyToDate(range.von);
  const bis = ddmmyyyyToDate(range.bis);
  // Compare by date only (ignore time)
  const dayTime = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
  ).getTime();
  const vonTime = new Date(
    von.getFullYear(),
    von.getMonth(),
    von.getDate(),
  ).getTime();
  const bisTime = new Date(
    bis.getFullYear(),
    bis.getMonth(),
    bis.getDate(),
  ).getTime();
  return dayTime >= vonTime && dayTime <= bisTime;
}

// ─── MiniCalendar ─────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  datesWithEntries: Set<string>;
  zitraumFilter: ZeitraumFilter;
  onZeitraumChange: (filter: ZeitraumFilter) => void;
}

function MiniCalendar({
  selectedDate,
  onSelect,
  datesWithEntries,
  zitraumFilter,
  onZeitraumChange,
}: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    const d = ddmmyyyyToDate(selectedDate);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const today = todayDate();

  function prevMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  // Build calendar grid (Mon-first)
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Shift so Monday = 0
  const startOffset = (firstDay + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const day = i - startOffset + 1;
    cells.push(day >= 1 && day <= daysInMonth ? day : null);
  }

  return (
    <div className="bg-card border-r border-border p-4 flex flex-col gap-3 w-[280px] shrink-0">
      {/* Month header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          aria-label="Vorheriger Monat"
          data-ocid="calendar.prev_button"
        >
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
        <span className="text-sm font-display font-semibold text-foreground">
          {GERMAN_MONTHS[month]} {year}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="p-1.5 rounded hover:bg-muted transition-colors"
          aria-label="Nächster Monat"
          data-ocid="calendar.next_button"
        >
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0">
        {GERMAN_DAYS_SHORT.slice(1)
          .concat(GERMAN_DAYS_SHORT[0])
          .map((d) => (
            <div
              key={d}
              className="text-center text-[11px] font-medium text-muted-foreground py-1"
            >
              {d}
            </div>
          ))}
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`empty-cell-${i}-${month}-${year}`} className="h-8" />
            );
          }
          const dayDate = new Date(year, month, day);
          const dayStr = dateToBackend(dayDate);
          const isToday = dayStr === today;
          const isSelected = dayStr === selectedDate;
          const hasEntries = datesWithEntries.has(dayStr);
          // Active range highlighting for woche/monat/jahr filters.
          // For 'tag' this returns true only for the selected day (same as
          // isSelected), so the existing single-day behaviour is preserved.
          const inActiveRange =
            zitraumFilter !== "tag" && zitraumFilter !== "alles"
              ? isDayActiveForFilter(zitraumFilter, selectedDate, dayDate)
              : false;

          return (
            <button
              type="button"
              key={`day-${year}-${month}-${day}`}
              onClick={() => onSelect(dayStr)}
              data-ocid={`calendar.day.${day}`}
              className={[
                "relative h-8 w-full flex items-center justify-center rounded text-sm transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground font-semibold ring-2 ring-primary"
                  : inActiveRange
                    ? "bg-primary/30 text-primary font-medium hover:bg-primary/40"
                    : isToday
                      ? "bg-primary/20 text-primary font-semibold hover:bg-primary/30"
                      : "hover:bg-muted text-foreground",
              ].join(" ")}
            >
              {day}
              {hasEntries && !isSelected && !inActiveRange && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Zeitraum-Filter-Navigation (Tag / Woche / Monat / Jahr / Alles) */}
      <div
        className="flex items-center gap-1 bg-muted/50 rounded-md p-1"
        role="tablist"
        aria-label="Zeitraum-Filter"
        data-ocid="calendar.zeitraum_filter"
      >
        {ZEITRAUM_OPTIONS.map((opt) => {
          const isActive = zitraumFilter === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onZeitraumChange(opt.value)}
              data-ocid={`calendar.zeitraum_tab.${opt.value}`}
              className={[
                "flex-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Quick nav: today */}
      <button
        type="button"
        onClick={() => {
          onSelect(today);
          setViewDate(() => {
            const d = ddmmyyyyToDate(today);
            return new Date(d.getFullYear(), d.getMonth(), 1);
          });
        }}
        data-ocid="calendar.today_button"
        className="text-xs text-primary hover:underline text-center"
      >
        Heute
      </button>
    </div>
  );
}

// ─── Leistung Row ────────────────────────────────────────────────────────────

interface LeistungRowProps {
  leistung: Leistung;
  klienten: Klient[];
  mandate: Mandat[];
  providers: Leistungserbringer[];
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (id: string, taetigkeit: string, dauer: bigint) => void;
  onDelete: (id: string) => void;
}

function LeistungRow({
  leistung,
  klienten,
  mandate,
  providers,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
}: LeistungRowProps) {
  const [taetigkeit, setTaetigkeit] = useState(leistung.taetigkeit);
  // Raw, unnormalized user input while editing the Dauer field.
  // We keep it as a string so the user can type freely (e.g. "800", "08:00", "0800")
  // without React fighting the cursor position.
  const [dauerInput, setDauerInput] = useState(
    formatDuration(Number(leistung.dauer)),
  );

  // ── Stopwatch (FEATURE 1 & 2): backend-persisted via useStopwatch hook.
  // The hook reconstructs elapsed time from the stored startTime on mount,
  // ticks locally every second for display, and on stop calls stopTimer then
  // updateLeistung to persist the dauer. Survives page navigation because the
  // running timer lives in the backend.
  const { running, displayMins, start, stop } = useStopwatch({
    leistungId: leistung.id,
    baseDauer: leistung.dauer,
    taetigkeit,
  });

  // Keep the Dauer input in sync with the persisted leistung.dauer when the
  // prop changes after a query refresh (e.g. after stop() invalidates the
  // leistungen query and the backend returns the new additive total). This
  // ensures the field reflects the authoritative backend value, not a stale
  // local edit. We skip the sync while the stopwatch is running so the live
  // ticking display is not overwritten.
  useEffect(() => {
    if (!running) {
      setDauerInput(formatDuration(Number(leistung.dauer)));
    }
  }, [leistung.dauer, running]);

  const mandat = mandate.find((m) => m.id === leistung.mandatId);
  const klient = klienten.find((k) => k.id === mandat?.klientId);
  const leistungserbringer = providers.find(
    (p) => p.id.toString() === leistung.leistungserbringerId.toString(),
  );
  const leistungserbringerName = leistungserbringer
    ? `${leistungserbringer.vorname} ${leistungserbringer.nachname}`
    : "–";

  function handleBlurTaetigkeit() {
    if (taetigkeit !== leistung.taetigkeit) {
      onUpdate(leistung.id, taetigkeit, leistung.dauer);
    }
  }

  function handleBlurDauer() {
    const mins = parseDuration(dauerInput);
    const formatted = formatDuration(mins);
    // Always normalize display to hh:mm on blur
    setDauerInput(formatted);
    const newDauer = BigInt(mins);
    if (newDauer !== leistung.dauer) {
      onUpdate(leistung.id, taetigkeit, newDauer);
    }
  }

  async function handleStopwatchToggle() {
    if (running) {
      try {
        // stop() returns the backend's authoritative total minutes
        // (baseDauer + elapsed), already persisted via updateLeistung. Use
        // this returned value — NOT the locally derived displayMins, which
        // is reset to baseDauer after stop and would lose the just-stopped
        // time.
        const totalMinutes = await stop();
        if (totalMinutes !== null) {
          setDauerInput(formatDuration(Number(totalMinutes)));
        }
        toast.success("Stoppuhr gestoppt und Dauer gespeichert");
      } catch (err) {
        toast.error(
          `Fehler beim Stoppen: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      try {
        await start();
        toast.success("Stoppuhr gestartet");
      } catch (err) {
        toast.error(
          `Fehler beim Starten: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  // Live display while stopwatch runs: base duration + elapsed, formatted as hh:mm.
  // displayMins is fractional (baseDauer minutes + elapsedSec/60); floor to whole
  // minutes for the hh:mm display per the requirement.
  const liveDisplay = formatDuration(Math.floor(displayMins));

  return (
    <tr
      className={`border-b border-border text-sm transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}
      data-ocid={`leistungen.row.${leistung.id}`}
    >
      <td className="w-8 px-3 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          data-ocid={`leistungen.checkbox.${leistung.id}`}
        />
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <span className="text-foreground font-medium truncate block max-w-[200px]">
          {klient?.name ?? "–"}
        </span>
        <span className="text-muted-foreground text-xs truncate block max-w-[200px]">
          {mandat?.bezeichnung ?? "–"}
        </span>
      </td>
      <td className="px-3 py-2 min-w-[160px]">
        <input
          value={taetigkeit}
          onChange={(e) => setTaetigkeit(e.target.value)}
          onBlur={handleBlurTaetigkeit}
          onKeyDown={(e) => e.key === "Enter" && handleBlurTaetigkeit()}
          placeholder="Tätigkeit eingeben…"
          className="w-full bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground focus:bg-muted/50 rounded px-1 py-0.5"
          data-ocid={`leistungen.taetigkeit_input.${leistung.id}`}
        />
      </td>
      <td className="px-3 py-2 w-[120px]">
        <div className="flex items-center gap-1">
          <input
            value={running ? liveDisplay : dauerInput}
            onChange={(e) => {
              if (!running) setDauerInput(e.target.value);
            }}
            onBlur={handleBlurDauer}
            onKeyDown={(e) => e.key === "Enter" && handleBlurDauer()}
            readOnly={running}
            inputMode="numeric"
            placeholder="00:00"
            className="w-16 bg-transparent border border-input rounded px-2 py-0.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            data-ocid={`leistungen.dauer_input.${leistung.id}`}
          />
          <button
            type="button"
            onClick={handleStopwatchToggle}
            title={running ? "Stopp" : "Starten"}
            data-ocid={`leistungen.stopwatch_button.${leistung.id}`}
            className={`p-1 rounded transition-colors ${running ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
          >
            {running ? <Square size={14} /> : <Play size={14} />}
          </button>
        </div>
      </td>
      <td className="px-3 py-2 w-[160px] text-right font-mono text-sm text-foreground">
        {formatCHF(leistung.honorar, currencySymbol(mandat?.waehrung))}
      </td>
      <td className="px-3 py-2 w-[160px]">
        <span className="text-foreground text-sm truncate block max-w-[150px]">
          {leistungserbringerName}
        </span>
      </td>
      <td className="px-3 py-2 w-10">
        {selected && (
          <button
            type="button"
            onClick={() => onDelete(leistung.id)}
            data-ocid={`leistungen.delete_button.${leistung.id}`}
            className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
            title="Löschen"
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── New Leistung Row ─────────────────────────────────────────────────────────

interface NewLeistungRowProps {
  klienten: Klient[];
  mandate: Mandat[];
  selectedDate: string;
  onSave: (mandatId: string, taetigkeit: string, dauer: bigint) => void;
  onCancel: () => void;
}

function NewLeistungRow({
  klienten,
  mandate,
  onSave,
  onCancel,
}: NewLeistungRowProps) {
  const [mandatId, setMandatId] = useState("");
  const [taetigkeit, setTaetigkeit] = useState("");
  const [dauerStr, setDauerStr] = useState("00:00");
  const taetigkeitRef = useRef<HTMLInputElement>(null);

  // Focus the Tätigkeit input once on mount
  useEffect(() => {
    taetigkeitRef.current?.focus();
  }, []);

  function handleSave() {
    if (!mandatId || !taetigkeit) return;
    onSave(mandatId, taetigkeit, BigInt(parseDuration(dauerStr)));
    onCancel();
  }

  return (
    <tr
      className="border-b border-border bg-primary/5 text-sm"
      data-ocid="leistungen.new_row"
    >
      <td className="px-3 py-2 w-8" />
      <td className="px-3 py-2 min-w-[180px]">
        <Select value={mandatId} onValueChange={setMandatId}>
          <SelectTrigger
            className="h-8 text-xs"
            data-ocid="leistungen.new_mandat_select"
          >
            <SelectValue placeholder="Klient / Mandat" />
          </SelectTrigger>
          <SelectContent>
            {mandate.map((m) => {
              const klient = klienten.find((k) => k.id === m.klientId);
              return (
                <SelectItem key={m.id} value={m.id}>
                  {klient?.name ?? "?"} – {m.bezeichnung}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <input
          value={taetigkeit}
          onChange={(e) => setTaetigkeit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Tätigkeit…"
          ref={taetigkeitRef}
          className="w-full bg-transparent border border-input rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          data-ocid="leistungen.new_taetigkeit_input"
        />
      </td>
      <td className="px-3 py-2 w-[120px]">
        <input
          value={dauerStr}
          onChange={(e) => setDauerStr(e.target.value)}
          onBlur={() => setDauerStr(formatDuration(parseDuration(dauerStr)))}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          inputMode="numeric"
          placeholder="00:00"
          className="w-16 border border-input rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
          data-ocid="leistungen.new_dauer_input"
        />
      </td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2" />
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            className="btn-success h-7 px-2 text-xs"
            data-ocid="leistungen.new_save_button"
          >
            Speichern
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-7 px-2 text-xs"
            data-ocid="leistungen.new_cancel_button"
          >
            Abbrechen
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Auslage Row ──────────────────────────────────────────────────────────────

interface AuslageRowProps {
  auslage: Auslage;
  klienten: Klient[];
  mandate: Mandat[];
  providers: Leistungserbringer[];
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (id: string, beschreibung: string, betrag: bigint) => void;
  onDelete: (id: string) => void;
}

function AuslageRow({
  auslage,
  klienten,
  mandate,
  providers,
  selected,
  onToggleSelect,
  onUpdate,
  onDelete,
}: AuslageRowProps) {
  const [beschreibung, setBeschreibung] = useState(auslage.beschreibung);
  const [betragStr, setBetragStr] = useState(
    (Number(auslage.betrag) / 100).toFixed(2),
  );

  const mandat = mandate.find((m) => m.id === auslage.mandatId);
  const klient = klienten.find((k) => k.id === mandat?.klientId);
  const leistungserbringer = providers.find(
    (p) => p.id.toString() === auslage.leistungserbringerId.toString(),
  );
  const leistungserbringerName = leistungserbringer
    ? `${leistungserbringer.vorname} ${leistungserbringer.nachname}`
    : "–";

  const kategorieLabels: Record<AuslagenKategorie, string> = {
    [AuslagenKategorieEnum.porto]: "Porto",
    [AuslagenKategorieEnum.kopien]: "Kopien",
    [AuslagenKategorieEnum.reise]: "Reise",
    [AuslagenKategorieEnum.andere]: "Andere",
  };

  function handleBlurBetrag() {
    const betrag = BigInt(Math.round(Number(betragStr) * 100));
    if (betrag !== auslage.betrag || beschreibung !== auslage.beschreibung) {
      onUpdate(auslage.id, beschreibung, betrag);
    }
  }

  return (
    <tr
      className={`border-b border-border text-sm transition-colors ${selected ? "bg-primary/5" : "hover:bg-muted/40"}`}
      data-ocid={`auslagen.row.${auslage.id}`}
    >
      <td className="w-8 px-3 py-2">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          data-ocid={`auslagen.checkbox.${auslage.id}`}
        />
      </td>
      <td className="px-3 py-2 min-w-[180px]">
        <span className="text-foreground font-medium truncate block max-w-[200px]">
          {klient?.name ?? "–"}
        </span>
        <span className="text-muted-foreground text-xs truncate block max-w-[200px]">
          {mandat?.bezeichnung ?? "–"}
        </span>
      </td>
      <td className="px-3 py-2 min-w-[160px]">
        <span className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground mr-2">
          {kategorieLabels[auslage.kategorie]}
        </span>
        <input
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          onBlur={handleBlurBetrag}
          placeholder="Beschreibung…"
          className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground focus:bg-muted/50 rounded px-1 py-0.5"
          data-ocid={`auslagen.beschreibung_input.${auslage.id}`}
        />
      </td>
      <td className="px-3 py-2 w-[140px]">
        <div className="flex items-center gap-1">
          <input
            value={betragStr}
            onChange={(e) => setBetragStr(e.target.value)}
            onBlur={handleBlurBetrag}
            onKeyDown={(e) => e.key === "Enter" && handleBlurBetrag()}
            className="w-20 border border-input rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            data-ocid={`auslagen.betrag_input.${auslage.id}`}
          />
          <span className="text-xs text-muted-foreground">
            {currencySymbol(mandat?.waehrung)}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 w-[160px]">
        <span className="text-foreground text-sm truncate block max-w-[150px]">
          {leistungserbringerName}
        </span>
      </td>
      <td className="px-3 py-2 w-10">
        {selected && (
          <button
            type="button"
            onClick={() => onDelete(auslage.id)}
            data-ocid={`auslagen.delete_button.${auslage.id}`}
            className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
            title="Löschen"
          >
            <Trash2 size={14} />
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── New Auslage Row ──────────────────────────────────────────────────────────

interface NewAuslageRowProps {
  klienten: Klient[];
  mandate: Mandat[];
  selectedDate: string;
  onSave: (
    mandatId: string,
    beschreibung: string,
    kategorie: AuslagenKategorie,
    betrag: bigint,
  ) => void;
  onCancel: () => void;
}

function NewAuslageRow({
  klienten,
  mandate,
  onSave,
  onCancel,
}: NewAuslageRowProps) {
  const [mandatId, setMandatId] = useState("");
  const [kategorie, setKategorie] = useState<AuslagenKategorie>(
    AuslagenKategorieEnum.andere,
  );
  const [beschreibung, setBeschreibung] = useState("");
  const [betragStr, setBetragStr] = useState("0.00");

  // Fix 10: Währungssuffix des Betrag-Eingabefelds folgt dem gewählten Mandat,
  // nicht hart codiert "CHF". currencySymbol normalisiert empty/undefined → "CHF".
  const selectedMandat = mandate.find((m) => m.id === mandatId);

  function handleSave() {
    if (!mandatId) return;
    const betrag = BigInt(Math.round(Number(betragStr) * 100));
    onSave(mandatId, beschreibung, kategorie, betrag);
    onCancel();
  }

  return (
    <tr
      className="border-b border-border bg-primary/5 text-sm"
      data-ocid="auslagen.new_row"
    >
      <td className="px-3 py-2 w-8" />
      <td className="px-3 py-2 min-w-[180px]">
        <Select value={mandatId} onValueChange={setMandatId}>
          <SelectTrigger
            className="h-8 text-xs"
            data-ocid="auslagen.new_mandat_select"
          >
            <SelectValue placeholder="Klient / Mandat" />
          </SelectTrigger>
          <SelectContent>
            {mandate.map((m) => {
              const klient = klienten.find((k) => k.id === m.klientId);
              return (
                <SelectItem key={m.id} value={m.id}>
                  {klient?.name ?? "?"} – {m.bezeichnung}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2 min-w-[200px]">
        <div className="flex items-center gap-2">
          <Select
            value={kategorie}
            onValueChange={(v) => setKategorie(v as AuslagenKategorie)}
          >
            <SelectTrigger
              className="h-8 w-28 text-xs"
              data-ocid="auslagen.new_kategorie_select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AuslagenKategorieEnum.porto}>Porto</SelectItem>
              <SelectItem value={AuslagenKategorieEnum.kopien}>
                Kopien
              </SelectItem>
              <SelectItem value={AuslagenKategorieEnum.reise}>Reise</SelectItem>
              <SelectItem value={AuslagenKategorieEnum.andere}>
                Andere
              </SelectItem>
            </SelectContent>
          </Select>
          <input
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Beschreibung…"
            className="flex-1 border border-input rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            data-ocid="auslagen.new_beschreibung_input"
          />
        </div>
      </td>
      <td className="px-3 py-2 w-[140px]">
        <div className="flex items-center gap-1">
          <input
            value={betragStr}
            onChange={(e) => setBetragStr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-20 border border-input rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            data-ocid="auslagen.new_betrag_input"
          />
          <span className="text-xs text-muted-foreground">
            {currencySymbol(selectedMandat?.waehrung)}
          </span>
        </div>
      </td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            onClick={handleSave}
            className="btn-success h-7 px-2 text-xs"
            data-ocid="auslagen.new_save_button"
          >
            Speichern
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-7 px-2 text-xs"
            data-ocid="auslagen.new_cancel_button"
          >
            Abbrechen
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Budget Summary Panel (FEATURE 3) ─────────────────────────────────────────
// Displays the aggregated Restbudget per Mandat (not per individual Leistung):
//   restbudget = totalBudget - totalHonorar - totalAuslagen
// Uses the useBudget hook (Map<mandatId, BudgetSummary>). Shown as a per-mandat
// summary panel above the Leistungen table, scoped to the mandates that appear
// in the currently filtered Leistungen/Auslagen for the selected day.

interface BudgetSummaryPanelProps {
  leistungen: Leistung[];
  auslagen: Auslage[];
  mandate: Mandat[];
  klienten: Klient[];
  budgetSummaries: Map<
    string,
    {
      restbudget: bigint;
      totalBudget: bigint;
      totalHonorar: bigint;
      totalAuslagen: bigint;
    }
  >;
  budgetLoading: boolean;
}

function BudgetSummaryPanel({
  leistungen,
  auslagen,
  mandate,
  klienten,
  budgetSummaries,
  budgetLoading,
}: BudgetSummaryPanelProps) {
  // Collect the distinct mandatIds that appear in today's filtered data.
  const mandatIds = new Set<string>();
  for (const l of leistungen) mandatIds.add(l.mandatId);
  for (const a of auslagen) mandatIds.add(a.mandatId);

  const rows = Array.from(mandatIds)
    .map((id) => {
      const m = mandate.find((mm) => mm.id === id);
      const k = klienten.find((kk) => kk.id === m?.klientId);
      const summary = budgetSummaries.get(id);
      return { id, mandat: m, klient: k, summary };
    })
    // Only show mandates that actually have a budget summary and a non-zero budget.
    .filter((r) => r.summary && r.mandat && r.mandat.budget > 0n);

  if (rows.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      data-ocid="leistungen.budget_summary_panel"
    >
      <h3 className="font-display font-semibold text-foreground text-sm mb-3">
        Restbudget pro Mandat
      </h3>
      {budgetLoading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(({ id, mandat, klient, summary }) => {
            if (!summary || !mandat) return null;
            const rest = summary.restbudget;
            const isNegative = rest < 0n;
            const usedPct =
              summary.totalBudget > 0n
                ? Math.min(
                    100,
                    Number(
                      ((summary.totalHonorar + summary.totalAuslagen) * 100n) /
                        summary.totalBudget,
                    ),
                  )
                : 0;
            return (
              <div
                key={id}
                className="border border-border rounded-md p-3 bg-background"
                data-ocid={`leistungen.budget_summary_card.${id}`}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {klient?.name ?? "–"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {mandat.bezeichnung}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-mono font-semibold shrink-0 ${isNegative ? "text-destructive" : "text-foreground"}`}
                    data-ocid={`leistungen.restbudget_value.${id}`}
                  >
                    {formatCHF(rest, currencySymbol(mandat.waehrung))}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono mb-1.5">
                  Budget{" "}
                  {formatCHF(
                    summary.totalBudget,
                    currencySymbol(mandat.waehrung),
                  )}{" "}
                  · Verbraucht{" "}
                  {formatCHF(
                    summary.totalHonorar + summary.totalAuslagen,
                    currencySymbol(mandat.waehrung),
                  )}
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${isNegative ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LeistungenPage() {
  const { actor, isLoading: actorLoading } = useBackend();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState<string>(todayDate());
  const [zeitraumFilter, setZeitraumFilter] = useState<ZeitraumFilter>("tag");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLeistungen, setSelectedLeistungen] = useState<Set<string>>(
    new Set(),
  );
  const [selectedAuslagen, setSelectedAuslagen] = useState<Set<string>>(
    new Set(),
  );
  const [showNewLeistung, setShowNewLeistung] = useState(false);
  const [showNewAuslage, setShowNewAuslage] = useState(false);
  const [providerFilterInitialized, setProviderFilterInitialized] =
    useState(false);
  // FEATURE 4: combined export loading flags for PDF/Excel buttons.
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const { data: providers = [] } = useQuery({
    queryKey: queryKeys.leistungserbringer(),
    queryFn: async () => (actor ? actor.getLeistungserbringer() : []),
    enabled: !!actor && !actorLoading,
  });

  // Auto-set the 'Leistungen von' filter to the logged-in user on page load.
  // Runs once when currentUser becomes available; the user can change it afterwards.
  useEffect(() => {
    if (providerFilterInitialized || !currentUser) return;
    setProviderFilter(currentUser.id.toString());
    setProviderFilterInitialized(true);
  }, [currentUser, providerFilterInitialized]);

  const { data: klienten = [] } = useQuery({
    queryKey: queryKeys.klienten(),
    queryFn: async () => (actor ? actor.getKlienten() : []),
    enabled: !!actor && !actorLoading,
  });

  const { data: mandate = [] } = useQuery({
    queryKey: queryKeys.mandate(),
    queryFn: async () => (actor ? actor.getMandate(null) : []),
    enabled: !!actor && !actorLoading,
  });

  // Zeitraum-Filter: compute datumVon/datumBis based on the selected filter
  // relative to selectedDate. Returns null for 'alles' (no date filter).
  const dateRange = computeDateRange(zeitraumFilter, selectedDate);

  const leistungFilter = {
    ...(dateRange ? { datumVon: dateRange.von, datumBis: dateRange.bis } : {}),
    ...(providerFilter !== "all"
      ? {
          leistungserbringerId: providers.find(
            (p) => p.id.toString() === providerFilter,
          )?.id as Principal | undefined,
        }
      : {}),
    ...(statusFilter !== "all"
      ? { status: statusFilter as "offen" | "verrechnet" }
      : {}),
  };

  const { data: leistungen = [], isLoading: leistungenLoading } = useQuery({
    queryKey: queryKeys.leistungen(leistungFilter),
    queryFn: async () => (actor ? actor.getLeistungen(leistungFilter) : []),
    enabled: !!actor && !actorLoading,
  });

  const auslagenFilterObj = {
    ...(dateRange ? { datumVon: dateRange.von, datumBis: dateRange.bis } : {}),
    ...(providerFilter !== "all"
      ? {
          leistungserbringerId: providers.find(
            (p) => p.id.toString() === providerFilter,
          )?.id as Principal | undefined,
        }
      : {}),
    ...(statusFilter !== "all"
      ? {
          status:
            statusFilter as (typeof AuslagenStatus)[keyof typeof AuslagenStatus],
        }
      : {}),
  };

  const { data: auslagen = [], isLoading: auslagenLoading } = useQuery({
    queryKey: queryKeys.auslagen(auslagenFilterObj),
    queryFn: async () => (actor ? actor.getAuslagen(auslagenFilterObj) : []),
    enabled: !!actor && !actorLoading,
  });

  // Dates with entries (for calendar dots) — load all leistungen for current month
  const { data: allLeistungen = [] } = useQuery({
    queryKey: ["leistungen", "month"],
    queryFn: async () => (actor ? actor.getLeistungen({}) : []),
    enabled: !!actor && !actorLoading,
  });

  const datesWithEntries = new Set(
    allLeistungen.map((l) => dateToDisplay(l.datum)),
  );

  // FEATURE 3: aggregated budget summaries (Map<mandatId, BudgetSummary>).
  const { summaries: budgetSummaries, isLoading: budgetLoading } = useBudget();

  // Kanzlei-Stammdaten für PDF-Kopfzeile (Kanzlei-Name als Fallback vor
  // Ersteller-Name, falls keine Kanzlei hinterlegt ist).
  const { data: kanzlei } = useKanzlei();

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createLeistungMut = useMutation({
    mutationFn: async ({
      mandatId,
      taetigkeit,
      dauer,
    }: { mandatId: string; taetigkeit: string; dauer: bigint }) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.createLeistung(
        mandatId,
        taetigkeit,
        selectedDate,
        dauer,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leistungen"] });
      toast.success("Leistung gespeichert");
    },
    onError: (e: Error) => toast.error(`Fehler beim Speichern: ${e.message}`),
  });

  const updateLeistungMut = useMutation({
    mutationFn: async ({
      id,
      taetigkeit,
      dauer,
    }: { id: string; taetigkeit: string; dauer: bigint }) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.updateLeistung(id, taetigkeit, dauer);
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leistungen"] });
      toast.success("Leistung gespeichert");
    },
    onError: (e: Error) => toast.error(`Fehler beim Speichern: ${e.message}`),
  });

  const deleteLeistungMut = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.deleteLeistung(id);
      if (res.__kind__ === "err") throw new Error(res.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leistungen"] });
      toast.success("Leistung gelöscht");
    },
    onError: (e: Error) => toast.error(`Fehler beim Löschen: ${e.message}`),
  });

  const createAuslageMut = useMutation({
    mutationFn: async ({
      mandatId,
      beschreibung,
      kategorie,
      betrag,
    }: {
      mandatId: string;
      beschreibung: string;
      kategorie: AuslagenKategorie;
      betrag: bigint;
    }) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.createAuslage(
        mandatId,
        beschreibung,
        kategorie,
        betrag,
        selectedDate,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auslagen"] });
      toast.success("Auslage gespeichert");
    },
    onError: (e: Error) => toast.error(`Fehler beim Speichern: ${e.message}`),
  });

  const updateAuslageMut = useMutation({
    mutationFn: async ({
      id,
      beschreibung,
      betrag,
    }: { id: string; beschreibung: string; betrag: bigint }) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.updateAuslage(id, beschreibung, betrag);
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auslagen"] });
      toast.success("Auslage gespeichert");
    },
    onError: (e: Error) => toast.error(`Fehler beim Speichern: ${e.message}`),
  });

  const deleteAuslageMut = useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.deleteAuslage(id);
      if (res.__kind__ === "err") throw new Error(res.err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auslagen"] });
      toast.success("Auslage gelöscht");
    },
    onError: (e: Error) => toast.error(`Fehler beim Löschen: ${e.message}`),
  });

  // ── Totals ─────────────────────────────────────────────────────────────────

  const totalDauerMinuten = leistungen.reduce(
    (sum, l) => sum + Number(l.dauer),
    0,
  );
  const totalHonorar = leistungen.reduce((sum, l) => sum + l.honorar, 0n);
  const totalAuslagenBetrag = auslagen.reduce((sum, a) => sum + a.betrag, 0n);

  // Fix 11 — Root Cause: totalHonorar/totalAuslagenBetrag summieren Beträge
  // über mehrere Mandate, die unterschiedliche Währungen (mandat.waehrung)
  // tragen können. Eine blinde Summe würde Äpfel mit Birnen addieren und
  // einen falschen, einheitlich formatierten Betrag ausweisen. Daher wird
  // die Währung nur dann ausgewiesen, wenn ALLE involvierten Mandate dieselbe
  // waehrung tragen; andernfalls wird der Totalbetrag ohne Währungssymbol
  // gezeigt und ein Mixed-Currency-Hinweis eingeblendet.
  const leistungWaehrungen = new Set(
    leistungen
      .map((l) => mandate.find((mm) => mm.id === l.mandatId)?.waehrung)
      .filter((c): c is string => Boolean(c)),
  );
  const auslageWaehrungen = new Set(
    auslagen
      .map((a) => mandate.find((mm) => mm.id === a.mandatId)?.waehrung)
      .filter((c): c is string => Boolean(c)),
  );
  const uniformLeistungWaehrung =
    leistungWaehrungen.size === 1
      ? (currencySymbol([...leistungWaehrungen][0]) ?? null)
      : null;
  const uniformAuslageWaehrung =
    auslageWaehrungen.size === 1
      ? (currencySymbol([...auslageWaehrungen][0]) ?? null)
      : null;

  // ── Export handlers (FEATURE 4) ────────────────────────────────────────────
  // Build rows from the currently displayed/filtered Leistungen and Auslagen,
  // then call the generic exportPdf / exportXlsx utilities with domain-specific
  // column definitions. A brief loading state is shown on the button and a
  // success toast fires once the file downloads.

  function buildLeistungExportRows() {
    return leistungen.map((l) => {
      const m = mandate.find((mm) => mm.id === l.mandatId);
      const k = klienten.find((kk) => kk.id === m?.klientId);
      const provider = providers.find(
        (p) => p.id.toString() === l.leistungserbringerId.toString(),
      );
      const leistungserbringer = provider
        ? `${provider.vorname} ${provider.nachname}`
        : "–";
      return {
        datum: dateToDisplay(l.datum),
        mandat: m ? `${k?.name ?? ""} – ${m.bezeichnung}` : (k?.name ?? ""),
        taetigkeit: l.taetigkeit,
        dauer: formatDuration(Number(l.dauer)),
        honorar: formatCHF(l.honorar, currencySymbol(m?.waehrung)),
        leistungserbringer,
      };
    });
  }

  function buildAuslageExportRows() {
    return auslagen.map((a) => {
      const m = mandate.find((mm) => mm.id === a.mandatId);
      const k = klienten.find((kk) => kk.id === m?.klientId);
      const kategorieLabels: Record<AuslagenKategorie, string> = {
        [AuslagenKategorieEnum.porto]: "Porto",
        [AuslagenKategorieEnum.kopien]: "Kopien",
        [AuslagenKategorieEnum.reise]: "Reise",
        [AuslagenKategorieEnum.andere]: "Andere",
      };
      const provider = providers.find(
        (p) => p.id.toString() === a.leistungserbringerId.toString(),
      );
      const leistungserbringer = provider
        ? `${provider.vorname} ${provider.nachname}`
        : "–";
      return {
        datum: dateToDisplay(a.datum),
        mandat: m ? `${k?.name ?? ""} – ${m.bezeichnung}` : (k?.name ?? ""),
        kategorie: kategorieLabels[a.kategorie],
        beschreibung: a.beschreibung,
        betrag: formatCHF(a.betrag, currencySymbol(m?.waehrung)),
        leistungserbringer,
      };
    });
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      // Ersteller-Name (aktueller Benutzer) als Fallback für Kanzlei-Name,
      // falls keine Kanzlei hinterlegt ist.
      const erstellerName = currentUser
        ? `${currentUser.vorname} ${currentUser.nachname}`
        : "Unbekannt";
      const kanzleiName =
        kanzlei?.name ?? (currentUser ? erstellerName : "Kanzlei");

      // Aufgelöster Provider-Name für den Filter-Text in der Kopfzeile.
      const filterProvider =
        providerFilter === "all"
          ? undefined
          : (() => {
              const p = providers.find(
                (pp) => pp.id.toString() === providerFilter,
              );
              return p ? `${p.vorname} ${p.nachname}` : undefined;
            })();

      // Status-Filter als deutsches Label für die Kopfzeile.
      const filterStatus =
        statusFilter === "all"
          ? undefined
          : statusFilter === "offen"
            ? "Offen"
            : "Verrechnet";

      // Summen in Rappen für die Total-Zeilen.
      const totalHonorarRappen = leistungen.reduce(
        (sum, l) => sum + l.honorar,
        0n,
      );
      const totalAuslagenRappen = auslagen.reduce(
        (sum, a) => sum + a.betrag,
        0n,
      );
      const gesamttotalRappen = totalHonorarRappen + totalAuslagenRappen;

      // Fix 11 — Root Cause: Die Total-Zeilen summieren Honorare/Auslagen
      // über mehrere Mandate, die unterschiedliche Währungen (mandat.waehrung)
      // haben können. Eine blinde Summe würde Äpfel mit Birnen addieren und
      // einen falschen, einheitlich formatierten Betrag ausweisen. Daher wird
      // die Währung nur dann ausgewiesen, wenn ALLE involvierten Mandate
      // dieselbe waehrung tragen; andernfalls wird der Totalbetrag ohne
      // Währungssymbol gezeigt und ein Mixed-Currency-Hinweis ausgegeben.
      const leistungMandate = leistungen.map(
        (l) => mandate.find((mm) => mm.id === l.mandatId)?.waehrung,
      );
      const auslageMandate = auslagen.map(
        (a) => mandate.find((mm) => mm.id === a.mandatId)?.waehrung,
      );
      const allMandateCurrencies = [...leistungMandate, ...auslageMandate];
      const distinctCurrencies = new Set(
        allMandateCurrencies.filter((c): c is string => Boolean(c)),
      );
      const uniformCurrency =
        distinctCurrencies.size === 1
          ? (currencySymbol([...distinctCurrencies][0]) ?? null)
          : null;
      const leistungCurrencies = new Set(
        leistungMandate.filter((c): c is string => Boolean(c)),
      );
      const auslageCurrencies = new Set(
        auslageMandate.filter((c): c is string => Boolean(c)),
      );
      const uniformLeistungCurrency =
        leistungCurrencies.size === 1
          ? (currencySymbol([...leistungCurrencies][0]) ?? null)
          : null;
      const uniformAuslageCurrency =
        auslageCurrencies.size === 1
          ? (currencySymbol([...auslageCurrencies][0]) ?? null)
          : null;
      const mixedCurrencyDisclaimer =
        uniformCurrency === null && allMandateCurrencies.length > 0
          ? "Hinweis: Total über mehrere Währungen — ohne Währungssymbol."
          : undefined;

      await exportPdf({
        title: "Leistungen & Auslagen",
        subtitle: formatZeitraumHeading(zeitraumFilter, selectedDate),
        kopfzeile: {
          kanzleiName,
          ersteller: erstellerName,
          erstellungsdatum: formatDate(todayDate()),
          filterLeistungserbringer: filterProvider,
          filterStatus,
        },
        sections: [
          {
            title: "Leistungen",
            columns: [
              { header: "Datum", dataKey: "datum" },
              { header: "Mandat", dataKey: "mandat" },
              { header: "Tätigkeit", dataKey: "taetigkeit" },
              { header: "Dauer", dataKey: "dauer" },
              { header: "Honorar", dataKey: "honorar" },
              { header: "Leistungserbringer", dataKey: "leistungserbringer" },
            ],
            rows: buildLeistungExportRows(),
            totalLabel: "Total Leistungen",
            totalValue: formatCHF(
              totalHonorarRappen,
              uniformLeistungCurrency ?? "",
            ),
          },
          {
            title: "Auslagen",
            columns: [
              { header: "Datum", dataKey: "datum" },
              { header: "Mandat", dataKey: "mandat" },
              { header: "Kategorie", dataKey: "kategorie" },
              { header: "Beschreibung", dataKey: "beschreibung" },
              { header: "Betrag", dataKey: "betrag" },
              { header: "Leistungserbringer", dataKey: "leistungserbringer" },
            ],
            rows: buildAuslageExportRows(),
            totalLabel: "Total Auslagen",
            totalValue: formatCHF(
              totalAuslagenRappen,
              uniformAuslageCurrency ?? "",
            ),
          },
        ],
        grandTotalLabel:
          uniformCurrency === null && allMandateCurrencies.length > 0
            ? `Gesamttotal (gemischte Währungen — ${mixedCurrencyDisclaimer ?? ""})`
            : "Gesamttotal",
        grandTotalValue: formatCHF(gesamttotalRappen, uniformCurrency ?? ""),
        filename: `Leistungen_Auslagen_${selectedDate.replace(/\./g, "-")}.pdf`,
      });
      toast.success("PDF exportiert");
    } catch (err) {
      toast.error(
        `PDF-Export fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportExcel() {
    setExportingXlsx(true);
    try {
      await exportXlsx({
        sheets: [
          {
            sheetName: "Leistungen",
            columns: [
              { header: "Datum", key: "datum", width: 14 },
              { header: "Mandat", key: "mandat", width: 32 },
              { header: "Leistung", key: "taetigkeit", width: 40 },
              { header: "Dauer", key: "dauer", width: 10 },
              { header: "Honorar", key: "honorar", width: 16 },
              {
                header: "Leistungserbringer",
                key: "leistungserbringer",
                width: 24,
              },
            ],
            rows: buildLeistungExportRows(),
          },
          {
            sheetName: "Auslagen",
            columns: [
              { header: "Datum", key: "datum", width: 14 },
              { header: "Mandat", key: "mandat", width: 32 },
              { header: "Kategorie", key: "kategorie", width: 14 },
              { header: "Beschreibung", key: "beschreibung", width: 40 },
              { header: "Betrag", key: "betrag", width: 16 },
              {
                header: "Leistungserbringer",
                key: "leistungserbringer",
                width: 24,
              },
            ],
            rows: buildAuslageExportRows(),
          },
        ],
        filename: `Leistungen_Auslagen_${selectedDate.replace(/\./g, "-")}.xlsx`,
      });
      toast.success("Excel exportiert");
    } catch (err) {
      toast.error(
        `Excel-Export fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setExportingXlsx(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div data-ocid="leistungen.page" className="flex h-full overflow-hidden">
      {/* Left: Calendar */}
      <MiniCalendar
        selectedDate={selectedDate}
        onSelect={(date) => {
          setSelectedDate(date);
          setSelectedLeistungen(new Set());
          setSelectedAuslagen(new Set());
        }}
        datesWithEntries={datesWithEntries}
        zitraumFilter={zeitraumFilter}
        onZeitraumChange={setZeitraumFilter}
      />

      {/* Right: Content */}
      <div className="flex-1 flex flex-col overflow-auto bg-background">
        {/* Header bar */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-3 flex items-center gap-3 flex-wrap">
          {/* Date heading */}
          <h2 className="font-display font-semibold text-foreground text-base flex-1 min-w-[200px]">
            {formatZeitraumHeading(zeitraumFilter, selectedDate)}
          </h2>

          {/* Provider filter — 'Leistungen von', available to all users */}
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger
              className="h-8 w-[200px] text-xs"
              data-ocid="leistungen.provider_filter"
            >
              <SelectValue placeholder="Leistungen von" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p.id.toString()} value={p.id.toString()}>
                  {p.vorname} {p.nachname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger
              className="h-8 w-[130px] text-xs"
              data-ocid="leistungen.status_filter"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="offen">Offen</SelectItem>
              <SelectItem value="verrechnet">Verrechnet</SelectItem>
            </SelectContent>
          </Select>

          {/* Export buttons — combined Leistungen & Auslagen (FEATURE 4) */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExportPdf}
            disabled={
              exportingPdf || (leistungen.length === 0 && auslagen.length === 0)
            }
            data-ocid="leistungen.pdf_export_button"
          >
            <FileDown size={14} />
            {exportingPdf ? "Export…" : "PDF"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExportExcel}
            disabled={
              exportingXlsx ||
              (leistungen.length === 0 && auslagen.length === 0)
            }
            data-ocid="leistungen.excel_export_button"
          >
            <FileSpreadsheet size={14} />
            {exportingXlsx ? "Export…" : "Excel"}
          </Button>
        </div>

        {/* Main content */}
        <div className="p-6 space-y-8 flex-1">
          {/* ── Budget Summary (FEATURE 3) ──────────────────────────────── */}
          <BudgetSummaryPanel
            leistungen={leistungen}
            auslagen={auslagen}
            mandate={mandate}
            klienten={klienten}
            budgetSummaries={budgetSummaries}
            budgetLoading={budgetLoading}
          />

          {/* ── Leistungen Table ─────────────────────────────────────────── */}
          <section data-ocid="leistungen.section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-foreground text-base">
                Leistungen
              </h3>
              <Button
                size="sm"
                className="btn-success gap-1.5 h-8 text-xs"
                onClick={() => setShowNewLeistung(true)}
                data-ocid="leistungen.add_button"
              >
                <Plus size={14} />
                Neue Leistung
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 text-left font-medium">
                      Klient / Mandat
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Tätigkeit
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Dauer</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Honorar
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Leistungserbringer
                    </th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {leistungenLoading ? (
                    (["skel-l-1", "skel-l-2", "skel-l-3"] as const).map((k) => (
                      <tr key={k} className="border-b border-border">
                        <td className="px-3 py-3" colSpan={7}>
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : leistungen.length === 0 && !showNewLeistung ? (
                    <tr data-ocid="leistungen.empty_state">
                      <td
                        colSpan={7}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        Keine Leistungen für diesen Zeitraum. Klicken Sie auf
                        „Neue Leistung", um eine Eintragung hinzuzufügen.
                      </td>
                    </tr>
                  ) : (
                    leistungen.map((l) => (
                      <LeistungRow
                        key={l.id}
                        leistung={l}
                        klienten={klienten}
                        mandate={mandate}
                        providers={providers}
                        selected={selectedLeistungen.has(l.id)}
                        onToggleSelect={() =>
                          setSelectedLeistungen((prev) => {
                            const next = new Set(prev);
                            if (next.has(l.id)) next.delete(l.id);
                            else next.add(l.id);
                            return next;
                          })
                        }
                        onUpdate={(id, taetigkeit, dauer) =>
                          updateLeistungMut.mutate({ id, taetigkeit, dauer })
                        }
                        onDelete={(id) => deleteLeistungMut.mutate(id)}
                      />
                    ))
                  )}

                  {/* New row */}
                  {showNewLeistung && (
                    <NewLeistungRow
                      klienten={klienten}
                      mandate={mandate}
                      selectedDate={selectedDate}
                      onSave={(mandatId, taetigkeit, dauer) =>
                        createLeistungMut.mutate({
                          mandatId,
                          taetigkeit,
                          dauer,
                        })
                      }
                      onCancel={() => setShowNewLeistung(false)}
                    />
                  )}

                  {/* Summary row */}
                  {leistungen.length > 0 && (
                    <tr
                      className="border-t-2 border-border bg-muted/20 text-sm font-semibold"
                      data-ocid="leistungen.summary_row"
                    >
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-muted-foreground">Total</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 font-mono">
                        {formatDuration(totalDauerMinuten)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCHF(totalHonorar, uniformLeistungWaehrung ?? "")}
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Auslagen Table ───────────────────────────────────────────── */}
          <section data-ocid="auslagen.section">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-foreground text-base">
                Auslagen
              </h3>
              <Button
                size="sm"
                className="btn-success gap-1.5 h-8 text-xs"
                onClick={() => setShowNewAuslage(true)}
                data-ocid="auslagen.add_button"
              >
                <Plus size={14} />
                Neue Auslage
              </Button>
            </div>

            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="w-8 px-3 py-2" />
                    <th className="px-3 py-2 text-left font-medium">
                      Klient / Mandat
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Beschreibung
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Betrag</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Leistungserbringer
                    </th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {auslagenLoading ? (
                    (["skel-a-1", "skel-a-2"] as const).map((k) => (
                      <tr key={k} className="border-b border-border">
                        <td className="px-3 py-3" colSpan={6}>
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : auslagen.length === 0 && !showNewAuslage ? (
                    <tr data-ocid="auslagen.empty_state">
                      <td
                        colSpan={6}
                        className="px-3 py-10 text-center text-sm text-muted-foreground"
                      >
                        Keine Auslagen für diesen Zeitraum.
                      </td>
                    </tr>
                  ) : (
                    auslagen.map((a) => (
                      <AuslageRow
                        key={a.id}
                        auslage={a}
                        klienten={klienten}
                        mandate={mandate}
                        providers={providers}
                        selected={selectedAuslagen.has(a.id)}
                        onToggleSelect={() =>
                          setSelectedAuslagen((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.id)) next.delete(a.id);
                            else next.add(a.id);
                            return next;
                          })
                        }
                        onUpdate={(id, beschreibung, betrag) =>
                          updateAuslageMut.mutate({ id, beschreibung, betrag })
                        }
                        onDelete={(id) => deleteAuslageMut.mutate(id)}
                      />
                    ))
                  )}

                  {/* New auslage row */}
                  {showNewAuslage && (
                    <NewAuslageRow
                      klienten={klienten}
                      mandate={mandate}
                      selectedDate={selectedDate}
                      onSave={(mandatId, beschreibung, kategorie, betrag) =>
                        createAuslageMut.mutate({
                          mandatId,
                          beschreibung,
                          kategorie,
                          betrag,
                        })
                      }
                      onCancel={() => setShowNewAuslage(false)}
                    />
                  )}

                  {/* Summary row */}
                  {auslagen.length > 0 && (
                    <tr
                      className="border-t-2 border-border bg-muted/20 text-sm font-semibold"
                      data-ocid="auslagen.summary_row"
                    >
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-muted-foreground">Total</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 font-mono">
                        {formatCHF(
                          totalAuslagenBetrag,
                          uniformAuslageWaehrung ?? "",
                        )}
                      </td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
