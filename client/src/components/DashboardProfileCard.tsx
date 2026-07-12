import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Camera, Check, Globe, Link as LinkIcon, MapPin, Pencil, Save, Send, UserRound, X } from "lucide-react";
import { getStoredUser, saveUser, type AuthUser } from "../utils/auth";
import { updateUser } from "../services/userService";
import {
  generateInterviewQuestionsWithAI,
  generateLessonPlanWithAI,
  generateJobDescriptionWithAI,
  rewriteResumeWithAI,
} from "../services/aiService";

type ProfileForm = {
  name: string;
  headline: string;
  bio: string;
  phone: string;
  address: string;
  company: string;
  education: string;
  skills: string;
  linkedIn: string;
  github: string;
  portfolio: string;
  website: string;
  preferredJobRole: string;
  preferredLocation: string;
  profilePicture: string;
};

const editableFields: Array<{ key: keyof ProfileForm; label: string; placeholder: string; icon?: React.ReactNode }> = [
  { key: "name", label: "Full name", placeholder: "Your name", icon: <UserRound size={16} /> },
  { key: "headline", label: "Headline", placeholder: "Frontend engineer, recruiter, trainer..." },
  { key: "phone", label: "Phone", placeholder: "+91 98765 43210" },
  { key: "address", label: "Address", placeholder: "City, state, country", icon: <MapPin size={16} /> },
  { key: "company", label: "Company / organization", placeholder: "AETHRIX AI" },
  { key: "preferredJobRole", label: "Target role", placeholder: "Frontend Engineer" },
  { key: "preferredLocation", label: "Preferred location", placeholder: "Hyderabad / Remote", icon: <MapPin size={16} /> },
  { key: "education", label: "Highest qualification", placeholder: "B.Tech / M.Tech" },
  { key: "skills", label: "Skills", placeholder: "React, Node.js, MongoDB" },
  { key: "linkedIn", label: "LinkedIn", placeholder: "https://linkedin.com/in/you", icon: <LinkIcon size={16} /> },
  { key: "github", label: "GitHub", placeholder: "https://github.com/you", icon: <LinkIcon size={16} /> },
  { key: "portfolio", label: "Portfolio", placeholder: "https://yourportfolio.com", icon: <Globe size={16} /> },
  { key: "website", label: "Website", placeholder: "https://your-site.com", icon: <Globe size={16} /> },
];

function userToForm(user: AuthUser | null): ProfileForm {
  return {
    name: user?.name || "",
    headline: user?.headline || "",
    bio: user?.bio || "",
    phone: user?.phone || "",
    address: user?.address || "",
    company: user?.company || "",
    education: user?.education || "",
    skills: user?.skills || "",
    linkedIn: user?.linkedIn || "",
    github: user?.github || "",
    portfolio: user?.portfolio || "",
    website: user?.website || "",
    preferredJobRole: user?.preferredJobRole || "",
    preferredLocation: user?.preferredLocation || "",
    profilePicture: user?.profilePicture || "",
  };
}

