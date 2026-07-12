import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpenCheck, BrainCircuit, CheckCircle2, FileText, Send, Sparkles, Target, WandSparkles } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import WelcomeMessage from "../components/WelcomeMessage";
import CertificateQR from "../components/CertificateQR";
import SessionCertificates from "../components/SessionCertificates";
import DashboardProfileCard from "../components/DashboardProfileCard";
import { ensureCertificateMeta, getCertificateMeta, getExamPassed, getStoredUser, clearStoredUser, type CertificateRecord } from "../utils/auth";
import {
  analyzeResumeWithAI,
  chatWithAI,
  generateCandidateFitReportWithAI,
  generateLearningPathWithAI,
  rewriteResumeWithAI,
  runMockInterviewWithAI,
  type CandidateFitReport,
  type LearningPathResult,
  type MockInterviewResult,
  type ResumeAnalysisResult,
  type ResumeRewriteResult,
} from "../services/aiService";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const logoUrl = "/robo.png";
const certificateTemplateUrl = "/certificate-template.png";
const certificateFontUrl = "/certificate-template-font.ttf";
const certificateTitle = "Certificate of Completion";
const certificateProgramName = "AETHRIX AI Assessment & Training Program";

const steps = ["Profile completed", "Resume analyzed", "Recruiter review", "Interview pending"];

const requiredProfileFields = [
  "Full Name",
  "Email",
  "Phone",
  "Date of Birth",
  "Gender",
  "Address",
  "Education",
  "University",
  "Graduation Year",
  "Experience",
  "Skills",
  "Resume",
  "LinkedIn",
  "GitHub",
  "Portfolio",
  "Preferred Job Role",
  "Preferred Location",
];

function getResumeSuggestionContext(resumeAnalysis: ResumeAnalysisResult | null, jobDescriptionText: string) {
  const combinedText = [
    resumeAnalysis?.summary || "",
    resumeAnalysis?.matchedKeywords?.join(" ") || "",
    resumeAnalysis?.missingKeywords?.join(" ") || "",
    jobDescriptionText,
  ]
    .join(" ")
    .toLowerCase();

  const itSignals = [
    "software",
    "developer",
    "engineering",
    "programming",
    "react",
    "node",
    "python",
    "java",
    "sql",
    "api",
    "cloud",
    "data",
    "ai",
    "machine learning",
    "cyber",
    "testing",
    "frontend",
    "backend",
    "full stack",
  ];
  const nonItSignals = [
    "sales",
    "marketing",
    "finance",
    "hr",
    "business",
    "management",
    "operations",
    "customer",
    "support",
    "retail",
    "healthcare",
    "education",
    "accounting",
    "administrative",
    "legal",
  ];
  const courseSignals = ["course", "certificate", "training", "diploma", "internship", "academic", "curriculum"];
  const nonItSkillSignals = ["aptitude", "technical", "reasoning", "verbal", "communication"];

  const isItFocused = itSignals.some((signal) => combinedText.includes(signal));
  const isNonItFocused = nonItSignals.some((signal) => combinedText.includes(signal));
  const hasNonItSkillSignals = nonItSkillSignals.some((signal) => combinedText.includes(signal));
  const isCourseFocused = courseSignals.some((signal) => combinedText.includes(signal));

  if (isItFocused && !isNonItFocused) {
    return {
      label: "IT-focused profile",
      prompt: "This resume looks IT-focused. Give one concise profile improvement suggestion for a candidate targeting an IT role. Focus on technical keywords, project evidence, and practical next steps.",
    };
  }

  if ((isNonItFocused || hasNonItSkillSignals) && !isItFocused) {
    return {
      label: "Non-IT profile",
      prompt: "This resume looks non-IT focused. Give one concise profile improvement suggestion for a candidate targeting a non-IT role. Focus on aptitude, technical reasoning, verbal communication, and strong impact statements. Keep coding as the exception unless the role specifically asks for it.",
    };
  }

  if (isCourseFocused) {
    return {
      label: "Course-based profile",
      prompt: "This resume looks course-oriented. Give one concise profile improvement suggestion for a candidate with a course-based background. Focus on certification strength, practical projects, and role-fit positioning.",
    };
  }

  return {
    label: "General profile",
    prompt: "Give one concise profile improvement suggestion for a candidate dashboard user. Focus on resume metrics, project impact, or role fit.",
  };
}

