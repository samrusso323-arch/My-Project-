# Speed Map Builder

A local racing "Speed Map" board — three columns (Backmarkers / Midfield /
Leaders) showing an SVG horse-and-jockey silhouette per runner, coloured to
the horse and wearing the horse's registered silks (photo or pattern).

This started as a single-file HTML prototype and has been restructured into
a small local app: a Flask + SQLite server, a persistent silk-image library
on disk, bulk silk import, and a horse/race database so a horse's silks only
need to be entered once and are reused automatically in future races.

> The board's visual design (racing-poster look, gold/green theme, three
> columns) was carried over as-is from the original mock so the app has a
> working baseline. Treat it as a first draft, not a final look — happy to
> iterate on layout, type, colour, etc. next.

## Run it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://localhost:5000** in a browser.

## What's in here

- `app.py` — Flask server: REST API + serves the static UI.
- `static/index.html`, `static/app.js`, `static/styles.css` — the board UI
  (SVG horse/jockey rendering logic is unchanged from the original prototype).
- `speedmap.db` — SQLite database (created automatically on first run,
  git-ignored).
- `silks/` — persistent folder of uploaded silk photos (git-ignored; the
  folder itself is kept via `.gitkeep`).

## Data model

- **Horses** are a global, reusable profile: name, body colour, fallback
  silk pattern/colours, and (optionally) an uploaded silk photo. Looked up
  case-insensitively by name — add "Whiskey Neat" once and her silks are
  offered automatically next time you type her name into any race.
- **Silks** is the persistent library of uploaded images, browsable/
  searchable from the "Add a Horse" panel, independent of any one horse.
- **Races** each save a title, expected pace, and the list of horses
  assigned to a column/position. Past races are listed in the "Load Race"
  dropdown in the toolbar and can be reopened at any time.

## Key workflows

- **Add/edit a horse on the board** — fills in the form on the bottom
  panel; typing a name that already exists auto-loads that horse's saved
  colours/silks. Saving upserts the horse profile and adds/updates it on
  the current race board (autosaved).
- **Reuse a silk** — the searchable Silk Library grid pulls from every
  silk ever uploaded; click a thumbnail to apply it to the horse you're
  editing.
- **Bulk import** — "Bulk Import Silks…" lets you drop in a whole folder
  of photos at once. Each file is matched against existing horse names by
  filename; you get a quick assignment screen to confirm or fix each
  guess before it's saved.
- **Past races** — the toolbar's "Load Race" dropdown reopens any
  previously saved board exactly as it was left.
