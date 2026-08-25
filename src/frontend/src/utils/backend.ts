import { useActor } from "@caffeineai/core-infrastructure";
import { createActor } from "@/backend";
import type {
  AuditTrailFilter,
  AuslagenFilter,
  DsrRequest,
  DsrStatus,
  KanzleiOverview,
  KanzleiStammdaten,
  MigrationSummary,
  Rechnungsvorlage,
  RoleMigrationResult,
  SuperAdminWhitelistEntry,
} from "@/types";
import { ExternalBlob } from "@/backend";
import type {
  ActiveUserEntry,
  ActiveUserMonth,
  ActiveUsersYearReport,
  AllKanzleienActiveUsersReport,
  Role,
  SupportCategory,
  SupportConversation,
  SupportConversationId,
  SupportConversationWithMessages,
  SupportMessage,
  SupportStatus,
  AuslagenFilter as BackendAuslagenFilter,
} from "@/backend";
import { Principal } from "@icp-sdk/core/principal";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VerificationError } from "@/types";
import type { Zahlungsmodalitaet } from "@/backend";

// ─── Defensive normalizers for active-users reports ─────────────────────────
// The backend contract guarantees `months` is always a 12-entry array built
// via Array.tabulate. In practice a stale canister IDL, a partial decode, or
// a null/undefined response can leave `months` (or `users` per month) as
// undefined, which crashes any `[...report.months]` spread or `.map`/`.slice`
// with a minified "p2.slice is not a function". These normalizers coerce the
// response into a safe shape so every consumer can rely on real arrays.

/** Coerce a possibly-malformed ActiveUserMonth into a safe shape. */
function normalizeActiveUserMonth(m: unknown): ActiveUserMonth {
  const raw = (m ?? {}) as Partial<ActiveUserMonth>;
  const users = Array.isArray(raw.users) ? raw.users : [];
  return {
    month: raw.month ?? 0n,
    total: raw.total ?? 0n,
    year: raw.year ?? 0n,
    users: users.map((u) => {
      const eu = (u ?? {}) as Partial<ActiveUserEntry>;
      return {
        userId: eu.userId,
        name: typeof eu.name === "string" ? eu.name : "",
        isActive: typeof eu.isActive === "boolean" ? eu.isActive : false,
      } as ActiveUserEntry;
    }),
  };
}

/** Coerce a possibly-malformed ActiveUsersYearReport into a safe shape. */
function normalizeActiveUsersYearReport(
  r: unknown,
): ActiveUsersYearReport | null {
  if (r == null) return null;
  const raw = r as Partial<ActiveUsersYearReport>;
  return {
    yearTotal: raw.yearTotal ?? 0n,
    year: raw.year ?? 0n,
    months: Array.isArray(raw.months)
      ? raw.months.map(normalizeActiveUserMonth)
      : [],
    kanzleiId: raw.kanzleiId ?? "",
  };
}

/** Coerce a possibly-malformed AllKanzleienActiveUsersReport into a safe shape. */
function normalizeAllKanzleienReport(
  r: unknown,
): AllKanzleienActiveUsersReport | null {
  if (r == null) return null;
  const raw = r as Partial<AllKanzleienActiveUsersReport>;
  return {
    kanzleiName: typeof raw.kanzleiName === "string" ? raw.kanzleiName : "",
    yearTotal: raw.yearTotal ?? 0n,
    year: raw.year ?? 0n,
    months: Array.isArray(raw.months)
      ? raw.months.map(normalizeActiveUserMonth)
      : [],
    kanzleiId: raw.kanzleiId ?? "",
  };
}

// ─── Super-Admin / Plattform-Admin Actor Extension ───────────────────────────
// backend.d.ts is regenerated from the backend canister; until the new
// super-admin methods are bound there, we cast the actor through this typed
// extension interface so callers stay type-safe without resorting to `any`.
// The method signatures mirror the Motoko public functions in types/super-admin.mo
// and types/roles.mo. When bindgen catches up, this interface can be removed and
// the actor used directly.

export interface SuperAdminActor {
  isSuperAdmin(): Promise<boolean>;
  getAllKanzleienOverview(): Promise<KanzleiOverview[]>;
  exportKanzleienCsv(): Promise<string>;
  exportKanzleienPdf(): Promise<Uint8Array>;
  migrateRoles(): Promise<MigrationSummary>;
  updateUserRole(principal: Principal, newRole: Role): Promise<RoleMigrationResult>;
  promoteJoaoMarques(): Promise<{
    __kind__: "ok";
    ok: { principal?: unknown; email: string; changed: boolean; whitelistAdded: boolean };
  } | { __kind__: "err"; err: string }>;
  getMyRole(): Promise<Role>;
  getUserRole(principal: string): Promise<Role>;
  getSuperAdmins(): Promise<SuperAdminWhitelistEntry[]>;
}

