import { useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { navigate } from "../services/navigation.js";
import { useAuth } from "../context/AuthContext.jsx";
import { ProfileAvatar } from "./ProfileAvatar.jsx";
import { SkillBridgeLogo } from "./SkillBridgeLogo.jsx";
import "../pages/StudentDashboard.css";

const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6" /></>,
  cap: <><path d="m2 10 10-6 10 6-10 6-10-6Z" /><path d="M6 12v5c2.4 2 9.6 2 12 0v-5M22 10v6" /></>,
  chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /><path d="M16 7h3v3" /></>,
  tag: <><path d="M20 13 13 20a2 2 0 0 1-2.8 0L3 12.8V4h8.8L19 11.2a2.5 2.5 0 0 1 1 1.8Z" /><circle cx="7.5" cy="8" r="1" /></>,
  heart: <path d="M20.8 8.8c0 5.5-8.8 11-8.8 11s-8.8-5.5-8.8-11A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z" />,
  support: <><path d="M3 13v-2a9 9 0 0 1 18 0v2" /><path d="M3 13h4v7H5a2 2 0 0 1-2-2v-5Zm18 0h-4v7h2a2 2 0 0 0 2-2v-5Z" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  cart: <><circle cx="9" cy="20" r="1" /><circle cx="19" cy="20" r="1" /><path d="M2 3h2l2.5 12.2a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.9-1.4L22 8H5" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  exit: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
};

