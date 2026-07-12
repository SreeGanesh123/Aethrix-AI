const express = require('express');
const mammoth = require('mammoth');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { chatWithGroq, completeWithGroq } = require('../services/groqService');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
});

function parseJsonObject(text) {
    const trimmed = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { }
        }
        const arrMatch = trimmed.match(/\[[\s\S]*\]/);
        if (arrMatch) {
            try { return JSON.parse(arrMatch[0]); } catch { }
        }
        throw new Error('AI response did not include valid JSON');
    }
}

function normalizePromptList(value, count) {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                return item.question || item.prompt || item.text || item.task || item.scenario || '';
            }
            return '';
        })
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, count);
}

function fallbackResumeAnalysis(resumeText, jobDescriptionText = '') {
    const lower = resumeText.toLowerCase();
    const signals = [
        'project',
        'internship',
        'experience',
        'javascript',
        'react',
        'python',
        'node',
        'sql',
        'api',
        'git',
        'certification',
        'leadership',
        'achievement',
    ];
    const matchedSignals = signals.filter((signal) => lower.includes(signal)).length;
    const hasMetrics = /\b\d+%|\b\d+\s*(users|projects|months|years|clients|teams)\b/i.test(resumeText);
    const score = Math.min(88, 48 + matchedSignals * 3 + (hasMetrics ? 12 : 0));

    const jdKeywords = Array.from(new Set(
        (jobDescriptionText.match(/[a-zA-Z]{3,}/g) || [])
            .map((word) => word.toLowerCase())
            .filter((word) => !['and', 'the', 'with', 'for', 'that', 'this', 'from', 'your', 'role', 'skills', 'experience', 'team', 'work', 'responsible', 'candidate', 'job', 'description', 'will', 'should', 'about'].includes(word))
            .slice(0, 8)
    ));
    const matchedKeywords = jdKeywords.filter((keyword) => lower.includes(keyword));
    const missingKeywords = jdKeywords.filter((keyword) => !lower.includes(keyword));
    const keywordMatch = jdKeywords.length ? Math.round((matchedKeywords.length / jdKeywords.length) * 100) : 0;
    const atsScore = Math.min(100, Math.round((score * 0.6) + (keywordMatch * 0.4)));

    return {
        score,
        atsScore,
        keywordMatch,
        matchedKeywords: matchedKeywords.slice(0, 8),
        missingKeywords: missingKeywords.slice(0, 6),
        atsIssues: [
            hasMetrics ? 'Metrics are present in the resume.' : 'Add measurable outcomes such as percentages, users, revenue, or time saved.',
            jdKeywords.length ? 'Add more role-specific keywords from the job description.' : 'Add a clear Skills section with role-specific keywords.',
            'Keep formatting simple: avoid tables, icons, and multi-column layouts for ATS parsing.',
        ],
        summary: jobDescriptionText
            ? 'Resume shows useful experience and is being compared to the provided job description for fit.'
            : 'Resume shows useful experience, but would be stronger with clearer metrics and project outcomes.',
        recommendation: jobDescriptionText
            ? 'Add quantified achievements and align more keywords with the target role description.'
            : 'Add quantified achievements, target-role keywords, and a concise project impact section.',
    };
}

function fallbackAssessmentPrompts(testType) {
    return {
        aptitude: [
            `A ${testType} cohort has 36 learners and 25% are shortlisted. How many learners are shortlisted?`,
            'Find the next number in the sequence: 3, 6, 12, 24, __.',
            'If a task takes 4 people 6 hours, how long should 8 equally skilled people take?',
        ],
        communication: [
            'Write a short email asking a trainer for clarification on a delayed assignment.',
            'Draft a concise status update explaining one completed task, one blocker, and one next step.',
        ],
    };
}

function fallbackResumeRewrite({ role = 'target role' }) {
    return {
        headline: `Resume rewrite for ${role}`,
        bullets: [
            'Led a measurable project initiative using relevant tools, improving delivery quality and stakeholder visibility.',
            'Built and documented reusable workflows that reduced manual effort and improved team execution speed.',
            'Collaborated across product, engineering, and operations to ship practical outcomes under clear timelines.',
        ],
        keywords: ['impact metrics', 'ownership', 'collaboration', 'automation', 'delivery'],
    };
}

function fallbackMockInterview({ role = 'candidate', answer = '' }) {
    return {
        question: `Tell me about a ${role} project where you solved a difficult problem and measured the result.`,
        feedback: answer
            ? 'Your answer has useful context. Make it stronger by adding the business goal, your exact action, measurable impact, and one lesson learned.'
            : 'Start with a project summary, then explain your role, tradeoffs, result, and what you would improve next.',
        score: answer ? 74 : 0,
        nextQuestion: 'Describe a time you received feedback and changed your approach.',
    };
}

