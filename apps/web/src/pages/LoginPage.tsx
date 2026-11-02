import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  GraduationCap,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useAuth } from "../auth/auth-context";
import { ApiError } from "../lib/api-client";
import "./LoginPage.css";

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Incorrect email or password.";
    if (error.status === 0 || error.code === "NETWORK_ERROR") {
      return "Cannot connect to the server. Please try again.";
    }
    if (error.status >= 500) return "Server error. Please try again later.";
    if (error.status === 429)
      return "Too many attempts. Please try again later.";
    return error.message;
  }
  return error instanceof Error
    ? error.message
    : "Sign in failed. Please try again.";
}

export default function LoginPage() {
  const { login, sessionNotice, clearSessionNotice } = useAuth();
  const [light, setLight] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setHelp("");
    clearSessionNotice();
    setLoading(true);
    try {
      await login(email, password);
    } catch (caught) {
      setError(loginErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  const sessionMessage =
    sessionNotice === "expired"
      ? "Your session has expired. Please sign in again."
      : sessionNotice === "unauthorized"
        ? "Your session is no longer valid. Please sign in again."
        : null;

  return (
    <div className={`cf-login ${light ? "cf-login--light" : ""}`}>
      <main className="cf-login__page">
        <button
          className="cf-login__theme"
          type="button"
          aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
          onClick={() => setLight((current) => !current)}
        >
          {light ? <Moon size={19} /> : <Sun size={19} />}
        </button>

        <section className="cf-login__card" aria-label="Teacher login">
          <div className="cf-login__brand">
            <span className="cf-login__logo">
              <GraduationCap size={25} />
            </span>
            <span>ClassFlow</span>
          </div>

          <h1>A brighter day starts here.</h1>
          <p className="cf-login__subtitle">
            Welcome back. Let’s make learning flow.
          </p>

          {sessionMessage && (
            <p className="cf-login__help" role="status">
              {sessionMessage}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <label htmlFor="teacher-email">
              Email address
              <input
                id="teacher-email"
                type="email"
                autoComplete="username"
                placeholder="you@school.edu"
                required
                disabled={loading}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label htmlFor="teacher-password">
              Password
              <input
                id="teacher-password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                disabled={loading}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <div className="cf-login__options">
              <label title="Persistent login is not supported in this milestone">
                <input type="checkbox" disabled />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => {
                  setHelp(
                    "Please contact your school IT administrator to reset your password.",
                  );
                  setError("");
                }}
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <p className="cf-login__error" role="alert">
                {error}
              </p>
            )}
            {help && (
              <p className="cf-login__help" role="status">
                {help}
              </p>
            )}

            <button
              className="cf-login__submit"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="cf-login__security">
            <ShieldCheck size={14} />A secure space for your school community.
          </p>
        </section>
        <span className="cf-login__copyright">
          © {new Date().getFullYear()} ClassFlow. Made for a better school day.
        </span>
      </main>
    </div>
  );
}
