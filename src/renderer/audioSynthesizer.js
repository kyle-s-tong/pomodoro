let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playBeep(freq, durationSec, peakGain = 0.15, startOffset = 0) {
  try {
    const ctx = getCtx();
    const start = ctx.currentTime + startOffset;
    const end = start + durationSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  } catch (err) {
    console.error('beep failed', err);
  }
}

function playChime() {
  [880, 1320, 990].forEach((freq, i) => playBeep(freq, 0.35, 0.25, i * 0.22));
}

function playTick() {
  playBeep(880, 0.12, 0.18);
}
