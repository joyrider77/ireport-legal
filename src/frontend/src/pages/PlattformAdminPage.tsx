import type { Leistungserbringer } from "@/backend.d";
import { AboModell, Role } from "@/backend.d";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  ActiveUserMonth,
  ActiveUsersYearReport,
  BillingStatus,
  KanzleiOverview,
  SuperAdminWhitelistEntry,
} from "@/types";
import {
  useDeactivateKanzlei,
  useDeleteKanzlei,
  useGetActiveUsersPerMonth,
  useGetAllKanzleienOverview,
  useGetLeistungserbringerByKanzlei,
  useGetSuperAdmins,
  useReactivateKanzlei,
} from "@/utils/backend";
import { exportActiveUsersPdf } from "@/utils/export";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Mail,
  Minus,
  Power,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Convert a bigint nanosecond timestamp (IC) to a dd.mm.yyyy display string.
 * Returns "—" for invalid/zero timestamps.
 */
function formatTimestampNs(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Truncate a principal string to "first5…last4" form for compact display.
 */
function truncatePrincipal(p: string): string {
  const s = typeof p === "string" ? p : String(p ?? "");
  if (!s) return "—";
  if (s.length <= 10) return s;
  return `${s.slice(0, 5)}…${s.slice(-4)}`;
}

// ─── Aktive-Benutzer-Tabelle (rollendes 12-Monats-Fenster) ────────────────────

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

/** Deutsche Monatsnamen (lang), Index 0 = Januar — für CSV/PDF-Export. */
const GERMAN_MONTHS_LONG = [
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
] as const;

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1; // 1–12

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

/**
 * Normalisiert einen Monats-Report in ein 12-Einträge-Array, das dem rollenden
 * Fenster entspricht. Fehlende Monate werden als Null-Eintrag eingefügt.
 * `total` ist die Gesamtzahl aktiver Benutzer im Monat.
 */
function normalizeToWindow(
  months: ActiveUserMonth[] | undefined | null,
  windowMonths: WindowMonth[],
): Array<{ year: number; month: number; total: number }> {
  const byKey = new Map<string, number>();
  if (Array.isArray(months)) {
    for (const m of months) {
      byKey.set(`${Number(m.year)}-${Number(m.month)}`, Number(m.total));
    }
  }
  return windowMonths.map((wm) => ({
    year: wm.year,
    month: wm.month,
    total: byKey.get(`${wm.year}-${wm.month}`) ?? 0,
  }));
}

// ─── Per-User Rows (für die ausgeklappte Kanzlei-Ansicht) ─────────────────────

/**
 * Eine Zeile pro Benutzer in der ausgeklappten Kanzlei-Ansicht. `key` ist der
 * Principal als Text (stabil), `name` der Anzeigename, `activePerMonth` hat
 * 12 Einträge (einer pro Fenster-Monat). `null` bedeutet, der Benutzer war in
 * diesem Monat noch nicht vorhanden (z. B. vor der Registrierung).
 */
interface KanzleiUserRow {
  key: string;
  name: string;
  activePerMonth: (boolean | null)[];
}

/**
 * buildKanzleiUserRows — baut die pro-Benutzer-Zeilen für eine einzelne
 * Kanzlei aus dem ActiveUsersYearReport. Die Monate werden aufsteigend nach
 * (year, month) sortiert, damit die Reihenfolge mit dem rollenden Fenster
 * (ältester Monat zuerst) übereinstimmt. Benutzer folgen der Reihenfolge
 * ihres ersten Auftretens, damit die Tabelle stabil bleibt.
 */
function buildKanzleiUserRows(
  report: ActiveUsersYearReport | null | undefined,
  windowMonths: WindowMonth[],
): KanzleiUserRow[] {
  if (!report) return [];
  // Defensive: `report.months` is contractually a 12-entry array, but a stale
  // IDL or partial decode can leave it undefined. Guard with Array.isArray
  // before any spread/sort/map to avoid "p2.slice is not a function".
  const monthsArray = Array.isArray(report.months) ? report.months : [];
  if (monthsArray.length === 0) return [];

  const sorted = [...monthsArray].sort(
    (a, b) =>
      Number(a.year) * 12 +
      Number(a.month) -
      (Number(b.year) * 12 + Number(b.month)),
  );

  const byKey = new Map<string, ActiveUserMonth>();
  for (const m of sorted) {
    byKey.set(`${Number(m.year)}-${Number(m.month)}`, m);
  }

  const order: string[] = [];
  const nameByKey = new Map<string, string>();
  for (const m of sorted) {
    const users = Array.isArray(m.users) ? m.users : [];
    for (const u of users) {
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
      const users = Array.isArray(m.users) ? m.users : [];
      const u = users.find((x) => x.userId.toString() === key);
      return u ? u.isActive : null;
    }),
  }));
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

