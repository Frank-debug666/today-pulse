import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const outputPath = resolve("public/daily.json");
const previous = JSON.parse(await readFile(outputPath, "utf8"));
const now = new Date();
const learningHistoryLimit = 30;
const categoryCooldown = 4;

function normalizeForDedupe(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\-_/·：:，,。.!！?？、"'“”‘’()[\]{}]/g, "");
}

function compactLearningEntry(entry) {
  if (!entry) return null;
  const word = entry.word || {};
  const interview = entry.interview || {};
  if (!word.term && !interview.question) return null;
  return {
    dateLabel: entry.dateLabel || "",
    word: {
      term: word.term || "",
      definition: word.definition || "",
      example: word.example || "",
    },
    interview: {
      category: interview.category || "",
      difficulty: interview.difficulty || "",
      question: interview.question || "",
      points: Array.isArray(interview.points) ? interview.points : [],
      answerLead: interview.answerLead || "",
      answer: Array.isArray(interview.answer) ? interview.answer : [],
    },
  };
}

function getPreviousLearningHistory() {
  const existing = Array.isArray(previous.learningHistory) ? previous.learningHistory.map(compactLearningEntry).filter(Boolean) : [];
  const current = compactLearningEntry(previous);
  const merged = current ? [current, ...existing] : existing;
  const seen = new Set();
  return merged.filter((entry) => {
    const key = [
      normalizeForDedupe(entry.word?.term),
      normalizeForDedupe(entry.interview?.question),
    ].join("|");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, learningHistoryLimit);
}

const previousLearningHistory = getPreviousLearningHistory();
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

function hasChineseText(value) {
  return /[\u4e00-\u9fff]/.test(String(value || ""));
}

function extractLaunchName(title) {
  return String(title || "")
    .replace(/^Launch HN:\s*/i, "")
    .split(/[–—-]/)[0]
    .trim()
    .slice(0, 48);
}

function localizeEnglishTitle(item) {
  const title = String(item.title || "").trim();
  const lower = title.toLowerCase();
  const category = item.category || classifyNews(title);

  if (hasChineseText(title)) return title;
  if (/linux|luks|encryption|disk-encryption|key/.test(lower)) return "Linux 磁盘加密密钥处理变化引发安全讨论";
  if (/launch hn/.test(lower)) return `${extractLaunchName(title) || "新产品"}发布：开发者工具方向出现新项目`;
  if (/android|developer verification|malware/.test(lower)) return "Android 开发者验证机制引发安全与生态争议";
  if (/peertube/.test(lower)) return "去中心化视频平台 PeerTube 获开源社区关注";
  if (/ask for help|don't know you|dont know you/.test(lower)) return "开发者社区热议：如何向陌生专家高效求助";
  if (/ai.*inventor|inventor.*ai|patent/.test(lower)) return "日本法院裁定 AI 不能作为专利发明人";
  if (/palantir/.test(lower)) return "西班牙推动限制 Palantir 在公共与私营部门使用";
  if (/browser|chrome|firefox|safari/.test(lower)) return "浏览器生态出现新的产品与技术讨论";
  if (/gpu|nvidia|amd|intel|chip|semiconductor/.test(lower)) return "算力芯片领域出现新的市场与技术动向";
  if (/open source|github|repository|developer/.test(lower)) return "开源生态热点项目引发开发者关注";
  if (/model|llm|agent|openai|anthropic|ai/.test(lower)) return "人工智能领域出现新的产品与治理议题";
  return `${category}热点：海外技术社区出现新的高热讨论`;
}

function localizeNewsFallback(news) {
  return news.map((item, index) => ({
    index,
    title: localizeEnglishTitle(item),
    summary: hasChineseText(item.summary)
      ? item.summary
      : `${item.category || classifyNews(item.title)}方向的海外技术讨论正在升温，适合关注其产品、工程或安全影响。`,
  }));
}

function localizeReposFallback(repos) {
  return repos.map((repo, index) => ({
    index,
    summary: hasChineseText(repo.summary)
      ? repo.summary
      : `${repo.name} 是近期增长较快的 ${repo.language || "开源"} 项目，值得关注其场景定位和实现方式。`,
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

function isLearningRepeated(learning, history = previousLearningHistory) {
  const interview = enrichInterview(learning?.interview || {});
  const term = normalizeForDedupe(learning?.word?.term);
  const question = normalizeForDedupe(interview.question);
  const category = normalizeForDedupe(interview.category);
  const recentTerms = new Set(history.map((entry) => normalizeForDedupe(entry.word?.term)).filter(Boolean));
  const recentQuestions = new Set(history.map((entry) => normalizeForDedupe(entry.interview?.question)).filter(Boolean));
  const recentCategories = new Set(history.slice(0, categoryCooldown).map((entry) => normalizeForDedupe(entry.interview?.category)).filter(Boolean));

  if (term && recentTerms.has(term)) return `repeated word: ${learning.word.term}`;
  if (question && recentQuestions.has(question)) return "repeated interview question";
  if (category && recentCategories.has(category)) return `recent repeated category: ${interview.category}`;
  return "";
}

function pickFallbackLearning() {
  const start = Number(chinaDateKey.replaceAll("-", "")) % learningFallbacks.length;
  for (let offset = 0; offset < learningFallbacks.length; offset += 1) {
    const candidate = learningFallbacks[(start + offset) % learningFallbacks.length];
    if (!isLearningRepeated(candidate)) return candidate;
  }
  return learningFallbacks[start];
}

function appendLearningHistory(daily) {
  const current = compactLearningEntry(daily);
  if (!current) return previousLearningHistory;
  const seen = new Set();
  return [current, ...previousLearningHistory].filter((entry) => {
    const key = [
      normalizeForDedupe(entry.word?.term),
      normalizeForDedupe(entry.interview?.question),
    ].join("|");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, learningHistoryLimit);
}

async function generateEditorial(news, repos) {
  const apiKey = process.env.ARK_API_KEY || process.env.AI_API_KEY || process.env.AI_API || process.env.VOLCENGINE_API_KEY;
  const model = process.env.ARK_MODEL_ID || process.env.ARK_ENDPOINT_ID || process.env.ARK_MODEL;
  if (!apiKey || !model) throw new Error("Missing ARK_API_KEY/AI_API_KEY or ARK_MODEL_ID");

  const recentTopic = previous.interview?.category || previous.interview?.question || "无";
  const recentLearningBrief = previousLearningHistory.slice(0, 12).map((entry) => ({
    date: entry.dateLabel,
    word: entry.word?.term,
    category: entry.interview?.category,
    question: entry.interview?.question,
  }));
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
- 必须避开最近出现过的术语、题目和相近题型。最近学习内容：${JSON.stringify(recentLearningBrief)}
- 最近 4 期出现过的方向不要再选；术语不要与最近 30 期重复。
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
      temperature: 0.85,
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Ark returned an empty response");
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error("Ark response did not contain JSON");
  const learning = JSON.parse(jsonText);
  const repeatedReason = isLearningRepeated(learning);
  if (repeatedReason) throw new Error(`Ark generated repeated learning content: ${repeatedReason}`);
  return learning;
}

async function generateLocalization(news, repos) {
  const apiKey = process.env.ARK_API_KEY || process.env.AI_API_KEY || process.env.AI_API || process.env.VOLCENGINE_API_KEY;
  const model = process.env.ARK_MODEL_ID || process.env.ARK_ENDPOINT_ID || process.env.ARK_MODEL;
  if (!apiKey || !model) throw new Error("Missing ARK_API_KEY/AI_API_KEY or ARK_MODEL_ID");

  const newsBrief = news.map((item, index) => ({
    index,
    title: item.title,
    category: item.category,
    summary: String(item.summary || "").slice(0, 180),
  }));
  const repoBrief = repos.map((repo, index) => ({
    index,
    name: repo.name,
    language: repo.language,
    summary: String(repo.summary || "").slice(0, 160),
  }));
  const prompt = `你是中文科技资讯编辑。请只完成本地化，不要生成其它内容。
要求：
- 新闻标题必须改写为自然中文，可以保留 Linux、Android、PeerTube、Palantir、AI 等专有名词。
- 新闻摘要必须是自然中文，不要直接保留英文原句。
- GitHub 项目简介用一句中文说明用途，不要翻译仓库名。
- 只返回严格 JSON，不要 Markdown。

新闻：${JSON.stringify(newsBrief)}
GitHub 项目：${JSON.stringify(repoBrief)}

JSON 结构：
{"news":[{"index":0,"title":"中文标题","summary":"中文摘要"}],"repos":[{"index":0,"summary":"中文项目简介"}]}`;

  const baseUrl = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
  const data = await fetchJson(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Ark localization returned an empty response");
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) throw new Error("Ark localization response did not contain JSON");
  return JSON.parse(jsonText);
}

const settled = await Promise.allSettled([fetchGithub(), fetchNews()]);
const githubRepos = settled[0].status === "fulfilled" ? settled[0].value : previous.githubRepos || [];
const globalNews = settled[1].status === "fulfilled" ? settled[1].value : previous.globalNews || [];

let learning = pickFallbackLearning();
let learningSource = "fallback";
let learningError = null;
let localization = null;
let localizationSource = "none";
let localizationError = null;
try {
  learning = await generateEditorial(globalNews, githubRepos);
  learningSource = "ark";
  localization = learning;
  localizationSource = "ark";
} catch (error) {
  learningError = error.message;
  console.warn(`AI generation failed; using rotating fallback: ${error.message}`);
  try {
    localization = await generateLocalization(globalNews, githubRepos);
    localizationSource = "ark-localization";
  } catch (localizeError) {
    localizationError = localizeError.message;
    console.warn(`AI localization failed; using local Chinese fallback: ${localizeError.message}`);
  }
}

const localizedNews = globalNews.map((item, index) => {
  const localized = localization?.news?.find((entry) => Number(entry.index) === index)
    || localizeNewsFallback([item])[0];
  return {
    ...item,
    title: localized.title || localizeEnglishTitle(item),
    summary: localized.summary || item.summary,
  };
});
const localizedRepos = githubRepos.map((repo, index) => {
  const localized = localization?.repos?.find((entry) => Number(entry.index) === index)
    || localizeReposFallback([repo])[0];
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
    localizationSource,
    localizationError,
  },
};
daily.learningHistory = appendLearningHistory(daily);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(daily, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}: ${githubRepos.length} repos, ${globalNews.length} news items`);
