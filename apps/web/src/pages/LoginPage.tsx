import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  GraduationCap,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import "./LoginPage.css";

export default function LoginPage() {
  const { login } = useAuth();
  const [light, setLight] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setHelp("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

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

          <form onSubmit={handleSubmit}>
            <label htmlFor="teacher-email">
              Email address
              <input
                id="teacher-email"
                type="email"
                autoComplete="username"
                placeholder="you@school.edu"
                required
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
