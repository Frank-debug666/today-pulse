import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve("public/daily.json");
const previous = JSON.parse(await readFile(outputPath, "utf8"));
const now = new Date();
const chinaDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(now);
const previousChinaDateKey = previous.generatedAt
  ? new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(previous.generatedAt))
  : "";

if (process.env.GITHUB_EVENT_NAME === "schedule" && previousChinaDateKey === chinaDateKey) {
  console.log(`Daily briefing already updated for ${chinaDateKey}; skipping backup run.`);
  process.exit(0);
}

const chinaDate = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(now);

const languageColors = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  Java: "#b07219",
};

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchGithub() {
  const since = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const query = encodeURIComponent(`created:>${since} stars:>20`);
  const data = await fetchJson(`https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=5`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "today-pulse-daily-job" },
  });

  return data.items.map((repo, index) => ({
    rank: String(index + 1).padStart(2, "0"),
    name: repo.full_name.replace("/", " / "),
    summary: repo.description || "本周快速增长的开源项目。",
    language: repo.language || "Other",
    color: languageColors[repo.language] || "#707873",
    stars: Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(repo.stargazers_count),
    growth: `+${repo.stargazers_count}`,
    url: repo.html_url,
  }));
}

async function fetchNews() {
  const apiKey = process.env.GNEWS_API_KEY;
  if (apiKey) {
    try {
      const query = encodeURIComponent("artificial intelligence OR technology OR semiconductor OR open source");
      const data = await fetchJson(`https://gnews.io/api/v4/search?q=${query}&lang=en&max=8&sortby=publishedAt&apikey=${apiKey}`);
      if (data.articles?.length) return formatGnewsArticles(data.articles);
      console.warn("GNews returned no articles; using Hacker News fallback.");
    } catch (error) {
      console.warn(`GNews unavailable; using Hacker News fallback: ${error.message}`);
    }
  }

  return fetchHackerNews();
}

function formatGnewsArticles(articles) {
  const accents = ["lime", "coral", "mint", "ink"];
  const categories = ["人工智能", "全球科技", "算力芯片", "开源生态"];

  return articles.slice(0, 8).map((article, index) => ({
    id: `news-${now.toISOString().slice(0, 10)}-${index}`,
    category: categories[index % categories.length],
    time: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(article.publishedAt)),
    title: article.title,
    summary: article.description || article.source?.name || "点击阅读原文了解详情。",
    url: article.url,
    accent: accents[index % accents.length],
  }));
}

async function fetchHackerNews() {
  const ids = await fetchJson("https://hacker-news.firebaseio.com/v0/topstories.json");
  const items = await Promise.all(ids.slice(0, 16).map((id) => fetchJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)));
  const accents = ["lime", "coral", "mint", "ink"];

  return items
    .filter((item) => item?.title && item?.url)
    .slice(0, 8)
    .map((item, index) => ({
      id: `hn-${item.id}`,
      category: "全球科技",
      time: new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(item.time * 1000)),
      title: item.title,
      summary: `Hacker News 热门讨论 · ${item.score || 0} points · ${item.descendants || 0} 条评论`,
      url: item.url,
      accent: accents[index % accents.length],
    }));
}

async function generateLearning(news) {
  const apiKey = process.env.ARK_API_KEY || process.env.AI_API_KEY || process.env.VOLCENGINE_API_KEY;
  const model = process.env.ARK_MODEL_ID || process.env.ARK_MODEL;
  if (!apiKey || !model) return { word: previous.word, interview: previous.interview };

  const prompt = `你是中文科技晨报编辑。根据这些今日科技新闻标题，生成每日科技一词和一道 AI 应用工程面试题。
新闻：${news.map((item) => item.title).join("；")}
只返回严格 JSON，不要 Markdown：
{"word":{"term":"英文术语","phonetic":"音标或英文读音提示","definition":"中文定义，不超过50字","example":"一句话理解，不超过50字"},"interview":{"question":"问题","points":["考察点1","考察点2","考察点3"],"answer":["答案步骤1","答案步骤2","答案步骤3","答案步骤4"]}}`;

  const data = await fetchJson("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      response_format: { type: "json_object" },
    }),
  });
  return JSON.parse(data.choices[0].message.content);
}

const settled = await Promise.allSettled([fetchGithub(), fetchNews()]);
const githubRepos = settled[0].status === "fulfilled" ? settled[0].value : previous.githubRepos || [];
const globalNews = settled[1].status === "fulfilled" ? settled[1].value : previous.globalNews || [];

let learning = { word: previous.word, interview: previous.interview };
try {
  learning = await generateLearning(globalNews);
} catch (error) {
  console.warn(`AI generation skipped: ${error.message}`);
}

const daily = {
  generatedAt: now.toISOString(),
  dateLabel: chinaDate.replace("星期", " · 星期"),
  issue: Number(previous.issue || 164) + 1,
  githubRepos,
  globalNews,
  word: learning.word,
  interview: learning.interview,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(daily, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}: ${githubRepos.length} repos, ${globalNews.length} news items`);
