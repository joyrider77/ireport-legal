import type {
  FirmReport,
  GehaltInfo,
  Leistungserbringer,
  MonthlyTotal,
  ProviderReport,
  ReportPeriod,
} from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys, useBackend, useKanzlei } from "@/utils/backend";
import { exportPdf, exportXlsx } from "@/utils/export";
import {
  currencySymbol,
  formatAmount,
  formatCHF,
  todayDate,
} from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONATE_LANG = [
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
];

const currentYear = new Date().getFullYear();
const YEARS = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
  currentYear + 1,
  currentYear + 2,
];

type TabId = "provider" | "kanzlei" | "gehalt";
type Zeitraum = "ganz" | "q1" | "q2" | "q3" | "q4";
type VerrechnetFilter = "alle" | "verrechnet" | "nicht_verrechnet";
type ZahlungsFilter = "alle" | "bezahlt" | "ausstehend";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toChartVal(rappen: bigint | number): number {
  const n = typeof rappen === "bigint" ? Number(rappen) : rappen;
  return Math.round(n / 100);
}

function filterMonthsByZeitraum(
  months: MonthlyTotal[],
  zeitraum: Zeitraum,
): MonthlyTotal[] {
  if (zeitraum === "ganz") return months;
  const ranges: Record<string, number[]> = {
    q1: [1, 2, 3],
    q2: [4, 5, 6],
    q3: [7, 8, 9],
    q4: [10, 11, 12],
  };
  const range = ranges[zeitraum] ?? [];
  return months.filter((m) => range.includes(Number(m.month)));
}

function calcTotals(months: MonthlyTotal[]) {
  return months.reduce(
    (acc, m) => ({
      honorar: acc.honorar + m.honorar,
      auslagen: acc.auslagen + m.auslagen,
      total: acc.total + m.total,
      verrechnete: acc.verrechnete + m.verrechnete,
    }),
    { honorar: 0n, auslagen: 0n, total: 0n, verrechnete: 0n },
  );
}

function emptyMonthlyTotal(): MonthlyTotal {
  return {
    month: 0n,
    total: 0n,
    auslagen: 0n,
    year: 0n,
    verrechnete: 0n,
    honorar: 0n,
  };
}

function toPeriod(zeitraum: Zeitraum): ReportPeriod {
  if (zeitraum === "ganz") return { __kind__: "jaehrlich", jaehrlich: null };
  return {
    __kind__: "monatlich",
    monatlich: BigInt(Number.parseInt(zeitraum.replace("q", ""), 10) * 3),
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-foreground mb-3">{children}</h3>
  );
}

