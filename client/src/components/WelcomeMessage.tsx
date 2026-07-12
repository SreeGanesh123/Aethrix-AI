import { useEffect, useState } from "react";
import { getStoredUser } from "../utils/auth";
import type { AuthUser } from "../utils/auth";

export default function WelcomeMessage() {
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        setUser(getStoredUser());
    }, []);

    if (!user) return null;

    const firstName = user.name.trim().split(" ")[0] || user.name;
    const title = user.gender === "female" ? "Mrs" : "Mr";

    return <p className="dashboard-welcome">Welcome {title} {firstName}</p>;
}
