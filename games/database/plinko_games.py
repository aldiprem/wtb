# games/database/plinko_games.py - PERBAIKAN LENGKAP DENGAN SINGLETON DATABASE

import sqlite3
import json
import random
import math
import os
from datetime import datetime
from pathlib import Path
import threading

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'games', 'database', 'plinko.db')

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

print(f"📁 Plinko DB Path: {DB_PATH}")
print(f"📁 Database exists: {os.path.exists(DB_PATH)}")

TARGET_BANDAR_PROFIT = 5.0

# Konfigurasi multiplier untuk setiap risk level
RISK_MULTIPLIERS = {
    'low': [2, 1.5, 1, 0.8, 0.5, 0.3, 0.5, 0.8, 1, 1.5, 2],
    'medium': [3, 2, 1.5, 1, 0.5, 0.2, 0.5, 1, 1.5, 2, 3],
    'high': [4, 3, 2, 1.5, 1, 0.5, 0.2, 0.1, 0.0, 0.1, 0.2, 0.5, 1, 1.5, 2, 3, 4]
}

SMALL_MULTIPLIERS = {
    'low': [0.1, 0.2, 0.3, 0.4, 0.5, 0.5, 0.5],
    'medium': [0.0, 0.0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.5],
    'high': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.1, 0.2]
}

MEDIUM_MULTIPLIERS = {
    'low': [1, 1.2, 1.5],
    'medium': [1.5, 2, 2.5],
    'high': [1, 1.5, 2]
}

BIG_MULTIPLIERS = {
    'low': [2, 2.5],
    'medium': [3, 4],
    'high': [3, 4, 5]
}

# Thread-local storage untuk database connections
_local = threading.local()

