# games/services/games_service.py

from flask import Blueprint, jsonify, request
import sys
import os
import sqlite3
import traceback # Tambahan untuk melihat detail error di terminal

# Tambah path biar bisa import database
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from games.database.games import get_or_create_user

# Membuat Blueprint untuk API
games_bp = Blueprint('games_bp', __name__, url_prefix='/api/games')
DB_PATH = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'games_data.db')

# API Route untuk Authentikasi dan Sinkronisasi User Data dari Telegram
@games_bp.route('/auth', methods=['POST'])
def auth_user():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Tidak ada data yang dikirim"}), 400
        
    telegram_id = data.get('telegram_id')
    username = data.get('username', 'Unknown')
    first_name = data.get('first_name', 'Guest')
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id diperlukan"}), 400
    
    try:
        # PERBAIKAN: get_or_create_user sekarang mengembalikan DICTIONARY (Data Lengkap)
        user_data = get_or_create_user(telegram_id, username, first_name)
        
        return jsonify({
            "success": True,
            "telegram_id": telegram_id,
            "username": username,
            # Ambil spesifik 'balance' dari dictionary untuk ditampilkan di UI
            "balance": user_data['balance'] 
        })
    except Exception as e:
        print("❌ Error DB Games Auth:")
        traceback.print_exc() # Menampilkan error log yang sangat detail di terminal
        return jsonify({"success": False, "error": str(e)}), 500

# API untuk update balance setelah main game
@games_bp.route('/update-balance', methods=['POST'])
def update_balance():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Tidak ada data"}), 400
    
    telegram_id = data.get('telegram_id')
    new_balance = data.get('new_balance')
    
    if not telegram_id or new_balance is None:
        return jsonify({"success": False, "error": "Missing required fields"}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET balance = ? WHERE telegram_id = ?", (new_balance, telegram_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@games_bp.route('/balance/<int:telegram_id>', methods=['GET'])
def get_balance(telegram_id):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({"success": True, "balance": row[0]})
        else:
            # KALAU USER TIDAK DITEMUKAN, TETAP KIRIM 0 BUKAN ERROR
            return jsonify({"success": True, "balance": 0})
    except Exception as e:
        return jsonify({"success": True, "balance": 0})
    
# Tambahkan ini ke games/services/games_service.py

@games_bp.route('/user-stats/<int:telegram_id>', methods=['GET'])
def get_user_stats(telegram_id):
    """Get total gifts dan referral reward user"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT gifts, referral_reward FROM users WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({
                "success": True,
                "gifts": row['gifts'] or 0,
                "referral_reward": row['referral_reward'] or 0
            })
        else:
            return jsonify({"success": True, "gifts": 0, "referral_reward": 0})
    except Exception as e:
        return jsonify({"success": True, "gifts": 0, "referral_reward": 0})

@games_bp.route('/user-history/<int:telegram_id>', methods=['GET'])
def get_user_game_history(telegram_id):
    """Get riwayat game user dari game_history"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('''
            SELECT game_name, bet_amount, win_amount, multiplier, played_at 
            FROM game_history 
            WHERE telegram_id = ? 
            ORDER BY played_at DESC 
            LIMIT 50
        ''', (telegram_id,))
        rows = cursor.fetchall()
        conn.close()
        
        history = [dict(row) for row in rows]
        return jsonify({"success": True, "history": history})
    except Exception as e:
        return jsonify({"success": True, "history": []})

@games_bp.route('/deposit', methods=['POST'])
def process_deposit():
    """Endpoint deposit (integrasi dengan payment nanti)"""
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "No data"}), 400
    
    telegram_id = data.get('telegram_id')
    amount = data.get('amount')
    
    if not telegram_id or not amount or amount < 10000:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Update balance
        cursor.execute("UPDATE users SET balance = balance + ? WHERE telegram_id = ?", (amount, telegram_id))
        
        # Catat transaksi
        cursor.execute('''
            INSERT INTO game_history (telegram_id, game_name, bet_amount, win_amount, multiplier, played_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (telegram_id, 'DEPOSIT', amount, amount, 1.0, get_current_time()))
        
        conn.commit()
        conn.close()
        
        return jsonify({"success": True, "message": f"Deposit {amount} berhasil"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500