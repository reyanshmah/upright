# Upright — Build plan (Nov 10–14)

Build Upright as a mobile-first web app (an installable PWA), harden the measurement engine first, and polish the interface around it; four build days remain before the Nov 14 code freeze.

## Decision: a mobile-first web app, not a native app

Upright ships as a mobile-first web app that installs to the home screen (a PWA). A native iOS and Android app would cost the four days you have and add nothing a judge can see.

- **Judges open a link.** DSH asks for a prototype with user interaction. A URL that works on any phone in 10 seconds beats an app store build or a TestFlight invite.
- **The ML already runs in the browser.** MediaPipe Pose Landmarker has a web build, and the camera needs HTTPS anyway, which Vercel gives for free.
- **One codebase to harden.** Two native apps would split the time you need for the measurement engine, the validation study and the video.
- **It still feels like an app.** A web manifest, a service worker and full-screen display give a home-screen icon, no browser bar and offline use after the first load.

**What would change the decision:** only a requirement for background sensors or app-store distribution. Neither is in the rubric.

**Three rules that follow from it**

1. Design for a phone in portrait first, then let tablets and laptops scale up.
2. Test on a real iPhone and a real Android every day, not only in a desktop browser.
3. Treat Safari on iPhone as the strictest target: audio needs a tap to start, and the camera and wake lock have quirks in installed mode.

## Schedule: four build days, then evidence

Today’s gate is the Nov 10 checkpoint: chair-stand count matches your hand count on 10 trials, and at least 3 older adults are confirmed. Build runs through Nov 14, the thresholds freeze that day, and everything after it is testing, annotation and submission.

| Date | Build focus | Validation and ops | Gate to pass |
| --- | --- | --- | --- |
| Tue Nov 10 | 60-minute audit of what exists (next section). Gate debounce, three quality outcomes, session file, PWA shell. | Confirm 3+ older adults. Hand-count 10 chair-stand trials. | Chair-stand app count matches hand count on 10 trials. |
| Wed Nov 11 | TUG quality tiers, phase sanity flag, offline re-scoring script. Design tokens and setup screens on a phone. | Record the 20-clip gate test set. Run TUG trials with a stopwatch and a second camera. | Gate test set recorded; annotation page working. |
| Thu Nov 12 | Fix TUG timing from the first annotated runs. Report route and number check. | Annotate 10 TUG trials. | TUG total within 0.5 s of annotated truth on 10 trials. If not, cut phases. |
| Fri Nov 13 | Results, family plan and clinician summary polish. Spanish copy and Go/Stop audio. Post-TUG prompt. Offline caching. | Start classmate robustness sessions. | Full session runs start to finish on an iPhone and an Android. |
| Sat Nov 14 | Code freeze after bug fixes. Freeze thresholds and tag v1.0. | Older-adult sessions begin (Nov 14–16). | A stranger completes both tests alone from the public link. |
| Sun Nov 15 | Bug fixes only. | Finish classmate robustness data. Annotate. | Classmate data collected. |
| Mon Nov 16 | None. | Finish older-adult sessions. Run the raw-LLM baseline. Annotate. | Annotation at least half done, per the risk table. |
| Tue Nov 17 | None. | Analysis notebook, Bland-Altman and robustness charts. | All charts drawn from real data. |
| Wed Nov 18 | None. | Record the demo video. Delete validation recordings. | Video cut under the length limit. |
| Thu Nov 19 | None. | One-page PDF, code PDF, submit. | Submitted a day before the Nov 20 deadline. |

**Cut order if behind (cut from the top):** 4-Stage Balance, clinician PDF export (keep it on screen), offline caching, TUG phases beyond stand-up, Spanish audio (keep Spanish text), Supabase (use local JSON).

**Never cut:** chair stand, TUG total time, quality gates with refusal, the safety prompts, the validation study and the raw-LLM baseline.

## Workstreams: four tracks, one shared contract

The measurement engine is the critical path, because the interface, the report and the study all consume its output. Fix its output shape today and the other tracks can build in parallel. Assign names in the first 10 minutes; a natural split is one person on engine plus backend and one on interface, with validation shared and one person leading it.

