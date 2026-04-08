# database/data.py - Database Functions for MASTER BOT ONLY
# This database stores: users, balances, finances, and cloned bots data
# Bot clones use their own separate database (data_clone.py)

import sqlite3
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import pytz
import os
from pathlib import Path
import json
import hashlib
import secrets
import re

logger = logging.getLogger(__name__)

# Database path for MASTER BOT
DB_PATH = str(Path(__file__).parent.parent / "frag_master.db")

JAKARTA_TZ = pytz.timezone('Asia/Jakarta')

def get_jakarta_time():
    return datetime.now(JAKARTA_TZ)

def get_jakarta_time_iso():
    return datetime.now(JAKARTA_TZ).isoformat()

def get_jakarta_date():
    return datetime.now(JAKARTA_TZ).date().isoformat()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def init_database():
    """Initialize SQLite3 database for MASTER BOT"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # ==================== TABLE: bot_owners (users who rent/clone bots) ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_owners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            owner_name TEXT,
            email TEXT,
            whatsapp TEXT,
            balance INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            last_login TIMESTAMP,
            expires_at TIMESTAMP,
            notes TEXT
        )
    ''')
    
    # ==================== TABLE: owner_sessions ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS owner_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id)
        )
    ''')
    
    # ==================== TABLE: cloned_bots ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cloned_bots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT UNIQUE NOT NULL,
            bot_username TEXT,
            bot_name TEXT,
            bot_avatar TEXT,
            status TEXT DEFAULT 'stopped',
            owner_id INTEGER,
            created_at TIMESTAMP,
            last_started TIMESTAMP,
            last_stopped TIMESTAMP,
            pid INTEGER,
            expires_at TIMESTAMP,
            bot_db_path TEXT,
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id)
        )
    ''')
    
    # ==================== TABLE: bot_rentals (rental history) ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_rentals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT NOT NULL,
            owner_id INTEGER NOT NULL,
            rental_price INTEGER,
            payment_id INTEGER,
            rented_at TIMESTAMP,
            expires_at TIMESTAMP,
            status TEXT DEFAULT 'active',
            FOREIGN KEY (bot_token) REFERENCES cloned_bots(bot_token),
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id)
        )
    ''')
    
    # ==================== TABLE: deposits (top up balance) ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS deposits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            order_id TEXT UNIQUE NOT NULL,
            amount INTEGER NOT NULL,
            total_payment INTEGER,
            payment_method TEXT,
            payment_number TEXT,
            payment_proof TEXT,
            status TEXT DEFAULT 'pending',
            qr_string TEXT,
            expired_at TIMESTAMP,
            completed_at TIMESTAMP,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            confirmed_by INTEGER,
            notes TEXT,
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id),
            FOREIGN KEY (confirmed_by) REFERENCES bot_owners(id)
        )
    ''')
    
    # ==================== TABLE: owner_balances (balance history) ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS owner_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            balance_before INTEGER,
            balance_after INTEGER,
            amount INTEGER,
            type TEXT,
            reference_id TEXT,
            description TEXT,
            created_at TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id)
        )
    ''')
    
    # ==================== TABLE: owner_activities (logs) ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS owner_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER,
            action TEXT,
            details TEXT,
            ip_address TEXT,
            user_agent TEXT,
            timestamp TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id)
        )
    ''')
    
    # ==================== TABLE: bot_config_templates (config for cloned bots) ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_config_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT NOT NULL,
            config_type TEXT NOT NULL,
            config_data TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            UNIQUE(bot_token, config_type)
        )
    ''')
    
    # ==================== TABLE: master_settings ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS master_settings (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT,
            updated_at TIMESTAMP,
            updated_by INTEGER
        )
    ''')
    
    # ==================== TABLE: master_stats ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS master_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_owners INTEGER DEFAULT 0,
            total_bots INTEGER DEFAULT 0,
            active_bots INTEGER DEFAULT 0,
            total_revenue INTEGER DEFAULT 0,
            total_deposits INTEGER DEFAULT 0,
            total_withdrawals INTEGER DEFAULT 0,
            updated_at TIMESTAMP
        )
    ''')
    
    # ==================== TABLE: admin_users (master bot admins) ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admin_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            role TEXT DEFAULT 'admin',
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP,
            last_seen TIMESTAMP
        )
    ''')
    
    # ==================== TABLE: withdrawal_requests ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            bank_name TEXT,
            account_number TEXT,
            account_name TEXT,
            status TEXT DEFAULT 'pending',
            approved_by INTEGER,
            approved_at TIMESTAMP,
            rejected_reason TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id),
            FOREIGN KEY (approved_by) REFERENCES bot_owners(id)
        )
    ''')
    
    # ==================== TABLE: payment_methods ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payment_methods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT,
            account_number TEXT,
            account_name TEXT,
            qr_string TEXT,
            is_active BOOLEAN DEFAULT 1,
            min_amount INTEGER DEFAULT 0,
            max_amount INTEGER,
            created_at TIMESTAMP,
            updated_at TIMESTAMP
        )
    ''')
    
    # ==================== TABLE: bot_owner_messages ====================
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_owner_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner_id INTEGER NOT NULL,
            subject TEXT,
            message TEXT,
            is_read BOOLEAN DEFAULT 0,
            created_at TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES bot_owners(id)
        )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("✅ Master database initialized successfully")

_active_sessions = {}

# ==================== DEFAULT SETTINGS ====================

async def init_default_settings():
    """Initialize default master settings"""
    settings = {
        'bot_rental_price': '100000',
        'min_deposit': '50000',
        'max_deposit': '10000000',
        'min_withdrawal': '100000',
        'bot_expiration_days': '30',
        'payment_methods': 'bank_transfer,qris',
        'maintenance_mode': '0',
        'website_url': 'https://companel.shop',
        'support_contact': '@support'
    }
    
    for key, value in settings.items():
        await save_master_setting(key, value, f"Default {key}")
    
    logger.info("✅ Default settings initialized")


async def save_master_setting(key: str, value: str, description: str = None) -> bool:
    """Save or update master setting"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            INSERT OR REPLACE INTO master_settings (key, value, description, updated_at)
            VALUES (?, ?, ?, ?)
        """, (key, value, description, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error saving master setting: {e}")
        return False


async def get_master_setting(key: str, default: str = None) -> str:
    """Get master setting value"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM master_settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else default
    except Exception as e:
        logger.error(f"Error getting master setting: {e}")
        return default


# ==================== ADMIN FUNCTIONS ====================

