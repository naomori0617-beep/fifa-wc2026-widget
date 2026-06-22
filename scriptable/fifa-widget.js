// ===================================================================
// FIFA World Cup 2026 ウィジェット for Scriptable
// 「次の2試合」だけを FIFA 公式サイト風（白基調）で表示するシンプル版
// -------------------------------------------------------------------
// 使い方:
//   1. iPhone に「Scriptable」アプリを入れる
//   2. このファイルの中身を新規スクリプトに貼り付ける
//   3. ホーム画面にウィジェット追加 → Scriptable → このスクリプトを指定
//   推奨サイズ: 中（小・大にも対応）
// ===================================================================

// このリポジトリの GitHub Pages の data.json（設定済み）
const DATA_URL = "https://naomori0617-beep.github.io/fifa-wc2026-widget/data.json";

// 表示する試合数
const SHOW = 2;

// ----- 配色（FIFA 公式サイト風：白基調・濃紺アクセント） -----
const C = {
  bg: new Color("#ffffff"),
  text: new Color("#15151e"), // チーム名
  time: new Color("#15151e"), // キックオフ時刻
  sub: new Color("#8a8a94"), // 日付など補助
  divider: new Color("#ededf1"),
  flagBorder: new Color("#000000", 0.08),
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

const flagCache = {};
async function loadFlag(url) {
  if (!url) return null;
  if (flagCache[url] !== undefined) return flagCache[url];
  try {
    flagCache[url] = await new Request(url).loadImage();
  } catch (e) {
    flagCache[url] = null;
  }
  return flagCache[url];
}

// ----- 日付・時刻（端末のタイムゾーン = 日本なら JST 表示） -----
function fmtDate(iso) {
  const df = new DateFormatter();
  df.locale = "ja-JP";
  df.dateFormat = "M月d日(EEE)";
  return df.string(new Date(iso));
}
function fmtTime(iso) {
  const df = new DateFormatter();
  df.locale = "ja-JP";
  df.dateFormat = "HH:mm";
  return df.string(new Date(iso));
}

// 次の SHOW 試合（試合中＋未開催を日付順に）
function pickNext(data) {
  return (data.matches || [])
    .filter((m) => m.status === "live" || m.status === "upcoming")
    .slice(0, SHOW);
}

// ----- 1試合分の描画 -----
async function drawMatch(w, m, sz) {
  const block = w.addStack();
  block.layoutVertically();
  block.spacing = sz.gap;

  // 日付・時刻（上段・中央・控えめ）
  const dateRow = block.addStack();
  dateRow.addSpacer();
  const dt = dateRow.addText(fmtDate(m.date));
  dt.font = Font.mediumSystemFont(sz.date);
  dt.textColor = m.status === "live" ? new Color("#e4002b") : C.sub;
  dateRow.addSpacer();

  // 対戦カード： [HOMEコード][旗]  〔kickoff〕  [旗][AWAYコード]
  const row = block.addStack();
  row.centerAlignContent();

  await teamSide(row, m.home, sz, true);

  row.addSpacer();
  const ko = row.addText(m.status === "live" ? "LIVE" : fmtTime(m.date));
  ko.font = Font.boldSystemFont(sz.time);
  ko.textColor = m.status === "live" ? new Color("#e4002b") : C.time;
  row.addSpacer();

  await teamSide(row, m.away, sz, false);
}

async function teamSide(row, t, sz, isHome) {
  const code = (t.code || t.name || "TBD").toString().toUpperCase().slice(0, 3);
  const flag = await loadFlag(t.flag);

  if (isHome) {
    const label = row.addText(code);
    label.font = Font.boldSystemFont(sz.code);
    label.textColor = C.text;
    label.lineLimit = 1;
    row.addSpacer(sz.flagGap);
    addFlag(row, flag, sz);
  } else {
    addFlag(row, flag, sz);
    row.addSpacer(sz.flagGap);
    const label = row.addText(code);
    label.font = Font.boldSystemFont(sz.code);
    label.textColor = C.text;
    label.lineLimit = 1;
  }
}

function addFlag(row, flag, sz) {
  if (flag) {
    const img = row.addImage(flag);
    img.imageSize = new Size(sz.flagW, sz.flagH);
    img.cornerRadius = 3;
    img.borderWidth = 1;
    img.borderColor = C.flagBorder;
  } else {
    const ph = row.addText("■");
    ph.font = Font.systemFont(sz.code);
    ph.textColor = C.divider;
  }
}

function divider(w, sz) {
  w.addSpacer(sz.blockGap);
  const line = w.addStack();
  line.backgroundColor = C.divider;
  line.size = new Size(0, 1);
  line.addSpacer();
  w.addSpacer(sz.blockGap);
}

// ----- サイズ別パラメータ -----
function sizeParams(family) {
  if (family === "small") {
    return { date: 9, time: 16, code: 14, flagW: 24, flagH: 16, flagGap: 5, gap: 4, blockGap: 7, pad: 12 };
  }
  // medium / large
  return { date: 11, time: 20, code: 18, flagW: 30, flagH: 20, flagGap: 7, gap: 6, blockGap: 12, pad: 16 };
}

// ===================================================================
// メイン
// ===================================================================
async function main() {
  const family = config.widgetFamily || "medium";
  const sz = sizeParams(family);

  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(sz.pad, sz.pad, sz.pad, sz.pad);

  let data;
  try {
    data = await loadData();
  } catch (e) {
    const t = w.addText("データを取得できませんでした");
    t.font = Font.systemFont(12);
    t.textColor = C.text;
    return finish(w);
  }

  const matches = pickNext(data);
  if (matches.length === 0) {
    w.addSpacer();
    const r = w.addStack();
    r.addSpacer();
    const t = r.addText("予定された試合はありません");
    t.font = Font.systemFont(13);
    t.textColor = C.sub;
    r.addSpacer();
    w.addSpacer();
    return finish(w);
  }

  w.addSpacer();
  for (let i = 0; i < matches.length; i++) {
    await drawMatch(w, matches[i], sz);
    if (i < matches.length - 1) divider(w, sz);
  }
  w.addSpacer();

  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  return finish(w);
}

function finish(w) {
  if (config.runsInWidget) Script.setWidget(w);
  else w.presentMedium();
  Script.complete();
}

await main();
