# games/database/games.py - VERSION TON (BUKAN IDR)

import sqlite3
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'database', 'games_data.db')

print(f"📁 Database path: {DB_PATH}")

def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def init_db():
    """Inisialisasi tabel untuk sistem Games - Balance dalam TON"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Buat Tabel Users - balance dalam TON (float)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            balance REAL DEFAULT 0,
            referred_by INTEGER DEFAULT NULL,
            referral_reward REAL DEFAULT 0,
            gifts INTEGER DEFAULT 0,
            wallet_address TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP
        )
    ''')
    
    # Buat Tabel Riwayat Main - amount dalam TON
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS game_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER,
            game_name TEXT,
            bet_amount REAL,
            win_amount REAL,
            multiplier REAL,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Cek dan tambahkan kolom yang mungkin hilang
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = [col[1] for col in cursor.fetchall()]
    
    columns_to_add = {
        "referred_by": "INTEGER DEFAULT NULL",
        "referral_reward": "REAL DEFAULT 0",
        "gifts": "INTEGER DEFAULT 0",
        "wallet_address": "TEXT DEFAULT NULL",
        "last_seen": "TIMESTAMP"
    }
    
    for col, data_type in columns_to_add.items():
        if col not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {data_type}")
                print(f"✅ Kolom '{col}' ditambahkan")
            except:
                pass
    
    conn.commit()
    conn.close()
    print("✅ Database games siap (balance dalam TON)")

def get_or_create_user(telegram_id, username, first_name, referred_by=None):
    """Mencari user atau membuat user baru dengan balance 0 TON"""
    init_db()
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    current_time = get_current_time()
    
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    
    if user:
        cursor.execute('''
            UPDATE users 
            SET username = ?, first_name = ?, last_seen = ? 
            WHERE telegram_id = ?
        ''', (username, first_name, current_time, telegram_id))
        conn.commit()
        
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        updated_user = dict(cursor.fetchone())
        conn.close()
        return updated_user
    else:
        cursor.execute('''
            INSERT INTO users (telegram_id, username, first_name, balance, referred_by, created_at, last_seen) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (telegram_id, username, first_name, 0.0, referred_by, current_time, current_time))
        
        if referred_by:
            cursor.execute("SELECT balance, referral_reward FROM users WHERE telegram_id = ?", (referred_by,))
            referrer = cursor.fetchone()
            if referrer:
                new_balance = referrer['balance'] + 0.5
                new_ref_reward = referrer['referral_reward'] + 0.5
                cursor.execute('''
                    UPDATE users 
                    SET balance = ?, referral_reward = ? 
                    WHERE telegram_id = ?
                ''', (new_balance, new_ref_reward, referred_by))
        
        conn.commit()
        
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        new_user = dict(cursor.fetchone())
        conn.close()
        return new_user

def get_user_data(telegram_id):
    """Mendapatkan seluruh data user"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def update_user_balance(telegram_id, amount_change):
    """Update balance user (dalam TON)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE users 
        SET balance = balance + ? 
        WHERE telegram_id = ?
    ''', (amount_change, telegram_id))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0

def add_game_history(telegram_id, game_name, bet_amount, win_amount, multiplier):
    """Menambahkan riwayat game (dalam TON)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO game_history (telegram_id, game_name, bet_amount, win_amount, multiplier, played_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (telegram_id, game_name, bet_amount, win_amount, multiplier, get_current_time()))
    
    conn.commit()
    conn.close()
    return True

def delete_user_data(telegram_id):
    """Menghapus user dan riwayat gamenya"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM game_history WHERE telegram_id = ?", (telegram_id,))
    cursor.execute("DELETE FROM users WHERE telegram_id = ?", (telegram_id,))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0

# Jalankan inisialisasi
init_db()