| Track | Scope | Owner | Done when |
| --- | --- | --- | --- |
| 1. Measurement engine | Pose capture, frame clock, signal pipeline, gates, chair-stand and TUG logic, outcomes, session file, replay tools | \[A\] | Nov 10 and Nov 12 gates pass; all unit and replay tests green |
| 2. Mobile interface and accessibility | Design tokens, every screen, English and Spanish copy, captions, results and plans | \[B\] | Accessibility checklist passes on both phones; a stranger finishes unaided |
| 3. Backend and data | Report route, number check, storage, offline PWA, security, deployment | \[A\] | 20-JSON report test passes; public link works on a stranger’s phone |
| 4. Validation operations | Recruiting, consent, recording, annotation, analysis, charts | \[A + B, one lead\] | Charts drawn from real data by Nov 17 |

**The contract between tracks.** The engine returns one typed object per test. The interface renders it, the backend sends it, and the study stores it. Change it only by agreement.

```ts
type Outcome = "full" | "total_only" | "refused";

interface GateEvent { t: number; gate: "body" | "one_person" | "fps" | "light" | "seated" | "arms"; ok: boolean }

interface TugResult {
  schemaVersion: 1;
  outcome: Outcome;
  refusalReason?: "fps_low" | "second_person" | "not_visible_at_start_or_end" | "aborted" | "tab_hidden";
  totalSec: number | null;          // null when refused
  riskFlag: boolean | null;         // totalSec >= 12, null when refused
  phases?: { standUp: number; walkOut: number; turn: number; walkBack: number; sitDown: number }; // only when outcome === "full"
  timingErrorSec: number;           // about 1 / median fps
  medianFps: number;
  gateLog: GateEvent[];
}

interface ChairStandResult {
  schemaVersion: 1;
  outcome: "full" | "refused";
  refusalReason?: string;
  stands: number | null;
  armUse: boolean;
  belowNorm: boolean | null;        // CDC age and sex table
  medianFps: number;
  gateLog: GateEvent[];
}
```

**Day-0 audit (60 minutes, both of you, on real phones).** Tick only what works on a phone today. Every unticked line becomes that track’s first task.

- [ ] The public HTTPS link opens on an iPhone and an Android, not only on localhost.
- [ ] Pose overlay runs at 15 fps or better on both phones (write down the median fps).
- [ ] The back or ultra-wide camera can be chosen and is remembered.
- [ ] Each gate (whole body, one person, fps, light, seated, arms crossed) shows its fix message.
- [ ] Chair stand counts with the 30 s window and the last-rise rule.
- [ ] TUG starts its clock on the Go cue.
- [ ] The landmark download reproduces the on-screen result.
- [ ] Results, plan and clinician summary fit a phone with no sideways scrolling.
- [ ] The report route and number check exist.
- [ ] Every screen has Spanish text.
- [ ] Anonymous results save to Supabase or export as local JSON.

## Repo review: findings and fixes (Nov 10)

A repo review of the CLAUDE.md commands and the code found five issues that change the Nov 10 and Nov 12 gates. Fix them in this order.

1. **Confirm which chair counter the tests exercise.** `lib/analysis/chair.ts` is the production path; `lib/signal/chairStand.ts` is used only by the pose page and tests. Point the 27 tests at the production path, then delete the other counter. **Done when:** the test suite fails if the production counter is broken.
2. **Record real audio cues today, not Nov 13.** Browser speech starts after a variable delay, so every TUG time carries a bias you cannot measure. Record Go, Stop and 3-2-1 in English and Spanish (about ten short files) and start the clock at the file’s known Go frame. **Done when:** the cue offset is measured on a phone and written in the README.
3. **Add real golden streams.** The tests are synthetic only. Commit two or three real landmark streams from the Nov 8 runs, with face landmarks 0–10 removed and written consent confirmed. **Done when:** a golden test fails if the chair count changes on those streams.
4. **Confirm the report route exists.** The repo summary does not mention a server route, a Claude API call or Supabase. If none exists by Nov 12, cut “AI that cannot invent a number” from the one-page PDF and the pitch. **Done when:** either the route passes the 20-JSON test, or the claim is gone from every document.
5. **Check what the 3 m step records.** If it knows whether the mark was visible, pass that into the TUG outcome, so a missing mark yields Total only. **Done when:** a TUG with the mark out of frame cannot return Full.

**Smaller items**

