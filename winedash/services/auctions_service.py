# winedash/services/auctions_service.py
import sqlite3
import sys
from pathlib import Path
from flask import Blueprint, request, jsonify
from datetime import datetime

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from winedash.database.auctions import AuctionsDatabase

auctions_bp = Blueprint('auctions', __name__, url_prefix='/api/winedash/auctions')
auctions_db = AuctionsDatabase()


# ==================== CREATE AUCTION ====================

@auctions_bp.route('/create', methods=['POST', 'OPTIONS'])
def create_auction():
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
        start_price = data.get('start_price')
        min_increment = data.get('min_increment')
        duration = data.get('duration')
        
        # Validations
        if not username or not username_id:
            return jsonify({'success': False, 'error': 'Username diperlukan'}), 400
        
        if not owner_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        if not start_price or float(start_price) < 0.1:
            return jsonify({'success': False, 'error': 'Start price minimal 0.1 TON'}), 400
        
        if not min_increment or float(min_increment) < 0.01:
            return jsonify({'success': False, 'error': 'Minimum increment minimal 0.01 TON'}), 400
        
        if not duration:
            return jsonify({'success': False, 'error': 'Durasi auction diperlukan'}), 400
        
        # PERBAIKAN: Cek apakah username sudah memiliki auction
        with sqlite3.connect(auctions_db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, status FROM auctions WHERE username = ?', (username,))
            existing = cursor.fetchone()
            
            if existing:
                existing_id, existing_status = existing
                return jsonify({'success': False, 'error': f'Username @{username} sudah pernah di-auction sebelumnya (status: {existing_status})'}), 400
        
        # Check if username is owned by user and available
        with sqlite3.connect(auctions_db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, status FROM usernames 
                WHERE id = ? AND seller_id = ? AND status = 'available'
            ''', (username_id, owner_id))
            username_row = cursor.fetchone()
            
            if not username_row:
                return jsonify({'success': False, 'error': 'Username tidak tersedia atau bukan milik Anda'}), 400
        
        # Create auction
        auction_id = auctions_db.create_auction(
            username=username,
            username_id=username_id,
            owner_id=owner_id,
            start_price=float(start_price),
            min_increment=float(min_increment),
            duration_str=duration
        )
        
        if not auction_id:
            return jsonify({'success': False, 'error': 'Gagal membuat auction. Username mungkin sudah pernah di-auction.'}), 500
        
        return jsonify({
            'success': True,
            'auction_id': auction_id,
            'message': f'Auction untuk @{username} berhasil dimulai!'
        })
        
    except Exception as e:
        print(f"Error in create_auction: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== GET AUCTIONS ====================

@auctions_bp.route('/active', methods=['GET', 'OPTIONS'])
def get_active_auctions():
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        print(f"[API] get_active_auctions called")
        
        auctions = auctions_db.get_active_auctions()
        
        print(f"[API] Found {len(auctions)} active auctions from DB")
        
        # PERBAIKAN: Filter hanya yang end_time > now dan status active
        from datetime import datetime
        import pytz
        
        tz = pytz.timezone('Asia/Jakarta')
        now = datetime.now(tz)
        
        active_auctions = []
        for auction in auctions:
            # Skip jika status bukan active
            if auction.get('status') != 'active':
                print(f"[API] Skipping auction {auction.get('id')} - status: {auction.get('status')}")
                continue
                
            if auction.get('end_time'):
                try:
                    end_time_str = auction['end_time']
                    if 'Z' in end_time_str:
                        end_time_str = end_time_str.replace('Z', '+00:00')
                    end_time = datetime.fromisoformat(end_time_str)
                    
                    if end_time.tzinfo is None:
                        end_time = tz.localize(end_time)
                    
                    if end_time > now:
                        active_auctions.append(auction)
                        print(f"[API] Added auction {auction.get('id')} - {auction.get('username')} ends at {end_time}")
                    else:
                        print(f"[API] Auction {auction.get('id')} expired at {end_time}")
                except Exception as e:
                    print(f"Error parsing end_time: {e}")
                    active_auctions.append(auction)
            else:
                active_auctions.append(auction)
        
        print(f"[API] Returning {len(active_auctions)} active auctions")
        
        return jsonify({
            'success': True,
            'auctions': active_auctions,
            'total': len(active_auctions)
        })
        
    except Exception as e:
        print(f"Error in get_active_auctions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e), 'auctions': []}), 500

@auctions_bp.route('/my/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_my_auctions(user_id):
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        auctions = auctions_db.get_auctions_by_owner(user_id)
        
        return jsonify({
            'success': True,
            'auctions': auctions,
            'total': len(auctions)
        })
        
    except Exception as e:
        print(f"Error in get_my_auctions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@auctions_bp.route('/my-bids/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_my_bids_endpoint(user_id):
    """Get auctions where user has placed bids"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        auctions = auctions_db.get_auctions_with_bids(user_id)
        
        # PERBAIKAN: Tambahkan informasi my_last_bid untuk setiap auction
        import sqlite3
        with sqlite3.connect(auctions_db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            for auction in auctions:
                cursor.execute('''
                    SELECT bid_amount, timestamp FROM bids 
                    WHERE auction_id = ? AND user_id = ? 
                    ORDER BY timestamp DESC LIMIT 1
                ''', (auction['id'], user_id))
                row = cursor.fetchone()
                if row:
                    auction['my_last_bid'] = row['bid_amount']
                    auction['my_last_bid_time'] = row['timestamp']
        
        # Filter hanya yang masih active
        from datetime import datetime
        import pytz
        
        tz = pytz.timezone('Asia/Jakarta')
        now = datetime.now(tz)
        
        active_auctions = []
        for auction in auctions:
            if auction.get('end_time'):
                try:
                    end_time_str = auction['end_time']
                    if 'Z' in end_time_str:
                        end_time_str = end_time_str.replace('Z', '+00:00')
                    end_time = datetime.fromisoformat(end_time_str)
                    
                    if end_time.tzinfo is None:
                        end_time = tz.localize(end_time)
                    
                    if end_time > now:
                        active_auctions.append(auction)
                except Exception:
                    active_auctions.append(auction)
            else:
                active_auctions.append(auction)
        
        return jsonify({
            'success': True,
            'auctions': active_auctions,
            'total': len(active_auctions)
        })
        
    except Exception as e:
        print(f"Error in get_my_bids_endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e), 'auctions': []}), 500

@auctions_bp.route('/detail/<int:auction_id>', methods=['GET', 'OPTIONS'])
def get_auction_detail(auction_id):
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        auction = auctions_db.get_auction_detail(auction_id)
        bids = auctions_db.get_bid_history(auction_id)
        
        if not auction:
            return jsonify({'success': False, 'error': 'Auction tidak ditemukan'}), 404
        
        return jsonify({
            'success': True,
            'auction': auction,
            'bids': bids,
            'bid_count': len(bids)
        })
        
    except Exception as e:
        print(f"Error in get_auction_detail: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@auctions_bp.route('/count/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_auction_count(user_id):
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        count = auctions_db.get_auction_count_by_user(user_id)
        
        return jsonify({
            'success': True,
            'count': count
        })
        
    except Exception as e:
        print(f"Error in get_auction_count: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== BID OPERATIONS ====================

@auctions_bp.route('/bid/<int:auction_id>', methods=['POST', 'OPTIONS'])
def place_bid(auction_id):
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        bid_amount = data.get('bid_amount')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        if not bid_amount or float(bid_amount) <= 0:
            return jsonify({'success': False, 'error': 'Bid amount tidak valid'}), 400
        
        success = auctions_db.place_bid(auction_id, user_id, float(bid_amount))
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Bid berhasil ditempatkan!'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Gagal menempatkan bid. Pastikan bid lebih tinggi dari current price + increment'
            }), 400
        
    except Exception as e:
        print(f"Error in place_bid: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== END AUCTION ====================

@auctions_bp.route('/check-expired', methods=['POST', 'OPTIONS'])
def check_expired_auctions():
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        ended_count = auctions_db.check_expired_auctions()
        
        return jsonify({
            'success': True,
            'ended_count': ended_count,
            'message': f'{ended_count} auction(s) ended'
        })
        
    except Exception as e:
        print(f"Error in check_expired_auctions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@auctions_bp.route('/ended/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_ended_auctions(user_id):
    """Get ended auctions for user"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        print(f"[DEBUG] get_ended_auctions called for user_id: {user_id}")
        
        # Panggil method get_ended_auctions dari AuctionsDatabase
        auctions = auctions_db.get_ended_auctions(user_id)
        
        # PERBAIKAN: Tambahkan logging untuk debug
        print(f"[DEBUG] Found {len(auctions)} ended auctions for user {user_id}")
        if len(auctions) > 0:
            print(f"[DEBUG] First ended auction: {auctions[0].get('username')}")
        
        return jsonify({
            'success': True,
            'auctions': auctions,
            'total': len(auctions)
        })
        
    except Exception as e:
        print(f"Error in get_ended_auctions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e), 'auctions': []}), 500

@auctions_bp.route('/ended-all', methods=['GET', 'OPTIONS'])
def get_all_ended_auctions():
    """Get all ended auctions from all users"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        print(f"[DEBUG] get_all_ended_auctions called")
        
        auctions = auctions_db.get_ended_auctions()
        
        print(f"[DEBUG] Found {len(auctions)} ended auctions total")
        
        return jsonify({
            'success': True,
            'auctions': auctions,
            'total': len(auctions)
        })
        
    except Exception as e:
        print(f"Error in get_all_ended_auctions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e), 'auctions': []}), 500
    
@auctions_bp.route('/my-auctions/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_my_auctions_endpoint(user_id):
    """Get auctions created by user (my auctions)"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response
    
    try:
        print(f"[AUCTIONS] get_my_auctions_endpoint called for user_id: {user_id}")
        
        auctions = auctions_db.get_auctions_by_owner(user_id)
        
        print(f"[AUCTIONS] Found {len(auctions)} auctions for user {user_id}")
        
        from datetime import datetime
        import pytz
        
        tz = pytz.timezone('Asia/Jakarta')
        now = datetime.now(tz)
        
        for auction in auctions:
            if auction.get('end_time'):
                try:
                    end_time_str = auction['end_time']
                    if 'Z' in end_time_str:
                        end_time_str = end_time_str.replace('Z', '+00:00')
                    end_time = datetime.fromisoformat(end_time_str)
                    
                    if end_time.tzinfo is None:
                        end_time = tz.localize(end_time)
                    
                    if auction.get('status') == 'active' and now > end_time:
                        auction['status'] = 'ended'
                        with sqlite3.connect(auctions_db.db_path) as conn:
                            cursor = conn.cursor()
                            cursor.execute('UPDATE auctions SET status = "ended" WHERE id = ?', (auction['id'],))
                            conn.commit()
                except Exception as e:
                    print(f"Error parsing end_time for auction {auction.get('id')}: {e}")
        
        # Tambahkan winner info jika ada
        with sqlite3.connect(auctions_db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            for auction in auctions:
                if auction.get('winner_id'):
                    cursor.execute('SELECT username, first_name, photo_url FROM users WHERE user_id = ?', (auction['winner_id'],))
                    winner = cursor.fetchone()
                    if winner:
                        auction['winner_username'] = winner['username']
                        auction['winner_name'] = winner['first_name']
                        auction['winner_photo'] = winner['photo_url']
        
        return jsonify({
            'success': True,
            'auctions': auctions,
            'total': len(auctions)
        })
        
    except Exception as e:
        print(f"Error in get_my_auctions_endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e), 'auctions': []}), 500