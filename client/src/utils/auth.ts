export type Role = "candidate" | "recruiter" | "super-admin" | "trainer";
export type Gender = "male" | "female" | "non-binary" | "prefer-not-to-say";

export type CertificateRecord = {
    id: string;
    issuedAt: string;
    candidateName: string;
    candidateEmail: string;
    examType: string;
    examName: string;
    score: number;
    totalScore: number;
    grade: string;
    passStatus: "pass" | "fail";
    completedDate: string;
};

export type AuthUser = {
    name: string;
    email: string;
    password?: string;
    role: Role;
    gender?: Gender;
    profilePicture?: string;
    headline?: string;
    bio?: string;
    company?: string;
    website?: string;
    phone?: string;
    dob?: string;
    address?: string;
    education?: string;
    university?: string;
    graduationYear?: string;
    experience?: string;
    skills?: string;
    resume?: string;
    linkedIn?: string;
    github?: string;
    portfolio?: string;
    preferredJobRole?: string;
    preferredLocation?: string;
    sessionExpiresAt?: number;
    examPassed?: boolean;
    certificateMeta?: CertificateRecord | null;
    certificates?: CertificateRecord[];
    scheduleEvents?: ScheduleEvent[];
    theme?: "dark" | "light";
};

export type ScheduleEvent = {
    id: string;
    title: string;
    type: "interview" | "assessment" | "training" | "review" | "meeting";
    date: string;
    time: string;
    withPerson?: string;
    mode: "video" | "phone" | "in-person";
    notes?: string;
    createdAt: string;
};

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";
let currentUser: AuthUser | null = null;

function emitAuthChange() {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aethrix-auth-change"));
    }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        ...options,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) as T : ({} as T);
    if (!response.ok) {
        const anyData = data as any;
        throw new Error(anyData.error || `Request failed: ${response.status}`);
    }
    return data;
}

async function persistUserPatch(updates: Partial<AuthUser>) {
    if (!currentUser?.email) return;
    try {
        const data = await request<{ ok: boolean; user: AuthUser }>(`/api/users/${encodeURIComponent(currentUser.email)}`, {
            method: "PUT",
            body: JSON.stringify(updates),
        });
        currentUser = { ...data.user, ...currentUser };
        emitAuthChange();
    } catch (error) {
        console.error("Failed to persist auth state to MongoDB:", error);
    }
}

export async function loadStoredUser(): Promise<AuthUser | null> {
    try {
        const data = await request<{ ok: boolean; user: AuthUser }>("/api/auth/me");
        currentUser = data.user;
    } catch {
        currentUser = null;
    }
    emitAuthChange();
    return currentUser;
}

export function createCertificateId() {
    const suffix = Date.now().toString(36).toUpperCase();
    return `AETHX-${suffix.slice(-8)}`;
}

function normalizeCertificateGrade(cert: CertificateRecord): CertificateRecord {
    const derivedGrade = getGradeFromScore(cert.score, cert.totalScore);
    return {
        ...cert,
        grade: derivedGrade,
    };
}

export function getGradeFromScore(score: number, totalScore: number) {
    const percentage = totalScore > 0 ? (score / totalScore) * 100 : 0;
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    return "F";
}

export function getStoredUser(): AuthUser | null {
    if (currentUser?.sessionExpiresAt && Date.now() > currentUser.sessionExpiresAt) {
        clearStoredUser();
        return null;
    }
    return currentUser;
}

export function getRoleHomeRoute(role: Role) {
    switch (role) {
        case "candidate":
            return "/candidate";
        case "recruiter":
            return "/recruiter";
        case "trainer":
            return "/trainer";
        case "super-admin":
            return "/admin";
        default:
            return "/";
    }
}

export async function saveUser(user: AuthUser) {
    currentUser = { ...currentUser, ...user };
    emitAuthChange();
    if (!currentUser?.email) return;
    try {
        await request<{ ok: boolean; user: AuthUser }>(`/api/users/${encodeURIComponent(currentUser.email)}`, {
            method: "PUT",
            body: JSON.stringify({
                ...user,
                email: currentUser.email,
            }),
        });
    } catch (error) {
        console.error("Failed to sync user updates to server:", error);
    }
}

export function clearStoredUser() {
    currentUser = null;
    if (typeof window !== "undefined") {
        void request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    }
    emitAuthChange();
}

export function startUserSession(user: AuthUser) {
    currentUser = user;
    void request<{ ok: boolean; user: AuthUser }>("/api/auth/session/extend", { method: "POST" })
        .then((data) => {
            currentUser = data.user;
            emitAuthChange();
        })
        .catch(() => {
            const expiresAt = Date.now() + 3 * 60 * 60 * 1000;
            currentUser = { ...user, sessionExpiresAt: user.sessionExpiresAt ?? expiresAt };
            emitAuthChange();
        });
    emitAuthChange();
}

export function isSessionExpired(user: AuthUser) {
    return Boolean(user.sessionExpiresAt && Date.now() > user.sessionExpiresAt);
}

export function getSessionTimeRemaining(user?: AuthUser): number | null {
    if (!user?.sessionExpiresAt) return null;
    const remaining = user.sessionExpiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
}

export function isSessionExpiringSoon(user?: AuthUser, minutesBefore: number = 5): boolean {
    const remaining = getSessionTimeRemaining(user);
    if (!remaining) return false;
    const thresholdMs = minutesBefore * 60 * 1000;
    return remaining <= thresholdMs;
}

export function getExamPassed(email?: string) {
    if (!email || currentUser?.email !== email) return false;
    return Boolean(currentUser.examPassed);
}

export function getCertificateMeta(email?: string) {
    if (!email || currentUser?.email !== email) return null;
    return currentUser.certificateMeta ? normalizeCertificateGrade(currentUser.certificateMeta) : null;
}

export function setCertificateMeta(email: string, meta: CertificateRecord) {
    if (!email || currentUser?.email !== email) return;
    const normalizedMeta = normalizeCertificateGrade(meta);
    currentUser = { ...currentUser, certificateMeta: normalizedMeta };
    emitAuthChange();
    void persistUserPatch({ certificateMeta: normalizedMeta });
}

export function ensureCertificateMeta(email?: string): CertificateRecord | null {
    if (!email) return null;
    return getCertificateMeta(email);
}

export function setExamPassed(email: string) {
    if (!email || currentUser?.email !== email) return;
    currentUser = { ...currentUser, examPassed: true };
    emitAuthChange();
    void persistUserPatch({ examPassed: true });
}

export function addCertificateToSession(email: string, cert: CertificateRecord) {
    if (!email || currentUser?.email !== email) return;
    const certificates = currentUser.certificates ?? [];
    if (certificates.find((item) => item.id === cert.id)) return;

    const normalizedCert = normalizeCertificateGrade(cert);
    const next = [...certificates, normalizedCert];
    currentUser = { ...currentUser, certificates: next };
    emitAuthChange();
    void persistUserPatch({ certificates: next });
}

export function getSessionCertificates(email?: string): CertificateRecord[] {
    if (!email || currentUser?.email !== email) return [];
    return (currentUser.certificates ?? []).map(normalizeCertificateGrade);
}

export function clearSessionCertificates(email?: string) {
    if (!email || currentUser?.email !== email) return;
    currentUser = { ...currentUser, certificates: [] };
    emitAuthChange();
    void persistUserPatch({ certificates: [] });
}
