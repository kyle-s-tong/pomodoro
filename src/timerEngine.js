const { getSettings } = require('./settingsManager');

function phaseDurationMs(phase, s) {
  s = s || getSettings();
  if (phase === 'work') return s.workMin * 60_000;
  if (phase === 'shortBreak') return s.shortBreakMin * 60_000;
  if (phase === 'longBreak') return s.longBreakMin * 60_000;
  return s.workMin * 60_000;
}

function phaseLabel(phase) {
  return { idle: 'Ready', work: 'Work', shortBreak: 'Short break', longBreak: 'Long break' }[phase];
}

const timerState = {
  phase: 'idle',
  remainingMs: getSettings().workMin * 60_000,
  running: false,
  completedWorkSessions: 0,
};

let tickHandle = null;
let lastTickAt = 0;

function nextPhaseAfter(phase) {
  if (phase === 'work') {
    const completed = timerState.completedWorkSessions + 1;
    const isLong = completed % getSettings().sessionsBeforeLongBreak === 0;
    return { phase: isLong ? 'longBreak' : 'shortBreak', completedWorkSessions: completed };
  }
  return { phase: 'work', completedWorkSessions: timerState.completedWorkSessions };
}

function stopTicking() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function startTicking({ onBroadcast, onTick, onPhaseEnd }) {
  if (tickHandle) return;
  lastTickAt = Date.now();
  tickHandle = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTickAt;
    lastTickAt = now;
    const prevSeconds = Math.ceil(timerState.remainingMs / 1000);
    timerState.remainingMs -= delta;
    const newSeconds = Math.ceil(timerState.remainingMs / 1000);
    if (timerState.remainingMs > 0 && newSeconds < prevSeconds && newSeconds >= 1 && newSeconds <= 3) {
      onTick();
    }
    if (timerState.remainingMs <= 0) {
      const endedPhase = timerState.phase;
      const { phase: next, completedWorkSessions } = nextPhaseAfter(endedPhase);
      timerState.completedWorkSessions = completedWorkSessions;
      timerState.phase = next;
      timerState.remainingMs = phaseDurationMs(next);
      onPhaseEnd(endedPhase, next);
      if (endedPhase === 'longBreak') {
        timerState.running = false;
        stopTicking();
      }
    }
    onBroadcast();
  }, 250);
}

module.exports = { timerState, phaseDurationMs, phaseLabel, startTicking, stopTicking };
