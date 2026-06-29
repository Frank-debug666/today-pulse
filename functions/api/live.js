const accents = ["lime", "coral", "mint", "ink"];

const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      ...(init.headers || {}),
    },
  });

function classifyNews(text) {
  const lower = String(text || "").toLowerCase();
  if (/(ai|人工智能|大模型|artificial intelligence|model|llm|agent|openai|anthropic)/.test(lower)) return "人工智能";
  if (/(芯片|半导体|chip|semiconductor|gpu|cpu|nvidia|amd|intel)/.test(lower)) return "芯片";
  if (/(开源|开发者|open source|github|linux|repository|developer)/.test(lower)) return "开发者";
  if (/(安全|隐私|攻击|security|cyber|privacy|attack|vulnerability)/.test(lower)) return "安全";
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
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(12000),
      });
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
    headers: { Accept: "application/vnd.github+json", "User-Agent": "today-pulse-cloudflare-refresh" },
  });

  return data.items.map((repo, index) => ({
    rank: String(index + 1).padStart(2, "0"),
    name: repo.full_name.replace("/", " / "),
    summary: `近期快速增长的 ${repo.language || "技术"} 开源项目，当前获得 ${repo.stargazers_count} 个关注。`,
    language: repo.language || "Other",
    stars: Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(repo.stargazers_count),
    growth: `+${repo.stargazers_count}`,
    url: repo.html_url,
  }));
}

async function fetchHackerNews() {
  const ids = await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json");
  const items = await Promise.all(ids.slice(0, 14).map((id) => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));

  return items.filter((item) => item?.title && item?.url).slice(0, 8).map((item, index) => {
    const category = classifyNews(item.title);
    return {
      id: `live-hn-${item.id}`,
      category,
      time: formatTime(new Date(item.time * 1000)),
      title: item.title,
      summary: `${category}领域热门讨论，当前热度 ${item.score || 0}，共有 ${item.descendants || 0} 条评论。`,
      url: item.url,
      accent: accents[index % accents.length],
    };
  });
}

export async function onRequestGet() {
  try {
    const [githubResult, newsResult] = await Promise.allSettled([fetchGithub(), fetchHackerNews()]);
    const githubRepos = githubResult.status === "fulfilled" ? githubResult.value : [];
    const globalNews = newsResult.status === "fulfilled" ? newsResult.value : [];

    if (!githubRepos.length && !globalNews.length) {
      throw new Error(`GitHub: ${githubResult.reason?.message || "失败"}; News: ${newsResult.reason?.message || "失败"}`);
    }

    return json({
      generatedAt: new Date().toISOString(),
      githubRepos,
      globalNews,
      source: "cloudflare-live-refresh",
      warnings: [
        githubResult.status === "rejected" ? `GitHub 暂时不可用：${githubResult.reason.message}` : null,
        newsResult.status === "rejected" ? `新闻源暂时不可用：${newsResult.reason.message}` : null,
      ].filter(Boolean),
    });
  } catch (error) {
    return json({ error: `实时数据获取失败：${error.message}` }, { status: 502 });
  }
}

export async function onRequest({ request }) {
  if (request.method === "GET") return onRequestGet();
  return json({ error: "仅支持 GET 请求" }, { status: 405 });
}