function fallbackCandidateFit({ role = 'target role', profile = {} }) {
    const skills = String(profile.skills || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 4);
    return {
        fitScore: skills.length ? 82 : 68,
        summary: `Candidate appears suitable for ${role}, with the strongest signal coming from profile completeness and listed skills.`,
        strengths: skills.length ? skills : ['profile completion', 'assessment readiness', 'learning orientation'],
        risks: ['needs stronger quantified outcomes', 'role-specific evidence can be clearer'],
        recommendation: 'Proceed with a focused technical screen and ask for examples with measurable impact.',
    };
}

function fallbackLearningPath({ role = 'target role', weakArea = 'core skills', developmentGoal = '', resumeSkills = '', resumeSummary = '', missingKeywords = [] }) {
    const primaryFocus = developmentGoal || weakArea || 'core skills';
    const gapFocus = Array.isArray(missingKeywords) && missingKeywords.length ? missingKeywords[0] : primaryFocus;
    return {
        title: `${role} learning path`,
        focus: primaryFocus,
        weeks: [
            { week: 1, goal: `Refresh ${gapFocus} fundamentals`, task: `Review the resume, identify the strongest ${resumeSkills || 'skills'} signal, and complete two short drills.` },
            { week: 2, goal: 'Build a practical mini project', task: `Ship one small artifact that bridges ${primaryFocus} and the resume summary: ${resumeSummary || 'candidate profile'}.` },
            { week: 3, goal: 'Practice interview-style explanation', task: 'Record concise answers using problem, action, result, and role alignment.' },
            { week: 4, goal: 'Prepare portfolio evidence', task: 'Add metrics, screenshots, and a short project narrative tailored to the target role.' },
        ],
    };
}

function fallbackRecruiterShortlist({ role = 'open role', candidates = [] }) {
    const ranked = candidates.map((candidate, index) => ({
        name: candidate.name,
        rank: index + 1,
        reason: `${candidate.name} is a strong match for ${role} based on fit score and current pipeline status.`,
        nextStep: index === 0 ? 'Schedule interview' : 'Keep warm and request one more work sample',
    }));

    return {
        summary: `Shortlist generated for ${role}. Prioritize the top fit candidates with the clearest role alignment.`,
        ranked,
        outreach: `Hi, your profile looks aligned with our ${role} opening. Would you be open to a focused interview this week?`,
    };
}

function fallbackCertificateSummary({ certificate = {} }) {
    const percent = certificate.totalScore ? Math.round((certificate.score / certificate.totalScore) * 100) : 0;
    return {
        summary: `${certificate.name || 'This candidate'} verified completion of ${certificate.exam || 'the assessment'} with a ${percent}% score.`,
        skills: [certificate.examType || 'assessment readiness', 'verified completion', 'role learning signal'],
        interpretation: percent >= 80
            ? 'The score indicates strong assessment performance and readiness for next-stage evaluation.'
            : 'The certificate confirms completion, while a follow-up screen can clarify depth in the assessed skills.',
    };
}

function normalizeStringList(value, count) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, count);
}

async function runJsonFeature({ system, prompt, fallback, maxTokens = 900, temperature = 0.5 }) {
    try {
        const aiText = await completeWithGroq([
            { role: 'system', content: `${system} Return strict JSON only.` },
            { role: 'user', content: prompt },
        ], { temperature, maxTokens });

        return { success: true, data: parseJsonObject(aiText) };
    } catch (error) {
        console.error('AI feature fallback:', error.message);
        return { success: true, fallback: true, data: fallback };
    }
}

async function extractResumeText(file) {
    if (!file) throw new Error('Resume file is required');

    if (file.mimetype === 'application/pdf' || file.originalname.match(/\.pdf$/i)) {
        const parsed = await pdfParse(file.buffer);
        return parsed.text;
    }

    if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || file.originalname.match(/\.docx$/i)
    ) {
        const parsed = await mammoth.extractRawText({ buffer: file.buffer });
        return parsed.value;
    }

    throw new Error('Only PDF and DOCX resumes are supported');
}

// POST /api/ai/chat - Send a message to Groq AI
router.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ success: false, error: 'Message is required and must be a string' });
        }

        const conversationHistory = Array.isArray(history)
            ? history
                .filter((msg) => msg && typeof msg.content === 'string')
                .map((msg) => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: msg.content,
                }))
            : [];

        const result = await chatWithGroq(message, conversationHistory);
        res.json(result);
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process chat request',
            message: error.message,
        });
    }
});

