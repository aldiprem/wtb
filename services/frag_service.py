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

from fragment.database import data as db_data

frag_bp = Blueprint('fragment', __name__, url_prefix='/api/fragment')
logger = logging.getLogger(__name__)

# Database path
DB_PATH = Path(__file__).parent.parent / "frag.db"

def get_db_connection():
    """Get SQLite database connection"""
    return sqlite3.connect(str(DB_PATH))

def run_async(coro):
    """Run async function in sync context"""
    try:
        loop = asyncio.get_event_loop()
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
        session_token = get_session_from_request()
        if not session_token:
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        
        user_session = run_async(db_data.validate_panel_session(session_token))
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
        
        user = run_async(db_data.authenticate_panel_user(username, password))
        if not user:
            return jsonify({'success': False, 'error': 'Username atau password salah'}), 401
        
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        user_agent = request.headers.get('User-Agent')
        
        session_token = run_async(db_data.create_panel_session(user['id'], ip_address, user_agent))
        if not session_token:
            return jsonify({'success': False, 'error': 'Gagal membuat session'}), 500
        
        return jsonify({
            'success': True,
            'session_token': session_token,
            'user': {'username': user['username']}
        })
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/logout', methods=['POST', 'OPTIONS'])
@require_auth
def logout():
    """Logout endpoint"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    session_token = get_session_from_request()
    if session_token:
        run_async(db_data.delete_panel_session(session_token))
    
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
                    'username': row[0],
                    'bot_token': row[1],
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
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Total bots
        if bot_token:
            cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE bot_token = ?", (bot_token,))
        else:
            cursor.execute("SELECT COUNT(*) FROM cloned_bots")
        total_bots = cursor.fetchone()[0] or 0
        
        # Total users
        cursor.execute("SELECT COUNT(DISTINCT user_id) FROM users")
        total_users = cursor.fetchone()[0] or 0
        
        # Total purchases
        if bot_token:
            cursor.execute("""
                SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_ton), 0)
                FROM purchases WHERE status = 'success' AND bot_token = ?
            """, (bot_token,))
        else:
            cursor.execute("""
                SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_ton), 0)
                FROM purchases WHERE status = 'success'
            """)
        total_purchases, total_stars, total_volume = cursor.fetchone()
        
        # Chart data (7 days)
        chart_labels = []
        chart_values = []
        
        for i in range(6, -1, -1):
            date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            chart_labels.append((datetime.now() - timedelta(days=i)).strftime('%d/%m'))
            
            if bot_token:
                cursor.execute("""
                    SELECT COALESCE(SUM(stars_amount), 0)
                    FROM purchases 
                    WHERE DATE(timestamp) = ? AND status = 'success' AND bot_token = ?
                """, (date, bot_token))
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(stars_amount), 0)
                    FROM purchases 
                    WHERE DATE(timestamp) = ? AND status = 'success'
                """, (date,))
            chart_values.append(cursor.fetchone()[0] or 0)
        
        # Recent activities
        if bot_token:
            cursor.execute("""
                SELECT action, details, timestamp FROM activity_log 
                WHERE bot_token = ? OR bot_token IS NULL
                ORDER BY timestamp DESC LIMIT 10
            """, (bot_token,))
        else:
            cursor.execute("""
                SELECT action, details, timestamp FROM activity_log 
                ORDER BY timestamp DESC LIMIT 10
            """)
        
        activities = []
        for row in cursor.fetchall():
            icon = 'shopping-cart' if 'purchase' in str(row[0]) else 'user' if 'user' in str(row[0]) else 'bell'
            activities.append({
                'icon': icon,
                'message': str(row[1]) if row[1] else str(row[0]),
                'timestamp': row[2]
            })
        
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_bots': total_bots,
                'total_users': total_users,
                'total_purchases': total_purchases or 0,
                'total_stars': total_stars or 0,
                'total_volume': float(total_volume or 0)
            },
            'chart': {
                'labels': chart_labels,
                'values': chart_values
            },
            'activities': activities
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
        
        if not bot_token:
            return jsonify({'success': True, 'bot': None})
        
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT bot_token, bot_username, bot_name, status, created_at, last_started, last_stopped
            FROM cloned_bots WHERE bot_token = ?
        """, (bot_token,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return jsonify({
                'success': True,
                'bot': {
                    'bot_token': row[0],
                    'bot_username': row[1],
                    'bot_name': row[2],
                    'status': row[3],
                    'created_at': row[4],
                    'last_started': row[5],
                    'last_stopped': row[6]
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
        limit = request.args.get('limit', default=50, type=int)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT u.user_id, u.username, u.first_name, u.last_name,
                   COALESCE(SUM(p.stars_amount), 0) as total_stars,
                   COUNT(p.id) as total_purchases
            FROM users u
            LEFT JOIN purchases p ON u.user_id = p.user_id AND p.status = 'success'
            GROUP BY u.user_id
            ORDER BY total_stars DESC
            LIMIT ?
        """, (limit,))
        
        users = []
        for row in cursor.fetchall():
            users.append({
                'user_id': row[0],
                'username': row[1],
                'first_name': row[2],
                'last_name': row[3],
                'total_stars': row[4],
                'total_purchases': row[5]
            })
        
        conn.close()
        return jsonify({'success': True, 'users': users})
    except Exception as e:
        logger.error(f"Error getting users list: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500