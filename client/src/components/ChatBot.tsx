import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Send, X } from "lucide-react";
import { chatWithAI } from "../services/aiService";

const quickReplies = [
    "Show my latest updates",
    "How do I improve my profile?",
    "What should I do next?",
];

export default function ChatBot() {
    const location = useLocation();
    const widgetRef = useRef<HTMLDivElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const dragState = useRef<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 });
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ x: 24, y: 24 });
    const [messages, setMessages] = useState<{ from: "user" | "bot"; text: string }[]>([
        { from: "bot", text: "Hello! I’m your AETHRIX assistant. Ask me about the dashboard or OTP setup." },
    ]);
    const [input, setInput] = useState("");

    async function sendMessage(text: string) {
        const trimmed = text.trim();
        if (!trimmed) return;

        const history = messages.map((message) => ({
            role: message.from === "user" ? "user" as const : "assistant" as const,
            content: message.text,
        }));

        setMessages((prev) => [
            ...prev,
            { from: "user" as const, text: trimmed },
            { from: "bot" as const, text: "Thinking..." },
        ]);
        setInput("");

        try {
            const response = await chatWithAI(trimmed, history);

            setMessages((prev) => {
                const updated = [...prev];
                const thinkingIndex = updated.findLastIndex((message) => message.from === "bot" && message.text === "Thinking...");
                if (thinkingIndex !== -1) {
                    updated[thinkingIndex] = { from: "bot", text: response };
                }
                return updated;
            });
        } catch (error) {
            console.error("Chat error", error);
            setMessages((prev) => {
                const updated = [...prev];
                const thinkingIndex = updated.findLastIndex((message) => message.from === "bot" && message.text === "Thinking...");
                if (thinkingIndex !== -1) {
                    updated[thinkingIndex] = { from: "bot", text: "AI service is unavailable right now. Please try again in a moment." };
                }
                return updated;
            });
        }
    }

    function handleQuickReply(text: string) {
        void sendMessage(text);
    }

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, open]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (!dragState.current.active || !widgetRef.current) return;
            const nextX = event.clientX - dragState.current.offsetX;
            const nextY = event.clientY - dragState.current.offsetY;
            const maxX = window.innerWidth - (widgetRef.current.offsetWidth || 360) - 12;
            const maxY = window.innerHeight - (widgetRef.current.offsetHeight || 80) - 12;
            setPosition({
                x: Math.min(Math.max(nextX, 12), maxX),
                y: Math.min(Math.max(nextY, 12), maxY),
            });
        };

        const stopDragging = () => {
            dragState.current.active = false;
        };

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", stopDragging);
        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", stopDragging);
        };
    }, []);

    function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
        if (!widgetRef.current) return;
        if ((event.target as HTMLElement).closest(".close-button, .chat-toggle-button")) return;
        dragState.current.active = true;
        const rect = widgetRef.current.getBoundingClientRect();
        dragState.current.offsetX = event.clientX - rect.left;
        dragState.current.offsetY = event.clientY - rect.top;
        widgetRef.current.setPointerCapture(event.pointerId);
    }

    function openChat(event: ReactMouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
    }

    const onHomePage = location.pathname === "/" || location.pathname === "/landing";

    return (
        <div
            ref={widgetRef}
            className={`chat-widget ${open ? "open" : ""}${onHomePage ? " chat-widget--home" : ""}`}
            style={{ left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" }}
        >
            <div className="chat-header" onPointerDown={handleDragStart}>
                <button
                    type="button"
                    className="chat-toggle-button"
                    aria-label="Open chat"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={openChat}
                >
                    <MessageCircle size={18} />
                </button>
                <span>AETHRIX Assistant</span>
                <button
                    type="button"
                    className="close-button"
                    aria-label="Close chat"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpen(false);
                        setInput("");
                    }}
                >
                    <X size={16} />
                </button>
            </div>

            {open && (
                <div className="chat-body">
                    <div className="chat-messages">
                        {messages.map((message, index) => (
                            <div key={index} className={`chat-message ${message.from}`}>
                                <span>{message.text}</span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="chat-footer">
                        <div className="chat-replies">
                            {quickReplies.map((reply) => (
                                <button key={reply} type="button" onClick={() => handleQuickReply(reply)}>
                                    {reply}
                                </button>
                            ))}
                        </div>
                        <form
                            className="chat-input"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void sendMessage(input);
                            }}
                        >
                            <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about dashboards or OTP…" />
                            <button type="submit">
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
