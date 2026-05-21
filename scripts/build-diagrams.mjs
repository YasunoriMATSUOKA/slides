import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, access, readdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const MD = process.argv[2] || '20260521_kyoto-hacker-way.md'
const OUT_DIR = 'assets/diagrams'
const MERMAID_FENCE = /```mermaid\n([\s\S]*?)```/g

const PUPPETEER_CFG = join(tmpdir(), 'mmdc-puppeteer-config.json')

await mkdir(OUT_DIR, { recursive: true })
await writeFile(PUPPETEER_CFG, JSON.stringify({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
}))

const md = await readFile(MD, 'utf8')
const blocks = [...md.matchAll(MERMAID_FENCE)].map((m) => m[1].trimEnd())

const hashes = new Set()
for (const content of blocks) {
  const hash = createHash('sha1').update(content).digest('hex').slice(0, 12)
  hashes.add(hash)
  const target = join(OUT_DIR, `${hash}.svg`)
  try {
    await access(target)
    console.log(`skip   ${hash}  (cached)`)
    continue
  } catch {}
  const inputFile = join(tmpdir(), `mermaid-${hash}.mmd`)
  await writeFile(inputFile, content, 'utf8')
  console.log(`render ${hash}  (${content.split('\n')[0].slice(0, 50)}...)`)
  await exec('npx', [
    'mmdc',
    '-i', inputFile,
    '-o', target,
    '-t', 'neutral',
    '-b', 'transparent',
    '-p', PUPPETEER_CFG,
    '--quiet',
  ])
}

// 使われなくなった SVG を掃除（ハッシュ未登録のもの）
for (const f of await readdir(OUT_DIR)) {
  if (!f.endsWith('.svg')) continue
  const hash = f.replace(/\.svg$/, '')
  if (!hashes.has(hash)) {
    await unlink(join(OUT_DIR, f))
    console.log(`prune  ${hash}`)
  }
}

console.log(`done. ${blocks.length} block(s), ${hashes.size} unique.`)
