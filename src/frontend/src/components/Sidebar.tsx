import { Role } from "@/backend";
import { cn } from "@/lib/utils";
import {
  queryKeys,
  useBackend,
  useIsSuperAdmin,
  useKanzlei,
  useUnreadSupportCountForAdmin,
} from "@/utils/backend";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCog,
  FileText,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Scale,
  Settings,
  Shield,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  ocid: string;
  /** Shield accent for the Datenschutz section icon. */
  shield?: boolean;
}

/**
 * Permission matrix: which nav routes each role may see.
 * Routes are identified by their `to` path. The matrix encodes the
 * documented role model:
 *  - plattform_admin: everything admin sees + superAdminOnly items
 *  - admin: adminOnly items + standard items
 *  - anwalt: leistungen / klienten / rechnungen / auswertungen
 *  - mitarbeiter: leistungen / klienten / rechnungen
 *  - mandant: only mandant-accessible items (none in the current nav)
 */
const ROLE_NAV_PERMISSIONS: Record<Role, Set<string>> = {
  [Role.plattform_admin]: new Set([
    "/app/leistungen",
    "/app/klienten",
    "/app/rechnungen",
    "/app/rechnungsvorlagen",
    "/app/auswertungen",
    "/app/datenschutz",
    "/app/benutzerverwaltung",
    "/app/einstellungen",
    "/app/plattform-admin",
    "/app/meine-nachrichten",
    "/app/feedback-support",
  ]),
  [Role.admin]: new Set([
    "/app/leistungen",
    "/app/klienten",
    "/app/rechnungen",
    "/app/rechnungsvorlagen",
    "/app/auswertungen",
    "/app/datenschutz",
    "/app/benutzerverwaltung",
    "/app/einstellungen",
    "/app/meine-nachrichten",
  ]),
  [Role.anwalt]: new Set([
    "/app/leistungen",
    "/app/klienten",
    "/app/rechnungen",
    "/app/auswertungen",
    "/app/meine-nachrichten",
  ]),
  [Role.mitarbeiter]: new Set([
    "/app/leistungen",
    "/app/klienten",
    "/app/rechnungen",
    "/app/meine-nachrichten",
  ]),
  [Role.mandant]: new Set(["/app/meine-nachrichten"]),
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Leistungen & Auslagen",
    to: "/app/leistungen",
    icon: Clock,
    ocid: "nav.leistungen.link",
  },
  {
    label: "Klienten & Mandate",
    to: "/app/klienten",
    icon: Users,
    ocid: "nav.klienten.link",
  },
  {
    label: "Rechnungen & Zahlungen",
    to: "/app/rechnungen",
    icon: FileText,
    ocid: "nav.rechnungen.link",
  },
  {
    label: "Rechnungsvorlagen",
    to: "/app/rechnungsvorlagen",
    icon: FileCog,
    ocid: "nav.rechnungsvorlagen.link",
  },
  {
    label: "Auswertungen",
    to: "/app/auswertungen",
    icon: BarChart2,
    ocid: "nav.auswertungen.link",
  },
  {
    label: "Datenschutz",
    to: "/app/datenschutz",
    icon: Shield,
    ocid: "nav.datenschutz.link",
    shield: true,
  },
  {
    label: "Benutzerverwaltung",
    to: "/app/benutzerverwaltung",
    icon: UserCog,
    ocid: "nav.benutzerverwaltung.link",
  },
  {
    label: "Einstellungen",
    to: "/app/einstellungen",
    icon: Settings,
    ocid: "nav.einstellungen.link",
  },
  {
    label: "Plattform-Admin",
    to: "/app/plattform-admin",
    icon: ShieldCheck,
    ocid: "nav.plattform_admin.link",
  },
  {
    label: "Meine Nachrichten",
    to: "/app/meine-nachrichten",
    icon: MessageSquare,
    ocid: "nav.meine_nachrichten.link",
  },
  {
    label: "Feedback & Support",
    to: "/app/feedback-support",
    icon: LifeBuoy,
    ocid: "nav.feedback_support.link",
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Derive the effective role for the current user. The backend exposes
 * `currentUser.role` (optional, present on the new 5-role model). When it
 * is missing we fall back to the legacy `isAdmin` / super-admin signals so
 * the sidebar keeps working for users whose record predates the migration.
 */
function deriveUserRole(
  currentUser: { role?: Role; isAdmin: boolean } | null | undefined,
  isSuperAdmin: boolean | undefined,
): Role {
  if (currentUser?.role) return currentUser.role;
  if (isSuperAdmin) return Role.plattform_admin;
  if (currentUser?.isAdmin) return Role.admin;
  return Role.mitarbeiter;
}

const ROLE_LABEL: Record<Role, string> = {
  [Role.plattform_admin]: "Plattform-Admin",
  [Role.admin]: "Administrator",
  [Role.anwalt]: "Anwalt",
  [Role.mitarbeiter]: "Mitarbeiter",
  [Role.mandant]: "Mandant",
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { identity, clear } = useInternetIdentity();
  const { actor, isLoading: actorLoading } = useBackend();
  const { data: kanzlei } = useKanzlei();

  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: async () => (actor ? actor.getCurrentUser() : null),
    enabled: !!actor && !actorLoading,
  });

  // Role derivation uses the legacy isAdmin flag as a fallback only; the
  // authoritative signal is currentUser.role from the 5-role model. Der
  // isSuperAdmin-Parameter muss das tatsächliche useIsSuperAdmin()-Ergebnis
  // sein, damit der Fallback-Zweig (plattform_admin) korrekt greift.
  const { data: isSuperAdmin = false } = useIsSuperAdmin();
  const role = deriveUserRole(currentUser, isSuperAdmin);

  // Anzahl der neuen ('Neu') Support-Konversationen für den Plattform-Admin.
  // Wiederverwendet den bestehenden Query (supportUnreadAdmin), der von den
  // Support-Mutationen automatisch invalidiert wird — keine zweite Datenquelle.
  const { data: unreadSupportCount = 0 } = useUnreadSupportCountForAdmin();

  const principal = identity?.getPrincipal().toText();
  const shortPrincipal = principal
    ? `${principal.slice(0, 5)}…${principal.slice(-4)}`
    : "Anonym";

  const userInitials = currentUser
    ? `${currentUser.vorname.charAt(0)}${currentUser.nachname.charAt(0)}`.toUpperCase()
    : "LE";

  const allowedRoutes = ROLE_NAV_PERMISSIONS[role];
  const visibleItems = NAV_ITEMS.filter((item) => allowedRoutes.has(item.to));

  return (
    <aside
      data-ocid="sidebar.panel"
      className={cn(
        "fixed left-0 top-0 h-screen z-30 flex flex-col transition-all duration-300",
        "border-r border-[oklch(var(--sidebar-border))]",
        collapsed ? "w-16" : "w-60",
      )}
      style={{
        background: "oklch(var(--sidebar))",
        color: "oklch(var(--sidebar-foreground))",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[oklch(var(--sidebar-border))] min-h-[64px]">
        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-white/20 flex items-center justify-center">
          <Scale size={16} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <p className="text-white font-display font-bold text-sm leading-tight truncate">
              iReport Legal
            </p>
            <p className="text-white/60 text-xs leading-tight truncate">
              Kanzlei Management
            </p>
          </div>
        )}
      </div>

      {/* Kanzleiname */}
      {!collapsed && (
        <div
          data-ocid="sidebar.kanzlei_name"
          className="px-4 py-3 border-b border-[oklch(var(--sidebar-border))]"
        >
          <p className="text-white/90 font-display font-semibold text-sm leading-tight truncate">
            {kanzlei?.name ?? "—"}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1 px-2">
          {visibleItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  data-ocid={item.ocid}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-smooth",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                    collapsed ? "justify-center px-2" : "",
                    isActive
                      ? "bg-white text-[oklch(var(--primary))] shadow-sm"
                      : "text-white/80 hover:bg-white/15 hover:text-white",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    size={18}
                    className={cn(
                      "flex-shrink-0",
                      item.shield && !isActive && "shield-icon",
                      item.shield && isActive && "shield-icon-active",
                    )}
                  />
                  {!collapsed && (
                    <span className="truncate leading-tight">{item.label}</span>
                  )}
                  {!collapsed &&
                    item.to === "/app/feedback-support" &&
                    unreadSupportCount > 0 && (
                      <span
                        className="nav-unread-dot"
                        aria-label={`${unreadSupportCount} neue Konversationen`}
                        title={`${unreadSupportCount} neue Konversationen`}
                        data-ocid="nav.feedback_support.unread_dot"
                      />
                    )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-2 border-t border-[oklch(var(--sidebar-border))]">
        <button
          type="button"
          data-ocid="sidebar.collapse_toggle"
          onClick={onToggle}
          className={cn(
            "w-full flex items-center justify-center py-2 rounded-md text-white/60",
            "hover:bg-white/15 hover:text-white transition-smooth text-xs gap-1.5",
            collapsed ? "" : "px-2",
          )}
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>Einklappen</span>
            </>
          )}
        </button>
      </div>

      {/* User info + Logout */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-4 border-t border-[oklch(var(--sidebar-border))]",
          collapsed ? "justify-center" : "",
        )}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold">
          {userInitials}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">
              {currentUser
                ? `${currentUser.vorname} ${currentUser.nachname}`
                : shortPrincipal}
            </p>
            <p className="text-white/50 text-xs truncate">{ROLE_LABEL[role]}</p>
          </div>
        )}
        <button
          type="button"
          data-ocid="sidebar.logout_button"
          onClick={() => clear()}
          className="flex-shrink-0 p-1.5 rounded-md text-white/60 hover:bg-white/15 hover:text-white transition-smooth"
          aria-label="Abmelden"
          title="Abmelden"
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
}
