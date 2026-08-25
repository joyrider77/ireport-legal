import type { ActiveUserMonth, ActiveUsersYearReport } from "@/backend";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  queryKeys,
  useBackend,
  useGetActiveUsersPerMonth,
} from "@/utils/backend";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  UserCheck,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Deutsche Monatsnamen (kurz), Index 0 = Januar — für die Spalten-Header. */
const MONATE_KURZ = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
] as const;

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1; // 1–12

// ─── Rolling-Window Helpers ───────────────────────────────────────────────────

/**
 * Ein einzelner Monat im rollenden Fenster. `year`/`month` sind die echten
 * Kalenderwerte (das Fenster kann zwei Kalenderjahre überspannen), `label`
 * ist die Anzeigeform "Jul 25".
 */
interface WindowMonth {
  year: number;
  month: number; // 1–12
  label: string;
}

/**
 * Baut das rollende 12-Monats-Fenster. Das Fenster endet am
 * `(selectedYear, currentMonth)` und reicht 12 Monate zurück. Bei
 * `selectedYear === currentYear` endet das Fenster also mit dem aktuellen
 * Kalendermonat; bei einem Vorjahr endet es im gleichen Kalendermonat des
 * gewählten Jahres.
 */
function buildRollingWindow(selectedYear: number): WindowMonth[] {
  // Endpunkt als absoluter Monatsindex (Jahr*12 + (Monat-1)).
  const endAbs = selectedYear * 12 + (currentMonth - 1);
  const window: WindowMonth[] = [];
  for (let i = 11; i >= 0; i--) {
    const abs = endAbs - i;
    const year = Math.floor(abs / 12);
    const month = (abs % 12) + 1; // 1–12
    const yy = String(year).slice(-2);
    window.push({
      year,
      month,
      label: `${MONATE_KURZ[month - 1]} ${yy}`,
    });
  }
  return window;
}

// ─── Row Helpers ──────────────────────────────────────────────────────────────

interface UserRow {
  /** Stabiler Schlüssel — Principal als Text. */
  key: string;
  name: string;
  /** 12 Einträge, einer pro Fenster-Monat. `null` wenn der Benutzer in
   *  diesem Monat nicht in der Antwort enthalten ist (z. B. vor der
   *  Registrierung). */
  activePerMonth: (boolean | null)[];
}

/**
 * Sortiert die Monate des Reports nach (year, month) aufsteigend, damit die
 * Reihenfolge mit dem rollenden Fenster (ältester Monat zuerst) übereinstimmt.
 */
function sortMonths(months: ActiveUserMonth[] | undefined): ActiveUserMonth[] {
  if (!months) return [];
  return [...months].sort(
    (a, b) =>
      Number(a.year) * 12 +
      Number(a.month) -
      (Number(b.year) * 12 + Number(b.month)),
  );
}

/**
 * Eindeutige Benutzerliste über alle Monate des Fensters hinweg. Die
 * Reihenfolge folgt dem ersten Auftreten (ältester Monat zuerst), damit die
 * Tabelle stabil bleibt, auch wenn ein Benutzer erst später hinzukommt.
 */
function buildUserRows(
  report: ActiveUsersYearReport | null | undefined,
  windowMonths: WindowMonth[],
): UserRow[] {
  if (!report) return [];

  const sorted = sortMonths(report.months);

  // Lookup: (year, month) → ActiveUserMonth.
  const byKey = new Map<string, ActiveUserMonth>();
  for (const m of sorted) {
    byKey.set(`${Number(m.year)}-${Number(m.month)}`, m);
  }

  // Benutzer in Reihenfolge ihres ersten Auftretens sammeln.
  const order: string[] = [];
  const nameByKey = new Map<string, string>();
  for (const m of sorted) {
    for (const u of m.users) {
      const key = u.userId.toString();
      if (!nameByKey.has(key)) {
        nameByKey.set(key, u.name);
        order.push(key);
      }
    }
  }

  return order.map((key) => ({
    key,
    name: nameByKey.get(key) ?? key,
    activePerMonth: windowMonths.map((wm) => {
      const m = byKey.get(`${wm.year}-${wm.month}`);
      if (!m) return null;
      const u = m.users.find((x) => x.userId.toString() === key);
      return u ? u.isActive : null;
    }),
  }));
}

/** Monatstotal pro Fenster-Spalte (Summe der aktiven Benutzer). */
function buildMonthTotals(
  report: ActiveUsersYearReport | null | undefined,
  windowMonths: WindowMonth[],
): number[] {
  if (!report) return Array.from({ length: 12 }, () => 0);
  const byKey = new Map<string, number>();
  for (const m of report.months) {
    byKey.set(`${Number(m.year)}-${Number(m.month)}`, Number(m.total));
  }
  return windowMonths.map((wm) => byKey.get(`${wm.year}-${wm.month}`) ?? 0);
}

