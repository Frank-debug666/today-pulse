const accents = ["lime", "coral", "mint", "ink"];

function classifyNews(text) {
  const lower = text.toLowerCase();
  if (/(ai|artificial intelligence|model|llm|agent|openai|anthropic)/.test(lower)) return "人工智能";
  if (/(chip|semiconductor|gpu|cpu|nvidia|amd|intel)/.test(lower)) return "芯片";
  if (/(open source|github|linux|repository|developer)/.test(lower)) return "开发者";
  if (/(security|cyber|privacy|attack|vulnerability)/.test(lower)) return "安全";
  return "全球科技";
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function fetchJson(url, options) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function fetchGithub() {
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const query = encodeURIComponent(`created:>${since} stars:>20`);
  const data = await fetchJson(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=5`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "today-pulse-live-refresh" },
  });

  return data.items.map((repo, index) => ({
    rank: String(index + 1).padStart(2, "0"),
    name: repo.full_name.replace("/", " / "),
    summary: repo.description || "近期快速增长的开源项目。",
    language: repo.language || "Other",
    stars: Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(repo.stargazers_count),
    growth: `+${repo.stargazers_count}`,
    url: repo.html_url,
  }));
}

async function fetchHackerNews() {
  const ids = await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json");
  const items = await Promise.all(ids.slice(0, 14).map((id) => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));

  return items.filter((item) => item?.title && item?.url).slice(0, 8).map((item, index) => ({
    id: `live-hn-${item.id}`,
    category: classifyNews(item.title),
    time: formatTime(new Date(item.time * 1000)),
    title: item.title,
    summary: `Hacker News 热门讨论 · ${item.score || 0} points · ${item.descendants || 0} 条评论`,
    url: item.url,
    accent: accents[index % accents.length],
  }));
}

export default async function handler(request, response) {
  if (request.method !== "GET") return response.status(405).json({ error: "Method not allowed" });

  try {
    const [githubResult, newsResult] = await Promise.allSettled([fetchGithub(), fetchHackerNews()]);
    const githubRepos = githubResult.status === "fulfilled" ? githubResult.value : [];
    const globalNews = newsResult.status === "fulfilled" ? newsResult.value : [];
    if (!githubRepos.length && !globalNews.length) {
      throw new Error(`GitHub: ${githubResult.reason?.message || "失败"}; News: ${newsResult.reason?.message || "失败"}`);
    }
    response.setHeader("Cache-Control", "no-store, max-age=0");
    return response.status(200).json({
      generatedAt: new Date().toISOString(),
      githubRepos,
      globalNews,
      source: "live-refresh",
      warnings: [
        githubResult.status === "rejected" ? `GitHub 暂时不可用：${githubResult.reason.message}` : null,
        newsResult.status === "rejected" ? `新闻源暂时不可用：${newsResult.reason.message}` : null,
      ].filter(Boolean),
    });
  } catch (error) {
    return response.status(502).json({ error: `实时数据获取失败：${error.message}` });
  }
}
