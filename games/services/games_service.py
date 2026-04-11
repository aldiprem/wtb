# games/services/games_service.py

from flask import Blueprint, jsonify, request
import sys
import os

# Tambah path biar bisa import database
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from games.database.games import (
    get_or_create_user, 
    get_user_data, 
    update_user_stats, 
    delete_user_data
)

# Membuat Blueprint untuk API
games_bp = Blueprint('games_bp', __name__, url_prefix='/api/games')

# 1. API: Authentikasi / Tambah User / Update Last Seen
@games_bp.route('/auth', methods=['POST'])
def auth_user():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Tidak ada data yang dikirim"}), 400
        
    telegram_id = data.get('telegram_id')
    username = data.get('username', 'Unknown')
    first_name = data.get('first_name', 'Guest')
    referred_by = data.get('referred_by', None) # Untuk link undangan
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id diperlukan"}), 400
    
    try:
        # Fungsi ini otomatis update last_seen, atau buat user baru jika belum ada
        user = get_or_create_user(telegram_id, username, first_name, referred_by)
        
        return jsonify({
            "success": True,
            "data": user
        })
    except Exception as e:
        print(f"❌ Error DB Games Auth: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# 2. API: Mendapatkan Data Lengkap User
@games_bp.route('/user/<int:telegram_id>', methods=['GET'])
def get_user_detail(telegram_id):
    try:
        user = get_user_data(telegram_id)
        if user:
            return jsonify({"success": True, "data": user})
        else:
            return jsonify({"success": False, "error": "User tidak ditemukan"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# 3. API: Memperbarui Status User (Balance, Referral, Gifts)
@games_bp.route('/user/update', methods=['POST'])
def update_user():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Tidak ada data"}), 400
    
    telegram_id = data.get('telegram_id')
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id diperlukan"}), 400
    
    balance = data.get('balance')
    referral_reward = data.get('referral_reward')
    gifts = data.get('gifts')
    
    try:
        success = update_user_stats(telegram_id, balance=balance, referral_reward=referral_reward, gifts=gifts)
        
        if success:
            return jsonify({"success": True, "message": "Data berhasil diperbarui"})
        else:
            return jsonify({"success": False, "error": "User tidak ditemukan atau tidak ada data yang diubah"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# 4. API: Menghapus User dari Database
@games_bp.route('/user/<int:telegram_id>', methods=['DELETE'])
def delete_user(telegram_id):
    try:
        success = delete_user_data(telegram_id)
        if success:
            return jsonify({"success": True, "message": f"User {telegram_id} berhasil dihapus"})
        else:
            return jsonify({"success": False, "error": "User tidak ditemukan"}), 404
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500