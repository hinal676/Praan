import React from "react";
import { Link, useLocation } from "react-router-dom";

function getUserInitials(name = "User") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export default function ShellLayout({ user, onLogout, children }) {
  const location = useLocation();

  const navItems = [
    { to: "/", label: "Recipe Generator" },
    { to: "/discover", label: "All Recipes" },
    { to: "/profile", label: "My Profile" },
  ];

  return (
    <div className="react-shell">
      <aside className="side-panel">
        <div className="panel-header">
          <div className="logo-wrap">
            <div className="logo-mark">🍃</div>
            <div className="logo">Praan</div>
          </div>
        </div>

        <div className="user-section">
          <div className="user-avatar">
            <span>{getUserInitials(user?.name || "User")}</span>
          </div>
          <div className="user-meta">
            <div className="user-name">{user?.name || "User"}</div>
            <div className="user-email">{user?.email || "user@email.com"}</div>
          </div>
        </div>

        <h3 className="nav-heading">Navigation</h3>
        <nav className="nav-menu">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`nav-item ${location.pathname === item.to ? "active" : ""}`}
            >
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="side-panel-footer">
          <button className="side-action" type="button" onClick={onLogout}>
            <span className="side-action-icon">↩</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content react-main-content">{children}</main>
    </div>
  );
}
