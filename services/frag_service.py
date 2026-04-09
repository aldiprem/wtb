# services/frag_service.py - Flask Service untuk Fragment Bot Admin Panel

from flask import Blueprint, request, jsonify, make_response
import sys
import os
import asyncio
import logging
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timedelta
from functools import wraps

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    create_panel_user
)

from fragment.database.data_clone import get_user_stats

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
            # Create a new loop in a thread if current loop is running
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
                    'last_login': row[3] or run_async(get_jakarta_time_iso)
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
        
        # Get cloned bots list
        bots = run_async(get_cloned_bots())
        total_bots = len(bots)
        running_bots = len([b for b in bots if b.get('status') == 'running'])
        
        # Get overall stats from database
        all_stats = run_async(get_all_stats, bot_token)
        
        # Get chart data (7 days)
        chart_data = run_async(get_chart_data, bot_token, 7)
        
        # Get recent activities
        activities = run_async(get_recent_activities, bot_token, 10)
        
        return jsonify({
            'success': True,
            'stats': {
                'total_bots': total_bots,
                'running_bots': running_bots,
                'total_users': all_stats.get('total_users', 0),
                'total_stars': all_stats.get('total_stars', 0),
                'total_volume': float(all_stats.get('total_volume_idr', 0) or 0),
                'total_purchases': all_stats.get('total_purchases', 0),
                'today_purchases': all_stats.get('today_purchases', 0),
                'today_stars': all_stats.get('today_stars', 0),
                'today_volume': float(all_stats.get('today_volume_idr', 0) or 0)
            },
            'chart': {
                'labels': chart_data.get('labels', []),
                'values': chart_data.get('values', [])
            },
            'activities': [
                {
                    'id': a.get('id'),
                    'icon': 'shopping-cart' if 'purchase' in str(a.get('action', '')) else 'user' if 'user' in str(a.get('action', '')) else 'bell',
                    'message': a.get('details') or a.get('action', ''),
                    'timestamp': a.get('timestamp')
                }
                for a in activities
            ]
        })
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        import traceback
        traceback.print_exc()
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
        
        # Get all cloned bots
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

@frag_bp.route('/bots/list', methods=['GET', 'OPTIONS'])
@require_auth
def get_bots_list():
    """Get list of all cloned bots"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        bots = run_async(get_cloned_bots())
        
        # Add stats for each bot
        for bot in bots:
            stats = run_async(get_bot_stats, bot['bot_token'])
            bot['stats'] = stats
        
        return jsonify({
            'success': True,
            'bots': bots,
            'total': len(bots)
        })
    except Exception as e:
        logger.error(f"Error getting bots list: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/bot/logs', methods=['GET', 'OPTIONS'])
@require_auth
def get_bot_logs_endpoint():
    """Get bot logs"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        bot_username = request.args.get('bot_username')
        limit = request.args.get('limit', default=50, type=int)
        
        if not bot_username:
            return jsonify({'success': False, 'error': 'bot_username required'}), 400
        
        logs = run_async(get_bot_logs, bot_username, limit)
        
        return jsonify({
            'success': True,
            'logs': [
                {
                    'level': log[0],
                    'message': log[1],
                    'timestamp': log[2]
                }
                for log in logs
            ]
        })
    except Exception as e:
        logger.error(f"Error getting bot logs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/user/stats/<int:user_id>', methods=['GET', 'OPTIONS'])
@require_auth
def get_user_stats_endpoint(user_id):
    """Get user statistics for specific user"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        
        stats = run_async(get_user_stats, user_id, bot_token)
        
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        logger.error(f"Error getting user stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== HEALTH CHECK ====================

@frag_bp.route('/health', methods=['GET', 'OPTIONS'])
def health_check():
    """Health check endpoint"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({
            'success': True,
            'status': 'healthy',
            'database': 'connected',
            'timestamp': run_async(get_jakarta_time_iso)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 'unhealthy',
            'error': str(e)
        }), 500