/**
 * Cast the backend actor to include the not-yet-bound super-admin methods.
 * Falls back to `null` while the actor is initializing so hooks can gate on it.
 */
function useSuperAdminActor(): SuperAdminActor | null {
  const { actor } = useBackend();
  return actor as unknown as SuperAdminActor | null;
}

/**
 * useBackend — returns the backend actor for use in React Query hooks.
 * The actor is undefined while initializing; queries should gate on `!!actor`.
 */
export function useBackend() {
  const { actor, isFetching } = useActor(createActor);
  return { actor, isLoading: isFetching };
}

/**
 * Centralized React Query key factory.
 * Keeps cache keys consistent across the app.
 */
export const queryKeys = {
  kanzlei: () => ["kanzlei"] as const,
  currentUser: () => ["currentUser"] as const,
  leistungserbringer: () => ["leistungserbringer"] as const,
  leistungserbringerById: (id: string) => ["leistungserbringer", id] as const,

  klienten: () => ["klienten"] as const,
  klientById: (id: string) => ["klienten", id] as const,

  mandate: (klientId?: string) =>
    klientId ? ["mandate", klientId] : (["mandate"] as const),
  mandatById: (id: string) => ["mandate", "detail", id] as const,

  leistungen: (filter?: Record<string, unknown>) =>
    filter ? ["leistungen", filter] : (["leistungen"] as const),

  auslagen: (filter?: Record<string, unknown>) =>
    filter ? ["auslagen", filter] : (["auslagen"] as const),

  rechnungen: (filter?: Record<string, unknown>) =>
    filter ? ["rechnungen", filter] : (["rechnungen"] as const),
  rechnungById: (id: string) => ["rechnungen", "detail", id] as const,

  zahlungen: (rechnungId?: string) =>
    rechnungId ? ["zahlungen", rechnungId] : (["zahlungen"] as const),

  providerReport: (providerId: string, params?: Record<string, unknown>) =>
    ["report", "provider", providerId, params] as const,

  kanzleiReport: (params?: Record<string, unknown>) =>
    ["report", "kanzlei", params] as const,

  gehaltReport: (params?: Record<string, unknown>) =>
    ["report", "gehalt", params] as const,

  inviteLinks: () => ["inviteLinks"] as const,

  // ─── Timer / Stoppuhr ──────────────────────────────────────────────────────
  timer: (leistungId: string) => ["timer", leistungId] as const,
  timers: () => ["timers"] as const,

  // ─── Budget ────────────────────────────────────────────────────────────────
  budgetSummary: (mandatId: string) => ["budgetSummary", mandatId] as const,
  budgetSummaries: () => ["budgetSummaries"] as const,

  // ─── Datenschutz (revDSG) ────────────────────────────────────────────────
  auditTrail: (filter?: AuditTrailFilter) =>
    filter ? (["datenschutz", "auditTrail", filter] as const) : (["datenschutz", "auditTrail"] as const),

  consentRecords: (kanzleiId?: string) =>
    kanzleiId
      ? (["datenschutz", "consentRecords", kanzleiId] as const)
      : (["datenschutz", "consentRecords"] as const),

  dsrRequests: (kanzleiId?: string) =>
    kanzleiId
      ? (["datenschutz", "dsrRequests", kanzleiId] as const)
      : (["datenschutz", "dsrRequests"] as const),

  retentionPolicies: (kanzleiId?: string) =>
    kanzleiId
      ? (["datenschutz", "retentionPolicies", kanzleiId] as const)
      : (["datenschutz", "retentionPolicies"] as const),

  dataInventory: (kanzleiId?: string) =>
    kanzleiId
      ? (["datenschutz", "dataInventory", kanzleiId] as const)
      : (["datenschutz", "dataInventory"] as const),

  dataFlows: (kanzleiId?: string) =>
    kanzleiId
      ? (["datenschutz", "dataFlows", kanzleiId] as const)
      : (["datenschutz", "dataFlows"] as const),

  dsgVersion: () => ["datenschutz", "dsgVersion"] as const,

  dashboardStats: (kanzleiId?: string) =>
    kanzleiId
      ? (["datenschutz", "dashboardStats", kanzleiId] as const)
      : (["datenschutz", "dashboardStats"] as const),

  pendingDeletions: (kanzleiId?: string) =>
    kanzleiId
      ? (["datenschutz", "pendingDeletions", kanzleiId] as const)
      : (["datenschutz", "pendingDeletions"] as const),

  // ─── Rechnungsvorlagen ──────────────────────────────────────────────────────
  rechnungsvorlage: () => ["rechnungsvorlage"] as const,
  // Logo hat einen eigenen Query-Key, der sich nicht mit der Vorlage
  // überschneidet. useGetLogo ruft actor.getLogo() auf, useRechnungsvorlage
  // ruft actor.getRechnungsvorlage() auf — beide würden sich sonst denselben
  // Cache-Eintrag ['rechnungsvorlage'] teilen und sich gegenseitig
  // überschreiben. Der Logo-Key ist ein Kind des Vorlage-Keys, sodass eine
  // Invalidierung von ['rechnungsvorlage'] (Prefix-Match) auch das Logo
  // refetchet, aber umgekehrt das Logo allein invalidiert werden kann.
  logo: () => ["rechnungsvorlage", "logo"] as const,

  // ─── Kanzlei-Stammdaten (Einstellungen > Kanzleidaten) ──────────────────────
  // Streng getrennt vom Rechnungslogo (queryKeys.logo) und von der
  // Kanzlei-Entity (queryKeys.kanzlei). Stammdaten werden über
  // getKanzleiStammdaten / updateKanzleiStammdaten persistiert.
  kanzleiStammdaten: () => ["kanzleiStammdaten"] as const,

  // ─── Super-Admin / Plattform-Admin ────────────────────────────────────────
  isSuperAdmin: () => ["superAdmin", "isSuperAdmin"] as const,
  myRole: () => ["superAdmin", "myRole"] as const,
  userRole: (principal: string) => ["superAdmin", "userRole", principal] as const,
  superAdmins: () => ["superAdmin", "whitelist"] as const,
  kanzleienOverview: () => ["superAdmin", "kanzleienOverview"] as const,
  activeUsers: (kanzleiId: string, year: bigint) =>
    ["superAdmin", "activeUsers", kanzleiId, year.toString()] as const,
  allActiveUsers: (year: bigint) =>
    ["superAdmin", "allActiveUsers", year.toString()] as const,
  leistungserbringerByKanzlei: (kanzleiId: string) =>
    ["superAdmin", "leistungserbringerByKanzlei", kanzleiId] as const,

  // ─── Feedback & Support ────────────────────────────────────────────────────
  support: () => ["support"] as const,
  supportConversation: (id: SupportConversationId) =>
    ["support", "conversation", id] as const,
  supportConversations: () => ["support", "conversations"] as const,
  supportUnreadUser: () => ["support", "unread-user"] as const,
  supportUnreadAdmin: () => ["support", "unread-admin"] as const,

  // ─── Registrierung / E-Mail-Verifizierung ─────────────────────────────────
  // PendingRegistration wird über die nicht-sensitive pendingId (localStorage)
  // abgefragt. Der Key ist pro pendingId, damit Reload-Recovery und
  // E-Mail-Änderung den Cache gezielt invalidiert werden können.
  pendingRegistration: (pendingId: string) =>
    ["pendingRegistration", pendingId] as const,
};

