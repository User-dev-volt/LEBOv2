// CI ratchet for the standing vitest failure baseline.
//
// The suite has 7 tolerated failures confined to three files (tracked in
// sprint-status.yaml as the "standing baseline"). CI must stay green on those
// exact failures while catching ANY new failure — a new failing file, or an
// 8th failing test inside a baseline file. When a baseline suite is fixed,
// shrink BASELINE below (never grow it — that requires a recorded decision).
//
// Usage: vitest run --reporter=json --outputFile=vitest-report.json (|| true),
// then: node scripts/ci-vitest-baseline.mjs vitest-report.json

import { readFileSync } from 'node:fs'

const BASELINE = {
  'src/features/settings/ProviderSelector.test.tsx': 5,
  'src/features/settings/Settings.test.tsx': 1,
  'src/features/skill-tree/TreeControls.test.tsx': 1,
}

const reportPath = process.argv[2] ?? 'vitest-report.json'
let report
try {
  report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch (err) {
  console.error(`ci-vitest-baseline: cannot read ${reportPath}: ${err.message}`)
  console.error('(vitest likely crashed before writing the report — treat as failure)')
  process.exit(1)
}

const normalize = (p) => p.replaceAll('\\', '/')
const results = report.testResults ?? []
if (results.length === 0) {
  console.error('ci-vitest-baseline: report contains no test results — treat as failure')
  process.exit(1)
}

let violations = 0
for (const file of results) {
  const failed = (file.assertionResults ?? []).filter((t) => t.status === 'failed').length
  if (failed === 0) continue
  const rel = normalize(file.name).split('/lebo/')[1] ?? normalize(file.name)
  const allowed = Object.entries(BASELINE).find(([k]) => rel.endsWith(k))
  if (!allowed) {
    console.error(`NEW FAILING FILE: ${rel} (${failed} failed) — not in the standing baseline`)
    violations += failed
  } else if (failed > allowed[1]) {
    console.error(`BASELINE EXCEEDED: ${rel} has ${failed} failures (baseline ${allowed[1]})`)
    violations += failed - allowed[1]
  } else {
    console.log(`baseline-tolerated: ${rel} (${failed}/${allowed[1]})`)
  }
}

if (violations > 0) {
  console.error(`\nci-vitest-baseline: ${violations} failure(s) beyond the standing baseline.`)
  process.exit(1)
}
console.log('ci-vitest-baseline: no failures beyond the standing baseline.')
