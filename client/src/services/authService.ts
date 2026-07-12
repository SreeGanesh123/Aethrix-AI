import type { AuthUser } from "../utils/auth";

const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';

interface SendOtpResponse {
    ok: boolean;
    preview?: string | null;
    devOtp?: string | null;
    mailError?: string;
    error?: string;
}

interface VerifyOtpResponse {
    ok: boolean;
    user?: AuthUser;
    error?: string;
}

interface LoginResponse {
    ok: boolean;
    twoFactor?: boolean;
    message?: string;
    preview?: string | null;
    devOtp?: string | null;
    user?: AuthUser;
    error?: string;
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
    if (!text) {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return {} as T;
    }

    let data: T;
    try {
        data = JSON.parse(text) as T;
    } catch {
        throw new Error(`Invalid JSON response from ${path}`);
    }

    if (!response.ok) {
        const anyData = data as any;
        throw new Error(anyData.error || `Request failed: ${response.status}`);
    }

    return data;
}

export async function sendRegistrationOtp(payload: {
    name: string;
    email: string;
    password: string;
    role: AuthUser['role'];
    gender: AuthUser['gender'];
}): Promise<SendOtpResponse> {
    return request<SendOtpResponse>("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function sendLoginOtp(payload: { email: string }): Promise<SendOtpResponse> {
    return request<SendOtpResponse>("/api/auth/send-login-otp", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function verifyLoginOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
    return request<VerifyOtpResponse>("/api/auth/verify-login-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
    });
}
export async function verifyOtp(email: string, otp: string): Promise<VerifyOtpResponse> {
    return request<VerifyOtpResponse>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
    });
}

export async function forgotPassword(payload: { email: string; name: string; role?: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
    return request<{ ok: boolean; message?: string; error?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function resetPassword(payload: { email: string; otp: string; password: string; confirmPassword: string }): Promise<{ ok: boolean; message?: string; error?: string }> {
    return request<{ ok: boolean; message?: string; error?: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function login(email: string, password: string): Promise<LoginResponse> {
    return request<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
}

export async function getCurrentSession(): Promise<VerifyOtpResponse> {
    return request<VerifyOtpResponse>("/api/auth/me");
}

export async function extendSession(): Promise<VerifyOtpResponse> {
    return request<VerifyOtpResponse>("/api/auth/session/extend", {
        method: "POST",
    });
}

export async function logout(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
    });
}