// ─── Datenschutz (revDSG) Hooks ──────────────────────────────────────────────
// Follow the existing useBackend + useQuery pattern. Each hook gates on `!!actor`
// and forwards to the corresponding backend method.

export function useKanzlei() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.kanzlei(),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getKanzlei();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useDashboardStats(kanzleiId?: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.dashboardStats(kanzleiId),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDashboardStats(kanzleiId ?? "");
    },
    enabled: !!actor && !isLoading,
  });
}

export function useAuditTrail(filter?: AuditTrailFilter) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.auditTrail(filter),
    queryFn: async () => {
      if (!actor || !filter) return [];
      return actor.getAuditTrail(filter);
    },
    enabled: !!actor && !isLoading && !!filter,
  });
}

export function useConsentRecords(kanzleiId?: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.consentRecords(kanzleiId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getConsentRecords(kanzleiId ?? "");
    },
    enabled: !!actor && !isLoading,
  });
}

export function useDsrRequests(kanzleiId?: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.dsrRequests(kanzleiId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getDsrRequests(kanzleiId ?? "");
    },
    enabled: !!actor && !isLoading,
  });
}

export function useCreateDsrRequest() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (req: DsrRequest) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.createDsrRequest(req);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dsrRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dashboardStats"] });
    },
  });
}

export function useUpdateDsrRequest() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { id: string; status: DsrStatus; notes: string | null }) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.updateDsrRequest(args.id, args.status, args.notes);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dsrRequests"] });
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dashboardStats"] });
    },
  });
}

export function useRetentionPolicies(kanzleiId?: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.retentionPolicies(kanzleiId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getRetentionPolicies(kanzleiId ?? "");
    },
    enabled: !!actor && !isLoading,
  });
}

