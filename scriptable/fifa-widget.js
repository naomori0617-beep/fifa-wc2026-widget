// ===================================================================
// FIFA World Cup 2026 ウィジェット for Scriptable
// -------------------------------------------------------------------
// 使い方:
//   1. iPhone に「Scriptable」アプリを入れる
//   2. このファイルの中身を Scriptable の新規スクリプトに貼り付ける
//   3. 下の DATA_URL を自分の GitHub Pages の data.json の URL に書き換える
//   4. ホーム画面にウィジェットを追加 → Scriptable を選択 → このスクリプトを指定
// 対応サイズ: 小 / 中 / 大
// ===================================================================

// ▼▼▼ ここだけ自分の URL に書き換える ▼▼▼
const DATA_URL = "https://USERNAME.github.io/REPO/data.json";
// ▲▲▲ 例: https://naomori.github.io/fifa-wc2026-widget/data.json ▲▲▲

// ----- 色・スタイル -----
const COLORS = {
  bg1: new Color("#0b3d2e"),
  bg2: new Color("#072018"),
  text: new Color("#ffffff"),
  sub: new Color("#9fd9bf"),
  live: new Color("#ff4d4d"),
  win: new Color("#ffd54a"),
  line: new Color("#ffffff", 0.15),
};

// ----- データ取得（失敗時は端末キャッシュにフォールバック） -----
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "fifa_wc2026.json");

async function loadData() {
  try {
    const req = new Request(DATA_URL);
    req.timeoutInterval = 10;
    const data = await req.loadJSON();
    fm.writeString(cachePath, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fm.fileExists(cachePath)) return JSON.parse(fm.readString(cachePath));
    throw e;
  }
}

// 国旗画像（取得失敗は無視してテキストにフォールバック）
const flagCache = {};
async function loadFlag(url) {
  if (!url) return null;
  if (flagCache[url] !== undefined) return flagCache[url];
  try {
    const img = await new Request(url).loadImage();
    flagCache[url] = img;
    return img;
  } catch (e) {
    flagCache[url] = null;
    return null;
  }
}

// ----- 日付フォーマット（端末のタイムゾーン = 日本なら JST 表示） -----
function fmtKickoff(iso) {
  const d = new Date(iso);
  const df = new DateFormatter();
  df.locale = "ja-JP";
  df.dateFormat = "M/d(EEE) HH:mm";
  return df.string(d);
}
function fmtDateShort(iso) {
  const d = new Date(iso);
  const df = new DateFormatter();
  df.locale = "ja-JP";
  df.dateFormat = "M/d";
  return df.string(d);
}

// ----- 試合の選別 -----
function pickMatches(data) {
  const matches = data.matches || [];
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "upcoming"); // date 昇順
  const finished = matches.filter((m) => m.status === "finished");
  const recent = finished.slice(-5).reverse(); // 直近の終了試合（新しい順）
  // 「次の試合」= 進行中があればそれ、なければ未開催の先頭
  const next = live[0] || upcoming[0] || null;
  return { live, upcoming, finished, recent, next };
}

// ===================================================================
// レンダリング
// ===================================================================
function gradientBg(w) {
  const g = new LinearGradient();
  g.colors = [COLORS.bg1, COLORS.bg2];
  g.locations = [0, 1];
  w.backgroundGradient = g;
}

function headerRow(w, data) {
  const row = w.addStack();
  row.centerAlignContent();
  const t = row.addText("⚽ WC 2026");
  t.font = Font.boldSystemFont(11);
  t.textColor = COLORS.sub;
  row.addSpacer();
  const u = row.addText(fmtDateShort(data.updated) + " 更新");
  u.font = Font.systemFont(8);
  u.textColor = COLORS.sub;
}

// 1試合分の行（フラグ・名前・スコア）
async function matchRow(container, m, opts = {}) {
  const { compact = false } = opts;
  const row = container.addStack();
  row.centerAlignContent();

  // ステータスバッジ / キックオフ
  const meta = row.addStack();
  meta.layoutVertically();
  meta.size = new Size(compact ? 52 : 64, 0);
  if (m.status === "live") {
    const b = meta.addText("● LIVE");
    b.font = Font.boldSystemFont(9);
    b.textColor = COLORS.live;
  } else if (m.status === "finished") {
    const b = meta.addText("終了");
    b.font = Font.systemFont(9);
    b.textColor = COLORS.sub;
  } else {
    const b = meta.addText(fmtKickoff(m.date));
    b.font = Font.systemFont(9);
    b.textColor = COLORS.sub;
  }
  if (m.group) {
    const g = meta.addText(m.group);
    g.font = Font.systemFont(8);
    g.textColor = COLORS.sub;
    g.lineLimit = 1;
  }

  row.addSpacer(6);

  // 対戦カード（縦に Home / Away）
  const teams = row.addStack();
  teams.layoutVertically();
  teams.spacing = 2;
  await teamLine(teams, m.home, m, true, compact);
  await teamLine(teams, m.away, m, false, compact);

  return row;
}

