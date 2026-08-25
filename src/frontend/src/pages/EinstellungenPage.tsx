import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { KanzleiStammdaten } from "@/types";
import {
  useGetKanzleiStammdaten,
  useUpdateKanzleiStammdaten,
} from "@/utils/backend";
import {
  Building2,
  Image as ImageIcon,
  Loader2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

// ─── Pflichtfelder ────────────────────────────────────────────────────────────
// Diese Felder müssen vor dem Speichern ausgefüllt sein. Die Validierung
// erfolgt im Frontend (Inline-Errors) und blockiert den Speichern-Button.
const REQUIRED_FIELDS = [
  "kanzleiname",
  "strasseHausnummer",
  "plz",
  "ort",
  "land",
] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

const FIELD_LABELS: Record<keyof KanzleiStammdaten, string> = {
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
  kanzleiLogoBlob: "Kanzlei-Logo",
};

const EMPTY_STAMMDATEN: KanzleiStammdaten = {
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
  kanzleiLogoBlob: undefined,
};

// ─── Section card wrapper ──────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  description?: string;
  ocid: string;
  icon?: ReactNode;
  children: ReactNode;
}

function SectionCard({
  title,
  description,
  ocid,
  icon,
  children,
}: SectionCardProps) {
  return (
    <Card data-ocid={ocid} className="gap-0 py-0">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-foreground text-base leading-tight">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

function Field({
  id,
  label,
  required,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p
          data-ocid={`einstellungen.field_error.${id}`}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────

export function EinstellungenPage() {
  const { data: stammdaten, isLoading } = useGetKanzleiStammdaten();
  const updateMut = useUpdateKanzleiStammdaten();

  const [form, setForm] = useState<KanzleiStammdaten>(EMPTY_STAMMDATEN);
  // Lokales Kanzlei-Logo als Uint8Array (strikt getrennt vom Rechnungslogo).
  // Wird über updateKanzleiStammdaten persistiert, NICHT über useUploadLogo.
  const [logoBytes, setLogoBytes] = useState<Uint8Array | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<RequiredField>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Stammdaten in das Formular laden ──────────────────────────────────────
  useEffect(() => {
    if (stammdaten) {
      setForm(stammdaten);
      // Bestehendes Kanzlei-Logo anzeigen, falls vorhanden.
      if (stammdaten.kanzleiLogoBlob && stammdaten.kanzleiLogoBlob.length > 0) {
        setLogoBytes(stammdaten.kanzleiLogoBlob);
        const blob = new Blob([new Uint8Array(stammdaten.kanzleiLogoBlob)], {
          type: "image/png",
        });
        setLogoUrl(URL.createObjectURL(blob));
        setLogoFileName("gespeichertes Logo");
      }
    } else if (!isLoading) {
      setForm(EMPTY_STAMMDATEN);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stammdaten, isLoading]);

  // Object-URL aufräumen, wenn sie ersetzt oder die Komponente unmountet wird.
  useEffect(() => {
    return () => {
      if (logoUrl) URL.revokeObjectURL(logoUrl);
    };
  }, [logoUrl]);

  // ── Validierung der Pflichtfelder ─────────────────────────────────────────
  const errors = useMemo(() => {
    const errs: Partial<Record<RequiredField, string>> = {};
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

  function updateField<K extends keyof KanzleiStammdaten>(
    field: K,
    value: KanzleiStammdaten[K],
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleBlur(field: RequiredField) {
    setTouched((prev) => new Set(prev).add(field));
  }

  function showError(field: RequiredField): string | undefined {
    return touched.has(field) ? errors[field] : undefined;
  }

  // ── Kanzlei-Logo Upload (separat vom Rechnungslogo) ───────────────────────
  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) {
      setUploadError("Bitte eine Bilddatei auswählen (PNG, JPG, SVG).");
      toast.error("Ungültiger Dateityp");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      setLogoBytes(bytes);
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
      setLogoFileName(file.name);
      toast.success("Logo geladen — bitte speichern Sie, um es zu übernehmen.");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Logo-Laden fehlgeschlagen",
      );
      toast.error("Logo-Laden fehlgeschlagen");
    }
    e.target.value = "";
  }

  function handleRemoveLogo() {
    setLogoBytes(null);
    setLogoUrl(null);
    setLogoFileName(null);
    setUploadError(null);
    setForm((prev) => ({ ...prev, kanzleiLogoBlob: undefined }));
    toast.info(
      "Logo entfernt — bitte speichern Sie, um die Änderung zu übernehmen.",
    );
  }

  // ── Speichern ──────────────────────────────────────────────────────────────
  function handleSave() {
    // Alle Pflichtfelder als "touched" markieren, damit Fehler sichtbar werden.
    setTouched(new Set(REQUIRED_FIELDS));
    if (hasErrors) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus.");
      return;
    }

    const toSave: KanzleiStammdaten = {
      ...form,
      // kanzleiLogoBlob nur setzen, wenn ein Logo ausgewählt wurde; sonst
      // undefined, damit das Backend ein bestehendes Logo beibehält.
      kanzleiLogoBlob: logoBytes ?? undefined,
    };

    updateMut.mutate(toSave, {
      onSuccess: (res) => {
        if (
          res &&
          typeof res === "object" &&
          "__kind__" in res &&
          res.__kind__ === "err"
        ) {
          const errMsg =
            (res as { err: string }).err || "Speichern fehlgeschlagen";
          console.error(
            "[EinstellungenPage] updateKanzleiStammdaten returned #err:",
            errMsg,
          );
          toast.error(errMsg);
        } else {
          toast.success("Kanzleidaten gespeichert");
        }
      },
      onError: (e: Error) => {
        const errMsg = e.message || "Speichern fehlgeschlagen";
        console.error(
          "[EinstellungenPage] updateKanzleiStammdaten threw:",
          errMsg,
        );
        toast.error(errMsg);
      },
    });
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        data-ocid="einstellungen.loading_state"
        className="p-6 space-y-6 max-w-4xl mx-auto"
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isSaving = updateMut.isPending;

  return (
    <div
      data-ocid="einstellungen.page"
      className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto"
    >
      {/* ── Sticky page header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-4xl mx-auto">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-foreground text-xl tracking-tight">
              Einstellungen
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Verwalten Sie die Kanzleistammdaten — Pflichtfelder sind mit *
              markiert.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              data-ocid="einstellungen.save_button"
              className="btn-primary gap-2"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Speichern
            </Button>
          </div>
        </div>
      </div>

      {/* ── Kanzleidaten ─────────────────────────────────────────────────────── */}
      <SectionCard
        ocid="einstellungen.kanzleidaten_section"
        title="Kanzleidaten"
        description="Pflichtfelder für Rechnungen und Korrespondenz."
        icon={<Building2 size={16} />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="kanzleiname"
            label={FIELD_LABELS.kanzleiname}
            required
            error={showError("kanzleiname")}
            className="sm:col-span-2"
          >
            <Input
              id="kanzleiname"
              data-ocid="einstellungen.input.kanzleiname"
              value={form.kanzleiname}
              onChange={(e) => updateField("kanzleiname", e.target.value)}
              onBlur={() => handleBlur("kanzleiname")}
              placeholder="z. B. Kanzlei Müller & Partner"
              aria-required="true"
              aria-invalid={!!showError("kanzleiname")}
            />
          </Field>

          <Field
            id="strasseHausnummer"
            label={FIELD_LABELS.strasseHausnummer}
            required
            error={showError("strasseHausnummer")}
            className="sm:col-span-2"
          >
            <Input
              id="strasseHausnummer"
              data-ocid="einstellungen.input.strasseHausnummer"
              value={form.strasseHausnummer}
              onChange={(e) => updateField("strasseHausnummer", e.target.value)}
              onBlur={() => handleBlur("strasseHausnummer")}
              placeholder="z. B. Bahnhofstrasse 12"
              aria-required="true"
              aria-invalid={!!showError("strasseHausnummer")}
            />
          </Field>

          <Field
            id="plz"
            label={FIELD_LABELS.plz}
            required
            error={showError("plz")}
          >
            <Input
              id="plz"
              data-ocid="einstellungen.input.plz"
              value={form.plz}
              onChange={(e) => updateField("plz", e.target.value)}
              onBlur={() => handleBlur("plz")}
              placeholder="z. B. 8001"
              aria-required="true"
              aria-invalid={!!showError("plz")}
            />
          </Field>

          <Field
            id="ort"
            label={FIELD_LABELS.ort}
            required
            error={showError("ort")}
          >
            <Input
              id="ort"
              data-ocid="einstellungen.input.ort"
              value={form.ort}
              onChange={(e) => updateField("ort", e.target.value)}
              onBlur={() => handleBlur("ort")}
              placeholder="z. B. Zürich"
              aria-required="true"
              aria-invalid={!!showError("ort")}
            />
          </Field>

          <Field
            id="land"
            label={FIELD_LABELS.land}
            required
            error={showError("land")}
            className="sm:col-span-2"
          >
            <Input
              id="land"
              data-ocid="einstellungen.input.land"
              value={form.land}
              onChange={(e) => updateField("land", e.target.value)}
              onBlur={() => handleBlur("land")}
              placeholder="z. B. Schweiz"
              aria-required="true"
              aria-invalid={!!showError("land")}
            />
          </Field>

          <Field id="telefon" label={FIELD_LABELS.telefon}>
            <Input
              id="telefon"
              data-ocid="einstellungen.input.telefon"
              value={form.telefon ?? ""}
              onChange={(e) => updateField("telefon", e.target.value)}
              placeholder="z. B. +41 44 123 45 67"
            />
          </Field>

          <Field id="email" label={FIELD_LABELS.email}>
            <Input
              id="email"
              type="email"
              data-ocid="einstellungen.input.email"
              value={form.email ?? ""}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="z. B. kontakt@kanzlei.ch"
            />
          </Field>

          <Field id="website" label={FIELD_LABELS.website}>
            <Input
              id="website"
              data-ocid="einstellungen.input.website"
              value={form.website ?? ""}
              onChange={(e) => updateField("website", e.target.value)}
              placeholder="z. B. www.kanzlei.ch"
            />
          </Field>

          <Field id="uid" label={FIELD_LABELS.uid}>
            <Input
              id="uid"
              data-ocid="einstellungen.input.uid"
              value={form.uid ?? ""}
              onChange={(e) => updateField("uid", e.target.value)}
              placeholder="z. B. CHE-123.456.789"
            />
          </Field>

          <Field
            id="mwstNr"
            label={FIELD_LABELS.mwstNr}
            className="sm:col-span-2"
          >
            <Input
              id="mwstNr"
              data-ocid="einstellungen.input.mwstNr"
              value={form.mwstNr ?? ""}
              onChange={(e) => updateField("mwstNr", e.target.value)}
              placeholder="z. B. CHE-123.456.789 MWST"
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── Kanzlei-Logo (strikt getrennt vom Rechnungslogo) ─────────────────── */}
      <SectionCard
        ocid="einstellungen.kanzlei_logo_section"
        title="Kanzlei-Logo"
        description="Allgemeines Kanzlei-Logo — separat vom Rechnungslogo verwaltet."
        icon={<ImageIcon size={16} />}
      >
        <div className="space-y-4">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            data-ocid="einstellungen.logo_input"
            className="hidden"
            onChange={handleLogoUpload}
          />

          {logoUrl ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30 overflow-hidden">
                <img
                  src={logoUrl}
                  alt="Kanzlei-Logo Vorschau"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {logoFileName ?? "Logo ausgewählt"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Das Logo wird beim Speichern übernommen.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    data-ocid="einstellungen.logo_replace_button"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    Ersetzen
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    data-ocid="einstellungen.logo_remove_button"
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 size={14} />
                    Entfernen
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border py-8 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ImageIcon size={20} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Kein Kanzlei-Logo hinterlegt
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PNG, JPG oder SVG — wird separat vom Rechnungslogo
                  gespeichert.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                data-ocid="einstellungen.logo_upload_button"
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload size={14} />
                Logo hochladen
              </Button>
            </div>
          )}

          {uploadError && (
            <p
              data-ocid="einstellungen.logo_error"
              role="alert"
              className="text-xs text-destructive"
            >
              {uploadError}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Hinweis: Das Kanzlei-Logo ist strikt getrennt vom Rechnungslogo
            (Rechnungsvorlagen) und wird über die Kanzleistammdaten gespeichert.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

export default EinstellungenPage;
