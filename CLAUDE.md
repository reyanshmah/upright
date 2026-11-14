# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`MASTER.md` is the build plan (Nov 10–14 schedule, the result contract, failure defenses, the repo-review findings). Work stays inside it. `README.md` has the feature status table and design rules.

## Commands

```bash
npm install                  # postinstall copies MediaPipe wasm into public/mediapipe (gitignored)
npm run dev:https            # camera needs https://, so use this for phone testing
npm test                     # vitest run: unit, synthetic-stream and golden-stream tests
npm run typecheck            # tsc --noEmit
npm run build
```

There is no lint script. CI (`.github/workflows/ci.yml`) runs typecheck and tests on every push.

Single test file or test name:

```bash
npx vitest run tests/outcome.test.ts
npx vitest run tests/signal.test.ts -t "TUG threshold"
```

Other scripts: `npm run models` (fetch pose models; skips existing), `node scripts/make-icons.mjs` (rebuild the app icons from `assets/logo.png`; rounded corners are cut into the PNG alpha), `node scripts/strip-face.mjs in.json > out.json` (blank face landmarks 0–10 in an old stream).

## Big picture

Upright is a phone-only CDC STEADI fall-risk screen (Timed Up and Go + 30-Second Chair Stand), shipped as a mobile-first PWA. Everything that touches video runs in the browser; the server only ever sees numbers.

**Screen flow (Next.js App Router, all client pages):** `/start` (welcome: what Upright does + how data stays safe, then profile (name, age, sex, walking aid; height is asked only if the 3 m camera-estimate option needs it) and the STEADI questions; a helper always holds the phone, so there is no "who is using the phone" step) → `/setup` (safety promise "I will…" + 3 m line; on iPhone the Measure app card is offered first and repeated on the tape, camera-estimate and TUG intro screens) → `/test/tug` → `/test/chair` → `/results`. Pages pass state through `lib/session.ts` (one `sessionStorage` key; `loadSession()` / `updateSession()`), so data is per-tab. Each finished test is also written to IndexedDB (`lib/store.ts`) before the results screen opens.

**Camera → landmarks → result (one pipeline for every camera screen):**
- `lib/pose/usePoseCamera.ts` is the single hook for camera, MediaPipe pose, skeleton overlay, live gates and recording. Used by `components/TestRunner.tsx` (both tests), `components/ARMeasure.tsx` (3 m line) and `app/pose/page.tsx`.
- `TestRunner` phases: intro → position (all gates green for `GATES.allGreenHoldMs`) → instructions → 3-2-1 → running. The "Go" cue is time zero. During the instructions or 3-2-1 the start pauses if the PERSON moves (stood up or uncrossed arms: at once; out of view for `GATES.interruptLostMs`: so a hand-held phone can sway) or the PHONE turns more than `MOTION.phoneMovedDeg` (gyroscope, `lib/motion.ts`; tremor and drift ignored). A phone turned that much during a running test stops it (refused as aborted). A frame-rate dip never pauses. When paused, cues stop (`stopCues()` in `lib/voice.ts`), the pause is shown and spoken, and it goes back to position; a run token stops a stale start from carrying on. Settings > "Start the test" = Auto-start (TUG, chair stand, balance): each test opens the camera itself, begins the moment Start would light up (`GATES.allGreenHoldMs`), and after the result moves on (or retries a failed run) after `AUTO_NEXT_S`. Any tap on any screen unlocks audio (AppShell), so no "Check position" tap is needed on iPhone. It logs every gate transition (`GateLogger`) and records `PoseFrame`s stamped with `performance.now()`, never frame counts.
- Face landmarks 0–10 are blanked at record time (`lib/signal/privacy.ts`). The detectors never read them.

**The result contract (`lib/contract.ts`)** is the single typed object the engine returns, the UI renders, the backend sends and the study stores. Change it only by agreement (bump `schemaVersion`, update MASTER.md in the same commit). `lib/session.ts` stores it as `TugEntry` / `ChairEntry` (contract + local extras like `camera`, `halfwayCounted`). Use `tugMeasured()` / `chairMeasured()` to read a number: they return null for skipped or refused runs.