export function useUpdateRetentionPolicy() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { id: string; retentionYears: bigint; isLocked: boolean }) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.updateRetentionPolicy(args.id, args.retentionYears, args.isLocked);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "retentionPolicies"] });
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "pendingDeletions"] });
    },
  });
}

export function usePendingDeletions(kanzleiId?: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.pendingDeletions(kanzleiId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPendingDeletions(kanzleiId ?? "");
    },
    enabled: !!actor && !isLoading,
  });
}

export function useExecuteDeletion() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { categoryName: string; entityId: string }) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.executeDeletion(args.categoryName, args.entityId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "pendingDeletions"] });
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dashboardStats"] });
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "auditTrail"] });
    },
  });
}

export function useDataInventory(kanzleiId?: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.dataInventory(kanzleiId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getDataInventory(kanzleiId ?? "");
    },
    enabled: !!actor && !isLoading,
  });
}

export function useUpdateDataInventoryEntry() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { id: string; entry: unknown }) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.updateDataInventoryEntry(args.id, args.entry as never);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dataInventory"] });
    },
  });
}

export function useDataFlows(kanzleiId?: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.dataFlows(kanzleiId),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getDataFlows(kanzleiId ?? "");
    },
    enabled: !!actor && !isLoading,
  });
}

export function useUpdateDataFlowEntry() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { id: string; entry: unknown }) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.updateDataFlowEntry(args.id, args.entry as never);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dataFlows"] });
    },
  });
}

export function useDsgVersion() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.dsgVersion(),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDsgVersion();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useUpdateDsgVersion() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { version: string; content: string | null }) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.updateDsgVersion(args.version, args.content);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dsgVersion"] });
    },
  });
}

export function useRecordConsent() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { klientId: string; dsgVersion: string }) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.recordConsent(args.klientId, args.dsgVersion);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "consentRecords"] });
      void queryClient.invalidateQueries({ queryKey: ["datenschutz", "dashboardStats"] });
    },
  });
}

export function useExportAuditTrailCsv() {
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (filter: AuditTrailFilter) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.exportAuditTrailCsv(filter);
    },
  });
}

export function useExportAuditTrailPdf() {
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (filter: AuditTrailFilter) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.exportAuditTrailPdf(filter);
    },
  });
}

// ─── Super-Admin / Plattform-Admin Hooks ──────────────────────────────────────
// These hooks call methods that are not yet bound in backend.d.ts. They go
// through the typed SuperAdminActor extension interface to stay type-safe.

export function useIsSuperAdmin() {
  const actor = useSuperAdminActor();
  const { isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.isSuperAdmin(),
    queryFn: async () => {
      if (!actor) return false;
      return actor.isSuperAdmin();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useGetAllKanzleienOverview() {
  const actor = useSuperAdminActor();
  const { isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.kanzleienOverview(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllKanzleienOverview();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useExportKanzleienCsv() {
  const actor = useSuperAdminActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend not ready");
      return actor.exportKanzleienCsv();
    },
  });
}

export function useExportKanzleienPdf() {
  const actor = useSuperAdminActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend not ready");
      return actor.exportKanzleienPdf();
    },
  });
}

export function useGetActiveUsersPerMonth(kanzleiId: string, year: bigint) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.activeUsers(kanzleiId, year),
    queryFn: async () => {
      if (!actor) return null;
      const raw = await actor.getActiveUsersPerMonth(kanzleiId, year);
      // Defensive: the backend contract guarantees a 12-entry `months` array,
      // but a stale IDL or partial decode can leave `months`/`users` undefined,
      // which would crash downstream array operations. Normalize to a safe
      // shape with empty arrays and zero totals.
      return normalizeActiveUsersYearReport(raw);
    },
    enabled: !!actor && !isLoading && !!kanzleiId,
  });
}

export function useGetAllActiveUsersPerMonth(year: bigint) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.allActiveUsers(year),
    queryFn: async () => {
      if (!actor) return [] as AllKanzleienActiveUsersReport[];
      const raw = await actor.getAllActiveUsersPerMonth(year);
      // Defensive: drop null/malformed reports and normalize the survivors so
      // every consumer can rely on `months` being a real array.
      if (!Array.isArray(raw)) return [] as AllKanzleienActiveUsersReport[];
      return raw
        .map(normalizeAllKanzleienReport)
        .filter((r): r is AllKanzleienActiveUsersReport => r !== null);
    },
    enabled: !!actor && !isLoading,
  });
}

/**
 * useGetLeistungserbringerByKanzlei — lädt alle Leistungserbringer (Benutzer)
 * einer bestimmten Kanzlei. Wird in der ausgeklappten Kanzlei-Zeile der
 * PlattformAdminPage verwendet, um die Benutzerliste (Name, E-Mail, Rolle,
 * Status) pro Kanzlei anzuzeigen. Lazy loading via `enabled`-Flag, das der
 * Parent beim Ausklappen steuert.
 */