// ─── URL-Query-Sync (year) ────────────────────────────────────────────────────

/**
 * Initialisiert das gewählte Jahr aus dem URL-Query-Parameter `?year=YYYY`.
 * Fällt auf das aktuelle Jahr zurück, wenn der Parameter fehlt oder ungültig
 * ist. Einmalige Initialisierung beim Mount — die laufende Synchronisation
 * beim Paging übernimmt `useEffect` + `history.replaceState`.
 */
function initialYearFromUrl(): number {
  if (typeof window === "undefined") return currentYear;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("year");
  if (!raw) return currentYear;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 2000 || parsed > 2100) {
    return currentYear;
  }
  return parsed;
}

/**
 * Schreibt das gewählte Jahr in den URL-Query-Parameter `?year=YYYY`, ohne
 * einen History-Eintrag zu erzeugen (replaceState). So überlebt der Filter
 * einen Seiten-Refresh und ist über die URL teilbar.
 */
function syncYearToUrl(year: number) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("year", String(year));
  window.history.replaceState(null, "", url.toString());
}

// ─── Reusable View (eingebettet in Tab 2 der Benutzerverwaltung) ──────────────

/**
 * AktiveBenutzerView — die wiederverwendbare Kanzlei-Admin-Ansicht der aktiven
 * Benutzer pro Monat. Wird sowohl von der eigenständigen AktiveBenutzerPage
 * (Route /app/aktive-benutzer) als auch in Tab 2 der BenutzerverwaltungPage
 * gerendert (für Nicht-Plattform-Admins). KEIN CSV/PDF-Export in dieser Ansicht.
 *
 * Rollendes 12-Monats-Fenster: die letzte Spalte ist der aktuelle Monat
 * (bzw. der Endpunkt des gewählten Jahres), die erste Spalte liegt 11 Monate
 * davor. Monatsnamen werden dynamisch aus dem Fenster abgeleitet
 * (z. B. "Jul 25", "Aug 25" … "Jun 26"). Monate vor der Registrierung eines
 * Benutzers zeigen "nicht vorhanden" (null).
 */
