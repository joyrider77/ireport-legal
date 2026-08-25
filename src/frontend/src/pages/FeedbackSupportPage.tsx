/**
 * FeedbackSupportPage — Plattform-Admin-Inbox für Feedback & Support.
 *
 * SuperAdminGuarded-Route (/app/feedback-support). Der Plattform-Admin sieht
 * alle Conversations aller Kanzleien, kann den Nachrichtenverlauf lesen,
 * antworten (senderType #platformAdmin wird vom Backend für Super-Admin-Caller
 * automatisch gesetzt) und den Status wechseln (neu / in_bearbeitung /
 * erledigt / archiviert).
 *
 * Datenmodell-Hinweis: useAllSupportConversations / useSupportConversation
 * liefern die rohen Result-Varianten ({__kind__:'ok', ok} | {__kind__:'err',
 * err}) — nicht wie die Mutations entpackt. Wir entpacken hier und zeigen
 * bei err einen Toast. SupportStatus / SupportCategory / SupportSenderType
 * sind String-Enums (z. B. SupportStatus.neu === "neu"), KEINE __kind__-
 * Unions; daher switch (status) mit Enum-Case-Labels.
 *
 * Referenz-Pattern: PlattformAdminPage.tsx (Tabelle + ausklappbare Zeilen,
 * Badge-Komponenten, Table/TableHeader/TableRow, toast aus sonner,
 * data-ocid) und DsrPage.tsx (Status-Workflow + Select-Filter).
 */
