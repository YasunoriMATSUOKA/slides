# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## このリポジトリについて

各種登壇イベントのスライドを **イベントごとに `events/<event-name>/` 配下に閉じ込めて** 管理する作業リポジトリ。最初のイベントは「Kyoto Hacker Way」(2026-05-21)。

現状の構成：

- `events/<event-name>/<event-name>.md` — そのイベントのメインスライド（Marp）
- `events/<event-name>/assets/logos/` — そのイベントで使う技術スタックのロゴ SVG/PNG（commit する）
- `events/<event-name>/assets/diagrams/` — `build:diagrams` が生成する Mermaid SVG（`.gitignore` 済み、commit しない）
- `marp.config.mjs` / `marp.engine.mjs` — marp-cli が読む設定 + Mermaid フェンス対応のカスタムエンジン（**全イベントで共有**、ルート直下）
- `scripts/build-diagrams.mjs` — `events/**/*.md` を自動走査して Mermaid SVG を出力（**ツールはルートで共有**）
- `scripts/fetch-logos.mjs` — ロゴ取得スクリプト（出力先イベントを引数で指定）
- `scripts/build-site.mjs` — `events/*/` を全走査して `dist/<slug>/index.html` + `dist/index.html`（イベント一覧）を生成（Cloudflare Workers 公開用ビルダ）
- `wrangler.toml` — Cloudflare Workers Static Assets 設定。`dist/` を `slide.<account-subdomain>.workers.dev` に公開する
- `package.json` / `node_modules` — **ルートに 1 つだけ**。イベントごとに切らない

新しいイベントを追加するときは `events/<yyyymmdd>_<event-slug>/` ディレクトリを切り、その中に md と `assets/logos/` を置く。ツール群はそのまま流用される。`build-site.mjs` がディレクトリを自動走査するので scripts の追記も不要。

## デプロイ（Cloudflare Workers）

`npm run deploy` で `build:diagrams` → `build-site.mjs` → `wrangler deploy` が連続実行される。初回のみ `npx wrangler login` で Cloudflare アカウントを認証する必要がある。ローカルでの動作確認は `npm run preview`（`wrangler dev` 経由）で本番と同じ Static Assets ルーティングを再現できる。詳細は README.md 参照。

## スライドの形式（Marp）

メインスライド `events/20260521_kyoto-hacker-way/20260521_kyoto-hacker-way.md` は **Marp** で書かれている：

- `marp: true` / `theme: gaia` / `size: 16:9` / `paginate: true`
- フロントマターの `style:` ブロックに以下のクラス CSS を集約：
  - `.stack` 技術スタック / `.learn` 学び / `.pain` つらみ（既存）
  - `.logos` 横並びロゴ行 / `.note` 図の補足注釈（追加）
  - `section .mermaid` Mermaid 図 / `section pre code` Part 1 用コード縮小
- セクション区切りは `---` を単独行で。前後に空行を入れる
- スライド単位のクラス指定は `<!-- _class: lead -->`、ページ番号非表示は `<!-- _paginate: false -->`
- HTML タグ・`<script>` を md 内に書きたいので `marp.config.mjs` で `html: true` を設定済み

詳細スライドを追加する場合も、原則として **同じ CSS 規約・同じ視覚要素（`.stack` で技術スタック、`.learn` で学び、`.pain` でつらみ）** を踏襲する。テーマやスタイルを変える場合はトーンが揃わなくなるので、必ず作者と意思合わせをしてから変更する。

### プレビュー / 書き出し

`@marp-team/marp-cli` はリポジトリ直下に **devDependency としてローカルインストール済み**（Node v24 / npm 11 系）。最初に `npm install` を一度実行すれば、以下の npm scripts が使える：

```bash
npm install          # 初回または node_modules 削除後のみ
npm run dev          # 開発サーバ（events/ 配下の md を一覧 + ライブリロード）
npm run build:html   # dist/20260521_kyoto-hacker-way/index.html を生成 + assets/ を dist/<event>/ へコピー
npm run build:pdf    # dist/20260521_kyoto-hacker-way.pdf を生成（要 Chromium）
npm run build:pptx   # dist/20260521_kyoto-hacker-way.pptx を生成（要 Chromium）
npm run fetch:logos  # events/20260521_kyoto-hacker-way/assets/logos/*.svg を DevIcon / Simple Icons から再取得
```

- 生成物は `dist/` に出力する（`.gitignore` 済み）。HTML は `dist/<event-name>/index.html` + `dist/<event-name>/assets/` の構造で、`assets/logos/*` の相対参照が `<event-name>/` 配下と同じ位置関係で解決される
- `--allow-local-files` を付けているのは PDF/PPTX 出力時にローカル画像を埋め込めるようにするため
- **PDF / PPTX / 画像書き出しは Chrome / Chromium / Edge を要求**する。WSL2 や Linux 環境で動かない場合は `CHROME_PATH` 環境変数で実行ファイルパスを明示するか、`google-chrome` / `chromium` を別途インストールすること
- 個別ファイルを指定して書き出したい場合は `npx marp events/<event>/<file>.md -o dist/<file>.html` のように直接 `npx marp` を叩く（`node_modules/.bin/marp` を解決する）
- VS Code を使う場合は Marp for VS Code 拡張のプレビューが最も手早い（CLI と同じテーマで描画される）
- 新しいイベントを増やしたときは `package.json` に `build:html` / `build:pdf` / `build:pptx` のイベント別 script を追加する想定（共通化が必要になったらその時点でリファクタ）

