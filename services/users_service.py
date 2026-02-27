# user_service.py - Flask service untuk manajemen user
from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import users

user_bp = Blueprint('user', __name__)

# ==================== ENDPOINT UTAMA ====================

@user_bp.route('/user/check', methods=['POST', 'OPTIONS'])
def check_user():
    """
    Cek atau buat user berdasarkan data Telegram
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        print(f"📥 Checking/creating user: {data}")
        
        user_id = data.get('user_id')
        username = data.get('username')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        photo_url = data.get('photo_url')
        language_code = data.get('language_code')
        is_bot = data.get('is_bot', False)
        is_premium = data.get('is_premium', False)
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Get or create user
        user = users.get_or_create_user({
            'user_id': user_id,
            'username': username,
            'first_name': first_name,
            'last_name': last_name,
            'photo_url': photo_url,
            'language_code': language_code,
            'is_bot': is_bot,
            'is_premium': is_premium
        })
        
        if not user:
            return jsonify({'success': False, 'error': 'Failed to create user'}), 500
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'photo_url': user['photo_url'],
                'language_code': user['language_code'],
                'is_premium': user['is_premium']
            }
        })
        
    except Exception as e:
        print(f"❌ Error checking user: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@user_bp.route('/user/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_user(user_id):
    """
    Mendapatkan data user berdasarkan ID
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        user = users.get_user(user_id)
        
        if not user:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'first_name': user['first_name'],
                'last_name': user['last_name'],
                'photo_url': user['photo_url'],
                'language_code': user['language_code'],
                'is_premium': user['is_premium'],
                'last_login': user['last_login'],
                'created_at': user['created_at']
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@user_bp.route('/user/<int:user_id>', methods=['PUT', 'OPTIONS'])
def update_user(user_id):
    """
    Update data user
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        
        # Hanya update field yang diizinkan
        update_data = {}
        allowed_fields = ['username', 'first_name', 'last_name', 'photo_url', 
                         'language_code', 'is_premium']
        
        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]
        
        success = users.update_user(user_id, update_data)
        
        if success:
            return jsonify({'success': True, 'message': 'User updated successfully'})
        else:
            return jsonify({'success': False, 'error': 'User not found'}), 404
        
    except Exception as e:
        print(f"❌ Error updating user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ENDPOINT BALANCE ====================

@user_bp.route('/user/<int:user_id>/balance', methods=['GET', 'OPTIONS'])
def get_balance(user_id):
    """
    Mendapatkan balance user untuk website tertentu
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        website_id = request.args.get('website_id', type=int)
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID required'}), 400
        
        balance = users.get_user_balance(user_id, website_id)
        
        # Dapatkan preferensi lengkap
        preferences = users.get_user_preferences(user_id, website_id)
        
        return jsonify({
            'success': True,
            'balance': balance,
            'total_deposit': preferences.get('total_deposit', 0) if preferences else 0,
            'total_withdraw': preferences.get('total_withdraw', 0) if preferences else 0,
            'total_purchase': preferences.get('total_purchase', 0) if preferences else 0
        })
        
    except Exception as e:
        print(f"❌ Error getting balance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ENDPOINT PREFERENCES ====================

@user_bp.route('/user/<int:user_id>/preferences', methods=['GET', 'OPTIONS'])
def get_preferences(user_id):
    """
    Mendapatkan preferensi user untuk website tertentu
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        website_id = request.args.get('website_id', type=int)
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID required'}), 400
        
        preferences = users.get_user_preferences(user_id, website_id)
        
        if not preferences:
            return jsonify({'success': False, 'error': 'Preferences not found'}), 404
        
        return jsonify({
            'success': True,
            'preferences': {
                'balance': preferences['balance'],
                'total_deposit': preferences['total_deposit'],
                'total_withdraw': preferences['total_withdraw'],
                'total_purchase': preferences['total_purchase'],
                'settings': preferences['settings'],
                'is_blocked': preferences['is_blocked']
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting preferences: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@user_bp.route('/user/<int:user_id>/preferences', methods=['PUT', 'OPTIONS'])
def update_preferences(user_id):
    """
    Update preferensi user
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'PUT, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        website_id = data.get('website_id')
        settings = data.get('settings', {})
        
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID required'}), 400
        
        success = users.update_user_preferences(user_id, website_id, settings)
        
        if success:
            return jsonify({'success': True, 'message': 'Preferences updated successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to update preferences'}), 500
        
    except Exception as e:
        print(f"❌ Error updating preferences: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ENDPOINT ADDRESSES ====================

@user_bp.route('/user/<int:user_id>/addresses', methods=['GET', 'OPTIONS'])
def get_addresses(user_id):
    """
    Mendapatkan semua alamat user
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        website_id = request.args.get('website_id', type=int)
        address_type = request.args.get('type')
        
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID required'}), 400
        
        addresses = users.get_user_addresses(user_id, website_id, address_type)
        
        return jsonify({
            'success': True,
            'addresses': addresses,
            'count': len(addresses)
        })
        
    except Exception as e:
        print(f"❌ Error getting addresses: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@user_bp.route('/user/<int:user_id>/addresses', methods=['POST', 'OPTIONS'])
def add_address(user_id):
    """
    Menambahkan alamat baru
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        website_id = data.get('website_id')
        
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID required'}), 400
        
        address_id = users.add_user_address(user_id, website_id, data)
        
        if address_id:
            return jsonify({
                'success': True,
                'address_id': address_id,
                'message': 'Address added successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to add address'}), 500
        
    except Exception as e:
        print(f"❌ Error adding address: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@user_bp.route('/user/addresses/<int:address_id>', methods=['DELETE', 'OPTIONS'])
def delete_address(address_id):
    """
    Menghapus alamat
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
        return response, 200
    
    try:
        data = request.json
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        success = users.delete_user_address(address_id, user_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Address deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Address not found'}), 404
        
    except Exception as e:
        print(f"❌ Error deleting address: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ENDPOINT ACTIVITIES ====================

@user_bp.route('/user/<int:user_id>/activities', methods=['GET', 'OPTIONS'])
def get_user_activities(user_id):
    """
    Mendapatkan aktivitas user
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        website_id = request.args.get('website_id', type=int)
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        activities = users.get_user_activities(user_id, website_id, limit, offset)
        
        return jsonify({
            'success': True,
            'activities': activities,
            'count': len(activities)
        })
        
    except Exception as e:
        print(f"❌ Error getting activities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ENDPOINT SEARCH ====================

@user_bp.route('/users/search', methods=['GET', 'OPTIONS'])
def search_users():
    """
    Mencari user berdasarkan query
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        query = request.args.get('q', '')
        limit = request.args.get('limit', default=20, type=int)
        
        if not query or len(query) < 2:
            return jsonify({'success': False, 'error': 'Query too short'}), 400
        
        results = users.search_users(query, limit)
        
        return jsonify({
            'success': True,
            'users': results,
            'count': len(results)
        })
        
    except Exception as e:
        print(f"❌ Error searching users: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ENDPOINT STATISTICS ====================

@user_bp.route('/users/statistics', methods=['GET', 'OPTIONS'])
def get_statistics():
    """
    Mendapatkan statistik user
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        website_id = request.args.get('website_id', type=int)
        
        stats = users.get_user_statistics(website_id)
        
        return jsonify({
            'success': True,
            'statistics': stats
        })
        
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ENDPOINT ADMIN (BLOCK USER) ====================

@user_bp.route('/user/<int:user_id>/block', methods=['POST', 'OPTIONS'])
def block_user(user_id):
    """
    Block atau unblock user (admin only)
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        website_id = data.get('website_id')
        block = data.get('block', True)
        reason = data.get('reason')
        
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID required'}), 400
        
        success = users.block_user(user_id, website_id, block, reason)
        
        if success:
            action = 'blocked' if block else 'unblocked'
            return jsonify({
                'success': True,
                'message': f'User {action} successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'User preferences not found'}), 404
        
    except Exception as e:
        print(f"❌ Error blocking user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
