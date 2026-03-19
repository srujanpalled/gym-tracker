import { useState, useEffect, useRef, useCallback } from "react";
import { App as CapacitorApp } from '@capacitor/app';
import "./index.css";
import LockScreen from "./src/LockScreen";

// ─── PLANS ───────────────────────────────────────────────────
const DEFAULT_PLANS = [
  { id: "plan1", label: "1 Month",  days: 30,  price: 800  },
  { id: "plan2", label: "3 Months", days: 90,  price: 2100 },
  { id: "plan3", label: "6 Months", days: 180, price: 3800 },
  { id: "plan4", label: "1 Year",   days: 365, price: 6500 },
];

// No sample data, start fresh

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today() { return new Date().toISOString().split("T")[0]; }

function safeDate(ymd) {
  if (!ymd) return new Date();
  const parts = ymd.split("-");
  if (parts.length !== 3) return new Date(ymd);
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function daysLeft(member, plans) {
  let days = member.plan === "custom" ? (member.customDays || 0) : (plans.find(p => p.id === member.plan)?.days || 0);
  const expiry = safeDate(member.joinDate);
  expiry.setDate(expiry.getDate() + days);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return Math.round((expiry - todayStart) / (1000 * 60 * 60 * 24));
}

function expiryDate(member, plans) {
  let days = member.plan === "custom" ? (member.customDays || 0) : (plans.find(p => p.id === member.plan)?.days || 0);
  const d = safeDate(member.joinDate);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getStatus(days) {
  if (days < 0)   return "expired";
  if (days <= 5)  return "critical";
  if (days <= 10) return "warning";
  return "active";
}

function avatarColor(name) {
  const colors = ["#f97316","#8b5cf6","#06b6d4","#ec4899","#10b981","#f59e0b","#3b82f6"];
  return colors[name.charCodeAt(0) % colors.length];
}

function sendWhatsApp(member, plans) {
  const days = daysLeft(member, plans);
  const isCustom = member.plan === "custom";
  const planLabel = isCustom ? "Custom Plan" : plans.find(p => p.id === member.plan)?.label;
  const planPrice = isCustom ? member.customPrice : plans.find(p => p.id === member.plan)?.price;
  
  let msg = "";
  if (days < 0) {
    msg = `*Hi ${member.name}!* 💪🏋️‍♂️\n\nHope you're doing great! This is a gentle reminder that your Gym Membership at *FitTrack* has *expired*.\n\nDon't lose your momentum! Let's get back to grinding. 💯\n\n📋 *Plan:* ${planLabel}\n💰 *Amount:* ₹${planPrice}\n\nLooking forward to seeing you at the gym soon! 🏃‍♂️🔥`;
  } else if (days <= 7) {
    const dStr = days === 0 ? "today" : `in *${days} day${days===1?"":"s"}*`;
    msg = `*Hi ${member.name}!* 💪\n\nCrushing those workouts! 🔥 Just a quick heads-up that your gym membership is expiring ${dStr}.\n\nKeep the consistency going! 💯 Please renew your membership to continue without interruption.\n\n📋 *Plan:* ${planLabel}\n💰 *Amount:* ₹${planPrice}\n\nKeep pushing your limits! 🏋️‍♀️✨`;
  } else {
    msg = `*Hi ${member.name}!* 💪\n\nYour membership is active for *${days} more days*.\n\nConsistency is key! Keep up the great work and keep pushing! 🏋️‍♂️🔥`;
  }
  
  window.open(`https://wa.me/91${member.phone}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ─── SMALL COMPONENTS ────────────────────────────────────────
function Avatar({ name, size = 40 }) {
  const color = avatarColor(name);
  return (
    <div className="member-avatar" style={{
      width: size, height: size, background: color,
      color: "#fff", fontSize: size * 0.38, flexShrink: 0
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function Badge({ days }) {
  const status = getStatus(days);
  const cls = { active:"badge-active", warning:"badge-warning", critical:"badge-danger", expired:"badge-muted" }[status];
  const label = days < 0 ? "Expired" : days === 0 ? "Today!" : `${days}d left`;
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Toast({ msg, type }) {
  return (
    <div className={`toast ${type === "error" ? "error" : type === "success" ? "success" : ""}`}>
      {msg}
    </div>
  );
}

function SkeletonCards({ count = 4, type = "member" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`skeleton ${type === "stat" ? "skeleton-stat" : "skeleton-card"}`}
          style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

// ─── NEW LOCK SCREEN INTEGRATED IN APP DIRECTLY ─────────────────

// ─── MAIN APP ─────────────────────────────────────────────────
export default function App() {
  const [isAuth, setIsAuth]   = useState(() => localStorage.getItem("gm_auth") === "true");
  const [theme, setTheme]     = useState(() => localStorage.getItem("gm_theme") || "dark");
  const [members, setMembers] = useState(() => {
    try { const s = localStorage.getItem("gm_members"); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [plans, setPlans] = useState(() => {
    try { const s = localStorage.getItem("gm_plans"); return s ? JSON.parse(s) : DEFAULT_PLANS; } catch { return DEFAULT_PLANS; }
  });

  const [page, setPage]           = useState("dashboard");
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all");
  const [toast, setToast]         = useState(null);
  const [editId, setEditId]       = useState(null);
  const [confirmDel, setConfirmDel]   = useState(null);
  const [confirmRenew, setConfirmRenew] = useState(null);
  const [renewPlan, setRenewPlan] = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [planForm, setPlanForm]   = useState({ label: "", days: "", price: "" });
  const [form, setForm] = useState({
    name: "", phone: "", plan: "plan1", joinDate: today(), customPrice: "", customMonths: ""
  });

  // Persist
  useEffect(() => { localStorage.setItem("gm_members", JSON.stringify(members)); }, [members]);
  useEffect(() => { localStorage.setItem("gm_plans",   JSON.stringify(plans));   }, [plans]);
  useEffect(() => { localStorage.setItem("gm_auth",    isAuth);                  }, [isAuth]);
  useEffect(() => {
    localStorage.setItem("gm_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Simulate loading
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(t);
  }, []);

  // Close sidebar on outside click or route change
  useEffect(() => { setSidebarOpen(false); }, [page]);

  // Handle hardware back button for Android
  useEffect(() => {
    let listener;
    const setupListener = async () => {
      listener = await CapacitorApp.addListener('backButton', () => {
        setPage(currentPage => {
          if (currentPage !== "dashboard") {
            // Close any open modals/sidebars and go to dashboard
            setConfirmDel(null);
            setConfirmRenew(null);
            setSidebarOpen(false);
            return "dashboard";
          } else {
            // On dashboard, allow the app to close
            CapacitorApp.exitApp();
            return currentPage;
          }
        });
      });
    };
    setupListener();
    
    return () => {
      if (listener) listener.remove();
    };
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  function goTo(p) {
    setPage(p);
    if (p !== "add") {
      setEditId(null);
      setForm({ name: "", phone: "", plan: plans[0]?.id || "plan1", joinDate: today(), customPrice: "", customMonths: "" });
    }
  }

  function handleSave() {
    if (!form.name.trim() || !form.phone.trim()) { showToast("Name and phone are required", "error"); return; }
    if (form.phone.replace(/\D/g, "").length < 10) { showToast("Enter a valid 10-digit number", "error"); return; }
    let finalForm = { ...form };
    if (form.plan === "custom") {
      const price = parseInt(form.customPrice);
      const months = parseInt(form.customMonths);
      if (isNaN(price) || price < 0) { showToast("Enter a valid custom price", "error"); return; }
      if (isNaN(months) || months <= 0) { showToast("Enter valid duration in months", "error"); return; }
      finalForm.customDays  = months * 30;
      finalForm.customPrice = price;
    }
    if (editId) {
      setMembers(p => p.map(m => m.id === editId ? { ...m, ...finalForm } : m));
      showToast("✅ Member updated"); setEditId(null);
    } else {
      setMembers(p => [...p, { ...finalForm, id: Date.now(), phone: finalForm.phone.replace(/\D/g, "") }]);
      showToast("✅ Member added");
    }
    setForm({ name: "", phone: "", plan: plans[0]?.id || "plan1", joinDate: today(), customPrice: "", customMonths: "" });
    setPage("members");
  }

  function startEdit(m) {
    setForm({ name: m.name, phone: m.phone, plan: m.plan, joinDate: m.joinDate,
      customPrice: m.customPrice || "", customMonths: m.customDays ? m.customDays / 30 : "" });
    setEditId(m.id); setPage("add");
  }

  function renewMember(id) {
    const member = members.find(m => m.id === id);
    setRenewPlan(member.plan);
    setConfirmRenew(member);
  }

  function doRenew() {
    setMembers(p => p.map(m => m.id === confirmRenew.id ? { ...m, joinDate: today(), plan: renewPlan } : m));
    showToast(`✅ ${confirmRenew.name}'s membership renewed`);
    setConfirmRenew(null);
  }

  function deleteMember(id) {
    setMembers(p => p.filter(m => m.id !== id));
    setConfirmDel(null); showToast("Member removed");
  }

  function startEditPlan(plan) {
    setEditingPlan(plan.id);
    setPlanForm({ label: plan.label, days: String(plan.days), price: String(plan.price) });
  }

  function savePlan(planId) {
    const days = parseInt(planForm.days), price = parseInt(planForm.price);
    if (!planForm.label.trim())  { showToast("Plan name required","error"); return; }
    if (isNaN(days)  || days<1)  { showToast("Enter valid days","error"); return; }
    if (isNaN(price) || price<1) { showToast("Enter valid price","error"); return; }
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, label: planForm.label.trim(), days, price } : p));
    setEditingPlan(null); showToast("✅ Plan updated");
  }

  function addNewPlan() {
    const newPlan = { id: "plan_" + Date.now(), label: "New Plan", days: 30, price: 999 };
    setPlans(prev => [...prev, newPlan]);
    startEditPlan(newPlan);
  }

  function deletePlan(planId) {
    if (plans.length <= 1) { showToast("Must have at least 1 plan","error"); return; }
    if (members.some(m => m.plan === planId)) { showToast("Can't delete — members on this plan","error"); return; }
    setPlans(prev => prev.filter(p => p.id !== planId));
    showToast("Plan deleted");
  }

  // Derived state
  const expiring     = members.filter(m => { const d = daysLeft(m,plans); return d >= 0 && d <= 7; });
  const expired      = members.filter(m => daysLeft(m,plans) < 0);
  const active       = members.filter(m => daysLeft(m,plans) >= 0);
  const totalRevenue = members.reduce((s,m) => {
    if (m.plan === "custom") return s + (m.customPrice || 0);
    return s + (plans.find(p => p.id === m.plan)?.price || 0);
  }, 0);

  const filtered = members.filter(m => {
    const match = m.name.toLowerCase().includes(search.toLowerCase()) || m.phone.includes(search);
    const d = daysLeft(m,plans); const st = getStatus(d);
    if (filter === "active")   return match && st === "active";
    if (filter === "expiring") return match && (st === "warning" || st === "critical");
    if (filter === "expired")  return match && st === "expired";
    return match;
  });

  const navItems = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "members",   icon: "👥", label: "Members"   },
    { id: "add",       icon: "➕", label: "Add Member" },
    { id: "plans",     icon: "⚙️", label: "Edit Plans" },
  ];

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const isTablet = typeof window !== "undefined" && window.innerWidth >= 768 && window.innerWidth < 1024;
  const sidebarDesktop = typeof window !== "undefined" && window.innerWidth >= 1024;

  return (
    <div className="app-root" data-theme={theme}>
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ── TOP HEADER ── */}
      <header className="top-header">
        <button
          className={`hamburger ${sidebarOpen ? "open" : ""}`}
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle menu"
          style={{ display: sidebarDesktop ? "none" : "flex" }}
        >
          <span /><span /><span />
        </button>

        <div className="header-logo">
          <div className="header-logo-icon">💪</div>
          <div className="header-logo-text">
            <div className="header-logo-name">FitTrack</div>
            <div className="header-logo-sub">Gym Manager</div>
          </div>
        </div>

        <div className="header-spacer" />

        <div className="header-actions">
          {(expiring.length > 0 || expired.length > 0) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { goTo("dashboard"); }}
              title="View alerts"
              style={{ gap: 6 }}
            >
              🔔 <span style={{ background: "var(--danger)", color:"white", borderRadius:"var(--radius-full)", padding:"2px 7px", fontSize: 10, fontWeight:700 }}>
                {expiring.length + expired.length}
              </span>
            </button>
          )}
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
        </div>
      </header>

      {/* ── OVERLAY (mobile/tablet) ── */}
      <div
        className={`overlay ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${
        sidebarDesktop
          ? (sidebarCollapsed ? "collapsed" : "")
          : (sidebarOpen ? (isMobile ? "mobile-open" : "tablet-open") : "")
      }`}>

        {/* Collapse button (desktop only) */}
        {sidebarDesktop && (
          <button
            className="collapse-btn"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        )}

        <nav className="sidebar-nav">
          <div className="nav-group-label">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => { goTo(item.id); setSidebarOpen(false); }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}

          {(expiring.length > 0 || expired.length > 0) && (
            <>
              <div className="nav-group-label" style={{ marginTop: 8 }}>Alerts</div>
              {expiring.length > 0 && (
                <button className="nav-item" onClick={() => { goTo("members"); setFilter("expiring"); setSidebarOpen(false); }}>
                  <span className="nav-icon">⚠️</span>
                  <span className="nav-label">Expiring Soon</span>
                  <span className="alert-badge">{expiring.length}</span>
                </button>
              )}
              {expired.length > 0 && (
                <button className="nav-item" onClick={() => { goTo("members"); setFilter("expired"); setSidebarOpen(false); }}>
                  <span className="nav-icon">🔴</span>
                  <span className="nav-label">Expired</span>
                  <span className="alert-badge">{expired.length}</span>
                </button>
              )}
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            onClick={() => setIsAuth(false)}
            style={{ color: "var(--danger)" }}
          >
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className={`main-content ${sidebarDesktop && sidebarCollapsed ? "sidebar-collapsed" : ""}`}>

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <div className="page-enter">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Your gym at a glance — {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}</p>

            {loading ? (
              <>
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                  {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-stat" />)}
                </div>
                <SkeletonCards count={3} />
              </>
            ) : (
              <>
                {/* Stat Cards */}
                <div className="stats-grid">
                  {[
                    { icon:"👥", label:"Total Members", value: members.length, color:"var(--text-primary)", onClick: () => goTo("members") },
                    { icon:"✅", label:"Active",         value: active.length, color:"var(--success)", onClick: () => { goTo("members"); setFilter("active"); } },
                    { icon:"⚠️", label:"Expiring",      value: expiring.length, color:"var(--warning)", onClick: () => { goTo("members"); setFilter("expiring"); } },
                    { icon:"💰", label:"Est. Revenue",   value: `₹${(totalRevenue/1000).toFixed(1)}k`, color:"var(--accent)" },
                  ].map((s, i) => (
                    <div key={i} className="stat-card" onClick={s.onClick} style={{ cursor: s.onClick ? "pointer" : "default", animationDelay: `${i * 0.08}s` }}>
                      <div className="stat-icon">{s.icon}</div>
                      <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Expiring alerts */}
                {expiring.length > 0 && (
                  <div className="alert-section alert-warning">
                    <div className="alert-section-title">⚠️ Expiring Within 7 Days ({expiring.length})</div>
                    {expiring.map(m => (
                      <div key={m.id} className="alert-member-row">
                        <Avatar name={m.name} size={36} />
                        <div className="alert-member-info">
                          <div style={{ fontWeight:600, fontSize:"var(--text-base)" }}>{m.name}</div>
                          <div style={{ color:"var(--text-muted)", fontSize:"var(--text-xs)" }}>📱 {m.phone}</div>
                        </div>
                        <Badge days={daysLeft(m, plans)} />
                        <div className="alert-member-actions">
                          <button className="btn btn-whatsapp btn-sm btn-icon" onClick={() => sendWhatsApp(m, plans)} title="WhatsApp">💬</button>
                          <button className="btn btn-primary btn-sm" onClick={() => renewMember(m.id)}>Renew</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expired */}
                {expired.length > 0 && (
                  <div className="alert-section alert-danger">
                    <div className="alert-section-title">❌ Expired ({expired.length})</div>
                    {expired.map(m => (
                      <div key={m.id} className="alert-member-row">
                        <Avatar name={m.name} size={36} />
                        <div className="alert-member-info">
                          <div style={{ fontWeight:600, fontSize:"var(--text-base)", color:"var(--text-secondary)" }}>{m.name}</div>
                          <div style={{ color:"var(--text-muted)", fontSize:"var(--text-xs)" }}>
                            📱 {m.phone} · {m.plan === "custom" ? "Custom" : plans.find(p => p.id === m.plan)?.label}
                          </div>
                        </div>
                        <div className="alert-member-actions">
                          <button className="btn btn-whatsapp btn-sm btn-icon" onClick={() => sendWhatsApp(m, plans)} title="WhatsApp">💬</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => renewMember(m.id)}>Renew</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {members.length === 0 && (
                  <div className="empty-state">
                    <span className="empty-state-icon">🏋️</span>
                    <div className="empty-state-title">No members yet</div>
                    <p className="empty-state-desc">Add your first member to get started</p>
                    <button className="btn btn-primary" onClick={() => goTo("add")}>+ Add First Member</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MEMBERS */}
        {page === "members" && (
          <div className="page-enter">
            <div className="flex items-center justify-between mb-6" style={{ flexWrap:"wrap", gap:"var(--space-3)" }}>
              <div>
                <h1 className="page-title">Members</h1>
                <p className="page-subtitle" style={{ marginBottom: 0 }}>{filtered.length} of {members.length} members</p>
              </div>
              <button className="btn btn-primary" onClick={() => goTo("add")}>+ Add Member</button>
            </div>

            {/* Search + Filters */}
            <div className="flex gap-3 mb-6" style={{ flexWrap:"wrap" }}>
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  className="form-input"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search name or phone..."
                  style={{ paddingLeft: 38 }}
                />
              </div>
              <div className="filter-tabs">
                {["all","active","expiring","expired"].map(f => (
                  <button key={f} className={`filter-tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
            </div>

            {/* Table header (desktop) */}
            {filtered.length > 0 && (
              <div className="table-header" style={{ display: "grid" }}>
                {["Member","Phone","Plan","Status","Actions"].map(h => (
                  <div key={h} className="table-header-cell">{h}</div>
                ))}
              </div>
            )}

            {loading ? <SkeletonCards count={5} /> : (
              <div className="members-grid">
                {filtered.map((m, i) => {
                  const days = daysLeft(m, plans);
                  const isCustom = m.plan === "custom";
                  const planLabel = isCustom ? "Custom Plan" : plans.find(p => p.id === m.plan)?.label || "—";
                  const planPrice = isCustom ? m.customPrice : plans.find(p => p.id === m.plan)?.price;
                  return (
                    <div key={m.id} className="member-card" style={{ animationDelay: `${i * 0.05}s` }}>
                      {/* Desktop row layout */}
                      <div className="member-row-desktop" style={{ flex: 1 }}>
                        {/* Member Info */}
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name} size={38} />
                          <div style={{ minWidth: 0 }}>
                            <div className="member-name">{m.name}</div>
                            <div className="member-meta">Expires {expiryDate(m, plans)}</div>
                          </div>
                        </div>
                        {/* Phone */}
                        <div className="text-secondary text-sm">📱 {m.phone}</div>
                        {/* Plan */}
                        <div className="member-plan-detail">
                          <div style={{ fontWeight:500, fontSize:"var(--text-sm)" }}>{planLabel}</div>
                          <div className="text-sm text-muted">₹{planPrice}</div>
                        </div>
                        {/* Status */}
                        <Badge days={days} />
                        {/* Actions */}
                        <div className="member-actions">
                          <button className="btn btn-whatsapp btn-icon btn-sm" onClick={() => sendWhatsApp(m, plans)} title="WhatsApp">💬</button>
                          <button className="btn btn-primary btn-sm" onClick={() => renewMember(m.id)}>Renew</button>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => startEdit(m)} title="Edit">✏️</button>
                          <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirmDel(m)} title="Delete">🗑</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="empty-state">
                    <span className="empty-state-icon">🔍</span>
                    <div className="empty-state-title">No members found</div>
                    <p className="empty-state-desc">Try adjusting your search or filter</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ADD / EDIT */}
        {page === "add" && (
          <div className="page-enter" style={{ maxWidth: 520 }}>
            <h1 className="page-title">{editId ? "Edit Member" : "Add New Member"}</h1>
            <p className="page-subtitle">{editId ? "Update member details" : "Fill in the details below"}</p>

            <div className="glass-card" style={{ padding: "var(--space-8)" }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" placeholder="e.g. Rahul Sharma"
                  value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" placeholder="e.g. 9876543210" type="tel"
                  value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} />
              </div>

              <div className="form-group">
                <label className="form-label">Membership Plan</label>
                <div className="plan-options">
                  {plans.map(p => (
                    <button key={p.id} className={`plan-option ${form.plan === p.id ? "selected" : ""}`}
                      onClick={() => setForm(prev => ({...prev, plan: p.id}))}>
                      <div className="plan-option-name">{p.label}</div>
                      <div className="plan-option-detail">₹{p.price} · {p.days} days</div>
                    </button>
                  ))}
                  <button className={`plan-option ${form.plan === "custom" ? "selected" : ""}`}
                    onClick={() => setForm(prev => ({...prev, plan: "custom"}))}>
                    <div className="plan-option-name">Custom Plan</div>
                    <div className="plan-option-detail">Set price & duration</div>
                  </button>
                </div>
              </div>

              {form.plan === "custom" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom: "var(--space-5)",
                  background:"var(--glass-bg)", padding:14, borderRadius:"var(--radius-md)", border:"1px dashed var(--border-subtle)" }}>
                  <div>
                    <label className="form-label">Price (₹)</label>
                    <input className="form-input" type="number" placeholder="e.g. 1500" style={{ padding: "10px 12px" }}
                      value={form.customPrice} onChange={e => setForm(p => ({...p, customPrice: e.target.value}))} />
                  </div>
                  <div>
                    <label className="form-label">Duration (Months)</label>
                    <input className="form-input" type="number" placeholder="e.g. 2" style={{ padding: "10px 12px" }}
                      value={form.customMonths} onChange={e => setForm(p => ({...p, customMonths: e.target.value}))} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Join Date</label>
                <div style={{ display:"flex", gap:10 }}>
                  {[
                    { flex: 1.2, key: 0, options: Array.from({ length: 15 }, (_, i) => ({ v: String(new Date().getFullYear() + 2 - i), l: String(new Date().getFullYear() + 2 - i) })) },
                    { flex: 1.5, key: 1, options: ["01-Jan","02-Feb","03-Mar","04-Apr","05-May","06-Jun","07-Jul","08-Aug","09-Sep","10-Oct","11-Nov","12-Dec"].map(m => ({ v: m.slice(0,2), l: m })) },
                    { flex: 1,   key: 2, options: Array.from({ length: 31 }, (_, i) => ({ v: String(i+1).padStart(2,"0"), l: String(i+1).padStart(2,"0") })) },
                  ].map(sel => (
                    <select key={sel.key} className="form-select" style={{ flex: sel.flex }}
                      value={form.joinDate.split("-")[sel.key] || ""}
                      onChange={e => {
                        const parts = (form.joinDate || today()).split("-");
                        parts[sel.key] = e.target.value;
                        setForm(p => ({...p, joinDate: parts.join("-")}));
                      }}>
                      {sel.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  ))}
                </div>
              </div>

              <div style={{ display:"flex", gap:10 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => goTo("members")}>Cancel</button>
                <button className="btn btn-primary" style={{ flex:2 }} onClick={handleSave}>
                  {editId ? "💾 Save Changes" : "✅ Add Member"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PLANS */}
        {page === "plans" && (
          <div className="page-enter" style={{ maxWidth: 580 }}>
            <h1 className="page-title">Edit Plans</h1>
            <p className="page-subtitle">Change plan name, price, and duration anytime</p>

            {plans.map(plan => (
              <div key={plan.id} className={`plan-edit-card ${editingPlan === plan.id ? "editing" : ""}`}>
                {editingPlan !== plan.id ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div style={{ fontWeight:700, fontSize:"var(--text-md)" }}>{plan.label}</div>
                      <div className="text-muted text-sm" style={{ marginTop:4 }}>
                        ₹{plan.price.toLocaleString("en-IN")} &nbsp;·&nbsp; {plan.days} days
                        &nbsp;·&nbsp; {members.filter(m => m.plan === plan.id).length} members
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" onClick={() => startEditPlan(plan)}>✏️ Edit</button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => deletePlan(plan.id)}>🗑</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight:700, fontSize:"var(--text-xs)", color:"var(--accent)", marginBottom:"var(--space-4)", textTransform:"uppercase", letterSpacing:1 }}>Editing Plan</div>
                    <div className="plan-edit-grid">
                      <div>
                        <label className="form-label">Plan Name</label>
                        <input className="form-input" style={{ padding:"10px 12px", fontSize:"var(--text-sm)" }}
                          value={planForm.label} onChange={e => setPlanForm(p => ({...p, label: e.target.value}))} placeholder="e.g. 1 Month" />
                      </div>
                      <div>
                        <label className="form-label">Price (₹)</label>
                        <input className="form-input" type="number" style={{ padding:"10px 12px", fontSize:"var(--text-sm)" }}
                          value={planForm.price} onChange={e => setPlanForm(p => ({...p, price: e.target.value}))} placeholder="e.g. 800" />
                      </div>
                      <div>
                        <label className="form-label">Duration (days)</label>
                        <input className="form-input" type="number" style={{ padding:"10px 12px", fontSize:"var(--text-sm)" }}
                          value={planForm.days} onChange={e => setPlanForm(p => ({...p, days: e.target.value}))} placeholder="e.g. 30" />
                      </div>
                    </div>
                    <div style={{ marginBottom:"var(--space-4)" }}>
                      <div className="form-label" style={{ marginBottom:8 }}>Quick Presets</div>
                      <div className="preset-pills">
                        {[{label:"1M",days:30},{label:"3M",days:90},{label:"6M",days:180},{label:"1Y",days:365}].map(p => (
                          <button key={p.days} className={`preset-pill ${planForm.days === String(p.days) ? "selected" : ""}`}
                            onClick={() => setPlanForm(f => ({...f, days: String(p.days)}))}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setEditingPlan(null)}>Cancel</button>
                      <button className="btn btn-primary" style={{ flex:2 }} onClick={() => savePlan(plan.id)}>✅ Save Plan</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button className="add-plan-btn" onClick={addNewPlan}>+ Add New Plan</button>

            <div className="tip-box">
              💡 <strong>Tip:</strong> Changes to plans apply to new memberships. Existing members keep their current expiry. You cannot delete a plan with active members.
            </div>
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV (Mobile) ── */}
      <nav className="bottom-nav">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`bottom-nav-item ${page === item.id ? "active" : ""}`}
            onClick={() => goTo(item.id)}
          >
            <span className="bnav-icon">{item.icon}</span>
            <span className="bnav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── RENEW MODAL ── */}
      {confirmRenew && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConfirmRenew(null)}>
          <div className="modal-panel">
            <span className="modal-icon">🔄</span>
            <div className="modal-title">Confirm Renewal</div>
            <p className="modal-desc">Renewing membership for <strong style={{ color:"var(--text-primary)" }}>{confirmRenew.name}</strong></p>

            <div className="modal-info-grid">
              <div className="modal-info-row">
                <span className="modal-info-label">Phone</span>
                <span>{confirmRenew.phone}</span>
              </div>
              <div className="modal-info-row">
                <span className="modal-info-label">Current Expiry</span>
                <span style={{ color: daysLeft(confirmRenew, plans) < 0 ? "var(--danger)" : "var(--warning)" }}>
                  {expiryDate(confirmRenew, plans)}
                </span>
              </div>
              <div className="modal-info-row">
                <span className="modal-info-label">New Start Date</span>
                <span style={{ color:"var(--success)" }}>
                  {new Date().toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                </span>
              </div>
            </div>

            <div style={{ marginBottom:"var(--space-5)" }}>
              <div className="form-label" style={{ marginBottom:8 }}>Select Renewal Plan</div>
              <div className="plan-options">
                {plans.map(p => (
                  <button key={p.id} className={`plan-option ${renewPlan === p.id ? "selected" : ""}`}
                    onClick={() => setRenewPlan(p.id)}>
                    <div className="plan-option-name">{p.label}</div>
                    <div className="plan-option-detail">₹{p.price} · {p.days}d</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmRenew(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doRenew}>✅ Confirm Renewal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {confirmDel && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="modal-panel" style={{ maxWidth: 360 }}>
            <span className="modal-icon">🗑️</span>
            <div className="modal-title">Remove Member?</div>
            <p className="modal-desc">
              This will permanently remove <strong style={{ color:"var(--text-primary)" }}>{confirmDel.name}</strong> from the system.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex:2, background:"var(--danger)", color:"white", border:"none" }}
                onClick={() => deleteMember(confirmDel.id)}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}