router.post('/resume-analysis', upload.single('resume'), async (req, res) => {
    let resumeText = '';
    let jobDescriptionText = '';
    try {
        resumeText = (await extractResumeText(req.file)).replace(/\s+/g, ' ').trim();
        jobDescriptionText = String(req.body?.jobDescription || '').replace(/\s+/g, ' ').trim();
        if (resumeText.length < 80) {
            return res.status(400).json({
                success: false,
                error: 'Resume text is too short to analyze',
            });
        }

        const prompt = [
            'Analyze this candidate resume for job readiness.',
            jobDescriptionText
                ? 'Compare the resume against the provided job description and score how well it matches the role.'
                : 'No job description was provided, so evaluate the resume generally.',
            'Return only JSON with keys: score, atsScore, keywordMatch, matchedKeywords, missingKeywords, atsIssues, summary, recommendation.',
            'score, atsScore, and keywordMatch must be integers from 0 to 100.',
            'matchedKeywords must be up to 8 strings. missingKeywords must be up to 6 strings.',
            'atsIssues must be exactly 3 concise ATS formatting or keyword notes.',
            'summary and recommendation must each be one concise sentence.',
            jobDescriptionText ? `Job description: ${jobDescriptionText.slice(0, 8000)}` : '',
            `Resume text: ${resumeText.slice(0, 7000)}`,
        ].filter(Boolean).join('\n');

        const aiText = await completeWithGroq([
            {
                role: 'system',
                content: 'You are an expert technical recruiter and career coach. Return strict JSON only.',
            },
            { role: 'user', content: prompt },
        ], { temperature: 0.3, maxTokens: 500 });

        const parsed = parseJsonObject(aiText);
        const score = Math.min(100, Math.max(0, Number.parseInt(parsed.score, 10) || 0));

        res.json({
            success: true,
            analysis: {
                score,
                atsScore: Math.min(100, Math.max(0, Number.parseInt(parsed.atsScore, 10) || score)),
                keywordMatch: Math.min(100, Math.max(0, Number.parseInt(parsed.keywordMatch, 10) || 0)),
                matchedKeywords: normalizeStringList(parsed.matchedKeywords, 8),
                missingKeywords: normalizeStringList(parsed.missingKeywords, 6),
                atsIssues: normalizeStringList(parsed.atsIssues, 3),
                summary: String(parsed.summary || 'Resume analysis completed.'),
                recommendation: String(parsed.recommendation || 'Add clearer impact metrics and role-specific keywords.'),
            },
        });
    } catch (error) {
        console.error('Resume analysis error:', error);
        if (!resumeText) {
            return res.status(500).json({
                success: false,
                error: error.message || 'Failed to analyze resume',
            });
        }

        res.json({
            success: true,
            fallback: true,
            analysis: fallbackResumeAnalysis(resumeText, jobDescriptionText),
        });
    }
});

router.post('/assessment-prompts', async (req, res) => {
    try {
        const { testType = 'Aptitude & Communication' } = req.body || {};
        const aiText = await completeWithGroq([
            {
                role: 'system',
                content: 'You generate hiring assessment content. Return strict JSON only.',
            },
            {
                role: 'user',
                content: [
                    `Generate fresh prompts for ${testType}.`,
                    'Return only JSON with keys aptitude and communication.',
                    'aptitude must be an array of exactly 3 short numerical/logical reasoning questions.',
                    'communication must be an array of exactly 2 workplace writing prompts.',
                    'Do not include answers.',
                ].join('\n'),
            },
        ], { temperature: 0.8, maxTokens: 700 });

        const parsed = parseJsonObject(aiText);
        const aptitude = normalizePromptList(parsed.aptitude, 3);
        const communication = normalizePromptList(parsed.communication, 2);

        if (aptitude.length !== 3 || communication.length !== 2) {
            throw new Error('AI did not return the expected prompt structure');
        }

        res.json({
            success: true,
            aptitude,
            communication,
        });
    } catch (error) {
        console.error('Assessment prompt generation error:', error);
        const { testType = 'Aptitude & Communication' } = req.body || {};
        res.json({
            success: true,
            fallback: true,
            ...fallbackAssessmentPrompts(testType),
        });
    }
});

router.post('/resume-rewrite', async (req, res) => {
    const payload = req.body || {};
    const { resumeSummary = '', role = 'target role', skills = '' } = payload;
    const fallback = fallbackResumeRewrite(payload);
    const result = await runJsonFeature({
        system: 'You are a concise resume writer for technical and business roles.',
        prompt: [
            `Rewrite resume positioning for role: ${role}.`,
            `Known skills: ${skills || 'not provided'}.`,
            `Resume summary: ${resumeSummary || 'not provided'}.`,
            'Return JSON with keys headline, bullets, keywords.',
            'bullets must be exactly 3 stronger resume bullet strings.',
            'keywords must be exactly 5 short keyword strings.',
        ].join('\n'),
        fallback,
    });

    const data = result.data || fallback;
    res.json({
        ...result,
        data: {
            headline: String(data.headline || fallback.headline),
            bullets: normalizeStringList(data.bullets, 3).length === 3 ? normalizeStringList(data.bullets, 3) : fallback.bullets,
            keywords: normalizeStringList(data.keywords, 5).length ? normalizeStringList(data.keywords, 5) : fallback.keywords,
        },
    });
});

