import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpenCheck, BrainCircuit, FileText, Sparkles, UserRoundCheck, ExternalLink } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { generateAssessmentWithAI, type GeneratedAssessmentResult } from "../services/aiService";
import { getStoredUser } from "../utils/auth";

const assessmentCards = [
    {
        title: "MCQ Assessment",
        description: "Answer multiple-choice questions in technical, logical, and aptitude domains with instant scoring.",
        icon: BrainCircuit,
        route: "/assessment/start/mcq",
    },
    {
        title: "Coding Assessment",
        description: "Solve a programming challenge with timed execution, sample test cases and editor support.",
        icon: BookOpenCheck,
        route: "/assessment/start/coding",
    },
    {
        title: "Aptitude & Communication",
        description: "Take automatically generated aptitude questions and written communication tasks.",
        icon: Sparkles,
        route: "/assessment/start/aptitude-communication",
    },
    {
        title: "Candidate Profile Review",
        description: "Review mandatory profile sections such as education, experience, skills, resume, and social profiles before assessment.",
        icon: UserRoundCheck,
        route: "/profile/complete?return=/assessment/test?test=MCQ",
    },
];

const externalProviders = [
    { label: "HackerRank", href: "https://www.hackerrank.com/" },
    { label: "Codility", href: "https://www.codility.com/" },
    { label: "TestDome", href: "https://www.testdome.com/" },
    { label: "HackerEarth", href: "https://www.hackerearth.com/" },
];

export default function AssessmentHub() {
    const [role, setRole] = useState("Frontend Engineer");
    const [skill, setSkill] = useState("JavaScript");
    const [difficulty, setDifficulty] = useState("intermediate");
    const [jobDescription, setJobDescription] = useState("");
    const [generatedAssessment, setGeneratedAssessment] = useState<GeneratedAssessmentResult | null>(null);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        const storedUser = getStoredUser();
        if (storedUser?.preferredJobRole) {
            setRole(storedUser.preferredJobRole);
        }
        if (storedUser?.skills) {
            setSkill(storedUser.skills);
        }
    }, []);

    async function handleGenerateAssessment() {
        setGenerating(true);
        try {
            const storedUser = getStoredUser();
            const result = await generateAssessmentWithAI({
                role,
                skill,
                difficulty,
                resumeSkills: storedUser?.skills || skill,
                jobDescription,
            });
            setGeneratedAssessment(result);
        } catch (error) {
            console.error("Assessment generation failed:", error);
        } finally {
            setGenerating(false);
        }
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
                    <h1>Assessment hub</h1>
                    <p>Choose a structured assessment experience for candidates and recruiters.</p>
                </div>
                <div className="dashboard-actions">
                    <ThemeToggle />
                    <Link to="/candidate" className="ghost-link">
                        Candidate view
                    </Link>
                </div>
            </header>

            <section className="dashboard-grid assessment-hub-grid">
                {assessmentCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article className="dash-card assessment-card" key={card.title}>
                            <div className="assessment-card-icon">
                                <Icon size={22} />
                            </div>
                            <h2>{card.title}</h2>
                            <p>{card.description}</p>
                            <Link to={card.route} className="primary-link assessment-link">
                                <FileText size={18} />
                                Open assessment
                            </Link>
                        </article>
                    );
                })}
            </section>

            <section className="dashboard-grid provider-grid">
                <article className="dash-card provider-card">
                    <div className="ai-feature-heading">
                        <Sparkles size={22} />
                        <div>
                            <span className="card-kicker">AI assessment generator</span>
                            <h2>Create a custom test</h2>
                        </div>
                    </div>
                    <p>Generate MCQs, a coding prompt, and a scoring rubric using the candidate’s resume skills and the target job description.</p>
                    <div className="ai-control-grid">
                        <label>
                            <span>Role</span>
                            <input value={role} onChange={(event) => setRole(event.target.value)} />
                        </label>
                        <label>
                            <span>Resume skills</span>
                            <input value={skill} onChange={(event) => setSkill(event.target.value)} />
                        </label>
                        <label>
                            <span>Difficulty</span>
                            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </label>
                    </div>
                    <label>
                        <span>Job description</span>
                        <textarea
                            value={jobDescription}
                            onChange={(event) => setJobDescription(event.target.value)}
                            rows={5}
                            placeholder="Paste the job description here to tailor the assessment questions."
                        />
                    </label>
                    <button type="button" className="primary-cta" onClick={() => void handleGenerateAssessment()} disabled={generating}>
                        <Sparkles size={18} />
                        {generating ? "Generating..." : "Generate assessment"}
                    </button>
                    {generatedAssessment && (
                        <div className="ai-result-block">
                            <strong>{generatedAssessment.title}</strong>
                            {generatedAssessment.mcqs.map((item, index) => (
                                <div className="ai-week-row" key={item.question}>
                                    <span>Q{index + 1}</span>
                                    <p><strong>{item.question}</strong> {item.options?.join(" / ")}</p>
                                </div>
                            ))}
                            <p><strong>Coding:</strong> {generatedAssessment.codingPrompt}</p>
                            <div className="ai-chip-row">
                                {generatedAssessment.rubric.map((item) => <span key={item}>{item}</span>)}
                            </div>
                        </div>
                    )}
                </article>

                <article className="dash-card provider-card">
                    <span className="card-kicker">Real exam providers</span>
                    <h2>Launch official assessment platforms</h2>
                    <p>Use these real exam providers for premium technical and aptitude testing.</p>
                    <div className="provider-links">
                        {externalProviders.map((provider) => (
                            <a key={provider.label} href={provider.href} target="_blank" rel="noreferrer" className="provider-link">
                                <span>{provider.label}</span>
                                <ExternalLink size={16} />
                            </a>
                        ))}
                    </div>
                </article>
            </section>
        </main>
    );
}
