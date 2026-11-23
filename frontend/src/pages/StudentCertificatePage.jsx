import { useEffect, useState } from "react";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import "./StudentCertificatePage.css";

export function StudentCertificatePage({ code, logout }) {
  const [certificate, setCertificate] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    api(`/certificates/${encodeURIComponent(code)}`, { method: "GET", auth: true })
      .then((data) => { if (active) setCertificate(data.certificate); })
      .catch((loadError) => { if (active) setError(loadError.message || "Unable to load this certificate."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code]);

  return <div className="student-certificate-page">
    <StudentPortalHeader active="progress" onLogout={logout} />
    <main className="student-certificate-content">
      <div className="student-certificate-actions"><button type="button" onClick={() => navigate("/progress")}>← Learning progress</button>{certificate && <button type="button" className="print" onClick={() => window.print()}>Print / Save PDF</button>}</div>
      {loading ? <div className="student-certificate-state">Loading certificate…</div> : error ? <div className="student-certificate-state error" role="alert">{error}</div> : certificate && <article className="certificate-paper">
        <div className="certificate-border"><span className="certificate-mark">SB</span><span className="certificate-kicker">SKILLBRIDGE LEARNING</span><h1>Certificate of Completion</h1><p className="certificate-intro">This certificate is proudly presented to</p><h2>{certificate.studentName}</h2><p className="certificate-description">for successfully completing the course</p><h3>{certificate.courseTitle}</h3><p className="certificate-detail">and passing the course assessment with a score of <strong>{certificate.score}%</strong>.</p><div className="certificate-signatures"><div><strong>{certificate.instructor}</strong><span>Course instructor</span></div><div><strong>{new Date(certificate.issuedAt).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</strong><span>Date issued</span></div></div><small className="certificate-code">Certificate ID: {certificate.code}</small></div>
      </article>}
    </main>
  </div>;
}
