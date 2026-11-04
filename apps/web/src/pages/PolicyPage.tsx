import { Link, useLocation } from "react-router-dom";
export default function PolicyPage({ privacy = false }: { privacy?: boolean }) {
  const location = useLocation();
  return (
    <>
      <h1>{privacy ? "Privacy Policy" : "Terms of Service"}</h1>
      <div className="cf-auth__policy">
        {privacy ? (
          <>
            <p>
              Your school uses your name, date of birth, gender, phone number,
              email and optional address to review registration and administer
              your account.
            </p>
            <p>
              Authorized administrators can review this information. Contact
              your school to request correction or deletion and to learn about
              its data retention and guardian-consent policies.
            </p>
          </>
        ) : (
          <>
            <p>
              Provide accurate information when creating your account. Access to
              ClassFlow requires approval from your school administrator.
            </p>
            <p>
              Keep your credentials secure. Do not share accounts or misuse
              school information. Contact your school administrator for
              assistance or account closure.
            </p>
          </>
        )}
      </div>
      <Link className="cf-auth__back" to={location.state?.from ?? "/register"}>
        Back to registration
      </Link>
    </>
  );
}
