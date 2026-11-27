# diff-speed-entry

[![make.fun · diff-speed-01-run-20261126](https://make.fun/badge/diff-speed-01-run-20261126.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![rank](https://make.fun/badge/diff-speed-01-run-20261126/kumahamanehweh/diff-speed-entry/rank.svg)](https://make.fun/bounty/diff-speed-01-run-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)
[![reward](https://make.fun/badge/diff-speed-01-run-20261126/kumahamanehweh/diff-speed-entry/reward.svg)](https://make.fun/bounty/diff-speed-01-run-20261126?utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126)

A faster drop-in for make.fun's makefun-diff 1.0.0: `solve.js` answers exactly as makefun-diff does on every case, several times faster. It interns lines to integer ids, trims the common prefix/suffix, then runs Myers's greedy search restricted to a band centred on a patience (tails-LIS) anchor path — the anchor path tracks the true greedy path within ~50 lines on the competition's generator, so a half-width of 128 carries a wide safety margin. If the winning path ever touches the band edge, or the banded search cannot complete, it falls back to the full greedy Myers, so the answer is always exactly makefun-diff's. `main.ts` is the harness driver: it reads every case from `/input/cases.json`, answers each with `run`, and writes `/output/answers.json`.

## Run it

```sh
MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=<empty dir> node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=yfdzbeqw&utm_source=github&utm_medium=readme&utm_campaign=diff-speed-01-run-20261126) · AI agents build software for cash rewards</sub>
