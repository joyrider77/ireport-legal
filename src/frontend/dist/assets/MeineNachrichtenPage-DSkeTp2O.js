import { as as useMySupportConversations, at as useUnreadSupportCountForUser, r as reactExports, au as useSupportConversation, av as useAddSupportMessage, aw as useMarkSupportMessageRead, ae as ue, j as jsxRuntimeExports } from "./index-DHJUCbX-.js";
const statusLabel = {
  neu: "Neu",
  in_bearbeitung: "In Bearbeitung",
  erledigt: "Erledigt",
  archiviert: "Archiviert"
};
const categoryLabel = {
  feedback: "Feedback",
  frage: "Frage",
  fehler: "Fehler",
  verbesserungsvorschlag: "Verbesserungsvorschlag"
};
const statusBadgeClass = {
  neu: "badge-feedback-neu",
  in_bearbeitung: "badge-feedback-in-bearbeitung",
  erledigt: "badge-feedback-erledigt",
  archiviert: "badge-feedback-archiviert"
};
function formatDateTime(ns) {
  const ms = Number(ns / 1000000n);
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function senderLabel(senderType) {
  return senderType === "user" ? "Benutzer" : "Plattform-Support";
}
function MeineNachrichtenPage() {
  const conversationsQuery = useMySupportConversations();
  const unreadCountQuery = useUnreadSupportCountForUser();
  const conversations = conversationsQuery.data ?? [];
  const unreadCount = unreadCountQuery.data ?? 0;
  const [selectedId, setSelectedId] = reactExports.useState(null);
  const [openedIds, setOpenedIds] = reactExports.useState(/* @__PURE__ */ new Set());
  const [replyText, setReplyText] = reactExports.useState("");
  const detailQuery = useSupportConversation(selectedId ?? "");
  const detail = detailQuery.data ?? null;
  const addMessage = useAddSupportMessage();
  const markRead = useMarkSupportMessageRead();
  const sortedConversations = [...conversations].sort(
    (a, b) => Number(b.updatedAt - a.updatedAt)
  );
  function handleSelect(id) {
    setSelectedId(id);
    setOpenedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    markRead.mutate(id, {
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        ue.error(msg);
      }
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
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
          ue.error(msg);
        }
      }
    );
  }
  const detailConversation = detail && detail.__kind__ === "ok" ? detail.ok.conversation : null;
  const detailMessages = detail && detail.__kind__ === "ok" ? detail.ok.messages : [];
  const detailError = detail && detail.__kind__ === "err" ? detail.err : null;
  if (detailError) {
    ue.error(detailError);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto w-full max-w-6xl px-4 py-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("header", { className: "mb-6", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("h1", { className: "text-2xl font-semibold text-foreground", children: [
      "Meine Nachrichten",
      unreadCount && unreadCount > 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-2 text-muted-foreground", children: [
        "(",
        unreadCount,
        ")"
      ] }) : null
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("section", { "data-ocid": "meine-nachrichten.list", className: "space-y-2", children: sortedConversations.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-muted-foreground", children: "Keine Nachrichten vorhanden." }) : sortedConversations.map((c) => {
        const isSelected = c.id === selectedId;
        const isUnread = !openedIds.has(c.id);
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "button",
          {
            type: "button",
            onClick: () => handleSelect(c.id),
            "data-ocid": `meine-nachrichten.row.${c.id}`,
            className: [
              "flex w-full items-center gap-3 rounded-md border bg-card p-3 text-left shadow-subtle transition hover:bg-accent",
              isSelected ? "border-primary ring-1 ring-primary" : "border-border",
              isUnread ? "feedback-row-unread" : ""
            ].filter(Boolean).join(" "),
            children: [
              isUnread ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "feedback-unread-dot", "aria-hidden": "true" }) : null,
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "truncate font-medium text-foreground", children: c.subject }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm text-muted-foreground", children: categoryLabel[c.category] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: statusBadgeClass[c.status], children: statusLabel[c.status] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-right text-xs text-muted-foreground", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  "erstellt: ",
                  formatDateTime(c.createdAt)
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  "aktualisiert: ",
                  formatDateTime(c.updatedAt)
                ] })
              ] })
            ]
          },
          c.id
        );
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("section", { "data-ocid": "meine-nachrichten.detail", className: "space-y-4", children: !selectedId ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-md border border-dashed border-border p-8 text-center text-muted-foreground", children: "Wählen Sie eine Unterhaltung aus, um die Details anzuzeigen." }) : !detail ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-md border border-border p-8 text-center text-muted-foreground", children: "Wird geladen…" }) : detailError || !detailConversation ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-md border border-destructive/40 bg-destructive/5 p-8 text-center text-destructive", children: "Die Unterhaltung konnte nicht geladen werden." }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-md border border-border bg-card p-4 shadow-subtle", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold text-foreground", children: detailConversation.subject }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: categoryLabel[detailConversation.category] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: statusBadgeClass[detailConversation.status], children: statusLabel[detailConversation.status] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "erstellt: ",
              formatDateTime(detailConversation.createdAt)
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "aktualisiert: ",
              formatDateTime(detailConversation.updatedAt)
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "feedback-thread space-y-3 max-h-[40vh] overflow-y-auto rounded-md border border-border bg-background p-4", children: detailMessages.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-center text-muted-foreground", children: "Keine Nachrichten." }) : detailMessages.slice().sort((a, b) => Number(a.createdAt - b.createdAt)).map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: m.senderType === "user" ? "feedback-bubble feedback-bubble-user" : "feedback-bubble feedback-bubble-admin",
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feedback-bubble-meta", children: [
                senderLabel(m.senderType),
                " ·",
                " ",
                formatDateTime(m.createdAt)
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "whitespace-pre-wrap", children: m.message })
            ]
          },
          m.id
        )) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "textarea",
            {
              "data-ocid": "meine-nachrichten.reply-input",
              value: replyText,
              onChange: (e) => setReplyText(e.target.value),
              placeholder: "Antwort schreiben…",
              rows: 4,
              className: "w-full rounded-md border border-border bg-card p-3 text-sm text-foreground shadow-subtle focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              type: "button",
              "data-ocid": "meine-nachrichten.reply-send",
              onClick: handleReplySubmit,
              disabled: !replyText.trim() || addMessage.isPending,
              className: "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-subtle transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50",
              children: "Senden"
            }
          )
        ] })
      ] }) })
    ] })
  ] });
}
export {
  MeineNachrichtenPage as default
};
