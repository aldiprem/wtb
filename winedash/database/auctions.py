# winedash/database/auctions.py
import sqlite3
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import pytz

class AuctionsDatabase:
    def __init__(self, db_path: str = "/root/wtb/winedash/database/winedash.db"):
        self.db_path = db_path
        self.timezone = pytz.timezone('Asia/Jakarta')
    
    def _get_now(self) -> datetime:
        return datetime.now(self.timezone)
    
    def _get_now_str(self) -> str:
        return self._get_now().isoformat()
    
    def parse_duration(self, duration_str: str) -> tuple:
        """Parse duration string to seconds and display text"""
        durations = {
            '1h': (3600, '1 Jam'),
            '12h': (43200, '12 Jam'),
            '1d': (86400, '1 Hari'),
            '7d': (604800, '1 Minggu')
        }
        
        if duration_str in durations:
            return durations[duration_str]
        
        # Custom duration (in hours)
        try:
            hours = int(duration_str)
            return (hours * 3600, f'{hours} Jam')
        except:
            return (3600, '1 Jam')
    
    # ==================== CREATE AUCTION ====================
    
    def create_auction(self, username: str, username_id: int, owner_id: int,
                       start_price: float, min_increment: float, 
                       duration_str: str) -> Optional[int]:
        """Create a new auction for a username"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                now_str = now.isoformat()
                
                # Parse duration
                duration_seconds, duration_text = self.parse_duration(duration_str)
                end_time = now + timedelta(seconds=duration_seconds)
                end_time_str = end_time.isoformat()
                
                # Check if username already has active auction
                cursor.execute('''
                    SELECT id FROM auctions 
                    WHERE username = ? AND status = 'active'
                ''', (username,))
                if cursor.fetchone():
                    print(f"❌ Username {username} already has active auction")
                    return None
                
                # Check if username exists and is available
                cursor.execute('''
                    SELECT id, status FROM usernames 
                    WHERE id = ? AND seller_id = ? AND status = 'available'
                ''', (username_id, owner_id))
                username_row = cursor.fetchone()
                
                if not username_row:
                    print(f"❌ Username {username} not available or not owned by user")
                    return None
                
                # Create auction
                cursor.execute('''
                    INSERT INTO auctions 
                    (username, username_id, owner_id, start_price, current_price, 
                     min_increment, duration, duration_seconds, start_time, end_time, 
                     status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
                ''', (username, username_id, owner_id, start_price, start_price,
                      min_increment, duration_text, duration_seconds, now_str, end_time_str,
                      now_str, now_str))
                
                auction_id = cursor.lastrowid
                
                # Update username status to on_auction
                cursor.execute('''
                    UPDATE usernames 
                    SET status = 'on_auction', auction_id = ?
                    WHERE id = ?
                ''', (auction_id, username_id))
                
                conn.commit()
                print(f"✅ Auction created: ID={auction_id}, username={username}, end_time={end_time_str}")
                return auction_id
                
        except Exception as e:
            print(f"Error creating auction: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    # ==================== GET AUCTIONS ====================
    
    def get_active_auctions(self, limit: int = 100) -> List[Dict]:
        """Get all active auctions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                now = self._get_now_str()
                
                cursor.execute('''
                    SELECT a.*, u.username as owner_username, u.first_name as owner_name,
                           u.photo_url as owner_photo
                    FROM auctions a
                    LEFT JOIN users u ON a.owner_id = u.user_id
                    WHERE a.status = 'active' AND a.end_time > ?
                    ORDER BY a.end_time ASC
                    LIMIT ?
                ''', (now, limit))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting active auctions: {e}")
            return []
    
    def get_auctions_by_owner(self, owner_id: int) -> List[Dict]:
        """Get auctions created by user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT a.*, 
                           (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count,
                           (SELECT MAX(bid_amount) FROM bids WHERE auction_id = a.id) as highest_bid
                    FROM auctions a
                    WHERE a.owner_id = ?
                    ORDER BY a.created_at DESC
                ''', (owner_id,))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting auctions by owner: {e}")
            return []
    
    def get_auctions_with_bids(self, user_id: int) -> List[Dict]:
        """Get auctions where user has placed bids"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT DISTINCT a.*, 
                           (SELECT MAX(bid_amount) FROM bids WHERE auction_id = a.id) as highest_bid,
                           (SELECT bid_amount FROM bids WHERE auction_id = a.id AND user_id = ? ORDER BY timestamp DESC LIMIT 1) as my_last_bid
                    FROM auctions a
                    INNER JOIN bids b ON a.id = b.auction_id
                    WHERE b.user_id = ? AND a.status = 'active'
                    ORDER BY a.end_time ASC
                ''', (user_id, user_id))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting auctions with bids: {e}")
            return []
    
    def get_auction_detail(self, auction_id: int) -> Optional[Dict]:
        """Get auction detail with additional info"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT a.*, u.username as owner_username, u.first_name as owner_name,
                           u.photo_url as owner_photo
                    FROM auctions a
                    LEFT JOIN users u ON a.owner_id = u.user_id
                    WHERE a.id = ?
                ''', (auction_id,))
                
                row = cursor.fetchone()
                return dict(row) if row else None
                
        except Exception as e:
            print(f"Error getting auction detail: {e}")
            return None
    
    def get_bid_history(self, auction_id: int, limit: int = 50) -> List[Dict]:
        """Get bid history for an auction"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT b.*, u.username, u.first_name, u.last_name, u.photo_url
                    FROM bids b
                    LEFT JOIN users u ON b.user_id = u.user_id
                    WHERE b.auction_id = ?
                    ORDER BY b.bid_amount DESC, b.timestamp ASC
                    LIMIT ?
                ''', (auction_id, limit))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting bid history: {e}")
            return []
    
    def get_auction_count_by_user(self, user_id: int) -> int:
        """Get count of active auctions for a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now_str()
                
                cursor.execute('''
                    SELECT COUNT(*) FROM auctions 
                    WHERE owner_id = ? AND status = 'active' AND end_time > ?
                ''', (user_id, now))
                
                row = cursor.fetchone()
                return row[0] if row else 0
                
        except Exception as e:
            print(f"Error getting auction count: {e}")
            return 0
    
    # ==================== BID OPERATIONS ====================
    
    def place_bid(self, auction_id: int, user_id: int, bid_amount: float) -> bool:
        """Place a bid on an auction"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now_str()
                
                cursor.execute('BEGIN IMMEDIATE')
                
                # Get auction details
                cursor.execute('''
                    SELECT id, username, current_price, min_increment, end_time, status, owner_id
                    FROM auctions WHERE id = ? AND status = 'active'
                ''', (auction_id,))
                auction = cursor.fetchone()
                
                if not auction:
                    conn.rollback()
                    return False
                
                auction_id, username, current_price, min_increment, end_time, status, owner_id = auction
                
                # Check if auction is still active
                end_time_dt = datetime.fromisoformat(end_time)
                if self._get_now() > end_time_dt:
                    cursor.execute('UPDATE auctions SET status = "ended" WHERE id = ?', (auction_id,))
                    conn.commit()
                    conn.rollback()
                    return False
                
                # Check if user is the owner (cannot bid on own auction)
                if user_id == owner_id:
                    conn.rollback()
                    return False
                
                # Check minimum bid
                min_bid = current_price + min_increment
                if bid_amount < min_bid:
                    conn.rollback()
                    return False
                
                # Place bid
                cursor.execute('''
                    INSERT INTO bids (auction_id, user_id, bid_amount, timestamp)
                    VALUES (?, ?, ?, ?)
                ''', (auction_id, user_id, bid_amount, now))
                
                # Update auction current price
                cursor.execute('''
                    UPDATE auctions 
                    SET current_price = ?, updated_at = ?
                    WHERE id = ?
                ''', (bid_amount, now, auction_id))
                
                conn.commit()
                print(f"✅ Bid placed: auction={auction_id}, user={user_id}, amount={bid_amount}")
                return True
                
        except Exception as e:
            print(f"Error placing bid: {e}")
            return False
    
    def end_auction(self, auction_id: int) -> Optional[Dict]:
        """End an auction and determine winner"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now_str()
                
                cursor.execute('BEGIN IMMEDIATE')
                
                # Get auction details
                cursor.execute('''
                    SELECT id, username, username_id, owner_id, current_price
                    FROM auctions WHERE id = ? AND status = 'active'
                ''', (auction_id,))
                auction = cursor.fetchone()
                
                if not auction:
                    conn.rollback()
                    return None
                
                auction_id, username, username_id, owner_id, current_price = auction
                
                # Get highest bid
                cursor.execute('''
                    SELECT user_id, bid_amount FROM bids 
                    WHERE auction_id = ? 
                    ORDER BY bid_amount DESC, timestamp ASC 
                    LIMIT 1
                ''', (auction_id,))
                highest_bid = cursor.fetchone()
                
                winner_id = None
                winning_bid = None
                
                if highest_bid:
                    winner_id = highest_bid[0]
                    winning_bid = highest_bid[1]
                    
                    # Transfer username to winner
                    cursor.execute('''
                        UPDATE usernames 
                        SET status = 'sold', buyer_id = ?, sold_at = ?
                        WHERE id = ?
                    ''', (winner_id, now, username_id))
                    
                    # Transfer funds: winner pays, owner receives (minus fee)
                    fee = winning_bid * 0.05  # 5% fee
                    owner_receives = winning_bid - fee
                    
                    cursor.execute('UPDATE users SET balance = balance - ? WHERE user_id = ?', (winning_bid, winner_id))
                    cursor.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (owner_receives, owner_id))
                
                # Update auction status
                cursor.execute('''
                    UPDATE auctions 
                    SET status = 'ended', winner_id = ?, winning_bid = ?, updated_at = ?
                    WHERE id = ?
                ''', (winner_id, winning_bid, now, auction_id))
                
                conn.commit()
                
                return {
                    'winner_id': winner_id,
                    'winning_bid': winning_bid,
                    'username': username
                }
                
        except Exception as e:
            print(f"Error ending auction: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def check_expired_auctions(self) -> int:
        """Check and end all expired auctions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now_str()
                
                cursor.execute('''
                    SELECT id FROM auctions 
                    WHERE status = 'active' AND end_time <= ?
                ''', (now,))
                expired = cursor.fetchall()
                
                ended_count = 0
                for (auction_id,) in expired:
                    result = self.end_auction(auction_id)
                    if result:
                        ended_count += 1
                
                return ended_count
                
        except Exception as e:
            print(f"Error checking expired auctions: {e}")
            return 0
            
    def get_ended_auctions(self, user_id: int = None, limit: int = 100) -> List[Dict]:
        """Get ended auctions (completed auctions)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                if user_id:
                    # Get ended auctions where user is owner or bidder
                    cursor.execute('''
                        SELECT DISTINCT a.*, 
                            u.username as owner_username, u.first_name as owner_name, u.photo_url as owner_photo,
                            w.username as winner_username, w.first_name as winner_name, w.photo_url as winner_photo,
                            (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
                        FROM auctions a
                        LEFT JOIN users u ON a.owner_id = u.user_id
                        LEFT JOIN users w ON a.winner_id = w.user_id
                        WHERE a.status = 'ended' AND (a.owner_id = ? OR a.winner_id = ?)
                        ORDER BY a.end_time DESC
                        LIMIT ?
                    ''', (user_id, user_id, limit))
                else:
                    # Get all ended auctions
                    cursor.execute('''
                        SELECT a.*, 
                            u.username as owner_username, u.first_name as owner_name, u.photo_url as owner_photo,
                            w.username as winner_username, w.first_name as winner_name, w.photo_url as winner_photo,
                            (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
                        FROM auctions a
                        LEFT JOIN users u ON a.owner_id = u.user_id
                        LEFT JOIN users w ON a.winner_id = w.user_id
                        WHERE a.status = 'ended'
                        ORDER BY a.end_time DESC
                        LIMIT ?
                    ''', (limit,))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting ended auctions: {e}")
            return []