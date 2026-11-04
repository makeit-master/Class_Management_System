import { useEffect, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import { registrationRequest } from "./registration-api";
export type RegistrationProfile = {
  id: string;
  fullName: string;
  email: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  profileCompletedAt: string | null;
  emailVerifiedAt: string | null;
  registrationStatus: "PENDING" | "APPROVED" | "REJECTED";
};
const key = "classflow_registration_token";
export function readRegistrationToken() {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function clearRegistrationToken() {
  sessionStorage.removeItem(key);
}
export function profilePath(profile: RegistrationProfile) {
  if (profile.registrationStatus !== "PENDING") return "/registration-status";
  if (!profile.profileCompletedAt) return "/complete-profile";
  return profile.emailVerifiedAt ? "/pending-approval" : "/registration-status";
}
export async function continueRegistration(
  token: string,
  navigate: NavigateFunction,
) {
  const profile: RegistrationProfile = await registrationRequest(
    "/registration",
    undefined,
    token,
  );
  sessionStorage.setItem(key, token);
  navigate(profilePath(profile), { replace: true });
}
export function useRegistrationProfile() {
  const [profile, setProfile] = useState<RegistrationProfile | null>(null);
  const [loading, setLoading] = useState(!!readRegistrationToken());
  const [error, setError] = useState("");
  const token = readRegistrationToken();
  useEffect(() => {
    let active = true;
    if (!token) return;
    registrationRequest("/registration", undefined, token)
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          clearRegistrationToken();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);
  return { profile, loading, error, setProfile };
}
