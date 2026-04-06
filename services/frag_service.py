# services/frag_service.py - Flask Service untuk Fragment Bot Admin Panel

from flask import Blueprint, request, jsonify, session
import sys
import os
import asyncio
import logging
import json
import sqlite3
from pathlib import Path
from datetime import datetime

# Add path untuk import fragment modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import fragment modules - HAPUS import wallet
from fragment.api import fragment as frag_api
# from fragment.api import wallet as wallet_api  # <-- HAPUS INI, TIDAK DIPERLUKAN
from fragment.database import data as db_data

frag_bp = Blueprint('fragment', __name__, url_prefix='/api/fragment')
logger = logging.getLogger(__name__)

# ==================== KONFIGURASI ====================
# Load dari environment
COOKIES = os.getenv("COOKIES", "")
HASH = os.getenv("HASH", "")
WALLET_API_KEY = os.getenv("WALLET_API_KEY", "")
WALLET_MNEMONIC_STR = os.getenv("WALLET_MNEMONIC", "[]")

try:
    WALLET_MNEMONIC = json.loads(WALLET_MNEMONIC_STR) if isinstance(WALLET_MNEMONIC_STR, str) else WALLET_MNEMONIC_STR
except:
    WALLET_MNEMONIC = []

PRICE_PER_STAR = float(os.getenv("PRICE_PER_STAR", 0.01))
MIN_STARS = int(os.getenv("MIN_STARS", 10))
MAX_STARS = int(os.getenv("MAX_STARS", 100000))

# Database path
DB_PATH = Path(__file__).parent.parent / "frag.db"

# ==================== HELPER FUNCTIONS ====================
def run_async(coro):
    """Run async function in sync context"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)

def get_db_connection():
    """Get SQLite database connection"""
    return sqlite3.connect(str(DB_PATH))

def _cors_response(response):
    """Add CORS headers to response"""
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response

# ==================== GET WALLET BALANCE (OPTIONAL) ====================
def get_wallet_balance():
    """Get wallet balance if available, return 0 if not"""
    try:
        from fragment.api import wallet as wallet_api
        if WALLET_API_KEY and WALLET_MNEMONIC:
            return run_async(wallet_api.get_balance(WALLET_API_KEY, WALLET_MNEMONIC))
    except ImportError:
        pass
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
    return 0.0

# ==================== ADMIN STATS ENDPOINTS ====================

@frag_bp.route('/status', methods=['GET', 'OPTIONS'])
def get_status():
    """Get bot status (Fragment API, Wallet)"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    fragment_ok = bool(COOKIES and HASH)
    wallet_ok = bool(WALLET_API_KEY and WALLET_MNEMONIC)
    balance = get_wallet_balance()
    
    return jsonify({
        'success': True,
        'status': {
            'fragment_ok': fragment_ok,
            'wallet_ok': wallet_ok,
            'balance': balance
        }
    })

