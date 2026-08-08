import sqlite3
from pathlib import Path

# instance/ vive un nivel arriba de database.py, junto a app.py
INSTANCE_DIR = Path(__file__).resolve().parent / "instance"
INSTANCE_DIR.mkdir(exist_ok=True)  # la crea si no existe, sin lanzar error si ya está

DB_PATH = INSTANCE_DIR / "studia.db"

def initialize_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""CREATE TABLE IF NOT EXISTS docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        summary TEXT,
        questions TEXT
        )
    """)
    conn.commit()
    conn.close()

def save_doc(title, created_at, summary, questions_json):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO docs (title, created_at, summary, questions) VALUES (?,?,?,?)",
        (title, created_at, summary, questions_json)
    )
    conn.commit()
    conn.close()

def get_history():
    conn = sqlite3.connect(DB_PATH)  # ← corregido, ahora usa la misma constante
    rows = conn.execute("SELECT id, title, created_at FROM docs ORDER BY created_at DESC").fetchall()
    conn.close()
    return rows

if __name__ == "__main__":
    initialize_db()