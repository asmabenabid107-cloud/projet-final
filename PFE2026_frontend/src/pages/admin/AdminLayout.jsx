import { createElement, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Package,
  Route,
  Truck,
  UsersRound,
  Warehouse,
  X,
} from "lucide-react";
import ThemeToggleButton from "../../components/ThemeToggleButton.jsx";

const primaryNav = [
  {
    to: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    accent: "#2563eb",
  },
  {
    to: "/admin/expediteurs",
    label: "Expediteurs",
    icon: UsersRound,
    accent: "#f59e0b",
  },
  {
    to: "/admin/planification",
    label: "Planification",
    icon: MapPinned,
    accent: "#0f766e",
  },
];

const navGroups = [
  {
    id: "tournees",
    title: "Tournees",
    icon: Route,
    accent: "#0f766e",
    activePath: ["/admin/route-planner", "/admin/tournees-accepted"],
    items: [
      {
        to: "/admin/route-planner",
        label: "Generer IA",
        color: "#0f766e",
        end: true,
      },
      {
        to: "/admin/tournees-accepted",
        label: "Acceptees",
        color: "#16a34a",
      },
    ],
  },
  {
    id: "livreurs",
    title: "Livreurs",
    icon: Truck,
    accent: "#0891b2",
    activePath: ["/admin/livreurs"],
    items: [
      {
        to: "/admin/livreurs",
        label: "Demandes",
        color: "#0891b2",
        end: true,
      },
      {
        to: "/admin/livreurs/approuves",
        label: "Approuves",
        color: "#16a34a",
      },
      {
        to: "/admin/livreurs/conges",
        label: "Conges livreurs",
        color: "#f59e0b",
      },
    ],
  },
  {
    id: "colis",
    title: "Colis",
    icon: Package,
    accent: "#7c3aed",
    activePath: ["/admin/colis"],
    items: [
      {
        to: "/admin/colis",
        label: "Tous les colis",
        color: "#7c3aed",
        end: true,
      },
      {
        to: "/admin/colis/confirmes",
        label: "Confirmes",
        color: "#16a34a",
      },
      {
        to: "/admin/colis/refuses",
        label: "Refuses",
        color: "#dc2626",
      },
    ],
  },
];

const secondaryNav = [
  {
    to: "/admin/vehicules",
    label: "Vehicules",
    icon: Warehouse,
    accent: "#ea580c",
  },
];

function activeTitle(pathname) {
  const flatItems = [
    ...primaryNav,
    ...secondaryNav,
    ...navGroups.flatMap((group) => group.items),
  ];

  const match = flatItems
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];

  return match?.label || "Espace Admin";
}

function isGroupActive(group, pathname) {
  return group.activePath.some((path) => pathname.startsWith(path));
}

function PrimaryNavItem({ to, label, icon, accent, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => `adminNavItem ${isActive ? "isActive" : ""}`}
      style={{ "--admin-nav-accent": accent }}
    >
      <span className="adminNavIcon">
        {createElement(icon, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 })}
      </span>
      <span>{label}</span>
    </NavLink>
  );
}

function MenuGroup({ group, active, onNavigate }) {
  const [open, setOpen] = useState(active);
  const expanded = active || open;

  return (
    <div className={`adminNavGroup ${active ? "isActive" : ""}`}>
      <button
        type="button"
        className="adminNavGroupButton"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={expanded}
        aria-controls={`admin-nav-${group.id}`}
        style={{ "--admin-nav-accent": group.accent }}
      >
        <span className="adminNavGroupLabel">
          <span className="adminNavIcon">
            {createElement(group.icon, { "aria-hidden": "true", size: 18, strokeWidth: 1.9 })}
          </span>
          <span>{group.title}</span>
        </span>
        <ChevronDown className="adminNavChevron" aria-hidden="true" size={16} />
      </button>

      {expanded && (
        <div id={`admin-nav-${group.id}`} className="adminNavChildren">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) => `adminNavSubItem ${isActive ? "isActive" : ""}`}
              style={{ "--admin-nav-accent": item.color }}
            >
              <span className="adminNavDot" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("adminNavOpen", mobileOpen);
    return () => document.body.classList.remove("adminNavOpen");
  }, [mobileOpen]);

  function logout() {
    localStorage.removeItem("admin_access_token");
    navigate("/admin/login");
  }

  function closeMobileNav() {
    setMobileOpen(false);
  }

  return (
    <div className={`adminShell ${mobileOpen ? "isNavOpen" : ""}`}>
      <div className="adminMobileBar">
        <button
          type="button"
          className="adminIconButton"
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir le menu admin"
          aria-expanded={mobileOpen}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <div>
          <div className="adminMobileKicker">MZ Logistic</div>
          <div className="adminMobileTitle">{activeTitle(location.pathname)}</div>
        </div>
        <ThemeToggleButton compact className="adminMobileTheme" />
      </div>

      <button
        type="button"
        className="adminSidebarBackdrop"
        aria-label="Fermer le menu admin"
        onClick={() => setMobileOpen(false)}
      />

      <aside className="adminSidebar" aria-label="Navigation admin">
        <div className="adminSidebarHead">
          <div className="adminBrand">
            <div className="adminBrandMark">MZ</div>
            <div className="adminBrandText">
              <strong>MZ Logistic</strong>
              <span>Espace Admin</span>
            </div>
          </div>
          <button
            type="button"
            className="adminIconButton adminSidebarClose"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu admin"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <nav className="adminNav" aria-label="Menu principal">
          <div className="adminNavSection">
            <div className="adminNavSectionLabel">Pilotage</div>
            {primaryNav.map((item) => (
              <PrimaryNavItem key={item.to} {...item} onNavigate={closeMobileNav} />
            ))}
          </div>

          <div className="adminNavSection">
            <div className="adminNavSectionLabel">Operations</div>
            {navGroups.map((group) => (
              <MenuGroup
                key={group.id}
                group={group}
                active={isGroupActive(group, location.pathname)}
                onNavigate={closeMobileNav}
              />
            ))}
            {secondaryNav.map((item) => (
              <PrimaryNavItem key={item.to} {...item} onNavigate={closeMobileNav} />
            ))}
          </div>
        </nav>

        <div className="adminSidebarTools">
          <ThemeToggleButton className="adminShellTheme" />
          <button type="button" className="adminLogoutButton" onClick={logout}>
            <LogOut size={17} aria-hidden="true" />
            <span>Se deconnecter</span>
          </button>
        </div>
      </aside>

      <main className="adminMain">
        <Outlet />
      </main>
    </div>
  );
}
