import { createHash } from 'node:crypto'
import { Marp } from '@marp-team/marp-core'

export default (opts) => {
  const marp = new Marp(opts)
  const originalFence = marp.markdown.renderer.rules.fence
  marp.markdown.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx]
    if ((token.info || '').trim() === 'mermaid') {
      const content = token.content.trimEnd()
      const hash = createHash('sha1').update(content).digest('hex').slice(0, 12)
      return `<p class="diagram"><img src="assets/diagrams/${hash}.svg" alt="mermaid diagram"></p>`
    }
    return originalFence(tokens, idx, options, env, slf)
  }
  return marp
}
