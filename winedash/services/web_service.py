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
    """Get all available usernames"""
    try:
        category = request.args.get('category')
        limit = request.args.get('limit', 50, type=int)
        
        usernames = db.get_available_usernames(category, limit)
        
        return jsonify({
            'success': True,
            'usernames': usernames,
            'total': len(usernames)
        })
        
    except Exception as e:
        print(f"Error in get_usernames: {e}")
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
    
# winedash/services/web_service.py - Tambahkan method PUT di bagian user

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