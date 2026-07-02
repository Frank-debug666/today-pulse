import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const outputPath = resolve("public/market.json");
const now = new Date();
const eastmoneyBase = "https://push2delay.eastmoney.com/api";
const eastmoneyHistoryBase = "https://push2his.eastmoney.com/api";
const execFileAsync = promisify(execFile);

const indices = [
  { id: "sh", name: "上证指数", secid: "1.000001" },
  { id: "sz", name: "深证成指", secid: "0.399001" },
  { id: "cyb", name: "创业板指", secid: "0.399006" },
  { id: "hsi", name: "恒生指数", secid: "100.HSI" },
];

const fallbackGold = {
  name: "COMEX 黄金期货",
  symbol: "GC=F",
  priceUsdOz: 4079,
  priceCnyGram: 943.5,
  changePct: 0.72,
  trend: [3988, 4012, 3995, 4042, 4079],
  sourceLabel: "备用示例金价",
  note: "免费源不可用时展示",
};

const fallback = {
  generatedAt: now.toISOString(),
  source: "fallback",
  sourceLabel: "备用示例数据",
  marketTemperature: {
    score: 52,
    label: "震荡",
    summary: "免费行情源暂时不可用，先展示备用样例；重新运行脚本后会自动覆盖。",
    drivers: ["指数分化", "板块轮动", "成交情绪中性"],
  },
  indices: [
    { id: "sh", name: "上证指数", price: 3454.79, changePct: -0.1, trend: [3420, 3444, 3457, 3454], note: "备用" },
    { id: "sz", name: "深证成指", price: 10456.12, changePct: 0.24, trend: [10310, 10380, 10420, 10456], note: "备用" },
    { id: "cyb", name: "创业板指", price: 2188.44, changePct: 0.48, trend: [2140, 2160, 2172, 2188], note: "备用" },
    { id: "hsi", name: "恒生指数", price: 23055.03, changePct: 0.76, trend: [22690, 22840, 22910, 23055], note: "备用" },
  ],
  sectors: [
    { rank: 1, name: "半导体", changePct: 2.8, heat: 78, capitalFlow: "活跃" },
    { rank: 2, name: "AI 应用", changePct: 2.1, heat: 72, capitalFlow: "升温" },
    { rank: 3, name: "机器人", changePct: 1.6, heat: 66, capitalFlow: "轮动" },
  ],
  gold: fallbackGold,
  warnings: ["行情接口不可用，已使用备用样例。"],
};

function chinaDate(value = now) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(value).replace("星期", " · 星期");
}

async function fetchJson(url) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json,text/csv,*/*",
        Referer: "https://quote.eastmoney.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    return response.json();
  } catch (error) {
    const command = process.platform === "win32" ? "curl.exe" : "curl";
    let stdout = "";
    try {
      const result = await execFileAsync(command, [
        "-L",
        "--max-time",
        "20",
        "-A",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        "-H",
        "Accept: application/json,text/csv,*/*",
        url,
      ], { maxBuffer: 8 * 1024 * 1024 });
      stdout = result.stdout;
    } catch (curlError) {
      stdout = curlError.stdout || "";
    }
    try {
      return JSON.parse(stdout);
    } catch {
      throw new Error(`${error.message}; curl fallback returned non-JSON`);
    }
  }
}

