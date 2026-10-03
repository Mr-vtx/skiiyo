"use strict";

const CFG = window.SKIIYO_CONFIG;
const BASE = CFG.API_BASE_URL.replace(/\/$/, "");
const HEALTH_URL = BASE.replace(/\/api\/v1$/, "/health");

document.getElementById("baseUrlLabel").textContent = BASE;

// ---- State ----------------------------------------------------------

const state = {
  accessToken: localStorage.getItem("skiiyo_access") || null,
  refreshToken: localStorage.getItem("skiiyo_refresh") || null,
  user: JSON.parse(localStorage.getItem("skiiyo_user") || "null"),
};

function setSession(data) {
  if (data.accessToken) {
    state.accessToken = data.accessToken;
    localStorage.setItem("skiiyo_access", data.accessToken);
  }
  if (data.refreshToken) {
    state.refreshToken = data.refreshToken;
    localStorage.setItem("skiiyo_refresh", data.refreshToken);
  }
  if (data.user) {
    state.user = data.user;
    localStorage.setItem("skiiyo_user", JSON.stringify(data.user));
  }
}

function clearSession() {
  state.accessToken = null;
  state.refreshToken = null;
  state.user = null;
  localStorage.removeItem("skiiyo_access");
  localStorage.removeItem("skiiyo_refresh");
  localStorage.removeItem("skiiyo_user");
}

// ---- API client + activity log --------------------------------------

const logstream = document.getElementById("logstream");

function logRequest({ method, path, status, ms, body }) {
  const empty = logstream.querySelector(".empty");
  if (empty) empty.remove();

  const el = document.createElement("div");
  el.className = "logentry";
  const ok = status >= 200 && status < 400;
  el.innerHTML = `
    <div class="line1">
      <span><span class="method">${method}</span> ${path}</span>
      <span class="status ${ok ? "ok" : "err"}">${status} · ${ms}ms</span>
    </div>
    <pre></pre>
  `;
  el.querySelector("pre").textContent =
    typeof body === "string" ? body : JSON.stringify(body, null, 2);
  logstream.prepend(el);
}

document.getElementById("clearLog").onclick = () => {
  logstream.innerHTML = '<div class="empty">Log cleared.</div>';
};

// path: e.g. "/auth/login". opts.raw = true to skip JSON body encoding (multipart).
async function api(path, { method = "GET", body, auth = false, raw = false } = {}) {
  const headers = {};
  if (!raw && body !== undefined) headers["Content-Type"] = "application/json";
  if (CFG.API_KEY) headers["X-API-Key"] = CFG.API_KEY;
  if (auth && state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;

  const started = performance.now();
  let res, data;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: raw ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = text;
    }
  } catch (err) {
    logRequest({ method, path, status: 0, ms: Math.round(performance.now() - started), body: String(err) });
    throw err;
  }

  const ms = Math.round(performance.now() - started);
  logRequest({ method, path, status: res.status, ms, body: data });

  if (!res.ok) {
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function checkHealth() {
  const el = document.getElementById("healthStatus");
  const started = performance.now();
  try {
    const res = await fetch(HEALTH_URL);
    const data = await res.json();
    const ms = Math.round(performance.now() - started);
    logRequest({ method: "GET", path: "/health", status: res.status, ms, body: data });
    const ok = data.status === "ok";
    el.innerHTML = `<span class="dot ${ok ? "ok" : "bad"}"></span>${ok ? "connected" : "unhealthy"} · db ${data.services?.db} · redis ${data.services?.redis}`;
  } catch {
    el.innerHTML = `<span class="dot bad"></span>can't reach backend`;
  }
}

// ---- Tabs -------------------------------------------------------------

const TABS = {
  auth: renderAuth,
  profile: renderProfile,
  avatar: renderAvatar,
  settings: renderSettings,
  notifications: renderNotifications,
  admin: renderAdmin,
};

const main = document.getElementById("main");

function setTab(tab) {
  document.querySelectorAll("#nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab),
  );
  main.innerHTML = "";
  TABS[tab]();
}

document.getElementById("nav").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (btn) setTab(btn.dataset.tab);
});

function gateIfLoggedOut() {
  if (state.accessToken) return false;
  main.innerHTML = `
    <p class="panel-title">Log in first</p>
    <p class="gate">This panel needs an authenticated user. Register or log in from the Auth tab, then come back.</p>
  `;
  return true;
}

function toast(el, msg, isError = false) {
  el.textContent = msg;
  el.style.color = isError ? "var(--error)" : "var(--success)";
}

// ---- Auth tab ---------------------------------------------------------