- **Results persistence.** `sessionStorage` is cleared when the tab closes. Save each finished result to IndexedDB before the results screen opens.
- **Lint and CI.** There is no lint script. Add one, or drop lint from CI and run typecheck and tests on every push.
- **Network address.** Move the hardcoded LAN address in `next.config.mjs` to an environment variable, so a teammate on another network can run the dev server.
- **Tracked models.** `public/models/*.task` is tracked, although `npm run models` is meant to fetch them. Confirm which file is the lite model and that no heavy model ships to phones.
- **Commit CLAUDE.md.** It is the only change in the tree; commit it so agent work stays within the plan.

**Rules for changes (add to CLAUDE.md)**

- Every threshold lives in one config file; never inline a number in a detector.
- Never edit golden fixtures or test tolerances to make a test pass; stop and ask.
- Thresholds freeze on Nov 14; after that, bug fixes only.
- One stand counter: `lib/analysis/chair.ts`. Do not add another.
- Never commit video, face landmarks (indices 0–10) or API keys.
- Every screen and both reports say: “Home screening aid, not a diagnosis; share results with your doctor.”
- Every user-facing string has English and Spanish text.
- A run that fails a gate shows Refused or Total only, never a bare number.

## Look, feel and accessibility

Keep the current cream-and-deep-green look and make it stricter: one task per screen, one primary button, no text under 16 px, and nothing that depends on color or sound alone. Older adults and helpers are the users, so plain and large beats clever.

**Design tokens (starting values; check every text pair at 4.5:1, or 3:1 for 24 px and larger, with a contrast checker)**

| Token | Value | Use |
| --- | --- | --- |
| Background | #F7F3EC | Page |
| Surface | #FFFFFF | Cards, result rows |
| Text | #1B2B26 | Body and headings |
| Text secondary | #4A5A53 | Hints, captions |
| Primary | #1F3D36 | Main button fill (white text) |
| Accent | #A24A1C | Step labels such as “Test 1 of 2” |
| Success | #2F7D4F | Passed gate, OK result |
| Warning | #8A5A00 | Total-only result, low confidence |
| Error | #B3261E | Failed gate, refused result, Stop |
| Focus ring | #1D4ED8 | 2 px ring, 2 px offset, every focusable item |

**Type (use rem units so the phone’s text-size setting applies; the layout must survive 200% with no sideways scroll)**

| Role | Size | Weight | Where |
| --- | --- | --- | --- |
| Body | 18 px | 400 | Instructions, plans |
| Secondary | 16 px | 400 | Hints, footer |
| Screen title | 28 px | 700 | Top of every screen |
| Live status | 32 px | 700 | Phase label, gate fix messages during setup |
| Big numerals | 72–96 px | 700 | TUG timer, stand count |

**Layout and touch**

- Portrait first, content width capped at 480 px and centered on larger screens.
- One primary button per screen: full width, 56 px high, pinned to the bottom within thumb reach, padded for the safe-area inset.
- Every target is at least 48 × 48 px with 8 px between targets. Stop stays 56 px high in the same place on every test screen.
- Back is always top left. Radius 16 px, spacing on an 8 px grid.
- Build eight components once and reuse them: Button, GateRow, CameraStage, BigNumber, StepCard, StatusChip, Banner, ResultRow.

**Language and copy**

- English and Español switch on the first screen and in the header of every screen, saved on the device, with the page’s lang attribute set to match.
- Spanish uses the formal “usted” with older adults. A fluent speaker reviews all Spanish text before Nov 13.
- Write at about a 6th-grade level, under 15 words a sentence, one instruction per line. Check English with a readability tool.
- Never blame the person. Say “Move the phone back so we can see your feet,” not “Feet not detected.”

**Hearing, sight and motion**

- Every spoken prompt appears as an on-screen caption at the same moment. Many older adults wear hearing aids, and homes are noisy.
- The Go cue is a sound plus one full-width “GO” flash at the same instant. Nothing flashes more than three times a second.
- Status is never color alone: every gate and result shows an icon, a word and a color.
- The gate list is a polite live region for screen readers. The countdown is hidden from them, because the recorded audio already speaks it.
- Skeleton overlay lines are 3 px with a dark outline so they stay visible on any wall or clothing.
- Respect reduced motion. Keep transitions under 150 ms.

**Accessibility acceptance (tick when done)**