router.post('/mock-interview', async (req, res) => {
    const payload = req.body || {};
    const { role = 'candidate', skills = '', answer = '', lastQuestion = '' } = payload;
    const fallback = fallbackMockInterview(payload);
    const result = await runJsonFeature({
        system: 'You are a practical AI mock interviewer.',
        prompt: [
            `Interview role: ${role}.`,
            `Candidate skills: ${skills || 'not provided'}.`,
            `Previous question: ${lastQuestion || 'none'}.`,
            `Candidate answer: ${answer || 'none yet'}.`,
            'Return JSON with keys question, feedback, score, nextQuestion.',
            'score must be 0 to 100. If no answer is provided, score is 0 and feedback should tell them how to answer.',
        ].join('\n'),
        fallback,
        temperature: 0.6,
    });

    const data = result.data || fallback;
    res.json({
        ...result,
        data: {
            question: String(data.question || fallback.question),
            feedback: String(data.feedback || fallback.feedback),
            score: Math.min(100, Math.max(0, Number.parseInt(data.score, 10) || fallback.score)),
            nextQuestion: String(data.nextQuestion || fallback.nextQuestion),
        },
    });
});

router.post('/assessment-generator', async (req, res) => {
    const { role = 'General', skill = 'JavaScript', difficulty = 'intermediate', resumeSkills = '', jobDescription = '' } = req.body || {};
    const fallback = {
        title: `${skill} ${difficulty} assessment`,
        mcqs: [
            { question: `Which ${skill} concept is most important for ${role}?`, options: ['Syntax', 'Problem solving', 'Naming only', 'Formatting only'], answer: 1 },
            { question: `What should a ${role} candidate explain after solving a task?`, options: ['Tradeoffs', 'Font size', 'Keyboard color', 'Nothing'], answer: 0 },
            { question: `Which signal best proves ${skill} ability?`, options: ['Copied code', 'Working project', 'Long resume', 'No tests'], answer: 1 },
        ],
        codingPrompt: `Build a small ${skill} solution for a ${role} workflow using the resume skills and job description context.`,
        rubric: ['role alignment', 'technical correctness', 'clarity', 'business relevance'],
    };
    const result = await runJsonFeature({
        system: 'You generate compact hiring assessments tailored to the candidate profile and target role.',
        prompt: [
            `Role: ${role}.`,
            `Resume skills: ${resumeSkills || skill}.`,
            `Job description: ${jobDescription || 'No job description provided.'}`,
            `Difficulty: ${difficulty}.`,
            'Return JSON with keys title, mcqs, codingPrompt, rubric.',
            'mcqs must be exactly 3 objects with question, options array of 4 strings, answer index number.',
            'rubric must be exactly 4 short strings.',
            'Make the questions relevant to the candidate skills and the job description rather than generic interview trivia.',
        ].join('\n'),
        fallback,
        temperature: 0.7,
        maxTokens: 1100,
    });

    res.json({ ...result, data: result.data || fallback });
});

router.post('/candidate-fit-report', async (req, res) => {
    const payload = req.body || {};
    const fallback = fallbackCandidateFit(payload);
    const result = await runJsonFeature({
        system: 'You are an expert recruiter writing concise candidate fit reports.',
        prompt: [
            `Target role: ${payload.role || 'target role'}.`,
            `Candidate profile JSON: ${JSON.stringify(payload.profile || {})}`,
            'Return JSON with keys fitScore, summary, strengths, risks, recommendation.',
            'fitScore must be a whole number from 0 to 100, not a decimal and not a 1-10 rating.',
            'strengths and risks must be arrays of short strings.',
        ].join('\n'),
        fallback,
    });

    const data = result.data || fallback;
    let fitScore = Number.parseFloat(data.fitScore);
    if (!Number.isFinite(fitScore)) fitScore = fallback.fitScore;
    if (fitScore > 0 && fitScore <= 1) fitScore *= 100;
    if (fitScore > 1 && fitScore <= 10) fitScore *= 10;

    res.json({
        ...result,
        data: {
            fitScore: Math.min(100, Math.max(0, Math.round(fitScore))),
            summary: String(data.summary || fallback.summary),
            strengths: normalizeStringList(data.strengths, 5).length ? normalizeStringList(data.strengths, 5) : fallback.strengths,
            risks: normalizeStringList(data.risks, 5).length ? normalizeStringList(data.risks, 5) : fallback.risks,
            recommendation: String(data.recommendation || fallback.recommendation),
        },
    });
});

router.post('/learning-path', async (req, res) => {
    const payload = req.body || {};
    const fallback = fallbackLearningPath(payload);
    const result = await runJsonFeature({
        system: 'You create practical four-week learning plans for job candidates.',
        prompt: [
            `Target role: ${payload.role || 'target role'}.`,
            `Resume summary: ${payload.resumeSummary || 'not provided'}.`,
            `Resume skills: ${payload.resumeSkills || 'not provided'}.`,
            `Development goal: ${payload.developmentGoal || payload.weakArea || 'core skills'}.`,
            `Missing ATS keywords: ${Array.isArray(payload.missingKeywords) ? payload.missingKeywords.join(', ') : 'not provided'}.`,
            `Job description: ${payload.jobDescription || 'not provided'}.`,
            `Profile JSON: ${JSON.stringify(payload.profile || {})}`,
            'Return JSON with keys title, focus, weeks.',
            'weeks must be exactly 4 objects with week number, goal, task.',
            'Make the plan specific to the resume gaps and the candidate’s goal, not generic study advice.',
        ].join('\n'),
        fallback,
    });

    res.json({ ...result, data: result.data || fallback });
});

