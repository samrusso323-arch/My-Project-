"""Speed Map Builder - local Flask server.

Serves the board UI and a small REST API backed by SQLite. Silk photos are
stored as real files under SILKS_DIR so the library survives across runs.
"""
import os
import sqlite3
import uuid
from datetime import datetime, timezone

from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

import horse_render

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "speedmap.db")
SILKS_DIR = os.path.join(BASE_DIR, "silks")
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "webp"}

os.makedirs(SILKS_DIR, exist_ok=True)

app = Flask(__name__, static_folder="static", static_url_path="")

SCHEMA = """
CREATE TABLE IF NOT EXISTS horses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    horsecolor TEXT NOT NULL DEFAULT '#1c1b17',
    pattern TEXT NOT NULL DEFAULT 'solid',
    silk1 TEXT NOT NULL DEFAULT '#0b6e4f',
    silk2 TEXT NOT NULL DEFAULT '#ffffff',
    namecolor TEXT NOT NULL DEFAULT '#1c1b17',
    silk_filename TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_horses_name_nocase ON horses(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS silks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT,
    label TEXT,
    horse_id INTEGER REFERENCES horses(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS races (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    speed TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS race_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    race_id INTEGER NOT NULL REFERENCES races(id) ON DELETE CASCADE,
    horse_id INTEGER NOT NULL REFERENCES horses(id) ON DELETE CASCADE,
    col TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    number TEXT,
    UNIQUE(race_id, horse_id)
);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def row_to_horse(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "horsecolor": row["horsecolor"],
        "pattern": row["pattern"],
        "silk1": row["silk1"],
        "silk2": row["silk2"],
        "namecolor": row["namecolor"],
        "silk_filename": row["silk_filename"],
    }


def find_horse_by_name(db, name):
    return db.execute(
        "SELECT * FROM horses WHERE name = ? COLLATE NOCASE", (name,)
    ).fetchone()


# ---------------------------------------------------------------- pages ---

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/silks/<path:filename>")
def serve_silk(filename):
    return send_from_directory(SILKS_DIR, filename)


@app.route("/render/horse.png")
def render_horse_png():
    body = request.args.get("body", "#8a6a3a")
    pattern = request.args.get("pattern", "solid")
    silk1 = request.args.get("silk1", "#0b6e4f")
    silk2 = request.args.get("silk2", "#ffffff")
    silk_filename = request.args.get("silk") or None
    path = horse_render.get_or_render_path(body, pattern, silk1, silk2, silk_filename, SILKS_DIR)
    directory, filename = os.path.split(path)
    response = send_from_directory(directory, filename)
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


# --------------------------------------------------------------- horses ---

@app.route("/api/horses", methods=["GET"])
def list_horses():
    q = request.args.get("q", "").strip()
    db = get_db()
    if q:
        rows = db.execute(
            "SELECT * FROM horses WHERE name LIKE ? ORDER BY name COLLATE NOCASE",
            (f"%{q}%",),
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM horses ORDER BY name COLLATE NOCASE").fetchall()
    return jsonify([row_to_horse(r) for r in rows])


@app.route("/api/horses", methods=["POST"])
def upsert_horse():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    fields = {
        "horsecolor": data.get("horsecolor", "#1c1b17"),
        "pattern": data.get("pattern", "solid"),
        "silk1": data.get("silk1", "#0b6e4f"),
        "silk2": data.get("silk2", "#ffffff"),
        "namecolor": data.get("namecolor", "#1c1b17"),
        "silk_filename": data.get("silk_filename"),
    }

    db = get_db()
    existing = find_horse_by_name(db, name)
    ts = now_iso()
    if existing:
        db.execute(
            """UPDATE horses SET name=?, horsecolor=?, pattern=?, silk1=?, silk2=?,
               namecolor=?, silk_filename=?, updated_at=? WHERE id=?""",
            (name, fields["horsecolor"], fields["pattern"], fields["silk1"],
             fields["silk2"], fields["namecolor"],
             fields["silk_filename"], ts, existing["id"]),
        )
        horse_id = existing["id"]
    else:
        cur = db.execute(
            """INSERT INTO horses (name, horsecolor, pattern, silk1, silk2,
               namecolor, silk_filename, created_at, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (name, fields["horsecolor"], fields["pattern"], fields["silk1"],
             fields["silk2"], fields["namecolor"],
             fields["silk_filename"], ts, ts),
        )
        horse_id = cur.lastrowid
    db.commit()
    row = db.execute("SELECT * FROM horses WHERE id=?", (horse_id,)).fetchone()
    return jsonify(row_to_horse(row))


# ---------------------------------------------------------------- silks ---

@app.route("/api/silks", methods=["GET"])
def list_silks():
    q = request.args.get("q", "").strip()
    db = get_db()
    sql = """SELECT s.*, h.name AS horse_name FROM silks s
             LEFT JOIN horses h ON h.id = s.horse_id"""
    params = ()
    if q:
        sql += " WHERE s.label LIKE ? OR s.original_name LIKE ? OR h.name LIKE ?"
        params = (f"%{q}%", f"%{q}%", f"%{q}%")
    sql += " ORDER BY s.created_at DESC"
    rows = db.execute(sql, params).fetchall()
    return jsonify([
        {
            "id": r["id"],
            "filename": r["filename"],
            "original_name": r["original_name"],
            "label": r["label"],
            "horse_id": r["horse_id"],
            "horse_name": r["horse_name"],
            "url": f"/silks/{r['filename']}",
        }
        for r in rows
    ])


