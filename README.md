# FIFA World Cup 2026 ウィジェット

FIFA ワールドカップ2026の **試合日程・結果** を iPhone のホーム画面ウィジェットに表示するための一式です。

```
FIFA 公式 API ──(GitHub Actions が10分毎に取得)──▶ docs/data.json ──(GitHub Pages で公開)──▶ Scriptable ウィジェット
```

- **データ源:** FIFA 公式 API（APIキー不要） `https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&language=ja`
- **iOS 側:** [Scriptable](https://scriptable.app/)（無料・Mac/Xcode不要）
- **自動更新:** GitHub Actions の cron。新しい結果が出たときだけ `docs/data.json` をコミット

---

## 構成

| パス | 役割 |
| --- | --- |
| `scripts/fetch.mjs` | FIFA APIを叩いて整形JSON(`docs/data.json`)を生成。依存ライブラリゼロ |
| `.github/workflows/update-data.yml` | 10分毎に上記を実行し、変化があればコミット |
| `docs/data.json` | ウィジェットが読む整形済みデータ（自動生成） |
| `docs/index.html` | ブラウザ確認用のプレビューページ |
| `scriptable/fifa-widget.js` | iPhone の Scriptable に貼るウィジェット本体 |

---

## セットアップ手順

### 1. GitHub リポジトリを作る
1. GitHub で新規リポジトリを作成（例: `fifa-wc2026-widget`、Public 推奨）。
2. このフォルダの中身を push する。

```bash
git init
git add .
git commit -m "init: FIFA WC2026 widget"
git branch -M main
git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
git push -u origin main
```

### 2. GitHub Pages を有効化
1. リポジトリの **Settings → Pages**。
2. **Build and deployment → Source** を「Deploy from a branch」。
3. **Branch** を `main` / フォルダを **`/docs`** にして Save。
4. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` が公開される。
   - データ本体は `https://<ユーザー名>.github.io/<リポジトリ名>/data.json`

### 3. 自動更新を有効化
1. リポジトリの **Settings → Actions → General → Workflow permissions** で
   **「Read and write permissions」** を選んで Save（Actions がコミットできるように）。
2. **Actions** タブ → 「Update FIFA data」→ **Run workflow** で初回を手動実行。
   - 以降は10分毎に自動実行されます（GitHubの都合で多少遅延します）。

### 4. iPhone にウィジェットを入れる
1. App Store から **Scriptable** をインストール。
2. Scriptable で「＋」→ 新規スクリプト。`scriptable/fifa-widget.js` の中身を全部貼り付け。
3. 先頭の `DATA_URL` を **自分の data.json の URL** に書き換える。
   ```js
   const DATA_URL = "https://<ユーザー名>.github.io/<リポジトリ名>/data.json";
   ```
4. スクリプト名を分かりやすく（例: `FIFA WC2026`）。
5. ホーム画面を長押し → 「＋」→ **Scriptable** を追加 → ウィジェットを長押しして
   **Script** に作成したスクリプトを指定。
   - **小** = 次の試合 / **中** = 次の試合＋直近の結果 / **大** = 直近の結果＋これからの試合

---

## ローカルで試す

```bash
npm run fetch        # docs/data.json を生成
# docs/index.html をブラウザで開けば一覧プレビューを確認できる
```

---

## カスタマイズの勘所

- **更新頻度:** `.github/workflows/update-data.yml` の `cron`。試合がない日は `*/30 * * * *` 等に下げてもOK。
- **表示内容:** `scriptable/fifa-widget.js` の `renderSmall / renderMedium / renderLarge`。
- **日本代表だけ出したい:** `pickMatches` で `m.home.code === "JPN" || m.away.code === "JPN"` のフィルタを足す。
- **配色:** `fifa-widget.js` 冒頭の `COLORS`。

## データ仕様（`docs/data.json`）

```jsonc
{
  "updated": "ISO8601",            // 生成時刻(UTC)
  "competition": "FIFA ワールドカップ™",
  "season": "FIFA ワールドカップ 2026™",
  "count": 104,
  "matches": [
    {
      "id": "400021443",
      "date": "2026-06-11T19:00:00Z",   // UTC キックオフ
      "localDate": "2026-06-11T13:00:00Z",
      "status": "finished | live | upcoming",
      "stage": "1st ステージ",
      "group": "グループ A",
      "home": { "name": "メキシコ", "code": "MEX", "score": 2, "flag": "..." },
      "away": { "name": "南アフリカ", "code": "RSA", "score": 0, "flag": "..." },
      "homePens": null, "awayPens": null,
      "stadium": "メキシコシティスタジアム"
    }
  ]
}
```

## 注意・既知のリスク

- FIFA 非公式利用のため、API仕様が変わると `fetch.mjs` の調整が必要になることがあります。
- 保険のデータ源として APIキー不要の [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) もあります（更新はコミュニティ依存でやや遅れる）。
- 時刻はウィジェット側で **端末のタイムゾーン**（日本なら JST）に変換表示します。