router.post('/recruiter-shortlist', async (req, res) => {
    const payload = req.body || {};
    const fallback = fallbackRecruiterShortlist(payload);
    const result = await runJsonFeature({
        system: 'You help recruiters shortlist candidates fairly and explainably.',
        prompt: [
            `Open role: ${payload.role || 'open role'}.`,
            `Candidates JSON: ${JSON.stringify(payload.candidates || [])}`,
            'Return JSON with keys summary, ranked, outreach.',
            'ranked must include name, rank, reason, nextStep for each candidate.',
        ].join('\n'),
        fallback,
    });

    res.json({ ...result, data: result.data || fallback });
});

router.post('/generate-questions', async (req, res) => {
    const { type = 'mcq', language = 'JavaScript', userSeed = '' } = req.body || {};

    if (type === 'mcq') {
        const fallback = {
            questions: [
                { question: `What is a key feature of ${language}?`, options: ['Syntax', 'Closures', 'Naming', 'Formatting'], answer: 1, explanation: 'Closures are a core language feature.' },
                { question: `Which ${language} concept handles async work?`, options: ['Loops', 'Promises', 'Classes', 'Strings'], answer: 1, explanation: 'Promises handle asynchronous operations.' },
                { question: `How do you declare a variable in ${language}?`, options: ['let/const', 'make', 'set', 'define'], answer: 0, explanation: 'let and const are standard variable declarations.' },
                { question: `What does a function return by default in ${language}?`, options: ['null', 'undefined', '0', 'false'], answer: 1, explanation: 'Functions return undefined if no return statement is given.' },
                { question: `Which data structure stores key-value pairs in ${language}?`, options: ['Array', 'Object/Dict', 'Set', 'Queue'], answer: 1, explanation: 'Objects/Dicts store key-value pairs.' },
                { question: `What is the entry point of a ${language} program?`, options: ['main()', 'start()', 'run()', 'init()'], answer: 0, explanation: 'main() is the standard entry point.' },
                { question: `Which loop iterates a fixed number of times in ${language}?`, options: ['while', 'for', 'do-while', 'foreach'], answer: 1, explanation: 'for loop iterates a fixed number of times.' },
                { question: `How do you handle errors in ${language}?`, options: ['try/catch', 'if/else', 'switch', 'goto'], answer: 0, explanation: 'try/catch handles exceptions.' },
                { question: `Which keyword exits a loop in ${language}?`, options: ['exit', 'break', 'stop', 'end'], answer: 1, explanation: 'break exits a loop.' },
                { question: `What is a null value in ${language}?`, options: ['0', 'empty string', 'absence of value', 'false'], answer: 2, explanation: 'null represents absence of value.' },
                { question: `Which operator checks equality in ${language}?`, options: ['=', '==', '===', '!='], answer: 2, explanation: 'Strict equality operator.' },
                { question: `What is recursion in ${language}?`, options: ['A loop', 'A function calling itself', 'An array method', 'A class'], answer: 1, explanation: 'Recursion is a function calling itself.' },
                { question: `Which method converts string to number in ${language}?`, options: ['parseInt()', 'toString()', 'toArray()', 'toFloat()'], answer: 0, explanation: 'parseInt converts string to integer.' },
                { question: `What is a callback in ${language}?`, options: ['A return value', 'A function passed as argument', 'A loop', 'A variable'], answer: 1, explanation: 'Callbacks are functions passed as arguments.' },
                { question: `Which keyword skips to next iteration in ${language}?`, options: ['skip', 'next', 'continue', 'pass'], answer: 2, explanation: 'continue skips to next iteration.' },
                { question: `What is an array in ${language}?`, options: ['A key-value store', 'An ordered collection', 'A function', 'A class'], answer: 1, explanation: 'Arrays are ordered collections.' },
                { question: `Which symbol is used for comments in ${language}?`, options: ['#', '//', '/*', '--'], answer: 1, explanation: '// is used for single-line comments.' },
                { question: `What is a class in ${language}?`, options: ['A function', 'A blueprint for objects', 'A variable', 'A loop'], answer: 1, explanation: 'Classes are blueprints for objects.' },
                { question: `Which method removes last element from array in ${language}?`, options: ['shift()', 'pop()', 'splice()', 'slice()'], answer: 1, explanation: 'pop() removes the last element.' },
                { question: `What is scope in ${language}?`, options: ['Memory size', 'Variable accessibility', 'Loop count', 'File size'], answer: 1, explanation: 'Scope defines where variables are accessible.' },
            ],
        };
        try {
            const aiText = await completeWithGroq([
                { role: 'system', content: 'You generate unique MCQ questions for technical hiring. Return strict JSON only. No markdown, no code fences.' },
                {
                    role: 'user', content: [
                        `Generate exactly 20 unique MCQ questions for ${language} programming. User seed: ${userSeed}.`,
                        'Return a JSON object with key "questions" containing an array of exactly 20 objects.',
                        'Each object must have: "question" (string), "options" (array of exactly 4 strings), "answer" (0-based index integer), "explanation" (string).',
                        'Vary difficulty across beginner, intermediate, and advanced. Do not use markdown or code fences.',
                    ].join(' ')
                },
            ], { temperature: 0.9, maxTokens: 4000 });

            const parsed = parseJsonObject(aiText);
            let questions = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.questions) ? parsed.questions : []);
            questions = questions
                .filter(q => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length === 4)
                .map(q => ({
                    question: String(q.question),
                    options: q.options.map(String),
                    answer: Math.min(3, Math.max(0, Number.parseInt(q.answer, 10) || 0)),
                    explanation: String(q.explanation || ''),
                }));

            if (questions.length < 5) throw new Error('Not enough valid questions returned');
            return res.json({ success: true, data: { questions } });
        } catch (err) {
            console.error('MCQ generation error:', err.message);
            return res.json({ success: true, data: fallback });
        }
    }

    if (type === 'coding') {
        const defaultStarter = language === 'Python' ? 'def solve(data):\n    pass' : language === 'SQL' ? 'SELECT * FROM table_name;' : 'function solve(data) {\n  // your code here\n}';
        const fallback = {
            challenges: [
                {
                    title: `${language} Challenge 1`,
                    description: `Write a ${language} function that returns the sum of all even numbers in an array.`,
                    starterCode: defaultStarter,
                    sampleTests: ['[1,2,3,4] => 6', '[10,11,12] => 22'],
                },
                {
                    title: `${language} Challenge 2`,
                    description: `Write a ${language} function that reverses a string without using built-in reverse methods.`,
                    starterCode: defaultStarter,
                    sampleTests: ['"hello" => "olleh"', '"world" => "dlrow"'],
                },
            ],
        };
        try {
            const aiText = await completeWithGroq([
                { role: 'system', content: 'You generate unique coding challenges for technical hiring. Return strict JSON only. No markdown, no code fences.' },
                {
                    role: 'user', content: [
                        `Generate exactly 2 unique ${language} coding challenges. User seed: ${userSeed}.`,
                        'Return a JSON object with key "challenges" containing an array of exactly 2 objects.',
                        'Each object must have: "title" (string), "description" (string), "starterCode" (string), "sampleTests" (array of exactly 2 strings in format "input => output").',
                        'Each challenge must be practical and solvable in under 20 minutes. Never use fizzbuzz, fibonacci, or factorial.',
                        'Do not use markdown or code fences.',
                    ].join(' ')
                },
            ], { temperature: 0.9, maxTokens: 1600 });

            const parsed = parseJsonObject(aiText);
            let challenges = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.challenges) ? parsed.challenges : []);
            challenges = challenges
                .filter(c => c && typeof c.title === 'string' && typeof c.description === 'string')
                .map(c => ({
                    title: String(c.title),
                    description: String(c.description),
                    starterCode: String(c.starterCode || defaultStarter),
                    sampleTests: Array.isArray(c.sampleTests) ? c.sampleTests.map(String).slice(0, 2) : ['Input => Output'],
                }));

            if (challenges.length < 1) throw new Error('No valid challenges returned');
            return res.json({ success: true, data: { challenges } });
        } catch (err) {
            console.error('Coding challenge generation error:', err.message);
            return res.json({ success: true, data: fallback });
        }
    }

    if (type === 'aptitude') {
        const fallback = {
            aptitude: [
                'If a train travels 150 km in 2.5 hours, what is its average speed in km/h?',
                'Find the missing number: 5, 11, 23, 47, ___',
                'A project takes 6 workers 8 days. How many days for 4 workers at the same rate?',
            ],
            communication: [
                'Write a professional email to your manager requesting a one-day work-from-home arrangement.',
                'Draft a brief message to a client explaining a two-day delay in project delivery.',
            ],
        };
        try {
            const aiText = await completeWithGroq([
                { role: 'system', content: 'You generate unique aptitude and communication prompts for hiring assessments. Return strict JSON only. No markdown, no code fences.' },
                {
                    role: 'user', content: [
                        `Generate fresh assessment prompts. User seed: ${userSeed}.`,
                        'Return a JSON object with keys: "aptitude" (array of exactly 3 unique numerical/logical questions) and "communication" (array of exactly 2 unique workplace writing prompts).',
                        'Vary the numbers and context. Do not repeat standard examples. Do not use markdown or code fences.',
                    ].join(' ')
                },
            ], { temperature: 0.9, maxTokens: 800 });

            const parsed = parseJsonObject(aiText);
            const aptitude = normalizePromptList(parsed.aptitude, 3);
            const communication = normalizePromptList(parsed.communication, 2);
            if (aptitude.length < 2 || communication.length < 1) throw new Error('Not enough prompts returned');
            return res.json({ success: true, data: { aptitude, communication } });
        } catch (err) {
            console.error('Aptitude generation error:', err.message);
            return res.json({ success: true, data: fallback });
        }
    }

    res.status(400).json({ success: false, error: 'Invalid type. Use mcq, coding, or aptitude.' });
});

