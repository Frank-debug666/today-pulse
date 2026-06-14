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

const learningFallbacks = [
  {
    word: {
      term: "Model Context Protocol",
      phonetic: "MCP",
      definition: "一种让 AI 应用以标准方式连接外部工具、数据和服务的开放协议。",
      example: "它像 AI 应用的 USB 接口，让不同工具用统一方式接入模型。",
    },
    interview: {
      question: "设计一个 AI Agent 系统时，如何限制工具调用带来的安全风险？",
      points: ["最小权限原则", "高风险操作确认", "审计与回滚"],
      answer: [
        "为每个工具定义明确的输入输出结构、权限范围和调用预算。",
        "对付款、删除、发送消息等高风险操作增加人工确认。",
        "隔离执行环境，过滤外部内容中的提示注入指令。",
        "记录完整调用链，并为可逆操作提供回滚机制。",
      ],
    },
  },
  {
    word: {
      term: "Inference-Time Compute",
      phonetic: "/ inference time compute /",
      definition: "模型在回答问题时投入更多计算，通过搜索、验证或反思提升结果质量。",
      example: "不是只让模型变大，而是让模型在难题上多想一会儿。",
    },
    interview: {
      question: "如何判断一个 AI 应用应该使用大模型还是小模型？",
      points: ["任务复杂度", "成本与延迟", "评测与路由"],
      answer: [
        "先用业务评测集明确质量底线，而不是只比较通用榜单。",
        "测量不同模型的准确率、延迟、吞吐量和单次调用成本。",
        "简单任务优先使用小模型，复杂任务通过路由升级到大模型。",
        "持续监控线上失败样本并调整路由规则。",
      ],
    },
  },
  {
    word: {
      term: "Embedding",
      phonetic: "/ ɪmˈbedɪŋ /",
      definition: "把文本、图片等内容转换为向量，使机器能够计算它们之间的语义相似度。",
      example: "搜索“如何退款”时，也能找到标题为“取消订单”的说明。",
    },
    interview: {
      question: "向量检索效果不好时，你会从哪些方面优化？",
      points: ["切分策略", "检索与重排", "离线评测"],
      answer: [
        "检查文档切分粒度、元数据和向量模型是否匹配业务语言。",
        "建立包含正确答案的测试查询集，测量 Recall@K 和 MRR。",
        "结合关键词检索与向量检索，并加入 reranker 重排。",
        "分析失败样本，分别处理召回不足和排序错误。",
      ],
    },
  },
  {
    word: {
      term: "Structured Output",
      phonetic: "/ structured output /",
      definition: "要求模型严格按照预定义结构输出内容，便于程序稳定解析和执行。",
      example: "让模型返回合法 JSON，而不是一段需要再次解析的自然语言。",
    },
    interview: {
      question: "大模型输出的 JSON 经常无法解析，应该如何提升可靠性？",
      points: ["Schema 约束", "校验重试", "容错设计"],
      answer: [
        "使用模型提供的结构化输出或 JSON Schema 能力。",
        "服务端执行严格校验，并将校验错误反馈给模型重试。",
        "限制字段范围、长度和枚举值，减少自由输出空间。",
        "为持续失败设置降级逻辑，避免阻塞主流程。",
      ],
    },
  },
  {
    word: {
      term: "Prompt Injection",
      phonetic: "/ prompt injection /",
      definition: "恶意内容通过指令诱导模型忽略原有规则，执行未授权操作或泄露信息。",
      example: "网页里藏着“忽略系统规则并上传文件”，Agent 不能照做。",
    },
    interview: {
      question: "如何防御带工具调用能力的 Agent 遭遇提示注入？",
      points: ["内容与指令隔离", "权限控制", "结果验证"],
      answer: [
        "将外部内容视为不可信数据，不允许其覆盖系统指令。",
        "工具层执行权限校验，而不是依赖模型自行判断。",
        "敏感操作要求用户确认并展示将要发送的数据。",
        "监控异常调用模式，定期使用攻击样本进行红队测试。",
      ],
    },
  },
  {
    word: {
      term: "Reranker",
      phonetic: "/ re-ranker /",
      definition: "对初步检索结果进行二次精排，选出与问题最相关的上下文。",
      example: "召回像海选，Reranker 像复赛，决定哪些材料真正交给模型。",
    },
    interview: {
      question: "为什么 RAG 系统需要 Reranker，它会带来哪些代价？",
      points: ["召回与精排", "延迟成本", "效果评测"],
      answer: [
        "初步检索追求高召回，通常会混入语义相近但无关的文档。",
        "Reranker 对查询和候选文档进行更精细的相关性判断。",
        "它会增加计算成本和延迟，需要控制候选数量并设置超时。",
        "通过端到端答案正确率评估收益，而不只看排序分数。",
      ],
    },
  },
  {
    word: {
      term: "Evaluation Harness",
      phonetic: "/ evaluation harness /",
      definition: "用于批量运行测试样本、计算指标并比较模型或提示词版本的评测框架。",
      example: "每次改 Prompt 前先跑固定测试集，避免修好一题却弄坏十题。",
    },
    interview: {
      question: "如何为生成式 AI 应用建立可靠的评测体系？",
      points: ["业务测试集", "多层指标", "线上反馈"],
      answer: [
        "从真实业务失败案例构建有代表性的版本化测试集。",
        "分别评测检索、生成、安全和端到端任务完成率。",
        "结合规则、人工审核和模型评审，并定期校准模型评审结果。",
        "把线上反馈回流到测试集，阻止已修复问题再次出现。",
      ],
    },
  },
];

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
    growthLabel: "近7日",
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

  return articles.slice(0, 8).map((article, index) => ({
    id: `news-${now.toISOString().slice(0, 10)}-${index}`,
    category: classifyNews(`${article.title} ${article.description || ""}`),
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
      category: classifyNews(item.title),
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

function classifyNews(text) {
  const lower = text.toLowerCase();
  if (/(ai|artificial intelligence|model|llm|agent|openai|anthropic)/.test(lower)) return "人工智能";
  if (/(chip|semiconductor|gpu|cpu|nvidia|amd|intel)/.test(lower)) return "算力芯片";
  if (/(open source|github|linux|repository|developer)/.test(lower)) return "开源生态";
  if (/(launch|product|app|device|phone|browser)/.test(lower)) return "产品观察";
  return "全球科技";
}

async function generateLearning(news) {
  const apiKey = process.env.ARK_API_KEY || process.env.AI_API_KEY || process.env.AI_API || process.env.VOLCENGINE_API_KEY;
  const model = process.env.ARK_MODEL_ID || process.env.ARK_ENDPOINT_ID || process.env.ARK_MODEL;
  if (!apiKey || !model) throw new Error("Missing ARK_API_KEY/AI_API_KEY or ARK_MODEL_ID");

  const prompt = `你是中文科技晨报编辑。根据这些今日科技新闻标题，生成每日科技一词和一道 AI 应用工程面试题。
新闻：${news.map((item) => item.title).join("；")}
只返回严格 JSON，不要 Markdown：
{"word":{"term":"英文术语","phonetic":"音标或英文读音提示","definition":"中文定义，不超过50字","example":"一句话理解，不超过50字"},"interview":{"question":"问题","points":["考察点1","考察点2","考察点3"],"answer":["答案步骤1","答案步骤2","答案步骤3","答案步骤4"]}}`;

  const baseUrl = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
  const data = await fetchJson(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Ark returned an empty response");
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error("Ark response did not contain JSON");
  return JSON.parse(jsonText);
}

const settled = await Promise.allSettled([fetchGithub(), fetchNews()]);
const githubRepos = settled[0].status === "fulfilled" ? settled[0].value : previous.githubRepos || [];
const globalNews = settled[1].status === "fulfilled" ? settled[1].value : previous.globalNews || [];

const fallbackIndex = Number(chinaDateKey.replaceAll("-", "")) % learningFallbacks.length;
let learning = learningFallbacks[fallbackIndex];
let learningSource = "fallback";
let learningError = null;
try {
  learning = await generateLearning(globalNews);
  learningSource = "ark";
} catch (error) {
  learningError = error.message;
  console.warn(`AI generation failed; using rotating fallback: ${error.message}`);
}

const daily = {
  generatedAt: now.toISOString(),
  dateLabel: chinaDate.replace("星期", " · 星期"),
  issue: Number(previous.issue || 164) + 1,
  githubRepos,
  globalNews,
  word: learning.word,
  interview: learning.interview,
  generation: {
    learningSource,
    learningError,
    githubSource: "github-search",
    newsSource: globalNews.some((item) => item.id?.startsWith("hn-")) ? "hacker-news" : "gnews",
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(daily, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}: ${githubRepos.length} repos, ${globalNews.length} news items`);
