import { readFile, writeFile, mkdir, readdir, rm, cp } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { spawn } from 'node:child_process'

const EVENTS_DIR = 'events'
const DIST_DIR = 'dist'
const MARP_BIN = join('node_modules', '.bin', 'marp')
const MARP_TIMEOUT_MS = 60_000

const DATE_PREFIX = /^(\d{4})(\d{2})(\d{2})_/
const HEADER_FRONTMATTER = /^header:\s*['"]?(.+?)['"]?\s*$/m

function log(msg) {
  const t = new Date().toISOString().slice(11, 19)
  process.stdout.write(`[${t}] ${msg}\n`)
}

function parseEventDir(name) {
  const m = DATE_PREFIX.exec(name)
  if (!m) return null
  const [, y, mo, d] = m
  return {
    slug: name,
    date: `${y}-${mo}-${d}`,
    sortKey: `${y}${mo}${d}`,
  }
}

async function readTitle(mdPath) {
  const src = await readFile(mdPath, 'utf8')
  const fmEnd = src.indexOf('\n---', 3)
  const frontmatter = fmEnd > 0 ? src.slice(0, fmEnd) : src
  const m = HEADER_FRONTMATTER.exec(frontmatter)
  return m ? m[1].trim() : basename(mdPath, '.md')
}

function runMarp(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(MARP_BIN, args, { stdio: 'inherit' })
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`marp timed out after ${MARP_TIMEOUT_MS}ms: ${args.join(' ')}`))
    }, MARP_TIMEOUT_MS)
    child.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.once('exit', (code, signal) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`marp exited with code=${code} signal=${signal}`))
    })
  })
}

async function buildEvent(meta) {
  const mdPath = join(EVENTS_DIR, meta.slug, `${meta.slug}.md`)
  const outDir = join(DIST_DIR, meta.slug)
  const outHtml = join(outDir, 'index.html')

  await mkdir(outDir, { recursive: true })

  log(`marp   ${meta.slug}  →  ${outHtml}`)
  const t0 = Date.now()
  await runMarp([mdPath, '-o', outHtml, '--allow-local-files'])
  log(`marp   ${meta.slug}  done in ${Date.now() - t0}ms`)

  const srcAssets = join(EVENTS_DIR, meta.slug, 'assets')
  const destAssets = join(outDir, 'assets')
  log(`copy   ${srcAssets}/  →  ${destAssets}/`)
  const tCopy = Date.now()
  await cp(srcAssets, destAssets, { recursive: true })
  log(`copy   ${meta.slug}  done in ${Date.now() - tCopy}ms`)
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function renderIndex(events) {
  const items = events
    .map(
      (e) => `
      <li class="event">
        <a href="/${e.slug}/" class="event-link">
          <time datetime="${e.date}" class="event-date">${e.date}</time>
          <span class="event-title">${escapeHtml(e.title)}</span>
          <span class="event-slug">${escapeHtml(e.slug)}</span>
        </a>
      </li>`,
    )
    .join('')

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>登壇スライド一覧 — YasunoriMATSUOKA</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="YasunoriMATSUOKA の登壇スライド集">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
    color: #1a202c;
    background: #f7fafc;
    line-height: 1.6;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e2e8f0; background: #1a202c; }
  }
  main {
    max-width: 760px;
    margin: 0 auto;
    padding: 64px 24px 96px;
  }
  h1 {
    font-size: 28px;
    margin: 0 0 8px;
    letter-spacing: 0.01em;
  }
  .lead {
    color: #718096;
    margin: 0 0 40px;
    font-size: 15px;
  }
  ul.events {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 12px;
  }
  .event-link {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    column-gap: 20px;
    align-items: baseline;
    padding: 18px 22px;
    border-radius: 10px;
    background: white;
    color: inherit;
    text-decoration: none;
    border: 1px solid #e2e8f0;
    transition: border-color 0.15s, transform 0.15s;
  }
  @media (prefers-color-scheme: dark) {
    .event-link { background: #2d3748; border-color: #4a5568; }
  }
  .event-link:hover {
    border-color: #4299e1;
    transform: translateY(-1px);
  }
  .event-date {
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    color: #718096;
    grid-row: 1;
  }
  .event-title {
    grid-row: 1;
    font-size: 16px;
    font-weight: 600;
  }
  .event-slug {
    grid-column: 2;
    grid-row: 2;
    font-size: 12px;
    color: #a0aec0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  footer {
    margin-top: 64px;
    color: #a0aec0;
    font-size: 13px;
    text-align: center;
  }
  footer a { color: inherit; }
</style>
</head>
<body>
<main>
  <h1>登壇スライド</h1>
  <p class="lead">YasunoriMATSUOKA の登壇資料アーカイブ</p>
  <ul class="events">${items}
  </ul>
  <footer>
    Built with <a href="https://marp.app/">Marp</a> · Hosted on <a href="https://workers.cloudflare.com/">Cloudflare Workers</a>
  </footer>
</main>
</body>
</html>
`
}

async function main() {
  const tStart = Date.now()
  log(`clean  ${DIST_DIR}/`)
  await rm(DIST_DIR, { recursive: true, force: true })
  await mkdir(DIST_DIR, { recursive: true })

  log(`scan   ${EVENTS_DIR}/`)
  const entries = await readdir(EVENTS_DIR, { withFileTypes: true })
  const events = []
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    const meta = parseEventDir(ent.name)
    if (!meta) {
      log(`skip   ${ent.name}  (does not match YYYYMMDD_ prefix)`)
      continue
    }
    const mdPath = join(EVENTS_DIR, meta.slug, `${meta.slug}.md`)
    try {
      meta.title = await readTitle(mdPath)
    } catch (err) {
      console.error(`ERROR  ${meta.slug}  cannot read ${mdPath}: ${err.message}`)
      continue
    }
    events.push(meta)
  }
  log(`found  ${events.length} event(s): ${events.map((e) => e.slug).join(', ') || '(none)'}`)

  events.sort((a, b) => b.sortKey.localeCompare(a.sortKey))

  const failed = []
  for (const meta of events) {
    try {
      await buildEvent(meta)
    } catch (err) {
      console.error(`ERROR  ${meta.slug}: ${err.message}`)
      failed.push(meta.slug)
    }
  }

  log(`write  ${DIST_DIR}/index.html  (${events.length} event(s) listed)`)
  await writeFile(join(DIST_DIR, 'index.html'), renderIndex(events), 'utf8')

  log(`done.  total ${Date.now() - tStart}ms${failed.length ? `, ${failed.length} failed: ${failed.join(', ')}` : ''}`)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
