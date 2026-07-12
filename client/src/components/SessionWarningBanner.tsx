import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStoredUser, startUserSession, getSessionTimeRemaining } from '../utils/auth';

export default function SessionWarningBanner() {
    const [isWarning, setIsWarning] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState<string>('');

    useEffect(() => {
        const checkSession = () => {
            const user = getStoredUser();
            if (!user) return;

            const remaining = getSessionTimeRemaining(user);
            if (!remaining) return;

            // Show warning when 5 minutes or less remain
            if (remaining <= 5 * 60 * 1000 && remaining > 0) {
                setIsWarning(true);
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            } else {
                setIsWarning(false);
            }
        };

        checkSession();
        const interval = window.setInterval(checkSession, 1000);
        return () => window.clearInterval(interval);
    }, []);

    const handleExtendSession = () => {
        const user = getStoredUser();
        if (user) {
            startUserSession(user);
            setIsWarning(false);
        }
    };

    if (!isWarning) return null;

    return (
        <div className="session-warning-banner">
            <div className="session-warning-content">
                <AlertTriangle size={20} />
                <div>
                    <span>Session Expiring Soon</span>
                    <p>
                        Your session will expire in <strong>{timeRemaining}</strong>. Click "Extend" to stay logged in.
                    </p>
                </div>
            </div>

            <button type="button" onClick={handleExtendSession}>
                <RotateCcw size={16} />
                Extend Session
            </button>
        </div>
    );
}
