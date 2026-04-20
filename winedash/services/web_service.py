# winedash/services/web_service.py

import sqlite3
import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import Blueprint, request, jsonify
import sys
from pathlib import Path
import re
import asyncio

# Add root to path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from winedash.database.web import WinedashDatabase

# Create blueprint
winedash_bp = Blueprint('winedash', __name__)

# Initialize database
db = WinedashDatabase()

# Configuration
JAKARTA_TZ = None
try:
    import pytz
    JAKARTA_TZ = pytz.timezone('Asia/Jakarta')
except ImportError:
    from datetime import timezone
    JAKARTA_TZ = timezone(datetime.timedelta(hours=7))

OWNER_ID = int(os.getenv("OWNER_ID", 0))
DOMAIN = os.getenv("DOMAIN", "https://companel.shop")


def get_jakarta_time() -> datetime:
    if JAKARTA_TZ:
        return datetime.now(JAKARTA_TZ)
    return datetime.now()


def format_jakarta_time(dt: datetime) -> str:
    return dt.strftime('%d %B %Y %H:%M:%S WIB')


# ==================== TELEGRAM AUTH ====================

def validate_telegram_user(data: dict) -> tuple:
    """Validate and extract Telegram user data from WebApp initData"""
    try:
        user_id = data.get('id')
        username = data.get('username', '')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        photo_url = data.get('photo_url', '')
        
        if user_id:
            return True, user_id, username, first_name, last_name, photo_url
        return False, None, None, None, None, None
    except Exception as e:
        print(f"Error validating telegram data: {e}")
        return False, None, None, None, None, None

def validate_based_on(username: str, based_on: str) -> tuple:
    """
    Validasi apakah based_on (nama asli) memiliki hubungan dengan username
    berdasarkan aturan penjualan username.
    Returns: (is_valid, error_message, category)
    """
    if not username or not based_on:
        return False, "Username dan Based On harus diisi", None
    
    # Bersihkan input
    username_lower = username.lower().strip()
    based_on_lower = based_on.lower().strip()
    
    # Cek apakah based_on adalah bagian dari username atau sebaliknya
    # Atau apakah username adalah modifikasi dari based_on
    
    # ============ CEK UNCOMMON (OP, SOP, SCANON, CANON) ============
    
    # 1. OP (On Point) - Exact match tanpa modifikasi
    if username_lower == based_on_lower:
        return True, "OP (On Point) - Exact match", "OP"
    
    # 2. SOP (Semi On Point) - Penambahan huruf double
    # Cek apakah based_on adalah versi tanpa double dari username
    # Contoh: WiinWin -> WinWin, Roose -> Rose
    # Hapus karakter double berurutan
    def remove_consecutive_duplicates(s):
        result = []
        prev = ''
        for char in s:
            if char != prev:
                result.append(char)
                prev = char
        return ''.join(result)
    
    username_no_double = remove_consecutive_duplicates(username_lower)
    if username_no_double == based_on_lower and len(username_lower) > len(based_on_lower):
        return True, "SOP (Semi On Point) - Double huruf", "SOP"
    
    # 3. SCANON - Penambahan huruf 's' di akhir atau hanya nama (tanpa marga)
    if username_lower.endswith('s') and username_lower[:-1] == based_on_lower:
        return True, "SCANON - Penambahan huruf S di akhir", "SCANON"
    
    # Cek jika based_on adalah nama tanpa marga (hanya 1 kata)
    if ' ' not in based_on_lower and len(based_on_lower.split()) == 1:
        # Jika username mengandung based_on sebagai bagian
        if based_on_lower in username_lower:
            return True, "SCANON - Nama tanpa marga", "SCANON"
    
    # 4. CANON - Penggantian huruf i ke l atau l ke i
    # Cek substitusi i<->l
    username_il_swap = username_lower.replace('i', 'L').replace('l', 'i').lower()
    if username_il_swap == based_on_lower:
        return True, "CANON - Swap i/l", "CANON"
    
    # ============ CEK COMMON ============
    
    # 5. TAMPING (Tambah Pinggir) - Penambahan 1 huruf di depan atau belakang
    if len(username_lower) == len(based_on_lower) + 1:
        # Cek apakah username adalah based_on + 1 huruf di depan
        if username_lower[1:] == based_on_lower:
            return True, "TAMPING - Tambah huruf di depan", "TAMPING"
        # Cek apakah username adalah based_on + 1 huruf di belakang
        if username_lower[:-1] == based_on_lower:
            return True, "TAMPING - Tambah huruf di belakang", "TAMPING"
        # Cek apakah based_on adalah username + 1 huruf di depan
        if based_on_lower[1:] == username_lower:
            return True, "TAMPING - Based On lebih panjang (tambah huruf di depan)", "TAMPING"
        # Cek apakah based_on adalah username + 1 huruf di belakang
        if based_on_lower[:-1] == username_lower:
            return True, "TAMPING - Based On lebih panjang (tambah huruf di belakang)", "TAMPING"
    
    # 6. TAMDAL (Tambah Dalam) - Penambahan 1 huruf di dalam
    if len(username_lower) == len(based_on_lower) + 1:
        # Cek apakah username adalah based_on dengan 1 huruf tambahan di dalam
        for i in range(len(username_lower)):
            temp = username_lower[:i] + username_lower[i+1:]
            if temp == based_on_lower:
                return True, "TAMDAL - Tambah huruf di dalam", "TAMDAL"
    
    if len(based_on_lower) == len(username_lower) + 1:
        # Cek apakah based_on adalah username dengan 1 huruf tambahan di dalam
        for i in range(len(based_on_lower)):
            temp = based_on_lower[:i] + based_on_lower[i+1:]
            if temp == username_lower:
                return True, "TAMDAL - Based On lebih panjang (tambah huruf di dalam)", "TAMDAL"
    
    # 7. GANHUR (Ganti Huruf) - Penggantian 1 huruf
    if len(username_lower) == len(based_on_lower):
        diff_count = 0
        for i in range(len(username_lower)):
            if username_lower[i] != based_on_lower[i]:
                diff_count += 1
        if diff_count == 1:
            return True, "GANHUR - Ganti 1 huruf", "GANHUR"
    
    # 8. SWITCH (Perpindahan Huruf) - Perpindahan 1 langkah (swap adjacent)
    if len(username_lower) == len(based_on_lower):
        for i in range(len(username_lower) - 1):
            # Swap huruf di posisi i dan i+1
            swapped = list(username_lower)
            swapped[i], swapped[i+1] = swapped[i+1], swapped[i]
            if ''.join(swapped) == based_on_lower:
                return True, "SWITCH - Perpindahan huruf", "SWITCH"
    
    # 9. KURHUF (Kurang Huruf) - Kurang 1 huruf
    if len(username_lower) == len(based_on_lower) - 1:
        # Cek apakah username adalah based_on tanpa 1 huruf
        for i in range(len(based_on_lower)):
            temp = based_on_lower[:i] + based_on_lower[i+1:]
            if temp == username_lower:
                return True, "KURHUF - Kurang 1 huruf", "KURHUF"
    
    # 10. CEK APAKAH BASED_ON ADALAH NAMA YANG MENGANDUNG USERNAME
    if based_on_lower in username_lower:
        return True, f"Based On '{based_on}' terkandung dalam username", "SUBSET"
    
    if username_lower in based_on_lower:
        return True, f"Username terkandung dalam Based On '{based_on}'", "SUPERSET"
    
    # Jika tidak ada yang cocok
    return False, f"'{based_on}' tidak memiliki hubungan yang valid dengan username '{username}'", None

