const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface ChatResponse {
    success: boolean;
    message: string;
    error?: string;
}

interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
}

interface ResumeAnalysisResponse {
    success: boolean;
    analysis?: ResumeAnalysisResult;
    error?: string;
}

interface AssessmentPromptsResponse {
    success: boolean;
    aptitude?: string[];
    communication?: string[];
    error?: string;
}

interface AiFeatureResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface ResumeRewriteResult {
    headline: string;
    bullets: string[];
    keywords: string[];
}

export interface ResumeAnalysisResult {
    score: number;
    atsScore: number;
    keywordMatch: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    atsIssues: string[];
    summary: string;
    recommendation: string;
}

export interface MockInterviewResult {
    question: string;
    feedback: string;
    score: number;
    nextQuestion: string;
}

export interface GeneratedAssessmentResult {
    title: string;
    mcqs: Array<{ question: string; options: string[]; answer: number }>;
    codingPrompt: string;
    rubric: string[];
}

export interface CandidateFitReport {
    fitScore: number;
    summary: string;
    strengths: string[];
    risks: string[];
    recommendation: string;
}

export interface LearningPathResult {
    title: string;
    focus: string;
    weeks: Array<{ week: number; goal: string; task: string }>;
}

export interface RecruiterShortlistResult {
    summary: string;
    ranked: Array<{ name: string; rank: number; reason: string; nextStep: string }>;
    outreach: string;
}

export interface CertificateSummaryResult {
    summary: string;
    skills: string[];
    interpretation: string;
}

export async function chatWithAI(message: string, history: ConversationMessage[] = []): Promise<string> {
    try {
        const response = await fetch(`${API_URL}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message.trim(),
                history,
            }),
        });

        const data = await response.json() as ChatResponse;

        if (!response.ok) {
            throw new Error(data.error || `AI request failed with status ${response.status}`);
        }

        if (!data.success) {
            throw new Error(data.error || data.message || 'AI request failed');
        }

        return data.message || 'No response message';
    } catch (error) {
        console.error('AI chat request failed:', error);
        throw error;
    }
}

export async function analyzeResumeWithAI(file: File, jobDescription?: string): Promise<ResumeAnalysisResult> {
    const formData = new FormData();
    formData.append('resume', file);
    if (jobDescription && jobDescription.trim()) {
        formData.append('jobDescription', jobDescription.trim());
    }

    const response = await fetch(`${API_URL}/api/ai/resume-analysis`, {
        method: 'POST',
        body: formData,
    });
    const data = await response.json() as ResumeAnalysisResponse;

    if (!response.ok || !data.success || !data.analysis) {
        throw new Error(data.error || 'Resume analysis failed');
    }

    return {
        ...data.analysis,
        atsScore: Number.isFinite(Number(data.analysis.atsScore)) ? data.analysis.atsScore : data.analysis.score,
        keywordMatch: Number.isFinite(Number(data.analysis.keywordMatch)) ? data.analysis.keywordMatch : 0,
        matchedKeywords: Array.isArray(data.analysis.matchedKeywords) ? data.analysis.matchedKeywords : [],
        missingKeywords: Array.isArray(data.analysis.missingKeywords) ? data.analysis.missingKeywords : [],
        atsIssues: Array.isArray(data.analysis.atsIssues) ? data.analysis.atsIssues : [],
    };
}

export async function generateAssessmentPromptsWithAI(testType: string): Promise<{ aptitude: string[]; communication: string[] }> {
    const response = await fetch(`${API_URL}/api/ai/assessment-prompts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ testType }),
    });
    const data = await response.json() as AssessmentPromptsResponse;

    if (!response.ok || !data.success || !data.aptitude || !data.communication) {
        throw new Error(data.error || 'Assessment prompt generation failed');
    }

    return {
        aptitude: data.aptitude,
        communication: data.communication,
    };
}

