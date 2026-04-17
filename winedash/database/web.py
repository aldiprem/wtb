import sqlite3
import json
from datetime import datetime
from pathlib import Path
import hashlib
import secrets

class WinedashDatabase:
    def __init__(self, db_path):
        self.db_path = db_path
        self.init_database()
    
    def get_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_database(self):
        """Initialize all tables for Winedash marketplace"""
        with self.get_connection() as conn:
            # ========== USERS TABLE (Telegram Auth) ==========
            conn.execute('''
                CREATE TABLE IF NOT EXISTS wd_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    telegram_id TEXT UNIQUE NOT NULL,
                    telegram_username TEXT,
                    telegram_first_name TEXT,
                    telegram_last_name TEXT,
                    telegram_photo_url TEXT,
                    wallet_address TEXT,
                    balance_ton REAL DEFAULT 0,
                    total_deposited REAL DEFAULT 0,
                    total_withdrawn REAL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # ========== TON CONNECT MANIFEST ==========
            conn.execute('''
                CREATE TABLE IF NOT EXISTS wd_ton_manifest (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    domain TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    icon_url TEXT,
                    terms_url TEXT,
                    privacy_url TEXT,
                    manifest_json TEXT,
                    is_active BOOLEAN DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # ========== TRANSACTIONS TABLE ==========
            conn.execute('''
                CREATE TABLE IF NOT EXISTS wd_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    transaction_hash TEXT UNIQUE,
                    amount_ton REAL NOT NULL,
                    amount_nano TEXT,
                    from_address TEXT,
                    to_address TEXT,
                    memo TEXT,
                    transaction_type TEXT CHECK(transaction_type IN ('deposit', 'withdraw', 'purchase', 'refund')),
                    status TEXT DEFAULT 'pending',
                    reference TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    confirmed_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES wd_users (id)
                )
            ''')
            
            # ========== BALANCE HISTORY ==========
            conn.execute('''
                CREATE TABLE IF NOT EXISTS wd_balance_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    previous_balance REAL,
                    new_balance REAL,
                    change_amount REAL,
                    transaction_id INTEGER,
                    reason TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES wd_users (id),
                    FOREIGN KEY (transaction_id) REFERENCES wd_transactions (id)
                )
            ''')
            
            # ========== SESSIONS ==========
            conn.execute('''
                CREATE TABLE IF NOT EXISTS wd_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    session_id TEXT UNIQUE,
                    wallet_connected BOOLEAN DEFAULT 0,
                    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES wd_users (id)
                )
            ''')
            
            # ========== PAYMENT TRACKING ==========
            conn.execute('''
                CREATE TABLE IF NOT EXISTS wd_payment_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    reference TEXT UNIQUE,
                    body_base64_hash TEXT,
                    telegram_id TEXT,
                    amount REAL,
                    status TEXT DEFAULT 'pending',
                    transaction_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            
            # Insert default manifest for companel.shop
            self._insert_default_manifest(conn)
            
            print("✅ Winedash database initialized successfully")
    
    def _insert_default_manifest(self, conn):
        """Insert default TON Connect manifest for companel.shop"""
        manifest_data = {
            "url": "https://companel.shop",
            "name": "Winedash",
            "iconUrl": "https://companel.shop/images/winedash-icon.png",
            "termsOfUseUrl": "https://companel.shop/terms",
            "privacyPolicyUrl": "https://companel.shop/privacy"
        }
        
        cursor = conn.execute('''
            INSERT OR IGNORE INTO wd_ton_manifest 
            (domain, name, icon_url, terms_url, privacy_url, manifest_json, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        ''', (
            "companel.shop",
            "Winedash",
            "https://companel.shop/images/winedash-icon.png",
            "https://companel.shop/terms",
            "https://companel.shop/privacy",
            json.dumps(manifest_data)
        ))
        conn.commit()
        
        if cursor.rowcount > 0:
            print("✅ Default TON manifest inserted for companel.shop")
    
    # ==================== USER METHODS ====================
    
    def save_user(self, telegram_id, telegram_username=None, 
                  telegram_first_name=None, telegram_last_name=None,
                  telegram_photo_url=None, wallet_address=None):
        """Save or update user from Telegram data"""
        with self.get_connection() as conn:
            # Check if user exists
            existing = conn.execute('SELECT id, balance_ton FROM wd_users WHERE telegram_id = ?', (telegram_id,)).fetchone()
            
            if existing:
                # Update existing user
                conn.execute('''
                    UPDATE wd_users 
                    SET telegram_username = ?,
                        telegram_first_name = ?,
                        telegram_last_name = ?,
                        telegram_photo_url = ?,
                        wallet_address = COALESCE(?, wallet_address),
                        updated_at = CURRENT_TIMESTAMP,
                        last_active = CURRENT_TIMESTAMP
                    WHERE telegram_id = ?
                ''', (telegram_username, telegram_first_name, telegram_last_name, 
                      telegram_photo_url, wallet_address, telegram_id))
                user_id = existing['id']
                balance = existing['balance_ton']
            else:
                # Create new user
                cursor = conn.execute('''
                    INSERT INTO wd_users (
                        telegram_id, telegram_username, telegram_first_name,
                        telegram_last_name, telegram_photo_url, wallet_address,
                        balance_ton
                    ) VALUES (?, ?, ?, ?, ?, ?, 0)
                    RETURNING id
                ''', (telegram_id, telegram_username, telegram_first_name,
                      telegram_last_name, telegram_photo_url, wallet_address))
                result = cursor.fetchone()
                user_id = result[0] if result else None
                balance = 0
            
            conn.commit()
            return user_id, balance
    
    def get_user(self, telegram_id):
        """Get user by telegram ID"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM wd_users WHERE telegram_id = ?
            ''', (telegram_id,))
            return cursor.fetchone()
    
    def get_user_by_id(self, user_id):
        """Get user by database ID"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM wd_users WHERE id = ?
            ''', (user_id,))
            return cursor.fetchone()
    
    def update_wallet_address(self, telegram_id, wallet_address):
        """Update user's TON wallet address"""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE wd_users 
                SET wallet_address = ?, updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            ''', (wallet_address, telegram_id))
            conn.commit()
    
    def update_last_active(self, telegram_id):
        """Update user's last active timestamp"""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE wd_users SET last_active = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            ''', (telegram_id,))
            conn.commit()
    
    # ==================== BALANCE METHODS ====================
    
    def get_user_balance(self, telegram_id):
        """Get user's current balance"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT balance_ton FROM wd_users WHERE telegram_id = ?
            ''', (telegram_id,))
            result = cursor.fetchone()
            return float(result[0]) if result else 0.0
    
    def add_balance(self, telegram_id, amount_ton, transaction_id=None, reason="deposit"):
        """Add balance to user (for deposits)"""
        with self.get_connection() as conn:
            # Get current balance
            current = self.get_user_balance(telegram_id)
            new_balance = current + amount_ton
            
            # Update user balance
            conn.execute('''
                UPDATE wd_users 
                SET balance_ton = ?,
                    total_deposited = total_deposited + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            ''', (new_balance, amount_ton, telegram_id))
            
            # Record balance history
            user = self.get_user(telegram_id)
            if user:
                conn.execute('''
                    INSERT INTO wd_balance_history 
                    (user_id, previous_balance, new_balance, change_amount, transaction_id, reason)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (user['id'], current, new_balance, amount_ton, transaction_id, reason))
            
            conn.commit()
            return new_balance
    
    def deduct_balance(self, telegram_id, amount_ton, transaction_id=None, reason="withdraw"):
        """Deduct balance from user (for withdrawals or purchases)"""
        with self.get_connection() as conn:
            # Get current balance
            current = self.get_user_balance(telegram_id)
            
            if current < amount_ton:
                raise ValueError(f"Insufficient balance. Current: {current}, Requested: {amount_ton}")
            
            new_balance = current - amount_ton
            
            # Update user balance
            conn.execute('''
                UPDATE wd_users 
                SET balance_ton = ?,
                    total_withdrawn = total_withdrawn + ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE telegram_id = ?
            ''', (new_balance, amount_ton, telegram_id))
            
            # Record balance history
            user = self.get_user(telegram_id)
            if user:
                conn.execute('''
                    INSERT INTO wd_balance_history 
                    (user_id, previous_balance, new_balance, change_amount, transaction_id, reason)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (user['id'], current, new_balance, -amount_ton, transaction_id, reason))
            
            conn.commit()
            return new_balance
    
    # ==================== TRANSACTION METHODS ====================
    
    def save_transaction(self, user_id, transaction_hash, amount_ton, from_address, 
                         to_address, memo="", transaction_type="deposit", reference=None):
        """Save transaction record"""
        with self.get_connection() as conn:
            # Convert TON to nano
            amount_nano = str(int(amount_ton * 1_000_000_000))
            
            cursor = conn.execute('''
                INSERT INTO wd_transactions (
                    user_id, transaction_hash, amount_ton, amount_nano, 
                    from_address, to_address, memo, transaction_type, 
                    status, reference, confirmed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(transaction_hash) DO UPDATE SET
                    status = 'confirmed',
                    confirmed_at = CURRENT_TIMESTAMP
                RETURNING id
            ''', (
                user_id, transaction_hash, amount_ton, amount_nano,
                from_address, to_address, memo, transaction_type,
                'confirmed', reference
            ))
            result = cursor.fetchone()
            tx_id = result[0] if result else None
            
            conn.commit()
            return tx_id
    
    def get_user_transactions(self, telegram_id, limit=50, offset=0):
        """Get user transactions with pagination"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT t.* FROM wd_transactions t
                JOIN wd_users u ON t.user_id = u.id
                WHERE u.telegram_id = ?
                ORDER BY t.created_at DESC
                LIMIT ? OFFSET ?
            ''', (telegram_id, limit, offset))
            return [dict(row) for row in cursor.fetchall()]
    
    def get_transaction_by_reference(self, reference):
        """Get transaction by reference"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT * FROM wd_transactions WHERE reference = ?
            ''', (reference,))
            return cursor.fetchone()
    
    # ==================== TON MANIFEST METHODS ====================
    
    def get_ton_manifest(self, domain):
        """Get TON Connect manifest for domain"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT manifest_json, name, icon_url, terms_url, privacy_url
                FROM wd_ton_manifest 
                WHERE domain = ? AND is_active = 1
            ''', (domain,))
            result = cursor.fetchone()
            
            if result:
                return json.loads(result['manifest_json'])
            return None
    
    def save_ton_manifest(self, domain, name, icon_url, terms_url, privacy_url):
        """Save or update TON Connect manifest"""
        manifest_data = {
            "url": f"https://{domain}",
            "name": name,
            "iconUrl": icon_url,
            "termsOfUseUrl": terms_url,
            "privacyPolicyUrl": privacy_url
        }
        
        with self.get_connection() as conn:
            conn.execute('''
                INSERT OR REPLACE INTO wd_ton_manifest 
                (domain, name, icon_url, terms_url, privacy_url, manifest_json, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ''', (domain, name, icon_url, terms_url, privacy_url, json.dumps(manifest_data)))
            conn.commit()
            return manifest_data
    
    # ==================== PAYMENT TRACKING ====================
    
    def save_payment_tracking(self, reference, body_base64_hash, telegram_id, amount):
        """Save payment tracking data"""
        with self.get_connection() as conn:
            conn.execute('''
                INSERT OR IGNORE INTO wd_payment_tracking 
                (reference, body_base64_hash, telegram_id, amount, status)
                VALUES (?, ?, ?, ?, ?)
            ''', (reference, body_base64_hash, telegram_id, amount, 'pending'))
            conn.commit()
    
    def update_payment_tracking(self, reference, status='completed', transaction_hash=None):
        """Update payment tracking status"""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE wd_payment_tracking 
                SET status = ?, transaction_hash = ?
                WHERE reference = ?
            ''', (status, transaction_hash, reference))
            conn.commit()
    
    # ==================== SESSION METHODS ====================
    
    def create_session(self, user_id, session_id):
        """Create new session"""
        with self.get_connection() as conn:
            conn.execute('''
                INSERT INTO wd_sessions (user_id, session_id)
                VALUES (?, ?)
            ''', (user_id, session_id))
            conn.commit()
    
    def update_session_wallet(self, session_id, wallet_connected):
        """Update session wallet status"""
        with self.get_connection() as conn:
            conn.execute('''
                UPDATE wd_sessions 
                SET wallet_connected = ?, last_active = CURRENT_TIMESTAMP
                WHERE session_id = ?
            ''', (wallet_connected, session_id))
            conn.commit()
    
    # ==================== STATISTICS ====================
    
    def get_user_stats(self, telegram_id):
        """Get user statistics"""
        with self.get_connection() as conn:
            cursor = conn.execute('''
                SELECT 
                    balance_ton,
                    total_deposited,
                    total_withdrawn,
                    (SELECT COUNT(*) FROM wd_transactions t 
                     WHERE t.user_id = u.id AND t.transaction_type = 'deposit') as deposit_count,
                    (SELECT COUNT(*) FROM wd_transactions t 
                     WHERE t.user_id = u.id AND t.transaction_type = 'withdraw') as withdraw_count,
                    julianday('now') - julianday(created_at) as days_member
                FROM wd_users u
                WHERE u.telegram_id = ?
            ''', (telegram_id,))
            return dict(cursor.fetchone()) if cursor.fetchone() else None