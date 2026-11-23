import { AuthShell, AuthTop } from "../components/AuthComponents.jsx";

export function SuccessPage({reset=false}){return <AuthShell><AuthTop/><div className="success-card"><div className="success-icon">✓</div><h2 className="auth-heading">{reset?"Password updated":"Email verified!"}</h2><p className="auth-subtitle">{reset?"Your password has been reset. Sign in again.":"Your student account is active."}</p><a className="primary-button wide" href="#/login">Continue to sign in</a></div></AuthShell>}
