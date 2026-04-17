import os
import json
import hashlib
import base64
import time
import secrets
from datetime import datetime
from flask import Blueprint, request, jsonify, send_from_directory
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# PERBAIKAN: Import langsung dari file web.py di folder database
# Karena folder database ada di dalam folder winedash
from winedash.database.web import WinedashDatabase

# Create blueprint
winedash_bp = Blueprint('winedash', __name__, url_prefix='/winedash')

# Database path
DB_PATH = os.getenv('WINEDASH_DB_PATH', '/root/winedash/users.db')
# Pastikan direktori untuk database ada
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
db = WinedashDatabase(DB_PATH)

# Configuration
WEB_ADDRESS = os.getenv('WEB_ADDRESS', 'UQBX9MJCyRK3-eQjh7CgbwB2bR9hT5vYAdzx4uv_CagAo4Ra')
TUNNEL_URL = os.getenv('TUNNEL_URL', 'https://companel.shop')


# ==================== USER AUTHENTICATION ====================

@winedash_bp.route('/auth/telegram', methods=['POST'])
def auth_telegram():
    """Authenticate user with Telegram data"""
    data = request.json
    
    telegram_id = data.get('telegram_id')
    telegram_username = data.get('telegram_username')
    telegram_first_name = data.get('telegram_first_name')
    telegram_last_name = data.get('telegram_last_name')
    telegram_photo_url = data.get('telegram_photo_url')
    wallet_address = data.get('wallet_address')
    
    if not telegram_id:
        return jsonify({'success': False, 'error': 'Telegram ID required'}), 400
    
    # Save or update user
    user_id, balance = db.save_user(
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        telegram_first_name=telegram_first_name,
        telegram_last_name=telegram_last_name,
        telegram_photo_url=telegram_photo_url,
        wallet_address=wallet_address
    )
    
    # Update last active
    db.update_last_active(telegram_id)
    
    return jsonify({
        'success': True,
        'user_id': user_id,
        'balance': balance,
        'message': 'User authenticated successfully'
    })


@winedash_bp.route('/user/<telegram_id>', methods=['GET'])
def get_user(telegram_id):
    """Get user data"""
    user = db.get_user(telegram_id)
    
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'user': {
            'telegram_id': user['telegram_id'],
            'telegram_username': user['telegram_username'],
            'telegram_first_name': user['telegram_first_name'],
            'telegram_last_name': user['telegram_last_name'],
            'telegram_photo_url': user['telegram_photo_url'],
            'wallet_address': user['wallet_address'],
            'balance_ton': user['balance_ton'],
            'total_deposited': user['total_deposited'],
            'total_withdrawn': user['total_withdrawn'],
            'created_at': user['created_at'],
            'last_active': user['last_active']
        }
    })


@winedash_bp.route('/user/wallet', methods=['POST'])
def update_wallet():
    """Update user's wallet address"""
    data = request.json
    telegram_id = data.get('telegram_id')
    wallet_address = data.get('wallet_address')
    
    if not telegram_id:
        return jsonify({'success': False, 'error': 'Telegram ID required'}), 400
    
    db.update_wallet_address(telegram_id, wallet_address)
    
    return jsonify({'success': True, 'message': 'Wallet updated'})


# ==================== BALANCE ENDPOINTS ====================

@winedash_bp.route('/balance/<telegram_id>', methods=['GET'])
def get_balance(telegram_id):
    """Get user balance"""
    balance = db.get_user_balance(telegram_id)
    
    return jsonify({
        'success': True,
        'balance': balance,
        'formatted': f"{balance:.2f} TON"
    })


@winedash_bp.route('/stats/<telegram_id>', methods=['GET'])
def get_user_stats(telegram_id):
    """Get user statistics"""
    stats = db.get_user_stats(telegram_id)
    
    if not stats:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'stats': stats
    })


# ==================== DEPOSIT ENDPOINTS ====================

@winedash_bp.route('/deposit/info', methods=['GET'])
def deposit_info():
    """Get deposit information"""
    return jsonify({
        'success': True,
        'web_address': WEB_ADDRESS,
        'min_deposit': 0.1,
        'network': 'mainnet'
    })