### Mermaid 構成図（mmdc プリレンダー方式）

Marp の `bespoke` テンプレートは各スライドを `<svg><foreignObject>` で包む — その内側で Mermaid のランタイム描画は機能しなかったため、**ビルド時に mmdc で SVG をプリレンダーし `<img>` で参照する** 方式を採っている。

- ```` ```mermaid ```` フェンスを書くと、`marp.engine.mjs` がフェンス内容を SHA1 ハッシュ化（先頭 12 文字）し、`<img src="assets/diagrams/<hash>.svg">` に変換する（md からの相対パス）
- 同じハッシュの SVG を `scripts/build-diagrams.mjs` が `@mermaid-js/mermaid-cli` (mmdc) 経由で生成し、`events/<event>/assets/diagrams/<hash>.svg` に保存
- `build:diagrams` は `events/**/*.md` を **自動走査** するので、新しいイベント md を追加してもスクリプトの修正は不要
- `build:diagrams` は `build:html` / `build:pdf` / `build:pptx` / `dev` の事前ステップとして自動実行される
- 既存ハッシュの SVG はキャッシュとしてスキップ。不要になったハッシュは event 単位で prune される
- **mmdc は Chrome/Chromium を要求**。`PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome` を `scripts/build-diagrams.mjs` の `puppeteerConfigFile` に渡している。別環境では同変数で上書き
- 図のスタイル変更は CSS の `.diagram img { max-height: 380px; ... }` で。Mermaid テーマ自体を変えたいときは `scripts/build-diagrams.mjs` の `-t neutral` を `-t default | dark | forest | base` に差し替える
- **commit 戦略**: `events/<event>/assets/diagrams/*.svg` は **commit しない**（`**/assets/diagrams/` で `.gitignore` 済み）。ハッシュ生成は決定的なので、md からいつでも再生成可能

### ロゴ管理

- ロゴはイベント単位で `events/<event>/assets/logos/*.svg|png` に置き、**commit する**（CDN 死活に依存しないため、オフライン PDF 出力にも備えるため）
- 取得元: DevIcon の `original` / `plain` variant を第一候補に、無い物は Simple Icons (`https://cdn.simpleicons.org/<slug>`) からフォールバック
- 追加・差し替えは `scripts/fetch-logos.mjs` の `ICONS` マップを編集 → `npm run fetch:logos`（出力先は `events/20260521_kyoto-hacker-way` 固定で書かれているので、別イベントへ取得したい場合は `node scripts/fetch-logos.mjs events/<event>` のように引数を渡す）
- Simple Icons にも DevIcon にも無い技術名（例: SendGrid、Cosmos SDK、Better Auth）は `<span class="label">…</span>` でテキスト表示にする
- スライド内では `<div class="logos"><img src="assets/logos/<name>.svg" alt="..." /></div>` のパターンで配置（md からの相対パス。CSS が `height: 36px` で揃える）

詳細スライドや追加の Markdown を増やす際は、`scripts` を増殖させずに `npx marp events/<event>/<file>.md` で都度書き出す運用を基本にする。常用ファイルが増えてきたタイミングで scripts を整理する。

## 登壇のトーンと構成（編集時に守ること）

メインスライドは「JavaScript/Vue → SES 経験 → ブロックチェーン SP の自社開発 → Next/Vercel/Supabase → Cloudflare ネイティブ」と続く **キャリア時系列の振り返り** が骨格。新しいスライドを差し込む際の作法：

- **一人称・主観であることを明示**するトーンを維持する（「個人の感想です」「dis ではなく当時の風景として」というスタンスがメインスライド冒頭で宣言されている）
- 技術選定の話は「楽に・安く・ほどほどに」というキーメッセージに収束させる
- 各フェーズで **学び（`.learn`）／つらみ（`.pain`）** を1つは添える構成パターンを踏襲
- 絵文字は控えめに使う（🚀 🙏 ⚡ 🤖 程度。乱用しない）
- 「Angular 推し」「React は文法より気持ち」「Cloudflare のコスパ」「Hono × Inertia の可能性」は登壇者の持論なので、勝手にトーンダウン・反対の立場に書き換えない

## サンプルアプリについて

**本リポジトリではサンプルアプリのソースコードは扱わない**。スライドに紐づくサンプルアプリは別リポジトリで管理する：

- テンプレート: https://github.com/YasunoriMATSUOKA/template-vp-cf-hono-inertia-react

このリポジトリは `events/` 配下にスライド資料のみを置き、コード本体は外部リポジトリへリンクする運用にする。

## 編集時の注意

- メインスライドの `style:` ブロックを編集するときは、既存スライドのレイアウトが崩れないか必ず確認する（特に `section.lead` のリードスライド、`.stack` のテーブル風ボックス、`.logos` の横並び、`.mermaid` の SVG サイズ）
- セクション間の `---` の前後には空行を入れる（Marp のページ分割が確実になる）
- Part 1 の各フェーズは **(1/3) スタック概観 / (2/3) Mermaid 構成図 / (3/3) コードスニペット** の 3 スライド構成で揃っている（⑦ Svelte のみ 2 スライド）。フェーズを追加する場合も同じパターンを踏襲
- 表（`| FW | 印象 |` のような）は1行が長くなるとはみ出すので、追記時はセル幅に注意
- Marp の `style:` フロントマターでは **`@import url(...)` がビルド時に解決されない**（CDN URL でない限り）。新しい CSS ルールは `style:` ブロックに直接書く（外部ファイルに分けない）