async def add_admin(telegram_id: int, username: str = None, first_name: str = None, 
                    last_name: str = None, role: str = 'admin') -> bool:
    """Add admin user for master bot"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            INSERT OR REPLACE INTO admin_users (telegram_id, username, first_name, last_name, role, created_at, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (telegram_id, username, first_name, last_name, role, now, now))
        
        conn.commit()
        conn.close()
        logger.info(f"✅ Admin {telegram_id} added")
        return True
    except Exception as e:
        logger.error(f"Error adding admin: {e}")
        return False


async def is_admin(telegram_id: int) -> bool:
    """Check if user is admin"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM admin_users WHERE telegram_id = ? AND is_active = 1", (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        logger.error(f"Error checking admin: {e}")
        return False


async def update_admin_last_seen(telegram_id: int):
    """Update admin last seen timestamp"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        cursor.execute("UPDATE admin_users SET last_seen = ? WHERE telegram_id = ?", (now, telegram_id))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating admin last seen: {e}")


# ==================== BOT OWNER FUNCTIONS ====================

async def create_bot_owner(username: str, password: str, owner_name: str = None, 
                           email: str = None, whatsapp: str = None, 
                           expires_days: int = 30) -> Optional[int]:
    """Create new bot owner (user who can rent/clone bots)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        expires_at = (get_jakarta_time() + timedelta(days=expires_days)).isoformat()
        
        hashed_pw = hash_password(password)
        
        cursor.execute("""
            INSERT INTO bot_owners (username, password, owner_name, email, whatsapp, 
                                   balance, is_active, created_at, updated_at, expires_at)
            VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
        """, (username, hashed_pw, owner_name, email, whatsapp, now, now, expires_at))
        
        owner_id = cursor.lastrowid
        
        # Log initial balance
        cursor.execute("""
            INSERT INTO owner_balances (owner_id, balance_before, balance_after, amount, type, created_at)
            VALUES (?, 0, 0, 0, 'registration', ?)
        """, (owner_id, now))
        
        conn.commit()
        conn.close()
        logger.info(f"✅ Bot owner created: {username} (ID: {owner_id})")
        return owner_id
    except Exception as e:
        logger.error(f"Error creating bot owner: {e}")
        return None


async def authenticate_bot_owner(username: str, password: str) -> Optional[Dict]:
    """Authenticate bot owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            SELECT id, username, password, owner_name, email, whatsapp, balance, 
                   is_active, expires_at, created_at
            FROM bot_owners WHERE username = ?
        """, (username,))
        row = cursor.fetchone()
        conn.close()
        
        if row and row[7] == 1 and verify_password(password, row[2]):
            # Check expiration
            if row[8] and row[8] < now:
                return None  # Account expired
            
            return {
                'id': row[0],
                'username': row[1],
                'owner_name': row[3],
                'email': row[4],
                'whatsapp': row[5],
                'balance': row[6],
                'expires_at': row[8],
                'created_at': row[9]
            }
        return None
    except Exception as e:
        logger.error(f"Error authenticating bot owner: {e}")
        return None


async def get_bot_owner(owner_id: int) -> Optional[Dict]:
    """Get bot owner by ID"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, owner_name, email, whatsapp, balance, is_active, 
                   created_at, expires_at, last_login
            FROM bot_owners WHERE id = ?
        """, (owner_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'username': row[1],
                'owner_name': row[2],
                'email': row[3],
                'whatsapp': row[4],
                'balance': row[5],
                'is_active': row[6],
                'created_at': row[7],
                'expires_at': row[8],
                'last_login': row[9]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting bot owner: {e}")
        return None


async def get_bot_owner_by_username(username: str) -> Optional[Dict]:
    """Get bot owner by username"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, owner_name, email, whatsapp, balance, is_active, 
                   created_at, expires_at
            FROM bot_owners WHERE username = ?
        """, (username,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'username': row[1],
                'owner_name': row[2],
                'email': row[3],
                'whatsapp': row[4],
                'balance': row[5],
                'is_active': row[6],
                'created_at': row[7],
                'expires_at': row[8]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting bot owner by username: {e}")
        return None


async def get_all_bot_owners(limit: int = 100, offset: int = 0) -> List[Dict]:
    """Get all bot owners"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, owner_name, email, whatsapp, balance, is_active, 
                   created_at, expires_at, last_login
            FROM bot_owners ORDER BY created_at DESC LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = cursor.fetchall()
        conn.close()
        
        owners = []
        for row in rows:
            # Get bot count for this owner
            bot_count = await get_owner_bot_count(row[0])
            owners.append({
                'id': row[0],
                'username': row[1],
                'owner_name': row[2],
                'email': row[3],
                'whatsapp': row[4],
                'balance': row[5],
                'is_active': row[6],
                'created_at': row[7],
                'expires_at': row[8],
                'last_login': row[9],
                'bot_count': bot_count
            })
        return owners
    except Exception as e:
        logger.error(f"Error getting all bot owners: {e}")
        return []


async def update_owner_last_login(owner_id: int, ip_address: str = None):
    """Update owner last login"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        cursor.execute("""
            UPDATE bot_owners SET last_login = ?, updated_at = ? WHERE id = ?
        """, (now, now, owner_id))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating last login: {e}")


# ==================== BALANCE FUNCTIONS ====================

async def get_owner_balance(owner_id: int) -> int:
    """Get owner balance"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT balance FROM bot_owners WHERE id = ?", (owner_id,))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else 0
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
        return 0


async def add_owner_balance(owner_id: int, amount: int, reference_id: str = None, 
                            description: str = None) -> bool:
    """Add balance to owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        # Get current balance
        cursor.execute("SELECT balance FROM bot_owners WHERE id = ?", (owner_id,))
        row = cursor.fetchone()
        if not row:
            return False
        
        balance_before = row[0]
        balance_after = balance_before + amount
        
        # Update balance
        cursor.execute("""
            UPDATE bot_owners SET balance = ?, updated_at = ? WHERE id = ?
        """, (balance_after, now, owner_id))
        
        # Log balance change
        cursor.execute("""
            INSERT INTO owner_balances (owner_id, balance_before, balance_after, amount, 
                                       type, reference_id, description, created_at)
            VALUES (?, ?, ?, ?, 'credit', ?, ?, ?)
        """, (owner_id, balance_before, balance_after, amount, reference_id, description, now))
        
        conn.commit()
        conn.close()
        logger.info(f"Added {amount} to owner {owner_id}, new balance: {balance_after}")
        return True
    except Exception as e:
        logger.error(f"Error adding balance: {e}")
        return False


async def deduct_owner_balance(owner_id: int, amount: int, reference_id: str = None, 
                               description: str = None) -> bool:
    """Deduct balance from owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        # Get current balance
        cursor.execute("SELECT balance FROM bot_owners WHERE id = ?", (owner_id,))
        row = cursor.fetchone()
        if not row:
            return False
        
        balance_before = row[0]
        if balance_before < amount:
            return False
        
        balance_after = balance_before - amount
        
        # Update balance
        cursor.execute("""
            UPDATE bot_owners SET balance = ?, updated_at = ? WHERE id = ?
        """, (balance_after, now, owner_id))
        
        # Log balance change
        cursor.execute("""
            INSERT INTO owner_balances (owner_id, balance_before, balance_after, amount, 
                                       type, reference_id, description, created_at)
            VALUES (?, ?, ?, ?, 'debit', ?, ?, ?)
        """, (owner_id, balance_before, balance_after, amount, reference_id, description, now))
        
        conn.commit()
        conn.close()
        logger.info(f"Deducted {amount} from owner {owner_id}, new balance: {balance_after}")
        return True
    except Exception as e:
        logger.error(f"Error deducting balance: {e}")
        return False


async def get_balance_history(owner_id: int, limit: int = 50) -> List[Dict]:
    """Get balance change history"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT balance_before, balance_after, amount, type, reference_id, description, created_at
            FROM owner_balances WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?
        """, (owner_id, limit))
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'balance_before': r[0],
            'balance_after': r[1],
            'amount': r[2],
            'type': r[3],
            'reference_id': r[4],
            'description': r[5],
            'created_at': r[6]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting balance history: {e}")
        return []


