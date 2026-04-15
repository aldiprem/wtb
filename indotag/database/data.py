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
    
    def init_database(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Tabel users
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    balance INTEGER DEFAULT 0,
                    is_admin INTEGER DEFAULT 0,
                    joined_at TEXT,
                    last_seen TEXT
                )
            ''')
            
            # Tabel usernames (yang dijual)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS usernames (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    seller_id INTEGER NOT NULL,
                    price INTEGER NOT NULL,
                    status TEXT DEFAULT 'available',
                    description TEXT,
                    created_at TEXT,
                    sold_at TEXT,
                    buyer_id INTEGER,
                    FOREIGN KEY (seller_id) REFERENCES users(user_id)
                )
            ''')
            
            # Tabel transactions
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_id TEXT UNIQUE NOT NULL,
                    username TEXT NOT NULL,
                    seller_id INTEGER NOT NULL,
                    buyer_id INTEGER NOT NULL,
                    price INTEGER NOT NULL,
                    status TEXT DEFAULT 'pending',
                    created_at TEXT,
                    completed_at TEXT,
                    payment_proof TEXT,
                    FOREIGN KEY (seller_id) REFERENCES users(user_id),
                    FOREIGN KEY (buyer_id) REFERENCES users(user_id)
                )
            ''')
            
            # Tabel pending payments
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pending_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    username TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    transaction_id TEXT NOT NULL,
                    created_at TEXT,
                    status TEXT DEFAULT 'pending',
                    FOREIGN KEY (user_id) REFERENCES users(user_id)
                )
            ''')
            
            conn.commit()
    
    def generate_transaction_id(self) -> str:
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=12))
    
    def save_user(self, user_id: int, username: str = "", first_name: str = "", last_name: str = "") -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
                existing = cursor.fetchone()
                
                if existing:
                    cursor.execute('''
                        UPDATE users SET username = ?, first_name = ?, last_name = ?, last_seen = ?
                        WHERE user_id = ?
                    ''', (username, first_name, last_name, now, user_id))
                else:
                    cursor.execute('''
                        INSERT INTO users (user_id, username, first_name, last_name, joined_at, last_seen)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (user_id, username, first_name, last_name, now, now))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving user: {e}")
            return False
    
    def get_user(self, user_id: int) -> Optional[Dict]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_id, username, first_name, last_name, balance, is_admin, joined_at, last_seen
                    FROM users WHERE user_id = ?
                ''', (user_id,))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'user_id': row[0],
                        'username': row[1],
                        'first_name': row[2],
                        'last_name': row[3],
                        'balance': row[4],
                        'is_admin': bool(row[5]),
                        'joined_at': row[6],
                        'last_seen': row[7]
                    }
                return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def add_username(self, username: str, seller_id: int, price: int, description: str = "") -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    INSERT INTO usernames (username, seller_id, price, description, created_at, status)
                    VALUES (?, ?, ?, ?, ?, 'available')
                ''', (username, seller_id, price, description, now))
                conn.commit()
                return True
        except sqlite3.IntegrityError:
            return False
        except Exception as e:
            print(f"Error adding username: {e}")
            return False
    
    def get_username(self, username: str) -> Optional[Dict]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, username, seller_id, price, status, description, created_at, sold_at, buyer_id
                    FROM usernames WHERE username = ?
                ''', (username,))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'id': row[0],
                        'username': row[1],
                        'seller_id': row[2],
                        'price': row[3],
                        'status': row[4],
                        'description': row[5],
                        'created_at': row[6],
                        'sold_at': row[7],
                        'buyer_id': row[8]
                    }
                return None
        except Exception as e:
            print(f"Error getting username: {e}")
            return None
    
    def get_my_usernames(self, seller_id: int) -> List[Dict]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, username, price, status, description, created_at
                    FROM usernames WHERE seller_id = ? ORDER BY created_at DESC
                ''', (seller_id,))
                rows = cursor.fetchall()
                
                return [{
                    'id': r[0],
                    'username': r[1],
                    'price': r[2],
                    'status': r[3],
                    'description': r[4],
                    'created_at': r[5]
                } for r in rows]
        except Exception as e:
            print(f"Error getting my usernames: {e}")
            return []
    
    def get_all_available_usernames(self, limit: int = 50, offset: int = 0) -> List[Dict]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, username, seller_id, price, description, created_at
                    FROM usernames WHERE status = 'available'
                    ORDER BY created_at DESC LIMIT ? OFFSET ?
                ''', (limit, offset))
                rows = cursor.fetchall()
                
                return [{
                    'id': r[0],
                    'username': r[1],
                    'seller_id': r[2],
                    'price': r[3],
                    'description': r[4],
                    'created_at': r[5]
                } for r in rows]
        except Exception as e:
            print(f"Error getting available usernames: {e}")
            return []
    
    def search_usernames(self, query: str) -> List[Dict]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, username, seller_id, price, description, created_at
                    FROM usernames WHERE status = 'available' AND username LIKE ?
                    ORDER BY created_at DESC LIMIT 50
                ''', (f'%{query}%',))
                rows = cursor.fetchall()
                
                return [{
                    'id': r[0],
                    'username': r[1],
                    'seller_id': r[2],
                    'price': r[3],
                    'description': r[4],
                    'created_at': r[5]
                } for r in rows]
        except Exception as e:
            print(f"Error searching usernames: {e}")
            return []
    
    def delete_username(self, username_id: int, seller_id: int) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    DELETE FROM usernames WHERE id = ? AND seller_id = ? AND status = 'available'
                ''', (username_id, seller_id))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting username: {e}")
            return False
    
    def create_transaction(self, username: str, seller_id: int, buyer_id: int, price: int) -> Optional[str]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                transaction_id = self.generate_transaction_id()
                
                cursor.execute('''
                    INSERT INTO transactions (transaction_id, username, seller_id, buyer_id, price, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'pending', ?)
                ''', (transaction_id, username, seller_id, buyer_id, price, now))
                conn.commit()
                return transaction_id
        except Exception as e:
            print(f"Error creating transaction: {e}")
            return None
    
    def get_transaction(self, transaction_id: str) -> Optional[Dict]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, transaction_id, username, seller_id, buyer_id, price, status, created_at, completed_at
                    FROM transactions WHERE transaction_id = ?
                ''', (transaction_id,))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'id': row[0],
                        'transaction_id': row[1],
                        'username': row[2],
                        'seller_id': row[3],
                        'buyer_id': row[4],
                        'price': row[5],
                        'status': row[6],
                        'created_at': row[7],
                        'completed_at': row[8]
                    }
                return None
        except Exception as e:
            print(f"Error getting transaction: {e}")
            return None
    
    def complete_transaction(self, transaction_id: str, buyer_id: int) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Update status username
                cursor.execute('''
                    UPDATE usernames 
                    SET status = 'sold', sold_at = ?, buyer_id = ?
                    WHERE username = (SELECT username FROM transactions WHERE transaction_id = ?)
                ''', (now, buyer_id, transaction_id))
                
                # Update transaction
                cursor.execute('''
                    UPDATE transactions 
                    SET status = 'completed', completed_at = ?
                    WHERE transaction_id = ? AND buyer_id = ?
                ''', (now, transaction_id, buyer_id))
                
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error completing transaction: {e}")
            return False
    
    def add_balance(self, user_id: int, amount: int) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users SET balance = balance + ? WHERE user_id = ?
                ''', (amount, user_id))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error adding balance: {e}")
            return False
    
    def deduct_balance(self, user_id: int, amount: int) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE users SET balance = balance - ? WHERE user_id = ? AND balance >= ?
                ''', (amount, user_id, amount))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deducting balance: {e}")
            return False