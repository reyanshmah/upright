# Upright

Upright turns any phone into a CDC STEADI fall-risk screen that a family member can run at home in about 10 minutes, in English or Spanish. It needs no wearable, and no video ever leaves the phone.

Built for DSH Hacks V2.

> Home screening aid, not a diagnosis; share results with your doctor.

## What it does

A helper holds the phone, and the older adult does three tests from the CDC's STEADI toolkit. The phone's camera and an on-device pose model do the timing and counting.

| Test | What the app measures | CDC rule it applies |
| --- | --- | --- |
| **Timed Up and Go (TUG)** | Time from the "Go" cue to sitting back down, split into phases (stand, walk 3 m, turn, return, sit) | 12 seconds or more = at risk |
| **30-Second Chair Stand** | Full stands in 30 s, and whether arms were used | Arm use scores 0. A last stand counts only if the person is more than halfway up at 30 s. Below-average for age and sex (CDC norms, ages 60-94) = at risk |
| **4-Stage Balance** | Four stances (feet together, semi-tandem, tandem, one foot), each held up to 10 s, plus sway | Not holding tandem for 10 s = at risk |

Before the tests the app asks the three STEADI key questions (unsteady, worried about falling, fallen) and the fall follow-ups. If the TUG takes 20 s or more, it suggests skipping the chair stand for safety.

The results screen gives a **family action plan** (medicines review, strength and balance exercises, home safety, doctor visit), a **printable clinician summary** and an anonymous data download.

## A session, start to finish

1. **`/start`**: what Upright does and how data stays safe, then name, age, sex, walking aid and the STEADI questions. Height is asked only if the 3 m camera-estimate option needs it.
2. **`/setup`**: a safety promise ("I will...") and the 3 m line. On Android Chrome the phone can measure the line with AR. On iPhone the app points to the Measure app, or estimates the distance from the camera using the person's height. A tape measure always works.
3. **`/test/tug`, `/test/chair`, `/test/balance`**: for each test, a diagram, a position check, spoken instructions, a 3-2-1 countdown and the test itself.
4. **`/results`**: the plan, the clinician summary and the data download.

During a test:

- **Position check.** For the TUG and chair stand, Start stays disabled until every gate has been green for 0.7 s: whole body in view, one person, enough frames per second, seated, arms crossed. Each gate shows its own fix message. The balance test checks that the person is standing with both feet in view.
- **Spoken cues.** The person can't see the screen, so every instruction and cue is spoken. Recorded English and Spanish voice clips are used first, with the browser's speech as a fallback. Voice speed can be slowed to 0.75x or 0.5x without changing pitch, except 3-2-1, Go and Stop, which stay at normal speed so time zero is exact.
- **Pauses (TUG and chair stand).** If the person stands up early or leaves the picture during the instructions or countdown, the start pauses and says so. A phone that turns more than 15° (gyroscope) pauses the start too, and a run in which it does is stopped and not scored. Hand tremor is ignored. The balance test lets the phone move a little, because it measures the feet relative to each other.
- **Auto-start.** Settings has a "Start the test" switch. With it on, each test opens the camera itself, begins the moment the gates are green, and moves on or retries after the result, so a person testing alone doesn't have to reach over.

## How the measurement works

```
camera → MediaPipe Pose Landmarker (on the phone) → landmark frames (performance.now() stamps)
       → live detectors (on-screen numbers, auto-stop)
       → after the test: the saved stream is REPLAYED through the same detectors
       → quality rules → typed result (lib/contract.ts)
```

- **Replay, not a single pass.** `buildTugResult` and `buildChairResult` (`lib/analysis/results.ts`) re-run the recorded stream, so any session file can be re-scored later (`rescoreSessionFile` in `lib/sessionFile.ts`). Detectors are pure functions: no DOM, timers or React state.
- **One config file.** Every CDC value and detector constant lives in `lib/signal/thresholds.ts` (`CONFIG_VERSION` is stored with every result).
- **Timestamps, not frame counts.** Browser frame rates vary.
- **Scale from the body.** Distances are measured in shank lengths, so results don't depend on how far the phone is. The scale follows a person walking toward or away from the camera, and ignores a sudden 2x size jump (for example, a pet crossing the picture).
- **Any camera angle.** A TUG filmed front-on (no turn visible) still ends when the person sits back down, but is scored as Total only. The balance test works from the front or at about 45°.
- **Balance detection.** Feet are compared as a gap vector, so a helper's phone can drift or zoom without ending a hold. A position starts once the feet have moved from the previous position and settled. Positions 2-3 are recognised by foot movement, not ankle height, since a phone held above the feet sees the nearer foot lower. Position 4 needs the lift to exceed the previous position's baseline.

**Every result carries a quality outcome. A run that fails a check never shows a bare number.**

| Outcome | When | What the person sees |
| --- | --- | --- |
| **Full** | All checks passed | The number and phases |
| **Total only** | Body left the picture mid-walk, phases are missing, or the 3 m mark was out of frame | The total only |
| **Refused** | Aborted, tab hidden, under 15 fps, a second person for more than 0.5 s, no total, or body not visible at the start or end | No number, with the reason and a retry |

## Privacy