# ==================== SESSION FUNCTIONS ====================

async def create_owner_session(owner_id: int, ip_address: str = None, 
                                user_agent: str = None) -> Optional[str]:
    """Create session for bot owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        expires_at = (get_jakarta_time() + timedelta(days=1)).isoformat()
        session_token = generate_session_token()
        
        cursor.execute("""
            INSERT INTO owner_sessions (owner_id, session_token, ip_address, user_agent, 
                                       created_at, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (owner_id, session_token, ip_address, user_agent, now, expires_at))
        
        conn.commit()
        conn.close()
        return session_token
    except Exception as e:
        logger.error(f"Error creating session: {e}")
        return None


async def validate_owner_session(session_token: str) -> Optional[Dict]:
    """Validate owner session"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            SELECT s.owner_id, s.session_token, s.expires_at, o.username, o.owner_name, o.balance
            FROM owner_sessions s
            JOIN bot_owners o ON s.owner_id = o.id
            WHERE s.session_token = ? AND s.expires_at > ? AND o.is_active = 1
        """, (session_token, now))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'owner_id': row[0],
                'session_token': row[1],
                'expires_at': row[2],
                'username': row[3],
                'owner_name': row[4],
                'balance': row[5]
            }
        return None
    except Exception as e:
        logger.error(f"Error validating session: {e}")
        return None


async def delete_owner_session(session_token: str) -> bool:
    """Delete owner session (logout)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM owner_sessions WHERE session_token = ?", (session_token,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        return False


# ==================== CLONED BOT FUNCTIONS ====================

async def add_cloned_bot(bot_token: str, bot_username: str, bot_name: str, 
                         owner_id: int, bot_db_path: str = None,
                         expires_days: int = 30) -> bool:
    """Add cloned bot for an owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        expires_at = (get_jakarta_time() + timedelta(days=expires_days)).isoformat()
        
        cursor.execute("""
            INSERT OR REPLACE INTO cloned_bots 
            (bot_token, bot_username, bot_name, status, owner_id, created_at, expires_at, bot_db_path)
            VALUES (?, ?, ?, 'stopped', ?, ?, ?, ?)
        """, (bot_token, bot_username, bot_name, owner_id, now, expires_at, bot_db_path))
        
        # Log activity
        await log_owner_activity(owner_id, "create_bot", f"Created bot @{bot_username}")
        
        conn.commit()
        conn.close()
        logger.info(f"✅ Bot clone {bot_username} added for owner {owner_id}")
        return True
    except Exception as e:
        logger.error(f"Error adding cloned bot: {e}")
        return False


async def get_cloned_bots(owner_id: int = None, status: str = None) -> List[Dict]:
    """Get cloned bots for an owner or all"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if owner_id and status:
            cursor.execute("""
                SELECT id, bot_token, bot_username, bot_name, status, owner_id, created_at, 
                       last_started, last_stopped, pid, expires_at, bot_db_path
                FROM cloned_bots WHERE owner_id = ? AND status = ? ORDER BY created_at DESC
            """, (owner_id, status))
        elif owner_id:
            cursor.execute("""
                SELECT id, bot_token, bot_username, bot_name, status, owner_id, created_at, 
                       last_started, last_stopped, pid, expires_at, bot_db_path
                FROM cloned_bots WHERE owner_id = ? ORDER BY created_at DESC
            """, (owner_id,))
        elif status:
            cursor.execute("""
                SELECT id, bot_token, bot_username, bot_name, status, owner_id, created_at, 
                       last_started, last_stopped, pid, expires_at, bot_db_path
                FROM cloned_bots WHERE status = ? ORDER BY created_at DESC
            """, (status,))
        else:
            cursor.execute("""
                SELECT id, bot_token, bot_username, bot_name, status, owner_id, created_at, 
                       last_started, last_stopped, pid, expires_at, bot_db_path
                FROM cloned_bots ORDER BY created_at DESC
            """)
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0], 'bot_token': r[1], 'bot_username': r[2], 'bot_name': r[3],
            'status': r[4], 'owner_id': r[5], 'created_at': r[6],
            'last_started': r[7], 'last_stopped': r[8], 'pid': r[9], 
            'expires_at': r[10], 'bot_db_path': r[11]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting cloned bots: {e}")
        return []


async def get_bot_by_token(bot_token: str) -> Optional[Dict]:
    """Get bot by token"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, bot_token, bot_username, bot_name, status, owner_id, created_at, 
                   last_started, last_stopped, pid, expires_at, bot_db_path
            FROM cloned_bots WHERE bot_token = ?
        """, (bot_token,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0], 'bot_token': row[1], 'bot_username': row[2], 'bot_name': row[3],
                'status': row[4], 'owner_id': row[5], 'created_at': row[6],
                'last_started': row[7], 'last_stopped': row[8], 'pid': row[9],
                'expires_at': row[10], 'bot_db_path': row[11]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting bot: {e}")
        return None


async def get_bot_by_username(bot_username: str) -> Optional[Dict]:
    """Get bot by username"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, bot_token, bot_username, bot_name, status, owner_id, created_at, 
                   last_started, last_stopped, pid, expires_at, bot_db_path
            FROM cloned_bots WHERE bot_username = ?
        """, (bot_username,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': r[0], 'bot_token': r[1], 'bot_username': r[2], 'bot_name': r[3],
                'status': r[4], 'owner_id': r[5], 'created_at': r[6],
                'last_started': r[7], 'last_stopped': r[8], 'pid': r[9],
                'expires_at': r[10], 'bot_db_path': r[11]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting bot by username: {e}")
        return None


async def update_bot_status(bot_token: str, status: str, pid: int = None):
    """Update bot status"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        if status == 'running':
            cursor.execute("""
                UPDATE cloned_bots SET status=?, last_started=?, pid=? WHERE bot_token=?
            """, (status, now, pid, bot_token))
        elif status == 'stopped':
            cursor.execute("""
                UPDATE cloned_bots SET status=?, last_stopped=?, pid=NULL WHERE bot_token=?
            """, (status, now, bot_token))
        else:
            cursor.execute("UPDATE cloned_bots SET status=? WHERE bot_token=?", (status, bot_token))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating bot status: {e}")


