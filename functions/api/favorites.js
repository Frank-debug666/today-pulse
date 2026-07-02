import { ensureSchema, json, requireSession } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;

  await ensureSchema(env);
  const favorites = await env.USER_DB.prepare(`
    SELECT repo_full_name, repo_url, starred, created_at, updated_at
    FROM favorites
    WHERE user_id = ? AND starred = 1
    ORDER BY updated_at DESC
  `).bind(session.user.id).all();

  return json({ favorites: favorites.results || [] });
}