function InlineName({ value, onChange, onSave, saving }: {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function confirm() {
    setEditing(false);
    onSave();
  }

  function cancel(original: string) {
    onChange(original);
    setEditing(false);
  }

  const original = useRef(value);

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 8, cursor: "pointer",
    flexShrink: 0, border: "none", padding: 0,
  };

  return editing ? (
    <div className="inline-name-edit">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(original.current); }}
        className="inline-name-input"
      />
      <button type="button" onClick={confirm} disabled={saving} title="Save"
        style={{ ...btnBase, background: "rgba(46,232,211,0.25)", color: "#2ee8d3" }}>
        <Check size={18} strokeWidth={2.5} />
      </button>
      <button type="button" onClick={() => cancel(original.current)} title="Cancel"
        style={{ ...btnBase, background: "rgba(239,68,68,0.2)", color: "#ff9aa5" }}>
        <X size={18} strokeWidth={2.5} />
      </button>
    </div>
  ) : (
    <div className="inline-name-view">
      <h2>{value || "Complete your profile"}</h2>
      <button type="button" onClick={() => { original.current = value; setEditing(true); }} title="Edit name"
        style={{ ...btnBase, background: "rgba(46,232,211,0.15)", color: "#2ee8d3" }}>
        <Pencil size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function DashboardProfileCard({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [form, setForm] = useState<ProfileForm>(() => userToForm(getStoredUser()));
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [cropDims, setCropDims] = useState({ width: 0, height: 0 });
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropSize, setCropSize] = useState(120);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const cropPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const syncUser = () => {
      const latest = getStoredUser();
      setUser(latest);
      setForm(userToForm(latest));
    };

    window.addEventListener("aethrix-auth-change", syncUser);
    return () => window.removeEventListener("aethrix-auth-change", syncUser);
  }, []);

  const initials = useMemo(() => {
    const source = form.name || user?.email || "A";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "A";
  }, [form.name, user?.email]);

  const roleMeta = getRoleFeatureMeta(user?.role ?? "candidate");
  const isReadOnly = !editing;

  function updateField(key: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
    setError(null);
    setAiResult(null);
  }

  function handleStartEditing() {
    setExpanded(true);
    setEditing(true);
    setMessage(null);
    setError(null);
    setAiResult(null);
  }

  function handleCancelEdit() {
    setForm(userToForm(user));
    setEditing(false);
    setExpanded(false);
    setMessage(null);
    setError(null);
    setAiResult(null);
  }

  function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    if (file.size > 900 * 1024) {
      setError("Profile picture must be under 900 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      setCropImageSrc(src);
      setCropError(null);
    };
    reader.onerror = () => setError("Unable to read that image.");
    reader.readAsDataURL(file);
  }

  function handleCropImageLoaded(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    cropImageRef.current = img;
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const size = Math.min(width, height, 320);
    setCropDims({ width, height });
    setCropSize(size);
    setCropX(Math.max(0, Math.round((width - size) / 2)));
    setCropY(Math.max(0, Math.round((height - size) / 2)));
  }

  useEffect(() => {
    if (!cropImageSrc || !cropPreviewCanvasRef.current || !cropImageRef.current) return;
    const canvas = cropPreviewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 260;
    canvas.height = 260;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cropImageRef.current, cropX, cropY, cropSize, cropSize, 0, 0, canvas.width, canvas.height);
  }, [cropImageSrc, cropX, cropY, cropSize]);

  function closeCropModal() {
    setCropImageSrc(null);
    setCropError(null);
  }

  function handleConfirmCrop() {
    if (!cropImageSrc) return;
    const image = new Image();
    image.src = cropImageSrc;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.min(cropSize, image.naturalWidth, image.naturalHeight);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setCropError("Crop failed.");
        return;
      }
      ctx.drawImage(image, cropX, cropY, size, size, 0, 0, size, size);
      const cropped = canvas.toDataURL("image/jpeg", 0.92);
      updateField("profilePicture", cropped);
      closeCropModal();
    };
    image.onerror = () => setCropError("Unable to crop image.");
  }

  async function handleSave() {
    if (!user?.email) {
      setError("Sign in before saving your profile.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await updateUser(user.email, form);
      saveUser({ ...user, ...updated });
      setMessage("Profile saved.");
      setEditing(false);
      setExpanded(false);
    } catch (saveError) {
      console.error("Profile save failed:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  function getRoleFeatureMeta(role: AuthUser["role"]) {
    switch (role) {
      case "candidate":
        return {
          heading: "AI career coach",
          description: "Generate tailored resume and interview tips for your target role.",
          buttonLabel: "Run candidate AI assistant",
        };
      case "recruiter":
        return {
          heading: "AI hiring assistant",
          description: "Generate interview questions and outreach copy for your hiring pipeline.",
          buttonLabel: "Run recruiter AI assistant",
        };
      case "trainer":
        return {
          heading: "AI training planner",
          description: "Generate a role-based lesson plan or training recommendation.",
          buttonLabel: "Run trainer AI assistant",
        };
      default:
        return {
          heading: "AI assistant",
          description: "Generate a quick role-based recommendation.",
          buttonLabel: "Run AI assistant",
        };
    }
  }

  async function handleRunRoleAI() {
    if (!user) return;
    setAiLoading(true);
    setAiResult(null);
    setError(null);
    try {
      if (user.role === "candidate") {
        const result = await rewriteResumeWithAI({ resumeSummary: form.bio || form.headline || "", role: form.preferredJobRole, skills: form.skills });
        setAiResult([result.headline, ...result.bullets].join("\n"));
      } else if (user.role === "recruiter") {
        const result = await generateInterviewQuestionsWithAI({ role: form.preferredJobRole || form.headline || "", skills: form.skills, round: "screening" });
        setAiResult(result.questions.map((q) => `• ${q.type}: ${q.question}`).join("\n"));
      } else if (user.role === "trainer") {
        const result = await generateLessonPlanWithAI({ topic: form.preferredJobRole || form.skills || "Training", level: "intermediate", duration: "4 weeks" });
        setAiResult(result.weeks.map((w) => `Week ${w.week}: ${w.topic} — ${w.activities}`).join("\n"));
      } else {
        const result = await generateJobDescriptionWithAI({ role: form.preferredJobRole || form.headline || "Professional", skills: form.skills, level: "mid" });
        setAiResult([result.title, result.summary, ...result.responsibilities, ...result.requirements].join("\n"));
      }
    } catch (aiError) {
      setError(aiError instanceof Error ? aiError.message : "AI assistant failed.");
    } finally {
      setAiLoading(false);
    }
  }

  if (!user) return null;

  if (!expanded) {
    return (
      <article className="dash-card dashboard-profile-card dashboard-profile-card--collapsed">
        <div className="dashboard-profile-card-collapsed">
          <div>
            <span className="card-kicker">Profile</span>
            <h2>Update your profile</h2>
            <p>Complete your career profile to unlock personalized AI recommendations and certificates.</p>
            {message && <p className="form-note">{message}</p>}
            {error && <p className="form-error">{error}</p>}
          </div>
          <button type="button" className="primary-cta" onClick={handleStartEditing}>
            <Pencil size={18} />
            Edit profile
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`dash-card dashboard-profile-card${compact ? " dashboard-profile-card--compact" : ""}`}>
      <div className="dashboard-profile-head">
        <div className="profile-picture-wrap">
          {form.profilePicture ? (
            <img src={form.profilePicture} alt={`${form.name || "User"} profile`} />
          ) : (
            <span>{initials}</span>
          )}
          {editing && (
            <label className="profile-picture-action" title="Upload profile picture">
              <Camera size={16} />
              <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
            </label>
          )}
        </div>
        <div>
          <span className="card-kicker">Profile</span>
          <InlineName
            value={form.name}
            onChange={(val) => updateField("name", val)}
            onSave={handleSave}
            saving={saving}
          />
          <p>{form.headline || user.email}</p>
        </div>
        {!editing && (
          <button type="button" className="profile-edit-card-btn" onClick={handleStartEditing} title="Edit profile card">
            <Pencil size={18} />
          </button>
        )}
      </div>

      <label className="profile-bio-field">
        <span>Bio</span>
        {isReadOnly ? (
          <p className="profile-bio-static">{form.bio || "Write a short professional summary."}</p>
        ) : (
          <textarea
            rows={compact ? 3 : 4}
            value={form.bio}
            onChange={(event) => updateField("bio", event.target.value)}
            placeholder="Write a short professional summary."
          />
        )}
      </label>

      <div className="dashboard-profile-grid">
        {editableFields.map((field) => (
          <label key={field.key}>
            <span>{field.label}</span>
            {isReadOnly ? (
              <div className="profile-static-value">{form[field.key] || "—"}</div>
            ) : (
              <div className="profile-input-wrap">
                {field.icon}
                <input
                  value={form[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            )}
          </label>
        ))}
      </div>

      <div className="dashboard-profile-actions">
        {editing ? (
          <>
            <button type="button" className="secondary-cta" onClick={handleCancelEdit} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="primary-cta" onClick={() => void handleSave()} disabled={saving}>
              <Save size={18} />
              {saving ? "Saving..." : "Save profile"}
            </button>
          </>
        ) : (
          <button type="button" className="primary-cta" onClick={handleStartEditing}>
            <Pencil size={18} />
            Edit profile
          </button>
        )}
      </div>

      <article className="dash-card ai-role-card">
        <div className="ai-feature-heading">
          <span className="card-kicker">{roleMeta.heading}</span>
          <h2>{roleMeta.description}</h2>
        </div>
        <button type="button" className="primary-cta" onClick={() => void handleRunRoleAI()} disabled={aiLoading}>
          <Send size={18} />
          {aiLoading ? "Running AI..." : roleMeta.buttonLabel}
        </button>
        {aiResult && (
          <div className="ai-result-block">
            <pre>{aiResult}</pre>
          </div>
        )}
      </article>

      {cropImageSrc && (
        <div className="crop-modal-overlay" onClick={closeCropModal}>
          <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crop-modal-header">
              <h3>Crop profile image</h3>
              <button type="button" className="crop-close-btn" onClick={closeCropModal}><X size={18} /></button>
            </div>
            <div className="crop-body">
              <div className="crop-preview">
                <img
                  src={cropImageSrc}
                  alt="Crop preview"
                  onLoad={handleCropImageLoaded}
                  className="crop-source-image"
                />
                <div className="crop-preview-frame" />
              </div>
              <div className="crop-controls">
                <label>
                  <span>X offset</span>
                  <input type="range" min={0} max={Math.max(0, cropDims.width - cropSize)} value={cropX}
                    onChange={(e) => setCropX(Number(e.target.value))} />
                </label>
                <label>
                  <span>Y offset</span>
                  <input type="range" min={0} max={Math.max(0, cropDims.height - cropSize)} value={cropY}
                    onChange={(e) => setCropY(Number(e.target.value))} />
                </label>
                <label>
                  <span>Crop size</span>
                  <input type="range" min={80} max={Math.min(cropDims.width, cropDims.height, 320)} value={cropSize}
                    onChange={(e) => setCropSize(Number(e.target.value))} />
                </label>
                <div className="crop-preview-small">
                  <canvas ref={cropPreviewCanvasRef} />
                </div>
              </div>
            </div>
            {cropError && <p className="form-note error-note">{cropError}</p>}
            <div className="crop-modal-actions">
              <button type="button" className="secondary-cta" onClick={closeCropModal}>Cancel</button>
              <button type="button" className="primary-cta" onClick={handleConfirmCrop}>Apply crop</button>
            </div>
          </div>
        </div>
      )}

      {message && <p className="form-note">{message}</p>}
      {error && <p className="form-note error-note">{error}</p>}
    </article>
  );
}
