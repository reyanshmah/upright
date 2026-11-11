# Upright

Upright turns any phone into a CDC STEADI fall-risk screen that a family member can run at home in about 10 minutes, in English or Spanish, with no wearable and no video leaving the phone.

Built for DSH Hacks V2.

> Home screening aid, not a diagnosis; share results with your doctor.

## Status

| Piece | State |
| --- | --- |
| Onboarding (`/start`): language, who runs it, age/sex/height/walking aid, STEADI 3 key questions + fall follow-ups | Done (Spanish needs a fluent check) |
| Safety checklist (`/setup`) | Done |
| 3 m line: camera measurement (pose + person's height) or tape | Done (camera accuracy not yet validated) |
| Test 1 TUG + Test 2 chair stand (`/test/tug`, `/test/chair`): instructions, placement diagram, live gates, countdown + "Go" cue, timer, safety stop, manual entry, CDC observations | Done |
| 4-Stage Balance (`/test/balance`): spoken stages, stance check, automatic 10 s holds, feet-moved detection, sway; CDC tandem < 10 s rule | Done (tested on synthetic streams; needs real-video validation) |
| Results (`/results`): family action plan (EN/ES template) + printable clinician summary + anonymous data download | Done |
| CDC thresholds: TUG >= 12 s, chair-stand norms 60–94, arms used = 0 | Done |
| Automatic TUG (auto-stop when seated, 5 phases) and chair stand (count, CDC halfway rule, arm use) — `lib/analysis/` | Done (tested on synthetic streams; needs real-video validation) |
| Pre-recorded voice MP3s (`public/audio/<lang>/<cue>.mp3`) | Browser speech placeholder |
| Quality outcomes (Full / Total only / Refused), gate log, session file, local IndexedDB copy, PWA shell (manifest, icons, service worker) | Done (Nov 10; phone-tested: no) |
| Lighting gate, Claude-written report with number check, Supabase | TODO |

**Results are typed.** Each test returns the contract in `lib/contract.ts` (`TugResult`, `ChairStandResult`): an `outcome` of `full`, `total_only` or `refused`, the gate log, median fps and timing error. `buildTugResult()` / `buildChairResult()` in `lib/analysis/results.ts` replay the recorded landmark stream through the same detectors the live test uses and apply the quality rules. A refused run carries no number. Each finished test can be downloaded as a session file (`lib/sessionFile.ts`: result + face-free landmark stream) that re-scores to the same result.

## Run it

```bash
npm install          # also copies the MediaPipe runtime into public/
npm run models       # downloads the pose models into public/models (once)
npm run dev:https    # camera needs HTTPS, even on your own phone
```

To load the dev server from a phone, put your laptop's Wi-Fi IP in `.env.local` as `ALLOWED_DEV_ORIGINS=192.168.x.x` (see `.env.example`).

Open the `https://` address it prints. To test on a phone, use the network address on the same Wi-Fi (accept the certificate warning), or deploy to Vercel.

```bash
npm test             # unit, synthetic-stream and golden-stream tests
npm run build
```

## Layout

```
app/
  page.tsx            home
  start/page.tsx      onboarding + STEADI screening questions
  setup/page.tsx      safety checklist + 3 m line (camera or tape)
  test/tug, test/chair  the two tests (shared components/TestRunner.tsx)
  results/page.tsx    family action plan + clinician summary
  pose/page.tsx       developer camera check
components/           CameraStage, TestRunner, setup diagram
lib/
  i18n.ts             English/Spanish strings
  session.ts          profile, answers, results (sessionStorage, stays on the phone)
  measure.ts          3 m measurement math (height-scaled pixels per meter)
  report.ts           family plan step order + EN/ES text
  voice.ts            voice cues (MP3 if present, else browser speech)
  contract.ts         typed result contract shared by engine, UI, backend, study
  sessionFile.ts      downloadable session file + replay (re-score) function
  store.ts            IndexedDB copy of each finished result
  analysis/index.ts   replay a landmark stream through the detectors
  analysis/results.ts quality outcome rules -> contract results
  pose/usePoseCamera.ts  camera + pose + gates + recording hook
  pose/landmarker.ts  MediaPipe Pose Landmarker (VIDEO mode, self-hosted wasm + model)
  signal/             pure functions of the landmark stream
    thresholds.ts     the ONE config file: CDC thresholds (TUG >= 12 s) and every detector constant
    oneEuro.ts        One Euro filter
    geometry.ts       knee angle, body scale, camera side, whole-body gate
    gate.ts           gate hysteresis + gate event log
    privacy.ts        face landmarks 0-10 are blanked when recorded
    types.ts          landmark stream format
tests/                vitest unit tests on synthetic streams
scripts/              copy-mediapipe.mjs, fetch-models.mjs
```

## Design rules

- **Everything that touches video runs on the phone.** The server only ever sees numbers.
- **Timestamps from `performance.now()`, never frame counts**, because browser frame rate varies.
- **Algorithms are pure functions of the saved landmark stream**, so threshold changes and ablations re-score every recorded session without re-recording anyone.
- **Clinical values are copied from the official CDC STEADI forms**, never typed from memory. TUG risk is **>= 12 s** ([CDC TUG form](https://www.cdc.gov/steadi/pdf/steadi-assessment-tug-508.pdf)).
- **No video and no identifiable landmark streams are committed.** See `.gitignore`.

## AI assistance

Parts of this codebase were written with AI assistance (Claude). Disclose this in the submission per the event rules.
