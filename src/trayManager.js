const { Tray, nativeImage } = require('electron');
const { formatTime } = require('./utils');

function createTray(iconBase64, onClick) {
  const icon = nativeImage.createFromBuffer(Buffer.from(iconBase64, 'base64'));
  icon.setTemplateImage(false);
  const tray = new Tray(icon);
  tray.setToolTip('Pomodoro');
  tray.on('click', onClick);
  tray.on('right-click', onClick);
  return tray;
}

function updateTrayTitle(tray, phase, remainingMs) {
  if (!tray) return;
  if (phase === 'idle') {
    tray.setTitle('');
    return;
  }
  const glyph = phase === 'work' ? '🍅' : '☕';
  tray.setTitle(` ${glyph} ${formatTime(remainingMs)}`);
}

module.exports = { createTray, updateTrayTitle };
