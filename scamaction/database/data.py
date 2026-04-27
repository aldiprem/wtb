# database/data.py — ScamAction Database Layer
import sqlite3
import os
import re
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scamaction.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    cur = conn.cursor()

    # Users yang pernah /start bot
    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        user_id     INTEGER PRIMARY KEY,
        fullname    TEXT,
        username    TEXT,
        joined_at   TEXT,
        first_start TEXT,
        last_start  TEXT
    )""")

    # Channel/group yang di-scan (diatur oleh OWNER)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS scan_channels (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id  INTEGER UNIQUE,
        channel_name TEXT,
        username    TEXT,
        added_at    TEXT
    )""")

    # Hasil scan: user_id yang ditemukan di pesan channel
    cur.execute("""
    CREATE TABLE IF NOT EXISTS scanned_ids (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER,
        channel_id  INTEGER,
        channel_name TEXT,
        msg_id      INTEGER,
        found_at    TEXT,
        UNIQUE(user_id, channel_id, msg_id)
    )""")

    # Channel/group yang di-monitor (bot ditambahkan sebagai member)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS monitor_channels (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id         INTEGER UNIQUE,
        chat_name       TEXT,
        chat_username   TEXT,
        added_by        INTEGER,
        is_active       INTEGER DEFAULT 1,
        added_at        TEXT
    )""")

    # Admin per monitor channel
    cur.execute("""
    CREATE TABLE IF NOT EXISTS monitor_admins (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id     INTEGER,
        user_id     INTEGER,
        added_at    TEXT,
        UNIQUE(chat_id, user_id)
    )""")

    # Laporan dari user (sesi laporan)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS reports (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER,
        msg_ids     TEXT,
        status      TEXT DEFAULT 'pending',
        created_at  TEXT,
        forwarded_at TEXT
    )""")

    # Log notifikasi monitor
    cur.execute("""
    CREATE TABLE IF NOT EXISTS monitor_alerts (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER,
        chat_id     INTEGER,
        chat_name   TEXT,
        triggered_at TEXT
    )""")

    conn.commit()
    conn.close()

# ─── SCAN CHANNELS ────────────────────────────────────────────────────────────

def add_scan_channel(channel_id: int, channel_name: str, username: str):
    conn = get_conn()
    conn.execute("""
        INSERT OR REPLACE INTO scan_channels (channel_id, channel_name, username, added_at)
        VALUES (?, ?, ?, ?)
    """, (channel_id, channel_name, username or "", datetime.now().isoformat()))
    conn.commit()
    conn.close()

