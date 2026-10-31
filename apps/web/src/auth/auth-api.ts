export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "TEACHER" | "ADMIN";
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function parseApi<T>(response: Response): Promise<T> {
  const payload: ApiEnvelope<T> = await response.json();
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error?.message ?? `Request failed (${response.status})`);
  }
  return payload.data;
}

export async function loginRequest(email: string, password: string): Promise<string> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseApi<{ accessToken?: string; token?: string }>(response);
  const token = data.accessToken ?? data.token;
  if (!token) throw new Error("Login response did not include an access token");
  return token;
}

export async function meRequest(token: string): Promise<AuthUser> {
  const response = await fetch("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseApi<{ user: AuthUser }>(response);
  if (!data.user || !["TEACHER", "ADMIN"].includes(data.user.role)) {
    throw new Error("This account cannot access ClassFlow");
  }
  return data.user;
}
