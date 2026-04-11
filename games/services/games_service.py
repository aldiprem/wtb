# games/services/games_service.py

import os
from flask import Blueprint, jsonify, request

# Import fungsi database
from games.database.games import get_or_create_user

# Membuat Blueprint
games_bp = Blueprint('games_bp', __name__)

# API Route untuk Authentikasi dan Sinkronisasi User Data dari Telegram
@games_bp.route('/api/games/auth', methods=['POST'])
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
        # Panggil database untuk get/create user dan kembalikan balance aslinya
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