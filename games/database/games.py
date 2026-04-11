# games/database/games.py - VERSION FIXED

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'games_data.db')

def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def init_db():
    """Inisialisasi tabel untuk sistem Games beserta migrasi kolom baru"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Buat Tabel Users dengan struktur baru
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            balance INTEGER DEFAULT 0,
            referred_by INTEGER DEFAULT NULL,
            referral_reward INTEGER DEFAULT 0,
            gifts INTEGER DEFAULT 0,
            wallet_address TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP
        )
    ''')
    
    # Buat Tabel Riwayat Main (Plinko / Crash / Deposit)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS game_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER,
            game_name TEXT,
            bet_amount INTEGER,
            win_amount INTEGER,
            multiplier REAL,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Cek dan tambahkan kolom yang mungkin hilang
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = [col[1] for col in cursor.fetchall()]
    
    columns_to_add = {
        "referred_by": "INTEGER DEFAULT NULL",
        "referral_reward": "INTEGER DEFAULT 0",
        "gifts": "INTEGER DEFAULT 0",
        "wallet_address": "TEXT DEFAULT NULL",
        "last_seen": "TIMESTAMP"
    }
    
    for col, data_type in columns_to_add.items():
        if col not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {data_type}")
                print(f"✅ Kolom '{col}' ditambahkan ke tabel users")
            except Exception as e:
                print(f"⚠️ Gagal tambah kolom {col}: {e}")
    
    conn.commit()
    conn.close()
    print("✅ Database games berhasil diinisialisasi")

def get_or_create_user(telegram_id, username, first_name, referred_by=None):
    """Mencari user atau membuat user baru dengan balance 0 (tanpa dummy)"""
    # Pastikan database terinisialisasi
    init_db()
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    current_time = get_current_time()
    
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    
    if user:
        # Update last_seen dan username/first_name
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
        # BALANCE = 0
        cursor.execute('''
            INSERT INTO users (telegram_id, username, first_name, balance, referred_by, created_at, last_seen) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (telegram_id, username, first_name, 0, referred_by, current_time, current_time))
        
        if referred_by:
            cursor.execute("SELECT balance, referral_reward FROM users WHERE telegram_id = ?", (referred_by,))
            referrer = cursor.fetchone()
            if referrer:
                new_balance = referrer['balance'] + 500
                new_ref_reward = referrer['referral_reward'] + 500
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
    """Update balance user (positive atau negative)"""
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

def update_user_stats(telegram_id, balance=None, referral_reward=None, gifts=None):
    """Memperbarui nilai balance, referral, atau gifts secara dinamis"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updates = []
    params = []
    
    if balance is not None:
        updates.append("balance = ?")
        params.append(balance)
    if referral_reward is not None:
        updates.append("referral_reward = ?")
        params.append(referral_reward)
    if gifts is not None:
        updates.append("gifts = ?")
        params.append(gifts)
        
    if not updates:
        return False
        
    params.append(telegram_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE telegram_id = ?"
    
    cursor.execute(query, params)
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0

def add_game_history(telegram_id, game_name, bet_amount, win_amount, multiplier):
    """Menambahkan riwayat game"""
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
    """Menghapus user dan riwayat gamenya dari database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM game_history WHERE telegram_id = ?", (telegram_id,))
    cursor.execute("DELETE FROM users WHERE telegram_id = ?", (telegram_id,))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0

# Jalankan inisialisasi ketika modul di-import
init_db()