def lobby_create_bot():
    """Create new cloned bot from lobby"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        data = request.json
        plan = data.get('plan')
        bot_token = data.get('bot_token', '').strip()
        telegram_id = data.get('telegram_id')
        username = data.get('username', '').strip().lower()
        password = data.get('password')
        price = data.get('price', 100000)
        
        # Validate inputs
        if not all([plan, bot_token, telegram_id, username, password]):
            return jsonify({
                'success': False, 
                'error': 'Semua field harus diisi'
            }), 400
        
        # Validate username (alphanumeric + underscore)
        import re
        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return jsonify({
                'success': False,
                'error': 'Username hanya boleh berisi huruf, angka, dan underscore'
            }), 400
        
        if len(username) < 3:
            return jsonify({
                'success': False,
                'error': 'Username minimal 3 karakter'
            }), 400
        
        if len(password) < 6:
            return jsonify({
                'success': False,
                'error': 'Password minimal 6 karakter'
            }), 400
        
        # Validate bot token format
        if ':' not in bot_token:
            return jsonify({
                'success': False,
                'error': 'Format bot token tidak valid'
            }), 400
        
        # Check if username already exists
        existing_user = run_async(get_bot_owner_by_username, username)
        if existing_user:
            return jsonify({
                'success': False,
                'error': f'Username "{username}" sudah digunakan'
            }), 400
        
        # Check balance
        user_session = request.user_session
        balance = user_session.get('balance', 0)
        
        if balance < price:
            return jsonify({
                'success': False,
                'error': f'Saldo tidak cukup. Butuh Rp {price:,}, saldo Anda Rp {balance:,}'
            }), 400
        
        # Set expiration days based on plan
        expires_days = 30 if plan == 'basic' else 90 if plan == 'pro' else 365
        
        # Create bot owner (panel user)
        owner_id = run_async(
            create_panel_user,
            username, password, 
            owner_name=None, 
            email=None, 
            expires_days=expires_days
        )
        
        if not owner_id:
            return jsonify({
                'success': False,
                'error': 'Gagal membuat user'
            }), 500
        
        # Update telegram_id
        try:
            from fragment.database.data import DB_PATH as MASTER_DB_PATH
            conn = sqlite3.connect(str(MASTER_DB_PATH))
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE bot_owners SET telegram_id = ? WHERE id = ?",
                (telegram_id, owner_id)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Error updating telegram_id: {e}")
        
        # Deduct balance from master owner (the one who created the bot)
        run_async(
            deduct_owner_balance,
            user_session['owner_id'],
            price,
            f"create_bot_{username}",
            f"Create bot for {username} (Plan: {plan})"
        )
        
        # Add bot to database
        bot_username = f"{username}_bot"
        bot_name = f"Fragment Bot - {username}"
        
        success = run_async(
            add_cloned_bot,
            bot_token,
            bot_username,
            bot_name,
            owner_id,
            expires_days=expires_days
        )
        
        if not success:
            # Refund balance if bot creation failed
            run_async(add_owner_balance, user_session['owner_id'], price)
            return jsonify({
                'success': False,
                'error': 'Gagal menambahkan bot ke database'
            }), 500
        
        # Log activity
        run_async(log_owner_activity, owner_id, "bot_created", f"Created bot {bot_username} with plan {plan}")
        
        # Get updated user info
        user = run_async(get_bot_owner, owner_id)
        
        return jsonify({
            'success': True,
            'message': f'Bot berhasil dibuat! Username: {username}',
            'user': {
                'id': user.get('id'),
                'username': user.get('username'),
                'owner_name': user.get('owner_name'),
                'balance': user.get('balance', 0)
            }
        })
        
    except Exception as e:
        logger.error(f"Error creating bot from lobby: {e}")
        import traceback
        traceback.print_exc()
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
        
        # Get bot token from environment or config
        MASTER_BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
        
        if not MASTER_BOT_TOKEN:
            logger.error("BOT_TOKEN not configured")
            return jsonify({'success': False, 'error': 'Server configuration error'}), 500
        
        # Parse init data
        params = {}
        for item in init_data.split('&'):
            if '=' in item:
                key, value = item.split('=', 1)
                params[key] = value
        
        if 'hash' not in params:
            return jsonify({'success': False, 'error': 'Invalid auth data'}), 400
        
        auth_hash = params.pop('hash')
        
        # Sort and create check string
        sorted_params = sorted(params.items())
        check_string = '\n'.join(f"{k}={v}" for k, v in sorted_params)
        
        # Compute HMAC-SHA256
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
        
        # Check expiration (24 hours)
        auth_date = int(params.get('auth_date', 0))
        if datetime.now().timestamp() - auth_date > 86400:
            return jsonify({'success': False, 'error': 'Auth expired'}), 401
        
        # Get user data
        user_data = json.loads(params.get('user', '{}'))
        telegram_id = user_data.get('id')
        
        if not telegram_id:
            return jsonify({'success': False, 'error': 'No user data'}), 400
        
        # Check if user exists
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
            # Create new user
            username = user_data.get('username') or f"user_{telegram_id}"
            password = secrets.token_urlsafe(16)
            
            # Create user
            owner_id = run_async(
                create_panel_user,
                username, password,
                owner_name=f"{user_data.get('first_name', '')} {user_data.get('last_name', '')}".strip(),
                email=None,
                expires_days=30
            )
            
            if not owner_id:
                conn.close()
                return jsonify({'success': False, 'error': 'Failed to create user'}), 500
            
            # Update telegram_id
            cursor.execute(
                "UPDATE bot_owners SET telegram_id = ? WHERE id = ?",
                (telegram_id, owner_id)
            )
            conn.commit()
            conn.close()
            
            user = run_async(get_bot_owner, owner_id)
        
        # Create session
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
        import traceback
        traceback.print_exc()
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


@frag_bp.route('/lobby/dashboard/stats', methods=['GET', 'OPTIONS'])
@require_auth
def lobby_dashboard_stats():
    """Get dashboard stats for lobby"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        
        # Get stats
        stats = run_async(get_all_stats, bot_token)
        
        # Get chart data
        chart = run_async(get_chart_data, bot_token, 7)
        
        # Get activities
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


# ==================== HELPER FUNCTIONS ====================

def get_bot_owner_by_username(username: str):
    """Get bot owner by username"""
    try:
        from fragment.database.data import DB_PATH as MASTER_DB_PATH
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, owner_name, email, whatsapp, balance, is_active, created_at, expires_at
            FROM bot_owners WHERE username = ?
        """, (username,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'username': row[1],
                'owner_name': row[2],
                'email': row[3],
                'whatsapp': row[4],
                'balance': row[5],
                'is_active': row[6],
                'created_at': row[7],
                'expires_at': row[8]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting bot owner by username: {e}")
        return None


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