router.post('/job-description', async (req, res) => {
    const { role = 'Software Engineer', skills = '', level = 'mid' } = req.body || {};
    const fallback = {
        title: `${role} — ${level}`,
        summary: `We are looking for a ${level}-level ${role} to join our team.`,
        responsibilities: ['Build and maintain core product features', 'Collaborate with cross-functional teams', 'Participate in code reviews and technical planning'],
        requirements: skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : ['Relevant experience', 'Strong communication', 'Problem-solving skills'],
        niceToHave: ['Open source contributions', 'Experience in a fast-paced startup'],
    };
    const result = await runJsonFeature({
        system: 'You write clear, inclusive, and compelling job descriptions for technical hiring.',
        prompt: [
            `Write a job description for: ${role}, level: ${level}, required skills: ${skills || 'not specified'}.`,
            'Return JSON with keys: title, summary, responsibilities (array of 3), requirements (array of 4), niceToHave (array of 2).',
        ].join('\n'),
        fallback, temperature: 0.7, maxTokens: 900,
    });
    res.json({ ...result, data: result.data || fallback });
});

router.post('/interview-questions', async (req, res) => {
    const { role = 'Software Engineer', skills = '', round = 'technical' } = req.body || {};
    const fallback = {
        questions: [
            { question: `Describe a challenging ${role} project and how you handled it.`, type: 'behavioral' },
            { question: `How do you approach debugging a complex issue in ${skills || 'your stack'}?`, type: 'technical' },
            { question: 'How do you prioritize tasks when deadlines conflict?', type: 'situational' },
            { question: `What is your experience with ${skills || 'relevant tools'}?`, type: 'technical' },
            { question: 'Tell me about a time you disagreed with a teammate and how you resolved it.', type: 'behavioral' },
        ],
    };
    const result = await runJsonFeature({
        system: 'You generate structured interview questions for technical hiring rounds.',
        prompt: [
            `Generate 5 interview questions for role: ${role}, skills: ${skills || 'general'}, round: ${round}.`,
            'Return JSON with key questions: array of 5 objects each with question (string) and type (behavioral/technical/situational).',
        ].join('\n'),
        fallback, temperature: 0.75, maxTokens: 800,
    });
    res.json({ ...result, data: result.data || fallback });
});

