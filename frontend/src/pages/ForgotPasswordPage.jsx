import { useState } from "react";
import { AuthShell, AuthTop, Message, Input } from "../components/AuthComponents.jsx";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { normalizeEmail, validateEmail } from "../services/validation.js";

export function ForgotPage({ setEmail }) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const email = normalizeEmail(new FormData(event.currentTarget).get("email"));
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api("/auth/forgot-password", { body: { email } });
      setEmail(email);
      navigate("/verify-reset");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthShell>
    <AuthTop />
    <h2 className="auth-heading">Reset your password</h2>
    <p className="auth-subtitle">Enter your email. We’ll send a code if an eligible account exists.</p>
    {error && <Message>{error}</Message>}
    <form noValidate onSubmit={submit}>
      <Input label="Email address" name="email" icon="mail" type="email" autoComplete="email" required />
      <button className="primary-button wide" type="submit" disabled={submitting}>{submitting ? "Sending…" : "Send reset code"}</button>
    </form>
    <p className="auth-switch"><a href="#/login">← Back to sign in</a></p>
  </AuthShell>;
}
