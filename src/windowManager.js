const { BrowserWindow, screen } = require('electron');
const path = require('node:path');

function createPopover() {
  const win = new BrowserWindow({
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
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

function positionPopoverNearTray(win, tray) {
  const trayBounds = tray.getBounds();
  const winBounds = win.getBounds();
  const display = screen.getDisplayMatching(trayBounds);
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  const maxX = display.workArea.x + display.workArea.width - winBounds.width - 8;
  const minX = display.workArea.x + 8;
  x = Math.max(minX, Math.min(maxX, x));
  win.setPosition(x, y, false);
}

function togglePopover(win, tray) {
  if (!win) return;
  if (win.isVisible()) {
    win.hide();
  } else {
    positionPopoverNearTray(win, tray);
    win.show();
    win.focus();
  }
}

module.exports = { createPopover, positionPopoverNearTray, togglePopover };
