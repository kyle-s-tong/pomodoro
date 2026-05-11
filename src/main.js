const { app, BrowserWindow, Tray, nativeImage, ipcMain, Notification, screen } = require('electron');
const path = require('node:path');
const Store = require('electron-store');

const TRAY_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAARElEQVR4nO3MwQkAMAhDUfdf2k4gJmrAln7IJYdn9mIOfhSITIJSOItCeBVNcQncRUP8wxfDE3iYDO7gUBKUxcuNgzs78Kz7BdVxgA4AAAAASUVORK5CYII=';

const DEFAULT_SETTINGS = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  sessionsBeforeLongBreak: 4,
};

const store = new Store({ defaults: { settings: DEFAULT_SETTINGS } });

let tray = null;
let popover = null;

const state = {
  phase: 'idle', // 'idle' | 'work' | 'shortBreak' | 'longBreak'
  remainingMs: store.get('settings').workMin * 60_000,
  running: false,
  completedWorkSessions: 0,
};

let tickHandle = null;
let lastTickAt = 0;

function settings() {
  return store.get('settings');
}

function phaseDurationMs(phase, s = settings()) {
  if (phase === 'work') return s.workMin * 60_000;
  if (phase === 'shortBreak') return s.shortBreakMin * 60_000;
  if (phase === 'longBreak') return s.longBreakMin * 60_000;
  return s.workMin * 60_000;
}

function phaseLabel(phase) {
  return { idle: 'Ready', work: 'Work', shortBreak: 'Short break', longBreak: 'Long break' }[phase];
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateTrayTitle() {
  if (!tray) return;
  if (state.phase === 'idle') {
    tray.setTitle('');
    return;
  }
  const glyph = state.phase === 'work' ? '🍅' : '☕';
  tray.setTitle(` ${glyph} ${formatTime(state.remainingMs)}`);
}

function broadcastState() {
  updateTrayTitle();
  if (popover && !popover.isDestroyed()) {
    popover.webContents.send('state-update', { ...state, settings: settings() });
  }
}

function nextPhaseAfter(phase) {
  if (phase === 'work') {
    const completed = state.completedWorkSessions + 1;
    const isLong = completed % settings().sessionsBeforeLongBreak === 0;
    return { phase: isLong ? 'longBreak' : 'shortBreak', completedWorkSessions: completed };
  }
  return { phase: 'work', completedWorkSessions: state.completedWorkSessions };
}

function notifyPhaseEnd(endedPhase, nextPhase) {
  const titles = {
    work: 'Work session done',
    shortBreak: 'Short break done',
    longBreak: 'Long break done',
  };
  const bodies = {
    work: `Time for a ${nextPhase === 'longBreak' ? 'long' : 'short'} break.`,
    shortBreak: 'Back to work.',
    longBreak: 'Back to work.',
  };
  try {
    new Notification({ title: titles[endedPhase], body: bodies[endedPhase] }).show();
  } catch {}
  if (popover && !popover.isDestroyed()) {
    popover.webContents.send('play-chime');
  }
}

function startTicking() {
  if (tickHandle) return;
  lastTickAt = Date.now();
  tickHandle = setInterval(() => {
    const now = Date.now();
    const delta = now - lastTickAt;
    lastTickAt = now;
    state.remainingMs -= delta;
    if (state.remainingMs <= 0) {
      const endedPhase = state.phase;
      const { phase: next, completedWorkSessions } = nextPhaseAfter(endedPhase);
      state.completedWorkSessions = completedWorkSessions;
      state.phase = next;
      state.remainingMs = phaseDurationMs(next);
      state.running = false;
      stopTicking();
      notifyPhaseEnd(endedPhase, next);
    }
    broadcastState();
  }, 250);
}

function stopTicking() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

function startTimer() {
  if (state.phase === 'idle') {
    state.phase = 'work';
    state.remainingMs = phaseDurationMs('work');
  }
  state.running = true;
  startTicking();
  broadcastState();
}

function pauseTimer() {
  state.running = false;
  stopTicking();
  broadcastState();
}

function resetTimer() {
  state.running = false;
  stopTicking();
  state.phase = 'idle';
  state.completedWorkSessions = 0;
  state.remainingMs = phaseDurationMs('work');
  broadcastState();
}

function saveSettings(next) {
  const cleaned = {
    workMin: Math.max(1, Math.min(180, Number(next.workMin) || DEFAULT_SETTINGS.workMin)),
    shortBreakMin: Math.max(1, Math.min(60, Number(next.shortBreakMin) || DEFAULT_SETTINGS.shortBreakMin)),
    longBreakMin: Math.max(1, Math.min(120, Number(next.longBreakMin) || DEFAULT_SETTINGS.longBreakMin)),
    sessionsBeforeLongBreak: Math.max(1, Math.min(12, Number(next.sessionsBeforeLongBreak) || DEFAULT_SETTINGS.sessionsBeforeLongBreak)),
  };
  store.set('settings', cleaned);
  if (state.phase === 'idle') {
    state.remainingMs = phaseDurationMs('work', cleaned);
  }
  broadcastState();
}

function createPopover() {
  popover = new BrowserWindow({
    width: 320,
    height: 460,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  popover.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  popover.on('blur', () => {
    if (popover && !popover.isDestroyed()) popover.hide();
  });
}

function positionPopoverNearTray() {
  if (!tray || !popover) return;
  const trayBounds = tray.getBounds();
  const winBounds = popover.getBounds();
  const display = screen.getDisplayMatching(trayBounds);
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  const maxX = display.workArea.x + display.workArea.width - winBounds.width - 8;
  const minX = display.workArea.x + 8;
  x = Math.max(minX, Math.min(maxX, x));
  popover.setPosition(x, y, false);
}

function togglePopover() {
  if (!popover) return;
  if (popover.isVisible()) {
    popover.hide();
  } else {
    positionPopoverNearTray();
    popover.show();
    popover.focus();
  }
}

function createTray() {
  const icon = nativeImage.createFromBuffer(Buffer.from(TRAY_ICON_BASE64, 'base64'));
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Pomodoro');
  tray.on('click', togglePopover);
  tray.on('right-click', togglePopover);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createPopover();
  createTray();
  broadcastState();
});

app.on('window-all-closed', (e) => {
  // Keep app alive in the tray.
  e.preventDefault?.();
});

ipcMain.handle('get-state', () => ({ ...state, settings: settings() }));
ipcMain.handle('start', () => { startTimer(); });
ipcMain.handle('pause', () => { pauseTimer(); });
ipcMain.handle('reset', () => { resetTimer(); });
ipcMain.handle('save-settings', (_e, next) => { saveSettings(next); });
ipcMain.handle('quit', () => { app.quit(); });