async def remove_cloned_bot(bot_token: str) -> bool:
    """Remove cloned bot"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM cloned_bots WHERE bot_token = ?', (bot_token,))
        cursor.execute('DELETE FROM bot_rentals WHERE bot_token = ?', (bot_token,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error removing cloned bot: {e}")
        return False


async def get_owner_bot_count(owner_id: int) -> int:
    """Get number of bots owned by an owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE owner_id = ?", (owner_id,))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else 0
    except Exception as e:
        logger.error(f"Error getting bot count: {e}")
        return 0


async def check_bot_expiration(bot_token: str) -> bool:
    """Check if bot has expired"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        cursor.execute("SELECT expires_at FROM cloned_bots WHERE bot_token = ?", (bot_token,))
        row = cursor.fetchone()
        conn.close()
        
        if row and row[0]:
            return row[0] < now
        return False
    except Exception as e:
        logger.error(f"Error checking bot expiration: {e}")
        return True


async def extend_bot_expiration(bot_token: str, extra_days: int) -> bool:
    """Extend bot expiration date"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("SELECT expires_at FROM cloned_bots WHERE bot_token = ?", (bot_token,))
        row = cursor.fetchone()
        
        if row and row[0]:
            current_expiry = datetime.fromisoformat(row[0])
            new_expiry = current_expiry + timedelta(days=extra_days)
            new_expiry_str = new_expiry.isoformat()
        else:
            new_expiry_str = (get_jakarta_time() + timedelta(days=extra_days)).isoformat()
        
        cursor.execute("""
            UPDATE cloned_bots SET expires_at = ?, updated_at = ? WHERE bot_token = ?
        """, (new_expiry_str, now, bot_token))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error extending bot expiration: {e}")
        return False


# ==================== DEPOSIT FUNCTIONS ====================