def remove_scan_channel(channel_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM scan_channels WHERE channel_id = ?", (channel_id,))
    conn.commit()
    conn.close()

def get_scan_channels():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM scan_channels ORDER BY added_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def reset_scan_channels():
    conn = get_conn()
    conn.execute("DELETE FROM scan_channels")
    conn.commit()
    conn.close()

# ─── SCANNED IDS ──────────────────────────────────────────────────────────────

def save_scanned_id(user_id: int, channel_id: int, channel_name: str, msg_id: int):
    conn = get_conn()
    conn.execute("""
        INSERT OR IGNORE INTO scanned_ids (user_id, channel_id, channel_name, msg_id, found_at)
        VALUES (?, ?, ?, ?, ?)
    """, (user_id, channel_id, channel_name, msg_id, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def is_known_scammer(user_id: int) -> bool:
    conn = get_conn()
    row = conn.execute("SELECT 1 FROM scanned_ids WHERE user_id = ? LIMIT 1", (user_id,)).fetchone()
    conn.close()
    return row is not None

def get_scammer_references(user_id: int):
    conn = get_conn()
    rows = conn.execute("""
        SELECT channel_id, channel_name, msg_id, found_at
        FROM scanned_ids WHERE user_id = ?
    """, (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_all_scanned_ids():
    conn = get_conn()
    rows = conn.execute("SELECT DISTINCT user_id FROM scanned_ids").fetchall()
    conn.close()
    return [r["user_id"] for r in rows]

def get_stats():
    conn = get_conn()
    total_ids    = conn.execute("SELECT COUNT(DISTINCT user_id) FROM scanned_ids").fetchone()[0]
    total_ch     = conn.execute("SELECT COUNT(*) FROM scan_channels").fetchone()[0]
    total_mon    = conn.execute("SELECT COUNT(*) FROM monitor_channels WHERE is_active=1").fetchone()[0]
    total_alerts = conn.execute("SELECT COUNT(*) FROM monitor_alerts").fetchone()[0]
    total_rep    = conn.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
    conn.close()
    return {
        "total_scanned_ids": total_ids,
        "total_scan_channels": total_ch,
        "total_monitor_channels": total_mon,
        "total_alerts": total_alerts,
        "total_reports": total_rep,
    }

# ─── MONITOR CHANNELS ─────────────────────────────────────────────────────────

def add_monitor_channel(chat_id: int, chat_name: str, chat_username: str, added_by: int):
    conn = get_conn()
    conn.execute("""
        INSERT OR REPLACE INTO monitor_channels
            (chat_id, chat_name, chat_username, added_by, is_active, added_at)
        VALUES (?, ?, ?, ?, 1, ?)
    """, (chat_id, chat_name, chat_username or "", added_by, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def get_monitor_channels(added_by: int = None):
    conn = get_conn()
    if added_by:
        rows = conn.execute(
            "SELECT * FROM monitor_channels WHERE added_by = ? ORDER BY added_at DESC", (added_by,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM monitor_channels ORDER BY added_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def toggle_monitor_channel(chat_id: int) -> int:
    conn = get_conn()
    row = conn.execute("SELECT is_active FROM monitor_channels WHERE chat_id = ?", (chat_id,)).fetchone()
    new_state = 0 if row and row["is_active"] else 1
    conn.execute("UPDATE monitor_channels SET is_active = ? WHERE chat_id = ?", (new_state, chat_id))
    conn.commit()
    conn.close()
    return new_state

def get_monitor_channel(chat_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM monitor_channels WHERE chat_id = ?", (chat_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

# ─── MONITOR ADMINS ───────────────────────────────────────────────────────────

def add_monitor_admin(chat_id: int, user_id: int):
    conn = get_conn()
    conn.execute("""
        INSERT OR IGNORE INTO monitor_admins (chat_id, user_id, added_at)
        VALUES (?, ?, ?)
    """, (chat_id, user_id, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def remove_monitor_admin(chat_id: int, user_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM monitor_admins WHERE chat_id = ? AND user_id = ?", (chat_id, user_id))
    conn.commit()
    conn.close()

def reset_monitor_admins(chat_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM monitor_admins WHERE chat_id = ?", (chat_id,))
    conn.commit()
    conn.close()

def get_monitor_admins(chat_id: int):
    conn = get_conn()
    rows = conn.execute("SELECT * FROM monitor_admins WHERE chat_id = ?", (chat_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def is_monitor_admin(chat_id: int, user_id: int) -> bool:
    conn = get_conn()
    row = conn.execute(
        "SELECT 1 FROM monitor_admins WHERE chat_id = ? AND user_id = ?", (chat_id, user_id)
    ).fetchone()
    conn.close()
    return row is not None

# ─── REPORTS ──────────────────────────────────────────────────────────────────

def save_report(user_id: int, msg_ids: list):
    conn = get_conn()
    cur = conn.execute("""
        INSERT INTO reports (user_id, msg_ids, status, created_at)
        VALUES (?, ?, 'pending', ?)
    """, (user_id, ",".join(str(m) for m in msg_ids), datetime.now().isoformat()))
    rid = cur.lastrowid
    conn.commit()
    conn.close()
    return rid

def mark_report_forwarded(report_id: int):
    conn = get_conn()
    conn.execute("""
        UPDATE reports SET status='forwarded', forwarded_at=? WHERE id=?
    """, (datetime.now().isoformat(), report_id))
    conn.commit()
    conn.close()

def get_reports(user_id: int = None, limit: int = 50):
    conn = get_conn()
    if user_id:
        rows = conn.execute(
            "SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM reports ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ─── MONITOR ALERTS ───────────────────────────────────────────────────────────

def save_monitor_alert(user_id: int, chat_id: int, chat_name: str):
    conn = get_conn()
    conn.execute("""
        INSERT INTO monitor_alerts (user_id, chat_id, chat_name, triggered_at)
        VALUES (?, ?, ?, ?)
    """, (user_id, chat_id, chat_name, datetime.now().isoformat()))
    conn.commit()
    conn.close()

def get_monitor_alerts(limit: int = 50):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM monitor_alerts ORDER BY triggered_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ─── USERS ────────────────────────────────────────────────────────────────────

def upsert_user(user_id: int, fullname: str, username: str):
    conn = get_conn()
    now = datetime.now().isoformat()
    existing = conn.execute("SELECT first_start FROM users WHERE user_id = ?", (user_id,)).fetchone()
    first = existing["first_start"] if existing else now
    conn.execute("""
        INSERT OR REPLACE INTO users (user_id, fullname, username, joined_at, first_start, last_start)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, fullname, username or "", now, first, now))
    conn.commit()
    conn.close()

def get_user(user_id: int):
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_users():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM users ORDER BY last_start DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

# ─── UTILITY: Extract Telegram IDs from text ──────────────────────────────────

def extract_telegram_ids(text: str) -> list:
    """Extract 9–11 digit numbers from text that look like Telegram user IDs."""
    pattern = r'\b([1-9]\d{8,10})\b'
    return list(set(int(m) for m in re.findall(pattern, text)))

# Initialize database
init_db()