# services/frag_service.py - Flask Service untuk Fragment Bot Admin Panel

from flask import Blueprint, request, jsonify, make_response
import sys
import os
import asyncio
import logging
import json
import sqlite3
import secrets
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import dari database
from fragment.database.data import (
    init_database,
    authenticate_panel_user,
    create_panel_session,
    get_panel_session as validate_panel_session,
    get_current_user_from_session,
    get_current_admin_from_session,
    get_all_bot_owners,
    get_bot_owner,
    get_cloned_bots,
    get_bot_by_token,
    update_bot_status,
    remove_cloned_bot,
    get_all_activities,
    get_master_stats,
    get_pending_deposits,
    update_deposit_status,
    get_withdrawal_requests,
    approve_withdrawal,
    reject_withdrawal,
    get_payment_methods,
    get_master_setting,
    save_master_setting,
    add_admin,
    is_admin,
    log_owner_activity,
    get_owner_balance,
    add_owner_balance,
    deduct_owner_balance,
    get_all_stats,
    get_chart_data,
    get_recent_activities,
    get_bot_stats,
    get_all_users_with_stats,
    get_bot_logs,
    get_panel_user_by_bot_token,
    create_panel_user,
    create_bot_owner,
    add_cloned_bot
)

from fragment.database.data_clone import get_user_stats
from fragment.database.orders import (
    init_bot_orders_table,
    save_bot_order,
    get_bot_order,
    update_bot_order_status,
    check_bot_token_exists,
    check_username_exists,
    check_telegram_id_exists,
    get_bot_owner_by_username
)
from fragment.api.pakasir import (
    generate_order_id,
    create_pakasir_payment,
    check_pakasir_payment
)

frag_bp = Blueprint('fragment', __name__, url_prefix='/api/fragment')
logger = logging.getLogger(__name__)

# Database path
DB_PATH = Path(__file__).parent.parent / "fragment" / "frag.db"


def get_db_connection():
    """Get SQLite database connection"""
    return sqlite3.connect(str(DB_PATH))


def run_async(coro):
    """Run async function in sync context"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)


def _cors_response(response):
    """Add CORS headers to response"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token')
    return response


# ==================== AUTH MIDDLEWARE ====================

def get_session_from_request():
    """Get session token from request headers"""
    return request.headers.get('X-Session-Token')