function formatCapitalFlow(value) {
  if (!Number.isFinite(value)) return "资金观望";
  if (value >= 1_000_000_000) return "主力流入";
  if (value <= -1_000_000_000) return "主力流出";
  return "资金轮动";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tempLabel(score) {
  if (score >= 80) return "过热";
  if (score >= 65) return "偏热";
  if (score >= 45) return "震荡";
  if (score >= 30) return "偏冷";
  return "冰点";
}

async function fetchQuotes() {
  const secids = indices.map((item) => item.secid).join(",");
  const data = await fetchJson(`${eastmoneyBase}/qt/ulist.np/get?fltt=2&fields=f2,f3,f12,f14&secids=${secids}`);
  const rows = data.data?.diff || [];
  return new Map(rows.map((row) => [row.f12, row]));
}

async function fetchTrend(secid) {
  const data = await fetchJson(`${eastmoneyHistoryBase}/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55&klt=101&fqt=1&beg=20250601&end=20500101`);
  return (data.data?.klines || []).slice(-30).map((line) => {
    const [date, open, close, high, low] = line.split(",");
    return { date, open: Number(open), close: Number(close), high: Number(high), low: Number(low) };
  });
}

async function fetchSectors() {
  const data = await fetchJson(`${eastmoneyBase}/qt/clist/get?pn=1&pz=8&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f12,f14,f2,f3,f62`);
  return (data.data?.diff || []).map((row, index) => ({
    rank: index + 1,
    code: row.f12,
    name: row.f14,
    price: Number(row.f2),
    changePct: Number(row.f3),
    heat: clamp(Math.round(55 + Number(row.f3 || 0) * 6 + Math.max(0, Number(row.f62 || 0)) / 400_000_000), 0, 100),
    capitalFlow: formatCapitalFlow(Number(row.f62)),
  }));
}

async function fetchGold() {
  const data = await fetchJson(`${eastmoneyBase}/qt/stock/get?secid=101.GC00Y&fields=f43,f44,f45,f46,f57,f58,f60,f86,f170,f171`);
  const row = data.data;
  if (!row) throw new Error("Eastmoney gold quote returned no data");
  const priceUsdOz = Number(row.f43 || 0) / 10;
  const previousClose = Number(row.f60 || 0) / 10 || priceUsdOz;
  const usdCny = 7.2;
  const changePct = previousClose ? ((priceUsdOz - previousClose) / previousClose) * 100 : 0;
  const low = Number(row.f45 || 0) / 10 || Math.min(previousClose, priceUsdOz);
  const high = Number(row.f44 || 0) / 10 || Math.max(previousClose, priceUsdOz);
  return {
    name: row.f58 || "COMEX 黄金",
    symbol: row.f57 || "GC00Y",
    priceUsdOz,
    priceCnyGram: priceUsdOz * usdCny / 31.1034768,
    changePct,
    trend: [previousClose * 0.997, low, previousClose, (previousClose + priceUsdOz) / 2, high, priceUsdOz],
    sourceLabel: "东方财富免费行情",
    note: "COMEX 黄金，人民币/克按 7.20 汇率估算",
  };
}

function calcTemperature(indexRows, sectors) {
  const avgIndex = indexRows.reduce((sum, item) => sum + Number(item.changePct || 0), 0) / Math.max(1, indexRows.length);
  const avgSector = sectors.slice(0, 5).reduce((sum, item) => sum + Number(item.changePct || 0), 0) / Math.max(1, Math.min(5, sectors.length));
  const strongSectors = sectors.filter((item) => item.changePct >= 3).length;
  const score = clamp(Math.round(50 + avgIndex * 8 + avgSector * 3 + strongSectors * 1.5), 0, 100);
  const label = tempLabel(score);
  return {
    score,
    label,
    summary: `主要指数平均涨跌 ${avgIndex.toFixed(2)}%，强势板块平均涨幅 ${avgSector.toFixed(2)}%，市场温度处于“${label}”。`,
    drivers: [
      `指数均值 ${avgIndex >= 0 ? "+" : ""}${avgIndex.toFixed(2)}%`,
      `热门板块均值 ${avgSector >= 0 ? "+" : ""}${avgSector.toFixed(2)}%`,
      `${strongSectors} 个板块涨幅超过 3%`,
    ],
  };
}

async function buildMarket() {
  const [quotes, sectors, gold] = await Promise.all([
    fetchQuotes(),
    fetchSectors(),
    fetchGold().catch(() => fallbackGold),
  ]);
  const indexRows = await Promise.all(indices.map(async (item) => {
    const quote = quotes.get(item.secid.split(".").at(-1)) || {};
    let trendRows = [];
    try {
      trendRows = await fetchTrend(item.secid);
    } catch {
      const price = Number(quote.f2 || 0);
      const change = Number(quote.f3 || 0) / 100;
      const previous = price / (1 + change || 1);
      trendRows = [
        { date: "", close: previous * 0.995 },
        { date: "", close: previous },
        { date: "", close: (previous + price) / 2 },
        { date: "", close: price },
      ];
    }
    const latest = trendRows.at(-1);
    return {
      id: item.id,
      name: quote.f14 || item.name,
      price: Number(quote.f2 || latest?.close || 0),
      changePct: Number(quote.f3 || 0),
      trend: trendRows.map((row) => row.close),
      latestDate: latest?.date || "",
      note: "东方财富",
    };
  }));

  return {
    generatedAt: now.toISOString(),
    dateLabel: chinaDate(),
    source: "free-market",
    sourceLabel: "东方财富免费行情",
    marketTemperature: calcTemperature(indexRows, sectors),
    indices: indexRows,
    sectors,
    gold,
    warnings: [],
  };
}

let market = fallback;
try {
  market = await buildMarket();
} catch (error) {
  market = { ...fallback, warnings: [`免费行情源读取失败：${error.message}`] };
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(market, null, 2)}\n`, "utf8");
console.log(`Updated ${outputPath}: ${market.indices.length} indices, ${market.sectors.length} sectors, gold=${market.gold?.sourceLabel || "none"}, source=${market.source}`);
