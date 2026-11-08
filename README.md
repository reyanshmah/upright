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
| Results (`/results`): family action plan (EN/ES template) + printable clinician summary + anonymous data download | Done |
| CDC thresholds: TUG >= 12 s, chair-stand norms 60–94, arms used = 0 | Done |
| **Automatic analysis of the recording** (`lib/analysis/index.ts`) | **Stub: rebuild at the hackathon** |
| Pre-recorded voice MP3s (`public/audio/<lang>/<cue>.mp3`) | Browser speech placeholder |
| Lighting gate, Claude-written report with number check, Supabase | TODO |

**Where the analysis plugs in:** `analyzeTug()` and `analyzeChairStand()` in `lib/analysis/index.ts` receive the recorded landmark stream (with `goCueT` = time zero) after every test. Return `null` and the app uses the helper's tap/count; return a value and it becomes the measured result (the helper's number is kept for the stopwatch comparison).

## Run it

```bash
npm install          # also copies the MediaPipe runtime into public/
npm run models       # downloads the pose models into public/models (once)
npm run dev:https    # camera needs HTTPS, even on your own phone
```

Open the `https://` address it prints. To test on a phone, use the network address on the same Wi-Fi (accept the certificate warning), or deploy to Vercel.

```bash
npm test             # signal-processing unit tests
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
  analysis/index.ts   ANALYSIS SLOTS for the hackathon
  pose/usePoseCamera.ts  camera + pose + gates + recording hook
  pose/landmarker.ts  MediaPipe Pose Landmarker (VIDEO mode, self-hosted wasm + model)
  signal/             pure functions of the landmark stream
    thresholds.ts     CDC thresholds (TUG >= 12 s) and algorithm constants
    oneEuro.ts        One Euro filter
    geometry.ts       knee angle, body scale, camera side, whole-body gate
    chairStand.ts     SEATED/STANDING state machine and stand counter
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
