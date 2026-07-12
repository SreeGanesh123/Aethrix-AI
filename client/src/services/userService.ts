import type { AuthUser } from "../utils/auth";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:4000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        ...options,
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Request failed: ${response.status}`);
    }

    return response.json();
}

export async function getUsers(): Promise<AuthUser[]> {
    const data = await request<{ ok: boolean; users: AuthUser[] }>("/api/users");
    return data.users;
}

export async function getUser(email: string): Promise<AuthUser> {
    const data = await request<{ ok: boolean; user: AuthUser }>(`/api/users/${encodeURIComponent(email)}`);
    return data.user;
}

export async function createUser(user: AuthUser): Promise<AuthUser> {
    const data = await request<{ ok: boolean; user: AuthUser }>("/api/users", {
        method: "POST",
        body: JSON.stringify(user),
    });
    return data.user;
}

export async function updateUser(email: string, updates: Partial<AuthUser>): Promise<AuthUser> {
    const data = await request<{ ok: boolean; user: AuthUser }>(`/api/users/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify(updates),
    });
    return data.user;
}

export async function deleteUser(email: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
    });
}
