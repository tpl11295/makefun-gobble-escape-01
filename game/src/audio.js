// Every sound is synthesized with the Web Audio API — no audio files, no
// network. The context is created on the first user gesture; before that the
// game simply stays silent, which keeps the screenshot runs quiet too.
//
// Gobble: a low two-note honk. Alarm: a rising sting when the farmer spots
// the turkey. Pickup: a bright two-note chime. Hit: a thud with a feather
// rustle. Win and lose: short jingles. The oven sizzles while the turkey
// stands in its heat.

export function createAudio() {
  return {
    context: null,
    master: null,
    sizzle: null,
    sizzleGain: null,
    enabled: true,
  };
}

/** Create the context (call from a user gesture). */
export function ensureAudio(audio) {
  if (!audio.enabled || audio.context) return;
  try {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    audio.context = new Context();
    audio.master = audio.context.createGain();
    audio.master.gain.value = 0.25;
    audio.master.connect(audio.context.destination);
  } catch {
    audio.enabled = false;
  }
}

function tone(audio, frequency, duration, type, volume, when = 0) {
  if (!audio.context || !audio.master) return;
  try {
    const start = audio.context.currentTime + when;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(audio.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  } catch {
    // A sound failing must never break the game.
  }
}

function noiseBurst(audio, duration, volume, filterFrequency) {
  if (!audio.context || !audio.master) return;
  try {
    const length = Math.floor(audio.context.sampleRate * duration);
    const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
    const source = audio.context.createBufferSource();
    source.buffer = buffer;
    const filter = audio.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFrequency;
    const gain = audio.context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    source.start();
    source.stop(audio.context.currentTime + duration);
  } catch {
    // A sound failing must never break the game.
  }
}

export function playGobble(audio) {
  tone(audio, 320, 0.09, 'square', 0.12);
  tone(audio, 260, 0.12, 'square', 0.12, 0.09);
}

export function playAlarm(audio) {
  tone(audio, 220, 0.12, 'sawtooth', 0.14);
  tone(audio, 330, 0.14, 'sawtooth', 0.14, 0.11);
  tone(audio, 440, 0.18, 'sawtooth', 0.14, 0.22);
}

export function playPickup(audio) {
  tone(audio, 660, 0.1, 'sine', 0.16);
  tone(audio, 990, 0.16, 'sine', 0.16, 0.09);
}

export function playHit(audio) {
  tone(audio, 140, 0.18, 'triangle', 0.2);
  noiseBurst(audio, 0.12, 0.12, 1800);
}

export function playWin(audio) {
  [523, 659, 784, 1047].forEach((frequency, index) => {
    tone(audio, frequency, 0.18, 'sine', 0.16, index * 0.12);
  });
}

export function playLose(audio) {
  [392, 330, 262, 196].forEach((frequency, index) => {
    tone(audio, frequency, 0.22, 'triangle', 0.16, index * 0.14);
  });
}

export function playDash(audio) {
  noiseBurst(audio, 0.1, 0.08, 2400);
}

export function playGateOpen(audio) {
  tone(audio, 523, 0.14, 'sine', 0.14);
  tone(audio, 784, 0.2, 'sine', 0.14, 0.12);
}

/** Start or stop the oven's sizzle while the turkey stands in its heat. */
export function setSizzle(audio, on) {
  if (!audio.context || !audio.master) return;
  try {
    if (on && !audio.sizzle) {
      const length = audio.context.sampleRate;
      const buffer = audio.context.createBuffer(1, length, audio.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
      const source = audio.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = audio.context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3000;
      const gain = audio.context.createGain();
      gain.gain.value = 0.05;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(audio.master);
      source.start();
      audio.sizzle = source;
      audio.sizzleGain = gain;
    } else if (!on && audio.sizzle) {
      audio.sizzle.stop();
      audio.sizzle = null;
      audio.sizzleGain = null;
    }
  } catch {
    // A sound failing must never break the game.
  }
}