export function useGetLeistungserbringerByKanzlei(kanzleiId: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.leistungserbringerByKanzlei(kanzleiId),
    queryFn: async () => {
      if (!actor) return [];
      const raw = await actor.getLeistungserbringerByKanzlei(kanzleiId);
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!actor && !isLoading && !!kanzleiId,
  });
}

export function useMigrateRoles() {
  const queryClient = useQueryClient();
  const actor = useSuperAdminActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend not ready");
      return actor.migrateRoles();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["superAdmin"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    },
  });
}

/**
 * usePromoteJoaoMarques — one-shot Super-Admin action that promotes the
 * known principal "João Marques" to Plattform-Admin and adds them to the
 * super-admin whitelist. Mirrors useMigrateRoles: invalidates all
 * superAdmin-scoped queries plus currentUser so role/whitelist UI refreshes.
 */
export function usePromoteJoaoMarques() {
  const queryClient = useQueryClient();
  const actor = useSuperAdminActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend not ready");
      return actor.promoteJoaoMarques();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["superAdmin"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const actor = useSuperAdminActor();
  return useMutation({
    mutationFn: async (args: { principal: string; newRole: Role }) => {
      if (!actor) throw new Error("Backend not ready");
      // The generated actor binding (backend.d.ts) expects a Principal object,
      // not a string. The page passes user.id.toString() (the textual form, e.g.
      // "b2sqc-...-lqe"). Convert it back to a Principal via fromText before the
      // actor call — passing the raw string produces "Invalid principal argument".
      const principal = Principal.fromText(args.principal);
      return actor.updateUserRole(principal, args.newRole);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["superAdmin", "userRole", variables.principal] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    },
  });
}

export function useGetMyRole() {
  const actor = useSuperAdminActor();
  const { isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.myRole(),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getMyRole();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useGetUserRole(principal: string | null) {
  const actor = useSuperAdminActor();
  const { isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.userRole(principal ?? ""),
    queryFn: async () => {
      if (!actor || !principal) return null;
      return actor.getUserRole(principal);
    },
    enabled: !!actor && !isLoading && !!principal,
  });
}

export function useGetSuperAdmins() {
  const actor = useSuperAdminActor();
  const { isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.superAdmins(),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSuperAdmins();
    },
    enabled: !!actor && !isLoading,
  });
}

// ─── Rechnungsvorlagen Hooks ──────────────────────────────────────────────────
// One vorlage per kanzlei. getRechnungsvorlage returns null until the admin
// saves a vorlage for the first time; the editor falls back to DEFAULT_VORLAGE
// from @/types in that case. Mutations invalidate the single vorlage cache key.

export function useRechnungsvorlage() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.rechnungsvorlage(),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getRechnungsvorlage();
    },
    enabled: !!actor && !isLoading,
  });
}

// ─── Rechnung / Auslagen hooks (single rechnung + auslagen by filter) ──────────
// useRechnung loads a single Rechnung by id (returns null while the actor is
// initializing or when the id is empty). useAuslagen loads the Auslagen list
// for a given AuslagenFilter — used by the V2 layout preview to resolve the
// auslageIds referenced by a test rechnung. Both follow the existing
// useBackend() + useQuery pattern (see useRechnungsvorlage above).

export function useRechnung(id: string) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.rechnungById(id),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getRechnung(id);
    },
    enabled: !!actor && !isLoading && !!id,
  });
}

export function useAuslagen(filter?: AuslagenFilter) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.auslagen(
      filter as unknown as Record<string, unknown> | undefined,
    ),
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAuslagen(
        (filter ?? {}) as unknown as BackendAuslagenFilter,
      );
    },
    enabled: !!actor && !isLoading,
  });
}

export function useGetLogo() {
  const { actor } = useBackend();
  return useQuery({
    queryKey: queryKeys.logo(),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getLogo();
    },
    enabled: !!actor,
  });
}

export function useSaveRechnungsvorlage() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (vorlage: Rechnungsvorlage) => {
      if (!actor) throw new Error("Backend not ready");
      return actor.saveRechnungsvorlage(vorlage);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.rechnungsvorlage() });
    },
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (blob: Uint8Array) => {
      if (!actor) throw new Error("Backend not ready");
      const externalBlob = ExternalBlob.fromBytes(new Uint8Array(blob));
      return actor.uploadLogo(externalBlob);
    },
    onSuccess: () => {
      // Vorlage refetchen (logoBlob-Referenz aktualisiert) UND Logo-Blob
      // refetchen — beide Keys, damit beide Caches konsistent bleiben.
      void queryClient.invalidateQueries({ queryKey: queryKeys.rechnungsvorlage() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.logo() });
    },
  });
}

