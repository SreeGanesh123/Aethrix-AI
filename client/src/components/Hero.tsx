import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import aethrixLogo from "../assets/Aethrix2.jpeg";
import FloatingRobot from "./FloatingRobot";
import { getStoredUser } from "../utils/auth";

const highlights = ["AI-generated assessments", "Adaptive questioning", "Personalized feedback", "Downloadable reports"];

export default function Hero() {
  const [user, setUser] = useState(getStoredUser());

  useEffect(() => {
    const onAuthChange = () => setUser(getStoredUser());
    window.addEventListener("aethrix-auth-change", onAuthChange);
    return () => window.removeEventListener("aethrix-auth-change", onAuthChange);
  }, []);

  return (
    <section className="hero-section">
      <div className="hero-copy">
        <div className="hero-brand-lockup">
          <img src={`${aethrixLogo}?v=${Date.now()}`} alt="AETHRIX AI logo" />
          <span>AETHRIX AI</span>
          <FloatingRobot />
        </div>
        <div className="eyebrow">
          <Zap size={16} />
          AI-powered skill assessment platform
        </div>
        <h1>Measure technical and soft skills with intelligent, adaptive assessments.</h1>
        <p>
          Evaluate candidates through coding challenges, aptitude tests, MCQs, video interviews,
          and project-based reviews while generating personalized feedback, skill-gap insights,
          and learning recommendations.
        </p>

        <div className="hero-actions">
          {!user && (
            <>
              <Link to="/register" className="primary-cta">
                Register now
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="primary-cta">
                Sign in
              </Link>
            </>
          )}
        </div>

        <div className="hero-highlights" aria-label="AETHRIX AI platform areas">
          {highlights.map((item) => (
            <span key={item}>
              <CheckCircle2 size={16} />
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="hero-visual" aria-label="AETHRIX AI assessment intelligence preview">
        <div className="product-shell">
          <div className="product-topbar">
            <img src={`${aethrixLogo}?v=${Date.now()}`} alt="" />
            <div>
              <strong>AETHRIX AI Skills</strong>
              <span>Live assessment intelligence</span>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className="score-panel">
            <span>Readiness score</span>
            <strong>87%</strong>
            <small>Skill readiness</small>
          </div>
          <div className="signal-grid">
            <div>
              <span>Coding</span>
              <strong>High</strong>
            </div>
            <div>
              <span>Communication</span>
              <strong>Strong</strong>
            </div>
            <div>
              <span>Aptitude</span>
              <strong>Improving</strong>
            </div>
          </div>
          <div className="module-grid">
            <div>
              <span>Projects</span>
              <strong>90%</strong>
            </div>
            <div>
              <span>MCQs</span>
              <strong>86%</strong>
            </div>
            <div>
              <span>Interviews</span>
              <strong>88%</strong>
            </div>
            <div>
              <span>Feedback</span>
              <strong>AI</strong>
            </div>
          </div>
          <div className="pipeline-card">
            <span>Adaptive feedback</span>
            <div className="pipeline-bars">
              <i style={{ width: "84%" }} />
              <i style={{ width: "71%" }} />
              <i style={{ width: "58%" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
