// 各イベントの表紙スライド (1 枚目) を OGP 画像 (PNG 1280x720) として書き出す。
//
// - 出力先: events/<event>/assets/ogp/<hash>.png
//   hash = フロントマター + 1 枚目スライドの内容の SHA1 先頭 12 文字
//   → 表紙を編集したときだけ新しいファイルが生成され、古いものは prune される
// - Mermaid SVG と同じく **生成物は commit する**。CI (Cloudflare Workers Builds) には
//   Chrome がない前提なので、CI ではキャッシュ済み PNG をそのまま使う
// - キャッシュが無く Chrome も無い環境では warning を出してスキップする（ビルドは止めない）
import { createHash } from 'node:crypto'
import { readFile, mkdir, readdir, unlink, access } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const EVENTS_DIR = 'events'
const DATE_PREFIX = /^\d{8}_/
const MARP_BIN = join('node_modules', '.bin', 'marp')
const MARP_TIMEOUT_MS = 120_000

// フロントマター + 1 枚目スライドを取り出す（---\n...\n---\n<slide1>\n---\n...）
export function extractCover(md) {
  const lines = md.split('\n')
  if (lines[0].trim() !== '---') return md
  const fmEnd = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (fmEnd < 0) return md
  const rest = lines.slice(fmEnd + 1)
  const slideEnd = rest.findIndex((l) => l.trim() === '---')
  const cover = slideEnd < 0 ? rest : rest.slice(0, slideEnd)
  return [...lines.slice(0, fmEnd + 1), ...cover].join('\n').trimEnd()
}

export function ogpHash(md) {
  return createHash('sha1').update(extractCover(md)).digest('hex').slice(0, 12)
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const entries = await readdir(EVENTS_DIR, { withFileTypes: true })
  let rendered = 0
  let skipped = 0
  let missing = 0

  for (const ent of entries) {
    if (!ent.isDirectory() || !DATE_PREFIX.test(ent.name)) continue
    const slug = ent.name
    const mdPath = join(EVENTS_DIR, slug, `${slug}.md`)
    if (!(await exists(mdPath))) continue

    const md = await readFile(mdPath, 'utf8')
    const hash = ogpHash(md)
    const outDir = join(EVENTS_DIR, slug, 'assets', 'ogp')
    const target = join(outDir, `${hash}.png`)
    await mkdir(outDir, { recursive: true })

    if (await exists(target)) {
      console.log(`skip   ${relative('.', target)}  (cached)`)
      skipped++
    } else {
      console.log(`render ${relative('.', target)}`)
      try {
        // --image: 1 枚目だけを画像化。16:9 / scale 1 → 1280x720
        // --no-stdin: execFile の stdin はパイプなので、付けないと marp が stdin 待ちで固まる
        await exec(
          MARP_BIN,
          [mdPath, '--image', 'png', '--allow-local-files', '--no-stdin', '-o', target],
          { timeout: MARP_TIMEOUT_MS },
        )
        rendered++
      } catch (err) {
        console.warn(`WARN   ${slug}: OGP 画像を生成できませんでした (Chrome が無い?)。og:image なしで続行します`)
        console.warn(`       ${String(err.message).split('\n')[0]}`)
        missing++
        continue
      }
    }

    for (const f of await readdir(outDir)) {
      if (f.endsWith('.png') && f !== `${hash}.png`) {
        await unlink(join(outDir, f))
        console.log(`prune  ${relative('.', join(outDir, f))}`)
      }
    }
  }

  console.log(`done. rendered=${rendered} cached=${skipped} missing=${missing}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
}
