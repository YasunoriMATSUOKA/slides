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

### 初回セットアップ

```bash
npx wrangler login   # ブラウザで Cloudflare アカウントを認証（1 回だけ）
```

### デプロイ

```bash
npm run deploy
```

- 内部で `build:diagrams` → `build-site.mjs`（events を全走査して `dist/<slug>/index.html` と `dist/index.html` を生成）→ `wrangler deploy` を順に走らせる
- 完了するとコンソールに公開 URL（`https://slide.<account-subdomain>.workers.dev`）が表示される
- イベントを増やしたら `events/<YYYYMMDD>_<slug>/<YYYYMMDD>_<slug>.md` を追加して `npm run deploy` するだけ。`build-site.mjs` がディレクトリ走査するので、scripts の追記は不要

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

## トラブルシューティング

- **`mmdc` が失敗 / Chromium not found**: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome npm run build:diagrams` のように env で実行ファイルパスを上書きする
- **Marp の PDF / PPTX が落ちる**: `CHROME_PATH=/usr/bin/google-chrome npm run build:pdf` で同様に明示
- **図が古いまま更新されない**: Mermaid フェンスのハッシュは内容の SHA1 なので、文字 1 つでも変わると別ハッシュになる。古い SVG は次の `build:diagrams` で `prune` される。それでもおかしいときは `rm -rf events/<event>/assets/diagrams` で全削除して再生成
- **ロゴが 404**: md 内の `<img src="assets/logos/<name>.svg">` は **md 自身からの相対パス**。md と同じ階層に `assets/logos/` がある状態を保つ（移動する場合はロゴごと持っていく）
