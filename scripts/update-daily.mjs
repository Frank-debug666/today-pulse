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

let newsSource = "hacker-news";
let newsError = null;

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
      const query = encodeURIComponent("人工智能 OR 科技 OR 半导体 OR 开源");
      const data = await fetchJson(`https://gnews.io/api/v4/search?q=${query}&lang=zh&max=8&sortby=publishedAt&apikey=${apiKey}`);
      if (data.articles?.length) {
        newsSource = "gnews";
        return formatGnewsArticles(data.articles);
      }
      newsError = "GNews returned no articles";
      console.warn(`${newsError}; using Hacker News fallback.`);
    } catch (error) {
      newsError = error.message;
      console.warn(`GNews unavailable; using Hacker News fallback: ${newsError}`);
    }
  } else {
    newsError = "Missing GNEWS_API_KEY";
    console.warn(`${newsError}; using Hacker News fallback.`);
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
      summary: `${classifyNews(item.title)}领域热门讨论，当前热度 ${item.score || 0}，共有 ${item.descendants || 0} 条评论。`,
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

function enrichInterview(interview) {
  const question = interview.question || "";
  let category = interview.category;
  if (!category) {
    if (/RAG|向量|检索|Reranker/i.test(question)) category = "RAG 与搜索";
    else if (/Agent|工具调用/i.test(question)) category = "Agent 系统";
    else if (/安全|注入|风险/i.test(question)) category = "安全治理";
    else if (/评测|测试集/i.test(question)) category = "模型评测";
    else if (/性能|延迟|成本|模型选择/i.test(question)) category = "推理性能";
    else if (/JSON|结构化|Schema/i.test(question)) category = "AI 产品架构";
    else category = "AI 应用工程";
  }
  return {
    ...interview,
    category,
    difficulty: interview.difficulty || "中等",
    answerLead: interview.answerLead || "参考答题思路：",
  };
}

async function generateEditorial(news, repos) {
  const apiKey = process.env.ARK_API_KEY || process.env.AI_API_KEY || process.env.AI_API || process.env.VOLCENGINE_API_KEY;
  const model = process.env.ARK_MODEL_ID || process.env.ARK_ENDPOINT_ID || process.env.ARK_MODEL;
  if (!apiKey || !model) throw new Error("Missing ARK_API_KEY/AI_API_KEY or ARK_MODEL_ID");

  const recentTopic = previous.interview?.category || previous.interview?.question || "无";
  const newsBrief = news.map((item, index) => ({
    index,
    title: item.title,
    summary: String(item.summary || "").slice(0, 220),
  }));
  const repoBrief = repos.map((repo, index) => ({
    index,
    name: repo.name,
    language: repo.language,
    summary: String(repo.summary || "").slice(0, 180),
  }));
  const prompt = `你是面向中文开发者的科技晨报编辑。完成内容本地化，并生成每日学习内容。
新闻：${JSON.stringify(newsBrief)}
GitHub 项目：${JSON.stringify(repoBrief)}
本地化要求：
- 新闻标题和摘要必须改写成自然、准确、简洁的中文，保留公司名、产品名和专有名词。
- GitHub 项目简介必须用一句自然中文说明项目用途，不要只写“热门项目”。
- 不要虚构原文没有的信息，不要翻译项目名称。
题目要求：
- 从这些方向中选择一个：RAG与搜索、Agent系统、安全治理、模型评测、推理性能、数据工程、多模态、AI产品架构、成本与可观测性。
- 不要选择与上一期相同的方向。上一期方向或题目：${recentTopic}
- 提示词工程类题目最多每周一次，除非当天新闻强相关。
- 必须是需要系统分析或架构权衡的开放题，不要只问概念定义。
只返回严格 JSON，不要 Markdown：
{"news":[{"index":0,"title":"中文标题","summary":"中文摘要"}],"repos":[{"index":0,"summary":"中文项目简介"}],"word":{"term":"英文术语","phonetic":"音标或英文读音提示","definition":"中文定义，不超过50字","example":"一句话理解，不超过50字"},"interview":{"category":"方向","difficulty":"初级/中等/高级","question":"问题","points":["考察点1","考察点2","考察点3"],"answerLead":"与该题匹配的一句答题策略，不要固定提到Prompt","answer":["答案步骤1","答案步骤2","答案步骤3","答案步骤4"]}}`;

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
  learning = await generateEditorial(globalNews, githubRepos);
  learningSource = "ark";
} catch (error) {
  learningError = error.message;
  console.warn(`AI generation failed; using rotating fallback: ${error.message}`);
}

const localizedNews = globalNews.map((item, index) => {
  const localized = learning.news?.find((entry) => Number(entry.index) === index);
  return localized ? { ...item, title: localized.title || item.title, summary: localized.summary || item.summary } : item;
});
const localizedRepos = githubRepos.map((repo, index) => {
  const localized = learning.repos?.find((entry) => Number(entry.index) === index);
  return localized ? { ...repo, summary: localized.summary || repo.summary } : repo;
});

const daily = {
  generatedAt: now.toISOString(),
  dateLabel: chinaDate.replace("星期", " · 星期"),
  issue: Number(previous.issue || 164) + 1,
  githubRepos: localizedRepos,
  globalNews: localizedNews,
  word: learning.word,
  interview: enrichInterview(learning.interview),
  generation: {
    learningSource,
    learningError,
    githubSource: "github-search",
    newsSource,
    newsError,
  },
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(daily, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}: ${githubRepos.length} repos, ${globalNews.length} news items`);
