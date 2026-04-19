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


@winedash_bp.route('/deposit/confirm', methods=['POST'])
def confirm_deposit():
    """Confirm a deposit (webhook from TON payment)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        transaction_id = data.get('transaction_id')
        
        if not transaction_id:
            return jsonify({'success': False, 'error': 'Transaction ID required'}), 400
        
        success = db.confirm_deposit(transaction_id)
        
        if success:
            # Create transaction record
            # Get deposit details
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id, amount FROM deposits WHERE transaction_id = ?', (transaction_id,))
                row = cursor.fetchone()
                if row:
                    db.create_transaction(
                        transaction_id=transaction_id,
                        user_id=row[0],
                        tx_type='deposit',
                        amount=float(row[1]),
                        details=f"Deposit confirmed via TON"
                    )
            
            return jsonify({'success': True, 'message': 'Deposit confirmed'})
        
        return jsonify({'success': False, 'error': 'Deposit not found or already processed'}), 404
        
    except Exception as e:
        print(f"Error in confirm_deposit: {e}")
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
        
        # Create withdrawal record
        withdrawal_id = db.create_withdrawal(user_id, amount, wallet_address)
        
        if not withdrawal_id:
            return jsonify({'success': False, 'error': 'Saldo tidak mencukupi'}), 400
        
        return jsonify({
            'success': True,
            'withdrawal_id': withdrawal_id,
            'amount': amount,
            'message': 'Withdrawal request created. Waiting for admin approval.'
        })
        
    except Exception as e:
        print(f"Error in create_withdrawal: {e}")
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
        return jsonify({'success': False, 'error': str(e)}), 500


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
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id = data.get('user_id')
        amount = data.get('amount')
        transaction_hash = data.get('transaction_hash')
        from_address = data.get('from_address')
        memo = data.get('memo', '')
        
        print(f"📥 Deposit confirmation request: user_id={user_id}, amount={amount}, tx_hash={transaction_hash}")
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        if not amount or amount <= 0:
            return jsonify({'success': False, 'error': 'Amount tidak valid'}), 400
        
        # Generate unique transaction ID if not provided
        if not transaction_hash:
            import uuid
            transaction_hash = f"deposit_{uuid.uuid4().hex[:16]}_{int(datetime.now().timestamp())}"
            print(f"⚠️ No transaction hash provided, generated: {transaction_hash}")
        
        # Create transaction record
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            now = get_jakarta_time().isoformat()
            
            # Check if transaction already exists
            cursor.execute('SELECT id FROM deposits WHERE transaction_id = ?', (transaction_hash,))
            existing = cursor.fetchone()
            
            if existing:
                print(f"⚠️ Transaction already exists: {transaction_hash}")
                return jsonify({'success': False, 'error': 'Transaction already processed'}), 400
            
            # Insert deposit record
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
        
        print(f"✅ Deposit confirmed: {amount} TON for user {user_id}")
        
        # Get updated balance
        cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
        new_balance = cursor.fetchone()[0] if cursor else 0
        
        return jsonify({
            'success': True,
            'message': 'Deposit confirmed successfully',
            'transaction_id': transaction_hash,
            'new_balance': float(new_balance)
        })
        
    except Exception as e:
        print(f"Error in confirm_deposit_web: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/username/pending/add', methods=['POST', 'OPTIONS'])
def add_pending_username():
    """Add username to pending verification"""
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
        seller_wallet = data.get('seller_wallet')
        category = data.get('category', 'default')
        
        print(f"[DEBUG] Parsed: username={username}, price={price}, seller_id={seller_id}")
        
        if not username:
            return jsonify({'success': False, 'error': 'Username tidak boleh kosong'}), 400
        
        if not price or price <= 0:
            return jsonify({'success': False, 'error': 'Harga harus lebih dari 0'}), 400
        
        if not seller_id:
            return jsonify({'success': False, 'error': 'Seller ID diperlukan'}), 400
        
        # Clean username
        username_clean = username.lstrip('@')
        
        # CEK APAKAH USERNAME VALID (BOT BISA MENDETEKSI)
        # Kita coba deteksi dulu sebelum menambah ke pending
        import requests
        
        BOT_TOKEN = os.getenv("BOT_WINEDASH", "")
        
        if BOT_TOKEN:
            # Cek apakah username valid menggunakan Telegram Bot API
            check_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChat"
            check_params = {'chat_id': f"@{username_clean}"}
            
            try:
                check_response = requests.get(check_url, params=check_params, timeout=10)
                check_data = check_response.json()
                
                if not check_data.get('ok'):
                    error_msg = check_data.get('description', 'Username tidak valid')
                    print(f"[DEBUG] Username check failed: {error_msg}")
                    return jsonify({'success': False, 'error': f'Username @{username_clean} tidak ditemukan di Telegram!'}), 400
                else:
                    print(f"[DEBUG] Username @{username_clean} is valid!")
            except Exception as e:
                print(f"[DEBUG] Error checking username: {e}")
                # Lanjutkan meskipun gagal check, biar bot yang menentukan
        
        # Tambahkan ke pending
        pending_id = db.add_pending_username(
            username=username_clean,
            price=float(price),
            seller_id=seller_id,
            seller_wallet=seller_wallet or '',
            category=category,
            verification_type='auto'
        )
        
        print(f"[DEBUG] add_pending_username result: pending_id={pending_id}")
        
        if not pending_id:
            return jsonify({'success': False, 'error': 'Gagal menambahkan username (mungkin sudah ada)'}), 500
        
        return jsonify({
            'success': True,
            'pending_id': pending_id,
            'username': username_clean,
            'message': 'Username pending verification. Bot akan memproses dalam beberapa saat.'
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
    """Confirm pending username with OTP code"""
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
        print(f"[DEBUG] Fetching profile photo for username: {username}")
        
        # Bersihkan username
        username_clean = username.lstrip('@').strip()
        
        with sqlite3.connect(db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Cek di tabel usernames
            cursor.execute('SELECT photo_url FROM usernames WHERE username = ?', (username_clean,))
            row = cursor.fetchone()
            if row and row['photo_url'] and row['photo_url'].startswith('data:image'):
                print(f"[DEBUG] Found photo_url in usernames for {username_clean}")
                return jsonify({'success': True, 'photo_url': row['photo_url']})
            
            # Cek di tabel pending_usernames
            cursor.execute("PRAGMA table_info(pending_usernames)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'photo_url' in columns:
                cursor.execute('SELECT photo_url FROM pending_usernames WHERE username = ?', (username_clean,))
                row = cursor.fetchone()
                if row and row['photo_url'] and row['photo_url'].startswith('data:image'):
                    print(f"[DEBUG] Found photo_url in pending_usernames for {username_clean}")
                    return jsonify({'success': True, 'photo_url': row['photo_url']})
        
        # Return null agar frontend bisa fetch ulang nanti
        print(f"[DEBUG] No profile photo found for {username_clean}")
        return jsonify({'success': False, 'photo_url': None, 'message': 'No photo found'})
        
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
        print(f"[DEBUG] Photo URL length: {len(photo_url)} characters")
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Pastikan kolom photo_url ada di usernames
            cursor.execute("PRAGMA table_info(usernames)")
            columns = [col[1] for col in cursor.fetchall()]
            if 'photo_url' not in columns:
                cursor.execute('ALTER TABLE usernames ADD COLUMN photo_url TEXT')
                print("✅ Added photo_url column to usernames")
            
            # Cek di usernames
            cursor.execute('SELECT id FROM usernames WHERE username = ?', (username,))
            if cursor.fetchone():
                cursor.execute('UPDATE usernames SET photo_url = ? WHERE username = ?', (photo_url, username))
                print(f"✅ Updated photo_url in usernames for {username}")
            else:
                # Cek di pending_usernames
                cursor.execute("PRAGMA table_info(pending_usernames)")
                columns = [col[1] for col in cursor.fetchall()]
                if 'photo_url' not in columns:
                    cursor.execute('ALTER TABLE pending_usernames ADD COLUMN photo_url TEXT')
                    print("✅ Added photo_url column to pending_usernames")
                cursor.execute('UPDATE pending_usernames SET photo_url = ? WHERE username = ?', (photo_url, username))
                print(f"✅ Updated photo_url in pending_usernames for {username}")
            
            conn.commit()
        
        return jsonify({'success': True, 'message': 'Photo saved'})
        
    except Exception as e:
        print(f"Error saving profile photo: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@winedash_bp.route('/profile-photo/fetch/<string:username>', methods=['POST', 'OPTIONS'])
def fetch_profile_photo_via_bot(username):
    """Fetch profile photo directly via bot (like /get command)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        import requests
        import base64
        
        username_clean = username.lstrip('@').strip()
        BOT_TOKEN = os.getenv("BOT_WINEDASH", "")
        
        if not BOT_TOKEN:
            return jsonify({'success': False, 'error': 'Bot not configured'}), 500
        
        print(f"[DEBUG] Fetching profile photo for @{username_clean} via bot...")
        
        # Gunakan Telegram Bot API untuk mendapatkan foto profil
        # Method 1: getChat
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChat"
        params = {'chat_id': f"@{username_clean}"}
        
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        photo_url = None
        
        if data.get('ok') and data.get('result', {}).get('photo'):
            # Dapatkan file_id foto profil
            photo = data['result']['photo']
            if isinstance(photo, dict) and 'big_file_id' in photo:
                file_id = photo['big_file_id']
            elif isinstance(photo, list) and len(photo) > 0:
                # Ambil ukuran terbesar
                file_id = photo[-1]['file_id']
            else:
                file_id = None
            
            if file_id:
                # Get file path
                file_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getFile"
                file_response = requests.get(file_url, params={'file_id': file_id}, timeout=10)
                file_data = file_response.json()
                
                if file_data.get('ok'):
                    file_path = file_data['result']['file_path']
                    photo_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
                    print(f"[DEBUG] Got photo URL: {photo_url[:100]}...")
                    
                    # Download dan konversi ke base64 untuk disimpan
                    img_response = requests.get(photo_url, timeout=10)
                    if img_response.status_code == 200:
                        photo_base64 = f"data:image/jpeg;base64,{base64.b64encode(img_response.content).decode('ascii')}"
                        
                        # Simpan ke database
                        with sqlite3.connect(db.db_path) as conn:
                            cursor = conn.cursor()
                            
                            # Pastikan kolom photo_url ada
                            cursor.execute("PRAGMA table_info(usernames)")
                            columns = [col[1] for col in cursor.fetchall()]
                            if 'photo_url' not in columns:
                                cursor.execute('ALTER TABLE usernames ADD COLUMN photo_url TEXT')
                            
                            # Update di usernames
                            cursor.execute('UPDATE usernames SET photo_url = ? WHERE username = ?', (photo_base64, username_clean))
                            
                            # Juga update di pending_usernames
                            cursor.execute("PRAGMA table_info(pending_usernames)")
                            columns = [col[1] for col in cursor.fetchall()]
                            if 'photo_url' in columns:
                                cursor.execute('UPDATE pending_usernames SET photo_url = ? WHERE username = ?', (photo_base64, username_clean))
                            
                            conn.commit()
                        
                        return jsonify({'success': True, 'photo_url': photo_base64})
        
        # Method 2: Gunakan getChatMember untuk user
        if not photo_url:
            try:
                member_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember"
                member_params = {'chat_id': f"@{username_clean}", 'user_id': username_clean}
                # Ini mungkin tidak berhasil untuk channel/group
            except:
                pass
        
        # Jika tidak ada foto, kembalikan default
        initial = username_clean[0] if username_clean else 'U'
        default_avatar = f"https://ui-avatars.com/api/?name={initial}&background=40a7e3&color=fff&size=120&rounded=true&bold=true&length=1"
        return jsonify({'success': False, 'photo_url': default_avatar, 'message': 'No profile photo'})
        
    except Exception as e:
        print(f"Error in fetch_profile_photo_via_bot: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500