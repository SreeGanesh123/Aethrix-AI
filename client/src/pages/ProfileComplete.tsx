import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import { getStoredUser, saveUser } from "../utils/auth";
import { getUser, updateUser } from "../services/userService";
import type { AuthUser } from "../utils/auth";

const requiredProfileFields = [
    { key: "name", label: "Full Name" },
    { key: "email", label: "Email" },
    { key: "role", label: "Role" },
    { key: "gender", label: "Gender" },
    { key: "phone", label: "Phone" },
    { key: "dob", label: "Date of Birth" },
    { key: "address", label: "Address" },
    { key: "education", label: "Highest qualification" },
    { key: "university", label: "University" },
    { key: "graduationYear", label: "Graduation Year" },
    { key: "experience", label: "Experience" },
    { key: "skills", label: "Skills" },
    { key: "resume", label: "Resume" },
    { key: "linkedIn", label: "LinkedIn" },
    { key: "github", label: "GitHub" },
    { key: "portfolio", label: "Portfolio" },
    { key: "preferredJobRole", label: "Preferred Job Role" },
    { key: "preferredLocation", label: "Preferred Location" },
];

export default function ProfileComplete() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const returnTo = params.get("return") || "/assessment/test";
    const storedUser = getStoredUser();
    const [formValues, setFormValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        requiredProfileFields.forEach((field) => {
            initial[field.key] = storedUser?.[field.key as keyof AuthUser] as string || "";
        });
        return initial;
    });
    const [savedMessage, setSavedMessage] = useState("Your profile changes are saved automatically.");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const missingFieldsData = useMemo(
        () => requiredProfileFields.filter((field) => !formValues[field.key]),
        [formValues],
    );

    const allFilled = missingFieldsData.length === 0;

    useEffect(() => {
        const hasAnyValue = Object.values(formValues).some(Boolean) || Boolean(storedUser);
        if (!hasAnyValue) return;

        const updated: AuthUser = {
            ...storedUser,
            ...formValues,
            name: formValues.name || storedUser?.name || "",
            email: formValues.email || storedUser?.email || "",
            password: storedUser?.password || "",
            role: (formValues.role as any) || storedUser?.role || "candidate",
            gender: (formValues.gender as any) || storedUser?.gender,
        } as AuthUser;

        saveUser(updated);
        setSavedMessage(allFilled
            ? "All required fields are complete. Redirecting back to the assessment..."
            : "Your answers are saved automatically as you type.");
    }, [formValues, allFilled, storedUser]);

    useEffect(() => {
        const currentEmail = storedUser?.email ?? "";
        if (!currentEmail) return;
        let isMounted = true;

        async function loadRemoteUser() {
            try {
                const remoteUser = await getUser(currentEmail);
                if (!isMounted) return;

                const initial: Record<string, string> = {};
                requiredProfileFields.forEach((field) => {
                    initial[field.key] = String(remoteUser[field.key as keyof AuthUser] || "");
                });
                setFormValues(initial);
                saveUser({ ...storedUser, ...remoteUser });
            } catch (error) {
                console.error("Failed to load profile from server:", error);
            }
        }

        void loadRemoteUser();
        return () => {
            isMounted = false;
        };
    }, [storedUser?.email, storedUser]);

    useEffect(() => {
        const currentEmail = storedUser?.email;
        if (typeof currentEmail !== "string" || !currentEmail) return;

        const timer = window.setTimeout(() => {
            setIsSaving(true);
            setSaveError(null);

            updateUser(currentEmail, formValues)
                .then((updatedUser) => {
                    saveUser({ ...storedUser, ...updatedUser });
                })
                .catch((error) => {
                    console.error("Failed to save profile to server:", error);
                    setSaveError("Unable to save profile updates to server.");
                })
                .finally(() => {
                    setIsSaving(false);
                });
        }, 600);

        return () => {
            window.clearTimeout(timer);
        };
    }, [formValues, storedUser?.email, storedUser]);

    useEffect(() => {
        if (!allFilled) return;
        const timer = window.setTimeout(() => navigate(returnTo), 1400);
        return () => window.clearTimeout(timer);
    }, [allFilled, navigate, returnTo]);

    return (
        <main className="dashboard-page">
            <header className="dashboard-header">
                <Link to="/assessment" className="back-link">
                    <ArrowLeft size={18} />
                    Back to assessment hub
                </Link>
                <div>
                    <span>AETHRIX AI</span>
                    <h1>Complete your profile</h1>
                    <p>Fill the missing required profile fields in one dedicated page. Your data is saved automatically.</p>
                </div>
                <div className="dashboard-actions">
                    <ThemeToggle />
                    <Link to="/candidate" className="ghost-link">
                        Candidate profile
                    </Link>
                </div>
            </header>

            <section className="dashboard-grid test-grid">
                <article className="dash-card test-card">
                    <span className="card-kicker">Profile completion</span>
                    <h2>Required details</h2>
                    <p>Complete the missing fields below to unlock the exam. There is no submit button; changes are stored automatically.</p>
                    <div className="field-summary">
                        <div>
                            <span>Fields remaining</span>
                            <strong>{missingFieldsData.length}</strong>
                        </div>
                        <div>
                            <span>Status</span>
                            <strong>{allFilled ? "Ready to return" : "Awaiting input"}</strong>
                        </div>
                    </div>
                    {saveError && <p className="form-error">{saveError}</p>}
                    {isSaving && <p className="form-note">Saving changes…</p>}
                    {allFilled && (
                        <div className="profile-ready">
                            <ShieldCheck size={18} />
                            <span>{savedMessage}</span>
                        </div>
                    )}
                    {!allFilled && (
                        <div className="field-checklist">
                            {missingFieldsData.map((field) => (
                                <div key={field.key} className="field-item">
                                    <CheckCircle2 size={16} />
                                    <span>{field.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </article>

                <article className="dash-card test-start-card">
                    <span className="card-kicker">Direct profile fields</span>
                    <div className="profile-form">
                        <div className="profile-form-grid">
                            {requiredProfileFields.map((field) => (
                                <label key={field.key}>
                                    <span>{field.label}</span>
                                    <input
                                        type="text"
                                        value={formValues[field.key] || ""}
                                        onChange={(e) => setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                        placeholder={`Enter ${field.label}`}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>
                    <p className="form-note">No submit button is required here; your profile updates are saved as soon as you type.</p>
                </article>

                <article className="dash-card exam-info-card">
                    <span className="card-kicker">Saved progress</span>
                    <p>{savedMessage}</p>
                    <ul>
                        <li>All required fields are saved automatically.</li>
                        <li>If the form is complete, you will return to the assessment page shortly.</li>
                        <li>If you want, you can manually go back to the exam hub or candidate profile.</li>
                    </ul>
                </article>
            </section>
        </main>
    );
}