function TableSkeleton({
  rows = 5,
  cols = 5,
}: {
  rows?: number;
  cols?: number;
}) {
  const rowKeys = ["a", "b", "c", "d", "e", "f", "g", "h"].slice(0, rows);
  const colKeys = ["1", "2", "3", "4", "5", "6", "7", "8"].slice(0, cols);
  return (
    <div className="space-y-2">
      {rowKeys.map((rk) => (
        <div key={rk} className="flex gap-4">
          {colKeys.map((ck) => (
            <Skeleton key={`${rk}${ck}`} className="h-7 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function MonthlyTable({
  months,
  zeitraum,
}: {
  months: MonthlyTotal[];
  zeitraum: Zeitraum;
}) {
  const filtered = filterMonthsByZeitraum(months, zeitraum);
  const totals = calcTotals(filtered);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {/* Fix 11: Backend-Report-Typen (MonthlyTotal) tragen keine per-Zeile-
          Währung. Die Monatswerte sind mandatsübergreifende Aggregate über
          potenziell gemischte Währungen (CHF/EUR/USD). Daher werden die
          Spaltenköpfe ohne hartcodierte Währung gelabelt und ein Disclaimer
          auf die Summenzeile gesetzt, anstatt eine gemeinsame Summe über
          gemischte Währungen stillschweigend auszuweisen. Root Cause: frühere
          Single-Currency-Annahme (nur CHF). */}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/60 border-b border-border">
            <th className="text-left px-4 py-3 font-semibold text-foreground">
              Monat
            </th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">
              Honorar
            </th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">
              Auslagen
            </th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">
              Total
            </th>
            <th className="text-right px-4 py-3 font-semibold text-foreground">
              Verrechnet
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => {
            const idx = Number(m.month) - 1;
            return (
              <tr
                key={Number(m.month)}
                className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-2.5 text-foreground">
                  {MONATE_LANG[idx] ?? `Monat ${m.month}`}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCHF(m.honorar)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCHF(m.auslagen)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {formatCHF(m.total)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {formatCHF(m.verrechnete)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-muted/50 border-t-2 border-border font-semibold">
            <td className="px-4 py-3 text-foreground">
              Total
              <span
                className="block text-xs font-normal text-muted-foreground"
                title="Summe über Mandate mit potenziell unterschiedlichen Währungen"
              >
                summiert über gemischte Währungen
              </span>
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatAmount(totals.honorar)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatAmount(totals.auslagen)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-primary">
              {formatAmount(totals.total)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatAmount(totals.verrechnete)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium tabular-nums">
            {Math.round(entry.value).toLocaleString("de-CH")}
          </span>
        </div>
      ))}
    </div>
  );
}

interface FiltersRowProps {
  year: number;
  setYear: (y: number) => void;
  zeitraum: Zeitraum;
  setZeitraum: (z: Zeitraum) => void;
  verrechnet: VerrechnetFilter;
  setVerrechnet: (v: VerrechnetFilter) => void;
  zahlungsStatus: ZahlungsFilter;
  setZahlungsStatus: (z: ZahlungsFilter) => void;
  providerSelect?: React.ReactNode;
}

function FiltersRow({
  year,
  setYear,
  zeitraum,
  setZeitraum,
  verrechnet,
  setVerrechnet,
  zahlungsStatus,
  setZahlungsStatus,
  providerSelect,
}: FiltersRowProps) {
  return (
    <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/30 rounded-lg border border-border">
      {providerSelect}
      <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
        <SelectTrigger className="w-28" data-ocid="filter.year.select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {YEARS.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={zeitraum}
        onValueChange={(v) => setZeitraum(v as Zeitraum)}
      >
        <SelectTrigger className="w-44" data-ocid="filter.zeitraum.select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ganz">Ganzes Jahr</SelectItem>
          <SelectItem value="q1">Q1 (Jan–Mär)</SelectItem>
          <SelectItem value="q2">Q2 (Apr–Jun)</SelectItem>
          <SelectItem value="q3">Q3 (Jul–Sep)</SelectItem>
          <SelectItem value="q4">Q4 (Okt–Dez)</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={verrechnet}
        onValueChange={(v) => setVerrechnet(v as VerrechnetFilter)}
      >
        <SelectTrigger className="w-48" data-ocid="filter.verrechnet.select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="alle">Alle</SelectItem>
          <SelectItem value="verrechnet">Verrechnet</SelectItem>
          <SelectItem value="nicht_verrechnet">Nicht verrechnet</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={zahlungsStatus}
        onValueChange={(v) => setZahlungsStatus(v as ZahlungsFilter)}
      >
        <SelectTrigger className="w-36" data-ocid="filter.zahlung.select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="alle">Alle</SelectItem>
          <SelectItem value="bezahlt">Bezahlt</SelectItem>
          <SelectItem value="ausstehend">Ausstehend</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── TAB 1: Nach Leistungserbringer ─────────────────────────────────────────

function TabProvider({
  providers,
  currentUserId,
}: {
  providers: Leistungserbringer[];
  currentUserId: string | undefined;
}) {
  const { actor, isLoading: actorLoading } = useBackend();
  const [year, setYear] = useState(currentYear);
  const [zeitraum, setZeitraum] = useState<Zeitraum>("ganz");
  const [verrechnet, setVerrechnet] = useState<VerrechnetFilter>("alle");
  const [zahlungsStatus, setZahlungsStatus] = useState<ZahlungsFilter>("alle");
  const [selectedProvider, setSelectedProvider] = useState<string>(
    currentUserId ?? providers[0]?.id?.toString() ?? "",
  );

  const { data: report, isLoading } = useQuery<ProviderReport>({
    queryKey: queryKeys.providerReport(selectedProvider, { year, zeitraum }),
    queryFn: async (): Promise<ProviderReport> => {
      if (!actor) {
        return {
          monthlyBreakdown: [],
          totals: emptyMonthlyTotal(),
          comparisonData: [],
        };
      }
      const provider = providers.find(
        (p) => p.id.toString() === selectedProvider,
      );
      return actor.getLeistungserbringerReport(
        provider?.id ?? null,
        BigInt(year),
        toPeriod(zeitraum),
      );
    },
    enabled: !!actor && !actorLoading,
  });

  const months = report?.monthlyBreakdown ?? [];
  const filtered = filterMonthsByZeitraum(months, zeitraum);
  const comparison = report?.comparisonData ?? [];
  const totals = report?.totals ?? emptyMonthlyTotal();

  const chartData = filtered.map((m) => ({
    name: MONATE_KURZ[Number(m.month) - 1] ?? "",
    Total: toChartVal(m.total),
  }));

  const selectedObj = providers.find(
    (p) => p.id.toString() === selectedProvider,
  );
  const titlePrefix = selectedObj?.titel ? `${selectedObj.titel} ` : "";
  const fullName = selectedObj
    ? `${titlePrefix}${selectedObj.vorname} ${selectedObj.nachname}`
    : "—";

  return (
    <div className="space-y-8">
      <FiltersRow
        year={year}
        setYear={setYear}
        zeitraum={zeitraum}
        setZeitraum={setZeitraum}
        verrechnet={verrechnet}
        setVerrechnet={setVerrechnet}
        zahlungsStatus={zahlungsStatus}
        setZahlungsStatus={setZahlungsStatus}
        providerSelect={
          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
            <SelectTrigger className="w-52" data-ocid="filter.provider.select">
              <SelectValue placeholder="Leistungserbringer" />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.id.toString()} value={p.id.toString()}>
                  {p.titel ? `${p.titel} ` : ""}
                  {p.vorname} {p.nachname}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Annual summary */}
      <div>
        <SectionHeader>Jahresübersicht {year}</SectionHeader>
        {isLoading ? (
          <TableSkeleton rows={2} cols={5} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold">
                    Leistungserbringer
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Honorar
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Auslagen
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Verrechnet
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{fullName}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.honorar)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.auslagen)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-primary">
                    {formatAmount(totals.total)}
                    <span
                      className="block text-xs font-normal text-muted-foreground"
                      title="Summe über Mandate mit potenziell unterschiedlichen Währungen"
                    >
                      summiert über gemischte Währungen
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.verrechnete)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monthly breakdown */}
      <div>
        <SectionHeader>Monatsübersicht</SectionHeader>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <MonthlyTable months={months} zeitraum={zeitraum} />
        )}
      </div>

      {/* Line chart */}
      <div>
        <SectionHeader>Umsatzentwicklung</SectionHeader>
        <div className="rounded-lg border border-border bg-card p-4">
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickFormatter={(v: number) => v.toLocaleString("de-CH")}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={70}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Total"
                  stroke="#7F77DD"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#7F77DD" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Comparison table */}
      <div>
        <SectionHeader>Vergleich mit anderen Leistungserbringern</SectionHeader>
        {isLoading ? (
          <TableSkeleton rows={4} cols={3} />
        ) : comparison.length === 0 ? (
          <div
            className="text-center py-10 text-muted-foreground text-sm border border-border rounded-lg"
            data-ocid="comparison.empty_state"
          >
            Keine Vergleichsdaten verfügbar
          </div>
        ) : (
          (() => {
            const grandTotal = comparison.reduce(
              (s, c) => s + Number(c.total),
              0,
            );
            return (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold">
                        Name
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">
                        Total
                      </th>
                      <th className="text-right px-4 py-3 font-semibold">
                        Anteil (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map((c, i) => {
                      const isMe =
                        c.provider.id.toString() === selectedProvider;
                      const pct =
                        grandTotal > 0
                          ? ((Number(c.total) / grandTotal) * 100).toFixed(1)
                          : "0.0";
                      return (
                        <tr
                          key={c.provider.id.toString()}
                          data-ocid={`comparison.item.${i + 1}`}
                          className={`border-b border-border last:border-0 transition-colors ${
                            isMe
                              ? "bg-primary/5 font-medium"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-4 py-2.5 flex items-center gap-2">
                            {`${c.provider.titel ? `${c.provider.titel} ` : ""}${c.provider.vorname} ${c.provider.nachname}`}
                            {isMe && (
                              <Badge variant="secondary" className="text-xs">
                                Sie
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {formatAmount(c.total)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {pct}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

// ─── TAB 2: Gesamtkanzlei ─────────────────────────────────────────────────────

function TabKanzlei() {
  const { actor, isLoading: actorLoading } = useBackend();
  const [year, setYear] = useState(currentYear);
  const [zeitraum, setZeitraum] = useState<Zeitraum>("ganz");
  const [verrechnet, setVerrechnet] = useState<VerrechnetFilter>("alle");
  const [zahlungsStatus, setZahlungsStatus] = useState<ZahlungsFilter>("alle");

  const { data: report, isLoading } = useQuery<FirmReport>({
    queryKey: queryKeys.kanzleiReport({ year, zeitraum }),
    queryFn: async (): Promise<FirmReport> => {
      if (!actor) {
        return { monthlyBreakdown: [], totals: emptyMonthlyTotal() };
      }
      return actor.getKanzleiReport(BigInt(year), toPeriod(zeitraum));
    },
    enabled: !!actor && !actorLoading,
  });

  const months = report?.monthlyBreakdown ?? [];
  const totals = report?.totals ?? emptyMonthlyTotal();
  const filtered = filterMonthsByZeitraum(months, zeitraum);

  const chartData = filtered.map((m) => ({
    name: MONATE_KURZ[Number(m.month) - 1] ?? "",
    Honorar: toChartVal(m.honorar),
    Auslagen: toChartVal(m.auslagen),
  }));

  return (
    <div className="space-y-8">
      <FiltersRow
        year={year}
        setYear={setYear}
        zeitraum={zeitraum}
        setZeitraum={setZeitraum}
        verrechnet={verrechnet}
        setVerrechnet={setVerrechnet}
        zahlungsStatus={zahlungsStatus}
        setZahlungsStatus={setZahlungsStatus}
      />

      {/* Annual summary */}
      <div>
        <SectionHeader>Jahresübersicht Kanzlei</SectionHeader>
        {isLoading ? (
          <TableSkeleton rows={2} cols={4} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-right px-4 py-3 font-semibold">
                    Honorar
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Auslagen
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Verrechnet
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.honorar)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.auslagen)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-primary">
                    {formatAmount(totals.total)}
                    <span
                      className="block text-xs font-normal text-muted-foreground"
                      title="Summe über Mandate mit potenziell unterschiedlichen Währungen"
                    >
                      summiert über gemischte Währungen
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAmount(totals.verrechnete)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div>
        <SectionHeader>Umsatzentwicklung nach Kategorie</SectionHeader>
        <div className="rounded-lg border border-border bg-card p-4">
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tickFormatter={(v: number) => v.toLocaleString("de-CH")}
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  width={70}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar dataKey="Honorar" fill="#7F77DD" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Auslagen" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Monthly breakdown */}
      <div>
        <SectionHeader>Monatsübersicht</SectionHeader>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <MonthlyTable months={months} zeitraum={zeitraum} />
        )}
      </div>
    </div>
  );
}

// ─── TAB 3: Gehälter ──────────────────────────────────────────────────────────

function TabGehalt() {
  const { actor, isLoading: actorLoading } = useBackend();
  const [year, setYear] = useState(currentYear);
  const [monat, setMonat] = useState<string>("ganz");

  const monthParam =
    monat === "ganz" ? null : BigInt(Number.parseInt(monat, 10));

  const { data: gehaltData, isLoading } = useQuery<GehaltInfo[]>({
    queryKey: queryKeys.gehaltReport({ year, monat }),
    queryFn: async (): Promise<GehaltInfo[]> => {
      if (!actor) return [];
      return actor.getGehaltReport(BigInt(year), monthParam);
    },
    enabled: !!actor && !actorLoading,
  });

  const records = gehaltData ?? [];
  const totals = records.reduce(
    (acc, g) => ({
      leistungsbasiert: acc.leistungsbasiert + g.leistungsbasiert,
      akquisitionsboni: acc.akquisitionsboni + g.akquisitionsboni,
      gesamtgehalt: acc.gesamtgehalt + g.gesamtgehalt,
      kanzleianteil: acc.kanzleianteil + g.kanzleianteil,
    }),
    {
      leistungsbasiert: 0n,
      akquisitionsboni: 0n,
      gesamtgehalt: 0n,
      kanzleianteil: 0n,
    },
  );

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-muted/30 rounded-lg border border-border">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28" data-ocid="gehalt.year.select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monat} onValueChange={setMonat}>
          <SelectTrigger className="w-44" data-ocid="gehalt.monat.select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ganz">Ganzes Jahr</SelectItem>
            {MONATE_LANG.map((m, i) => (
              <SelectItem key={m} value={String(i + 1)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Performance salary */}
      <div>
        <SectionHeader>Leistungsbasierte Vergütung</SectionHeader>
        {isLoading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 font-semibold">Titel</th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Leistungsbasiert
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Akquisitionsboni
                  </th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Gesamtgehalt
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-muted-foreground"
                      data-ocid="gehalt.empty_state"
                    >
                      Keine Gehaltsdaten für diesen Zeitraum
                    </td>
                  </tr>
                ) : (
                  records.map((g, i) => (
                    <tr
                      key={g.provider.id.toString()}
                      data-ocid={`gehalt.item.${i + 1}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {g.provider.vorname} {g.provider.nachname}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {g.provider.titel || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCHF(g.leistungsbasiert)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCHF(g.akquisitionsboni)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-primary">
                        {formatCHF(g.gesamtgehalt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/50 border-t-2 border-border font-semibold">
                    <td colSpan={2} className="px-4 py-3">
                      Total
                      <span
                        className="block text-xs font-normal text-muted-foreground"
                        title="Summe über Leistungserbringer mit potenziell unterschiedlichen Währungen"
                      >
                        summiert über gemischte Währungen
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatAmount(totals.leistungsbasiert)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatAmount(totals.akquisitionsboni)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-primary">
                      {formatAmount(totals.gesamtgehalt)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Office share */}
      <div>
        <SectionHeader>Kanzleianteil</SectionHeader>
        {isLoading ? (
          <TableSkeleton rows={4} cols={2} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b border-border">
                  <th className="text-left px-4 py-3 font-semibold">Name</th>
                  <th className="text-right px-4 py-3 font-semibold">
                    Kanzleianteil
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      Keine Daten verfügbar
                    </td>
                  </tr>
                ) : (
                  records.map((g, i) => (
                    <tr
                      key={g.provider.id.toString()}
                      data-ocid={`kanzleianteil.item.${i + 1}`}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {g.provider.vorname} {g.provider.nachname}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatCHF(g.kanzleianteil)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {records.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/50 border-t-2 border-border font-semibold">
                    <td className="px-4 py-3">
                      Total
                      <span
                        className="block text-xs font-normal text-muted-foreground"
                        title="Summe über Leistungserbringer mit potenziell unterschiedlichen Währungen"
                      >
                        summiert über gemischte Währungen
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatAmount(totals.kanzleianteil)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AuswertungenPage() {
  const { actor, isLoading: actorLoading } = useBackend();
  const { data: kanzlei } = useKanzlei();
  const [activeTab, setActiveTab] = useState<TabId>("provider");
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const { data: providers = [] } = useQuery<Leistungserbringer[]>({
    queryKey: queryKeys.leistungserbringer(),
    queryFn: async (): Promise<Leistungserbringer[]> => {
      if (!actor) return [];
      return actor.getLeistungserbringer();
    },
    enabled: !!actor && !actorLoading,
  });

  const { data: currentUser } = useQuery<Leistungserbringer | null>({
    queryKey: queryKeys.currentUser(),
    queryFn: async (): Promise<Leistungserbringer | null> => {
      if (!actor) return null;
      return actor.getCurrentUser();
    },
    enabled: !!actor && !actorLoading,
  });

  // Kanzlei report used for the export summary (current year, ganzes Jahr).
  const { data: kanzleiReport } = useQuery<FirmReport>({
    queryKey: queryKeys.kanzleiReport({ year: currentYear, zeitraum: "ganz" }),
    queryFn: async (): Promise<FirmReport> => {
      if (!actor) return { monthlyBreakdown: [], totals: emptyMonthlyTotal() };
      return actor.getKanzleiReport(BigInt(currentYear), toPeriod("ganz"));
    },
    enabled: !!actor && !actorLoading,
  });

  const tabs: { id: TabId; label: string }[] = [
    { id: "provider", label: "Nach Leistungserbringer" },
    { id: "kanzlei", label: "Gesamtkanzlei" },
    { id: "gehalt", label: "Gehälter" },
  ];

  async function handleExport(format: "pdf" | "xlsx") {
    if (exporting) return;
    setExporting(format);
    const toastId = toast.loading(
      `Export wird vorbereitet… (${format.toUpperCase()})`,
    );
    try {
      const kanzleiName = kanzlei?.name ?? "Kanzlei";
      const subtitle = `Auswertungen ${currentYear} — Stand ${todayDate()}`;
      const totals = kanzleiReport?.totals ?? emptyMonthlyTotal();
      const months = kanzleiReport?.monthlyBreakdown ?? [];
      const anzahlMonate = filterMonthsByZeitraum(months, "ganz").length;

      // Kennzahlen summary rows — formatted as CHF strings for PDF, raw for XLSX.
      const summaryRows = [
        { label: "Total Honorar", value: formatAmount(totals.honorar) },
        { label: "Total Auslagen", value: formatAmount(totals.auslagen) },
        { label: "Total Umsatz", value: formatAmount(totals.total) },
        { label: "Verrechnet", value: formatAmount(totals.verrechnete) },
        { label: "Anzahl Leistungserbringer", value: String(providers.length) },
        { label: "Anzahl Monate", value: String(anzahlMonate) },
      ];

      if (format === "pdf") {
        await exportPdf({
          title: `${kanzleiName} — Auswertungen`,
          subtitle,
          columns: [
            { header: "Kennzahl", dataKey: "label" },
            { header: "Wert", dataKey: "value" },
          ],
          rows: summaryRows,
          filename: `Auswertungen_${kanzleiName.replace(/\s+/g, "_")}_${currentYear}.pdf`,
        });
      } else {
        await exportXlsx({
          sheetName: "Auswertungen",
          columns: [
            { header: "Kennzahl", key: "label", width: 32 },
            { header: "Wert", key: "value", width: 24 },
          ],
          rows: summaryRows,
          filename: `Auswertungen_${kanzleiName.replace(/\s+/g, "_")}_${currentYear}.xlsx`,
        });
      }

      toast.success(
        `${format.toUpperCase()}-Export erfolgreich heruntergeladen.`,
        {
          id: toastId,
        },
      );
    } catch (err) {
      toast.error(
        `Export fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`,
        { id: toastId },
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-col h-full" data-ocid="auswertungen.page">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card shrink-0">
        <h1 className="text-2xl font-display font-bold text-foreground">
          Auswertungen
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleExport("pdf")}
            disabled={exporting !== null}
            data-ocid="export.pdf.button"
          >
            {exporting === "pdf" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleExport("xlsx")}
            disabled={exporting !== null}
            data-ocid="export.xlsx.button"
          >
            {exporting === "xlsx" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Excel
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="px-6 pt-4 border-b border-border bg-background shrink-0">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              data-ocid={`auswertungen.${tab.id}.tab`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-background">
        {activeTab === "provider" && (
          <TabProvider
            providers={providers}
            currentUserId={currentUser?.id?.toString()}
          />
        )}
        {activeTab === "kanzlei" && <TabKanzlei />}
        {activeTab === "gehalt" && <TabGehalt />}
      </div>
    </div>
  );
}