def get_db():
    """Get database connection - singleton per thread"""
    if not hasattr(_local, 'conn') or _local.conn is None:
        _local.conn = sqlite3.connect(str(DB_PATH), timeout=30.0, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=DELETE")
        _local.conn.execute("PRAGMA synchronous=NORMAL")
        _local.conn.execute("PRAGMA busy_timeout=30000")
    return _local.conn

def close_db():
    """Close database connection for current thread"""
    if hasattr(_local, 'conn') and _local.conn:
        _local.conn.close()
        _local.conn = None

def init_db():
    """Initialize database tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Games table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plinko_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            round_hash TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            username TEXT,
            photo_url TEXT,
            bet_amount REAL,
            multiplier REAL,
            win_amount REAL,
            risk_level TEXT,
            is_forced BOOLEAN DEFAULT 0,
            cheat_reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Stats table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plinko_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_players INTEGER DEFAULT 0,
            total_games INTEGER DEFAULT 0,
            biggest_multiplier REAL DEFAULT 0,
            biggest_win REAL DEFAULT 0,
            total_bet_amount REAL DEFAULT 0,
            total_win_amount REAL DEFAULT 0,
            last_player TEXT,
            last_time TIMESTAMP,
            current_hash TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Bandar profit table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bandar_profit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_bet_all_time REAL DEFAULT 0,
            total_win_all_time REAL DEFAULT 0,
            bandar_profit REAL DEFAULT 0,
            total_cheat_activated INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # User loss tracking table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_loss_tracking (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            total_bet REAL DEFAULT 0,
            total_win REAL DEFAULT 0,
            net_loss REAL DEFAULT 0,
            games_played INTEGER DEFAULT 0,
            forced_loss_count INTEGER DEFAULT 0,
            last_win_multiplier REAL DEFAULT 0,
            consecutive_losses INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Cheat log table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cheat_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT,
            round_hash TEXT,
            action TEXT,
            multiplier_given REAL,
            expected_multiplier REAL,
            bandar_profit_before REAL,
            bandar_profit_after REAL,
            cheat_intensity REAL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert default bandar profit if empty
    cursor.execute('SELECT COUNT(*) FROM bandar_profit')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO bandar_profit (total_bet_all_time, total_win_all_time, bandar_profit, total_cheat_activated)
            VALUES (0, 0, 0, 0)
        ''')
    
    # Insert default stats if empty
    cursor.execute('SELECT COUNT(*) FROM plinko_stats')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO plinko_stats (total_players, total_games, current_hash)
            VALUES (0, 0, ?)
        ''', (datetime.now().strftime('%Y%m%d%H%M%S'),))
    
    # Add missing columns
    cursor.execute("PRAGMA table_info(plinko_games)")
    existing_columns = [col[1] for col in cursor.fetchall()]
    
    if 'is_forced' not in existing_columns:
        cursor.execute("ALTER TABLE plinko_games ADD COLUMN is_forced BOOLEAN DEFAULT 0")
        print("✅ Kolom is_forced ditambahkan")
    if 'cheat_reason' not in existing_columns:
        cursor.execute("ALTER TABLE plinko_games ADD COLUMN cheat_reason TEXT")
        print("✅ Kolom cheat_reason ditambahkan")
    if 'photo_url' not in existing_columns:
        cursor.execute("ALTER TABLE plinko_games ADD COLUMN photo_url TEXT")
        print("✅ Kolom photo_url ditambahkan")
    
    conn.commit()
    print("✅ Plinko database initialized")
    print(f"📁 Database location: {DB_PATH}")
    print(f"🎯 Target Bandar Profit: {TARGET_BANDAR_PROFIT} TON")
    
    # VERIFIKASI: Cek apakah tabel bisa diakses
    test_cursor = conn.cursor()
    test_cursor.execute("SELECT COUNT(*) FROM plinko_games")
    count = test_cursor.fetchone()[0]
    print(f"📊 Existing games in DB: {count}")

def get_bandar_profit():
    """Mendapatkan keuntungan bandar saat ini"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT total_bet_all_time, total_win_all_time, bandar_profit, total_cheat_activated 
        FROM bandar_profit ORDER BY id DESC LIMIT 1
    ''')
    row = cursor.fetchone()
    
    if row:
        return {
            'total_bet': row['total_bet_all_time'] or 0,
            'total_win': row['total_win_all_time'] or 0,
            'profit': row['bandar_profit'] or 0,
            'cheat_count': row['total_cheat_activated'] or 0
        }
    return {'total_bet': 0, 'total_win': 0, 'profit': 0, 'cheat_count': 0}

def update_bandar_profit(bet_amount, win_amount, is_cheat=False):
    """Update keuntungan bandar setelah setiap game"""
    conn = get_db()
    cursor = conn.cursor()
    
    profit_change = bet_amount - win_amount
    
    if is_cheat:
        cursor.execute('''
            UPDATE bandar_profit 
            SET total_bet_all_time = total_bet_all_time + ?,
                total_win_all_time = total_win_all_time + ?,
                bandar_profit = bandar_profit + ?,
                total_cheat_activated = total_cheat_activated + 1,
                last_updated = CURRENT_TIMESTAMP
        ''', (bet_amount, win_amount, profit_change))
    else:
        cursor.execute('''
            UPDATE bandar_profit 
            SET total_bet_all_time = total_bet_all_time + ?,
                total_win_all_time = total_win_all_time + ?,
                bandar_profit = bandar_profit + ?,
                last_updated = CURRENT_TIMESTAMP
        ''', (bet_amount, win_amount, profit_change))
    
    conn.commit()
    return profit_change

def get_user_loss(user_id):
    """Mendapatkan data kerugian user tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT total_bet, total_win, net_loss, games_played, forced_loss_count, consecutive_losses
        FROM user_loss_tracking WHERE user_id = ?
    ''', (user_id,))
    row = cursor.fetchone()
    
    if row:
        return {
            'total_bet': row['total_bet'] or 0,
            'total_win': row['total_win'] or 0,
            'net_loss': row['net_loss'] or 0,
            'games_played': row['games_played'] or 0,
            'forced_loss_count': row['forced_loss_count'] or 0,
            'consecutive_losses': row['consecutive_losses'] or 0
        }
    return {
        'total_bet': 0, 
        'total_win': 0, 
        'net_loss': 0, 
        'games_played': 0,
        'forced_loss_count': 0,
        'consecutive_losses': 0
    }

def update_user_loss(user_id, username, bet_amount, win_amount, is_forced=False):
    """Update data kerugian user"""
    conn = get_db()
    cursor = conn.cursor()
    
    net_change = bet_amount - win_amount
    is_win = win_amount > bet_amount
    
    cursor.execute('''
        INSERT INTO user_loss_tracking (user_id, username, total_bet, total_win, net_loss, games_played, forced_loss_count, consecutive_losses, last_updated)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
            username = excluded.username,
            total_bet = total_bet + excluded.total_bet,
            total_win = total_win + excluded.total_win,
            net_loss = net_loss + excluded.net_loss,
            games_played = games_played + 1,
            forced_loss_count = forced_loss_count + excluded.forced_loss_count,
            consecutive_losses = CASE 
                WHEN ? THEN 0 
                ELSE consecutive_losses + 1 
            END,
            last_updated = CURRENT_TIMESTAMP
    ''', (user_id, username, bet_amount, win_amount, net_change, 1 if is_forced else 0, 
          1 if is_forced else 0, is_win))
    
    conn.commit()

