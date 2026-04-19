import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import pytz
import string
import os

class WinedashDatabase:
    def __init__(self, db_path: str = "/root/wtb/winedash/database/winedash.db"):
        self.db_path = db_path
        self.timezone = pytz.timezone('Asia/Jakarta')
        self.init_database()
    
    def _get_now(self) -> str:
        """Get current time in Asia/Jakarta timezone as ISO format string"""
        return datetime.now(self.timezone).isoformat()
    
    def _get_now_datetime(self) -> datetime:
        """Get current datetime in Asia/Jakarta timezone"""
        return datetime.now(self.timezone)

    def init_database(self):
        """Initialize database tables"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            # ============ USERS TABLE (Telegram Auth) ============
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    photo_url TEXT,
                    wallet_address TEXT,
                    balance DECIMAL(20, 8) DEFAULT 0,
                    total_deposit DECIMAL(20, 8) DEFAULT 0,
                    total_withdraw DECIMAL(20, 8) DEFAULT 0,
                    is_admin BOOLEAN DEFAULT 0,
                    first_seen TIMESTAMP,
                    last_seen TIMESTAMP
                )
            ''')

            # ============ TONCONNECT MANIFEST TABLE ============
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ton_manifest (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT UNIQUE NOT NULL,
                    name TEXT,
                    icon_url TEXT,
                    terms_of_use_url TEXT,
                    privacy_policy_url TEXT,
                    manifest_json TEXT,
                    updated_at TIMESTAMP
                )
            ''')

            # ============ DEPOSITS TABLE ============
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS deposits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    amount DECIMAL(20, 8) NOT NULL,
                    wallet_address TEXT,
                    transaction_id TEXT UNIQUE,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(user_id)
                )
            ''')

            # ============ WITHDRAWALS TABLE ============
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS withdrawals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    amount DECIMAL(20, 8) NOT NULL,
                    wallet_address TEXT NOT NULL,
                    transaction_id TEXT UNIQUE,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(user_id)
                )
            ''')

            # ============ USERNAMES MARKETPLACE TABLE ============
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS usernames (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    category TEXT,
                    based_on TEXT,  -- BARU: nama asli username
                    price DECIMAL(20, 8) NOT NULL,
                    seller_id INTEGER,
                    seller_wallet TEXT,
                    photo_url TEXT,
                    status TEXT DEFAULT 'available',
                    created_at TIMESTAMP,
                    sold_at TIMESTAMP,
                    buyer_id INTEGER,
                    transaction_id TEXT,
                    FOREIGN KEY (seller_id) REFERENCES users(user_id),
                    FOREIGN KEY (buyer_id) REFERENCES users(user_id)
                )
            ''')

            # ============ TRANSACTIONS TABLE ============
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    transaction_id TEXT UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL,
                    type TEXT NOT NULL,
                    amount DECIMAL(20, 8) NOT NULL,
                    status TEXT DEFAULT 'pending',
                    details TEXT,
                    created_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(user_id)
                )
            ''')

            # ============ PENDING USERNAMES TABLE ============
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pending_usernames (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    category TEXT,
                    based_on TEXT,
                    price DECIMAL(20, 8) NOT NULL,
                    seller_id INTEGER NOT NULL,
                    seller_wallet TEXT,
                    verification_type TEXT DEFAULT 'channel',
                    verification_code TEXT,
                    status TEXT DEFAULT 'pending',
                    target_chat_id TEXT,
                    target_chat_title TEXT,
                    photo_url TEXT,
                    created_at TIMESTAMP,
                    expires_at TIMESTAMP,
                    confirmed_at TIMESTAMP
                )
            ''')
            
            conn.commit()
            print("✅ Winedash Database initialized successfully")

    def migrate_add_based_on_column(self):
        """Add based_on column to existing tables if not exists"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Cek dan tambah kolom based_on ke usernames
                cursor.execute("PRAGMA table_info(usernames)")
                columns = [col[1] for col in cursor.fetchall()]
                if 'based_on' not in columns:
                    cursor.execute('ALTER TABLE usernames ADD COLUMN based_on TEXT')
                    print("✅ Added based_on column to usernames")
                
                # Cek dan tambah kolom based_on ke pending_usernames
                cursor.execute("PRAGMA table_info(pending_usernames)")
                columns = [col[1] for col in cursor.fetchall()]
                if 'based_on' not in columns:
                    cursor.execute('ALTER TABLE pending_usernames ADD COLUMN based_on TEXT')
                    print("✅ Added based_on column to pending_usernames")
                
                conn.commit()
        except Exception as e:
            print(f"Error migrating based_on column: {e}")

    # ==================== USER MANAGEMENT ====================
    
    def save_user(self, user_id: int, username: str = "", first_name: str = "", 
                  last_name: str = "", photo_url: str = "", wallet_address: str = "") -> bool:
        """Save or update user information"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
                existing = cursor.fetchone()
                
                now = self._get_now()
                
                if existing:
                    cursor.execute('''
                        UPDATE users 
                        SET username = ?, first_name = ?, last_name = ?, 
                            photo_url = ?, wallet_address = ?, last_seen = ?
                        WHERE user_id = ?
                    ''', (username, first_name, last_name, photo_url, wallet_address, now, user_id))
                else:
                    cursor.execute('''
                        INSERT INTO users (user_id, username, first_name, last_name, photo_url, wallet_address, first_seen, last_seen)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (user_id, username, first_name, last_name, photo_url, wallet_address, now, now))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving user: {e}")
            return False

    def get_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user information by user_id"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_id, username, first_name, last_name, photo_url, 
                        wallet_address, balance, total_deposit, total_withdraw, is_admin, first_seen, last_seen
                    FROM users WHERE user_id = ?
                ''', (user_id,))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'user_id': int(row['user_id']),
                        'username': str(row['username']) if row['username'] else '',
                        'first_name': str(row['first_name']) if row['first_name'] else '',
                        'last_name': str(row['last_name']) if row['last_name'] else '',
                        'photo_url': str(row['photo_url']) if row['photo_url'] else '',
                        'wallet_address': str(row['wallet_address']) if row['wallet_address'] else '',
                        'balance': float(row['balance']) if row['balance'] else 0.0,
                        'total_deposit': float(row['total_deposit']) if row['total_deposit'] else 0.0,
                        'total_withdraw': float(row['total_withdraw']) if row['total_withdraw'] else 0.0,
                        'is_admin': bool(row['is_admin']),
                        'first_seen': str(row['first_seen']) if row['first_seen'] else None,
                        'last_seen': str(row['last_seen']) if row['last_seen'] else None
                    }
                return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None

    def update_user_balance(self, user_id: int, amount: float, is_deposit: bool = True) -> bool:
        """Update user balance"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                if is_deposit:
                    cursor.execute('''
                        UPDATE users 
                        SET balance = balance + ?, total_deposit = total_deposit + ?
                        WHERE user_id = ?
                    ''', (amount, amount, user_id))
                else:
                    cursor.execute('''
                        UPDATE users 
                        SET balance = balance - ?, total_withdraw = total_withdraw + ?
                        WHERE user_id = ? AND balance >= ?
                    ''', (amount, amount, user_id, amount))
                
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating user balance: {e}")
            return False

    # ==================== TON MANIFEST ====================
    
    def save_ton_manifest(self, domain: str, name: str, icon_url: str, 
                          terms_url: str, privacy_url: str, manifest_json: str) -> bool:
        """Save or update TON Connect manifest"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    INSERT OR REPLACE INTO ton_manifest 
                    (domain, name, icon_url, terms_of_use_url, privacy_policy_url, manifest_json, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (domain, name, icon_url, terms_url, privacy_url, manifest_json, now))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving TON manifest: {e}")
            return False

    def get_ton_manifest(self, domain: str) -> Optional[Dict[str, Any]]:
        """Get TON Connect manifest by domain"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT domain, name, icon_url, terms_of_use_url, privacy_policy_url, manifest_json, updated_at
                    FROM ton_manifest WHERE domain = ?
                ''', (domain,))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'domain': row[0],
                        'name': row[1],
                        'icon_url': row[2],
                        'terms_of_use_url': row[3],
                        'privacy_policy_url': row[4],
                        'manifest_json': json.loads(row[5]) if row[5] else {},
                        'updated_at': row[6]
                    }
                return None
        except Exception as e:
            print(f"Error getting TON manifest: {e}")
            return None

    # ==================== DEPOSITS ====================
    
    def create_deposit(self, user_id: int, amount: float, wallet_address: str, 
                       transaction_id: str) -> Optional[int]:
        """Create a new deposit record"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    INSERT INTO deposits (user_id, amount, wallet_address, transaction_id, status, created_at)
                    VALUES (?, ?, ?, ?, 'pending', ?)
                ''', (user_id, amount, wallet_address, transaction_id, now))
                
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            print(f"Error creating deposit: {e}")
            return None

    def confirm_deposit(self, transaction_id: str) -> bool:
        """Confirm a deposit and add balance to user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    SELECT id, user_id, amount FROM deposits 
                    WHERE transaction_id = ? AND status = 'pending'
                ''', (transaction_id,))
                deposit = cursor.fetchone()
                
                if not deposit:
                    return False
                
                deposit_id, user_id, amount = deposit
                
                # Update deposit status
                cursor.execute('''
                    UPDATE deposits SET status = 'completed', completed_at = ?
                    WHERE id = ?
                ''', (now, deposit_id))
                
                # Update user balance
                cursor.execute('''
                    UPDATE users SET balance = balance + ?, total_deposit = total_deposit + ?
                    WHERE user_id = ?
                ''', (amount, amount, user_id))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error confirming deposit: {e}")
            return False

    def get_user_deposits(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get user deposit history"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, amount, wallet_address, transaction_id, status, created_at, completed_at
                    FROM deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
                ''', (user_id, limit))
                rows = cursor.fetchall()
                
                deposits = []
                for row in rows:
                    deposits.append({
                        'id': row[0],
                        'amount': float(row[1]),
                        'wallet_address': row[2],
                        'transaction_id': row[3],
                        'status': row[4],
                        'created_at': row[5],
                        'completed_at': row[6]
                    })
                return deposits
        except Exception as e:
            print(f"Error getting user deposits: {e}")
            return []

    # ==================== WITHDRAWALS ====================
    
    def create_withdrawal(self, user_id: int, amount: float, wallet_address: str) -> Optional[int]:
        """Create a new withdrawal request"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Check balance first
                cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
                row = cursor.fetchone()
                if not row or float(row[0]) < amount:
                    return None
                
                cursor.execute('''
                    INSERT INTO withdrawals (user_id, amount, wallet_address, status, created_at)
                    VALUES (?, ?, ?, 'pending', ?)
                ''', (user_id, amount, wallet_address, now))
                
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            print(f"Error creating withdrawal: {e}")
            return None

    def confirm_withdrawal(self, withdrawal_id: int, transaction_id: str) -> bool:
        """Confirm a withdrawal and deduct balance"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    SELECT id, user_id, amount FROM withdrawals 
                    WHERE id = ? AND status = 'pending'
                ''', (withdrawal_id,))
                withdrawal = cursor.fetchone()
                
                if not withdrawal:
                    return False
                
                withdraw_id, user_id, amount = withdrawal
                
                # Update withdrawal status
                cursor.execute('''
                    UPDATE withdrawals SET status = 'completed', transaction_id = ?, completed_at = ?
                    WHERE id = ?
                ''', (transaction_id, now, withdraw_id))
                
                # Deduct user balance
                cursor.execute('''
                    UPDATE users SET balance = balance - ?, total_withdraw = total_withdraw + ?
                    WHERE user_id = ? AND balance >= ?
                ''', (amount, amount, user_id, amount))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error confirming withdrawal: {e}")
            return False

    def get_user_withdrawals(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get user withdrawal history"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, amount, wallet_address, transaction_id, status, created_at, completed_at
                    FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
                ''', (user_id, limit))
                rows = cursor.fetchall()
                
                withdrawals = []
                for row in rows:
                    withdrawals.append({
                        'id': row[0],
                        'amount': float(row[1]),
                        'wallet_address': row[2],
                        'transaction_id': row[3],
                        'status': row[4],
                        'created_at': row[5],
                        'completed_at': row[6]
                    })
                return withdrawals
        except Exception as e:
            print(f"Error getting user withdrawals: {e}")
            return []

    # ==================== USERNAMES MARKETPLACE ====================
    
    def add_username(self, username: str, price: float, seller_id: int, 
                     seller_wallet: str, category: str = "default") -> Optional[int]:
        """Add a username to marketplace"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    INSERT INTO usernames (username, category, price, seller_id, seller_wallet, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'available', ?)
                ''', (username, category, price, seller_id, seller_wallet, now))
                
                conn.commit()
                return cursor.lastrowid
        except Exception as e:
            print(f"Error adding username: {e}")
            return None

    def buy_username(self, username_id: int, buyer_id: int, transaction_id: str) -> bool:
        """Buy a username from marketplace"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    SELECT id, price, seller_id FROM usernames 
                    WHERE id = ? AND status = 'available'
                ''', (username_id,))
                username = cursor.fetchone()
                
                if not username:
                    return False
                
                username_id, price, seller_id = username
                
                # Check buyer balance
                cursor.execute('SELECT balance FROM users WHERE user_id = ?', (buyer_id,))
                row = cursor.fetchone()
                if not row or float(row[0]) < price:
                    return False
                
                # Deduct buyer balance
                cursor.execute('UPDATE users SET balance = balance - ? WHERE user_id = ?', (price, buyer_id))
                
                # Add balance to seller
                if seller_id:
                    cursor.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', (price, seller_id))
                
                # Update username status
                cursor.execute('''
                    UPDATE usernames 
                    SET status = 'sold', buyer_id = ?, transaction_id = ?, sold_at = ?
                    WHERE id = ?
                ''', (buyer_id, transaction_id, now, username_id))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error buying username: {e}")
            return False

    def get_available_usernames(self, category: str = None, limit: int = 50) -> List[Dict[str, Any]]:
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Include based_on in SELECT
                if category:
                    cursor.execute('''
                        SELECT id, username, based_on, price, seller_id, seller_wallet, status, created_at
                        FROM usernames 
                        WHERE category = ?
                        ORDER BY created_at DESC
                        LIMIT ?
                    ''', (category, limit))
                else:
                    cursor.execute('''
                        SELECT id, username, based_on, price, seller_id, seller_wallet, status, created_at
                        FROM usernames 
                        ORDER BY created_at DESC
                        LIMIT ?
                    ''', (limit,))
                
                rows = cursor.fetchall()
                usernames = []
                for row in rows:
                    usernames.append({
                        'id': int(row['id']),
                        'username': str(row['username']) if row['username'] else '',
                        'based_on': str(row['based_on']) if row['based_on'] else '',
                        'price': float(row['price']) if row['price'] else 0.0,
                        'seller_id': int(row['seller_id']) if row['seller_id'] else None,
                        'seller_wallet': str(row['seller_wallet']) if row['seller_wallet'] else '',
                        'status': str(row['status']) if row['status'] else 'available',
                        'created_at': str(row['created_at']) if row['created_at'] else None
                    })
                return usernames
        except Exception as e:
            print(f"Error getting usernames: {e}")
            return []

    def get_user_purchases(self, user_id: int) -> List[Dict[str, Any]]:
        """Get usernames purchased by user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, username, category, price, seller_id, seller_wallet, created_at, sold_at, transaction_id
                    FROM usernames WHERE buyer_id = ? AND status = 'sold'
                    ORDER BY sold_at DESC
                ''', (user_id,))
                rows = cursor.fetchall()
                
                purchases = []
                for row in rows:
                    purchases.append({
                        'id': row[0],
                        'username': row[1],
                        'category': row[2],
                        'price': float(row[3]),
                        'seller_id': row[4],
                        'seller_wallet': row[5],
                        'created_at': row[6],
                        'sold_at': row[7],
                        'transaction_id': row[8]
                    })
                return purchases
        except Exception as e:
            print(f"Error getting user purchases: {e}")
            return []

    # ==================== TRANSACTIONS ====================
    
    def create_transaction(self, transaction_id: str, user_id: int, 
                           tx_type: str, amount: float, details: str = "") -> bool:
        """Create a transaction record"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    INSERT INTO transactions (transaction_id, user_id, type, amount, status, details, created_at)
                    VALUES (?, ?, ?, ?, 'pending', ?, ?)
                ''', (transaction_id, user_id, tx_type, amount, details, now))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error creating transaction: {e}")
            return False

    def update_transaction_status(self, transaction_id: str, status: str) -> bool:
        """Update transaction status"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    UPDATE transactions 
                    SET status = ?, completed_at = ?
                    WHERE transaction_id = ?
                ''', (status, now, transaction_id))
                
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating transaction: {e}")
            return False

    def get_user_transactions(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get user transaction history"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT transaction_id, type, amount, status, details, created_at, completed_at
                    FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
                ''', (user_id, limit))
                rows = cursor.fetchall()
                
                transactions = []
                for row in rows:
                    transactions.append({
                        'transaction_id': row[0],
                        'type': row[1],
                        'amount': float(row[2]),
                        'status': row[3],
                        'details': row[4],
                        'created_at': row[5],
                        'completed_at': row[6]
                    })
                return transactions
        except Exception as e:
            print(f"Error getting user transactions: {e}")
            return []

    def add_pending_username(self, username: str, price: float, seller_id: int, 
                            seller_wallet: str, based_on: str = "", 
                            verification_type: str = "channel") -> Optional[int]:
        """Add a username to pending verification"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Clean username
                username_clean = username.lstrip('@').strip()
                
                if not username_clean:
                    print(f"[DB] Invalid username: {username}")
                    return None
                
                # Cek apakah username sudah ada di usernames
                cursor.execute('SELECT id FROM usernames WHERE username = ?', (username_clean,))
                if cursor.fetchone():
                    print(f"[DB] Username {username_clean} already exists in usernames")
                    return None
                
                # Cek apakah username sudah ada di pending
                cursor.execute('SELECT id FROM pending_usernames WHERE username = ? AND status = "pending"', (username_clean,))
                if cursor.fetchone():
                    print(f"[DB] Username {username_clean} already in pending queue")
                    return None
                
                # Insert new pending with based_on
                cursor.execute('''
                    INSERT INTO pending_usernames 
                    (username, based_on, price, seller_id, seller_wallet, verification_type, 
                    verification_code, status, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                ''', (username_clean, based_on, price, seller_id, seller_wallet, 
                    verification_type, None, now, None))
                
                pending_id = cursor.lastrowid
                conn.commit()
                print(f"[DB] Pending username added with ID: {pending_id}, based_on: {based_on}")
                return pending_id
                
        except sqlite3.IntegrityError as e:
            print(f"[DB] IntegrityError adding pending username: {e}")
            return None
        except Exception as e:
            print(f"[DB] Error adding pending username: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_pending_usernames(self, user_id: int = None) -> List[Dict[str, Any]]:
        """Get pending usernames for a user (or all if user_id is None)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Cek kolom yang tersedia di tabel
                cursor.execute("PRAGMA table_info(pending_usernames)")
                columns = [col[1] for col in cursor.fetchall()]
                
                # Tentukan kolom yang akan diambil
                select_cols = ['id', 'username', 'category', 'price', 'seller_id', 'seller_wallet',
                            'verification_type', 'verification_code', 'status', 'created_at']
                
                # Tambahkan expires_at jika ada
                if 'expires_at' in columns:
                    select_cols.append('expires_at')
                
                select_str = ', '.join(select_cols)
                
                if user_id:
                    cursor.execute(f'''
                        SELECT {select_str}
                        FROM pending_usernames 
                        WHERE seller_id = ? AND status = 'pending'
                        ORDER BY created_at DESC
                    ''', (user_id,))
                else:
                    cursor.execute(f'''
                        SELECT {select_str}
                        FROM pending_usernames 
                        WHERE status = 'pending'
                        ORDER BY created_at DESC
                    ''')
                
                rows = cursor.fetchall()
                results = []
                for row in rows:
                    result = {
                        'id': int(row['id']),
                        'username': str(row['username']) if row['username'] else '',
                        'category': str(row['category']) if row['category'] else 'default',
                        'price': float(row['price']) if row['price'] else 0.0,
                        'seller_id': int(row['seller_id']) if row['seller_id'] else None,
                        'seller_wallet': str(row['seller_wallet']) if row['seller_wallet'] else '',
                        'verification_type': str(row['verification_type']) if row['verification_type'] else 'auto',
                        'verification_code': str(row['verification_code']) if row['verification_code'] else None,
                        'status': str(row['status']) if row['status'] else 'pending',
                        'created_at': str(row['created_at']) if row['created_at'] else None
                    }
                    # Tambahkan expires_at jika ada
                    if 'expires_at' in columns and 'expires_at' in row.keys():
                        result['expires_at'] = str(row['expires_at']) if row['expires_at'] else None
                    else:
                        result['expires_at'] = None
                    
                    results.append(result)
                return results
        except Exception as e:
            print(f"Error getting pending usernames: {e}")
            import traceback
            traceback.print_exc()
            return []

    def confirm_pending_username(self, pending_id: int, code: str = None) -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                # Get pending record including based_on
                cursor.execute('''
                    SELECT username, based_on, price, seller_id, seller_wallet, verification_type, verification_code
                    FROM pending_usernames WHERE id = ? AND status = 'pending'
                ''', (pending_id,))
                row = cursor.fetchone()
                
                if not row:
                    return False
                
                username, based_on, price, seller_id, seller_wallet, v_type, v_code = row
                
                # Move to usernames table with based_on
                cursor.execute('''
                    INSERT INTO usernames (username, based_on, price, seller_id, seller_wallet, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'available', ?)
                ''', (username, based_on or '', price, seller_id, seller_wallet, now))
                
                # Delete pending record
                cursor.execute('DELETE FROM pending_usernames WHERE id = ?', (pending_id,))
                conn.commit()
                return True
                
        except Exception as e:
            print(f"Error confirming pending username: {e}")
            return False

    def reject_pending_username(self, pending_id: int) -> bool:
        """Reject pending username - hapus record agar bisa ditambahkan ulang nanti"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                # Hapus record, jangan hanya update status
                cursor.execute('DELETE FROM pending_usernames WHERE id = ?', (pending_id,))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error rejecting pending username: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_user_pending_count(self, user_id: int) -> int:
        """Get count of pending usernames for a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT COUNT(*) FROM pending_usernames 
                    WHERE seller_id = ? AND status = 'pending'
                ''', (user_id,))
                row = cursor.fetchone()
                return row[0] if row else 0
        except Exception as e:
            print(f"Error getting pending count: {e}")
            import traceback
            traceback.print_exc()
            return 0