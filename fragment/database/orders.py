# fragment/database/orders.py
import sqlite3
import logging
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

# Database path for MASTER BOT
from fragment.database.data import DB_PATH as MASTER_DB_PATH
from fragment.database.data import hash_password, get_jakarta_time_iso


def init_bot_orders_table():
    """Initialize bot_orders table for tracking orders"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bot_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT UNIQUE NOT NULL,
                plan TEXT NOT NULL,
                bot_token TEXT NOT NULL,
                telegram_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                amount INTEGER NOT NULL,
                status TEXT DEFAULT 'pending',
                pakasir_payment_id TEXT,
                qr_string TEXT,
                created_at TIMESTAMP,
                expires_at TIMESTAMP,
                completed_at TIMESTAMP,
                owner_id INTEGER
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("✅ bot_orders table initialized")
    except Exception as e:
        logger.error(f"Error initializing bot_orders table: {e}")


def save_bot_order(order_id: str, plan: str, bot_token: str, telegram_id: int,
                   username: str, password: str, amount: int, pakasir_payment_id: str = None,
                   qr_string: str = None) -> bool:
    """Save bot order to database"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        expires_at = (datetime.now() + timedelta(hours=24)).isoformat()
        
        password_hash = hash_password(password)
        
        cursor.execute('''
            INSERT INTO bot_orders (
                order_id, plan, bot_token, telegram_id, username, password_hash,
                amount, status, pakasir_payment_id, qr_string, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
        ''', (order_id, plan, bot_token, telegram_id, username, password_hash,
              amount, pakasir_payment_id, qr_string, now, expires_at))
        
        conn.commit()
        conn.close()
        logger.info(f"Bot order saved: {order_id}")
        return True
    except Exception as e:
        logger.error(f"Error saving bot order: {e}")
        return False


def get_bot_order(order_id: str) -> dict:
    """Get bot order by order_id"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute('''
            SELECT id, order_id, plan, bot_token, telegram_id, username, password_hash,
                   amount, status, pakasir_payment_id, qr_string, created_at, expires_at, completed_at, owner_id
            FROM bot_orders WHERE order_id = ?
        ''', (order_id,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                'id': row[0],
                'order_id': row[1],
                'plan': row[2],
                'bot_token': row[3],
                'telegram_id': row[4],
                'username': row[5],
                'password_hash': row[6],
                'amount': row[7],
                'status': row[8],
                'pakasir_payment_id': row[9],
                'qr_string': row[10],
                'created_at': row[11],
                'expires_at': row[12],
                'completed_at': row[13],
                'owner_id': row[14]
            }
        return None
    except Exception as e:
        logger.error(f"Error getting bot order: {e}")
        return None


def update_bot_order_status(order_id: str, status: str, owner_id: int = None, completed_at: str = None) -> bool:
    """Update bot order status"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        now = get_jakarta_time_iso()
        
        if status == 'completed':
            if owner_id:
                cursor.execute('''
                    UPDATE bot_orders SET status = ?, completed_at = ?, owner_id = ? WHERE order_id = ?
                ''', (status, now, owner_id, order_id))
            else:
                cursor.execute('''
                    UPDATE bot_orders SET status = ?, completed_at = ? WHERE order_id = ?
                ''', (status, now, order_id))
        else:
            cursor.execute('''
                UPDATE bot_orders SET status = ? WHERE order_id = ?
            ''', (status, order_id))
        
        conn.commit()
        conn.close()
        logger.info(f"Bot order {order_id} status updated to {status}")
        return True
    except Exception as e:
        logger.error(f"Error updating bot order status: {e}")
        return False


def check_bot_token_exists(bot_token: str) -> bool:
    """Check if bot token already exists in database"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM cloned_bots WHERE bot_token = ?", (bot_token,))
        row = cursor.fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        logger.error(f"Error checking bot token: {e}")
        return False


def check_username_exists(username: str) -> bool:
    """Check if username already exists in database"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM bot_owners WHERE username = ?", (username,))
        row = cursor.fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        logger.error(f"Error checking username: {e}")
        return False


def check_telegram_id_exists(telegram_id: int) -> bool:
    """Check if telegram_id already exists in database"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM bot_owners WHERE telegram_id = ?", (telegram_id,))
        row = cursor.fetchone()
        conn.close()
        return row is not None
    except Exception as e:
        logger.error(f"Error checking telegram_id: {e}")
        return False


def get_bot_owner_by_username(username: str) -> dict:
    """Get bot owner by username"""
    try:
        conn = sqlite3.connect(str(MASTER_DB_PATH))
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, owner_name, email, whatsapp, balance, is_active, created_at, expires_at
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


# Initialize table on import
init_bot_orders_table()