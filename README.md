# Ashen Way — Solo DnD Campaign

A single-player *Dungeons & Dragons* campaign for desktop and mobile. The app is the table: a Dungeon Master builds a homebrew world from your answers, runs NPCs and monsters, tracks the environment, and answers whatever you type.

Open `index.html` locally or enable **GitHub Pages** (Settings → Pages → Deploy from branch `main` / root).

## What you can do

- Shape the setting with five worldwright questions (tone, doom, land, magic, what your hero will not surrender).
- Create a hero from **Human, Elf, Dwarf, Dragonborn, Tiefling**, or a **custom lineage**.
- Use a proper **5e six-ability array**: Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma.
  - Standard array, 27-point buy, or 4d6 drop lowest
  - Racial bonuses apply after the base scores
  - Hit points = class hit die + Constitution modifier
- Keep **multiple named save slots**. Play, rename, or delete them from the home table.
- Optionally plug in an **LLM narrator** (OpenAI, xAI Grok, OpenRouter, Anthropic, or any OpenAI-compatible endpoint). Dice, combat, HP, and quest flags stay in the local engine; the model only writes the scene.
- Play a save-the-world arc: town → road → reliquary → city/wilds → enemy threshold → the heart of the doom.
- Built-in dice (d4–d100, advantage, all six ability checks).

## How to run

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

## Optional LLM Dungeon Master

1. Home screen → **Dungeon Master settings**.
2. Choose a provider, model, and paste an API key.
3. Tick **Use the LLM for narration** and **Test connection**.

Keys live only in this browser's localStorage. If a host blocks browser calls (CORS), point the endpoint at a local OpenAI-compatible proxy. If a call fails mid-game, the built-in DM narrates instead.

## Project layout

```
index.html
styles.css
js/data.js         races, classes, world tables, 5e arrays
js/dice.js         roller and check math
js/engine.js       worldwright, action parser, combat, multi-slot saves
js/llm.js          optional hosted narrator
js/ui.js           screens
```

## License

Fan work. *Dungeons & Dragons* is a trademark of Wizards of the Coast. This project is unofficial.
