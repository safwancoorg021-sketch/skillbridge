import { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "../components/AdminLayout.jsx";
import { api } from "../services/api.js";
import "./AdminCommercePages.css";

const today = () => new Date().toISOString().slice(0, 10);
const nextMonth = () => { const date = new Date(); date.setMonth(date.getMonth() + 1); return date.toISOString().slice(0, 10); };
const dateOnly = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const dateToIso = (value, end = false) => value ? new Date(value + (end ? "T23:59:59" : "T00:00:00")).toISOString() : "";
const emptyCoupon = () => ({ code: "", discountType: "percentage", discountValue: "10", minOrderAmount: "0", maxDiscountAmount: "0", startsAt: today(), endsAt: nextMonth(), isActive: true });
const emptyOffer = () => ({ title: "", description: "", discountLabel: "10% off", couponCode: "", startsAt: today(), endsAt: nextMonth(), isActive: true });
const dateLabel = (value) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
const couponSummary = (item) => (item.discountType === "percentage" ? item.discountValue + "% off" : "₹" + item.discountValue + " off") + " · used " + (item.usageCount || 0) + " times";
const offerSummary = (item) => item.discountLabel + (item.couponCode ? " · Code " + item.couponCode : "");

export function AdminOffersPage({ logout }) {
  const [tab, setTab] = useState("coupons");
  const [coupons, setCoupons] = useState([]);
  const [offers, setOffers] = useState([]);
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [offerForm, setOfferForm] = useState(emptyOffer);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [couponData, offerData] = await Promise.all([
        api("/admin/commerce/coupons", { method: "GET", auth: true }),
        api("/admin/commerce/offers", { method: "GET", auth: true }),
      ]);
      setCoupons(couponData.coupons || []);
      setOffers(offerData.offers || []);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startNew() {
    setEditingId("");
    setError("");
    if (tab === "coupons") setCouponForm(emptyCoupon());
    else setOfferForm(emptyOffer());
  }

  function switchTab(nextTab) {
    setTab(nextTab);
    setEditingId("");
    setError("");
    if (nextTab === "coupons") setCouponForm(emptyCoupon());
    else setOfferForm(emptyOffer());
  }

  function editCoupon(coupon) {
    setTab("coupons");
    setEditingId(coupon._id);
    setCouponForm({ code: coupon.code, discountType: coupon.discountType, discountValue: String(coupon.discountValue), minOrderAmount: String(coupon.minOrderAmount || 0), maxDiscountAmount: String(coupon.maxDiscountAmount || 0), startsAt: dateOnly(coupon.startsAt), endsAt: dateOnly(coupon.endsAt), isActive: coupon.isActive });
    setError("");
  }

  function editOffer(offer) {
    setTab("offers");
    setEditingId(offer._id);
    setOfferForm({ title: offer.title, description: offer.description, discountLabel: offer.discountLabel, couponCode: offer.couponCode || "", startsAt: dateOnly(offer.startsAt), endsAt: dateOnly(offer.endsAt), isActive: offer.isActive });
    setError("");
  }

  async function saveCoupon(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const body = { ...couponForm, code: couponForm.code.trim().toUpperCase(), discountValue: Number(couponForm.discountValue), minOrderAmount: Number(couponForm.minOrderAmount) || 0, maxDiscountAmount: Number(couponForm.maxDiscountAmount) || 0, startsAt: dateToIso(couponForm.startsAt), endsAt: dateToIso(couponForm.endsAt, true) };
    try {
      const data = await api(editingId ? "/admin/commerce/coupons/" + editingId : "/admin/commerce/coupons", { method: editingId ? "PUT" : "POST", auth: true, body });
      setNotice(data.message || "Coupon saved.");
      setCouponForm(emptyCoupon());
      setEditingId("");
      await load();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }

  async function saveOffer(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const body = { ...offerForm, title: offerForm.title.trim(), couponCode: offerForm.couponCode.trim().toUpperCase(), startsAt: dateToIso(offerForm.startsAt), endsAt: dateToIso(offerForm.endsAt, true) };
    try {
      const data = await api(editingId ? "/admin/commerce/offers/" + editingId : "/admin/commerce/offers", { method: editingId ? "PUT" : "POST", auth: true, body });
      setNotice(data.message || "Offer saved.");
      setOfferForm(emptyOffer());
      setEditingId("");
      await load();
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  }

  async function deleteItem(kind, item) {
    const label = kind === "coupons" ? "coupon " + item.code : "offer " + item.title;
    if (!window.confirm("Delete " + label + "? This cannot be undone.")) return;
    try {
      const data = await api("/admin/commerce/" + kind + "/" + item._id, { method: "DELETE", auth: true });
      setNotice(data.message || "Item deleted.");
      if (editingId === item._id) startNew();
      await load();
    } catch (deleteError) { setError(deleteError.message); }
  }

  const currentList = tab === "coupons" ? coupons : offers;

  return <AdminLayout logout={logout} active="offers">
    <div className="page-head"><div><div className="crumb-small">Admin Portal &gt; <strong>Offers & coupons</strong></div><h1>Offers & coupons</h1><p>Create student promotions and checkout coupon codes.</p></div></div>
    <div className="commerce-tabs" role="tablist" aria-label="Offer management"><button type="button" role="tab" aria-selected={tab === "coupons"} className={tab === "coupons" ? "active" : ""} onClick={() => switchTab("coupons")}>Coupons</button><button type="button" role="tab" aria-selected={tab === "offers"} className={tab === "offers" ? "active" : ""} onClick={() => switchTab("offers")}>Student offers</button></div>
    {error && <div className="admin-course-message error" role="alert">{error}<button type="button" onClick={() => setError("")}>×</button></div>}
    {notice && <div className="admin-course-message success" role="status">{notice}<button type="button" onClick={() => setNotice("")}>×</button></div>}
    <div className="commerce-management-grid">
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>{editingId ? "Edit " : "Create "}{tab === "coupons" ? "coupon" : "offer"}</h2><p>{tab === "coupons" ? "Students enter coupon codes at checkout." : "Active offers appear in the student dashboard."}</p></div></div>
        {tab === "coupons" ? <form className="commerce-form" onSubmit={saveCoupon}>
          <label><span>Coupon code</span><input required maxLength={32} value={couponForm.code} onChange={(event) => setCouponForm({ ...couponForm, code: event.target.value.toUpperCase() })} placeholder="WELCOME10" /></label>
          <label><span>Discount type</span><select value={couponForm.discountType} onChange={(event) => setCouponForm({ ...couponForm, discountType: event.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (₹)</option></select></label>
          <label><span>{couponForm.discountType === "percentage" ? "Percent off" : "Amount off (₹)"}</span><input required type="number" min="0.01" max={couponForm.discountType === "percentage" ? 100 : 1000000} step="0.01" value={couponForm.discountValue} onChange={(event) => setCouponForm({ ...couponForm, discountValue: event.target.value })} /></label>
          <label><span>Minimum cart value (₹)</span><input type="number" min="0" step="1" value={couponForm.minOrderAmount} onChange={(event) => setCouponForm({ ...couponForm, minOrderAmount: event.target.value })} /></label>
          {couponForm.discountType === "percentage" && <label><span>Maximum discount (₹, 0 = no cap)</span><input type="number" min="0" step="1" value={couponForm.maxDiscountAmount} onChange={(event) => setCouponForm({ ...couponForm, maxDiscountAmount: event.target.value })} /></label>}
          <label><span>Starts</span><input required type="date" value={couponForm.startsAt} onChange={(event) => setCouponForm({ ...couponForm, startsAt: event.target.value })} /></label>
          <label><span>Expires</span><input required type="date" value={couponForm.endsAt} onChange={(event) => setCouponForm({ ...couponForm, endsAt: event.target.value })} /></label>
          <label className="commerce-active-check"><input type="checkbox" checked={couponForm.isActive} onChange={(event) => setCouponForm({ ...couponForm, isActive: event.target.checked })} /><span>Active</span></label>
          <div className="commerce-form-actions">{editingId && <button type="button" className="secondary-button button-small" onClick={startNew}>Cancel edit</button>}<button className="primary-button button-small" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save coupon" : "Create coupon"}</button></div>
        </form> : <form className="commerce-form" onSubmit={saveOffer}>
          <label><span>Offer title</span><input required minLength={3} maxLength={100} value={offerForm.title} onChange={(event) => setOfferForm({ ...offerForm, title: event.target.value })} placeholder="Spring learning sale" /></label>
          <label><span>Display discount</span><input required maxLength={50} value={offerForm.discountLabel} onChange={(event) => setOfferForm({ ...offerForm, discountLabel: event.target.value })} placeholder="20% off" /></label>
          <label className="wide-field"><span>Description</span><textarea required maxLength={500} rows="3" value={offerForm.description} onChange={(event) => setOfferForm({ ...offerForm, description: event.target.value })} /></label>
          <label><span>Coupon code (optional)</span><select value={offerForm.couponCode} onChange={(event) => setOfferForm({ ...offerForm, couponCode: event.target.value })}><option value="">No coupon</option>{coupons.map((coupon) => <option value={coupon.code} key={coupon._id}>{coupon.code}</option>)}</select></label>
          <label><span>Starts</span><input required type="date" value={offerForm.startsAt} onChange={(event) => setOfferForm({ ...offerForm, startsAt: event.target.value })} /></label>
          <label><span>Expires</span><input required type="date" value={offerForm.endsAt} onChange={(event) => setOfferForm({ ...offerForm, endsAt: event.target.value })} /></label>
          <label className="commerce-active-check"><input type="checkbox" checked={offerForm.isActive} onChange={(event) => setOfferForm({ ...offerForm, isActive: event.target.checked })} /><span>Active</span></label>
          <div className="commerce-form-actions">{editingId && <button type="button" className="secondary-button button-small" onClick={startNew}>Cancel edit</button>}<button className="primary-button button-small" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save offer" : "Create offer"}</button></div>
        </form>}
      </section>
      <section className="admin-panel"><div className="admin-panel-heading"><div><h2>{tab === "coupons" ? "Coupon codes" : "Student offers"}</h2><p>{currentList.length} total</p></div></div>
        {loading ? <div className="admin-profile-loading">Loading…</div> : !currentList.length ? <div className="admin-profile-loading">No {tab} created yet.</div> : <div className="commerce-record-list">{currentList.map((item) => <article className="commerce-record" key={item._id}><div><strong>{tab === "coupons" ? item.code : item.title}</strong><small>{tab === "coupons" ? couponSummary(item) : offerSummary(item)}</small><small>Valid {dateLabel(item.startsAt)} – {dateLabel(item.endsAt)}</small></div><span className={"status-badge " + (item.isActive ? "status-active" : "status-blocked")}>{item.isActive ? "Active" : "Inactive"}</span><div className="commerce-record-actions"><button type="button" onClick={() => tab === "coupons" ? editCoupon(item) : editOffer(item)}>Edit</button><button type="button" className="delete" onClick={() => deleteItem(tab, item)}>Delete</button></div></article>)}</div>}
      </section>
    </div>
  </AdminLayout>;
}
