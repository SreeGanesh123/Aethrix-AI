import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Activity, AlertTriangle, ArrowLeft, DatabaseZap, ShieldCheck, Sparkles, UsersRound, RefreshCcw, UserRoundCheck, BriefcaseBusiness, GraduationCap, LayoutDashboard, LockKeyhole, ShieldAlert } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import WelcomeMessage from "../components/WelcomeMessage";
import DashboardProfileCard from "../components/DashboardProfileCard";
import { clearStoredUser, getStoredUser, type AuthUser } from "../utils/auth";
import {
  fetchSystemStatus,
  generateAdminAccessMatrixWithAI,
  generateAdminGovernanceBriefWithAI,
  generateAdminIncidentPlanWithAI,
  generatePlatformReportWithAI,
  type AdminAccessMatrixResult,
  type AdminGovernanceResult,
  type AdminIncidentPlanResult,
  type PlatformReportResult,
  type SystemStatusResult,
} from "../services/aiService";
import { getInterviewReports, getLatestInterviewReport, downloadInterviewReportPdf, type InterviewReportRecord } from "../utils/interviewReports";
import { deleteUser, getUsers, updateUser } from "../services/userService";

const health = [
  { label: "Model uptime", value: "99.9%" },
  { label: "Reviews processed", value: "1,284" },
  { label: "Active companies", value: "36" },
];

const platformStats = {
  totalUsers: 1284,
  activeCandidates: 842,
  activeRecruiters: 96,
  assessmentsToday: 47,
  certificatesIssued: 312,
  avgFitScore: "81%",
};

type AdminUserSummary = {
  email: string;
  name: string;
  role: string;
  status: "pending" | "needs-review" | "qualified";
  fitScore: number;
  activityLabel: string;
  examPassed: boolean;
  interviewPassed: boolean;
};

type IncidentItem = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  owner: string;
  status: "open" | "investigating" | "resolved";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  reason: string;
  createdAt: string;
};

const INCIDENT_STORAGE_KEY = "aethrix_superadmin_incidents";
const AUDIT_STORAGE_KEY = "aethrix_superadmin_audit";
const accessMatrixRows = [
  { area: "Candidate portal", candidate: true, recruiter: false, trainer: false, superAdmin: true },
  { area: "Recruiter shortlist", candidate: false, recruiter: true, trainer: false, superAdmin: true },
  { area: "Trainer cohorts", candidate: false, recruiter: false, trainer: true, superAdmin: true },
  { area: "Interview monitor", candidate: false, recruiter: true, trainer: true, superAdmin: true },
  { area: "System status", candidate: false, recruiter: false, trainer: false, superAdmin: true },
  { area: "User management", candidate: false, recruiter: false, trainer: false, superAdmin: true },
];

function getStoredIncidents(): IncidentItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INCIDENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) as IncidentItem[] : [];
  } catch {
    return [];
  }
}

function saveStoredIncidents(incidents: IncidentItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INCIDENT_STORAGE_KEY, JSON.stringify(incidents));
}

function getStoredAuditEntries(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) as AuditEntry[] : [];
  } catch {
    return [];
  }
}

function saveStoredAuditEntries(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries));
}

