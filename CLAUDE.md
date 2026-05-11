# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm install` — install deps (Electron is a dev dep; postinstall downloads the binary).
- `pnpm start` — launch the Electron app (`electron .`). There is no build step, no test suite, no linter.
- `timeout 5 node_modules/.bin/electron . --enable-logging 2>&1 | grep -iE "error|exception"` — headless-ish smoke test. The app has no main window (menu bar tray only), so this is the practical way to surface renderer/main errors from a terminal. Renderer `console.log` and uncaught syntax errors appear under `INFO:CONSOLE`.

## Architecture

macOS menu bar (tray) pomodoro timer. No dock icon (`app.dock.hide()`), no main window — just a `Tray` and a hidden `BrowserWindow` that's positioned beneath the tray icon on click and hides on `blur` (standard menubar UX).

**Authoritative state lives in the main process** (`src/main.js`). The renderer is purely a view + input surface. This is load-bearing:

- The timer state machine (`idle → work → short/longBreak → work …`), the `setInterval` tick loop, phase transitions, and persistence (`electron-store`) are all in main.
- The renderer never owns timer state — it receives `state-update` IPC pushes on every tick (every 250ms while running) and renders them.
- Settings flow: renderer sends `save-settings` → main writes to `electron-store` → main broadcasts a fresh `state-update` → renderer re-fills inputs from `state.settings` (but only when the user hasn't typed since the last save; see the `settingsDirty` flag in `renderer.js`).

**IPC contract** (defined in `src/preload.js` via `contextBridge`, exposed as `window.pomodoro`, aliased to `api` in the renderer):
- Invokes: `getState`, `start`, `pause`, `reset`, `saveSettings`, `quit`.
- Pushes from main: `state-update` (every tick + on every state change), `play-chime` (phase boundary), `play-tick` (last 3 seconds of each phase).

**Phase transition rules** (in `nextPhaseAfter` + the tick handler in `main.js`):
- After each `work`, increment `completedWorkSessions`; if it's a multiple of `sessionsBeforeLongBreak`, the next phase is `longBreak`, otherwise `shortBreak`.
- Transitions auto-continue (keep ticking) **except** after `longBreak` — that one stops and waits for a manual Start. If you change this, preserve the behavior or get explicit user buy-in.

**Audio quirks worth knowing:**
- The chime and the 3-2-1 countdown beep are synthesized in the renderer via Web Audio (no bundled `.wav`). There's a shared `playBeep(freq, durationSec, peakGain, startOffset)` helper in `renderer.js`; the chime is three calls to it.
- The popover is *hidden*, not closed, when blurred — the renderer process and AudioContext stay alive so beeps fire in the background. This depends on two things:
  1. `backgroundThrottling: false` in the popover's `webPreferences`. Removing this will cause Electron to throttle/suspend the renderer when hidden and beeps will stop firing.
  2. `getCtx()` calls `audioCtx.resume()` if suspended. Don't remove this — Web Audio contexts auto-suspend without a recent user gesture, and there's a click-listener seeding call to keep it primed.
- Native OS notifications come from `new Notification(...)` in main, which is independent of the renderer — that's why notifications work even if the audio path is broken. When debugging "sound stopped working", main-process notifications continuing is *not* evidence the renderer is healthy.

**Tray icon** is a 22×22 PNG generated once and embedded as base64 in `main.js` (`TRAY_ICON_BASE64`). It uses `setTemplateImage(false)` so the colored tomato renders as-is (template mode would force monochrome). To regenerate, run a Node script that emits raw RGBA → PNG via `zlib.deflateSync` + manual CRC32 chunks; previous generator invocations are in conversation history if needed.

**contextBridge gotcha** (already fixed, easy to reintroduce): the global exposed by `contextBridge.exposeInMainWorld('pomodoro', ...)` cannot be re-declared at script scope. `const pomodoro = window.pomodoro` and especially `const { pomodoro } = window` will throw `Identifier 'pomodoro' has already been declared` and the entire renderer script aborts at line 1 — every handler silently fails to bind. Use a different local name (`const api = window.pomodoro`).
