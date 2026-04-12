# games/services/games_plinko_service.py - LENGKAP DENGAN CHEAT SYSTEM

from flask import Blueprint, jsonify, request
import sys
import os
import sqlite3
import json
import random
import traceback
from datetime import datetime
from pathlib import Path

# Import cheat system dari plinko_games.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database.plinko_games import (
    get_multiplier, calculate_win, generate_round_hash, save_game_result,
    get_stats as get_cheat_stats, get_history as get_cheat_history,
    get_bandar_profit, TARGET_BANDAR_PROFIT
)

# Konfigurasi path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLINKO_DB_PATH = os.path.join(BASE_DIR, 'database', 'plinko.db')
GAMES_DB_PATH = os.path.join(BASE_DIR, 'database', 'games_data.db')

print(f"📁 Plinko DB Path: {PLINKO_DB_PATH}")
print(f"📁 Games DB Path: {GAMES_DB_PATH}")
print("🎰 Plinko Service with CHEAT SYSTEM enabled")

# Pastikan direktori database ada
os.makedirs(os.path.dirname(PLINKO_DB_PATH), exist_ok=True)
os.makedirs(os.path.dirname(GAMES_DB_PATH), exist_ok=True)

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
        
        # Cek dan tambah kolom jika belum ada
        cursor.execute("PRAGMA table_info(plinko_games)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_forced' not in existing_columns:
            cursor.execute("ALTER TABLE plinko_games ADD COLUMN is_forced BOOLEAN DEFAULT 0")
            print("✅ Kolom is_forced ditambahkan ke plinko_games")
        
        if 'cheat_reason' not in existing_columns:
            cursor.execute("ALTER TABLE plinko_games ADD COLUMN cheat_reason TEXT")
            print("✅ Kolom cheat_reason ditambahkan ke plinko_games")
        
        if 'photo_url' not in existing_columns:
            cursor.execute("ALTER TABLE plinko_games ADD COLUMN photo_url TEXT")
            print("✅ Kolom photo_url ditambahkan ke plinko_games")
        
        # Insert default stats if empty
        cursor.execute('SELECT COUNT(*) FROM plinko_stats')
        if cursor.fetchone()[0] == 0:
            cursor.execute('''
                INSERT INTO plinko_stats (total_players, total_games, current_hash)
                VALUES (0, 0, ?)
            ''', (datetime.now().strftime('%Y%m%d%H%M%S'),))
        
        conn.commit()
        conn.close()
        print("✅ Plinko database initialized")
        return True
    except Exception as e:
        print(f"❌ Error initializing plinko DB: {e}")
        traceback.print_exc()
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

# ==================== API ENDPOINTS (dengan CHEAT SYSTEM) ====================

@plinko_bp.route('/stats', methods=['GET', 'OPTIONS'])
def get_stats():
    """Get current plinko stats termasuk profit bandar"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    init_plinko_db()
    try:
        # Gunakan cheat stats dari plinko_games.py
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
            "bandar_total_bet": stats.get('bandar_total_bet', 0),
            "bandar_total_win": stats.get('bandar_total_win', 0),
            "bandar_cheat_count": stats.get('bandar_cheat_count', 0),
            "bandar_target": TARGET_BANDAR_PROFIT
        })
    except Exception as e:
        print(f"Error getting stats: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/history', methods=['GET', 'OPTIONS'])
def get_history():
    """Get game history"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    init_plinko_db()
    try:
        limit = request.args.get('limit', 50, type=int)
        # Gunakan cheat history dari plinko_games.py
        history = get_cheat_history(limit)
        return jsonify({"success": True, "history": history})
    except Exception as e:
        print(f"Error getting history: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/save', methods=['POST', 'OPTIONS'])
def save_game():
    """Save game result - MENGGUNAKAN CHEAT SYSTEM"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    init_plinko_db()
    data = request.json
    
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    required_fields = ['bet_amount', 'multiplier', 'win_amount', 'round_hash', 'risk_level']
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "error": f"Missing field: {field}"}), 400
    
    try:
        # Simpan ke database plinko dengan cheat system
        save_game_result(data)
        
        # Update balance user (hanya jika menang)
        if data.get('user_id'):
            if data['win_amount'] > data['bet_amount']:
                profit = data['win_amount'] - data['bet_amount']
                if profit > 0:
                    update_user_balance(data['user_id'], profit)
            
            # Catat history
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
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/play', methods=['POST', 'OPTIONS'])
def play_game():
    """Play a plinko game - MENGGUNAKAN CHEAT SYSTEM untuk multiplier"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    init_plinko_db()
    data = request.json
    
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    bet_amount = data.get('bet_amount', 0)
    risk_level = data.get('risk_level', 'medium')
    user_id = data.get('user_id')
    username = data.get('username', 'Anonymous')
    
    if bet_amount <= 0:
        return jsonify({"success": False, "error": "Invalid bet amount"}), 400
    
    # 🔥 PAKAI CHEAT SYSTEM dari plinko_games.py
    multiplier, is_forced, cheat_reason = get_multiplier(
        risk_level, 
        position=None,
        user_id=user_id,
        username=username,
        bet_amount=bet_amount
    )
    
    win_amount = calculate_win(bet_amount, multiplier)
    round_hash = generate_round_hash()
    
    # Log jika cheat aktif
    if is_forced:
        print(f"🔴 [CHEAT] Game forced for {username}: {multiplier}x (reason: {cheat_reason})")
    
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
    
    from database.plinko_games import RISK_MULTIPLIERS
    return jsonify({
        "success": True,
        "multipliers": RISK_MULTIPLIERS
    })

@plinko_bp.route('/bandar-status', methods=['GET', 'OPTIONS'])
def get_bandar_status():
    """Endpoint untuk cek status bandar (admin/debug)"""
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        profit_data = get_bandar_profit()
        return jsonify({
            "success": True,
            "total_bet": profit_data['total_bet'],
            "total_win": profit_data['total_win'],
            "bandar_profit": profit_data['profit'],
            "target_profit": TARGET_BANDAR_PROFIT,
            "is_profit_achieved": profit_data['profit'] >= TARGET_BANDAR_PROFIT,
            "deficit": max(0, TARGET_BANDAR_PROFIT - profit_data['profit']),
            "cheat_count": profit_data['cheat_count']
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

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
    
    # Hanya proses net_change positif (kemenangan)
    if net_change < 0:
        print(f"⚠️ Ignoring negative net_change: {net_change}")
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

# Initialize database on import
init_plinko_db()
print("✅ games_plinko_service.py loaded with CHEAT SYSTEM integration")