async def create_deposit(owner_id: int, order_id: str, amount: int, payment_method: str,
                         payment_number: str = None, qr_string: str = None, 
                         total_payment: int = None, expired_minutes: int = 60) -> bool:
    """Create deposit record"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        expired_at = (get_jakarta_time() + timedelta(minutes=expired_minutes)).isoformat()
        
        cursor.execute("""
            INSERT INTO deposits (owner_id, order_id, amount, total_payment, payment_method,
                                 payment_number, qr_string, status, expired_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        """, (owner_id, order_id, amount, total_payment or amount, payment_method,
              payment_number, qr_string, expired_at, now, now))
        
        conn.commit()
        conn.close()
        await log_owner_activity(owner_id, "create_deposit", f"Created deposit {order_id} for {amount}")
        return True
    except Exception as e:
        logger.error(f"Error creating deposit: {e}")
        return False


async def get_deposit(order_id: str) -> Optional[Dict]:
    """Get deposit by order ID"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, owner_id, order_id, amount, total_payment, payment_method,
                   payment_number, qr_string, status, expired_at, completed_at, 
                   created_at, updated_at, confirmed_by, notes
            FROM deposits WHERE order_id = ?
        """, (order_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0], 'owner_id': row[1], 'order_id': row[2], 'amount': row[3],
                'total_payment': row[4], 'payment_method': row[5], 'payment_number': row[6],
                'qr_string': row[7], 'status': row[8], 'expired_at': row[9],
                'completed_at': row[10], 'created_at': row[11], 'updated_at': row[12],
                'confirmed_by': row[13], 'notes': row[14]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting deposit: {e}")
        return None


async def get_owner_deposits(owner_id: int, limit: int = 50) -> List[Dict]:
    """Get all deposits for an owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT order_id, amount, total_payment, payment_method, status, 
                   created_at, completed_at
            FROM deposits WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?
        """, (owner_id, limit))
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'order_id': r[0], 'amount': r[1], 'total_payment': r[2],
            'payment_method': r[3], 'status': r[4], 'created_at': r[5],
            'completed_at': r[6]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting owner deposits: {e}")
        return []


async def update_deposit_status(order_id: str, status: str, confirmed_by: int = None,
                                notes: str = None) -> bool:
    """Update deposit status"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            UPDATE deposits SET status = ?, updated_at = ?, completed_at = COALESCE(completed_at, ?),
                               confirmed_by = COALESCE(?, confirmed_by), notes = COALESCE(?, notes)
            WHERE order_id = ?
        """, (status, now, now if status == 'completed' else None, confirmed_by, notes, order_id))
        
        if status == 'completed':
            # Add balance to owner
            cursor.execute("SELECT owner_id, amount FROM deposits WHERE order_id = ?", (order_id,))
            row = cursor.fetchone()
            if row:
                await add_owner_balance(row[0], row[1], order_id, f"Deposit {order_id}")
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error updating deposit status: {e}")
        return False


async def get_pending_deposits(limit: int = 50) -> List[Dict]:
    """Get all pending deposits"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            SELECT d.id, d.order_id, d.owner_id, d.amount, d.total_payment, d.payment_method,
                   d.payment_number, d.qr_string, d.created_at, o.username, o.owner_name
            FROM deposits d
            JOIN bot_owners o ON d.owner_id = o.id
            WHERE d.status = 'pending' AND d.expired_at > ?
            ORDER BY d.created_at ASC LIMIT ?
        """, (now, limit))
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0], 'order_id': r[1], 'owner_id': r[2], 'amount': r[3],
            'total_payment': r[4], 'payment_method': r[5], 'payment_number': r[6],
            'qr_string': r[7], 'created_at': r[8], 'username': r[9], 'owner_name': r[10]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting pending deposits: {e}")
        return []


# ==================== WITHDRAWAL FUNCTIONS ====================

async def create_withdrawal_request(owner_id: int, amount: int, bank_name: str,
                                    account_number: str, account_name: str) -> bool:
    """Create withdrawal request"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            INSERT INTO withdrawal_requests (owner_id, amount, bank_name, account_number, 
                                            account_name, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        """, (owner_id, amount, bank_name, account_number, account_name, now, now))
        
        conn.commit()
        conn.close()
        await log_owner_activity(owner_id, "request_withdrawal", f"Requested withdrawal of {amount}")
        return True
    except Exception as e:
        logger.error(f"Error creating withdrawal request: {e}")
        return False


async def get_withdrawal_requests(status: str = None, limit: int = 50) -> List[Dict]:
    """Get withdrawal requests"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if status:
            cursor.execute("""
                SELECT w.id, w.owner_id, w.amount, w.bank_name, w.account_number, w.account_name,
                       w.status, w.created_at, w.approved_at, w.rejected_reason, o.username, o.owner_name
                FROM withdrawal_requests w
                JOIN bot_owners o ON w.owner_id = o.id
                WHERE w.status = ? ORDER BY w.created_at DESC LIMIT ?
            """, (status, limit))
        else:
            cursor.execute("""
                SELECT w.id, w.owner_id, w.amount, w.bank_name, w.account_number, w.account_name,
                       w.status, w.created_at, w.approved_at, w.rejected_reason, o.username, o.owner_name
                FROM withdrawal_requests w
                JOIN bot_owners o ON w.owner_id = o.id
                ORDER BY w.created_at DESC LIMIT ?
            """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0], 'owner_id': r[1], 'amount': r[2], 'bank_name': r[3],
            'account_number': r[4], 'account_name': r[5], 'status': r[6],
            'created_at': r[7], 'approved_at': r[8], 'rejected_reason': r[9],
            'username': r[10], 'owner_name': r[11]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting withdrawal requests: {e}")
        return []


async def approve_withdrawal(withdrawal_id: int, approved_by: int) -> bool:
    """Approve withdrawal request"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        # Get withdrawal details
        cursor.execute("SELECT owner_id, amount FROM withdrawal_requests WHERE id = ?", (withdrawal_id,))
        row = cursor.fetchone()
        
        if not row:
            return False
        
        owner_id, amount = row
        
        # Deduct balance
        success = await deduct_owner_balance(owner_id, amount, f"withdrawal_{withdrawal_id}", 
                                             f"Withdrawal #{withdrawal_id}")
        
        if not success:
            return False
        
        cursor.execute("""
            UPDATE withdrawal_requests SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
        """, (approved_by, now, now, withdrawal_id))
        
        conn.commit()
        conn.close()
        await log_owner_activity(owner_id, "withdrawal_approved", f"Withdrawal of {amount} approved")
        return True
    except Exception as e:
        logger.error(f"Error approving withdrawal: {e}")
        return False


async def reject_withdrawal(withdrawal_id: int, approved_by: int, reason: str) -> bool:
    """Reject withdrawal request"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            UPDATE withdrawal_requests SET status = 'rejected', approved_by = ?, 
                       rejected_reason = ?, updated_at = ?
            WHERE id = ?
        """, (approved_by, reason, now, withdrawal_id))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error rejecting withdrawal: {e}")
        return False


# ==================== ACTIVITY LOGS ====================

async def log_owner_activity(owner_id: int, action: str, details: str = None, 
                             ip_address: str = None, user_agent: str = None):
    """Log owner activity"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO owner_activities (owner_id, action, details, ip_address, user_agent, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (owner_id, action, details, ip_address, user_agent, get_jakarta_time_iso()))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error logging owner activity: {e}")


async def get_owner_activities(owner_id: int, limit: int = 50) -> List[Dict]:
    """Get owner activities"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT action, details, ip_address, timestamp FROM owner_activities 
            WHERE owner_id = ? ORDER BY timestamp DESC LIMIT ?
        """, (owner_id, limit))
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'action': r[0], 'details': r[1], 'ip_address': r[2], 'timestamp': r[3]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting owner activities: {e}")
        return []


async def get_all_activities(limit: int = 100) -> List[Dict]:
    """Get all activities (for admin)"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.action, a.details, a.ip_address, a.timestamp, o.username, o.owner_name
            FROM owner_activities a
            JOIN bot_owners o ON a.owner_id = o.id
            ORDER BY a.timestamp DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'action': r[0], 'details': r[1], 'ip_address': r[2], 'timestamp': r[3],
            'username': r[4], 'owner_name': r[5]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting all activities: {e}")
        return []


# ==================== BOT CONFIG TEMPLATES ====================

async def save_bot_config_template(bot_token: str, config_type: str, config_data: dict) -> bool:
    """Save bot configuration template"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            INSERT OR REPLACE INTO bot_config_templates (bot_token, config_type, config_data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        """, (bot_token, config_type, json.dumps(config_data), now, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error saving bot config template: {e}")
        return False


async def get_bot_config_template(bot_token: str, config_type: str) -> Optional[dict]:
    """Get bot configuration template"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT config_data FROM bot_config_templates 
            WHERE bot_token = ? AND config_type = ?
        """, (bot_token, config_type))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return json.loads(row[0])
        return None
    except Exception as e:
        logger.error(f"Error getting bot config template: {e}")
        return None


# ==================== STATISTICS FUNCTIONS ====================

