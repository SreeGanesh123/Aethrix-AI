import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStoredUser, type Role } from "../utils/auth";

const roleLinks: Record<Role, { label: string; to: string }[]> = {
  candidate: [{ label: "Candidate", to: "/candidate" }],
  recruiter: [{ label: "Candidate", to: "/candidate" }, { label: "Recruiter", to: "/recruiter" }],
  trainer: [{ label: "Candidate", to: "/candidate" }, { label: "Trainer", to: "/trainer" }],
  "super-admin": [
    { label: "Candidate", to: "/candidate" },
    { label: "Recruiter", to: "/recruiter" },
    { label: "Trainer", to: "/trainer" },
    { label: "Admin", to: "/admin" },
  ],
};
const alwaysLinks = [
  { label: "Assessment", to: "/assessment" },
  { label: "Contact", to: "/contact" },
];
export default function Footer() {
  const [role, setRole] = useState<Role | null>(() => getStoredUser()?.role ?? null);

  useEffect(() => {
    const sync = () => setRole(getStoredUser()?.role ?? null);
    window.addEventListener("aethrix-auth-change", sync);
    return () => window.removeEventListener("aethrix-auth-change", sync);
  }, []);

  const links = role ? [...alwaysLinks, ...roleLinks[role]] : alwaysLinks;

  return (
    <footer className="site-footer">
      <strong>AETHRIX AI</strong>
      <span>AI hiring intelligence for modern teams.</span>
      <div>
        {links.map((link) => (
          <Link key={link.to} to={link.to}>{link.label}</Link>
        ))}
      </div>
    </footer>
  );
}
