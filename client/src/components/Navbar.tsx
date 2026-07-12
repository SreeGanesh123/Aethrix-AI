import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import aethrixLogo from "../assets/Aethrix2.jpeg";
import { getStoredUser } from "../utils/auth";

const links = [
  { label: "Platform", href: "#platform" },
  { label: "Workflow", href: "#explore" },
  { label: "Outcomes", href: "#outcomes" },
  { label: "Support", href: "/contact" },
];

import type { Role } from "../utils/auth";

const allDropdownLinks = [
  { label: "Assessment Hub", to: "/assessment", roles: null },
  { label: "Candidate Workspace", to: "/candidate", roles: ["candidate", "recruiter", "trainer", "super-admin"] as Role[] },
  { label: "Recruiter Workspace", to: "/recruiter", roles: ["recruiter", "super-admin"] as Role[] },
  { label: "Trainer Dashboard", to: "/trainer", roles: ["trainer", "super-admin"] as Role[] },
  { label: "Admin Dashboard", to: "/admin", roles: ["super-admin"] as Role[] },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [user, setUser] = useState(getStoredUser());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onAuthChange = () => setUser(getStoredUser());
    window.addEventListener("aethrix-auth-change", onAuthChange);
    return () => window.removeEventListener("aethrix-auth-change", onAuthChange);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, []);

  // Accessibility: trap focus inside mobile menu when open, and close on Escape
  useEffect(() => {
    if (!menuOpen) return;

    const navEl = navRef.current;
    const focusableSelector = 'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusable = navEl ? Array.from(navEl.querySelectorAll(focusableSelector)) as HTMLElement[] : [];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        if (focusable.length === 0) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Move focus to first focusable element in the nav
    setTimeout(() => first?.focus(), 0);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.classList.add('menu-open');
    } else {
      document.body.classList.remove('menu-open');
    }
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  return (
    <header className={`site-header${menuOpen ? " is-open" : ""}`}>
      <Link to="/" className="brand-mark" aria-label="AETHRIX AI home">
        {user ? (
          <>
            <img
              src={user.profilePicture || aethrixLogo}
              alt={user.name || "Profile"}
              className="brand-logo brand-logo--avatar"
            />
            <span>{user.name}</span>
          </>
        ) : (
          <>
            <img src={aethrixLogo} alt="AETHRIX AI" className="brand-logo" />
            <span>AETHRIX AI</span>
          </>
        )}
      </Link>

      <button
        type="button"
        className={`nav-toggle${menuOpen ? " is-open" : ""}`}
        aria-label="Toggle navigation"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id="primary-nav" ref={navRef} className={`nav-links${menuOpen ? " is-open" : ""}`} aria-label="Primary navigation">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMenuOpen(false)}
          >
            {link.label}
          </a>
        ))}

        <div className="nav-dropdown" ref={dropdownRef}>
          <button
            type="button"
            className="nav-dropdown-toggle"
            onClick={() => setDropdownOpen((open) => !open)}
            aria-expanded={dropdownOpen}
          >
            Explore
            <ChevronDown size={16} />
          </button>
          {dropdownOpen && (
            <div className="nav-dropdown-menu">
              {allDropdownLinks
                .filter((item) => !item.roles || (user ? item.roles.includes(user.role) : false))
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className="nav-dropdown-link"
                    onClick={() => {
                      setDropdownOpen(false);
                      setMenuOpen(false);
                    }}
                  >
                    {item.label}
                  </NavLink>
                ))}
            </div>
          )}
        </div>

        {/* Mobile auth links shown inside the menu for clearer affordance */}
        {menuOpen && (
          <>
            <button
              type="button"
              className="mobile-menu-close"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              ×
            </button>
            {!user && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexDirection: 'column' }}>
                <NavLink to="/login" className="nav-dropdown-link" onClick={() => setMenuOpen(false)}>
                  Sign in
                </NavLink>
                <NavLink to="/register" className="nav-dropdown-link nav-dropdown-link--primary" onClick={() => setMenuOpen(false)}>
                  Get started
                </NavLink>
              </div>
            )}
          </>
        )}

      </nav>

      <div className="nav-actions">
        <ThemeToggle />
        {!user && (
          <NavLink to="/login" className="primary-link">
            Sign in
            <ArrowRight size={16} />
          </NavLink>
        )}
      </div>
    </header>
  );
}
