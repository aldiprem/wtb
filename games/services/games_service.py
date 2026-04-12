# games/services/games_service.py - VERSION FINAL

from flask import Blueprint, jsonify, request
import sys
import os
import sqlite3
import traceback

# ==================== KONFIGURASI PATH ====================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'database', 'games_data.db')

print(f"📁 Games DB Path: {DB_PATH}")

# Membuat Blueprint untuk API
games_bp = Blueprint('games_bp', __name__, url_prefix='/api/games')

def get_current_time():
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def init_db():
    """Pastikan database dan tabel ada"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabel users
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            balance INTEGER DEFAULT 0,
            referred_by INTEGER DEFAULT NULL,
            referral_reward INTEGER DEFAULT 0,
            gifts INTEGER DEFAULT 0,
            wallet_address TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP
        )
    ''')
    
    # Tabel game_history
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS game_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER,
            game_name TEXT,
            bet_amount INTEGER,
            win_amount INTEGER,
            multiplier REAL,
            played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tambah kolom wallet_address jika belum ada
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'wallet_address' not in columns:
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN wallet_address TEXT DEFAULT NULL")
            print("✅ Kolom wallet_address ditambahkan")
        except:
            pass
    
    conn.commit()
    conn.close()
    print("✅ Database siap")

# ==================== AUTH ====================
@games_bp.route('/auth', methods=['POST'])
def auth_user():
    init_db()
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Tidak ada data"}), 400
        
    telegram_id = data.get('telegram_id')
    username = data.get('username', 'Unknown')
    first_name = data.get('first_name', 'Guest')
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id diperlukan"}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        current_time = get_current_time()
        
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
        
        if user:
            cursor.execute('''
                UPDATE users 
                SET username = ?, first_name = ?, last_seen = ? 
                WHERE telegram_id = ?
            ''', (username, first_name, current_time, telegram_id))
            conn.commit()
            balance = user['balance']
        else:
            cursor.execute('''
                INSERT INTO users (telegram_id, username, first_name, balance, created_at, last_seen) 
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (telegram_id, username, first_name, 0, current_time, current_time))
            conn.commit()
            balance = 0
        
        conn.close()
        
        return jsonify({
            "success": True,
            "telegram_id": telegram_id,
            "username": username,
            "balance": balance
        })
    except Exception as e:
        print(f"❌ Error: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== BALANCE ====================
@games_bp.route('/balance/<int:telegram_id>', methods=['GET'])
def get_balance(telegram_id):
    init_db()
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        
        balance = row[0] if row else 0
        return jsonify({"success": True, "balance": balance})
    except Exception as e:
        return jsonify({"success": True, "balance": 0})

# ==================== WALLET ADDRESS ====================
@games_bp.route('/user/wallet', methods=['POST'])
def update_user_wallet():
    init_db()
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
            SET wallet_address = ?
            WHERE telegram_id = ?
        ''', (wallet_address, telegram_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Wallet address updated'})
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# games/services/games_service.py - PERBAIKAN verify_ton_deposit

@games_bp.route('/verify-ton-deposit', methods=['POST'])
def verify_ton_deposit():
    """Verifikasi deposit TON - Balance langsung dalam TON"""
    init_db()
    data = request.json
    telegram_id = data.get('telegram_id')
    transaction_hash = data.get('transaction_hash')
    amount_ton = data.get('amount_ton')
    from_address = data.get('from_address')
    memo = data.get('memo', '')
    
    if not telegram_id or not transaction_hash:
        return jsonify({"success": False, "error": "Missing required fields"}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Cek apakah user ada
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({"success": False, "error": "User not found"}), 404
        
        # LANGSUNG PAKAI TON, BUKAN IDR
        amount = float(amount_ton)
        
        # Update balance (tambah saldo dalam TON)
        cursor.execute('''
            UPDATE users 
            SET balance = balance + ? 
            WHERE telegram_id = ?
        ''', (amount, telegram_id))
        
        # Catat history (dalam TON)
        cursor.execute('''
            INSERT INTO game_history (telegram_id, game_name, bet_amount, win_amount, multiplier, played_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (telegram_id, 'DEPOSIT_TON', amount, amount, 1.0, get_current_time()))
        
        # Ambil balance baru
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        new_balance = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        print(f"✅ Deposit: {amount} TON for user {telegram_id}")
        print(f"   New balance: {new_balance} TON")
        
        return jsonify({
            "success": True,
            "message": f"Deposit {amount} TON berhasil",
            "amount_ton": amount,
            "new_balance": new_balance
        })
        
    except Exception as e:
        print(f"❌ Error: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# ==================== USER STATS ====================
@games_bp.route('/user-stats/<int:telegram_id>', methods=['GET'])
def get_user_stats(telegram_id):
    init_db()
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
        return jsonify({"success": True, "gifts": 0, "referral_reward": 0})
    except Exception as e:
        return jsonify({"success": True, "gifts": 0, "referral_reward": 0})

# ==================== USER HISTORY ====================
@games_bp.route('/user-history/<int:telegram_id>', methods=['GET'])
def get_user_game_history(telegram_id):
    init_db()
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
        
        return jsonify({"success": True, "history": [dict(row) for row in rows]})
    except Exception as e:
        return jsonify({"success": True, "history": []})

# ==================== UPDATE BALANCE ====================
@games_bp.route('/update-balance', methods=['POST'])
def update_balance():
    init_db()
    data = request.json
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

@games_bp.route('/create-payload', methods=['POST'])
def create_payload():
    """Buat payload yang valid untuk TON Connect deposit"""
    init_db()
    data = request.json
    
    if not data:
        return jsonify({'success': False, 'error': 'No data provided'}), 400
    
    telegram_id = data.get('telegram_id')
    amount_ton = float(data.get('amount_ton', 0))
    
    # Validasi
    if amount_ton < 0.1:
        return jsonify({'success': False, 'error': 'Minimum deposit 0.1 TON'}), 400
    
    # Get user dari database
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        # Buat memo dengan format yang jelas
        timestamp = int(datetime.now().timestamp())
        memo_plain = f"deposit:{telegram_id}:{timestamp}"
        
        # 🔥 BUAT PAYLOAD DENGAN FORMAT YANG VALID
        # Format: text comment sederhana (tanpa prefix 4 byte)
        # Ini lebih kompatibel dengan berbagai wallet
        memo_bytes = memo_plain.encode('utf-8')
        payload_base64 = base64.b64encode(memo_bytes).decode('utf-8')
        
        # Konversi amount ke nano
        amount_nano = str(int(amount_ton * 1_000_000_000))
        
        print(f"📤 Created payload for user {telegram_id}:")
        print(f"   Amount: {amount_ton} TON ({amount_nano} nano)")
        print(f"   Memo: {memo_plain}")
        print(f"   Payload: {payload_base64[:50]}...")
        
        return jsonify({
            'success': True,
            'transaction': {
                'address': 'UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra',  # WEB_ADDRESS
                'amount': amount_nano,
                'payload': payload_base64
            },
            'memo_plain': memo_plain
        })
        
    except Exception as e:
        print(f"❌ Error creating payload: {e}")
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== WITHDRAW ====================
@games_bp.route('/user-wallet/<int:telegram_id>', methods=['GET'])
def get_user_wallet(telegram_id):
    """Mendapatkan wallet address user"""
    init_db()
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT wallet_address FROM users WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        
        wallet_address = row[0] if row else None
        return jsonify({"success": True, "wallet_address": wallet_address})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@games_bp.route('/withdraw', methods=['POST'])
def process_withdraw():
    """Proses withdraw TON ke wallet user menggunakan TON Pay Transfer"""
    init_db()
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "No data provided"}), 400
    
    telegram_id = data.get('telegram_id')
    amount = data.get('amount')
    wallet_address = data.get('wallet_address')
    
    if not telegram_id:
        return jsonify({"success": False, "error": "telegram_id required"}), 400
    
    if not amount or amount <= 0:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    if amount < 0.1:
        return jsonify({"success": False, "error": "Minimum withdraw 0.1 TON"}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Cek user dan balance
        cursor.execute("SELECT balance, wallet_address FROM users WHERE telegram_id = ?", (telegram_id,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return jsonify({"success": False, "error": "User not found"}), 404
        
        current_balance = user['balance'] or 0
        user_wallet = user['wallet_address']
        
        if amount > current_balance:
            conn.close()
            return jsonify({"success": False, "error": f"Insufficient balance. Your balance: {current_balance:.2f} TON"}), 400
        
        if not user_wallet:
            conn.close()
            return jsonify({"success": False, "error": "Wallet address not connected"}), 400
        
        # 🔥 KIRIM TON KE WALLET USER MENGGUNAKAN TON PAY
        # Buat reference unik
        reference = f"wd_{telegram_id}_{int(datetime.now().timestamp())}"
        
        # Siapkan payload untuk TON Pay Transfer
        transfer_data = {
            "address": user_wallet,
            "amount": str(int(amount * 1_000_000_000)),  # Konversi ke nanoTON
            "comment": f"Withdraw from BarackGift: {reference}"
        }
        
        print(f"💰 Processing withdraw for user {telegram_id}:")
        print(f"   Amount: {amount} TON")
        print(f"   To: {user_wallet}")
        print(f"   Reference: {reference}")
        
        # SIMPAN DULU KE DATABASE (status pending)
        cursor.execute("UPDATE users SET balance = balance - ? WHERE telegram_id = ?", (amount, telegram_id))
        
        cursor.execute('''
            INSERT INTO game_history (telegram_id, game_name, bet_amount, win_amount, multiplier, played_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (telegram_id, 'WITHDRAW_TON', amount, 0, 0, get_current_time()))
        
        # Ambil balance baru
        cursor.execute("SELECT balance FROM users WHERE telegram_id = ?", (telegram_id,))
        new_balance = cursor.fetchone()[0]
        
        # Simpan tracking withdraw
        cursor.execute('''
            INSERT INTO withdraw_requests (telegram_id, amount_ton, destination_address, reference, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (telegram_id, amount, user_wallet, reference, 'pending', get_current_time()))
        
        conn.commit()
        
        # Generate transaction ID
        transaction_id = f"WID_{datetime.now().strftime('%Y%m%d%H%M%S')}_{telegram_id}"
        
        conn.close()
        
        # 🔥 INI PENTING: Return data untuk TON Pay di frontend
        return jsonify({
            "success": True,
            "message": f"Withdraw {amount} TON initiated",
            "amount": amount,
            "new_balance": new_balance,
            "transaction_id": transaction_id,
            "wallet_address": user_wallet,
            "reference": reference,
            "ton_pay_data": transfer_data  # ← Data untuk TON Pay di frontend
        })
        
    except Exception as e:
        print(f"❌ Withdraw error: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500