@winedash_bp.route('/deposit/create-payload', methods=['POST'])
def create_deposit_payload():
    """Create payload for TON Connect deposit"""
    data = request.json
    telegram_id = data.get('telegram_id')
    amount_ton = float(data.get('amount_ton', 0))
    
    # Validate
    if amount_ton < 0.1:
        return jsonify({'success': False, 'error': 'Minimum deposit 0.1 TON'}), 400
    
    # Get user
    user = db.get_user(telegram_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    
    # Create memo
    timestamp = int(time.time())
    reference = f"wd_deposit_{telegram_id}_{timestamp}"
    memo_plain = f"deposit:{telegram_id}:{timestamp}"
    
    # Create payload (comment in TON)
    memo_bytes = memo_plain.encode('utf-8')
    comment_prefix = b'\x00\x00\x00\x00'  # Text comment prefix
    full_bytes = comment_prefix + memo_bytes
    payload_base64 = base64.b64encode(full_bytes).decode('utf-8')
    
    # Convert amount to nano
    amount_nano = str(int(amount_ton * 1_000_000_000))
    
    # Save payment tracking
    body_hash = hashlib.sha256(reference.encode()).hexdigest()
    db.save_payment_tracking(reference, body_hash, telegram_id, amount_ton)
    
    return jsonify({
        'success': True,
        'transaction': {
            'address': WEB_ADDRESS,
            'amount': amount_nano,
            'payload': payload_base64
        },
        'reference': reference,
        'memo_plain': memo_plain
    })


@winedash_bp.route('/deposit/verify', methods=['POST'])
def verify_deposit():
    """Verify and record deposit transaction"""
    data = request.json
    telegram_id = data.get('telegram_id')
    transaction_hash = data.get('transaction_hash')
    amount_ton = float(data.get('amount_ton', 0))
    from_address = data.get('from_address')
    reference = data.get('reference')
    memo = data.get('memo', '')
    
    # Get user
    user = db.get_user(telegram_id)
    if not user:
        return jsonify({'success': False, 'error': 'User not found'}), 404
    
    # Check if transaction already exists
    existing = db.get_transaction_by_reference(reference)
    if existing:
        return jsonify({
            'success': False, 
            'error': 'Transaction already processed'
        }), 400
    
    # Save transaction
    tx_id = db.save_transaction(
        user_id=user['id'],
        transaction_hash=transaction_hash,
        amount_ton=amount_ton,
        from_address=from_address,
        to_address=WEB_ADDRESS,
        memo=memo,
        transaction_type='deposit',
        reference=reference
    )
    
    if not tx_id:
        return jsonify({
            'success': False, 
            'error': 'Failed to save transaction'
        }), 500
    
    # Add balance to user
    new_balance = db.add_balance(
        telegram_id=telegram_id,
        amount_ton=amount_ton,
        transaction_id=tx_id,
        reason="deposit"
    )
    
    # Update payment tracking
    db.update_payment_tracking(reference, 'completed', transaction_hash)
    
    return jsonify({
        'success': True,
        'transaction_id': tx_id,
        'new_balance': new_balance,
        'message': f'Deposit of {amount_ton} TON confirmed!'
    })


# ==================== TON CONNECT MANIFEST ====================

@winedash_bp.route('/tonconnect-manifest.json', methods=['GET'])
def get_ton_manifest():
    """Serve TON Connect manifest"""
    domain = request.host.split(':')[0]
    
    # Get manifest from database
    manifest = db.get_ton_manifest(domain)
    
    if not manifest:
        # Return default manifest
        manifest = {
            "url": f"https://{domain}",
            "name": "Winedash",
            "iconUrl": f"https://{domain}/images/winedash-icon.png",
            "termsOfUseUrl": f"https://{domain}/terms",
            "privacyPolicyUrl": f"https://{domain}/privacy"
        }
    
    return jsonify(manifest)


@winedash_bp.route('/manifest/save', methods=['POST'])
def save_manifest():
    """Save TON Connect manifest (admin only)"""
    data = request.json
    domain = data.get('domain')
    name = data.get('name')
    icon_url = data.get('icon_url')
    terms_url = data.get('terms_url')
    privacy_url = data.get('privacy_url')
    
    if not domain:
        return jsonify({'success': False, 'error': 'Domain required'}), 400
    
    manifest = db.save_ton_manifest(domain, name, icon_url, terms_url, privacy_url)
    
    return jsonify({
        'success': True,
        'manifest': manifest
    })


# ==================== TRANSACTION HISTORY ====================

@winedash_bp.route('/transactions/<telegram_id>', methods=['GET'])
def get_transactions(telegram_id):
    """Get user transaction history"""
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    transactions = db.get_user_transactions(telegram_id, limit, offset)
    
    return jsonify({
        'success': True,
        'transactions': transactions,
        'count': len(transactions)
    })


# ==================== HEALTH CHECK ====================

@winedash_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'service': 'Winedash',
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })


# ==================== STATIC FILES ====================

@winedash_bp.route('/', methods=['GET'])
def serve_index():
    """Serve main HTML page"""
    html_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'winedash', 'html', 'web.html')
    return send_from_directory(os.path.dirname(html_path), 'web.html')


@winedash_bp.route('/css/<path:filename>', methods=['GET'])
def serve_css(filename):
    """Serve CSS files"""
    css_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'winedash', 'css')
    return send_from_directory(css_path, filename)


@winedash_bp.route('/js/<path:filename>', methods=['GET'])
def serve_js(filename):
    """Serve JS files"""
    js_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'winedash', 'js')
    return send_from_directory(js_path, filename)