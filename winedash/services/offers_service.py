# winedash/services/offers_service.py
import sqlite3
import sys
from pathlib import Path
from flask import Blueprint, request, jsonify
from datetime import datetime

# Add root to path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from winedash.database.offers import OffersDatabase

# Create blueprint
offers_bp = Blueprint('offers', __name__, url_prefix='/api/winedash/offers')

# Initialize database
offers_db = OffersDatabase()


# ==================== CREATE OFFER ====================

@offers_bp.route('/create', methods=['POST', 'OPTIONS'])
def create_offer():
    """Create a new offer for a username"""
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
        
        username = data.get('username')
        username_id = data.get('username_id')
        owner_id = data.get('owner_id')
        bidder_id = data.get('bidder_id')
        price = data.get('price')
        message = data.get('message', '')
        
        # Validations
        if not username:
            return jsonify({'success': False, 'error': 'Username diperlukan'}), 400
        
        if not owner_id or not bidder_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        if owner_id == bidder_id:
            return jsonify({'success': False, 'error': 'Tidak bisa membuat offer untuk username sendiri'}), 400
        
        if not price or price <= 0:
            return jsonify({'success': False, 'error': 'Harga offer harus lebih dari 0'}), 400
        
        # Check if username exists in marketplace
        with sqlite3.connect(offers_db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, seller_id FROM usernames WHERE username = ? AND status = "available"', (username,))
            username_row = cursor.fetchone()
            
            if not username_row:
                return jsonify({'success': False, 'error': f'Username @{username} tidak tersedia di marketplace'}), 400
            
            if username_row[1] != owner_id:
                return jsonify({'success': False, 'error': 'Anda bukan pemilik username ini'}), 403
        
        # Create offer
        offer_id = offers_db.create_offer(
            username=username,
            username_id=username_id,
            owner_id=owner_id,
            bidder_id=bidder_id,
            price=float(price),
            message=message
        )
        
        if not offer_id:
            return jsonify({'success': False, 'error': 'Gagal membuat offer'}), 500
        
        return jsonify({
            'success': True,
            'offer_id': offer_id,
            'message': f'Offer berhasil dibuat untuk @{username} dengan harga {price} TON'
        })
        
    except Exception as e:
        print(f"Error in create_offer: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== GET OFFERS ====================

@offers_bp.route('/incoming/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_incoming_offers(user_id):
    """Get offers where user is the owner (incoming offers)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        status = request.args.get('status', 'pending')
        offers = offers_db.get_offers_by_owner(user_id, status)
        
        return jsonify({
            'success': True,
            'offers': offers,
            'total': len(offers)
        })
        
    except Exception as e:
        print(f"Error in get_incoming_offers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@offers_bp.route('/my-offers/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_my_offers(user_id):
    """Get offers where user is the bidder (my offers)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        status = request.args.get('status', 'pending')
        offers = offers_db.get_offers_by_bidder(user_id, status)
        
        return jsonify({
            'success': True,
            'offers': offers,
            'total': len(offers)
        })
        
    except Exception as e:
        print(f"Error in get_my_offers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@offers_bp.route('/all-pending', methods=['GET', 'OPTIONS'])
def get_all_pending_offers():
    """Get all pending offers (for marketplace display)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        offers = offers_db.get_all_pending_offers()
        
        return jsonify({
            'success': True,
            'offers': offers,
            'total': len(offers)
        })
        
    except Exception as e:
        print(f"Error in get_all_pending_offers: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@offers_bp.route('/detail/<int:offer_id>', methods=['GET', 'OPTIONS'])
def get_offer_detail(offer_id):
    """Get single offer detail"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        offer = offers_db.get_offer_by_id(offer_id)
        
        if not offer:
            return jsonify({'success': False, 'error': 'Offer tidak ditemukan'}), 404
        
        return jsonify({
            'success': True,
            'offer': offer
        })
        
    except Exception as e:
        print(f"Error in get_offer_detail: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@offers_bp.route('/history/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_offer_history(user_id):
    """Get offer history for a user"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        limit = request.args.get('limit', 50, type=int)
        history = offers_db.get_offer_history(user_id, limit)
        
        return jsonify({
            'success': True,
            'history': history,
            'total': len(history)
        })
        
    except Exception as e:
        print(f"Error in get_offer_history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@offers_bp.route('/count/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_offer_count(user_id):
    """Get offer count for a user"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        status = request.args.get('status', 'pending')
        count = offers_db.get_offer_count_by_user(user_id, status)
        
        return jsonify({
            'success': True,
            'count': count
        })
        
    except Exception as e:
        print(f"Error in get_offer_count: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== UPDATE OFFER STATUS ====================

@offers_bp.route('/accept/<int:offer_id>', methods=['POST', 'OPTIONS'])
def accept_offer(offer_id):
    """Accept an offer"""
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
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        success = offers_db.accept_offer(offer_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Offer berhasil diterima!'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Gagal menerima offer. Pastikan Anda adalah pemilik username.'
            }), 400
        
    except Exception as e:
        print(f"Error in accept_offer: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@offers_bp.route('/reject/<int:offer_id>', methods=['POST', 'OPTIONS'])
def reject_offer(offer_id):
    """Reject an offer"""
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
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        success = offers_db.reject_offer(offer_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Offer ditolak!'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Gagal menolak offer'
            }), 400
        
    except Exception as e:
        print(f"Error in reject_offer: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@offers_bp.route('/cancel/<int:offer_id>', methods=['POST', 'OPTIONS'])
def cancel_offer(offer_id):
    """Cancel an offer (by bidder)"""
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
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        success = offers_db.cancel_offer(offer_id, user_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Offer dibatalkan!'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Gagal membatalkan offer'
            }), 400
        
    except Exception as e:
        print(f"Error in cancel_offer: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500