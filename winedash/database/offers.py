# winedash/database/offers.py
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional, Any
import pytz
import os

class OffersDatabase:
    def __init__(self, db_path: str = "/root/wtb/winedash/database/winedash.db"):
        self.db_path = db_path
        self.timezone = pytz.timezone('Asia/Jakarta')
        self.init_offers_table()
    
    def _get_now(self) -> str:
        """Get current time in Asia/Jakarta timezone as ISO format string"""
        return datetime.now(self.timezone).isoformat()
    
    def init_offers_table(self):
        """Initialize offers table if not exists"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create offers table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS offers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT NOT NULL,
                        username_id INTEGER,
                        owner_id INTEGER NOT NULL,
                        bidder_id INTEGER NOT NULL,
                        price DECIMAL(20, 8) NOT NULL,
                        status TEXT DEFAULT 'pending',
                        message TEXT,
                        created_at TIMESTAMP,
                        updated_at TIMESTAMP,
                        expires_at TIMESTAMP,
                        accepted_at TIMESTAMP,
                        rejected_at TIMESTAMP,
                        cancelled_at TIMESTAMP,
                        FOREIGN KEY (owner_id) REFERENCES users(user_id),
                        FOREIGN KEY (bidder_id) REFERENCES users(user_id)
                    )
                ''')
                
                # Create indexes for better performance
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_offers_owner ON offers(owner_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_offers_bidder ON offers(bidder_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_offers_username ON offers(username)')
                
                # Create offers_history table for completed offers
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS offers_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        offer_id INTEGER,
                        username TEXT NOT NULL,
                        owner_id INTEGER NOT NULL,
                        bidder_id INTEGER NOT NULL,
                        price DECIMAL(20, 8) NOT NULL,
                        status TEXT NOT NULL,
                        action_by INTEGER,
                        created_at TIMESTAMP,
                        completed_at TIMESTAMP,
                        FOREIGN KEY (owner_id) REFERENCES users(user_id),
                        FOREIGN KEY (bidder_id) REFERENCES users(user_id)
                    )
                ''')
                
                conn.commit()
                print("✅ Offers table initialized successfully")
                
        except Exception as e:
            print(f"Error initializing offers table: {e}")
    
    # ==================== CREATE OFFER ====================
    
    def create_offer(self, username: str, username_id: int, owner_id: int, 
                     bidder_id: int, price: float, message: str = "") -> Optional[int]:
        """Create a new offer for a username"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Check if there's already a pending offer for this username by same bidder
                cursor.execute('''
                    SELECT id FROM offers 
                    WHERE username = ? AND bidder_id = ? AND status = 'pending'
                ''', (username, bidder_id))
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing offer instead of creating new
                    cursor.execute('''
                        UPDATE offers 
                        SET price = ?, message = ?, updated_at = ?
                        WHERE id = ?
                    ''', (price, message, now, existing[0]))
                    return existing[0]
                
                # Create new offer
                cursor.execute('''
                    INSERT INTO offers 
                    (username, username_id, owner_id, bidder_id, price, message, 
                     status, created_at, updated_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
                ''', (username, username_id, owner_id, bidder_id, price, message, 
                      now, now, None))
                
                offer_id = cursor.lastrowid
                conn.commit()
                print(f"✅ Offer created: ID={offer_id}, username={username}, price={price}")
                return offer_id
                
        except Exception as e:
            print(f"Error creating offer: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    # ==================== GET OFFERS ====================
    
    def get_offers_by_owner(self, owner_id: int, status: str = None, limit: int = 100) -> List[Dict]:
        """Get offers where user is the owner (username owner)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                if status:
                    cursor.execute('''
                        SELECT o.*, u.username as bidder_username, u.first_name as bidder_name,
                               u.photo_url as bidder_photo
                        FROM offers o
                        LEFT JOIN users u ON o.bidder_id = u.user_id
                        WHERE o.owner_id = ? AND o.status = ?
                        ORDER BY o.created_at DESC
                        LIMIT ?
                    ''', (owner_id, status, limit))
                else:
                    cursor.execute('''
                        SELECT o.*, u.username as bidder_username, u.first_name as bidder_name,
                               u.photo_url as bidder_photo
                        FROM offers o
                        LEFT JOIN users u ON o.bidder_id = u.user_id
                        WHERE o.owner_id = ?
                        ORDER BY o.created_at DESC
                        LIMIT ?
                    ''', (owner_id, limit))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting offers by owner: {e}")
            return []
    
    def get_offers_by_bidder(self, bidder_id: int, status: str = None, limit: int = 100) -> List[Dict]:
        """Get offers where user is the bidder"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                if status:
                    cursor.execute('''
                        SELECT o.*, u.username as owner_username, u.first_name as owner_name,
                               u.photo_url as owner_photo
                        FROM offers o
                        LEFT JOIN users u ON o.owner_id = u.user_id
                        WHERE o.bidder_id = ? AND o.status = ?
                        ORDER BY o.created_at DESC
                        LIMIT ?
                    ''', (bidder_id, status, limit))
                else:
                    cursor.execute('''
                        SELECT o.*, u.username as owner_username, u.first_name as owner_name,
                               u.photo_url as owner_photo
                        FROM offers o
                        LEFT JOIN users u ON o.owner_id = u.user_id
                        WHERE o.bidder_id = ?
                        ORDER BY o.created_at DESC
                        LIMIT ?
                    ''', (bidder_id, limit))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting offers by bidder: {e}")
            return []
    
    def get_offers_by_username(self, username: str, limit: int = 50) -> List[Dict]:
        """Get all offers for a specific username"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT o.*, 
                           u1.username as owner_username, u1.first_name as owner_name,
                           u2.username as bidder_username, u2.first_name as bidder_name
                    FROM offers o
                    LEFT JOIN users u1 ON o.owner_id = u1.user_id
                    LEFT JOIN users u2 ON o.bidder_id = u2.user_id
                    WHERE o.username = ?
                    ORDER BY o.created_at DESC
                    LIMIT ?
                ''', (username, limit))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting offers by username: {e}")
            return []
    
    def get_all_pending_offers(self, limit: int = 200) -> List[Dict]:
        """Get all pending offers (for marketplace display)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT o.*, 
                           u1.username as owner_username, u1.first_name as owner_name,
                           u2.username as bidder_username, u2.first_name as bidder_name
                    FROM offers o
                    LEFT JOIN users u1 ON o.owner_id = u1.user_id
                    LEFT JOIN users u2 ON o.bidder_id = u2.user_id
                    WHERE o.status = 'pending'
                    ORDER BY o.price DESC, o.created_at ASC
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting all pending offers: {e}")
            return []
    
    def get_offer_by_id(self, offer_id: int) -> Optional[Dict]:
        """Get single offer by ID"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT o.*, 
                           u1.username as owner_username, u1.first_name as owner_name,
                           u2.username as bidder_username, u2.first_name as bidder_name,
                           u1.photo_url as owner_photo, u2.photo_url as bidder_photo
                    FROM offers o
                    LEFT JOIN users u1 ON o.owner_id = u1.user_id
                    LEFT JOIN users u2 ON o.bidder_id = u2.user_id
                    WHERE o.id = ?
                ''', (offer_id,))
                
                row = cursor.fetchone()
                return dict(row) if row else None
                
        except Exception as e:
            print(f"Error getting offer by ID: {e}")
            return None
    
    def get_offer_count_by_user(self, user_id: int, status: str = 'pending') -> int:
        """Get count of offers for a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT COUNT(*) FROM offers 
                    WHERE (owner_id = ? OR bidder_id = ?) AND status = ?
                ''', (user_id, user_id, status))
                
                row = cursor.fetchone()
                return row[0] if row else 0
                
        except Exception as e:
            print(f"Error getting offer count: {e}")
            return 0
    
    # ==================== UPDATE OFFER STATUS ====================
    
    def accept_offer(self, offer_id: int, user_id: int) -> bool:
        """Accept an offer (owner accepts bidder's offer)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Get offer details
                cursor.execute('SELECT owner_id, bidder_id, price, username FROM offers WHERE id = ? AND status = "pending"', (offer_id,))
                offer = cursor.fetchone()
                
                if not offer:
                    return False
                
                owner_id, bidder_id, price, username = offer
                
                # Verify user is the owner
                if owner_id != user_id:
                    return False
                
                # Update offer status
                cursor.execute('''
                    UPDATE offers 
                    SET status = 'accepted', accepted_at = ?, updated_at = ?
                    WHERE id = ?
                ''', (now, now, offer_id))
                
                # Move to history
                cursor.execute('''
                    INSERT INTO offers_history 
                    (offer_id, username, owner_id, bidder_id, price, status, action_by, created_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, 'accepted', ?, ?, ?)
                ''', (offer_id, username, owner_id, bidder_id, price, user_id, now, now))
                
                conn.commit()
                print(f"✅ Offer {offer_id} accepted by owner {user_id}")
                return True
                
        except Exception as e:
            print(f"Error accepting offer: {e}")
            return False
    
    def reject_offer(self, offer_id: int, user_id: int) -> bool:
        """Reject an offer"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Get offer details
                cursor.execute('SELECT owner_id, bidder_id, price, username FROM offers WHERE id = ? AND status = "pending"', (offer_id,))
                offer = cursor.fetchone()
                
                if not offer:
                    return False
                
                owner_id, bidder_id, price, username = offer
                
                # Verify user is either owner or bidder
                if owner_id != user_id and bidder_id != user_id:
                    return False
                
                # Update offer status
                cursor.execute('''
                    UPDATE offers 
                    SET status = 'rejected', rejected_at = ?, updated_at = ?
                    WHERE id = ?
                ''', (now, now, offer_id))
                
                # Move to history
                cursor.execute('''
                    INSERT INTO offers_history 
                    (offer_id, username, owner_id, bidder_id, price, status, action_by, created_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, 'rejected', ?, ?, ?)
                ''', (offer_id, username, owner_id, bidder_id, price, user_id, now, now))
                
                conn.commit()
                print(f"✅ Offer {offer_id} rejected by user {user_id}")
                return True
                
        except Exception as e:
            print(f"Error rejecting offer: {e}")
            return False
    
    def cancel_offer(self, offer_id: int, user_id: int) -> bool:
        """Cancel an offer (bidder cancels their own offer)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Get offer details
                cursor.execute('SELECT bidder_id, price, username, owner_id FROM offers WHERE id = ? AND status = "pending"', (offer_id,))
                offer = cursor.fetchone()
                
                if not offer:
                    return False
                
                bidder_id, price, username, owner_id = offer
                
                # Verify user is the bidder
                if bidder_id != user_id:
                    return False
                
                # Update offer status
                cursor.execute('''
                    UPDATE offers 
                    SET status = 'cancelled', cancelled_at = ?, updated_at = ?
                    WHERE id = ?
                ''', (now, now, offer_id))
                
                # Move to history
                cursor.execute('''
                    INSERT INTO offers_history 
                    (offer_id, username, owner_id, bidder_id, price, status, action_by, created_at, completed_at)
                    VALUES (?, ?, ?, ?, ?, 'cancelled', ?, ?, ?)
                ''', (offer_id, username, owner_id, bidder_id, price, user_id, now, now))
                
                conn.commit()
                print(f"✅ Offer {offer_id} cancelled by bidder {user_id}")
                return True
                
        except Exception as e:
            print(f"Error cancelling offer: {e}")
            return False
    
    def get_offer_history(self, user_id: int, limit: int = 50) -> List[Dict]:
        """Get offer history for a user (completed offers)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT h.*, 
                           u1.username as owner_username, u1.first_name as owner_name,
                           u2.username as bidder_username, u2.first_name as bidder_name
                    FROM offers_history h
                    LEFT JOIN users u1 ON h.owner_id = u1.user_id
                    LEFT JOIN users u2 ON h.bidder_id = u2.user_id
                    WHERE h.owner_id = ? OR h.bidder_id = ?
                    ORDER BY h.completed_at DESC
                    LIMIT ?
                ''', (user_id, user_id, limit))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting offer history: {e}")
            return []
    
    def get_offers_by_status(self, user_id: int, status: str) -> List[Dict]:
        """Get offers by status for a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT o.*, 
                           u1.username as owner_username, u1.first_name as owner_name,
                           u2.username as bidder_username, u2.first_name as bidder_name,
                           u1.photo_url as owner_photo, u2.photo_url as bidder_photo
                    FROM offers o
                    LEFT JOIN users u1 ON o.owner_id = u1.user_id
                    LEFT JOIN users u2 ON o.bidder_id = u2.user_id
                    WHERE (o.owner_id = ? OR o.bidder_id = ?) AND o.status = ?
                    ORDER BY o.created_at DESC
                ''', (user_id, user_id, status))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
                
        except Exception as e:
            print(f"Error getting offers by status: {e}")
            return []