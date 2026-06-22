// ===================================================================
// FIFA World Cup 2026 ウィジェット for Scriptable
// 「次の2試合」を FIFA 公式サイトの試合カードに寄せたデザインで表示
//   日付 ／ 国名フル＋国旗＋キックオフ時刻 ／ ステージ・グループ・会場
// -------------------------------------------------------------------
// 使い方:
//   1. iPhone に「Scriptable」を入れる
//   2. このファイルの中身を新規スクリプトに貼り付ける
//   3. ホーム画面にウィジェット追加 → Scriptable → このスクリプトを指定
//   推奨サイズ: 中
// ===================================================================

// このリポジトリの GitHub Pages の data.json（設定済み）
const DATA_URL = "https://naomori0617-beep.github.io/fifa-wc2026-widget/data.json";

// 表示する試合数
const SHOW = 2;

// ----- 配色（FIFA 公式サイト風：白基調） -----
const C = {
  bg: new Color("#ffffff"),
  text: new Color("#1a1a22"), // 国名
  time: new Color("#1a1a22"), // キックオフ時刻
  sub: new Color("#7a7a86"), // 日付・メタ
  red: new Color("#e4002b"), // LIVE
  divider: new Color("#ececf0"),
  flagBorder: new Color("#000000", 0.12),
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

// ----- 日付・時刻（端末のタイムゾーン = 日本なら JST） -----
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

function metaText(m) {
  const venue = m.city || m.stadium || null; // 会場は都市名のみ（長いので）
  return [m.stage, m.group, venue].filter(Boolean).join(" ・ ");
}

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

  // 日付（上段・中央・控えめ。縮小はしない）
  centerText(block, fmtDate(m.date), Font.systemFont(sz.date), m.status === "live" ? C.red : C.sub, 1);

  // 対戦カード：[国名 旗] (gap) 時刻 (gap) [旗 国名]
  // 左右を同じ固定幅にし、外側の可変スペーサーで全体を中央寄せ → 時刻が常に中央
  const row = block.addStack();
  row.centerAlignContent();
  row.addSpacer();

  const home = row.addStack();
  home.size = new Size(sz.side, 0);
  home.centerAlignContent();
  home.addSpacer(); // 内容を中央側（右端）へ寄せる
  addName(home, m.home.name, sz);
  home.addSpacer(sz.flagGap);
  await addFlag(home, m.home.flag, sz);

  row.addSpacer(sz.koGap);
  const ko = row.addText(m.status === "live" ? "LIVE" : fmtTime(m.date));
  ko.font = Font.mediumSystemFont(sz.time);
  ko.textColor = m.status === "live" ? C.red : C.time;
  ko.lineLimit = 1;
  row.addSpacer(sz.koGap);

  const away = row.addStack();
  away.size = new Size(sz.side, 0);
  away.centerAlignContent();
  await addFlag(away, m.away.flag, sz);
  away.addSpacer(sz.flagGap);
  addName(away, m.away.name, sz);
  away.addSpacer(); // 内容を中央側（左端）へ寄せる

  row.addSpacer();

  // メタ（ステージ・グループ・都市）
  const meta = metaText(m);
  if (meta) centerText(block, meta, Font.systemFont(sz.meta), C.sub, 0.7);
}

function addName(stack, name, sz) {
  const t = stack.addText(name);
  t.font = Font.systemFont(sz.name);
  t.textColor = C.text;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.7; // 長い国名のみ少し縮小
}

async function addFlag(stack, url, sz) {
  const flag = await loadFlag(url);
  if (flag) {
    const img = stack.addImage(flag);
    img.imageSize = new Size(sz.flagW, sz.flagH);
    img.cornerRadius = 0; // 角ばった（シャープな）四角形
    img.borderWidth = 1;
    img.borderColor = C.flagBorder;
  } else {
    const ph = stack.addText("□");
    ph.font = Font.systemFont(sz.name);
    ph.textColor = C.divider;
  }
}

function centerText(container, text, font, color, scale = 1) {
  const r = container.addStack();
  r.addSpacer();
  const t = r.addText(text);
  t.font = font;
  t.textColor = color;
  t.lineLimit = 1;
  t.minimumScaleFactor = scale;
  t.centerAlignText();
  r.addSpacer();
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
    return { date: 9, name: 10, time: 14, meta: 7.5, flagW: 20, flagH: 13, flagGap: 4, side: 60, koGap: 6, gap: 4, blockGap: 7, pad: 10 };
  }
  // medium / large（幅は同じ）
  return { date: 11, name: 14, time: 19, meta: 9.5, flagW: 28, flagH: 19, flagGap: 6, side: 116, koGap: 10, gap: 6, blockGap: 12, pad: 12 };
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
    centerText(w, "予定された試合はありません", Font.systemFont(13), C.sub);
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
