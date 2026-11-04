import "./RegistrationReview.css";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/auth-context";
import { registrationRequest } from "../auth/registration-api";
type Applicant = {
  id: string;
  fullName: string;
  email: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  address: string | null;
  profileCompletedAt: string | null;
  emailVerifiedAt: string | null;
};
export default function RegistrationReview() {
  const { user, token } = useAuth();
  const [rows, setRows] = useState<Applicant[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user?.role === "ADMIN" && token)
      registrationRequest("/registrations", undefined, token)
        .then(setRows)
        .catch((e) => setError(e.message));
  }, [user, token]);
  if (user?.role !== "ADMIN") return null;
  async function review(id: string, approved: boolean) {
    setBusy(true);
    setError("");
    try {
      await registrationRequest(
        `/registrations/${id}/review`,
        approved
          ? { decision: "APPROVED", role: "TEACHER" }
          : { decision: "REJECTED" },
        token!,
      );
      setRows(rows.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="registration-reviews"
      aria-label="Registration approvals"
    >
      <h2>Registration approvals</h2>
      {error && <p role="alert">{error}</p>}
      {!rows.length && <p>No pending registrations.</p>}
      {rows.map((r) => (
        <article key={r.id}>
          <h3>{r.fullName || "Incomplete profile"}</h3>
          <dl>
            {[
              ["Email", r.email],
              ["Date of birth", r.dateOfBirth?.slice(0, 10)],
              ["Gender", r.gender],
              ["Phone", r.phone],
              ["Address", r.address],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value || "Not provided"}</dd>
              </div>
            ))}
          </dl>
          <p>
            {r.emailVerifiedAt
              ? "Email verified"
              : "Email verification pending"}{" "}
            · {r.profileCompletedAt ? "Profile complete" : "Profile incomplete"}
          </p>
          <button
            disabled={busy || !r.profileCompletedAt || !r.emailVerifiedAt}
            onClick={() => review(r.id, true)}
          >
            Approve and assign Teacher
          </button>
          <button disabled={busy} onClick={() => review(r.id, false)}>
            Reject
          </button>
        </article>
      ))}
    </section>
  );
}
