import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Outlet, useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Toaster } from "sonner";
import { DemoNotice } from "./DemoNotice";
import { FeedbackModal } from "./FeedbackModal";
import { Sidebar } from "./Sidebar";

const ROUTE_TITLES: Record<string, string> = {
  "/app/leistungen": "Leistungen & Auslagen",
  "/app/klienten": "Klienten & Mandate",
  "/app/rechnungen": "Rechnungen & Zahlungen",
  "/app/rechnungsvorlagen": "Rechnungsvorlagen",
  "/app/auswertungen": "Auswertungen",
  "/app/benutzerverwaltung": "Benutzerverwaltung",
  "/app/einstellungen": "Einstellungen",
  "/app/datenschutz/dateninventar": "Datenschutz · Dateninventar",
  "/app/datenschutz/datenfluesse": "Datenschutz · Datenflüsse",
  "/app/datenschutz/dsr": "Datenschutz · DSR-Anträge",
  "/app/datenschutz/audit-trail": "Datenschutz · Audit-Trail",
  "/app/datenschutz/loeschkonzept": "Datenschutz · Löschkonzept",
  "/app/datenschutz": "Datenschutz-Dashboard",
  "/app/plattform-admin": "Plattform-Admin",
  "/app/registrierung": "Registrierung",
  "/app": "Dashboard",
};

function getPageTitle(pathname: string): string {
  for (const [route, title] of Object.entries(ROUTE_TITLES)) {
    if (pathname.startsWith(route)) return title;
  }
  return "iReport Legal";
}

export function Layout() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const location = useLocation();

  const sidebarWidth = collapsed ? 64 : 240;
  const pageTitle = getPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 bg-foreground/30 z-20"
          onClick={() => setMobileOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setMobileOpen(false)}
          aria-label="Menü schliessen"
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <div
        className={cn(
          isMobile
            ? cn(
                "fixed z-30 transition-transform duration-300",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            : "relative",
        )}
      >
        <Sidebar
          collapsed={isMobile ? false : collapsed}
          onToggle={() => {
            if (isMobile) setMobileOpen(false);
            else setCollapsed((c) => !c);
          }}
        />
      </div>

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: isMobile ? 0 : sidebarWidth }}
      >
        {/* Top header */}
        <header
          data-ocid="header.panel"
          className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 bg-card border-b border-border shadow-sm min-h-[64px]"
        >
          {isMobile && (
            <button
              type="button"
              data-ocid="header.menu_button"
              onClick={() => setMobileOpen((o) => !o)}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-smooth"
              aria-label="Menü öffnen"
            >
              <Menu size={20} />
            </button>
          )}
          <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
            {pageTitle}
          </h1>
          {/* Demo-Hinweis — gelb hinterlegte Zone rechts neben dem Titel,
              erscheint auf allen Seiten über das Layout. Die "Feedback
              geben"-Aktion öffnet das FeedbackModal (Layout-Ebene). */}
          <DemoNotice onOpenFeedback={() => setFeedbackOpen(true)} />
        </header>

        {/* Page content */}
        <main
          data-ocid="main.content"
          className="flex-1 bg-background overflow-y-auto"
        >
          <Outlet />
        </main>

        {/* Footer */}
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

      {/*
        Globaler Toast-Provider (sonner). Wird bewusst AUSserhalb des
        Seiten-/Modal-Kontexts gerendert, damit ein Toast das Schliessen
        eines Modals (z.B. CreateRechnungModal) und das Unmounten der
        aufrufenden Komponente überlebt. richColors liefert klare
        Erfolg-/Fehler-Farben passend zu den bestehenden
        toast.success/error/warning-Aufrufen.
      */}
      <Toaster
        richColors
        position="top-right"
        toastOptions={{ duration: 5000 }}
      />

      {/* Feedback-Modal — auf Layout-Ebene gerendert, damit es auf allen
          Seiten über das gelbe Demo-Badge geöffnet werden kann. State wird
          hier gehalten; DemoNotice triggert onOpenFeedback. */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  );
}
