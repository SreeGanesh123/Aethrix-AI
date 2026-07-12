import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, CalendarCheck, FileText, Link2, MessageSquare, Pencil, Plus, Send, Sparkles, Star, Trash2, X, CalendarClock } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import WelcomeMessage from "../components/WelcomeMessage";
import DashboardProfileCard from "../components/DashboardProfileCard";
import ScheduleCard from "../components/ScheduleCard";
import { clearStoredUser, getStoredUser, saveUser, type AuthUser, type ScheduleEvent } from "../utils/auth";
import {
  generateRecruiterShortlistWithAI, generateJobDescriptionWithAI, generateInterviewQuestionsWithAI, generateOutreachMessageWithAI,
  type RecruiterShortlistResult, type JobDescriptionResult, type InterviewQuestionsResult, type OutreachMessageResult,
} from "../services/aiService";
import { getUsers } from "../services/userService";
import { getInterviewReports, type InterviewReportRecord } from "../utils/interviewReports";

type Candidate = { name: string; role: string; fit: string; status: string; meetingLink: string; email?: string };

const initialCandidates: Candidate[] = [
  { name: "Aarav Mehta", role: "Frontend Engineer", fit: "94%", status: "Interview", meetingLink: "" },
  { name: "Mira Kapoor", role: "Product Designer", fit: "91%", status: "Shortlist", meetingLink: "" },
  { name: "Dev Rao", role: "Data Analyst", fit: "88%", status: "Screening", meetingLink: "" },
];

const emptyCandidate: Candidate = { name: "", role: "", fit: "", status: "", meetingLink: "" };

function buildQualifiedCandidates(users: AuthUser[], reports: InterviewReportRecord[]): Candidate[] {
  const reportMap = new Map(reports.map((report) => [report.candidateEmail.toLowerCase(), report]));

  return users
    .filter((user) => user.role === "candidate")
    .map((user) => {
      const report = reportMap.get(user.email.toLowerCase());
      const passedInterview = Boolean(report?.transcript?.some((entry) => entry.passed));
      const passedAssessment = Boolean(user.examPassed);
      const averageScore = report?.transcript?.length
        ? Math.round(report.transcript.reduce((sum, entry) => sum + entry.score, 0) / report.transcript.length)
        : 0;
      const assessmentScore = user.examPassed ? 95 : 0;
      const interviewScore = passedInterview ? Math.max(88, Math.min(99, averageScore || 92)) : 0;
      const fitScore = Math.max(assessmentScore, interviewScore);

      let status = "Pending";
      let fit = "—";

      if (passedAssessment && passedInterview) {
        status = "Passed test + interview";
        fit = `${Math.max(90, Math.min(99, fitScore))}%`;
      } else if (passedAssessment) {
        status = "Passed test";
        fit = "90%";
      } else if (passedInterview) {
        status = "Passed interview";
        fit = `${Math.max(88, Math.min(99, fitScore))}%`;
      }

      return {
        name: user.name || user.email,
        role: user.preferredJobRole || "Candidate",
        fit,
        status,
        meetingLink: "",
        email: user.email,
      };
    })
    .filter((candidate) => candidate.status !== "Pending")
    .sort((left, right) => {
      const leftScore = Number.parseInt(left.fit, 10) || 0;
      const rightScore = Number.parseInt(right.fit, 10) || 0;
      return rightScore - leftScore || left.name.localeCompare(right.name);
    });
}