async def update_master_stats():
    """Update master statistics"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        # Get stats
        cursor.execute("SELECT COUNT(*) FROM bot_owners WHERE is_active = 1")
        total_owners = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COUNT(*) FROM cloned_bots")
        total_bots = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE status = 'running'")
        active_bots = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'completed'")
        total_revenue = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE status = 'completed'")
        total_deposits = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status = 'approved'")
        total_withdrawals = cursor.fetchone()[0] or 0
        
        cursor.execute("""
            INSERT OR REPLACE INTO master_stats (id, total_owners, total_bots, active_bots,
                       total_revenue, total_deposits, total_withdrawals, updated_at)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        """, (total_owners, total_bots, active_bots, total_revenue, total_deposits, total_withdrawals, now))
        
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error updating master stats: {e}")


async def get_master_stats() -> Dict:
    """Get master statistics"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT total_owners, total_bots, active_bots, total_revenue, total_deposits, total_withdrawals, updated_at
            FROM master_stats WHERE id = 1
        """)
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'total_owners': row[0] or 0,
                'total_bots': row[1] or 0,
                'active_bots': row[2] or 0,
                'total_revenue': row[3] or 0,
                'total_deposits': row[4] or 0,
                'total_withdrawals': row[5] or 0,
                'updated_at': row[6]
            }
        return {}
    except Exception as e:
        logger.error(f"Error getting master stats: {e}")
        return {}


async def get_owner_stats(owner_id: int) -> Dict:
    """Get statistics for specific owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE owner_id = ?", (owner_id,))
        total_bots = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE owner_id = ? AND status = 'running'", (owner_id,))
        active_bots = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM deposits WHERE owner_id = ? AND status = 'completed'", (owner_id,))
        total_deposits = cursor.fetchone()[0] or 0
        
        cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE owner_id = ? AND status = 'approved'", (owner_id,))
        total_withdrawals = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            'total_bots': total_bots,
            'active_bots': active_bots,
            'total_deposits': total_deposits,
            'total_withdrawals': total_withdrawals
        }
    except Exception as e:
        logger.error(f"Error getting owner stats: {e}")
        return {}


# ==================== PAYMENT METHODS ====================

async def add_payment_method(name: str, method_type: str, account_number: str = None,
                             account_name: str = None, qr_string: str = None,
                             min_amount: int = 0, max_amount: int = None) -> bool:
    """Add payment method"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            INSERT INTO payment_methods (name, type, account_number, account_name, qr_string,
                                        min_amount, max_amount, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, method_type, account_number, account_name, qr_string,
              min_amount, max_amount, now, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error adding payment method: {e}")
        return False


async def get_payment_methods(is_active: bool = True) -> List[Dict]:
    """Get all payment methods"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if is_active:
            cursor.execute("""
                SELECT id, name, type, account_number, account_name, qr_string,
                       min_amount, max_amount, is_active
                FROM payment_methods WHERE is_active = 1 ORDER BY id ASC
            """)
        else:
            cursor.execute("""
                SELECT id, name, type, account_number, account_name, qr_string,
                       min_amount, max_amount, is_active
                FROM payment_methods ORDER BY id ASC
            """)
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0], 'name': r[1], 'type': r[2], 'account_number': r[3],
            'account_name': r[4], 'qr_string': r[5], 'min_amount': r[6],
            'max_amount': r[7], 'is_active': r[8]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting payment methods: {e}")
        return []


# ==================== MESSAGES ====================

