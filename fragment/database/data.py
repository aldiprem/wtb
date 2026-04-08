import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path
import logging
import os

logger = logging.getLogger(__name__)

# Database path
DB_PATH = Path(__file__).parent.parent / 'database.db'

def init_database():
    """Initialize all database tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table: panel_users
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS panel_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            owner_name TEXT,
            email TEXT,
            balance INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP
        )
    ''')
    
    # Table: cloned_bots
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cloned_bots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT UNIQUE NOT NULL,
            bot_username TEXT NOT NULL,
            bot_name TEXT,
            owner_id INTEGER NOT NULL,
            status TEXT DEFAULT 'stopped',
            pid INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES panel_users (id)
        )
    ''')
    
    # Table: deposits
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS deposits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            payment_method TEXT,
            payment_proof TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES panel_users (id)
        )
    ''')
    
    # Table: bot_logs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            level TEXT,
            message TEXT
        )
    ''')
    
    # Table: owner_activities
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS owner_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            action TEXT,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table: panel_sessions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS panel_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES panel_users (id)
        )
    ''')
    
    # Table: bot_fragment_config
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_fragment_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT UNIQUE NOT NULL,
            fragment_api_key TEXT,
            min_stars INTEGER DEFAULT 1,
            max_stars INTEGER DEFAULT 100,
            markup_percent INTEGER DEFAULT 10,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table: bot_wallet_config
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bot_wallet_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bot_token TEXT UNIQUE NOT NULL,
            wallet_address TEXT,
            ton_api_key TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully")


# ==================== PANEL USER FUNCTIONS ====================

def hash_password(password: str, salt: str = None) -> tuple:
    """Hash password with salt"""
    if salt is None:
        salt = secrets.token_hex(16)
    hash_obj = hashlib.sha256((password + salt).encode())
    return hash_obj.hexdigest(), salt

async def create_panel_user(username: str, password: str, owner_name: str = None, email: str = None, expire_days: int = 30) -> Optional[int]:
    """Create new panel user"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        password_hash, salt = hash_password(password)
        expires_at = datetime.now() + timedelta(days=expire_days)
        
        cursor.execute('''
            INSERT INTO panel_users (username, password_hash, salt, owner_name, email, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (username, password_hash, salt, owner_name, email, expires_at))
        
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None

async def authenticate_panel_user(username: str, password: str) -> Optional[Dict]:
    """Authenticate panel user"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, username, password_hash, salt, owner_name, email, balance, expires_at FROM panel_users WHERE username = ?', (username,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        stored_hash, salt = row[2], row[3]
        input_hash, _ = hash_password(password, salt)
        
        if input_hash == stored_hash:
            return {
                'id': row[0],
                'username': row[1],
                'owner_name': row[4],
                'email': row[5],
                'balance': row[6],
                'expires_at': row[7]
            }
    return None

async def get_panel_user(user_id: int = None, username: str = None) -> Optional[Dict]:
    """Get panel user by ID or username"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if user_id:
        cursor.execute('SELECT id, username, owner_name, email, balance, created_at, expires_at FROM panel_users WHERE id = ?', (user_id,))
    elif username:
        cursor.execute('SELECT id, username, owner_name, email, balance, created_at, expires_at FROM panel_users WHERE username = ?', (username,))
    else:
        conn.close()
        return None
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'id': row[0],
            'username': row[1],
            'owner_name': row[2],
            'email': row[3],
            'balance': row[4],
            'created_at': row[5],
            'expires_at': row[6]
        }
    return None

async def get_user_balance(user_id: int) -> int:
    """Get user balance"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT balance FROM panel_users WHERE id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else 0

async def add_user_balance(user_id: int, amount: int) -> bool:
    """Add balance to user"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('UPDATE panel_users SET balance = balance + ? WHERE id = ?', (amount, user_id))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0

async def deduct_user_balance(user_id: int, amount: int) -> bool:
    """Deduct balance from user"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    current = await get_user_balance(user_id)
    if current >= amount:
        cursor.execute('UPDATE panel_users SET balance = balance - ? WHERE id = ?', (amount, user_id))
        conn.commit()
        affected = cursor.rowcount
        conn.close()
        return affected > 0
    conn.close()
    return False


# ==================== CLONED BOTS FUNCTIONS ====================

async def add_cloned_bot(bot_token: str, bot_username: str, bot_name: str, owner_id: int, expire_days: int = 30) -> bool:
    """Add cloned bot to database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    expires_at = datetime.now() + timedelta(days=expire_days)
    
    try:
        cursor.execute('''
            INSERT INTO cloned_bots (bot_token, bot_username, bot_name, owner_id, expires_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (bot_token, bot_username, bot_name, owner_id, expires_at))
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        conn.close()
        return False

async def get_cloned_bots(owner_id: int = None, status: str = None) -> List[Dict]:
    """Get cloned bots, optionally filtered by owner_id and status"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    query = "SELECT id, bot_token, bot_username, bot_name, owner_id, status, pid, created_at, expires_at FROM cloned_bots"
    params = []
    conditions = []
    
    if owner_id:
        conditions.append("owner_id = ?")
        params.append(owner_id)
    if status:
        conditions.append("status = ?")
        params.append(status)
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    query += " ORDER BY created_at DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    bots = []
    for row in rows:
        bots.append({
            'id': row[0],
            'bot_token': row[1],
            'bot_username': row[2],
            'bot_name': row[3],
            'owner_id': row[4],
            'status': row[5],
            'pid': row[6],
            'created_at': row[7],
            'expires_at': row[8]
        })
    return bots

async def get_bot_by_token(bot_token: str) -> Optional[Dict]:
    """Get bot by token"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT id, bot_token, bot_username, bot_name, owner_id, status, pid, created_at, expires_at FROM cloned_bots WHERE bot_token = ?', (bot_token,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'id': row[0],
            'bot_token': row[1],
            'bot_username': row[2],
            'bot_name': row[3],
            'owner_id': row[4],
            'status': row[5],
            'pid': row[6],
            'created_at': row[7],
            'expires_at': row[8]
        }
    return None