router.post('/outreach-message', async (req, res) => {
    const { candidateName = 'Candidate', role = 'Software Engineer', fit = '90%', recruiterName = 'the team' } = req.body || {};
    const fallback = {
        subject: `Exciting ${role} opportunity at AETHRIX AI`,
        message: `Hi ${candidateName},\n\nYour profile stood out for our ${role} opening — your background is a strong ${fit} match. We'd love to connect for a quick call this week.\n\nBest,\n${recruiterName}`,
    };
    const result = await runJsonFeature({
        system: 'You write concise, professional recruiter outreach messages.',
        prompt: [
            `Write an outreach message to ${candidateName} for the ${role} role. Fit score: ${fit}. Recruiter: ${recruiterName}.`,
            'Return JSON with keys: subject (string), message (string, max 80 words, warm and professional).',
        ].join('\n'),
        fallback, temperature: 0.7, maxTokens: 400,
    });
    res.json({ ...result, data: result.data || fallback });
});

router.post('/skill-gap', async (req, res) => {
    const { cohortName = 'Cohort', learners = [], targetSkills = [] } = req.body || {};
    const fallback = {
        summary: `${cohortName} shows gaps in advanced topics. Focus on practical exercises and peer reviews.`,
        gaps: ['Problem solving under constraints', 'System design fundamentals', 'Code review practices'],
        recommendations: ['Add 2 micro-lessons on weak topics', 'Assign peer-review tasks', 'Schedule a live Q&A session'],
    };
    const result = await runJsonFeature({
        system: 'You analyze learner cohort data and identify skill gaps for trainers.',
        prompt: [
            `Cohort: ${cohortName}. Learners: ${learners.length}. Target skills: ${targetSkills.join(', ') || 'general programming'}.`,
            'Return JSON with keys: summary (string), gaps (array of 3 strings), recommendations (array of 3 strings).',
        ].join('\n'),
        fallback, temperature: 0.65, maxTokens: 600,
    });
    res.json({ ...result, data: result.data || fallback });
});

router.post('/lesson-plan', async (req, res) => {
    const { topic = 'JavaScript', level = 'intermediate', duration = '4 weeks' } = req.body || {};
    const fallback = {
        title: `${topic} — ${level} plan`,
        weeks: [
            { week: 1, topic: `${topic} fundamentals`, activities: 'Video + quiz + mini project' },
            { week: 2, topic: 'Practical application', activities: 'Hands-on coding exercises' },
            { week: 3, topic: 'Advanced patterns', activities: 'Case study + peer review' },
            { week: 4, topic: 'Assessment & review', activities: 'Final test + feedback session' },
        ],
    };
    const result = await runJsonFeature({
        system: 'You create structured lesson plans for technical trainers.',
        prompt: [
            `Create a ${duration} lesson plan for topic: ${topic}, level: ${level}.`,
            'Return JSON with keys: title (string), weeks (array of objects with week number, topic, activities).',
        ].join('\n'),
        fallback, temperature: 0.7, maxTokens: 700,
    });
    res.json({ ...result, data: result.data || fallback });
});