async function requestAiFeature<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetch(`${API_URL}/api/ai/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await response.json() as AiFeatureResponse<T>;
    if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
    if (!data.success) throw new Error(data.error || 'AI feature request failed');
    if (!data.data) throw new Error('No data returned from AI');
    return data.data;
}

export function rewriteResumeWithAI(payload: { resumeSummary?: string; role?: string; skills?: string }): Promise<ResumeRewriteResult> {
    return requestAiFeature<ResumeRewriteResult>('resume-rewrite', payload);
}

export function runMockInterviewWithAI(payload: { role?: string; skills?: string; answer?: string; lastQuestion?: string }): Promise<MockInterviewResult> {
    return requestAiFeature<MockInterviewResult>('mock-interview', payload);
}

export function generateAssessmentWithAI(payload: { role?: string; skill?: string; difficulty?: string; resumeSkills?: string; jobDescription?: string }): Promise<GeneratedAssessmentResult> {
    return requestAiFeature<GeneratedAssessmentResult>('assessment-generator', payload);
}

export function generateCandidateFitReportWithAI(payload: { role?: string; profile?: unknown }): Promise<CandidateFitReport> {
    return requestAiFeature<CandidateFitReport>('candidate-fit-report', payload).then((report) => {
        const rawScore = Number(report.fitScore);
        let fitScore = rawScore > 0 && rawScore <= 1 ? rawScore * 100 : rawScore;
        if (fitScore > 1 && fitScore <= 10) fitScore *= 10;
        return {
            ...report,
            fitScore: Math.min(100, Math.max(0, Math.round(Number.isFinite(fitScore) ? fitScore : 0))),
            strengths: Array.isArray(report.strengths) ? report.strengths : [],
            risks: Array.isArray(report.risks) ? report.risks : [],
        };
    });
}

export function generateLearningPathWithAI(payload: { role?: string; weakArea?: string; profile?: unknown; resumeSummary?: string; resumeSkills?: string; developmentGoal?: string; jobDescription?: string; missingKeywords?: string[] }): Promise<LearningPathResult> {
    return requestAiFeature<LearningPathResult>('learning-path', payload);
}

export function generateRecruiterShortlistWithAI(payload: { role?: string; candidates?: unknown[] }): Promise<RecruiterShortlistResult> {
    return requestAiFeature<RecruiterShortlistResult>('recruiter-shortlist', payload);
}

export interface GeneratedQuestion {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
}

export interface GeneratedCodingChallenge {
    title: string;
    description: string;
    starterCode: string;
    sampleTests: string[];
}

export interface GeneratedAptitude {
    aptitude: string[];
    communication: string[];
}

const MCQ_FALLBACK: Record<string, GeneratedQuestion[]> = {
    JavaScript: [
        { question: 'Which keyword declares a block-scoped variable?', options: ['var', 'let', 'function', 'class'], answer: 1, explanation: '`let` is block-scoped.' },
        { question: 'What does `typeof []` return?', options: ['array', 'object', 'list', 'undefined'], answer: 1, explanation: 'Arrays are objects in JS.' },
        { question: 'Which method adds to the end of an array?', options: ['push()', 'pop()', 'shift()', 'unshift()'], answer: 0, explanation: '`push()` appends elements.' },
        { question: 'What does `===` check?', options: ['Value only', 'Type only', 'Value and type', 'Neither'], answer: 2, explanation: 'Strict equality checks both.' },
        { question: 'Which method filters an array?', options: ['map()', 'forEach()', 'filter()', 'reduce()'], answer: 2, explanation: '`filter()` returns matching elements.' },
    ],
    Python: [
        { question: 'Which keyword defines a function?', options: ['func', 'def', 'function', 'lambda'], answer: 1, explanation: '`def` defines functions in Python.' },
        { question: 'What does `len("hello")` return?', options: ['4', '5', '6', 'Error'], answer: 1, explanation: 'The string has 5 characters.' },
        { question: 'Which is ordered and mutable?', options: ['tuple', 'set', 'list', 'frozenset'], answer: 2, explanation: 'Lists are ordered and mutable.' },
        { question: 'How do you start a comment?', options: ['//', '/*', '#', '--'], answer: 2, explanation: 'Python comments start with #.' },
        { question: 'What does `10 // 3` return?', options: ['3', '3.33', '4', '1'], answer: 0, explanation: 'Floor division returns 3.' },
    ],
    SQL: [
        { question: 'Which clause filters rows?', options: ['SELECT', 'WHERE', 'GROUP BY', 'ORDER BY'], answer: 1, explanation: 'WHERE filters rows.' },
        { question: 'How do you select all columns?', options: ['SELECT * FROM t', 'GET * FROM t', 'SELECT ALL t', 'FETCH * t'], answer: 0, explanation: 'SELECT * returns all columns.' },
        { question: 'Which clause sorts results?', options: ['SORT BY', 'ORDER BY', 'GROUP BY', 'FILTER BY'], answer: 1, explanation: 'ORDER BY sorts results.' },
        { question: 'What does COUNT(*) return?', options: ['Row count', 'First row', 'Max value', 'Column names'], answer: 0, explanation: 'COUNT(*) counts all rows.' },
        { question: 'Which keyword removes duplicates?', options: ['UNIQUE', 'DISTINCT', 'NODUP', 'FILTER'], answer: 1, explanation: 'DISTINCT removes duplicates.' },
    ],
};

