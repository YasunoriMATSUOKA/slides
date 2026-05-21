# slides

各種登壇イベントのスライドを **イベントごとに `events/<event-name>/` 配下** にまとめて管理するリポジトリ。Marp + Mermaid で書く。

現状のイベント：

- `events/20260521_kyoto-hacker-way/20260521_kyoto-hacker-way.md` — Kyoto Hacker Way 2026-05-21

## 前提

- Node.js v24 系 / npm 11 系
- **Chrome / Chromium / Edge**（Mermaid 図の SVG プリレンダー、PDF / PPTX 書き出しで必須）
  - WSL2 / Linux で見つからない場合は `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome` を env で渡すか、Marp 側は `CHROME_PATH` を設定

## 初回セットアップ

```bash
npm install
```

`@marp-team/marp-cli` と `@mermaid-js/mermaid-cli` がローカルにインストールされる。

## プレビュー（ライブリロード）

```bash
npm run dev
```

- Mermaid 図を必要に応じて事前生成したあと、`marp --server .` が立ち上がる
- ブラウザで表示される一覧から `events/20260521_kyoto-hacker-way/20260521_kyoto-hacker-way.md` を開く
- md を保存するとブラウザが自動リロード（ただし Mermaid フェンスを書き換えた場合は別ターミナルで `npm run build:diagrams` を流し直す必要あり）

VS Code を使うなら **Marp for VS Code** 拡張のプレビューが最も手早い（CLI と同じテーマで描画される）。

## 1 回限りの書き出し

```bash
npm run build:html    # dist/20260521_kyoto-hacker-way/index.html + assets/
npm run build:pdf     # dist/20260521_kyoto-hacker-way.pdf
npm run build:pptx    # dist/20260521_kyoto-hacker-way.pptx
```

- HTML は `dist/<event-name>/index.html` と `dist/<event-name>/assets/{logos,diagrams}/` の構造で出力される（ロゴ・図を相対参照するため）
- PDF / PPTX は単一ファイルに画像を埋め込む（`--allow-local-files` 指定済み）
- いずれも `build:diagrams` を事前ステップとして自動実行する

## ゼロからクリーンにビルドする手順

「キャッシュも一切信用しない、まっさらな状態から組み直す」場合：

```bash
# 1. 生成物・キャッシュをすべて削除
rm -rf dist node_modules events/*/assets/diagrams .wrangler

# 2. 依存を入れ直す
npm install

# 3. ロゴを取り直す（CDN から再取得したいときだけ）
npm run fetch:logos

# 4. Mermaid 図を全生成
npm run build:diagrams

# 5a. 単発で HTML / PDF / PPTX を出すなら
npm run build:html
# npm run build:pdf
# npm run build:pptx

# 5b. デプロイ用に全イベントをまとめてビルドするなら
npm run build:site

# 6. プレビューしたい場合
npm run dev          # marp ライブリロードサーバ
# npm run preview    # 公開時と同じ Static Assets 経由 (wrangler dev)
```

各ステップの意味：

| 手順 | 何を消す / 何が起きる |
|---|---|
| `rm -rf dist` | これまでの書き出し成果物（HTML/PDF/PPTX）を破棄 |
| `rm -rf node_modules` | marp-cli / mmdc / Chromium 連携が壊れているときに有効。普段は省略可 |
| `rm -rf events/*/assets/diagrams` | Mermaid SVG のキャッシュを全消去（`.gitignore` 済みディレクトリ。再生成可） |
| `npm install` | devDependencies を再構築 |
| `npm run fetch:logos` | `events/20260521_kyoto-hacker-way/assets/logos/*` を DevIcon / Simple Icons から **上書き再取得**。ロゴ自体は commit されているので、CDN を疑うときだけでよい |
| `npm run build:diagrams` | `events/**/*.md` を走査し、md 内の ` ```mermaid ``` ` フェンスを SHA1 ハッシュ化して `events/<event>/assets/diagrams/<hash>.svg` を生成（キャッシュがなければ mmdc 経由でレンダー） |
| `npm run build:html` | 上記 build:diagrams を再実行（基本キャッシュヒット）したうえで HTML 化＋ assets コピー（Kyoto Hacker Way 単体） |
| `npm run build:site` | 全イベントを `dist/<slug>/index.html` に書き出し、`dist/index.html`（イベント一覧）も生成 |
| `npm run dev` | Marp のライブリロードサーバ（md 編集 → 即反映） |
| `npm run preview` | Workers Static Assets のローカルシミュレータ（本番と同じ URL ルーティング） |