- **Video never leaves the phone.** The pose model runs in the browser (WebAssembly, self-hosted).
- **Face landmarks (indices 0-10) are blanked at record time** and never read by the detectors.
- **The name and answers stay on the phone**, in `sessionStorage`, so they disappear when the tab closes.
- **Each finished result is also saved locally** in IndexedDB. Settings has "Delete my data".
- **The server sees numbers and a few categories.** The report request (`lib/reportgen/clientInput.ts`) contains test results, an age band and answers such as walking aid, never a name, birth date, video or landmarks.
- **Session files and landmark streams are identifiable even without video.** They are downloaded only when the person asks, and `.gitignore` excludes `recordings/`, `landmarks/` and video files.
- `/privacy` and `/terms` (Upright Inc.) are built from `lib/legal.ts`. They are a draft and have not had a lawyer's review.

## The AI-written family plan

`POST /api/report` asks Claude (`claude-sonnet-5-5`, key held server-side) to write the plan from the numbers. The model is a writer only and doesn't decide anything:

1. The server accepts at most 20 KB (read as a stream), only from this site's own pages, and at most 20 requests a minute per address.
2. The model gets the results plus the person's focus areas and walking aid, and picks 3-4 exercises from the approved library in `lib/exercises.ts` (12 exercises, English and Spanish). The library supplies the steps and numbers. The model writes only why each fits and a one-line tip.
3. `lib/reportgen/check.ts` checks the draft:
   - Every number must come from the engine's facts, in its format and with a fitting unit.
   - There can be no diagnosis wording, medicine changes or promises.
   - If any risk flag is set, the exact disclaimer and a doctor visit must both appear.
   - Exercise ids must be eligible for this person.
4. A rejected draft is regenerated once with the checker's reasons, inside one 15 s budget. If that fails too, or there is no key or no network, the app shows the on-device template plan, which is personalised the same way.
5. The safety box ("before you start", doctor or physical therapist first when risk is higher) is always written by the app, never the model.

The results page says why the standard plan is shown (no key, failed checks, error). `GET /api/health` reports `reportWriter: configured | missing_api_key`.

## Accessibility and languages

- **English and Spanish** for every user-facing string, switchable in Settings, with the phone's language as the default. The Spanish text needs a review by a fluent speaker.
- **Settings:** text size from 0.75x to 1.25x, a dyslexia-friendly font (OpenDyslexic), line spacing, a reading guide, a header "Read this screen aloud" button, voice speed, and colour themes.
- **Status colours** use one colour-blind-safe set (ok, total only, risk, info) in every theme, and `tests/contrast.test.ts` checks the contrast of each theme's colours.
- **Installable PWA** (manifest, icons and a service worker with one cache per build; the worker registers in production builds only). The screen stays awake while the camera runs.
- **Low-power phones:** if the camera stays under 15 fps for 3 s outside a recording (for example iPhone Low Power Mode), the app switches to the lighter pose model.

## Status and known limits

| Piece | State |
| --- | --- |
| Onboarding, safety checklist, 3 m line (AR, Measure-app guidance, camera estimate, tape) | Done. The camera estimate is accurate to roughly 10-15 cm and hasn't been validated against a tape |
| TUG, chair stand, balance: instructions, gates, cues, timers, manual entry, CDC rules | Done |
| Automatic scoring of all three tests | Done and tested on synthetic landmark streams. **Not validated against real, annotated recordings** |
| Voice clips (EN + ES) | Recorded for every cue except the English "phone moved a lot" message, which uses browser speech |
| Results: plan, clinician summary, anonymous download | Done |
| AI-written plan with number and phrase checks | Done. Needs `ANTHROPIC_API_KEY` on the server |
| Privacy policy and terms | Draft, pending legal review, the governing-law state and a contact email (`NEXT_PUBLIC_LEGAL_EMAIL`) |
| Lighting gate (backlit or dim rooms) | Not built |
| Shared database (Supabase) | Not built. Results stay on the phone, and a download is available |
| Real phone testing (Android and iPhone) | Partial. Audio overlap, the iPhone motion-permission prompt, Low Power Mode and the Measure-app flow still need checking on devices |

Passing tests are not clinical validation. `tests/golden/` is ready for real, consented, face-free streams with a hand-counted truth, but none are committed yet, so the golden test shows as `todo`.

## Run it

```bash
npm install          # also copies the MediaPipe runtime into public/mediapipe (gitignored)
npm run models       # downloads the pose models into public/models (skips existing)
npm run dev:https    # the camera needs HTTPS, even on your own phone
```

Open the `https://` address it prints. To test on a phone on the same Wi-Fi, put the laptop's IP in `.env.local` as `ALLOWED_DEV_ORIGINS` and accept the certificate warning, or deploy to Vercel.

| Variable | Where | What it does |
| --- | --- | --- |
| `ALLOWED_DEV_ORIGINS` | `.env.local` | Comma-separated hosts allowed to load the dev server (see `.env.example`) |
| `ANTHROPIC_API_KEY` | Server only | Enables the AI-written plan. Without it the on-device plan is used |
| `NEXT_PUBLIC_LEGAL_EMAIL` | Build time | Contact address shown on `/privacy` and `/terms` |

`VERCEL_GIT_COMMIT_SHA` names the offline cache per deploy. The app is set up for Vercel, and `next.config.mjs` sets the security headers (no framing, camera allowed only for this site).

```bash
npm test             # unit, synthetic-stream and golden-stream tests (700+)
npm run typecheck    # tsc --noEmit
npm run build
```

There is no lint script. CI (`.github/workflows/ci.yml`) runs typecheck and tests on every push. Other scripts: `node scripts/make-icons.mjs` rebuilds the app icons from `assets/logo.png`, and `node scripts/strip-face.mjs in.json > out.json` blanks the face landmarks in an old stream.