export default function RecruiterDashboard() {
  const navigate = useNavigate();
  const [storedUser, setStoredUser] = useState<AuthUser | null>(() => getStoredUser());
  const [shortlist, setShortlist] = useState<RecruiterShortlistResult | null>(null);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>(initialCandidates);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Candidate>(emptyCandidate);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCandidate, setNewCandidate] = useState<Candidate>(emptyCandidate);

  // AI: Job Description
  const [jdRole, setJdRole] = useState("Frontend Engineer");
  const [jdSkills, setJdSkills] = useState("React, TypeScript");
  const [jdLevel, setJdLevel] = useState("mid");
  const [jdResult, setJdResult] = useState<JobDescriptionResult | null>(null);
  const [jdLoading, setJdLoading] = useState(false);

  // AI: Interview Questions
  const [iqRole, setIqRole] = useState("Frontend Engineer");
  const [iqSkills, setIqSkills] = useState("React, TypeScript");
  const [iqRound, setIqRound] = useState("technical");
  const [iqResult, setIqResult] = useState<InterviewQuestionsResult | null>(null);
  const [iqLoading, setIqLoading] = useState(false);

  // AI: Outreach
  const [outreachCandidate, setOutreachCandidate] = useState("");
  const [outreachResult, setOutreachResult] = useState<OutreachMessageResult | null>(null);
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleCandidate, setScheduleCandidate] = useState<Candidate | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ date: "", time: "", meetingLink: "", notes: "" });

  useEffect(() => {
    const syncUser = () => setStoredUser(getStoredUser());
    syncUser();
    window.addEventListener("aethrix-auth-change", syncUser);
    return () => window.removeEventListener("aethrix-auth-change", syncUser);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadQualifiedCandidates() {
      try {
        const users = await getUsers();
        const reports = getInterviewReports();
        const nextCandidates = buildQualifiedCandidates(users, reports);
        if (active) {
          setCandidates(nextCandidates.length > 0 ? nextCandidates : initialCandidates);
        }
      } catch (error) {
        console.error("Failed to load recruiter candidates", error);
        if (active) setCandidates(initialCandidates);
      }
    }

    void loadQualifiedCandidates();
    return () => {
      active = false;
    };
  }, []);

  const scheduledInterviews = useMemo(() => {
    return (storedUser?.scheduleEvents ?? [])
      .filter((event) => event.type === "interview")
      .sort((left, right) => left.date.localeCompare(right.date) || left.time.localeCompare(right.time));
  }, [storedUser?.scheduleEvents]);

  function handleSignOut() {
    clearStoredUser();
    navigate("/login");
  }

  function openScheduleModal(candidate: Candidate) {
    setScheduleCandidate(candidate);
    setScheduleForm({ date: "", time: "", meetingLink: candidate.meetingLink || "", notes: "" });
    setShowScheduleModal(true);
  }

  function handleScheduleInterview() {
    if (!scheduleCandidate || !scheduleForm.date || !scheduleForm.time) return;

    const event: ScheduleEvent = {
      id: `interview-${Date.now()}`,
      title: `Interview: ${scheduleCandidate.name}`,
      type: "interview",
      date: scheduleForm.date,
      time: scheduleForm.time,
      withPerson: scheduleCandidate.name,
      mode: "video",
      notes: `Role: ${scheduleCandidate.role}\nEmail: ${scheduleCandidate.email || ""}\n${scheduleForm.notes}`.trim(),
      createdAt: new Date().toISOString(),
    };

    const nextEvents = [...(storedUser?.scheduleEvents ?? []), event];
    const nextUser = { ...(storedUser ?? {}), scheduleEvents: nextEvents } as AuthUser;
    void saveUser(nextUser);
    setStoredUser(nextUser);
    setCandidates((prev) => prev.map((candidate) => candidate.email === scheduleCandidate.email || candidate.name === scheduleCandidate.name
      ? { ...candidate, status: "Interview", meetingLink: scheduleForm.meetingLink || candidate.meetingLink || "https://meet.google.com/lookup" }
      : candidate));
    setShowScheduleModal(false);
    setScheduleCandidate(null);
    setScheduleForm({ date: "", time: "", meetingLink: "", notes: "" });
  }

  async function handleShortlist() {
    setShortlistLoading(true);
    try {
      const result = await generateRecruiterShortlistWithAI({ role: "Frontend Engineer", candidates });
      setShortlist(result);
    } catch (error) {
      console.error("Shortlist generation failed:", error);
    } finally {
      setShortlistLoading(false);
    }
  }

  async function handleJD() {
    setJdLoading(true);
    try { setJdResult(await generateJobDescriptionWithAI({ role: jdRole, skills: jdSkills, level: jdLevel })); }
    catch (e) { console.error(e); } finally { setJdLoading(false); }
  }

  async function handleIQ() {
    setIqLoading(true);
    try { setIqResult(await generateInterviewQuestionsWithAI({ role: iqRole, skills: iqSkills, round: iqRound })); }
    catch (e) { console.error(e); } finally { setIqLoading(false); }
  }

  async function handleOutreach(candidate: Candidate) {
    setOutreachCandidate(candidate.name);
    setOutreachLoading(true);
    try {
      setOutreachResult(await generateOutreachMessageWithAI({
        candidateName: candidate.name, role: candidate.role,
        fit: candidate.fit, recruiterName: storedUser?.name || "the team",
      }));
    } catch (e) { console.error(e); } finally { setOutreachLoading(false); }
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditForm({ ...candidates[index] });
  }

  function saveEdit() {
    if (editingIndex === null) return;
    setCandidates((prev) => prev.map((c, i) => (i === editingIndex ? editForm : c)));
    setEditingIndex(null);
  }

  function deleteCandidate(index: number) {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }

  function addCandidate() {
    if (!newCandidate.name.trim()) return;
    setCandidates((prev) => [...prev, newCandidate]);
    setNewCandidate(emptyCandidate);
    setShowAddForm(false);
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} />
          Home
        </Link>
        <div>
          <span>AETHRIX AI</span>
          <h1>Recruiter dashboard</h1>
          <p>Review top matches, active roles, and interview movement.</p>
        </div>
        <div className="dashboard-actions">
          <Link to="/admin/interviews" className="ghost-link">Interview monitor</Link>
          <ThemeToggle />
          <button type="button" className="secondary-cta" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <WelcomeMessage />

      <section className="dashboard-grid recruiter-layout">
        <DashboardProfileCard />

        <article className="dash-card stat-card">
          <BriefcaseBusiness size={23} />
          <span>Open roles</span>
          <strong>18</strong>
        </article>
        <article className="dash-card stat-card">
          <Star size={23} />
          <span>High-fit candidates</span>
          <strong>42</strong>
        </article>
        <article className="dash-card stat-card">
          <CalendarCheck size={23} />
          <span>Interviews today</span>
          <strong>7</strong>
        </article>

        <ScheduleCard />

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">Shortlist</span>
              <h2>Best matches</h2>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={() => setShowAddForm((v) => !v)}>
                <Plus size={15} /> Add
              </button>
              <button>Export</button>
            </div>
          </div>

          {showAddForm && (
            <div className="add-candidate-form">
              <div className="add-candidate-fields">
                {(["name", "role", "fit", "status", "meetingLink"] as (keyof Candidate)[]).map((field) => (
                  <div key={field} className="profile-input-wrap">
                    <input
                      placeholder={field === "meetingLink" ? "Meeting link (optional)" : field.charAt(0).toUpperCase() + field.slice(1)}
                      value={newCandidate[field]}
                      onChange={(e) => setNewCandidate((p) => ({ ...p, [field]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div className="add-candidate-actions">
                <button type="button" className="secondary-cta" onClick={() => setShowAddForm(false)}><X size={14} /> Cancel</button>
                <button type="button" className="primary-cta" onClick={addCandidate}><Send size={14} /> Submit</button>
              </div>
            </div>
          )}

          {candidates.map((candidate, index) => (
            editingIndex === index ? (
              <div className="candidate-row" key={candidate.name} style={{ flexWrap: "wrap", gap: "0.4rem" }}>
                {(["name", "role", "fit", "status", "meetingLink"] as (keyof Candidate)[]).map((field) => (
                  <input
                    key={field}
                    placeholder={field === "meetingLink" ? "Meeting link" : field.charAt(0).toUpperCase() + field.slice(1)}
                    value={editForm[field]}
                    onChange={(e) => setEditForm((p) => ({ ...p, [field]: e.target.value }))}
                    style={{ flex: "1 1 100px", padding: "0.3rem 0.5rem", borderRadius: "6px", border: "1px solid #ccc", fontSize: "0.85rem" }}
                  />
                ))}
                <button type="button" onClick={saveEdit} style={{ padding: "0.3rem 0.8rem" }}>Save</button>
                <button type="button" onClick={() => setEditingIndex(null)} style={{ padding: "0.3rem 0.6rem" }}><X size={14} /></button>
              </div>
            ) : (
              <div className="candidate-row" key={candidate.name} style={index === 0 ? { border: "1px solid var(--teal, #2ee8d3)", boxShadow: "0 0 0 1px rgba(46,232,211,0.15)" } : undefined}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.role}</span>
                </div>
                <strong>{candidate.fit}</strong>
                <span>{candidate.status}</span>
                {candidate.meetingLink ? (
                  <a href={candidate.meetingLink} target="_blank" rel="noopener noreferrer" title="Join meeting" style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent, #6366f1)", fontSize: "0.82rem" }}>
                    <Link2 size={14} /> Join
                  </a>
                ) : (
                  <span style={{ fontSize: "0.78rem", opacity: 0.45 }}>No link</span>
                )}
                <div style={{ display: "flex", gap: "0.4rem", marginLeft: "auto" }}>
                  <button type="button" title="Schedule interview" onClick={() => openScheduleModal(candidate)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--accent, #6366f1)" }}><CalendarClock size={15} /></button>
                  <button type="button" title="Outreach" onClick={() => void handleOutreach(candidate)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--teal)" }}><MessageSquare size={15} /></button>
                  <button type="button" title="Edit" onClick={() => startEdit(index)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px" }}><Pencil size={15} /></button>
                  <button type="button" title="Delete" onClick={() => deleteCandidate(index)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "#ef4444" }}><Trash2 size={15} /></button>
                </div>
              </div>
            )
          ))}
        </article>

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">Scheduled interviews</span>
              <h2>Upcoming recruiter interviews</h2>
            </div>
          </div>
          {scheduledInterviews.length === 0 ? (
            <p className="form-note">No interviews scheduled yet. Use the calendar icon beside a candidate to book one.</p>
          ) : scheduledInterviews.map((event) => (
            <div className="candidate-row" key={event.id}>
              <div>
                <strong>{event.title}</strong>
                <span>{event.withPerson || "Candidate"}</span>
              </div>
              <strong>{event.date}</strong>
              <span>{event.time}</span>
              <span>{event.mode}</span>
            </div>
          ))}
        </article>

        <article className="dash-card insights-card">
          <span className="card-kicker">AI insight</span>
          <h2>Frontend role is trending above target.</h2>
          <p>Most high-fit candidates share React, accessibility, and performance experience. Move the top 5 to interviews this week.</p>
        </article>

        <article className="dash-card action-card">
          <div className="ai-feature-heading">
            <Sparkles size={22} />
            <div>
              <span className="card-kicker">Recruiter support</span>
              <h2>Need help selecting candidates?</h2>
            </div>
          </div>
          <p>Use the assistant to surface best-fit candidates and recommended messaging for interviews.</p>
          <button type="button" onClick={() => void handleShortlist()} disabled={shortlistLoading}>
            <Send size={18} />
            {shortlistLoading ? "Ranking..." : "Rank shortlist"}
          </button>
          {shortlist && (
            <div className="ai-result-block">
              <strong>{shortlist.summary}</strong>
              {shortlist.ranked.map((item) => (
                <div className="ai-week-row" key={item.name}>
                  <span>#{item.rank}</span>
                  <p><strong>{item.name}</strong> {item.reason} Next: {item.nextStep}</p>
                </div>
              ))}
              <p><strong>Outreach:</strong> {shortlist.outreach}</p>
            </div>
          )}
        </article>

        {/* AI: Job Description Generator */}
        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <FileText size={22} />
            <div>
              <span className="card-kicker">AI job description</span>
              <h2>Generate a job post</h2>
            </div>
          </div>
          <p>Create a clear, inclusive job description for any role in seconds.</p>
          <div className="ai-control-grid">
            <label><span>Role</span><input value={jdRole} onChange={(e) => setJdRole(e.target.value)} /></label>
            <label><span>Skills</span><input value={jdSkills} onChange={(e) => setJdSkills(e.target.value)} /></label>
            <label><span>Level</span>
              <select value={jdLevel} onChange={(e) => setJdLevel(e.target.value)}>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
              </select>
            </label>
          </div>
          <button type="button" className="primary-cta" onClick={() => void handleJD()} disabled={jdLoading}>
            <Sparkles size={18} />{jdLoading ? "Generating..." : "Generate JD"}
          </button>
          {jdResult && (
            <div className="ai-result-block">
              <strong>{jdResult.title}</strong>
              <p>{jdResult.summary}</p>
              <div className="ai-two-column">
                <div><span>Responsibilities</span>{jdResult.responsibilities.map((r) => <p key={r}>• {r}</p>)}</div>
                <div><span>Requirements</span>{jdResult.requirements.map((r) => <p key={r}>• {r}</p>)}</div>
              </div>
              <div className="ai-chip-row">{jdResult.niceToHave.map((n) => <span key={n}>{n}</span>)}</div>
            </div>
          )}
        </article>

        {/* AI: Interview Questions */}
        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <MessageSquare size={22} />
            <div>
              <span className="card-kicker">AI interview questions</span>
              <h2>Generate interview questions</h2>
            </div>
          </div>
          <p>Get role-specific behavioral, technical, and situational questions instantly.</p>
          <div className="ai-control-grid">
            <label><span>Role</span><input value={iqRole} onChange={(e) => setIqRole(e.target.value)} /></label>
            <label><span>Skills</span><input value={iqSkills} onChange={(e) => setIqSkills(e.target.value)} /></label>
            <label><span>Round</span>
              <select value={iqRound} onChange={(e) => setIqRound(e.target.value)}>
                <option value="screening">Screening</option>
                <option value="technical">Technical</option>
                <option value="behavioral">Behavioral</option>
                <option value="final">Final</option>
              </select>
            </label>
          </div>
          <button type="button" className="primary-cta" onClick={() => void handleIQ()} disabled={iqLoading}>
            <Sparkles size={18} />{iqLoading ? "Generating..." : "Generate questions"}
          </button>
          {iqResult && (
            <div className="ai-result-block">
              {iqResult.questions.map((q, i) => (
                <div className="ai-week-row" key={i}>
                  <span>{q.type}</span>
                  <p>{q.question}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* AI: Outreach Message */}
        {outreachResult && (
          <article className="dash-card ai-feature-card">
            <div className="ai-feature-heading">
              <Send size={22} />
              <div>
                <span className="card-kicker">AI outreach — {outreachCandidate}</span>
                <h2>Candidate message ready</h2>
              </div>
            </div>
            {outreachLoading ? <p className="form-note">Writing message…</p> : (
              <div className="ai-result-block">
                <strong>{outreachResult.subject}</strong>
                <p style={{ whiteSpace: "pre-line" }}>{outreachResult.message}</p>
              </div>
            )}
          </article>
        )}
      </section>

      {showScheduleModal && scheduleCandidate && (
        <div className="schedule-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="schedule-modal" onClick={(event) => event.stopPropagation()}>
            <div className="schedule-modal-header">
              <div className="schedule-modal-title">
                <CalendarClock size={20} />
                <h3>Schedule interview with {scheduleCandidate.name}</h3>
              </div>
              <button type="button" className="schedule-modal-close" onClick={() => setShowScheduleModal(false)}><X size={18} /></button>
            </div>
            <div className="schedule-modal-body">
              <div className="schedule-form-row schedule-form-row--two">
                <label>
                  <span>Date</span>
                  <input className="schedule-input" type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm((prev) => ({ ...prev, date: event.target.value }))} />
                </label>
                <label>
                  <span>Time</span>
                  <input className="schedule-input" type="time" value={scheduleForm.time} onChange={(event) => setScheduleForm((prev) => ({ ...prev, time: event.target.value }))} />
                </label>
              </div>
              <div className="schedule-form-row">
                <label>
                  <span>Meeting link</span>
                  <input className="schedule-input" placeholder="https://meet.google.com/abc-defg-hij" value={scheduleForm.meetingLink} onChange={(event) => setScheduleForm((prev) => ({ ...prev, meetingLink: event.target.value }))} />
                </label>
              </div>
              <div className="schedule-form-row">
                <label>
                  <span>Notes</span>
                  <textarea className="schedule-input schedule-textarea" rows={3} placeholder="Add interviewer notes or candidate context" value={scheduleForm.notes} onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </label>
              </div>
            </div>
            <div className="schedule-modal-footer">
              <button type="button" className="secondary-cta" onClick={() => setShowScheduleModal(false)}>Cancel</button>
              <button type="button" className="primary-cta" onClick={handleScheduleInterview} disabled={!scheduleForm.date || !scheduleForm.time}>Save interview</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
