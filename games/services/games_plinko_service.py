# games/services/games_plinko_service.py
from flask import Blueprint, jsonify, request
import sys
import os
import sqlite3
import json
import random
import traceback
from datetime import datetime
from pathlib import Path

# Konfigurasi path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLINKO_DB_PATH = os.path.join(BASE_DIR, 'database', 'plinko.db')
GAMES_DB_PATH = os.path.join(BASE_DIR, 'database', 'games_data.db')

print(f"📁 Plinko DB Path: {PLINKO_DB_PATH}")
print(f"📁 Games DB Path: {GAMES_DB_PATH}")

# Pastikan direktori database ada
os.makedirs(os.path.dirname(PLINKO_DB_PATH), exist_ok=True)
os.makedirs(os.path.dirname(GAMES_DB_PATH), exist_ok=True)

import importlib.util
spec = importlib.util.spec_from_file_location(
    "plinko_games",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'database', 'plinko_games.py')
)
plinko_games_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plinko_games_module)

cheat_get_multiplier = plinko_games_module.get_multiplier
calculate_win = plinko_games_module.calculate_win
generate_round_hash = plinko_games_module.generate_round_hash
save_game_result = plinko_games_module.save_game_result
get_cheat_stats = plinko_games_module.get_stats
get_cheat_history = plinko_games_module.get_history
get_bandar_profit = plinko_games_module.get_bandar_profit
TARGET_BANDAR_PROFIT = plinko_games_module.TARGET_BANDAR_PROFIT

# Membuat Blueprint untuk Plinko API
plinko_bp = Blueprint('plinko_bp', __name__, url_prefix='/api/plinko')

