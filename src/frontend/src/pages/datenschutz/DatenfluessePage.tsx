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
import type { DataFlowEntry } from "@/types";
import { queryKeys, useBackend } from "@/utils/backend";
import { useDataFlows, useUpdateDataFlowEntry } from "@/utils/backend";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ExternalLink,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Edit form state ────────────────────────────────────────────────────────
interface EditFormState {
  id: string;
  flowName: string;
  what: string;
  destination: string;
  purpose: string;
  legalBasis: string;
  isExternal: boolean;
}

function toEditState(entry: DataFlowEntry): EditFormState {
  return {
    id: entry.id,
    flowName: entry.flowName,
    what: entry.what,
    destination: entry.destination,
    purpose: entry.purpose,
    legalBasis: entry.legalBasis,
    isExternal: entry.isExternal,
  };
}

function buildEntryFromForm(
  entry: DataFlowEntry,
  form: EditFormState,
): DataFlowEntry {
  return {
    ...entry,
    flowName: form.flowName.trim(),
    what: form.what.trim(),
    destination: form.destination.trim(),
    purpose: form.purpose.trim(),
    legalBasis: form.legalBasis.trim(),
    isExternal: form.isExternal,
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────
export function DatenfluessePage() {
  const { actor, isLoading: actorLoading } = useBackend();

  // Admin-only soft guard: read current user, gate UI on isAdmin.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const isAdmin = currentUser?.isAdmin ?? false;

  const { data: flows = [], isLoading: flowsLoading } = useDataFlows(
    currentUser?.kanzleiId,
  );

  const updateMut = useUpdateDataFlowEntry();

  const [editState, setEditState] = useState<EditFormState | null>(null);
  const [open, setOpen] = useState(false);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) setEditState(null);
  }, [open]);

  function handleOpenEdit(entry: DataFlowEntry) {
    setEditState(toEditState(entry));
    setOpen(true);
  }

  function handleSave() {
    if (!editState) return;
    const original = flows.find((e) => e.id === editState.id);
    if (!original) {
      toast.error("Eintrag nicht gefunden");
      return;
    }
    const updated = buildEntryFromForm(original, editState);
    updateMut.mutate(
      { id: editState.id, entry: updated },
      {
        onSuccess: (res) => {
          if (res && typeof res === "object" && "__kind__" in res) {
            if (res.__kind__ === "err") {
              toast.error((res as { err: string }).err);
              return;
            }
          }
          toast.success("Datenfluss aktualisiert");
          setOpen(false);
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  }

  // ── Admin guard ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div
        data-ocid="datenfluesse.access_denied"
        className="flex flex-col items-center justify-center h-64 gap-4 px-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Lock size={28} className="text-destructive" />
        </div>
        <p className="font-semibold text-foreground">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Die Datenfluss-Dokumentation ist Teil der revDSG-Transparenzpflichten
          und nur für Administratoren zugänglich.
        </p>
      </div>
    );
  }

  return (
    <div
      data-ocid="datenfluesse.page"
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Header / Purpose ─────────────────────────────────────────────── */}
      <section
        data-ocid="datenfluesse.header_section"
        className="bg-card border border-border rounded-lg p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Workflow size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-foreground text-xl tracking-tight">
                Datenflüsse
              </h2>
              <span className="badge-info">
                <ShieldCheck size={12} />
                revDSG Art. 5 & 8
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              Diese Übersicht dokumentiert alle Weitergaben personenbezogener
              Daten gemäss den Transparenzpflichten des revidierten
              Datenschutzgesetzes (revDSG). Externe Datenflüsse — etwa an
              OpenAI, Bexio, E-Mail-Dienstleister oder Caffeine File Storage —
              sind besonders relevant, da hier eine Weitergabe an Drittländer
              oder Auftragsverarbeiter vorliegen kann. Für jeden Datenfluss muss
              die Rechtsgrundlage (z. B. Einwilligung, Vertragserfüllung,
              gesetzliche Aufbewahrungspflicht) ausgewiesen sein.
            </p>
          </div>
        </div>
      </section>

      {/* ── Flows Table ──────────────────────────────────────────────────── */}
      <section data-ocid="datenfluesse.table_section">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-foreground text-lg">
              Erfasste Datenflüsse
            </h3>
            <p className="text-sm text-muted-foreground">
              {flows.length} {flows.length === 1 ? "Datenfluss" : "Datenflüsse"}{" "}
              dokumentiert
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">
                    Datenfluss
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Was</th>
                  <th className="px-4 py-3 text-left font-medium">Wohin</th>
                  <th className="px-4 py-3 text-left font-medium">Zweck</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Rechtsgrundlage
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Intern/Extern
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {flowsLoading ? (
                  ["s1", "s2", "s3", "s4"].map((sk) => (
                    <tr
                      key={sk}
                      data-ocid="datenfluesse.loading_state"
                      className="border-b border-border"
                    >
                      {["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((ck) => (
                        <td key={ck} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : flows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div
                        data-ocid="datenfluesse.empty_state"
                        className="flex flex-col items-center py-16 gap-3"
                      >
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Workflow
                            size={22}
                            className="text-muted-foreground"
                          />
                        </div>
                        <p className="font-medium text-foreground">
                          Noch keine Datenflüsse erfasst
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                          Datenflüsse werden automatisch aus den
                          Verarbeitungstätigkeiten der Kanzlei befüllt. Externe
                          Weitergaben (OpenAI, Bexio, E-Mail, Caffeine File
                          Storage) erscheinen hier mit ihrer Rechtsgrundlage.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  flows.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      data-ocid={`datenfluesse.row.${idx + 1}`}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {entry.flowName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground max-w-xs">
                        <span className="line-clamp-2" title={entry.what}>
                          {entry.what}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          {entry.isExternal && (
                            <ExternalLink
                              size={13}
                              className="text-muted-foreground flex-shrink-0"
                            />
                          )}
                          <span
                            className="line-clamp-1"
                            title={entry.destination}
                          >
                            {entry.destination}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <span className="line-clamp-2" title={entry.purpose}>
                          {entry.purpose}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        <span className="line-clamp-2" title={entry.legalBasis}>
                          {entry.legalBasis}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.isExternal ? (
                          <span
                            className="badge-warning"
                            data-ocid={`datenfluesse.external_badge.${idx + 1}`}
                          >
                            <ArrowRight size={12} />
                            Extern
                          </span>
                        ) : (
                          <span
                            className="badge-info"
                            data-ocid={`datenfluesse.internal_badge.${idx + 1}`}
                          >
                            Intern
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          data-ocid={`datenfluesse.edit_button.${idx + 1}`}
                          onClick={() => handleOpenEdit(entry)}
                        >
                          <Pencil size={13} />
                          Eintrag bearbeiten
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          data-ocid="datenfluesse.edit_dialog"
          className="sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Datenfluss bearbeiten
            </DialogTitle>
            <DialogDescription>
              {editState
                ? `Datenfluss «${editState.flowName}» bearbeiten.`
                : "Datenfluss bearbeiten."}
            </DialogDescription>
          </DialogHeader>

          {editState && (
            <div className="space-y-4">
              {/* Datenfluss (flowName) */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-flow-name">Datenfluss</Label>
                <Input
                  id="edit-flow-name"
                  data-ocid="datenfluesse.flow_name.input"
                  value={editState.flowName}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      flowName: e.target.value,
                    })
                  }
                  placeholder="z. B. KI-gestützte Dokumentanalyse"
                />
              </div>

              {/* Was */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-what">Was</Label>
                <Textarea
                  id="edit-what"
                  data-ocid="datenfluesse.what.input"
                  value={editState.what}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      what: e.target.value,
                    })
                  }
                  placeholder="Welche Daten werden übermittelt, z. B. Mandantendokumente, Namen, Adressen"
                  rows={2}
                />
              </div>

              {/* Wohin */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-destination">Wohin</Label>
                <Input
                  id="edit-destination"
                  data-ocid="datenfluesse.destination.input"
                  value={editState.destination}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      destination: e.target.value,
                    })
                  }
                  placeholder="z. B. OpenAI API, Bexio, E-Mail-Provider, Caffeine File Storage"
                />
              </div>

              {/* Zweck */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-purpose">Zweck</Label>
                <Textarea
                  id="edit-purpose"
                  data-ocid="datenfluesse.purpose.input"
                  value={editState.purpose}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      purpose: e.target.value,
                    })
                  }
                  placeholder="Zweck der Weitergabe, z. B. juristische Auswertung, Buchhaltung"
                  rows={2}
                />
              </div>

              {/* Rechtsgrundlage */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-legal-basis">Rechtsgrundlage</Label>
                <Input
                  id="edit-legal-basis"
                  data-ocid="datenfluesse.legal_basis.input"
                  value={editState.legalBasis}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      legalBasis: e.target.value,
                    })
                  }
                  placeholder="z. B. Einwilligung Art. 6 Abs. 1 DSG, Vertragserfüllung, gesetzliche Aufbewahrung"
                />
              </div>

              {/* Intern/Extern */}
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-3">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="edit-is-external"
                    className="text-sm font-medium"
                  >
                    Externe Weitergabe
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Aktivieren, wenn Daten an einen externen Empfänger oder
                    Auftragsverarbeiter weitergegeben werden.
                  </p>
                </div>
                <Switch
                  id="edit-is-external"
                  data-ocid="datenfluesse.is_external.switch"
                  checked={editState.isExternal}
                  onCheckedChange={(checked) =>
                    setEditState({
                      ...editState,
                      isExternal: checked,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              data-ocid="datenfluesse.cancel_button"
              onClick={() => setOpen(false)}
              disabled={updateMut.isPending}
            >
              Abbrechen
            </Button>
            <Button
              data-ocid="datenfluesse.save_button"
              onClick={handleSave}
              disabled={
                updateMut.isPending ||
                !editState ||
                !editState.flowName.trim() ||
                !editState.what.trim() ||
                !editState.destination.trim() ||
                !editState.purpose.trim() ||
                !editState.legalBasis.trim()
              }
            >
              {updateMut.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <ShieldCheck size={15} />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
