import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
import pytz
import random
import string

class IndotagDatabase:
    def __init__(self, db_path: str = "/root/wtb/indotag/database/indotag.db"):
        self.db_path = db_path
        self.timezone = pytz.timezone('Asia/Jakarta')
        self.init_database()
    
    def _get_now(self) -> str:
        return datetime.now(self.timezone).isoformat()
    
    def _get_now_datetime(self) -> datetime:
        return datetime.now(self.timezone)

    def init_database(self):
        """Initialize database tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Tabel users
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    photo_url TEXT,
                    balance INTEGER DEFAULT 0,
                    is_admin BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP,
                    last_seen TIMESTAMP
                )
            ''')
            
            # Tabel username listings (marketplace)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS username_listings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    listing_id TEXT UNIQUE NOT NULL,
                    seller_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    price INTEGER NOT NULL,
                    description TEXT,
                    is_premium BOOLEAN DEFAULT 0,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    views INTEGER DEFAULT 0,
                    likes INTEGER DEFAULT 0,
                    FOREIGN KEY (seller_id) REFERENCES users(user_id)
                )
            ''')
            
            # Tabel transactions
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_id TEXT UNIQUE NOT NULL,
                    listing_id TEXT NOT NULL,
                    buyer_id INTEGER NOT NULL,
                    seller_id INTEGER NOT NULL,
                    amount INTEGER NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    FOREIGN KEY (listing_id) REFERENCES username_listings(listing_id),
                    FOREIGN KEY (buyer_id) REFERENCES users(user_id),
                    FOREIGN KEY (seller_id) REFERENCES users(user_id)
                )
            ''')
            
            # Tabel user activities
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    activity_type TEXT NOT NULL,
                    description TEXT,
                    reference_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(user_id)
                )
            ''')
            
            # Tabel user storage (purchased usernames)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_storage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    listing_id TEXT NOT NULL,
                    username TEXT NOT NULL,
                    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    is_used BOOLEAN DEFAULT 0,
                    FOREIGN KEY (user_id) REFERENCES users(user_id),
                    FOREIGN KEY (listing_id) REFERENCES username_listings(listing_id)
                )
            ''')
            
            conn.commit()
            print("✅ Indotag database initialized")
    
    # ==================== USER METHODS ====================
    
    def save_user(self, user_id: int, username: str = "", first_name: str = "", 
                  last_name: str = "", photo_url: str = "") -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
                existing = cursor.fetchone()
                now = self._get_now()
                
                if existing:
                    cursor.execute('''
                        UPDATE users SET username = ?, first_name = ?, last_name = ?, 
                        photo_url = ?, last_seen = ? WHERE user_id = ?
                    ''', (username, first_name, last_name, photo_url, now, user_id))
                else:
                    cursor.execute('''
                        INSERT INTO users (user_id, username, first_name, last_name, 
                        photo_url, created_at, last_seen)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (user_id, username, first_name, last_name, photo_url, now, now))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving user: {e}")
            return False
    
    def get_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_id, username, first_name, last_name, photo_url, 
                    balance, is_admin, created_at, last_seen
                    FROM users WHERE user_id = ?
                ''', (user_id,))
                row = cursor.fetchone()
                if row:
                    return {
                        'user_id': row[0], 'username': row[1], 'first_name': row[2],
                        'last_name': row[3], 'photo_url': row[4], 'balance': row[5],
                        'is_admin': bool(row[6]), 'created_at': row[7], 'last_seen': row[8]
                    }
                return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def get_user_balance(self, user_id: int) -> int:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
                row = cursor.fetchone()
                return row[0] if row else 0
        except Exception as e:
            print(f"Error getting balance: {e}")
            return 0
    
    def update_balance(self, user_id: int, amount: int, operation: str = 'add') -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                current = self.get_user_balance(user_id)
                new_balance = current + amount if operation == 'add' else current - amount
                if new_balance < 0:
                    return False
                cursor.execute('UPDATE users SET balance = ? WHERE user_id = ?', (new_balance, user_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error updating balance: {e}")
            return False
    
    # ==================== LISTING METHODS ====================
    
    def generate_listing_id(self) -> str:
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
    
    def create_listing(self, seller_id: int, username: str, price: int, 
                       category: str = 'general', description: str = '') -> Optional[str]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                listing_id = self.generate_listing_id()
                cursor.execute('''
                    INSERT INTO username_listings 
                    (listing_id, seller_id, username, category, price, description)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (listing_id, seller_id, username, category, price, description))
                conn.commit()
                return listing_id
        except Exception as e:
            print(f"Error creating listing: {e}")
            return None
    
    def get_listings(self, category: str = None, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                if category and category != 'all':
                    cursor.execute('''
                        SELECT l.*, u.username as seller_username, u.first_name as seller_first_name,
                               u.photo_url as seller_photo_url
                        FROM username_listings l
                        JOIN users u ON l.seller_id = u.user_id
                        WHERE l.status = 'active' AND l.category = ?
                        ORDER BY l.is_premium DESC, l.created_at DESC
                        LIMIT ? OFFSET ?
                    ''', (category, limit, offset))
                else:
                    cursor.execute('''
                        SELECT l.*, u.username as seller_username, u.first_name as seller_first_name,
                               u.photo_url as seller_photo_url
                        FROM username_listings l
                        JOIN users u ON l.seller_id = u.user_id
                        WHERE l.status = 'active'
                        ORDER BY l.is_premium DESC, l.created_at DESC
                        LIMIT ? OFFSET ?
                    ''', (limit, offset))
                
                rows = cursor.fetchall()
                columns = [description[0] for description in cursor.description]
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            print(f"Error getting listings: {e}")
            return []
    
    def get_listing_by_id(self, listing_id: str) -> Optional[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT l.*, u.username as seller_username, u.first_name as seller_first_name,
                           u.photo_url as seller_photo_url
                    FROM username_listings l
                    JOIN users u ON l.seller_id = u.user_id
                    WHERE l.listing_id = ?
                ''', (listing_id,))
                row = cursor.fetchone()
                if row:
                    columns = [description[0] for description in cursor.description]
                    return dict(zip(columns, row))
                return None
        except Exception as e:
            print(f"Error getting listing: {e}")
            return None
    
    def increment_listing_views(self, listing_id: str) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('UPDATE username_listings SET views = views + 1 WHERE listing_id = ?', (listing_id,))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error incrementing views: {e}")
            return False
    
    # ==================== STORAGE METHODS ====================
    
    def add_to_storage(self, user_id: int, listing_id: str, username: str) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO user_storage (user_id, listing_id, username)
                    VALUES (?, ?, ?)
                ''', (user_id, listing_id, username))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding to storage: {e}")
            return False
    
    def get_user_storage(self, user_id: int) -> List[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM user_storage WHERE user_id = ? ORDER BY purchased_at DESC
                ''', (user_id,))
                rows = cursor.fetchall()
                columns = [description[0] for description in cursor.description]
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            print(f"Error getting storage: {e}")
            return []
    
    # ==================== ACTIVITY METHODS ====================
    
    def add_activity(self, user_id: int, activity_type: str, description: str, reference_id: str = '') -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO user_activities (user_id, activity_type, description, reference_id)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, activity_type, description, reference_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding activity: {e}")
            return False
    
    def get_user_activities(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM user_activities WHERE user_id = ? 
                    ORDER BY created_at DESC LIMIT ?
                ''', (user_id, limit))
                rows = cursor.fetchall()
                columns = [description[0] for description in cursor.description]
                return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            print(f"Error getting activities: {e}")
            return []
    
    # ==================== STATS METHODS ====================
    
    def get_user_stats(self, user_id: int) -> Dict[str, Any]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Total listings created
                cursor.execute('SELECT COUNT(*) FROM username_listings WHERE seller_id = ?', (user_id,))
                total_listings = cursor.fetchone()[0] or 0
                
                # Total purchases (from transactions as buyer)
                cursor.execute('SELECT COUNT(*) FROM transactions WHERE buyer_id = ? AND status = "completed"', (user_id,))
                total_purchases = cursor.fetchone()[0] or 0
                
                # Total storage items
                cursor.execute('SELECT COUNT(*) FROM user_storage WHERE user_id = ?', (user_id,))
                total_storage = cursor.fetchone()[0] or 0
                
                return {
                    'total_listings': total_listings,
                    'total_purchases': total_purchases,
                    'total_storage': total_storage
                }
        except Exception as e:
            print(f"Error getting user stats: {e}")
            return {'total_listings': 0, 'total_purchases': 0, 'total_storage': 0}
    
    def get_market_stats(self) -> Dict[str, Any]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('SELECT COUNT(*) FROM username_listings WHERE status = "active"')
                total_listings = cursor.fetchone()[0] or 0
                
                cursor.execute('SELECT COUNT(*) FROM transactions WHERE status = "completed"')
                total_transactions = cursor.fetchone()[0] or 0
                
                cursor.execute('SELECT SUM(amount) FROM transactions WHERE status = "completed"')
                total_volume = cursor.fetchone()[0] or 0
                
                return {
                    'total_listings': total_listings,
                    'total_transactions': total_transactions,
                    'total_volume': total_volume
                }
        except Exception as e:
            print(f"Error getting market stats: {e}")
            return {'total_listings': 0, 'total_transactions': 0, 'total_volume': 0}