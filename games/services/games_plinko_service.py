# games/services/games_plinko_service.py - PERBAIKAN ENDPOINT SAVE

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
    os.makedirs(os.path.dirname(PLINKO_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(str(PLINKO_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_plinko_db():
    """Initialize plinko database tables"""
    try:
        conn = get_plinko_db()
        cursor = conn.cursor()
        
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
        print(f"❌ Error in get_stats: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/history', methods=['GET', 'OPTIONS'])
def get_history():
    if request.method == 'OPTIONS':
        return _build_cors_preflight_response()
    
    try:
        limit = request.args.get('limit', 50, type=int)
        
        print(f"🔍 Getting history with limit: {limit}")
        print(f"🔍 Database path: {PLINKO_DB_PATH}")
        
        history = get_cheat_history(limit)
        
        print(f"📜 History fetched: {len(history)} records")
        if len(history) > 0:
            print(f"   First record: {history[0]}")
        
        return jsonify({"success": True, "history": history})
    except Exception as e:
        print(f"❌ Error in get_history: {e}")
        traceback.print_exc()
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
        print(f"📝 [SAVE GAME] Received data: {data}")
        
        # PASTIKAN data memiliki semua field yang diperlukan
        required_fields = ['bet_amount', 'multiplier', 'win_amount', 'round_hash', 'risk_level']
        for field in required_fields:
            if field not in data:
                print(f"❌ Missing required field: {field}")
                return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400
        
        # Simpan pakai cheat system
        save_result = save_game_result(data)
        
        if not save_result:
            print(f"❌ save_game_result returned False")
            return jsonify({"success": False, "error": "Failed to save game to database"}), 500
        
        print(f"✅ Game saved successfully via save_game_result")
        
        # VERIFIKASI: Cek apakah data benar-benar tersimpan
        history_check = get_cheat_history(1)
        print(f"📜 Last game in DB after save: {history_check[0] if history_check else 'None'}")
        
        return jsonify({"success": True, "message": "Game saved successfully"})
    except Exception as e:
        print(f"❌ Error saving game: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

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
            print(f"💰 Deducted {amount} TON from user {telegram_id}, new balance: {new_balance}")
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
            print(f"💰 Added {amount} TON to user {telegram_id}, new balance: {new_balance}")
            return jsonify({"success": True, "new_balance": new_balance})
        
        return jsonify({"success": False, "error": "Failed to add balance"}), 500
    except Exception as e:
        print(f"Error in add_balance: {e}")
        traceback.print_exc()
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
    
    # net_change HARUS positif (win amount)
    if net_change < 0:
        print(f"⚠️ Ignoring negative net_change: {net_change} - bet already deducted")
        return jsonify({"success": True, "message": "Ignored negative change", "net_change": 0})
    
    try:
        if update_user_balance(telegram_id, net_change):
            new_balance = get_user_balance(telegram_id)
            print(f"💰 Added win {net_change} TON to user {telegram_id}, new balance: {new_balance}")
            return jsonify({"success": True, "new_balance": new_balance, "net_change": net_change})
        
        return jsonify({"success": False, "error": "Failed to update balance"}), 500
    except Exception as e:
        print(f"Error in update_net_balance: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/debug/count', methods=['GET'])
def debug_count():
    """Cek jumlah data di database"""
    try:
        conn = get_plinko_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM plinko_games")
        count = cursor.fetchone()[0]
        conn.close()
        print(f"🔍 Debug count: {count} games in database")
        return jsonify({"success": True, "count": count})
    except Exception as e:
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
print("✅ games_plinko_service.py loaded successfully")