def log_cheat_action(user_id, username, round_hash, action, multiplier_given, expected_multiplier, cheat_intensity, reason):
    """Mencatat aksi kecurangan ke database"""
    profit_data = get_bandar_profit()
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO cheat_log (user_id, username, round_hash, action, multiplier_given, expected_multiplier, 
                               bandar_profit_before, cheat_intensity, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, username, round_hash, action, multiplier_given, expected_multiplier,
          profit_data['profit'], cheat_intensity, reason))
    conn.commit()
    
    print(f"🔴 [CHEAT] {action} - {reason} - User: {username} | Multiplier: {multiplier_given}x | Intensity: {cheat_intensity:.2f}")

def should_activate_cheat():
    """Menentukan apakah sistem curang perlu diaktifkan"""
    profit_data = get_bandar_profit()
    current_profit = profit_data['profit']
    
    if current_profit < TARGET_BANDAR_PROFIT:
        deficit = TARGET_BANDAR_PROFIT - current_profit
        return True, current_profit, deficit
    
    return False, current_profit, 0

def calculate_cheat_intensity():
    """Menghitung intensitas kecurangan berdasarkan defisit profit bandar"""
    profit_data = get_bandar_profit()
    current_profit = profit_data['profit']
    
    if current_profit >= TARGET_BANDAR_PROFIT:
        return 0.0
    
    deficit = TARGET_BANDAR_PROFIT - current_profit
    intensity = min(0.98, 0.5 + (deficit / (TARGET_BANDAR_PROFIT)))
    
    return max(0.0, intensity)

def get_forced_multiplier(risk_level, user_loss_data=None):
    """Mendapatkan multiplier kecil secara paksa"""
    small_mult = SMALL_MULTIPLIERS.get(risk_level, SMALL_MULTIPLIERS['medium'])
    
    if user_loss_data and user_loss_data['net_loss'] > 20:
        mercy_mult = [0.8, 1, 1, 1.2, 1.5, 2]
        chosen = random.choice(mercy_mult)
        return chosen, 'mercy_multiplier'
    
    chosen = random.choice(small_mult)
    return chosen, 'force_small_multiplier'

def get_safe_multiplier(risk_level, bet_amount, current_bandar_profit):
    """Hitung multiplier yang aman untuk bandar"""
    max_safe_multiplier = (current_bandar_profit + bet_amount) / bet_amount
    
    all_multipliers = RISK_MULTIPLIERS.get(risk_level, RISK_MULTIPLIERS['medium'])
    
    safe_multipliers = [m for m in all_multipliers if m <= max_safe_multiplier]
    
    if not safe_multipliers:
        return 0.0, 'force_zero_no_safe_multiplier'
    
    chosen = min(safe_multipliers)
    
    if current_bandar_profit < 5 and chosen > 0.5:
        very_small = [m for m in all_multipliers if m < 0.5]
        if very_small:
            chosen = min(very_small)
            return chosen, 'force_small_due_low_profit'
    
    return chosen, 'safe_multiplier'

def get_random_multiplier_with_cheat(risk_level, bet_amount, user_id, username):
    """SISTEM BANDAR NEVER LOSE - PASTI BANDAR UNTUNG ATAU IMPAS"""
    profit_data = get_bandar_profit()
    current_bandar_profit = profit_data['profit']
    user_loss = get_user_loss(user_id)
    
    is_forced = False
    forced_reason = None
    
    safe_mult, safe_reason = get_safe_multiplier(risk_level, bet_amount, current_bandar_profit)
    
    print(f"📊 [BANDAR CHECK] Current profit: {current_bandar_profit:.2f} TON | Bet: {bet_amount} | Safe multiplier: {safe_mult}x")
    
    roll = random.random()
    
    if roll < 0.95:
        small_mult = SMALL_MULTIPLIERS.get(risk_level, SMALL_MULTIPLIERS['medium'])
        chosen = min(small_mult)
        forced_reason = f'force_small_loss_{safe_reason}'
        is_forced = True
        
        log_cheat_action(
            user_id, username, f"game_{datetime.now().timestamp()}",
            "BANDAR_FORCE_LOSS",
            chosen, safe_mult, 0.95,
            f"Bandar profit before: {current_bandar_profit:.2f} | Forcing {chosen}x"
        )
        
        print(f"🔴 [BANDAR FORCE] {username} forced {chosen}x | Bandar profit before: {current_bandar_profit:.2f}")
        return chosen, is_forced, forced_reason
    
    chosen = safe_mult
    is_forced = True
    forced_reason = f'bandar_protect_{safe_reason}'
    
    print(f"🟡 [BANDAR PROTECT] {username} got {chosen}x (safe multiplier)")
    return chosen, is_forced, forced_reason