async def send_message_to_owner(owner_id: int, subject: str, message: str) -> bool:
    """Send message to bot owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        cursor.execute("""
            INSERT INTO bot_owner_messages (owner_id, subject, message, created_at)
            VALUES (?, ?, ?, ?)
        """, (owner_id, subject, message, now))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return False


async def get_owner_messages(owner_id: int, unread_only: bool = False) -> List[Dict]:
    """Get messages for owner"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if unread_only:
            cursor.execute("""
                SELECT id, subject, message, is_read, created_at
                FROM bot_owner_messages WHERE owner_id = ? AND is_read = 0
                ORDER BY created_at DESC
            """, (owner_id,))
        else:
            cursor.execute("""
                SELECT id, subject, message, is_read, created_at
                FROM bot_owner_messages WHERE owner_id = ?
                ORDER BY created_at DESC
            """, (owner_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0], 'subject': r[1], 'message': r[2], 'is_read': r[3], 'created_at': r[4]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting owner messages: {e}")
        return []


async def mark_message_as_read(message_id: int) -> bool:
    """Mark message as read"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE bot_owner_messages SET is_read = 1 WHERE id = ?", (message_id,))
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error marking message as read: {e}")
        return False

def authenticate_panel_user(username, password):
    """
    Autentikasi user untuk panel admin fragment
    
    Args:
        username (str): Username
        password (str): Password
    
    Returns:
        dict or None: Data user jika berhasil, None jika gagal
    """
    import hashlib
    
    # Baca file users.json jika ada
    users_file = os.path.join(os.path.dirname(__file__), 'users.json')
    
    # Default credentials untuk testing
    default_users = {
        'admin': {
            'password': hashlib.sha256('admin123'.encode()).hexdigest(),
            'role': 'admin',
            'name': 'Administrator'
        },
        'owner': {
            'password': hashlib.sha256('owner123'.encode()).hexdigest(),
            'role': 'owner',
            'name': 'Store Owner'
        }
    }
    
    # Coba load dari file JSON
    if os.path.exists(users_file):
        try:
            import json
            with open(users_file, 'r') as f:
                users = json.load(f)
        except:
            users = default_users
    else:
        users = default_users
    
    # Hash password yang dimasukkan
    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    
    # Cek autentikasi
    if username in users and users[username]['password'] == hashed_password:
        return {
            'username': username,
            'role': users[username]['role'],
            'name': users[username]['name'],
            'authenticated': True
        }
    
    return None

# ==================== PANEL SESSION FUNCTIONS ====================

def create_panel_session(username: str, role: str) -> dict:
    """
    Create a new panel session for authenticated user
    
    Args:
        username (str): Username
        role (str): User role (admin/owner/user)
    
    Returns:
        dict: Session data with token
    """
    import uuid
    from datetime import datetime, timedelta
    
    session_token = str(uuid.uuid4())
    expires_at = datetime.now() + timedelta(hours=24)
    
    session_data = {
        'token': session_token,
        'username': username,
        'role': role,
        'created_at': datetime.now().isoformat(),
        'expires_at': expires_at.isoformat()
    }
    
    # Store in global _active_sessions dictionary (already defined in your file)
    global _active_sessions
    _active_sessions[session_token] = session_data
    
    return session_data


def get_panel_session(token: str) -> dict:
    """
    Get panel session by token
    
    Args:
        token (str): Session token
    
    Returns:
        dict or None: Session data if valid
    """
    from datetime import datetime
    
    global _active_sessions
    
    if token in _active_sessions:
        session = _active_sessions[token]
        expires_at = datetime.fromisoformat(session['expires_at'])
        
        if expires_at > datetime.now():
            return session
        else:
            # Remove expired session
            del _active_sessions[token]
    
    return None


def delete_panel_session(token: str) -> bool:
    """
    Delete/Invalidate panel session
    
    Args:
        token (str): Session token
    
    Returns:
        bool: True if deleted
    """
    global _active_sessions
    
    if token in _active_sessions:
        del _active_sessions[token]
        return True
    return False


def get_all_panel_sessions() -> list:
    """
    Get all active panel sessions
    
    Returns:
        list: List of active sessions
    """
    from datetime import datetime
    
    global _active_sessions
    
    # Clean expired sessions
    expired = []
    for token, session in _active_sessions.items():
        expires_at = datetime.fromisoformat(session['expires_at'])
        if expires_at <= datetime.now():
            expired.append(token)
    
    for token in expired:
        del _active_sessions[token]
    
    return list(_active_sessions.values())

# ==================== PANEL SESSION ALIASES (for compatibility) ====================

async def validate_panel_session(token: str) -> dict:
    """
    Async version of get_panel_session for compatibility
    
    Args:
        token (str): Session token
    
    Returns:
        dict or None: Session data if valid
    """
    return get_panel_session(token)


async def get_current_user_from_session(token: str) -> dict:
    """
    Get current user from panel session
    
    Args:
        token (str): Session token
    
    Returns:
        dict or None: User data if session valid
    """
    session = get_panel_session(token)
    if session:
        # Get full user data from database
        user = await get_bot_owner_by_username(session['username'])
        if user:
            user['role'] = session.get('role', 'user')
            user['authenticated'] = True
            return user
    return None


async def get_current_admin_from_session(token: str) -> dict:
    """
    Get current admin from panel session
    
    Args:
        token (str): Session token
    
    Returns:
        dict or None: Admin data if session valid and user is admin
    """
    session = get_panel_session(token)
    if session and session.get('role') == 'admin':
        return session
    return None


async def cleanup_expired_sessions():
    """
    Clean up expired sessions (run periodically)
    """
    from datetime import datetime
    
    global _active_sessions
    
    expired = []
    for token, session in _active_sessions.items():
        expires_at = datetime.fromisoformat(session['expires_at'])
        if expires_at <= datetime.now():
            expired.append(token)
    
    for token in expired:
        del _active_sessions[token]
    
    return len(expired)

async def authenticate_panel_user_async(username: str, password: str) -> dict:
    """
    Async version of authenticate_panel_user
    
    Args:
        username (str): Username
        password (str): Password
    
    Returns:
        dict or None: User data jika berhasil, None jika gagal
    """
    return authenticate_panel_user(username, password)

# ==================== PANEL USER FUNCTIONS ====================

async def get_panel_user_by_bot_token(bot_token: str) -> Optional[Dict]:
    """
    Get panel user by bot token
    
    Args:
        bot_token (str): Bot token
    
    Returns:
        dict or None: User data if found
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, owner_name, email, whatsapp, balance, is_active,
                   created_at, expires_at, last_login
            FROM bot_owners 
            WHERE id IN (SELECT owner_id FROM cloned_bots WHERE bot_token = ?)
        """, (bot_token,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'username': row[1],
                'owner_name': row[2],
                'email': row[3],
                'whatsapp': row[4],
                'balance': row[5],
                'is_active': row[6],
                'created_at': row[7],
                'expires_at': row[8],
                'last_login': row[9]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting panel user by bot token: {e}")
        return None


async def get_panel_user_by_username(username: str) -> Optional[Dict]:
    """
    Get panel user by username (alias for get_bot_owner_by_username)
    
    Args:
        username (str): Username
    
    Returns:
        dict or None: User data if found
    """
    return await get_bot_owner_by_username(username)


async def create_panel_user(username: str, password: str, email: str = None,
                            owner_name: str = None, whatsapp: str = None,
                            bot_token: str = None, expires_days: int = 30) -> Optional[int]:
    """
    Create new panel user (alias for create_bot_owner)
    
    Args:
        username (str): Username
        password (str): Password
        email (str): Email
        owner_name (str): Owner name
        whatsapp (str): WhatsApp number
        bot_token (str): Bot token (optional)
        expires_days (int): Expiration days
    
    Returns:
        int or None: User ID if created
    """
    owner_id = await create_bot_owner(username, password, owner_name, email, whatsapp, expires_days)
    
    if owner_id and bot_token:
        # Associate bot with user
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE cloned_bots SET owner_id = ? WHERE bot_token = ?", (owner_id, bot_token))
        conn.commit()
        conn.close()
    
    return owner_id

# ==================== RENTAL FUNCTIONS ====================

async def create_rental_record(bot_token: str, owner_id: int, rental_price: int,
                               expires_days: int = 30) -> bool:
    """Create bot rental record"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        expires_at = (get_jakarta_time() + timedelta(days=expires_days)).isoformat()
        
        cursor.execute("""
            INSERT INTO bot_rentals (bot_token, owner_id, rental_price, rented_at, expires_at, status)
            VALUES (?, ?, ?, ?, ?, 'active')
        """, (bot_token, owner_id, rental_price, now, expires_at))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Error creating rental record: {e}")
        return False
    
# ==================== ADDITIONAL FUNCTIONS FOR frag_service ====================

async def get_all_stats(bot_token: str = None) -> Dict:
    """Get all statistics for dashboard"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if bot_token:
            cursor.execute("SELECT COUNT(*) FROM users WHERE bot_token = ?", (bot_token,))
            total_users = cursor.fetchone()[0] or 0
            
            cursor.execute("""
                SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_idr), 0)
                FROM purchases WHERE status = 'success' AND bot_token = ?
            """, (bot_token,))
            row = cursor.fetchone()
            total_purchases, total_stars, total_volume_idr = row if row else (0, 0, 0)
            
            today = get_jakarta_date()
            cursor.execute("""
                SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_idr), 0)
                FROM purchases WHERE status = 'success' AND DATE(timestamp) = ? AND bot_token = ?
            """, (today, bot_token))
            row2 = cursor.fetchone()
            today_purchases, today_stars, today_volume_idr = row2 if row2 else (0, 0, 0)
        else:
            # Try to get from master DB or return default
            cursor.execute("SELECT COUNT(*) FROM users")
            total_users = cursor.fetchone()[0] if cursor.fetchone() else 0
            
            cursor.execute("""
                SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_idr), 0)
                FROM purchases WHERE status = 'success'
            """)
            row = cursor.fetchone()
            total_purchases, total_stars, total_volume_idr = row if row else (0, 0, 0)
            
            today = get_jakarta_date()
            cursor.execute("""
                SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_idr), 0)
                FROM purchases WHERE status = 'success' AND DATE(timestamp) = ?
            """, (today,))
            row2 = cursor.fetchone()
            today_purchases, today_stars, today_volume_idr = row2 if row2 else (0, 0, 0)
        
        conn.close()
        
        return {
            'total_users': total_users or 0,
            'total_purchases': total_purchases or 0,
            'total_stars': total_stars or 0,
            'total_volume_idr': float(total_volume_idr or 0),
            'today_purchases': today_purchases or 0,
            'today_stars': today_stars or 0,
            'today_volume_idr': float(today_volume_idr or 0)
        }
    except Exception as e:
        logger.error(f"Error getting all stats: {e}")
        return {
            'total_users': 0,
            'total_purchases': 0,
            'total_stars': 0,
            'total_volume_idr': 0,
            'today_purchases': 0,
            'today_stars': 0,
            'today_volume_idr': 0
        }


async def get_chart_data(bot_token: str = None, days: int = 7) -> Dict:
    """Get chart data for dashboard"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        labels = []
        values = []
        
        for i in range(days - 1, -1, -1):
            date = (get_jakarta_time() - timedelta(days=i)).date().isoformat()
            labels.append(date)
            
            if bot_token:
                cursor.execute("""
                    SELECT COALESCE(SUM(price_idr), 0)
                    FROM purchases WHERE status = 'success' AND DATE(timestamp) = ? AND bot_token = ?
                """, (date, bot_token))
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(price_idr), 0)
                    FROM purchases WHERE status = 'success' AND DATE(timestamp) = ?
                """, (date,))
            
            row = cursor.fetchone()
            values.append(float(row[0] or 0))
        
        conn.close()
        
        return {
            'labels': labels,
            'values': values
        }
    except Exception as e:
        logger.error(f"Error getting chart data: {e}")
        return {'labels': [], 'values': []}


async def get_recent_activities(bot_token: str = None, limit: int = 10) -> List[Dict]:
    """Get recent activities"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if bot_token:
            cursor.execute("""
                SELECT id, action, details, timestamp
                FROM activity_log WHERE bot_token = ?
                ORDER BY timestamp DESC LIMIT ?
            """, (bot_token, limit))
        else:
            cursor.execute("""
                SELECT id, action, details, timestamp
                FROM activity_log ORDER BY timestamp DESC LIMIT ?
            """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [{
            'id': r[0],
            'action': r[1],
            'details': r[2],
            'timestamp': r[3]
        } for r in rows]
    except Exception as e:
        logger.error(f"Error getting recent activities: {e}")
        return []


async def get_bot_stats(bot_token: str) -> Dict:
    """Get statistics for a specific bot"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*), COALESCE(SUM(stars_amount), 0), COALESCE(SUM(price_idr), 0)
            FROM purchases WHERE status = 'success' AND bot_token = ?
        """, (bot_token,))
        row = cursor.fetchone()
        total_purchases, total_stars, total_volume = row if row else (0, 0, 0)
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE bot_token = ?", (bot_token,))
        total_users = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            'total_purchases': total_purchases or 0,
            'total_stars': total_stars or 0,
            'total_volume_idr': float(total_volume or 0),
            'total_users': total_users
        }
    except Exception as e:
        logger.error(f"Error getting bot stats: {e}")
        return {
            'total_purchases': 0,
            'total_stars': 0,
            'total_volume_idr': 0,
            'total_users': 0
        }


