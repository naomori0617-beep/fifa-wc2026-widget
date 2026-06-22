// scripts/fetch.mjs
// FIFA 公式 API から World Cup 2026 の全試合を取得し、ウィジェット用に整形した
// JSON を docs/data.json へ書き出す。依存ライブラリなし（Node 18+ の標準 fetch を使用）。

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// --- 対象大会の ID（FIFA World Cup 2026™） ---
const ID_COMPETITION = "17";
const ID_SEASON = "285023";
const LANG = "ja";

const API_URL =
  `https://api.fifa.com/api/v3/calendar/matches` +
  `?idCompetition=${ID_COMPETITION}&idSeason=${ID_SEASON}&count=500&language=${LANG}`;

const OUT = "docs/data.json";

// FIFA API のローカライズ配列 [{Locale, Description}] から文字列を取り出す
function loc(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[0].Description ?? null;
}

// MatchStatus を扱いやすい区分へ変換する
//   0 = 終了 / 1 = 未開催 / 3 = 試合中（経験則。スコアの有無でも補正）
function classify(m) {
  const s = m.MatchStatus;
  if (s === 3) return "live";
  if (s === 0) return "finished";
  const hs = m.Home?.Score;
  const as = m.Away?.Score;
  if (hs != null && as != null && s !== 1) return "finished";
  return "upcoming";
}

function team(t) {
  if (!t) return { name: "未定", code: null, score: null, flag: null };
  const code = t.IdCountry || t.Abbreviation || null;
  return {
    name: loc(t.TeamName) || t.Abbreviation || "未定",
    code,
    score: t.Score ?? null,
    // 国旗画像（正方形）。Scriptable 側でそのまま読み込める
    flag: code ? `https://api.fifa.com/api/v3/picture/flags-sq-4/${code}` : null,
  };
}

async function main() {
  const res = await fetch(API_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (FIFA-widget data fetcher)" },
  });
  if (!res.ok) throw new Error(`FIFA API returned HTTP ${res.status}`);

  const json = await res.json();
  const results = Array.isArray(json.Results) ? json.Results : [];
  if (results.length === 0) throw new Error("FIFA API returned no matches");

  const matches = results
    .map((m) => ({
      id: m.IdMatch,
      date: m.Date, // UTC
      localDate: m.LocalDate, // 開催地ローカル
      status: classify(m),
      matchStatusRaw: m.MatchStatus,
      stage: loc(m.StageName),
      group: loc(m.GroupName),
      matchday: m.MatchDay,
      home: team(m.Home),
      away: team(m.Away),
      homePens: m.HomeTeamPenaltyScore ?? null,
      awayPens: m.AwayTeamPenaltyScore ?? null,
      stadium: m.Stadium ? loc(m.Stadium.Name) : null,
      city: m.Stadium ? loc(m.Stadium.CityName) : null,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const out = {
    updated: new Date().toISOString(),
    competition: loc(results[0].CompetitionName) || "FIFA World Cup 2026",
    season: loc(results[0].SeasonName) || null,
    count: matches.length,
    matches,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + "\n", "utf8");

  const finished = matches.filter((x) => x.status === "finished").length;
  const live = matches.filter((x) => x.status === "live").length;
  console.log(`Wrote ${matches.length} matches to ${OUT}`);
  console.log(`  finished=${finished} live=${live} upcoming=${matches.length - finished - live}`);
}

main().catch((e) => {
  console.error("fetch failed:", e.message);
  process.exit(1);
});
