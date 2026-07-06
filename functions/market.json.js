const githubMarketUrl = "https://raw.githubusercontent.com/Frank-debug666/today-pulse/main/public/market.json";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=60",
};

async function fetchGithubMarket() {
  const response = await fetch(`${githubMarketUrl}?ts=${Date.now()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "today-pulse-cloudflare-pages",
    },
    cf: { cacheTtl: 60, cacheEverything: false },
  });
  if (!response.ok) throw new Error(`GitHub market.json returned ${response.status}`);
  return response.text();
}

async function fetchStaticMarket({ request, env }) {
  if (!env?.ASSETS) throw new Error("Cloudflare ASSETS binding is unavailable");
  const assetUrl = new URL(request.url);
  assetUrl.pathname = "/market.json";
  assetUrl.search = "";
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  if (!response.ok) throw new Error(`Static market.json returned ${response.status}`);
  return response.text();
}

export async function onRequestGet(context) {
  try {
    return new Response(await fetchGithubMarket(), { headers: jsonHeaders });
  } catch (githubError) {
    try {
      return new Response(await fetchStaticMarket(context), { headers: jsonHeaders });
    } catch (staticError) {
      return new Response(JSON.stringify({
        error: "市场数据暂时不可用",
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
