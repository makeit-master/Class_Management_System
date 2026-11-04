import { useState, type SubmitEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import GoogleSignIn from "./GoogleSignIn";
import { registrationRequest } from "../auth/registration-api";
import {
  continueRegistration,
  readRegistrationToken,
  useRegistrationProfile,
  profilePath,
} from "../auth/registration-flow";
type Fields = Record<string, string[]>;
export default function RegistrationPage({
  complete = false,
}: {
  complete?: boolean;
}) {
  const { profile, loading, error } = useRegistrationProfile();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Fields>({});
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const fields: Fields = {};
    const fullName = String(values.fullName ?? "").trim();
    if (fullName.length < 2 || fullName.length > 120)
      fields.fullName = ["Enter 2 to 120 characters"];
    const dob = String(values.dateOfBirth);
    const date = new Date(dob + "T00:00:00Z");

    if (
      Number.isNaN(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== dob ||
      date > new Date()
    )
      fields.dateOfBirth = [
        "Enter a valid birth date that is not in the future.",
      ];
    if (
      !["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"].includes(
        String(values.gender),
      )
    )
      fields.gender = ["Select a gender"];
    if (
      !/^(?:0|\+84)(?:[35789]\d{8}|2\d{9})$/.test(
        String(values.phone).replace(/[ .()-]/g, ""),
      )
    )
      fields.phone = ["Enter a valid Vietnamese phone number"];
    if (!complete) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values.email).trim()))
        fields.email = ["Enter a valid email"];
      if (
        String(values.password).length < 12 ||
        new TextEncoder().encode(String(values.password)).length > 72
      )
        fields.password = [
          "Use at least 12 characters and at most 72 UTF-8 bytes",
        ];
      if (values.password !== values.confirmPassword)
        fields.confirmPassword = ["Passwords must match"];
    }
    if (!values.acceptTerms)
      fields.acceptTerms = ["Accept the Terms of Service and Privacy Policy"];
    setErrors(fields);
    if (Object.keys(fields).length) {
      form
        .querySelector<HTMLElement>(`[name="${Object.keys(fields)[0]}"]`)
        ?.focus();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = await registrationRequest(
        complete ? "/complete-profile" : "/register",
        { ...values, fullName, acceptTerms: !!values.acceptTerms },
        complete ? (readRegistrationToken() ?? undefined) : undefined,
      );
      if (complete) {
        await continueRegistration(readRegistrationToken()!, navigate);
      } else {
        form.reset();
        navigate("/registration-status", {
          state: { verificationSent: true, message: data.message },
        });
      }
    } catch (e) {
      setMessage((e as Error).message);
      setErrors((e as Error & { fields?: Fields }).fields ?? {});
    } finally {
      setBusy(false);
    }
  }
  const field = (
    name: string,
    label: string,
    type = "text",
    required = true,
  ) => (
    <label className="cf-auth__field" htmlFor={`reg-${name}`}>
      {label}
      <input
        aria-label={label}
        id={`reg-${name}`}
        name={name}
        type={type}
        required={required}
        maxLength={name === "address" ? 500 : name === "fullName" ? 120 : 254}
        defaultValue={
          name === "fullName" && complete ? profile?.fullName : undefined
        }
        placeholder={
          name === "phone"
            ? "0912 345 678 or +84…"
            : name === "email"
              ? "you@school.edu"
              : undefined
        }
        max={
          name === "dateOfBirth"
            ? new Date().toISOString().slice(0, 10)
            : undefined
        }
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `error-${name}` : undefined}
        autoComplete={
          name === "password" || name === "confirmPassword"
            ? "new-password"
            : {
                fullName: "name",
                dateOfBirth: "bday",
                phone: "tel",
                email: "email",
                address: "street-address",
              }[name]
        }
      />
      {name === "password" && (
        <span className="cf-auth__hint">
          At least 12 characters. Up to 72 UTF-8 bytes.
        </span>
      )}
      {errors[name] && (
        <span id={`error-${name}`} className="cf-login__error">
          {errors[name][0]}
        </span>
      )}
    </label>
  );

  if (complete && loading) return <p role="status">Loading your profile…</p>;
  if (complete && !profile)
    return (
      <>
        <h1>Complete your profile</h1>
        <p className="cf-auth__intro">
          {error ||
            "Continue with Google to securely access your registration."}
        </p>
        <GoogleSignIn />
        <p className="cf-auth__links">
          <Link to="/login">Back to sign in</Link>
        </p>
      </>
    );
  if (
    complete &&
    profile &&
    (profile.profileCompletedAt || profile.registrationStatus !== "PENDING")
  )
    return <Navigate to={profilePath(profile)} replace />;
  return (
    <>
      <header className="cf-auth__heading">
        <h1>{complete ? "Complete your profile" : "Create your account"}</h1>
        <p className="cf-auth__intro">
          {complete
            ? "Just a few more details before your administrator reviews your account."
            : "Join your school community. A better school day starts here."}
        </p>
      </header>
      {!complete && (
        <div className="cf-auth__social-row">
          <GoogleSignIn />
          <div className="cf-auth__divider">
            <span>or sign up with email</span>
          </div>
        </div>
      )}
      {complete && (
        <p className="cf-auth__identity">
          Signed in as <strong>{profile?.email}</strong> · Google account
        </p>
      )}
      <form className="cf-auth__registration-form" noValidate onSubmit={submit}>
        <fieldset disabled={busy}>
          <legend>Personal &amp; contact information</legend>
          <div className="cf-auth__grid">
            {field("fullName", "Full name")}
            {field("dateOfBirth", "Date of birth", "date")}
            <label className="cf-auth__field" htmlFor="reg-gender">
              Gender
              <select
                aria-label="Gender"
                id="reg-gender"
                name="gender"
                required
                aria-invalid={!!errors.gender}
                aria-describedby={errors.gender ? "error-gender" : undefined}
              >
                <option value="">Select gender</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              </select>
              {errors.gender && (
                <span className="cf-login__error" id="error-gender">
                  {errors.gender[0]}
                </span>
              )}
            </label>
            {field("phone", "Phone number", "tel")}
            {!complete && field("email", "Email address", "email")}
            {field("address", "Address (optional)", "text", false)}
          </div>
        </fieldset>
        {!complete && (
          <fieldset disabled={busy}>
            <legend>Account security</legend>
            <div className="cf-auth__grid">
              {field("password", "Password", "password")}
              {field("confirmPassword", "Confirm password", "password")}
            </div>
          </fieldset>
        )}
        <div className="cf-auth__consent">
          <label>
            <input
              type="checkbox"
              name="acceptTerms"
              required
              disabled={busy}
              aria-describedby={
                errors.acceptTerms ? "error-acceptTerms" : undefined
              }
              aria-invalid={!!errors.acceptTerms}
            />
            <span>
              I agree to the{" "}
              <Link target="_blank" to="/terms">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link target="_blank" to="/privacy">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms && (
            <p id="error-acceptTerms" className="cf-login__error">
              {errors.acceptTerms[0]}
            </p>
          )}
        </div>
        {message && (
          <p role="alert" className="cf-login__error">
            {message}
          </p>
        )}
        <div className="cf-auth__form-footer">
          <p>Your account will be reviewed by an administrator.</p>
          <button className="cf-login__submit" disabled={busy}>
            {busy
              ? "Submitting…"
              : complete
                ? "Submit profile"
                : "Create account"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
      <p className="cf-auth__links">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </>
  );
}
