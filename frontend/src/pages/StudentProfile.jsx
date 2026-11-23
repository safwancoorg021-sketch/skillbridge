import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { navigate } from "../services/navigation.js";
import { EmailChangeForm } from "../components/EmailChangeForm.jsx";
import { ProfilePhotoEditor } from "../components/ProfilePhotoEditor.jsx";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import { normalizeName, validateName } from "../services/validation.js";
import "./StudentProfile.css";

function ProfileIcon({ name, size = 18 }) {
  const paths = {
    arrow: <><path d="M19 12H5m7 7-7-7 7-7" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    exit: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
    eye: <><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="3" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 6.2A10.7 10.7 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 6 10 6a10.7 10.7 0 0 0 2.2-.2" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function StudentProfile({ logout, onAuthFailure }) {
  const { user: account, updateUser, signOut } = useAuth();
  const [profile, setProfile] = useState(account);
  const [name, setName] = useState(account?.name || "");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let active = true;
    api("/auth/me", { method: "GET", auth: true })
      .then((data) => {
        if (!active) return;
        setProfile(data.user);
        setName(data.user.name || "");
        updateUser(data.user);
      })
      .catch((requestError) => {
        if (!active) return;
        if ([401, 403, 404].includes(requestError.status)) {
          onAuthFailure(requestError.message);
          signOut();
          navigate("/login");
        } else {
          setError(requestError.message || "Unable to load your profile. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const joined = profile?.createdAt
    ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(profile.createdAt))
    : "—";
  const providerName = profile?.authProvider === "google" ? "Google" : "Email and password";
  const changed = normalizeName(name) !== (profile?.name || "");

  const saveProfile = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    const cleanName = normalizeName(name);
    const validationError = validateName(cleanName);
    if (validationError) {
      setNameError(validationError);
      return;
    }
    setNameError("");
    if (!changed) return;

    setSaving(true);
    try {
      const data = await api("/auth/me", { method: "PATCH", auth: true, body: { name: cleanName } });
      setProfile(data.user);
      setName(data.user.name);
      setNameError("");
      updateUser(data.user);
      setEditing(false);
      setMessage("Your profile has been updated.");
    } catch (requestError) {
      if (requestError.status === 400 && /name/i.test(requestError.message)) setNameError(requestError.message);
      else setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="student-profile-page">
      <StudentPortalHeader active="profile" onLogout={logout} />

      <main className="student-profile-main">
        <div className="student-profile-intro">
          <div>
            <span className="student-profile-eyebrow">STUDENT PORTAL</span>
            <h1>My Profile</h1>
            <p>View and manage your SkillBridge account details.</p>
          </div>
          <span className="student-profile-private"><ProfileIcon name="shield" size={17} />Your account</span>
        </div>

        <section className="student-profile-hero">
          <div className="student-profile-cover" />
          <div className="student-profile-identity">
            <ProfilePhotoEditor profile={profile} onProfileUpdated={setProfile} className="student-photo-popover" avatarClass="student-profile-avatar" />
            <div className="student-profile-identity-copy">
              <h2>{profile?.name || "Student"}</h2>
              <p>{profile?.email || "—"}</p>
              <div className="student-profile-tags"><span>Student</span><span className={profile?.isEmailVerified ? "verified" : "unverified"}><ProfileIcon name={profile?.isEmailVerified ? "check" : "mail"} size={13} />{profile?.isEmailVerified ? "Email verified" : "Email not verified"}</span></div>
            </div>
            <div className="student-profile-member"><ProfileIcon name="calendar" size={16} /><span>Member since <strong>{joined}</strong></span></div>
          </div>
        </section>

        <div className="student-profile-layout">
          <section className="student-profile-card student-profile-form-card">
            <div className="student-profile-card-title">
              <span className="student-profile-card-icon"><ProfileIcon name="user" size={18} /></span>
              <div><h2>Personal information</h2><p>Update the name shown on your account.</p></div>
            </div>

            {loading ? <div className="student-profile-loading">Loading your profile…</div> : (
              <>
              <form className="student-profile-form" noValidate onSubmit={saveProfile}>
                <label>
                  <span>Full name</span>
                  <input type="text" autoComplete="name" minLength={2} maxLength={80} value={name} readOnly={!editing} aria-invalid={Boolean(nameError)} aria-describedby="student-profile-name-help" onChange={(event) => { setName(event.target.value); setNameError(""); setError(""); setMessage(""); }} onBlur={() => { if (editing && name.trim()) setNameError(validateName(name)); }} />
                  <small id="student-profile-name-help" className={nameError ? "student-profile-field-error" : ""} role={nameError ? "alert" : undefined}>{nameError || "Use 2–80 letters. Spaces, hyphens, apostrophes, and periods are allowed."}</small>
                </label>
                <label>
                  <span>Email address</span>
                  <div className="student-profile-input-icon"><ProfileIcon name="mail" size={17} /><input type="email" value={profile?.email || ""} readOnly /></div>
                  <small>Change it by verifying a code sent to the new address.</small>
                </label>
                <label>
                  <span>Account role</span>
                  <div className="student-profile-input-icon"><ProfileIcon name="shield" size={17} /><input type="text" value="Student" readOnly /></div>
                </label>
                {error && <p className="student-profile-feedback error" role="alert">{error}</p>}
                {message && <p className="student-profile-feedback success" role="status">{message}</p>}
                <div className="student-profile-form-actions">
                  {editing ? <>
                    <button type="button" className="student-profile-cancel" disabled={saving} onClick={() => { setName(profile?.name || ""); setNameError(""); setError(""); setMessage(""); setEditing(false); }}>Cancel</button>
                    <button type="submit" className="student-profile-save" disabled={!changed || saving}>{saving ? "Saving…" : "Save changes"}</button>
                  </> : <button type="button" className="student-profile-save" onClick={() => { setEditing(true); setError(""); setMessage(""); }}>Edit profile</button>}
                </div>
              </form>
              </>
            )}
          </section>

          <aside className="student-profile-side">
            <section className="student-profile-card">
              <div className="student-profile-card-title">
                <span className="student-profile-card-icon lavender"><ProfileIcon name="lock" size={18} /></span>
                <div><h2>Account security</h2><p>Your sign-in information</p></div>
              </div>
              <div className="student-profile-detail">
                <span>Sign-in method</span><strong>{providerName}</strong>
              </div>
              <div className="student-profile-detail">
                <span>Email status</span><strong className={profile?.isEmailVerified ? "secure" : "pending"}>{profile?.isEmailVerified ? "Verified" : "Not verified"}</strong>
              </div>
              {!loading && <EmailChangeForm currentEmail={profile?.email || ""} onUpdated={setProfile} />}
              <div className="student-profile-security-note"><ProfileIcon name="shield" size={16} /><span>Your sign-in method is {providerName}. Account access is protected.</span></div>
            </section>

            <section className="student-profile-card student-profile-help">
              <span className="student-profile-card-icon mint"><ProfileIcon name="check" size={18} /></span>
              <h2>Need help with your account?</h2>
              <p>Contact your SkillBridge administrator if you need help accessing your student account.</p>
              <button type="button" onClick={() => navigate("/help")}>Open Help & support</button>
            </section>
          </aside>
        </div>

        <div className="student-profile-footer">
          <span>SkillBridge student account</span>
          <button type="button" onClick={() => logout?.()}><ProfileIcon name="exit" size={15} />Sign out</button>
        </div>
      </main>
    </div>
  );
}





