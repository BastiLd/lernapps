import { useCallback, useEffect, useState } from 'react';

export type View = 'explore' | 'cards' | 'quiz' | 'games' | 'stats';
export interface Route {
  view: View;
  iso?: string;
}

const SLUG: Record<View, string> = { explore: 'entdecken', cards: 'karteikarten', quiz: 'quiz', games: 'spiele', stats: 'fortschritt' };

export function parseHash(hash: string): Route {
  const [slug, iso] = hash.replace(/^#\/?/, '').split('/');
  if (slug === SLUG.cards) return { view: 'cards' };
  if (slug === SLUG.quiz) return { view: 'quiz' };
  if (slug === SLUG.stats) return { view: 'stats' };
  if (slug === SLUG.games) return { view: 'games' };
  return { view: 'explore', iso: iso && /^[A-Z]{2}$/.test(iso) ? iso : undefined };
}

export function toHash(r: Route): string {
  return `#/${SLUG[r.view]}${r.view === 'explore' && r.iso ? `/${r.iso}` : ''}`;
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((r: Route) => {
    const hash = toHash(r);
    if (window.location.hash !== hash) window.location.hash = hash;
    else setRoute(r);
  }, []);
  return [route, navigate];
}