# ==================== WITHDRAW HELPER FUNCTIONS ====================

async def send_ton_transfer(destination_address: str, amount_ton: float, memo: str = "") -> str:
    """
    Kirim transfer TON ke alamat tujuan menggunakan tonutils
    Returns: transaction hash
    """
    try:
        from tonutils.client import ToncenterClient
        from tonutils.wallet import WalletV4R2
        
        # Ambil mnemonic dari environment
        MERCHANT_MNEMONIC = os.getenv('MERCHANT_MNEMONIC', '')
        TONCENTER_API_KEY = os.getenv('TONCENTER_API_KEY', '')
        
        if not MERCHANT_MNEMONIC:
            raise Exception("MERCHANT_MNEMONIC tidak ditemukan di .env")
        
        if not TONCENTER_API_KEY:
            raise Exception("TONCENTER_API_KEY tidak ditemukan di .env")
        
        print(f"📤 Mengirim: {amount_ton} TON")
        print(f"📡 Ke alamat: {destination_address}")
        print(f"📝 Memo: {memo}")
        
        # Inisialisasi client
        client = ToncenterClient(api_key=TONCENTER_API_KEY, is_testnet=False)
        
        # Buat wallet dari mnemonic
        wallet, _, _, _ = WalletV4R2.from_mnemonic(
            client=client, 
            mnemonic=MERCHANT_MNEMONIC.split()
        )
        
        # Kirim transaksi - amount_ton langsung, library akan konversi ke nano
        tx_hash = await wallet.transfer(
            destination=destination_address,
            amount=amount_ton,  # Langsung dalam TON, library akan konversi ke nano
            body=memo if memo else f"Withdraw {amount_ton} TON",
        )
        
        print(f"✅ Berhasil! TX hash: {tx_hash}")
        return tx_hash
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        raise Exception("Library tonutils tidak tersedia. Install dengan: pip install tonutils")
    except Exception as e:
        print(f"❌ Error sending TON: {e}")
        raise

