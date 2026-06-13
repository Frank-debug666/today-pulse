import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Code2,
  Command,
  ExternalLink,
  Flame,
  Globe2,
  Home,
  Lightbulb,
  Menu,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

const githubRepos = [
  {
    rank: "01",
    name: "anthropics / claude-code",
    summary: "终端中的智能编程代理，可理解代码库、执行日常开发任务并解释复杂代码。",
    language: "TypeScript",
    color: "#3178c6",
    stars: "36.8k",
    growth: "+1,982",
    url: "https://github.com/anthropics/claude-code",
  },
  {
    rank: "02",
    name: "microsoft / generative-ai-for-beginners",
    summary: "面向初学者的生成式 AI 系统课程，覆盖模型、RAG、Agent 与负责任 AI。",
    language: "Jupyter",
    color: "#f37626",
    stars: "81.2k",
    growth: "+1,147",
    url: "https://github.com/microsoft/generative-ai-for-beginners",
  },
  {
    rank: "03",
    name: "twentyhq / twenty",
    summary: "面向现代团队的开源 CRM，强调可扩展数据模型和顺滑协作体验。",
    language: "TypeScript",
    color: "#3178c6",
    stars: "31.6k",
    growth: "+862",
    url: "https://github.com/twentyhq/twenty",
  },
  {
    rank: "04",
    name: "langgenius / dify",
    summary: "用于构建、编排和运营生产级生成式 AI 应用的开源平台。",
    language: "TypeScript",
    color: "#3178c6",
    stars: "111k",
    growth: "+735",
    url: "https://github.com/langgenius/dify",
  },
  {
    rank: "05",
    name: "open-webui / open-webui",
    summary: "支持多种模型、本地部署与知识库能力的自托管 AI 用户界面。",
    language: "Svelte",
    color: "#ff3e00",
    stars: "98.4k",
    growth: "+614",
    url: "https://github.com/open-webui/open-webui",
  },
];

const globalNews = [
  {
    id: "n1",
    category: "人工智能",
    time: "08:40",
    title: "AI Agent 从“回答问题”走向“完成工作”，企业开始重写软件入口",
    summary: "新的竞争焦点不再只是模型能力，而是任务拆解、工具调用、权限边界与结果验证。",
    accent: "lime",
  },
  {
    id: "n2",
    category: "算力芯片",
    time: "07:55",
    title: "高带宽内存成为 AI 基础设施的新瓶颈，供应链继续扩容",
    summary: "推理成本优化正在推动芯片、互联与内存系统协同设计，数据中心采购逻辑随之变化。",
    accent: "coral",
  },
  {
    id: "n3",
    category: "开源生态",
    time: "07:20",
    title: "小模型与端侧推理持续升温，开发者更关注可控成本与隐私",
    summary: "在手机、PC 和边缘设备上运行专用模型，正成为消费级 AI 产品的重要路线。",
    accent: "mint",
  },
  {
    id: "n4",
    category: "产品观察",
    time: "06:45",
    title: "从 Copilot 到 Coworker：软件产品开始围绕结果而非功能组织",
    summary: "越来越多产品把复杂流程封装为目标驱动的协作体验，传统菜单结构被重新审视。",
    accent: "ink",
  },
];

const toolBriefs = [
  { name: "Claude Code", text: "让代码代理在终端里完成真实开发任务", tag: "开发" },
  { name: "NotebookLM", text: "从资料源生成可追溯的研究与音频摘要", tag: "研究" },
  { name: "Dify", text: "快速搭建带知识库与工作流的 AI 应用", tag: "构建" },
];

