# Audit — Nov 10 (against MASTER.md)

Read-only checks of the code plus today's fixes. Nothing here was tested on a phone. A tick means "confirmed in code or by a passing test"; items that need a real device, a recording or a person are marked **needs you**.

## Day-0 checklist

| # | Item | Status | Evidence / next step |
| --- | --- | --- | --- |
| 1 | Public HTTPS link opens on iPhone + Android | **needs you** | No deployment config in the repo. `npm run build` and `next start` serve the app, manifest, service worker and icons (HTTP 200), but nobody has opened it on a phone. |
| 2 | Pose overlay ≥ 15 fps on both phones | **needs you** | Median fps is now stored in every result (`medianFps`) and a run under 15 fps is Refused. No phone numbers exist yet. |
| 3 | Back / ultra-wide camera chosen and remembered | Code ✔, phone **needs you** | `usePoseCamera.ts`: zoom-out, ultra-wide label search, device remembered in `sessionStorage`. |
| 4 | Every gate shows its fix message | Partial | Body (names the missing part), one person, fps, seated, arms all have EN/ES messages. **No light gate exists** (backlight/dim room). The `light` gate is in the contract type but nothing produces it. |
| 5 | Chair stand: 30 s window + last-rise rule | ✔ | `lib/analysis/chair.ts`; tests "counts full stands" and "more than halfway up at 30 s". Synthetic streams only. |
| 6 | TUG clock starts on the Go cue | ✔ with a bias | Time zero is `playCue()`'s return. With browser speech that is the instant `speak()` was called, not when sound starts (see finding 2). |
| 7 | Landmark download reproduces the on-screen result | ✔ (new) | Before today the download was a bare stream with no result. Now it is a session file; tests replay a JSON round trip and get an identical result for TUG and chair. |
| 8 | Results/plan/summary fit a phone, no sideways scroll | **needs you** | Not checked on a device. |
| 9 | Report route + number check exist | ✘ | There is no `app/api`, no Anthropic or Supabase code. README already lists it as TODO. |
| 10 | Every screen has Spanish text | Mostly ✔ | Fixed today: the four "start first / no results" fallbacks and the home disclaimer were English-only. Left alone: the `/pose` developer page and the clinician summary (English by design). Spanish copy still needs a fluent review before Nov 13. |
| 11 | Anonymous results saved (Supabase or local JSON) | Partial | Local JSON download on the results screen (name removed) ✔. New: each finished result is also saved to IndexedDB before the results screen opens. Supabase: not built. |

## Repo-review findings

1. **Which chair counter do the tests exercise: fixed.** `lib/signal/chairStand.ts` (`StandStateMachine`, `countChairStands`) was used only by `/pose` and its own tests. Deleted it and its tests; `/pose` now uses `FeatureExtractor` + `ChairDetector`. I broke the production counter on purpose (count never incremented) and 7 tests failed, including the analysis, outcome, session and golden-checker tests. Caveat: counting sits instead of stands is not caught, because on a clean synthetic stream the two counts are equal.
2. **Real audio cues: not done, needs you.** It needs about ten recorded files (Go, Stop, 3-2-1, EN + ES) and a phone measurement of the cue offset. What I did: session files now record `cue.source` (`mp3` / `speech`), so any TUG timed with browser speech is labelled as having an unmeasured start bias. Not done: Web Audio buffers and the Go-frame clock start (needs the files).
3. **Real golden streams: harness done, streams missing.** `tests/golden/` + `tests/golden.ts` check consent, face removal, annotated truth and drift from the stored result, and the checker is itself tested to fail on each problem. No Nov 8 landmark files exist in the repo, Downloads, Desktop or Documents (I did not search the whole disk). **needs you:** the files, written consent, and the hand-count truth. Until then the golden test shows as `todo`.
4. **Report route: confirmed missing.** Decision date is Nov 12: either the route passes the 20-JSON test, or "AI that cannot invent a number" comes out of the PDF and the pitch. The only references today are the README TODO row and a comment in `lib/report.ts`.
5. **What the 3 m step records: not enough.** `SetupInfo` stores only `lineMethod` and `cameraMeasuredM`; nothing tracks whether the mark is visible during the TUG. I added `markVisible` to the outcome input: `false` caps the result at Total only (tested), `null` (the default, nothing sets it yet) does not block Full. So "a TUG with the mark out of frame cannot return Full" holds in the rules, but the app cannot yet detect that case.

## Smaller items

- Results persistence: ✔ IndexedDB (`lib/store.ts`), safe when storage is blocked. Results only, no streams or names.
- Lint and CI: no lint script exists, so CI (`.github/workflows/ci.yml`) runs typecheck and tests on every push. It has not run on GitHub yet.
- Network address: ✔ moved to `ALLOWED_DEV_ORIGINS` in `.env.local` (your current IP was carried over); `.env.example` documents it.
- Tracked models: `pose_landmarker_lite.task` 5.8 MB and `pose_landmarker_full.task` 9.4 MB. No heavy model in the repo. The app still starts on `full`; the "fall back to lite under 20 fps" step is not built (engine spec, not on today's schedule).
- Commit CLAUDE.md: done (CLAUDE.md only).
- Rules for changes: added to CLAUDE.md.

## Built today (Nov 10 build focus)

- **Gate debounce:** every gate's hysteresis and the all-green hold now come from the config file; Start waits 0.7 s (was 1.5 s) after all gates are green.
- **Three quality outcomes:** typed contract in `lib/contract.ts`; rules in `lib/analysis/results.ts`; Refused shows no number; Total only hides the phase bar; EN/ES labels and refusal messages.
- **Session file:** `lib/sessionFile.ts` (result + face-free stream, config/app version, cue source, age band instead of exact age) with a replay function.
- **PWA shell:** manifest, icons, service worker (production only). Offline precaching of the model/audio is not done (scheduled Nov 13).
- **Config:** every detector constant moved to `lib/signal/thresholds.ts` (`CONFIG_VERSION 2026-11-10.1`). One behaviour change: the TUG hard limit is now 60 s (was 90 s), per MASTER.md.
- **Also:** tab-hidden and Stop now end the run as Refused; face landmarks 0–10 are blanked at record time.

## Gaps and decisions for you

- **Contract has no "timeout" reason.** A TUG that hits the 60 s limit is reported as `not_visible_at_start_or_end`. Adding a reason changes the contract, so it needs your agreement.
- **Chair `refusalReason` is a free string in the contract,** so I reuse the TUG reason codes. Same agreement point.
- **Nov 10 gates still open:** chair-stand count vs your hand count on 10 trials, and 3+ older adults confirmed. Neither can be done from code.
- Not started (scheduled later in MASTER.md): light gate, TUG phase sanity flag, annotation page, report route, design tokens, post-TUG question, language switch in the header, Spanish audio.
