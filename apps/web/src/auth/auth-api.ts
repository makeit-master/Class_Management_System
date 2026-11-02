import { apiClient } from "../lib/api-client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "TEACHER" | "ADMIN";
};

export async function loginRequest(
  email: string,
  password: string,
): Promise<string> {
  const data = await apiClient<{
    accessToken?: string;
    token?: string;
  }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const token = data.accessToken ?? data.token;

  if (!token) {
    throw new Error("Login response did not include an access token.");
  }

  return token;
}

export async function meRequest(token: string): Promise<AuthUser> {
  const data = await apiClient<{ user: AuthUser }>("/auth/me", { token });

  if (!data.user || !["TEACHER", "ADMIN"].includes(data.user.role)) {
    throw new Error("This account cannot access ClassFlow.");
  }

  return data.user;
}
