import type { DsrRequest, DsrStatus, DsrType } from "@/backend.d";
import {
  DsrStatus as DsrStatusEnum,
  DsrType as DsrTypeEnum,
} from "@/backend.d";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { queryKeys, useBackend } from "@/utils/backend";
import {
  useCreateDsrRequest,
  useDsrRequests,
  useUpdateDsrRequest,
} from "@/utils/backend";
import { formatDate } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Download,
  FileText,
  Pencil,
  Plus,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a backend Timestamp (nanoseconds since epoch) to "dd.mm.yyyy". */
function timestampToDate(ts: bigint | undefined): string {
  if (!ts) return "";
  const ms = Number(ts / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

/** Format a Principal-like value (string or Principal) to a short display form. */
function formatAssignedTo(value: unknown): string {
  if (!value) return "–";
  const s = typeof value === "string" ? value : String(value);
  if (!s) return "–";
  // Principals are typically long base32 strings; show first 8 chars.
  if (s.length > 16) return `${s.slice(0, 8)}…`;
  return s;
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
    <span data-ocid={`dsr.type_badge.${type}`} className={cls}>
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
    <span data-ocid={`dsr.status_badge.${status}`} className={cls}>
      {label}
    </span>
  );
}

// ─── CSV Export (Auskunftsersuchen) ──────────────────────────────────────────

/**
 * Generate a client-side CSV export of the affected person's data for an
 * Auskunftsersuchen. Mirrors the audit-trail CSV export pattern but builds the
 * document from the DSR request itself, since the affected person's data is
 * summarized in the request record.
 */
function exportDsrAsCsv(req: DsrRequest): void {
  const escapeCsvField = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const created = timestampToDate(req.createdAt);
  const updated = timestampToDate(req.updatedAt);
  const completed = timestampToDate(req.completedAt);

  const rows: string[][] = [
    ["Feld", "Wert"],
    ["Antrag-ID", req.id],
    ["Typ", TYPE_LABELS[req.dsrType] ?? req.dsrType],
    ["Status", STATUS_LABELS[req.status] ?? req.status],
    ["Anfragender", req.requesterName],
    ["E-Mail", req.requesterEmail],
    ["Zugewiesen an", formatAssignedTo(req.assignedTo)],
    ["Erfasst am", created],
    ["Aktualisiert am", updated],
    ["Abgeschlossen am", completed],
    ["Notizen", req.notes ?? ""],
  ];

  const csv = rows.map((r) => r.map(escapeCsvField).join(",")).join("\r\n");
  // Prepend BOM so Excel reads UTF-8 correctly (Swiss German umlauts).
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = (req.requesterName || "antrag").replace(
    /[^a-zA-Z0-9_-]+/g,
    "_",
  );
  link.download = `auskunft_${safeName}_${created || "export"}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Create Dialog ───────────────────────────────────────────────────────────

interface CreateFormValues {
  type: DsrType;
  requesterName: string;
  requesterEmail: string;
  notes: string;
}

function CreateDsrDialog({
  open,
  onOpenChange,
  kanzleiId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kanzleiId: string;
}) {
  const createMut = useCreateDsrRequest();
  const [values, setValues] = useState<CreateFormValues>({
    type: DsrTypeEnum.auskunft,
    requesterName: "",
    requesterEmail: "",
    notes: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof CreateFormValues, string>>
  >({});

  function reset() {
    setValues({
      type: DsrTypeEnum.auskunft,
      requesterName: "",
      requesterEmail: "",
      notes: "",
    });
    setErrors({});
  }

  function validate(): boolean {
    const next: Partial<Record<keyof CreateFormValues, string>> = {};
    if (!values.requesterName.trim())
      next.requesterName = "Name ist erforderlich";
    if (!values.requesterEmail.trim())
      next.requesterEmail = "E-Mail ist erforderlich";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.requesterEmail))
      next.requesterEmail = "Ungültige E-Mail-Adresse";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createMut.mutateAsync({
        id: "",
        status: DsrStatusEnum.erfasst,
        dsrType: values.type,
        requesterName: values.requesterName.trim(),
        requesterEmail: values.requesterEmail.trim(),
        notes: values.notes.trim() || null,
        kanzleiId,
        createdAt: 0n,
        updatedAt: 0n,
      } as DsrRequest);
      toast.success("DSR-Antrag erfasst");
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(
        (err as Error).message || "Antrag konnte nicht erfasst werden",
      );
    }
  }

  const isSaving = createMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="dsr.create_dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>DSR-Antrag erfassen</DialogTitle>
          <DialogDescription>
            Auskunfts-, Berichtigungs- oder Löschbegehren für eine betroffene
            Person erfassen. Nur durch Kanzlei-Mitarbeitende.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="dsr-type" className="text-xs mb-1 block">
              Typ <span className="text-destructive">*</span>
            </Label>
            <Select
              value={values.type}
              onValueChange={(v) =>
                setValues((s) => ({ ...s, type: v as DsrType }))
              }
            >
              <SelectTrigger id="dsr-type" data-ocid="dsr.create.type_select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DsrTypeEnum.auskunft}>Auskunft</SelectItem>
                <SelectItem value={DsrTypeEnum.berichtigung}>
                  Berichtigung
                </SelectItem>
                <SelectItem value={DsrTypeEnum.loeschung}>Löschung</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="dsr-name" className="text-xs mb-1 block">
              Anfragender <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dsr-name"
              data-ocid="dsr.create.name_input"
              value={values.requesterName}
              onChange={(e) =>
                setValues((s) => ({ ...s, requesterName: e.target.value }))
              }
              className={errors.requesterName ? "border-destructive" : ""}
              placeholder="Vor- und Nachname"
            />
            {errors.requesterName && (
              <p
                data-ocid="dsr.create.name_field_error"
                className="text-xs text-destructive mt-1"
              >
                {errors.requesterName}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="dsr-email" className="text-xs mb-1 block">
              E-Mail <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dsr-email"
              type="email"
              data-ocid="dsr.create.email_input"
              value={values.requesterEmail}
              onChange={(e) =>
                setValues((s) => ({ ...s, requesterEmail: e.target.value }))
              }
              className={errors.requesterEmail ? "border-destructive" : ""}
              placeholder="name@beispiel.ch"
            />
            {errors.requesterEmail && (
              <p
                data-ocid="dsr.create.email_field_error"
                className="text-xs text-destructive mt-1"
              >
                {errors.requesterEmail}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="dsr-notes" className="text-xs mb-1 block">
              Notizen
            </Label>
            <Textarea
              id="dsr-notes"
              data-ocid="dsr.create.notes_input"
              value={values.notes}
              onChange={(e) =>
                setValues((s) => ({ ...s, notes: e.target.value }))
              }
              rows={4}
              placeholder="Zusätzliche Angaben zum Begehren…"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-ocid="dsr.create.cancel_button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              data-ocid="dsr.create.submit_button"
              disabled={isSaving}
            >
              {isSaving ? "Speichern…" : "Antrag erfassen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Dialog ─────────────────────────────────────────────────────────────

function EditDsrDialog({
  request,
  open,
  onOpenChange,
}: {
  request: DsrRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMut = useUpdateDsrRequest();
  const [status, setStatus] = useState<DsrStatus>(DsrStatusEnum.erfasst);
  const [notes, setNotes] = useState("");

  // Sync local state when the request changes.
  useMemo(() => {
    if (request) {
      setStatus(request.status);
      setNotes(request.notes ?? "");
    }
  }, [request]);

  if (!request) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request) return;
    try {
      await updateMut.mutateAsync({
        id: request.id,
        status,
        notes: notes.trim() || null,
      });
      toast.success("Antrag aktualisiert");
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message || "Aktualisierung fehlgeschlagen");
    }
  }

  const isSaving = updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-ocid="dsr.edit_dialog" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Antrag bearbeiten</DialogTitle>
          <DialogDescription>
            Status und Notizen für den DSR-Antrag von{" "}
            <span className="font-medium text-foreground">
              {request.requesterName}
            </span>{" "}
            aktualisieren.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <TypeBadge type={request.dsrType} />
              <StatusBadge status={request.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              E-Mail: {request.requesterEmail || "–"}
            </p>
          </div>

          <div>
            <Label htmlFor="dsr-edit-status" className="text-xs mb-1 block">
              Status <span className="text-destructive">*</span>
            </Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as DsrStatus)}
            >
              <SelectTrigger
                id="dsr-edit-status"
                data-ocid="dsr.edit.status_select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DsrStatusEnum.erfasst}>Erfasst</SelectItem>
                <SelectItem value={DsrStatusEnum.inBearbeitung}>
                  In Bearbeitung
                </SelectItem>
                <SelectItem value={DsrStatusEnum.abgeschlossen}>
                  Abgeschlossen
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Workflow: erfasst → in Bearbeitung → abgeschlossen
            </p>
          </div>

          <div>
            <Label htmlFor="dsr-edit-notes" className="text-xs mb-1 block">
              Notizen
            </Label>
            <Textarea
              id="dsr-edit-notes"
              data-ocid="dsr.edit.notes_input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Bearbeitungsschritte, Kommunikation mit der betroffenenen Person…"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              data-ocid="dsr.edit.cancel_button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              data-ocid="dsr.edit.submit_button"
              disabled={isSaving}
            >
              {isSaving ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function DsrPage() {
  const { actor, isLoading: actorLoading } = useBackend();

  // Admin guard — soft guard matching the BenutzerverwaltungPage pattern.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });
  const isAdmin = currentUser?.isAdmin ?? false;

  const { data: requests = [], isLoading } = useDsrRequests(
    currentUser?.kanzleiId,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DsrRequest | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState<"alle" | DsrType>("alle");
  const [statusFilter, setStatusFilter] = useState<"alle" | DsrStatus>("alle");

  const filtered = useMemo(
    () =>
      requests.filter((r) => {
        const typeMatch = typeFilter === "alle" || r.dsrType === typeFilter;
        const statusMatch =
          statusFilter === "alle" || r.status === statusFilter;
        return typeMatch && statusMatch;
      }),
    [requests, typeFilter, statusFilter],
  );

  function handleEdit(req: DsrRequest) {
    setEditTarget(req);
    setEditOpen(true);
  }

  function handleExport(req: DsrRequest) {
    try {
      exportDsrAsCsv(req);
      toast.success("Auskunft exportiert");
    } catch (err) {
      toast.error((err as Error).message || "Export fehlgeschlagen");
    }
  }

  // ── Admin guard ───────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div
        data-ocid="dsr.page"
        className="flex flex-col items-center justify-center h-64 gap-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert size={28} className="text-destructive" />
        </div>
        <p className="font-semibold text-foreground">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground">
          Nur Administratoren können DSR-Anträge verwalten.
        </p>
      </div>
    );
  }

  return (
    <div data-ocid="dsr.page" className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between">
        <div>
          <h1 className="text-xl font-display font-semibold text-foreground">
            DSR-Verwaltung
          </h1>
          <p className="text-sm text-muted-foreground">
            Auskunfts-, Berichtigungs- und Löschbegehren (revDSG)
          </p>
        </div>
        <Button
          data-ocid="dsr.new_request_button"
          className="btn-success gap-2"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={15} />
          DSR-Antrag erfassen
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="px-6 py-3 bg-muted/30 border-b border-border flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Typ:
          </span>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as "alle" | DsrType)}
          >
            <SelectTrigger
              data-ocid="dsr.type_filter"
              className="h-8 text-sm w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Typen</SelectItem>
              <SelectItem value={DsrTypeEnum.auskunft}>Auskunft</SelectItem>
              <SelectItem value={DsrTypeEnum.berichtigung}>
                Berichtigung
              </SelectItem>
              <SelectItem value={DsrTypeEnum.loeschung}>Löschung</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Status:
          </span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "alle" | DsrStatus)}
          >
            <SelectTrigger
              data-ocid="dsr.status_filter"
              className="h-8 text-sm w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value={DsrStatusEnum.erfasst}>Erfasst</SelectItem>
              <SelectItem value={DsrStatusEnum.inBearbeitung}>
                In Bearbeitung
              </SelectItem>
              <SelectItem value={DsrStatusEnum.abgeschlossen}>
                Abgeschlossen
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} von {requests.length} Anträgen
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-card border-b border-border">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-4 py-3 font-medium">Typ</th>
              <th className="text-left px-4 py-3 font-medium">Anfragender</th>
              <th className="text-left px-4 py-3 font-medium">E-Mail</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Erstellt am</th>
              <th className="text-left px-4 py-3 font-medium">Zugewiesen an</th>
              <th className="text-right px-4 py-3 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              ["s1", "s2", "s3", "s4", "s5"].map((sk) => (
                <tr
                  key={sk}
                  data-ocid="dsr.loading_state"
                  className="border-b border-border"
                >
                  {["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((ck) => (
                    <td key={ck} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div
                    data-ocid="dsr.empty_state"
                    className="flex flex-col items-center justify-center py-20 gap-4"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <ClipboardList size={28} className="text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="font-display font-semibold text-foreground">
                        Keine DSR-Anträge vorhanden
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Erfassen Sie einen neuen Antrag mit «DSR-Antrag
                        erfassen».
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((req, idx) => (
                <tr
                  key={req.id}
                  data-ocid={`dsr.item.${idx + 1}`}
                  className="border-b border-border hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <TypeBadge type={req.dsrType} />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground truncate max-w-[180px]">
                    {req.requesterName || "–"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                    {req.requesterEmail || "–"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {formatDate(timestampToDate(req.createdAt))}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {formatAssignedTo(req.assignedTo)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {req.dsrType === DsrTypeEnum.auskunft && (
                        <Button
                          variant="outline"
                          size="sm"
                          data-ocid={`dsr.export_button.${idx + 1}`}
                          onClick={() => handleExport(req)}
                          className="gap-1.5"
                          title="Auskunft als CSV exportieren"
                        >
                          <Download size={14} />
                          Auskunft exportieren
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        data-ocid={`dsr.edit_button.${idx + 1}`}
                        onClick={() => handleEdit(req)}
                        className="gap-1.5"
                      >
                        <Pencil size={14} />
                        Bearbeiten
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer hint */}
      <div className="px-6 py-3 border-t border-border bg-card flex items-center gap-2 text-xs text-muted-foreground">
        <FileText size={14} className="text-primary" />
        <span>
          DSR-Anträge werden ausschliesslich durch Kanzlei-Mitarbeitende
          erfasst. Es steht kein Self-Service-Portal für Mandanten zur
          Verfügung.
        </span>
      </div>

      <CreateDsrDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        kanzleiId={currentUser?.kanzleiId ?? ""}
      />
      <EditDsrDialog
        request={editTarget}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
