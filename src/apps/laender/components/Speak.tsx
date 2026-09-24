import { Volume2 } from 'lucide-react';
import { useApp } from '../state';

const LOCALES = { es: ['es-ES', 'es-MX', 'es'], de: ['de-AT', 'de-DE', 'de'], en: ['en-GB', 'en-US', 'en'] } as const;
export type SpeakLang = keyof typeof LOCALES;

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

function voiceFor(lang: SpeakLang): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  for (const loc of LOCALES[lang]) {
    const v = voices.find((x) => x.lang.replace('_', '-').toLowerCase().startsWith(loc.toLowerCase()));
    if (v) return v;
  }
  return undefined;
}

/** Reads a word aloud with the device's built-in voices (works offline on most phones and computers). */
export function speak(text: string, lang: SpeakLang) {
  if (!canSpeak || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = LOCALES[lang][0];
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = lang === 'es' ? 0.88 : 0.95;
  synth.speak(u);
}

// Some browsers load their voice list only after it was asked for once.
if (canSpeak) window.speechSynthesis.getVoices();

export default function SpeakButton({ text, lang, label, className = '' }: { text: string; lang: SpeakLang; label?: string; className?: string }) {
  const { settings } = useApp();
  if (!canSpeak || !settings.speech || !text) return null;
  const name = label ?? `„${text}“ vorlesen`;
  return (
    <button
      type="button"
      className={`speak-btn ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        speak(text, lang);
      }}
      aria-label={name}
      title={name}
    >
      <Volume2 size={15} />
    </button>
  );
}
