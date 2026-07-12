import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { getExamPassed, getStoredUser, setExamPassed } from "../utils/auth";
import { generateQuestionsWithAI } from "../services/aiService";

export default function AssessmentAptitudeCommunication() {
  const storedUser = getStoredUser();

  const [loading, setLoading] = useState(false);
  const [aptitudePrompts, setAptitudePrompts] = useState<string[]>([]);
  const [communicationPrompts, setCommunicationPrompts] = useState<string[]>([]);
  const [aptitudeAnswers, setAptitudeAnswers] = useState<string[]>([]);
  const [communicationAnswers, setCommunicationAnswers] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [passed, setPassed] = useState(getExamPassed(storedUser?.email));
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setSubmitted(false);
    setLoadError(null);
    try {
      const result = await generateQuestionsWithAI({
        type: "aptitude",
        userSeed: `${storedUser?.email ?? "guest"}-aptitude-${Date.now()}`,
        aptitudeCount: 10,
        communicationCount: 10,
      });
      const apt = result.aptitude ?? [];
      const comm = result.communication ?? [];
      setAptitudePrompts(apt);
      setCommunicationPrompts(comm);
      setAptitudeAnswers(Array(apt.length).fill(""));
      setCommunicationAnswers(Array(comm.length).fill(""));
    } catch {
      setLoadError("Failed to load AI prompts. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }, [storedUser?.email]);

  useEffect(() => {
    void loadPrompts();
    setPassed(getExamPassed(storedUser?.email));
  }, [loadPrompts, storedUser?.email]);

  function submit() {
    setSubmitted(true);
    const allApt = aptitudeAnswers.every((a) => a.trim().length > 0);
    const allComm = communicationAnswers.every((a) => a.trim().length > 0);
    if (allApt && allComm && storedUser?.email) {
      setExamPassed(storedUser.email);
      setPassed(true);
    }
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link to="/assessment" className="back-link"><ArrowLeft size={18} />Back to hub</Link>
        <div>
          <span>AETHRIX AI</span>
          <h1>Aptitude & Communication</h1>
          <p>AI generates unique questions for every candidate.</p>
        </div>
        <div className="dashboard-actions">
          <ThemeToggle />
          <Link to="/candidate" className="ghost-link">Candidate profile</Link>
        </div>
      </header>

      <section className="dashboard-grid test-grid">
        {loading && (
          <article className="dash-card test-card grid-span-full">
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "var(--teal)" }}>
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              Generating your unique questions…
            </div>
          </article>
        )}

        {!loading && loadError && (
          <article className="dash-card test-card grid-span-full">
            <p className="form-note" style={{ color: "#ff9aa5" }}>{loadError}</p>
            <button type="button" className="secondary-cta" onClick={() => void loadPrompts()}>Retry</button>
          </article>
        )}

        {!loading && aptitudePrompts.length > 0 && (
          <>
            <article className="dash-card test-card grid-span-full">
              <span className="card-kicker">Aptitude — AI generated</span>
              <h2>Problem solving</h2>
              <p>Answer the aptitude questions below to demonstrate your numerical reasoning.</p>
              {aptitudePrompts.map((prompt, index) => (
                <div key={index} className="communication-card">
                  <p><strong>{index + 1}. {prompt}</strong></p>
                  <textarea
                    rows={3}
                    value={aptitudeAnswers[index] ?? ""}
                    onChange={(e) => {
                      const next = [...aptitudeAnswers];
                      next[index] = e.target.value;
                      setAptitudeAnswers(next);
                    }}
                  />
                </div>
              ))}
            </article>

            <article className="dash-card test-card">
              <span className="card-kicker">Communication — AI generated</span>
              <h2>Written responses</h2>
              <p>Write professional responses to the prompts below.</p>
              {communicationPrompts.map((prompt, index) => (
                <div key={index} className="communication-card">
                  <p><strong>{index + 1}. {prompt}</strong></p>
                  <textarea
                    rows={4}
                    value={communicationAnswers[index] ?? ""}
                    onChange={(e) => {
                      const next = [...communicationAnswers];
                      next[index] = e.target.value;
                      setCommunicationAnswers(next);
                    }}
                  />
                </div>
              ))}
              <div className="assessment-actions">
                <button type="button" className="secondary-cta" onClick={() => void loadPrompts()}>Regenerate questions</button>
                <button type="button" className="primary-cta" onClick={submit}>Submit responses</button>
              </div>
              {submitted && (
                <div className="submission-result">
                  <div className="profile-ready">
                    <CheckCircle2 size={18} />
                    <span>Responses submitted. Review and refine for clarity.</span>
                  </div>
                  {passed && (
                    <div className="profile-ready">
                      <CheckCircle2 size={18} />
                      <span>All answers complete. Certificate access unlocked.</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          </>
        )}
      </section>
    </main>
  );
}
