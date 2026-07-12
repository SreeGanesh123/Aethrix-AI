import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { getExamPassed, getStoredUser, setExamPassed } from "../utils/auth";
import { generateQuestionsWithAI } from "../services/aiService";

type Language = "JavaScript" | "Python" | "SQL";

type CodingTemplate = {
  title: string;
  description: string;
  starterCode: string;
  sampleTests: string[];
};

type TestResult = {
  label: string;
  passed: boolean;
  details: string;
  expected?: string;
  actual?: string;
};

function parseCodingTest(test: string) {
  const arrow = test.includes(">=") ? ">=" : test.includes("=>") ? "=>" : test.includes("->") ? "->" : null;
  if (!arrow) return null;
  const [input, expected] = test.split(arrow).map((part) => part.trim());
  return { input, expected, label: test };
}

function normalizeValue(value: string) {
  try {
    return JSON.parse(value.replace(/([\w]+):/g, '"$1":').replace(/'/g, '"'));
  } catch {
    return value;
  }
}

function isSameValue(a: unknown, b: unknown) {
  if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}

const defaultCodingTemplates: Record<Language, CodingTemplate> = {
  JavaScript: {
    title: "Array Sum Calculator",
    description: "Write a function that takes an array of numbers and returns the sum of all values.",
    starterCode: "function solve(numbers) {\n  // your code here\n}\n\n// Example:\n// solve([1,2,3]) => 6\n",
    sampleTests: ["[1, 2, 3] => 6", "[0, -1, 5] => 4", "[] => 0"],
  },
  Python: {
    title: "Array Sum Calculator",
    description: "Write a function that takes a list of numbers and returns the total sum.",
    starterCode: "def solve(numbers):\n    # your code here\n    pass\n\n# Example:\n# solve([1, 2, 3]) -> 6\n",
    sampleTests: ["[1, 2, 3] -> 6", "[0, -1, 5] -> 4", "[] -> 0"],
  },
  SQL: {
    title: "Employee Salary Filter",
    description: "Write a SQL query that returns employee names and salaries for employees earning more than 50000.",
    starterCode: "-- Write your SQL query below\nSELECT name, salary\nFROM employees\nWHERE salary > 50000;",
    sampleTests: ["employees with salary 55000 should be included", "employees with salary 48000 should be excluded"],
  },
};

export default function AssessmentCoding() {
  const storedUser = getStoredUser();
  const [searchParams] = useSearchParams();
  const selectedLanguageFromUrl = (searchParams.get("language") as Language | null) ?? "JavaScript";
  const returnTo = searchParams.get("returnTo");
  const sessionId = searchParams.get("session");

  const [language, setLanguage] = useState<Language>(selectedLanguageFromUrl);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sampleTests, setSampleTests] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [passed, setPassed] = useState(getExamPassed(storedUser?.email));

  const loadChallenge = useCallback(async (lang: Language) => {
    setLoading(true);
    setStatus(null);
    setOutput(null);
    try {
      const result = await generateQuestionsWithAI({
        type: "coding",
        language: lang,
        userSeed: `${storedUser?.email ?? "guest"}-${lang}-${Date.now()}`,
        challengeCount: 2,
      });

      const template = defaultCodingTemplates[lang];
      const challenge = result.challenges?.[0];
      setTitle(result.title ?? challenge?.title ?? template.title);
      setDescription(result.description ?? challenge?.description ?? template.description);
      const fallbackCode = result.starterCode || challenge?.starterCode || template.starterCode;
      setSampleTests(
        result.sampleTests?.length
          ? result.sampleTests
          : challenge?.sampleTests?.length
            ? challenge.sampleTests
            : template.sampleTests,
      );
      setCode(fallbackCode);
    } catch {
      setStatus("Failed to load AI challenge. Please refresh and try again.");
      const template = defaultCodingTemplates[lang];
      setTitle(template.title);
      setDescription(template.description);
      setSampleTests(template.sampleTests);
      setCode(template.starterCode);
    } finally {
      setLoading(false);
    }
  }, [storedUser?.email]);

  useEffect(() => {
    setLanguage(selectedLanguageFromUrl);
    void loadChallenge(selectedLanguageFromUrl);
  }, [selectedLanguageFromUrl, loadChallenge]);

  useEffect(() => {
    if (!passed || !returnTo) return;

    const nextUrl = new URL(returnTo, window.location.origin);
    if (sessionId) nextUrl.searchParams.set("session", sessionId);
    nextUrl.searchParams.set("codingComplete", "1");

    const timer = window.setTimeout(() => {
      window.location.assign(nextUrl.toString());
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [passed, returnTo, sessionId]);

  function evaluateCode() {
    setStatus(null);
    setOutput(null);
    setTestResults(null);

    if (!code.trim()) {
      setStatus("Please write your solution before running tests.");
      return;
    }

    if (language === "JavaScript") {
      const parsedTests = sampleTests
        .map(parseCodingTest)
        .filter((test): test is NonNullable<ReturnType<typeof parseCodingTest>> => test !== null);
      if (parsedTests.length === 0) {
        setStatus("No runnable JavaScript tests were found.");
        return;
      }

      const results: TestResult[] = parsedTests.map((test) => {
        const normalizedInput = normalizeValue(test.input);
        const expected = normalizeValue(test.expected);
        try {
          const fn = new Function(`${code}\nreturn typeof solve === 'function' ? solve : typeof solution === 'function' ? solution : undefined;`);
          const solveFn = fn();
          if (typeof solveFn !== "function") {
            return { label: test.label, passed: false, details: "No solve() or solution() function could be found in your code." };
          }
          const actual = solveFn(normalizedInput);
          const passedTest = isSameValue(actual, expected);
          return {
            label: test.label,
            passed: passedTest,
            expected: String(expected),
            actual: String(actual),
            details: passedTest ? "Passed" : `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
          } as TestResult;
        } catch (error) {
          return {
            label: test.label,
            passed: false,
            details: `Runtime error: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      });

      setTestResults(results);
      const passedCount = results.filter((result) => result.passed).length;
      const summary = `${passedCount} of ${results.length} sample tests passed.`;
      setStatus(passedCount === results.length ? `All sample tests passed. ${summary}` : `Some tests failed. ${summary}`);
      if (passedCount === results.length && storedUser?.email) {
        setExamPassed(storedUser.email);
        setPassed(true);
      }
      return;
    }

    if (language === "Python") {
      const hasFunction = /def\s+(solve|solution)\s*\(/.test(code);
      const hasReturn = /return\s+/.test(code);
      if (!hasFunction) {
        setStatus("Python solution must define a solve() or solution() function.");
        setTestResults([{ label: "Syntax check", passed: false, details: "Define a solve() or solution() function to handle input." }]);
        return;
      }
      if (!hasReturn) {
        setStatus("Python solution should include a return statement.");
        setTestResults([{ label: "Syntax check", passed: false, details: "Add a return statement inside your function." }]);
        return;
      }
      setStatus("Python code looks structurally valid. Use a proper interpreter for runtime results.");
      setTestResults([{ label: "Syntax check", passed: true, details: "Function definition and return statement are present." }]);
      return;
    }

    if (language === "SQL") {
      const normalized = code.toLowerCase();
      if (!normalized.includes("select") || !normalized.includes("from")) {
        setStatus("Your SQL query must include SELECT and FROM.");
        setTestResults([{ label: "Syntax check", passed: false, details: "Add SELECT and FROM to your query." }]);
        return;
      }
      setStatus("SQL query appears syntactically valid. Use a database engine for real execution results.");
      setTestResults([{ label: "Syntax check", passed: true, details: "SELECT and FROM statements detected." }]);
      return;
    }
  }

  function submitSolution() {
    evaluateCode();
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/assessment" className="back-link"><ArrowLeft size={18} />Back to hub</Link>
        <div>
          <span>AETHRIX AI</span>
          <h1>Coding Assessment</h1>
          <p>AI generates a unique coding challenge for every candidate.</p>
        </div>
        <div className="dashboard-actions">
          <ThemeToggle />
          <Link to="/candidate" className="ghost-link">Candidate profile</Link>
        </div>
      </header>

      <section className="dashboard-grid test-grid">
        <article className="dash-card test-card grid-span-full">
          <span className="card-kicker">{language} — coding challenge</span>

          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "var(--teal)" }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              Generating your unique challenge…
            </div>
          )}

          {!loading && (
            <>
              <div className="language-selector">
                <label htmlFor="code-language">Choose language</label>
                <select
                  id="code-language"
                  value={language}
                  onChange={(event) => {
                    const nextLang = event.target.value as Language;
                    setLanguage(nextLang);
                    void loadChallenge(nextLang);
                  }}
                >
                  <option value="JavaScript">JavaScript</option>
                  <option value="Python">Python</option>
                  <option value="SQL">SQL</option>
                </select>
              </div>

              <div className="coding-problem-summary">
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
              <div className="testcases-card">
                <h4>Problem definition</h4>
                <p>{description}</p>
                <h4>Sample test cases</h4>
                <ul>{sampleTests.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
              <textarea
                className="code-editor"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={18}
                placeholder="Write your code here..."
              />
              <div className="assessment-actions">
                <button type="button" className="secondary-cta" onClick={() => void loadChallenge(language)}>New challenge</button>
                <button type="button" className="secondary-cta" onClick={evaluateCode}>Run tests</button>
                <button type="button" className="primary-cta" onClick={submitSolution}>Submit solution</button>
              </div>
              {status && <p className="form-note">{status}</p>}
              {testResults && (
                <div className="testcases-card">
                  <h4>Test results</h4>
                  <ul>
                    {testResults.map((result) => (
                      <li key={result.label} style={{ color: result.passed ? "var(--success, #16a34a)" : "var(--danger, #dc2626)" }}>
                        <strong>{result.passed ? "Pass" : "Fail"}</strong>: {result.label}
                        <div style={{ fontSize: "0.9rem", opacity: 0.9, marginTop: 4 }}>{result.details}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {output && <pre className="code-output">{output}</pre>}
              {passed && (
                <div className="profile-ready">
                  <CheckCircle2 size={18} />
                  <span>Certificate access unlocked after passing the challenge.</span>
                </div>
              )}
              {passed && returnTo && (
                <p className="form-note">Coding round complete. Returning to the interview automatically...</p>
              )}
            </>
          )}
        </article>
      </section>
    </main>
  );
}