async def get_all_users_with_stats(bot_token: str = None, limit: int = 50) -> List[Dict]:
    """Get all users with their statistics"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        if bot_token:
            cursor.execute("""
                SELECT user_id, username, first_name, last_name, first_seen, last_seen
                FROM users WHERE bot_token = ? ORDER BY last_seen DESC LIMIT ?
            """, (bot_token, limit))
        else:
            cursor.execute("""
                SELECT user_id, username, first_name, last_name, first_seen, last_seen
                FROM users ORDER BY last_seen DESC LIMIT ?
            """, (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        users = []
        for row in rows:
            stats = await get_user_stats(row[0], bot_token)
            users.append({
                'user_id': row[0],
                'username': row[1],
                'first_name': row[2],
                'last_name': row[3],
                'first_seen': row[4],
                'last_seen': row[5],
                'stats': stats
            })
        
        return users
    except Exception as e:
        logger.error(f"Error getting all users with stats: {e}")
        return []


async def get_bot_logs(bot_username: str, limit: int = 50) -> List[tuple]:
    """Get bot logs from log file"""
    import glob
    
    log_files = glob.glob(f"logs/bot_{bot_username}*.log")
    if not log_files:
        return []
    
    # Get the latest log file
    log_file = max(log_files, key=os.path.getctime)
    
    logs = []
    try:
        with open(log_file, 'r') as f:
            lines = f.readlines()
            for line in lines[-limit:]:
                # Parse log line (simplified)
                if '|' in line:
                    parts = line.split('|')
                    if len(parts) >= 2:
                        logs.append(('INFO', parts[-1].strip(), parts[0].strip()))
                    else:
                        logs.append(('INFO', line.strip(), ''))
                else:
                    logs.append(('INFO', line.strip(), ''))
    except Exception as e:
        logger.error(f"Error reading bot logs: {e}")
    
    return logs


async def get_panel_user_by_bot_token(bot_token: str) -> Optional[Dict]:
    """Get panel user by bot token"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT o.id, o.username, o.owner_name, o.email, o.whatsapp, o.balance, o.is_active,
                   o.created_at, o.expires_at, o.last_login
            FROM bot_owners o
            JOIN cloned_bots b ON o.id = b.owner_id
            WHERE b.bot_token = ?
        """, (bot_token,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'username': row[1],
                'owner_name': row[2],
                'email': row[3],
                'whatsapp': row[4],
                'balance': row[5],
                'is_active': row[6],
                'created_at': row[7],
                'expires_at': row[8],
                'last_login': row[9]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting panel user by bot token: {e}")
        return None


async def create_panel_user(username: str, password: str, email: str = None,
                            owner_name: str = None, whatsapp: str = None,
                            bot_token: str = None, expires_days: int = 30) -> Optional[int]:
    """Create new panel user (alias for create_bot_owner)"""
    owner_id = await create_bot_owner(username, password, owner_name, email, whatsapp, expires_days)
    
    if owner_id and bot_token:
        # Associate bot with user
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("UPDATE cloned_bots SET owner_id = ? WHERE bot_token = ?", (owner_id, bot_token))
        conn.commit()
        conn.close()
    
    return owner_id