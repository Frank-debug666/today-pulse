import { getBaseUrl, json, randomToken, sessionCookie, SESSION_TTL, ensureSchema } from "../../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.AUTH_SESSIONS || !env.USER_DB) {
    return json({ error: "GitHub 登录尚未配置", code: "AUTH_NOT_CONFIGURED" }, { status: 501 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return json({ error: "缺少 GitHub 授权参数" }, { status: 400 });

  const storedState = await env.AUTH_SESSIONS.get(`oauth_state:${state}`);
  if (!storedState) return json({ error: "登录状态已过期，请重新登录" }, { status: 400 });
  await env.AUTH_SESSIONS.delete(`oauth_state:${state}`);

  const callback = `${getBaseUrl(request, env)}/api/auth/github/callback`;
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "today-pulse",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callback,
    }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    return json({ error: tokenData.error_description || "GitHub token 换取失败" }, { status: 502 });
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "today-pulse",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const githubUser = await userResponse.json();
  if (!userResponse.ok || !githubUser.id) {
    return json({ error: "GitHub 用户信息读取失败" }, { status: 502 });
  }

  await ensureSchema(env);
  await env.USER_DB.prepare(`
    INSERT INTO users (github_id, login, avatar_url, name, last_login_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(github_id) DO UPDATE SET
      login = excluded.login,
      avatar_url = excluded.avatar_url,
      name = excluded.name,
      last_login_at = CURRENT_TIMESTAMP
  `).bind(githubUser.id, githubUser.login, githubUser.avatar_url || "", githubUser.name || "").run();

  const user = await env.USER_DB.prepare("SELECT id, github_id, login, avatar_url, name FROM users WHERE github_id = ?")
    .bind(githubUser.id)
    .first();

  const sessionId = randomToken();
  await env.AUTH_SESSIONS.put(`session:${sessionId}`, JSON.stringify({
    accessToken: tokenData.access_token,
    scope: tokenData.scope || "",
    user,
    createdAt: new Date().toISOString(),
  }), { expirationTtl: SESSION_TTL });

  await env.USER_DB.prepare("INSERT INTO events (user_id, type, payload) VALUES (?, ?, ?)")
    .bind(user.id, "login", JSON.stringify({ provider: "github" }))
    .run();

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${getBaseUrl(request, env)}/?login=github`,
      "Set-Cookie": sessionCookie(sessionId),
    },
  });
}
