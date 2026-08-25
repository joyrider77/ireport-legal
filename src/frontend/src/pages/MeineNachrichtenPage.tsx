import type {
  SupportCategory,
  SupportConversation,
  SupportMessage,
  SupportSenderType,
  SupportStatus,
} from "@/backend";
import {
  useAddSupportMessage,
  useMarkSupportMessageRead,
  useMySupportConversations,
  useSupportConversation,
  useUnreadSupportCountForUser,
} from "@/utils/backend";
import { useState } from "react";
import { toast } from "sonner";

const statusLabel: Record<SupportStatus, string> = {
  neu: "Neu",
  in_bearbeitung: "In Bearbeitung",
  erledigt: "Erledigt",
  archiviert: "Archiviert",
};

const categoryLabel: Record<SupportCategory, string> = {
  feedback: "Feedback",
  frage: "Frage",
  fehler: "Fehler",
  verbesserungsvorschlag: "Verbesserungsvorschlag",
};

const statusBadgeClass: Record<SupportStatus, string> = {
  neu: "badge-feedback-neu",
  in_bearbeitung: "badge-feedback-in-bearbeitung",
  erledigt: "badge-feedback-erledigt",
  archiviert: "badge-feedback-archiviert",
};

function formatDateTime(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function senderLabel(senderType: SupportSenderType): string {
  return senderType === "user" ? "Benutzer" : "Plattform-Support";
}

export default function MeineNachrichtenPage() {
  const conversationsQuery = useMySupportConversations();
  const unreadCountQuery = useUnreadSupportCountForUser();
  const conversations: SupportConversation[] = conversationsQuery.data ?? [];
  const unreadCount: number = unreadCountQuery.data ?? 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedIds, setOpenedIds] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState("");

  const detailQuery = useSupportConversation(selectedId ?? "");
  const detail = detailQuery.data ?? null;
  const addMessage = useAddSupportMessage();
  const markRead = useMarkSupportMessageRead();

  const sortedConversations: SupportConversation[] = [...conversations].sort(
    (a, b) => Number(b.updatedAt - a.updatedAt),
  );

  function handleSelect(id: string) {
    setSelectedId(id);
    setOpenedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    markRead.mutate(id, {
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        toast.error(msg);
      },
    });
  }

  function handleReplySubmit() {
    if (!selectedId) return;
    const trimmed = replyText.trim();
    if (!trimmed) return;
    addMessage.mutate(
      { conversationId: selectedId, message: trimmed },
      {
        onSuccess: () => {
          setReplyText("");
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
          toast.error(msg);
        },
      },
    );
  }

  const detailConversation =
    detail && detail.__kind__ === "ok" ? detail.ok.conversation : null;
  const detailMessages: SupportMessage[] =
    detail && detail.__kind__ === "ok" ? detail.ok.messages : [];
  const detailError = detail && detail.__kind__ === "err" ? detail.err : null;

  if (detailError) {
    toast.error(detailError);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Meine Nachrichten
          {unreadCount && unreadCount > 0 ? (
            <span className="ml-2 text-muted-foreground">({unreadCount})</span>
          ) : null}
        </h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section data-ocid="meine-nachrichten.list" className="space-y-2">
          {sortedConversations.length === 0 ? (
            <p className="text-muted-foreground">
              Keine Nachrichten vorhanden.
            </p>
          ) : (
            sortedConversations.map((c) => {
              const isSelected = c.id === selectedId;
              const isUnread = !openedIds.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  data-ocid={`meine-nachrichten.row.${c.id}`}
                  className={[
                    "flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left shadow-subtle transition hover:bg-accent",
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-border",
                    isUnread ? "feedback-row-unread" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {isUnread ? (
                    <span className="feedback-unread-dot" aria-hidden="true" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {c.subject}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {categoryLabel[c.category]}
                    </div>
                  </div>
                  <span className={statusBadgeClass[c.status]}>
                    {statusLabel[c.status]}
                  </span>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>erstellt: {formatDateTime(c.createdAt)}</div>
                    <div>aktualisiert: {formatDateTime(c.updatedAt)}</div>
                  </div>
                </button>
              );
            })
          )}
        </section>

        <section data-ocid="meine-nachrichten.detail" className="space-y-4">
          {!selectedId ? (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">
              Wählen Sie eine Unterhaltung aus, um die Details anzuzeigen.
            </div>
          ) : !detail ? (
            <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
              Wird geladen…
            </div>
          ) : detailError || !detailConversation ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center text-destructive">
              Die Unterhaltung konnte nicht geladen werden.
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border bg-card p-4 shadow-subtle">
                <h2 className="text-lg font-semibold text-foreground">
                  {detailConversation.subject}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span>{categoryLabel[detailConversation.category]}</span>
                  <span className={statusBadgeClass[detailConversation.status]}>
                    {statusLabel[detailConversation.status]}
                  </span>
                  <span>
                    erstellt: {formatDateTime(detailConversation.createdAt)}
                  </span>
                  <span>
                    aktualisiert: {formatDateTime(detailConversation.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="feedback-thread space-y-3 max-h-[40vh] overflow-y-auto rounded-md border border-border bg-background p-4">
                {detailMessages.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    Keine Nachrichten.
                  </p>
                ) : (
                  detailMessages
                    .slice()
                    .sort((a, b) => Number(a.createdAt - b.createdAt))
                    .map((m) => (
                      <div
                        key={m.id}
                        className={
                          m.senderType === "user"
                            ? "feedback-bubble feedback-bubble-user"
                            : "feedback-bubble feedback-bubble-admin"
                        }
                      >
                        <div className="feedback-bubble-meta">
                          {senderLabel(m.senderType)} ·{" "}
                          {formatDateTime(m.createdAt)}
                        </div>
                        <div className="whitespace-pre-wrap">{m.message}</div>
                      </div>
                    ))
                )}
              </div>

              <div className="space-y-2">
                <textarea
                  data-ocid="meine-nachrichten.reply-input"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Antwort schreiben…"
                  rows={4}
                  className="w-full rounded-md border border-border bg-card p-3 text-sm text-foreground shadow-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  data-ocid="meine-nachrichten.reply-send"
                  onClick={handleReplySubmit}
                  disabled={!replyText.trim() || addMessage.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Senden
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
