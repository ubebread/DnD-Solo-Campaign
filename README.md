# Ashen Way — Solo DnD Campaign

A single-player *Dungeons & Dragons* campaign for desktop and mobile. The app is the table: an AI-style Dungeon Master builds a homebrew world from your answers, runs NPCs and monsters, tracks the environment, and answers whatever you type.

Live source: this repository. Open `index.html` locally or enable **GitHub Pages** (Settings → Pages → Deploy from branch `main` / root).

## What you can do

- Shape the setting with five worldwright questions (tone, doom, land, magic, what your hero will not surrender).
- Create a hero from **Human, Elf, Dwarf, Dragonborn, Tiefling**, or a **custom lineage**.
- Pick a class. Strength, Dexterity, Charisma, Intelligence, and Health are calculated from race + class and change as you level.
- Play a save-the-world arc in episodes: town → road → reliquary → city/wilds → enemy threshold → the heart of the doom.
- Type any action or tap a suggested move. The DM interprets intent, calls for rolls, and keeps state.
- Fight with attack rolls, class damage, racial tricks (dragonborn breath, and so on), loot, and XP.
- Use the built-in dice (d4–d100, advantage, ability checks).
- Continue later — the campaign is stored in the browser.

## How to run

No build step.

```bash
# from the repo root
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080). A phone on the same network can use your machine’s LAN address.

You can also just open `index.html` in a browser. Service worker caching works best over `http://localhost` or HTTPS.

## Project layout

```
index.html
styles.css
manifest.json      PWA install
sw.js
js/data.js         races, classes, world tables, locations, monsters
js/dice.js         roller and check math
js/engine.js       worldwright, action parser, combat, save/load
js/ui.js           screens
```

## Design notes

The Dungeon Master in this version is a **rules-and-narrative engine** that lives entirely on the client: it generates the homebrew frame from your answers, tracks quest acts, parses free-text actions into checks and combat, and writes scene text from the current place, threat, and character. No API key is required, so the table works offline after the first load.

A later hook can swap scene prose for a hosted LLM while leaving dice, sheets, and world state in this engine.

## License

Fan work. *Dungeons & Dragons* is a trademark of Wizards of the Coast. This project is unofficial.
