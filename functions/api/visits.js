const json = (body, init = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      ...(init.headers || {}),
    },
  });

const todayKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

async function readStats(kv) {
  const day = todayKey();
  const [total, today] = await Promise.all([
    kv.get("total"),
    kv.get(`day:${day}`),
  ]);

  return {
    total: toNumber(total),
    today: toNumber(today),
    day,
  };
}

export async function onRequestGet({ env }) {
  if (!env.VISIT_COUNTER) {
    return json({ enabled: false, total: 0, today: 0, day: todayKey() });
  }

  return json({ enabled: true, ...(await readStats(env.VISIT_COUNTER)) });
}

export async function onRequestPost({ env }) {
  if (!env.VISIT_COUNTER) {
    return json({ enabled: false, total: 0, today: 0, day: todayKey() });
  }

  const current = await readStats(env.VISIT_COUNTER);
  const next = {
    total: current.total + 1,
    today: current.today + 1,
    day: current.day,
  };

  await Promise.all([
    env.VISIT_COUNTER.put("total", String(next.total)),
    env.VISIT_COUNTER.put(`day:${next.day}`, String(next.today)),
  ]);

  return json({ enabled: true, ...next });
}