function buildUserActivitySummary(users: AuthUser[], reports: InterviewReportRecord[]): AdminUserSummary[] {
  const reportMap = new Map(reports.map((report) => [report.candidateEmail.toLowerCase(), report]));

  return users
    .filter((user) => user.role !== "super-admin")
    .map((user) => {
      const report = reportMap.get(user.email.toLowerCase());
      const interviewPassed = Boolean(report?.transcript?.some((entry) => entry.passed));
      const examPassed = Boolean(user.examPassed);
      const averageScore = report?.transcript?.length
        ? Math.round(report.transcript.reduce((sum, entry) => sum + entry.score, 0) / report.transcript.length)
        : 0;
      const fitScore = examPassed ? 95 : interviewPassed ? Math.max(88, Math.min(99, averageScore || 92)) : 0;

      let status: AdminUserSummary["status"] = "pending";
      if (examPassed && interviewPassed) status = "qualified";
      else if (examPassed || interviewPassed) status = "needs-review";

      let activityLabel = "Profile started";
      if (examPassed && interviewPassed) activityLabel = "Assessment + interview completed";
      else if (examPassed) activityLabel = "Assessment completed";
      else if (interviewPassed) activityLabel = "Interview completed";

      return {
        email: user.email,
        name: user.name || user.email,
        role: user.role,
        status,
        fitScore,
        activityLabel,
        examPassed,
        interviewPassed,
      };
    })
    .sort((left, right) => right.fitScore - left.fitScore || left.name.localeCompare(right.name));
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [report, setReport] = useState<PlatformReportResult | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [interviewReports, setInterviewReports] = useState<InterviewReportRecord[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatusResult | null>(null);
  const [systemLoading, setSystemLoading] = useState(false);
  const [governanceBrief, setGovernanceBrief] = useState<AdminGovernanceResult | null>(null);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [accessMatrix, setAccessMatrix] = useState<AdminAccessMatrixResult | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [incidentPlan, setIncidentPlan] = useState<AdminIncidentPlanResult | null>(null);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>(() => getStoredIncidents());
  const [incidentDraft, setIncidentDraft] = useState({ title: "", severity: "high" as IncidentItem["severity"], owner: "", notes: "" });
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>(() => getStoredAuditEntries());
  const [activeUser, setActiveUser] = useState<AuthUser | null>(() => getStoredUser());
  const [editingUser, setEditingUser] = useState<AdminUserSummary | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", role: "candidate" as AuthUser["role"], preferredJobRole: "" });
  const activeSession = searchParams.get("session");

  function handleSignOut() {
    clearStoredUser();
    navigate("/login");
  }

  async function handlePlatformReport() {
    setReportLoading(true);
    try {
      setReport(await generatePlatformReportWithAI({ stats: platformStats }));
    } catch (e) { console.error(e); } finally { setReportLoading(false); }
  }

  async function handleRefreshSystemStatus() {
    setSystemLoading(true);
    try {
      setSystemStatus(await fetchSystemStatus());
    } catch (error) {
      console.error(error);
    } finally {
      setSystemLoading(false);
    }
  }

  async function handleGovernanceBrief() {
    setGovernanceLoading(true);
    try {
      setGovernanceBrief(await generateAdminGovernanceBriefWithAI({ stats: platformStats, system: systemStatus, firebase: systemStatus?.firebase }));
    } catch (error) {
      console.error(error);
    } finally {
      setGovernanceLoading(false);
    }
  }

  async function handleAccessMatrix() {
    setAccessLoading(true);
    try {
      setAccessMatrix(await generateAdminAccessMatrixWithAI({
        roles: ["candidate", "recruiter", "trainer", "super-admin"],
        policies: { superAdminHasFullAccess: true, otherRolesAreScoped: true },
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setAccessLoading(false);
    }
  }

  async function handleIncidentPlan() {
    setIncidentLoading(true);
    try {
      setIncidentPlan(await generateAdminIncidentPlanWithAI({
        status: systemStatus,
        alerts: [
          "Database health",
          "Firebase config",
          "Interview report backlog",
          "AI endpoint availability",
        ],
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setIncidentLoading(false);
    }
  }

  useEffect(() => {
    const syncAuth = () => setActiveUser(getStoredUser());
    syncAuth();
    window.addEventListener("aethrix-auth-change", syncAuth);
    return () => window.removeEventListener("aethrix-auth-change", syncAuth);
  }, []);

  function canManageUser(user: Pick<AdminUserSummary, "email" | "role">) {
    return Boolean(activeUser?.role === "super-admin" && user.role !== "super-admin" && user.email.toLowerCase() !== activeUser.email.toLowerCase());
  }

  function recordAudit(action: string, target: string, reason: string) {
    const entry: AuditEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      actor: activeUser?.name || "Super admin",
      action,
      target,
      reason,
      createdAt: new Date().toISOString(),
    };
    setAuditEntries((prev) => {
      const next = [entry, ...prev].slice(0, 25);
      saveStoredAuditEntries(next);
      return next;
    });
  }

  async function refreshUsers() {
    setUsersLoading(true);
    try {
      const users = await getUsers();
      setAdminUsers(buildUserActivitySummary(users, interviewReports));
    } catch (error) {
      console.error(error);
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleBulkRoleChange(role: AuthUser["role"]) {
    if (!selectedUsers.length) return;
    const eligible = selectedUsers.filter((email) => {
      const match = adminUsers.find((user) => user.email === email);
      return match ? canManageUser(match) : false;
    });
    if (eligible.length !== selectedUsers.length) {
      setBulkMessage("Some selected users cannot be managed. Only eligible accounts were updated.");
    }
    setBulkActionLoading(true);
    setBulkMessage(null);
    try {
      await Promise.all(eligible.map((email) => updateUser(email, { role })));
      setSelectedUsers([]);
      if (eligible.length) {
        recordAudit("Bulk role update", `${eligible.length} user${eligible.length > 1 ? "s" : ""} -> ${role}`, `Role updated to ${role}`);
      }
      setBulkMessage(`Updated ${eligible.length} user${eligible.length > 1 ? "s" : ""} to ${role}.`);
      await refreshUsers();
    } catch (error) {
      console.error(error);
      setBulkMessage("Bulk role update failed.");
    } finally {
      setBulkActionLoading(false);
    }
  }

  async function handleBulkDelete() {
    if (!selectedUsers.length) return;
    const eligible = selectedUsers.filter((email) => {
      const match = adminUsers.find((user) => user.email === email);
      return match ? canManageUser(match) : false;
    });
    if (eligible.length !== selectedUsers.length) {
      setBulkMessage("Some selected users cannot be managed. Only eligible accounts were removed.");
    }
    const reason = window.prompt("Reason for bulk delete");
    if (!reason || !reason.trim()) {
      setBulkMessage("A reason is required for bulk delete.");
      return;
    }
    setBulkActionLoading(true);
    setBulkMessage(null);
    try {
      await Promise.all(eligible.map((email) => deleteUser(email)));
      setSelectedUsers([]);
      if (eligible.length) {
        recordAudit("Bulk delete", `${eligible.length} user${eligible.length > 1 ? "s" : ""}`, reason.trim());
      }
      setBulkMessage(`Deleted ${eligible.length} selected user${eligible.length > 1 ? "s" : ""}.`);
      await refreshUsers();
    } catch (error) {
      console.error(error);
      setBulkMessage("Bulk delete failed.");
    } finally {
      setBulkActionLoading(false);
    }
  }

  function startEditUser(user: AdminUserSummary) {
    if (!canManageUser(user)) {
      setBulkMessage("You can only edit non-super-admin accounts that are not your own.");
      return;
    }
    setEditingUser(user);
    setEditDraft({ name: user.name, role: user.role as AuthUser["role"], preferredJobRole: user.role === "candidate" ? "" : "" });
  }

  async function handleSaveUserEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingUser) return;
    const reason = window.prompt("Reason for this update");
    if (!reason || !reason.trim()) {
      setBulkMessage("A reason is required for account edits.");
      return;
    }
    try {
      await updateUser(editingUser.email, {
        name: editDraft.name.trim() || editingUser.name,
        role: editDraft.role,
        preferredJobRole: editDraft.preferredJobRole.trim() || undefined,
      });
      recordAudit("Edit user", editingUser.email, reason.trim());
      setEditingUser(null);
      setBulkMessage(`Updated ${editingUser.name}.`);
      await refreshUsers();
    } catch (error) {
      console.error(error);
      setBulkMessage("User edit failed.");
    }
  }

  async function handleDeleteUser(user: AdminUserSummary) {
    if (!canManageUser(user)) {
      setBulkMessage("You can only delete non-super-admin accounts that are not your own.");
      return;
    }
    const reason = window.prompt(`Reason for deleting ${user.name}`);
    if (!reason || !reason.trim()) {
      setBulkMessage("A reason is required for deletion.");
      return;
    }
    try {
      await deleteUser(user.email);
      recordAudit("Delete user", user.email, reason.trim());
      setBulkMessage(`Deleted ${user.name}.`);
      await refreshUsers();
    } catch (error) {
      console.error(error);
      setBulkMessage("Delete failed.");
    }
  }

  function handleCreateIncident(event: React.FormEvent) {
    event.preventDefault();
    if (!incidentDraft.title.trim()) return;

    const created: IncidentItem = {
      id: `${Date.now()}`,
      title: incidentDraft.title.trim(),
      severity: incidentDraft.severity,
      owner: incidentDraft.owner.trim() || "Unassigned",
      status: "open",
      notes: incidentDraft.notes.trim() || "New incident logged from super-admin console.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const next = [created, ...incidents];
    setIncidents(next);
    saveStoredIncidents(next);
    setIncidentDraft({ title: "", severity: "high", owner: "", notes: "" });
  }

  function updateIncidentStatus(id: string, status: IncidentItem["status"]) {
    const next = incidents.map((incident) => (incident.id === id ? { ...incident, status, updatedAt: new Date().toISOString() } : incident));
    setIncidents(next);
    saveStoredIncidents(next);
  }

  useEffect(() => {
    setInterviewReports(getInterviewReports());
    void handleRefreshSystemStatus();
  }, []);

  useEffect(() => {
    void refreshUsers();
  }, [interviewReports]);

  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === "aethrix_interview_reports") {
        setInterviewReports(getInterviewReports());
      }
    }

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const latestReport = activeSession
    ? interviewReports.find((item) => item.id === activeSession || item.candidateEmail === activeSession) || interviewReports[0] || null
    : getLatestInterviewReport() || interviewReports[0] || null;

  const interviewAnalytics = useMemo(() => {
    const totalSessions = interviewReports.length;
    const passedSessions = interviewReports.filter((report) => report.transcript.some((entry) => entry.passed)).length;
    const averageScore = totalSessions
      ? Math.round(interviewReports.reduce((sum, report) => sum + (report.transcript.reduce((scoreSum, entry) => scoreSum + entry.score, 0) / Math.max(1, report.transcript.length)), 0) / totalSessions)
      : 0;

    return {
      totalSessions,
      passedSessions,
      passRate: totalSessions ? Math.round((passedSessions / totalSessions) * 100) : 0,
      averageScore,
    };
  }, [interviewReports]);

  const pipelineStats = useMemo(() => {
    const qualified = adminUsers.filter((user) => user.status === "qualified").length;
    const needsReview = adminUsers.filter((user) => user.status === "needs-review").length;
    const pending = adminUsers.filter((user) => user.status === "pending").length;

    return { qualified, needsReview, pending };
  }, [adminUsers]);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/" className="back-link"><ArrowLeft size={18} />Home</Link>
        <div>
          <span>AETHRIX AI</span>
          <h1>Admin dashboard</h1>
          <p>Monitor system health, usage, and hiring operations.</p>
        </div>
        <div className="dashboard-actions">
          <ThemeToggle />
          <button type="button" className="secondary-cta" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
      <WelcomeMessage />

      <section className="dashboard-grid admin-layout">
        <DashboardProfileCard />

        {health.map((item) => (
          <article className="dash-card stat-card" key={item.label}>
            <Activity size={23} />
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}

        {/* Platform stats */}
        <article className="dash-card candidate-table">
          <div className="card-header">
            <div><span className="card-kicker">Platform</span><h2>Live stats</h2></div>
          </div>
          {Object.entries(platformStats).map(([key, val]) => (
            <div className="candidate-row" key={key}>
              <span style={{ textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1")}</span>
              <strong style={{ color: "var(--teal)" }}>{val}</strong>
            </div>
          ))}
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <RefreshCcw size={22} />
            <div>
              <span className="card-kicker">System status</span>
              <h2>Server and Firebase health</h2>
            </div>
          </div>
          <p>Refresh the live backend status and inspect database and Firebase configuration state.</p>
          <button type="button" className="primary-cta" onClick={() => void handleRefreshSystemStatus()} disabled={systemLoading}>
            <RefreshCcw size={18} />
            {systemLoading ? "Refreshing..." : "Refresh status"}
          </button>
          {systemStatus && (
            <div className="ai-result-block">
              <p><strong>Server:</strong> {systemStatus.server.running ? "Running" : "Stopped"} | Uptime {systemStatus.server.uptimeSeconds}s | Node {systemStatus.server.nodeVersion}</p>
              <p><strong>Memory:</strong> {systemStatus.server.memoryUsedMB} MB</p>
              <p><strong>Database:</strong> {systemStatus.database.connected ? "Connected" : "Disconnected"} | Users {systemStatus.database.userCount} | Active sessions {systemStatus.database.activeSessions}</p>
              <p><strong>Firebase:</strong> {systemStatus.firebase.configured ? "Configured" : "Not configured"}</p>
              <p>{systemStatus.firebase.projectId ? `Project: ${systemStatus.firebase.projectId}` : "Add Firebase env vars to enable real Firebase integration."}</p>
            </div>
          )}
        </article>

        {/* AI: Platform Health Report */}
        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <Sparkles size={22} />
            <div>
              <span className="card-kicker">AI platform report</span>
              <h2>Generate health report</h2>
            </div>
          </div>
          <p>Get an AI-generated summary of platform health, risks, and recommended actions based on live stats.</p>
          <button type="button" className="primary-cta" onClick={() => void handlePlatformReport()} disabled={reportLoading}>
            <Sparkles size={18} />{reportLoading ? "Analyzing..." : "Generate report"}
          </button>
          {report && (
            <div className="ai-result-block">
              <p>{report.health}</p>
              <div className="ai-two-column">
                <div>
                  <span>Insights</span>
                  {report.insights.map((i) => <p key={i}>• {i}</p>)}
                </div>
                <div>
                  <span>Risks</span>
                  {report.risks.map((r) => <p key={r}>• {r}</p>)}
                </div>
              </div>
              <div className="ai-chip-row">{report.actions.map((a) => <span key={a}>{a}</span>)}</div>
            </div>
          )}
        </article>

        <article className="dash-card">
          <span className="card-kicker">Access</span>
          <h2>Role permissions and dashboard access</h2>
          <p>Launch any role dashboard directly and review access boundaries for each user type.</p>
          <div className="assessment-actions" style={{ marginTop: "0.75rem" }}>
            <Link to="/candidate" className="secondary-cta"><LayoutDashboard size={16} />Candidate</Link>
            <Link to="/recruiter" className="secondary-cta"><BriefcaseBusiness size={16} />Recruiter</Link>
            <Link to="/trainer" className="secondary-cta"><GraduationCap size={16} />Trainer</Link>
            <Link to="/admin" className="secondary-cta"><ShieldCheck size={16} />Super admin</Link>
          </div>
          <div className="assessment-actions" style={{ marginTop: "0.75rem" }}>
            <Link to="/admin/users" className="ghost-link"><UserRoundCheck size={16} />Users</Link>
            <Link to="/admin/security" className="ghost-link"><LockKeyhole size={16} />Security</Link>
            <Link to="/admin/companies" className="ghost-link"><BriefcaseBusiness size={16} />Companies</Link>
          </div>
        </article>

        <article className="dash-card action-card">
          <span className="card-kicker">Super Admin control</span>
          <h2>Open admin management tools</h2>
          <p>Launch the full Super Admin control center and manage companies, users, security, and system settings.</p>
          <Link to="/admin/companies" className="primary-cta">Open admin center</Link>
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <ShieldAlert size={22} />
            <div>
              <span className="card-kicker">AI governance</span>
              <h2>Platform governance brief</h2>
            </div>
          </div>
          <p>Generate a super-admin briefing with priorities, risks, and actions based on system and platform state.</p>
          <button type="button" className="primary-cta" onClick={() => void handleGovernanceBrief()} disabled={governanceLoading}>
            <Sparkles size={18} />
            {governanceLoading ? "Analyzing..." : "Generate governance brief"}
          </button>
          {governanceBrief && (
            <div className="ai-result-block">
              <p>{governanceBrief.summary}</p>
              <div className="ai-two-column">
                <div>
                  <span>Priorities</span>
                  {governanceBrief.priorities.map((item) => <p key={item}>• {item}</p>)}
                </div>
                <div>
                  <span>Risks</span>
                  {governanceBrief.risks.map((item) => <p key={item}>• {item}</p>)}
                </div>
              </div>
              <div className="ai-chip-row">{governanceBrief.actions.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          )}
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <ShieldCheck size={22} />
            <div>
              <span className="card-kicker">AI access matrix</span>
              <h2>Review role permissions</h2>
            </div>
          </div>
          <p>Create a least-privilege access review for candidate, recruiter, trainer, and super-admin roles.</p>
          <button type="button" className="primary-cta" onClick={() => void handleAccessMatrix()} disabled={accessLoading}>
            <ShieldCheck size={18} />
            {accessLoading ? "Reviewing..." : "Generate access matrix"}
          </button>
          {accessMatrix && (
            <div className="ai-result-block">
              <p>{accessMatrix.summary}</p>
              <div className="ai-two-column">
                <div>
                  <span>Access changes</span>
                  {accessMatrix.accessChanges.map((item) => <p key={item}>• {item}</p>)}
                </div>
                <div>
                  <span>Cautions</span>
                  {accessMatrix.cautions.map((item) => <p key={item}>• {item}</p>)}
                </div>
              </div>
            </div>
          )}
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <AlertTriangle size={22} />
            <div>
              <span className="card-kicker">AI incident plan</span>
              <h2>Operational response steps</h2>
            </div>
          </div>
          <p>Generate a quick response plan for server, Firebase, and interview workflow issues.</p>
          <button type="button" className="primary-cta" onClick={() => void handleIncidentPlan()} disabled={incidentLoading}>
            <AlertTriangle size={18} />
            {incidentLoading ? "Planning..." : "Generate incident plan"}
          </button>
          {incidentPlan && (
            <div className="ai-result-block">
              <p>{incidentPlan.summary}</p>
              <div className="ai-two-column">
                <div>
                  <span>Steps</span>
                  {incidentPlan.steps.map((item) => <p key={item}>• {item}</p>)}
                </div>
                <div>
                  <span>Escalations</span>
                  {incidentPlan.escalations.map((item) => <p key={item}>• {item}</p>)}
                </div>
              </div>
            </div>
          )}
        </article>

        <article className="dash-card">
          <span className="card-kicker">Live interview monitoring</span>
          <h2>Observe active interview sessions</h2>
          <p>Authorized reviewers can monitor interviews as they are recorded and tracked live.</p>
          {interviewReports.length === 0 ? (
            <p className="form-note">No active interview sessions.</p>
          ) : (
            <div className="field-checklist">
              {interviewReports.map((session) => (
                <div key={session.id} className="field-item">
                  <Activity size={16} />
                  <span>{session.candidateEmail} — {session.candidateType} — completed</span>
                </div>
              ))}
            </div>
          )}
          {latestReport && (
            <div className="ai-result-block" style={{ marginTop: "1rem" }}>
              <strong>Latest interview report</strong>
              <p>{latestReport.summary}</p>
              <p><strong>Candidate:</strong> {latestReport.candidateName} ({latestReport.candidateEmail})</p>
              <p><strong>Type:</strong> {latestReport.testType}</p>
              <p><strong>Recording:</strong> {latestReport.recordingStatus}</p>
              <p><strong>Rounds:</strong> {latestReport.rounds.join(" • ")}</p>
              <p><strong>Transcript entries:</strong> {latestReport.transcript.length}</p>
              <div className="assessment-actions">
                <button type="button" className="primary-cta" onClick={() => void downloadInterviewReportPdf(latestReport)}>
                  Download PDF
                </button>
                <button type="button" className="secondary-cta" onClick={() => setInterviewReports(getInterviewReports())}>
                  Refresh
                </button>
              </div>
            </div>
          )}
        </article>

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">User activity</span>
              <h2>Live activity monitor</h2>
            </div>
          </div>
          <p className="form-note">Review recent candidate activity and assign user roles from one place.</p>
          {usersLoading ? <p className="form-note">Loading users...</p> : (
            <>
              <div className="assessment-actions" style={{ marginBottom: "0.75rem" }}>
                <button type="button" className="secondary-cta" onClick={() => void handleBulkRoleChange("recruiter")} disabled={bulkActionLoading || !selectedUsers.length}>Make recruiter</button>
                <button type="button" className="secondary-cta" onClick={() => void handleBulkRoleChange("trainer")} disabled={bulkActionLoading || !selectedUsers.length}>Make trainer</button>
                <button type="button" className="secondary-cta" onClick={() => void handleBulkRoleChange("candidate")} disabled={bulkActionLoading || !selectedUsers.length}>Make candidate</button>
                <button type="button" className="secondary-cta" onClick={() => void handleBulkDelete()} disabled={bulkActionLoading || !selectedUsers.length}>Delete selected</button>
              </div>
              {bulkMessage && <p className="form-note">{bulkMessage}</p>}
              {adminUsers.slice(0, 8).map((user) => (
                <div className="candidate-row" key={user.email}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input type="checkbox" checked={selectedUsers.includes(user.email)} onChange={() => setSelectedUsers((prev) => prev.includes(user.email) ? prev.filter((item) => item !== user.email) : [...prev, user.email])} />
                    <div>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </div>
                  </label>
                  <span>{user.role}</span>
                  <strong>{user.fitScore}%</strong>
                  <span>{user.activityLabel}</span>
                  <div style={{ display: "flex", gap: "0.35rem" }}>
                    <button type="button" className="secondary-cta" onClick={() => startEditUser(user)}>Edit</button>
                    <button type="button" className="secondary-cta" onClick={() => void handleDeleteUser(user)}>Delete</button>
                  </div>
                </div>
              ))}
            </>
          )}
        </article>

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">Audit trail</span>
              <h2>Super-admin activity log</h2>
            </div>
          </div>
          {auditEntries.length === 0 ? <p className="form-note">No admin actions recorded yet.</p> : auditEntries.slice(0, 8).map((entry) => (
            <div className="candidate-row" key={entry.id}>
              <div>
                <strong>{entry.action}</strong>
                <span>{entry.target}</span>
              </div>
              <span>{entry.actor}</span>
              <span>{entry.reason}</span>
              <span>{new Date(entry.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </article>

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">Pipeline</span>
              <h2>Candidate pipeline overview</h2>
            </div>
          </div>
          <div className="candidate-row"><span>Qualified</span><strong>{pipelineStats.qualified}</strong></div>
          <div className="candidate-row"><span>Needs review</span><strong>{pipelineStats.needsReview}</strong></div>
          <div className="candidate-row"><span>Pending</span><strong>{pipelineStats.pending}</strong></div>
          <div className="field-checklist" style={{ marginTop: "0.75rem" }}>
            {adminUsers.filter((user) => user.status !== "pending").slice(0, 6).map((user) => (
              <div className="field-item" key={user.email}>
                <Activity size={16} />
                <span>{user.name} — {user.status === "qualified" ? "Qualified" : "Needs review"}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">Analytics</span>
              <h2>Interview analytics</h2>
            </div>
          </div>
          <div className="candidate-row"><span>Total sessions</span><strong>{interviewAnalytics.totalSessions}</strong></div>
          <div className="candidate-row"><span>Passed sessions</span><strong>{interviewAnalytics.passedSessions}</strong></div>
          <div className="candidate-row"><span>Pass rate</span><strong>{interviewAnalytics.passRate}%</strong></div>
          <div className="candidate-row"><span>Average score</span><strong>{interviewAnalytics.averageScore}%</strong></div>
        </article>

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">Access matrix</span>
              <h2>Role-based access</h2>
            </div>
          </div>
          {accessMatrixRows.map((row) => (
            <div className="candidate-row" key={row.area}>
              <span>{row.area}</span>
              <strong>{row.candidate ? "Candidate" : "—"}</strong>
              <strong>{row.recruiter ? "Recruiter" : "—"}</strong>
              <strong>{row.trainer ? "Trainer" : "—"}</strong>
              <strong>{row.superAdmin ? "Super admin" : "—"}</strong>
            </div>
          ))}
        </article>

        <article className="dash-card candidate-table">
          <div className="card-header">
            <div>
              <span className="card-kicker">Incident workflow</span>
              <h2>Log and track incidents</h2>
            </div>
          </div>
          <form onSubmit={handleCreateIncident} className="ai-control-grid" style={{ marginBottom: "0.75rem" }}>
            <label><span>Title</span><input value={incidentDraft.title} onChange={(event) => setIncidentDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Server outage" /></label>
            <label><span>Severity</span><select value={incidentDraft.severity} onChange={(event) => setIncidentDraft((prev) => ({ ...prev, severity: event.target.value as IncidentItem["severity"] }))}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <label><span>Owner</span><input value={incidentDraft.owner} onChange={(event) => setIncidentDraft((prev) => ({ ...prev, owner: event.target.value }))} placeholder="Ops team" /></label>
            <label><span>Notes</span><input value={incidentDraft.notes} onChange={(event) => setIncidentDraft((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Describe the incident" /></label>
            <button type="submit" className="primary-cta">Log incident</button>
          </form>
          <div className="field-checklist">
            {incidents.slice(0, 6).map((incident) => (
              <div className="field-item" key={incident.id}>
                <AlertTriangle size={16} />
                <span>{incident.title} — {incident.severity} — {incident.owner}</span>
                <button type="button" className="secondary-cta" style={{ marginLeft: "auto" }} onClick={() => updateIncidentStatus(incident.id, incident.status === "resolved" ? "open" : "resolved")}>{incident.status === "resolved" ? "Reopen" : "Resolve"}</button>
              </div>
            ))}
          </div>
        </article>

        <article className="dash-card">
          <span className="card-kicker">Data sync</span>
          <h2>Firebase and server status</h2>
          <p>Prepare integrations for auth, profile records, job postings, and match reports.</p>
          <button><DatabaseZap size={18} />View services</button>
        </article>

        <article className="dash-card insights-card">
          <span className="card-kicker">Action items</span>
          <h2>Review security and system alerts</h2>
          <p>Update role access policies, validate active integrations, and schedule the next compliance review.</p>
          <button className="card-action-button"><AlertTriangle size={17} /> View alerts</button>
        </article>

        <article className="dash-card action-card">
          <UsersRound size={24} />
          <h2>Super Admin responsibilities</h2>
          <ul className="info-list">
            {["Manage platform", "Manage companies", "Manage recruiters", "Manage trainers", "Manage candidates", "Manage question banks", "AI configuration", "Subscription management", "Payment management", "Reports & analytics", "Certificate templates", "Email & SMS settings", "API management", "Platform settings", "Security settings"].map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </article>
      </section>

      {editingUser && (
        <div className="schedule-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="schedule-modal" onClick={(event) => event.stopPropagation()}>
            <div className="schedule-modal-header">
              <div className="schedule-modal-title">
                <ShieldCheck size={20} />
                <h3>Edit account</h3>
              </div>
              <button type="button" className="schedule-modal-close" onClick={() => setEditingUser(null)}><span>×</span></button>
            </div>
            <form className="schedule-modal-body" onSubmit={handleSaveUserEdit}>
              <div className="schedule-form-row">
                <label>
                  <span>Name</span>
                  <input className="schedule-input" value={editDraft.name} onChange={(event) => setEditDraft((prev) => ({ ...prev, name: event.target.value }))} />
                </label>
              </div>
              <div className="schedule-form-row schedule-form-row--two">
                <label>
                  <span>Role</span>
                  <select className="schedule-input" value={editDraft.role} onChange={(event) => setEditDraft((prev) => ({ ...prev, role: event.target.value as AuthUser["role"] }))}>
                    <option value="candidate">Candidate</option>
                    <option value="recruiter">Recruiter</option>
                    <option value="trainer">Trainer</option>
                    <option value="super-admin">Super admin</option>
                  </select>
                </label>
                <label>
                  <span>Preferred role</span>
                  <input className="schedule-input" value={editDraft.preferredJobRole} onChange={(event) => setEditDraft((prev) => ({ ...prev, preferredJobRole: event.target.value }))} placeholder="Frontend Engineer" />
                </label>
              </div>
              <p className="form-note">Only the super admin can edit or delete non-super-admin accounts. All sensitive actions are logged.</p>
              <div className="schedule-modal-footer">
                <button type="button" className="secondary-cta" onClick={() => setEditingUser(null)}>Cancel</button>
                <button type="submit" className="primary-cta">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