- [ ] Lighthouse accessibility score of 95 or more on the setup, results and summary screens.
- [ ] axe DevTools reports no serious or critical issues.
- [ ] The setup flow completes with VoiceOver on iPhone and TalkBack on Android.
- [ ] At 200% text size nothing is clipped and nothing scrolls sideways.
- [ ] In a grayscale screenshot every status is still readable.
- [ ] One adult aged 60 or older finishes setup and one test, and tells you where they hesitated.

## Screen flow

The flow combines what the Nov 8 recording showed with four additions: a language and role screen, a quality label on every result, the unsteadiness question after the TUG, and stopped and refused states.

&#91;embedded content: screen flow · 13 screens, 1 decision\]

A failed run never reaches the next screen as a bare number: it carries its quality label, or it shows no number at all.

**Screens to add or change**

- **Language and role (new):** the first screen. English or Español, and helper or the person themselves (see the solo-mode decision in the execution plan).
- **Result screens:** add the quality label (Full, Total only, Couldn’t measure) and hide the phase bar unless the outcome is Full.
- **Post-TUG question (new):** “Did the person look unsteady?” A yes skips the chair stand and recommends a doctor visit.
- **Stopped and refused states (new):** a plain message, what to fix, a Redo button and no number.
- **Setup screens:** show the fix message at 32 px, and keep Start disabled until every gate has stayed green for 0.7 s.
- **Results summary:** one sentence first, then three status rows, then the numbered plan. The clinician summary sits under a “For the doctor” heading with Print / save.
- **Sample session (new):** a button on the first screen for judges, described in the backend section.

## Measurement engine

The engine is a chain of pure functions over a timestamped landmark stream, so every number can be recomputed offline and every failure has a named defense. Build it in the order below; each layer is testable before the next exists.

**1. Capture (browser)**

- **Camera:** request 1280 × 720 at 30 fps, prefer the back camera, offer the ultra-wide when present, and remember the chosen device.
- **Pose model:** MediaPipe Pose Landmarker in VIDEO mode with the GPU delegate and a CPU fallback. Set numPoses to 2 so the one-person gate can see a second person. Self-host the model and WASM files; do not load them from a CDN at test time.
- **Adaptive model:** during setup, run the full model for 2 s. If median fps is under 20, switch to lite. Log which model ran. Never ship the heavy model to phones.
- **Frame clock:** stamp every frame at capture using requestVideoFrameCallback metadata where the browser provides it (capture or presentation time), else performance.now() inside the callback. Log which source was used. Pass strictly increasing millisecond timestamps to the model.
- **Cue timing:** decode the Go and Stop audio into Web Audio buffers and start them from the Start tap, because iPhone requires a tap before sound. Time zero is performance.now() at start, plus the output latency where the browser reports it. Measure the remaining offset by filming the phone.
- **Stall log:** keep the gap between every pair of frames. A gap over 150 ms inside a critical window counts as a stall.

**2. Signal pipeline**

- **Missing data:** a landmark with visibility under 0.5 is missing. Interpolate gaps up to 200 ms; longer gaps stay missing and feed the gates.
- **Smoothing:** a One Euro filter on every landmark coordinate. Starting values: minimum cutoff 1.0 Hz, beta 0.05, derivative cutoff 1.0 Hz. Tune on saved streams, then freeze.
- **Side choice:** use the leg with the higher mean visibility over the last second.
- **Body scale:** median hip-to-knee distance over the last second, recomputed per frame, so walking toward the camera does not distort thresholds.
- **Features per frame:** knee angle, trunk angle from vertical, hip x and y divided by body scale, hip velocity over a window of at least 100 ms (not frame to frame), and wrist distance from the opposite shoulder.
- **One config file:** every threshold lives in a single versioned file, never inline in a function.

**3. Chair stand**

- SEATED when knee angle is under 110°. STANDING when it is over 160° and hip height is near the standing baseline. A state must hold at least 100 ms, in time rather than frames, because fps varies.
- One stand per SEATED to STANDING transition inside a window that opens at the Go cue and closes exactly 30.0 s later in frame time. A rise more than halfway up at 30 s counts, per the STEADI form; copy its wording.
- Arm use: wrist distance from the opposite shoulder above 0.6 body scales during a rise. Per the STEADI form this stops the test and scores 0; confirm the wording.
- A STANDING state shorter than the hold time is ignored, which blocks bounce double counts.
- The CDC age and sex norms live in a typed table copied from the official form, with a test that checks every row.

