import { a0 as useGetKanzleiStammdaten, aq as useUpdateKanzleiStammdaten, r as reactExports, j as jsxRuntimeExports, a2 as Skeleton, a3 as Button, a4 as LoaderCircle, ab as Input, ar as Building2, a7 as Trash2, ae as ue, af as Card, ag as CardContent, aa as Label } from "./index-DHJUCbX-.js";
import { S as Save, U as Upload, I as Image } from "./upload-EMtQ2-Aw.js";
const REQUIRED_FIELDS = [
  "kanzleiname",
  "strasseHausnummer",
  "plz",
  "ort",
  "land"
];
const FIELD_LABELS = {
  kanzleiname: "Kanzleiname",
  strasseHausnummer: "Strasse / Hausnummer",
  plz: "PLZ",
  ort: "Ort",
  land: "Land",
  telefon: "Telefon",
  email: "E-Mail",
  website: "Website",
  uid: "UID",
  mwstNr: "MWST-Nr.",
  kanzleiLogoBlob: "Kanzlei-Logo"
};
const EMPTY_STAMMDATEN = {
  kanzleiname: "",
  strasseHausnummer: "",
  plz: "",
  ort: "",
  land: "",
  telefon: "",
  email: "",
  website: "",
  uid: "",
  mwstNr: "",
  kanzleiLogoBlob: void 0
};
function SectionCard({
  title,
  description,
  ocid,
  icon,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(Card, { "data-ocid": ocid, className: "gap-0 py-0", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-start justify-between gap-3 px-5 py-4 border-b border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-start gap-3 min-w-0", children: [
      icon && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary", children: icon }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "font-display font-semibold text-foreground text-base leading-tight", children: title }),
        description && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: description })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(CardContent, { className: "px-5 py-5", children })
  ] });
}
function Field({
  id,
  label,
  required,
  error,
  children,
  className
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `space-y-1.5 ${className ?? ""}`, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { htmlFor: id, className: "text-sm font-medium text-foreground", children: [
      label,
      required && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-destructive ml-0.5", children: "*" })
    ] }),
    children,
    error && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "p",
      {
        "data-ocid": `einstellungen.field_error.${id}`,
        role: "alert",
        className: "text-xs text-destructive",
        children: error
      }
    )
  ] });
}
function EinstellungenPage() {
  const { data: stammdaten, isLoading } = useGetKanzleiStammdaten();
  const updateMut = useUpdateKanzleiStammdaten();
  const [form, setForm] = reactExports.useState(EMPTY_STAMMDATEN);
  const [logoBytes, setLogoBytes] = reactExports.useState(null);
  const [logoUrl, setLogoUrl] = reactExports.useState(null);
  const [logoFileName, setLogoFileName] = reactExports.useState(null);
  const [uploadError, setUploadError] = reactExports.useState(null);
  const [touched, setTouched] = reactExports.useState(/* @__PURE__ */ new Set());
  const [hydrated, setHydrated] = reactExports.useState(false);
  const logoInputRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (stammdaten) {
      setForm(stammdaten);
      if (stammdaten.kanzleiLogoBlob && stammdaten.kanzleiLogoBlob.length > 0) {
        setLogoBytes(stammdaten.kanzleiLogoBlob);
        const blob = new Blob([new Uint8Array(stammdaten.kanzleiLogoBlob)], {
          type: "image/png"
        });
        setLogoUrl(URL.createObjectURL(blob));
        setLogoFileName("gespeichertes Logo");
      }
    } else if (!isLoading) {
      setForm(EMPTY_STAMMDATEN);
    }
    setHydrated(true);
  }, [stammdaten, isLoading]);
  reactExports.useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);
  const errors = reactExports.useMemo(() => {
    const errs = {};
    for (const field of REQUIRED_FIELDS) {
      const value = form[field];
      if (!value || value.trim() === "") {
        errs[field] = `${FIELD_LABELS[field]} ist ein Pflichtfeld.`;
      }
    }
    return errs;
  }, [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const canSave = hydrated && !hasErrors && !updateMut.isPending;
  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }
  function handleBlur(field) {
    setTouched((prev) => new Set(prev).add(field));
  }
  function showError(field) {
    return touched.has(field) ? errors[field] : void 0;
  }
  async function handleLogoUpload(e) {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Bitte eine Bilddatei auswählen (PNG, JPG, SVG).");
      ue.error("Ungültiger Dateityp");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setLogoBytes(bytes);
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
      setLogoFileName(file.name);
      ue.success("Logo geladen — bitte speichern Sie, um es zu übernehmen.");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Logo-Laden fehlgeschlagen"
      );
      ue.error("Logo-Laden fehlgeschlagen");
    }
    e.target.value = "";
  }
  function handleRemoveLogo() {
    setLogoBytes(null);
    setLogoUrl(null);
    setLogoFileName(null);
    setUploadError(null);
    setForm((prev) => ({ ...prev, kanzleiLogoBlob: void 0 }));
    ue.info(
      "Logo entfernt — bitte speichern Sie, um die Änderung zu übernehmen."
    );
  }
  function handleSave() {
    setTouched(new Set(REQUIRED_FIELDS));
    if (hasErrors) {
      ue.error("Bitte füllen Sie alle Pflichtfelder aus.");
      return;
    }
    const toSave = {
      ...form,
      // kanzleiLogoBlob nur setzen, wenn ein Logo ausgewählt wurde; sonst
      // undefined, damit das Backend ein bestehendes Logo beibehält.
      kanzleiLogoBlob: logoBytes ?? void 0
    };
    updateMut.mutate(toSave, {
      onSuccess: (res) => {
        if (res && typeof res === "object" && "__kind__" in res && res.__kind__ === "err") {
          const errMsg = res.err || "Speichern fehlgeschlagen";
          console.error(
            "[EinstellungenPage] updateKanzleiStammdaten returned #err:",
            errMsg
          );
          ue.error(errMsg);
        } else {
          ue.success("Kanzleidaten gespeichert");
        }
      },
      onError: (e) => {
        const errMsg = e.message || "Speichern fehlgeschlagen";
        console.error(
          "[EinstellungenPage] updateKanzleiStammdaten threw:",
          errMsg
        );
        ue.error(errMsg);
      }
    });
  }
  if (isLoading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        "data-ocid": "einstellungen.loading_state",
        className: "p-6 space-y-6 max-w-4xl mx-auto",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-10 w-64" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-96 w-full" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Skeleton, { className: "h-48 w-full" })
        ]
      }
    );
  }
  const isSaving = updateMut.isPending;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(
    "div",
    {
      "data-ocid": "einstellungen.page",
      className: "p-4 sm:p-6 space-y-6 max-w-4xl mx-auto",
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-4xl mx-auto", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "font-display font-bold text-foreground text-xl tracking-tight", children: "Einstellungen" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground mt-0.5", children: "Verwalten Sie die Kanzleistammdaten — Pflichtfelder sind mit * markiert." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-3 shrink-0", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              "data-ocid": "einstellungen.save_button",
              className: "btn-primary gap-2",
              onClick: handleSave,
              disabled: !canSave,
              children: [
                isSaving ? /* @__PURE__ */ jsxRuntimeExports.jsx(LoaderCircle, { size: 16, className: "animate-spin" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Save, { size: 16 }),
                "Speichern"
              ]
            }
          ) })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          SectionCard,
          {
            ocid: "einstellungen.kanzleidaten_section",
            title: "Kanzleidaten",
            description: "Pflichtfelder für Rechnungen und Korrespondenz.",
            icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Building2, { size: 16 }),
            children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Field,
                {
                  id: "kanzleiname",
                  label: FIELD_LABELS.kanzleiname,
                  required: true,
                  error: showError("kanzleiname"),
                  className: "sm:col-span-2",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "kanzleiname",
                      "data-ocid": "einstellungen.input.kanzleiname",
                      value: form.kanzleiname,
                      onChange: (e) => updateField("kanzleiname", e.target.value),
                      onBlur: () => handleBlur("kanzleiname"),
                      placeholder: "z. B. Kanzlei Müller & Partner",
                      "aria-required": "true",
                      "aria-invalid": !!showError("kanzleiname")
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Field,
                {
                  id: "strasseHausnummer",
                  label: FIELD_LABELS.strasseHausnummer,
                  required: true,
                  error: showError("strasseHausnummer"),
                  className: "sm:col-span-2",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "strasseHausnummer",
                      "data-ocid": "einstellungen.input.strasseHausnummer",
                      value: form.strasseHausnummer,
                      onChange: (e) => updateField("strasseHausnummer", e.target.value),
                      onBlur: () => handleBlur("strasseHausnummer"),
                      placeholder: "z. B. Bahnhofstrasse 12",
                      "aria-required": "true",
                      "aria-invalid": !!showError("strasseHausnummer")
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Field,
                {
                  id: "plz",
                  label: FIELD_LABELS.plz,
                  required: true,
                  error: showError("plz"),
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "plz",
                      "data-ocid": "einstellungen.input.plz",
                      value: form.plz,
                      onChange: (e) => updateField("plz", e.target.value),
                      onBlur: () => handleBlur("plz"),
                      placeholder: "z. B. 8001",
                      "aria-required": "true",
                      "aria-invalid": !!showError("plz")
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Field,
                {
                  id: "ort",
                  label: FIELD_LABELS.ort,
                  required: true,
                  error: showError("ort"),
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "ort",
                      "data-ocid": "einstellungen.input.ort",
                      value: form.ort,
                      onChange: (e) => updateField("ort", e.target.value),
                      onBlur: () => handleBlur("ort"),
                      placeholder: "z. B. Zürich",
                      "aria-required": "true",
                      "aria-invalid": !!showError("ort")
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Field,
                {
                  id: "land",
                  label: FIELD_LABELS.land,
                  required: true,
                  error: showError("land"),
                  className: "sm:col-span-2",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "land",
                      "data-ocid": "einstellungen.input.land",
                      value: form.land,
                      onChange: (e) => updateField("land", e.target.value),
                      onBlur: () => handleBlur("land"),
                      placeholder: "z. B. Schweiz",
                      "aria-required": "true",
                      "aria-invalid": !!showError("land")
                    }
                  )
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { id: "telefon", label: FIELD_LABELS.telefon, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  id: "telefon",
                  "data-ocid": "einstellungen.input.telefon",
                  value: form.telefon ?? "",
                  onChange: (e) => updateField("telefon", e.target.value),
                  placeholder: "z. B. +41 44 123 45 67"
                }
              ) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { id: "email", label: FIELD_LABELS.email, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  id: "email",
                  type: "email",
                  "data-ocid": "einstellungen.input.email",
                  value: form.email ?? "",
                  onChange: (e) => updateField("email", e.target.value),
                  placeholder: "z. B. kontakt@kanzlei.ch"
                }
              ) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { id: "website", label: FIELD_LABELS.website, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  id: "website",
                  "data-ocid": "einstellungen.input.website",
                  value: form.website ?? "",
                  onChange: (e) => updateField("website", e.target.value),
                  placeholder: "z. B. www.kanzlei.ch"
                }
              ) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { id: "uid", label: FIELD_LABELS.uid, children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                Input,
                {
                  id: "uid",
                  "data-ocid": "einstellungen.input.uid",
                  value: form.uid ?? "",
                  onChange: (e) => updateField("uid", e.target.value),
                  placeholder: "z. B. CHE-123.456.789"
                }
              ) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                Field,
                {
                  id: "mwstNr",
                  label: FIELD_LABELS.mwstNr,
                  className: "sm:col-span-2",
                  children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                    Input,
                    {
                      id: "mwstNr",
                      "data-ocid": "einstellungen.input.mwstNr",
                      value: form.mwstNr ?? "",
                      onChange: (e) => updateField("mwstNr", e.target.value),
                      placeholder: "z. B. CHE-123.456.789 MWST"
                    }
                  )
                }
              )
            ] })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          SectionCard,
          {
            ocid: "einstellungen.kanzlei_logo_section",
            title: "Kanzlei-Logo",
            description: "Allgemeines Kanzlei-Logo — separat vom Rechnungslogo verwaltet.",
            icon: /* @__PURE__ */ jsxRuntimeExports.jsx(Image, { size: 16 }),
            children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(
                "input",
                {
                  ref: logoInputRef,
                  type: "file",
                  accept: "image/*",
                  "data-ocid": "einstellungen.logo_input",
                  className: "hidden",
                  onChange: handleLogoUpload
                }
              ),
              logoUrl ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center gap-4", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "img",
                  {
                    src: logoUrl,
                    alt: "Kanzlei-Logo Vorschau",
                    className: "max-h-full max-w-full object-contain"
                  }
                ) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground truncate", children: logoFileName ?? "Logo ausgewählt" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: "Das Logo wird beim Speichern übernommen." }),
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mt-3", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      Button,
                      {
                        type: "button",
                        variant: "outline",
                        size: "sm",
                        className: "gap-1.5",
                        "data-ocid": "einstellungen.logo_replace_button",
                        onClick: () => {
                          var _a;
                          return (_a = logoInputRef.current) == null ? void 0 : _a.click();
                        },
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(Upload, { size: 14 }),
                          "Ersetzen"
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs(
                      Button,
                      {
                        type: "button",
                        variant: "outline",
                        size: "sm",
                        className: "gap-1.5 text-destructive hover:text-destructive",
                        "data-ocid": "einstellungen.logo_remove_button",
                        onClick: handleRemoveLogo,
                        children: [
                          /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { size: 14 }),
                          "Entfernen"
                        ]
                      }
                    )
                  ] })
                ] })
              ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border py-8 px-4 text-center", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Image, { size: 20 }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm font-medium text-foreground", children: "Kein Kanzlei-Logo hinterlegt" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground mt-0.5", children: "PNG, JPG oder SVG — wird separat vom Rechnungslogo gespeichert." })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs(
                  Button,
                  {
                    type: "button",
                    variant: "outline",
                    size: "sm",
                    className: "gap-1.5",
                    "data-ocid": "einstellungen.logo_upload_button",
                    onClick: () => {
                      var _a;
                      return (_a = logoInputRef.current) == null ? void 0 : _a.click();
                    },
                    children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsx(Upload, { size: 14 }),
                      "Logo hochladen"
                    ]
                  }
                )
              ] }),
              uploadError && /* @__PURE__ */ jsxRuntimeExports.jsx(
                "p",
                {
                  "data-ocid": "einstellungen.logo_error",
                  role: "alert",
                  className: "text-xs text-destructive",
                  children: uploadError
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-muted-foreground", children: "Hinweis: Das Kanzlei-Logo ist strikt getrennt vom Rechnungslogo (Rechnungsvorlagen) und wird über die Kanzleistammdaten gespeichert." })
            ] })
          }
        )
      ]
    }
  );
}
export {
  EinstellungenPage,
  EinstellungenPage as default
};