export async function generateQuestionsWithAI(payload: { type: 'mcq' | 'coding' | 'aptitude'; language?: string; userSeed?: string; questionCount?: number; challengeCount?: number; aptitudeCount?: number; communicationCount?: number }): Promise<{ questions?: GeneratedQuestion[]; challenges?: GeneratedCodingChallenge[]; title?: string; description?: string; starterCode?: string; sampleTests?: string[]; aptitude?: string[]; communication?: string[] }> {
    try {
        return await requestAiFeature('generate-questions', payload);
    } catch (err) {
        console.warn('generateQuestionsWithAI fell back to local data:', err);
        const lang = payload.language ?? 'JavaScript';
        if (payload.type === 'mcq') {
            const questions = MCQ_FALLBACK[lang] ?? MCQ_FALLBACK.JavaScript;
            const required = payload.questionCount ?? 20;
            return { questions: Array.from({ length: required }, (_, index) => questions[index % questions.length]) };
        }
        if (payload.type === 'coding') {
            const challengeCount = payload.challengeCount ?? 2;
            return {
                title: `${lang} Challenge`,
                description: `Write a ${lang} function that returns the sum of all numbers in an array.`,
                starterCode: lang === 'Python' ? 'def solve(nums):\n    pass' : lang === 'SQL' ? 'SELECT * FROM employees;' : 'function solve(nums) {\n  // return sum\n}',
                sampleTests: ['[1,2,3] => 6', '[10,20] => 30'],
                questions: Array.from({ length: challengeCount }, () => ({
                    question: `Implement the required ${lang} challenge.`,
                    options: [],
                    answer: 0,
                    explanation: 'Write a working solution that passes the sample tests.',
                })),
            };
        }
        const aptitude = Array.from({ length: payload.aptitudeCount ?? 10 }, (_, index) => {
            const samples = [
                'A train travels 120 km in 2 hours. What is its speed in km/h?',
                'Find the next number: 2, 6, 12, 20, ___',
                'If 5 workers finish a job in 10 days, how long for 10 workers?',
                'A recipe calls for 3 cups of flour for 4 servings. How much for 6 servings?',
                'If a laptop costs $45 after a 10% discount, what was the original price?',
                'A rectangle has length 12 and width 5. What is its area?',
                'If you save $15 per week, how much in 8 weeks?',
                'A car travels 180 km in 3 hours. What is the average speed?',
                'Three friends split $90 equally. How much does each get?',
                'A number is tripled and then reduced by 5 to get 16. What is the number?',
            ];
            return samples[index % samples.length];
        });
        const communication = Array.from({ length: payload.communicationCount ?? 10 }, (_, index) => {
            const samples = [
                'Write a professional email requesting a deadline extension.',
                'Draft a message to a client explaining a project delay.',
                'Describe how you handled a challenging team situation in a previous role.',
                'Write a short cover note introducing yourself for a product role.',
                'Explain a technical concept clearly for a non-technical stakeholder.',
                'Compose a thank-you note after a successful interview.',
                'Draft a message asking for feedback after an assessment.',
                'Write a statement outlining why you are a strong fit for the role.',
                'Explain a gap in employment in a positive way.',
                'Write a concise summary of your key strengths for a hiring manager.',
            ];
            return samples[index % samples.length];
        });
        return { aptitude, communication };
    }
}

