import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import Blueprint, request, jsonify
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from database.data import IndotagDatabase

indotag_bp = Blueprint('indotag', __name__, url_prefix='/api/indotag')
db = IndotagDatabase()


def validate_telegram_user():
    """Extract Telegram user from request"""
    try:
        data = request.get_json() if request.is_json else {}
        user_data = data.get('user', {}) if data else {}
        
        user_id = user_data.get('id')
        username = user_data.get('username', '')
        first_name = user_data.get('first_name', '')
        last_name = user_data.get('last_name', '')
        photo_url = user_data.get('photo_url', '')
        
        if user_id:
            db.save_user(user_id, username, first_name, last_name, photo_url)
            return user_id, username, first_name, last_name, photo_url
        return None, None, None, None, None
    except Exception as e:
        print(f"Error validating user: {e}")
        return None, None, None, None, None


# ==================== USER ROUTES ====================

@indotag_bp.route('/user/info', methods=['GET', 'POST'])
def get_user_info():
    """Get current user info"""
    try:
        if request.method == 'POST':
            user_id, username, first_name, last_name, photo_url = validate_telegram_user()
            if not user_id:
                return jsonify({'success': False, 'error': 'User tidak valid'}), 400
            
            user = db.get_user(user_id)
            stats = db.get_user_stats(user_id)
            balance = db.get_user_balance(user_id)
            
            return jsonify({
                'success': True,
                'user': user,
                'stats': stats,
                'balance': balance
            })
        else:
            # GET method - ambil dari query parameter
            user_id = request.args.get('user_id', type=int)
            if not user_id:
                return jsonify({'success': False, 'error': 'user_id required'}), 400
            
            user = db.get_user(user_id)
            stats = db.get_user_stats(user_id)
            balance = db.get_user_balance(user_id)
            
            return jsonify({
                'success': True,
                'user': user,
                'stats': stats,
                'balance': balance
            })
    except Exception as e:
        print(f"Error in get_user_info: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@indotag_bp.route('/user/balance', methods=['GET'])
def get_user_balance():
    user_id = request.args.get('user_id', type=int)
    if not user_id:
        return jsonify({'success': False, 'error': 'user_id required'}), 400
    
    balance = db.get_user_balance(user_id)
    return jsonify({'success': True, 'balance': balance})


# ==================== LISTING ROUTES ====================

@indotag_bp.route('/listings', methods=['GET'])
def get_listings():
    """Get all active listings"""
    try:
        category = request.args.get('category', 'all')
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        listings = db.get_listings(category, limit, offset)
        
        return jsonify({
            'success': True,
            'listings': listings,
            'total': len(listings)
        })
    except Exception as e:
        print(f"Error in get_listings: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@indotag_bp.route('/listings/<listing_id>', methods=['GET'])
def get_listing_detail(listing_id):
    """Get listing detail"""
    try:
        listing = db.get_listing_by_id(listing_id)
        if not listing:
            return jsonify({'success': False, 'error': 'Listing tidak ditemukan'}), 404
        
        # Increment views
        db.increment_listing_views(listing_id)
        
        return jsonify({
            'success': True,
            'listing': listing
        })
    except Exception as e:
        print(f"Error in get_listing_detail: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@indotag_bp.route('/listings', methods=['POST'])
def create_listing():
    """Create new listing"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id, username, first_name, last_name, photo_url = validate_telegram_user()
        if not user_id:
            return jsonify({'success': False, 'error': 'User tidak valid'}), 400
        
        username_list = data.get('username')
        price = data.get('price')
        category = data.get('category', 'general')
        description = data.get('description', '')
        
        if not username_list or not price:
            return jsonify({'success': False, 'error': 'Username dan harga wajib diisi'}), 400
        
        listing_id = db.create_listing(user_id, username_list, price, category, description)
        
        if listing_id:
            db.add_activity(user_id, 'create_listing', f'Membuat listing untuk @{username_list}', listing_id)
            return jsonify({
                'success': True,
                'listing_id': listing_id,
                'message': 'Listing berhasil dibuat'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal membuat listing'}), 500
    except Exception as e:
        print(f"Error in create_listing: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== STORAGE ROUTES ====================

@indotag_bp.route('/storage', methods=['GET'])
def get_storage():
    """Get user's purchased usernames"""
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        storage = db.get_user_storage(user_id)
        
        return jsonify({
            'success': True,
            'storage': storage,
            'total': len(storage)
        })
    except Exception as e:
        print(f"Error in get_storage: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== ACTIVITY ROUTES ====================

@indotag_bp.route('/activities', methods=['GET'])
def get_activities():
    """Get user activities"""
    try:
        user_id = request.args.get('user_id', type=int)
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        limit = request.args.get('limit', 50, type=int)
        activities = db.get_user_activities(user_id, limit)
        
        return jsonify({
            'success': True,
            'activities': activities,
            'total': len(activities)
        })
    except Exception as e:
        print(f"Error in get_activities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== STATS ROUTES ====================

@indotag_bp.route('/stats', methods=['GET'])
def get_stats():
    """Get market statistics"""
    try:
        stats = db.get_market_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        print(f"Error in get_stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== CATEGORIES ====================

@indotag_bp.route('/categories', methods=['GET'])
def get_categories():
    categories = [
        {'id': 'all', 'name': 'Semua', 'icon': 'fa-globe'},
        {'id': 'premium', 'name': 'Premium', 'icon': 'fa-crown'},
        {'id': 'general', 'name': 'General', 'icon': 'fa-tag'},
        {'id': 'rare', 'name': 'Rare', 'icon': 'fa-gem'},
        {'id': 'old', 'name': 'Old School', 'icon': 'fa-clock'}
    ]
    return jsonify({'success': True, 'categories': categories})