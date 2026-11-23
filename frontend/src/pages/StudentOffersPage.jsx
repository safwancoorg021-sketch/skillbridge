import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { StudentPortalHeader } from "../components/StudentPortalHeader.jsx";
import "./StudentCoursesPage.css";
import "./StudentPages.css";

const dateLabel = (value) => new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function StudentOffersPage({ logout }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/offers", { method: "GET", auth: true });
      setOffers(data.offers || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load current offers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
    window.addEventListener("focus", loadOffers);
    return () => window.removeEventListener("focus", loadOffers);
  }, [loadOffers]);

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage("");
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => current === code ? "" : current), 1800);
    } catch {
      setCopyMessage(`Copy is unavailable here. You can enter ${code} at checkout.`);
    }
  }

  return <div className="learning-portal">
    <StudentPortalHeader active="offers" onLogout={logout} />
    <main className="learning-content">
      <section className="learning-page-title"><div><span>STUDENT PERKS</span><h1>Offers & discounts</h1><p>Current promotions for your next SkillBridge course.</p></div></section>
      {copyMessage && <p className="student-offer-copy-message" role="status">{copyMessage}</p>}
      {loading ? <div className="learning-state" role="status">Loading student offers…</div> : error ? <div className="learning-state error" role="alert">{error}<button type="button" onClick={loadOffers}>Try again</button></div> : offers.length ? <div className="student-offer-page-grid">{offers.map((offer) => <article className="student-offer-page-card" key={offer._id}>
        <span className="student-offer-page-badge">{offer.discountLabel}</span>
        <h2>{offer.title}</h2>
        <p>{offer.description}</p>
        <small>Valid through {dateLabel(offer.endsAt)}</small>
        {offer.couponCode && <div className="student-offer-page-code"><span><small>Use code</small><strong>{offer.couponCode}</strong></span><button type="button" onClick={() => copyCode(offer.couponCode)}>{copiedCode === offer.couponCode ? "Copied" : "Copy code"}</button></div>}
        <button className="student-offer-page-browse" type="button" onClick={() => navigate("/courses")}>Browse courses</button>
      </article>)}</div> : <div className="learning-state"><strong>No active offers right now</strong><span>New promotions will appear here when they are published.</span><button type="button" onClick={() => navigate("/courses")}>Browse courses</button></div>}
    </main>
  </div>;
}