**Analysis is replayed, not run once.** Live detectors (`lib/analysis/tug.ts`, `chair.ts`) drive the on-screen numbers and auto-stop. After the test, `buildTugResult` / `buildChairResult` (`lib/analysis/results.ts`) replay the saved stream through the same detectors (`lib/analysis/index.ts`), then apply the quality rules: **Refused** (no number) for abort, hidden tab, fps < 15, a second person > 0.5 s, no total, or body not visible at the start/end; **Total only** when the body gate dropped mid-walk, phases are missing, or the 3 m mark was out of frame; **Full** otherwise. A TUG filmed front-on (no turn seen) still ends when they sit back down after being up at least `TUG.minAwayMs`, with no phases, so it is Total only. Facing the camera, the seated check also accepts a short-looking thigh (`POSTURE.frontalShoulderFrac` / `frontalThighFrac`). The `one_person` gate logs "no second person" (losing the person is the body gate's job). The body-size scale (shank) follows a person walking toward/away from the camera (`FEATURES.shankRescaleFrac`), and a sudden 2x size jump is ignored as a different detection, e.g. a pet (`FEATURES.maxScaleJump`). Keep detectors and builders pure: no DOM, timers or React state, so any session file can be re-scored (`rescoreSessionFile` in `lib/sessionFile.ts`).

**Signal layer (`lib/signal/`):** `thresholds.ts` is the one config file (CDC values, `ALGO`, `GATES`, `FEATURES`, `POSTURE`, `TUG`, `CHAIR`, `CONFIG_VERSION`). `gate.ts` has `StableFlag` hysteresis and the gate log; `geometry.ts` has the whole-body gate; `oneEuro.ts` smooths.

**Other modules:** `lib/i18n.ts` (EN/ES; Spanish needs a fluent review), `lib/report.ts` (family plan order + text), `lib/measure.ts` (3 m math), `lib/voice.ts` (MP3 from `public/audio/<lang>/` if present, else browser speech; `getLastCueSource()` records which was used), `components/SettingsSheet.tsx` (the header's Settings: language from `LANGS` in `lib/i18n.ts`, text size and dyslexia font via `lib/displayPrefs.ts`, colors via `lib/themePref.ts`; all applied as `data-*` on `<html>` before paint), `lib/langPref.ts` (`detectLang()`: saved choice, else the phone's language). `public/sw.js` + `app/manifest.ts` are the PWA shell (the worker registers in production builds only, with one cache per build id). `lib/wakeLock.ts` keeps the screen on while the camera runs. A camera below `ALGO.minFps` for `PERF.liteAfterMs` (e.g. iPhone Low Power Mode) switches to the lite pose model when not recording. Settings also has a 0.75x–1.25x text scale, line spacing, a reading guide, a header "Read this screen aloud" button (voice speed applies to every spoken text via `speakText()`), and "Delete my data" (`clearRuns()` + session). Status colours are one colour-blind-safe set (ok / warn = total / error = risk / info) in every theme. `/privacy` and `/terms` (Upright Inc.) come from `lib/legal.ts`; the contact email is `NEXT_PUBLIC_LEGAL_EMAIL`.

**Backend:** `POST /api/report` (guards in `lib/reportgen/guard.ts`: 20 KB cap read as a stream, same-site Origin check, per-address rate limit) and `GET /api/health`. The results page builds the request with `lib/reportgen/clientInput.ts` (numbers and an age band only) and shows the model's plan only when the server says it passed the checks; offline or on failure it keeps the on-device plan. The report request includes the balance test and walking aid; the writer gets per-person `focus` and `personalNotes` (`lib/report.ts` `planContext` / `stepDetail`), and the on-device plan is personalised the same way. The results footnote says why the standard plan is shown (no key / failed checks / error); `GET /api/health` reports `reportWriter: configured | missing_api_key`.

**Exercises:** `lib/exercises.ts` picks fixed, approved exercises from the results (CDC chair rise for weak legs / a slow walk; practice of the balance position they could not hold) and the results screen shows them under the plan with safety lines (ask the doctor first when risk is higher). The AI writer never writes exercise steps (`FACTS.exercises` only names them).

**Balance test:** front or ~45° view; feet are compared as a gap vector scaled by shank length, so the helper's phone may move. A position starts once the feet have changed from the previous position and settled; positions are spoken aloud (the person can't see the screen).

## Rules for changes (from MASTER.md)

- Every threshold lives in `lib/signal/thresholds.ts`; never inline a number in a detector.
- Never edit golden fixtures or test tolerances to make a test pass; stop and ask.
- Thresholds freeze on Nov 14; after that, bug fixes only.
- One stand counter: `lib/analysis/chair.ts`. Do not add another.
- Never commit video, face landmarks (indices 0–10) or API keys.
- Every screen and both reports say: "Home screening aid, not a diagnosis; share results with your doctor."
- Every user-facing string has English and Spanish text.
- A run that fails a gate shows Refused or Total only, never a bare number.
- Clinical values are copied from the official CDC STEADI forms, never typed from memory.

## Gotchas

- To load the dev server from a phone, set `ALLOWED_DEV_ORIGINS=<laptop Wi-Fi IP>` in `.env.local` (gitignored; see `.env.example`).
- Tests use synthetic landmark streams (`tests/synth.ts`). `tests/golden/` is for real, consented, face-free streams; until some are committed the golden test shows as `todo`. Passing tests are not clinical validation.
- `public/models/` holds the lite and full pose models, tracked in git. No heavy model exists in the repo; keep it that way.
- Session files and landmark streams are identifiable even without video. `.gitignore` excludes `recordings/`, `landmarks/` and video files.
