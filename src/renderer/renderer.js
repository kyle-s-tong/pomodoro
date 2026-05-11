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

document.addEventListener('click', () => { getCtx(); }, { once: false });

api.onChime(playChime);
api.onTick(playTick);
