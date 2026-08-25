import { Zahlungsmodalitaet } from "@/backend";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PendingRegistrationView } from "@/types";
import { VerificationError } from "@/types";
import {
  useBackend,
  useChangeEmail,
  useCompleteRegistration,
  useGetPendingRegistration,
  useSendVerificationCode,
  useVerifyEmail,
  verificationErrorMessage,
} from "@/utils/backend";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

const TITEL_OPTIONS = [
  "Dr.",
  "LL.M.",
  "Rechtsanwalt",
  "Rechtsanwältin",
  "Prof.",
  "—",
] as const;

// Nur die nicht-sensitive pendingId wird im Local Storage abgelegt — niemals
// der Bestätigungscode oder der Code-Hash.
const PENDING_REGISTRATION_KEY = "ireport.pendingRegistrationId";

const STEPS = [
  { label: "Kanzlei & Person" },
  { label: "E-Mail bestätigen" },
  { label: "Internet Identity verbinden & Registrierung abschliessen" },
] as const;

interface KanzleiFormState {
  kanzleiName: string;
  adminTitel: string;
  vorname: string;
  nachname: string;
  email: string;
  zahlungsmodalitaet: Zahlungsmodalitaet;
}

interface InviteFormState {
  titel: string;
  vorname: string;
  nachname: string;
  email: string;
}

type StatusMessage = {
  type: "info" | "success" | "error";
  text: string;
};

const DEFAULT_KANZLEI: KanzleiFormState = {
  kanzleiName: "",
  adminTitel: "",
  vorname: "",
  nachname: "",
  email: "",
  // Standardwert 'Jahres-Abonnement' (#jahres), falls nichts gewählt wurde.
  zahlungsmodalitaet: Zahlungsmodalitaet.jahres,
};

const DEFAULT_INVITE: InviteFormState = {
  titel: "",
  vorname: "",
  nachname: "",
  email: "",
};

function readStoredPendingId(): string | null {
  try {
    return window.localStorage.getItem(PENDING_REGISTRATION_KEY);
  } catch {
    return null;
  }
}

function storePendingId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(PENDING_REGISTRATION_KEY, id);
    else window.localStorage.removeItem(PENDING_REGISTRATION_KEY);
  } catch {
    // Storage nicht verfügbar — Flow läuft dann ohne Reload-Recovery weiter.
  }
}

/**
 * verificationErrorFromError — wandelt einen von den Registrierungs-Hooks
 * geworfenen Fehler zurück in einen VerificationError. Die Hooks werfen
 * `new Error(<VerificationError-Enum-Wert>)` (siehe unwrapVerificationResult),
 * daher ist err.message exakt der Enum-String. Unbekannte Fehler fallen auf
 * einen generischen Wert zurück, damit das UI nie rohe Backend-Details zeigt.
 */
function verificationErrorFromError(err: unknown): VerificationError {
  if (err instanceof Error) {
    const msg = err.message;
    if ((Object.values(VerificationError) as string[]).includes(msg)) {
      return msg as VerificationError;
    }
  }
  return VerificationError.invalidInput;
}

