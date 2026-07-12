import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, BookOpen, BookOpenCheck, BrainCircuit, CheckCircle, Send, Sparkles, Users } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import WelcomeMessage from "../components/WelcomeMessage";
import DashboardProfileCard from "../components/DashboardProfileCard";
import { clearStoredUser } from "../utils/auth";
import { analyzeSkillGapWithAI, generateLessonPlanWithAI, type SkillGapResult, type LessonPlanResult } from "../services/aiService";

const cohorts = [
  { name: "React Fundamentals", learners: 18, progress: 72, status: "Active" },
  { name: "System Design Bootcamp", learners: 12, progress: 45, status: "Active" },
  { name: "Python for Data Science", learners: 24, progress: 91, status: "Completing" },
  { name: "DevOps Essentials", learners: 9, progress: 28, status: "Active" },
];

export default function TrainerDashboard() {
  const navigate = useNavigate();

  // AI: Skill Gap
  const [sgCohort, setSgCohort] = useState("React Fundamentals");
  const [sgSkills, setSgSkills] = useState("React, JavaScript, CSS");
  const [sgResult, setSgResult] = useState<SkillGapResult | null>(null);
  const [sgLoading, setSgLoading] = useState(false);

  // AI: Lesson Plan
  const [lpTopic, setLpTopic] = useState("JavaScript");
  const [lpLevel, setLpLevel] = useState("intermediate");
  const [lpDuration, setLpDuration] = useState("4 weeks");
  const [lpResult, setLpResult] = useState<LessonPlanResult | null>(null);
  const [lpLoading, setLpLoading] = useState(false);

  function handleSignOut() {
    clearStoredUser();
    navigate("/login");
  }

  async function handleSkillGap() {
    setSgLoading(true);
    try {
      setSgResult(await analyzeSkillGapWithAI({
        cohortName: sgCohort,
        learners: cohorts.find((c) => c.name === sgCohort) ? [cohorts.find((c) => c.name === sgCohort)] : [],
        targetSkills: sgSkills.split(",").map((s) => s.trim()),
      }));
    } catch (e) { console.error(e); } finally { setSgLoading(false); }
  }

  async function handleLessonPlan() {
    setLpLoading(true);
    try {
      setLpResult(await generateLessonPlanWithAI({ topic: lpTopic, level: lpLevel, duration: lpDuration }));
    } catch (e) { console.error(e); } finally { setLpLoading(false); }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="back-link"><ArrowLeft size={18} /> Home</Link>
        <div>
          <span>AETHRIX AI</span>
          <h1>Trainer dashboard</h1>
          <p>Manage cohorts, track learner progress, and assign skill assessments.</p>
        </div>
        <div className="dashboard-actions">
          <Link to="/admin/interviews" className="ghost-link">Interview monitor</Link>
          <ThemeToggle />
          <button type="button" className="secondary-cta" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
      <WelcomeMessage />

      <div className="toolbar">
        <button><Users size={17} /> Add Learner</button>
        <button><BookOpen size={17} /> New Cohort</button>
      </div>

      <section className="dashboard-grid recruiter-layout">
        <DashboardProfileCard />

        <article className="dash-card stat-card">
          <Users size={23} />
          <span>Total learners</span>
          <strong>63</strong>
        </article>
        <article className="dash-card stat-card">
          <BarChart3 size={23} />
          <span>Avg. progress</span>
          <strong>59%</strong>
        </article>
        <article className="dash-card stat-card">
          <CheckCircle size={23} />
          <span>Completions</span>
          <strong>21</strong>
        </article>

        {/* Cohort table */}
        <article className="dash-card candidate-table">
          <div className="card-header">
            <span className="card-kicker">Active cohorts</span>
            <button>View all</button>
          </div>
          {cohorts.map((c) => (
            <div className="candidate-row" key={c.name}>
              <div>
                <strong className="table-primary-text">{c.name}</strong>
                <span>{c.learners} learners</span>
              </div>
              <div className="ai-score-meter" style={{ width: 80 }}>
                <i style={{ width: `${c.progress}%` }} />
              </div>
              <strong className="table-score-text">{c.progress}%</strong>
              <span className={c.status === "Completing" ? "status-pill status-pill--success" : "status-pill status-pill--info"}>{c.status}</span>
            </div>
          ))}
        </article>

        {/* AI: Skill Gap Analyzer */}
        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <BrainCircuit size={22} />
            <div>
              <span className="card-kicker">AI skill gap analyzer</span>
              <h2>Find cohort weak spots</h2>
            </div>
          </div>
          <p>Identify where learners are falling behind and get targeted recommendations.</p>
          <div className="ai-control-grid">
            <label><span>Cohort</span>
              <select value={sgCohort} onChange={(e) => setSgCohort(e.target.value)}>
                {cohorts.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label><span>Target skills</span><input value={sgSkills} onChange={(e) => setSgSkills(e.target.value)} /></label>
          </div>
          <button type="button" className="primary-cta" onClick={() => void handleSkillGap()} disabled={sgLoading}>
            <Sparkles size={18} />{sgLoading ? "Analyzing..." : "Analyze skill gap"}
          </button>
          {sgResult && (
            <div className="ai-result-block">
              <p>{sgResult.summary}</p>
              <div className="ai-two-column">
                <div><span>Gaps</span>{sgResult.gaps.map((g) => <p key={g}>• {g}</p>)}</div>
                <div><span>Recommendations</span>{sgResult.recommendations.map((r) => <p key={r}>• {r}</p>)}</div>
              </div>
            </div>
          )}
        </article>

        {/* AI: Lesson Plan Generator */}
        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <BookOpenCheck size={22} />
            <div>
              <span className="card-kicker">AI lesson plan</span>
              <h2>Generate a training plan</h2>
            </div>
          </div>
          <p>Create a structured week-by-week lesson plan for any topic and skill level.</p>
          <div className="ai-control-grid">
            <label><span>Topic</span><input value={lpTopic} onChange={(e) => setLpTopic(e.target.value)} /></label>
            <label><span>Level</span>
              <select value={lpLevel} onChange={(e) => setLpLevel(e.target.value)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label><span>Duration</span>
              <select value={lpDuration} onChange={(e) => setLpDuration(e.target.value)}>
                <option value="2 weeks">2 weeks</option>
                <option value="4 weeks">4 weeks</option>
                <option value="6 weeks">6 weeks</option>
              </select>
            </label>
          </div>
          <button type="button" className="primary-cta" onClick={() => void handleLessonPlan()} disabled={lpLoading}>
            <Send size={18} />{lpLoading ? "Generating..." : "Generate lesson plan"}
          </button>
          {lpResult && (
            <div className="ai-result-block">
              <strong>{lpResult.title}</strong>
              {lpResult.weeks.map((w) => (
                <div className="ai-week-row" key={w.week}>
                  <span>Week {w.week}</span>
                  <p><strong>{w.topic}</strong> — {w.activities}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dash-card insights-card">
          <span className="card-kicker">AI insights</span>
          <h2>Skill gap analysis ready.</h2>
          <p>3 cohorts have learners falling behind on assessments. AI recommends targeted micro-lessons for 8 learners.</p>
          <button className="card-action-button"><BarChart3 size={17} /> View report</button>
        </article>
      </section>
    </main>
  );
}
