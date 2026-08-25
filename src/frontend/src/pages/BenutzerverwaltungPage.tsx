import type { InviteToken, Leistungserbringer } from "@/backend.d";
import { Role } from "@/backend.d";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { Badge } from "@/components/ui/badge";
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
import {
  queryKeys,
  useBackend,
  useDeleteLeistungserbringer,
  useGetMyRole,
  useIsSuperAdmin,
  useMigrateRoles,
  useUpdateUserRole,
} from "@/utils/backend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Check,
  ClipboardCopy,
  Link2,
  Loader2,
  Mail,
  Pencil,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AktiveBenutzerView } from "./AktiveBenutzerPage";
import { PlattformAdminAktiveBenutzerView } from "./PlattformAdminPage";

interface EditState {
  userId: string;
  vorname: string;
  nachname: string;
  titel: string;
}

// ─── Tab-Schlüssel ────────────────────────────────────────────────────────────

type TabKey = "benutzerverwaltung" | "aktive-benutzer";

const TAB_BENUTZERVERWALTUNG: TabKey = "benutzerverwaltung";
const TAB_AKTIVE_BENUTZER: TabKey = "aktive-benutzer";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: TAB_BENUTZERVERWALTUNG, label: "Benutzerverwaltung" },
  { key: TAB_AKTIVE_BENUTZER, label: "Aktive Benutzer" },
];

function isTabKey(value: string | null): value is TabKey {
  return value === TAB_BENUTZERVERWALTUNG || value === TAB_AKTIVE_BENUTZER;
}

// ─── Role helpers ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<Role, string> = {
  [Role.admin]: "Admin",
  [Role.anwalt]: "Anwalt",
  [Role.mitarbeiter]: "Mitarbeiter",
  [Role.mandant]: "Mandant",
  [Role.plattform_admin]: "Plattform-Admin",
};

/**
 * getAssignableRoles — Rollen, die ein Aufrufer mit der gegebenen Rolle
 * vergeben darf. plattform_admin darf alle 5 Rollen vergeben; admin darf
 * admin/anwalt/mitarbeiter/mandant vergeben (NICHT plattform_admin); alle
 * anderen Rollen dürfen nichts vergeben (read-only / leer).
 */
function getAssignableRoles(callerRole: Role | null): Role[] {
  if (callerRole === Role.plattform_admin) {
    return [
      Role.plattform_admin,
      Role.admin,
      Role.anwalt,
      Role.mitarbeiter,
      Role.mandant,
    ];
  }
  if (callerRole === Role.admin) {
    return [Role.admin, Role.anwalt, Role.mitarbeiter, Role.mandant];
  }
  return [];
}

/**
 * deriveRole — if the user has an explicit role, use it; otherwise derive
 * from the legacy isAdmin flag (isAdmin=true → Admin, else → Anwalt).
 */
function deriveRole(user: Leistungserbringer): Role {
  if (user.role) return user.role;
  return user.isAdmin ? Role.admin : Role.anwalt;
}

/** Tailwind classes for each role badge — distinct, accessible colors. */
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
 * maskRole — blendet die Rolle `plattform_admin` für Nicht-Plattform-Admins
 * als `admin` aus (Rollenausblendung in der UI). Plattform-Admins sehen die
 * echte Rolle; alle anderen Admins sehen „Admin" für plattform_admin-Benutzer,
 * sodass die Plattform-Admin-Rolle in anderen Kanzleien nicht sichtbar ist.
 * Alle anderen Rollen werden unverändert durchgereicht.
 */
function maskRole(role: Role, viewerIsPlattformAdmin: boolean): Role {
  if (role === Role.plattform_admin && !viewerIsPlattformAdmin) {
    return Role.admin;
  }
  return role;
}