export default function CandidateDashboard() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeScore, setResumeScore] = useState<number | null>(null);
  const [resumeMessage, setResumeMessage] = useState("Upload a PDF or DOCX to get an instant AI score.");
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysisResult | null>(null);
  const [resumeAnalyzing, setResumeAnalyzing] = useState(false);
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [jobDescriptionFileName, setJobDescriptionFileName] = useState<string | null>(null);
  const [jobDescriptionError, setJobDescriptionError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [assistantResponse, setAssistantResponse] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [resumeRewrite, setResumeRewrite] = useState<ResumeRewriteResult | null>(null);
  const [resumeRewriteLoading, setResumeRewriteLoading] = useState(false);
  const [interview, setInterview] = useState<MockInterviewResult | null>(null);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [fitReport, setFitReport] = useState<CandidateFitReport | null>(null);
  const [fitLoading, setFitLoading] = useState(false);
  const [learningPath, setLearningPath] = useState<LearningPathResult | null>(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [learningGoal, setLearningGoal] = useState("Improve the skills needed for my target role");
  const [examPassed, setExamPassedState] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [certificateData, setCertificateData] = useState<CertificateRecord | null>(null);
  const storedUser = getStoredUser();
  const navigate = useNavigate();
  function handleSignOut() {
    clearStoredUser();
    navigate("/login");
  }

  useEffect(() => {
    setExamPassedState(getExamPassed(storedUser?.email));
    if (storedUser?.email) {
      const cert = getCertificateMeta(storedUser.email);
      setCertificateData(cert);
    }
  }, [storedUser?.email]);

  useEffect(() => {
    function handleAuthChange() {
      const user = getStoredUser();
      setExamPassedState(getExamPassed(user?.email));
      setCertificateData(user?.email ? getCertificateMeta(user.email) : null);
    }

    window.addEventListener("aethrix-auth-change", handleAuthChange);
    return () => window.removeEventListener("aethrix-auth-change", handleAuthChange);
  }, []);

  const certificateReady = examPassed;

  async function loadCertificateFont(pdfDoc: PDFDocument) {
    try {
      const response = await fetch(certificateFontUrl);
      if (!response.ok) return null;
      const fontBytes = await response.arrayBuffer();
      return await pdfDoc.embedFont(fontBytes);
    } catch {
      return null;
    }
  }

  async function downloadCertificate() {
    setDownloadError(null);
    setDownloading(true);
    try {
      const user = storedUser ?? { name: "Candidate", email: "candidate@aethrix.ai" };
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([842, 595]);
      await loadCertificateFont(pdfDoc);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      const { width, height } = page.getSize();

      const accent = rgb(0.93, 0.74, 0.22);
      const frame = rgb(0.08, 0.14, 0.24);
      let templateUsed = false;

      const templateResponse = await fetch(certificateTemplateUrl);
      if (templateResponse.ok) {
        const templateBytes = await templateResponse.arrayBuffer();
        const templateImage = certificateTemplateUrl.endsWith(".png")
          ? await pdfDoc.embedPng(templateBytes)
          : await pdfDoc.embedJpg(templateBytes);
        page.drawImage(templateImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
        templateUsed = true;
      }

      if (!templateUsed) {
        page.drawRectangle({
          x: 20,
          y: 20,
          width: width - 40,
          height: height - 40,
          borderColor: frame,
          borderWidth: 10,
          color: rgb(1, 1, 1),
        });

        page.drawRectangle({
          x: 40,
          y: height - 170,
          width: width - 80,
          height: 120,
          color: rgb(0.03, 0.16, 0.32),
        });

        page.drawText("AETHRIX AI", {
          x: 55,
          y: height - 88,
          size: 30,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        page.drawText(certificateTitle, {
          x: 55,
          y: height - 112,
          size: 10,
          font: helveticaFont,
          color: rgb(0.76, 0.84, 0.96),
        });

        page.drawRectangle({
          x: width - 210,
          y: height - 148,
          width: 150,
          height: 70,
          color: accent,
          borderColor: rgb(0.74, 0.52, 0.08),
          borderWidth: 1.5,
        });

        page.drawText("VERIFIED", {
          x: width - 190,
          y: height - 110,
          size: 14,
          font: helveticaBold,
          color: rgb(0.12, 0.16, 0.22),
        });

        page.drawText("PREMIUM", {
          x: width - 190,
          y: height - 126,
          size: 9,
          font: helveticaFont,
          color: rgb(0.12, 0.16, 0.22),
        });

        page.drawEllipse({
          x: width / 2,
          y: height / 2 + 120,
          xScale: 178,
          yScale: 178,
          color: rgb(0.06, 0.18, 0.34),
          opacity: 0.08,
        });

        const response = await fetch(logoUrl);
        if (!response.ok) throw new Error(`Failed to load certificate image: ${response.status}`);
        const logoBytes = await response.arrayBuffer();
        const logoImage = logoUrl.endsWith(".png")
          ? await pdfDoc.embedPng(logoBytes)
          : await pdfDoc.embedJpg(logoBytes);
        const logoDims = logoImage.scale(0.18);

        page.drawImage(logoImage, {
          x: width / 2 - logoDims.width / 2,
          y: height / 2 + 104 - logoDims.height / 2,
          width: logoDims.width,
          height: logoDims.height,
          opacity: 0.14,
        });
      }

      const nameSize = 36;
      const userNameWidth = timesRomanBold.widthOfTextAtSize(user.name, nameSize);
      const bodyText = `has successfully completed the ${certificateProgramName}, including course assessment and training program requirements.`;
      const contentX = 72;
      const bodyX = 96;
      const bodyMaxWidth = width - 144;

      if (!templateUsed) {
        page.drawText("This is to certify that", {
          x: contentX,
          y: height / 2 + 64,
          size: 12,
          font: helveticaFont,
          color: rgb(0.28, 0.34, 0.42),
        });

        page.drawText(user.name, {
          x: (width - userNameWidth) / 2,
          y: height / 2 + 20,
          size: 34,
          font: helveticaBold,
          color: rgb(0.06, 0.12, 0.24),
        });

        page.drawText(bodyText, {
          x: bodyX,
          y: height / 2 - 25,
          size: 12,
          font: helveticaFont,
          color: rgb(0.18, 0.26, 0.34),
          maxWidth: bodyMaxWidth,
          lineHeight: 18,
        });
      } else {
        page.drawText(user.name, {
          x: (width - userNameWidth) / 2,
          y: height / 2 - 2,
          size: nameSize,
          font: timesRomanBold,
          color: rgb(0.08, 0.12, 0.22),
        });
      }

      const certificateMeta = storedUser?.email ? ensureCertificateMeta(storedUser.email) : null;
      const certificateId = certificateMeta?.id ?? `AETHX-${String(Date.now()).slice(-8)}`;
      const issuedDate = certificateMeta?.issuedAt ? new Date(certificateMeta.issuedAt).toLocaleDateString() : new Date().toLocaleDateString();
      const detailY = 100;
      if (templateUsed) {
        const templateIdX = 85;
        const issuedX = width - 100;
        const issuedY = 160;

        page.drawText("Certificate ID:", {
          x: templateIdX,
          y: detailY,
          size: 9,
          font: timesRoman,
          color: rgb(0.08, 0.12, 0.22),
        });

        page.drawText(certificateId, {
          x: templateIdX,
          y: detailY - 12,
          size: 10,
          font: timesRomanBold,
          color: rgb(0.08, 0.12, 0.22),
        });

        page.drawText("Issued on:", {
          x: issuedX,
          y: issuedY,
          size: 9,
          font: timesRoman,
          color: rgb(0.06, 0.12, 0.22),
        });

        page.drawText(issuedDate, {
          x: issuedX,
          y: issuedY - 12,
          size: 10,
          font: timesRomanBold,
          color: rgb(0.06, 0.12, 0.22),
        });
      } else {
        const issuedX = contentX + 240;

        page.drawText("Certificate ID:", {
          x: contentX,
          y: detailY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.20, 0.24, 0.30),
        });

        page.drawText(certificateId, {
          x: 145,
          y: detailY,
          size: 10,
          font: helveticaBold,
          color: rgb(0.06, 0.12, 0.24),
        });

        page.drawText("Issued on:", {
          x: issuedX,
          y: detailY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.20, 0.24, 0.30),
        });

        page.drawText(issuedDate, {
          x: issuedX + 68,
          y: detailY,
          size: 10,
          font: helveticaBold,
          color: rgb(0.06, 0.12, 0.24),
        });
      }

      if (!templateUsed) {
        const signatureText = "Sree Ganesh Yarraballi";
        page.drawText(signatureText, {
          x: width - 260,
          y: 180,
          size: 16,
          font: helveticaBold,
          color: rgb(0.08, 0.16, 0.28),
        });

        page.drawText("CEO, AETHRIX AI", {
          x: width - 260,
          y: 165,
          size: 10,
          font: helveticaFont,
          color: rgb(0.20, 0.24, 0.30),
        });

        page.drawText("AETHRIX AI x JobWayTech | Premium Certificate", {
          x: 72,
          y: 60,
          size: 9,
          font: helveticaFont,
          color: rgb(0.42, 0.48, 0.56),
        });

        page.drawLine({
          start: { x: 72, y: 52 },
          end: { x: width - 72, y: 52 },
          thickness: 0.8,
          color: rgb(0.82, 0.74, 0.52),
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${user.name.replace(/\s+/g, "_")}_Aethrix_Certificate.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Certificate download failed", error);
      setDownloadError("Unable to generate the certificate. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleResumeUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setResumeFile(null);
      setResumeScore(null);
      setResumeMessage("Upload a PDF or DOCX to get an instant AI score.");
      setResumeAnalysis(null);
      return;
    }

    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) {
      setResumeFile(null);
      setResumeScore(null);
      setResumeAnalysis(null);
      setResumeMessage("Only PDF or DOCX resumes are accepted.");
      return;
    }

    setResumeFile(file);
    setResumeAnalyzing(true);
    setResumeMessage(jobDescriptionText.trim() ? `Analyzing ${file.name} against the job description...` : `Analyzing ${file.name} with AI...`);
    setResumeAnalysis(null);

    try {
      const analysis = await analyzeResumeWithAI(file, jobDescriptionText.trim() || undefined);
      setResumeScore(analysis.score);
      setResumeAnalysis(analysis);
      setResumeMessage(jobDescriptionText.trim() ? `AI resume review complete for ${file.name} against your job description.` : `AI resume review complete for ${file.name}.`);
    } catch (error) {
      console.error("AI resume analysis failed", error);
      setResumeScore(null);
      setResumeAnalysis(null);
      setResumeMessage("AI resume analysis is unavailable right now. Please try again in a moment.");
    } finally {
      setResumeAnalyzing(false);
    }
  }

  async function handleJobDescriptionUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setJobDescriptionText("");
      setJobDescriptionFileName(null);
      setJobDescriptionError(null);
      return;
    }

    const allowedTypes = ["text/plain", "text/markdown", "application/json"];
    const isTextFile = allowedTypes.includes(file.type) || /\.(txt|md|json)$/i.test(file.name);
    if (!isTextFile) {
      setJobDescriptionText("");
      setJobDescriptionFileName(null);
      setJobDescriptionError("Please upload a plain text job description file such as .txt or .md.");
      return;
    }

    try {
      const text = await file.text();
      setJobDescriptionText(text.trim());
      setJobDescriptionFileName(file.name);
      setJobDescriptionError(null);
      setResumeMessage(`Loaded job description from ${file.name}. Upload your resume to score it.`);
    } catch (error) {
      console.error("Job description file read failed", error);
      setJobDescriptionText("");
      setJobDescriptionFileName(null);
      setJobDescriptionError("Unable to read the uploaded job description file.");
    }
  }

  async function applyAiSuggestion() {
    setSuggestion("Thinking...");
    try {
      const suggestionContext = getResumeSuggestionContext(resumeAnalysis, jobDescriptionText);
      const response = await chatWithAI(
        `${suggestionContext.prompt} Keep it short, practical, and tailored to a ${suggestionContext.label.toLowerCase()} candidate.`
      );
      setSuggestion(`${suggestionContext.label}: ${response}`);
    } catch (error) {
      console.error("AI suggestion failed", error);
      setSuggestion("AI suggestions are unavailable right now. Please try again in a moment.");
    }
  }

  async function askAiAssistant() {
    setAssistantLoading(true);
    setAssistantResponse("Thinking...");
    try {
      const response = await chatWithAI(
        "You are an AI career coach for a candidate dashboard user. Provide a concise profile improvement answer with practical next steps."
      );
      setAssistantResponse(response);
    } catch (error) {
      console.error("AI assistant failed", error);
      setAssistantResponse("AI assistant is unavailable right now. Please try again in a moment.");
    } finally {
      setAssistantLoading(false);
    }
  }

  async function handleResumeRewrite() {
    setResumeRewriteLoading(true);
    try {
      const result = await rewriteResumeWithAI({
        role: storedUser?.preferredJobRole || "target role",
        skills: storedUser?.skills || "",
        resumeSummary: resumeAnalysis?.summary || storedUser?.resume || "",
      });
      setResumeRewrite(result);
    } catch (error) {
      console.error("Resume rewrite failed", error);
      setResumeRewrite({
        headline: "Resume rewrite unavailable",
        bullets: ["Try again after the AI service is reachable."],
        keywords: ["resume", "impact", "role fit"],
      });
    } finally {
      setResumeRewriteLoading(false);
    }
  }

  async function handleMockInterview() {
    setInterviewLoading(true);
    try {
      const result = await runMockInterviewWithAI({
        role: storedUser?.preferredJobRole || "candidate",
        skills: storedUser?.skills || "",
        answer: interviewAnswer,
        lastQuestion: interview?.question,
      });
      setInterview(result);
      setInterviewAnswer("");
    } catch (error) {
      console.error("Mock interview failed", error);
      setInterview({
        question: "Tell me about a project where you solved a hard problem.",
        feedback: "The AI interviewer is unavailable. Use the STAR format: situation, task, action, result.",
        score: 0,
        nextQuestion: "What would you improve next time?",
      });
    } finally {
      setInterviewLoading(false);
    }
  }

  async function handleFitReport() {
    setFitLoading(true);
    try {
      const result = await generateCandidateFitReportWithAI({
        role: storedUser?.preferredJobRole || "target role",
        profile: storedUser,
      });
      setFitReport(result);
    } catch (error) {
      console.error("Fit report failed", error);
    } finally {
      setFitLoading(false);
    }
  }

  async function handleLearningPath() {
    setLearningLoading(true);
    try {
      const result = await generateLearningPathWithAI({
        role: storedUser?.preferredJobRole || "target role",
        weakArea: resumeAnalysis?.missingKeywords?.[0] || resumeAnalysis?.recommendation || "assessment readiness",
        profile: storedUser,
        resumeSummary: resumeAnalysis?.summary || storedUser?.bio || storedUser?.headline || "",
        resumeSkills: storedUser?.skills || "",
        developmentGoal: learningGoal,
        jobDescription: jobDescriptionText,
        missingKeywords: resumeAnalysis?.missingKeywords || [],
      });
      setLearningPath(result);
    } catch (error) {
      console.error("Learning path failed", error);
    } finally {
      setLearningLoading(false);
    }
  }

  return (
    <main className="dashboard-page">
      <DashboardHeader title="Candidate workspace" subtitle="Track your applications and keep your profile ready." onSignOut={handleSignOut} />
      <WelcomeMessage />

      <section className="dashboard-grid candidate-layout">
        <article className="dash-card profile-card">
          <span className="card-kicker">Profile strength</span>
          <strong>86%</strong>
          <p>Your resume is clear, but adding project impact metrics can improve matching.</p>
          <div className="dashboard-action-row">
            <Link to="/profile/complete?return=/candidate" className="primary-cta">
              <FileText size={18} />
              Complete profile details
            </Link>
          </div>
        </article>

        <DashboardProfileCard />

        <article className="dash-card resume-card">
          <span className="card-kicker">Resume upload</span>
          <h2>Upload your resume</h2>
          <p>Upload a PDF or DOCX resume and get an instant AI score to improve your profile.</p>
          <label className="resume-upload-button">
            <input
              type="file"
              accept=".pdf,.docx"
              onChange={handleResumeUpload}
              hidden
            />
            <FileText size={18} />
            Select resume file
          </label>
          <label className="resume-upload-button" style={{ marginTop: "10px" }}>
            <input
              type="file"
              accept=".txt,.md,.json"
              onChange={handleJobDescriptionUpload}
              hidden
            />
            <FileText size={18} />
            Upload job description
          </label>
          <textarea
            className="ai-textarea"
            rows={5}
            value={jobDescriptionText}
            onChange={(event) => {
              setJobDescriptionText(event.target.value);
              setJobDescriptionError(null);
            }}
            placeholder="Paste the target job description here, or upload a text file."
          />
          {jobDescriptionFileName && (
            <div className="resume-summary">
              <strong>{jobDescriptionFileName}</strong>
              <span>Loaded for ATS matching</span>
            </div>
          )}
          {jobDescriptionError && <p className="form-note error-note">{jobDescriptionError}</p>}
          {resumeFile && (
            <div className="resume-summary">
              <strong>{resumeFile.name}</strong>
              <span>{(resumeFile.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
          <div className="resume-score-block">
            <span>{resumeMessage}</span>
            {resumeScore !== null && (
              <div className="resume-score-meter">
                <div className="resume-score-fill" style={{ width: `${resumeScore}%` }} />
              </div>
            )}
            {resumeScore !== null && <strong className="resume-score-value">{resumeScore}% AI score</strong>}
            {resumeAnalyzing && <p className="form-note">Analyzing resume, please wait...</p>}
            {resumeAnalysis && (
              <div className="resume-analysis-summary">
                <strong>Summary</strong>
                <p>{resumeAnalysis.summary}</p>
                <strong>Recommendation</strong>
                <p>{resumeAnalysis.recommendation}</p>
                <div className="ats-score-panel">
                  <div className="ai-score-row">
                    <strong>ATS score</strong>
                    <span>{resumeAnalysis.atsScore}%</span>
                  </div>
                  <div className="ai-score-meter">
                    <i style={{ width: `${resumeAnalysis.atsScore}%` }} />
                  </div>
                  <div className="ai-score-row ats-keyword-row">
                    <strong>Keyword match</strong>
                    <span>{resumeAnalysis.keywordMatch}%</span>
                  </div>
                  <div className="ai-score-meter">
                    <i style={{ width: `${resumeAnalysis.keywordMatch}%` }} />
                  </div>
                </div>
                {resumeAnalysis.matchedKeywords.length > 0 && (
                  <>
                    <strong>Matched ATS keywords</strong>
                    <div className="ai-chip-row">
                      {resumeAnalysis.matchedKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
                    </div>
                  </>
                )}
                {resumeAnalysis.missingKeywords.length > 0 && (
                  <>
                    <strong>Missing keywords</strong>
                    <div className="ai-chip-row ai-chip-row--warning">
                      {resumeAnalysis.missingKeywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
                    </div>
                  </>
                )}
                {resumeAnalysis.atsIssues.length > 0 && (
                  <>
                    <strong>ATS improvements</strong>
                    <ul className="ats-issue-list">
                      {resumeAnalysis.atsIssues.map((issue) => <li key={issue}>{issue}</li>)}
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        </article>

        <article className="dash-card">
          <span className="card-kicker">Application status</span>
          <h2>Product Designer</h2>
          <div className="status-list">
            {steps.map((step, index) => (
              <span key={step} className={index < 3 ? "done" : ""}>
                <CheckCircle2 size={17} />
                {step}
              </span>
            ))}
          </div>
        </article>

        <article className="dash-card action-card">
          <Sparkles size={24} />
          <h2>AI suggestion</h2>
          <p>Highlight your dashboard and analytics work for stronger fit against active design roles.</p>
          <button type="button" className="primary-cta" onClick={() => void applyAiSuggestion()}>
            <Send size={18} />
            Apply suggestion
          </button>
          {suggestion && <p className="form-note">{suggestion}</p>}
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <WandSparkles size={22} />
            <div>
              <span className="card-kicker">AI resume rewrite</span>
              <h2>Upgrade your profile language</h2>
            </div>
          </div>
          <p>Turn your resume signals into stronger role-focused bullets and keywords.</p>
          <button type="button" className="primary-cta" onClick={() => void handleResumeRewrite()} disabled={resumeRewriteLoading}>
            <WandSparkles size={18} />
            {resumeRewriteLoading ? "Rewriting..." : "Rewrite resume"}
          </button>
          {resumeRewrite && (
            <div className="ai-result-block">
              <strong>{resumeRewrite.headline}</strong>
              <ul>
                {resumeRewrite.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
              <div className="ai-chip-row">
                {resumeRewrite.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
              </div>
            </div>
          )}
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <BrainCircuit size={22} />
            <div>
              <span className="card-kicker">AI mock interview</span>
              <h2>Practice one answer</h2>
            </div>
          </div>
          <p>{interview?.question || "Generate a role-based question, answer it, then get scored feedback."}</p>
          <textarea
            className="ai-textarea"
            rows={5}
            value={interviewAnswer}
            onChange={(event) => setInterviewAnswer(event.target.value)}
            placeholder="Write your answer here"
          />
          <button type="button" className="primary-cta" onClick={() => void handleMockInterview()} disabled={interviewLoading}>
            <BrainCircuit size={18} />
            {interviewLoading ? "Reviewing..." : interview ? "Score answer" : "Start interview"}
          </button>
          <button type="button" className="secondary-cta" onClick={() => navigate(`/assessment/interview?test=${encodeURIComponent("Student Dashboard")}`)} style={{ marginTop: "0.75rem" }}>
            Start full AI interview
          </button>
          {interview && (
            <div className="ai-result-block">
              <div className="ai-score-row">
                <strong>Score</strong>
                <span>{interview.score}/100</span>
              </div>
              <div className="ai-score-meter">
                <i style={{ width: `${interview.score}%` }} />
              </div>
              <p>{interview.feedback}</p>
              <p><strong>Next:</strong> {interview.nextQuestion}</p>
            </div>
          )}
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <Target size={22} />
            <div>
              <span className="card-kicker">AI fit report</span>
              <h2>Candidate fit summary</h2>
            </div>
          </div>
          <p>Generate a recruiter-style readout from your profile, skills, and assessment status.</p>
          <button type="button" className="primary-cta" onClick={() => void handleFitReport()} disabled={fitLoading}>
            <Sparkles size={18} />
            {fitLoading ? "Generating..." : "Generate fit report"}
          </button>
          {fitReport && (
            <div className="ai-result-block ai-fit-report">
              <div className="ai-score-row">
                <strong>Role fit</strong>
                <span>{fitReport.fitScore}%</span>
              </div>
              <div className="ai-score-meter">
                <i style={{ width: `${fitReport.fitScore}%` }} />
              </div>
              <p>{fitReport.summary}</p>
              <div className="ai-two-column">
                <div>
                  <span>Strengths</span>
                  {fitReport.strengths.map((item) => <p key={item}>{item}</p>)}
                </div>
                <div>
                  <span>Risks</span>
                  {fitReport.risks.map((item) => <p key={item}>{item}</p>)}
                </div>
              </div>
              <p>{fitReport.recommendation}</p>
            </div>
          )}
        </article>

        <article className="dash-card ai-feature-card">
          <div className="ai-feature-heading">
            <BookOpenCheck size={22} />
            <div>
              <span className="card-kicker">AI learning path</span>
              <h2>Personal training plan</h2>
            </div>
          </div>
          <p>Build a four-week plan from your resume gaps, target role, and the skill you want to improve.</p>
          <label className="ai-textarea-label" style={{ display: "block", marginBottom: "0.75rem" }}>
            <span>What do you want to develop?</span>
            <textarea
              className="ai-textarea"
              rows={3}
              value={learningGoal}
              onChange={(event) => setLearningGoal(event.target.value)}
              placeholder="Example: React fundamentals, communication, aptitude, project confidence"
            />
          </label>
          <button type="button" className="primary-cta" onClick={() => void handleLearningPath()} disabled={learningLoading}>
            <BookOpenCheck size={18} />
            {learningLoading ? "Planning..." : "Create learning path"}
          </button>
          {learningPath && (
            <div className="ai-result-block">
              <strong>{learningPath.title}</strong>
              <p>Focus: {learningPath.focus}</p>
              <p>Based on: {resumeAnalysis?.summary || storedUser?.skills || "your current resume"}</p>
              {learningPath.weeks.map((week) => (
                <div className="ai-week-row" key={week.week}>
                  <span>Week {week.week}</span>
                  <p><strong>{week.goal}</strong> {week.task}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dash-card certificate-card">
          <span className="card-kicker">Certificate download</span>
          <h2>Your completion certificate</h2>
          <p>Download your AETHRIX AI certificate co-branded with Inventra.</p>

          {certificateReady && certificateData && (
            <div className="certificate-qr-wrap">
              <CertificateQR certificate={certificateData} />
            </div>
          )}

          {certificateReady && certificateData && (
            <div className="certificate-summary-card">
              <div className="certificate-summary-grid">
                <div>
                  <span>Exam</span>
                  <p>{certificateData.examName}</p>
                  <span>Type</span>
                  <p>{certificateData.examType}</p>
                </div>
                <div>
                  <span>Score</span>
                  <strong>{certificateData.score}/{certificateData.totalScore}</strong>
                  <span>Grade</span>
                  <strong>{certificateData.grade}</strong>
                </div>
              </div>
            </div>
          )}

          <button className="primary-cta" type="button" disabled={!certificateReady || downloading} onClick={downloadCertificate}>
            <FileText size={18} />
            {downloading ? "Preparing certificate..." : "Download certificate"}
          </button>
          {!certificateReady && (
            <p className="form-note">You must pass the exam before downloading your professional AETHRIX AI certificate.</p>
          )}
          {downloadError && <p className="form-note error-note">{downloadError}</p>}
        </article>

        <SessionCertificates email={storedUser?.email} />

        <article className="dash-card profile-required-card">
          <span className="card-kicker">Required profile sections</span>
          <h2>Complete these sections before assessment</h2>
          <div className="profile-field-grid">
            {requiredProfileFields.map((field) => (
              <span className="profile-field-pill" key={field}>
                {field}
              </span>
            ))}
          </div>
        </article>

        <article className="dash-card action-card">
          <span className="card-kicker">AI coach</span>
          <h2>Improve your profile score</h2>
          <p>Get tips for clarity, metrics, and role match strength across your applications.</p>
          <button type="button" className="primary-cta" onClick={() => void askAiAssistant()} disabled={assistantLoading}>
            <Send size={18} />
            Ask Assistant
          </button>
          {assistantResponse && <p className="form-note">{assistantResponse}</p>}
        </article>
      </section>
    </main>
  );
}

function DashboardHeader({ title, subtitle, onSignOut }: { title: string; subtitle: string; onSignOut: () => void }) {
  return (
    <header className="dashboard-header">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} />
        Home
      </Link>
      <div>
        <span>AETHRIX AI</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="dashboard-actions">
        <ThemeToggle />
        <button type="button" className="secondary-cta" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