function IconButton({ label, children, onClick, active = false, className = "" }) {
  return (
    <button
      className={`icon-button ${active ? "is-active" : ""} ${className}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SectionHeading({ icon: Icon, title, meta, action, actionLabel }) {
  return (
    <div className="section-heading">
      <div className="section-title">
        <Icon size={17} strokeWidth={2.2} />
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </div>
      {action ? (
        <button className="text-action" type="button" onClick={action}>
          {actionLabel}
          <ArrowRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

function GitHubRow({ repo, saved, onSave }) {
  return (
    <article className="repo-row">
      <span className="rank">{repo.rank}</span>
      <div className="repo-copy">
        <a href={repo.url} target="_blank" rel="noreferrer">
          {repo.name}
          <ExternalLink size={13} />
        </a>
        <p>{repo.summary}</p>
        <div className="repo-meta">
          <span>
            <i style={{ background: repo.color }} />
            {repo.language}
          </span>
          <span>
            <Star size={13} />
            {repo.stars}
          </span>
          <strong>{repo.growth} 今日</strong>
        </div>
      </div>
      <IconButton label={saved ? "取消收藏" : "收藏仓库"} active={saved} onClick={onSave}>
        {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      </IconButton>
    </article>
  );
}

function NewsItem({ item, read, saved, onRead, onSave }) {
  const openNews = () => {
    onRead();
    if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
  };

  return (
    <article className={`news-row ${read ? "is-read" : ""}`}>
      <button className="news-main" type="button" onClick={openNews}>
        <span className={`news-accent ${item.accent}`} />
        <div>
          <div className="news-kicker">
            <span>{item.category}</span>
            <time>{item.time}</time>
            {read ? <em>已读</em> : null}
          </div>
          <h3>{item.title}{item.url ? <ExternalLink size={13} /> : null}</h3>
          <p>{item.summary}</p>
        </div>
      </button>
      <IconButton label={saved ? "取消收藏" : "收藏资讯"} active={saved} onClick={onSave}>
        {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      </IconButton>
    </article>
  );
}

function TrendRadar() {
  return (
    <div className="trend-chart" aria-label="趋势雷达图">
      <div className="chart-bars">
        {[42, 58, 47, 76, 66, 88, 73].map((height, index) => (
          <span key={`trend-${index}`} style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="trend-list">
        <span><i className="dot lime" />Agentic AI <b>92</b></span>
        <span><i className="dot coral" />端侧模型 <b>78</b></span>
        <span><i className="dot ink" />AI Infra <b>71</b></span>
      </div>
    </div>
  );
}

function App() {
  const [dailyData, setDailyData] = useState(null);
  const [activeNav, setActiveNav] = useState("brief");
  const [activeFilter, setActiveFilter] = useState("全部");
  const [query, setQuery] = useState("");
  const [answerOpen, setAnswerOpen] = useState(false);
  const [saved, setSaved] = useState(() => new Set());
  const [read, setRead] = useState(() => new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentGithubRepos = dailyData?.githubRepos?.length ? dailyData.githubRepos : githubRepos;
  const currentGlobalNews = dailyData?.globalNews?.length ? dailyData.globalNews : globalNews;
  const currentWord = dailyData?.word;
  const currentInterview = dailyData?.interview;

  useEffect(() => {
    fetch(`/daily.json?ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then(setDailyData)
      .catch(() => {});
  }, []);

  const filteredNews = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return currentGlobalNews.filter((item) => {
      const inFilter = activeFilter === "全部" || item.category === activeFilter;
      const inSearch =
        !normalized ||
        `${item.title}${item.summary}${item.category}`.toLowerCase().includes(normalized);
      return inFilter && inSearch;
    });
  }, [activeFilter, currentGlobalNews, query]);

  const toggleSetItem = (setter, id) => {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refresh = () => {
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 850);
  };

  const goTo = (nav, target) => {
    setActiveNav(nav);
    setMobileNavOpen(false);
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <button className="brand-mark" type="button" aria-label="今日脉冲首页" onClick={() => goTo("brief", "today")}>
          <Zap size={19} fill="currentColor" />
        </button>
        <nav aria-label="主要导航">
          {[
            ["brief", Home, "今日简报", "today"],
            ["github", Code2, "GitHub 热点", "github"],
            ["world", Globe2, "全球科技", "world"],
            ["ai", Bot, "AI 学习", "interview"],
          ].map(([id, Icon, label, target]) => (
            <button
              key={id}
              className={activeNav === id ? "is-active" : ""}
              type="button"
              onClick={() => goTo(id, target)}
              aria-label={label}
              title={label}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" aria-label="收藏夹" title="收藏夹" onClick={() => setActiveNav("saved")}>
            <Bookmark size={18} />
            <span>收藏夹</span>
            {saved.size ? <b>{saved.size}</b> : null}
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="brand-title">
            <IconButton label="打开导航" className="mobile-menu" onClick={() => setMobileNavOpen((value) => !value)}>
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </IconButton>
            <div>
              <h1>今日脉冲</h1>
              <p>{dailyData?.dateLabel || "2026年6月13日 · 星期六"}</p>
            </div>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索今日资讯" />
            <kbd>⌘ K</kbd>
          </label>
          <button className={`refresh-button ${refreshing ? "is-refreshing" : ""}`} type="button" onClick={refresh}>
            <RefreshCw size={15} />
            <span>{refreshing ? "同步中" : "刷新"}</span>
          </button>
        </header>

        <section className="daily-intro" id="today">
          <div className="intro-copy">
            <span className="issue-label">DAILY BRIEF · NO.{dailyData?.issue || 164}</span>
            <h2>今天，技术继续从<br /><strong>“能回答”</strong>走向<strong>“能完成”</strong></h2>
            <p>大模型的下一阶段不只是更聪明，而是更可靠地进入真实工作流。今天值得关注的信号，都在这里。</p>
            <div className="intro-actions">
              <button type="button" onClick={() => goTo("world", "world")}>
                开始阅读
                <ArrowRight size={16} />
              </button>
              <span><CircleDot size={14} />预计阅读 8 分钟</span>
            </div>
          </div>
          <div className="signal-panel">
            <div className="signal-top">
              <span>今日信号</span>
              <TrendingUp size={18} />
            </div>
            <strong>AI Agent</strong>
            <p>从模型能力竞赛，进入工作流与交付质量竞赛。</p>
            <div className="signal-meter"><span /></div>
            <small>热度较昨日 +18%</small>
          </div>
        </section>

        <div className="content-grid">
          <div className="feed-column">
            <section className="editorial-section" id="world">
              <SectionHeading icon={Globe2} title="全球科技热点" meta={`${filteredNews.length} 条更新`} action={refresh} actionLabel="重新获取" />
              <div className="filter-row" aria-label="资讯筛选">
                {["全部", "人工智能", "算力芯片", "开源生态", "产品观察"].map((filter) => (
                  <button
                    key={filter}
                    className={activeFilter === filter ? "is-active" : ""}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="news-list">
                {filteredNews.length ? filteredNews.map((item) => (
                  <NewsItem
                    key={item.id}
                    item={item}
                    read={read.has(item.id)}
                    saved={saved.has(item.id)}
                    onRead={() => toggleSetItem(setRead, item.id)}
                    onSave={() => toggleSetItem(setSaved, item.id)}
                  />
                )) : (
                  <div className="empty-state">
                    <Search size={22} />
                    <p>今天的简报里暂时没有匹配内容</p>
                  </div>
                )}
              </div>
            </section>

            <section className="editorial-section github-section" id="github">
              <SectionHeading icon={Flame} title="GitHub 每日热点" meta="Trending today" />
              <div className="repo-list">
                {currentGithubRepos.map((repo) => (
                  <GitHubRow
                    key={repo.name}
                    repo={repo}
                    saved={saved.has(repo.name)}
                    onSave={() => toggleSetItem(setSaved, repo.name)}
                  />
                ))}
              </div>
            </section>

            <section className="tools-section" id="tools">
              <SectionHeading icon={Boxes} title="AI 工具速递" meta="今日值得试试" />
              <div className="tool-strip">
                {toolBriefs.map((tool, index) => (
                  <article key={tool.name}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <div className="tool-title"><h3>{tool.name}</h3><em>{tool.tag}</em></div>
                      <p>{tool.text}</p>
                    </div>
                    <ArrowRight size={16} />
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="utility-column">
            <section className="utility-panel word-panel">
              <SectionHeading icon={Lightbulb} title="每日一词" />
              <span className="word-index">WORD / {dailyData?.issue || 164}</span>
              <h2>{currentWord?.term || "Agentic Workflow"}</h2>
              <p className="phonetic">{currentWord?.phonetic || "/ eɪˈdʒentɪk ˈwɜːrkfloʊ /"}</p>
              <p>{currentWord?.definition || "由 AI Agent 自主规划、调用工具、检查结果并持续推进目标的工作流程。"}</p>
              <div className="word-example">
                <span>一句话理解</span>
                <p>{currentWord?.example || "不是“帮我写一封邮件”，而是“跟进客户，直到确认会议时间”。"}</p>
              </div>
            </section>

            <section className="utility-panel interview-panel" id="interview">
              <SectionHeading icon={Bot} title="每日面试一题" />
              <span className="difficulty"><i /> AI 应用工程 · 中等</span>
              <h3>{currentInterview?.question || "RAG 系统召回率很高，但最终回答仍不准确，你会如何定位问题？"}</h3>
              <ul>
                {(currentInterview?.points || ["检索结果质量与排序", "上下文组织与长度", "模型指令与答案评估"]).map((point) => <li key={point}>{point}</li>)}
              </ul>
              <button className="answer-toggle" type="button" onClick={() => setAnswerOpen((value) => !value)}>
                {answerOpen ? "收起参考答案" : "查看参考答案"}
                {answerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {answerOpen ? (
                <div className="answer-box">
                  <p>先分层评估，而不是直接改 Prompt：</p>
                  <ol>{(currentInterview?.answer || [
                    "建立可复现测试集，拆分检索命中率、重排质量和生成正确率。",
                    "检查召回文档是否真正包含答案，以及关键信息是否被截断或稀释。",
                    "对比无上下文、理想上下文和真实上下文三组生成结果，定位瓶颈。",
                    "再针对瓶颈调整 chunk、reranker、上下文结构或模型指令。",
                  ]).map((step) => <li key={step}>{step}</li>)}</ol>
                </div>
              ) : null}
            </section>

            <section className="utility-panel radar-panel">
              <SectionHeading icon={TrendingUp} title="趋势雷达" meta="7 日热度" />
              <TrendRadar />
            </section>

            <section className="utility-panel prompt-panel">
              <div className="prompt-icon"><Sparkles size={18} /></div>
              <div>
                <span>今日提示词</span>
                <p>“请先列出判断标准，再给出结论和不确定性。”</p>
              </div>
              <IconButton label="已掌握" onClick={() => toggleSetItem(setRead, "prompt")} active={read.has("prompt")}>
                {read.has("prompt") ? <Check size={16} /> : <Command size={16} />}
              </IconButton>
            </section>
          </aside>
        </div>

        <footer>
          <span><Zap size={14} fill="currentColor" /> 今日脉冲</span>
          <p>保持好奇，保持判断。</p>
          <span>更新于 {dailyData?.generatedAt ? new Date(dailyData.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" }) : "09:00"}</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
