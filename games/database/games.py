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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabel users (existing)
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
    
    # 🔥 TABEL BARU: wallet_sessions - untuk menyimpan wallet address yang sedang connect
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wallet_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER NOT NULL,
            wallet_address TEXT NOT NULL,
            session_id TEXT,
            is_active BOOLEAN DEFAULT 1,
            connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (telegram_id) REFERENCES users(telegram_id),
            UNIQUE(telegram_id, wallet_address)
        )
    ''')
    
    # Tabel game_history
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
    
    # Tabel withdraw_requests
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS withdraw_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER,
            amount_ton REAL,
            destination_address TEXT,
            reference TEXT,
            transaction_hash TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP
        )
    ''')
    
    # Tabel payment_tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payment_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reference TEXT UNIQUE,
            body_base64_hash TEXT,
            telegram_id TEXT,
            amount REAL,
            status TEXT DEFAULT 'pending',
            transaction_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Cek dan tambah kolom yang mungkin hilang di users
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
                print(f"✅ Kolom '{col}' ditambahkan ke users")
            except:
                pass
    
    # Cek dan tambah kolom di withdraw_requests
    cursor.execute("PRAGMA table_info(withdraw_requests)")
    withdraw_columns = [col[1] for col in cursor.fetchall()]
    
    if 'reference' not in withdraw_columns:
        try:
            cursor.execute("ALTER TABLE withdraw_requests ADD COLUMN reference TEXT")
            print("✅ Kolom 'reference' ditambahkan ke withdraw_requests")
        except:
            pass
    
    if 'transaction_hash' not in withdraw_columns:
        try:
            cursor.execute("ALTER TABLE withdraw_requests ADD COLUMN transaction_hash TEXT")
            print("✅ Kolom 'transaction_hash' ditambahkan ke withdraw_requests")
        except:
            pass
    
    if 'processed_at' not in withdraw_columns:
        try:
            cursor.execute("ALTER TABLE withdraw_requests ADD COLUMN processed_at TIMESTAMP")
            print("✅ Kolom 'processed_at' ditambahkan ke withdraw_requests")
        except:
            pass
    
    conn.commit()
    conn.close()
    print("✅ Database siap dengan semua tabel yang diperlukan")

# ==================== WALLET SESSION FUNCTIONS ====================

def save_wallet_session(telegram_id, wallet_address, session_id=None):
    """Simpan wallet address yang sedang connect ke database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    current_time = get_current_time()
    
    # Nonaktifkan session lama untuk user ini
    cursor.execute('''
        UPDATE wallet_sessions 
        SET is_active = 0 
        WHERE telegram_id = ?
    ''', (telegram_id,))
    
    # Simpan session baru
    cursor.execute('''
        INSERT INTO wallet_sessions (telegram_id, wallet_address, session_id, is_active, connected_at, last_verified)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(telegram_id, wallet_address) DO UPDATE SET
            is_active = 1,
            session_id = COALESCE(?, session_id),
            last_verified = ?
    ''', (telegram_id, wallet_address, session_id, current_time, current_time, session_id, current_time))
    
    # Update juga di tabel users
    cursor.execute('''
        UPDATE users 
        SET wallet_address = ?, last_seen = ?
        WHERE telegram_id = ?
    ''', (wallet_address, current_time, telegram_id))
    
    conn.commit()
    conn.close()
    print(f"✅ Wallet session saved: {telegram_id} -> {wallet_address}")


def get_active_wallet_session(telegram_id):
    """Dapatkan wallet address yang sedang aktif untuk user"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT wallet_address, session_id, connected_at, last_verified
        FROM wallet_sessions 
        WHERE telegram_id = ? AND is_active = 1
        ORDER BY last_verified DESC LIMIT 1
    ''', (telegram_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'wallet_address': row['wallet_address'],
            'session_id': row['session_id'],
            'connected_at': row['connected_at'],
            'last_verified': row['last_verified']
        }
    return None


def deactivate_wallet_session(telegram_id, wallet_address=None):
    """Nonaktifkan wallet session (disconnect)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if wallet_address:
        cursor.execute('''
            UPDATE wallet_sessions 
            SET is_active = 0 
            WHERE telegram_id = ? AND wallet_address = ?
        ''', (telegram_id, wallet_address))
    else:
        cursor.execute('''
            UPDATE wallet_sessions 
            SET is_active = 0 
            WHERE telegram_id = ?
        ''', (telegram_id,))
    
    conn.commit()
    conn.close()
    print(f"✅ Wallet session deactivated for user {telegram_id}")


def get_user_withdraw_wallet(telegram_id):
    """Dapatkan wallet address untuk withdraw (prioritaskan dari session aktif)"""
    # Cek dari session aktif dulu
    session = get_active_wallet_session(telegram_id)
    if session and session['wallet_address']:
        return session['wallet_address']
    
    # Fallback ke wallet_address dari tabel users
    user = get_user_data(telegram_id)
    if user and user.get('wallet_address'):
        return user['wallet_address']
    
    return None


# ==================== EXISTING FUNCTIONS ====================

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
    cursor.execute("DELETE FROM wallet_sessions WHERE telegram_id = ?", (telegram_id,))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0


# Jalankan inisialisasi
init_db()