def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_plinko_db():
    """Get database connection for plinko.db"""
    conn = sqlite3.connect(str(PLINKO_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_plinko_db():
    """Initialize plinko database tables"""
    try:
        conn = get_plinko_db()
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

        # Cek dan tambah kolom photo_url jika belum ada
        cursor.execute("PRAGMA table_info(plinko_games)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        if 'photo_url' not in existing_columns:
            cursor.execute("ALTER TABLE plinko_games ADD COLUMN photo_url TEXT")
            print("✅ Kolom photo_url ditambahkan ke plinko_games")

        conn.commit()
        conn.close()
        print("✅ Plinko database initialized")
        return True
    except Exception as e:
        print(f"❌ Error initializing plinko DB: {e}")
        traceback.print_exc()
        return False

# Risk multipliers configuration
RISK_MULTIPLIERS = {
    'low': [5, 4, 3, 2, 1, 0.5, 1, 2, 3, 4, 5],
    'medium': [15, 10, 5, 2.5, 1, 0.2, 1, 2.5, 5, 10, 15],
    'high': [20, 10, 2, 1.5, 0.8, 0.5, 0.1, 0.0, 0.1, 0.5, 0.8, 1.5, 2, 10, 20]
}

def get_multiplier(risk_level, position):
    """Get multiplier based on risk level and position"""
    multipliers = RISK_MULTIPLIERS.get(risk_level, RISK_MULTIPLIERS['medium'])
    if position < 0 or position >= len(multipliers):
        position = random.randint(0, len(multipliers) - 1)
    return multipliers[position]

def calculate_win(bet_amount, multiplier):
    """Calculate win amount"""
    return bet_amount * multiplier

def generate_round_hash():
    """Generate unique round hash"""
    return f"plinko_{datetime.now().strftime('%Y%m%d%H%M%S')}_{random.randint(1000, 9999)}"

def save_game_to_plinko_db(data):
    """Save game result to plinko database"""
    try:
        conn = get_plinko_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO plinko_games (round_hash, user_id, username, photo_url, bet_amount, multiplier, win_amount, risk_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data['round_hash'],
            data.get('user_id'),
            data.get('username'),
            data.get('photo_url'),
            data['bet_amount'],
            data['multiplier'],
            data['win_amount'],
            data['risk_level']
        ))
        
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
                updated_at = ?
        ''', (
            total_players, total_games, biggest_multiplier, biggest_win,
            total_bet or 0, total_win or 0,
            last['username'] if last else None,
            last['created_at'] if last else None,
            data['round_hash'],
            get_current_time()
        ))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error saving to plinko DB: {e}")
        traceback.print_exc()
        return False

def update_game_history(telegram_id, game_name, bet_amount, win_amount, multiplier):
    """Update game history in games database"""
    try:
        conn = sqlite3.connect(GAMES_DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO game_history (telegram_id, game_name, bet_amount, win_amount, multiplier, played_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (telegram_id, game_name, bet_amount, win_amount, multiplier, get_current_time()))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating game history: {e}")
        return False

def update_user_balance(telegram_id, amount_change):
    """Update user balance in games database (dalam TON)"""
    try:
        conn = sqlite3.connect(GAMES_DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE users 
            SET balance = balance + ? 
            WHERE telegram_id = ?
        ''', (float(amount_change), telegram_id))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        print(f"Error updating balance: {e}")
        traceback.print_exc()
        return False

def get_user_balance(telegram_id):
    """Get user balance from games database (dalam TON)"""
    try:
        conn = sqlite3.connect(GAMES_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        return float(row[0]) if row and row[0] is not None else 0.0
    except Exception as e:
        print(f"Error getting balance: {e}")
        return 0.0

# ==================== API ENDPOINTS ====================
@plinko_bp.route('/stats', methods=['GET', 'OPTIONS'])
def get_stats():
    """Get current plinko stats termasuk profit bandar"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        stats = get_cheat_stats()
        return jsonify({
            "success": True,
            "total_players": stats.get('total_players', 0),
            "total_games": stats.get('total_games', 0),
            "biggest_multiplier": stats.get('biggest_multiplier', 0),
            "biggest_win": stats.get('biggest_win', 0),
            "total_bet_amount": stats.get('total_bet_amount', 0),
            "total_win_amount": stats.get('total_win_amount', 0),
            "last_player": stats.get('last_player'),
            "last_time": stats.get('last_time'),
            "current_hash": stats.get('current_hash'),
            "last_multiplier": stats.get('last_multiplier', 0),
            "bandar_profit": stats.get('bandar_profit', 0),
            "bandar_target": TARGET_BANDAR_PROFIT
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/history', methods=['GET', 'OPTIONS'])
def get_history():
    """Get game history"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        limit = request.args.get('limit', 50, type=int)
        history = get_cheat_history(limit)
        return jsonify({"success": True, "history": history})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/save', methods=['POST', 'OPTIONS'])
def save_game():
    """Save game result - MENGGUNAKAN CHEAT SYSTEM"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    data = request.json
    
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    try:
        # Simpan pakai cheat system
        save_game_result(data)
        
        if data.get('user_id'):
            if data['win_amount'] > data['bet_amount']:
                profit = data['win_amount'] - data['bet_amount']
                if profit > 0:
                    update_user_balance(data['user_id'], profit)
            
            update_game_history(
                data['user_id'],
                'Plinko',
                data['bet_amount'],
                data['win_amount'],
                data['multiplier']
            )
        
        return jsonify({"success": True, "message": "Game saved successfully"})
    except Exception as e:
        print(f"Error saving game: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/play', methods=['POST', 'OPTIONS'])
def play_game():
    """Play a plinko game - MENGGUNAKAN CHEAT SYSTEM"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    data = request.json
    
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    bet_amount = data.get('bet_amount', 0)
    risk_level = data.get('risk_level', 'medium')
    user_id = data.get('user_id')
    username = data.get('username', 'Anonymous')
    
    if bet_amount <= 0:
        return jsonify({"success": False, "error": "Invalid bet amount"}), 400
    
    # PAKAI CHEAT SYSTEM
    multiplier, is_forced, cheat_reason = cheat_get_multiplier(
        risk_level, 
        position=None,
        user_id=user_id,
        username=username,
        bet_amount=bet_amount
    )
    
    win_amount = calculate_win(bet_amount, multiplier)
    round_hash = generate_round_hash()
    
    if is_forced:
        print(f"🔴 [CHEAT] {username}: {multiplier}x ({cheat_reason})")
    
    return jsonify({
        "success": True,
        "multiplier": multiplier,
        "win_amount": win_amount,
        "position": None,
        "round_hash": round_hash,
        "risk_level": risk_level,
        "is_forced": is_forced,
        "cheat_reason": cheat_reason
    })

@plinko_bp.route('/balance/<int:telegram_id>', methods=['GET', 'OPTIONS'])
def get_balance(telegram_id):
    """Get user balance from games database"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        balance = get_user_balance(telegram_id)
        return jsonify({"success": True, "balance": balance})
    except Exception as e:
        print(f"Error getting balance: {e}")
        return jsonify({"success": True, "balance": 0.0})

@plinko_bp.route('/deduct-balance', methods=['POST', 'OPTIONS'])
def deduct_balance():
    """Deduct user balance for bet"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    telegram_id = data.get('telegram_id')
    amount = data.get('amount', 0)
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id required"}), 400
    
    if amount <= 0:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    try:
        current_balance = get_user_balance(telegram_id)
        
        if current_balance < amount:
            return jsonify({"success": False, "error": f"Insufficient balance. Your balance: {current_balance:.2f} TON"}), 400
        
        # PERBAIKAN: Pastikan amount dikonversi ke float dengan benar
        if update_user_balance(telegram_id, -float(amount)):
            new_balance = get_user_balance(telegram_id)
            return jsonify({"success": True, "new_balance": new_balance, "deducted": amount})
        
        return jsonify({"success": False, "error": "Failed to deduct balance"}), 500
    except Exception as e:
        print(f"Error in deduct_balance: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/add-balance', methods=['POST', 'OPTIONS'])
def add_balance():
    """Add user balance for win"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    telegram_id = data.get('telegram_id')
    amount = data.get('amount', 0)
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id required"}), 400
    
    if amount <= 0:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    try:
        if update_user_balance(telegram_id, amount):
            new_balance = get_user_balance(telegram_id)
            return jsonify({"success": True, "new_balance": new_balance})
        
        return jsonify({"success": False, "error": "Failed to add balance"}), 500
    except Exception as e:
        print(f"Error in add_balance: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/multipliers', methods=['GET', 'OPTIONS'])
def get_multipliers():
    """Get all risk multipliers configuration"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    return jsonify({
        "success": True,
        "multipliers": RISK_MULTIPLIERS
    })

def _build_cors_preflight_response():
    """Build CORS preflight response"""
    response = jsonify({"success": True})
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type")
    response.headers.add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    return response

@plinko_bp.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

@plinko_bp.route('/update-net-balance', methods=['POST', 'OPTIONS'])
def update_net_balance():
    """Update user balance with net change (HANYA TAMBAHAN WIN)"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    telegram_id = data.get('telegram_id')
    net_change = data.get('net_change', 0)
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id required"}), 400
    
    if net_change == 0:
        return jsonify({"success": True, "message": "No change"})
    
    # PERBAIKAN: net_change HARUS positif (win amount)
    # Jika net_change negatif, abaikan karena bet sudah dipotong di awal
    if net_change < 0:
        print(f"⚠️ Ignoring negative net_change: {net_change} - bet already deducted")
        return jsonify({"success": True, "message": "Ignored negative change", "net_change": 0})
    
    try:
        if update_user_balance(telegram_id, net_change):
            new_balance = get_user_balance(telegram_id)
            return jsonify({"success": True, "new_balance": new_balance, "net_change": net_change})
        
        return jsonify({"success": False, "error": "Failed to update balance"}), 500
    except Exception as e:
        print(f"Error in update_net_balance: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Initialize database on import
init_plinko_db()
print("✅ games_plinko_service.py loaded successfully")