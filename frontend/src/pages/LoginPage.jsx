import { useState } from "react";
import { AuthShell, AuthTop, Message, Input, GoogleButton } from "../components/AuthComponents.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { navigate } from "../services/navigation.js";
import { normalizeEmail, validateEmail } from "../services/validation.js";

export function LoginPage({ admin = false, authMessage = "", clearAuthMessage = () => {} }) {
  const { signIn } = useAuth();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const googleSuccess = async (idToken) => {
    clearAuthMessage();
    const data = await api("/auth/google", { body: { idToken } });
    if (data.user?.role !== "student") throw Error("Unable to sign in with this account.");
    signIn(data.token, data.user, false);
    navigate("/dashboard");
  };

  async function submit(event) {
    event.preventDefault();
    setError("");
    clearAuthMessage();
    const fields = new FormData(event.currentTarget);
    const email = normalizeEmail(fields.get("email"));
    const password = String(fields.get("password") || "");
    const validationError = validateEmail(email) || (!password ? "Enter your password." : "");
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const data = await api(admin ? "/auth/admin/login" : "/auth/login", { body: { email, password } });
      const role = admin ? "admin" : "student";
      if (data.user?.role !== role) {
        throw Error("Invalid email or password.");
      }
      signIn(data.token, data.user, fields.get("remember") === "on");
      navigate(admin ? "/admin/dashboard" : "/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return <AuthShell admin={admin}>
    <AuthTop />
    <h2 className="auth-heading">{admin ? "Admin sign in" : "Welcome Back"}</h2>
    <p className="auth-subtitle">{admin ? "Sign in with your administrator account to manage SkillBridge." : "Enter your student credentials to access your learning dashboard."}</p>
    {(error || authMessage) && <Message>{error || authMessage}</Message>}
    <form noValidate onSubmit={submit}>
      <Input label={admin ? "Administrator email" : "Student email address"} name="email" icon="mail" type="email" autoComplete="username" placeholder="name@example.com" required />
      <Input label="Password" name="password" icon="lock" type="password" autoComplete="current-password" placeholder="Enter your password" required />
      <div className="field-row">{!admin && <label className="remember"><input type="checkbox" name="remember" />Remember on this device</label>}<a href="#/forgot-password">Forgot password?</a></div>
      <button className="primary-button wide" type="submit" disabled={submitting}>{submitting ? "Signing in…" : admin ? "Sign in to Admin" : "Login →"}</button>
    </form>
    {admin ? <p className="auth-switch"><a href="#/login">← Student sign in</a></p> : <>
      <div className="split-line">OR CONTINUE WITH</div>
      <GoogleButton onSuccess={googleSuccess} onError={setError} />
      <p className="auth-switch">Don&apos;t have an active student account? <a href="#/register">Create an Account</a></p>
    </>}
  </AuthShell>;
}

