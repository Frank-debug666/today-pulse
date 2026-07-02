import { ensureSchema, getSession, isAuthConfigured, json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!isAuthConfigured(env)) {
    return json({ authenticated: false, configured: false });
  }

  const session = await getSession(request, env);
  if (!session?.user?.id) return json({ authenticated: false, configured: true });

  await ensureSchema(env);
  const favorites = await env.USER_DB.prepare(`
    SELECT repo_full_name, repo_url, starred, updated_at
    FROM favorites
    WHERE user_id = ? AND starred = 1
    ORDER BY updated_at DESC
  `).bind(session.user.id).all();

  return json({
    authenticated: true,
    configured: true,
    user: session.user,
    favorites: favorites.results || [],
  });
}

