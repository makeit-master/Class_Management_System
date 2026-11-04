import { useEffect, useRef, useState } from "react";
import { GraduationCap, Moon, Sun } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import "./LoginPage.css";
import "./RegistrationPage.css";
export default function AuthLayout() {
  const [light, setLight] = useState(
    () => localStorage.getItem("classflow_auth_theme") === "light",
  );
  const location = useLocation();
  const heading = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title =
      ({
        "/login": "Sign in",
        "/register": "Sign up",
        "/complete-profile": "Complete your profile",
        "/registration-status": "Registration status",
        "/pending-approval": "Pending approval",
        "/terms": "Terms of Service",
        "/privacy": "Privacy Policy",
      }[location.pathname] ?? "Welcome") + " · ClassFlow";
    heading.current?.focus();
  }, [location.pathname]);
  const wide = ["/register", "/complete-profile"].includes(location.pathname);
  return (
    <div className={`cf-login ${light ? "cf-login--light" : ""}`}>
      <main className="cf-login__page">
        <button
          className="cf-login__theme"
          type="button"
          aria-label="Switch color theme"
          onClick={() =>
            setLight((current) => {
              localStorage.setItem(
                "classflow_auth_theme",
                current ? "dark" : "light",
              );
              return !current;
            })
          }
        >
          {light ? <Moon size={19} /> : <Sun size={19} />}
        </button>
        <section
          ref={heading}
          tabIndex={-1}
          className={`cf-login__card ${wide ? "cf-registration" : ""}`}
          aria-label="ClassFlow account"
        >
          <Link className="cf-login__brand" to="/login">
            <span className="cf-login__logo">
              <GraduationCap size={25} />
            </span>
            <span>ClassFlow</span>
          </Link>
          <Outlet />
        </section>
        <span className="cf-login__copyright">
          © {new Date().getFullYear()} ClassFlow. Made for a better school day.
        </span>
      </main>
    </div>
  );
}