function renderAuth() {
  if (state.accessToken && state.user) {
    main.innerHTML = `
      <p class="panel-title">Signed in</p>
      <p class="panel-sub">Session details, plus token / email-verification tools.</p>

      <div class="card">
        <h3>Current user</h3>
        <p style="margin:0 0 4px">${state.user.username} · ${state.user.email}</p>
        <p class="meta" style="color:var(--text-dim)">role: ${state.user.role} · verified: ${state.user.isEmailVerified}</p>
        <button class="btn secondary" id="btnMe">GET /auth/me</button>
        <button class="btn danger" id="btnLogout">Log out</button>
      </div>

      <div class="card">
        <h3>Refresh access token</h3>
        <button class="btn secondary" id="btnRefresh">POST /auth/refresh</button>
        <p class="hint" id="refreshHint"></p>
      </div>

      <div class="card">
        <h3>Verify email</h3>
        <p class="hint" style="margin-top:0">A verification email was sent on signup (or logged to the server console if email isn't configured). Paste the token here.</p>
        <input type="text" id="verifyToken" placeholder="verification token" />
        <button class="btn secondary" id="btnVerify">POST /auth/verify-email</button>
        <p class="hint" id="verifyHint"></p>
      </div>
    `;
    document.getElementById("btnLogout").onclick = async () => {
      try {
        await api("/auth/logout", { method: "POST", auth: true });
      } catch {}
      clearSession();
      renderAuth();
    };
    document.getElementById("btnMe").onclick = () => api("/auth/me", { auth: true }).catch(() => {});
    document.getElementById("btnRefresh").onclick = async () => {
      const hint = document.getElementById("refreshHint");
      try {
        const data = await api("/auth/refresh", { method: "POST", body: { refreshToken: state.refreshToken } });
        setSession(data.data);
        toast(hint, "Token refreshed.");
      } catch (err) {
        toast(hint, err.message, true);
      }
    };
    document.getElementById("btnVerify").onclick = async () => {
      const hint = document.getElementById("verifyHint");
      const token = document.getElementById("verifyToken").value.trim();
      try {
        await api("/auth/verify-email", { method: "POST", body: { token } });
        toast(hint, "Email verified.");
      } catch (err) {
        toast(hint, err.message, true);
      }
    };
    return;
  }

  main.innerHTML = `
    <p class="panel-title">Auth</p>
    <p class="panel-sub">Register or log in against the default project — no API key needed for self-hosted single-project use.</p>

    <div class="card">
      <h3>Register</h3>
      <label>Username</label>
      <input type="text" id="regUsername" placeholder="at least 4 characters" />
      <label>Email</label>
      <input type="email" id="regEmail" placeholder="you@example.com" />
      <label>Password</label>
      <input type="password" id="regPassword" placeholder="at least 6 characters" />
      <button class="btn" id="btnRegister">POST /auth/register</button>
      <p class="hint" id="regHint"></p>
    </div>

    <div class="card">
      <h3>Log in</h3>
      <label>Email</label>
      <input type="email" id="loginEmail" />
      <label>Password</label>
      <input type="password" id="loginPassword" />
      <button class="btn" id="btnLogin">POST /auth/login</button>
      <p class="hint" id="loginHint"></p>
      <div id="googleSlot"></div>
    </div>

    <div class="card">
      <h3>Forgot / reset password</h3>
      <label>Email</label>
      <input type="email" id="forgotEmail" />
      <button class="btn secondary" id="btnForgot">POST /auth/forgot-password</button>
      <hr class="divider" />
      <label>Reset token</label>
      <input type="text" id="resetToken" />
      <label>New password</label>
      <input type="password" id="resetPassword" />
      <button class="btn secondary" id="btnReset">POST /auth/reset-password</button>
      <p class="hint" id="pwHint"></p>
    </div>
  `;

  document.getElementById("btnRegister").onclick = async () => {
    const hint = document.getElementById("regHint");
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: {
          username: document.getElementById("regUsername").value.trim(),
          email: document.getElementById("regEmail").value.trim(),
          password: document.getElementById("regPassword").value,
        },
      });
      setSession(data.data);
      renderAuth();
    } catch (err) {
      toast(hint, err.message, true);
    }
  };

  document.getElementById("btnLogin").onclick = async () => {
    const hint = document.getElementById("loginHint");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: {
          email: document.getElementById("loginEmail").value.trim(),
          password: document.getElementById("loginPassword").value,
        },
      });
      setSession(data.data);
      renderAuth();
    } catch (err) {
      toast(hint, err.message, true);
    }
  };

  document.getElementById("btnForgot").onclick = async () => {
    const hint = document.getElementById("pwHint");
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email: document.getElementById("forgotEmail").value.trim() } });
      toast(hint, "If that email exists, a reset link was sent (check server logs if email isn't configured).");
    } catch (err) {
      toast(hint, err.message, true);
    }
  };

  document.getElementById("btnReset").onclick = async () => {
    const hint = document.getElementById("pwHint");
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: {
          token: document.getElementById("resetToken").value.trim(),
          newPassword: document.getElementById("resetPassword").value,
        },
      });
      toast(hint, "Password reset — log in again.");
    } catch (err) {
      toast(hint, err.message, true);
    }
  };

  mountGoogleButton();
}