@winedash_bp.route('/auth', methods=['POST', 'OPTIONS'])
def auth_user():
    """Authenticate user via Telegram WebApp data"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        is_valid, user_id, username, first_name, last_name, photo_url = validate_telegram_user(data)
        
        if not is_valid or not user_id:
            return jsonify({'success': False, 'error': 'Data user tidak valid'}), 400
        
        # Save or update user
        db.save_user(
            user_id=user_id,
            username=username or "",
            first_name=first_name or "",
            last_name=last_name or "",
            photo_url=photo_url or ""
        )
        
        # Get user data
        user = db.get_user(user_id)
        
        return jsonify({
            'success': True,
            'user': user,
            'message': 'Authentication successful'
        })
        
    except Exception as e:
        print(f"Error in auth_user: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@winedash_bp.route('/user/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get user information"""
    try:
        user = db.get_user(user_id)
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        return jsonify({'success': True, 'user': user})
        
    except Exception as e:
        print(f"Error in get_user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== TON MANIFEST ====================

@winedash_bp.route('/ton-manifest', methods=['GET'])
def get_ton_manifest():
    """Get TON Connect manifest"""
    try:
        # Check if manifest exists in database
        manifest = db.get_ton_manifest(DOMAIN.replace('https://', '').replace('http://', ''))
        
        if not manifest:
            # Return default manifest
            default_manifest = {
                "url": DOMAIN,
                "name": "Winedash",
                "iconUrl": f"{DOMAIN}/winedash/images/logo.png",
                "termsOfUseUrl": f"{DOMAIN}/terms",
                "privacyPolicyUrl": f"{DOMAIN}/privacy"
            }
            return jsonify(default_manifest)
        
        return jsonify(manifest['manifest_json'])
        
    except Exception as e:
        print(f"Error in get_ton_manifest: {e}")
        default_manifest = {
            "url": DOMAIN,
            "name": "Winedash",
            "iconUrl": f"{DOMAIN}/winedash/images/logo.png",
            "termsOfUseUrl": f"{DOMAIN}/terms",
            "privacyPolicyUrl": f"{DOMAIN}/privacy"
        }
        return jsonify(default_manifest)


@winedash_bp.route('/ton-manifest', methods=['POST'])
def save_ton_manifest():
    """Save TON Connect manifest to database"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        domain = data.get('domain', DOMAIN.replace('https://', '').replace('http://', ''))
        name = data.get('name', 'Winedash')
        icon_url = data.get('iconUrl', f"{DOMAIN}/winedash/images/logo.png")
        terms_url = data.get('termsOfUseUrl', f"{DOMAIN}/terms")
        privacy_url = data.get('privacyPolicyUrl', f"{DOMAIN}/privacy")
        
        manifest_json = json.dumps(data)
        
        success = db.save_ton_manifest(domain, name, icon_url, terms_url, privacy_url, manifest_json)
        
        return jsonify({
            'success': success,
            'message': 'Manifest saved successfully' if success else 'Failed to save manifest'
        })
        
    except Exception as e:
        print(f"Error in save_ton_manifest: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== DEPOSIT FUNCTIONS ====================

@winedash_bp.route('/deposit/create', methods=['POST', 'OPTIONS'])
def create_deposit():
    """Create a new deposit request"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id = data.get('user_id')
        amount = data.get('amount')
        wallet_address = data.get('wallet_address')
        
        if not user_id or not amount or amount <= 0:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        # Generate unique transaction ID
        transaction_id = f"deposit_{uuid.uuid4().hex[:16]}_{int(datetime.now().timestamp())}"
        
        # Create deposit record
        deposit_id = db.create_deposit(user_id, amount, wallet_address or "", transaction_id)
        
        if not deposit_id:
            return jsonify({'success': False, 'error': 'Gagal membuat deposit'}), 500
        
        return jsonify({
            'success': True,
            'deposit_id': deposit_id,
            'transaction_id': transaction_id,
            'amount': amount,
            'message': 'Deposit request created. Please send TON to complete.'
        })
        
    except Exception as e:
        print(f"Error in create_deposit: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/deposit/history/<int:user_id>', methods=['GET'])
def get_deposit_history(user_id):
    """Get user deposit history"""
    try:
        deposits = db.get_user_deposits(user_id)
        
        return jsonify({
            'success': True,
            'deposits': deposits,
            'total': len(deposits)
        })
        
    except Exception as e:
        print(f"Error in get_deposit_history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== WITHDRAWAL FUNCTIONS ====================

@winedash_bp.route('/withdraw/create', methods=['POST', 'OPTIONS'])
def create_withdrawal():
    """Create a new withdrawal request"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id = data.get('user_id')
        amount = data.get('amount')
        wallet_address = data.get('wallet_address')
        
        if not user_id or not amount or amount <= 0 or not wallet_address:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        # Check minimum withdrawal
        if amount < 1:
            return jsonify({'success': False, 'error': 'Minimal withdraw 1 TON'}), 400
        
        # Get user balance
        user = db.get_user(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'User tidak ditemukan'}), 404
        
        if user['balance'] < amount:
            return jsonify({'success': False, 'error': f'Saldo tidak mencukupi. Saldo Anda: {user["balance"]} TON'}), 400
        
        # Generate unique reference
        import uuid
        reference = f"wd_{user_id}_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        
        # Create withdrawal record with pending status
        withdrawal_id = db.create_withdrawal(user_id, amount, wallet_address)
        
        if not withdrawal_id:
            return jsonify({'success': False, 'error': 'Gagal membuat request withdraw'}), 500
        
        return jsonify({
            'success': True,
            'withdrawal_id': withdrawal_id,
            'reference': reference,
            'amount': amount,
            'message': 'Withdrawal request created. Processing...'
        })
        
    except Exception as e:
        print(f"Error in create_withdrawal: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/withdraw/process', methods=['POST', 'OPTIONS'])
def process_withdraw():
    """Process withdrawal - send TON to user wallet"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id = data.get('user_id')
        amount = data.get('amount')
        destination_address = data.get('destination_address')
        withdrawal_id = data.get('withdrawal_id')
        
        if not user_id or not amount or amount <= 0 or not destination_address:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        # ==================== PERBAIKAN FEE WITHDRAW ====================
        # Kurangi 0.02 TON untuk fee network
        WITHDRAW_FEE = 0.02
        amount_to_send = amount - WITHDRAW_FEE
        
        if amount_to_send <= 0:
            return jsonify({'success': False, 'error': f'Jumlah withdraw terlalu kecil. Minimal {WITHDRAW_FEE + 0.01} TON untuk menutup fee'}), 400
        
        # Get user and verify balance
        user = db.get_user(user_id)
        if not user:
            return jsonify({'success': False, 'error': 'User tidak ditemukan'}), 404
        
        if user['balance'] < amount:
            return jsonify({'success': False, 'error': f'Saldo tidak mencukupi'}), 400
        
        print(f"💰 Processing withdrawal for user {user_id}")
        print(f"   Requested amount: {amount} TON")
        print(f"   Fee: {WITHDRAW_FEE} TON")
        print(f"   Amount to send: {amount_to_send} TON")
        print(f"   To: {destination_address}")
        
        # Generate memo
        memo = f"withdraw:{user_id}:{int(datetime.now().timestamp())}"
        
        # Send TON transfer (dengan amount yang sudah dikurangi fee)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            tx_hash = loop.run_until_complete(
                send_ton_transfer(destination_address, amount_to_send, memo)
            )
        finally:
            loop.close()
        
        print(f"✅ Transfer successful! TX Hash: {tx_hash}")
        
        # Update withdrawal record - catat amount asli (yang diminta user)
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            now = get_jakarta_time().isoformat()
            
            if withdrawal_id:
                cursor.execute('''
                    UPDATE withdrawals 
                    SET status = 'completed', transaction_id = ?, completed_at = ?
                    WHERE id = ?
                ''', (tx_hash, now, withdrawal_id))
            
            # Deduct FULL amount dari balance user (bukan hanya yang dikirim)
            cursor.execute('''
                UPDATE users SET balance = balance - ?, total_withdraw = total_withdraw + ?
                WHERE user_id = ?
            ''', (amount, amount, user_id))
            
            # Create transaction record dengan amount asli
            cursor.execute('''
                INSERT INTO transactions (transaction_id, user_id, type, amount, status, details, created_at, completed_at)
                VALUES (?, ?, 'withdraw', ?, 'success', ?, ?, ?)
            ''', (tx_hash, user_id, amount, f"Withdraw {amount} TON (Fee {WITHDRAW_FEE} TON, diterima {amount_to_send} TON)", now, now))
            
            conn.commit()
        
        # Get new balance
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
            row = cursor.fetchone()
            new_balance = float(row[0]) if row else 0
        
        return jsonify({
            'success': True,
            'transaction_hash': tx_hash,
            'amount_requested': amount,
            'fee': WITHDRAW_FEE,
            'amount_sent': amount_to_send,
            'new_balance': new_balance,
            'message': f'Withdraw {amount} TON berhasil! (Fee {WITHDRAW_FEE} TON, {amount_to_send} TON dikirim)'
        })
        
    except Exception as e:
        print(f"Error in process_withdraw: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/withdraw/confirm', methods=['POST'])
def confirm_withdrawal():
    """Confirm a withdrawal (admin only)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        withdrawal_id = data.get('withdrawal_id')
        transaction_id = data.get('transaction_id')
        
        if not withdrawal_id or not transaction_id:
            return jsonify({'success': False, 'error': 'Invalid parameters'}), 400
        
        success = db.confirm_withdrawal(withdrawal_id, transaction_id)
        
        if success:
            # Create transaction record
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id, amount FROM withdrawals WHERE id = ?', (withdrawal_id,))
                row = cursor.fetchone()
                if row:
                    db.create_transaction(
                        transaction_id=transaction_id,
                        user_id=row[0],
                        tx_type='withdraw',
                        amount=float(row[1]),
                        details=f"Withdrawal processed"
                    )
            
            return jsonify({'success': True, 'message': 'Withdrawal confirmed'})
        
        return jsonify({'success': False, 'error': 'Withdrawal not found'}), 404
        
    except Exception as e:
        print(f"Error in confirm_withdrawal: {e}")
        return process_withdraw()

@winedash_bp.route('/withdraw/history/<int:user_id>', methods=['GET'])
def get_withdrawal_history(user_id):
    """Get user withdrawal history"""
    try:
        withdrawals = db.get_user_withdrawals(user_id)
        
        return jsonify({
            'success': True,
            'withdrawals': withdrawals,
            'total': len(withdrawals)
        })
        
    except Exception as e:
        print(f"Error in get_withdrawal_history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== USERNAME MARKETPLACE ====================

@winedash_bp.route('/usernames', methods=['GET'])
def get_usernames():
    """Get all usernames for storage (including unlisted)"""
    try:
        category = request.args.get('category')
        limit = request.args.get('limit', 100, type=int)
        
        # Gunakan method yang sama untuk mendapatkan semua usernames
        usernames = db.get_available_usernames(category, limit)
        
        return jsonify({
            'success': True,
            'usernames': usernames,
            'total': len(usernames)
        })
        
    except Exception as e:
        print(f"Error in get_usernames: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/username/add', methods=['POST', 'OPTIONS'])
def add_username():
    """Add a username to marketplace"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        username = data.get('username')
        price = data.get('price')
        seller_id = data.get('seller_id')
        seller_wallet = data.get('seller_wallet')
        category = data.get('category', 'default')
        
        if not username or not price or price <= 0:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        username_id = db.add_username(username, price, seller_id, seller_wallet, category)
        
        if not username_id:
            return jsonify({'success': False, 'error': 'Username already exists'}), 400
        
        return jsonify({
            'success': True,
            'username_id': username_id,
            'message': 'Username added to marketplace'
        })
        
    except Exception as e:
        print(f"Error in add_username: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@winedash_bp.route('/username/buy', methods=['POST', 'OPTIONS'])
def buy_username():
    """Buy a username from marketplace"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        username_id = data.get('username_id')
        buyer_id = data.get('buyer_id')
        
        if not username_id or not buyer_id:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        transaction_id = f"buy_{uuid.uuid4().hex[:16]}_{int(datetime.now().timestamp())}"
        
        success = db.buy_username(username_id, buyer_id, transaction_id)
        
        if not success:
            return jsonify({'success': False, 'error': 'Insufficient balance or username not available'}), 400
        
        # Create transaction record
        db.create_transaction(
            transaction_id=transaction_id,
            user_id=buyer_id,
            tx_type='purchase',
            amount=0,  # Will be updated with actual price
            details=f"Purchased username ID: {username_id}"
        )
        
        return jsonify({
            'success': True,
            'transaction_id': transaction_id,
            'message': 'Username purchased successfully'
        })
        
    except Exception as e:
        print(f"Error in buy_username: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@winedash_bp.route('/user/purchases/<int:user_id>', methods=['GET'])
def get_user_purchases(user_id):
    """Get usernames purchased by user"""
    try:
        purchases = db.get_user_purchases(user_id)
        
        return jsonify({
            'success': True,
            'purchases': purchases,
            'total': len(purchases)
        })
        
    except Exception as e:
        print(f"Error in get_user_purchases: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== TRANSACTIONS ====================

@winedash_bp.route('/transactions/<int:user_id>', methods=['GET'])
def get_user_transactions(user_id):
    """Get user transaction history"""
    try:
        transactions = db.get_user_transactions(user_id)
        
        return jsonify({
            'success': True,
            'transactions': transactions,
            'total': len(transactions)
        })
        
    except Exception as e:
        print(f"Error in get_user_transactions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== STATISTICS ====================

@winedash_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get marketplace statistics"""
    try:
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Total users
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0] or 0
            
            # Total usernames available
            cursor.execute("SELECT COUNT(*) FROM usernames WHERE status = 'available'")
            total_available = cursor.fetchone()[0] or 0
            
            # Total usernames sold
            cursor.execute("SELECT COUNT(*) FROM usernames WHERE status = 'sold'")
            total_sold = cursor.fetchone()[0] or 0
            
            # Total volume
            cursor.execute("SELECT SUM(price) FROM usernames WHERE status = 'sold'")
            total_volume = cursor.fetchone()[0] or 0
            
            return jsonify({
                'success': True,
                'stats': {
                    'total_users': total_users,
                    'total_available_usernames': total_available,
                    'total_sold_usernames': total_sold,
                    'total_volume': float(total_volume)
                }
            })
            
    except Exception as e:
        print(f"Error in get_stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/user/<int:user_id>', methods=['PUT', 'OPTIONS'])
def update_user(user_id):
    """Update user information (wallet address, etc)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        wallet_address = data.get('wallet_address')
        
        # Update wallet address
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users SET wallet_address = ?, last_seen = ?
                WHERE user_id = ?
            ''', (wallet_address, get_jakarta_time().isoformat(), user_id))
            conn.commit()
        
        return jsonify({'success': True, 'message': 'User updated'})
        
    except Exception as e:
        print(f"Error in update_user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/deposit/confirm', methods=['POST', 'OPTIONS'])
def confirm_deposit_web():
    """Confirm a deposit and add balance to user"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        print(f"📥 Deposit confirmation request received: {data}")
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id = data.get('user_id')
        amount = data.get('amount')
        transaction_hash = data.get('transaction_hash')
        from_address = data.get('from_address')
        memo = data.get('memo', '')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        if not amount or amount <= 0:
            return jsonify({'success': False, 'error': 'Amount tidak valid'}), 400
        
        if not transaction_hash:
            import uuid
            transaction_hash = f"deposit_{uuid.uuid4().hex[:16]}_{int(datetime.now().timestamp())}"
            print(f"⚠️ No transaction hash provided, generated: {transaction_hash}")
        
        print(f"📥 Processing deposit: user_id={user_id}, amount={amount}, tx_hash={transaction_hash}")
        
        # ==================== PERBAIKAN UTAMA: Gunakan method dari db ====================
        # Panggil method confirm_deposit yang sudah ada di WinedashDatabase
        success = db.confirm_deposit(transaction_hash)
        
        if success:
            # Get updated user data
            user = db.get_user(user_id)
            new_balance = user['balance'] if user else 0
            
            print(f"✅ Deposit confirmed via db.confirm_deposit: {amount} TON added, new balance: {new_balance}")
            
            return jsonify({
                'success': True,
                'message': 'Deposit confirmed successfully',
                'transaction_id': transaction_hash,
                'new_balance': new_balance
            })
        else:
            # Fallback: manual processing jika method gagal
            print(f"⚠️ db.confirm_deposit failed, trying manual processing...")
            
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                now = get_jakarta_time().isoformat()
                
                # CEK DOUBLE PROCESSING
                cursor.execute('SELECT id, status FROM deposits WHERE transaction_id = ?', (transaction_hash,))
                existing = cursor.fetchone()
                
                if existing:
                    existing_id, existing_status = existing
                    if existing_status == 'completed':
                        cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
                        row = cursor.fetchone()
                        current_balance = float(row[0]) if row else 0
                        return jsonify({
                            'success': True,
                            'message': 'Deposit already processed',
                            'transaction_id': transaction_hash,
                            'new_balance': current_balance
                        })
                    
                    # Update existing pending deposit
                    cursor.execute('UPDATE deposits SET status = "completed", completed_at = ? WHERE id = ?', (now, existing_id))
                else:
                    # Create new deposit record
                    cursor.execute('''
                        INSERT INTO deposits (user_id, amount, wallet_address, transaction_id, status, created_at, completed_at)
                        VALUES (?, ?, ?, ?, 'completed', ?, ?)
                    ''', (user_id, amount, from_address or '', transaction_hash, now, now))
                
                # Update user balance
                cursor.execute('''
                    UPDATE users SET balance = balance + ?, total_deposit = total_deposit + ?
                    WHERE user_id = ?
                ''', (amount, amount, user_id))
                
                # Create transaction record
                cursor.execute('''
                    INSERT INTO transactions (transaction_id, user_id, type, amount, status, details, created_at, completed_at)
                    VALUES (?, ?, 'deposit', ?, 'success', ?, ?, ?)
                ''', (transaction_hash, user_id, amount, f"Deposit via TON Connect - {memo[:50] if memo else ''}", now, now))
                
                conn.commit()
                
                # Get new balance
                cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
                row = cursor.fetchone()
                new_balance = float(row[0]) if row else 0
                
                print(f"✅ Manual deposit processed: {amount} TON added, new balance: {new_balance}")
                
                return jsonify({
                    'success': True,
                    'message': 'Deposit confirmed successfully',
                    'transaction_id': transaction_hash,
                    'new_balance': new_balance
                })
        
    except Exception as e:
        print(f"❌ Error in confirm_deposit_web: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/username/pending/add', methods=['POST', 'OPTIONS'])
def add_pending_username():
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        print(f"[DEBUG] add_pending_username received data: {data}")
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        username = data.get('username')
        price = data.get('price')
        seller_id = data.get('seller_id')
        seller_wallet = data.get('seller_wallet', '')
        based_on = data.get('based_on', '')
        
        print(f"[DEBUG] Parsed: username={username}, price={price}, seller_id={seller_id}, based_on={based_on}")
        
        # Validasi based_on
        if not based_on or based_on.strip() == '':
            return jsonify({'success': False, 'error': 'Based On (nama asli) tidak boleh kosong'}), 400
        
        # Validasi username
        if not username:
            return jsonify({'success': False, 'error': 'Username tidak boleh kosong'}), 400
        
        if not price or price <= 0:
            return jsonify({'success': False, 'error': 'Harga harus lebih dari 0'}), 400
        
        if not seller_id:
            return jsonify({'success': False, 'error': 'Seller ID diperlukan'}), 400
        
        # Clean username
        username_clean = username.lstrip('@').strip()
        
        if not username_clean:
            return jsonify({'success': False, 'error': 'Username tidak valid'}), 400
        
        # ============ VALIDASI BASED_ON DENGAN ATURAN ============
        is_valid, validation_message, category = validate_based_on(username_clean, based_on.strip())
        
        if not is_valid:
            return jsonify({
                'success': False, 
                'error': validation_message,
                'details': 'Based On harus memiliki hubungan dengan username (OP, SOP, SCANON, CANON, TAMPING, TAMDAL, GANHUR, SWITCH, atau KURHUF)'
            }), 400
        
        print(f"[DEBUG] Based On validation passed: {validation_message} (Category: {category})")
        
        # CEK DUPLIKAT USERNAME DI TABEL USERNAMES
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, status FROM usernames WHERE username = ?', (username_clean,))
            existing = cursor.fetchone()
            if existing:
                return jsonify({'success': False, 'error': f'Username @{username_clean} sudah terdaftar di marketplace!'}), 400
        
        # Tambahkan ke pending dengan based_on
        pending_id = db.add_pending_username(
            username=username_clean,
            price=float(price),
            seller_id=seller_id,
            seller_wallet=seller_wallet or '',
            based_on=based_on.strip(),
            verification_type='auto'
        )
        
        print(f"[DEBUG] add_pending_username result: pending_id={pending_id}")
        
        if not pending_id:
            return jsonify({'success': False, 'error': 'Gagal menambahkan username (mungkin username sudah ada di pending queue)'}), 400
        
        return jsonify({
            'success': True,
            'pending_id': pending_id,
            'username': username_clean,
            'based_on': based_on.strip(),
            'validation_category': category,
            'validation_message': validation_message,
            'message': f'Username pending verification. Based On valid: {validation_message}'
        })
        
    except Exception as e:
        print(f"Error in add_pending_username: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/username/pending/list/<int:user_id>', methods=['GET'])
def get_pending_usernames(user_id):
    """Get pending usernames for user"""
    try:
        pendings = db.get_pending_usernames(user_id)
        
        return jsonify({
            'success': True,
            'pendings': pendings,
            'total': len(pendings)
        })
        
    except Exception as e:
        print(f"Error in get_pending_usernames: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/username/pending/confirm', methods=['POST', 'OPTIONS'])
def confirm_pending_username():
    """Confirm pending username with OTP code (required for user type)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        pending_id = data.get('pending_id')
        code = data.get('code')
        
        if not pending_id:
            return jsonify({'success': False, 'error': 'Pending ID required'}), 400
        
        # Dapatkan tipe verifikasi dari database
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT verification_type FROM pending_usernames WHERE id = ? AND status = "pending"', (pending_id,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({'success': False, 'error': 'Pending record not found'}), 404
            
            verification_type = row[0]
            
            # Untuk tipe user, WAJIB ada kode OTP
            if verification_type == 'user' and not code:
                return jsonify({'success': False, 'error': 'Kode OTP diperlukan untuk verifikasi user'}), 400
            
            # Untuk tipe channel/group, tidak perlu OTP
            if verification_type in ['channel', 'supergroup', 'group'] and code:
                # Jika ada code, abaikan saja
                code = None
        
        success = db.confirm_pending_username(pending_id, code)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Username confirmed and added to marketplace!'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Invalid code or pending expired'
            }), 400
        
    except Exception as e:
        print(f"Error in confirm_pending_username: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/username/pending/list', methods=['GET', 'OPTIONS'])
def get_pending_usernames_global():
    """Get pending usernames (global, for bot)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        # Panggil method dengan parameter None
        pendings = db.get_pending_usernames(None)
        return jsonify({
            'success': True,
            'pendings': pendings,
            'total': len(pendings)
        })
    except Exception as e:
        print(f"Error in get_pending_usernames_global: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@winedash_bp.route('/username/pending/list/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_pending_usernames_by_user(user_id):
    """Get pending usernames for specific user"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        pendings = db.get_pending_usernames(user_id)
        return jsonify({
            'success': True,
            'pendings': pendings,
            'total': len(pendings)
        })
    except Exception as e:
        print(f"Error in get_pending_usernames_by_user: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@winedash_bp.route('/username/pending/count/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_pending_count(user_id):
    """Get pending count for user inbox"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        count = db.get_user_pending_count(user_id)
        return jsonify({
            'success': True,
            'count': count
        })
    except Exception as e:
        print(f"Error in get_pending_count: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/username/pending/reject', methods=['POST', 'OPTIONS'])
def reject_pending_username_route():
    """Reject pending username"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        pending_id = data.get('pending_id')
        
        if not pending_id:
            return jsonify({'success': False, 'error': 'Pending ID required'}), 400
        
        success = db.reject_pending_username(pending_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Username rejected!'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to reject'
            }), 400
        
    except Exception as e:
        print(f"Error in reject_pending_username_route: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/username/delete', methods=['POST', 'OPTIONS'])
def delete_username():
    """Delete a username from storage"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        username_id = data.get('username_id')
        user_id = data.get('user_id')
        
        if not username_id or not user_id:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Dapatkan username sebelum dihapus
            cursor.execute('SELECT seller_id, username FROM usernames WHERE id = ?', (username_id,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({'success': False, 'error': 'Username tidak ditemukan'}), 404
            
            if row[0] != user_id:
                return jsonify({'success': False, 'error': 'Anda tidak memiliki akses'}), 403
            
            username_deleted = row[1]
            
            # Delete username
            cursor.execute('DELETE FROM usernames WHERE id = ?', (username_id,))
            
            # Juga hapus record pending yang mungkin terkait dengan username yang sama
            cursor.execute('DELETE FROM pending_usernames WHERE username = ?', (username_deleted,))
            
            conn.commit()
        
        print(f"[DEBUG] Username {username_deleted} deleted successfully")
        
        return jsonify({
            'success': True,
            'message': 'Username berhasil dihapus!'
        })
        
    except Exception as e:
        print(f"Error in delete_username: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@winedash_bp.route('/username/toggle', methods=['POST', 'OPTIONS'])
def toggle_username_status():
    """Toggle username status (listed/unlisted)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        username_id = data.get('username_id')
        new_status = data.get('status')
        user_id = data.get('user_id')
        
        if not username_id or not new_status or not user_id:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        # Validasi status
        if new_status not in ['available', 'unlisted']:
            return jsonify({'success': False, 'error': 'Status tidak valid'}), 400
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Cek apakah username milik user ini
            cursor.execute('SELECT seller_id FROM usernames WHERE id = ?', (username_id,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({'success': False, 'error': 'Username tidak ditemukan'}), 404
            
            if row[0] != user_id:
                return jsonify({'success': False, 'error': 'Anda tidak memiliki akses'}), 403
            
            # Update status
            cursor.execute('UPDATE usernames SET status = ? WHERE id = ?', (new_status, username_id))
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': f'Username berhasil di{new_status == "available" and "listed" or "unlisted"}!'
        })
        
    except Exception as e:
        print(f"Error in toggle_username_status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/username/edit-price', methods=['POST', 'OPTIONS'])
def edit_username_price():
    """Edit username price"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        username_id = data.get('username_id')
        new_price = data.get('price')
        user_id = data.get('user_id')
        
        if not username_id or not new_price or new_price <= 0:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Cek apakah username milik user ini
            cursor.execute('SELECT seller_id FROM usernames WHERE id = ?', (username_id,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({'success': False, 'error': 'Username tidak ditemukan'}), 404
            
            if row[0] != user_id:
                return jsonify({'success': False, 'error': 'Anda tidak memiliki akses'}), 403
            
            # Update price
            cursor.execute('UPDATE usernames SET price = ? WHERE id = ?', (new_price, username_id))
            conn.commit()
        
        return jsonify({
            'success': True,
            'message': 'Harga berhasil diubah!'
        })
        
    except Exception as e:
        print(f"Error in edit_username_price: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/profile-photo/<string:username>', methods=['GET', 'OPTIONS'])
def get_profile_photo(username):
    """Get profile photo URL for username from database"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        # Bersihkan username
        username_clean = username.lstrip('@').strip()
        
        print(f"[DEBUG] Fetching profile photo for username: {username_clean}")
        
        with sqlite3.connect(db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Cek di tabel usernames
            cursor.execute('SELECT photo_url FROM usernames WHERE username = ?', (username_clean,))
            row = cursor.fetchone()
            if row and row['photo_url']:
                print(f"[DEBUG] Found photo_url in usernames for {username_clean}")
                return jsonify({'success': True, 'photo_url': row['photo_url']})
            
            # Cek di tabel pending_usernames
            cursor.execute("PRAGMA table_info(pending_usernames)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'photo_url' in columns:
                cursor.execute('SELECT photo_url FROM pending_usernames WHERE username = ?', (username_clean,))
                row = cursor.fetchone()
                if row and row['photo_url']:
                    print(f"[DEBUG] Found photo_url in pending_usernames for {username_clean}")
                    return jsonify({'success': True, 'photo_url': row['photo_url']})
        
        # Tidak ada foto
        print(f"[DEBUG] No profile photo found for {username_clean}")
        return jsonify({'success': False, 'photo_url': None})
        
    except Exception as e:
        print(f"Error in get_profile_photo: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'photo_url': None, 'error': str(e)})

@winedash_bp.route('/profile-photo/direct/<string:username>', methods=['GET', 'OPTIONS'])
def get_direct_profile_photo(username):
    """Get profile photo directly from Telegram (forward to bot)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        # Forward request ke bot untuk mendapatkan foto profil
        import requests
        BOT_TOKEN = os.getenv("BOT_WINEDASH", "")
        
        if not BOT_TOKEN:
            return jsonify({'success': False, 'error': 'Bot not configured'}), 500
        
        # Gunakan Telegram Bot API untuk get chat photo
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChat"
        params = {'chat_id': f"@{username}"}
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data.get('ok') and data.get('result', {}).get('photo'):
            # Dapatkan file_id foto profil
            photo = data['result']['photo']
            # Gunakan small photo (biasanya array of photo sizes)
            if isinstance(photo, list) and len(photo) > 0:
                file_id = photo[-1]['file_id']  # Ambil ukuran terbesar
                
                # Get file path
                file_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getFile"
                file_response = requests.get(file_url, params={'file_id': file_id}, timeout=10)
                file_data = file_response.json()
                
                if file_data.get('ok'):
                    file_path = file_data['result']['file_path']
                    photo_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
                    return jsonify({'success': True, 'photo_url': photo_url})
        
        # Fallback ke default avatar
        initial = username[0] if username else 'U'
        default_avatar = f"https://ui-avatars.com/api/?name={initial}&background=40a7e3&color=fff&size=120&rounded=true&bold=true&length=1"
        return jsonify({'success': True, 'photo_url': default_avatar})
        
    except Exception as e:
        print(f"Error in get_direct_profile_photo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/profile-photo/save', methods=['POST', 'OPTIONS'])
def save_profile_photo():
    """Save profile photo from bot (called by bot after downloading)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        username = data.get('username')
        photo_url = data.get('photo_url')
        
        if not username or not photo_url:
            return jsonify({'success': False, 'error': 'Missing data'}), 400
        
        print(f"[DEBUG] Saving profile photo for username: {username}")
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Pastikan kolom photo_url ada di usernames
            cursor.execute("PRAGMA table_info(usernames)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'photo_url' not in columns:
                cursor.execute('ALTER TABLE usernames ADD COLUMN photo_url TEXT')
                print("✅ Added photo_url column to usernames")
            
            # UPDATE di tabel usernames (jika ada)
            cursor.execute('UPDATE usernames SET photo_url = ? WHERE username = ?', (photo_url, username))
            
            # UPDATE di tabel pending_usernames (jika ada)
            cursor.execute("PRAGMA table_info(pending_usernames)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'photo_url' not in columns:
                cursor.execute('ALTER TABLE pending_usernames ADD COLUMN photo_url TEXT')
                print("✅ Added photo_url column to pending_usernames")
            cursor.execute('UPDATE pending_usernames SET photo_url = ? WHERE username = ?', (photo_url, username))
            
            conn.commit()
        
        print(f"✅ Profile photo saved for {username}")
        return jsonify({'success': True, 'message': 'Photo saved'})
        
    except Exception as e:
        print(f"Error saving profile photo: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500