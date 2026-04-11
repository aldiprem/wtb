# games/services/games_service.py

from flask import Blueprint, jsonify, request
import sys
import os
import sqlite3

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
        balance = get_or_create_user(telegram_id, username, first_name)
        
        return jsonify({
            "success": True,
            "telegram_id": telegram_id,
            "username": username,
            "balance": balance
        })
    except Exception as e:
        print(f"❌ Error DB Games Auth: {e}")
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

# API untuk get user balance
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
            return jsonify({"success": False, "error": "User not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500