def guess_label(original_name):
    stem = os.path.splitext(original_name)[0]
    stem = stem.replace("_", " ").replace("-", " ").strip()
    return " ".join(w.capitalize() for w in stem.split()) or "Untitled Silk"


@app.route("/api/silks/upload", methods=["POST"])
def upload_silks():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "no files uploaded"}), 400

    db = get_db()
    created = []
    ts = now_iso()
    for f in files:
        if not f or not f.filename:
            continue
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
        if ext not in ALLOWED_EXT:
            continue
        original_name = secure_filename(f.filename)
        stored_name = f"{uuid.uuid4().hex}.{ext}"
        f.save(os.path.join(SILKS_DIR, stored_name))
        label = guess_label(original_name)
        cur = db.execute(
            "INSERT INTO silks (filename, original_name, label, created_at) VALUES (?,?,?,?)",
            (stored_name, original_name, label, ts),
        )
        created.append({
            "id": cur.lastrowid,
            "filename": stored_name,
            "original_name": original_name,
            "label": label,
            "horse_id": None,
            "horse_name": None,
            "url": f"/silks/{stored_name}",
        })
    db.commit()
    return jsonify(created)


@app.route("/api/silks/bulk-assign", methods=["POST"])
def bulk_assign_silks():
    items = request.get_json(force=True) or []
    db = get_db()
    ts = now_iso()
    results = []
    for item in items:
        silk_id = item.get("silk_id")
        horse_name = (item.get("horse_name") or "").strip()
        if not silk_id or not horse_name:
            continue
        silk = db.execute("SELECT * FROM silks WHERE id=?", (silk_id,)).fetchone()
        if not silk:
            continue

        existing = find_horse_by_name(db, horse_name)
        if existing:
            db.execute(
                "UPDATE horses SET silk_filename=?, updated_at=? WHERE id=?",
                (silk["filename"], ts, existing["id"]),
            )
            horse_id = existing["id"]
        else:
            cur = db.execute(
                """INSERT INTO horses (name, silk_filename, created_at, updated_at)
                   VALUES (?,?,?,?)""",
                (horse_name, silk["filename"], ts, ts),
            )
            horse_id = cur.lastrowid

        db.execute("UPDATE silks SET horse_id=? WHERE id=?", (horse_id, silk_id))
        row = db.execute("SELECT * FROM horses WHERE id=?", (horse_id,)).fetchone()
        results.append(row_to_horse(row))
    db.commit()
    return jsonify(results)


# ---------------------------------------------------------------- races ---

@app.route("/api/races", methods=["GET"])
def list_races():
    db = get_db()
    rows = db.execute(
        "SELECT id, title, speed, created_at, updated_at FROM races ORDER BY updated_at DESC"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/races/<int:race_id>", methods=["GET"])
def get_race(race_id):
    db = get_db()
    race = db.execute("SELECT * FROM races WHERE id=?", (race_id,)).fetchone()
    if not race:
        return jsonify({"error": "not found"}), 404
    entries = db.execute(
        """SELECT re.col, re.position, re.number, h.* FROM race_entries re
           JOIN horses h ON h.id = re.horse_id
           WHERE re.race_id=? ORDER BY re.col, re.position""",
        (race_id,),
    ).fetchall()
    return jsonify({
        "id": race["id"],
        "title": race["title"],
        "speed": race["speed"],
        "created_at": race["created_at"],
        "updated_at": race["updated_at"],
        "entries": [
            {**row_to_horse(e), "col": e["col"], "position": e["position"], "number": e["number"]}
            for e in entries
        ],
    })


def save_race_entries(db, race_id, entries):
    db.execute("DELETE FROM race_entries WHERE race_id=?", (race_id,))
    for e in entries:
        db.execute(
            "INSERT INTO race_entries (race_id, horse_id, col, position, number) VALUES (?,?,?,?,?)",
            (race_id, e["horse_id"], e["col"], e.get("position", 0), e.get("number")),
        )


@app.route("/api/races", methods=["POST"])
def create_race():
    data = request.get_json(force=True) or {}
    ts = now_iso()
    db = get_db()
    cur = db.execute(
        "INSERT INTO races (title, speed, created_at, updated_at) VALUES (?,?,?,?)",
        (data.get("title", "Untitled Race"), data.get("speed", ""), ts, ts),
    )
    race_id = cur.lastrowid
    save_race_entries(db, race_id, data.get("entries", []))
    db.commit()
    return jsonify({"id": race_id})


@app.route("/api/races/<int:race_id>", methods=["PUT"])
def update_race(race_id):
    data = request.get_json(force=True) or {}
    db = get_db()
    race = db.execute("SELECT * FROM races WHERE id=?", (race_id,)).fetchone()
    if not race:
        return jsonify({"error": "not found"}), 404
    ts = now_iso()
    db.execute(
        "UPDATE races SET title=?, speed=?, updated_at=? WHERE id=?",
        (data.get("title", race["title"]), data.get("speed", race["speed"]), ts, race_id),
    )
    save_race_entries(db, race_id, data.get("entries", []))
    db.commit()
    return jsonify({"id": race_id})


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