export function useRemoveLogo() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Backend not ready");
      return actor.removeLogo();
    },
    onSuccess: () => {
      // Vorlage refetchen (logoBlob-Referenz aktualisiert) UND Logo-Blob
      // refetchen — beide Keys, damit beide Caches konsistent bleiben.
      void queryClient.invalidateQueries({ queryKey: queryKeys.rechnungsvorlage() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.logo() });
    },
  });
}

// ─── Kanzlei-Stammdaten (Einstellungen > Kanzleidaten) ──────────────────────────
// Streng getrennt vom Rechnungslogo (useGetLogo/useUploadLogo/useRemoveLogo):
// Stammdaten werden über getKanzleiStammdaten / updateKanzleiStammdaten
// persistiert und haben einen eigenen Query-Key (queryKeys.kanzleiStammdaten).
// Das Kanzlei-Logo (kanzleiLogoBlob) ist Teil der Stammdaten und wird NICHT
// über die Rechnungslogo-Hooks gespeichert.

export function useGetKanzleiStammdaten() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.kanzleiStammdaten(),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getKanzleiStammdaten();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useUpdateKanzleiStammdaten() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (stammdaten: KanzleiStammdaten) => {
      if (!actor) throw new Error("Backend not ready");
      // Lokaler KanzleiStammdaten-Typ (@/types) hat optionale Felder
      // (uid?, mwstNr?, email?, website?, telefon?), der Backend-Typ
      // (backend.d.ts) erwartet diese als Pflicht-Strings. Wir normalisieren
      // undefined → "" vor dem Actor-Call, damit der Typ-Contract erfüllt ist.
      const normalized = {
        kanzleiname: stammdaten.kanzleiname,
        strasseHausnummer: stammdaten.strasseHausnummer,
        plz: stammdaten.plz,
        ort: stammdaten.ort,
        land: stammdaten.land,
        telefon: stammdaten.telefon ?? "",
        email: stammdaten.email ?? "",
        website: stammdaten.website ?? "",
        uid: stammdaten.uid ?? "",
        mwstNr: stammdaten.mwstNr ?? "",
        kanzleiLogoBlob: stammdaten.kanzleiLogoBlob ?? undefined,
      };
      return actor.updateKanzleiStammdaten(normalized);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanzleiStammdaten() });
    },
  });
}

// ─── Löschen / Deaktivieren — neue Backend-Methoden ──────────────────────────
// deleteLeistungserbringer (physisch löschen) und deleteKanzlei (physisch
// löschen) sind unwiderruflich; deactivateKanzlei setzt status='inaktiv'.
// Alle drei invalidieren die relevanten Query-Keys, damit Tabellen/Overviews
// nach der Mutation sofort refetchen. Die Actor-Methoden sind in backend.d.ts
// gebunden (Promise<Result>); wir werfen bei err, damit die Mutation fehlschlägt.

function unwrapResult(res: { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string }): null {
  if (res.__kind__ === "err") throw new Error(res.err);
  return res.ok;
}

export function useDeleteLeistungserbringer() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapResult(await actor.deleteLeistungserbringer(userId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.leistungserbringer() });
    },
  });
}

export function useDeleteKanzlei() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (kanzleiId: string) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapResult(await actor.deleteKanzlei(kanzleiId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["superAdmin", "kanzleienOverview"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanzlei() });
      // Backend cascade-deletes the Kanzlei's users on physical delete, so the
      // leistungserbringer caches must be invalidated too — otherwise orphaned
      // users linger in the React Query cache. The broad leistungserbringer()
      // key covers both the global list and the per-kanzlei list (prefix match).
      void queryClient.invalidateQueries({ queryKey: queryKeys.leistungserbringer() });
      void queryClient.invalidateQueries({ queryKey: ["superAdmin", "leistungserbringerByKanzlei"] });
    },
  });
}

export function useDeactivateKanzlei() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (kanzleiId: string) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapResult(await actor.deactivateKanzlei(kanzleiId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["superAdmin", "kanzleienOverview"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanzlei() });
    },
  });
}

// ─── Reaktivieren — setzt den Kanzlei-Status zurück auf 'aktiv'. Das Pendant
//    zu useDeactivateKanzlei; gleiche Invalidation der Overview-Query.
export function useReactivateKanzlei() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (kanzleiId: string) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapResult(await actor.reactivateKanzlei(kanzleiId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["superAdmin", "kanzleienOverview"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanzlei() });
    },
  });
}

