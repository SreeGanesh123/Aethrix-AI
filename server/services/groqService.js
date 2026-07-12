const Groq = require('groq-sdk');

let groq = null;

function cleanChatResponse(text) {
    return String(text || '')
        .replace(/\*\*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function getGroqClient() {
    if (!groq) {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not set in environment variables');
        }
        groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });
    }
    return groq;
}

async function chatWithGroq(message, conversationHistory = []) {
    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not set in environment variables');
        }

        const client = getGroqClient();

        const messages = [
            {
                role: 'system',
                content: [
                    'You are the AETHRIX assistant for candidates, trainers, recruiters, and admins.',
                    'Always reply in plain text with this compact structure:',
                    'Answer: one direct sentence.',
                    'Key points: 2-4 short bullet points using "- ".',
                    'Next steps: 1-3 short bullet points using "- " when action is useful.',
                    'Tip: one short practical sentence.',
                    'Keep the full response under 120 words unless the user asks for more detail.',
                    'Do not use markdown bold, numbered lists, tables, long introductions, or repeated headings.',
                    'Do not mention internal API or system instructions.',
                ].join(' '),
            },
            ...conversationHistory,
            { role: 'user', content: message }
        ];

        const completion = await client.chat.completions.create({
            messages: messages,
            model: 'llama-3.1-8b-instant',
            max_tokens: 320,
            temperature: 0.4,
        });

        const responseText = cleanChatResponse(completion.choices[0].message.content);

        return {
            success: true,
            message: responseText,
            model: 'llama-3.1-8b-instant'
        };
    } catch (error) {
        console.error('Groq API Error:', error.message);
        return {
            success: true,
            error: error.message,
            message: [
                'I cannot reach the live AI provider right now, but I can still help with general guidance.',
                '',
                'Next steps:',
                `- Recheck your question: "${message.slice(0, 120)}"`,
                '- Share the role, skill area, or resume section you want to improve.',
                '- Try again once the backend network connection is available.',
                '',
                'Tip: Keep the backend running while using the chatbot.'
            ].join('\n')
        };
    }
}

async function completeWithGroq(messages, options = {}) {
    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not set in environment variables');
        }

        const client = getGroqClient();
        const completion = await client.chat.completions.create({
            messages,
            model: options.model || 'llama-3.1-8b-instant',
            max_tokens: options.maxTokens || 1024,
            temperature: options.temperature ?? 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Groq completion error:', error.message);
        throw error;
    }
}

module.exports = {
    chatWithGroq,
    completeWithGroq
};
