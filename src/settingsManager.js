const Store = require('electron-store');

const DEFAULT_SETTINGS = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  sessionsBeforeLongBreak: 4,
};

const store = new Store({ defaults: { settings: DEFAULT_SETTINGS } });

function getSettings() {
  return store.get('settings');
}

function saveSettings(next) {
  const cleaned = {
    workMin: Math.max(1, Math.min(180, Number(next.workMin) || DEFAULT_SETTINGS.workMin)),
    shortBreakMin: Math.max(1, Math.min(60, Number(next.shortBreakMin) || DEFAULT_SETTINGS.shortBreakMin)),
    longBreakMin: Math.max(1, Math.min(120, Number(next.longBreakMin) || DEFAULT_SETTINGS.longBreakMin)),
    sessionsBeforeLongBreak: Math.max(1, Math.min(12, Number(next.sessionsBeforeLongBreak) || DEFAULT_SETTINGS.sessionsBeforeLongBreak)),
  };
  store.set('settings', cleaned);
  return cleaned;
}

module.exports = { getSettings, saveSettings, DEFAULT_SETTINGS };
