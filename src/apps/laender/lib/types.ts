export type Lang = 'de' | 'es' | 'en';
export type ContinentId = 'europe' | 'asia' | 'africa' | 'north-america' | 'south-america' | 'oceania';
export type CountryStatus = 'un' | 'observer' | 'partial' | 'territory';

export interface Names {
  de: string;
  es: string;
  en: string;
}

export interface Place extends Names {
  lat: number;
  lng: number;
}

export interface Country {
  iso2: string;
  iso3: string;
  status: CountryStatus;
  name: Names;
  aliases: string[];
  capital: Place;
  capitalNote: string | null;
  otherCapitals: (Place & { role: string })[];
  continents: ContinentId[];
  subregion: string;
  languages: { official: string[]; regional: string[]; spoken: string[] };
  languageNote: string | null;
  demonym: { deM: string; deF: string; esM: string; esF: string } | null;
  history: string | null;
  culture: string | null;
  funFact: string | null;
  population: { value: number; year: number } | null;
  currencies: { code: string; de: string; es: string; symbol: string }[];
  phone: string | null;
  tld: string | null;
  /** IANA time zone of the capital, e.g. "Europe/Madrid". */
  timezone: string | null;
  area: number;
  landlocked: boolean;
  borders: string[];
  center: [number, number];
  small: boolean;
}

export type LangMode = 'official' | 'only' | 'spoken';

export type GroupId = '' | 'eu' | 'euro' | 'landlocked' | 'island';

export interface Filters {
  lang: string;
  langMode: LangMode;
  continents: ContinentId[];
  includeSpecial: boolean;
  group: GroupId;
}

export type MapStyle = 'satellite' | 'terrain' | 'streets' | 'blank';

export interface Settings {
  nameLang: Lang;
  showSecondary: boolean;
  mapOpen: boolean;
  mapSide: 'left' | 'right';
  mapMobileSide: 'top' | 'bottom';
  mapMobileSize: 'half' | 'full';
  mapWidth: number;
  mapLabels: boolean;
  mapBorders: boolean;
  mapStyle: MapStyle;
  speech: boolean;
  sound: boolean;
}