function Icon({ name, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}

export function StudentPortalHeader({
  active = "",
  onLogout,
  searchValue,
  onSearchChange,
  searchResults: controlledResults,
  searchLoading: controlledLoading,
  searchError: controlledError,
}) {
  const { user: account } = useAuth();
  const searchInput = useRef(null);
  const mobileMenuButtonRef = useRef(null);
  const mobileNavRef = useRef(null);
  const notificationWrapRef = useRef(null);
  const profileWrapRef = useRef(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [localResults, setLocalResults] = useState([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);

  const controlledSearch = typeof searchValue === "string";
  const search = controlledSearch ? searchValue : localSearch;
  const searchResults = controlledSearch ? controlledResults || [] : localResults;
  const searchLoading = controlledSearch ? Boolean(controlledLoading) : localLoading;
  const searchError = controlledSearch ? controlledError || "" : localError;
  const firstName = (account?.name || "Student").trim().split(/\s+/)[0];
  const initials = (account?.name || "Student").trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  function updateSearch(value) {
    if (!controlledSearch) setLocalSearch(value);
    onSearchChange?.(value);
  }

  useEffect(() => {
    if (controlledSearch) return undefined;
    const query = localSearch.trim();
    if (query.length < 2) {
      setLocalResults([]);
      setLocalError("");
      setLocalLoading(false);
      return undefined;
    }
    let activeRequest = true;
    setLocalResults([]);
    const timer = window.setTimeout(async () => {
      setLocalLoading(true);
      setLocalError("");
      try {
        const data = await api(`/courses?limit=6&search=${encodeURIComponent(query)}`, { method: "GET", auth: true });
        if (activeRequest) setLocalResults(data.courses || []);
      } catch (error) {
        if (activeRequest) {
          setLocalResults([]);
          setLocalError(error.message || "Unable to search courses.");
        }
      } finally {
        if (activeRequest) setLocalLoading(false);
      }
    }, 250);
    return () => {
      activeRequest = false;
      window.clearTimeout(timer);
    };
  }, [controlledSearch, localSearch]);

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;
      if (
        mobileNavOpen &&
        !mobileNavRef.current?.contains(target) &&
        !mobileMenuButtonRef.current?.contains(target)
      ) {
        setMobileNavOpen(false);
      }
      if (notificationsOpen && !notificationWrapRef.current?.contains(target)) {
        setNotificationsOpen(false);
      }
      if (profileOpen && !profileWrapRef.current?.contains(target)) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavOpen, notificationsOpen, profileOpen]);

  useEffect(() => {
    let activeRequest = true;
    const loadCartCount = async () => {
      try {
        const data = await api("/cart", { method: "GET", auth: true });
        if (activeRequest) setCartCount((data.items || []).length);
      } catch {
        if (activeRequest) setCartCount(0);
      }
    };
    loadCartCount();
    window.addEventListener("focus", loadCartCount);
    return () => {
      activeRequest = false;
      window.removeEventListener("focus", loadCartCount);
    };
  }, []);

  async function loadNotifications() {
    setNotificationsLoading(true);
    setNotificationsError("");
    try {
      const data = await api("/notifications", { method: "GET", auth: true });
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch (error) {
      setNotificationsError(error.message || "Unable to load notifications.");
    } finally {
      setNotificationsLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    window.addEventListener("focus", loadNotifications);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", loadNotifications);
    };
  }, []);

  function openCourse(course) {
    updateSearch("");
    navigate(`/courses/${course.id || course._id}`);
  }

  function openAllResults() {
    const query = search.trim();
    if (query) navigate(`/courses?search=${encodeURIComponent(query)}`);
  }

  async function markNotificationRead(notification) {
    setNotificationsOpen(false);
    if (!notification.readAt) {
      try {
        await api(`/notifications/${encodeURIComponent(notification.id)}/read`, { method: "PATCH", auth: true, body: {} });
        setNotifications((current) => current.filter((item) => item.id !== notification.id));
        setUnreadCount((current) => Math.max(0, current - 1));
      } catch (error) {
        setNotificationsError(error.message || "Unable to update this notification.");
        return;
      }
    }
    if (notification.linkPath) navigate(notification.linkPath);
  }

  async function markAllNotificationsRead() {
    try {
      await api("/notifications/read-all", { method: "PATCH", auth: true, body: {} });
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      setNotificationsError(error.message || "Unable to update notifications.");
    }
  }

  const navItems = [
    { label: "Dashboard", key: "dashboard", path: "/dashboard", icon: "grid" },
    { label: "Courses", key: "courses", path: "/courses", icon: "book" },
    { label: "My Courses", key: "enrolled", path: "/my-courses", icon: "cap" },
    { label: "Progress", key: "progress", path: "/progress", icon: "chart" },
    { label: "Wishlist", key: "wishlist", path: "/wishlist", icon: "heart" },
    { label: "Offers", key: "offers", path: "/offers", icon: "tag" },
    { label: "Help", key: "help", path: "/help", icon: "support" },
  ];

  function selectNav(item) {
    setMobileNavOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
    if (item.key === "dashboard" && active === "dashboard") window.scrollTo({ top: 0, behavior: "smooth" });
    else navigate(item.path);
  }

  return <header className="student-header portal-blue-header">
    <div className="student-header-inner">
      <button ref={mobileMenuButtonRef} className="student-mobile-menu" type="button" aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileNavOpen} onClick={() => {
        const opening = !mobileNavOpen;
        setMobileNavOpen(opening);
        if (opening) {
          setNotificationsOpen(false);
          setProfileOpen(false);
        }
      }}>
        <Icon name="menu" size={20} />
      </button>
      <button className="student-brand" type="button" onClick={() => active === "dashboard" ? window.scrollTo({ top: 0, behavior: "smooth" }) : navigate("/dashboard")} aria-label="SkillBridge home">
        <SkillBridgeLogo className="student-brand-lockup" size="small" theme="inverse" />
        <span className="student-role-pill">STUDENT</span>
      </button>
      <nav ref={mobileNavRef} className={`student-nav${mobileNavOpen ? " is-open" : ""}`} aria-label="Student navigation">
        {navItems.map((item) => <button key={item.key} type="button" className={`student-nav-item${active === item.key ? " is-active" : ""}`} aria-current={active === item.key ? "page" : undefined} onClick={() => selectNav(item)}>
          <Icon name={item.icon} size={16} /><span>{item.label}</span>
        </button>)}
      </nav>
      <div className="student-search-wrap">
        <label className="student-quick-search">
          <Icon name="search" size={16} />
          <input
            aria-label="Search all courses"
            aria-autocomplete="list"
            aria-controls="student-search-results"
            aria-expanded={search.trim().length >= 2}
            role="combobox"
            ref={searchInput}
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") updateSearch("");
              if (event.key === "Enter" && search.trim().length >= 2) openAllResults();
            }}
            placeholder="Search courses..."
          />
        </label>
        {search.trim().length >= 2 && <div className="student-search-results" id="student-search-results" role="listbox" aria-label="Course search results">
          {searchLoading ? <p className="student-search-state" role="status">Searching all courses…</p> : searchError ? <p className="student-search-state error" role="alert">{searchError}</p> : searchResults.length ? <>
            {searchResults.map((course) => <button type="button" role="option" className="student-search-result-item" key={course.id || course._id} onClick={() => openCourse(course)}>
              <span><strong>{course.title}</strong><small>{course.category || "Course"} · {course.level || "All levels"}</small></span>
              <b>{course.isFree || Number(course.price) === 0 ? "Free" : `₹${Number(course.price).toLocaleString("en-IN")}`}</b>
            </button>)}
            <button type="button" className="student-search-view-all" onClick={openAllResults}>View all results for “{search.trim()}”</button>
          </> : <p className="student-search-state">No courses found for “{search.trim()}”.</p>}
        </div>}
      </div>
      <div className="student-header-actions">
        <button type="button" className="student-icon-button student-cart-button" onClick={() => {
          setMobileNavOpen(false);
          setNotificationsOpen(false);
          setProfileOpen(false);
          navigate("/cart");
        }} aria-label={cartCount ? `Shopping cart, ${cartCount} items` : "Shopping cart"} title="Cart">
          <Icon name="cart" size={18} />{cartCount > 0 && <span className="student-cart-count">{cartCount > 9 ? "9+" : cartCount}</span>}
        </button>
        <div ref={notificationWrapRef} className="student-notification-wrap">
          <button type="button" className="student-icon-button student-notification" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} aria-expanded={notificationsOpen} aria-controls="student-notification-panel" onClick={() => {
            const opening = !notificationsOpen;
            setNotificationsOpen(opening);
            if (opening) {
              setMobileNavOpen(false);
              setProfileOpen(false);
              loadNotifications();
            }
          }}>
            <Icon name="bell" size={18} />{unreadCount > 0 && <span className="student-notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </button>
          {notificationsOpen && <section className="student-notification-panel" id="student-notification-panel" aria-label="Notifications">
            <div className="student-notification-heading"><strong>Notifications</strong><button type="button" onClick={markAllNotificationsRead} disabled={!unreadCount || notificationsLoading}>Mark all read</button></div>
            {notificationsLoading ? <p className="student-notification-state" role="status">Loading notifications…</p> : notificationsError ? <p className="student-notification-state error" role="alert">{notificationsError}</p> : notifications.length ? <div className="student-notification-list">{notifications.map((notification) => <button type="button" key={notification.id} className={`student-notification-item${notification.readAt ? " is-read" : " is-unread"}`} onClick={() => markNotificationRead(notification)}>
              <span className="student-notification-item-title">{notification.title}</span>
              <span className="student-notification-item-message">{notification.message}</span>
              <small>{new Date(notification.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</small>
            </button>)}</div> : <p className="student-notification-state">You’re all caught up. New offers, enrollments, and lesson updates will show here.</p>}
          </section>}
        </div>
        <div ref={profileWrapRef} className="student-profile-wrap">
          <button className="student-profile" type="button" aria-expanded={profileOpen} onClick={() => {
            const opening = !profileOpen;
            setProfileOpen(opening);
            if (opening) {
              setMobileNavOpen(false);
              setNotificationsOpen(false);
            }
          }} aria-label={`Open profile menu for ${account?.name || "student"}`}>
            <ProfileAvatar profileImage={account?.profileImage} initials={initials} className="student-avatar" />
            <span className="student-profile-copy"><strong>{firstName}<span className="student-header-role">STUDENT</span></strong><small>{account?.email || "Signed in"}</small></span>
          </button>
          {profileOpen && <div className="student-profile-menu">
            <strong>{account?.name || "Student"}</strong>
            <span>{account?.email || ""}</span>
            <button type="button" onClick={() => { setProfileOpen(false); navigate("/profile"); }}><Icon name="user" size={16} /> Edit profile</button>
            <button type="button" onClick={() => { setProfileOpen(false); onLogout?.(); }}><Icon name="exit" size={16} /> Sign out</button>
          </div>}
        </div>
      </div>
    </div>
  </header>;
}
