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

# Di frag_service.py, ubah baris import menjadi:

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