def require_auth(f):
    """Decorator untuk memeriksa autentikasi"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == 'OPTIONS':
            return _cors_response(jsonify({'success': True}))
        
        session_token = get_session_from_request()
        if not session_token:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        
        user_session = run_async(validate_panel_session(session_token))
        if not user_session:
            return jsonify({'success': False, 'error': 'Session expired'}), 401
        
        request.user_session = user_session
        return f(*args, **kwargs)
    return decorated_function


# ==================== AUTH ENDPOINTS ====================

@frag_bp.route('/login', methods=['POST', 'OPTIONS'])
def login():
    """Login endpoint"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'Username dan password diperlukan'}), 400
        
        user = run_async(authenticate_panel_user(username, password))
        if not user:
            return jsonify({'success': False, 'error': 'Username atau password salah'}), 401
        
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent')
        
        session_token = run_async(create_panel_session(user['id'], ip_address, user_agent))
        if not session_token:
            return jsonify({'success': False, 'error': 'Gagal membuat session'}), 500
        
        return jsonify({
            'success': True,
            'session_token': session_token,
            'user': {
                'id': user['id'],
                'username': user['username']
            }
        })
    except Exception as e:
        logger.error(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@frag_bp.route('/logout', methods=['POST', 'OPTIONS'])
@require_auth
def logout():
    """Logout endpoint"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    session_token = get_session_from_request()
    if session_token:
        run_async(delete_panel_session(session_token))
    
    return jsonify({'success': True})


@frag_bp.route('/profile', methods=['GET', 'OPTIONS'])
@require_auth
def get_profile():
    """Get user profile"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT username, bot_token, created_at, last_login
            FROM panel_users WHERE id = ?
        """, (user_session['user_id'],))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({
                'success': True,
                'profile': {
                    'id': user_session['user_id'],
                    'username': row[0],
                    'bot_token': row[1] or user_session.get('bot_token'),
                    'created_at': row[2],
                    'last_login': row[3]
                }
            })
        return jsonify({'success': False, 'error': 'User not found'}), 404
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== DASHBOARD ENDPOINTS ====================

@frag_bp.route('/dashboard/stats', methods=['GET', 'OPTIONS'])
@require_auth
def get_dashboard_stats():
    """Get dashboard statistics with chart data"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        
        bots = run_async(get_cloned_bots())
        total_bots = len(bots)
        
        all_stats = run_async(get_all_stats, bot_token)
        
        chart_data = run_async(get_chart_data, bot_token, 7)
        
        activities = run_async(get_recent_activities, bot_token, 10)
        
        return jsonify({
            'success': True,
            'stats': {
                'total_bots': total_bots,
                'total_users': all_stats.get('total_users', 0),
                'total_stars': all_stats.get('total_stars', 0),
                'total_volume': float(all_stats.get('total_volume_idr', 0) or 0),
            },
            'chart': {
                'labels': chart_data.get('labels', []),
                'values': chart_data.get('values', [])
            },
            'activities': [
                {
                    'id': i,
                    'icon': 'shopping-cart',
                    'message': a.get('details') or a.get('action', ''),
                    'timestamp': a.get('timestamp')
                }
                for i, a in enumerate(activities)
            ]
        })
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@frag_bp.route('/bot/info', methods=['GET', 'OPTIONS'])
@require_auth
def get_bot_info():
    """Get bot information for current user"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        
        bots = run_async(get_cloned_bots())
        bot_info = None
        
        for bot in bots:
            if bot_token and bot.get('bot_token') == bot_token:
                bot_info = bot
                break
            elif not bot_token:
                bot_info = bot
                break
        
        if bot_info:
            stats = run_async(get_bot_stats, bot_info['bot_token'])
            return jsonify({
                'success': True,
                'bot': {
                    'id': bot_info.get('id'),
                    'bot_token': bot_info.get('bot_token'),
                    'bot_username': bot_info.get('bot_username'),
                    'bot_name': bot_info.get('bot_name'),
                    'status': bot_info.get('status'),
                    'created_at': bot_info.get('created_at'),
                    'last_started': bot_info.get('last_started'),
                    'last_stopped': bot_info.get('last_stopped'),
                    'stats': stats
                }
            })
        
        return jsonify({'success': True, 'bot': None})
    except Exception as e:
        logger.error(f"Error getting bot info: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@frag_bp.route('/users/list', methods=['GET', 'OPTIONS'])
@require_auth
def get_users_list():
    """Get list of users with their stats"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        limit = request.args.get('limit', default=50, type=int)
        
        users = run_async(get_all_users_with_stats, bot_token, limit)
        
        return jsonify({
            'success': True,
            'users': users,
            'total': len(users)
        })
    except Exception as e:
        logger.error(f"Error getting users list: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== LOBBY ENDPOINTS ====================

@frag_bp.route('/lobby/dashboard/stats', methods=['GET', 'OPTIONS'])
@require_auth
def lobby_dashboard_stats():
    """Get dashboard stats for lobby"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        
        stats = run_async(get_all_stats, bot_token)
        chart = run_async(get_chart_data, bot_token, 7)
        activities = run_async(get_recent_activities, bot_token, 10)
        
        return jsonify({
            'success': True,
            'stats': {
                'total_users': stats.get('total_users', 0),
                'total_bots': stats.get('total_bots', 0),
                'total_stars': stats.get('total_stars', 0),
                'total_volume': float(stats.get('total_volume_idr', 0) or 0)
            },
            'chart': {
                'labels': chart.get('labels', []),
                'values': chart.get('values', [])
            },
            'activities': [
                {
                    'id': i,
                    'icon': 'shopping-cart',
                    'message': a.get('details') or a.get('action', ''),
                    'timestamp': a.get('timestamp')
                }
                for i, a in enumerate(activities)
            ]
        })
    except Exception as e:
        logger.error(f"Error getting lobby dashboard stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@frag_bp.route('/lobby/profile', methods=['GET', 'OPTIONS'])
@require_auth
def lobby_get_profile():
    """Get user profile for lobby"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        user = run_async(get_bot_owner, user_session['owner_id'])
        bots = run_async(get_cloned_bots, user_session['owner_id'])
        
        return jsonify({
            'success': True,
            'profile': {
                'id': user.get('id'),
                'username': user.get('username'),
                'owner_name': user.get('owner_name'),
                'email': user.get('email'),
                'whatsapp': user.get('whatsapp'),
                'balance': user.get('balance', 0),
                'created_at': user.get('created_at'),
                'expires_at': user.get('expires_at'),
                'last_login': user.get('last_login'),
                'telegram_id': user.get('telegram_id')
            },
            'telegram_user': {},
            'bots': [
                {
                    'id': b.get('id'),
                    'bot_token': b.get('bot_token'),
                    'bot_username': b.get('bot_username'),
                    'bot_name': b.get('bot_name'),
                    'status': b.get('status'),
                    'created_at': b.get('created_at'),
                    'expires_at': b.get('expires_at')
                }
                for b in bots
            ]
        })
    except Exception as e:
        logger.error(f"Error getting lobby profile: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@frag_bp.route('/lobby/telegram-auth', methods=['POST', 'OPTIONS'])
def lobby_telegram_auth():
    """Handle Telegram WebApp authentication"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        data = request.json
        init_data = data.get('init_data')
        
        if not init_data:
            return jsonify({'success': False, 'error': 'No init data'}), 400
        
        MASTER_BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
        
        if not MASTER_BOT_TOKEN:
            logger.error("BOT_TOKEN not configured")
            return jsonify({'success': False, 'error': 'Server configuration error'}), 500
        
        import hmac
        import hashlib
        import json
        
        params = {}
        for item in init_data.split('&'):
            if '=' in item:
                key, value = item.split('=', 1)
                params[key] = value
        
        if 'hash' not in params:
            return jsonify({'success': False, 'error': 'Invalid auth data'}), 400
        
        auth_hash = params.pop('hash')
        sorted_params = sorted(params.items())
        check_string = '\n'.join(f"{k}={v}" for k, v in sorted_params)
        
        secret_key = hmac.new(
            b"WebAppData",
            MASTER_BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()
        
        computed_hash = hmac.new(
            secret_key,
            check_string.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if computed_hash != auth_hash:
            logger.warning(f"Telegram auth hash mismatch")
            return jsonify({'success': False, 'error': 'Invalid hash'}), 401
        
        auth_date = int(params.get('auth_date', 0))
        if datetime.now().timestamp() - auth_date > 86400:
            return jsonify({'success': False, 'error': 'Auth expired'}), 401
        
        user_data = json.loads(params.get('user', '{}'))
        telegram_id = user_data.get('id')
        
        if not telegram_id:
            return jsonify({'success': False, 'error': 'No user data'}), 400
        
        from fragment.database.data import DB_PATH as MASTER_DB_PATH
        
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, username, owner_name, email, balance, expires_at FROM bot_owners WHERE telegram_id = ?",
            (telegram_id,)
        )
        row = cursor.fetchone()
        
        if row:
            user = {
                'id': row[0],
                'username': row[1],
                'owner_name': row[2],
                'email': row[3],
                'balance': row[4],
                'expires_at': row[5]
            }
            conn.close()
        else:
            username = user_data.get('username') or f"user_{telegram_id}"
            temp_password = secrets.token_urlsafe(16)
            
            owner_id = run_async(
                create_bot_owner,
                username,
                temp_password,
                owner_name=f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
                email=None,
                expires_days=30
            )
            
            if not owner_id:
                conn.close()
                return jsonify({'success': False, 'error': 'Failed to create user'}), 500
            
            cursor.execute(
                "UPDATE bot_owners SET telegram_id = ? WHERE id = ?",
                (telegram_id, owner_id)
            )
            conn.commit()
            conn.close()
            
            user = run_async(get_bot_owner, owner_id)
        
        session_token = run_async(
            create_panel_session,
            user['id'],
            request.headers.get('X-Forwarded-For', request.remote_addr),
            request.headers.get('User-Agent')
        )
        
        return jsonify({
            'success': True,
            'session_token': session_token,
            'user': {
                'id': user['id'],
                'username': user.get('username'),
                'first_name': user_data.get('first_name'),
                'last_name': user_data.get('last_name'),
                'balance': user.get('balance', 0)
            }
        })
        
    except Exception as e:
        logger.error(f"Telegram auth error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@frag_bp.route('/lobby/logout', methods=['POST', 'OPTIONS'])
def lobby_logout():
    """Logout from lobby"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    session_token = get_session_from_request()
    if session_token:
        run_async(delete_panel_session, session_token)
    
    return jsonify({'success': True})


@frag_bp.route('/lobby/me', methods=['GET', 'OPTIONS'])
def lobby_me():
    """Get current user from session"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    session_token = get_session_from_request()
    if session_token:
        user_session = run_async(validate_panel_session(session_token))
        if user_session:
            user = run_async(get_bot_owner, user_session['owner_id'])
            if user:
                return jsonify({
                    'success': True,
                    'user': {
                        'id': user.get('id'),
                        'username': user.get('username'),
                        'owner_name': user.get('owner_name'),
                        'balance': user.get('balance', 0)
                    }
                })
    
    return jsonify({'success': False, 'error': 'Not authenticated'}), 401


# ==================== CREATE BOT ORDER ENDPOINT ====================

@frag_bp.route('/lobby/create-order', methods=['POST', 'OPTIONS'])
def lobby_create_order():
    """Create bot order and generate payment QRIS via Pakasir"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        data = request.json
        plan = data.get('plan')
        bot_token = data.get('bot_token', '').strip()
        telegram_id = data.get('telegram_id')
        username = data.get('username', '').strip().lower()
        password = data.get('password')
        
        plan_prices = {
            'basic': 100000,
            'pro': 250000,
            'enterprise': 500000
        }
        
        if not all([plan, bot_token, telegram_id, username, password]):
            return jsonify({'success': False, 'error': 'Semua field harus diisi'}), 400
        
        if plan not in plan_prices:
            return jsonify({'success': False, 'error': 'Plan tidak valid'}), 400
        
        import re
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({'success': False, 'error': 'Username hanya boleh berisi huruf, angka, dan underscore'}), 400
        
        if len(username) < 3:
            return jsonify({'success': False, 'error': 'Username minimal 3 karakter'}), 400
        
        if len(password) < 6:
            return jsonify({'success': False, 'error': 'Password minimal 6 karakter'}), 400
        
        if ':' not in bot_token:
            return jsonify({'success': False, 'error': 'Format bot token tidak valid'}), 400
        
        # CEK DUPLIKAT
        if check_bot_token_exists(bot_token):
            return jsonify({'success': False, 'error': 'Bot token sudah terdaftar'}), 400
        
        if check_username_exists(username):
            return jsonify({'success': False, 'error': f'Username "{username}" sudah digunakan'}), 400
        
        if check_telegram_id_exists(telegram_id):
            return jsonify({'success': False, 'error': 'Telegram ID sudah terdaftar'}), 400
        
        amount = plan_prices[plan]
        order_id = generate_order_id()
        
        payment_result = create_pakasir_payment(amount, order_id, username, None)
        
        if not payment_result:
            return jsonify({'success': False, 'error': 'Gagal membuat pembayaran, silakan coba lagi'}), 500
        
        qr_string = None
        pakasir_payment_id = None
        
        if payment_result.get('data'):
            payment_data = payment_result['data']
            pakasir_payment_id = payment_data.get('id')
            qr_string = payment_data.get('qr_string') or payment_data.get('qris_string')
        
        if not qr_string:
            return jsonify({'success': False, 'error': 'Gagal mendapatkan QRIS payment'}), 500
        
        success = save_bot_order(
            order_id=order_id,
            plan=plan,
            bot_token=bot_token,
            telegram_id=telegram_id,
            username=username,
            password=password,
            amount=amount,
            pakasir_payment_id=pakasir_payment_id,
            qr_string=qr_string
        )
        
        if not success:
            return jsonify({'success': False, 'error': 'Gagal menyimpan order'}), 500
        
        return jsonify({
            'success': True,
            'order_id': order_id,
            'amount': amount,
            'qr_string': qr_string,
            'payment_url': f'/fragment/pay?order_id={order_id}',
            'message': 'Silakan scan QRIS untuk melakukan pembayaran'
        })
        
    except Exception as e:
        logger.error(f"Error creating bot order: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== CHECK PAYMENT ENDPOINT ====================

@frag_bp.route('/lobby/check-payment', methods=['GET', 'OPTIONS'])
def lobby_check_payment():
    """Check payment status for an order"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        order_id = request.args.get('order_id')
        
        if not order_id:
            return jsonify({'success': False, 'error': 'Order ID required'}), 400
        
        order = get_bot_order(order_id)
        
        if not order:
            return jsonify({'success': False, 'error': 'Order not found'}), 404
        
        if order['status'] == 'completed':
            return jsonify({
                'success': True,
                'status': 'completed',
                'message': 'Bot sudah dibuat. Silakan login.',
                'redirect_url': '/fragment/login'
            })
        
        payment_status = check_pakasir_payment(order_id)
        
        if payment_status and payment_status.get('data'):
            status = payment_status['data'].get('status')
            
            if status in ['PAID', 'SETTLED', 'COMPLETED']:
                if order['status'] != 'completed':
                    from fragment.database.data import get_jakarta_time_iso
                    
                    expires_days = 30 if order['plan'] == 'basic' else 90 if order['plan'] == 'pro' else 365
                    temp_password = secrets.token_urlsafe(12)
                    
                    owner_id = run_async(
                        create_bot_owner,
                        order['username'],
                        temp_password,
                        owner_name=None,
                        email=None,
                        expires_days=expires_days
                    )
                    
                    if owner_id:
                        try:
                            from fragment.database.data import DB_PATH as MASTER_DB_PATH
                            conn = sqlite3.connect(str(MASTER_DB_PATH))
                            cursor = conn.cursor()
                            cursor.execute(
                                "UPDATE bot_owners SET telegram_id = ? WHERE id = ?",
                                (order['telegram_id'], owner_id)
                            )
                            conn.commit()
                            conn.close()
                        except Exception as e:
                            logger.error(f"Error updating telegram_id: {e}")
                        
                        bot_username = f"{order['username']}_bot"
                        bot_name = f"Fragment Bot - {order['username']}"
                        
                        success = run_async(
                            add_cloned_bot,
                            order['bot_token'],
                            bot_username,
                            bot_name,
                            owner_id,
                            expires_days=expires_days
                        )
                        
                        if success:
                            completed_at = get_jakarta_time_iso()
                            update_bot_order_status(order_id, 'completed', owner_id, completed_at)
                            run_async(log_owner_activity, owner_id, "bot_created", 
                                     f"Created bot {bot_username} with plan {order['plan']}")
                            
                            return jsonify({
                                'success': True,
                                'status': 'completed',
                                'message': 'Pembayaran berhasil! Bot telah dibuat.',
                                'redirect_url': '/fragment/login'
                            })
                        else:
                            return jsonify({
                                'success': False,
                                'status': 'pending',
                                'error': 'Gagal membuat bot, silakan hubungi support'
                            }), 500
                    else:
                        return jsonify({
                            'success': False,
                            'status': 'pending',
                            'error': 'Gagal membuat user, silakan hubungi support'
                        }), 500
                else:
                    return jsonify({
                        'success': True,
                        'status': 'completed',
                        'message': 'Bot sudah dibuat. Silakan login.',
                        'redirect_url': '/fragment/login'
                    })
            elif status == 'EXPIRED':
                update_bot_order_status(order_id, 'expired')
                return jsonify({
                    'success': False,
                    'status': 'expired',
                    'error': 'Pembayaran sudah kadaluarsa'
                }), 400
            else:
                return jsonify({
                    'success': False,
                    'status': 'pending',
                    'message': 'Menunggu pembayaran...'
                })
        else:
            return jsonify({
                'success': False,
                'status': order['status'],
                'message': 'Cek status pembayaran...'
            })
            
    except Exception as e:
        logger.error(f"Error checking payment: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== RENDER PAYMENT PAGE ====================

@frag_bp.route('/pay', methods=['GET'])
def payment_page():
    """Render payment page HTML"""
    order_id = request.args.get('order_id')
    
    if not order_id:
        return '<html><body><h3>Order ID not found</h3></body></html>', 400
    
    order = get_bot_order(order_id)
    
    if not order:
        return '<html><body><h3>Order not found</h3></body></html>', 404
    
    html_content = f'''
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Payment - Fragment Bot</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Inter', sans-serif;
                background: linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }}
            .payment-container {{
                max-width: 480px;
                width: 100%;
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 24px;
                padding: 24px;
            }}
            .payment-header {{ text-align: center; margin-bottom: 24px; }}
            .payment-header i {{ font-size: 48px; color: #40a7e3; margin-bottom: 12px; }}
            .payment-header h2 {{ font-size: 20px; color: white; margin-bottom: 8px; }}
            .payment-header p {{ font-size: 13px; color: rgba(255, 255, 255, 0.6); }}
            .order-info {{
                background: rgba(0, 0, 0, 0.3);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 20px;
            }}
            .order-info-row {{
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 13px;
            }}
            .order-info-row:last-child {{ border-bottom: none; }}
            .order-info-label {{ color: rgba(255, 255, 255, 0.6); }}
            .order-info-value {{ color: white; font-weight: 500; }}
            .amount {{ font-size: 24px; font-weight: 700; color: #40a7e3; }}
            .qris-section {{ text-align: center; margin-bottom: 24px; }}
            .qris-image {{
                background: white;
                border-radius: 16px;
                padding: 16px;
                display: inline-block;
                margin-bottom: 12px;
            }}
            .qris-image img {{ width: 200px; height: 200px; object-fit: contain; }}
            .status-section {{ text-align: center; margin-bottom: 20px; }}
            .status-badge {{
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
            }}
            .status-pending {{ background: rgba(245, 158, 11, 0.2); color: #f59e0b; }}
            .status-success {{ background: rgba(16, 185, 129, 0.2); color: #10b981; }}
            .btn-check {{
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #40a7e3, #2d8bcb);
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                margin-bottom: 12px;
                transition: all 0.2s;
            }}
            .btn-check:hover {{ transform: translateY(-2px); box-shadow: 0 8px 20px rgba(64, 167, 227, 0.3); }}
            .btn-check:disabled {{ opacity: 0.6; transform: none; }}
            .btn-copy {{
                width: 100%;
                padding: 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                color: white;
                font-size: 13px;
                cursor: pointer;
                margin-bottom: 12px;
            }}
            .timer {{ text-align: center; font-size: 12px; color: rgba(255, 255, 255, 0.5); margin-top: 16px; }}
            .error-message {{
                background: rgba(239, 68, 68, 0.15);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 12px;
                padding: 12px;
                color: #ef4444;
                font-size: 12px;
                text-align: center;
                margin-bottom: 16px;
                display: none;
            }}
            @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
            .fa-spin {{ animation: spin 1s linear infinite; }}
        </style>
    </head>
    <body>
        <div class="payment-container">
            <div class="payment-header">
                <i class="fas fa-qrcode"></i>
                <h2>Pembayaran Bot Clone</h2>
                <p>Scan QRIS untuk menyelesaikan pembayaran</p>
            </div>
            
            <div class="order-info">
                <div class="order-info-row">
                    <span class="order-info-label">Order ID</span>
                    <span class="order-info-value">{order['order_id'][:20]}...</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Plan</span>
                    <span class="order-info-value">{order['plan'].upper()}</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Username</span>
                    <span class="order-info-value">{order['username']}</span>
                </div>
                <div class="order-info-row">
                    <span class="order-info-label">Total Pembayaran</span>
                    <span class="order-info-value amount">Rp {order['amount']:,}</span>
                </div>
            </div>
            
            <div class="qris-section">
                <div class="qris-image">
                    <img id="qrisImage" src="{order['qr_string']}" alt="QRIS Code" onerror="this.src='https://placehold.co/200x200?text=QRIS'">
                </div>
                <button class="btn-copy" onclick="copyQRIS()">
                    <i class="fas fa-copy"></i> Salin QRIS
                </button>
            </div>
            
            <div id="errorMessage" class="error-message"></div>
            
            <div class="status-section">
                <span id="statusBadge" class="status-badge status-pending">
                    <i class="fas fa-clock"></i> Menunggu Pembayaran
                </span>
            </div>
            
            <button id="checkPaymentBtn" class="btn-check" onclick="checkPayment()">
                <i class="fas fa-search"></i> Sudah Bayar
            </button>
            
            <div class="timer">
                Sisa waktu: <span id="countdown">--:--:--</span>
            </div>
        </div>
        
        <script>
            const orderId = '{order["order_id"]}';
            let checkInterval = null;
            let countdownInterval = null;
            
            function copyQRIS() {{
                const qrisImage = document.getElementById('qrisImage');
                const qrisUrl = qrisImage.src;
                navigator.clipboard.writeText(qrisUrl).then(() => {{
                    showMessage('QRIS berhasil disalin!', 'success');
                }}).catch(() => {{
                    showMessage('Gagal menyalin QRIS', 'error');
                }});
            }}
            
            function showMessage(message, type) {{
                const errorDiv = document.getElementById('errorMessage');
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
                if (type === 'success') {{
                    errorDiv.style.background = 'rgba(16, 185, 129, 0.15)';
                    errorDiv.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                    errorDiv.style.color = '#10b981';
                }} else {{
                    errorDiv.style.background = 'rgba(239, 68, 68, 0.15)';
                    errorDiv.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                    errorDiv.style.color = '#ef4444';
                }}
                setTimeout(() => {{ errorDiv.style.display = 'none'; }}, 5000);
            }}
            
            async function checkPayment() {{
                const btn = document.getElementById('checkPaymentBtn');
                const originalText = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memeriksa...';
                
                try {{
                    const response = await fetch('/api/fragment/lobby/check-payment?order_id=' + orderId);
                    const data = await response.json();
                    
                    if (data.success && data.status === 'completed') {{
                        showMessage(data.message || 'Pembayaran berhasil! Mengalihkan...', 'success');
                        const badge = document.getElementById('statusBadge');
                        badge.innerHTML = '<i class="fas fa-check-circle"></i> Pembayaran Berhasil';
                        badge.className = 'status-badge status-success';
                        if (checkInterval) clearInterval(checkInterval);
                        if (countdownInterval) clearInterval(countdownInterval);
                        if (data.redirect_url) {{
                            setTimeout(() => {{ window.location.href = data.redirect_url; }}, 2000);
                        }}
                    }} else if (data.status === 'expired') {{
                        showMessage(data.error || 'Pembayaran sudah kadaluarsa', 'error');
                        if (checkInterval) clearInterval(checkInterval);
                        if (countdownInterval) clearInterval(countdownInterval);
                    }} else {{
                        showMessage('Pembayaran belum terdeteksi. Silakan coba lagi nanti.', 'error');
                    }}
                }} catch (error) {{
                    console.error('Error checking payment:', error);
                    showMessage('Gagal memeriksa pembayaran', 'error');
                }} finally {{
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }}
            }}
            
            checkInterval = setInterval(() => {{ checkPayment(); }}, 5000);
            
            function startCountdown() {{
                const expiresAt = new Date('{order["expires_at"]}');
                function updateCountdown() {{
                    const now = new Date();
                    const diff = expiresAt - now;
                    if (diff <= 0) {{
                        document.getElementById('countdown').textContent = 'Kadaluarsa';
                        if (countdownInterval) clearInterval(countdownInterval);
                        return;
                    }}
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    document.getElementById('countdown').textContent = 
                        `${{hours.toString().padStart(2, '0')}}:${{minutes.toString().padStart(2, '0')}}:${{seconds.toString().padStart(2, '0')}}`;
                }}
                updateCountdown();
                countdownInterval = setInterval(updateCountdown, 1000);
            }}
            
            startCountdown();
        </script>
    </body>
    </html>
    '''
    
    response = make_response(html_content)
    response.headers['Content-Type'] = 'text/html'
    return _cors_response(response)


# ==================== DELETE SESSION HELPER ====================

def delete_panel_session(session_token: str) -> bool:
    """Delete panel session"""
    try:
        from fragment.database.data import DB_PATH as MASTER_DB_PATH
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM owner_sessions WHERE session_token = ?", (session_token,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        return False


# Initialize database tables
def init_all_tables():
    try:
        from fragment.database.data import init_database
        init_database()
        init_bot_orders_table()
        logger.info("✅ All database tables initialized")
    except Exception as e:
        logger.error(f"Error initializing tables: {e}")

init_all_tables()