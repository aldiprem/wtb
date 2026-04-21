# winedash/services/admin_service.py
import sqlite3
import sys
from pathlib import Path
from flask import Blueprint, request, jsonify, session
from datetime import datetime
import os
import hashlib

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from winedash.database.admin import AdminDatabase
from winedash.database.web import WinedashDatabase

admin_bp = Blueprint('admin', __name__, url_prefix='/api/winedash/admin')
admin_db = AdminDatabase()
db = WinedashDatabase()

# Admin credentials for browser login
ADMIN_USERNAME = "aldi013"
ADMIN_PASSWORD_HASH = hashlib.sha256("Asdf1234".encode()).hexdigest()
OWNER_ID = int(os.getenv("OWNER_ID", 0))

def is_admin_authorized():
    """Check if request is from authorized admin"""
    # Check if from Telegram MiniApp with owner ID
    auth_header = request.headers.get('X-Telegram-User-Id')
    if auth_header:
        try:
            user_id = int(auth_header)
            return user_id == OWNER_ID
        except:
            pass
    
    # Check session for browser login
    if session.get('admin_authenticated'):
        return True
    
    return False

def require_admin_auth(f):
    """Decorator to require admin authentication"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not is_admin_authorized():
            return jsonify({'success': False, 'error': 'Unauthorized', 'require_auth': True}), 401
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/auth/telegram', methods=['POST', 'OPTIONS'])
def auth_telegram():
    """Authenticate via Telegram user ID"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        if user_id == OWNER_ID:
            session['admin_authenticated'] = True
            return jsonify({'success': True, 'message': 'Authenticated as owner'})
        else:
            return jsonify({'success': False, 'error': 'Not authorized'}), 403
            
    except Exception as e:
        print(f"Error in auth_telegram: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/auth/login', methods=['POST', 'OPTIONS'])
def auth_login():
    """Authenticate via username/password for browser"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if username == ADMIN_USERNAME and hashlib.sha256(password.encode()).hexdigest() == ADMIN_PASSWORD_HASH:
            session['admin_authenticated'] = True
            return jsonify({'success': True, 'message': 'Login successful'})
        else:
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
            
    except Exception as e:
        print(f"Error in auth_login: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/auth/logout', methods=['POST', 'OPTIONS'])
def auth_logout():
    """Logout from admin session"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    session.pop('admin_authenticated', None)
    return jsonify({'success': True, 'message': 'Logged out'})

@admin_bp.route('/auth/check', methods=['GET', 'OPTIONS'])
def check_auth():
    """Check if user is authenticated"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    return jsonify({'authenticated': is_admin_authorized()})

# ==================== SYSTEM STATS ====================

@admin_bp.route('/stats', methods=['GET', 'OPTIONS'])
@require_admin_auth
def get_system_stats():
    """Get system statistics"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        stats = admin_db.get_system_stats()
        return jsonify({'success': True, 'stats': stats})
    except Exception as e:
        print(f"Error getting stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== USER MANAGEMENT ====================

@admin_bp.route('/users', methods=['GET', 'OPTIONS'])
@require_admin_auth
def get_all_users():
    """Get all users"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        users = admin_db.get_all_users()
        return jsonify({'success': True, 'users': users, 'total': len(users)})
    except Exception as e:
        print(f"Error getting users: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/user/<int:user_id>', methods=['GET', 'OPTIONS'])
@require_admin_auth
def get_user_detail(user_id):
    """Get detailed user information"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        user = admin_db.get_user_detail(user_id)
        usernames = admin_db.get_user_usernames(user_id)
        transactions = admin_db.get_user_transactions(user_id)
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': user,
            'usernames': usernames,
            'transactions': transactions
        })
    except Exception as e:
        print(f"Error getting user detail: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/user/balance', methods=['POST', 'OPTIONS'])
@require_admin_auth
def update_user_balance():
    """Update user balance (add or subtract)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        amount = data.get('amount')
        is_add = data.get('is_add', True)
        
        if not user_id or not amount or amount <= 0:
            return jsonify({'success': False, 'error': 'Invalid parameters'}), 400
        
        success = admin_db.update_user_balance_admin(user_id, float(amount), is_add)
        
        if success:
            action = 'add_balance' if is_add else 'subtract_balance'
            admin_db.log_admin_action(
                admin_id=OWNER_ID,
                action=action,
                target_type='user',
                target_id=str(user_id),
                details=f"{'Added' if is_add else 'Subtracted'} {amount} TON"
            )
            return jsonify({'success': True, 'message': f'Balance updated'})
        else:
            return jsonify({'success': False, 'error': 'Failed to update balance'}), 400
            
    except Exception as e:
        print(f"Error updating balance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/user/delete/<int:user_id>', methods=['DELETE', 'OPTIONS'])
@require_admin_auth
def delete_user(user_id):
    """Delete user (only if no transactions)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
        return response
    
    try:
        if user_id == OWNER_ID:
            return jsonify({'success': False, 'error': 'Cannot delete owner account'}), 400
        
        success = admin_db.delete_user_admin(user_id)
        
        if success:
            admin_db.log_admin_action(
                admin_id=OWNER_ID,
                action='delete_user',
                target_type='user',
                target_id=str(user_id)
            )
            return jsonify({'success': True, 'message': 'User deleted'})
        else:
            return jsonify({'success': False, 'error': 'Cannot delete user with transactions'}), 400
            
    except Exception as e:
        print(f"Error deleting user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== USERNAME MANAGEMENT ====================

@admin_bp.route('/usernames', methods=['GET', 'OPTIONS'])
@require_admin_auth
def get_all_usernames():
    """Get all usernames"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        usernames = admin_db.get_all_usernames()
        return jsonify({'success': True, 'usernames': usernames, 'total': len(usernames)})
    except Exception as e:
        print(f"Error getting usernames: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/pending-usernames', methods=['GET', 'OPTIONS'])
@require_admin_auth
def get_pending_usernames():
    """Get all pending usernames"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        pendings = admin_db.get_all_pending_usernames()
        return jsonify({'success': True, 'pendings': pendings, 'total': len(pendings)})
    except Exception as e:
        print(f"Error getting pending usernames: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/username/delete/<int:username_id>', methods=['DELETE', 'OPTIONS'])
@require_admin_auth
def delete_username(username_id):
    """Delete username"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
        return response
    
    try:
        success = admin_db.delete_username_admin(username_id)
        
        if success:
            admin_db.log_admin_action(
                admin_id=OWNER_ID,
                action='delete_username',
                target_type='username',
                target_id=str(username_id)
            )
            return jsonify({'success': True, 'message': 'Username deleted'})
        else:
            return jsonify({'success': False, 'error': 'Username not found'}), 404
            
    except Exception as e:
        print(f"Error deleting username: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/username/confirm-pending/<int:pending_id>', methods=['POST', 'OPTIONS'])
@require_admin_auth
def confirm_pending_username(pending_id):
    """Confirm pending username directly"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        success = db.confirm_pending_username(pending_id, None)
        
        if success:
            admin_db.log_admin_action(
                admin_id=OWNER_ID,
                action='confirm_pending',
                target_type='pending',
                target_id=str(pending_id)
            )
            return jsonify({'success': True, 'message': 'Username confirmed and added to marketplace'})
        else:
            return jsonify({'success': False, 'error': 'Failed to confirm'}), 400
            
    except Exception as e:
        print(f"Error confirming pending: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/username/reject-pending/<int:pending_id>', methods=['DELETE', 'OPTIONS'])
@require_admin_auth
def reject_pending_username(pending_id):
    """Reject pending username"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
        return response
    
    try:
        success = db.reject_pending_username(pending_id)
        
        if success:
            admin_db.log_admin_action(
                admin_id=OWNER_ID,
                action='reject_pending',
                target_type='pending',
                target_id=str(pending_id)
            )
            return jsonify({'success': True, 'message': 'Username rejected'})
        else:
            return jsonify({'success': False, 'error': 'Failed to reject'}), 400
            
    except Exception as e:
        print(f"Error rejecting pending: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== AUCTION MANAGEMENT ====================

@admin_bp.route('/auctions', methods=['GET', 'OPTIONS'])
@require_admin_auth
def get_all_auctions():
    """Get all auctions"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        auctions = admin_db.get_all_auctions()
        return jsonify({'success': True, 'auctions': auctions, 'total': len(auctions)})
    except Exception as e:
        print(f"Error getting auctions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ADMIN LOGS ====================

@admin_bp.route('/logs', methods=['GET', 'OPTIONS'])
@require_admin_auth
def get_admin_logs():
    """Get admin action logs"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        logs = admin_db.get_admin_logs()
        return jsonify({'success': True, 'logs': logs, 'total': len(logs)})
    except Exception as e:
        print(f"Error getting logs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500