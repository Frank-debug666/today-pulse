import { ensureSchema, githubFetch, json, normalizeRepo, requireSession } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const { session, error } = await requireSession(request, env);
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const repo = normalizeRepo(body.repo || body.repoFullName);
  if (!repo) return json({ error: "仓库名称无效" }, { status: 400 });

  const star = body.star !== false;
  await githubFetch(`/user/starred/${repo}`, session.accessToken, {
    method: star ? "PUT" : "DELETE",
    body: star ? "" : undefined,
  });

  await ensureSchema(env);
  await env.USER_DB.prepare(`
    INSERT INTO favorites (user_id, repo_full_name, repo_url, starred, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, repo_full_name) DO UPDATE SET
      repo_url = excluded.repo_url,
      starred = excluded.starred,
      updated_at = CURRENT_TIMESTAMP
  `).bind(session.user.id, repo, `https://github.com/${repo}`, star ? 1 : 0).run();

  await env.USER_DB.prepare("INSERT INTO events (user_id, type, payload) VALUES (?, ?, ?)")
    .bind(session.user.id, star ? "star" : "unstar", JSON.stringify({ repo }))
    .run();

  return json({ ok: true, repo, starred: star });
}