async function teamLine(container, t, m, isHome, compact) {
  const line = container.addStack();
  line.centerAlignContent();

  const flag = await loadFlag(t.flag);
  if (flag) {
    const img = line.addImage(flag);
    img.imageSize = new Size(16, 11);
    img.cornerRadius = 1;
    line.addSpacer(5);
  }

  const name = line.addText(t.name);
  name.font = Font.mediumSystemFont(compact ? 11 : 12);
  name.textColor = COLORS.text;
  name.lineLimit = 1;

  line.addSpacer();

  const hasScore = t.score != null;
  if (hasScore) {
    const won =
      m.status !== "upcoming" &&
      ((isHome && m.home.score > m.away.score) ||
        (!isHome && m.away.score > m.home.score));
    const s = line.addText(String(t.score));
    s.font = Font.boldSystemFont(compact ? 12 : 14);
    s.textColor = won ? COLORS.win : COLORS.text;
  }
}

// --- 小ウィジェット: 次の試合だけ ---
async function renderSmall(w, data, picked) {
  headerRow(w, data);
  w.addSpacer(6);
  const m = picked.next;
  if (!m) {
    const t = w.addText("予定された試合はありません");
    t.font = Font.systemFont(11);
    t.textColor = COLORS.sub;
    return;
  }
  const label = w.addText(m.status === "live" ? "試合中" : "次の試合");
  label.font = Font.boldSystemFont(10);
  label.textColor = m.status === "live" ? COLORS.live : COLORS.sub;
  w.addSpacer(4);
  await matchRow(w, m, { compact: true });
  w.addSpacer();
  if (m.stadium) {
    const st = w.addText("📍 " + m.stadium);
    st.font = Font.systemFont(8);
    st.textColor = COLORS.sub;
    st.lineLimit = 1;
  }
}

// --- 中ウィジェット: 次の試合 + 直近の結果2件 ---
async function renderMedium(w, data, picked) {
  headerRow(w, data);
  w.addSpacer(4);

  if (picked.next) {
    const label = w.addText(picked.next.status === "live" ? "試合中" : "次の試合");
    label.font = Font.boldSystemFont(10);
    label.textColor = picked.next.status === "live" ? COLORS.live : COLORS.sub;
    w.addSpacer(2);
    await matchRow(w, picked.next);
  }

  if (picked.recent.length) {
    w.addSpacer(6);
    const label = w.addText("直近の結果");
    label.font = Font.boldSystemFont(10);
    label.textColor = COLORS.sub;
    w.addSpacer(2);
    for (const m of picked.recent.slice(0, 2)) {
      await matchRow(w, m, { compact: true });
      w.addSpacer(2);
    }
  }
}

// --- 大ウィジェット: 直近の結果 + これからの試合 ---
async function renderLarge(w, data, picked) {
  headerRow(w, data);
  w.addSpacer(4);

  const label1 = w.addText("直近の結果");
  label1.font = Font.boldSystemFont(11);
  label1.textColor = COLORS.sub;
  w.addSpacer(3);
  for (const m of picked.recent.slice(0, 4)) {
    await matchRow(w, m, { compact: true });
    w.addSpacer(3);
  }

  w.addSpacer(6);
  const label2 = w.addText("これからの試合");
  label2.font = Font.boldSystemFont(11);
  label2.textColor = COLORS.sub;
  w.addSpacer(3);
  const up = [...picked.live, ...picked.upcoming].slice(0, 4);
  for (const m of up) {
    await matchRow(w, m, { compact: true });
    w.addSpacer(3);
  }
}

// ===================================================================
// メイン
// ===================================================================
async function main() {
  const w = new ListWidget();
  w.setPadding(12, 12, 12, 12);
  gradientBg(w);

  let data;
  try {
    data = await loadData();
  } catch (e) {
    const t = w.addText("データを取得できませんでした");
    t.font = Font.systemFont(12);
    t.textColor = COLORS.text;
    const e2 = w.addText(String(e.message || e));
    e2.font = Font.systemFont(9);
    e2.textColor = COLORS.sub;
    return finish(w);
  }

  const picked = pickMatches(data);
  const family = config.widgetFamily || "medium";

  if (family === "small") await renderSmall(w, data, picked);
  else if (family === "large") await renderLarge(w, data, picked);
  else await renderMedium(w, data, picked);

  // 次の更新目安（15分後）
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return finish(w);
}

function finish(w) {
  if (config.runsInWidget) {
    Script.setWidget(w);
  } else {
    // アプリ内で実行したときはプレビュー表示
    w.presentMedium();
  }
  Script.complete();
}

await main();
