import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const patterns = [
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/u,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|AIza[\w-]{35})\b/u,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][\w./+-]{24,}["']/iu,
]
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
let findings = 0
for (const path of paths) {
  const bytes = readFileSync(path)
  if (bytes.includes(0)) continue
  bytes.toString('utf8').split(/\r?\n/u).forEach((line, index) => {
    if (patterns.some(pattern => pattern.test(line))) {
      findings++
      process.stderr.write(`Possible secret in ${path}:${index + 1}\n`)
    }
  })
}
process.stdout.write(`Scanned ${paths.length} tracked paths. ${findings} possible matches.\n`)
process.exitCode = findings ? 1 : 0