export function AktiveBenutzerView() {
  const { actor, isLoading: actorLoading } = useBackend();
  const [selectedYear, setSelectedYear] = useState<number>(initialYearFromUrl);

  // URL-Sync: schreibt das gewählte Jahr bei jeder Änderung in die URL.
  useEffect(() => {
    syncYearToUrl(selectedYear);
  }, [selectedYear]);

  // Aktueller Benutzer → kanzleiId für den Backend-Aufruf.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const kanzleiId = currentUser?.kanzleiId ?? "";

  const {
    data: report,
    isLoading: reportLoading,
    isError,
  } = useGetActiveUsersPerMonth(kanzleiId, BigInt(selectedYear));

  const windowMonths = useMemo(
    () => buildRollingWindow(selectedYear),
    [selectedYear],
  );
  const rows = useMemo(
    () => buildUserRows(report, windowMonths),
    [report, windowMonths],
  );
  const monthTotals = useMemo(
    () => buildMonthTotals(report, windowMonths),
    [report, windowMonths],
  );
  // Jahrestotal aus dem Backend-Report (DISTINCT aktive Benutzer über das
  // rollende Fenster). Fällt auf 0 zurück, wenn der Report noch nicht geladen
  // ist.
  const yearTotal = useMemo(
    () => (report ? Number(report.yearTotal) : 0),
    [report],
  );
  const totalActiveUsers = useMemo(
    () => monthTotals.reduce((max, t) => Math.max(max, t), 0),
    [monthTotals],
  );

  const isLoading = reportLoading || (actorLoading && !report);

  function goToPrevYear() {
    setSelectedYear((y) => y - 1);
  }
  function goToNextYear() {
    setSelectedYear((y) => y + 1);
  }

  return (
    <div data-ocid="aktive_benutzer.view" className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display font-semibold text-foreground text-xl">
            Aktive Benutzer pro Monat
          </h2>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Erklärung zum Status aktiv"
                  data-ocid="aktive_benutzer.info_tooltip"
                  className="text-muted-foreground hover:text-foreground transition-smooth rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs leading-relaxed">
                <p>
                  <strong>Aktiv</strong> bedeutet, dass der Benutzerstatus in
                  diesem Monat <code className="font-mono">aktiv</code> war.
                  Login-Aktivität und erfasste Leistungen fliessen{" "}
                  <em>nicht</em> in diese Zählung ein.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-sm text-muted-foreground">
          Rollende 12-Monats-Übersicht über alle Benutzer dieser Kanzlei und
          ihren Status (&laquo;aktiv&raquo;). Die letzte Spalte entspricht dem
          Endmonat des gewählten Fensters.
        </p>
      </header>

      {/* ── Hinweis-Note ───────────────────────────────────────────────────── */}
      <div
        data-ocid="aktive_benutzer.note"
        className="flex items-start gap-2.5 rounded-md border border-info/30 bg-info/5 px-4 py-3 text-sm text-foreground"
      >
        <Info size={15} className="mt-0.5 shrink-0 text-info" />
        <p className="leading-relaxed">
          Massgeblich ist ausschliesslich der Benutzerstatus{" "}
          <span className="font-medium">aktiv</span>. Anmeldungen und erfasste
          Leistungen werden <span className="font-medium">nicht</span>{" "}
          berücksichtigt.
        </p>
      </div>

      {/* ── Jahr-Paging (±1) ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Jahr</span>
        <fieldset
          aria-label="Jahr-Auswahl"
          className="flex items-center gap-1 border-0 p-0 m-0"
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={goToPrevYear}
            aria-label="Vorheriges Jahr"
            data-ocid="aktive_benutzer.year_prev"
          >
            <ChevronLeft size={16} />
          </Button>
          <span
            className="min-w-[64px] text-center text-sm font-semibold tabular-nums text-foreground px-2"
            data-ocid="aktive_benutzer.year_display"
          >
            {selectedYear}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={goToNextYear}
            aria-label="Nächstes Jahr"
            data-ocid="aktive_benutzer.year_next"
          >
            <ChevronRight size={16} />
          </Button>
        </fieldset>
        <span className="text-xs text-muted-foreground">
          Fenster endet {MONATE_KURZ[currentMonth - 1]} {selectedYear}
        </span>
      </div>

      {/* ── Tabelle ────────────────────────────────────────────────────────── */}
      <section data-ocid="aktive_benutzer.table_section">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Horizontal scrollbar — 12 Monatsspalten + Namensspalte sind breit. */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[820px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium border-r border-border min-w-[220px]"
                  >
                    Benutzer
                  </th>
                  {windowMonths.map((wm, i) => (
                    <th
                      key={`${wm.year}-${wm.month}`}
                      scope="col"
                      className="px-3 py-3 text-center font-medium min-w-[52px]"
                      data-ocid={`aktive_benutzer.month_header.${i + 1}`}
                    >
                      {wm.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-3 py-3 text-center font-semibold border-l border-border min-w-[64px] text-primary"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  // ── Loading State ──────────────────────────────────────────
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr
                      key={`sk-skeleton-${i + 1}`}
                      data-ocid="aktive_benutzer.loading_state"
                      className="border-b border-border"
                    >
                      <td className="sticky left-0 z-10 bg-card px-4 py-3 border-r border-border">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      {windowMonths.map((wm) => (
                        <td
                          key={`${wm.year}-${wm.month}`}
                          className="px-3 py-3 text-center"
                        >
                          <Skeleton className="h-4 w-4 mx-auto rounded-full" />
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center border-l border-border">
                        <Skeleton className="h-4 w-8 mx-auto" />
                      </td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  // ── Empty State ───────────────────────────────────────────
                  <tr>
                    <td colSpan={14}>
                      <div
                        data-ocid="aktive_benutzer.empty_state"
                        className="flex flex-col items-center py-16 gap-3"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                          <Users size={28} className="text-muted-foreground" />
                        </div>
                        <p className="font-medium text-foreground">
                          Keine Benutzer gefunden
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-sm">
                          Für das gewählte Fenster (endet{" "}
                          {MONATE_KURZ[currentMonth - 1]} {selectedYear}) liegen
                          keine Daten vor. Wählen Sie ein anderes Jahr oder
                          legen Sie Benutzer in der Benutzerverwaltung an.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : isError ? (
                  // ── Error State ───────────────────────────────────────────
                  <tr>
                    <td colSpan={14}>
                      <div
                        data-ocid="aktive_benutzer.error_state"
                        className="flex flex-col items-center py-16 gap-3"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                          <Info size={28} className="text-destructive" />
                        </div>
                        <p className="font-medium text-foreground">
                          Daten konnten nicht geladen werden
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Versuchen Sie es später erneut.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // ── Datenzeilen ───────────────────────────────────────────
                  rows.map((row, idx) => (
                    <tr
                      key={row.key}
                      data-ocid={`aktive_benutzer.row.${idx + 1}`}
                      className={
                        idx % 2 === 1
                          ? "border-b border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                          : "border-b border-border hover:bg-muted/40 transition-colors"
                      }
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3 border-r border-border font-medium text-foreground whitespace-nowrap">
                        {row.name}
                      </td>
                      {row.activePerMonth.map((active, mIdx) => (
                        <td
                          key={`month-${windowMonths[mIdx].year}-${windowMonths[mIdx].month}`}
                          className="px-3 py-3 text-center"
                        >
                          {active === null ? (
                            // Benutzer in diesem Monat nicht vorhanden
                            // (z. B. vor der Registrierung).
                            <span
                              aria-label="nicht vorhanden"
                              title="nicht vorhanden"
                              className="inline-block text-muted-foreground/40"
                            >
                              &middot;
                            </span>
                          ) : active ? (
                            // Aktiv — grünes Häkchen.
                            <span
                              data-ocid={`aktive_benutzer.active.${idx + 1}.${mIdx + 1}`}
                              aria-label="aktiv"
                              title="aktiv"
                              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent"
                            >
                              <UserCheck size={14} />
                            </span>
                          ) : (
                            // Inaktiv — Strich.
                            <span
                              data-ocid={`aktive_benutzer.inactive.${idx + 1}.${mIdx + 1}`}
                              aria-label="inaktiv"
                              title="inaktiv"
                              className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground/50"
                            >
                              <Minus size={14} />
                            </span>
                          )}
                        </td>
                      ))}
                      {/* Jahrestotal-Spalte: Häkchen, wenn der Benutzer im
                          gesamten Fenster in mindestens einem Monat aktiv
                          war. */}
                      <td className="px-3 py-3 text-center border-l border-border">
                        {row.activePerMonth.some((a) => a === true) ? (
                          <span
                            data-ocid={`aktive_benutzer.year_active.${idx + 1}`}
                            aria-label="im Fenster mindestens einmal aktiv"
                            title="im Fenster mindestens einmal aktiv"
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent"
                          >
                            <UserCheck size={14} />
                          </span>
                        ) : (
                          <span
                            aria-label="im Fenster nie aktiv"
                            title="im Fenster nie aktiv"
                            className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground/50"
                          >
                            <Minus size={14} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* ── Totalzeile ─────────────────────────────────────────────────── */}
              {!isLoading && rows.length > 0 && !isError && (
                <tfoot>
                  <tr
                    data-ocid="aktive_benutzer.totals_row"
                    className="border-t-2 border-primary/30 bg-primary/5 font-medium text-foreground"
                  >
                    <td className="sticky left-0 z-10 bg-primary/5 px-4 py-3 border-r border-border font-semibold whitespace-nowrap">
                      Monatstotal aktiv
                    </td>
                    {monthTotals.map((total, mIdx) => (
                      <td
                        key={`total-month-${windowMonths[mIdx].year}-${windowMonths[mIdx].month}`}
                        data-ocid={`aktive_benutzer.total.${mIdx + 1}`}
                        className="px-3 py-3 text-center tabular-nums text-primary font-semibold"
                      >
                        {total}
                      </td>
                    ))}
                    {/* Jahrestotal — eindeutige aktive Benutzer im gesamten
                        Fenster (DISTINCT, aus dem Backend-Report). */}
                    <td
                      data-ocid="aktive_benutzer.year_total"
                      className="px-3 py-3 text-center tabular-nums text-primary font-bold border-l border-border bg-primary/10"
                    >
                      {yearTotal}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── Legende ──────────────────────────────────────────────────────── */}
        {!isLoading && rows.length > 0 && !isError && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent">
                <UserCheck size={14} />
              </span>
              aktiv (Status = aktiv)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground/50">
                <Minus size={14} />
              </span>
              inaktiv
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground/40">&middot;</span>
              nicht vorhanden
            </span>
            <span className="ml-auto text-muted-foreground">
              Höchstes Monatstotal:{" "}
              <span className="font-semibold text-foreground">
                {totalActiveUsers}
              </span>{" "}
              aktive Benutzer
            </span>
            <span className="text-muted-foreground">
              Jahrestotal:{" "}
              <span className="font-semibold text-foreground">{yearTotal}</span>{" "}
              eindeutige aktive Benutzer
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Page (eigenständige Route /app/aktive-benutzer) ──────────────────────────

export function AktiveBenutzerPage() {
  return (
    <div
      data-ocid="aktive_benutzer.page"
      className="p-6 space-y-6 max-w-[1400px] mx-auto"
    >
      <AktiveBenutzerView />
    </div>
  );
}
