# services/frag_service.py - Flask Service untuk Fragment Stars Bot

from flask import Blueprint, request, jsonify, session
import sys
import os
import asyncio
import logging
from pathlib import Path

# Add path untuk import fragment modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import fragment modules
from fragment.api import fragment as frag_api
from fragment.api import wallet as wallet_api
from fragment.database import data as db_data

frag_bp = Blueprint('fragment', __name__, url_prefix='/api/fragment')
logger = logging.getLogger(__name__)

# ==================== KONFIGURASI ====================
# Load dari environment atau config
COOKIES = os.getenv("FRAGMENT_COOKIES", "")
HASH = os.getenv("FRAGMENT_HASH", "")
WALLET_API_KEY = os.getenv("WALLET_API_KEY", "")
WALLET_MNEMONIC_STR = os.getenv("WALLET_MNEMONIC", "[]")

try:
    WALLET_MNEMONIC = eval(WALLET_MNEMONIC_STR) if isinstance(WALLET_MNEMONIC_STR, str) else WALLET_MNEMONIC_STR
except:
    WALLET_MNEMONIC = []

PRICE_PER_STAR = float(os.getenv("PRICE_PER_STAR", 0.01))
MIN_STARS = int(os.getenv("MIN_STARS", 10))
MAX_STARS = int(os.getenv("MAX_STARS", 100000))

# ==================== HELPER FUNCTIONS ====================
def run_async(coro):
    """Run async function in sync context"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

# ==================== ENDPOINTS ====================

@frag_bp.route('/config', methods=['GET', 'OPTIONS'])
def get_config():
    """Get bot configuration"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    return jsonify({
        'success': True,
        'config': {
            'price_per_star': PRICE_PER_STAR,
            'min_stars': MIN_STARS,
            'max_stars': MAX_STARS
        }
    })

@frag_bp.route('/status', methods=['GET', 'OPTIONS'])
def get_status():
    """Get bot status (Fragment API, Wallet, Balance)"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    fragment_ok = bool(COOKIES and HASH)
    wallet_ok = bool(WALLET_API_KEY and WALLET_MNEMONIC)
    balance = 0.0
    
    if wallet_ok:
        try:
            balance = run_async(wallet_api.get_balance(WALLET_API_KEY, WALLET_MNEMONIC))
        except Exception as e:
            logger.error(f"Error getting balance: {e}")
            balance = 0.0
    
    return jsonify({
        'success': True,
        'status': {
            'fragment_ok': fragment_ok,
            'wallet_ok': wallet_ok,
            'balance': balance
        }
    })

@frag_bp.route('/stats', methods=['GET', 'OPTIONS'])
def get_stats():
    """Get purchase statistics"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        stats = run_async(db_data.get_all_stats())
        return jsonify({
            'success': True,
            'stats': {
                'total_purchases': stats.get('total_purchases', 0),
                'total_stars': stats.get('total_stars', 0),
                'total_volume': stats.get('total_volume_idr', 0)
            }
        })
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/purchases/recent', methods=['GET', 'OPTIONS'])
def get_recent_purchases():
    """Get recent purchases"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        limit = request.args.get('limit', default=20, type=int)
        
        conn = None
        try:
            import sqlite3
            from pathlib import Path
            db_path = Path(__file__).parent.parent / "frag.db"
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT recipient_username, stars_amount, price_ton, status, timestamp
                FROM purchases 
                WHERE status IN ('success', 'pending', 'failed')
                ORDER BY timestamp DESC LIMIT ?
            """, (limit,))
            
            rows = cursor.fetchall()
            purchases = []
            for row in rows:
                purchases.append({
                    'recipient_username': row[0],
                    'stars_amount': row[1],
                    'price_ton': row[2],
                    'status': row[3],
                    'timestamp': row[4]
                })
            
            return jsonify({'success': True, 'purchases': purchases})
        finally:
            if conn:
                conn.close()
                
    except Exception as e:
        logger.error(f"Error getting recent purchases: {e}")
        return jsonify({'success': True, 'purchases': []})

