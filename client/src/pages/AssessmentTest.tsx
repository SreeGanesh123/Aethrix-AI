import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, Pause, Play, RefreshCcw, ShieldCheck } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { getExamPassed, getStoredUser, setExamPassed, setCertificateMeta, createCertificateId, addCertificateToSession, getGradeFromScore, type CertificateRecord } from "../utils/auth";
import { generateAssessmentPromptsWithAI } from "../services/aiService";
import type { AuthUser } from "../utils/auth";


const mcqQuestions = [
    {
        question: "Which data structure uses First In, First Out (FIFO)?",
        options: ["Stack", "Queue", "Hash Table", "Binary Tree"],
        answer: 1,
    },
    {
        question: "What is the output of `2 + '2'` in JavaScript?",
        options: ["4", "22", "TypeError", "NaN"],
        answer: 1,
    },
    {
        question: "Which algorithm type is used for finding the shortest path in a graph?",
        options: ["Dynamic programming", "Backtracking", "Greedy", "Divide and conquer"],
        answer: 2,
    },
    {
        question: "What is the primary purpose of a relational database index?",
        options: ["Store backups", "Improve search speed", "Encrypt data", "Compress tables"],
        answer: 1,
    },
    {
        question: "Which sentence is an example of passive voice?",
        options: ["The team completed the report.", "The report was completed by the team.", "The team will complete the report.", "The team is completing the report."],
        answer: 1,
    },
];

const codingChallenges = [
    {
        title: "Sum of Array",
        description: "Write a JavaScript function that returns the sum of all numbers in an array.",
        functionName: "sumArray",
        starterCode: `function sumArray(nums) {
  // return the total of all items in nums
}`,
        sampleTests: [
            { input: "[1,2,3]", expected: "6" },
            { input: "[5,-2,4]", expected: "7" },
        ],
        challengeTests: [
            { input: "[0,0,0]", expected: "0" },
            { input: "[-5, 10, 2]", expected: "7" },
        ],
    },
    {
        title: "Reverse String",
        description: "Write a JavaScript function that returns the reversed string.",
        functionName: "reverseString",
        starterCode: `function reverseString(text) {
  // return the text reversed
}`,
        sampleTests: [
            { input: "'hello'", expected: "'olleh'" },
            { input: "'abc'", expected: "'cba'" },
        ],
        challengeTests: [
            { input: "'OpenAI'", expected: "'IAnepO'" },
            { input: "'AETHRIX'", expected: "'XIRHTEA'" },
        ],
    },
];

const aptitudeQuestions = [
    "If 5 machines take 5 minutes to make 5 widgets, how long will 100 machines take to make 100 widgets?",
    "A train travels 60 km in 50 minutes. What is its average speed in km/h?",
    "If the ratio of cats to dogs is 3:5 and there are 40 animals, how many cats are there?",
    "Complete the sequence: 2, 6, 12, 20, ___.",
];

const communicationPrompts = [
    "Write a short professional email to request feedback after a job interview.",
    "Explain a technical concept, such as APIs, in simple terms for a non-technical audience.",
    "Draft a response to a customer who is unhappy with a delayed delivery.",
];

const requiredProfileFields = [
    { key: "name", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "gender", label: "Gender" },
    { key: "phone", label: "Phone" },
    { key: "dob", label: "Date of Birth" },
    { key: "address", label: "Address" },
    { key: "education", label: "Education" },
    { key: "university", label: "University" },
    { key: "graduationYear", label: "Graduation Year" },
    { key: "experience", label: "Experience" },
    { key: "skills", label: "Skills" },
    { key: "resume", label: "Resume" },
    { key: "linkedIn", label: "LinkedIn" },
    { key: "github", label: "GitHub" },
    { key: "portfolio", label: "Portfolio" },
    { key: "preferredJobRole", label: "Preferred Job Role" },
    { key: "preferredLocation", label: "Preferred Location" },
];

const testDurationMap: Record<string, number> = {
    MCQ: 15 * 60,
    Coding: 30 * 60,
    "Aptitude & Communication": 20 * 60,
    "Original Test": 25 * 60,
};

