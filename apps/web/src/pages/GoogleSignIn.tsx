import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { registrationRequest } from "../auth/registration-api";
import { continueRegistration } from "../auth/registration-flow";
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}
export default function GoogleSignIn() {
  const host = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  useEffect(() => {
    if (!client) return;
    let active = true;
    function render() {
      if (!active || !host.current) return;
      window.google?.accounts.id.initialize({
        client_id: client,
        callback: async ({ credential }) => {
          if (!active) return;
          setBusy(true);
          setError("");
          try {
            const data = await registrationRequest("/google", { credential });
            if (data.accessToken) {
              sessionStorage.setItem(
                "classflow_access_token",
                data.accessToken,
              );
              location.assign("/");
            } else await continueRegistration(data.registrationToken, navigate);
          } catch (e) {
            if (active) setError((e as Error).message);
          } finally {
            if (active) setBusy(false);
          }
        },
      });
      window.google?.accounts.id.renderButton(host.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        width: Math.min(host.current.clientWidth, 400),
        locale: "en",
      });
    }
    let script = document.querySelector<HTMLScriptElement>(
      "script[data-classflow-google]",
    );
    const failed = () =>
      active &&
      setError("Google sign-in could not load. Please use email or try again.");
    if (window.google) render();
    else {
      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client?hl=en";
        script.async = true;
        script.dataset.classflowGoogle = "true";
        document.head.appendChild(script);
      }
      script.addEventListener("load", render);
      script.addEventListener("error", failed);
    }
    return () => {
      active = false;
      script?.removeEventListener("load", render);
      script?.removeEventListener("error", failed);
    };
  }, [client, navigate]);
  return (
    <div className="cf-google" aria-busy={busy}>
      {client ? (
        <div ref={host} aria-label="Continue with Google" />
      ) : (
        <>
          <button className="cf-auth__secondary" type="button" disabled>
            <span className="cf-google__mark" aria-hidden="true">
              G
            </span>
            Continue with Google
          </button>
          {import.meta.env.DEV && (
            <p className="cf-auth__configuration">
              Google sign-in is not configured for development.
            </p>
          )}
        </>
      )}
      {busy && <p role="status">Verifying your Google account…</p>}
      {error && (
        <p className="cf-login__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