async def update_bot_status(bot_token: str, status: str, pid: int = None) -> bool:
    """Update bot status"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    if pid:
        cursor.execute('UPDATE cloned_bots SET status = ?, pid = ? WHERE bot_token = ?', (status, pid, bot_token))
    else:
        cursor.execute('UPDATE cloned_bots SET status = ? WHERE bot_token = ?', (status, bot_token))
    
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0

async def remove_cloned_bot(bot_token: str) -> bool:
    """Remove cloned bot from database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM cloned_bots WHERE bot_token = ?', (bot_token,))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0


# ==================== BOT LOGS FUNCTIONS ====================

async def get_bot_logs(bot_token: str, limit: int = 50) -> List[Dict]:
    """Get logs for a specific bot"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT timestamp, level, message FROM bot_logs 
        WHERE bot_token = ? 
        ORDER BY timestamp DESC LIMIT ?
    ''', (bot_token, limit))
    rows = cursor.fetchall()
    conn.close()
    
    logs = []
    for row in rows:
        logs.append({
            'timestamp': row[0],
            'level': row[1],
            'message': row[2]
        })
    return logs

def add_bot_log_sync(bot_token: str, level: str, message: str):
    """Add bot log synchronously (for subprocess monitoring)"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO bot_logs (bot_token, timestamp, level, message)
        VALUES (?, ?, ?, ?)
    ''', (bot_token, datetime.now().isoformat(), level, message))
    conn.commit()
    conn.close()


# ==================== DEPOSIT FUNCTIONS ====================

async def create_deposit(user_id: int, amount: int, payment_method: str = None, payment_proof: str = None) -> Optional[int]:
    """Create a new deposit request"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO deposits (user_id, amount, payment_method, payment_proof)
        VALUES (?, ?, ?, ?)
    ''', (user_id, amount, payment_method, payment_proof))
    conn.commit()
    deposit_id = cursor.lastrowid
    conn.close()
    return deposit_id

async def update_deposit_status(deposit_id: int, status: str) -> bool:
    """Update deposit status"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    processed_at = datetime.now() if status == 'completed' else None
    cursor.execute('UPDATE deposits SET status = ?, processed_at = ? WHERE id = ?', (status, processed_at, deposit_id))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    
    # If completed, add balance to user
    if status == 'completed' and affected > 0:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT user_id, amount FROM deposits WHERE id = ?', (deposit_id,))
        row = cursor.fetchone()
        if row:
            await add_user_balance(row[0], row[1])
        conn.close()
    
    return affected > 0


# ==================== OWNER ACTIVITIES FUNCTIONS ====================

async def log_owner_activity(user_id: int, action: str, details: str = None):
    """Log owner activity"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO owner_activities (user_id, action, details)
        VALUES (?, ?, ?)
    ''', (user_id, action, details))
    conn.commit()
    conn.close()

async def get_owner_activities(user_id: int, limit: int = 50) -> List[Dict]:
    """Get owner activities"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, action, details, created_at FROM owner_activities
        WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
    ''', (user_id, limit))
    rows = cursor.fetchall()
    conn.close()
    
    activities = []
    for row in rows:
        activities.append({
            'id': row[0],
            'action': row[1],
            'details': row[2],
            'created_at': row[3]
        })
    return activities


