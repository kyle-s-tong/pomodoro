const { app, ipcMain, Notification } = require('electron');
const { getSettings, saveSettings } = require('./settingsManager');
const { timerState, phaseDurationMs, startTicking, stopTicking } = require('./timerEngine');
const { createPopover, togglePopover } = require('./windowManager');
const { createTray, updateTrayTitle } = require('./trayManager');

const TRAY_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABaElEQVR4nN2T7U7CMBSGuR5FGSAM5vxEUdEYLsfL8dIEFfxCyDAo0eTQpxuzWXTUBf7YpDk7p9uzt29Pc7l/PfzrpqwEmIxLASfnUqBJuFnPPEaNLRkdqali+6okrwcledkvytOukw0MLDiuyLj5PQFTHx6WY3jfL9j/gI/HCvp2UpXJqSuTM1dHcuqso/x5ryiPOwXpbW/awYMI+q6AH62aTM/rOpJTZ33YKMtgrtoGjJdsG4XAPi88+br0dCSnzjrvDZTquR339Y10uLYBsFKHUqDS9nUkp67BsR2OPAD2FoFXoRjP8C6Lx3cK3HHXf4ezvSxdcVvLp1tBf9KnP/VxEEGTfYy/XXcBmJf5CEVs17x55ObN49B6Xqi2U02xwYSzTTzkgIARyanH0Mjbbpq35mB7eAcg/IkTP1PvR0pDaF5uKmv21xo1nDYQ1BHJqeMp20fpn6DmoD8BEVEYAi09tR2pfZoYM5js70xg7xTrAAAAAElFTkSuQmCC';

let tray = null;
let popover = null;

function broadcastState() {
  updateTrayTitle(tray, timerState.phase, timerState.remainingMs);
  if (popover && !popover.isDestroyed()) {
    popover.webContents.send('state-update', { ...timerState, settings: getSettings() });
  }
}

function notifyPhaseEnd(endedPhase, nextPhase) {
  const titles = { work: 'Work session done', shortBreak: 'Short break done', longBreak: 'Long break done' };
  const bodies = {
    work: `Time for a ${nextPhase === 'longBreak' ? 'long' : 'short'} break.`,
    shortBreak: 'Back to work.',
    longBreak: 'Back to work.',
  };
  try { new Notification({ title: titles[endedPhase], body: bodies[endedPhase] }).show(); } catch {}
  if (popover && !popover.isDestroyed()) popover.webContents.send('play-chime');
}

const tickCallbacks = {
  onBroadcast: broadcastState,
  onTick: () => { if (popover && !popover.isDestroyed()) popover.webContents.send('play-tick'); },
  onPhaseEnd: notifyPhaseEnd,
};

function startTimer() {
  if (timerState.phase === 'idle') {
    timerState.phase = 'work';
    timerState.remainingMs = phaseDurationMs('work');
  }
  timerState.running = true;
  startTicking(tickCallbacks);
  broadcastState();
}

function pauseTimer() {
  timerState.running = false;
  stopTicking();
  broadcastState();
}

function resetTimer() {
  timerState.running = false;
  stopTicking();
  timerState.phase = 'idle';
  timerState.completedWorkSessions = 0;
  timerState.remainingMs = phaseDurationMs('work');
  broadcastState();
}

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  popover = createPopover();
  popover.on('blur', () => { if (popover && !popover.isDestroyed()) popover.hide(); });
  tray = createTray(TRAY_ICON_BASE64, () => togglePopover(popover, tray));
  broadcastState();
});

app.on('window-all-closed', (e) => {
  e.preventDefault?.();
});

ipcMain.handle('get-state', () => ({ ...timerState, settings: getSettings() }));
ipcMain.handle('start', () => { startTimer(); });
ipcMain.handle('pause', () => { pauseTimer(); });
ipcMain.handle('reset', () => { resetTimer(); });
ipcMain.handle('save-settings', (_e, next) => {
  const cleaned = saveSettings(next);
  if (timerState.phase === 'idle') timerState.remainingMs = phaseDurationMs('work', cleaned);
  broadcastState();
});
ipcMain.handle('quit', () => { app.quit(); });
