# winedash/services/market_service.py
import sqlite3
import sys
import uuid
from pathlib import Path
from flask import Blueprint, request, jsonify
from datetime import datetime

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from winedash.database.web import WinedashDatabase

market_bp = Blueprint('market', __name__, url_prefix='/api/winedash/market')
db = WinedashDatabase()


# ==================== CHECKOUT CART ENDPOINTS ====================

@market_bp.route('/cart/add', methods=['POST', 'OPTIONS'])
def add_to_cart():
    """Add username to checkout cart"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id = data.get('user_id')
        username_id = data.get('username_id')
        username = data.get('username')
        based_on = data.get('based_on', '')
        price = data.get('price')
        seller_id = data.get('seller_id')
        seller_wallet = data.get('seller_wallet', '')
        
        if not user_id or not username_id or not price:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        success = db.add_to_checkout(user_id, username_id, username, based_on, price, seller_id, seller_wallet)
        
        if success:
            count = db.get_checkout_count(user_id)
            return jsonify({
                'success': True,
                'message': f'@{username} added to cart',
                'cart_count': count
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to add to cart'}), 500
            
    except Exception as e:
        print(f"Error in add_to_cart: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@market_bp.route('/cart/remove', methods=['POST', 'OPTIONS'])
def remove_from_cart():
    """Remove username from checkout cart"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        user_id = data.get('user_id')
        username_id = data.get('username_id')
        
        if not user_id or not username_id:
            return jsonify({'success': False, 'error': 'Parameter tidak valid'}), 400
        
        success = db.remove_from_checkout(user_id, username_id)
        
        if success:
            count = db.get_checkout_count(user_id)
            return jsonify({
                'success': True,
                'message': 'Removed from cart',
                'cart_count': count
            })
        else:
            return jsonify({'success': False, 'error': 'Item not in cart'}), 404
            
    except Exception as e:
        print(f"Error in remove_from_cart: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@market_bp.route('/cart/list/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_cart(user_id):
    """Get user's checkout cart"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        cart = db.get_checkout_cart(user_id)
        return jsonify({
            'success': True,
            'cart': cart,
            'count': len(cart),
            'total': sum(item['price'] for item in cart)
        })
    except Exception as e:
        print(f"Error in get_cart: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@market_bp.route('/cart/count/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_cart_count(user_id):
    """Get cart item count"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        count = db.get_checkout_count(user_id)
        return jsonify({'success': True, 'count': count})
    except Exception as e:
        print(f"Error in get_cart_count: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@market_bp.route('/cart/checkout', methods=['POST', 'OPTIONS'])
def checkout_cart():
    """Process checkout - bulk purchase"""
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
        
        result = db.checkout_bulk_purchase(user_id)
        
        if result.get('success'):
            return jsonify({
                'success': True,
                'message': f'Successfully purchased {result["count"]} usernames!',
                'purchased': result['purchased'],
                'total_amount': result['total_amount'],
                'transaction_id': result['transaction_id']
            })
        else:
            return jsonify({'success': False, 'error': result.get('error', 'Checkout failed')}), 400
            
    except Exception as e:
        print(f"Error in checkout_cart: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@market_bp.route('/cart/summary/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_cart_summary(user_id):
    """Get cart summary"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        summary = db.get_checkout_summary(user_id)
        return jsonify({'success': True, 'summary': summary})
    except Exception as e:
        print(f"Error in get_cart_summary: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@market_bp.route('/cart/clear/<int:user_id>', methods=['DELETE', 'OPTIONS'])
def clear_cart(user_id):
    """Clear checkout cart"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
        return response
    
    try:
        success = db.clear_checkout_cart(user_id)
        return jsonify({'success': success, 'message': 'Cart cleared'})
    except Exception as e:
        print(f"Error in clear_cart: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== MARKET FILTER ENDPOINTS ====================

@market_bp.route('/filters', methods=['GET', 'OPTIONS'])
def get_market_filters():
    """Get available market filters"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        filters = [
            {'id': 'fixprice', 'name': 'Fix Price', 'icon': 'fa-tag'},
            {'id': 'premarket', 'name': 'Pre-Markets', 'icon': 'fa-chart-line'},
            {'id': 'instant', 'name': 'Instant Offers', 'icon': 'fa-bolt'},
            {'id': 'auctions', 'name': 'Auctions', 'icon': 'fa-gavel'}
        ]
        return jsonify({'success': True, 'filters': filters})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500