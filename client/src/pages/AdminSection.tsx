import type { ChangeEvent } from "react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Building,
    Users2,
    GraduationCap,
    UserCheck,
    BookOpen,
    Cpu,
    CreditCard,
    BarChart3,
    Sparkles,
    Mail,
    KeyRound,
    Shield,
    Settings2,
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import WelcomeMessage from "../components/WelcomeMessage";

const sections = [
    { slug: "companies", title: "Manage companies", icon: Building, description: "Approve, audit, and update company accounts." },
    { slug: "recruiters", title: "Manage recruiters", icon: Users2, description: "Review recruiter access, active roles, and approvals." },
    { slug: "trainers", title: "Manage trainers", icon: GraduationCap, description: "Approve trainers, verify expertise, and assign courses." },
    { slug: "candidates", title: "Manage candidates", icon: UserCheck, description: "Track candidate profiles, statuses, and exam readiness." },
    { slug: "question-banks", title: "Manage question banks", icon: BookOpen, description: "Create, publish, and archive assessment questions." },
    { slug: "ai-configuration", title: "AI configuration", icon: Cpu, description: "Tune scoring models, thresholds, and assistant behavior." },
    { slug: "subscription-management", title: "Subscription management", icon: CreditCard, description: "Oversee plans, renewals, and enterprise subscriptions." },
    { slug: "payment-management", title: "Payment management", icon: CreditCard, description: "Review transactions, refunds, and billing health." },
    { slug: "reports-analytics", title: "Reports & analytics", icon: BarChart3, description: "View platform metrics, adoption, and success trends." },
    { slug: "certificate-templates", title: "Certificate templates", icon: Sparkles, description: "Create branded certificates and export templates." },
    { slug: "email-sms-settings", title: "Email & SMS settings", icon: Mail, description: "Configure messaging templates and delivery settings." },
    { slug: "api-management", title: "API management", icon: KeyRound, description: "Issue keys, track usage, and secure API access." },
    { slug: "platform-settings", title: "Platform settings", icon: Settings2, description: "Update global platform defaults and environment settings." },
    { slug: "security-settings", title: "Security settings", icon: Shield, description: "Manage MFA, sessions, and admin security policies." },
];

const sampleCompanies = [
    { name: "BlueRiver Tech", status: "Active", tier: "Enterprise" },
    { name: "GrowthHub Labs", status: "Suspended", tier: "Professional" },
    { name: "Nimbus Consulting", status: "Active", tier: "Starter" },
];

const sampleRecruiters = [
    { name: "Rina Patel", company: "BlueRiver Tech", status: "Approved" },
    { name: "Samuel Lee", company: "Nimbus Consulting", status: "Pending" },
    { name: "Kavya Rao", company: "GrowthHub Labs", status: "Approved" },
];

const sampleTrainers = [
    { name: "Priya Sharma", specialty: "AI & ML", status: "Verified" },
    { name: "Anuj Desai", specialty: "Frontend", status: "Pending" },
    { name: "Neha Iyer", specialty: "Soft Skills", status: "Verified" },
];

const sampleCandidates = [
    { name: "Aditi Kumar", stage: "Profile review", role: "Product Designer" },
    { name: "Rahul Singh", stage: "Assessment scheduled", role: "Software Engineer" },
    { name: "Meera Nair", stage: "Interview pending", role: "QA Analyst" },
];

const sampleQuestions = [
    { category: "Frontend", questions: 18 },
    { category: "Backend", questions: 24 },
    { category: "Aptitude", questions: 12 },
];

const samplePlans = [
    { label: "Startup", price: "$149", users: "10 users" },
    { label: "Growth", price: "$349", users: "50 users" },
    { label: "Enterprise", price: "$899", users: "Unlimited" },
];