// ─── Feedback & Support Hooks ────────────────────────────────────────────────
// Follow the existing useBackend() + useQuery/useMutation pattern. Each hook
// gates on `!!actor`. Mutations invalidate the relevant support queryKeys so
// lists, conversation threads, and unread counters refetch immediately.
//
// Result variants: the backend returns {__kind__:'ok', ok} | {__kind__:'err',
// err} for create/get/update/mark operations. We unwrap via unwrapSupportResult
// (throws on err so the mutation fails) for mutations, and return the raw Result
// for queries so pages can render error states. getMySupportConversations and
// getUnreadSupportCountForUser return their payloads directly (no Result
// wrapper). bigint counts are converted with Number() where a number is more
// ergonomic for the UI.

function unwrapSupportResult<T>(res: { __kind__: "ok"; ok: T } | { __kind__: "err"; err: string }): T {
  if (res.__kind__ === "err") throw new Error(res.err);
  return res.ok;
}

export function useCreateSupportConversation() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: {
      category: SupportCategory;
      subject: string;
      message: string;
      appRoute: string;
      appVersion: string;
    }) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapSupportResult(
        await actor.createSupportConversation(
          args.category,
          args.subject,
          args.message,
          args.appRoute,
          args.appVersion,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportConversations() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportUnreadUser() });
    },
  });
}

export function useMySupportConversations() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.supportConversations(),
    queryFn: async () => {
      if (!actor) return [] as SupportConversation[];
      return actor.getMySupportConversations();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useSupportConversation(conversationId: SupportConversationId) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.supportConversation(conversationId),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getSupportConversation(conversationId);
    },
    enabled: !!actor && !isLoading && !!conversationId,
  });
}

export function useAllSupportConversations() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.supportConversations(),
    queryFn: async () => {
      if (!actor) return null;
      return actor.getAllSupportConversations();
    },
    enabled: !!actor && !isLoading,
  });
}

export function useAddSupportMessage() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { conversationId: SupportConversationId; message: string }) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapSupportResult(
        await actor.addSupportMessage(args.conversationId, args.message),
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.supportConversation(variables.conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportConversations() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportUnreadUser() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportUnreadAdmin() });
    },
  });
}

export function useUpdateSupportStatus() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: {
      conversationId: SupportConversationId;
      newStatus: SupportStatus;
    }) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapSupportResult(
        await actor.updateSupportStatus(args.conversationId, args.newStatus),
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.supportConversation(variables.conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportConversations() });
    },
  });
}

export function useMarkSupportMessageRead() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (conversationId: SupportConversationId) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapResult(await actor.markSupportMessageRead(conversationId));
    },
    onSuccess: (_data, conversationId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.supportConversation(conversationId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportUnreadUser() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.supportUnreadAdmin() });
    },
  });
}

export function useUnreadSupportCountForUser() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.supportUnreadUser(),
    queryFn: async () => {
      if (!actor) return 0;
      // Backend returns bigint directly (no Result wrapper).
      return Number(await actor.getUnreadSupportCountForUser());
    },
    enabled: !!actor && !isLoading,
  });
}

export function useUnreadSupportCountForAdmin() {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.supportUnreadAdmin(),
    queryFn: async () => {
      if (!actor) return 0;
      // Backend returns Result_12 ({ok: bigint} | {err: string}).
      const res = await actor.getUnreadSupportCountForAdmin();
      if (res.__kind__ === "err") return 0;
      return Number(res.ok);
    },
    enabled: !!actor && !isLoading,
  });
}

// ─── Registrierung / E-Mail-Verifizierung Hooks ──────────────────────────────
// Back the 3-step registration flow (Kanzlei & Person → E-Mail bestätigen →
// Internet Identity verbinden). All methods return a Result whose `err` is a
// VerificationError enum value. We unwrap via unwrapVerificationResult (throws
// on err so the mutation fails) and map the error to a clean, non-technical
// German message via verificationErrorMessage — the UI never shows raw backend
// error details.

function unwrapVerificationResult<T>(
  res: { __kind__: "ok"; ok: T } | { __kind__: "err"; err: VerificationError },
): T {
  if (res.__kind__ === "err") throw new Error(res.err);
  return res.ok;
}

/**
 * verificationErrorMessage — maps every VerificationError variant to a clean,
 * non-technical German message for the UI. Unknown variants fall back to a
 * generic message so the user is never shown raw backend error details.
 */
