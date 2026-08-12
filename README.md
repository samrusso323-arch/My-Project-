# Speed Map Builder

A local racing "Speed Map" board — three columns (Backmarkers / Midfield /
Leaders) showing an illustrated horse-and-jockey per runner, coloured to
the horse and wearing the horse's registered silks (photo, pattern, or flat
colour).

This started as a single-file HTML prototype and has been restructured into
a small local app: a Flask + SQLite server, a persistent silk-image library
on disk, bulk silk import, and a horse/race database so a horse's silks only
need to be entered once and are reused automatically in future races.

## Run it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://localhost:5000** in a browser.

## What's in here

- `app.py` — Flask server: REST API + serves the static UI.
- `horse_render.py` — generates each horse's artwork on request (see below).
- `static/index.html`, `static/app.js`, `static/styles.css` — the board UI.
- `speedmap.db` — SQLite database (created automatically on first run,
  git-ignored).
- `silks/` — persistent folder of uploaded silk photos (git-ignored; the
  folder itself is kept via `.gitkeep`).

## Horse artwork

Each horse is rendered from one of three fixed illustrated gallop poses
(`render_assets/pose1/`, `pose2/`, `pose3/` — picked per horse via "Horse
Pose" on the form), recolored per horse rather than drawn as flat vector
shapes. Every pose's base artwork is split into three layers:

- **Coat** — recolored to the horse's chosen colour while keeping the
  original illustration's muscle shading and highlights (the target colour
  is scaled by each pixel's lightness relative to the coat's average, so
  black, grey, chestnut, etc. all keep the same shading detail).
- **Silks** (jacket, sleeves, and cap, treated as one region) — filled with
  the horse's uploaded silk photo, or a flat/patterned colour fill if no
  photo is set, with the same shading technique applied.
- **Fixed details** (boots, pants, saddle, tack, mane, tail, hooves) —
  always rendered as-is from the source illustration.

`GET /render/horse.png?pose=<id>&body=<hex>&pattern=<name>&silk1=<hex>&silk2=<hex>&silk=<filename>`
renders and disk-caches the composite (`render_cache/`, git-ignored) so
repeat views are instant. The saddle-cloth number is drawn separately as an
HTML overlay (from each race entry's optional "Saddle Cloth #"), positioned
over each pose's fixed anchor point (`GET /api/poses` reports it as a
fraction of the artwork's width/height).

## Data model

- **Horses** are a global, reusable profile: name, body colour, pose,
  fallback silk pattern/colours, and (optionally) an uploaded silk photo.
  Looked up case-insensitively by name — add "Whiskey Neat" once and her
  colours/pose/silks are offered automatically next time you type her name
  into any race.
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
