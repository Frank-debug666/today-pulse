const githubDailyUrl = "https://raw.githubusercontent.com/Frank-debug666/today-pulse/main/public/daily.json";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60",
};

function redactSecrets(text) {
  return String(text || "").replace(/([?&]apikey=)[^&\s|"]+/gi, "$1[redacted]");
}

async function fetchGithubDaily() {
  const response = await fetch(`${githubDailyUrl}?ts=${Date.now()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "today-pulse-cloudflare-pages",
    },
    cf: { cacheTtl: 60, cacheEverything: false },
  });
  if (!response.ok) throw new Error(`GitHub daily.json returned ${response.status}`);
  return redactSecrets(await response.text());
}

async function fetchStaticDaily({ request, env }) {
  if (!env?.ASSETS) throw new Error("Cloudflare ASSETS binding is unavailable");
  const assetUrl = new URL(request.url);
  assetUrl.pathname = "/daily.json";
  assetUrl.search = "";
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  if (!response.ok) throw new Error(`Static daily.json returned ${response.status}`);
  return redactSecrets(await response.text());
}

export async function onRequestGet(context) {
  try {
    return new Response(await fetchGithubDaily(), { headers: jsonHeaders });
  } catch (githubError) {
    try {
      return new Response(await fetchStaticDaily(context), { headers: jsonHeaders });
    } catch (staticError) {
      return new Response(JSON.stringify({
        error: "日报数据暂时不可用",
        detail: `${githubError.message}; ${staticError.message}`,
      }), {
        status: 502,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }
  }
}
