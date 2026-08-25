import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart2,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Globe,
  Info,
  Lock,
  Scale,
  Server,
  Shield,
  Users,
} from "lucide-react";
import { useRef } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Clock,
    title: "Leistungserfassung",
    desc: "Zeiten mit Stoppuhr erfassen, Honorare automatisch berechnen, nach Mandaten filtern.",
  },
  {
    icon: Users,
    title: "Klienten & Mandate",
    desc: "Übersichtliche Mandatsverwaltung mit Budget-Tracking, Akquisiteur-Zuweisung und Archivierung.",
  },
  {
    icon: FileText,
    title: "Rechnungen & Word-Export",
    desc: "Rechnungen aus offenen Leistungen erstellen und direkt als Word-Dokument exportieren.",
  },
  {
    icon: BarChart2,
    title: "Auswertungen & Charts",
    desc: "Leistungsanalysen per Anwalt oder Kanzlei mit Linien- und Balkendiagrammen.",
  },
  {
    icon: Building2,
    title: "Mehrere Kanzleien",
    desc: "Strikte Datentrennung pro Kanzlei. Jede Kanzlei sieht nur ihre eigenen Daten.",
  },
  {
    icon: Scale,
    title: "Swiss Made",
    desc: "Für Schweizer Kanzleien konzipiert: CHF, MWST und auf Schweizer Rechnungsanforderungen ausgerichtete Prozesse.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Kanzlei registrieren",
    desc: "Erstellen Sie ein Kanzleikonto mit Ihren Firmendaten. Die Registrierung dauert nur wenige Minuten – Anwälte und Mitarbeitende können danach direkt hinzugefügt werden.",
  },
  {
    number: "02",
    title: "Leistungen & Mandate verwalten",
    desc: "Legen Sie Klienten und Mandate an. Erfassen Sie tägliche Leistungen mit Stoppuhr, Auslagen und Tätigkeitsbeschreibungen direkt einem Mandat zugeordnet.",
  },
  {
    number: "03",
    title: "Rechnungen stellen & Auswertungen",
    desc: "Erstellen Sie Rechnungen aus offenen Leistungen, exportieren Sie als Word-Dokument und behalten Sie den Überblick mit detaillierten Auswertungen und Charts.",
  },
];