export function verificationErrorMessage(err: VerificationError): string {
  switch (err) {
    case VerificationError.invalidCode:
      return "Der Bestätigungscode ist nicht korrekt.";
    case VerificationError.codeExpired:
      return "Der Bestätigungscode ist abgelaufen. Bitte fordern Sie einen neuen Code an.";
    case VerificationError.tooManyAttempts:
      return "Zu viele Fehlversuche. Bitte fordern Sie einen neuen Code an.";
    case VerificationError.resendTooSoon:
      return "Bitte warten Sie, bevor Sie einen neuen Code anfordern.";
    case VerificationError.sendFailed:
      return "Der Bestätigungscode konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.";
    case VerificationError.notFound:
      return "Die Registrierung wurde nicht gefunden. Bitte starten Sie den Vorgang erneut.";
    case VerificationError.alreadyRegistered:
      return "Für diese E-Mail-Adresse besteht bereits eine Registrierung.";
    case VerificationError.principalAlreadyUsed:
      return "Diese Internet Identity ist bereits mit einem Konto verknüpft.";
    case VerificationError.emailAlreadyVerified:
      return "Die E-Mail-Adresse wurde bereits bestätigt.";
    case VerificationError.invalidInput:
      return "Bitte prüfen Sie Ihre Eingaben.";
    default:
      return "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.";
  }
}

/**
 * useSendVerificationCode — Step 1 → Step 2. Erstellt eine PendingRegistration
 * und sendet den 6-stelligen Bestätigungscode an die angegebene E-Mail. Es wird
 * weder eine Kanzlei noch ein Benutzer angelegt und keine Internet Identity
 * gestartet. Returns the PendingRegistrationId on success.
 */
export function useSendVerificationCode() {
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: {
      kanzleiName: string;
      titel: string;
      vorname: string;
      nachname: string;
      email: string;
      zahlungsmodalitaet: Zahlungsmodalitaet;
    }) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapVerificationResult(
        await actor.sendVerificationCode(
          args.kanzleiName,
          args.titel,
          args.vorname,
          args.nachname,
          args.email,
          args.zahlungsmodalitaet,
        ),
      );
    },
    onError: (error) => {
      // Log the concrete technical error (e.g. 'sendFailed' or any additional
      // detail) to the browser console for diagnosis. The user-facing message
      // stays generic via verificationErrorMessage — never shown raw here.
      console.error(
        "[sendVerificationCode] Fehler beim Senden des Bestätigungscodes:",
        error,
      );
    },
  });
}

/**
 * useVerifyEmail — Step 2. Prüft den eingegebenen 6-stelligen Code gegen die
 * PendingRegistration. Bei Erfolg wird emailVerified=true gesetzt.
 */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { pendingId: string; code: string }) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapVerificationResult(
        await actor.verifyEmail(args.pendingId, args.code),
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.pendingRegistration(variables.pendingId),
      });
    },
  });
}

/**
 * useGetPendingRegistration — Reload-Recovery. Lädt eine noch gültige
 * PendingRegistration anhand der nicht-sensitiven pendingId aus localStorage,
 * um den Flow zum passenden Schritt zurückzukehren. Returns null wenn die
 * PendingRegistration nicht (mehr) existiert oder abgelaufen ist.
 */
export function useGetPendingRegistration(pendingId: string | null) {
  const { actor, isLoading } = useBackend();
  return useQuery({
    queryKey: queryKeys.pendingRegistration(pendingId ?? ""),
    queryFn: async () => {
      if (!actor || !pendingId) return null;
      return actor.getPendingRegistration(pendingId);
    },
    enabled: !!actor && !isLoading && !!pendingId,
  });
}

/**
 * useChangeEmail — 'E-Mail-Adresse ändern' in Step 2. Ändert die E-Mail der
 * PendingRegistration, invalidiert den bisherigen Code und erzwingt eine neue
 * Verifizierung der geänderten Adresse.
 */
export function useChangeEmail() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (args: { pendingId: string; newEmail: string }) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapVerificationResult(
        await actor.changeEmail(args.pendingId, args.newEmail),
      );
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.pendingRegistration(variables.pendingId),
      });
    },
  });
}

/**
 * useCompleteRegistration — Step 3. Verknüpft die Internet-Identity-Identität
 * mit der PendingRegistration, legt genau eine definitive Kanzlei und einen
 * Benutzer mit bestehender Rolle und gewählter Zahlungsmodalität an und entfernt
 * die PendingRegistration. Idempotent und gegen Double Submit geschützt.
 * Returns the KanzleiId on success.
 */
export function useCompleteRegistration() {
  const queryClient = useQueryClient();
  const { actor } = useBackend();
  return useMutation({
    mutationFn: async (pendingId: string) => {
      if (!actor) throw new Error("Backend not ready");
      return unwrapVerificationResult(
        await actor.completeRegistration(pendingId),
      );
    },
    onSuccess: (_data, pendingId) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.pendingRegistration(pendingId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.kanzlei() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser() });
    },
  });
}
