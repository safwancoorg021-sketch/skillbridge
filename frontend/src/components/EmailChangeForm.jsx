import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { normalizeEmail, validateEmail, validateOtp } from "../services/validation.js";
import "./EmailChangeForm.css";

const RESEND_SECONDS = 3 * 60;
const formatCountdown = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function EmailChangeForm({ currentEmail, onUpdated }) {
  const { updateUser, updateToken } = useAuth();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = window.setInterval(() => setSecondsLeft((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  async function requestCode(event) {
    event?.preventDefault();
    setError("");
    setMessage("");
    const cleanEmail = normalizeEmail(email);
    const validationError = validateEmail(cleanEmail)
      || (cleanEmail === normalizeEmail(currentEmail) ? "Enter a different email address." : "");
    if (validationError) {
      setError(validationError);
      return;
    }

    setSending(true);
    try {
      const data = await api("/auth/me/change-email/request", {
        method: "POST",
        auth: true,
        body: { email: cleanEmail },
      });
      setEmail(cleanEmail);
      setOtp("");
      setCodeSent(true);
      setSecondsLeft(data.resendAfterSeconds || RESEND_SECONDS);
      setMessage(data.message || `A verification code was sent to ${cleanEmail}.`);
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.retryAfterSeconds) setSecondsLeft(requestError.retryAfterSeconds);
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const cleanOtp = otp.trim();
    const validationError = validateEmail(email) || validateOtp(cleanOtp);
    if (validationError) {
      setError(validationError);
      return;
    }

    setVerifying(true);
    try {
      const data = await api("/auth/me/change-email/verify", {
        method: "POST",
        auth: true,
        body: { email: normalizeEmail(email), otp: cleanOtp },
      });
      updateToken(data.token);
      updateUser(data.user);
      onUpdated?.(data.user);
      setEmail(data.user.email);
      setOtp("");
      setCodeSent(false);
      setSecondsLeft(0);
      setMessage(data.message || "Your email address has been updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setVerifying(false);
    }
  }

  function cancelCode() {
    setCodeSent(false);
    setOtp("");
    setError("");
    setMessage("");
  }

  return <section className="profile-email-change" aria-labelledby="profile-email-change-heading">
    <div>
      <h3 id="profile-email-change-heading">Change email address</h3>
      <p>We’ll send a verification code to the new address. It expires in 3 minutes, and you can request another after that.</p>
    </div>
    {!codeSent ? (
      <form noValidate onSubmit={requestCode}>
        <label htmlFor="profile-new-email">New email address</label>
        <input id="profile-new-email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setMessage(""); }} required />
        {secondsLeft > 0 && <small className="profile-email-countdown">You can request a code in {formatCountdown(secondsLeft)}.</small>}
        <button type="submit" disabled={sending || secondsLeft > 0}>{sending ? "Sending code…" : "Send verification code"}</button>
      </form>
    ) : (
      <form noValidate onSubmit={verifyCode}>
        <p className="profile-email-code-sent">Code sent to <strong>{email}</strong></p>
        <label htmlFor="profile-email-otp">6-digit verification code</label>
        <input id="profile-email-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); setMessage(""); }} required />
        <div className="profile-email-actions">
          <button type="button" className="secondary" onClick={cancelCode}>Cancel</button>
          <button type="button" className="secondary" onClick={requestCode} disabled={sending || secondsLeft > 0}>{sending ? "Sending…" : secondsLeft > 0 ? `Resend ${formatCountdown(secondsLeft)}` : "Resend code"}</button>
          <button type="submit" disabled={verifying || otp.length !== 6}>{verifying ? "Verifying…" : "Verify email"}</button>
        </div>
      </form>
    )}
    {error && <p className="profile-email-feedback error" role="alert">{error}</p>}
    {message && <p className="profile-email-feedback success" role="status">{message}</p>}
  </section>;
}
