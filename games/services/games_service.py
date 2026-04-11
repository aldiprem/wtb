# games/services/games_service.py

from flask import Blueprint, jsonify, request
import sys
import os
import sqlite3
import traceback # Tambahan untuk melihat detail error di terminal

# Tambah path biar bisa import database
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from games.database.games import get_or_create_user, add_game_history, update_user_balance

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

@games_bp.route('/verify-ton-deposit', methods=['POST'])
def verify_ton_deposit():
    """Verifikasi deposit TON - REAL dengan update balance"""
    data = request.json
    telegram_id = data.get('telegram_id')
    transaction_hash = data.get('transaction_hash')
    amount_ton = data.get('amount_ton')
    from_address = data.get('from_address')
    memo = data.get('memo', '')
    
    if not telegram_id or not transaction_hash:
        return jsonify({"success": False, "error": "Missing required fields"}), 400
    
    try:
        # Pastikan database terinisialisasi
        from games.database.games import init_db
        init_db()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Cek apakah transaksi sudah diproses (berdasarkan transaction_hash)
        cursor.execute("SELECT id FROM game_history WHERE win_amount = ? AND game_name = ?", (amount_ton * 100, 'DEPOSIT_TON'))
        existing = cursor.fetchone()
        
        if existing:
            conn.close()
            return jsonify({"success": False, "error": "Transaction already processed"}), 400
        
        # Convert TON ke IDR (rate 1 TON = 10000 IDR)
        amount_idr = int(amount_ton * 10000)
        
        # Update balance user (tambah saldo)
        cursor.execute('''
            UPDATE users 
            SET balance = balance + ? 
            WHERE telegram_id = ?
        ''', (amount_idr, telegram_id))
        
        # Cek apakah update berhasil
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({"success": False, "error": "User not found"}), 404
        
        # Catat transaksi deposit di game_history
        cursor.execute('''
            INSERT INTO game_history (telegram_id, game_name, bet_amount, win_amount, multiplier, played_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (telegram_id, 'DEPOSIT_TON', amount_idr, amount_idr, 1.0, get_current_time()))
        
        conn.commit()
        
        # Ambil balance terbaru
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        new_balance = cursor.fetchone()[0]
        
        conn.close()
        
        print(f"✅ TON Deposit verified: {amount_ton} TON for user {telegram_id} -> +{amount_idr} IDR")
        print(f"   New balance: {new_balance} IDR")
        
        return jsonify({
            "success": True,
            "message": f"Deposit {amount_ton} TON berhasil",
            "amount_idr": amount_idr,
            "new_balance": new_balance
        })
        
    except Exception as e:
        print(f"❌ Error verifying TON deposit: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
    
@games_bp.route('/api/user/wallet', methods=['POST'])
def update_wallet():
    """Update user's wallet address"""
    data = request.json
    telegram_id = data.get('telegram_id')
    wallet_address = data.get('wallet_address')
    
    if not telegram_id:
        return jsonify({'success': False, 'error': 'telegram_id required'}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE users 
            SET wallet_address = ?, updated_at = CURRENT_TIMESTAMP
            WHERE telegram_id = ?
        ''', (wallet_address, telegram_id))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
# games/services/games_service.py - TAMBAHKAN ROUTE INI

@games_bp.route('/user/wallet', methods=['POST'])
def update_user_wallet():
    """Update user's wallet address di database games"""
    data = request.json
    telegram_id = data.get('telegram_id')
    wallet_address = data.get('wallet_address')
    
    if not telegram_id:
        return jsonify({'success': False, 'error': 'telegram_id required'}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Cek apakah kolom wallet_address ada di tabel users
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'wallet_address' not in columns:
            # Tambahkan kolom wallet_address jika belum ada
            cursor.execute('ALTER TABLE users ADD COLUMN wallet_address TEXT DEFAULT NULL')
            print("✅ Kolom wallet_address ditambahkan ke tabel users")
        
        # Update wallet address
        cursor.execute('''
            UPDATE users 
            SET wallet_address = ?
            WHERE telegram_id = ?
        ''', (wallet_address, telegram_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Wallet address updated'})
        
    except Exception as e:
        print(f"❌ Error updating wallet: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@games_bp.route('/user/wallet/<int:telegram_id>', methods=['GET'])
def get_user_wallet(telegram_id):
    """Get user's wallet address"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Cek kolom wallet_address
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'wallet_address' not in columns:
            return jsonify({'success': True, 'wallet_address': None})
        
        cursor.execute('SELECT wallet_address FROM users WHERE telegram_id = ?', (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        
        wallet_address = row[0] if row else None
        return jsonify({'success': True, 'wallet_address': wallet_address})
        
    except Exception as e:
        print(f"❌ Error getting wallet: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500