function RoleBadge({
  role,
  viewerIsPlattformAdmin = true,
}: {
  role: Role;
  viewerIsPlattformAdmin?: boolean;
}) {
  const displayed = maskRole(role, viewerIsPlattformAdmin);
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${ROLE_BADGE_CLASS[displayed]}`}
    >
      {ROLE_LABELS[displayed]}
    </Badge>
  );
}

// ─── Tab 1: Benutzerverwaltung (bestehende Logik, unverändert) ────────────────

function BenutzerverwaltungView() {
  const { actor, isLoading: actorLoading } = useBackend();
  const qc = useQueryClient();
  const { data: isSuperAdmin = false } = useIsSuperAdmin();
  const { data: myRole = null } = useGetMyRole();

  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [copied, setCopied] = useState(false);
  const [roleEditUserId, setRoleEditUserId] = useState<string | null>(null);
  const [roleEditValue, setRoleEditValue] = useState<Role | null>(null);
  const [migrateOpen, setMigrateOpen] = useState(false);
  // Ziel-Benutzer für den physischen Lösch-Modal (null = Modal geschlossen).
  // Deaktivieren bleibt eine direkte Aktion ohne Modal (bestehendes Verhalten).
  const [deleteTarget, setDeleteTarget] = useState<Leistungserbringer | null>(
    null,
  );

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: queryKeys.leistungserbringer(),
    queryFn: async (): Promise<Leistungserbringer[]> =>
      actor ? actor.getLeistungserbringer() : [],
    enabled: !!actor && !actorLoading,
  });

  const { data: inviteLinks = [], isLoading: invitesLoading } = useQuery({
    queryKey: ["inviteLinks"],
    queryFn: async (): Promise<InviteToken[]> =>
      actor ? actor.getInviteLinks() : [],
    enabled: !!actor && !actorLoading,
  });

  const isAdmin = currentUser?.isAdmin ?? false;

  // Effektive Aufrufer-Rolle: explizite Rolle falls vorhanden, sonst Fallback
  // aus Legacy-Flags (isSuperAdmin → plattform_admin, isAdmin → admin, sonst
  // mitarbeiter). Bestimmt, welche Rollen im Editor vergeben werden dürfen.
  const callerRole: Role | null = myRole
    ? myRole
    : isSuperAdmin
      ? Role.plattform_admin
      : isAdmin
        ? Role.admin
        : Role.mitarbeiter;
  const assignableRoles = getAssignableRoles(callerRole);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createInviteMut = useMutation({
    mutationFn: async (email: string) => {
      if (!actor) throw new Error("Kein Actor");
      const res = await actor.createInviteLink(email);
      if (res.__kind__ === "err") throw new Error(res.err);
      return res.ok;
    },
    onSuccess: (token) => {
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const link = `${baseUrl}/registrierung?invite=${token}&email=${encodeURIComponent(inviteEmail)}`;
      setGeneratedLink(link);
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["inviteLinks"] });
      toast.success("Einladungslink erstellt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateUserMut = useMutation({
    mutationFn: async (state: EditState) => {
      if (!actor) throw new Error("Kein Actor");
      const user = users.find((u) => u.id.toString() === state.userId);
      if (!user) throw new Error("Benutzer nicht gefunden");
      const res = await actor.updateLeistungserbringer(
        user.id,
        state.vorname,
        state.nachname,
        state.titel,
      );
      if (res.__kind__ === "err") throw new Error(res.err);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leistungserbringer() });
      toast.success("Benutzer aktualisiert");
      setEditState(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUserMut = useMutation({
    mutationFn: async (userId: string) => {
      if (!actor) throw new Error("Kein Actor");
      const user = users.find((u) => u.id.toString() === userId);
      if (!user) throw new Error("Benutzer nicht gefunden");
      const res = await actor.removeLeistungserbringer(user.id);
      if (res.__kind__ === "err") throw new Error(res.err);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leistungserbringer() });
      toast.success("Benutzer deaktiviert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Physische Löschung — unwiderruflich. Öffnet den Bestätigungs-Modal,
  // erst nach Bestätigung wird deleteLeistungserbringer aufgerufen. Die
  // Mutation invalidiert den leistungserbringer-Query (siehe useDeleteLeistungserbringer),
  // sodass die Tabelle nach Erfolg automatisch refetcht. Das Modal wird im
  // onSuccess hier geschlossen, damit es während des laufenden Requests
  // sichtbar bleibt (Loading-State im Bestätigen-Button).
  const deleteUserMut = useDeleteLeistungserbringer();
  const deleteUserWrapped = useMutation({
    mutationFn: async (userId: string) => {
      return deleteUserMut.mutateAsync(userId);
    },
    onSuccess: () => {
      setDeleteTarget(null);
      toast.success("Benutzer unwiderruflich gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Role management mutations ──────────────────────────────────────────────
  const updateUserRoleMut = useUpdateUserRole();
  const updateUserRoleWrapped = useMutation({
    mutationFn: async (args: { principal: string; newRole: Role }) => {
      const res = await updateUserRoleMut.mutateAsync(args);
      if (
        res &&
        typeof res === "object" &&
        "__kind__" in res &&
        res.__kind__ === "err"
      ) {
        throw new Error((res as unknown as { err: string }).err);
      }
      return res;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.leistungserbringer() });
      qc.invalidateQueries({
        queryKey: queryKeys.userRole(variables.principal),
      });
      toast.success(`Rolle auf „${ROLE_LABELS[variables.newRole]}“ geändert`);
      setRoleEditUserId(null);
      setRoleEditValue(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const migrateRolesMut = useMigrateRoles();
  const migrateRolesWrapped = useMutation({
    mutationFn: async () => {
      const res = await migrateRolesMut.mutateAsync();
      if (
        res &&
        typeof res === "object" &&
        "__kind__" in res &&
        res.__kind__ === "err"
      ) {
        throw new Error((res as unknown as { err: string }).err);
      }
      return res;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.leistungserbringer() });
      qc.invalidateQueries({ queryKey: ["superAdmin"] });
      const summary = data as
        | { convertedCount?: bigint; unchangedCount?: bigint }
        | undefined;
      const converted =
        summary?.convertedCount !== undefined
          ? Number(summary.convertedCount)
          : null;
      const unchanged =
        summary?.unchangedCount !== undefined
          ? Number(summary.unchangedCount)
          : null;
      if (converted !== null && unchanged !== null) {
        toast.success(
          `Rollenumigration abgeschlossen: ${converted} konvertiert, ${unchanged} unverändert`,
        );
      } else {
        toast.success("Rollenumigration abgeschlossen");
      }
      setMigrateOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleCopyLink(link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link in Zwischenablage kopiert");
    });
  }

  function buildInviteUrl(token: string, email: string): string {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/registrierung?invite=${token}&email=${encodeURIComponent(email)}`;
  }

  function openRoleEditor(user: Leistungserbringer) {
    setRoleEditUserId(user.id.toString());
    // Maskiere plattform_admin → admin für Nicht-Plattform-Admins, damit der
    // Editor die sichtbare (maskierte) Rolle als Startwert zeigt. Da
    // getAssignableRoles für admin-Aufrufer plattform_admin nicht enthält,
    // kann ein Nicht-Plattform-Admin die Rolle ohnehin nicht auf
    // plattform_admin setzen — der Startwert muss aber mit der angezeigten
    // Rolle übereinstimmen, sonst würde der Editor eine Rolle anzeigen, die
    // in der Auswahlliste nicht enthalten ist.
    const realRole = deriveRole(user);
    const startRole = maskRole(realRole, isSuperAdmin);
    setRoleEditValue(startRole);
  }

  function handleRoleChange(userId: string, newRole: Role) {
    updateUserRoleWrapped.mutate({ principal: userId, newRole });
  }

  // Zugriff nur für abgeleitete Admin-Rollen (admin ODER plattform_admin).
  // Ein reiner isAdmin-Check würde plattform_admins blockieren, die aus einer
  // Nicht-Admin-Rolle hochgestuft wurden (isAdmin bleibt dort false).
  if (callerRole !== Role.admin && callerRole !== Role.plattform_admin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Users size={28} className="text-destructive" />
        </div>
        <p className="font-semibold text-foreground">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground">
          Nur Administratoren können die Benutzerverwaltung aufrufen.
        </p>
      </div>
    );
  }

  return (
    <div
      data-ocid="benutzerverwaltung.view"
      className="space-y-8 max-w-4xl mx-auto"
    >
      {/* ── User Table ───────────────────────────────────────────────────── */}
      <section data-ocid="benutzerverwaltung.users_section">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold text-foreground text-lg">
              Leistungserbringer
            </h2>
            <p className="text-sm text-muted-foreground">
              Alle Mitglieder dieser Kanzlei
            </p>
          </div>
          {isSuperAdmin && (
            <Button
              variant="outline"
              className="gap-2"
              data-ocid="benutzerverwaltung.migrate_roles_button"
              onClick={() => setMigrateOpen(true)}
            >
              <RefreshCw size={15} />
              Rollen migrieren
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                <th className="px-4 py-3 text-left font-medium">Rolle</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading ? (
                ["s1", "s2", "s3"].map((sk) => (
                  <tr
                    key={sk}
                    data-ocid="benutzerverwaltung.loading_state"
                    className="border-b border-border"
                  >
                    {["c1", "c2", "c3", "c4", "c5"].map((ck) => (
                      <td key={ck} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div
                      data-ocid="benutzerverwaltung.empty_state"
                      className="flex flex-col items-center py-12 gap-3"
                    >
                      <Users size={28} className="text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Keine Benutzer gefunden.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, idx) => {
                  const userId = user.id.toString();
                  const isSelf = currentUser?.id.toString() === userId;
                  const isEditing = editState?.userId === userId;
                  const isInactive = user.status === "inaktiv";

                  return (
                    <tr
                      key={userId}
                      data-ocid={`benutzerverwaltung.item.${idx + 1}`}
                      className={`border-b border-border hover:bg-muted/30 transition-colors ${
                        isInactive ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <Input
                              value={editState.vorname}
                              onChange={(e) =>
                                setEditState({
                                  ...editState,
                                  vorname: e.target.value,
                                })
                              }
                              className="h-7 text-xs w-24"
                              placeholder="Vorname"
                              data-ocid="benutzerverwaltung.vorname_input"
                            />
                            <Input
                              value={editState.nachname}
                              onChange={(e) =>
                                setEditState({
                                  ...editState,
                                  nachname: e.target.value,
                                })
                              }
                              className="h-7 text-xs w-24"
                              placeholder="Nachname"
                              data-ocid="benutzerverwaltung.nachname_input"
                            />
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-foreground">
                              {user.titel && user.titel !== "—"
                                ? `${user.titel} `
                                : ""}
                              {user.vorname} {user.nachname}
                            </span>
                            {isSelf && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (Sie)
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="px-4 py-3">
                        {roleEditUserId === userId ? (
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={roleEditValue ?? undefined}
                              onValueChange={(v) => setRoleEditValue(v as Role)}
                            >
                              <SelectTrigger
                                className="h-7 w-32 text-xs"
                                data-ocid={`benutzerverwaltung.role_select.${idx + 1}`}
                              >
                                <SelectValue placeholder="Rolle wählen" />
                              </SelectTrigger>
                              <SelectContent>
                                {assignableRoles.map((r) => (
                                  <SelectItem
                                    key={r}
                                    value={r}
                                    className="text-xs"
                                  >
                                    {ROLE_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              className="btn-success h-7 w-7 p-0"
                              data-ocid={`benutzerverwaltung.role_save_button.${idx + 1}`}
                              onClick={() =>
                                roleEditValue &&
                                handleRoleChange(userId, roleEditValue)
                              }
                              disabled={
                                updateUserRoleWrapped.isPending ||
                                !roleEditValue
                              }
                            >
                              {updateUserRoleWrapped.isPending ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              data-ocid={`benutzerverwaltung.role_cancel_button.${idx + 1}`}
                              onClick={() => {
                                setRoleEditUserId(null);
                                setRoleEditValue(null);
                              }}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        ) : isSelf &&
                          isSuperAdmin &&
                          user.role === Role.plattform_admin ? (
                          // Plattform-Admin sieht die eigene Rolle read-only —
                          // nicht änderbar, nicht in anderen Kanzleien sichtbar.
                          <Badge
                            variant="outline"
                            data-ocid={`benutzerverwaltung.role_badge.${idx + 1}`}
                            className={`text-xs font-medium ${ROLE_BADGE_CLASS[Role.plattform_admin]}`}
                          >
                            {ROLE_LABELS[Role.plattform_admin]}
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            data-ocid={`benutzerverwaltung.role_badge.${idx + 1}`}
                            onClick={() => openRoleEditor(user)}
                            className="inline-flex items-center gap-1.5 rounded-md hover:bg-muted/60 px-1 -mx-1 py-0.5 transition-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            title="Rolle ändern"
                          >
                            <RoleBadge
                              role={deriveRole(user)}
                              viewerIsPlattformAdmin={isSuperAdmin}
                            />
                            <Pencil
                              size={11}
                              className="text-muted-foreground"
                            />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isInactive ? (
                          <Badge
                            variant="outline"
                            data-ocid={`benutzerverwaltung.status_badge.${idx + 1}`}
                            className="text-xs badge-neutral"
                          >
                            Inaktiv
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            data-ocid={`benutzerverwaltung.status_badge.${idx + 1}`}
                            className="text-xs badge-success"
                          >
                            Aktiv
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                className="btn-success h-7 px-2 text-xs gap-1"
                                data-ocid="benutzerverwaltung.save_button"
                                onClick={() => updateUserMut.mutate(editState)}
                                disabled={updateUserMut.isPending}
                              >
                                {updateUserMut.isPending ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Check size={12} />
                                )}
                                Speichern
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                data-ocid="benutzerverwaltung.cancel_button"
                                onClick={() => setEditState(null)}
                              >
                                <X size={12} />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                data-ocid={`benutzerverwaltung.edit_button.${idx + 1}`}
                                onClick={() =>
                                  setEditState({
                                    userId,
                                    vorname: user.vorname,
                                    nachname: user.nachname,
                                    titel: user.titel,
                                  })
                                }
                              >
                                <Pencil size={14} />
                              </Button>
                              {!isSelf && !isInactive && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                    data-ocid={`benutzerverwaltung.deactivate_button.${idx + 1}`}
                                    onClick={() => removeUserMut.mutate(userId)}
                                    disabled={removeUserMut.isPending}
                                    title="Benutzer deaktivieren"
                                    aria-label="Benutzer deaktivieren"
                                  >
                                    {removeUserMut.isPending ? (
                                      <Loader2
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Ban size={14} />
                                    )}
                                    Deaktivieren
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    data-ocid={`benutzerverwaltung.delete_button.${idx + 1}`}
                                    onClick={() => setDeleteTarget(user)}
                                    disabled={deleteUserWrapped.isPending}
                                    title="Benutzer unwiderruflich löschen"
                                    aria-label="Benutzer unwiderruflich löschen"
                                  >
                                    <Trash2 size={14} />
                                    Löschen
                                  </Button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Invite New User ──────────────────────────────────────────────── */}
      <section data-ocid="benutzerverwaltung.invite_section">
        <div className="mb-4">
          <h2 className="font-display font-semibold text-foreground text-lg">
            Neuen Anwalt einladen
          </h2>
          <p className="text-sm text-muted-foreground">
            Erstellen Sie einen Einladungslink und senden Sie ihn an den neuen
            Mitarbeiter.
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">E-Mail-Adresse</Label>
              <div className="relative">
                <Mail
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="invite-email"
                  type="email"
                  data-ocid="benutzerverwaltung.invite_email.input"
                  placeholder="kollege@kanzlei.ch"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && inviteEmail.includes("@")) {
                      createInviteMut.mutate(inviteEmail);
                    }
                  }}
                />
              </div>
            </div>
            <Button
              data-ocid="benutzerverwaltung.create_invite_button"
              className="btn-success gap-2"
              onClick={() => createInviteMut.mutate(inviteEmail)}
              disabled={!inviteEmail.includes("@") || createInviteMut.isPending}
            >
              {createInviteMut.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <UserPlus size={15} />
              )}
              Einladen
            </Button>
          </div>

          {/* Generated link */}
          {generatedLink && (
            <div
              data-ocid="benutzerverwaltung.generated_link"
              className="rounded-md bg-accent/10 border border-accent/30 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-accent">
                <Link2 size={13} />
                Einladungslink erstellt
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 font-mono text-foreground truncate">
                  {generatedLink}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  data-ocid="benutzerverwaltung.copy_link_button"
                  onClick={() => handleCopyLink(generatedLink)}
                >
                  {copied ? <Check size={13} /> : <ClipboardCopy size={13} />}
                  {copied ? "Kopiert" : "Kopieren"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Pending Invites ──────────────────────────────────────────────── */}
      {inviteLinks.length > 0 && (
        <section data-ocid="benutzerverwaltung.pending_invites_section">
          <div className="mb-4">
            <h2 className="font-display font-semibold text-foreground text-lg">
              Ausstehende Einladungen
            </h2>
            <p className="text-sm text-muted-foreground">
              Einladungen die noch nicht eingelöst wurden.
            </p>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {invitesLoading
                  ? ["i1", "i2"].map((sk) => (
                      <tr key={sk} className="border-b border-border">
                        {["c1", "c2", "c3"].map((ck) => (
                          <td key={ck} className="px-4 py-3">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : inviteLinks
                      .filter((inv) => !inv.redeemedBy)
                      .map((inv, idx) => (
                        <tr
                          key={inv.token}
                          data-ocid={`benutzerverwaltung.invite.${idx + 1}`}
                          className="border-b border-border hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 text-foreground">
                            {inv.email}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className="text-xs text-amber-700 border-amber-400"
                            >
                              Ausstehend
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 gap-1.5 text-xs"
                              data-ocid={`benutzerverwaltung.copy_invite_button.${idx + 1}`}
                              onClick={() =>
                                handleCopyLink(
                                  buildInviteUrl(inv.token, inv.email),
                                )
                              }
                            >
                              <ClipboardCopy size={12} />
                              Kopieren
                            </Button>
                          </td>
                        </tr>
                      ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Migration Confirmation Dialog ─────────────────────────────────── */}
      <Dialog open={migrateOpen} onOpenChange={setMigrateOpen}>
        <DialogContent
          data-ocid="benutzerverwaltung.migrate_dialog"
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Rollen migrieren</DialogTitle>
            <DialogDescription>
              Bestehende Benutzer mit{" "}
              <code className="font-mono text-xs">isAdmin=true</code> werden zur
              Rolle <strong>Admin</strong> konvertiert. Diese Aktion kann nicht
              rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              data-ocid="benutzerverwaltung.migrate_cancel_button"
              onClick={() => setMigrateOpen(false)}
              disabled={migrateRolesWrapped.isPending}
            >
              Abbrechen
            </Button>
            <Button
              className="btn-success gap-2"
              data-ocid="benutzerverwaltung.migrate_confirm_button"
              onClick={() => migrateRolesWrapped.mutate()}
              disabled={migrateRolesWrapped.isPending}
            >
              {migrateRolesWrapped.isPending ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
              Migrieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Physische Löschung — Bestätigungs-Modal ────────────────────────── */}
      {/* Ersetzt die Browser-Konfirmation durch einen barrierefreien Dialog. */}
      <ConfirmDeleteModal
        open={deleteTarget !== null}
        entityName={
          deleteTarget
            ? `${deleteTarget.titel && deleteTarget.titel !== "—" ? `${deleteTarget.titel} ` : ""}${deleteTarget.vorname} ${deleteTarget.nachname}`.trim()
            : ""
        }
        entityType="Leistungserbringer"
        loading={deleteUserWrapped.isPending}
        onClose={() => {
          if (!deleteUserWrapped.isPending) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget) {
            deleteUserWrapped.mutate(deleteTarget.id.toString());
          }
        }}
      />
    </div>
  );
}

// ─── Tab 2: Aktive Benutzer (rollenabhängig) ──────────────────────────────────

function AktiveBenutzerTab() {
  const { data: isSuperAdmin = false } = useIsSuperAdmin();

  // Plattform-Admin → Kanzlei-Übersicht mit Export; sonst → Kanzlei-Einzelansicht.
  if (isSuperAdmin) {
    return <PlattformAdminAktiveBenutzerView />;
  }
  return <AktiveBenutzerView />;
}

// ─── Page (zwei Tabs, Tab-State einmalig aus URL-Query initialisiert) ────────

function initialTabFromUrl(): TabKey {
  // Einmalige Initialisierung beim Mount aus ?tab=. KEINE laufende
  // URL-Synchronisation, KEIN useSearchParams (Projekt nutzt @tanstack/react-router).
  if (typeof window === "undefined") return TAB_BENUTZERVERWALTUNG;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("tab");
  return isTabKey(raw) ? raw : TAB_BENUTZERVERWALTUNG;
}

export function BenutzerverwaltungPage() {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTabFromUrl);

  function setTab(tab: TabKey) {
    setActiveTab(tab);
  }

  return (
    <div
      data-ocid="benutzerverwaltung.page"
      className="p-6 space-y-6 max-w-7xl mx-auto"
    >
      {/* ── Tab-Leiste ─────────────────────────────────────────────────────── */}
      <nav
        data-ocid="benutzerverwaltung.tabs"
        className="flex items-center gap-1 border-b border-border"
        role="tablist"
        aria-label="Benutzerverwaltung Bereiche"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`benutzerverwaltung-panel-${tab.key}`}
              data-ocid={`benutzerverwaltung.tab.${tab.key}`}
              onClick={() => setTab(tab.key)}
              className={`relative px-4 py-2.5 text-sm font-medium transition-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-t-md -mb-px ${
                isActive
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-b-2 border-transparent"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* ── Tab-Inhalt ─────────────────────────────────────────────────────── */}
      <div
        role="tabpanel"
        id="benutzerverwaltung-panel-benutzerverwaltung"
        aria-labelledby="benutzerverwaltung-tab-benutzerverwaltung"
        hidden={activeTab !== TAB_BENUTZERVERWALTUNG}
      >
        {activeTab === TAB_BENUTZERVERWALTUNG && <BenutzerverwaltungView />}
      </div>
      <div
        role="tabpanel"
        id="benutzerverwaltung-panel-aktive-benutzer"
        aria-labelledby="benutzerverwaltung-tab-aktive-benutzer"
        hidden={activeTab !== TAB_AKTIVE_BENUTZER}
      >
        {activeTab === TAB_AKTIVE_BENUTZER && <AktiveBenutzerTab />}
      </div>
    </div>
  );
}
