import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, access, readdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const EVENTS_DIR = 'events'
const MERMAID_FENCE = /```mermaid\n([\s\S]*?)```/g

const PUPPETEER_CFG = join(tmpdir(), 'mmdc-puppeteer-config.json')
await writeFile(PUPPETEER_CFG, JSON.stringify({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
}))

async function listMarkdown(dir) {
  const out = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const ent of entries) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) {
      out.push(...await listMarkdown(p))
    } else if (ent.isFile() && ent.name.endsWith('.md')) {
      out.push(p)
    }
  }
  return out
}

const mdFiles = await listMarkdown(EVENTS_DIR)
if (mdFiles.length === 0) {
  console.log(`no markdown found under ${EVENTS_DIR}/`)
  process.exit(0)
}

let totalBlocks = 0
let totalUnique = 0

for (const mdPath of mdFiles) {
  const md = await readFile(mdPath, 'utf8')
  const blocks = [...md.matchAll(MERMAID_FENCE)].map((m) => m[1].trimEnd())
  if (blocks.length === 0) continue

  const outDir = join(dirname(mdPath), 'assets', 'diagrams')
  await mkdir(outDir, { recursive: true })

  const hashes = new Set()
  for (const content of blocks) {
    const hash = createHash('sha1').update(content).digest('hex').slice(0, 12)
    hashes.add(hash)
    const target = join(outDir, `${hash}.svg`)
    try {
      await access(target)
      console.log(`skip   ${relative('.', target)}  (cached)`)
      continue
    } catch {}
    const inputFile = join(tmpdir(), `mermaid-${hash}.mmd`)
    await writeFile(inputFile, content, 'utf8')
    console.log(`render ${relative('.', target)}  (${content.split('\n')[0].slice(0, 50)}...)`)
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

  for (const f of await readdir(outDir)) {
    if (!f.endsWith('.svg')) continue
    const hash = f.replace(/\.svg$/, '')
    if (!hashes.has(hash)) {
      await unlink(join(outDir, f))
      console.log(`prune  ${relative('.', join(outDir, f))}`)
    }
  }

  totalBlocks += blocks.length
  totalUnique += hashes.size
}

console.log(`done. ${totalBlocks} block(s), ${totalUnique} unique across ${mdFiles.length} markdown file(s).`)
