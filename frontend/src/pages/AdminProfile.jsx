import { useEffect, useState } from "react";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { Icon } from "../components/AuthComponents.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { initials, formatDate } from "../services/formatters.js";
import { EmailChangeForm } from "../components/EmailChangeForm.jsx";
import { ProfilePhotoEditor } from "../components/ProfilePhotoEditor.jsx";
import { validateName } from "../services/validation.js";


export function AdminProfile({ logout, onAuthFailure }) {
  const { user: account, updateUser, signOut } = useAuth();
  const [profile, setProfile] = useState(account);
  const [name, setName] = useState(account?.name || "");
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
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
          navigate("/admin/login");
        } else {
          setNameError(requestError.message || "Unable to load your profile. Please try again.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const changed = name.trim() !== (profile?.name || "");

  async function saveName(event) {
    event.preventDefault();
    setNameError("");
    setNameMessage("");
    const cleanName = name.trim();
    const validationError = validateName(cleanName);
    if (validationError) {
      setNameError(validationError);
      return;
    }
    if (!changed) return;

    setSavingName(true);
    try {
      const data = await api("/auth/me", { method: "PATCH", auth: true, body: { name: cleanName } });
      setProfile(data.user);
      setName(data.user.name);
      updateUser(data.user);
      setEditing(false);
      setNameMessage("Admin profile updated.");
    } catch (requestError) {
      setNameError(requestError.status === 404 && requestError.message === "Request failed (404)."
        ? "Restart the backend so it loads the profile update route, then try again."
        : requestError.message);
    } finally {
      setSavingName(false);
    }
  }

  const providerName = profile?.authProvider === "google" ? "Google" : "Email and password";

  return (
    <AdminLayout logout={logout} active="profile">
      <div className="page-head">
        <div><div className="crumb-small">Admin Portal &gt; <strong>Profile</strong></div><h1>Admin profile</h1><p>Manage your administrator account and sign-in details.</p></div>
        <div className="head-actions"><a href="#/admin/dashboard" className="secondary-button button-small"><Icon name="grid" size={15} />Back to dashboard</a></div>
      </div>

      <section className="admin-profile-banner">
        <div className="admin-profile-banner-art" />
        <div className="admin-profile-identity">
          <ProfilePhotoEditor profile={profile} onProfileUpdated={setProfile} className="admin-photo-popover" avatarClass="admin-profile-avatar" />
          <div><h2>{profile?.name || "Admin"}</h2><p>{profile?.email || "—"}</p><span className="admin-profile-role"><Icon name="shield" size={13} />Administrator</span></div>
          <div className="admin-profile-member">Member since <strong>{formatDate(profile?.createdAt)}</strong></div>
        </div>
      </section>

      <div className="admin-profile-grid">
        <section className="admin-panel admin-profile-panel">
          <div className="admin-panel-heading"><div><h2>Account details</h2><p>Update the name displayed in the admin portal.</p></div><span className="admin-profile-panel-icon"><Icon name="people" size={18} /></span></div>
          {loading ? <div className="admin-profile-loading">Loading account details…</div> : (
            <>
            <form className="admin-profile-form" noValidate onSubmit={saveName}>
              <label><span>Full name</span><input type="text" autoComplete="name" minLength={2} maxLength={80} value={name} readOnly={!editing} onChange={(event) => { setName(event.target.value); setNameError(""); setNameMessage(""); }} /><small>This name appears in the admin sidebar and profile.</small></label>
              <label><span>Email address</span><div className="admin-profile-input-icon"><Icon name="mail" size={16} /><input type="email" value={profile?.email || ""} readOnly /></div><small>Change it by verifying a code sent to the new address.</small></label>
              <label><span>Account role</span><div className="admin-profile-input-icon"><Icon name="shield" size={16} /><input type="text" value="Administrator" readOnly /></div></label>
              {nameError && <p className="admin-profile-feedback error" role="alert">{nameError}</p>}
              {nameMessage && <p className="admin-profile-feedback success" role="status">{nameMessage}</p>}
              <div className="admin-profile-actions">{editing ? <><button className="secondary-button button-small" type="button" disabled={savingName} onClick={() => { setName(profile?.name || ""); setNameError(""); setNameMessage(""); setEditing(false); }}>Cancel</button><button className="primary-button button-small" type="submit" disabled={!changed || savingName}>{savingName ? "Saving…" : "Save changes"}</button></> : <button className="primary-button button-small" type="button" onClick={() => { setEditing(true); setNameError(""); setNameMessage(""); }}>Edit profile</button>}</div>
            </form>
            </>
          )}
        </section>

        <div className="admin-profile-side">
          <section className="admin-panel admin-profile-security">
            <div className="admin-panel-heading"><div><h2>Account security</h2><p>Your sign-in settings</p></div><span className="admin-profile-panel-icon lavender"><Icon name="lock" size={18} /></span></div>
            <div className="admin-profile-detail"><span>Sign-in method</span><strong>{providerName}</strong></div>
            <div className="admin-profile-detail"><span>Email status</span><strong className={profile?.isEmailVerified ? "secure" : "pending"}>{profile?.isEmailVerified ? "Verified" : "Not verified"}</strong></div>
            {!loading && <EmailChangeForm currentEmail={profile?.email || ""} onUpdated={setProfile} />}
            <p className="admin-profile-google-note">Password changes are managed from the sign-in recovery flow.</p>
          </section>
          <section className="admin-profile-security-note"><Icon name="shield" size={17} /><span>Student records and admin actions are restricted to verified administrator accounts.</span></section>
        </div>
      </div>
    </AdminLayout>
  );
}



