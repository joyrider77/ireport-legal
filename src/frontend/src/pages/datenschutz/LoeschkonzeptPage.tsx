import type { RetentionPolicy } from "@/backend.d";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys, useBackend } from "@/utils/backend";
import {
  useConsentRecords,
  useDsgVersion,
  useExecuteDeletion,
  usePendingDeletions,
  useRetentionPolicies,
  useUpdateDsgVersion,
  useUpdateRetentionPolicy,
} from "@/utils/backend";
import { formatDate } from "@/utils/format";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  Info,
  Lock,
  LockOpen,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Unlock,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert a nanosecond bigint timestamp (IC) to a dd.mm.yyyy display string. */
function formatTimestampNs(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

interface EditPolicyState {
  id: string;
  categoryName: string;
  retentionYears: string;
  isLocked: boolean;
}

interface ConfirmDeletionState {
  categoryName: string;
  entityId: string;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function LoeschkonzeptPage() {
  const { actor, isLoading: actorLoading } = useBackend();

  // Admin guard: fetch current user, soft-block non-admins.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const isAdmin = currentUser?.isAdmin ?? false;

  // ── Datenschutz data hooks ───────────────────────────────────────────────
  const { data: policies = [], isLoading: policiesLoading } =
    useRetentionPolicies(currentUser?.kanzleiId);
  const { data: pendingDeletions = [], isLoading: deletionsLoading } =
    usePendingDeletions(currentUser?.kanzleiId);
  const { data: dsgVersion, isLoading: dsgLoading } = useDsgVersion();
  const { data: consentRecords = [], isLoading: consentLoading } =
    useConsentRecords(currentUser?.kanzleiId);

  // ── Mutations ────────────────────────────────────────────────────────────
  const updatePolicyMut = useUpdateRetentionPolicy();
  const executeDeletionMut = useExecuteDeletion();
  const updateDsgMut = useUpdateDsgVersion();

  // ── Local UI state ───────────────────────────────────────────────────────
  const [editPolicy, setEditPolicy] = useState<EditPolicyState | null>(null);
  const [confirmDeletion, setConfirmDeletion] =
    useState<ConfirmDeletionState | null>(null);
  const [dsgDialogOpen, setDsgDialogOpen] = useState(false);
  const [dsgVersionField, setDsgVersionField] = useState("");
  const [dsgContentField, setDsgContentField] = useState("");

  // ── Handlers ─────────────────────────────────────────────────────────────
  function openEditPolicy(p: RetentionPolicy) {
    setEditPolicy({
      id: p.id,
      categoryName: p.categoryName,
      retentionYears: String(p.retentionYears),
      isLocked: p.isLocked,
    });
  }

  function handleSavePolicy() {
    if (!editPolicy) return;
    const years = Number.parseInt(editPolicy.retentionYears, 10);
    if (!Number.isFinite(years) || years < 0) {
      toast.error("Aufbewahrungsfrist muss eine nicht-negative Zahl sein.");
      return;
    }
    updatePolicyMut.mutate(
      {
        id: editPolicy.id,
        retentionYears: BigInt(years),
        isLocked: editPolicy.isLocked,
      },
      {
        onSuccess: (res) => {
          if (res.__kind__ === "err") {
            toast.error(res.err);
            return;
          }
          toast.success("Aufbewahrungsfrist aktualisiert.");
          setEditPolicy(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function handleConfirmDeletion() {
    if (!confirmDeletion) return;
    executeDeletionMut.mutate(
      {
        categoryName: confirmDeletion.categoryName,
        entityId: confirmDeletion.entityId,
      },
      {
        onSuccess: (res) => {
          if (res.__kind__ === "err") {
            toast.error(res.err);
            return;
          }
          toast.success("Datensatz manuell gelöscht.");
          setConfirmDeletion(null);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  function openDsgDialog() {
    setDsgVersionField(dsgVersion?.version ?? "");
    setDsgContentField(dsgVersion?.content ?? "");
    setDsgDialogOpen(true);
  }

  function handleSaveDsg() {
    const version = dsgVersionField.trim();
    if (!version) {
      toast.error("Bitte geben Sie eine Versionsnummer ein.");
      return;
    }
    updateDsgMut.mutate(
      {
        version,
        content: dsgContentField.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Datenschutzerklärungklärung-Version erfasst.");
          setDsgDialogOpen(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  // ── Derived consent summary ──────────────────────────────────────────────
  const consentGiven = consentRecords.filter((c) => c.consentGiven).length;
  const consentMissing = consentRecords.length - consentGiven;

  // ─── Admin soft guard ────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div
        data-ocid="loeschkonzept.page"
        className="flex flex-col items-center justify-center h-64 gap-4 p-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert size={28} className="text-destructive" />
        </div>
        <p className="font-semibold text-foreground">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Das Löschkonzept ist administrativ. Nur Administratoren dürfen
          Aufbewahrungsfristen und manuelle Löschungen verwalten.
        </p>
      </div>
    );
  }

  return (
    <div
      data-ocid="loeschkonzept.page"
      className="p-6 space-y-8 max-w-5xl mx-auto"
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <header data-ocid="loeschkonzept.header" className="space-y-1">
        <h2 className="font-display font-bold text-foreground text-2xl tracking-tight">
          Löschkonzept
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Verwaltung der Aufbewahrungsfristen gemäss OR 953a (10 Jahre),
          manuelle Löschung fälliger Datensätze und Versionierung der
          Datenschutzerklärung. Löschungen werden manuell ausgelöst — es gibt
          keine automatische Löschung.
        </p>
      </header>

      {/* ── Section 1: Aufbewahrungsfristen ─────────────────────────────── */}
      <section data-ocid="loeschkonzept.retention_section">
        <div className="mb-4">
          <h3 className="font-display font-semibold text-foreground text-lg">
            Aufbewahrungsfristen
          </h3>
          <p className="text-sm text-muted-foreground">
            Gesetzliche und kanzleispezifische Fristen pro Datenkategorie.
            Gesperrte Kategorien unterliegen der gesetzlichen
            Aufbewahrungspflicht und werden nicht automatisch gelöscht.
          </p>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">
                  Datenkategorie
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Aufbewahrungsfrist
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  Rechtsgrundlage
                </th>
                <th className="px-4 py-3 text-left font-medium">Gesperrt</th>
                <th className="px-4 py-3 text-right font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {policiesLoading ? (
                ["s1", "s2", "s3"].map((sk) => (
                  <tr
                    key={sk}
                    data-ocid="loeschkonzept.retention.loading_state"
                    className="border-b border-border"
                  >
                    {["c1", "c2", "c3", "c4", "c5"].map((ck) => (
                      <td key={ck} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div
                      data-ocid="loeschkonzept.retention.empty_state"
                      className="flex flex-col items-center py-12 gap-3"
                    >
                      <FileText size={28} className="text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Keine Aufbewahrungsfristen erfasst.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                policies.map((p, idx) => (
                  <tr
                    key={p.id}
                    data-ocid={`loeschkonzept.retention.row.${idx + 1}`}
                    className="border-b border-border hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {p.categoryName}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {String(p.retentionYears)} Jahre
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.legalBasis ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {p.isLocked ? (
                        <span
                          data-ocid={`loeschkonzept.retention.locked_badge.${idx + 1}`}
                          className="badge-danger"
                        >
                          <Lock size={12} />
                          Gesperrt
                        </span>
                      ) : (
                        <span
                          data-ocid={`loeschkonzept.retention.unlocked_badge.${idx + 1}`}
                          className="badge-success"
                        >
                          <LockOpen size={12} />
                          Frei
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs gap-1.5"
                        data-ocid={`loeschkonzept.retention.edit_button.${idx + 1}`}
                        onClick={() => openEditPolicy(p)}
                      >
                        Bearbeiten
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 2: Fällige Löschungen ───────────────────────────────── */}
      <section data-ocid="loeschkonzept.deletions_section">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-foreground text-lg">
              Fällige Löschungen
            </h3>
            <p className="text-sm text-muted-foreground">
              Datensätze deren Aufbewahrungsfrist abgelaufen ist. Die Löschung
              wird manuell ausgelöst.
            </p>
          </div>
        </div>

        <div
          data-ocid="loeschkonzept.deletions.note"
          className="mb-4 rounded-md border border-border bg-muted/40 px-4 py-3 flex items-start gap-2.5 text-sm text-muted-foreground"
        >
          <Info size={16} className="mt-0.5 shrink-0 text-info" />
          <span>
            Hinweis: Gesperrte Kategorien (gesetzliche Aufbewahrungspflicht)
            werden hier nicht angezeigt. Die Löschung erfolgt manuell — es
            findet keine automatische Löschung statt.
          </span>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Kategorie</th>
                <th className="px-4 py-3 text-left font-medium">
                  Datensatz-ID
                </th>
                <th className="px-4 py-3 text-left font-medium">Fällig seit</th>
                <th className="px-4 py-3 text-right font-medium">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {deletionsLoading ? (
                ["s1", "s2", "s3"].map((sk) => (
                  <tr
                    key={sk}
                    data-ocid="loeschkonzept.deletions.loading_state"
                    className="border-b border-border"
                  >
                    {["c1", "c2", "c3", "c4"].map((ck) => (
                      <td key={ck} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pendingDeletions.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div
                      data-ocid="loeschkonzept.deletions.empty_state"
                      className="flex flex-col items-center py-12 gap-3"
                    >
                      <ShieldCheck size={28} className="text-success" />
                      <p className="text-sm text-muted-foreground">
                        Keine fälligen Löschungen.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pendingDeletions.map((del, idx) => {
                  const [categoryName, entityId, dueTs] = del;
                  return (
                    <tr
                      key={`${categoryName}-${entityId}`}
                      data-ocid={`loeschkonzept.deletions.row.${idx + 1}`}
                      className="border-b border-border hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {categoryName}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {entityId}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {formatTimestampNs(dueTs) || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          className="btn-success h-7 px-2 text-xs gap-1.5"
                          data-ocid={`loeschkonzept.deletions.delete_button.${idx + 1}`}
                          onClick={() =>
                            setConfirmDeletion({ categoryName, entityId })
                          }
                          disabled={executeDeletionMut.isPending}
                        >
                          <Trash2 size={12} />
                          Löschen
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 3: Datenschutzerklärung-Version ──────────────────────── */}
      <section data-ocid="loeschkonzept.dsg_section">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display font-semibold text-foreground text-lg">
              Datenschutzerklärung-Version
            </h3>
            <p className="text-sm text-muted-foreground">
              Aktuell veröffentlichte Version der Datenschutzerklärung, auf die
              Klienten bei der Registrierung einwilligen.
            </p>
          </div>
          <Button
            className="btn-primary shrink-0"
            data-ocid="loeschkonzept.dsg.new_version_button"
            onClick={openDsgDialog}
          >
            Neue Version erfassen
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          {dsgLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : dsgVersion ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="badge-info">
                  <FileText size={12} />
                  Version {dsgVersion.version}
                </span>
                <span className="text-xs text-muted-foreground">
                  Veröffentlicht am{" "}
                  {formatTimestampNs(dsgVersion.publishedAt) || "—"}
                </span>
              </div>
              {dsgVersion.content ? (
                <p className="text-sm text-foreground whitespace-pre-line line-clamp-6">
                  {dsgVersion.content}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Kein Inhalt hinterlegt.
                </p>
              )}
            </div>
          ) : (
            <div
              data-ocid="loeschkonzept.dsg.empty_state"
              className="flex flex-col items-center py-8 gap-3"
            >
              <FileText size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Noch keine Datenschutzerklärung erfasst.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Einwilligungen ───────────────────────────────────── */}
      <section data-ocid="loeschkonzept.consent_section">
        <div className="mb-4">
          <h3 className="font-display font-semibold text-foreground text-lg">
            Einwilligungen
          </h3>
          <p className="text-sm text-muted-foreground">
            Übersicht über die erteilten Einwilligungen der Klienten in die
            aktuelle Datenschutzerklärung.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ConsentCard
            dataOcid="loeschkonzept.consent.total_card"
            label="Klienten mit Einwilligung"
            value={consentGiven}
            loading={consentLoading}
            icon={<CheckCircle2 size={18} className="text-success" />}
            tone="success"
          />
          <ConsentCard
            dataOcid="loeschkonzept.consent.missing_card"
            label="Fehlende Einwilligung"
            value={consentMissing}
            loading={consentLoading}
            icon={<XCircle size={18} className="text-danger" />}
            tone="danger"
          />
          <ConsentCard
            dataOcid="loeschkonzept.consent.total_records_card"
            label="Einwilligungen gesamt"
            value={consentRecords.length}
            loading={consentLoading}
            icon={<FileText size={18} className="text-info" />}
            tone="info"
          />
        </div>
      </section>

      {/* ── Edit retention policy dialog ───────────────────────────────── */}
      <Dialog
        open={!!editPolicy}
        onOpenChange={(open) => !open && setEditPolicy(null)}
      >
        <DialogContent
          data-ocid="loeschkonzept.retention_edit.modal"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>Aufbewahrungsfrist bearbeiten</DialogTitle>
            <DialogDescription>
              {editPolicy?.categoryName
                ? `Kategorie: ${editPolicy.categoryName}`
                : "Frist und Sperrstatus anpassen."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="retention-years">
                Aufbewahrungsfrist (Jahre)
              </Label>
              <Input
                id="retention-years"
                type="number"
                min={0}
                inputMode="numeric"
                data-ocid="loeschkonzept.retention_edit.years_input"
                value={editPolicy?.retentionYears ?? ""}
                onChange={(e) =>
                  setEditPolicy((prev) =>
                    prev ? { ...prev, retentionYears: e.target.value } : prev,
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Gemäss OR 953a beträgt die gesetzliche Frist 10 Jahre.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {editPolicy?.isLocked ? (
                    <Lock size={14} className="text-danger" />
                  ) : (
                    <Unlock size={14} className="text-success" />
                  )}
                  Gesetzliche Sperrung
                </div>
                <p className="text-xs text-muted-foreground">
                  Gesperrte Kategorien werden nicht in fällige Löschungen
                  aufgenommen.
                </p>
              </div>
              <Switch
                data-ocid="loeschkonzept.retention_edit.locked_switch"
                checked={editPolicy?.isLocked ?? false}
                onCheckedChange={(checked) =>
                  setEditPolicy((prev) =>
                    prev ? { ...prev, isLocked: checked } : prev,
                  )
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              data-ocid="loeschkonzept.retention_edit.cancel_button"
              onClick={() => setEditPolicy(null)}
            >
              Abbrechen
            </Button>
            <Button
              className="btn-primary"
              data-ocid="loeschkonzept.retention_edit.save_button"
              onClick={handleSavePolicy}
              disabled={updatePolicyMut.isPending}
            >
              {updatePolicyMut.isPending ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm deletion dialog ────────────────────────────────────── */}
      <AlertDialog
        open={!!confirmDeletion}
        onOpenChange={(open) => !open && setConfirmDeletion(null)}
      >
        <AlertDialogContent
          data-ocid="loeschkonzept.deletion_confirm.modal"
          className="sm:max-w-md"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Löschung bestätigen</AlertDialogTitle>
            <AlertDialogDescription>
              Der Datensatz wird unwiderruflich gelöscht. Diese Aktion wird im
              Audit-Trail protokolliert.
              {confirmDeletion && (
                <span className="block mt-2 text-xs font-mono text-foreground">
                  Kategorie: {confirmDeletion.categoryName}
                  <br />
                  Datensatz-ID: {confirmDeletion.entityId}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="loeschkonzept.deletion_confirm.cancel_button">
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="btn-success"
              data-ocid="loeschkonzept.deletion_confirm.confirm_button"
              onClick={handleConfirmDeletion}
              disabled={executeDeletionMut.isPending}
            >
              {executeDeletionMut.isPending ? "Lösche…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── New DSG version dialog ─────────────────────────────────────── */}
      <Dialog open={dsgDialogOpen} onOpenChange={setDsgDialogOpen}>
        <DialogContent
          data-ocid="loeschkonzept.dsg_edit.modal"
          className="sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle>Neue Datenschutzerklärung-Version</DialogTitle>
            <DialogDescription>
              Erfassen Sie eine neue Version. Klienten müssen bei der
              Registrierung in diese Version einwilligen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dsg-version">Versionsnummer</Label>
              <Input
                id="dsg-version"
                placeholder="z. B. 2.0"
                data-ocid="loeschkonzept.dsg_edit.version_input"
                value={dsgVersionField}
                onChange={(e) => setDsgVersionField(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dsg-content">Inhalt</Label>
              <Textarea
                id="dsg-content"
                rows={6}
                placeholder="Volltext der Datenschutzerklärung…"
                data-ocid="loeschkonzept.dsg_edit.content_input"
                value={dsgContentField}
                onChange={(e) => setDsgContentField(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              data-ocid="loeschkonzept.dsg_edit.cancel_button"
              onClick={() => setDsgDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              className="btn-primary"
              data-ocid="loeschkonzept.dsg_edit.save_button"
              onClick={handleSaveDsg}
              disabled={updateDsgMut.isPending}
            >
              {updateDsgMut.isPending ? "Speichern…" : "Version erfassen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Consent summary card ───────────────────────────────────────────────────

interface ConsentCardProps {
  label: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  tone: "success" | "danger" | "info";
  dataOcid: string;
}

function ConsentCard({
  label,
  value,
  loading,
  icon,
  tone,
  dataOcid,
}: ConsentCardProps) {
  const toneClass =
    tone === "success"
      ? "border-success/30 bg-success/5"
      : tone === "danger"
        ? "border-danger/30 bg-danger/5"
        : "border-info/30 bg-info/5";

  return (
    <div
      data-ocid={dataOcid}
      className={`rounded-lg border ${toneClass} bg-card p-4 flex items-center gap-4`}
    >
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        {loading ? (
          <Skeleton className="h-7 w-12 mt-1" />
        ) : (
          <p className="font-display font-bold text-foreground text-2xl leading-tight">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
