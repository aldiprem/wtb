# games/database/games.py

import sqlite3
import os

DB_PATH = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'games_data.db')

def init_db():
    """Inisialisasi tabel untuk sistem Games"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabel Users
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            balance INTEGER DEFAULT 1500,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabel Riwayat Main (Plinko / Crash)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS game_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER,
            game_name TEXT,
            bet_amount INTEGER,
            win_amount INTEGER,
            multiplier REAL,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(telegram_id) REFERENCES users(telegram_id)
        )
    ''')
    
    conn.commit()
    conn.close()

def get_or_create_user(telegram_id, username, first_name):
    """Mencari user atau membuat user baru jika belum ada"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    
    if user:
        conn.close()
        return user[0]  # Mengembalikan balance saat ini
    else:
        # Berikan bonus 1500 koin untuk pengguna baru
        cursor.execute(
            "INSERT INTO users (telegram_id, username, first_name, balance) VALUES (?, ?, ?, ?)",
            (telegram_id, username, first_name, 1500)
        )
        conn.commit()
        conn.close()
        return 1500

# Jalankan inisialisasi ketika modul di-import
init_db()