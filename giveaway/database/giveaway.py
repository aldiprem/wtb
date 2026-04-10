import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
import pytz

class GiveawayDatabase:
    def __init__(self, db_path: str = "/root/wtb/giveaway/giveaway.db"):
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
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()

            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    user_id INTEGER PRIMARY KEY,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    is_admin BOOLEAN DEFAULT 0,
                    first_seen TIMESTAMP,
                    last_seen TIMESTAMP
                )
            ''')

            # Table for giveaways - tambahkan kolom user_id
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS giveaways (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    giveaway_id TEXT UNIQUE NOT NULL,
                    user_id INTEGER DEFAULT 0,
                    chat_id INTEGER NOT NULL,
                    message_id INTEGER NOT NULL,
                    prize TEXT NOT NULL,
                    winners_count INTEGER DEFAULT 1,
                    end_time TEXT NOT NULL,
                    status TEXT DEFAULT 'active',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    winners TEXT DEFAULT '[]',
                    participants TEXT DEFAULT '[]'
                )
            ''')
            
            # Table for user entries
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS giveaway_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    giveaway_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (giveaway_id) REFERENCES giveaways(giveaway_id)
                )
            ''')
            
            conn.commit()

    def save_user(self, user_id: int, username: str = "", first_name: str = "", last_name: str = "") -> bool:
        """Save or update user information"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Cek apakah user sudah ada
                cursor.execute('SELECT user_id FROM users WHERE user_id = ?', (user_id,))
                existing = cursor.fetchone()
                
                now = self._get_now()
                
                if existing:
                    # Update existing user
                    cursor.execute('''
                        UPDATE users 
                        SET username = ?, first_name = ?, last_name = ?, last_seen = ?
                        WHERE user_id = ?
                    ''', (username, first_name, last_name, now, user_id))
                else:
                    # Insert new user
                    cursor.execute('''
                        INSERT INTO users (user_id, username, first_name, last_name, first_seen, last_seen)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (user_id, username, first_name, last_name, now, now))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error saving user: {e}")
            return False

    def get_user(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user information by user_id"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_id, username, first_name, last_name, is_admin, first_seen, last_seen
                    FROM users WHERE user_id = ?
                ''', (user_id,))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'user_id': row[0],
                        'username': row[1],
                        'first_name': row[2],
                        'last_name': row[3],
                        'is_admin': bool(row[4]),
                        'first_seen': row[5],
                        'last_seen': row[6]
                    }
                return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user information by username"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_id, username, first_name, last_name, is_admin, first_seen, last_seen
                    FROM users WHERE username = ?
                ''', (username,))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'user_id': row[0],
                        'username': row[1],
                        'first_name': row[2],
                        'last_name': row[3],
                        'is_admin': bool(row[4]),
                        'first_seen': row[5],
                        'last_seen': row[6]
                    }
                return None
        except Exception as e:
            print(f"Error getting user by username: {e}")
            return None

    def get_all_users(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Get all users with pagination"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_id, username, first_name, last_name, is_admin, first_seen, last_seen
                    FROM users ORDER BY last_seen DESC LIMIT ? OFFSET ?
                ''', (limit, offset))
                rows = cursor.fetchall()
                
                users = []
                for row in rows:
                    users.append({
                        'user_id': row[0],
                        'username': row[1],
                        'first_name': row[2],
                        'last_name': row[3],
                        'is_admin': bool(row[4]),
                        'first_seen': row[5],
                        'last_seen': row[6]
                    })
                return users
        except Exception as e:
            print(f"Error getting all users: {e}")
            return []

    def delete_user(self, user_id: int) -> bool:
        """Delete user from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Hapus user dari tabel users
                cursor.execute('DELETE FROM users WHERE user_id = ?', (user_id,))
                
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting user: {e}")
            return False

    def get_total_users_count(self) -> int:
        """Get total number of users"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT COUNT(*) FROM users')
                row = cursor.fetchone()
                return row[0] if row else 0
        except Exception as e:
            print(f"Error getting total users count: {e}")
            return 0

    def add_hadiah(self, giveaway_id: str, hadiah_text: str, is_append: bool = True) -> bool:
        """
        Add a single hadiah to existing giveaway
        Args:
            giveaway_id: ID of the giveaway
            hadiah_text: The prize description to add
            is_append: If True, append to existing hadiah; if False, replace
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get current prize
                cursor.execute('SELECT prize FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                result = cursor.fetchone()
                
                if not result:
                    return False
                
                current_prize = result[0] or ''
                
                if is_append and current_prize:
                    # Split existing hadiah
                    existing_hadiah = [h.strip() for h in current_prize.split('\n') if h.strip()]
                    # Add new hadiah
                    existing_hadiah.append(hadiah_text)
                    # Format with numbering
                    new_prize = '\n'.join([f"{i+1}. {h}" for i, h in enumerate(existing_hadiah)])
                else:
                    # Replace with single hadiah
                    new_prize = f"1. {hadiah_text}"
                
                cursor.execute('UPDATE giveaways SET prize = ? WHERE giveaway_id = ?', (new_prize, giveaway_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding hadiah: {e}")
            return False

    def add_hadiah_batch(self, giveaway_id: str, hadiah_list: List[str]) -> bool:
        """
        Add multiple hadiah to a giveaway (replace existing)
        Args:
            giveaway_id: ID of the giveaway
            hadiah_list: List of prize descriptions
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Format hadiah with numbering
                formatted_hadiah = '\n'.join([f"{i+1}. {h}" for i, h in enumerate(hadiah_list) if h.strip()])
                
                cursor.execute('UPDATE giveaways SET prize = ? WHERE giveaway_id = ?', (formatted_hadiah, giveaway_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding hadiah batch: {e}")
            return False

    def get_hadiah(self, giveaway_id: str) -> List[str]:
        """
        Get all hadiah as list from a giveaway
        Args:
            giveaway_id: ID of the giveaway
        Returns:
            List of hadiah texts (without numbering)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT prize FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                result = cursor.fetchone()
                
                if not result or not result[0]:
                    return []
                
                prize = result[0]
                # Split by newline and remove numbering (e.g., "1. Hadiah Text" -> "Hadiah Text")
                hadiah_list = []
                for line in prize.split('\n'):
                    line = line.strip()
                    if line:
                        # Remove numbering pattern like "1. ", "2. ", etc.
                        import re
                        cleaned = re.sub(r'^\d+\.\s*', '', line)
                        hadiah_list.append(cleaned)
                
                return hadiah_list
        except Exception as e:
            print(f"Error getting hadiah: {e}")
            return []

    def get_hadiah_formatted(self, giveaway_id: str) -> str:
        """
        Get formatted hadiah string (with numbering) from a giveaway
        Args:
            giveaway_id: ID of the giveaway
        Returns:
            Formatted string with numbered list
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT prize FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                result = cursor.fetchone()
                
                if not result or not result[0]:
                    return ''
                
                return result[0]
        except Exception as e:
            print(f"Error getting formatted hadiah: {e}")
            return ''

    def delete_hadiah(self, giveaway_id: str, index: int = None) -> bool:
        """
        Delete hadiah from a giveaway
        Args:
            giveaway_id: ID of the giveaway
            index: Specific index to delete (1-based). If None, delete all hadiah
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT prize FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                result = cursor.fetchone()
                
                if not result or not result[0]:
                    return False
                
                current_prize = result[0]
                
                if index is None:
                    # Delete all hadiah
                    new_prize = ''
                else:
                    # Delete specific index
                    lines = current_prize.split('\n')
                    new_lines = []
                    current_index = 1
                    
                    for line in lines:
                        line = line.strip()
                        if line:
                            if current_index != index:
                                # Re-number remaining lines
                                import re
                                cleaned = re.sub(r'^\d+\.\s*', '', line)
                                new_lines.append(f"{len(new_lines) + 1}. {cleaned}")
                            current_index += 1
                    
                    new_prize = '\n'.join(new_lines)
                
                cursor.execute('UPDATE giveaways SET prize = ? WHERE giveaway_id = ?', (new_prize, giveaway_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error deleting hadiah: {e}")
            return False

    def update_hadiah(self, giveaway_id: str, index: int, new_hadiah_text: str) -> bool:
        """
        Update a specific hadiah in a giveaway
        Args:
            giveaway_id: ID of the giveaway
            index: Index of hadiah to update (1-based)
            new_hadiah_text: New prize description
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT prize FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                result = cursor.fetchone()
                
                if not result or not result[0]:
                    return False
                
                current_prize = result[0]
                lines = current_prize.split('\n')
                new_lines = []
                current_index = 1
                
                for line in lines:
                    line = line.strip()
                    if line:
                        if current_index == index:
                            new_lines.append(f"{current_index}. {new_hadiah_text}")
                        else:
                            import re
                            cleaned = re.sub(r'^\d+\.\s*', '', line)
                            new_lines.append(f"{current_index}. {cleaned}")
                        current_index += 1
                
                new_prize = '\n'.join(new_lines)
                cursor.execute('UPDATE giveaways SET prize = ? WHERE giveaway_id = ?', (new_prize, giveaway_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error updating hadiah: {e}")
            return False

    def count_hadiah(self, giveaway_id: str) -> int:
        """
        Count total hadiah in a giveaway
        Args:
            giveaway_id: ID of the giveaway
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT prize FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                result = cursor.fetchone()
                
                if not result or not result[0]:
                    return 0
                
                # Count non-empty lines
                lines = [line.strip() for line in result[0].split('\n') if line.strip()]
                return len(lines)
        except Exception as e:
            print(f"Error counting hadiah: {e}")
            return 0

    def add_chat(self, user_id: int, chat_id: str, chat_type: str = "", username: str = "", title: str = "") -> bool:
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create table if not exists
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS user_chats (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        chat_id TEXT NOT NULL,
                        chat_type TEXT DEFAULT '',
                        username TEXT DEFAULT '',
                        title TEXT DEFAULT '',
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, chat_id)
                    )
                ''')
                
                # Check if already exists
                cursor.execute('''
                    SELECT 1 FROM user_chats WHERE user_id = ? AND chat_id = ?
                ''', (user_id, chat_id))
                
                if cursor.fetchone():
                    return False  # Already exists
                
                # Insert new chat
                cursor.execute('''
                    INSERT INTO user_chats (user_id, chat_id, chat_type, username, title)
                    VALUES (?, ?, ?, ?, ?)
                ''', (user_id, chat_id, chat_type, username, title))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding chat: {e}")
            return False

    def get_user_chats(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all chats for a user
        Args:
            user_id: User ID
        Returns:
            List of chat dictionaries
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Create table if not exists
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS user_chats (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        chat_id TEXT NOT NULL,
                        chat_type TEXT DEFAULT '',
                        username TEXT DEFAULT '',
                        title TEXT DEFAULT '',
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(user_id, chat_id)
                    )
                ''')
                
                cursor.execute('''
                    SELECT id, chat_id, chat_type, username, title, created_at
                    FROM user_chats WHERE user_id = ?
                    ORDER BY created_at DESC
                ''', (user_id,))
                rows = cursor.fetchall()
                
                chats = []
                for row in rows:
                    chats.append({
                        'id': row[0],
                        'chat_id': row[1],
                        'chat_type': row[2],
                        'username': row[3],
                        'title': row[4],
                        'created_at': row[5]
                    })
                return chats
        except Exception as e:
            print(f"Error getting user chats: {e}")
            return []

    def get_chat_by_id(self, user_id: int, chat_id: str) -> Optional[Dict[str, Any]]:
        """
        Get specific chat by ID for a user
        Args:
            user_id: User ID
            chat_id: Chat ID to find
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT id, chat_id, chat_type, username, title, created_at
                    FROM user_chats WHERE user_id = ? AND chat_id = ?
                ''', (user_id, chat_id))
                row = cursor.fetchone()
                
                if row:
                    return {
                        'id': row[0],
                        'chat_id': row[1],
                        'chat_type': row[2],
                        'username': row[3],
                        'title': row[4],
                        'created_at': row[5]
                    }
                return None
        except Exception as e:
            print(f"Error getting chat by id: {e}")
            return None

    def delete_chat(self, user_id: int, chat_id: str = None, chat_index: int = None) -> bool:
        """
        Delete a chat for a user
        Args:
            user_id: User ID
            chat_id: Chat ID to delete (if None, delete by index)
            chat_index: Index in the list (1-based, if chat_id is None)
        """
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                if chat_id is not None:
                    cursor.execute('''
                        DELETE FROM user_chats WHERE user_id = ? AND chat_id = ?
                    ''', (user_id, chat_id))
                elif chat_index is not None:
                    # Get chat by index
                    cursor.execute('''
                        SELECT chat_id FROM user_chats 
                        WHERE user_id = ? ORDER BY created_at DESC
                        LIMIT 1 OFFSET ?
                    ''', (user_id, chat_index - 1))
                    row = cursor.fetchone()
                    if row:
                        cursor.execute('''
                            DELETE FROM user_chats WHERE user_id = ? AND chat_id = ?
                        ''', (user_id, row[0]))
                else:
                    # Delete all chats for user
                    cursor.execute('DELETE FROM user_chats WHERE user_id = ?', (user_id,))
                
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting chat: {e}")
            return False

    def delete_all_chats(self, user_id: int) -> bool:
        """Delete all chats for a user"""
        return self.delete_chat(user_id)

    def count_user_chats(self, user_id: int) -> int:
        """Count total chats for a user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT COUNT(*) FROM user_chats WHERE user_id = ?', (user_id,))
                row = cursor.fetchone()
                return row[0] if row else 0
        except Exception as e:
            print(f"Error counting user chats: {e}")
            return 0

    def get_user_saved_chats(self, user_id: int) -> list:
        """Get saved chats from user_state (not from database)"""
        return []