const samplePayments = [
    { id: "TXN-2301", company: "BlueRiver Tech", amount: "$2,400", status: "Paid" },
    { id: "TXN-2302", company: "GrowthHub Labs", amount: "$1,200", status: "Pending" },
    { id: "TXN-2303", company: "Nimbus Consulting", amount: "$3,600", status: "Refunded" },
];

const sampleTemplates = [
    { title: "Completion certificate", type: "Standard" },
    { title: "Merit certificate", type: "Premium" },
    { title: "Course completion", type: "Academic" },
];

const sampleApiKeys = [
    { name: "Admin key", key: "sk_9j3k...8y7", active: true },
    { name: "Reporting key", key: "sk_h4b2...0ds", active: false },
];

export default function AdminSection() {
    const { section } = useParams<{ section: string }>();
    const navigate = useNavigate();
    const [questionInput, setQuestionInput] = useState("");
    const [aiEnabled, setAiEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [maintenance, setMaintenance] = useState(false);
    const [mfaEnabled, setMfaEnabled] = useState(true);
    const [apiKeys, setApiKeys] = useState(sampleApiKeys);
    const [questionBanks, setQuestionBanks] = useState(sampleQuestions);

    const currentSection = sections.find((item) => item.slug === section);
    if (!currentSection) {
        return (
            <main className="dashboard-page">
                <header className="dashboard-header">
                    <Link to="/admin" className="back-link">
                        <ArrowLeft size={18} />
                        Back to admin dashboard
                    </Link>
                    <div>
                        <span>AETHRIX AI</span>
                        <h1>Super Admin workspace</h1>
                        <p>Select a management section to continue.</p>
                    </div>
                    <div className="dashboard-actions">
                        <ThemeToggle />
                    </div>
                </header>
                <WelcomeMessage />
                <section className="dashboard-grid admin-layout">
                    {sections.map((item) => {
                        const Icon = item.icon;
                        return (
                            <article className="dash-card admin-card" key={item.slug}>
                                <div className="card-value">
                                    <Icon size={22} />
                                </div>
                                <h2>{item.title}</h2>
                                <p>{item.description}</p>
                                <button className="primary-cta" type="button" onClick={() => navigate(`/admin/${item.slug}`)}>
                                    Open
                                </button>
                            </article>
                        );
                    })}
                </section>
            </main>
        );
    }

    function renderSectionContent(sectionItem: (typeof sections)[number]) {
        switch (sectionItem.slug) {
            case "companies":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Company approval board</h3>
                            <p>Review company accounts, update status, and manage billing tiers.</p>
                            <div className="table-card">
                                {sampleCompanies.map((company) => (
                                    <div className="table-row" key={company.name}>
                                        <strong>{company.name}</strong>
                                        <span>{company.tier}</span>
                                        <span>{company.status}</span>
                                        <button type="button" className="secondary-cta">
                                            {company.status === "Active" ? "Suspend" : "Activate"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "recruiters":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Recruiter roster</h3>
                            <p>Approve recruiter accounts and review access status.</p>
                            <div className="table-card">
                                {sampleRecruiters.map((recruiter) => (
                                    <div className="table-row" key={recruiter.name}>
                                        <strong>{recruiter.name}</strong>
                                        <span>{recruiter.company}</span>
                                        <span>{recruiter.status}</span>
                                        <button type="button" className="secondary-cta">
                                            {recruiter.status === "Approved" ? "Revoke" : "Approve"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "trainers":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Trainer approval queue</h3>
                            <p>Verify trainer credentials and assign them to learning tracks.</p>
                            <div className="table-card">
                                {sampleTrainers.map((trainer) => (
                                    <div className="table-row" key={trainer.name}>
                                        <strong>{trainer.name}</strong>
                                        <span>{trainer.specialty}</span>
                                        <span>{trainer.status}</span>
                                        <button type="button" className="secondary-cta">
                                            {trainer.status === "Verified" ? "Review" : "Validate"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "candidates":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Candidate monitoring</h3>
                            <p>Track candidate readiness and prioritize exam scheduling.</p>
                            <div className="table-card">
                                {sampleCandidates.map((candidate) => (
                                    <div className="table-row" key={candidate.name}>
                                        <strong>{candidate.name}</strong>
                                        <span>{candidate.role}</span>
                                        <span>{candidate.stage}</span>
                                        <button type="button" className="secondary-cta">
                                            Message
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "question-banks":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Question bank editor</h3>
                            <p>Create and manage assessment questions by discipline.</p>
                            <div className="table-card">
                                {questionBanks.map((bank) => (
                                    <div className="table-row" key={bank.category}>
                                        <strong>{bank.category}</strong>
                                        <span>{bank.questions} questions</span>
                                        <button type="button" className="secondary-cta">
                                            Edit bank
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <label className="input-label">
                                Add quick question to aptitude
                                <input
                                    type="text"
                                    value={questionInput}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) => setQuestionInput(event.target.value)}
                                    placeholder="Type a sample question"
                                />
                            </label>
                            <button
                                type="button"
                                className="primary-cta"
                                onClick={() => {
                                    if (!questionInput.trim()) return;
                                    setQuestionBanks((current) =>
                                        current.map((bank) =>
                                            bank.category === "Aptitude" ? { ...bank, questions: bank.questions + 1 } : bank,
                                        ),
                                    );
                                    setQuestionInput("");
                                }}
                            >
                                Add to Aptitude bank
                            </button>
                        </div>
                    </div>
                );
            case "ai-configuration":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>AI scoring configuration</h3>
                            <p>Customize AI scoring, threshold, and assistant behavior.</p>
                            <label className="toggle-row">
                                <span>AI scoring enabled</span>
                                <button type="button" className="secondary-cta" onClick={() => setAiEnabled((state) => !state)}>
                                    {aiEnabled ? "Enabled" : "Disabled"}
                                </button>
                            </label>
                            <label className="input-label">
                                Scoring threshold
                                <input type="range" min="50" max="100" defaultValue="78" />
                            </label>
                            <button type="button" className="primary-cta">
                                Save AI settings
                            </button>
                        </div>
                    </div>
                );
            case "subscription-management":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Subscription plans</h3>
                            <p>Manage billing tiers and member access across customers.</p>
                            <div className="plan-grid">
                                {samplePlans.map((plan) => (
                                    <article className="dash-card plan-card" key={plan.label}>
                                        <span className="card-kicker">{plan.label}</span>
                                        <h2>{plan.price}</h2>
                                        <p>{plan.users}</p>
                                        <button type="button" className="secondary-cta">
                                            Select plan
                                        </button>
                                    </article>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "payment-management":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Payment ledger</h3>
                            <p>Review recent payment activity and issue refunds.</p>
                            <div className="table-card">
                                {samplePayments.map((payment) => (
                                    <div className="table-row" key={payment.id}>
                                        <strong>{payment.id}</strong>
                                        <span>{payment.company}</span>
                                        <span>{payment.amount}</span>
                                        <span>{payment.status}</span>
                                        <button type="button" className="secondary-cta">
                                            {payment.status === "Paid" ? "View" : "Review"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "reports-analytics":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Reports dashboard</h3>
                            <p>Monitor platform performance and user adoption at a glance.</p>
                            <div className="analytics-grid">
                                <article className="dash-card stat-card">
                                    <h4>Total assessments</h4>
                                    <strong>3,842</strong>
                                </article>
                                <article className="dash-card stat-card">
                                    <h4>Daily active users</h4>
                                    <strong>2,128</strong>
                                </article>
                                <article className="dash-card stat-card">
                                    <h4>Revenue growth</h4>
                                    <strong>+18%</strong>
                                </article>
                            </div>
                        </div>
                    </div>
                );
            case "certificate-templates":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Certificate templates</h3>
                            <p>Manage AETHRIX AI certificate designs co-branded with Inventra consultant and training.</p>
                            <div className="table-card">
                                {sampleTemplates.map((template) => (
                                    <div className="table-row" key={template.title}>
                                        <strong>{template.title}</strong>
                                        <span>{template.type}</span>
                                        <button type="button" className="secondary-cta">
                                            Preview
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <p className="form-note">Certificates are issued with AETHRIX AI and Inventra branding after successful assessment completion.</p>
                        </div>
                    </div>
                );
            case "email-sms-settings":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Email & SMS settings</h3>
                            <p>Configure campaign delivery and messaging templates.</p>
                            <label className="toggle-row">
                                <span>Email delivery</span>
                                <button type="button" className="secondary-cta" onClick={() => setEmailEnabled((state) => !state)}>
                                    {emailEnabled ? "Enabled" : "Disabled"}
                                </button>
                            </label>
                            <label className="toggle-row">
                                <span>SMS delivery</span>
                                <button type="button" className="secondary-cta" onClick={() => setSmsEnabled((state) => !state)}>
                                    {smsEnabled ? "Enabled" : "Disabled"}
                                </button>
                            </label>
                            <button type="button" className="primary-cta">
                                Save messaging settings
                            </button>
                        </div>
                    </div>
                );
            case "api-management":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>API key management</h3>
                            <p>Manage API credentials and audit client access.</p>
                            <div className="table-card">
                                {apiKeys.map((api) => (
                                    <div className="table-row" key={api.name}>
                                        <strong>{api.name}</strong>
                                        <span>{api.key}</span>
                                        <span>{api.active ? "Active" : "Inactive"}</span>
                                        <button
                                            type="button"
                                            className="secondary-cta"
                                            onClick={() =>
                                                setApiKeys((current) =>
                                                    current.map((item) =>
                                                        item.name === api.name ? { ...item, active: !item.active } : item,
                                                    ),
                                                )
                                            }
                                        >
                                            {api.active ? "Disable" : "Enable"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case "platform-settings":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Platform settings</h3>
                            <p>Control global defaults, maintenance mode, and environment flags.</p>
                            <label className="toggle-row">
                                <span>Maintenance mode</span>
                                <button type="button" className="secondary-cta" onClick={() => setMaintenance((state) => !state)}>
                                    {maintenance ? "Enabled" : "Disabled"}
                                </button>
                            </label>
                            <button type="button" className="primary-cta">
                                Save platform settings
                            </button>
                        </div>
                    </div>
                );
            case "security-settings":
                return (
                    <div className="section-block">
                        <div className="section-card">
                            <h3>Security management</h3>
                            <p>Manage session security, MFA, and policy enforcement.</p>
                            <label className="toggle-row">
                                <span>Multi-factor authentication</span>
                                <button type="button" className="secondary-cta" onClick={() => setMfaEnabled((state) => !state)}>
                                    {mfaEnabled ? "Enabled" : "Disabled"}
                                </button>
                            </label>
                            <div className="table-card">
                                <div className="table-row">
                                    <strong>Active sessions</strong>
                                    <span>12 sessions</span>
                                    <button type="button" className="secondary-cta">
                                        End all sessions
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    }

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <Link to="/admin" className="back-link">
                    <ArrowLeft size={18} />
                    Back to admin dashboard
                </Link>
                <div>
                    <span>AETHRIX AI</span>
                    <h1>{currentSection.title}</h1>
                    <p>{currentSection.description}</p>
                </div>
                <div className="dashboard-actions">
                    <ThemeToggle />
                </div>
            </header>
            <section className="dashboard-grid admin-section-grid">
                <article className="dash-card section-summary-card">
                    <span className="card-kicker">Section overview</span>
                    <h2>{currentSection.title}</h2>
                    <p>{currentSection.description}</p>
                    <button type="button" className="ghost-link" onClick={() => navigate("/admin")}>Return to admin hub</button>
                </article>
                <article className="dash-card section-action-card">
                    {renderSectionContent(currentSection)}
                </article>
            </section>
        </main>
    );
}