// ─── Rollen-Helper (lokal, da maskRole nicht exportiert ist) ──────────────────
// PlattformAdminPage ist ausschliesslich für Super-Admins sichtbar, daher ist
// Rollen-Masking hier faktisch ein No-Op — die echten Rollen-Labels werden
// direkt angezeigt. ROLE_LABELS / ROLE_BADGE_CLASS spiegeln die Definitionen
// aus BenutzerverwaltungPage.tsx, deriveRole liest user.role bzw. fällt auf
// das Legacy-isAdmin-Flag zurück.

const ROLE_LABELS: Record<Role, string> = {
  [Role.admin]: "Admin",
  [Role.anwalt]: "Anwalt",
  [Role.mitarbeiter]: "Mitarbeiter",
  [Role.mandant]: "Mandant",
  [Role.plattform_admin]: "Admin",
};

const ROLE_BADGE_CLASS: Record<Role, string> = {
  [Role.admin]: "bg-primary/15 text-primary border border-primary/30",
  [Role.anwalt]:
    "bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  [Role.mitarbeiter]: "bg-accent/15 text-accent border border-accent/30",
  [Role.mandant]:
    "bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  [Role.plattform_admin]:
    "bg-indigo-100 text-indigo-700 border border-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
};

/**
 * deriveRole — if the user has an explicit role, use it; otherwise derive
 * from the legacy isAdmin flag (isAdmin=true → Admin, else → Anwalt).
 */
function deriveRole(user: Leistungserbringer): Role {
  if (user.role) return user.role;
  return user.isAdmin ? Role.admin : Role.anwalt;
}

// ─── Badge renderers ────────────────────────────────────────────────────────
//
// AboModell ist ein String-Enum in den generierten Bindungen
// (backend.d.ts: `export enum AboModell { jahres = "jahres", ... }`). Der
// Candid-Decoder liefert zur Laufzeit den Enum-Wert AboModell.jahres /
// .monats / .keine — KEIN { __kind__: "jahres" } Objekt. Wir werten daher
// `switch (abo)` mit den Enum-Werten als Case-Labels aus, nicht
// `switch (abo.__kind__)`. Letzteres würde immer in den default-Fall fallen,
// da `abo.__kind__` undefined ist.
//
// BillingStatus wird vom Decoder als einfacher String geliefert
// ("offen" / "bezahlt" / "ueberfaellig"), ebenfalls ohne __kind__-Wrapper
// (siehe types/index.ts Kommentarblock). `switch (status)` mit String-
// Case-Labels ist korrekt.
//
// Beide Komponenten werden exportiert, damit Regressionstests die echten
// Badge-Komponenten importieren und die Decoder→Renderer-Kette abdecken
// können (nicht nur Backend-Replik/String-Vergleiche).

export function AboModellBadge({ abo }: { abo: AboModell }) {
  switch (abo) {
    case AboModell.jahres:
      return (
        <span
          className="badge-info"
          data-ocid="plattform_admin.abo_badge.jahres"
        >
          Jährlich
        </span>
      );
    case AboModell.monats:
      return (
        <span
          className="badge-success"
          data-ocid="plattform_admin.abo_badge.monats"
        >
          Monatlich
        </span>
      );
    case AboModell.keine:
      return (
        <span
          className="badge-neutral"
          data-ocid="plattform_admin.abo_badge.keine"
        >
          Keine
        </span>
      );
    default:
      return (
        <span
          className="badge-neutral"
          data-ocid="plattform_admin.abo_badge.unknown"
        >
          Keine
        </span>
      );
  }
}

export function BillingStatusBadge({ status }: { status: BillingStatus }) {
  switch (status) {
    case "bezahlt":
      return (
        <span
          className="badge-success"
          data-ocid="plattform_admin.billing_badge.bezahlt"
        >
          Bezahlt
        </span>
      );
    case "offen":
      return (
        <span
          className="badge-warning"
          data-ocid="plattform_admin.billing_badge.offen"
        >
          Offen
        </span>
      );
    case "ueberfaellig":
      return (
        <span
          className="badge-danger"
          data-ocid="plattform_admin.billing_badge.ueberfaellig"
        >
          Überfällig
        </span>
      );
    default:
      return (
        <span
          className="badge-neutral"
          data-ocid="plattform_admin.billing_badge.unknown"
        >
          —
        </span>
      );
  }
}

// ─── KanzleiBenutzerListe (Benutzerliste pro Kanzlei, lazy beim Ausklappen) ────

interface KanzleiBenutzerListeProps {
  kanzlei: KanzleiOverview;
  rowIndex: number;
}