# ==================== PANEL SESSIONS FUNCTIONS ====================

async def create_panel_session(user_id: int, expire_hours: int = 24) -> str:
    """Create panel session token"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    session_token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=expire_hours)
    
    cursor.execute('''
        INSERT INTO panel_sessions (user_id, session_token, expires_at)
        VALUES (?, ?, ?)
    ''', (user_id, session_token, expires_at))
    conn.commit()
    conn.close()
    return session_token

async def validate_panel_session(session_token: str) -> Optional[Dict]:
    """Validate panel session"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT user_id, expires_at FROM panel_sessions
        WHERE session_token = ? AND expires_at > ?
    ''', (session_token, datetime.now()))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {'user_id': row[0], 'expires_at': row[1]}
    return None

async def delete_panel_session(session_token: str):
    """Delete panel session"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('DELETE FROM panel_sessions WHERE session_token = ?', (session_token,))
    conn.commit()
    conn.close()


# ==================== BOT CONFIG FUNCTIONS ====================

async def save_bot_fragment_config(bot_token: str, fragment_api_key: str, min_stars: int = 1, max_stars: int = 100, markup_percent: int = 10) -> bool:
    """Save Fragment config for bot"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO bot_fragment_config (bot_token, fragment_api_key, min_stars, max_stars, markup_percent, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (bot_token, fragment_api_key, min_stars, max_stars, markup_percent, datetime.now()))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0

async def get_bot_fragment_config(bot_token: str) -> Optional[Dict]:
    """Get Fragment config for bot"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT fragment_api_key, min_stars, max_stars, markup_percent FROM bot_fragment_config WHERE bot_token = ?', (bot_token,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'fragment_api_key': row[0],
            'min_stars': row[1],
            'max_stars': row[2],
            'markup_percent': row[3]
        }
    return None

async def save_bot_wallet_config(bot_token: str, wallet_address: str, ton_api_key: str = None) -> bool:
    """Save wallet config for bot"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR REPLACE INTO bot_wallet_config (bot_token, wallet_address, ton_api_key, updated_at)
        VALUES (?, ?, ?, ?)
    ''', (bot_token, wallet_address, ton_api_key, datetime.now()))
    conn.commit()
    affected = cursor.rowcount
    conn.close()
    return affected > 0

async def get_bot_wallet_config(bot_token: str) -> Optional[Dict]:
    """Get wallet config for bot"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('SELECT wallet_address, ton_api_key FROM bot_wallet_config WHERE bot_token = ?', (bot_token,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'wallet_address': row[0],
            'ton_api_key': row[1]
        }
    return None


# ==================== STATISTICS FUNCTIONS ====================

async def get_master_stats() -> Dict:
    """Get master statistics"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM panel_users")
    total_users = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM cloned_bots")
    total_bots = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE status = 'running'")
    running_bots = cursor.fetchone()[0]
    
    cursor.execute("SELECT SUM(amount) FROM deposits WHERE status = 'completed'")
    total_revenue = cursor.fetchone()[0] or 0
    
    cursor.execute("SELECT SUM(amount) FROM deposits WHERE status = 'completed'")
    total_deposits = cursor.fetchone()[0] or 0
    
    conn.close()
    
    return {
        'total_users': total_users,
        'total_bots': total_bots,
        'running_bots': running_bots,
        'total_revenue': total_revenue,
        'total_deposits': total_deposits,
        'total_stars': 0,
        'total_volume': 0
    }

async def get_owner_stats(owner_id: int) -> Dict:
    """Get statistics for specific owner"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE owner_id = ?", (owner_id,))
    total_bots = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM cloned_bots WHERE owner_id = ? AND status = 'running'", (owner_id,))
    running_bots = cursor.fetchone()[0]
    
    cursor.execute('''
        SELECT SUM(amount) FROM deposits 
        WHERE user_id = ? AND status = 'completed'
    ''', (owner_id,))
    total_deposits = cursor.fetchone()[0] or 0
    
    conn.close()
    
    return {
        'total_bots': total_bots,
        'running_bots': running_bots,
        'total_deposits': total_deposits,
        'total_stars': 0,
        'total_volume': 0
    }


# ==================== MAIN ====================
if __name__ == '__main__':
    init_database()
    print("Database initialized successfully!")