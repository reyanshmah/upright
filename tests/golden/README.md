# Golden streams

Real recorded sessions with annotated truth, re-scored on every push
(`tests/golden.test.ts`). A golden test fails if the chair count or TUG total
changes on these streams; justify any change in the commit message. Never edit a
golden file or its tolerance to make a test pass.

## Adding one

1. Get written consent from the person in the recording (`golden.consent: true` is checked).
2. Use a session file downloaded from the app (`<id>.session.json`). Files from the app
   already have face landmarks 0-10 blanked. For older plain landmark downloads run:
   `node scripts/strip-face.mjs path/to/old.landmarks.json > tests/golden/name.session.json`
   and fill in the missing fields by hand, or re-record.
3. Add the truth from your hand count / stopwatch + second camera:

```json
"golden": {
  "consent": true,
  "truth": { "stands": 12, "armUse": false },
  "note": "Nov 8, helper-run, back camera"
}
```

TUG truth is `{ "totalSec": 9.8, "tolSec": 0.5 }`.

Never commit video or a stream that still has face landmarks (the test checks this).