@frag_bp.route('/admin/stats', methods=['GET', 'OPTIONS'])
def get_admin_stats():
    """Get admin statistics"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Total bots
        cursor.execute("SELECT COUNT(*) FROM cloned_bots")
        total_bots = cursor.fetchone()[0] or 0
        
        # Running bots
        cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE status = 'running'")
        running_bots = cursor.fetchone()[0] or 0
        
        # Total users (distinct)
        cursor.execute("SELECT COUNT(DISTINCT user_id) FROM users")
        total_users = cursor.fetchone()[0] or 0
        
        # Total purchases
        cursor.execute("""
            SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_ton), 0)
            FROM purchases WHERE status = 'success'
        """)
        total_purchases, total_stars, total_volume = cursor.fetchone()
        
        # Wallet balance
        wallet_balance = get_wallet_balance()
        
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_bots': total_bots,
                'running_bots': running_bots,
                'total_users': total_users,
                'total_purchases': total_purchases or 0,
                'total_stars': total_stars or 0,
                'total_volume': total_volume or 0,
                'wallet_balance': wallet_balance
            }
        })
    except Exception as e:
        logger.error(f"Error getting admin stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== BOT MANAGEMENT ENDPOINTS ====================

@frag_bp.route('/bots', methods=['GET', 'OPTIONS'])
def get_bots():
    """Get all cloned bots"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        bots = run_async(db_data.get_cloned_bots())
        
        # Add stats for each bot
        for bot in bots:
            stats = run_async(db_data.get_bot_stats(bot['bot_token']))
            bot.update(stats)
        
        return jsonify({'success': True, 'bots': bots})
    except Exception as e:
        logger.error(f"Error getting bots: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/bots/add', methods=['POST', 'OPTIONS'])
def add_bot():
    """Add a new cloned bot"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        data = request.json
        bot_token = data.get('bot_token', '').strip()
        bot_username = data.get('bot_username', '').strip()
        
        if not bot_token:
            return jsonify({'success': False, 'error': 'Bot token required'}), 400
        
        if ':' not in bot_token:
            return jsonify({'success': False, 'error': 'Invalid bot token format'}), 400
        
        # Validate bot token
        try:
            from telethon import TelegramClient
            
            async def validate_token():
                temp_client = TelegramClient('temp_validate', int(os.getenv("API_ID", 0)), os.getenv("API_HASH", ""))
                await temp_client.start(bot_token=bot_token)
                me = await temp_client.get_me()
                await temp_client.disconnect()
                return me
            
            me = run_async(validate_token())
            bot_username = bot_username or me.username or f"bot_{me.id}"
            bot_name = me.first_name or "Fragment Stars Bot"
            
        except Exception as e:
            return jsonify({'success': False, 'error': f'Invalid bot token: {str(e)}'}), 400
        
        # Add to database
        success = run_async(db_data.add_cloned_bot(bot_token, bot_username, bot_name, 1))
        
        if success:
            return jsonify({
                'success': True,
                'bot_username': bot_username,
                'bot_name': bot_name,
                'message': 'Bot added successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to save bot to database'}), 500
            
    except Exception as e:
        logger.error(f"Error adding bot: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/bots/<int:bot_id>/start', methods=['POST', 'OPTIONS'])
def start_bot(bot_id):
    """Start a cloned bot"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        bot_detail = run_async(db_data.get_bot_detail_by_id(bot_id))
        if not bot_detail:
            return jsonify({'success': False, 'error': 'Bot not found'}), 404
        
        # Update status di database saja (bot akan dijalankan oleh master)
        run_async(db_data.update_bot_status(bot_detail['bot_token'], 'running'))
        
        return jsonify({'success': True, 'bot_username': bot_detail['bot_username']})
    except Exception as e:
        logger.error(f"Error starting bot: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/bots/<int:bot_id>/stop', methods=['POST', 'OPTIONS'])
def stop_bot(bot_id):
    """Stop a cloned bot"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        bot_detail = run_async(db_data.get_bot_detail_by_id(bot_id))
        if not bot_detail:
            return jsonify({'success': False, 'error': 'Bot not found'}), 404
        
        # Update status di database saja
        run_async(db_data.update_bot_status(bot_detail['bot_token'], 'stopped'))
        
        return jsonify({'success': True, 'bot_username': bot_detail['bot_username']})
    except Exception as e:
        logger.error(f"Error stopping bot: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/bots/<int:bot_id>', methods=['DELETE', 'OPTIONS'])
def delete_bot(bot_id):
    """Delete a cloned bot"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        bot_detail = run_async(db_data.get_bot_detail_by_id(bot_id))
        if not bot_detail:
            return jsonify({'success': False, 'error': 'Bot not found'}), 404
        
        # Remove from database
        success = run_async(db_data.remove_cloned_bot(bot_detail['bot_token']))
        
        if success:
            return jsonify({'success': True, 'message': 'Bot deleted'})
        else:
            return jsonify({'success': False, 'error': 'Failed to delete bot'}), 500
            
    except Exception as e:
        logger.error(f"Error deleting bot: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@frag_bp.route('/bots/<int:bot_id>/logs', methods=['GET', 'OPTIONS'])
def get_bot_logs(bot_id):
    """Get logs for a specific bot"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        bot_detail = run_async(db_data.get_bot_detail_by_id(bot_id))
        if not bot_detail:
            return jsonify({'success': False, 'error': 'Bot not found'}), 404
        
        limit = request.args.get('limit', default=50, type=int)
        logs = run_async(db_data.get_bot_logs(bot_detail['bot_username'], limit))
        
        log_list = []
        for log in logs:
            log_list.append({
                'log_level': log[0],
                'message': log[1],
                'timestamp': log[2]
            })
        
        return jsonify({'success': True, 'logs': log_list})
    except Exception as e:
        logger.error(f"Error getting bot logs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== LOGS ENDPOINTS ====================

@frag_bp.route('/logs/recent', methods=['GET', 'OPTIONS'])
def get_recent_logs():
    """Get recent activity logs"""
    if request.method == 'OPTIONS':
        return _cors_response(jsonify({'success': True}))
    
    try:
        limit = request.args.get('limit', default=30, type=int)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT log_level, message, timestamp FROM bot_logs 
            ORDER BY timestamp DESC LIMIT ?
        """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        logs = []
        for row in rows:
            logs.append({
                'log_level': row[0],
                'message': row[1],
                'timestamp': row[2]
            })
        
        return jsonify({'success': True, 'logs': logs})
    except Exception as e:
        logger.error(f"Error getting recent logs: {e}")
        return jsonify({'success': True, 'logs': []})