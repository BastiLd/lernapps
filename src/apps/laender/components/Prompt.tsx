import { MapPinned, MousePointerClick } from 'lucide-react';
import { answerText, genderOf, isSpanishType, type QType } from '../lib/questions';
import type { Country, Lang } from '../lib/types';
import Flag from './Flag';
import Silhouette from './Silhouette';
import SpeakButton from './Speak';

export function questionText(type: QType, c: Country, lang: Lang): string {
  switch (type) {
    case 'flag':
      return 'Zu welchem Land gehört diese Flagge?';
    case 'flag-rev':
      return `Welche Flagge gehört zu ${c.name[lang]}?`;
    case 'capital':
      return `Wie heißt die Hauptstadt von ${c.name[lang]}?`;
    case 'capital-rev':
      return `${c.capital[lang]} ist die Hauptstadt von …`;
    case 'shape':
      return 'Welches Land hat diesen Umriss?';
    case 'map':
      return 'Welches Land ist auf der Karte markiert?';
    case 'click':
      return `Wo liegt ${c.name[lang]}?`;
    case 'name-es':
      return `Wie heißt ${c.name.de} auf Spanisch?`;
    case 'demonym-es':
      return `Wie heißen die Einwohner von ${c.name.de} auf Spanisch?`;
    case 'sentence-es':
      return `Stell dich auf Spanisch vor: Du bist ${genderOf(c) === 'f' ? 'eine Frau' : 'ein Mann'} aus diesem Land.`;
  }
}

/** The visual part of a question (front of a flashcard / top of a quiz question). */
export function PromptVisual({ type, c, lang }: { type: QType; c: Country; lang: Lang }) {
  switch (type) {
    case 'flag':
      return <Flag iso={c.iso2} alt="Flagge – zu welchem Land gehört sie?" className="prompt-flag" eager />;
    case 'shape':
      return <Silhouette iso={c.iso2} className="prompt-shape" title="Umriss eines Landes" />;
    case 'map':
      return (
        <div className="prompt-hint">
          <MapPinned size={34} />
          <span>Schau auf die Karte – das gesuchte Land ist gelb markiert.</span>
        </div>
      );
    case 'click':
      return (
        <div className="prompt-hint">
          <MousePointerClick size={34} />
          <span className="prompt-big">{c.name[lang]}</span>
        </div>
      );
    case 'capital-rev':
      return <span className="prompt-big">{c.capital[lang]}</span>;
    case 'sentence-es':
      return (
        <div className="flex flex-col items-center gap-3">
          <Flag iso={c.iso2} alt="" className="prompt-flag-small" eager />
          <span className="prompt-big">{c.name.de}</span>
          <span className={`gender-badge gender-${genderOf(c)}`}>{genderOf(c) === 'f' ? '♀ weiblich' : '♂ männlich'}</span>
        </div>
      );
    case 'name-es':
    case 'demonym-es':
      return (
        <div className="flex flex-col items-center gap-3">
          <Flag iso={c.iso2} alt="" className="prompt-flag-small" eager />
          <span className="prompt-big">{c.name.de}</span>
        </div>
      );
    default:
      return <span className="prompt-big">{c.name[lang]}</span>;
  }
}

/** The answer side of a flashcard. */
export function AnswerVisual({ type, c, lang }: { type: QType; c: Country; lang: Lang }) {
  if (type === 'flag-rev') {
    return (
      <div className="flex flex-col items-center gap-3">
        <Flag iso={c.iso2} alt={`Flagge von ${c.name.de}`} className="prompt-flag" eager />
        <span className="text-lg font-bold">{c.name[lang]}</span>
      </div>
    );
  }
  const main = answerText(type, c, lang);
  const spanish = isSpanishType(type) || lang === 'es';
  const extra =
    type === 'capital'
      ? c.name[lang]
      : type === 'name-es'
        ? `Hauptstadt: ${c.capital.es}`
        : type === 'sentence-es' && c.demonym
          ? `Deutsch: Ich komme aus diesem Land. Ich bin ${genderOf(c) === 'f' ? c.demonym.deF : c.demonym.deM}.`
          : type === 'demonym-es' && c.demonym
          ? `Deutsch: ${c.demonym.deM} / ${c.demonym.deF}`
          : `Hauptstadt: ${c.capital[lang]}`;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {type === 'shape' ? <Silhouette iso={c.iso2} className="answer-shape" /> : type !== 'flag' && <Flag iso={c.iso2} alt="" className="prompt-flag-small" eager />}
      <span className="inline-flex items-center gap-2">
        <span className={`prompt-big ${type === 'sentence-es' ? 'prompt-sentence' : ''}`} lang={spanish ? 'es' : undefined}>
          {main}
        </span>
        {spanish && <SpeakButton text={type === 'demonym-es' && c.demonym ? `${c.demonym.esM}, ${c.demonym.esF}` : main} lang="es" />}
      </span>
      <span className="font-semibold text-muted">{extra}</span>
      {type === 'capital' && c.capitalNote && <span className="max-w-md text-sm text-muted">{c.capitalNote}</span>}
    </div>
  );
}
