import { DsrStatus as DsrStatusEnum, DsrType as DsrTypeEnum } from "@/backend";
import type { DsrRequest, DsrStatus, DsrType } from "@/backend.d";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardStats, PendingDeletion } from "@/types";
import { queryKeys, useBackend } from "@/utils/backend";
import {
  useDashboardStats,
  useDsrRequests,
  useExecuteDeletion,
  usePendingDeletions,
} from "@/utils/backend";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Database,
  Download,
  FileText,
  Inbox,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a nanosecond bigint timestamp (IC) to a dd.mm.yyyy display string. */
function formatTimestampNs(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return "–";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "–";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

const TYPE_LABELS: Record<DsrType, string> = {
  [DsrTypeEnum.auskunft]: "Auskunft",
  [DsrTypeEnum.berichtigung]: "Berichtigung",
  [DsrTypeEnum.loeschung]: "Löschung",
};

const STATUS_LABELS: Record<DsrStatus, string> = {
  [DsrStatusEnum.erfasst]: "Erfasst",
  [DsrStatusEnum.inBearbeitung]: "In Bearbeitung",
  [DsrStatusEnum.abgeschlossen]: "Abgeschlossen",
};

function TypeBadge({ type }: { type: DsrType }) {
  const label = TYPE_LABELS[type] ?? type;
  const cls =
    type === DsrTypeEnum.auskunft
      ? "badge-info"
      : type === DsrTypeEnum.berichtigung
        ? "badge-warning"
        : "badge-danger";
  return (
    <span className={cls} data-ocid={`dsr_dashboard.type_badge.${type}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: DsrStatus }) {
  const label = STATUS_LABELS[status] ?? status;
  const cls =
    status === DsrStatusEnum.abgeschlossen
      ? "badge-success"
      : status === DsrStatusEnum.inBearbeitung
        ? "badge-info"
        : "badge-neutral";
  return (
    <span className={cls} data-ocid={`dsr_dashboard.status_badge.${status}`}>
      {label}
    </span>
  );
}

interface ConfirmDeletionState {
  categoryName: string;
  entityId: string;
}

// ─── KPI Card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentClass: string;
  iconWrapClass: string;
  testId: string;
}

function KpiCard({
  label,
  value,
  icon,
  accentClass,
  iconWrapClass,
  testId,
}: KpiCardProps) {
  return (
    <Card data-ocid={testId} className="relative overflow-hidden py-5">
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-1 ${accentClass}`}
      />
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardDescription className="text-xs uppercase tracking-wide">
              {label}
            </CardDescription>
            <CardTitle className="mt-1 font-display text-3xl font-bold tabular-nums">
              {value}
            </CardTitle>
          </div>
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}
          >
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0" />
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function DatenschutzDashboardPage() {
  const { actor, isLoading: actorLoading } = useBackend();

  // Admin guard: fetch current user, soft-block non-admins.
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const isAdmin = currentUser?.isAdmin ?? false;

  // ── Datenschutz data hooks ───────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useDashboardStats(
    currentUser?.kanzleiId,
  );
  const { data: pendingDeletions = [], isLoading: deletionsLoading } =
    usePendingDeletions(currentUser?.kanzleiId);
  const { data: dsrRequests = [], isLoading: dsrLoading } = useDsrRequests(
    currentUser?.kanzleiId,
  );

  // ── Mutations ────────────────────────────────────────────────────────────
  const executeDeletionMut = useExecuteDeletion();

  // ── Local UI state ───────────────────────────────────────────────────────
  const [confirmDeletion, setConfirmDeletion] =
    useState<ConfirmDeletionState | null>(null);

  // ── Derived values ───────────────────────────────────────────────────────
  const totalRecords =
    stats?.totalRecordsByCategory?.reduce(
      (sum, [, count]) => sum + count,
      0n,
    ) ?? 0n;

  const pendingCount = stats?.pendingDeletions ?? 0n;
  const openDsrCount = stats?.openDsrRequests ?? 0n;
  const missingConsents = stats?.missingConsents ?? 0n;
  const auditExports = stats?.auditExports ?? 0n;

  const showWarning =
    pendingCount > 0n || openDsrCount > 0n || missingConsents > 0n;

  const openDsrRequests = dsrRequests.filter(
    (r: DsrRequest) => r.status !== DsrStatusEnum.abgeschlossen,
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleConfirmDeletion() {
    if (!confirmDeletion) return;
    const { categoryName, entityId } = confirmDeletion;
    executeDeletionMut.mutate(
      { categoryName, entityId },
      {
        onSuccess: () => {
          toast.success("Datensatz erfolgreich gelöscht", {
            description: `Kategorie „${categoryName}" – ID ${entityId}`,
          });
          setConfirmDeletion(null);
        },
        onError: (err: unknown) => {
          toast.error("Löschung fehlgeschlagen", {
            description:
              err instanceof Error ? err.message : "Unbekannter Fehler",
          });
        },
      },
    );
  }

  // ── Loading state (user / admin check) ──────────────────────────────────
  if (userLoading) {
    return (
      <div className="space-y-6 p-6" data-ocid="dsr_dashboard.loading_state">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Non-admin soft guard ─────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="p-6" data-ocid="dsr_dashboard.no_access">
        <Card className="mx-auto max-w-lg">
          <CardHeader className="items-center text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <ShieldAlert className="size-6 text-destructive" />
            </div>
            <CardTitle className="font-display">Kein Zugriff</CardTitle>
            <CardDescription>
              Dieses Dashboard steht ausschliesslich Administratorinnen und
              Administratoren zur Verfügung. Wenden Sie sich an Ihre
              Kanzlei-Administration, falls Sie Zugriff benötigen.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-ocid="dsr_dashboard.page">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold text-foreground">
          Datenschutz-Dashboard
        </h2>
        <p className="text-sm text-muted-foreground">
          Überblick über revDSG-relevante Vorgänge: Löschungen, DSR-Anträge und
          Audit-Exporte.
        </p>
      </div>

      {/* ── Warning banner ─────────────────────────────────────────────────── */}
      {showWarning && (
        <div
          className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between"
          data-ocid="dsr_dashboard.warning_banner"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-warning-foreground">
                Handlungsbedarf erkannt
              </p>
              <p className="text-sm text-muted-foreground">
                {[
                  pendingCount > 0n
                    ? `${pendingCount.toString()} fällige Löschung(en)`
                    : null,
                  openDsrCount > 0n
                    ? `${openDsrCount.toString()} offene DSR-Anträge`
                    : null,
                  missingConsents > 0n
                    ? `${missingConsents.toString()} fehlende Einwilligung(en)`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <span
            className="badge-warning self-start sm:self-auto"
            data-ocid="dsr_dashboard.warning_badge"
          >
            Aktion erforderlich
          </span>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-ocid="dsr_dashboard.kpi_grid"
      >
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
            <Skeleton key={i} className="h-28 w-full" />
          ))
        ) : (
          <>
            <KpiCard
              testId="dsr_dashboard.kpi.total_records"
              label="Datensätze pro Kategorie"
              value={totalRecords.toString()}
              accentClass="bg-success"
              iconWrapClass="bg-success/10 text-success"
              icon={<Database className="size-5" />}
            />
            <KpiCard
              testId="dsr_dashboard.kpi.pending_deletions"
              label="Fällige Löschungen"
              value={pendingCount.toString()}
              accentClass="bg-warning"
              iconWrapClass="bg-warning/10 text-warning"
              icon={<Trash2 className="size-5" />}
            />
            <KpiCard
              testId="dsr_dashboard.kpi.open_dsr"
              label="Offene DSR-Anträge"
              value={openDsrCount.toString()}
              accentClass="bg-info"
              iconWrapClass="bg-info/10 text-info"
              icon={<FileText className="size-5" />}
            />
            <KpiCard
              testId="dsr_dashboard.kpi.audit_exports"
              label="Audit-Exporte"
              value={auditExports.toString()}
              accentClass="bg-primary"
              iconWrapClass="bg-primary/10 text-primary"
              icon={<Download className="size-5" />}
            />
          </>
        )}
      </div>

      {/* ── Pending deletions table ────────────────────────────────────────── */}
      <Card data-ocid="dsr_dashboard.pending_deletions_card">
        <CardHeader>
          <CardTitle className="font-display">Fällige Löschungen</CardTitle>
          <CardDescription>
            Datensätze, deren Aufbewahrungsfrist abgelaufen ist und manuell
            gelöscht werden müssen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deletionsLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : pendingDeletions.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 py-10 text-center"
              data-ocid="dsr_dashboard.pending_deletions.empty_state"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-success/10">
                <Inbox className="size-5 text-success" />
              </div>
              <p className="font-medium text-foreground">
                Keine fälligen Löschungen
              </p>
              <p className="text-sm text-muted-foreground">
                Alle Datensätze befinden sich innerhalb ihrer
                Aufbewahrungsfrist.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kategorie</TableHead>
                  <TableHead>Datensatz-ID</TableHead>
                  <TableHead>Fällig seit</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingDeletions.map((item: PendingDeletion, idx: number) => {
                  const [categoryName, entityId, dueTs] = item;
                  return (
                    <TableRow
                      key={`${categoryName}-${entityId}`}
                      data-ocid={`dsr_dashboard.pending_deletions.row.${idx}`}
                    >
                      <TableCell className="font-medium">
                        {categoryName}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {entityId}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatTimestampNs(dueTs)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          className="btn-success h-8 gap-1.5 text-xs"
                          data-ocid={`dsr_dashboard.pending_deletions.delete_button.${idx}`}
                          onClick={() =>
                            setConfirmDeletion({ categoryName, entityId })
                          }
                        >
                          <Trash2 className="size-3.5" />
                          Löschen
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Open DSR requests list ────────────────────────────────────────── */}
      <Card data-ocid="dsr_dashboard.open_dsr_card">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="font-display">Offene DSR-Anträge</CardTitle>
              <CardDescription>
                Betroffenenrecht-Anträge gemäss revDSG, die noch nicht
                abgeschlossen sind.
              </CardDescription>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="shrink-0"
              data-ocid="dsr_dashboard.open_dsr.all_link"
            >
              <Link to="/app/datenschutz/dsr">Alle Anträge</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {dsrLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : openDsrRequests.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 py-10 text-center"
              data-ocid="dsr_dashboard.open_dsr.empty_state"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-success/10">
                <Inbox className="size-5 text-success" />
              </div>
              <p className="font-medium text-foreground">
                Keine offenen DSR-Anträge
              </p>
              <p className="text-sm text-muted-foreground">
                Alle Anträge wurden erfasst oder bereits abgeschlossen.
              </p>
            </div>
          ) : (
            <ul
              className="divide-y divide-border"
              data-ocid="dsr_dashboard.open_dsr.list"
            >
              {openDsrRequests.map((req: DsrRequest, idx: number) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                  data-ocid={`dsr_dashboard.open_dsr.item.${idx}`}
                >
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium text-foreground">
                      {req.requesterName || "Unbekannt"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {req.requesterEmail || "–"} ·{" "}
                      <span className="font-mono">{req.id}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TypeBadge type={req.dsrType} />
                    <StatusBadge status={req.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Confirm deletion dialog ───────────────────────────────────────── */}
      <Dialog
        open={confirmDeletion !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeletion(null);
        }}
      >
        <DialogContent
          data-ocid="dsr_dashboard.confirm_deletion_dialog"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Löschung bestätigen
            </DialogTitle>
            <DialogDescription>
              {confirmDeletion ? (
                <>
                  Der Datensatz{" "}
                  <span className="font-mono">{confirmDeletion.entityId}</span>{" "}
                  aus der Kategorie „{confirmDeletion.categoryName}" wird
                  unwiderruflich gelöscht. Diese Aktion wird im Audit-Trail
                  protokolliert.
                </>
              ) : (
                "Bitte bestätigen Sie die Löschung."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                data-ocid="dsr_dashboard.confirm_deletion.cancel_button"
              >
                Abbrechen
              </Button>
            </DialogClose>
            <Button
              className="btn-success gap-2"
              data-ocid="dsr_dashboard.confirm_deletion.confirm_button"
              disabled={executeDeletionMut.isPending}
              onClick={handleConfirmDeletion}
            >
              <Trash2 className="size-4" />
              {executeDeletionMut.isPending
                ? "Wird gelöscht…"
                : "Endgültig löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
