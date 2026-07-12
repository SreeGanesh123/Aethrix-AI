import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LockKeyhole, Mail, ShieldAlert, BriefcaseBusiness, UserRound, GraduationCap } from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import RoleSelect from "../components/RoleSelect";
import { getRoleHomeRoute, saveUser, startUserSession } from "../utils/auth";
import { login, sendLoginOtp, verifyLoginOtp, sendRegistrationOtp, verifyOtp, forgotPassword, resetPassword } from "../services/authService";
import type { Gender, Role } from "../utils/auth";

const roles: { id: Role; label: string; icon: React.ReactNode; route: string; desc: string }[] = [
  { id: "candidate", label: "Candidate", icon: <UserRound size={17} />, route: "/candidate", desc: "Browse jobs, track applications, view AI match scores." },
  { id: "recruiter", label: "Recruiter", icon: <BriefcaseBusiness size={17} />, route: "/recruiter", desc: "Post jobs, screen candidates, manage hiring pipeline." },
  { id: "trainer", label: "Trainer", icon: <GraduationCap size={17} />, route: "/trainer", desc: "Assign skill courses, track learner progress and assessments." },
  { id: "super-admin", label: "Super Admin", icon: <ShieldAlert size={17} />, route: "/admin", desc: "Full platform access — users, roles, system health." },
];