function mountGoogleButton() {
  const slot = document.getElementById("googleSlot");
  if (!slot || !CFG.GOOGLE_CLIENT_ID) return;

  function render() {
    window.google.accounts.id.initialize({
      client_id: CFG.GOOGLE_CLIENT_ID,
      callback: async (resp) => {
        try {
          const data = await api("/auth/google", { method: "POST", body: { idToken: resp.credential } });
          setSession(data.data);
          renderAuth();
        } catch (err) {
          alert(err.message);
        }
      },
    });
    window.google.accounts.id.renderButton(slot, { theme: "outline", size: "medium" });
  }

  if (window.google?.accounts?.id) return render();
  const s = document.createElement("script");
  s.src = "https://accounts.google.com/gsi/client";
  s.onload = render;
  document.head.appendChild(s);
}

// ---- Profile tab --------------------------------------------------------

function renderProfile() {
  if (gateIfLoggedOut()) return;
  main.innerHTML = `
    <p class="panel-title">Profile</p>
    <p class="panel-sub">GET + PATCH /user/profile</p>
    <div class="card" id="profileCard">Loading…</div>
  `;

  api("/user/profile", { auth: true }).then(({ data }) => {
    const u = data.user;
    document.getElementById("profileCard").innerHTML = `
      <h3>Edit profile</h3>
      <label>Username</label>
      <input type="text" id="pUsername" value="${u.username || ""}" />
      <label>Bio</label>
      <textarea id="pBio">${u.bio || ""}</textarea>
      <label>City</label>
      <input type="text" id="pCity" value="${u.city || ""}" />
      <div class="row">
        <div>
          <label>Lat</label>
          <input type="number" id="pLat" value="${u.lat ?? ""}" />
        </div>
        <div>
          <label>Lng</label>
          <input type="number" id="pLng" value="${u.lng ?? ""}" />
        </div>
      </div>
      <button class="btn" id="btnSaveProfile">PATCH /user/profile</button>
      <p class="hint" id="profileHint"></p>
    `;
    document.getElementById("btnSaveProfile").onclick = async () => {
      const hint = document.getElementById("profileHint");
      const body = {
        username: document.getElementById("pUsername").value.trim(),
        bio: document.getElementById("pBio").value,
        city: document.getElementById("pCity").value,
      };
      const lat = document.getElementById("pLat").value;
      const lng = document.getElementById("pLng").value;
      if (lat) body.lat = Number(lat);
      if (lng) body.lng = Number(lng);
      try {
        const res = await api("/user/profile", { method: "PATCH", auth: true, body });
        setSession({ user: res.data.user });
        toast(hint, "Saved.");
      } catch (err) {
        toast(hint, err.message, true);
      }
    };
  }).catch(() => {
    document.getElementById("profileCard").textContent = "Failed to load — see activity log.";
  });
}

// ---- Avatar tab --------------------------------------------------------

function renderAvatar() {
  if (gateIfLoggedOut()) return;
  const current = state.user?.avatar;
  main.innerHTML = `
    <p class="panel-title">Avatar</p>
    <p class="panel-sub">POST /user/avatar (multipart) — requires Cloudinary configured on the backend.</p>
    <div class="card">
      ${current ? `<img class="avatar-preview" src="${current}" />` : ""}
      <input type="file" id="avatarFile" accept="image/jpeg,image/png,image/webp" />
      <button class="btn" id="btnUpload">Upload</button>
      <p class="hint" id="avatarHint"></p>
    </div>
  `;
  document.getElementById("btnUpload").onclick = async () => {
    const hint = document.getElementById("avatarHint");
    const file = document.getElementById("avatarFile").files[0];
    if (!file) return toast(hint, "Choose a file first.", true);
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await api("/user/avatar", { method: "POST", auth: true, raw: true, body: fd });
      setSession({ user: res.data.user });
      toast(hint, "Uploaded.");
      renderAvatar();
    } catch (err) {
      toast(hint, err.message, true);
    }
  };
}

// ---- Settings tab --------------------------------------------------------

