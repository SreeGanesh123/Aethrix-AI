import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, LockKeyhole, UserRound, ShieldAlert, BriefcaseBusiness, GraduationCap } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import RoleSelect from "../components/RoleSelect";
import { sendRegistrationOtp, verifyOtp } from "../services/authService";
import type { Gender, Role } from "../utils/auth";

const roles: { id: Role; label: string; icon: React.ReactNode; route: string; desc: string }[] = [
    { id: "candidate", label: "Candidate", icon: <UserRound size={17} />, route: "/candidate", desc: "Browse jobs, track applications, view AI match scores." },
    { id: "recruiter", label: "Recruiter", icon: <BriefcaseBusiness size={17} />, route: "/recruiter", desc: "Post jobs, screen candidates, manage hiring pipeline." },
    { id: "trainer", label: "Trainer", icon: <GraduationCap size={17} />, route: "/trainer", desc: "Assign skill courses, track learner progress and assessments." },
    { id: "super-admin", label: "Super Admin", icon: <ShieldAlert size={17} />, route: "/admin", desc: "Full platform access — users, roles, system health." },
];

export default function Register() {
    const [role, setRole] = useState<Role>("candidate");
    const [form, setForm] = useState<{ name: string; email: string; password: string; confirm: string; gender: Gender }>({
        name: "",
        email: "",
        password: "",
        confirm: "",
        gender: "male",
    });
    const [error, setError] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const active = roles.find((r) => r.id === role)!;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name || !form.email || !form.password || !form.confirm) {
            setError("All fields are required.");
            return;
        }
        if (form.password !== form.confirm) {
            setError("Passwords do not match.");
            return;
        }
        setLoading(true);
        setError('');

        try {
            const data = await sendRegistrationOtp({
                name: form.name,
                email: form.email,
                password: form.password,
                role,
                gender: form.gender,
            });

            setLoading(false);
            if (data.ok) {
                setOtpSent(true);
                setOtp("");
                setError("OTP sent to your email. Please check your inbox.");
                return;
            }

            setError(data.error || 'Unable to send OTP. Please try again.');
        } catch (err) {
            setLoading(false);
            setError(err instanceof Error ? err.message : 'Mail delivery failed. Please try again.');
            console.error(err);
        }
    }

    async function handleVerify(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await verifyOtp(form.email, otp);
            setLoading(false);
            if (data.ok) {
                setError("");
                navigate('/login');
                return;
            }
            setError(data.error || 'Invalid code');
        } catch (err) {
            setLoading(false);
            setError(err instanceof Error ? err.message : 'Verification failed');
            console.error(err);
        }
    }

    return (
        <main className="auth-page">
            <div className="page-topbar">
                <Link to="/" className="back-link">
                    <ArrowLeft size={18} /> Back to home
                </Link>
                <ThemeToggle />
            </div>

            <section className="auth-shell">
                <div className="auth-panel">
                    <span className="eyebrow">Create your account</span>
                    <h1>Register on AETHRIX AI</h1>
                    <p>Choose your role, enter your details, and start using the platform.</p>

                    <RoleSelect
                        options={roles.map((r) => ({ id: r.id, label: r.label }))}
                        value={role}
                        onChange={(v) => setRole(v as Role)}
                        ariaLabel="Select role"
                    />

                    <p className="role-desc">{active.desc}</p>

                    <form className="auth-form" onSubmit={otpSent ? handleVerify : handleSubmit}>
                        <label>
                            <span>Full name</span>
                            <div className="input-wrap">
                                <UserRound size={17} />
                                <input
                                    type="text"
                                    placeholder="Alex Chen"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                />
                            </div>
                        </label>

                        <label>
                            <span>Gender</span>
                            <div className="input-wrap input-wrap--gender">
                                <UserRound size={17} />
                                <RoleSelect
                                    options={[
                                        { id: 'male', label: 'Male' },
                                        { id: 'female', label: 'Female' },
                                        { id: 'non-binary', label: 'Non-binary' },
                                        { id: 'prefer-not-to-say', label: 'Prefer not to say' },
                                    ]}
                                    value={form.gender}
                                    onChange={(value) => setForm({ ...form, gender: value as Gender })}
                                    ariaLabel="Select gender"
                                />
                            </div>
                        </label>

                        <label>
                            <span>Email address</span>
                            <div className="input-wrap input-wrap--email">
                                <Mail size={17} />
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    placeholder="you@company.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
                                />
                            </div>
                        </label>

                        <label>
                            <span>Password</span>
                            <div className="input-wrap">
                                <LockKeyhole size={17} />
                                <input
                                    type="password"
                                    placeholder="Create password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    required
                                />
                            </div>
                        </label>

                        {!otpSent && (
                            <label>
                                <span>Confirm password</span>
                                <div className="input-wrap">
                                    <LockKeyhole size={17} />
                                    <input
                                        type="password"
                                        placeholder="Confirm password"
                                        value={form.confirm}
                                        onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                                        required
                                    />
                                </div>
                            </label>
                        )}

                        {otpSent && (
                            <>
                                <p className="otp-info">A verification code has been sent to {form.email}. Please enter it below.</p>
                                <label>
                                    <span>Verification code</span>
                                    <div className="input-wrap">
                                        <input
                                            type="text"
                                            placeholder="Enter 6-digit code"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            required
                                        />
                                    </div>
                                </label>
                            </>
                        )}

                        {error && <p className="form-error">{error}</p>}

                        <button type="submit" className="primary-cta full-width" disabled={loading}>
                            {otpSent ? 'Verify code' : (<><span style={{ marginRight: 8 }}>{active.icon}</span>Create {active.label} account</>)}
                        </button>

                    </form>

                    <p className="auth-switch">
                        Already have an account? <Link to="/login" className="auth-switch-btn">Sign in</Link>
                    </p>
                </div>

                <aside className="auth-aside">
                    <strong>New to AETHRIX AI?</strong>
                    <div>
                        <span>100%</span>
                        <p>secure AI-first onboarding</p>
                    </div>
                    <div>
                        <span>24</span>
                        <p>hours to complete setup</p>
                    </div>
                    <div>
                        <span>50+</span>
                        <p>custom workflows available</p>
                    </div>
                    <div>
                        <span>4</span>
                        <p>distinct user roles supported</p>
                    </div>
                </aside>
            </section>
        </main>
    );
}
