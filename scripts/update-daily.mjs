import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve("public/daily.json");
const previous = JSON.parse(await readFile(outputPath, "utf8"));
const now = new Date();
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
  if (!apiKey) return previous.globalNews || [];

  const query = encodeURIComponent("人工智能 OR 科技 OR 芯片 OR 开源");
  const data = await fetchJson(`https://gnews.io/api/v4/search?q=${query}&lang=zh&max=8&sortby=publishedAt&apikey=${apiKey}`);
  const accents = ["lime", "coral", "mint", "ink"];
  const categories = ["人工智能", "全球科技", "算力芯片", "开源生态"];

  return data.articles.slice(0, 8).map((article, index) => ({
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