/**
 * KanzleiBenutzerListe — lädt alle Leistungserbringer (Benutzer) einer Kanzlei
 * via useGetLeistungserbringerByKanzlei und rendert eine Tabelle mit Spalten
 * Name, E-Mail, Rolle, Status. Lazy loading beim Ausklappen (enabled-Flag
 * steuert der Parent über das expanded-Set). Zeigt Lade-, Fehler- und Leer-
 * zustände an.
 *
 * Name = `${titel ?? ''} ${vorname} ${nachname}`.trim(). Rolle = ROLE_LABELS
 * mit ROLE_BADGE_CLASS. Status = 'aktiv'→badge-success, 'inaktiv'→badge-neutral.
 */
function KanzleiBenutzerListe({
  kanzlei,
  rowIndex,
}: KanzleiBenutzerListeProps) {
  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useGetLeistungserbringerByKanzlei(kanzlei.id);

  return (
    <div
      data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.benutzer_liste`}
      className="mb-4"
    >
      <h4 className="font-display text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
        <Mail size={14} className="text-primary" />
        Benutzer der Kanzlei — {kanzlei.name || "—"}
      </h4>

      {isLoading ? (
        <div
          data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.benutzer_loading`}
          className="space-y-2"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div
          data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.benutzer_error`}
          className="text-sm text-destructive py-3 px-3 rounded-md border border-destructive/30 bg-destructive/5"
        >
          Fehler beim Laden der Benutzer:{" "}
          {error instanceof Error ? error.message : "unbekannt"}
        </div>
      ) : users.length === 0 ? (
        <div
          data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.benutzer_empty_state`}
          className="flex flex-col items-center justify-center py-8 px-6 gap-2 text-center"
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Users size={18} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Keine Benutzer vorhanden
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left font-medium min-w-[180px]"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left font-medium min-w-[200px]"
                >
                  E-Mail
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left font-medium min-w-[120px]"
                >
                  Rolle
                </th>
                <th
                  scope="col"
                  className="px-3 py-2.5 text-left font-medium min-w-[100px]"
                >
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, uIdx) => {
                const role = deriveRole(user);
                const fullName =
                  `${user.titel ?? ""} ${user.vorname} ${user.nachname}`.trim();
                const isActive = user.status === "aktiv";
                return (
                  <tr
                    key={user.id.toString()}
                    data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.benutzer.${uIdx + 1}`}
                    className={
                      uIdx % 2 === 1
                        ? "border-b border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                        : "border-b border-border hover:bg-muted/40 transition-colors"
                    }
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm font-medium text-foreground">
                      {fullName || "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm text-muted-foreground">
                      {user.email || "—"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${ROLE_BADGE_CLASS[role]}`}
                      >
                        {ROLE_LABELS[role]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {isActive ? (
                        <span
                          className="badge-success"
                          data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.benutzer.${uIdx + 1}.status_aktiv`}
                        >
                          Aktiv
                        </span>
                      ) : (
                        <span
                          className="badge-neutral"
                          data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.benutzer.${uIdx + 1}.status_inaktiv`}
                        >
                          Inaktiv
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Ausgeklappte Kanzlei-Zeile (eigene Komponente für Hook-Isolation) ────────

interface KanzleiExpandedRowProps {
  kanzlei: KanzleiOverview;
  year: number;
  rowIndex: number;
}

/**
 * Rendert die ausgeklappte rollende 12-Monate-Aktive-Benutzer-Tabelle für eine
 * einzelne Kanzlei. Die Daten werden lazy beim ersten Ausklappen geladen
 * (enabled-Flag steuert der Parent über das expanded-Set). CSV- und PDF-
 * Export-Buttons nutzen exportActiveUsersCsv / exportActiveUsersPdf.
 *
 * Die Tabelle zeigt 12 Monatsspalten (rollendes Fenster, Endpunkt =
 * `(year, currentMonth)`) mit dynamischen Monats-Headern (z. B. "Jul 25").
 * Das Jahrestotal entstammt dem Backend-Report (`yearTotal` — DISTINCT aktive
 * Benutzer über das Fenster), nicht einer lokalen Berechnung.
 */
function KanzleiExpandedRow({
  kanzlei,
  year,
  rowIndex,
}: KanzleiExpandedRowProps) {
  const yearBig = BigInt(year);
  const { data, isLoading, isError, error } = useGetActiveUsersPerMonth(
    kanzlei.id,
    yearBig,
  );

  const windowMonths = useMemo(() => buildRollingWindow(year), [year]);
  const months = useMemo(
    () => normalizeToWindow(data?.months, windowMonths),
    [data?.months, windowMonths],
  );

  // Jahrestotal aus dem Backend-Report (DISTINCT aktive Benutzer über das
  // rollende Fenster). Fällt auf 0 zurück, wenn der Report noch nicht geladen
  // ist oder das Feld fehlt.
  const yearTotal = useMemo(() => (data ? Number(data.yearTotal) : 0), [data]);

  // Per-Benutzer-Zeilen für die ausgeklappte Kanzlei-Ansicht. Eine Zeile pro
  // Benutzer, mit 12 Einträgen in `activePerMonth` (einer pro Fenster-Monat).
  // `null` bedeutet, der Benutzer war in diesem Monat noch nicht vorhanden.
  const userRows = useMemo(
    () => buildKanzleiUserRows(data, windowMonths),
    [data, windowMonths],
  );

  function handleCsv() {
    if (!data) {
      toast.error("Keine Daten zum Exportieren vorhanden");
      return;
    }
    try {
      // Inline-CSV-Export (semikolongetrennt, deutscher Monatsname lang).
      const monthsArray = Array.isArray(data.months) ? data.months : [];
      const byKey = new Map<string, number>();
      for (const m of monthsArray)
        byKey.set(`${Number(m.year)}-${Number(m.month)}`, Number(m.total));
      const lines: string[] = ["Monat;Aktive Benutzer;Gesamt"];
      for (const wm of windowMonths) {
        const aktive = byKey.get(`${wm.year}-${wm.month}`) ?? 0;
        const label = `${GERMAN_MONTHS_LONG[wm.month - 1]} ${wm.year}`;
        lines.push(`${label};${aktive};${aktive}`);
      }
      const csv = `\uFEFF${lines.join("\r\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `aktive-benutzer_${kanzlei.name || kanzlei.id}_${year}_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("CSV-Export heruntergeladen");
    } catch (e) {
      toast.error(
        `Export fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}`,
      );
    }
  }

  async function handlePdf() {
    if (!data) {
      toast.error("Keine Daten zum Exportieren vorhanden");
      return;
    }
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      // `data` ist bereits ein vollständiger ActiveUsersYearReport (mit
      // yearTotal + year) — direkt weiterreichen, kein Partial-Literal.
      await exportActiveUsersPdf(data, {
        filename: `aktive-benutzer_${kanzlei.name || kanzlei.id}_${year}_${stamp}`,
        title: `Aktive Benutzer — ${kanzlei.name || kanzlei.id} ${year}`,
      });
      toast.success("PDF-Export heruntergeladen");
    } catch (e) {
      toast.error(
        `Export fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}`,
      );
    }
  }

  return (
    <TableRow
      data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.expanded`}
      className="bg-muted/10 hover:bg-transparent"
    >
      <TableCell colSpan={7} className="p-0">
        <div className="p-4 border-t border-border">
          {/* Benutzerliste der Kanzlei (lazy loading beim Ausklappen) —
              erscheint OBEN, vor dem Export-Action-Bar und der 12-Monate-
              Tabelle. Zeigt Name, E-Mail, Rolle und Status je Benutzer. */}
          <KanzleiBenutzerListe kanzlei={kanzlei} rowIndex={rowIndex} />

          {/* Aktionsleiste: Export-Buttons für diese Kanzlei */}
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h4 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
              <Users size={14} className="text-primary" />
              Aktive Benutzer — {kanzlei.name || "—"} (Fenster endet{" "}
              {MONATE_KURZ[currentMonth - 1]} {year})
            </h4>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="btn-success gap-1.5"
                onClick={handleCsv}
                disabled={isLoading || !data}
                data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.export_csv`}
              >
                <Download size={14} />
                CSV
              </Button>
              <Button
                size="sm"
                className="btn-success gap-1.5"
                onClick={handlePdf}
                disabled={isLoading || !data}
                data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.export_pdf`}
              >
                <FileText size={14} />
                PDF
              </Button>
            </div>
          </div>

          {/* Rollende 12-Monate-Tabelle: 12 Monatsspalten + Total-Spalte.
              Horizontal scrollbar bei Bedarf. */}
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-left font-medium min-w-[180px]"
                  >
                    Benutzer
                  </th>
                  {windowMonths.map((wm, i) => (
                    <th
                      key={`${wm.year}-${wm.month}`}
                      scope="col"
                      className="px-3 py-2.5 text-center font-medium min-w-[52px]"
                      data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.month_header.${i + 1}`}
                    >
                      {wm.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-3 py-2.5 text-center font-semibold border-l border-border min-w-[64px] text-primary"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr
                    data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.loading`}
                  >
                    <td className="px-3 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    <td className="px-3 py-3">
                      <Skeleton className="h-5 w-24" />
                    </td>
                    {windowMonths.map((wm) => (
                      <td
                        key={`${wm.year}-${wm.month}`}
                        className="px-3 py-3 text-center"
                      >
                        <Skeleton className="h-5 w-8 mx-auto" />
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center border-l border-border">
                      <Skeleton className="h-5 w-8 mx-auto" />
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td
                      colSpan={15}
                      className="text-sm text-destructive py-4 text-center"
                    >
                      Fehler beim Laden der Daten:{" "}
                      {error instanceof Error ? error.message : "unbekannt"}
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Monatstotal-Zeile: eine Zelle pro Fenster-Monat.
                        Die Benutzer-Spalte bleibt hier leer, da die Total-
                        Zeile die Monatssummen aller Benutzer zeigt. */}
                    <tr
                      data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.totals_row`}
                      className="border-b border-border hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                        Aktive Benutzer
                      </td>
                      {months.map((m, mIdx) => (
                        <td
                          key={`${m.year}-${m.month}`}
                          data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.month.${mIdx + 1}`}
                          className="px-3 py-3 text-center text-sm text-foreground tabular-nums"
                        >
                          {m.total}
                        </td>
                      ))}
                      {/* Jahrestotal — DISTINCT aktive Benutzer über das
                          Fenster, aus dem Backend-Report. */}
                      <td
                        data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.total`}
                        className="px-3 py-3 text-center text-sm font-semibold text-foreground tabular-nums border-l border-border bg-primary/5"
                      >
                        {yearTotal}
                      </td>
                    </tr>
                    {/* Per-Benutzer-Zeilen: eine Zeile pro Benutzer der Kanzlei.
                        Jede Monatsspalte zeigt einen Aktivitäts-Indikator
                        (UserCheck = aktiv, Minus = inaktiv, · = nicht
                        vorhanden), passend zur AktiveBenutzerPage.tsx. */}
                    {userRows.map((row, uIdx) => (
                      <tr
                        key={row.key}
                        data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.user_row.${uIdx + 1}`}
                        className={
                          uIdx % 2 === 1
                            ? "border-b border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                            : "border-b border-border hover:bg-muted/40 transition-colors"
                        }
                      >
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-foreground">
                          {row.name}
                        </td>
                        {row.activePerMonth.map((active, mIdx) => (
                          <td
                            key={`user-month-${row.key}-${windowMonths[mIdx].year}-${windowMonths[mIdx].month}`}
                            className="px-3 py-3 text-center"
                          >
                            {active === null ? (
                              // Benutzer in diesem Monat noch nicht vorhanden
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
                                data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.user_active.${uIdx + 1}.${mIdx + 1}`}
                                aria-label="aktiv"
                                title="aktiv"
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/15 text-accent"
                              >
                                <UserCheck size={14} />
                              </span>
                            ) : (
                              // Inaktiv — Strich.
                              <span
                                data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.user_inactive.${uIdx + 1}.${mIdx + 1}`}
                                aria-label="inaktiv"
                                title="inaktiv"
                                className="inline-flex items-center justify-center w-5 h-5 text-muted-foreground/50"
                              >
                                <Minus size={14} />
                              </span>
                            )}
                          </td>
                        ))}
                        {/* Jahrestotal-Spalte pro Benutzer: Häkchen, wenn der
                            Benutzer im gesamten Fenster in mindestens einem
                            Monat aktiv war. */}
                        <td className="px-3 py-3 text-center border-l border-border">
                          {row.activePerMonth.some((a) => a === true) ? (
                            <span
                              data-ocid={`plattform_admin.kanzlei.${rowIndex + 1}.user_year_active.${uIdx + 1}`}
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
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Legende / Hinweis zur Fenster-Definition */}
          {!isLoading && !isError && data && (
            <p className="mt-2 text-xs text-muted-foreground">
              Rollendes 12-Monats-Fenster, Endpunkt{" "}
              {MONATE_KURZ[currentMonth - 1]} {year}. Jahrestotal = Anzahl
              eindeutiger aktiver Benutzer über das Fenster.
            </p>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Reusable View (eingebettet in Tab 2 der Benutzerverwaltung) ──────────────

/**
 * PlattformAdminAktiveBenutzerView — die wiederverwendbare Plattform-Admin-
 * Ansicht der aktiven Benutzer pro Kanzlei. Enthält die Kanzlei-Übersichtstabelle
 * mit ausklappbaren Zeilen, 12-Monate-Tabelle pro Kanzlei, CSV/PDF-Export pro
 * Kanzlei, 'Alle Kanzleien (CSV)' + 'Alle Kanzleien (PDF)' Gesamtexport und
 * Jahr-Paging (±1). Die Super-Admin-Whitelist-Tabelle ist NICHT enthalten — diese
 * bleibt auf der separaten /app/plattform-admin Seite.
 *
 * Wird sowohl von der eigenständigen PlattformAdminPage als auch in Tab 2 der
 * BenutzerverwaltungPage (für Plattform-Admins via useIsSuperAdmin) gerendert.
 */
export function PlattformAdminAktiveBenutzerView() {
  const { data: kanzleien = [], isLoading: kanzleienLoading } =
    useGetAllKanzleienOverview();

  const deleteKanzleiMut = useDeleteKanzlei();
  const deactivateKanzleiMut = useDeactivateKanzlei();
  const reactivateKanzleiMut = useReactivateKanzlei();

  // ── Expand-State: mehrere Kanzleien können gleichzeitig ausgeklappt sein
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // ── Jahr-Auswahl: global für alle ausgeklappten Zeilen. Initialisiert aus
  //    dem URL-Query-Parameter ?year=YYYY, synchronisiert via replaceState.
  const [selectedYear, setSelectedYear] = useState<number>(initialYearFromUrl);

  // ── Lösch-Modal-State: hält die Kanzlei, deren Löschung gerade bestätigt
  //    werden soll. `null` bedeutet: Modal geschlossen.
  const [deleteTarget, setDeleteTarget] = useState<KanzleiOverview | null>(
    null,
  );

  // URL-Sync: schreibt das gewählte Jahr bei jeder Änderung in die URL, damit
  // der Filter einen Seiten-Refresh überlebt und über die URL teilbar ist.
  useEffect(() => {
    syncYearToUrl(selectedYear);
  }, [selectedYear]);

  // Show the loading skeleton only during the initial fetch (no data yet).
  // `isLoading` (= isPending && isFetching) is true exclusively on the first
  // load; once `data` exists it stays false even during background refetches
  // (e.g. after delete/deactivate mutations invalidate the overview query).
  // Previously this also OR-ed `isFetching`, which kept the skeleton visible
  // permanently whenever a background refetch was in flight — hiding the
  // actual Kanzlei rows behind the six green bars even though `data` was
  // already populated (the header count "1 Kanzlei" was correct, but the
  // table body never rendered).
  const showLoading = kanzleienLoading;

  // ── Expand/Collapse-Toggle ──────────────────────────────────────────────
  function toggleExpand(kanzleiId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(kanzleiId)) {
        next.delete(kanzleiId);
      } else {
        next.add(kanzleiId);
      }
      return next;
    });
  }

  // ── Deaktivieren: setzt den Kanzlei-Status auf 'inaktiv'. Separate Aktion
  //    neben dem physischen Löschen. Bleibt sichtbar je Zeile, ist aber für
  //    bereits inaktive Kanzleien deaktiviert. Das Reaktivieren-Backend
  //    (reactivateKanzlei) existiert mittlerweile und wird über den
  //    „Reaktivieren"-Button je Zeile ausgelöst (siehe handleReactivate).
  function handleDeactivate(kanzlei: KanzleiOverview) {
    deactivateKanzleiMut.mutate(kanzlei.id, {
      onSuccess: () => {
        toast.success(`Kanzlei „${kanzlei.name || kanzlei.id}" deaktiviert`);
      },
      onError: (e: Error) =>
        toast.error(`Deaktivieren fehlgeschlagen: ${e.message}`),
    });
  }

  // ── Reaktivieren: setzt den Kanzlei-Status zurück auf 'aktiv'. Das Pendant
  //    zu handleDeaktivieren; gleiche Invalidation der Overview-Query.
  function handleReactivate(kanzlei: KanzleiOverview) {
    reactivateKanzleiMut.mutate(kanzlei.id, {
      onSuccess: () => {
        toast.success(`Kanzlei „${kanzlei.name || kanzlei.id}" reaktiviert`);
      },
      onError: (e: Error) =>
        toast.error(`Reaktivieren fehlgeschlagen: ${e.message}`),
    });
  }

  // ── Löschen: öffnet den Bestätigungs-Modal. Die eigentliche Mutation läuft
  //    erst nach Bestätigung im Modal (handleConfirmDelete).
  function handleDeleteClick(kanzlei: KanzleiOverview) {
    setDeleteTarget(kanzlei);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteKanzleiMut.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(
          `Kanzlei „${deleteTarget.name || deleteTarget.id}" gelöscht`,
        );
        setDeleteTarget(null);
      },
      onError: (e: Error) =>
        toast.error(`Löschen fehlgeschlagen: ${e.message}`),
    });
  }

  function handleCloseDeleteModal() {
    if (!deleteKanzleiMut.isPending) setDeleteTarget(null);
  }

  return (
    <div data-ocid="plattform_admin.aktive_benutzer_view" className="space-y-6">
      {/* ── Kanzlei-Übersicht ─────────────────────────────────────────────── */}
      <section
        data-ocid="plattform_admin.kanzleien_section"
        className="bg-card border border-border rounded-lg shadow-sm overflow-hidden"
      >
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Building2 size={16} className="text-primary" />
              Kanzleien
              {kanzleien.length > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {kanzleien.length}{" "}
                  {kanzleien.length === 1 ? "Kanzlei" : "Kanzleien"}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Jahr-Auswahl (±1 Paging, global für alle ausgeklappten Zeilen) */}
              <fieldset
                aria-label="Jahr-Auswahl"
                className="flex items-center gap-1 border-0 p-0 m-0"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  aria-label="Vorheriges Jahr"
                  data-ocid="plattform_admin.year_prev"
                >
                  <ChevronLeft size={16} />
                </Button>
                <span
                  className="min-w-[64px] text-center text-sm font-semibold tabular-nums text-foreground px-2"
                  data-ocid="plattform_admin.year_display"
                >
                  {selectedYear}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  aria-label="Nächstes Jahr"
                  data-ocid="plattform_admin.year_next"
                >
                  <ChevronRight size={16} />
                </Button>
              </fieldset>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {showLoading ? (
            <div className="p-6 space-y-3" data-ocid="plattform_admin.loading">
              {Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : kanzleien.length === 0 ? (
            <div
              data-ocid="plattform_admin.empty_state"
              className="flex flex-col items-center justify-center py-16 px-6 gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Building2 size={22} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Keine Kanzleien</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Es sind derzeit keine Kanzleien auf der Plattform registriert.
                Sobald sich eine Kanzlei registriert, erscheint sie hier in der
                Übersicht.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-ocid="plattform_admin.kanzleien_table">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-medium w-10" />
                    <TableHead className="font-medium">Kanzlei-Name</TableHead>
                    <TableHead className="font-medium text-right">
                      Benutzeranzahl
                    </TableHead>
                    <TableHead className="font-medium">Abo-Modell</TableHead>
                    <TableHead className="font-medium">
                      Billing-Status
                    </TableHead>
                    <TableHead className="font-medium">Erstellt am</TableHead>
                    <TableHead className="font-medium text-right">
                      Aktionen
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kanzleien.map((k: KanzleiOverview, idx: number) => {
                    const isExpanded = expanded.has(k.id);
                    return (
                      <Fragment key={k.id}>
                        <TableRow
                          data-ocid={`plattform_admin.kanzlei.${idx + 1}`}
                          className={
                            idx % 2 === 1
                              ? "bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                              : "hover:bg-muted/40 transition-colors cursor-pointer"
                          }
                          onClick={() => toggleExpand(k.id)}
                        >
                          <TableCell className="whitespace-nowrap">
                            <button
                              type="button"
                              aria-label={
                                isExpanded
                                  ? `Zeile für ${k.name || "Kanzlei"} einklappen`
                                  : `Zeile für ${k.name || "Kanzlei"} ausklappen`
                              }
                              aria-expanded={isExpanded}
                              data-ocid={`plattform_admin.kanzlei.${idx + 1}.toggle`}
                              className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">
                            {k.name || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-foreground text-right tabular-nums">
                            {Number(k.userCount)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <AboModellBadge abo={k.aboModell} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <BillingStatusBadge status={k.billingStatus} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatTimestampNs(k.createdAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {/* Aktionen: Deaktivieren (neutral/warning) und
                                Löschen (danger) als zwei eigenständige Buttons.
                                Klick-Propagation wird gestoppt, damit die
                                Zeile nicht versehentlich ein-/ausgeklappt
                                wird. */}
                            <div
                              className="inline-flex items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              {k.status === "aktiv" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 border-warning/40 text-warning-foreground hover:bg-warning/10"
                                  onClick={() => handleDeactivate(k)}
                                  disabled={deactivateKanzleiMut.isPending}
                                  aria-label={`Kanzlei „${k.name || k.id}" deaktivieren`}
                                  data-ocid={`plattform_admin.kanzlei.${idx + 1}.deactivate_button`}
                                >
                                  {deactivateKanzleiMut.isPending &&
                                  deactivateKanzleiMut.variables === k.id ? (
                                    <Loader2
                                      size={14}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Power size={14} />
                                  )}
                                  Deaktivieren
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 border-success/40 text-success-foreground hover:bg-success/10"
                                  onClick={() => handleReactivate(k)}
                                  disabled={reactivateKanzleiMut.isPending}
                                  aria-label={`Kanzlei „${k.name || k.id}" reaktivieren`}
                                  data-ocid={`plattform_admin.kanzlei.${idx + 1}.reactivate_button`}
                                >
                                  {reactivateKanzleiMut.isPending &&
                                  reactivateKanzleiMut.variables === k.id ? (
                                    <Loader2
                                      size={14}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <RotateCcw size={14} />
                                  )}
                                  Reaktivieren
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick(k)}
                                disabled={deleteKanzleiMut.isPending}
                                aria-label={`Kanzlei „${k.name || k.id}" löschen`}
                                data-ocid={`plattform_admin.kanzlei.${idx + 1}.delete_button`}
                              >
                                {deleteKanzleiMut.isPending &&
                                deleteKanzleiMut.variables ===
                                  deleteTarget?.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                                Löschen
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <KanzleiExpandedRow
                            kanzlei={k}
                            year={selectedYear}
                            rowIndex={idx}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </section>

      {/* ── Lösch-Bestätigungs-Modal ──────────────────────────────────────
          Wird geöffnet, wenn eine Kanzlei-Zeile auf „Löschen" geklickt
          wurde. Die eigentliche Mutation läuft erst nach Bestätigung im
          Modal. Ersetzt die Browser-Konfirmation durch einen barrierefreien
          Dialog (Escape/Overlay schliessen, Fokus im Dialog). */}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        entityName={deleteTarget?.name || deleteTarget?.id || ""}
        entityType="Kanzlei"
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        loading={deleteKanzleiMut.isPending}
      />
    </div>
  );
}

// ─── Page (eigenständige Route /app/plattform-admin) ──────────────────────────

export function PlattformAdminPage() {
  const { data: superAdmins = [], isLoading: superAdminsLoading } =
    useGetSuperAdmins();

  return (
    <div
      data-ocid="plattform_admin.page"
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Header / Purpose ─────────────────────────────────────────────── */}
      <section
        data-ocid="plattform_admin.header_section"
        className="bg-card border border-border rounded-lg p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <ShieldCheck size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-xl text-foreground">
                Plattform-Administration
              </h1>
              <span className="badge-info inline-flex items-center gap-1.5">
                <ShieldCheck size={12} />
                Super-Admin
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
              Übersicht über alle auf der Plattform registrierten Kanzleien
              (Mandanten) mit Benutzeranzahl, Abo-Modell und Billing-Status.
              Jede Kanzlei-Zeile lässt sich ausklappen und zeigt die aktiven
              Benutzer pro Monat für das gewählte Jahr. Diese Ansicht ist
              ausschliesslich für Super-Administratoren zugänglich, deren
              Principal in der Whitelist geführt ist.
            </p>
          </div>
        </div>
      </section>

      {/* ── Aktive-Benutzer-Kanzlei-Übersicht (wiederverwendbare View) ────── */}
      <PlattformAdminAktiveBenutzerView />

      {/* ── Super-Admin Whitelist ─────────────────────────────────────────── */}
      <section
        data-ocid="plattform_admin.whitelist_section"
        className="bg-card border border-border rounded-lg shadow-sm overflow-hidden"
      >
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            Super-Admin Whitelist
            {superAdmins.length > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {superAdmins.length}{" "}
                {superAdmins.length === 1 ? "Eintrag" : "Einträge"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {superAdminsLoading ? (
            <div
              className="p-6 space-y-3"
              data-ocid="plattform_admin.whitelist_loading"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : superAdmins.length === 0 ? (
            <div
              data-ocid="plattform_admin.whitelist_empty_state"
              className="flex flex-col items-center justify-center py-16 px-6 gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Users size={22} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Keine Super-Admins</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Die Super-Admin-Whelist ist leer. Der erste registrierte
                Internet Identity wird automatisch zum Super-Admin.
              </p>
            </div>
          ) : (
            <Table data-ocid="plattform_admin.whitelist_table">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-medium">Principal</TableHead>
                  <TableHead className="font-medium">Hinzugefügt am</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {superAdmins.map(
                  (entry: SuperAdminWhitelistEntry, idx: number) => (
                    <TableRow
                      key={entry.principal}
                      data-ocid={`plattform_admin.whitelist.${idx + 1}`}
                      className={
                        idx % 2 === 1
                          ? "bg-muted/20 hover:bg-muted/40 transition-colors"
                          : "hover:bg-muted/40 transition-colors"
                      }
                    >
                      <TableCell className="whitespace-nowrap text-sm font-mono text-muted-foreground">
                        {truncatePrincipal(entry.principal)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatTimestampNs(entry.addedAt)}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </section>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground px-1">
        Hinweis: Der Zugriff auf dieses Modul ist auf Principals in der
        Super-Admin-Whitelist beschränkt. Klicken Sie auf eine Kanzlei-Zeile, um
        die aktiven Benutzer pro Monat für das gewählte Jahr einzusehen. Exporte
        enthalten aggregierte Daten — keine mandantenspezifischen
        Geschäftsdaten.
      </p>
    </div>
  );
}