def get_bandar_status():
    """Cek status keuangan bandar"""
    profit_data = get_bandar_profit()
    
    status = {
        'current_profit': profit_data['profit'],
        'total_bet': profit_data['total_bet'],
        'total_win': profit_data['total_win'],
        'is_profitable': profit_data['profit'] > 0,
        'profit_margin': (profit_data['profit'] / profit_data['total_bet'] * 100) if profit_data['total_bet'] > 0 else 0
    }
    
    return status

def get_multiplier(risk_level, position=None, user_id=None, username=None, bet_amount=0):
    """Mendapatkan multiplier dengan sistem licik"""
    if user_id and bet_amount > 0:
        multiplier, is_forced, reason = get_random_multiplier_with_cheat(risk_level, bet_amount, user_id, username)
        return multiplier, is_forced, reason
    
    multipliers = RISK_MULTIPLIERS.get(risk_level, RISK_MULTIPLIERS['medium'])
    if position is not None and 0 <= position < len(multipliers):
        return multipliers[position], False, 'normal_position'
    return random.choice(multipliers), False, 'normal_random'

def calculate_win(bet_amount, multiplier):
    """Menghitung jumlah kemenangan"""
    return bet_amount * multiplier

def generate_round_hash():
    """Generate unique round hash"""
    return f"plinko_{datetime.now().strftime('%Y%m%d%H%M%S')}_{random.randint(1000, 9999)}"

