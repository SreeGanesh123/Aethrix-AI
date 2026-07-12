import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";

interface SessionExpiredModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SessionExpiredModal({ isOpen, onClose }: SessionExpiredModalProps) {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(5);

    const handleSignIn = useCallback(() => {
        navigate("/login");
        onClose();
    }, [navigate, onClose]);

    useEffect(() => {
        if (!isOpen) return;

        const timer = window.setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSignIn();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, handleSignIn]);

    if (!isOpen) return null;

    return (
        <div className="app-modal-backdrop">
            <div className="app-modal-card">
                <div className="app-modal-icon app-modal-icon--danger">
                    <AlertCircle size={40} />
                </div>
                <h2>Session Expired</h2>
                <p>Your session has ended for security reasons. Please sign in again to continue.</p>
                <div className="status-callout status-callout--error">
                    Redirecting in {countdown} second{countdown !== 1 ? "s" : ""}...
                </div>
                <button type="button" className="primary-cta full-width" onClick={handleSignIn}>
                    Sign In Now
                </button>
            </div>
        </div>
    );
}
