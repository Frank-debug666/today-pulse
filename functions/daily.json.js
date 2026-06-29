const dailyUrl = "https://raw.githubusercontent.com/Frank-debug666/today-pulse/main/public/daily.json";

export async function onRequestGet() {
  const response = await fetch(`${dailyUrl}?ts=${Date.now()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "today-pulse-cloudflare-pages",
    },
    cf: { cacheTtl: 60, cacheEverything: false },
  });

  if (!response.ok) {
    return new Response(JSON.stringify({ error: "日报数据暂时不可用" }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  return new Response(await response.text(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
