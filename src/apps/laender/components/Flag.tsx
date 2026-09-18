import { flagUrl } from '../lib/data';

interface Props {
  iso: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

export default function Flag({ iso, alt, className = '', eager }: Props) {
  return (
    <img
      src={flagUrl(iso)}
      alt={alt}
      width={40}
      height={30}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={`flag ${className}`}
    />
  );
}
