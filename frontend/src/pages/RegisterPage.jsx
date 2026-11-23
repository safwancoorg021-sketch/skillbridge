import { useState } from "react";
import { AuthShell, AuthTop, Message, Input, GoogleButton } from "../components/AuthComponents.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { navigate } from "../services/navigation.js";
import { normalizeEmail, validateEmail, validateName, validatePassword } from "../services/validation.js";

export function RegisterPage({ setEmail }) {
  const { signIn } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const googleSuccess = async (idToken) => {
    const data = await api("/auth/google", { body: { idToken } });
    if (data.user?.role !== "student") throw Error("This Google account does not have student access.");
    signIn(data.token, data.user, false);
    navigate("/dashboard");
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get("fullname") || "").trim();
    const email = normalizeEmail(fields.get("email"));
    const password = String(fields.get("password") || "");
    const confirmPassword = String(fields.get("confirm-password") || "");
    const validationError = validateName(name)
      || validateEmail(email)
      || validatePassword(password)
      || (password !== confirmPassword ? "Passwords do not match." : "")
      || (fields.get("termsAccepted") !== "on" ? "You must accept the terms and conditions." : "");
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await api("/auth/register", {
        body: { fullname: name, email, password, "confirm-password": confirmPassword, termsAccepted: true },
      });
      setEmail(email);
      navigate("/verify-email");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthShell>
    <AuthTop />
    <h2 className="auth-heading">Create your account</h2>
    <p className="auth-subtitle">Join SkillBridge and start building skills for your next opportunity.</p>
    {error && <Message>{error}</Message>}
    <form noValidate onSubmit={submit}>
      <Input label="Full name" name="fullname" autoComplete="name" placeholder="Your full name" minLength={2} maxLength={80} required />
      <Input label="Email address" name="email" icon="mail" type="email" autoComplete="email" placeholder="you@example.com" required />
      <Input label="Password" name="password" icon="lock" type="password" autoComplete="new-password" minLength={8} placeholder="Upper/lowercase, number and symbol" required />
      <Input label="Confirm password" name="confirm-password" icon="lock" type="password" autoComplete="new-password" required />
      <label className="remember" style={{ margin: "4px 0 17px" }}><input name="termsAccepted" type="checkbox" />I agree to the terms and conditions</label>
      <button className="primary-button wide" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Create account"}</button>
    </form>
    <div className="split-line">OR CONTINUE WITH</div>
    <GoogleButton onSuccess={googleSuccess} onError={setError} />
    <p className="auth-switch">Already have an account? <a href="#/login">Sign in</a></p>
  </AuthShell>;
}
