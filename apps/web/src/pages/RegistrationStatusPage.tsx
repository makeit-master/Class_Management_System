import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Mail,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import GoogleSignIn from "./GoogleSignIn";
import { registrationRequest } from "../auth/registration-api";
import {
  clearRegistrationToken,
  continueRegistration,
  profilePath,
  readRegistrationToken,
  useRegistrationProfile,
} from "../auth/registration-flow";
export default function RegistrationStatusPage({
  pending = false,
}: {
  pending?: boolean;
}) {
  const { profile, loading, error, setProfile } = useRegistrationProfile();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(() =>
    location.hash.startsWith("#verify="),
  );
  const verified = useRef(false);
  const navigate = useNavigate();
  const route = useLocation();
  const sent = !!route.state?.verificationSent;
  useEffect(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get("verify");
    if (!token || verified.current) return;
    verified.current = true;
    history.replaceState(null, "", location.pathname);
    registrationRequest("/verify-email", { token })
      .then((data) => continueRegistration(data.registrationToken, navigate))
      .catch((e) => setMessage(e.message))
      .finally(() => setVerifying(false));
  }, [navigate]);
  async function check(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const data = await registrationRequest("/registration-login", values);
      form.reset();
      await continueRegistration(data.registrationToken, navigate);
      setProfile(
        await registrationRequest(
          "/registration",
          undefined,
          data.registrationToken,
        ),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      const token = readRegistrationToken();
      if (!token) throw Error("Please sign in to check your registration.");
      const data = await registrationRequest("/registration", undefined, token);
      setProfile(data);
      navigate(profilePath(data), { replace: true });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading || verifying)
    return (
      <p role="status">
        {verifying ? "Verifying your email…" : "Loading registration status…"}
      </p>
    );
  if (profile && profilePath(profile) !== route.pathname)
    return <Navigate to={profilePath(profile)} replace />;
  const rejected = profile?.registrationStatus === "REJECTED";
  const approved = profile?.registrationStatus === "APPROVED";
  const emailPending = profile
    ? profile.registrationStatus === "PENDING" && !profile.emailVerifiedAt
    : sent;
  if (profile || sent)
    return (
      <div className="cf-auth__status">
        <div
          className={`cf-auth__status-icon ${rejected ? "cf-auth__status-icon--rejected" : ""}`}
        >
          {emailPending ? (
            <Mail size={28} />
          ) : approved ? (
            <CheckCircle2 size={28} />
          ) : rejected ? (
            <XCircle size={28} />
          ) : (
            <Clock3 size={28} />
          )}
        </div>
        <h1>
          {emailPending
            ? "Check your email"
            : approved
              ? "You're approved"
              : rejected
                ? "Registration not approved"
                : "You're on the list"}
        </h1>
        <p className="cf-auth__intro">
          {emailPending
            ? "If registration is available, we've sent you a verification link. Open it to verify your email before your administrator reviews your account."
            : approved
              ? "Your administrator has approved your account. Sign in to start using ClassFlow."
              : rejected
                ? "Your registration was not approved. Please contact your school administrator for more information."
                : "Your profile is complete and awaiting administrator approval. You're all set for now."}
        </p>
        {!emailPending && !approved && !rejected && (
          <div className="cf-auth__steps">
            <p>
              <CheckCircle2 size={17} /> Profile submitted
            </p>
            <p>
              <CheckCircle2 size={17} /> Email verified
            </p>
            <p>
              <Clock3 size={17} /> Administrator review in progress
            </p>
          </div>
        )}
        {message && (
          <p role="alert" className="cf-login__error">
            {message}
          </p>
        )}
        {profile && !approved && (
          <button
            className="cf-auth__secondary"
            disabled={busy}
            onClick={refresh}
          >
            {busy ? "Checking…" : "Refresh status"}
          </button>
        )}
        {sent && !profile && (
          <Link
            className="cf-auth__secondary"
            to="/registration-status"
            state={null}
          >
            Check registration status
          </Link>
        )}
        <Link
          className={approved ? "cf-login__submit" : "cf-auth__back"}
          to="/login"
        >
          Back to sign in
        </Link>
        {profile && (
          <button
            className="cf-auth__text-button"
            onClick={() => {
              clearRegistrationToken();
              setProfile(null);
              navigate("/registration-status", { replace: true });
            }}
          >
            Check another account
          </button>
        )}
      </div>
    );
  return (
    <>
      <h1>{pending ? "Check your approval status" : "Registration status"}</h1>
      <p className="cf-auth__intro">
        Sign in securely to see where your registration stands.
      </p>
      {(error || message) && (
        <p role="alert" className="cf-login__error">
          {message || error}
        </p>
      )}
      <form onSubmit={check} autoComplete="on">
        <label className="cf-auth__field" htmlFor="status-email">
          Email address
          <input
            id="status-email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@school.edu"
            required
            disabled={busy}
          />
        </label>
        <label className="cf-auth__field" htmlFor="status-password">
          Password
          <input
            id="status-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            disabled={busy}
          />
        </label>
        <button className="cf-login__submit" disabled={busy}>
          {busy ? "Checking…" : "Check status"}
          <ArrowRight size={16} />
        </button>
      </form>
      <div className="cf-auth__divider">
        <span>or continue with</span>
      </div>
      <GoogleSignIn />
      <p className="cf-auth__links">
        <Link to="/login">Back to sign in</Link>
      </p>
      <p className="cf-login__security">
        <ShieldCheck size={14} />
        Your profile is visible only to authorized administrators.
      </p>
    </>
  );
}