import type {
  SupportCategory,
  SupportConversation,
  SupportConversationId,
  SupportConversationWithMessages,
  SupportMessage,
  SupportSenderType,
  SupportStatus,
} from "@/backend.d";
import {
  SupportCategory as SupportCategoryEnum,
  SupportSenderType as SupportSenderTypeEnum,
  SupportStatus as SupportStatusEnum,
} from "@/backend.d";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useAddSupportMessage,
  useAllSupportConversations,
  useMarkSupportMessageRead,
  useSupportConversation,
  useUnreadSupportCountForAdmin,
  useUpdateSupportStatus,
} from "@/utils/backend";
import {
  ChevronDown,
  ChevronRight,
  Inbox,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Format a bigint nanosecond timestamp (IC) to "dd.MM.yyyy HH:mm".
 * Returns "—" for invalid/zero timestamps. Mirrors the formatTimestampNs
 * pattern from PlattformAdminPage.tsx but adds the time component required
 * for the message thread.
 */
function formatDateTimeNs(ns: bigint | undefined | null): string {
  if (ns === undefined || ns === null) return "—";
  const ms = Number(ns / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/** Compact date-only format "dd.MM.yyyy" for the inbox table columns. */
function formatDateNs(ns: bigint | undefined | null): string {
  if (ns === undefined || ns === null) return "—";
  const ms = Number(ns / 1_000_000n);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// ─── Label maps ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<SupportStatus, string> = {
  [SupportStatusEnum.neu]: "Neu",
  [SupportStatusEnum.in_bearbeitung]: "In Bearbeitung",
  [SupportStatusEnum.erledigt]: "Erledigt",
  [SupportStatusEnum.archiviert]: "Archiviert",
};

const STATUS_BADGE_CLASS: Record<SupportStatus, string> = {
  [SupportStatusEnum.neu]: "badge-feedback-neu",
  [SupportStatusEnum.in_bearbeitung]: "badge-feedback-in-bearbeitung",
  [SupportStatusEnum.erledigt]: "badge-feedback-erledigt",
  [SupportStatusEnum.archiviert]: "badge-feedback-archiviert",
};

const CATEGORY_LABELS: Record<SupportCategory, string> = {
  [SupportCategoryEnum.feedback]: "Feedback",
  [SupportCategoryEnum.frage]: "Frage",
  [SupportCategoryEnum.fehler]: "Fehler",
  [SupportCategoryEnum.verbesserungsvorschlag]: "Verbesserungsvorschlag",
};

const SENDER_LABELS: Record<SupportSenderType, string> = {
  [SupportSenderTypeEnum.user]: "Benutzer",
  [SupportSenderTypeEnum.platformAdmin]: "Plattform-Support",
};

// ─── Badge renderers ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SupportStatus }) {
  return (
    <span
      className={STATUS_BADGE_CLASS[status] ?? "badge-neutral"}
      data-ocid={`feedback.status_badge.${status}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function CategoryBadge({ category }: { category: SupportCategory }) {
  return (
    <Badge variant="outline" className="text-xs font-medium">
      {CATEGORY_LABELS[category] ?? category}
    </Badge>
  );
}

// ─── Unread detection ───────────────────────────────────────────────────────

/**
 * Eine Conversation gilt für den Admin als "ungelesen", wenn ihr Status #neu
 * ist. (Eine feinere readAt-basierte Erkennung auf Conversation-Ebene ist im
 * aktuellen Backend-Modell nicht vorgesehen — readAt lebt auf einzelnen
 * Nachrichten und wird via markSupportMessageRead gesetzt.)
 */
function isUnreadForAdmin(conv: SupportConversation): boolean {
  return conv.status === SupportStatusEnum.neu;
}

// ─── Result-Helper ──────────────────────────────────────────────────────────

// ─── Detail-Ansicht (eigenständige Komponente für Hook-Isolation) ────────────

interface ConversationDetailProps {
  conversationId: SupportConversationId;
  rowIndex: number;
}

/**
 * ConversationDetail — rendert die Detailansicht einer einzelnen Conversation
 * innerhalb der ausgeklappten Tabellenzeile. Lädt die Conversation mit
 * Nachrichten via useSupportConversation, markiert beim ersten Öffnen die
 * Benutzer-Nachrichten als gelesen (useMarkSupportMessageRead), zeigt den
 * Nachrichtenverlauf und bietet die Antwort- sowie Status-Wechsel-Aktion an.
 */
function ConversationDetail({
  conversationId,
  rowIndex,
}: ConversationDetailProps) {
  const {
    data: raw,
    isLoading,
    isError,
    error,
  } = useSupportConversation(conversationId);
  const addMessageMut = useAddSupportMessage();
  const updateStatusMut = useUpdateSupportStatus();
  const markReadMut = useMarkSupportMessageRead();

  const [replyText, setReplyText] = useState("");

  // Markiere Benutzer-Nachrichten als gelesen, sobald die Conversation das
  // erste Mal geladen wird. Backend setzt readAt nur für #user-Nachrichten;
  // der Aufruf ist idempotent. Wir triggern genau einmal pro conversationId.
  // biome-ignore lint/correctness/useExhaustiveDependencies: idempotenter Einmal-Aufruf pro conversationId; markReadMut.mutate ist stabil (React Query) und bewusst ausgelassen, um Doppel-Aufrufe bei Re-Renders zu vermeiden.
  useEffect(() => {
    if (!conversationId) return;
    markReadMut.mutate(conversationId, {
      onError: (e: Error) =>
        toast.error(`Als gelesen markieren fehlgeschlagen: ${e.message}`),
    });
  }, [conversationId]);

  // Entpacke das Result — bei err zeigen wir eine Fehlermeldung inline.
  const detail: SupportConversationWithMessages | null = useMemo(() => {
    if (!raw) return null;
    if (raw.__kind__ === "err") return null;
    return raw.ok;
  }, [raw]);

  const loadError =
    raw && raw.__kind__ === "err"
      ? raw.err
      : isError
        ? error instanceof Error
          ? error.message
          : "unbekannt"
        : null;

  // Nachrichten chronologisch (aufsteigend nach createdAt).
  const sortedMessages: SupportMessage[] = useMemo(() => {
    if (!detail) return [];
    const msgs = Array.isArray(detail.messages) ? detail.messages : [];
    return [...msgs].sort((a, b) => Number(a.createdAt - b.createdAt));
  }, [detail]);

  function handleSend() {
    const text = replyText.trim();
    if (!text) return;
    addMessageMut.mutate(
      { conversationId, message: text },
      {
        onSuccess: () => {
          setReplyText("");
          toast.success("Antwort gesendet");
        },
        onError: (e: Error) =>
          toast.error(`Senden fehlgeschlagen: ${e.message}`),
      },
    );
  }

  function handleStatusChange(newStatus: SupportStatus) {
    updateStatusMut.mutate(
      { conversationId, newStatus },
      {
        onSuccess: () =>
          toast.success(`Status geändert auf „${STATUS_LABELS[newStatus]}"`),
        onError: (e: Error) =>
          toast.error(`Statusänderung fehlgeschlagen: ${e.message}`),
      },
    );
  }

  // ── Ladezustand ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        data-ocid={`feedback.conversation.${rowIndex + 1}.loading`}
        className="p-4 space-y-3"
      >
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // ── Fehlerzustand ────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div
        data-ocid={`feedback.conversation.${rowIndex + 1}.error`}
        className="p-4 text-sm text-destructive"
      >
        Fehler beim Laden der Conversation: {loadError}
      </div>
    );
  }

  if (!detail) return null;
  const conv = detail.conversation;

  return (
    <div
      data-ocid={`feedback.conversation.${rowIndex + 1}.detail`}
      className="p-4 space-y-4"
    >
      {/* ── Detail-Header ─────────────────────────────────────────────────── */}
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h4 className="font-display text-base font-semibold text-foreground break-words">
              {conv.subject || "—"}
            </h4>
            <p className="text-xs text-muted-foreground mt-1">
              Conversation-ID: <span className="font-mono">{conv.id}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={conv.status} />
            <CategoryBadge category={conv.category} />
          </div>
        </div>

        {/* Metadaten-Raster */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-sm pt-2 border-t border-border">
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">
              Kanzlei
            </dt>
            <dd className="text-foreground font-mono text-xs break-all">
              {conv.kanzleiId || "—"}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">
              Absender
            </dt>
            <dd className="text-foreground">{conv.createdByUserName || "—"}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">
              Erstellungszeit
            </dt>
            <dd className="text-foreground">
              {formatDateTimeNs(conv.createdAt)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">
              App-Seite / Route
            </dt>
            <dd className="text-foreground font-mono text-xs break-all">
              {conv.appRoute || "—"}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">
              App-Version
            </dt>
            <dd className="text-foreground font-mono text-xs">
              {conv.appVersion || "—"}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-muted-foreground uppercase tracking-wide">
              Letzter Update
            </dt>
            <dd className="text-foreground">
              {formatDateTimeNs(conv.updatedAt)}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Nachrichten-Thread ─────────────────────────────────────────────── */}
      <div>
        <h5 className="font-display text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
          <MessageSquare size={14} className="text-primary" />
          Nachrichtenverlauf ({sortedMessages.length})
        </h5>
        {sortedMessages.length === 0 ? (
          <p
            data-ocid={`feedback.conversation.${rowIndex + 1}.messages_empty`}
            className="text-sm text-muted-foreground py-4 text-center"
          >
            Keine Nachrichten vorhanden.
          </p>
        ) : (
          <div
            data-ocid={`feedback.conversation.${rowIndex + 1}.thread`}
            className="feedback-thread max-h-[320px] overflow-y-auto pr-1"
          >
            {sortedMessages.map((msg, mIdx) => {
              const isUser = msg.senderType === SupportSenderTypeEnum.user;
              return (
                <div
                  key={msg.id}
                  data-ocid={`feedback.conversation.${rowIndex + 1}.message.${mIdx + 1}`}
                  className={`feedback-bubble ${
                    isUser ? "feedback-bubble-user" : "feedback-bubble-admin"
                  }`}
                >
                  <div className="feedback-bubble-meta">
                    <span className="font-medium">
                      {SENDER_LABELS[msg.senderType] ?? msg.senderType}
                    </span>
                    {" · "}
                    {formatDateTimeNs(msg.createdAt)}
                  </div>
                  <div className="whitespace-pre-wrap break-words mt-0.5">
                    {msg.message}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Antwort + Status-Wechsel ──────────────────────────────────────── */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div>
          <label
            htmlFor={`feedback-reply-${rowIndex}`}
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block"
          >
            Antwort als Plattform-Support
          </label>
          <Textarea
            id={`feedback-reply-${rowIndex}`}
            data-ocid={`feedback.conversation.${rowIndex + 1}.reply_input`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            placeholder="Antwort eingeben…"
            disabled={addMessageMut.isPending}
          />
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Status:
            </span>
            <Select
              value={conv.status}
              onValueChange={(v) => handleStatusChange(v as SupportStatus)}
            >
              <SelectTrigger
                data-ocid={`feedback.conversation.${rowIndex + 1}.status_select`}
                className="h-8 text-sm w-44"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SupportStatusEnum.neu}>Neu</SelectItem>
                <SelectItem value={SupportStatusEnum.in_bearbeitung}>
                  In Bearbeitung
                </SelectItem>
                <SelectItem value={SupportStatusEnum.erledigt}>
                  Erledigt
                </SelectItem>
                <SelectItem value={SupportStatusEnum.archiviert}>
                  Archiviert
                </SelectItem>
              </SelectContent>
            </Select>
            {updateStatusMut.isPending && (
              <Loader2
                size={14}
                className="animate-spin text-muted-foreground"
              />
            )}
          </div>
          <Button
            type="button"
            data-ocid={`feedback.conversation.${rowIndex + 1}.send_button`}
            onClick={handleSend}
            disabled={addMessageMut.isPending || !replyText.trim()}
            className="gap-1.5"
          >
            {addMessageMut.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            Senden
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Hauptseite ─────────────────────────────────────────────────────────────

export default function FeedbackSupportPage() {
  const { data: raw, isLoading } = useAllSupportConversations();
  const { data: unreadCount = 0 } = useUnreadSupportCountForAdmin();

  // ── Filter-State ──────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"alle" | SupportStatus>(
    "alle",
  );
  const [categoryFilter, setCategoryFilter] = useState<
    "alle" | SupportCategory
  >("alle");
  const [kanzleiFilter, setKanzleiFilter] = useState<string>("alle");

  // ── Expand-State: mehrere Conversations gleichzeitig ausklappbar ──────────
  const [expanded, setExpanded] = useState<Set<SupportConversationId>>(
    new Set(),
  );

  // ── Result entpacken ──────────────────────────────────────────────────────
  const conversations: SupportConversation[] = useMemo(() => {
    if (!raw) return [];
    if (raw.__kind__ === "err") return [];
    return Array.isArray(raw.ok) ? raw.ok : [];
  }, [raw]);

  const loadError = raw && raw.__kind__ === "err" ? raw.err : null;

  // ── Eindeutige Kanzlei-IDs für den Kanzlei-Filter ─────────────────────────
  const kanzleiOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      if (c.kanzleiId) set.add(c.kanzleiId);
    }
    return Array.from(set).sort();
  }, [conversations]);

  // ── Filtern + Sortieren (updatedAt absteigend) ────────────────────────────
  const filtered = useMemo(() => {
    const list = conversations.filter((c) => {
      const statusMatch = statusFilter === "alle" || c.status === statusFilter;
      const categoryMatch =
        categoryFilter === "alle" || c.category === categoryFilter;
      const kanzleiMatch =
        kanzleiFilter === "alle" || c.kanzleiId === kanzleiFilter;
      return statusMatch && categoryMatch && kanzleiMatch;
    });
    // Neueste / zuletzt aktualisierte oben (updatedAt absteigend).
    return [...list].sort((a, b) => Number(b.updatedAt - a.updatedAt));
  }, [conversations, statusFilter, categoryFilter, kanzleiFilter]);

  // ── Expand/Collapse-Toggle ────────────────────────────────────────────────
  function toggleExpand(id: SupportConversationId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ── Ladezustand ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div data-ocid="feedback.page" className="px-6 py-8 space-y-4">
        <div className="flex items-center gap-2">
          <Inbox size={22} className="text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">
            Feedback &amp; Support
          </h1>
        </div>
        <div data-ocid="feedback.loading" className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // ── Fehlerzustand (Result err) ─────────────────────────────────────────────
  if (loadError) {
    return (
      <div data-ocid="feedback.page" className="px-6 py-8 space-y-4">
        <div className="flex items-center gap-2">
          <Inbox size={22} className="text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">
            Feedback &amp; Support
          </h1>
        </div>
        <div
          data-ocid="feedback.error_state"
          className="text-sm text-destructive py-4 px-4 rounded-md border border-destructive/30 bg-destructive/5"
        >
          Fehler beim Laden der Conversations: {loadError}
        </div>
      </div>
    );
  }

  // ── Hauptansicht ──────────────────────────────────────────────────────────
  const titleSuffix = unreadCount > 0 ? ` (${unreadCount})` : "";

  return (
    <div data-ocid="feedback.page" className="space-y-4 px-6 py-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <Inbox size={22} className="text-primary" />
        <h1
          className="text-2xl font-display font-bold text-foreground"
          data-ocid="feedback.title"
        >
          Feedback &amp; Support{titleSuffix}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Admin-Inbox für Feedback, Fragen, Fehler und Verbesserungsvorschläge
        aller Kanzleien.
      </p>

      {/* ── Filter-Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Status:
          </span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as "alle" | SupportStatus)}
          >
            <SelectTrigger
              data-ocid="feedback.status_filter"
              className="h-8 text-sm w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Status</SelectItem>
              <SelectItem value={SupportStatusEnum.neu}>Neu</SelectItem>
              <SelectItem value={SupportStatusEnum.in_bearbeitung}>
                In Bearbeitung
              </SelectItem>
              <SelectItem value={SupportStatusEnum.erledigt}>
                Erledigt
              </SelectItem>
              <SelectItem value={SupportStatusEnum.archiviert}>
                Archiviert
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Kategorie:
          </span>
          <Select
            value={categoryFilter}
            onValueChange={(v) =>
              setCategoryFilter(v as "alle" | SupportCategory)
            }
          >
            <SelectTrigger
              data-ocid="feedback.category_filter"
              className="h-8 text-sm w-48"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Kategorien</SelectItem>
              <SelectItem value={SupportCategoryEnum.feedback}>
                Feedback
              </SelectItem>
              <SelectItem value={SupportCategoryEnum.frage}>Frage</SelectItem>
              <SelectItem value={SupportCategoryEnum.fehler}>Fehler</SelectItem>
              <SelectItem value={SupportCategoryEnum.verbesserungsvorschlag}>
                Verbesserungsvorschlag
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Kanzlei:
          </span>
          <Select
            value={kanzleiFilter}
            onValueChange={(v) => setKanzleiFilter(v)}
          >
            <SelectTrigger
              data-ocid="feedback.kanzlei_filter"
              className="h-8 text-sm w-56"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Kanzleien</SelectItem>
              {kanzleiOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} von {conversations.length} Conversations
        </div>
      </div>

      {/* ── Inbox-Tabelle ──────────────────────────────────────────────────── */}
      <Card data-ocid="feedback.inbox_card" className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <Inbox size={16} className="text-primary" />
            Conversations
            {conversations.length > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {conversations.length}{" "}
                {conversations.length === 1 ? "Conversation" : "Conversations"}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div
              data-ocid="feedback.empty_state"
              className="flex flex-col items-center justify-center py-16 px-6 gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Inbox size={22} className="text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">Keine Conversations</p>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                {conversations.length === 0
                  ? "Es sind derzeit keine Feedback- oder Support-Anfragen vorhanden."
                  : "Keine Conversations passen auf die aktiven Filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-ocid="feedback.inbox_table">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-medium w-10" />
                    <TableHead className="font-medium">Status</TableHead>
                    <TableHead className="font-medium">Kategorie</TableHead>
                    <TableHead className="font-medium">Betreff</TableHead>
                    <TableHead className="font-medium">Kanzlei</TableHead>
                    <TableHead className="font-medium">Absender</TableHead>
                    <TableHead className="font-medium">Bereich/Route</TableHead>
                    <TableHead className="font-medium">Eingang</TableHead>
                    <TableHead className="font-medium">
                      Letzter Update
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((conv, idx) => {
                    const isExpanded = expanded.has(conv.id);
                    const unread = isUnreadForAdmin(conv);
                    return (
                      <Fragment key={conv.id}>
                        <TableRow
                          data-ocid={`feedback.row.${idx + 1}`}
                          className={
                            (unread ? "feedback-row-unread " : "") +
                            (idx % 2 === 1
                              ? "bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
                              : "hover:bg-muted/40 transition-colors cursor-pointer")
                          }
                          onClick={() => toggleExpand(conv.id)}
                        >
                          <TableCell className="whitespace-nowrap">
                            <button
                              type="button"
                              aria-label={
                                isExpanded
                                  ? `Zeile für ${conv.subject || "Conversation"} einklappen`
                                  : `Zeile für ${conv.subject || "Conversation"} ausklappen`
                              }
                              aria-expanded={isExpanded}
                              data-ocid={`feedback.row.${idx + 1}.toggle`}
                              className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                              {isExpanded ? (
                                <ChevronDown size={16} />
                              ) : (
                                <ChevronRight size={16} />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {unread && (
                                <span
                                  className="feedback-unread-dot"
                                  aria-label="ungelesen"
                                  title="ungelesen"
                                  data-ocid={`feedback.row.${idx + 1}.unread_dot`}
                                />
                              )}
                              <StatusBadge status={conv.status} />
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <CategoryBadge category={conv.category} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium text-foreground max-w-[260px] truncate">
                            <span className="feedback-row-title">
                              {conv.subject || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono max-w-[140px] truncate">
                            {conv.kanzleiId || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-foreground">
                            {conv.createdByUserName || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono max-w-[160px] truncate">
                            {conv.appRoute || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateNs(conv.createdAt)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateNs(conv.updatedAt)}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow
                            data-ocid={`feedback.row.${idx + 1}.expanded`}
                            className="bg-muted/10 hover:bg-transparent"
                          >
                            <TableCell colSpan={9} className="p-0">
                              <div className="border-t border-border">
                                <ConversationDetail
                                  conversationId={conv.id}
                                  rowIndex={idx}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
