import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Mic, Send, Sparkles, Volume2 } from "lucide-react";
import { downloadInterviewReportPdf, saveInterviewReport, type InterviewReportRecord, type InterviewTranscriptEntry } from "../utils/interviewReports";
import ThemeToggle from "../components/ThemeToggle";
import { chatWithAI } from "../services/aiService";
import { getStoredUser } from "../utils/auth";

type InterviewRound = {
    title: string;
    role: string;
    description: string;
    kind: "intro" | "chat" | "coding";
};

type InterviewEvaluation = {
    score: number;
    passed: boolean;
    feedback: string;
    nextQuestion: string;
};

function getRounds(candidateType: "IT" | "Non-IT"): InterviewRound[] {
    if (candidateType === "Non-IT") {
        return [
            { title: "HR Round", role: "HR interviewer", description: "Start with a self-introduction, communication confidence, and motivation for the role.", kind: "intro" },
            { title: "Behavioral Round", role: "HR interviewer", description: "Explore teamwork, conflict handling, ownership, and professional maturity.", kind: "chat" },
            { title: "Functional Round", role: "Domain interviewer", description: "Discuss day-to-day work, domain knowledge, and role expectations.", kind: "chat" },
            { title: "Coding Round", role: "Assessment interviewer", description: "Move to the coding test to evaluate practical problem solving and implementation skill.", kind: "coding" },
            { title: "Final Manager Round", role: "Hiring manager", description: "Close with growth mindset, salary expectations, and fit for the team.", kind: "chat" },
        ];
    }

    return [
        { title: "HR Round", role: "HR interviewer", description: "Introduce yourself clearly and explain your motivation for the opportunity.", kind: "intro" },
        { title: "Technical Round", role: "Technical interviewer", description: "Assess core concepts, practical problem solving, and depth in the stack.", kind: "chat" },
        { title: "Coding Round", role: "Assessment interviewer", description: "Move to the coding test to evaluate practical implementation skill.", kind: "coding" },
        { title: "Behavioral Round", role: "Manager interviewer", description: "Evaluate collaboration, conflict handling, and working style.", kind: "chat" },
        { title: "Final Manager Round", role: "Hiring manager", description: "Discuss growth, leadership potential, and role alignment.", kind: "chat" },
    ];
}

function pickNeutralVoice(voices: SpeechSynthesisVoice[]) {
    const normalized = voices.map((voice) => ({
        voice,
        name: voice.name.toLowerCase(),
        lang: voice.lang.toLowerCase(),
    }));

    const preferredNames = ["zira", "samantha", "aria", "jenny", "victoria", "hazel", "susan", "emma", "olivia", "google us english"];
    const avoidedNames = ["david", "daniel", "mark", "alex", "george", "michael", "tom", "matthew"];

    return (
        normalized.find(({ name }) => preferredNames.some((preferred) => name.includes(preferred)))?.voice ||
        normalized.find(({ name }) => !avoidedNames.some((avoided) => name.includes(avoided)) && /female|woman|girl/.test(name))?.voice ||
        normalized.find(({ lang }) => lang === "en-us")?.voice ||
        normalized.find(({ lang }) => lang.startsWith("en"))?.voice ||
        normalized.find(({ voice }) => voice.default && !avoidedNames.some((avoided) => voice.name.toLowerCase().includes(avoided)))?.voice ||
        null
    );
}

function getRoundQuestion(round: InterviewRound, candidateType: "IT" | "Non-IT") {
    if (round.kind === "intro") {
        return candidateType === "Non-IT"
            ? "Please introduce yourself, tell me about your background, and explain why you are interested in this non-IT role."
            : "Please introduce yourself, summarize your background, and explain why you are interested in this role.";
    }

    if (round.title === "Behavioral Round") {
        return "Tell me about a time you handled a conflict, pressure, or a difficult teammate. What did you do and what happened?";
    }

    if (round.title === "Functional Round") {
        return candidateType === "Non-IT"
            ? "Tell me how you would handle day-to-day work in this role and which skills from your background are most relevant."
            : "Explain the core work you expect to do in this role and the technical strengths you would bring to it.";
    }

    if (round.kind === "coding") {
        return "This round is a coding assessment. Please complete the coding test that opens next.";
    }

    if (round.title === "Final Manager Round") {
        return "Why should we choose you for this role, and how do you see yourself growing here over time?";
    }

    return round.description;
}

