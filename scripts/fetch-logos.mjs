import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const EVENT_DIR = process.argv[2] || 'events/20260521_kyoto-hacker-way'
const OUT_DIR = join(EVENT_DIR, 'assets', 'logos')

const DEVICON = (name, variant = 'original') =>
  `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${name}/${name}-${variant}.svg`
const SI = (slug) => `https://cdn.simpleicons.org/${slug}`

const ICONS = {
  javascript:       DEVICON('javascript'),
  typescript:       DEVICON('typescript'),
  vuejs:            DEVICON('vuejs'),
  cordova:          SI('apachecordova'),
  nuxtjs:           DEVICON('nuxtjs'),
  bulma:            DEVICON('bulma', 'plain'),
  jquery:           DEVICON('jquery'),
  kotlin:           DEVICON('kotlin'),
  spring:           DEVICON('spring'),
  mysql:            DEVICON('mysql'),
  python:           DEVICON('python'),
  opencv:           DEVICON('opencv'),
  scikitlearn:      DEVICON('scikitlearn'),
  selenium:         DEVICON('selenium'),
  appium:           SI('appium'),
  angular:          DEVICON('angular'),
  rxjs:             DEVICON('rxjs'),
  tailwindcss:      DEVICON('tailwindcss'),
  firebase:         DEVICON('firebase', 'plain'),
  algolia:          SI('algolia'),
  googlecloud:      DEVICON('googlecloud'),
  stripe:           SI('stripe'),
  // sendgrid: Simple Icons / DevIcon にロゴ無し（slide ではテキスト表示）
  // cosmos: 同上
  githubactions:    DEVICON('githubactions'),
  go:               DEVICON('go'),
  docker:           DEVICON('docker'),
  vultr:            SI('vultr'),
  react:            DEVICON('react'),
  svelte:           DEVICON('svelte'),
  nextjs:           DEVICON('nextjs'),
  vercel:           SI('vercel'),
  supabase:         DEVICON('supabase'),
  terraform:        DEVICON('terraform'),
  cloudflareworkers:DEVICON('cloudflareworkers'),
  cloudflare:       SI('cloudflare'),
  php:              DEVICON('php'),
  laravel:          DEVICON('laravel', 'original'),
  expo:             SI('expo'),
  hono:             SI('hono'),
  turso:            SI('turso'),
  resend:           SI('resend'),
  inertia:          SI('inertia'),
}

await mkdir(OUT_DIR, { recursive: true })

const failed = []
for (const [name, url] of Object.entries(ICONS)) {
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) {
      console.error(`FAIL ${res.status}  ${name}  ${url}`)
      failed.push(name)
      continue
    }
    const text = await res.text()
    if (!text.trim().startsWith('<')) {
      console.error(`BAD  ${name}  not SVG`)
      failed.push(name)
      continue
    }
    await writeFile(join(OUT_DIR, `${name}.svg`), text, 'utf8')
    console.log(`ok   ${name}`)
  } catch (e) {
    console.error(`ERR  ${name}  ${e.message}`)
    failed.push(name)
  }
}

if (failed.length) {
  console.error(`\n${failed.length} failures:`, failed.join(', '))
  process.exit(1)
}