router.post('/platform-report', async (req, res) => {
    const { stats = {} } = req.body || {};
    const fallback = {
        health: 'Platform is operating normally with no critical issues detected.',
        insights: ['Assessment completion rate is above target', 'Candidate profile completeness has improved', 'AI response times are within SLA'],
        risks: ['Monitor API rate limits during peak hours', 'Review inactive recruiter accounts'],
        actions: ['Schedule monthly security audit', 'Update AI model prompts for better accuracy'],
    };
    const result = await runJsonFeature({
        system: 'You are a platform intelligence AI that generates admin health reports.',
        prompt: [
            `Generate a platform health report based on stats: ${JSON.stringify(stats)}.`,
            'Return JSON with keys: health (string), insights (array of 3), risks (array of 2), actions (array of 2).',
        ].join('\n'),
        fallback, temperature: 0.6, maxTokens: 600,
    });
    res.json({ ...result, data: result.data || fallback });
});

router.post('/admin-governance-brief', async (req, res) => {
    const payload = req.body || {};
    const fallback = {
        summary: 'Governance posture is stable. Focus on access hygiene, monitoring, and platform adoption.',
        priorities: ['Review privileged accounts', 'Track system uptime and DB health', 'Monitor interview and assessment usage'],
        risks: ['Stale permissions can create access drift', 'Unconfigured Firebase can block future features'],
        actions: ['Refresh permissions weekly', 'Audit platform settings monthly', 'Document AI prompt changes'],
    };
    const result = await runJsonFeature({
        system: 'You are a super-admin governance assistant for a hiring and assessment platform.',
        prompt: [
            `Platform stats: ${JSON.stringify(payload.stats || {})}`,
            `System status: ${JSON.stringify(payload.system || {})}`,
            `Firebase status: ${JSON.stringify(payload.firebase || {})}`,
            'Return JSON with keys summary, priorities, risks, actions.',
            'priorities must contain 3 short items. risks must contain 2 short items. actions must contain 3 short items.',
        ].join('\n'),
        fallback,
        temperature: 0.6,
        maxTokens: 700,
    });

    res.json({ ...result, data: result.data || fallback });
});

router.post('/admin-access-matrix', async (req, res) => {
    const payload = req.body || {};
    const fallback = {
        summary: 'Role access is broad and should be reviewed for least-privilege alignment.',
        accessChanges: ['Candidate: self-service profile and assessments', 'Recruiter: candidate review and outreach', 'Trainer: learning and assessment management', 'Super admin: full platform controls'],
        cautions: ['Avoid exposing admin-only reports to non-admin roles', 'Separate system settings from day-to-day recruiting actions'],
    };
    const result = await runJsonFeature({
        system: 'You are an access control advisor for a multi-role hiring platform.',
        prompt: [
            `Roles: ${JSON.stringify(payload.roles || [])}`,
            `Policies: ${JSON.stringify(payload.policies || {})}`,
            'Return JSON with keys summary, accessChanges, cautions.',
            'accessChanges must contain 4 short items. cautions must contain 2 short items.',
        ].join('\n'),
        fallback,
        temperature: 0.5,
    });

    res.json({ ...result, data: result.data || fallback });
});

router.post('/admin-incident-plan', async (req, res) => {
    const payload = req.body || {};
    const fallback = {
        summary: 'Prepare a compact incident playbook for service degradations and permission issues.',
        steps: ['Confirm server health and database connectivity', 'Check recent AI and auth failures', 'Notify stakeholders with a short status note'],
        escalations: ['Escalate unresolved DB issues to the backend owner', 'Escalate auth outages to platform security'],
    };
    const result = await runJsonFeature({
        system: 'You create incident response plans for platform administrators.',
        prompt: [
            `Current status JSON: ${JSON.stringify(payload.status || {})}`,
            `Alerts JSON: ${JSON.stringify(payload.alerts || [])}`,
            'Return JSON with keys summary, steps, escalations.',
            'steps must contain 3 short operational steps. escalations must contain 2 short items.',
        ].join('\n'),
        fallback,
        temperature: 0.6,
    });

    res.json({ ...result, data: result.data || fallback });
});

router.post('/certificate-summary', async (req, res) => {
    const payload = req.body || {};
    const fallback = fallbackCertificateSummary(payload);
    const result = await runJsonFeature({
        system: 'You summarize verified assessment certificates for employers and candidates.',
        prompt: [
            `Certificate JSON: ${JSON.stringify(payload.certificate || {})}`,
            'Return JSON with keys summary, skills, interpretation.',
            'skills must be 3 short strings.',
        ].join('\n'),
        fallback,
    });

    res.json({ ...result, data: result.data || fallback });
});

module.exports = router;
