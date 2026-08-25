import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLogEntry, AuditTrailFilter } from "@/types";
import {
  queryKeys,
  useAuditTrail,
  useBackend,
  useExportAuditTrailCsv,
  useExportAuditTrailPdf,
} from "@/utils/backend";
import { formatDate, parseDate } from "@/utils/format";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileText,
  Filter,
  History,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Truncate a principal string to "first5…last4" form for compact display.
 */
function truncatePrincipal(p: string): string {
  if (!p) return "—";
  if (p.length <= 10) return p;
  return `${p.slice(0, 5)}…${p.slice(-4)}`;
}

/**
 * Convert a bigint nanosecond timestamp to a formatted dd.mm.yyyy string.
 */
function formatTimestampNs(ns: bigint): string {
  const ms = Number(ns) / 1_000_000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hh}:${mm}`;
}

/**
 * Convert a dd.mm.yyyy date string (start or end of day) to bigint nanoseconds.
 * Returns undefined for empty/invalid input.
 */
function dateStrToNs(dateStr: string, endOfDay: boolean): bigint | undefined {
  if (!dateStr) return undefined;
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return undefined;
  const d = parseDate(dateStr);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return BigInt(Math.floor(d.getTime() * 1_000_000));
}

/**
 * Try to parse a principal text input. Returns Principal or undefined.
 */
function tryParsePrincipal(text: string): Principal | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return Principal.fromText(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * Truncate a value string for table display.
 */
function truncateValue(value: string | undefined, max = 40): string {
  if (!value) return "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

/**
 * Classify an audit action into a severity level for badge styling.
 * - critical: deletions, security-relevant changes
 * - warning: updates, status changes, exports
 * - info: reads, views, queries
 */
function severityForAction(action: string): "info" | "warning" | "critical" {
  const a = action.toLowerCase();
  if (
    a.includes("lösch") ||
    a.includes("loesch") ||
    a.includes("delete") ||
    a.includes("remove") ||
    a.includes("revoke") ||
    a.includes("permission") ||
    a.includes("role")
  ) {
    return "critical";
  }
  if (
    a.includes("update") ||
    a.includes("änder") ||
    a.includes("aender") ||
    a.includes("create") ||
    a.includes("export") ||
    a.includes("status") ||
    a.includes("assign")
  ) {
    return "warning";
  }
  return "info";
}

function severityBadgeClass(sev: "info" | "warning" | "critical"): string {
  switch (sev) {
    case "critical":
      return "badge-audit-critical";
    case "warning":
      return "badge-audit-warning";
    default:
      return "badge-audit-info";
  }
}

// Known entity types for the filter dropdown.
const ENTITY_TYPES = [
  "Klient",
  "Mandat",
  "Leistung",
  "Auslage",
  "Rechnung",
  "Zahlung",
  "Leistungserbringer",
  "DsrRequest",
  "ConsentRecord",
  "RetentionPolicy",
  "DataInventoryEntry",
  "DataFlowEntry",
  "DsgVersion",
] as const;

// ─── Page ──────────────────────────────────────────────────────────────────

export function AuditTrailPage() {
  const { actor, isLoading: actorLoading } = useBackend();

  // Admin-only soft guard: read current user, gate UI on isAdmin.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const isAdmin = currentUser?.isAdmin ?? false;

  // ── Filter state ────────────────────────────────────────────────────────
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [actorInput, setActorInput] = useState("");

  // Build the AuditTrailFilter from the filter inputs.
  // kanzleiId scopes the audit trail to the admin's kanzlei.
  const filter: AuditTrailFilter | undefined = useMemo(() => {
    if (!actor) return undefined;
    const fromNs = dateStrToNs(fromDate, false);
    const toNs = dateStrToNs(toDate, true);
    const principal = tryParsePrincipal(actorInput);
    return {
      kanzleiId: currentUser?.kanzleiId ?? "",
      fromTimestamp: fromNs,
      toTimestamp: toNs,
      entityType: entityType === "all" ? undefined : entityType,
      actorPrincipal: principal,
    } as AuditTrailFilter;
  }, [actor, fromDate, toDate, entityType, actorInput, currentUser?.kanzleiId]);

  const {
    data: entries = [],
    isLoading: entriesLoading,
    isFetching,
  } = useAuditTrail(filter);

  const csvMut = useExportAuditTrailCsv();
  const pdfMut = useExportAuditTrailPdf();

  // ── Export handlers ─────────────────────────────────────────────────────
  function handleExportCsv() {
    if (!filter) {
      toast.error("Backend nicht bereit");
      return;
    }
    csvMut.mutate(filter, {
      onSuccess: (csv) => {
        try {
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const stamp = new Date().toISOString().slice(0, 10);
          a.download = `audit-trail_${stamp}.csv`;
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
      },
      onError: (e: Error) =>
        toast.error(`CSV-Export fehlgeschlagen: ${e.message}`),
    });
  }

  function handleExportPdf() {
    if (!filter) {
      toast.error("Backend nicht bereit");
      return;
    }
    pdfMut.mutate(filter, {
      onSuccess: (bytes) => {
        try {
          const blob = new Blob([new Uint8Array(bytes)], {
            type: "application/pdf",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const stamp = new Date().toISOString().slice(0, 10);
          a.download = `audit-trail_${stamp}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("PDF-Export heruntergeladen");
        } catch (e) {
          toast.error(
            `Export fehlgeschlagen: ${e instanceof Error ? e.message : "unbekannt"}`,
          );
        }
      },
      onError: (e: Error) =>
        toast.error(`PDF-Export fehlgeschlagen: ${e.message}`),
    });
  }

  function handleResetFilters() {
    setFromDate("");
    setToDate("");
    setEntityType("all");
    setActorInput("");
  }

  const hasActiveFilters =
    fromDate !== "" ||
    toDate !== "" ||
    entityType !== "all" ||
    actorInput !== "";

  const exportPending = csvMut.isPending || pdfMut.isPending;

  // ── Admin guard ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div
        data-ocid="audit_trail.access_denied"
        className="flex flex-col items-center justify-center h-64 gap-4 px-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Lock size={28} className="text-destructive" />
        </div>
        <p className="font-semibold text-foreground">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Der Audit-Trail ist Teil der revDSG-Dokumentation und nur für
          Administratoren zugänglich.
        </p>
      </div>
    );
  }

  return (
    <div
      data-ocid="audit_trail.page"
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Header / Purpose ─────────────────────────────────────────────── */}
      <section
        data-ocid="audit_trail.header_section"
        className="bg-card border border-border rounded-lg p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <History size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-xl text-foreground">
                Audit-Trail
              </h1>
              <span className="badge-info inline-flex items-center gap-1.5">
                <ShieldCheck size={12} />
                revDSG
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
              Der Audit-Trail protokolliert alle Zugriffe und Änderungen an
              personenbezogenen Daten unveränderlich und append-only. Einträge
              können weder bearbeitet noch gelöscht werden — eine zentrale
              Anforderung der revidierten Datenschutzgesetzgebung (revDSG). Die
              Aufzeichnungen dienen der Nachweisführung gegenüber der
              Aufsichtsbehörde.
            </p>
          </div>
        </div>
      </section>

      {/* ── Filter controls ──────────────────────────────────────────────── */}
      <section
        data-ocid="audit_trail.filter_section"
        className="bg-card border border-border rounded-lg p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-muted-foreground" />
          <h2 className="font-display font-semibold text-foreground">Filter</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="audit-from"
              className="text-sm text-muted-foreground"
            >
              Zeitraum von
            </Label>
            <Input
              id="audit-from"
              data-ocid="audit_trail.filter_from"
              type="date"
              placeholder="dd.mm.yyyy"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to" className="text-sm text-muted-foreground">
              Zeitraum bis
            </Label>
            <Input
              id="audit-to"
              data-ocid="audit_trail.filter_to"
              type="date"
              placeholder="dd.mm.yyyy"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-muted-foreground">Entität-Typ</Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger
                data-ocid="audit_trail.filter_entity_type"
                className="w-full"
              >
                <SelectValue placeholder="Alle Entitäten" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Entitäten</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="audit-actor"
              className="text-sm text-muted-foreground"
            >
              Nutzer (Principal)
            </Label>
            <Input
              id="audit-actor"
              data-ocid="audit_trail.filter_actor"
              type="text"
              placeholder="z.B. 2vxsx-fae…"
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Search size={14} />
            <span>
              {hasActiveFilters
                ? "Filter aktiv"
                : "Kein Filter — alle Einträge werden angezeigt"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                data-ocid="audit_trail.filter_reset"
              >
                Zurücksetzen
              </Button>
            )}
            <Button
              size="sm"
              className="btn-success gap-1.5"
              onClick={handleExportCsv}
              disabled={exportPending || entries.length === 0}
              data-ocid="audit_trail.export_csv"
            >
              {csvMut.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Als CSV exportieren
            </Button>
            <Button
              size="sm"
              className="btn-success gap-1.5"
              onClick={handleExportPdf}
              disabled={exportPending || entries.length === 0}
              data-ocid="audit_trail.export_pdf"
            >
              {pdfMut.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              Als PDF exportieren
            </Button>
          </div>
        </div>
      </section>

      {/* ── Audit trail table ─────────────────────────────────────────────── */}
      <section
        data-ocid="audit_trail.table_section"
        className="bg-card border border-border rounded-lg shadow-sm overflow-hidden"
      >
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <History size={16} className="text-primary" />
            Protokollierte Ereignisse
            {entries.length > 0 && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {entries.length} {entries.length === 1 ? "Eintrag" : "Einträge"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entriesLoading || isFetching ? (
            <div className="p-6 space-y-3" data-ocid="audit_trail.loading">
              {Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div
              data-ocid="audit_trail.empty_state"
              className="flex flex-col items-center justify-center py-16 px-6 gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <History size={22} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Keine Einträge</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                Für die gewählten Filterkriterien wurden keine Audit-Einträge
                gefunden. Passen Sie den Zeitraum oder die Entität-Typ-Filter
                an, um Ergebnisse zu sehen.
              </p>
            </div>
          ) : (
            <Table data-ocid="audit_trail.table">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-medium">Zeitstempel</TableHead>
                  <TableHead className="font-medium">Nutzer</TableHead>
                  <TableHead className="font-medium">Aktion</TableHead>
                  <TableHead className="font-medium">Entität-Typ</TableHead>
                  <TableHead className="font-medium">Entität-ID</TableHead>
                  <TableHead className="font-medium">Vorher</TableHead>
                  <TableHead className="font-medium">Nachher</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: AuditLogEntry) => {
                  const severity = severityForAction(entry.action);
                  const principalText =
                    entry.actorPrincipal?.toText?.() ??
                    (typeof entry.actorPrincipal === "string"
                      ? entry.actorPrincipal
                      : "");
                  return (
                    <TableRow key={entry.id} data-ocid="audit_trail.row">
                      <TableCell className="whitespace-nowrap text-sm text-foreground">
                        {formatTimestampNs(entry.timestamp)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-mono text-muted-foreground">
                        {truncatePrincipal(principalText)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={severityBadgeClass(severity)}
                          data-ocid="audit_trail.severity_badge"
                        >
                          {entry.action}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-foreground">
                        {entry.entityType || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-mono text-muted-foreground">
                        {truncateValue(entry.entityId, 24)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {truncateValue(entry.beforeValue)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {truncateValue(entry.afterValue)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </section>

      {/* ── Footer note ──────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground px-1">
        Hinweis: Der Audit-Trail ist unveränderlich (immutable) und wird
        ausschliesslich append-only geführt. Exporte dienen der Nachweisführung
        gemäss revDSG Art. 8 und können von der Aufsichtsbehörde angefordert
        werden.
      </p>
    </div>
  );
}
