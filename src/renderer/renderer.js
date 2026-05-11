const api = window.pomodoro;

const $ = (id) => document.getElementById(id);
const phaseEl = $('phase');
const timeEl = $('time');
const counterEl = $('counter');
const toggleBtn = $('toggle');
const resetBtn = $('reset');
const quitBtn = $('quit');
const form = $('settings');
const inputs = {
  workMin: $('workMin'),
  shortBreakMin: $('shortBreakMin'),
  longBreakMin: $('longBreakMin'),
  sessionsBeforeLongBreak: $('sessionsBeforeLongBreak'),
};

const phaseLabels = {
  idle: 'Ready',
  work: 'Work',
  shortBreak: 'Short break',
  longBreak: 'Long break',
};

let settingsDirty = false;
Object.values(inputs).forEach((el) =>
  el.addEventListener('input', () => { settingsDirty = true; }),
);

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function render(state) {
  phaseEl.textContent = phaseLabels[state.phase] ?? state.phase;
  timeEl.textContent = formatTime(state.remainingMs);
  const n = state.completedWorkSessions;
  counterEl.textContent = `${n} session${n === 1 ? '' : 's'} completed`;
  toggleBtn.textContent = state.running ? 'Pause' : 'Start';
  toggleBtn.dataset.running = state.running ? '1' : '0';
  if (!settingsDirty && state.settings) {
    inputs.workMin.value = state.settings.workMin;
    inputs.shortBreakMin.value = state.settings.shortBreakMin;
    inputs.longBreakMin.value = state.settings.longBreakMin;
    inputs.sessionsBeforeLongBreak.value = state.settings.sessionsBeforeLongBreak;
  }
}

toggleBtn.addEventListener('click', () => {
  if (toggleBtn.dataset.running === '1') api.pause();
  else api.start();
});
resetBtn.addEventListener('click', () => api.reset());
quitBtn.addEventListener('click', () => api.quit());

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await api.saveSettings({
    workMin: inputs.workMin.value,
    shortBreakMin: inputs.shortBreakMin.value,
    longBreakMin: inputs.longBreakMin.value,
    sessionsBeforeLongBreak: inputs.sessionsBeforeLongBreak.value,
  });
  settingsDirty = false;
});

api.onState(render);
api.getState().then(render);

let audioCtx = null;
api.onChime(() => {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = audioCtx;
    const now = ctx.currentTime;
    const tones = [880, 1320, 990];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + i * 0.22;
      const end = start + 0.35;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    });
  } catch (err) {
    console.error('chime failed', err);
  }
});