export function RegistrierungPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isInitializing } = useInternetIdentity();
  const { actor } = useBackend();

  // Read invite token from URL query param
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : "",
  );
  const inviteToken = params.get("invite") ?? params.get("token") ?? "";
  const isInviteFlow = !!inviteToken;

  const [kanzleiForm, setKanzleiForm] = useState<KanzleiFormState>({
    ...DEFAULT_KANZLEI,
  });
  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    ...DEFAULT_INVITE,
    email: params.get("email") ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [checkingKanzlei, setCheckingKanzlei] = useState(false);
  // useRef flag prevents the auto-redirect effect from re-running the
  // async Kanzlei check on every state transition (avoids an infinite loop).
  const hasCheckedKanzleiRef = useRef(false);

  // ─── 3-Schritt-Flow State ─────────────────────────────────────────────────
  // pendingId wird beim Mount aus dem Local Storage gelesen (Reload-Recovery)
  // und über useGetPendingRegistration nachgeladen. Der aktuelle Schritt wird
  // aus pendingId + pending.emailVerified abgeleitet, sodass ein Reload den
  // Flow automatisch zum passenden Schritt zurückführt.
  const initialStoredId = useRef<string | null>(null);
  if (initialStoredId.current === null) {
    initialStoredId.current = readStoredPendingId();
  }
  const [pendingId, setPendingId] = useState<string | null>(
    initialStoredId.current,
  );
  const { data: pending, isLoading: pendingLoading } =
    useGetPendingRegistration(pendingId);
  const [code, setCode] = useState("");
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(
    null,
  );
  const [shouldComplete, setShouldComplete] = useState(false);
  const recoveryDoneRef = useRef(false);

  const sendVerification = useSendVerificationCode();
  const verifyEmail = useVerifyEmail();
  const _changeEmail = useChangeEmail();
  const completeRegistration = useCompleteRegistration();

  // Abgeleiteter Schritt: 1 = Kanzlei & Person, 2 = E-Mail bestätigen,
  // 3 = Internet Identity verbinden & abschliessen.
  const step: 1 | 2 | 3 = !pendingId
    ? 1
    : pending
      ? pending.emailVerified
        ? 3
        : 2
      : 2;

  // ─── Reload-Recovery ─────────────────────────────────────────────────────
  // Stellt eine noch gültige PendingRegistration wieder her und kehrt zum
  // passenden Schritt zurück, ohne eine bestätigte E-Mail erneut zu
  // verifizieren. Abgelaufene PendingRegistrations werden sauber verworfen.
  useEffect(() => {
    if (recoveryDoneRef.current) return;
    if (pendingLoading) return;
    recoveryDoneRef.current = true;
    if (pending) {
      setKanzleiForm({
        kanzleiName: pending.kanzleiName,
        adminTitel: pending.titel,
        vorname: pending.vorname,
        nachname: pending.nachname,
        email: pending.email,
        zahlungsmodalitaet:
          pending.zahlungsmodalitaet ?? Zahlungsmodalitaet.jahres,
      });
    } else if (initialStoredId.current) {
      // Gespeicherte PendingRegistration existiert nicht mehr → verwerfen.
      storePendingId(null);
      setPendingId(null);
    }
  }, [pending, pendingLoading]);

  // ─── Auto-redirect authenticated users with an existing Kanzlei ─────────
  // If an authenticated user lands on /registrierung (e.g. right after II
  // login completed while on this page) and already owns a Kanzlei, send them
  // straight to the dashboard instead of showing the registration form.
  // The invite flow is exempt: invitees may be joining a different Kanzlei.
  useEffect(() => {
    if (isInitializing || !isAuthenticated || isInviteFlow || submitted) {
      return;
    }
    if (hasCheckedKanzleiRef.current) return;
    hasCheckedKanzleiRef.current = true;
    setCheckingKanzlei(true);
    let cancelled = false;
    (async () => {
      try {
        if (!actor) return;
        const kanzlei = await actor.getKanzlei();
        if (!cancelled && kanzlei) {
          navigate({ to: "/app/leistungen" });
        }
      } catch {
        // If the check fails, fall through to the registration form so the
        // user is never stuck on a blank screen.
      } finally {
        if (!cancelled) setCheckingKanzlei(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    actor,
    isAuthenticated,
    isInitializing,
    isInviteFlow,
    submitted,
    navigate,
  ]);

  // ─── Abschluss nach Internet-Identity-Login ──────────────────────────────
  // In Schritt 3 startet der Button die Internet Identity. Sobald der Login
  // abgeschlossen ist, wird completeRegistration ausgeführt.
  useEffect(() => {
    if (shouldComplete && isAuthenticated && !isInitializing) {
      setShouldComplete(false);
      void doComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldComplete, isAuthenticated, isInitializing]);

  function setKanzlei(field: keyof KanzleiFormState, value: string) {
    setKanzleiForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function setInvite(field: keyof InviteFormState, value: string) {
    setInviteForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validateKanzlei(): boolean {
    const errs: Record<string, string> = {};
    if (!kanzleiForm.kanzleiName.trim()) errs.kanzleiName = "Pflichtfeld";
    if (!kanzleiForm.vorname.trim()) errs.vorname = "Pflichtfeld";
    if (!kanzleiForm.nachname.trim()) errs.nachname = "Pflichtfeld";
    if (!kanzleiForm.email.trim() || !kanzleiForm.email.includes("@"))
      errs.email = "Gültige E-Mail-Adresse erforderlich";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateInvite(): boolean {
    const errs: Record<string, string> = {};
    if (!inviteForm.vorname.trim()) errs.vorname = "Pflichtfeld";
    if (!inviteForm.nachname.trim()) errs.nachname = "Pflichtfeld";
    if (!inviteForm.email.trim() || !inviteForm.email.includes("@"))
      errs.email = "Gültige E-Mail-Adresse erforderlich";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Schritt 1 → Schritt 2: Bestätigungscode senden ──────────────────────
  // Validiert die Eingaben, prüft die E-Mail syntaktisch und ruft
  // sendVerificationCode auf. Es wird weder eine Kanzlei noch ein Benutzer
  // angelegt und keine Internet Identity gestartet.
  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!validateKanzlei()) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const id = await sendVerification.mutateAsync({
        kanzleiName: kanzleiForm.kanzleiName,
        titel: kanzleiForm.adminTitel || "—",
        vorname: kanzleiForm.vorname,
        nachname: kanzleiForm.nachname,
        email: kanzleiForm.email,
        zahlungsmodalitaet: kanzleiForm.zahlungsmodalitaet,
      });
      storePendingId(id);
      setPendingId(id);
      setCode("");
      setStatusMessage({
        type: "info",
        text: `Wir haben einen 6-stelligen Bestätigungscode an ${kanzleiForm.email} gesendet.`,
      });
    } catch (err) {
      // Log the concrete technical error for diagnosis while still showing the
      // user-friendly German message below.
      console.error(
        "[handleSendCode] Fehler beim Senden des Bestätigungscodes:",
        err,
      );
      setStatusMessage({
        type: "error",
        text: verificationErrorMessage(verificationErrorFromError(err)),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Schritt 2: Code prüfen ───────────────────────────────────────────────
  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingId) return;
    if (!code.trim()) {
      setStatusMessage({
        type: "error",
        text: "Bitte geben Sie den Bestätigungscode ein.",
      });
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      await verifyEmail.mutateAsync({ pendingId, code });
      // Kein statusMessage-Success hier setzen: Die Erfolgsmeldung wird
      // ausschliesslich vom Schritt-3-Banner (registrierung.step3.success)
      // gerendert, sobald emailVerified=true den Flow zu Schritt 3 führt.
      // So erscheint die Meldung nur einmal statt doppelt.
      // pending refetcht via Invalidation → emailVerified=true → Schritt 3.
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: verificationErrorMessage(verificationErrorFromError(err)),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Schritt 2: Code erneut senden ────────────────────────────────────────
  async function handleResendCode() {
    if (!pendingId) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const email = pending?.email ?? kanzleiForm.email;
      const id = await sendVerification.mutateAsync({
        kanzleiName: pending?.kanzleiName ?? kanzleiForm.kanzleiName,
        titel: (pending?.titel ?? kanzleiForm.adminTitel) || "—",
        vorname: pending?.vorname ?? kanzleiForm.vorname,
        nachname: pending?.nachname ?? kanzleiForm.nachname,
        email,
        zahlungsmodalitaet:
          pending?.zahlungsmodalitaet ?? kanzleiForm.zahlungsmodalitaet,
      });
      storePendingId(id);
      setPendingId(id);
      setCode("");
      setStatusMessage({
        type: "info",
        text: `Wir haben einen 6-stelligen Bestätigungscode an ${email} gesendet.`,
      });
    } catch (err) {
      // Log the concrete technical error for diagnosis while still showing the
      // user-friendly German message below.
      console.error(
        "[handleResendCode] Fehler beim erneuten Senden des Bestätigungscodes:",
        err,
      );
      setStatusMessage({
        type: "error",
        text: verificationErrorMessage(verificationErrorFromError(err)),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Schritt 2: E-Mail-Adresse ändern ────────────────────────────────────
  // Führt zurück zu Schritt 1, invalidiert den bisherigen Code (die
  // PendingRegistration wird verworfen) und erzwingt eine neue Verifizierung
  // der geänderten Adresse beim erneuten Absenden.
  function handleChangeEmail() {
    storePendingId(null);
    setPendingId(null);
    setCode("");
    setStatusMessage(null);
  }

  // ─── Schritt 3: Internet Identity verbinden & abschliessen ───────────────
  async function doComplete() {
    if (!pendingId) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      await completeRegistration.mutateAsync(pendingId);
      storePendingId(null);
      setPendingId(null);
      navigate({ to: "/app/leistungen" });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: verificationErrorMessage(verificationErrorFromError(err)),
      });
      setIsSubmitting(false);
    }
  }

  function handleComplete() {
    if (!pendingId) return;
    if (!isAuthenticated) {
      // Internet Identity starten; nach dem Login läuft doComplete via Effect.
      setShouldComplete(true);
      login();
      return;
    }
    void doComplete();
  }

  // ─── Einladungs-Flow (bestehend) ──────────────────────────────────────────
  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    const valid = validateInvite();
    if (!valid) return;
    if (!isAuthenticated) {
      login();
      return;
    }
    setIsSubmitting(true);
    try {
      if (!actor) throw new Error("Actor nicht bereit");
      const result = await actor.redeemInviteLink(
        inviteToken,
        inviteForm.vorname,
        inviteForm.nachname,
        inviteForm.titel || "—",
        inviteForm.email,
      );
      if (result.__kind__ === "err") {
        setErrors({ email: result.err });
        return;
      }
      setSubmitted(true);
      setTimeout(() => navigate({ to: "/app/leistungen" }), 1200);
    } catch (err) {
      setErrors({
        email:
          err instanceof Error
            ? err.message
            : "Einladung fehlgeschlagen. Bitte erneut versuchen.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const titel = isInviteFlow ? inviteForm.titel : kanzleiForm.adminTitel;
  const vorname = isInviteFlow ? inviteForm.vorname : kanzleiForm.vorname;
  const nachname = isInviteFlow ? inviteForm.nachname : kanzleiForm.nachname;
  const email = isInviteFlow ? inviteForm.email : kanzleiForm.email;
  const currentEmail = pending?.email ?? kanzleiForm.email;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-3 shadow-sm">
        <img
          src="/assets/images/ireport-legal-logo.png"
          alt="iReport Legal"
          className="h-8 w-auto"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Card
          data-ocid="registrierung.card"
          className="w-full max-w-md border border-border shadow-sm"
        >
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl font-bold text-foreground">
              {isInviteFlow ? "Einladung annehmen" : "Kanzlei registrieren"}
            </CardTitle>
            <CardDescription>
              {isInviteFlow
                ? "Sie wurden eingeladen, einer Kanzlei beizutreten. Bitte geben Sie Ihre persönlichen Daten ein."
                : "Erstellen Sie Ihren iReport Legal-Account für Ihre Kanzlei."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isInviteFlow ? (
              submitted ? (
                <div
                  data-ocid="registrierung.success_state"
                  className="flex flex-col items-center gap-3 py-8 text-center"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-success/10">
                    <Check size={22} className="text-success" />
                  </div>
                  <p className="font-semibold text-foreground">
                    Einladung angenommen!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Sie werden weitergeleitet…
                  </p>
                </div>
              ) : (
                <form
                  data-ocid="registrierung.invite_form"
                  onSubmit={handleInviteSubmit}
                  className="space-y-4"
                  noValidate
                >
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="inviteTitel">Titel</Label>
                      <Select
                        value={titel}
                        onValueChange={(v) => setInvite("titel", v)}
                      >
                        <SelectTrigger
                          id="inviteTitel"
                          data-ocid="registrierung.admin_titel.select"
                        >
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {TITEL_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inviteVorname">Vorname *</Label>
                      <Input
                        id="inviteVorname"
                        data-ocid="registrierung.vorname.input"
                        placeholder="Anna"
                        value={vorname}
                        onChange={(e) => setInvite("vorname", e.target.value)}
                        className={errors.vorname ? "border-destructive" : ""}
                      />
                      {errors.vorname && (
                        <p
                          data-ocid="registrierung.vorname.field_error"
                          className="text-xs text-destructive"
                        >
                          {errors.vorname}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inviteNachname">Nachname *</Label>
                      <Input
                        id="inviteNachname"
                        data-ocid="registrierung.nachname.input"
                        placeholder="Müller"
                        value={nachname}
                        onChange={(e) => setInvite("nachname", e.target.value)}
                        className={errors.nachname ? "border-destructive" : ""}
                      />
                      {errors.nachname && (
                        <p
                          data-ocid="registrierung.nachname.field_error"
                          className="text-xs text-destructive"
                        >
                          {errors.nachname}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inviteEmail">E-Mail *</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      data-ocid="registrierung.email.input"
                      placeholder="anna.mueller@kanzlei.ch"
                      value={email}
                      onChange={(e) => setInvite("email", e.target.value)}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p
                        data-ocid="registrierung.email.field_error"
                        className="text-xs text-destructive"
                      >
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="pt-2">
                    {!isAuthenticated && !isInitializing ? (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground text-center">
                          Zur Registrierung ist eine Internet Identity
                          erforderlich.
                        </p>
                        <Button
                          type="submit"
                          data-ocid="registrierung.submit_button"
                          className="btn-success w-full gap-2"
                          disabled={isSubmitting || isInitializing}
                        >
                          {isInitializing ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : null}
                          Mit Internet Identity anmelden & Einladung annehmen
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="submit"
                        data-ocid="registrierung.submit_button"
                        className="btn-success w-full gap-2"
                        disabled={isSubmitting || isInitializing}
                      >
                        {isSubmitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                        Einladung annehmen
                      </Button>
                    )}
                  </div>
                </form>
              )
            ) : checkingKanzlei && isAuthenticated ? (
              <div
                data-ocid="registrierung.loading_state"
                className="flex flex-col items-center gap-3 py-8 text-center"
              >
                <Loader2 size={28} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Konto wird geprüft…
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* 3-Schritt-Fortschritt */}
                <div data-ocid="registrierung.stepper" className="mb-1">
                  {STEPS.map((s, i) => {
                    const state =
                      i < step - 1
                        ? "complete"
                        : i === step - 1
                          ? "active"
                          : "pending";
                    return (
                      <div key={s.label} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`reg-step-dot ${
                              state === "active"
                                ? "reg-step-dot-active"
                                : state === "complete"
                                  ? "reg-step-dot-complete"
                                  : ""
                            }`}
                          >
                            {state === "complete" ? <Check size={16} /> : i + 1}
                          </span>
                          {i < STEPS.length - 1 && (
                            <div
                              className={`w-0.5 flex-1 my-1 ${
                                state === "complete"
                                  ? "bg-success"
                                  : "bg-border"
                              }`}
                            />
                          )}
                        </div>
                        <div className="pb-5">
                          <span
                            className={`reg-step-label ${
                              state === "active"
                                ? "reg-step-label-active"
                                : state === "complete"
                                  ? "reg-step-label-complete"
                                  : ""
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status-Meldung */}
                {statusMessage && (
                  <div
                    data-ocid="registrierung.status_message"
                    className={`animate-fade-in-up ${
                      statusMessage.type === "success"
                        ? "status-message-success"
                        : statusMessage.type === "info"
                          ? "status-message-info"
                          : "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-body bg-destructive/10 text-destructive"
                    }`}
                  >
                    {statusMessage.type === "success" ? (
                      <Check size={16} />
                    ) : statusMessage.type === "info" ? (
                      <Mail size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                )}

                {/* Schritt 1 — Kanzlei & Person */}
                {step === 1 && (
                  <form
                    data-ocid="registrierung.form"
                    onSubmit={handleSendCode}
                    className="space-y-4 animate-step-pop"
                    noValidate
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="kanzleiName">Kanzlei Name *</Label>
                      <Input
                        id="kanzleiName"
                        data-ocid="registrierung.kanzlei_name.input"
                        placeholder="z.B. Müller & Partner Rechtsanwälte"
                        value={kanzleiForm.kanzleiName}
                        onChange={(e) =>
                          setKanzlei("kanzleiName", e.target.value)
                        }
                        className={
                          errors.kanzleiName ? "border-destructive" : ""
                        }
                      />
                      {errors.kanzleiName && (
                        <p
                          data-ocid="registrierung.kanzlei_name.field_error"
                          className="text-xs text-destructive"
                        >
                          {errors.kanzleiName}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="adminTitel">Titel</Label>
                        <Select
                          value={titel}
                          onValueChange={(v) => setKanzlei("adminTitel", v)}
                        >
                          <SelectTrigger
                            id="adminTitel"
                            data-ocid="registrierung.admin_titel.select"
                          >
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {TITEL_OPTIONS.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="vorname">Vorname *</Label>
                        <Input
                          id="vorname"
                          data-ocid="registrierung.vorname.input"
                          placeholder="Anna"
                          value={vorname}
                          onChange={(e) =>
                            setKanzlei("vorname", e.target.value)
                          }
                          className={errors.vorname ? "border-destructive" : ""}
                        />
                        {errors.vorname && (
                          <p
                            data-ocid="registrierung.vorname.field_error"
                            className="text-xs text-destructive"
                          >
                            {errors.vorname}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="nachname">Nachname *</Label>
                        <Input
                          id="nachname"
                          data-ocid="registrierung.nachname.input"
                          placeholder="Müller"
                          value={nachname}
                          onChange={(e) =>
                            setKanzlei("nachname", e.target.value)
                          }
                          className={
                            errors.nachname ? "border-destructive" : ""
                          }
                        />
                        {errors.nachname && (
                          <p
                            data-ocid="registrierung.nachname.field_error"
                            className="text-xs text-destructive"
                          >
                            {errors.nachname}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="email">E-Mail *</Label>
                      <Input
                        id="email"
                        type="email"
                        data-ocid="registrierung.email.input"
                        placeholder="anna.mueller@kanzlei.ch"
                        value={email}
                        onChange={(e) => setKanzlei("email", e.target.value)}
                        className={errors.email ? "border-destructive" : ""}
                      />
                      {errors.email && (
                        <p
                          data-ocid="registrierung.email.field_error"
                          className="text-xs text-destructive"
                        >
                          {errors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label>Zahlungsmodalität *</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <label
                          data-ocid="registrierung.zahlungsmodalitaet.jahres.label"
                          className={`flex flex-col gap-0.5 rounded-md border px-3 py-2.5 cursor-pointer transition-smooth ${
                            kanzleiForm.zahlungsmodalitaet ===
                            Zahlungsmodalitaet.jahres
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <input
                              type="radio"
                              name="zahlungsmodalitaet"
                              data-ocid="registrierung.zahlungsmodalitaet.jahres.input"
                              value={Zahlungsmodalitaet.jahres}
                              checked={
                                kanzleiForm.zahlungsmodalitaet ===
                                Zahlungsmodalitaet.jahres
                              }
                              onChange={() =>
                                setKanzlei(
                                  "zahlungsmodalitaet",
                                  Zahlungsmodalitaet.jahres,
                                )
                              }
                              className="accent-primary"
                            />
                            Jahres-Abonnement
                          </span>
                          <span className="text-xs text-muted-foreground pl-6">
                            <span className="line-through">
                              29.00 CHF / Monat
                            </span>{" "}
                            <span className="font-semibold text-foreground">
                              0.00 CHF
                            </span>
                          </span>
                        </label>
                        <label
                          data-ocid="registrierung.zahlungsmodalitaet.monats.label"
                          className={`flex flex-col gap-0.5 rounded-md border px-3 py-2.5 cursor-pointer transition-smooth ${
                            kanzleiForm.zahlungsmodalitaet ===
                            Zahlungsmodalitaet.monats
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <input
                              type="radio"
                              name="zahlungsmodalitaet"
                              data-ocid="registrierung.zahlungsmodalitaet.monats.input"
                              value={Zahlungsmodalitaet.monats}
                              checked={
                                kanzleiForm.zahlungsmodalitaet ===
                                Zahlungsmodalitaet.monats
                              }
                              onChange={() =>
                                setKanzlei(
                                  "zahlungsmodalitaet",
                                  Zahlungsmodalitaet.monats,
                                )
                              }
                              className="accent-primary"
                            />
                            Monats-Abonnement
                          </span>
                          <span className="text-xs text-muted-foreground pl-6">
                            <span className="line-through">
                              32.00 CHF / Monat
                            </span>{" "}
                            <span className="font-semibold text-foreground">
                              0.00 CHF
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        data-ocid="registrierung.submit_button"
                        className="btn-success w-full gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Mail size={16} />
                        )}
                        E-Mail bestätigen
                      </Button>
                    </div>
                  </form>
                )}

                {/* Schritt 2 — E-Mail bestätigen */}
                {step === 2 && (
                  <div className="space-y-4 animate-step-pop">
                    <div
                      data-ocid="registrierung.step2.hint"
                      className="status-message-info"
                    >
                      <Mail size={16} />
                      <span>
                        Wir haben einen 6-stelligen Bestätigungscode an{" "}
                        <span className="font-semibold">{currentEmail}</span>{" "}
                        gesendet.
                      </span>
                    </div>

                    <form
                      data-ocid="registrierung.verify_form"
                      onSubmit={handleVerifyEmail}
                      className="space-y-4"
                      noValidate
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="verificationCode">
                          Bestätigungscode
                        </Label>
                        <Input
                          id="verificationCode"
                          data-ocid="registrierung.verification_code.input"
                          className="verification-code-input"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="••••••"
                          value={code}
                          onChange={(e) =>
                            setCode(
                              e.target.value.replace(/[^0-9]/g, "").slice(0, 6),
                            )
                          }
                        />
                      </div>

                      <Button
                        type="submit"
                        data-ocid="registrierung.verify_button"
                        className="btn-success w-full gap-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                        E-Mail bestätigen
                      </Button>
                    </form>

                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        data-ocid="registrierung.resend_button"
                        className="w-full gap-2"
                        disabled={isSubmitting}
                        onClick={handleResendCode}
                      >
                        <RefreshCw size={16} />
                        Code erneut senden
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        data-ocid="registrierung.change_email_button"
                        className="w-full text-muted-foreground"
                        disabled={isSubmitting}
                        onClick={handleChangeEmail}
                      >
                        E-Mail-Adresse ändern
                      </Button>
                    </div>
                  </div>
                )}

                {/* Schritt 3 — Internet Identity verbinden & abschliessen */}
                {step === 3 && (
                  <div className="space-y-4 animate-step-pop">
                    <div
                      data-ocid="registrierung.step3.success"
                      className="status-message-success"
                    >
                      <Check size={16} />
                      <span>E-Mail-Adresse erfolgreich bestätigt.</span>
                    </div>

                    <div className="pt-1">
                      <Button
                        type="button"
                        data-ocid="registrierung.complete_button"
                        className="btn-success w-full gap-2"
                        disabled={isSubmitting || isInitializing}
                        onClick={handleComplete}
                      >
                        {isSubmitting || isInitializing ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <ArrowRight size={16} />
                        )}
                        Mit Internet Identity anmelden & Registrierung
                        abschliessen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="bg-muted/40 border-t border-border px-6 py-3 text-center text-xs text-muted-foreground">
        © 2026{" "}
        <a
          href="https://www.iservices.ch"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground hover:text-primary transition-smooth"
        >
          iServices AG
        </a>
      </footer>
    </div>
  );
}
