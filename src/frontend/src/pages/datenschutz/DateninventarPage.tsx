import { Role } from "@/backend.d";
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
import type { DataInventoryEntry } from "@/types";
import { queryKeys, useBackend } from "@/utils/backend";
import { useDataInventory, useUpdateDataInventoryEntry } from "@/utils/backend";
import { useQuery } from "@tanstack/react-query";
import { Database, Loader2, Lock, Pencil, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// ─── Role display mapping (Swiss German) ────────────────────────────────────
const ROLE_LABELS: Record<Role, string> = {
  [Role.plattform_admin]: "Plattform-Admin",
  [Role.admin]: "Administrator",
  [Role.anwalt]: "Anwalt",
  [Role.mitarbeiter]: "Mitarbeiter",
  [Role.mandant]: "Mandant",
};

const ROLE_VALUES: Role[] = [
  Role.admin,
  Role.anwalt,
  Role.mitarbeiter,
  Role.mandant,
];

// ─── Edit form state ────────────────────────────────────────────────────────
interface EditFormState {
  id: string;
  categoryName: string;
  storageLocation: string;
  storageDuration: string;
  accessRole: Role;
  description: string;
}

function toEditState(entry: DataInventoryEntry): EditFormState {
  return {
    id: entry.id,
    categoryName: entry.categoryName,
    storageLocation: entry.storageLocation,
    storageDuration: entry.storageDuration,
    accessRole: entry.accessRole,
    description: entry.description ?? "",
  };
}

function buildEntryFromForm(
  entry: DataInventoryEntry,
  form: EditFormState,
): DataInventoryEntry {
  return {
    ...entry,
    storageLocation: form.storageLocation,
    storageDuration: form.storageDuration,
    accessRole: form.accessRole,
    description: form.description.trim() || undefined,
  };
}

// ─── Page ──────────────────────────────────────────────────────────────────
export function DateninventarPage() {
  const { actor, isLoading: actorLoading } = useBackend();

  // Admin-only soft guard: read current user, gate UI on isAdmin.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const isAdmin = currentUser?.isAdmin ?? false;

  const { data: inventory = [], isLoading: inventoryLoading } =
    useDataInventory(currentUser?.kanzleiId);

  const updateMut = useUpdateDataInventoryEntry();

  const [editState, setEditState] = useState<EditFormState | null>(null);
  const [open, setOpen] = useState(false);

  // Reset form state when dialog closes
  useEffect(() => {
    if (!open) setEditState(null);
  }, [open]);

  function handleOpenEdit(entry: DataInventoryEntry) {
    setEditState(toEditState(entry));
    setOpen(true);
  }

  function handleSave() {
    if (!editState) return;
    const original = inventory.find((e) => e.id === editState.id);
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
          toast.success("Eintrag aktualisiert");
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
        data-ocid="dateninventar.access_denied"
        className="flex flex-col items-center justify-center h-64 gap-4 px-6"
      >
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Lock size={28} className="text-destructive" />
        </div>
        <p className="font-semibold text-foreground">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          Das Dateninventar ist Teil der revDSG-Dokumentation und nur für
          Administratoren zugänglich.
        </p>
      </div>
    );
  }

  return (
    <div
      data-ocid="dateninventar.page"
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Header / Purpose ─────────────────────────────────────────────── */}
      <section
        data-ocid="dateninventar.header_section"
        className="bg-card border border-border rounded-lg p-6 shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database size={22} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-foreground text-xl tracking-tight">
                Dateninventar
              </h2>
              <span className="badge-info">
                <ShieldCheck size={12} />
                revDSG Art. 5
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              Das Dateninventar dokumentiert alle Kategorien personenbezogener
              Daten, die in der Kanzlei verarbeitet werden. Gemäss Art. 5 des
              revidierten Datenschutzgesetzes (revDSG) muss der Verantwortliche
              ein Verzeichnis der Verarbeitungstätigkeiten führen. Es umfasst
              Speicherort, Speicherdauer, zugriffsberechtigte Rolle und eine
              Beschreibung jeder Datenkategorie.
            </p>
          </div>
        </div>
      </section>

      {/* ── Inventory Table ──────────────────────────────────────────────── */}
      <section data-ocid="dateninventar.table_section">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-semibold text-foreground text-lg">
              Erfasste Datenkategorien
            </h3>
            <p className="text-sm text-muted-foreground">
              {inventory.length}{" "}
              {inventory.length === 1 ? "Eintrag" : "Einträge"} im Inventar
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">
                    Datenkategorie
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Speicherort
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Speicherdauer
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Zugriffsberechtigung
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    Beschreibung
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {inventoryLoading ? (
                  ["s1", "s2", "s3", "s4"].map((sk) => (
                    <tr
                      key={sk}
                      data-ocid="dateninventar.loading_state"
                      className="border-b border-border"
                    >
                      {["c1", "c2", "c3", "c4", "c5", "c6"].map((ck) => (
                        <td key={ck} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : inventory.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div
                        data-ocid="dateninventar.empty_state"
                        className="flex flex-col items-center py-16 gap-3"
                      >
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Database
                            size={22}
                            className="text-muted-foreground"
                          />
                        </div>
                        <p className="font-medium text-foreground">
                          Noch keine Datenkategorien erfasst
                        </p>
                        <p className="text-sm text-muted-foreground text-center max-w-md">
                          Das Inventar wird automatisch aus den
                          Verarbeitungstätigkeiten der Kanzlei befüllt.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  inventory.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      data-ocid={`dateninventar.row.${idx + 1}`}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">
                          {entry.categoryName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {entry.storageLocation}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {entry.storageDuration}
                      </td>
                      <td className="px-4 py-3">
                        <span className="badge-neutral">
                          {ROLE_LABELS[entry.accessRole] ?? entry.accessRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">
                        {entry.description ? (
                          <span
                            className="line-clamp-2"
                            title={entry.description}
                          >
                            {entry.description}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          data-ocid={`dateninventar.edit_button.${idx + 1}`}
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
          data-ocid="dateninventar.edit_dialog"
          className="sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Eintrag bearbeiten
            </DialogTitle>
            <DialogDescription>
              {editState
                ? `Datenkategorie «${editState.categoryName}» bearbeiten.`
                : "Datenkategorie bearbeiten."}
            </DialogDescription>
          </DialogHeader>

          {editState && (
            <div className="space-y-4">
              {/* Speicherort */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-storage-location">Speicherort</Label>
                <Input
                  id="edit-storage-location"
                  data-ocid="dateninventar.storage_location.input"
                  value={editState.storageLocation}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      storageLocation: e.target.value,
                    })
                  }
                  placeholder="z. B. Lokal, Cloud, Aktenarchiv"
                />
              </div>

              {/* Speicherdauer */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-storage-duration">Speicherdauer</Label>
                <Input
                  id="edit-storage-duration"
                  data-ocid="dateninventar.storage_duration.input"
                  value={editState.storageDuration}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      storageDuration: e.target.value,
                    })
                  }
                  placeholder="z. B. 10 Jahre, bis Mandatsende"
                />
              </div>

              {/* Zugriffsberechtigung (Role) */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-access-role">Zugriffsberechtigung</Label>
                <Select
                  value={editState.accessRole}
                  onValueChange={(value) =>
                    setEditState({
                      ...editState,
                      accessRole: value as Role,
                    })
                  }
                >
                  <SelectTrigger
                    id="edit-access-role"
                    data-ocid="dateninventar.access_role.select"
                    className="w-full"
                  >
                    <SelectValue placeholder="Rolle wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_VALUES.map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        data-ocid={`dateninventar.access_role.option.${role}`}
                      >
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Beschreibung */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Textarea
                  id="edit-description"
                  data-ocid="dateninventar.description.input"
                  value={editState.description}
                  onChange={(e) =>
                    setEditState({
                      ...editState,
                      description: e.target.value,
                    })
                  }
                  placeholder="Kurze Beschreibung der Datenkategorie"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              data-ocid="dateninventar.cancel_button"
              onClick={() => setOpen(false)}
              disabled={updateMut.isPending}
            >
              Abbrechen
            </Button>
            <Button
              data-ocid="dateninventar.save_button"
              onClick={handleSave}
              disabled={
                updateMut.isPending ||
                !editState ||
                !editState.storageLocation.trim() ||
                !editState.storageDuration.trim()
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