@frag_bp.route('/check-user', methods=['POST', 'OPTIONS'])
def check_user():
    """Check if username exists on Fragment"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        data = request.json
        username = data.get('username', '').strip().replace('@', '')
        
        if not username:
            return jsonify({'success': False, 'error': 'Username required'}), 400
        
        # Check Fragment API
        if not COOKIES or not HASH:
            return jsonify({'success': False, 'error': 'Fragment API not configured'}), 503
        
        user_info = run_async(frag_api.get_user_address(COOKIES, HASH, username))
        
        if user_info and user_info.get('found'):
            return jsonify({
                'success': True,
                'user': {
                    'nickname': user_info['found'].get('name'),
                    'address': user_info['found'].get('recipient')
                }
            })
        else:
            return jsonify({'success': False, 'error': 'User not found'}), 404
            
    except Exception as e:
        logger.error(f"Error checking user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/buy', methods=['POST', 'OPTIONS'])
def buy_stars():
    """Purchase stars via Fragment"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        data = request.json
        username = data.get('username', '').strip().replace('@', '')
        stars = data.get('stars', 0)
        show_sender = data.get('show_sender', True)
        
        if not username:
            return jsonify({'success': False, 'error': 'Username required'}), 400
        
        if stars < MIN_STARS or stars > MAX_STARS:
            return jsonify({'success': False, 'error': f'Stars must be between {MIN_STARS} and {MAX_STARS}'}), 400
        
        # Check configurations
        if not COOKIES or not HASH:
            return jsonify({'success': False, 'error': 'Fragment API not configured'}), 503
        
        if not WALLET_API_KEY or not WALLET_MNEMONIC:
            return jsonify({'success': False, 'error': 'Wallet not configured'}), 503
        
        # Get user info from Fragment
        user_info = run_async(frag_api.get_user_address(COOKIES, HASH, username))
        if not user_info or not user_info.get('found'):
            return jsonify({'success': False, 'error': 'User not found on Fragment'}), 404
        
        nickname = user_info['found'].get('name')
        address = user_info['found'].get('recipient')
        
        # Initialize buy order
        init_result = run_async(frag_api.init_buy_stars(COOKIES, HASH, address, stars))
        if not init_result or not init_result.get('req_id'):
            return jsonify({'success': False, 'error': 'Failed to initialize purchase'}), 500
        
        req_id = init_result['req_id']
        
        # Get payment details
        show_sender_value = "1" if show_sender else "0"
        buy_result = run_async(frag_api.get_buy_stars(COOKIES, HASH, req_id, show_sender_value))
        
        if not buy_result:
            return jsonify({'success': False, 'error': 'Failed to get payment details'}), 500
        
        messages = buy_result.get('transaction', {}).get('messages', [])
        if not messages:
            return jsonify({'success': False, 'error': 'No payment messages'}), 500
        
        pay_address = messages[0].get('address')
        amount = messages[0].get('amount')
        payload = messages[0].get('payload')
        
        if not all([pay_address, amount, payload]):
            return jsonify({'success': False, 'error': 'Missing payment data'}), 500
        
        # Decode payload
        decoded_payload = run_async(frag_api.encoded(payload))
        
        # Save purchase record (pending)
        user_id = session.get('user_id', 0) or 1  # Fallback
        price_ton = stars * PRICE_PER_STAR
        
        run_async(db_data.save_purchase(
            user_id=user_id,
            recipient_username=username,
            recipient_nickname=nickname,
            stars_amount=stars,
            price_idr=price_ton * 15000,  # Approximate IDR conversion
            price_ton=price_ton,
            show_sender=show_sender,
            status='pending',
            bot_token='fragment_bot'
        ))
        
        # Send transaction
        tx_hash = run_async(wallet_api.send_transfer(
            api_key=WALLET_API_KEY,
            mnemonic=WALLET_MNEMONIC,
            address=pay_address,
            amount=int(amount),
            payload=decoded_payload
        ))
        
        if tx_hash:
            # Update purchase record to success
            run_async(db_data.save_purchase(
                user_id=user_id,
                recipient_username=username,
                recipient_nickname=nickname,
                stars_amount=stars,
                price_idr=price_ton * 15000,
                price_ton=price_ton,
                tx_hash=tx_hash,
                show_sender=show_sender,
                status='success',
                bot_token='fragment_bot'
            ))
            
            return jsonify({
                'success': True,
                'transaction_hash': tx_hash,
                'message': 'Purchase successful'
            })
        else:
            return jsonify({'success': False, 'error': 'Transaction failed'}), 500
            
    except Exception as e:
        logger.error(f"Error buying stars: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def _cors_response(response):
    """Add CORS headers to response"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response