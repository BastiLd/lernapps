import { useEffect, useState } from 'react';
import { loadShapes, type Shape } from '../lib/geo';

let cache: Record<string, Shape> | null = null;

export function useShapes(): Record<string, Shape> | null {
  const [shapes, setShapes] = useState(cache);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    loadShapes().then((s) => {
      cache = s;
      if (alive) setShapes(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return shapes;
}

/** The outline of a country (main landmass and nearby islands), as on the map. */
export default function Silhouette({ iso, className = '', title }: { iso: string; className?: string; title?: string }) {
  const shapes = useShapes();
  const s = shapes?.[iso];
  if (!s) return <span className={`silhouette silhouette--loading ${className}`} aria-hidden={!title} />;
  const pad = 3;
  return (
    <svg className={`silhouette ${className}`} viewBox={`${-pad} ${-pad} ${s.w + pad * 2} ${s.h + pad * 2}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={!title}>
      <path d={s.d} fillRule="evenodd" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