**4. Timed Up and Go**

- Start is the Go cue. End is SEATED with hip speed near zero for 0.5 s, reported as the moment that window began. A hard limit of 60 s stops the test and refuses it.
- Events come from normalized hip x velocity: stand-up complete, departure, turn (velocity near zero, then reversing), return, sit start, seated.
- Outcomes: *Full* when every gate held, *Total only* when the person was visible at the start and the final sit but left the frame mid-walk (phases hidden), *Refused* otherwise.
- Phase sanity flag: if walk out and walk back differ by more than a limit set from your first 10 annotated trials, hide the phases.
- Reported precision is about one frame interval (1 / median fps) plus any stall. Show times to 0.1 s.

**Failure defenses**

| Failure | How the engine detects it | What it does |
| --- | --- | --- |
| Person partly out of frame | Hip, knee or ankle visibility under 0.5 | Gate turns red with a fix message; mid-test it yields Total only or Refused |
| Second person in frame | Second pose seen for more than 0.5 s | Refuse; the helper steps out of view |
| Low or uneven frame rate | Median fps under 15, or a stall inside a critical window | Refuse, or widen the reported error and log it |
| Backlight or dim room | Body brightness vs background ratio, plus low landmark confidence | Gate red: “Turn on a light or move away from the window” |
| Baggy clothing hides knees | Low knee visibility while hips stay visible | Gate red with a fix message; logged |
| Pose glitch or left-right swap | A landmark jumps farther than a person can move between frames | Drop the frame, hold the last good value; too many drops refuse the test |
| False “seated” at the end | Needs hip, knee and ankle visible and knee angle under 110° for 0.5 s | No end event; the 60 s limit refuses the test |
| Tab hidden, reload or camera lost | visibilitychange event, stream ended event | Abort, show Refused, no number |
| Audio fails or is muted | AudioContext suspended or decode error | Banner “Sound is off, use the on-screen GO”; time zero becomes the visual cue and is logged |
| Stop pressed or dizziness | Stop button | End the test, show no number, log the abort, show the safety message |
| Impossible profile input | Age outside 18–110 or height outside a sane range | Block with a plain message |

**Calibration discipline.** Split sessions into a development set and a held-out test set by participant, not by trial. Tune thresholds on the development set only, freeze them on Nov 14, and report final numbers on the held-out set. Tuning on the data you report is the quickest way to lose a judge’s trust.

## Backend and data

The server only ever sees numbers: it validates them, asks Claude to write the reports, rejects any report whose numbers do not match, and stores anonymous results. It never receives video, landmarks, a name, an exact age or a height.

**Routes**

| Route | Input | Output | Guards |
| --- | --- | --- | --- |
| POST /api/report | Engine results, age band, language | Family plan and clinician summary text | Schema check, range check, 15 s timeout, number check, template fallback, rate limit |
| POST /api/session | Anonymous results and gate summary | Session ID | Insert only, schema check, 20 KB size cap, rate limit |
| GET /api/health | None | Build version | Used to check the public deployment |

**Report pipeline**

1. The client builds one results JSON from the engine’s typed results. That is the single source of truth.
2. The server validates it with a schema and rejects impossible values, such as a TUG under 2 s or over 60 s, or more than 40 stands.
3. The prompt is a fixed system prompt, a fixed library of approved STEADI guidance in English and Spanish, and the JSON. Use Claude Sonnet 5.5 (confirm the current model string in Anthropic’s docs), temperature 0, and structured output with named fields.
4. **Number check.** Extract every numeral and spelled-out number from the output. Each must match a value in the JSON as the engine formats it, or a fixed constant in the guidance library such as 12 or 30. Anything else fails.
5. **Phrase check.** No diagnosis wording, no medicine changes (“stop taking,” dosing), no promises such as “will prevent falls.” The “not a diagnosis” line and the doctor-visit line must be present whenever any risk flag is set.
6. **Reading level.** Check English output against a grade of 7 or lower. A fluent speaker reviews the Spanish template and 10 sampled Spanish outputs.
7. On any failure, regenerate once. On a second failure, fill the deterministic template from the JSON. The person never sees a failed output.
8. Record which path wrote the text (model, regenerated, template) in the session. That rate becomes a result in the study.

Test with 20 fixed JSONs (Full, Total only, Refused, risk and no risk, English and Spanish) plus 10 adversarial outputs for the checker: an invented number, a right number in the wrong place, a spelled-out “twelve,” a wrong unit.