function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
    const remainder = (seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remainder}`;
}

export default function AssessmentTest() {
    const [params] = useSearchParams();
    const testType = params.get("test") || "Original Test";
    const storedUser = getStoredUser();
    const [user] = useState<AuthUser | null>(storedUser);
    const [secondsLeft, setSecondsLeft] = useState(25 * 60);
    const [running, setRunning] = useState(false);
    const [examPassed, setExamPassedState] = useState(false);
    const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<number[]>(Array(mcqQuestions.length).fill(-1));
    const [mcqSubmitted, setMcqSubmitted] = useState(false);
    const [mcqScore, setMcqScore] = useState<number | null>(null);
    const [codingIndex] = useState(0);
    const [code, setCode] = useState(codingChallenges[0].starterCode);
    const [codeOutput, setCodeOutput] = useState<string | null>(null);
    const [codeStatus, setCodeStatus] = useState<string | null>(null);
    const [generatedAptitude, setGeneratedAptitude] = useState<string[]>([]);
    const [generatedCommunication, setGeneratedCommunication] = useState<string[]>([]);
    const [aptitudeAnswers, setAptitudeAnswers] = useState<string[]>([]);
    const [communicationAnswers, setCommunicationAnswers] = useState<string[]>([]);
    const [generatingPrompts, setGeneratingPrompts] = useState(false);
    const [promptError, setPromptError] = useState<string | null>(null);

    const missingFieldsData = useMemo(() => {
        return requiredProfileFields.filter((field) => !user?.[field.key as keyof AuthUser]);
    }, [user]);

    useEffect(() => {
        setExamPassedState(getExamPassed(user?.email));
    }, [user?.email]);

    const missingFields = missingFieldsData.map((field) => field.label);
    const ready = missingFields.length === 0;

    useEffect(() => {
        const duration = testDurationMap[testType] || 25 * 60;
        setSecondsLeft(duration);
        setRunning(false);
    }, [testType]);

    useEffect(() => {
        if (!running) return;
        if (secondsLeft <= 0) {
            setRunning(false);
            return;
        }

        const timer = window.setInterval(() => {
            setSecondsLeft((value) => Math.max(0, value - 1));
        }, 1000);

        return () => window.clearInterval(timer);
    }, [running, secondsLeft]);

    useEffect(() => {
        if (secondsLeft === 0) setRunning(false);
    }, [secondsLeft]);

    useEffect(() => {
        setGeneratedAptitude(aptitudeQuestions.slice(0, 3));
        setGeneratedCommunication(communicationPrompts.slice(0, 2));
        setAptitudeAnswers(Array(3).fill(""));
        setCommunicationAnswers(Array(2).fill(""));
    }, []);

    const currentCoding = codingChallenges[codingIndex];

    const evaluateCode = (tests: { input: string; expected: string }[]) => {
        let outputText = "";
        try {
            for (const test of tests) {
                const runner = new Function(`${code}\nreturn ${currentCoding.functionName}(${test.input});`);
                const result = runner();
                const passed = String(result) === test.expected;
                outputText += `Test input: ${test.input} | expected: ${test.expected} | got: ${String(result)} | ${passed ? "PASS" : "FAIL"}\n`;
            }
            setCodeStatus("Evaluation complete.");
            setCodeOutput(outputText);
        } catch (err) {
            setCodeStatus("Error running code: " + (err instanceof Error ? err.message : String(err)));
            setCodeOutput(null);
        }
    };

    const submitMcq = () => {
        const score = selectedMcqAnswers.reduce((sum, answer, index) => (answer === mcqQuestions[index].answer ? sum + 1 : sum), 0);
        setMcqScore(score);
        setMcqSubmitted(true);
    };

    const regenerateTest = async () => {
        setGeneratingPrompts(true);
        setPromptError(null);

        try {
            const prompts = await generateAssessmentPromptsWithAI(testType);
            setGeneratedAptitude(prompts.aptitude);
            setGeneratedCommunication(prompts.communication);
            setAptitudeAnswers(Array(prompts.aptitude.length).fill(""));
            setCommunicationAnswers(Array(prompts.communication.length).fill(""));
        } catch (error) {
            console.error("AI prompt generation failed", error);
            setPromptError("AI prompt generation is unavailable right now. Please try again in a moment.");
        } finally {
            setGeneratingPrompts(false);
        }
    };

    const submitCommunicationTest = () => {
        setCommunicationAnswers(communicationAnswers.map((answer) => answer.trim()));
    };

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <Link to="/assessment" className="back-link">
                    <ArrowLeft size={18} />
                    Back to hub
                </Link>
                <div>
                    <span>AETHRIX AI</span>
                    <h1>{testType}</h1>
                    <p>Complete the required profile checks and run your timed original exam.</p>
                </div>
                <div className="dashboard-actions">
                    <ThemeToggle />
                    <Link to="/candidate" className="ghost-link">
                        Candidate profile
                    </Link>
                </div>
            </header>

            <section className="dashboard-grid test-grid">
                <article className="dash-card test-card">
                    <span className="card-kicker">Required field validation</span>
                    <h2>Profile readiness</h2>
                    <p>Every test is gated by profile details you already configured or still need to complete.</p>
                    <div className="field-summary">
                        <div>
                            <span>Profile status</span>
                            <strong>{ready ? "Ready for testing" : "Fields missing"}</strong>
                        </div>
                        <div>
                            <span>Missing items</span>
                            <strong>{missingFields.length}</strong>
                        </div>
                    </div>
                    {!ready && (
                        <>
                            <div className="field-checklist">
                                {missingFields.map((field) => (
                                    <div key={field} className="field-item">
                                        <CheckCircle2 size={16} />
                                        <span>{field}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="profile-form">
                                <h3>Missing profile details</h3>
                                <p>Open the dedicated profile completion page to fill all missing fields. The form saves automatically.</p>
                                <Link
                                    to={`/profile/complete?return=${encodeURIComponent(`/assessment/test?test=${testType}`)}`}
                                    className="primary-cta full-width"
                                >
                                    Complete profile details
                                </Link>
                            </div>
                        </>
                    )}
                    {ready && (
                        <div className="profile-ready">
                            <ShieldCheck size={18} />
                            <span>Your profile includes all required fields for the test.</span>
                        </div>
                    )}
                </article>

                <article className="dash-card timer-card">
                    <span className="card-kicker">Pomodoro exam timer</span>
                    <div className="timer-display">
                        <Clock3 size={20} />
                        <strong>{formatTime(secondsLeft)}</strong>
                    </div>
                    <p>Use a classic 25-minute focus session to complete the exam before the countdown ends.</p>
                    <div className="timer-controls">
                        <button className="secondary-cta" type="button" onClick={() => setRunning((state) => !state)}>
                            {running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Start</>}
                        </button>
                        <button className="ghost-link" type="button" onClick={() => { setSecondsLeft(25 * 60); setRunning(false); }}>
                            <RefreshCcw size={16} /> Reset
                        </button>
                    </div>
                </article>

                <article className="dash-card test-start-card">
                    <span className="card-kicker">{testType}</span>
                    <h2>{testType} assessment</h2>
                    <p>Run the selected internal assessment below. The timer tracks your session automatically.</p>

                    {testType === "MCQ" && (
                        <div className="assessment-section">
                            <h3>MCQ questions</h3>
                            <div className="mcq-list">
                                {mcqQuestions.map((question, index) => (
                                    <div key={question.question} className="mcq-question-card">
                                        <p><strong>{index + 1}. {question.question}</strong></p>
                                        <div className="mcq-options">
                                            {question.options.map((option, optionIndex) => (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    className={selectedMcqAnswers[index] === optionIndex ? "option selected" : "option"}
                                                    onClick={() => {
                                                        const next = [...selectedMcqAnswers];
                                                        next[index] = optionIndex;
                                                        setSelectedMcqAnswers(next);
                                                    }}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="assessment-actions">
                                <button type="button" className="primary-cta" onClick={submitMcq}>
                                    Submit MCQ
                                </button>
                            </div>
                            {mcqSubmitted && mcqScore !== null && (
                                <p className="form-note">Score: {mcqScore} / {mcqQuestions.length}</p>
                            )}
                        </div>
                    )}

                    {testType === "Coding" && (
                        <div className="assessment-section">
                            <h3>{currentCoding.title}</h3>
                            <p>{currentCoding.description}</p>
                            <textarea
                                className="code-editor"
                                value={code}
                                onChange={(event) => setCode(event.target.value)}
                                rows={14}
                            />
                            <div className="testcases-card">
                                <h4>Sample tests</h4>
                                <ul>
                                    {currentCoding.sampleTests.map((test, idx) => (
                                        <li key={idx}>{test.input} =&gt; {test.expected}</li>
                                    ))}
                                </ul>
                                <button type="button" className="primary-cta" onClick={() => evaluateCode(currentCoding.sampleTests)}>
                                    Run sample tests
                                </button>
                            </div>
                            <div className="testcases-card">
                                <h4>Challenge tests</h4>
                                <ul>
                                    {currentCoding.challengeTests.map((test, idx) => (
                                        <li key={idx}>{test.input} =&gt; {test.expected}</li>
                                    ))}
                                </ul>
                                <button type="button" className="secondary-cta" onClick={() => evaluateCode(currentCoding.challengeTests)}>
                                    Run challenge tests
                                </button>
                            </div>
                            {codeStatus && <p className="form-note">{codeStatus}</p>}
                            {codeOutput && <pre className="code-output">{codeOutput}</pre>}
                        </div>
                    )}

                    {testType === "Aptitude & Communication" && (
                        <div className="assessment-section">
                            <h3>Aptitude questions</h3>
                            {generatedAptitude.map((question, index) => (
                                <div key={question} className="aptitude-card">
                                    <p><strong>{index + 1}. {question}</strong></p>
                                    <textarea
                                        rows={3}
                                        value={aptitudeAnswers[index] || ""}
                                        onChange={(event) => {
                                            const next = [...aptitudeAnswers];
                                            next[index] = event.target.value;
                                            setAptitudeAnswers(next);
                                        }}
                                    />
                                </div>
                            ))}
                            <h3>Communication prompts</h3>
                            {generatedCommunication.map((prompt, index) => (
                                <div key={prompt} className="communication-card">
                                    <p><strong>{index + 1}. {prompt}</strong></p>
                                    <textarea
                                        rows={4}
                                        value={communicationAnswers[index] || ""}
                                        onChange={(event) => {
                                            const next = [...communicationAnswers];
                                            next[index] = event.target.value;
                                            setCommunicationAnswers(next);
                                        }}
                                    />
                                </div>
                            ))}
                            <div className="assessment-actions">
                                <button type="button" className="primary-cta" onClick={submitCommunicationTest}>
                                    Submit answers
                                </button>
                                <button type="button" className="ghost-link" onClick={() => void regenerateTest()} disabled={generatingPrompts}>
                                    {generatingPrompts ? "Generating..." : "Regenerate test"}
                                </button>
                            </div>
                            {promptError && <p className="form-note error-note">{promptError}</p>}
                        </div>
                    )}

                    {testType !== "MCQ" && testType !== "Coding" && testType !== "Aptitude & Communication" && (
                        <div className="empty-state-card">
                            <p>Select an assessment type from the hub to begin. The internal test engine supports MCQs, coding challenges, and aptitude/communication practice.</p>
                        </div>
                    )}

                    {ready && (
                        <button
                            type="button"
                            className="secondary-cta full-width"
                            onClick={() => {
                                if (!user?.email) return;

                                // Create and save certificate data
                                const generatedScore = Math.floor(Math.random() * 40 + 60); // Random score 60-100
                                const certData: CertificateRecord = {
                                    id: createCertificateId(),
                                    issuedAt: new Date().toISOString(),
                                    candidateName: user.name || 'Candidate',
                                    candidateEmail: user.email,
                                    examType: testType || 'General Assessment',
                                    examName: testType ? `${testType} Assessment` : 'AETHRIX Assessment',
                                    score: generatedScore,
                                    totalScore: 100,
                                    grade: getGradeFromScore(generatedScore, 100),
                                    passStatus: generatedScore >= 70 ? 'pass' : 'fail',
                                    completedDate: new Date().toISOString(),
                                };

                                setCertificateMeta(user.email, certData);
                                addCertificateToSession(user.email, certData);
                                setExamPassed(user.email);
                                setExamPassedState(true);
                            }}
                        >
                            <CheckCircle2 size={16} />
                            Mark exam as passed
                        </button>
                    )}
                    {examPassed && (
                        <div className="profile-ready">
                            <CheckCircle2 size={18} />
                            <span>Exam passed — certificate will be unlocked on your dashboard.</span>
                        </div>
                    )}
                </article>
            </section>

        </main>
    );
}
