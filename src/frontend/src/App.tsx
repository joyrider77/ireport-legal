import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { Suspense, lazy } from "react";
import { Role } from "./backend";
import { Layout } from "./components/Layout";
import { AuswertungenPage } from "./pages/AuswertungenPage";
import { BenutzerverwaltungPage } from "./pages/BenutzerverwaltungPage";
import { KlientenPage } from "./pages/KlientenPage";
import { LandingPage } from "./pages/LandingPage";
import { LeistungenPage } from "./pages/LeistungenPage";
import { RechnungenPage } from "./pages/RechnungenPage";
import { RegistrierungPage } from "./pages/RegistrierungPage";
import { AuditTrailPage } from "./pages/datenschutz/AuditTrailPage";
import { DatenfluessePage } from "./pages/datenschutz/DatenfluessePage";
import { DateninventarPage } from "./pages/datenschutz/DateninventarPage";
import { DatenschutzDashboardPage } from "./pages/datenschutz/DatenschutzDashboardPage";
import { DsrPage } from "./pages/datenschutz/DsrPage";
import { LoeschkonzeptPage } from "./pages/datenschutz/LoeschkonzeptPage";
import { queryKeys, useBackend, useIsSuperAdmin } from "./utils/backend";

// ─── Lazy-loaded Super-Admin pages ──────────────────────────────────────────
const PlattformAdminPage = lazy(() =>
  import("./pages/PlattformAdminPage").then((m) => ({
    default: m.PlattformAdminPage,
  })),
);
const RechnungsvorlagenPage = lazy(() =>
  import("./pages/RechnungsvorlagenPage").then((m) => ({
    default: m.RechnungsvorlagenPage,
  })),
);
const EinstellungenPage = lazy(() =>
  import("./pages/EinstellungenPage").then((m) => ({
    default: m.EinstellungenPage,
  })),
);
const MeineNachrichtenPage = lazy(() => import("./pages/MeineNachrichtenPage"));
const FeedbackSupportPage = lazy(() => import("./pages/FeedbackSupportPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Route Guards ─────────────────────────────────────────────────────────

function ProtectedLayout() {
  const { isAuthenticated, isInitializing } = useInternetIdentity();

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return <Layout />;
}

/**
 * SuperAdminGuard — gates a route so only Super-Admins can access it.
 * Non-super-admins are redirected to /app/leistungen. While the
 * isSuperAdmin query is loading, a spinner is shown.
 */
function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { data: isSuperAdmin, isLoading } = useIsSuperAdmin();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/app/leistungen" />;
  }

  return <>{children}</>;
}

/**
 * AdminGuard — gates a route so only Kanzlei-Admins (isAdmin) and
 * Plattform-Admins can access it. anwalt / mitarbeiter / mandant are
 * redirected to /app/leistungen. While the currentUser query is loading,
 * a spinner is shown. Mirrors SuperAdminGuard's pattern.
 *
 * The role is derived from currentUser.role (5-role model) with a
 * fallback to the legacy isAdmin flag so users whose record predates the
 * role migration keep their access.
 */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isInitializing } = useInternetIdentity();
  const { actor, isLoading: actorLoading } = useBackend();
  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  if (isInitializing) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  if (userLoading) {
    return <PageLoader />;
  }

  const role =
    currentUser?.role ?? (currentUser?.isAdmin ? Role.admin : Role.mitarbeiter);
  const isAdminOrPlattformAdmin =
    role === Role.admin || role === Role.plattform_admin;
  if (!isAdminOrPlattformAdmin) {
    return <Navigate to="/app/leistungen" />;
  }

  return <>{children}</>;
}

// ─── Routes ───────────────────────────────────────────────────────────────

const rootRoute = createRootRoute({
  component: Outlet,
});

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const registrierungRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/registrierung",
  component: RegistrierungPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  component: ProtectedLayout,
});

const appIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: () => <Navigate to="/app/leistungen" />,
});

const leistungenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/leistungen",
  component: LeistungenPage,
});

const klientenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/klienten",
  component: KlientenPage,
});

const rechnungenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rechnungen",
  component: RechnungenPage,
});

const auswertungenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/auswertungen",
  component: AuswertungenPage,
});

const benutzerverwaltungRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/benutzerverwaltung",
  component: BenutzerverwaltungPage,
});

const datenschutzRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/datenschutz",
  component: DatenschutzDashboardPage,
});

const datenschutzDateninventarRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/datenschutz/dateninventar",
  component: DateninventarPage,
});

const datenschutzDatenfluesseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/datenschutz/datenfluesse",
  component: DatenfluessePage,
});

const datenschutzDsrRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/datenschutz/dsr",
  component: DsrPage,
});

const datenschutzAuditTrailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/datenschutz/audit-trail",
  component: AuditTrailPage,
});

const datenschutzLoeschkonzeptRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/datenschutz/loeschkonzept",
  component: LoeschkonzeptPage,
});

const plattformAdminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/plattform-admin",
  component: () => (
    <SuperAdminGuard>
      <Suspense fallback={<PageLoader />}>
        <PlattformAdminPage />
      </Suspense>
    </SuperAdminGuard>
  ),
});

const aktiveBenutzerRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/aktive-benutzer",
  component: () => (
    <Navigate
      to="/app/benutzerverwaltung"
      search={{ tab: "aktive-benutzer" }}
    />
  ),
});

const rechnungsvorlagenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rechnungsvorlagen",
  component: () => (
    <AdminGuard>
      <Suspense fallback={<PageLoader />}>
        <RechnungsvorlagenPage />
      </Suspense>
    </AdminGuard>
  ),
});

const einstellungenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/einstellungen",
  component: () => (
    <AdminGuard>
      <Suspense fallback={<PageLoader />}>
        <EinstellungenPage />
      </Suspense>
    </AdminGuard>
  ),
});

const meineNachrichtenRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/meine-nachrichten",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <MeineNachrichtenPage />
    </Suspense>
  ),
});

const feedbackSupportRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/feedback-support",
  component: () => (
    <SuperAdminGuard>
      <Suspense fallback={<PageLoader />}>
        <FeedbackSupportPage />
      </Suspense>
    </SuperAdminGuard>
  ),
});

const routeTree = rootRoute.addChildren([
  landingRoute,
  registrierungRoute,
  appRoute.addChildren([
    appIndexRoute,
    leistungenRoute,
    klientenRoute,
    rechnungenRoute,
    auswertungenRoute,
    benutzerverwaltungRoute,
    datenschutzRoute,
    datenschutzDateninventarRoute,
    datenschutzDatenfluesseRoute,
    datenschutzDsrRoute,
    datenschutzAuditTrailRoute,
    datenschutzLoeschkonzeptRoute,
    plattformAdminRoute,
    aktiveBenutzerRoute,
    rechnungsvorlagenRoute,
    einstellungenRoute,
    meineNachrichtenRoute,
    feedbackSupportRoute,
  ]),
]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return <RouterProvider router={router} />;
}
