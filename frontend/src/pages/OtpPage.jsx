import { useEffect, useState } from "react";
import { AuthShell, AuthTop, Message, Input } from "../components/AuthComponents.jsx";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { validateOtp } from "../services/validation.js";

const RESEND_SECONDS = 3 * 60;
const formatCountdown = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function OtpPage({ registration = false, email, setResetToken }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email) navigate(registration ? "/register" : "/forgot-password");
    setSecondsLeft(RESEND_SECONDS);
    setError("");
    setMessage("");
  }, [email, registration]);

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => setSecondsLeft((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  if (!email) return null;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const otp = String(new FormData(event.currentTarget).get("otp") || "").trim();
    const validationError = validateOtp(otp);
    if (validationError) {
      setError(validationError);
      return;
    }

    setVerifying(true);
    try {
      const data = await api(registration ? "/auth/verify-email" : "/auth/verify-reset-otp", {
        body: { email, otp },
      });
      if (registration) navigate("/verified");
      else {
        setResetToken(data.resetToken);
        navigate("/reset-password");
      }
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.retryAfterSeconds) setSecondsLeft(requestError.retryAfterSeconds);
    } finally {
      setVerifying(false);
    }
  }

  async function resend() {
    if (secondsLeft > 0 || resending) return;
    setError("");
    setMessage("");
    setResending(true);
    try {
      const data = await api(registration ? "/auth/resend-otp" : "/auth/forgot-password", { body: { email } });
      setSecondsLeft(data.resendAfterSeconds || RESEND_SECONDS);
      setMessage(registration ? "A new verification code was sent." : "If the account is eligible, a new reset code was sent.");
    } catch (requestError) {
      setError(requestError.message);
      setSecondsLeft(requestError.retryAfterSeconds || RESEND_SECONDS);
    } finally {
      setResending(false);
    }
  }

  return <AuthShell>
    <AuthTop />
    <h2 className="auth-heading">{registration ? "Verify your email" : "Check your email"}</h2>
    <p className="auth-subtitle">{registration ? "We sent a 6-digit code to " : "Enter the reset code sent to "}<strong>{email}</strong>. The code expires in 3 minutes; you can request another after that.</p>
    {error && <Message>{error}</Message>}
    {message && <Message success>{message}</Message>}
    <form noValidate onSubmit={submit}>
      <Input label="6-digit verification code" name="otp" className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="••••••" required />
      <button className="primary-button wide" type="submit" disabled={verifying}>{verifying ? "Verifying…" : "Verify code"}</button>
    </form>
    <div className="otp-resend-control">
      <button className="inline-action" type="button" onClick={resend} disabled={secondsLeft > 0 || resending}>
        {resending ? "Sending…" : secondsLeft > 0 ? `Resend code in ${formatCountdown(secondsLeft)}` : "Resend code"}
      </button>
    </div>
    <p className="auth-switch"><a href={registration ? "#/register" : "#/forgot-password"}>← Back</a></p>
  </AuthShell>;
}