**Storage**

- **Supabase table “sessions”:** session ID, timestamp, schema and app version, device class, language, role (helper or self), age band, sex, outcomes and values, gate summary counts, median fps, simulated flag, condition tags, report source. No name, exact age, video or landmark stream; landmark files stay on the study laptop.
- **Row-level security:** the anonymous role can insert and nothing else. The notebook reads with a service key that never ships in the client bundle.
- **Local first:** save each result on the device (IndexedDB) and sync when online. If sync fails, offer a local JSON download.

**Offline and install**

- A web manifest (name, icons, standalone display, theme color) and a service worker that precaches the app shell, pose model, WASM, fonts and audio, so a test runs offline after one load.
- Version the cache by build hash and never swap versions during a test.
- Offline, the report uses the template and says so. Online, the model path runs.

**Security and operations**

- The API key lives only in a server environment variable. Set a monthly spend cap on it in the Anthropic console.
- Rate-limit both POST routes by IP, cap request bodies, allow same-origin requests only, and send a Permissions-Policy that grants the camera to your own origin only.
- No third-party analytics, cookies or trackers. Log client errors (message, build, device class) with no personal data.
- Production deploys from main, a preview deploys per branch, and v1.0 is tagged on Nov 14. Keep the tagged build deployed at a second URL as a fallback during judging.

**Sample session for judges.** Add a “Try a sample session” button that replays a saved, consented landmark stream through the real engine, labeled as a sample. A judge sees the timer, phases, quality label and both reports in 30 seconds without a camera, a chair or a walk. It also exercises the replay tool the tests already need.

## Quality bar

Resolute means every claim has a test that can fail: pure-function tests, synthetic and golden streams in CI, then real phones and real people. Set up the first three layers on Nov 10 and 11, before the code grows.

| Layer | What it checks | Tool | Pass bar |
| --- | --- | --- | --- |
| 1. Unit tests | Angle math, filters, state machines, the CDC norm table, the number checker | Vitest | Green on every push; every norm row tested |
| 2. Synthetic streams | Generated landmark sequences with known truth: clean sit-to-stand cycles, noise, dropped frames, fps drift, a second person | A generator in the test folder | Exact counts on clean streams; within ±1 under noise at 15 fps |
| 3. Golden streams | Real saved sessions with annotated truth, re-scored on every push | Replay script in CI | Every session within tolerance; any change must be justified in the commit |
| 4. Replay end to end | The whole page, including pose, fed a recorded video as the camera (Chromium fake-camera flags) | Playwright | A known video ends Full with the expected values (stretch goal) |
| 5. Real devices | Install, camera, sound unlock, wake lock, fps, a full session | One iPhone, one Android, daily | Median fps 15 or better; session completes |
| 6. Accessibility | Contrast, labels, focus order, screen readers, 200% text | Lighthouse, axe, VoiceOver, TalkBack | Checklist in the design section |
| 7. Report tests | 20 fixed JSONs and 10 adversarial outputs | Script | Zero unmeasured numbers pass |
| 8. Human trials | Accuracy, robustness, refusal, usability | The validation study | Targets in the execution plan |

**Continuous integration.** A GitHub Action runs typecheck, lint, unit, synthetic and golden tests on every push and builds a preview. Nobody merges on red.

**Definition of done for any change**

- It respects the typed result contract.
- It has a unit test, and a golden or synthetic test if it touches timing or counting.
- It runs on both phones.
- It adds no inline threshold; the value goes in the config file.
- It is labeled and reachable by keyboard, and it has English and Spanish text.
- If it affects a result, the session file records it.

**Daily ritual (15 minutes, evening).** Tag a build. Run one full session on each phone. Write down the median fps and one bug.

**Release checklist for v1.0 (Nov 14)**

- [ ] CI is green and the thresholds file is frozen with a version stamp.
- [ ] The public URL works on a stranger’s iPhone and Android.
- [ ] A test starts offline after one load.
- [ ] The sample session works.
- [ ] The API key has a spend cap and production environment variables are set.
- [ ] The README covers setup, architecture and how to rerun the analysis.
- [ ] The repo holds no videos, no landmark streams and no keys.
- [ ] “Home screening aid, not a diagnosis” appears on every screen and both reports.
