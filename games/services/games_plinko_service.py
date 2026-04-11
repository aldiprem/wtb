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
PLINKO_DB_PATH = Path(__file__).parent.parent.parent / 'data' / 'plinko.db'
GAMES_DB_PATH = os.path.join(BASE_DIR, 'database', 'games_data.db')

print(f"📁 Plinko DB Path: {PLINKO_DB_PATH}")
print(f"📁 Games DB Path: {GAMES_DB_PATH}")

# Membuat Blueprint untuk Plinko API
plinko_bp = Blueprint('plinko_bp', __name__, url_prefix='/api/plinko')

def get_current_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def get_plinko_db():
    """Get database connection for plinko.db"""
    PLINKO_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(PLINKO_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_plinko_db():
    """Initialize plinko database tables"""
    conn = get_plinko_db()
    cursor = conn.cursor()
    
    # Games table - menggunakan REAL untuk TON
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plinko_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            round_hash TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            username TEXT,
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
    conn = get_plinko_db()
    cursor = conn.cursor()
    
    # Insert game
    cursor.execute('''
        INSERT INTO plinko_games (round_hash, user_id, username, bet_amount, multiplier, win_amount, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['round_hash'],
        data.get('user_id'),
        data.get('username'),
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
        
        # Update balance (balance dalam TON/REAL)
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

@plinko_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get current plinko stats"""
    init_plinko_db()
    try:
        conn = get_plinko_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT total_players, total_games, biggest_multiplier, biggest_win,
                   total_bet_amount, total_win_amount, last_player, last_time, current_hash
            FROM plinko_stats ORDER BY id DESC LIMIT 1
        ''')
        
        row = cursor.fetchone()
        
        # Get last multiplier dari game terakhir
        cursor.execute('''
            SELECT multiplier, username FROM plinko_games 
            ORDER BY created_at DESC LIMIT 1
        ''')
        last_game = cursor.fetchone()
        
        conn.close()
        
        if row:
            return jsonify({
                "success": True,
                "total_players": row['total_players'] or 0,
                "total_games": row['total_games'] or 0,
                "biggest_multiplier": row['biggest_multiplier'] or 0,
                "biggest_win": row['biggest_win'] or 0,
                "total_bet_amount": row['total_bet_amount'] or 0,
                "total_win_amount": row['total_win_amount'] or 0,
                "last_player": row['last_player'],
                "last_time": row['last_time'],
                "current_hash": row['current_hash'],
                "last_multiplier": last_game['multiplier'] if last_game else 0
            })
        
        return jsonify({
            "success": True,
            "total_players": 0,
            "total_games": 0,
            "biggest_multiplier": 0,
            "biggest_win": 0,
            "total_bet_amount": 0,
            "total_win_amount": 0,
            "last_player": None,
            "last_time": None,
            "current_hash": None,
            "last_multiplier": 0
        })
    except Exception as e:
        print(f"Error getting stats: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/history', methods=['GET'])
def get_history():
    """Get game history"""
    init_plinko_db()
    try:
        limit = request.args.get('limit', 50, type=int)
        conn = get_plinko_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT round_hash, user_id, username, bet_amount, multiplier, win_amount, risk_level, created_at
            FROM plinko_games
            ORDER BY created_at DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            history.append({
                "round_hash": row['round_hash'],
                "user_id": row['user_id'],
                "username": row['username'],
                "bet_amount": row['bet_amount'],
                "multiplier": row['multiplier'],
                "win_amount": row['win_amount'],
                "risk_level": row['risk_level'],
                "created_at": row['created_at']
            })
        
        return jsonify({"success": True, "history": history})
    except Exception as e:
        print(f"Error getting history: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@plinko_bp.route('/save', methods=['POST'])
def save_game():
    """Save game result"""
    init_plinko_db()
    data = request.json
    
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    required_fields = ['bet_amount', 'multiplier', 'win_amount', 'round_hash', 'risk_level']
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "error": f"Missing field: {field}"}), 400
    
    try:
        # Save to plinko database
        save_game_to_plinko_db(data)
        
        # Update user balance if user_id is provided
        if data.get('user_id'):
            # For win: add win_amount, for loss: already deducted before game
            if data['win_amount'] > 0:
                profit = data['win_amount'] - data['bet_amount']
                if profit > 0:
                    update_user_balance(data['user_id'], profit)
            
            # Update game history
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

@plinko_bp.route('/play', methods=['POST'])
def play_game():
    """Play a plinko game - calculate result"""
    data = request.json
    
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    bet_amount = data.get('bet_amount', 0)
    risk_level = data.get('risk_level', 'medium')
    position = data.get('position', None)  # Optional: specific position
    
    if bet_amount <= 0:
        return jsonify({"success": False, "error": "Invalid bet amount"}), 400
    
    # Get multiplier
    if position is not None:
        multiplier = get_multiplier(risk_level, position)
    else:
        # Random position
        multipliers = RISK_MULTIPLIERS.get(risk_level, RISK_MULTIPLIERS['medium'])
        position = random.randint(0, len(multipliers) - 1)
        multiplier = multipliers[position]
    
    win_amount = calculate_win(bet_amount, multiplier)
    round_hash = generate_round_hash()
    
    return jsonify({
        "success": True,
        "multiplier": multiplier,
        "win_amount": win_amount,
        "position": position,
        "round_hash": round_hash,
        "risk_level": risk_level
    })

@plinko_bp.route('/balance/<int:telegram_id>', methods=['GET'])
def get_balance(telegram_id):
    """Get user balance from games database"""
    try:
        balance = get_user_balance(telegram_id)
        return jsonify({"success": True, "balance": balance})
    except Exception as e:
        print(f"Error getting balance: {e}")
        return jsonify({"success": True, "balance": 0.0})

@plinko_bp.route('/deduct-balance', methods=['POST'])
def deduct_balance():
    """Deduct user balance for bet"""
    data = request.json
    telegram_id = data.get('telegram_id')
    amount = data.get('amount', 0)
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id required"}), 400
    
    if amount <= 0:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    current_balance = get_user_balance(telegram_id)
    
    if current_balance < amount:
        return jsonify({"success": False, "error": f"Insufficient balance. Your balance: {current_balance:.2f} TON"}), 400
    
    if update_user_balance(telegram_id, -amount):
        new_balance = get_user_balance(telegram_id)
        return jsonify({"success": True, "new_balance": new_balance})
    
    return jsonify({"success": False, "error": "Failed to deduct balance"}), 500

@plinko_bp.route('/add-balance', methods=['POST'])
def add_balance():
    """Add user balance for win"""
    data = request.json
    telegram_id = data.get('telegram_id')
    amount = data.get('amount', 0)
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id required"}), 400
    
    if amount <= 0:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    if update_user_balance(telegram_id, amount):
        new_balance = get_user_balance(telegram_id)
        return jsonify({"success": True, "new_balance": new_balance})
    
    return jsonify({"success": False, "error": "Failed to add balance"}), 500

@plinko_bp.route('/multipliers', methods=['GET'])
def get_multipliers():
    """Get all risk multipliers configuration"""
    return jsonify({
        "success": True,
        "multipliers": RISK_MULTIPLIERS
    })

# Initialize database on import
init_plinko_db()