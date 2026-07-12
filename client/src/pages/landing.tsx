import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpenCheck, BookOpen, ShieldCheck, Sparkles, BadgeCheck } from "lucide-react";
import Features from "../components/Features";
import Footer from "../components/Footer";
import Hero from "../components/Hero";
import Navbar from "../components/Navbar";
import { getStoredUser } from "../utils/auth";

const quickLinks = [
  {
    title: "Assessment hub",
    description: "Launch technical, coding, aptitude, and soft-skill assessments from one professional entry point.",
    to: "/assessment",
    icon: BookOpenCheck,
  },
  {
    title: "Candidate workspace",
    description: "Complete the required profile sections and begin your assessment journey.",
    to: "/candidate",
    icon: Sparkles,
  },
  {
    title: "Recruiter workspace",
    description: "Review candidates, monitor progress, and make informed selection decisions.",
    to: "/recruiter",
    icon: ShieldCheck,
    roles: ["recruiter", "super-admin"],
  },
  {
    title: "Trainer workspace",
    description: "Build learner experiences, training plans, and cohort AI suggestions.",
    to: "/trainer",
    icon: BookOpen,
    roles: ["trainer", "super-admin"],
  },
  {
    title: "Super Admin workspace",
    description: "Manage platform health, AI configuration, and system-wide settings.",
    to: "/admin",
    icon: ShieldCheck,
    roles: ["super-admin"],
  },
  {
    title: "Verify certificate",
    description: "Scan a QR code to verify and view certificate details including scores and grades.",
    to: "/verify-certificate",
    icon: BadgeCheck,
  },
];

export default function Landing() {
  const [user, setUser] = useState(() => getStoredUser());

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    window.addEventListener("aethrix-auth-change", sync);
    return () => window.removeEventListener("aethrix-auth-change", sync);
  }, []);

  return (
    <main className="app-page">
      <Navbar />
      <Hero />
      <Features />

      <section className="features-section" id="outcomes">
        <div className="section-heading">
          <span>Outcomes</span>
          <h2>Real results for candidates and recruiters.</h2>
        </div>
        <div className="feature-grid">
          {[
            { title: "87% readiness score", desc: "Average candidate readiness after completing assessments." },
            { title: "3x faster hiring", desc: "Recruiters shortlist candidates in a fraction of the time." },
            { title: "AI-generated reports", desc: "Downloadable certificates and feedback summaries instantly." },
          ].map(({ title, desc }) => (
            <article className="feature-card" key={title}>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="features-section" id="explore">
        <div className="section-heading">
          <span>Start here</span>
          <h2>Choose the experience that fits the role you need.</h2>
        </div>
        <div className="feature-grid">
          {quickLinks
            .filter((item) => (item.roles ? user?.role ? item.roles.includes(user.role) : false : true))
            .map(({ title, description, to, icon: Icon }) => (
              <article className="feature-card" key={title}>
                <span className="feature-icon">
                  <Icon size={22} />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <Link to={to} className="primary-cta compact-cta">
                  Go to page
                  <ArrowRight size={18} />
                </Link>
              </article>
            ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