function renderSettings() {
  if (gateIfLoggedOut()) return;
  main.innerHTML = `
    <p class="panel-title">Settings</p>
    <p class="panel-sub">PATCH /user/settings — whole-object replace, free-form JSON.</p>
    <div class="card">
      <label>Settings (JSON)</label>
      <textarea id="settingsJson">${JSON.stringify(state.user?.settings || { emailNotifications: true }, null, 2)}</textarea>
      <button class="btn" id="btnSaveSettings">PATCH /user/settings</button>
      <p class="hint" id="settingsHint"></p>
    </div>
  `;
  document.getElementById("btnSaveSettings").onclick = async () => {
    const hint = document.getElementById("settingsHint");
    let parsed;
    try {
      parsed = JSON.parse(document.getElementById("settingsJson").value);
    } catch {
      return toast(hint, "Not valid JSON.", true);
    }
    try {
      const res = await api("/user/settings", { method: "PATCH", auth: true, body: parsed });
      setSession({ user: res.data.user });
      toast(hint, "Saved.");
    } catch (err) {
      toast(hint, err.message, true);
    }
  };
}

// ---- Notifications tab --------------------------------------------------------

function renderNotifications() {
  if (gateIfLoggedOut()) return;
  main.innerHTML = `
    <p class="panel-title">Notifications</p>
    <p class="panel-sub">GET / PATCH(read) / DELETE /user/notifications — a welcome notification is created on signup.</p>
    <div class="card" style="max-width:560px">
      <button class="btn secondary" id="btnMarkAll">Mark all read</button>
      <button class="btn secondary" id="btnRefreshNotifs">Refresh</button>
      <div id="notifList" style="margin-top:14px">Loading…</div>
    </div>
  `;

  async function load() {
    const list = document.getElementById("notifList");
    try {
      const { data, pagination } = await api("/user/notifications?limit=20", { auth: true });
      if (!data.length) {
        list.innerHTML = `<p class="empty">No notifications yet — they're created on signup, or by whatever you wire up next.</p>`;
        return;
      }
      list.innerHTML = data
        .map(
          (n) => `
        <div class="list-item" data-id="${n._id}">
          <div>
            <div>${n.title}</div>
            <div class="meta">${n.body}</div>
          </div>
          <div style="text-align:right">
            <span class="pill ${n.isRead ? "" : "unread"}">${n.isRead ? "read" : "unread"}</span><br/>
            <button class="btn secondary" style="margin-top:6px;padding:4px 10px;font-size:11px" data-del="${n._id}">Delete</button>
          </div>
        </div>`,
        )
        .join("");
      list.querySelectorAll("[data-del]").forEach((btn) => {
        btn.onclick = async () => {
          await api(`/user/notifications/${btn.dataset.del}`, { method: "DELETE", auth: true }).catch(() => {});
          load();
        };
      });
    } catch {
      list.textContent = "Failed to load — see activity log.";
    }
  }

  document.getElementById("btnMarkAll").onclick = async () => {
    await api("/user/notifications/read", { method: "PATCH", auth: true, body: {} }).catch(() => {});
    load();
  };
  document.getElementById("btnRefreshNotifs").onclick = load;
  load();
}

// ---- Admin tab --------------------------------------------------------

function renderAdmin() {
  if (gateIfLoggedOut()) return;
  main.innerHTML = `
    <p class="panel-title">Admin</p>
    <p class="panel-sub">GET /admin/stats — requires role "admin". Promote a user with <code>node scripts/makeAdmin.js you@example.com</code> on the backend, then log in again.</p>
    <button class="btn" id="btnStats">Fetch stats</button>
    <div id="statsOut" style="margin-top:18px"></div>
  `;
  document.getElementById("btnStats").onclick = async () => {
    const out = document.getElementById("statsOut");
    try {
      const { data } = await api("/admin/stats", { auth: true });
      out.innerHTML = `
        <div class="stat-grid">
          <div class="stat"><div class="n">${data.totalUsers}</div><div class="l">total users</div></div>
          <div class="stat"><div class="n">${data.activeUsers}</div><div class="l">active</div></div>
          <div class="stat"><div class="n">${data.newUsersLast7Days}</div><div class="l">new (7d)</div></div>
          <div class="stat"><div class="n">${data.verifiedUsers}</div><div class="l">verified</div></div>
        </div>
      `;
    } catch (err) {
      out.innerHTML = `<p class="hint" style="color:var(--error)">${err.message}${err.status === 403 ? " — this user isn't an admin." : ""}</p>`;
    }
  };
}

// ---- Boot --------------------------------------------------------

checkHealth();
setInterval(checkHealth, 20000);
setTab("auth");