const PRICING_PRO_FEATURES = [
  "Unbegrenzte Benutzer",
  "Benutzerverwaltung & Einladungslinks",
  "Erweiterte Auswertungen & Berichte",
  "Prioritäts-Support",
  "Gehaltsverwaltung & Akquisitionsprämien",
  "Automatische Budget-Warnungen",
];

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: "Schweizer Datenschutz",
    desc: "iReport Legal ist für die Anforderungen des Schweizer Datenschutzes konzipiert. Für den produktiven Einsatz ist die vollständige Verarbeitung und Speicherung der Daten auf Schweizer Infrastruktur vorgesehen.",
  },
  {
    icon: Server,
    title: "Dezentrale Datenhaltung",
    desc: "iReport Legal nutzt die dezentrale Infrastruktur des Internet Computer. Dadurch ist keine klassische zentrale Anwendungsdatenbank erforderlich und die Architektur vermeidet einen einzelnen zentralen Ausfallpunkt.",
  },
  {
    icon: Globe,
    title: "Betrieb in der Schweiz",
    desc: "Für den produktiven Einsatz ist der Betrieb von iReport Legal auf Schweizer Infrastruktur vorgesehen. Damit können Mandats- und Klientendaten innerhalb der Schweiz verarbeitet und gespeichert werden.",
  },
  {
    icon: Lock,
    title: "Sicherer Zugriff",
    desc: "Der Zugriff auf iReport Legal erfolgt über eine kryptografisch abgesicherte Authentifizierung. Benutzer- und Kanzleirechte sorgen für eine klare Trennung der Zugriffsberechtigungen.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────

export function LandingPage() {
  const { login, isAuthenticated, isInitializing } = useInternetIdentity();
  const navigate = useNavigate();
  const featuresRef = useRef<HTMLElement>(null);

  function handleLogin() {
    if (isAuthenticated) {
      navigate({ to: "/app/leistungen" });
    } else {
      login();
    }
  }

  function handleScrollToFeatures() {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Navigation ── */}
      <header
        data-ocid="landing.nav"
        className="sticky top-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm"
      >
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5 py-1">
            <img
              src="/assets/images/ireport-legal-logo.png"
              alt="iReport Legal Logo"
              className="h-[3.85rem] w-auto object-contain"
            />
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-ocid="landing.nav.login_button"
              onClick={handleLogin}
              disabled={isInitializing}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 px-3 py-1.5"
            >
              Anmelden
            </button>
            <Button
              data-ocid="landing.nav.register_button"
              onClick={() => navigate({ to: "/registrierung" })}
              className="btn-success gap-1.5 text-sm"
              size="sm"
            >
              Kanzlei registrieren
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        data-ocid="landing.hero.section"
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.45 0.19 270) 0%, oklch(0.55 0.22 264) 40%, oklch(0.48 0.17 280) 100%)",
        }}
      >
        {/* Decorative circles */}
        <div
          className="absolute top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full opacity-10"
          style={{ background: "oklch(0.85 0.08 264)" }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-[-100px] left-[-60px] w-[320px] h-[320px] rounded-full opacity-10"
          style={{ background: "oklch(0.80 0.10 264)" }}
          aria-hidden="true"
        />

        <div className="max-w-6xl mx-auto px-6 py-20 lg:py-28 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Copy */}
            <div className="space-y-7 text-white">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide border border-white/20 bg-white/10">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Für Schweizer Kanzleien
              </div>

              <p
                data-ocid="landing.hero.app_name"
                className="font-display font-semibold text-[2rem] leading-tight tracking-tight"
              >
                <span className="text-white">iReport</span>
                <span className="ml-1.5" style={{ color: "#7030A0" }}>
                  Legal
                </span>
              </p>

              <h1 className="font-display font-bold text-4xl lg:text-5xl leading-[1.12] tracking-tight">
                Kanzleimanagement für <span>Schweizer Anwaltsbüros</span>
              </h1>

              <p className="text-white/80 text-lg leading-relaxed max-w-lg">
                Die professionelle Kanzleilösung für Leistungserfassung,
                Mandatsverwaltung, Rechnungsstellung und Auswertungen.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <Button
                  data-ocid="landing.hero.primary_button"
                  onClick={() => navigate({ to: "/registrierung" })}
                  size="lg"
                  className="btn-success gap-2 text-base font-semibold shadow-md hover:shadow-lg"
                >
                  Kanzlei registrieren
                  <ArrowRight size={17} />
                </Button>
                <button
                  type="button"
                  data-ocid="landing.hero.scroll_link"
                  onClick={handleScrollToFeatures}
                  className="text-white/80 hover:text-white text-base font-medium flex items-center gap-2 transition-colors duration-200 justify-center sm:justify-start"
                >
                  Mehr erfahren ↓
                </button>
              </div>

              {/* Trust bar */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-white/70 text-sm">
                {[
                  "MWST-konform",
                  "Word-Export",
                  "Datentrennung",
                  "Für Schweizer Datenschutz konzipiert",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <CheckCircle2
                      size={13}
                      className="text-green-400 flex-shrink-0"
                    />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        data-ocid="landing.features.section"
        ref={featuresRef}
        id="features"
        className="py-20 px-6 bg-muted/30"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl lg:text-4xl text-foreground mb-3">
              Die zentralen Funktionen für Ihre Kanzlei
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Eine integrierte Lösung für den modernen Schweizer Kanzleibetrieb.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Card
                  key={f.title}
                  data-ocid={`landing.feature.item.${i + 1}`}
                  className="border border-border bg-card hover:shadow-md transition-smooth hover:-translate-y-0.5"
                >
                  <CardContent className="pt-6 pb-6 px-6 space-y-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: "oklch(0.62 0.16 264 / 0.1)" }}
                    >
                      <Icon
                        size={21}
                        style={{ color: "oklch(0.62 0.16 264)" }}
                      />
                    </div>
                    <h3 className="font-display font-semibold text-foreground">
                      {f.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {f.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section
        data-ocid="landing.howit.section"
        className="py-20 px-6 bg-background"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl lg:text-4xl text-foreground mb-3">
              In 3 Schritten zur effizienten Kanzlei
            </h2>
            <p className="text-muted-foreground text-lg">
              Einfaches Onboarding — in wenigen Minuten einsatzbereit.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div
                key={step.number}
                data-ocid={`landing.step.item.${i + 1}`}
                className="relative flex flex-col gap-4"
              >
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden lg:block absolute top-7 left-[3.75rem] right-0 h-px"
                    style={{ background: "oklch(0.62 0.16 264 / 0.25)" }}
                    aria-hidden="true"
                  />
                )}

                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-display font-bold text-xl text-white shadow-sm"
                    style={{ background: "oklch(0.62 0.16 264)" }}
                  >
                    {step.number}
                  </div>
                  <div className="pt-1">
                    <h3 className="font-display font-semibold text-foreground text-lg mb-2">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo-Hinweis ── */}
      <section
        data-ocid="landing.demo_notice.section"
        className="py-10 px-6 bg-background"
      >
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-border bg-card px-7 py-5 flex items-start gap-3.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "oklch(0.62 0.16 264 / 0.1)" }}
            >
              <Info
                size={18}
                style={{ color: "oklch(0.62 0.16 264)" }}
                aria-hidden="true"
              />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              iReport Legal befindet sich derzeit in der Demo- und
              Feedback-Phase. Die Anwendung dient zur Erprobung der Funktionen
              und zur gemeinsamen Weiterentwicklung. Produktive Mandats- oder
              Klientendaten sollten in dieser Version nicht verwendet werden.
            </p>
          </div>
        </div>
      </section>

      {/* ── Preise ── */}
      <section
        data-ocid="landing.pricing.section"
        id="preise"
        className="py-20 px-6 bg-muted/30"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display font-bold text-3xl lg:text-4xl text-foreground mb-3">
              Preise
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Transparente Preise pro Mitarbeiter — keine versteckten Kosten.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Jahres-Abonnement */}
            <Card
              data-ocid="landing.pricing.jahres.card"
              className="border-2 flex flex-col relative overflow-hidden"
              style={{ borderColor: "oklch(0.62 0.16 264)" }}
            >
              {/* Popular badge */}
              <div
                className="absolute top-0 right-0 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white rounded-bl-xl"
                style={{ background: "oklch(0.62 0.16 264)" }}
              >
                Empfohlen
              </div>

              <CardContent className="pt-8 pb-8 px-8 flex flex-col flex-1 gap-6">
                <div>
                  <div
                    className="text-sm font-semibold uppercase tracking-widest mb-1"
                    style={{ color: "oklch(0.62 0.16 264)" }}
                  >
                    Jahres-Abonnement
                  </div>
                  <div className="font-display font-bold text-4xl text-foreground mb-1 line-through decoration-2 decoration-foreground/40">
                    29.00 CHF
                  </div>
                  <div className="font-display font-bold text-4xl text-foreground mb-1">
                    0.00 CHF
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      data-ocid="landing.pricing.jahres.demo_badge"
                      className="badge-success"
                    >
                      Gratis Demo
                    </span>
                  </div>
                  <div className="text-muted-foreground text-sm space-y-0.5">
                    <div>pro Mitarbeiter / Monat</div>
                    <div className="text-xs">
                      0.00 CHF pro Mitarbeiter und Jahr.
                    </div>
                  </div>
                  <div className="text-foreground text-sm mt-2">
                    Jährliche Abrechnung, günstigerer Monatspreis.
                  </div>
                </div>

                <Button
                  data-ocid="landing.pricing.jahres.primary_button"
                  onClick={() => navigate({ to: "/registrierung" })}
                  className="w-full gap-2 btn-success mt-auto"
                >
                  Kostenlos starten
                  <ArrowRight size={15} />
                </Button>
              </CardContent>
            </Card>

            {/* Monats-Abonnement */}
            <Card
              data-ocid="landing.pricing.monats.card"
              className="border border-border bg-card flex flex-col"
            >
              <CardContent className="pt-8 pb-8 px-8 flex flex-col flex-1 gap-6">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    Monats-Abonnement
                  </div>
                  <div className="font-display font-bold text-4xl text-foreground mb-1 line-through decoration-2 decoration-foreground/40">
                    32.00 CHF
                  </div>
                  <div className="font-display font-bold text-4xl text-foreground mb-1">
                    0.00 CHF
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      data-ocid="landing.pricing.monats.demo_badge"
                      className="badge-success"
                    >
                      Gratis Demo
                    </span>
                  </div>
                  <div className="text-muted-foreground text-sm space-y-0.5">
                    <div>pro Mitarbeiter / Monat</div>
                    <div className="text-xs">
                      Monatliche Abrechnung zum regulären Satz.
                    </div>
                  </div>
                  <div className="text-foreground text-sm mt-2">
                    Monatliche Abrechnung, flexibel kündbar.
                  </div>
                </div>

                <Button
                  data-ocid="landing.pricing.monats.primary_button"
                  onClick={() => navigate({ to: "/registrierung" })}
                  variant="outline"
                  className="w-full gap-2 border-border hover:bg-muted/50 mt-auto"
                >
                  Kostenlos starten
                  <ArrowRight size={15} />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Gemeinsame Feature-Liste — gilt für beide Abonnements */}
          <div
            data-ocid="landing.pricing.features.list"
            className="max-w-3xl mx-auto mt-8 rounded-xl border border-border bg-card px-8 py-7"
          >
            <div className="text-center mb-5">
              <h3 className="font-display font-semibold text-foreground text-lg">
                In beiden Paketen enthalten
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                Alle Funktionen stehen Ihnen unabhängig vom gewählten
                Abrechnungsmodell zur Verfügung.
              </p>
            </div>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2.5">
              {PRICING_PRO_FEATURES.map((feat) => (
                <li
                  key={feat}
                  className="flex items-start gap-2.5 text-sm text-foreground"
                >
                  <CheckCircle2
                    size={15}
                    className="flex-shrink-0 mt-0.5"
                    style={{ color: "oklch(0.62 0.16 264)" }}
                  />
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-muted-foreground text-sm mt-8 max-w-2xl mx-auto">
            iReport Legal befindet sich aktuell in der Demo- und Feedback-Phase.
            Die Nutzung der Demo ist kostenlos. Die dargestellten Preise
            entsprechen dem derzeit geplanten Preismodell für den späteren
            produktiven Betrieb.
          </p>
        </div>
      </section>

      {/* ── Vertrauen & Compliance ── */}
      <section
        data-ocid="landing.trust.section"
        className="py-20 px-6 bg-background"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-display font-bold text-3xl lg:text-4xl text-foreground mb-3">
              Datenschutz und Datensouveränität im Fokus
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              iReport Legal wird mit Blick auf die besonderen Anforderungen
              Schweizer Kanzleien an Datenschutz, Vertraulichkeit und
              Datenhaltung entwickelt.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
            {TRUST_ITEMS.map((item, i) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  data-ocid={`landing.trust.item.${i + 1}`}
                  className="border border-border bg-card hover:shadow-md transition-smooth hover:-translate-y-0.5 text-center"
                >
                  <CardContent className="pt-7 pb-7 px-6 space-y-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
                      style={{ background: "oklch(0.62 0.16 264 / 0.1)" }}
                    >
                      <Icon
                        size={22}
                        style={{ color: "oklch(0.62 0.16 264)" }}
                      />
                    </div>
                    <h3 className="font-display font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Blockchain callout */}
          <div
            className="rounded-2xl px-8 py-10 text-white relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.35 0.15 270) 0%, oklch(0.45 0.19 264) 60%, oklch(0.40 0.16 280) 100%)",
            }}
          >
            <div
              className="absolute top-[-60px] right-[-60px] w-[300px] h-[300px] rounded-full opacity-10"
              style={{ background: "oklch(0.85 0.08 264)" }}
              aria-hidden="true"
            />
            <div className="relative z-10 grid lg:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border border-white/20 bg-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Internet Computer Blockchain
                </div>
                <h3 className="font-display font-bold text-2xl leading-snug">
                  Dezentrale Infrastruktur – Schweizer Betrieb als Zielbild
                </h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  iReport Legal basiert auf dem Internet Computer und nutzt eine
                  dezentrale Anwendungsarchitektur. Für den produktiven Einsatz
                  ist ein Betrieb auf Schweizer Infrastruktur vorgesehen.
                </p>
              </div>
              <div className="space-y-3">
                {[
                  "Dezentrale Anwendungsarchitektur",
                  "Kein zentraler Single Point of Failure",
                  "Kryptografisch abgesicherte Authentifizierung über Internet Identity",
                  "Strikte Trennung von Kanzlei- und Benutzerrechten",
                  "Schweizer Datenhaltung für den produktiven Betrieb vorgesehen",
                ].map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-2.5 text-sm text-white/90"
                  >
                    <CheckCircle2
                      size={14}
                      className="text-green-400 flex-shrink-0 mt-0.5"
                    />
                    {point}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section
        data-ocid="landing.cta.section"
        className="py-20 px-6 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.45 0.19 270) 0%, oklch(0.55 0.22 264) 60%, oklch(0.50 0.20 275) 100%)",
        }}
      >
        {/* Decorative */}
        <div
          className="absolute top-[-60px] right-[-40px] w-[300px] h-[300px] rounded-full opacity-10"
          style={{ background: "oklch(0.85 0.08 264)" }}
          aria-hidden="true"
        />

        <div className="max-w-2xl mx-auto text-center space-y-6 relative z-10">
          <h2 className="font-display font-bold text-3xl lg:text-4xl text-white leading-tight">
            Bereit loszulegen?
          </h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Melden Sie sich an und starten Sie noch heute mit der Zeiterfassung,
            Mandatsverwaltung und professionellen Rechnungsstellung.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button
              data-ocid="landing.cta.primary_button"
              onClick={() => navigate({ to: "/registrierung" })}
              size="lg"
              className="btn-success gap-2 text-base font-semibold shadow-md"
            >
              Kanzlei registrieren
              <ArrowRight size={17} />
            </Button>
            <button
              type="button"
              data-ocid="landing.cta.login_button"
              onClick={handleLogin}
              disabled={isInitializing}
              className="text-white/80 hover:text-white text-base font-medium transition-colors duration-200 px-4 py-2"
            >
              Bereits registriert? Einloggen →
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-card border-t border-border px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 py-1">
          <img
            src="/assets/images/ireport-legal-logo.png"
            alt="iReport Legal"
            className="h-[3.85rem] w-auto object-contain opacity-70"
          />
          <span>—</span>
          <span>Für Schweizer Kanzleien</span>
        </div>
        <span>
          © 2026{" "}
          <a
            href="https://www.iservices.ch"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary transition-colors duration-200 font-medium"
          >
            iServices AG
          </a>
        </span>
      </footer>
    </div>
  );
}
