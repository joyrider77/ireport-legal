import { c as createLucideIcon, ax as useAllSupportConversations, ay as useUnreadSupportCountForAdmin, r as reactExports, j as jsxRuntimeExports, az as Inbox, a2 as Skeleton, ah as Select, ai as SelectTrigger, aj as SelectValue, ak as SelectContent, al as SelectItem, aA as SupportStatus, aB as SupportCategory, af as Card, aC as CardHeader, aD as CardTitle, ag as CardContent, aE as Table, aF as TableHeader, aG as TableRow, aH as TableHead, aI as TableBody, aJ as TableCell, C as ChevronDown, a8 as ChevronRight, aK as Badge, au as useSupportConversation, av as useAddSupportMessage, aL as useUpdateSupportStatus, aw as useMarkSupportMessageRead, ae as ue, aM as MessageSquare, aN as SupportSenderType, ac as Textarea, a4 as LoaderCircle, a3 as Button } from "./index-DHJUCbX-.js";
/**
 * @license lucide-react v0.511.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
const __iconNode = [
  [
    "path",
    {
      d: "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",
      key: "1ffxy3"
    }
  ],
  ["path", { d: "m21.854 2.147-10.94 10.939", key: "12cjpa" }]
];
const Send = createLucideIcon("send", __iconNode);
function formatDateTimeNs(ns) {
  if (ns === void 0 || ns === null) return "—";
  const ms = Number(ns / 1000000n);
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
function formatDateNs(ns) {
  if (ns === void 0 || ns === null) return "—";
  const ms = Number(ns / 1000000n);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}
const STATUS_LABELS = {
  [SupportStatus.neu]: "Neu",
  [SupportStatus.in_bearbeitung]: "In Bearbeitung",
  [SupportStatus.erledigt]: "Erledigt",
  [SupportStatus.archiviert]: "Archiviert"
};
const STATUS_BADGE_CLASS = {
  [SupportStatus.neu]: "badge-feedback-neu",
  [SupportStatus.in_bearbeitung]: "badge-feedback-in-bearbeitung",
  [SupportStatus.erledigt]: "badge-feedback-erledigt",
  [SupportStatus.archiviert]: "badge-feedback-archiviert"
};
const CATEGORY_LABELS = {
  [SupportCategory.feedback]: "Feedback",
  [SupportCategory.frage]: "Frage",
  [SupportCategory.fehler]: "Fehler",
  [SupportCategory.verbesserungsvorschlag]: "Verbesserungsvorschlag"
};
const SENDER_LABELS = {
  [SupportSenderType.user]: "Benutzer",
  [SupportSenderType.platformAdmin]: "Plattform-Support"
};
function StatusBadge({ status }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "span",
    {
      className: STATUS_BADGE_CLASS[status] ?? "badge-neutral",
      "data-ocid": `feedback.status_badge.${status}`,
      children: STATUS_LABELS[status] ?? status
    }
  );
}
function CategoryBadge({ category }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(Badge, { variant: "outline", className: "text-xs font-medium", children: CATEGORY_LABELS[category] ?? category });
}
function isUnreadForAdmin(conv) {
  return conv.status === SupportStatus.neu;
}
function ConversationDetail({
  conversationId,
  rowIndex
}) {
  const {
    data: raw,
    isLoading,
    isError,
    error
  } = useSupportConversation(conversationId);
  const addMessageMut = useAddSupportMessage();
  const updateStatusMut = useUpdateSupportStatus();
  const markReadMut = useMarkSupportMessageRead();
  const [replyText, setReplyText] = reactExports.useState("");
  reactExports.useEffect(() => {
    if (!conversationId) return;
    markReadMut.mutate(conversationId, {
      onError: (e) => ue.error(`Als gelesen markieren fehlgeschlagen: ${e.message}`)
    });
  }, [conversationId]);
  const detail = reactExports.useMemo(() => {
    if (!raw) return null;
    if (raw.__kind__ === "err") return null;
    return raw.ok;
  }, [raw]);
  const loadError = raw && raw.__kind__ === "err" ? raw.err : isError ? error instanceof Error ? error.message : "unbekannt" : null;
  const sortedMessages = reactExports.useMemo(() => {
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
          ue.success("Antwort gesendet");
        },
        onError: (e) => ue.error(`Senden fehlgeschlagen: ${e.message}`)
      }
    );
  }
  function handleStatusChange(newStatus) {
    updateStatusMut.mutate(
      { conversationId, newStatus },
      {
        onSuccess: () => ue.success(`Status geändert auf „${STATUS_LABELS[newStatus]}"`),
        onError: (e) => ue.error(`Statusänderung fehlgeschlagen: ${e.message}`)
      }
    );
  }
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        "data-ocid": `feedback.conversation.${rowIndex + 1}.loading`,
        className: "p-4 space-y-3",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-6 w-3/4" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-4 w-1/2" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-24 w-full" })
        ]
      }
    );
  }
  if (loadError) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        "data-ocid": `feedback.conversation.${rowIndex + 1}.error`,
        className: "p-4 text-sm text-destructive",
        children: [
          "Fehler beim Laden der Conversation: ",
          loadError
        ]
      }
    );
  }
  if (!detail) return null;
  const conv = detail.conversation;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      "data-ocid": `feedback.conversation.${rowIndex + 1}.detail`,
      className: "p-4 space-y-4",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-md border border-border bg-muted/20 p-4 space-y-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start justify-between gap-3 flex-wrap", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("h4", { className: "font-display text-base font-semibold text-foreground break-words", children: conv.subject || "—" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: [
                "Conversation-ID: ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono", children: conv.id })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(StatusBadge, { status: conv.status }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(CategoryBadge, { category: conv.category })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("dl", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-sm pt-2 border-t border-border", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground uppercase tracking-wide", children: "Kanzlei" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground font-mono text-xs break-all", children: conv.kanzleiId || "—" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground uppercase tracking-wide", children: "Absender" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground", children: conv.createdByUserName || "—" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground uppercase tracking-wide", children: "Erstellungszeit" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground", children: formatDateTimeNs(conv.createdAt) })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground uppercase tracking-wide", children: "App-Seite / Route" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground font-mono text-xs break-all", children: conv.appRoute || "—" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground uppercase tracking-wide", children: "App-Version" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground font-mono text-xs", children: conv.appVersion || "—" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: "text-xs text-muted-foreground uppercase tracking-wide", children: "Letzter Update" }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("dd", { className: "text-foreground", children: formatDateTimeNs(conv.updatedAt) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("h5", { className: "font-display text-sm font-semibold text-foreground flex items-center gap-2 mb-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(MessageSquare, { size: 14, className: "text-primary" }),
            "Nachrichtenverlauf (",
            sortedMessages.length,
            ")"
          ] }),
          sortedMessages.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx(
            "p",
            {
              "data-ocid": `feedback.conversation.${rowIndex + 1}.messages_empty`,
              className: "text-sm text-muted-foreground py-4 text-center",
              children: "Keine Nachrichten vorhanden."
            }
          ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              "data-ocid": `feedback.conversation.${rowIndex + 1}.thread`,
              className: "feedback-thread max-h-[320px] overflow-y-auto pr-1",
              children: sortedMessages.map((msg, mIdx) => {
                const isUser = msg.senderType === SupportSenderType.user;
                return /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  "div",
                  {
                    "data-ocid": `feedback.conversation.${rowIndex + 1}.message.${mIdx + 1}`,
                    className: `feedback-bubble ${isUser ? "feedback-bubble-user" : "feedback-bubble-admin"}`,
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "feedback-bubble-meta", children: [
                        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: SENDER_LABELS[msg.senderType] ?? msg.senderType }),
                        " · ",
                        formatDateTimeNs(msg.createdAt)
                      ] }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "whitespace-pre-wrap break-words mt-0.5", children: msg.message })
                    ]
                  },
                  msg.id
                );
              })
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3 pt-2 border-t border-border", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "label",
              {
                htmlFor: `feedback-reply-${rowIndex}`,
                className: "text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block",
                children: "Antwort als Plattform-Support"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              Textarea,
              {
                id: `feedback-reply-${rowIndex}`,
                "data-ocid": `feedback.conversation.${rowIndex + 1}.reply_input`,
                value: replyText,
                onChange: (e) => setReplyText(e.target.value),
                rows: 3,
                placeholder: "Antwort eingeben…",
                disabled: addMessageMut.isPending
              }
            )
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-end justify-between gap-3 flex-wrap", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Status:" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                Select,
                {
                  value: conv.status,
                  onValueChange: (v) => handleStatusChange(v),
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx(
                      SelectTrigger,
                      {
                        "data-ocid": `feedback.conversation.${rowIndex + 1}.status_select`,
                        className: "h-8 text-sm w-44",
                        children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {})
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.neu, children: "Neu" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.in_bearbeitung, children: "In Bearbeitung" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.erledigt, children: "Erledigt" }),
                      /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.archiviert, children: "Archiviert" })
                    ] })
                  ]
                }
              ),
              updateStatusMut.isPending && /* @__PURE__ */ jsxRuntimeExports.jsx(
                LoaderCircle,
                {
                  size: 14,
                  className: "animate-spin text-muted-foreground"
                }
              )
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              Button,
              {
                type: "button",
                "data-ocid": `feedback.conversation.${rowIndex + 1}.send_button`,
                onClick: handleSend,
                disabled: addMessageMut.isPending || !replyText.trim(),
                className: "gap-1.5",
                children: [
                  addMessageMut.isPending ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { size: 14, className: "animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Send, { size: 14 }),
                  "Senden"
                ]
              }
            )
          ] })
        ] })
      ]
    }
  );
}
function FeedbackSupportPage() {
  const { data: raw, isLoading } = useAllSupportConversations();
  const { data: unreadCount = 0 } = useUnreadSupportCountForAdmin();
  const [statusFilter, setStatusFilter] = reactExports.useState(
    "alle"
  );
  const [categoryFilter, setCategoryFilter] = reactExports.useState("alle");
  const [kanzleiFilter, setKanzleiFilter] = reactExports.useState("alle");
  const [expanded, setExpanded] = reactExports.useState(
    /* @__PURE__ */ new Set()
  );
  const conversations = reactExports.useMemo(() => {
    if (!raw) return [];
    if (raw.__kind__ === "err") return [];
    return Array.isArray(raw.ok) ? raw.ok : [];
  }, [raw]);
  const loadError = raw && raw.__kind__ === "err" ? raw.err : null;
  const kanzleiOptions = reactExports.useMemo(() => {
    const set = /* @__PURE__ */ new Set();
    for (const c of conversations) {
      if (c.kanzleiId) set.add(c.kanzleiId);
    }
    return Array.from(set).sort();
  }, [conversations]);
  const filtered = reactExports.useMemo(() => {
    const list = conversations.filter((c) => {
      const statusMatch = statusFilter === "alle" || c.status === statusFilter;
      const categoryMatch = categoryFilter === "alle" || c.category === categoryFilter;
      const kanzleiMatch = kanzleiFilter === "alle" || c.kanzleiId === kanzleiFilter;
      return statusMatch && categoryMatch && kanzleiMatch;
    });
    return [...list].sort((a, b) => Number(b.updatedAt - a.updatedAt));
  }, [conversations, statusFilter, categoryFilter, kanzleiFilter]);
  function toggleExpand(id) {
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
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": "feedback.page", className: "px-6 py-8 space-y-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Inbox, { size: 22, className: "text-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-display font-bold text-foreground", children: "Feedback & Support" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { "data-ocid": "feedback.loading", className: "space-y-3", children: Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholder
        /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-10 w-full" }, i)
      )) })
    ] });
  }
  if (loadError) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": "feedback.page", className: "px-6 py-8 space-y-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Inbox, { size: 22, className: "text-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-display font-bold text-foreground", children: "Feedback & Support" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          "data-ocid": "feedback.error_state",
          className: "text-sm text-destructive py-4 px-4 rounded-md border border-destructive/30 bg-destructive/5",
          children: [
            "Fehler beim Laden der Conversations: ",
            loadError
          ]
        }
      )
    ] });
  }
  const titleSuffix = unreadCount > 0 ? ` (${unreadCount})` : "";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { "data-ocid": "feedback.page", className: "space-y-4 px-6 py-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Inbox, { size: 22, className: "text-primary" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "h1",
        {
          className: "text-2xl font-display font-bold text-foreground",
          "data-ocid": "feedback.title",
          children: [
            "Feedback & Support",
            titleSuffix
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground -mt-2", children: "Admin-Inbox für Feedback, Fragen, Fehler und Verbesserungsvorschläge aller Kanzleien." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Status:" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Select,
          {
            value: statusFilter,
            onValueChange: (v) => setStatusFilter(v),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                SelectTrigger,
                {
                  "data-ocid": "feedback.status_filter",
                  className: "h-8 text-sm w-44",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {})
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "alle", children: "Alle Status" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.neu, children: "Neu" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.in_bearbeitung, children: "In Bearbeitung" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.erledigt, children: "Erledigt" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportStatus.archiviert, children: "Archiviert" })
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Kategorie:" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Select,
          {
            value: categoryFilter,
            onValueChange: (v) => setCategoryFilter(v),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                SelectTrigger,
                {
                  "data-ocid": "feedback.category_filter",
                  className: "h-8 text-sm w-48",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {})
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "alle", children: "Alle Kategorien" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportCategory.feedback, children: "Feedback" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportCategory.frage, children: "Frage" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportCategory.fehler, children: "Fehler" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: SupportCategory.verbesserungsvorschlag, children: "Verbesserungsvorschlag" })
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs font-medium text-muted-foreground uppercase tracking-wide", children: "Kanzlei:" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(
          Select,
          {
            value: kanzleiFilter,
            onValueChange: (v) => setKanzleiFilter(v),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                SelectTrigger,
                {
                  "data-ocid": "feedback.kanzlei_filter",
                  className: "h-8 text-sm w-56",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {})
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectContent, { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: "alle", children: "Alle Kanzleien" }),
                kanzleiOptions.map((k) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: k, children: k }, k))
              ] })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ml-auto text-xs text-muted-foreground", children: [
        filtered.length,
        " von ",
        conversations.length,
        " Conversations"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": "feedback.inbox_card", className: "overflow-hidden", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardHeader, { className: "border-b border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(CardTitle, { className: "font-display text-base flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Inbox, { size: 16, className: "text-primary" }),
        "Conversations",
        conversations.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-1 text-xs font-normal text-muted-foreground", children: [
          conversations.length,
          " ",
          conversations.length === 1 ? "Conversation" : "Conversations"
        ] })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "p-0", children: filtered.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          "data-ocid": "feedback.empty_state",
          className: "flex flex-col items-center justify-center py-16 px-6 gap-3",
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "w-12 h-12 rounded-full bg-muted flex items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Inbox, { size: 22, className: "text-muted-foreground" }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "font-medium text-foreground", children: "Keine Conversations" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground text-center max-w-md", children: conversations.length === 0 ? "Es sind derzeit keine Feedback- oder Support-Anfragen vorhanden." : "Keine Conversations passen auf die aktiven Filter." })
          ]
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Table, { "data-ocid": "feedback.inbox_table", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TableHeader, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs(TableRow, { className: "bg-muted/40", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium w-10" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Status" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Kategorie" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Betreff" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Kanzlei" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Absender" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Bereich/Route" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Eingang" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(TableHead, { className: "font-medium", children: "Letzter Update" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(TableBody, { children: filtered.map((conv, idx) => {
          const isExpanded = expanded.has(conv.id);
          const unread = isUnreadForAdmin(conv);
          return /* @__PURE__ */ jsxRuntimeExports.jsxs(reactExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              TableRow,
              {
                "data-ocid": `feedback.row.${idx + 1}`,
                className: (unread ? "feedback-row-unread " : "") + (idx % 2 === 1 ? "bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer" : "hover:bg-muted/40 transition-colors cursor-pointer"),
                onClick: () => toggleExpand(conv.id),
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    "button",
                    {
                      type: "button",
                      "aria-label": isExpanded ? `Zeile für ${conv.subject || "Conversation"} einklappen` : `Zeile für ${conv.subject || "Conversation"} ausklappen`,
                      "aria-expanded": isExpanded,
                      "data-ocid": `feedback.row.${idx + 1}.toggle`,
                      className: "flex items-center justify-center w-7 h-7 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
                      children: isExpanded ? /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { size: 16 }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { size: 16 })
                    }
                  ) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5", children: [
                    unread && /* @__PURE__ */ jsxRuntimeExports.jsx(
                      "span",
                      {
                        className: "feedback-unread-dot",
                        "aria-label": "ungelesen",
                        title: "ungelesen",
                        "data-ocid": `feedback.row.${idx + 1}.unread_dot`
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsx(StatusBadge, { status: conv.status })
                  ] }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(CategoryBadge, { category: conv.category }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap text-sm font-medium text-foreground max-w-[260px] truncate", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "feedback-row-title", children: conv.subject || "—" }) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap text-xs text-muted-foreground font-mono max-w-[140px] truncate", children: conv.kanzleiId || "—" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap text-sm text-foreground", children: conv.createdByUserName || "—" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap text-xs text-muted-foreground font-mono max-w-[160px] truncate", children: conv.appRoute || "—" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap text-sm text-muted-foreground", children: formatDateNs(conv.createdAt) }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { className: "whitespace-nowrap text-sm text-muted-foreground", children: formatDateNs(conv.updatedAt) })
                ]
              }
            ),
            isExpanded && /* @__PURE__ */ jsxRuntimeExports.jsx(
              TableRow,
              {
                "data-ocid": `feedback.row.${idx + 1}.expanded`,
                className: "bg-muted/10 hover:bg-transparent",
                children: /* @__PURE__ */ jsxRuntimeExports.jsx(TableCell, { colSpan: 9, className: "p-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  ConversationDetail,
                  {
                    conversationId: conv.id,
                    rowIndex: idx
                  }
                ) }) })
              }
            )
          ] }, conv.id);
        }) })
      ] }) }) })
    ] })
  ] });
}
export {
  FeedbackSupportPage as default
};