function parseEvaluation(text: string, fallbackNextQuestion: string): InterviewEvaluation {
    try {
        const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(cleaned) as Partial<InterviewEvaluation>;
        const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
        const passed = Boolean(parsed.passed ?? score >= 70);
        return {
            score,
            passed,
            feedback: String(parsed.feedback || "Good effort.").trim(),
            nextQuestion: String(parsed.nextQuestion || fallbackNextQuestion).trim(),
        };
    } catch {
        const scoreMatch = text.match(/score\s*[:=]\s*(\d{1,3})/i);
        const score = Math.max(0, Math.min(100, scoreMatch ? Number(scoreMatch[1]) : 0));
        const passed = score >= 70;
        return {
            score,
            passed,
            feedback: text.trim() || "Good effort.",
            nextQuestion: fallbackNextQuestion,
        };
    }
}

const INTERVIEWER_NAME = "Miss BAALA";

export default function AssessmentInterview() {
    const [params] = useSearchParams();
    const testType = params.get("test") || "Assessment";
    const storedUser = getStoredUser();
    const recognitionRef = useRef<any>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const mediaChunksRef = useRef<Blob[]>([]);
    const interviewStartedAtRef = useRef(new Date().toISOString());
    const sessionIdRef = useRef(`${storedUser?.email || "candidate"}-${Date.now()}`);
    const [rounds, setRounds] = useState<InterviewRound[]>([]);
    const [roundIndex, setRoundIndex] = useState(0);
    const [question, setQuestion] = useState("Preparing your first interview question...");
    const [assistantMessage, setAssistantMessage] = useState("Your AI interviewer will guide you through the next five rounds.");
    const [answer, setAnswer] = useState("");
    const [listening, setListening] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [speaking, setSpeaking] = useState(false);
    const [recordingStatus, setRecordingStatus] = useState("Preparing interview recording...");
    const [monitoringLink, setMonitoringLink] = useState<string | null>(null);
    const [recordingReady, setRecordingReady] = useState(false);
    const [liveVideoUrl, setLiveVideoUrl] = useState<string | null>(null);
    const [transcriptEntries, setTranscriptEntries] = useState<InterviewTranscriptEntry[]>([]);
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(null);
    const wasRecordingRef = useRef(false);
    const [showResumePrompt, setShowResumePrompt] = useState(false);
    const navigate = useNavigate();
    const codingComplete = params.get("codingComplete") === "1";
    const requestedRound = Number.parseInt(params.get("round") || "0", 10);
    const canMonitorInterview = Boolean(storedUser && storedUser.role !== "candidate");

    const candidateType = useMemo(() => {
        const text = `${storedUser?.preferredJobRole || ""} ${storedUser?.skills || ""}`.toLowerCase();
        const nonItSignals = ["sales", "marketing", "finance", "hr", "business", "management", "operations", "customer", "support", "retail", "healthcare", "education", "accounting", "administrative", "legal"];
        return nonItSignals.some((signal) => text.includes(signal)) ? "Non-IT" : "IT";
    }, [storedUser?.preferredJobRole, storedUser?.skills]);

    useEffect(() => {
        const nextRounds = getRounds(candidateType);
        setRounds(nextRounds);
        const nextIndex = Number.isFinite(requestedRound) && requestedRound >= 0 && requestedRound < nextRounds.length ? requestedRound : 0;
        setRoundIndex(nextIndex);
        setQuestion(getRoundQuestion(nextRounds[nextIndex], candidateType));
    }, [candidateType, requestedRound]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        if (window.speechSynthesis) {
            const syncVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
            syncVoices();
            window.speechSynthesis.onvoiceschanged = syncVoices;
        }
        const speechRecognitionWindow = window as typeof window & {
            SpeechRecognition?: new () => any;
            webkitSpeechRecognition?: new () => any;
        };
        const SpeechRecognitionCtor = speechRecognitionWindow.SpeechRecognition || speechRecognitionWindow.webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) return;

        const recognition = new SpeechRecognitionCtor();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript.trim();
            if (transcript) {
                setAnswer(transcript);
            }
            setListening(false);
        };
        recognition.onerror = () => {
            setListening(false);
            setError("Voice capture was interrupted. You can still type your answer.");
        };
        recognition.onend = () => setListening(false);
        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
        };
    }, []);

    useEffect(() => {
        const saved = typeof window !== 'undefined' ? window.localStorage.getItem('aethrix_tts_voice') : null;
        if (saved) setSelectedVoiceName(saved);
        else if (availableVoices.length) {
            const auto = pickNeutralVoice(availableVoices as SpeechSynthesisVoice[]);
            if (auto && auto.name) setSelectedVoiceName(auto.name);
        }
    }, [availableVoices]);

    // capture control: start, stop, and resume
    async function stopCapture() {
        try {
            mediaRecorderRef.current?.stop();
        } catch { }
        mediaRecorderRef.current = null;
        const video = videoRef.current;
        const stream = video?.srcObject as MediaStream | null;
        try {
            stream?.getTracks().forEach((track) => track.stop());
        } catch { }
        if (video) video.srcObject = null;

        // If we have captured chunks, prepare a blob and upload it so admins can access partial recordings
        if (mediaChunksRef.current && mediaChunksRef.current.length > 0) {
            try {
                const recordingBlob = new Blob(mediaChunksRef.current, { type: 'video/webm' });
                const recordingUrl = URL.createObjectURL(recordingBlob);
                setLiveVideoUrl(recordingUrl);
                setRecordingStatus('Recording stopped. Uploading partial recording...');
                // attempt upload (base64) to server
                try {
                    await uploadRecording(sessionIdRef.current, recordingBlob);
                    setRecordingStatus('Recording stopped and uploaded (partial).');
                } catch (uploadErr) {
                    console.error('Upload failed', uploadErr);
                    setRecordingStatus('Recording stopped. Upload failed, saved locally.');
                }
            } catch (err) {
                console.error('Finalize recording failed', err);
            }
        } else {
            setRecordingStatus('Recording stopped.');
        }

        // clear collected chunks after handling
        mediaChunksRef.current = [];
        setRecordingReady(false);
    }

    async function uploadRecording(sessionId: string, blob: Blob) {
        // convert blob to base64 (may be large; server accepts up to 50MB for this route)
        const arrayBuffer = await blob.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const slice = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(slice));
        }
        const base64 = btoa(binary);

        const filename = `${sessionId}-${Date.now()}.webm`;
        const resp = await fetch(`/api/interviews/${encodeURIComponent(sessionId)}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, data: base64, candidateEmail: storedUser?.email || null, partial: true }),
        });
        if (!resp.ok) throw new Error('Upload failed');
        const body = await resp.json();
        if (!body?.ok) throw new Error(body?.error || 'Upload failed');
        // optional: store returned URL or notify admin UI
        return body;
    }

    async function startCapture() {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || !videoRef.current) {
            setRecordingStatus("Live video capture is unavailable in this browser.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

            videoRef.current!.srcObject = stream;
            setRecordingReady(true);
            setRecordingStatus("Live camera capture is running. Authorized reviewers can monitor the session.");

            if (typeof MediaRecorder !== "undefined") {
                const recorder = new MediaRecorder(stream);
                mediaRecorderRef.current = recorder;
                mediaChunksRef.current = [];
                recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) mediaChunksRef.current.push(event.data);
                };
                recorder.start();
            }
        } catch {
            setRecordingStatus("Camera permission was not granted. Voice interview remains available.");
        }
    }

    async function resumeCapture() {
        setShowResumePrompt(false);
        await startCapture();
        wasRecordingRef.current = false;
    }

    useEffect(() => {
        let mounted = true;

        void startCapture();

        function handleVisibilityChange() {
            if (document.hidden) {
                const isRecording = Boolean(mediaRecorderRef.current && (mediaRecorderRef.current as any).state === 'recording');
                wasRecordingRef.current = isRecording;
                void stopCapture();
            } else {
                // Auto-resume recording when the user returns if recording was active before
                if (wasRecordingRef.current && mounted) {
                    // attempt to restart capture automatically
                    void startCapture().then(() => { wasRecordingRef.current = false; setRecordingStatus('Recording resumed automatically after return.'); }).catch((err) => {
                        console.warn('Auto-resume failed', err);
                        // fallback to showing resume prompt
                        setShowResumePrompt(true);
                    });
                }
            }
        }

        window.addEventListener('beforeunload', stopCapture);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            mounted = false;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', stopCapture);
            void stopCapture();
        };
    }, []);

    const speakText = (text: string) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = availableVoices.length ? availableVoices : window.speechSynthesis.getVoices();
        let preferredVoice: SpeechSynthesisVoice | null = null;
        if (selectedVoiceName) {
            preferredVoice = voices.find((v) => v.name === selectedVoiceName) || null;
        }
        if (!preferredVoice) preferredVoice = pickNeutralVoice(voices as SpeechSynthesisVoice[]);
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = 1;
        utterance.pitch = 1.18;
        utterance.lang = "en-US";
        setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(utterance);
    };

    function buildReportSummary(entries: InterviewTranscriptEntry[]) {
        const totalWords = entries.reduce((count, entry) => count + entry.answer.split(/\s+/).filter(Boolean).length, 0);
        const passedRounds = entries.filter((entry) => entry.passed).length;
        return `Completed ${entries.length} interview rounds with ${passedRounds} passed rounds and ${totalWords} spoken response words with ${INTERVIEWER_NAME}.`;
    }

    async function evaluateAnswerWithAI(round: InterviewRound, candidateAnswer: string, nextQuestion: string) {
        const scoringPrompt = [
            `You are evaluating a no-human interview round for a ${candidateType} candidate.`,
            `The interviewer must be addressed as ${INTERVIEWER_NAME}.`,
            `Round title: ${round.title}.`,
            `Round kind: ${round.kind}.`,
            `What the round is testing: ${round.description}.`,
            `Candidate answer: ${candidateAnswer}.`,
            "Return strict JSON with keys: score, passed, feedback, nextQuestion.",
            "score must be a whole number from 0 to 100.",
            "passed must be true when the answer is good enough to move forward; use a threshold around 70.",
            "feedback must be one concise sentence about what was strong and what was missing.",
            `nextQuestion must be the next round prompt. Use this exact fallback if needed: ${nextQuestion}`,
            round.kind === "intro"
                ? "For HR intro rounds, score clarity, confidence, self-introduction structure, and motivation."
                : round.title === "Behavioral Round"
                    ? "For behavioral rounds, score STAR structure, conflict handling, ownership, and professionalism."
                    : round.title === "Functional Round"
                        ? "For functional rounds, score domain relevance, practical understanding, and clear examples."
                        : round.title === "Final Manager Round"
                            ? "For final rounds, score role fit, growth mindset, communication, and motivation."
                            : "For coding rounds, score the user's understanding of the coding test handoff and problem solving intent."
        ].join("\n");

        const aiText = await chatWithAI(scoringPrompt);
        return parseEvaluation(aiText, nextQuestion);
    }

    async function finalizeInterviewReport(entries: InterviewTranscriptEntry[]) {
        const completedAt = new Date().toISOString();
        const report: InterviewReportRecord = {
            id: sessionIdRef.current,
            candidateEmail: storedUser?.email || "candidate@example.com",
            candidateName: storedUser?.name || "Candidate",
            candidateType,
            testType,
            startedAt: interviewStartedAtRef.current,
            completedAt,
            rounds: rounds.map((round) => round.title),
            transcript: entries,
            recordingStatus,
            summary: buildReportSummary(entries),
            recommendation: "Review the weakest round in the transcript and repeat the learning path for that area before the next interview.",
            videoAvailable: Boolean(mediaRecorderRef.current || liveVideoUrl),
        };

        saveInterviewReport(report);
        await downloadInterviewReportPdf(report);
    }

    useEffect(() => {
        if (!rounds.length) return;
        if (codingComplete && rounds[roundIndex]?.kind === "coding") {
            const nextRound = rounds[roundIndex + 1];
            if (nextRound) {
                setRoundIndex(roundIndex + 1);
                setQuestion(`Round ${roundIndex + 2} — ${nextRound.title}: ${nextRound.description}`);
            }
        }
    }, [codingComplete, roundIndex, rounds]);

    useEffect(() => {
        if (!rounds.length) return;
        const currentRound = rounds[roundIndex];
        const openingText = currentRound.kind === "intro"
            ? `Hello, I’m ${INTERVIEWER_NAME}, your AI interviewer for the ${testType} assessment. Let’s start with your self-introduction. Please tell me about yourself, your background, and why you are a fit for this role.`
            : currentRound.kind === "coding"
                ? `Round ${roundIndex + 1} — ${currentRound.title}. ${currentRound.description}.`
                : `Round ${roundIndex + 1} — ${currentRound.title}. ${currentRound.description}. Please answer as if you were in a real interview.`;
        setAssistantMessage(openingText);
        speakText(openingText);
    }, [roundIndex, rounds, testType]);

    useEffect(() => {
        if (!storedUser?.email || !canMonitorInterview) return;
        const liveMonitoringUrl = `/admin/interviews?session=${encodeURIComponent(sessionIdRef.current)}`;
        setMonitoringLink(liveMonitoringUrl);
        setRecordingStatus("Live monitoring is active. Authorized reviewers can observe this interview session.");
    }, [storedUser?.email, canMonitorInterview]);

    const startListening = () => {
        if (!recognitionRef.current) {
            setError("Voice input is not supported in this browser. Please type your answer instead.");
            return;
        }

        setError(null);
        setListening(true);
        recognitionRef.current.start();
    };

    const handleSubmitAnswer = async () => {
        const trimmed = answer.trim();
        if (!trimmed) {
            setError("Please answer the question before continuing.");
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const currentRound = rounds[roundIndex];
            const nextRound = rounds[roundIndex + 1];
            if (currentRound.kind === "coding") {
                const returnTo = `/assessment/interview?test=${encodeURIComponent(testType)}&round=${roundIndex + 1}&codingComplete=1`;
                navigate(`/assessment/coding?language=JavaScript&returnTo=${encodeURIComponent(returnTo)}&session=${encodeURIComponent(sessionIdRef.current)}`);
                return;
            }

            const nextQuestion = nextRound ? getRoundQuestion(nextRound, candidateType) : "Thank you, that completes the interview.";
            const evaluation = await evaluateAnswerWithAI(currentRound, trimmed, nextQuestion);
            const currentEntry: InterviewTranscriptEntry = {
                roundTitle: currentRound.title,
                prompt: question,
                answer: trimmed,
                feedback: evaluation.feedback,
                aiReply: `${evaluation.feedback} Next question: ${evaluation.nextQuestion}`,
                score: evaluation.score,
                passed: evaluation.passed,
            };
            const updatedEntries = [...transcriptEntries, currentEntry];
            setTranscriptEntries(updatedEntries);
            setAssistantMessage(`${evaluation.feedback} ${evaluation.passed ? "You passed this round." : "You did not pass this round."}`);
            setQuestion(evaluation.nextQuestion || nextQuestion || `Round ${roundIndex + 2}: ${nextRound?.title || "Interview complete"}`);
            setAnswer("");
            speakText(`Score ${evaluation.score} out of 100. ${evaluation.passed ? "Pass." : "Fail."}`);

            if (!evaluation.passed) {
                setCompleted(true);
                const failText = `You did not pass the ${currentRound.title}. ${INTERVIEWER_NAME} has ended the interview automatically.`;
                setAssistantMessage(failText);
                speakText(failText);
                mediaRecorderRef.current?.stop();
                const video = videoRef.current;
                const stream = video?.srcObject as MediaStream | null;
                stream?.getTracks().forEach((track) => track.stop());
                if (video) video.srcObject = null;
                if (mediaChunksRef.current.length > 0) {
                    const recordingBlob = new Blob(mediaChunksRef.current, { type: "video/webm" });
                    const recordingUrl = URL.createObjectURL(recordingBlob);
                    setLiveVideoUrl(recordingUrl);
                }
                await finalizeInterviewReport(updatedEntries);
                return;
            }

            if (roundIndex >= rounds.length - 1) {
                setCompleted(true);
                const closingText = `Thank you for your time. That completes the ${rounds.length}-round interview. ${INTERVIEWER_NAME} will share a short summary with the recruiter.`;
                setAssistantMessage(closingText);
                speakText(closingText);
                mediaRecorderRef.current?.stop();
                const video = videoRef.current;
                const stream = video?.srcObject as MediaStream | null;
                stream?.getTracks().forEach((track) => track.stop());
                if (video) video.srcObject = null;
                if (mediaChunksRef.current.length > 0) {
                    const recordingBlob = new Blob(mediaChunksRef.current, { type: "video/webm" });
                    const recordingUrl = URL.createObjectURL(recordingBlob);
                    setLiveVideoUrl(recordingUrl);
                }
                await finalizeInterviewReport(updatedEntries);
            } else {
                if (nextRound?.kind === "coding") {
                    const codingIntro = `${INTERVIEWER_NAME} is sending you to the coding round now. Please open the coding test and complete it before returning to continue the interview.`;
                    setAssistantMessage(codingIntro);
                    speakText(codingIntro);
                    setQuestion(`Round ${roundIndex + 2} — ${nextRound.title}: ${nextRound.description}`);
                    return;
                }
                const nextQuestionText = `Round ${roundIndex + 2} — ${nextRound?.title || "Next round"}. ${nextQuestion}`;
                setQuestion(nextQuestionText);
                speakText(nextQuestionText);
                setRoundIndex((value) => value + 1);
            }
        } catch (error) {
            console.error("Interview turn failed", error);
            setError("The AI interviewer is unavailable right now. Please try again shortly.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <Link to="/assessment/test?test=MCQ" className="back-link">
                    <ArrowLeft size={18} />
                    Back to assessment
                </Link>
                <div>
                    <span>AETHRIX AI</span>
                    <h1>AI interview experience</h1>
                    <p>Complete a guided 5-round interview with voice input and voice responses.</p>
                </div>
                <div className="dashboard-actions">
                    <ThemeToggle />
                    <Link to="/candidate" className="ghost-link">
                        Candidate view
                    </Link>
                </div>
            </header>

            <section className="dashboard-grid test-grid">
                <article className="dash-card test-card">
                    <span className="card-kicker">Live interview</span>
                    <h2>{testType} interview flow</h2>
                    <p>This flow starts with an HR round for non-IT candidates, then continues through a five-step interview sequence.</p>
                    <div className="field-summary">
                        <div>
                            <span>Candidate profile</span>
                            <strong>{candidateType}</strong>
                        </div>
                        <div>
                            <span>Rounds</span>
                            <strong>{rounds.length}</strong>
                        </div>
                    </div>
                    <div className="ai-result-block" style={{ marginTop: "1rem" }}>
                        <strong>Recording & monitoring</strong>
                        <p>{recordingStatus}</p>
                        <p>{recordingReady ? "Video recording is active." : "Waiting for camera permission."}</p>
                        {showResumePrompt && (
                            <div className="form-note" style={{ marginTop: 8 }}>
                                <p>Recording was active before you left. Resume recording?</p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" className="primary-cta" onClick={() => void resumeCapture()}>Resume recording</button>
                                    <button type="button" className="secondary-cta" onClick={() => { setShowResumePrompt(false); wasRecordingRef.current = false; }}>Don't resume</button>
                                </div>
                            </div>
                        )}
                        {monitoringLink && canMonitorInterview && (
                            <button type="button" className="secondary-cta" onClick={() => navigate(monitoringLink)} style={{ marginTop: "0.5rem" }}>
                                Open admin monitor
                            </button>
                        )}
                        {liveVideoUrl && (
                            <a href={liveVideoUrl} download={`interview-recording-${storedUser?.email || "candidate"}.webm`} className="primary-cta" style={{ marginTop: "0.5rem", display: "inline-flex" }}>
                                Download video recording
                            </a>
                        )}
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            style={{ width: "100%", marginTop: "0.75rem", borderRadius: "16px", background: "#0b1220", minHeight: "180px" }}
                        />
                        {liveVideoUrl && <p className="form-note">Recorded video ready for download in this session.</p>}
                    </div>
                    <div className="field-checklist">
                        {rounds.map((round, index) => (
                            <div key={round.title} className="field-item">
                                <Sparkles size={16} />
                                <span>{index + 1}. {round.title}</span>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="dash-card test-card">
                    <span className="card-kicker">AI interviewer: {INTERVIEWER_NAME}</span>
                    <h2>Round {Math.min(roundIndex + 1, rounds.length)} of {rounds.length}</h2>
                    <p>{rounds[roundIndex]?.title || "Interview ready"}</p>
                    <div className="ai-result-block" style={{ marginTop: "1rem" }}>
                        <strong>Current prompt</strong>
                        <p>{question}</p>
                    </div>
                    <div className="ai-result-block" style={{ marginTop: "1rem" }}>
                        <strong>AI response</strong>
                        <p>{assistantMessage}</p>
                    </div>

                    <div style={{ marginTop: '0.75rem' }}>
                        <label style={{ display: 'block', marginBottom: 6 }}>
                            <span style={{ display: 'inline-block', marginBottom: 6 }}>Voice</span>
                            <select
                                value={selectedVoiceName || ''}
                                onChange={(e) => {
                                    const name = e.target.value || null;
                                    setSelectedVoiceName(name);
                                    try { if (typeof window !== 'undefined') window.localStorage.setItem('aethrix_tts_voice', name || ''); } catch { }
                                }}
                                style={{ display: 'block', padding: '0.4rem 0.6rem', borderRadius: 6 }}
                            >
                                <option value="">(Auto select female voice)</option>
                                {availableVoices.slice().map((v) => (
                                    <option key={v.name} value={v.name}>{v.name} — {v.lang}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label style={{ display: "block", marginTop: "1rem" }}>
                        <span>Answer aloud or type your response</span>
                        <textarea
                            rows={5}
                            value={answer}
                            onChange={(event) => setAnswer(event.target.value)}
                            placeholder="Speak or type your answer here..."
                        />
                    </label>

                    <div className="assessment-actions" style={{ marginTop: "1rem" }}>
                        <button type="button" className="primary-cta" onClick={startListening} disabled={listening || submitting}>
                            <Mic size={16} />
                            {listening ? "Listening..." : "Speak answer"}
                        </button>
                        <button type="button" className="secondary-cta" onClick={() => void handleSubmitAnswer()} disabled={submitting || !answer.trim()}>
                            <Send size={16} />
                            {submitting ? "Processing..." : completed ? "Finish" : "Submit answer"}
                        </button>
                        <button type="button" className="ghost-link" onClick={() => speakText(question)} disabled={speaking}>
                            <Volume2 size={16} />
                            {speaking ? "Speaking..." : "Hear question"}
                        </button>
                    </div>

                    {error && <p className="form-note error-note">{error}</p>}
                    {completed && <p className="form-note">Interview completed. The AI interviewer has finished the five-round flow and the PDF report has been downloaded.</p>}
                </article>
            </section>
        </main>
    );
}
