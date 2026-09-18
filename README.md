# Lernapps

Kleine Lern-Apps für die Schule – am Handy und am Computer, lokal und online (GitHub Pages), einmal geöffnet auch offline.

**App 1: Länder der Welt** – alle 198 Länder (193 UN-Mitglieder + Vatikanstadt, Palästina, Kosovo, Taiwan, Puerto Rico) mit Flagge, Hauptstadt, Sprachen, Einwohnerbezeichnung (auf Deutsch und Spanisch), kurzer Geschichte, Kultur und „Wusstest du?“ – dazu eine Satellitenkarte, Karteikarten und ein Quiz.

## Funktionen

- **Entdecken:** Liste mit Suche (auch nach Hauptstadt oder spanischem Namen), Sortierung, Detailseite pro Land, Nachbarländer anklickbar, vor/zurück blättern. Klick auf die Karte öffnet das Land.
- **Filter:** nach Sprache in drei Stufen – *Amtssprache*, *einzige Amtssprache*, *wird gesprochen* (inkl. regionaler Amtssprachen und weit verbreiteter Sprachen) – plus Kontinent. Schnellauswahl „Spanischsprachig“ (21 Länder, davon 16 mit Spanisch als einziger Amtssprache).
- **Karte:** Satellitenbild (Esri), frei zoom- und verschiebbar, Ländergrenzen, optional Ortsnamen. Das gewählte Land wird **gelb** umrandet, die Hauptstadt als **roter Pin** markiert, der Filter **türkis** eingefärbt, im Quiz richtig = **grün**, falsch = **rot**. Am Computer links oder rechts, einklappbar und in der Breite ziehbar; am Handy oben oder unten, in zwei Größen.
- **Karteikarten:** Flagge → Land, Land → Flagge, Land → Hauptstadt, Hauptstadt → Land, Karte → Land, Auf Karte finden, Name auf Spanisch, Nationalität auf Spanisch. „Nochmal“-Karten kommen bald wieder, der Fortschritt wird gespeichert (neu / am Lernen / sicher).
- **Quiz:** dieselben Fragetypen als Multiple Choice bzw. Klick auf die Karte, Punkte, Serie, Auswertung und „Fehler üben“.
- **Einstellungen:** Namen auf Deutsch / Español / English, Zweitsprache ein/aus, Kartenposition, Hell/Dunkel, Fortschritt zurücksetzen.
- Tastatur: Karteikarten `Leertaste` umdrehen, `1` nochmal, `2` gewusst · Quiz `1–4` antworten, `Enter` weiter.

## Starten

**Lokal ohne Programmierkenntnisse:** Doppelklick auf `Start-Lokal.bat`. Beim ersten Mal werden die Pakete installiert und die App gebaut, dann öffnet sich der Browser auf <http://localhost:4173/lernapps/>.

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
| `src/apps/laender/data/borders.json` | Ländergrenzen (TopoJSON, vereinfacht) | Natural Earth 1:10m über `world-atlas`, `npm run data:borders` |
| `src/apps/laender/data/countries.json`, `languages.json`, `flags/` | Das, was die App lädt | erzeugt mit `npm run data` |

**Einen Fehler korrigieren:** den Eintrag in `data-src/content/batch-XX.json` ändern, dann

```bash
npm run data:check   # prüft Format, Pflichtfelder, Sprachcodes, Satzlängen
npm run data         # baut countries.json neu
```

Sprachen-Regeln: `official` = landesweite Amtssprache (oder eindeutige De-facto-Landessprache), `regional` = nur in Regionen amtlich bzw. offiziell anerkannt, `spoken` = nicht amtlich, aber weit verbreitet. Stand der Inhalte: September 2026 (z. B. Äquatorialguinea: Hauptstadt seit Jänner 2026 Ciudad de la Paz).

## Eine neue Lern-App hinzufügen

1. Ordner `src/apps/<name>/` mit `main.tsx` anlegen (Vorlage: `src/apps/laender/main.tsx`) und `<name>/index.html` (Vorlage: `laender/index.html`).
2. In `vite.config.ts` unter `rolldownOptions.input` eintragen.
3. In `src/shared/apps.ts` eine Kachel für die Startseite ergänzen.

Gemeinsam nutzbar: Design (`src/shared/styles/base.css`), Hell/Dunkel (`theme.ts`), Speichern im Browser (`storage.ts`), Offline-Unterstützung (`pwa.ts`).

## Quellen & Lizenzen

Satellitenbilder © Esri, Maxar, Earthstar Geographics · Grenzen und Hauptstädte: Natural Earth (gemeinfrei) · Flaggen: [flag-icons](https://github.com/lipis/flag-icons) (MIT) · Länderdaten: [world-countries](https://github.com/mledoze/countries) (ODbL) · Karte: [Leaflet](https://leafletjs.com) · Schrift: Plus Jakarta Sans (OFL).
