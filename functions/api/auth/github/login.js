import { getBaseUrl, isAuthConfigured, json, randomToken } from "../../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!isAuthConfigured(env)) {
    return json({
      error: "GitHub 登录尚未配置",
      code: "AUTH_NOT_CONFIGURED",
      needs: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "AUTH_SESSIONS", "USER_DB"],
    }, { status: 501 });
  }

  const state = randomToken();
  await env.AUTH_SESSIONS.put(`oauth_state:${state}`, "1", { expirationTtl: 600 });

  const callback = `${getBaseUrl(request, env)}/api/auth/github/callback`;
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", "public_repo read:user");
  url.searchParams.set("state", state);

  return Response.redirect(url.toString(), 302);
}