def save_game_result(data):
    """Save game result dengan tracking keuntungan bandar"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        print(f"💾 [SAVE] Starting save_game_result with data: {data}")
        
        is_forced = 1 if data.get('is_forced', False) else 0
        cheat_reason = data.get('cheat_reason', '')
        photo_url = data.get('photo_url', None)
        
        # Insert ke plinko_games
        cursor.execute('''
            INSERT INTO plinko_games (round_hash, user_id, username, photo_url, bet_amount, multiplier, win_amount, risk_level, is_forced, cheat_reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['round_hash'],
            data.get('user_id'),
            data.get('username'),
            photo_url,
            data['bet_amount'],
            data['multiplier'],
            data['win_amount'],
            data['risk_level'],
            is_forced,
            cheat_reason,
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ))
        
        print(f"✅ [SAVE] Game inserted successfully, rows affected: {cursor.rowcount}")
        
        # Update bandar profit
        profit_change = update_bandar_profit(data['bet_amount'], data['win_amount'], is_forced)
        
        # Update user loss tracking
        if data.get('user_id'):
            update_user_loss(
                data['user_id'], 
                data.get('username', 'Unknown'), 
                data['bet_amount'], 
                data['win_amount'],
                data.get('is_forced', False)
            )
        
        # Update stats
        cursor.execute('SELECT COUNT(DISTINCT user_id) FROM plinko_games WHERE user_id IS NOT NULL')
        total_players = cursor.fetchone()[0] or 0
        
        cursor.execute('SELECT COUNT(*) FROM plinko_games')
        total_games = cursor.fetchone()[0] or 0
        
        cursor.execute('SELECT MAX(multiplier) FROM plinko_games')
        biggest_multiplier = cursor.fetchone()[0] or 0
        
        cursor.execute('SELECT MAX(win_amount) FROM plinko_games')
        biggest_win = cursor.fetchone()[0] or 0
        
        cursor.execute('SELECT SUM(bet_amount), SUM(win_amount) FROM plinko_games')
        total_bet, total_win = cursor.fetchone()
        
        cursor.execute('''
            SELECT username, created_at FROM plinko_games 
            ORDER BY created_at DESC LIMIT 1
        ''')
        last = cursor.fetchone()
        
        cursor.execute('''
            UPDATE plinko_stats SET
                total_players = ?,
                total_games = ?,
                biggest_multiplier = ?,
                biggest_win = ?,
                total_bet_amount = ?,
                total_win_amount = ?,
                last_player = ?,
                last_time = ?,
                current_hash = ?,
                updated_at = CURRENT_TIMESTAMP
        ''', (
            total_players, total_games, biggest_multiplier, biggest_win,
            total_bet or 0, total_win or 0,
            data.get('username') or (last['username'] if last else None),
            last['created_at'] if last else None,
            data['round_hash']
        ))
        
        conn.commit()
        
        # VERIFIKASI: Cek apakah data tersimpan
        verify_cursor = conn.cursor()
        verify_cursor.execute("SELECT COUNT(*) FROM plinko_games WHERE round_hash = ?", (data['round_hash'],))
        verify_count = verify_cursor.fetchone()[0]
        print(f"🔍 [VERIFY] Game with hash {data['round_hash']} exists: {verify_count > 0}")
        
        profit_data = get_bandar_profit()
        status_emoji = "✅" if profit_data['profit'] >= TARGET_BANDAR_PROFIT else "⚠️"
        print(f"{status_emoji} [BANDAR] Profit: {profit_data['profit']:.2f} TON | Target: {TARGET_BANDAR_PROFIT} TON")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in save_game_result: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False

def get_stats():
    """Get current stats termasuk keuntungan bandar"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT total_players, total_games, biggest_multiplier, biggest_win,
               total_bet_amount, total_win_amount, last_player, last_time, current_hash
        FROM plinko_stats ORDER BY id DESC LIMIT 1
    ''')
    
    row = cursor.fetchone()
    
    cursor.execute('''
        SELECT multiplier, username FROM plinko_games 
        ORDER BY created_at DESC LIMIT 1
    ''')
    last_game = cursor.fetchone()
    
    profit_data = get_bandar_profit()
    
    if row:
        return {
            'total_players': row['total_players'] or 0,
            'total_games': row['total_games'] or 0,
            'biggest_multiplier': row['biggest_multiplier'] or 0,
            'biggest_win': row['biggest_win'] or 0,
            'total_bet_amount': row['total_bet_amount'] or 0,
            'total_win_amount': row['total_win_amount'] or 0,
            'last_player': row['last_player'],
            'last_time': row['last_time'],
            'current_hash': row['current_hash'],
            'last_multiplier': last_game['multiplier'] if last_game else 0,
            'bandar_profit': profit_data['profit'],
            'bandar_total_bet': profit_data['total_bet'],
            'bandar_total_win': profit_data['total_win'],
            'bandar_cheat_count': profit_data['cheat_count'],
            'target_profit': TARGET_BANDAR_PROFIT
        }
    
    return {
        'total_players': 0,
        'total_games': 0,
        'biggest_multiplier': 0,
        'biggest_win': 0,
        'total_bet_amount': 0,
        'total_win_amount': 0,
        'last_player': None,
        'last_time': None,
        'current_hash': None,
        'last_multiplier': 0,
        'bandar_profit': 0,
        'bandar_total_bet': 0,
        'bandar_total_win': 0,
        'bandar_cheat_count': 0,
        'target_profit': TARGET_BANDAR_PROFIT
    }

def get_history(limit=50):
    """Get game history"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT round_hash, user_id, username, photo_url, bet_amount, multiplier, win_amount, risk_level, is_forced, cheat_reason, created_at
        FROM plinko_games
        ORDER BY created_at DESC
        LIMIT ?
    ''', (limit,))
    
    rows = cursor.fetchall()
    conn.close()
    
    result = [dict(row) for row in rows] if rows else []
    print(f"📜 get_history returning {len(result)} records")
    if result:
        print(f"   First record: {result[0]}")
    
    return result

def get_cheat_logs(limit=100):
    """Mendapatkan log kecurangan untuk monitoring"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM cheat_log ORDER BY created_at DESC LIMIT ?
    ''', (limit,))
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

def get_top_losing_users(limit=10):
    """Mendapatkan user dengan kerugian terbesar"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT user_id, username, total_bet, total_win, net_loss, games_played, forced_loss_count
        FROM user_loss_tracking
        ORDER BY net_loss DESC
        LIMIT ?
    ''', (limit,))
    rows = cursor.fetchall()
    return [dict(row) for row in rows]

def reset_bandar_profit():
    """Reset keuntungan bandar (untuk debugging)"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE bandar_profit 
        SET total_bet_all_time = 0, total_win_all_time = 0, bandar_profit = 0, total_cheat_activated = 0, last_updated = CURRENT_TIMESTAMP
    ''')
    conn.commit()
    print("🔄 Bandar profit telah direset")

def set_bandar_target(new_target):
    """Mengubah target keuntungan bandar"""
    global TARGET_BANDAR_PROFIT
    TARGET_BANDAR_PROFIT = new_target
    print(f"🎯 Target bandar profit diubah menjadi {new_target} TON")

# Initialize database on import
init_db()
print("✅ plinko_games.py loaded with BANDAR CHEAT SYSTEM")