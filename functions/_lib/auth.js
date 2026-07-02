export const SESSION_COOKIE = "tp_session";
export const SESSION_TTL = 60 * 60 * 24 * 30;

export const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      ...(init.headers || {}),
    },
  });

export function isAuthConfigured(env) {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.AUTH_SESSIONS && env.USER_DB);
}

export function getBaseUrl(request, env) {
  return env.SITE_URL || new URL(request.url).origin;
}

export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function readCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

export function sessionCookie(sessionId) {
  return `${SESSION_COOKIE}=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function getSession(request, env) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (!sessionId || !env.AUTH_SESSIONS) return null;
  const session = await env.AUTH_SESSIONS.get(`session:${sessionId}`, "json");
  return session ? { ...session, id: sessionId } : null;
}

export async function requireSession(request, env) {
  if (!isAuthConfigured(env)) {
    return { error: json({ error: "GitHub 登录尚未配置", code: "AUTH_NOT_CONFIGURED" }, { status: 501 }) };
  }
  const session = await getSession(request, env);
  if (!session?.accessToken || !session?.user?.id) {
    return { error: json({ error: "请先登录 GitHub", code: "UNAUTHENTICATED" }, { status: 401 }) };
  }
  return { session };
}

export async function githubFetch(path, accessToken, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "today-pulse",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function normalizeRepo(value) {
  const repo = String(value || "").trim().replace(/\s+/g, "").replace(/^https:\/\/github\.com\//, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return "";
  return repo;
}

export async function ensureSchema(env) {
  if (!env.USER_DB) return;
  await env.USER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      github_id INTEGER NOT NULL UNIQUE,
      login TEXT NOT NULL,
      avatar_url TEXT,
      name TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.USER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      repo_full_name TEXT NOT NULL,
      repo_url TEXT,
      starred INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, repo_full_name)
    )
  `).run();
  await env.USER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY,
      theme TEXT,
      categories TEXT,
      layout TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await env.USER_DB.prepare(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}
