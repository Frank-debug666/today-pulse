import { clearSessionCookie, json, readCookie, SESSION_COOKIE } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const sessionId = readCookie(request, SESSION_COOKIE);
  if (sessionId && env.AUTH_SESSIONS) {
    await env.AUTH_SESSIONS.delete(`session:${sessionId}`);
  }

  return json({ ok: true }, {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

