# games/database/games.py

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
            balance INTEGER DEFAULT 1500,
            referred_by INTEGER DEFAULT NULL,
            referral_reward INTEGER DEFAULT 0,
            gifts INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP
        )
    ''')
    
    # --- MIGRASI OTOMATIS: PERBAIKAN PADA 'last_seen' ---
    # SQLite tidak mengizinkan DEFAULT CURRENT_TIMESTAMP pada ALTER TABLE, 
    # jadi kita gunakan tipe data TIMESTAMP saja (akan berisi NULL awalnya)
    new_columns = {
        "referred_by": "INTEGER DEFAULT NULL",
        "referral_reward": "INTEGER DEFAULT 0",
        "gifts": "INTEGER DEFAULT 0",
        "last_seen": "TIMESTAMP"  # <-- PERBAIKAN DI SINI
    }
    
    for col, data_type in new_columns.items():
        try:
            cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {data_type}")
            print(f"✅ Auto-migrasi: Kolom '{col}' berhasil ditambahkan ke database.")
        except sqlite3.OperationalError:
            # Jika masuk ke sini, artinya kolom sudah ada. Kita abaikan saja.
            pass 
            
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

def get_or_create_user(telegram_id, username, first_name, referred_by=None):
    """Mencari user atau membuat user baru, dan memperbarui last_seen"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Agar hasil query bisa diakses seperti dictionary
    cursor = conn.cursor()
    
    current_time = get_current_time()
    
    cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
    user = cursor.fetchone()
    
    if user:
        # Jika user sudah ada, perbarui nama, username, dan last_seen
        cursor.execute('''
            UPDATE users 
            SET username = ?, first_name = ?, last_seen = ? 
            WHERE telegram_id = ?
        ''', (username, first_name, current_time, telegram_id))
        conn.commit()
        
        # Ambil data terbaru
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        updated_user = dict(cursor.fetchone())
        conn.close()
        return updated_user
    else:
        # Jika user baru, masukkan ke database
        cursor.execute('''
            INSERT INTO users (telegram_id, username, first_name, balance, referred_by, created_at, last_seen) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (telegram_id, username, first_name, 1500, referred_by, current_time, current_time))
        
        # Logika Tambahan: Jika ada pengundang (referrer), berikan hadiah ke pengundang
        if referred_by:
            cursor.execute("SELECT balance, referral_reward FROM users WHERE telegram_id = ?", (referred_by,))
            referrer = cursor.fetchone()
            if referrer:
                new_balance = referrer['balance'] + 500  # Bonus 500 koin untuk pengundang
                new_ref_reward = referrer['referral_reward'] + 500
                cursor.execute('''
                    UPDATE users 
                    SET balance = ?, referral_reward = ? 
                    WHERE telegram_id = ?
                ''', (new_balance, new_ref_reward, referred_by))
        
        conn.commit()
        
        # Ambil data yang baru dibuat
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

def delete_user_data(telegram_id):
    """Menghapus user dan riwayat gamenya dari database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Hapus dari tabel history dulu (foreign key constraint)
    cursor.execute("DELETE FROM game_history WHERE telegram_id = ?", (telegram_id,))
    # Hapus dari tabel users
    cursor.execute("DELETE FROM users WHERE telegram_id = ?", (telegram_id,))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0

# Jalankan inisialisasi ketika modul di-import
init_db()