export default function Login() {
  const [role, setRole] = useState<Role>("candidate");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [form, setForm] = useState<{ name: string; email: string; password: string; confirm: string; gender: Gender }>({
    name: "",
    email: "",
    password: "",
    confirm: "",
    gender: "male",
  });
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");

  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const active = roles.find((r) => r.id === role)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (mode === "forgot") {
      if (!form.email || !form.name) {
        setError("Email and full name are required.");
        return;
      }

      if (forgotStep === "request") {
        setLoading(true);
        try {
          const data = await forgotPassword({ email: form.email, name: form.name, role });
          if (data.ok) {
            setForgotStep("reset");
            setOtpSent(true);
            setError(data.message || "Reset code sent. Enter it below to create a new password.");
            return;
          }
          setError(data.error || "Unable to process password reset.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Request failed.");
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!otp) {
        setError("Enter the reset code.");
        return;
      }

      if (!newPassword || !confirmNewPassword) {
        setError("Please enter and confirm your new password.");
        return;
      }

      if (newPassword !== confirmNewPassword) {
        setError("Passwords do not match.");
        return;
      }

      setLoading(true);
      try {
        const data = await resetPassword({ email: form.email, otp, password: newPassword, confirmPassword: confirmNewPassword });
        if (data.ok) {
          setError("Password updated successfully. Please sign in.");
          setMode("login");
          setForgotStep("request");
          setOtpSent(false);
          setOtp("");
          setNewPassword("");
          setConfirmNewPassword("");
          setForm((current) => ({ ...current, password: "", confirm: "" }));
          return;
        }
        setError(data.error || "Unable to reset password.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!form.email) {
      setError("Email is required.");
      return;
    }

    if (mode === "signup" || authMethod === "password") {
      if (!form.password) {
        setError("Password is required.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        if (authMethod === "password") {
          if (!form.password) {
            setError("Email and password are required.");
            return;
          }

          if (!otpSent) {
            const data = await login(form.email, form.password);
            if (data.ok && data.twoFactor) {
              setOtpSent(true);
              setError(data.message || "OTP sent to your email. Please check your inbox.");
              return;
            }

            if (data.ok && data.user) {
              startUserSession(data.user);
              saveUser(data.user);
              setError("");
              navigate(getRoleHomeRoute(data.user.role));
              return;
            }

            setError(data.error || "Invalid email or password.");
            return;
          }

          if (!otp) {
            setError("Enter the OTP code.");
            return;
          }

          const data = await verifyLoginOtp(form.email, otp);
          if (data.ok && data.user) {
            startUserSession(data.user);
            saveUser(data.user);
            setError("");
            navigate(getRoleHomeRoute(data.user.role));
            return;
          }

          setError(data.error || "Invalid OTP code.");
          return;
        }

        if (!otpSent) {
          const data = await sendLoginOtp({ email: form.email });
          if (data.ok) {
            setOtpSent(true);
            setError("OTP sent to your email. Please check your inbox.");
            return;
          }

          setError(data.error || "Unable to send OTP. Please try again.");
          return;
        }

        if (!otp) {
          setError("Enter the OTP code.");
          return;
        }

        const data = await verifyLoginOtp(form.email, otp);
        if (data.ok && data.user) {
          startUserSession(data.user);
          saveUser(data.user);
          setError("");
          navigate(getRoleHomeRoute(data.user.role));
          return;
        }

        setError(data.error || "Invalid OTP code.");
        return;
      } else {
        if (!otpSent) {
          if (!form.confirm) {
            setError("Confirm password is required.");
            return;
          }
          if (form.password !== form.confirm) {
            setError("Passwords do not match.");
            return;
          }

          const data = await sendRegistrationOtp({
            name: form.name,
            email: form.email,
            password: form.password,
            role,
            gender: form.gender,
          });

          if (data.ok) {
            setOtpSent(true);
            setError("OTP sent to your email. Please check your inbox.");
            return;
          }

          setError(data.error || "Unable to send OTP. Please try again.");
          return;
        }

        if (!otp) {
          setError("Enter the OTP code.");
          return;
        }

        const data = await verifyOtp(form.email, otp);
        if (data.ok) {
          setError("");
          setMode("login");
          setOtpSent(false);
          setOtp("");
          setError("Registration complete. Please sign in.");
          return;
        }

        setError(data.error || "Invalid OTP code.");
        return;
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Request failed. Please try again.");
    } finally {
      setLoading(false);
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
        {/* LEFT — form panel */}
        <div className="auth-panel">
          <span className="eyebrow">{mode === "login" ? "Welcome back" : mode === "forgot" ? "Reset access" : "Get started"}</span>
          <h1>{mode === "login" ? "Sign in to AETHRIX AI" : mode === "forgot" ? "Recover your account" : "Create your account"}</h1>
          <p>{mode === "forgot" ? "Provide your registered details to receive a reset code and create a new password." : "Select your role below, then enter your credentials to continue."}</p>

          {/* Custom role select (replaces native select) */}
          <RoleSelect
            options={roles.map((r) => ({ id: r.id, label: r.label }))}
            value={role}
            onChange={(v) => setRole(v as Role)}
            ariaLabel="Select role"
          />
          {/* Role tabs removed — using dropdown only */}

          {/* Role description */}
          <p className="role-desc">{active.desc}</p>



          <form className="auth-form" onSubmit={handleSubmit}>
            {(mode === "signup" || mode === "forgot") && (
              <>
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

                {mode === "signup" && (
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
                )}
              </>
            )}

            <label>
              <span>Email address</span>
              <div className="input-wrap input-wrap--email">
                <Mail size={17} />
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </label>

            {(mode === "signup" || mode === "forgot" || authMethod === "password") && (
              <label>
                <span>Password</span>
                <div className="input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={mode === "signup" || authMethod === "password"}
                  />
                </div>
              </label>
            )}

            {mode === "signup" && !otpSent && (
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

            {(mode === "signup" && otpSent) || (mode === "login" && otpSent) || (mode === "forgot" && otpSent) ? (
              <label>
                <span>OTP code</span>
                <div className="input-wrap">
                  <LockKeyhole size={17} />
                  <input
                    type="text"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
              </label>
            ) : null}

            <button type="submit" className="primary-cta full-width" disabled={loading}>
              {active.icon}
              {mode === "forgot"
                ? forgotStep === "request"
                  ? "Send reset code"
                  : "Reset password"
                : mode === "signup"
                  ? `Create ${active.label} account`
                  : otpSent
                    ? "Verify OTP"
                    : authMethod === "otp"
                      ? "Send OTP"
                      : `Continue as ${active.label}`}
            </button>

            {mode === "login" && (
              <p className="auth-switch">
                {authMethod === "password" ? (
                  <>
                    Prefer passwordless?{' '}
                    <button
                      type="button"
                      className="auth-switch-btn"
                      onClick={() => {
                        setAuthMethod("otp");
                        setOtpSent(false);
                        setOtp("");
                        setError("");
                      }}
                    >
                      Login with OTP
                    </button>
                  </>
                ) : (
                  <>
                    Have a password?{' '}
                    <button
                      type="button"
                      className="auth-switch-btn"
                      onClick={() => {
                        setAuthMethod("password");
                        setOtpSent(false);
                        setOtp("");
                        setError("");
                      }}
                    >
                      Login with password
                    </button>
                  </>
                )}
              </p>
            )}
          </form>

          {error && <p className="form-note">{error}</p>}

          <p className="auth-switch">
            {mode === "forgot" ? (
              <>
                Remembered your password?{' '}
                <button type="button" className="auth-switch-btn" onClick={() => { setMode("login"); setForgotStep("request"); setOtpSent(false); setOtp(""); setNewPassword(""); setConfirmNewPassword(""); setError(""); }}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                {mode === "login" ? "Don't have an account? " : "Already have an account? "}
                <button type="button" className="auth-switch-btn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                  {mode === "login" ? "Sign up" : "Sign in"}
                </button>
              </>
            )}
          </p>

          {mode !== "forgot" && (
            <p className="auth-switch">
              <button type="button" className="auth-switch-btn" onClick={() => { setMode("forgot"); setForgotStep("request"); setOtpSent(false); setOtp(""); setNewPassword(""); setConfirmNewPassword(""); setError(""); }}>
                Forgot password?
              </button>
            </p>
          )}
        </div>

        {/* RIGHT — stats aside */}
        <aside className="auth-aside">
          <strong>Live on AETHRIX AI</strong>
          <div>
            <span>142</span>
            <p>candidates screened today</p>
          </div>
          <div>
            <span>24</span>
            <p>interviews scheduled this week</p>
          </div>
          <div>
            <span>98%</span>
            <p>AI match accuracy</p>
          </div>
          <div>
            <span>4</span>
            <p>active trainer cohorts</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
