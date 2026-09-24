// Small rewards: short tones (Web Audio, no sound files) and a burst of confetti.
let audio: AudioContext | null = null;

const TONES = {
  ok: [
    [660, 0],
    [990, 0.09],
  ],
  bad: [
    [220, 0],
    [180, 0.12],
  ],
  win: [
    [523, 0],
    [659, 0.1],
    [784, 0.2],
    [1047, 0.3],
  ],
} as const;

export type Tone = keyof typeof TONES;

export function playTone(kind: Tone) {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const now = audio.currentTime;
    for (const [freq, at] of TONES[kind]) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = kind === 'bad' ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.12, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.22);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.25);
    }
  } catch {
    // No audio available – nothing to do.
  }
}

const COLORS = ['#0f766e', '#2dd4bf', '#fcc419', '#e8590c', '#fa5252', '#40c057', '#7950f2'];

/** A short burst of confetti over the whole page (skipped when the user prefers less motion). */
export function confetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.remove();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
  };
  resize();
  const W = () => canvas.width;
  const H = () => canvas.height;
  const parts = Array.from({ length: 160 }, () => ({
    x: W() / 2 + (Math.random() - 0.5) * W() * 0.3,
    y: H() * 0.35,
    vx: (Math.random() - 0.5) * 18 * dpr,
    vy: (-Math.random() * 16 - 6) * dpr,
    r: (Math.random() * 5 + 4) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
  const start = performance.now();
  const frame = (t: number) => {
    const age = t - start;
    ctx.clearRect(0, 0, W(), H());
    for (const p of parts) {
      p.vy += 0.45 * dpr;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - age / 2600);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      ctx.restore();
    }
    if (age < 2600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
