# Lernapps

### ▶ [Jetzt öffnen: bastild.github.io/lernapps](https://bastild.github.io/lernapps/)

Direkt zur Länder-App: [bastild.github.io/lernapps/laender/](https://bastild.github.io/lernapps/laender/) · Spanischsprachige Länder: [bastild.github.io/lernapps/laender/?filter=es](https://bastild.github.io/lernapps/laender/?filter=es#/entdecken)

Kleine Lern-Apps für die Schule – am Handy und am Computer, lokal und online (GitHub Pages), einmal geöffnet auch offline. **Als App installieren:** Seite im Handy-Browser öffnen → Menü → „Zum Startbildschirm hinzufügen“ (am Computer im Chrome/Edge-Adressfeld auf das Installieren-Symbol klicken).

**App 1: Länder der Welt** – alle 198 Länder (193 UN-Mitglieder + Vatikanstadt, Palästina, Kosovo, Taiwan, Puerto Rico) mit Flagge, Umriss, Hauptstadt, Sprachen, Einwohnerbezeichnung (auf Deutsch und Spanisch), Währung, kurzer Geschichte, Kultur und „Wusstest du?“ – dazu eine genaue Satellitenkarte, Karteikarten, ein Quiz, eine Lernliste zum Ausdrucken und eine Fortschritts-Übersicht.

## Funktionen

- **Entdecken:** Liste mit Suche (auch nach Hauptstadt oder spanischem Namen), Sortierung, Detailseite pro Land mit Umriss, Einwohnern (Weltbank 2025), Fläche im Vergleich zu Österreich, Währung, Vorwahl, Nachbarländern (auch auf der Karte markiert), vor/zurück blättern. Klick auf die Karte öffnet das Land. **Schnellsuche** von überall mit `Strg+K` oder `/`.
- **Lernliste (Tabelle):** die gefilterten Länder mit Flagge, Namen DE/ES, Hauptstadt DE/ES, Gentilicio und Amtssprachen – zum **Ausdrucken / als PDF** oder als **CSV für Excel**. Praktisch für Hausübungen.
- **Vorlesen:** spanische Namen, Hauptstädte und Nationalitäten per 🔊 mit der Stimme des Geräts (abschaltbar).
- **Filter:** nach Sprache in drei Stufen – *Amtssprache*, *einzige Amtssprache*, *wird gesprochen* (inkl. regionaler Amtssprachen und weit verbreiteter Sprachen) – plus Kontinent. Schnellauswahl „Spanischsprachig“ (21 Länder, davon 16 mit Spanisch als einziger Amtssprache).
- **Karte:** vier Ansichten – **Satellit**, **Relief**, **Karte** (mit Ortsnamen) und **Stumm** (nur Umrisse wie im Atlas, funktioniert auch offline). Frei zoom- und verschiebbar, Maßstab, Legende. **Genaue Grenzen:** beim Hineinzoomen werden automatisch detailliertere Umrisse nachgeladen (~400 m ab Zoom 5, ~100 m ab Zoom 8) – Küsten und Grenzflüsse passen zum Satellitenbild. Das gewählte Land wird **gelb** umrandet, Nachbarn **gestrichelt**, die Hauptstadt als **roter Pin**, der Filter **türkis**, im Quiz richtig = **grün**, falsch = **rot**. Am Computer links oder rechts, einklappbar, in der Breite ziehbar und maximierbar; am Handy oben oder unten, in zwei Größen.
- **Karteikarten:** Flagge → Land, Land → Flagge, Land → Hauptstadt, Hauptstadt → Land, **Umriss → Land**, Karte → Land, Auf Karte finden, Name auf Spanisch, Nationalität auf Spanisch. „Nochmal“-Karten kommen bald wieder, der Fortschritt wird gespeichert (neu / am Lernen / sicher).
- **Quiz:** dieselben Fragetypen – zum **Auswählen** oder **Eintippen** (kleine Tippfehler und fehlende Akzente zählen als richtig, die korrekte Schreibweise wird gezeigt; Knöpfe für á é í ó ú ñ ü). 10/20/30/alle Fragen oder **Blitzrunde** (60 bzw. 120 Sekunden) mit Rekord. Punkte, Serie, Auswertung und „Fehler üben“.
- **Fortschritt:** Lerntage in Folge, Kalender der letzten Wochen, Trefferquote, Stand pro Fragetyp, die schwierigsten Länder – und die Karte färbt jedes Land nach Lernstand (rot → gelb → grün).
- **Einstellungen:** Namen auf Deutsch / Español / English, Zweitsprache ein/aus, Vorlesen ein/aus, Kartenansicht und -position, Hell/Dunkel, Fortschritt zurücksetzen.
- Tastatur: überall `Strg+K` suchen · Karteikarten `Leertaste` umdrehen, `1` nochmal, `2` gewusst · Quiz `1–4` antworten, `Enter` weiter.
- **Direktlinks:** `laender/?filter=es` öffnet die App gleich mit den spanischsprachigen Ländern (auch `en`, `fr`, `de`, `pt`, `ar`).

## Starten

**Lokal ohne Programmierkenntnisse:** Doppelklick auf `start.bat` (oder im Ordner darüber auf `Lernapps starten.bat`). Beim ersten Mal werden die Pakete installiert; gebaut wird nur, wenn sich seit dem letzten Mal etwas geändert hat, und der Browser öffnet sich auf <http://localhost:4173/lernapps/> (ist der Port belegt, wird automatisch 4174, 4175 … genommen – das Token-Dashboard läuft separat auf 5175).

**Zum Weiterentwickeln:**

```bash
npm install
npm run dev        # Entwicklungsserver mit Live-Reload: http://localhost:5173/
npm run build      # Produktions-Build nach dist/
npm run serve      # dist/ lokal ausliefern: http://localhost:4173/lernapps/
```

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

> **Hinweis OneDrive:** Der Ordner `node_modules` enthält zehntausende Dateien. Liegt das Projekt in OneDrive, synchronisiert OneDrive die alle mit. Wenn das stört: das Projekt in einen Ordner außerhalb von OneDrive legen (z. B. `C:\Projekte\lernapps`) – GitHub ist dann die Sicherung.

## Online stellen (GitHub Pages)

1. Auf GitHub ein Repository anlegen, z. B. `lernapps`, und dieses Projekt hochladen (`git push`).
2. Im Repository unter **Settings → Pages → Build and deployment → Source** „**GitHub Actions**“ wählen.
3. Jeder Push auf `main` baut und veröffentlicht automatisch (`.github/workflows/deploy.yml`). Die Seite ist dann unter `https://<dein-name>.github.io/lernapps/` erreichbar.

Der Pfad wird automatisch aus dem Repository-Namen gesetzt. Heißt das Repository anders, passt sich alles von selbst an.

## Auf dem Handy installieren

Seite im Handy-Browser öffnen → Menü → **„Zum Startbildschirm hinzufügen“**. Danach startet sie wie eine App und funktioniert auch offline (nur die Satellitenbilder brauchen Internet; ohne Internet zeigt die Karte die Umrisse).

## Daten

| Datei | Inhalt | Herkunft |
|---|---|---|
| `data-src/base.json` | Länderliste, Namen, Region, Fläche, Nachbarn, Hauptstadt-Koordinaten, Einwohner | `world-countries` (mledoze, ODbL) + Natural Earth (gemeinfrei), `npm run data:base` |
| `data-src/content/batch-*.json` | Namen DE/ES/EN, Hauptstadt, Sprachen, Einwohnerbezeichnung, Geschichte, Kultur, Wusstest du? | KI-geschrieben und von einem zweiten, unabhängigen Durchgang faktengeprüft |
| `data-src/extra.json` | Einwohnerzahlen (neuester Stand) | Weltbank (CC BY 4.0), `npm run data:extra` (braucht Internet) |
| `src/apps/laender/data/borders.json` | Ländergrenzen für die Weltansicht (~3 km genau) | geoBoundaries CGAZ (CC BY 4.0), `npm run data:borders` |
| `public/geo/mid/`, `public/geo/hi/`, `data/detail-index.json` | Genaue Grenzen (~400 m / ~100 m), pro Land und Region eine Datei – werden erst beim Hineinzoomen geladen | wie oben |
| `src/apps/laender/data/shapes.json` | Länder-Umrisse (Silhouetten) für Detailseite und „Umriss → Land“ | wie oben |
| `src/apps/laender/data/countries.json`, `languages.json`, `flags/` | Das, was die App lädt | erzeugt mit `npm run data` |

**Einen Fehler korrigieren:** den Eintrag in `data-src/content/batch-XX.json` ändern, dann

```bash
npm run data:check   # prüft Format, Pflichtfelder, Sprachcodes, Satzlängen
npm run data         # baut countries.json neu
```

**Grenzen neu erzeugen:** `npm run data:borders` lädt beim ersten Mal den geoBoundaries-Datensatz (~100 MB) in den Temp-Ordner des Computers (nicht nach OneDrive/Git) und baut daraus alle Grenzdateien (~1 Minute). Die Grenzziehung folgt geoBoundaries CGAZ (z. B. Krim = Ukraine, Golanhöhen = Syrien, Westsahara und einige umstrittene Gebiete neutral ohne Land).

Sprachen-Regeln: `official` = landesweite Amtssprache (oder eindeutige De-facto-Landessprache), `regional` = nur in Regionen amtlich bzw. offiziell anerkannt, `spoken` = nicht amtlich, aber weit verbreitet. Stand der Inhalte: September 2026 (z. B. Äquatorialguinea: Hauptstadt seit Jänner 2026 Ciudad de la Paz).

## Eine neue Lern-App hinzufügen

1. Ordner `src/apps/<name>/` mit `main.tsx` anlegen (Vorlage: `src/apps/laender/main.tsx`) und `<name>/index.html` (Vorlage: `laender/index.html`).
2. In `vite.config.ts` unter `rolldownOptions.input` eintragen.
3. In `src/shared/apps.ts` eine Kachel für die Startseite ergänzen.

Gemeinsam nutzbar: Design (`src/shared/styles/base.css`), Hell/Dunkel (`theme.ts`), Speichern im Browser (`storage.ts`), Offline-Unterstützung (`pwa.ts`).

## Quellen & Lizenzen

Satellitenbilder und Karten © Esri, Maxar, Earthstar Geographics, USGS, NOAA, HERE, Garmin, OpenStreetMap · Grenzen: [geoBoundaries](https://www.geoboundaries.org) (Runfola et al. 2020, CC BY 4.0) · Hauptstädte: Natural Earth (gemeinfrei) · Einwohner: [Weltbank](https://data.worldbank.org) (CC BY 4.0) · Flaggen: [flag-icons](https://github.com/lipis/flag-icons) (MIT) · Länderdaten: [world-countries](https://github.com/mledoze/countries) (ODbL) · Karte: [Leaflet](https://leafletjs.com) · Schriften: Plus Jakarta Sans, Bricolage Grotesque (OFL).