別イベント（例: `events/20260601_foo/`）を増やしてもステップ 4 のスクリプトは自動で拾うので、追加対応は要らない。

## 別イベント向けに個別書き出し

`package.json` の `build:html` / `build:pdf` / `build:pptx` は今のところ `20260521_kyoto-hacker-way` 専用。他イベント単発で書き出したい場合は直接 `npx marp` を叩く：

```bash
npx marp events/<event-name>/<file>.md -o dist/<event-name>/index.html --allow-local-files
```

（前提として `npm run build:diagrams` 済みであること）

なお **全イベントを一括ビルド** するなら下の `npm run build:site` を使う。

## Cloudflare Workers に公開

このリポジトリは **Cloudflare Workers Static Assets** で `slide.<account-subdomain>.workers.dev` に公開する構成。`dist/` を丸ごと配信し、ルートには `events/*/` から自動生成されたイベント一覧 HTML を置く。Worker コードは書かない（純粋静的）。

公開フローは 2 種類：

- **自動**: `main` push → Cloudflare Workers Builds が GitHub から取得してビルド + デプロイ（普段はこちら）
- **手動**: 手元から `npm run deploy`（緊急時 / dashboard を介さず直接出したいとき）

### 1. 初回: Cloudflare ダッシュボードで GitHub 連携を設定

ブラウザでの作業（コードからはできない、最初の 1 回のみ）：

1. [Cloudflare dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → 既存の `slide` Worker（無ければ最初に手元から `npm run deploy` を 1 回流して作成）を開く
2. **Settings → Builds → Connect**（または "Set up builds"）→ **GitHub** を選択
3. リポジトリ `YasunoriMATSUOKA/slides` と branch `main` を選択
4. **Build settings**:
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy`（デフォルト、空欄で OK）
   - Root directory: `/`（デフォルト）
   - Node version: `.nvmrc` で固定済み（24）。ダッシュボード側で上書きしたい場合は環境変数 `NODE_VERSION=24` を追加
5. **Save** → 以降は `main` push のたびに自動でビルド・デプロイされる

ダッシュボードの **Deployments** タブでビルドログ・履歴を確認できる。失敗時はそこにエラーが出る。

### 2. 手動デプロイ（バックアップ用）

ローカルからアカウント認証して直接 deploy したい場合：

```bash
npx wrangler login   # ブラウザで Cloudflare アカウント認証（1 回だけ）
npm run deploy       # build:site → wrangler deploy
```

完了するとコンソールに公開 URL (`https://slide.<account-subdomain>.workers.dev`) が表示される。

### 公開前にローカルで確認

```bash
npm run preview      # build:site → wrangler dev (localhost:8787)
```

- `localhost:8787/` でイベント一覧ページ
- `localhost:8787/<event-name>/` で各スライド
- 本番と同じ Static Assets の配信ロジックでローカル検証できる

### URL 構造

| URL | 内容 |
|---|---|
| `/` | `dist/index.html`（イベント一覧、日付降順） |
| `/<event-name>/` | `dist/<event-name>/index.html`（marp の HTML） |
| `/<event-name>/assets/logos/<file>` | ロゴ |
| `/<event-name>/assets/diagrams/<hash>.svg` | Mermaid 図 |

### イベントを増やすときの流れ

1. ローカルで `events/<YYYYMMDD>_<slug>/<YYYYMMDD>_<slug>.md` を作成（assets/logos/ も配置）
2. md に Mermaid フェンスを書いたら `npm run build:diagrams` で SVG を生成 → git に commit
3. `npm run preview` で表示確認
4. `git push origin main` → Workers Builds が拾って自動デプロイ

`build-site.mjs` が `events/*/` を自動走査するので、`package.json` や `wrangler.jsonc` の追記は不要。

## トラブルシューティング

- **`mmdc` が失敗 / Chromium not found**: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run build:diagrams` のように env で実行ファイルパスを上書きする
- **Marp の PDF / PPTX が落ちる**: `CHROME_PATH=/usr/bin/google-chrome npm run build:pdf` で同様に明示
- **図が古いまま更新されない**: Mermaid フェンスのハッシュは内容の SHA1 なので、文字 1 つでも変わると別ハッシュになる。古い SVG は次の `build:diagrams` で `prune` される。それでもおかしいときは `rm -rf events/<event>/assets/diagrams` で全削除して再生成
- **ロゴが 404**: md 内の `<img src="assets/logos/<name>.svg">` は **md 自身からの相対パス**。md と同じ階層に `assets/logos/` がある状態を保つ（移動する場合はロゴごと持っていく）
