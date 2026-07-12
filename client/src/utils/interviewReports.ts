import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type InterviewTranscriptEntry = {
    roundTitle: string;
    prompt: string;
    answer: string;
    feedback: string;
    aiReply: string;
    score: number;
    passed: boolean;
};

export type InterviewReportRecord = {
    id: string;
    candidateEmail: string;
    candidateName: string;
    candidateType: string;
    testType: string;
    startedAt: string;
    completedAt: string;
    rounds: string[];
    transcript: InterviewTranscriptEntry[];
    recordingStatus: string;
    summary: string;
    recommendation: string;
    videoAvailable: boolean;
};

const STORAGE_KEY = "aethrix_interview_reports";

function getStoredReports(): InterviewReportRecord[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as InterviewReportRecord[];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveStoredReports(reports: InterviewReportRecord[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function saveInterviewReport(report: InterviewReportRecord) {
    const reports = getStoredReports();
    const nextReports = [report, ...reports.filter((item) => item.id !== report.id)].slice(0, 25);
    saveStoredReports(nextReports);
}

export function getInterviewReports(candidateEmail?: string) {
    const reports = getStoredReports();
    if (!candidateEmail) return reports;
    return reports.filter((report) => report.candidateEmail === candidateEmail);
}

export function getLatestInterviewReport(candidateEmail?: string) {
    return getInterviewReports(candidateEmail)[0] ?? null;
}

function wrapText(text: string, maxChars: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
            lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }

    if (current) lines.push(current);
    return lines;
}

export async function createInterviewReportPdf(report: InterviewReportRecord) {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([842, 595]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const accent = rgb(0.08, 0.14, 0.24);
    const highlight = rgb(0.08, 0.48, 0.44);

    const margin = 42;
    const maxWidth = 760;
    let cursorY = 540;

    const drawLine = (text: string, size = 11, useBold = false, color = accent) => {
        page.drawText(text, {
            x: margin,
            y: cursorY,
            size,
            font: useBold ? boldFont : font,
            color,
        });
        cursorY -= size + 8;
    };

    const ensureSpace = (needed = 80) => {
        if (cursorY > needed) return;
        page = pdfDoc.addPage([842, 595]);
        cursorY = 540;
    };

    const writeWrapped = (text: string, size = 10, useBold = false, color = accent) => {
        const approxChars = Math.max(40, Math.floor(maxWidth / (size * 0.55)));
        for (const line of wrapText(text, approxChars)) {
            ensureSpace(40);
            drawLine(line, size, useBold, color);
        }
    };

    drawLine("AETHRIX AI Interview Report", 20, true, highlight);
    cursorY -= 8;
    writeWrapped(`Candidate: ${report.candidateName} <${report.candidateEmail}>`, 11, true);
    writeWrapped(`Type: ${report.candidateType} | Test: ${report.testType}`, 11, false);
    writeWrapped(`Started: ${new Date(report.startedAt).toLocaleString()} | Completed: ${new Date(report.completedAt).toLocaleString()}`, 10, false);
    writeWrapped(`Recording: ${report.recordingStatus}`, 10, false);
    cursorY -= 6;

    writeWrapped(`Summary: ${report.summary}`, 11, true);
    writeWrapped(`Recommendation: ${report.recommendation}`, 10, false);
    cursorY -= 6;

    for (const entry of report.transcript) {
        ensureSpace(120);
        writeWrapped(`Round: ${entry.roundTitle}`, 12, true, highlight);
        writeWrapped(`Prompt: ${entry.prompt}`, 10, false);
        writeWrapped(`Answer: ${entry.answer}`, 10, false);
        writeWrapped(`Feedback: ${entry.feedback}`, 10, false);
        writeWrapped(`Score: ${entry.score}/100 | Result: ${entry.passed ? "Pass" : "Fail"}`, 10, true);
        cursorY -= 4;
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

export async function downloadInterviewReportPdf(report: InterviewReportRecord) {
    const pdfBytes = await createInterviewReportPdf(report);
    const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aethrix-interview-report-${report.candidateEmail.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}