export interface JobDescriptionResult {
    title: string;
    summary: string;
    responsibilities: string[];
    requirements: string[];
    niceToHave: string[];
}

export interface InterviewQuestionsResult {
    questions: Array<{ question: string; type: string }>;
}

export interface OutreachMessageResult {
    subject: string;
    message: string;
}

export interface SkillGapResult {
    summary: string;
    gaps: string[];
    recommendations: string[];
}

export interface LessonPlanResult {
    title: string;
    weeks: Array<{ week: number; topic: string; activities: string }>;
}

export interface PlatformReportResult {
    health: string;
    insights: string[];
    risks: string[];
    actions: string[];
}

export interface AdminGovernanceResult {
    summary: string;
    priorities: string[];
    risks: string[];
    actions: string[];
}

export interface AdminAccessMatrixResult {
    summary: string;
    accessChanges: string[];
    cautions: string[];
}

export interface AdminIncidentPlanResult {
    summary: string;
    steps: string[];
    escalations: string[];
}

export interface SystemStatusResult {
    server: {
        running: boolean;
        uptimeSeconds: number;
        nodeVersion: string;
        memoryUsedMB: number;
    };
    database: {
        connected: boolean;
        readyState: number;
        userCount: number;
        activeSessions: number;
    };
    firebase: {
        configured: boolean;
        projectId: string | null;
        authDomain: string | null;
        storageBucket: string | null;
    };
}

export function generateJobDescriptionWithAI(payload: { role?: string; skills?: string; level?: string }): Promise<JobDescriptionResult> {
    return requestAiFeature<JobDescriptionResult>('job-description', payload);
}

export function generateInterviewQuestionsWithAI(payload: { role?: string; skills?: string; round?: string }): Promise<InterviewQuestionsResult> {
    return requestAiFeature<InterviewQuestionsResult>('interview-questions', payload);
}

export function generateOutreachMessageWithAI(payload: { candidateName?: string; role?: string; fit?: string; recruiterName?: string }): Promise<OutreachMessageResult> {
    return requestAiFeature<OutreachMessageResult>('outreach-message', payload);
}

export function analyzeSkillGapWithAI(payload: { cohortName?: string; learners?: unknown[]; targetSkills?: string[] }): Promise<SkillGapResult> {
    return requestAiFeature<SkillGapResult>('skill-gap', payload);
}

export function generateLessonPlanWithAI(payload: { topic?: string; level?: string; duration?: string }): Promise<LessonPlanResult> {
    return requestAiFeature<LessonPlanResult>('lesson-plan', payload);
}

export function generatePlatformReportWithAI(payload: { stats?: unknown }): Promise<PlatformReportResult> {
    return requestAiFeature<PlatformReportResult>('platform-report', payload);
}

export function generateAdminGovernanceBriefWithAI(payload: { stats?: unknown; system?: unknown; firebase?: unknown }): Promise<AdminGovernanceResult> {
    return requestAiFeature<AdminGovernanceResult>('admin-governance-brief', payload);
}

export function generateAdminAccessMatrixWithAI(payload: { roles?: string[]; policies?: unknown }): Promise<AdminAccessMatrixResult> {
    return requestAiFeature<AdminAccessMatrixResult>('admin-access-matrix', payload);
}

export function generateAdminIncidentPlanWithAI(payload: { status?: unknown; alerts?: unknown[] }): Promise<AdminIncidentPlanResult> {
    return requestAiFeature<AdminIncidentPlanResult>('admin-incident-plan', payload);
}

export async function fetchSystemStatus(): Promise<SystemStatusResult> {
    const response = await fetch(`${API_URL}/api/system/status`, { method: 'GET' });
    const data = await response.json() as { ok: boolean; status?: SystemStatusResult; error?: string };
    if (!response.ok || !data.ok || !data.status) {
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data.status;
}

export function summarizeCertificateWithAI(payload: { certificate?: unknown }): Promise<CertificateSummaryResult> {
    return requestAiFeature<CertificateSummaryResult>('certificate-summary', payload);
}
