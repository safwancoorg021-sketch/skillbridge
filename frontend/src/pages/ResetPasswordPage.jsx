import { useEffect, useState } from "react";
import { AuthShell, AuthTop, Message, Input } from "../components/AuthComponents.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { navigate } from "../services/navigation.js";
import { validatePassword } from "../services/validation.js";

export function ResetPage({ token, clearToken }) {
  const { signOut } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    const newPassword = String(fields.get("newPassword") || "");
    const confirmPassword = String(fields.get("confirmPassword") || "");
    const validationError = validatePassword(newPassword)
      || (newPassword !== confirmPassword ? "Passwords do not match." : "");
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api("/auth/reset-password", { body: { resetToken: token, newPassword, confirmPassword } });
      signOut();
      clearToken();
      navigate("/password-reset");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { if (!token) navigate("/forgot-password"); }, [token]);
  if (!token) return null;

  return <AuthShell>
    <AuthTop />
    <h2 className="auth-heading">Set a new password</h2>
    <p className="auth-subtitle">Use uppercase and lowercase letters, a number, and a symbol.</p>
    {error && <Message>{error}</Message>}
    <form noValidate onSubmit={submit}>
      <Input label="New password" name="newPassword" icon="lock" type="password" autoComplete="new-password" minLength={8} required />
      <Input label="Confirm password" name="confirmPassword" icon="lock" type="password" autoComplete="new-password" minLength={8} required />
      <button className="primary-button wide" type="submit" disabled={submitting}>{submitting ? "Updating…" : "Update password"}</button>
    </form>
  </AuthShell>;
}
