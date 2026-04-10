import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any

class GiveawayDatabase:
    def __init__(self, db_path: str = "/root/wtb/giveaway/giveaway.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database tables"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Table for giveaways
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS giveaways (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    giveaway_id TEXT UNIQUE NOT NULL,
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
    
    def create_giveaway(self, giveaway_id: str, chat_id: int, message_id: int, 
                       prize: str, winners_count: int, end_time: str) -> bool:
        """Create a new giveaway"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO giveaways 
                    (giveaway_id, chat_id, message_id, prize, winners_count, end_time)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (giveaway_id, chat_id, message_id, prize, winners_count, end_time))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error creating giveaway: {e}")
            return False
    
    def add_participant(self, giveaway_id: str, user_id: int, username: str = "", first_name: str = "") -> bool:
        """Add a participant to giveaway"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Check if already participated
                cursor.execute('''
                    SELECT id FROM giveaway_entries 
                    WHERE giveaway_id = ? AND user_id = ?
                ''', (giveaway_id, user_id))
                
                if cursor.fetchone():
                    return False
                
                # Add participant
                cursor.execute('''
                    INSERT INTO giveaway_entries (giveaway_id, user_id, username, first_name)
                    VALUES (?, ?, ?, ?)
                ''', (giveaway_id, user_id, username, first_name))
                
                # Update participants list in giveaways table
                cursor.execute('''
                    SELECT participants FROM giveaways WHERE giveaway_id = ?
                ''', (giveaway_id,))
                result = cursor.fetchone()
                
                if result:
                    participants = json.loads(result[0]) if result[0] else []
                    participants.append(user_id)
                    cursor.execute('''
                        UPDATE giveaways SET participants = ? WHERE giveaway_id = ?
                    ''', (json.dumps(participants), giveaway_id))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding participant: {e}")
            return False
    
    def get_giveaway(self, giveaway_id: str) -> Optional[Dict[str, Any]]:
        """Get giveaway details"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                row = cursor.fetchone()
                
                if row:
                    columns = [description[0] for description in cursor.description]
                    giveaway = dict(zip(columns, row))
                    giveaway['participants'] = json.loads(giveaway['participants']) if giveaway['participants'] else []
                    giveaway['winners'] = json.loads(giveaway['winners']) if giveaway['winners'] else []
                    return giveaway
                return None
        except Exception as e:
            print(f"Error getting giveaway: {e}")
            return None
    
    def get_active_giveaways(self) -> List[Dict[str, Any]]:
        """Get all active giveaways"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM giveaways 
                    WHERE status = 'active' AND end_time > datetime('now')
                    ORDER BY end_time ASC
                ''')
                rows = cursor.fetchall()
                
                giveaways = []
                for row in rows:
                    columns = [description[0] for description in cursor.description]
                    giveaway = dict(zip(columns, row))
                    giveaway['participants'] = json.loads(giveaway['participants']) if giveaway['participants'] else []
                    giveaway['winners'] = json.loads(giveaway['winners']) if giveaway['winners'] else []
                    giveaways.append(giveaway)
                
                return giveaways
        except Exception as e:
            print(f"Error getting active giveaways: {e}")
            return []
    
    def get_participants(self, giveaway_id: str) -> List[Dict[str, Any]]:
        """Get all participants for a giveaway"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT user_id, username, first_name, joined_at 
                    FROM giveaway_entries 
                    WHERE giveaway_id = ?
                    ORDER BY joined_at ASC
                ''', (giveaway_id,))
                rows = cursor.fetchall()
                
                participants = []
                for row in rows:
                    participants.append({
                        'user_id': row[0],
                        'username': row[1],
                        'first_name': row[2],
                        'joined_at': row[3]
                    })
                
                return participants
        except Exception as e:
            print(f"Error getting participants: {e}")
            return []
    
    def select_winners(self, giveaway_id: str, winners_count: int) -> List[int]:
        """Select winners randomly from participants"""
        import random
        
        participants = self.get_participants(giveaway_id)
        if not participants:
            return []
        
        participant_ids = [p['user_id'] for p in participants]
        winners_count = min(winners_count, len(participant_ids))
        winners = random.sample(participant_ids, winners_count)
        
        # Update winners in database
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE giveaways 
                SET winners = ?, status = 'ended'
                WHERE giveaway_id = ?
            ''', (json.dumps(winners), giveaway_id))
            conn.commit()
        
        return winners
    
    def end_expired_giveaways(self) -> List[Dict[str, Any]]:
        """End expired giveaways and return them"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM giveaways 
                    WHERE status = 'active' AND end_time <= datetime('now')
                ''')
                rows = cursor.fetchall()
                
                expired_giveaways = []
                for row in rows:
                    columns = [description[0] for description in cursor.description]
                    giveaway = dict(zip(columns, row))
                    giveaway['participants'] = json.loads(giveaway['participants']) if giveaway['participants'] else []
                    giveaway['winners'] = json.loads(giveaway['winners']) if giveaway['winners'] else []
                    expired_giveaways.append(giveaway)
                
                # Update status for expired giveaways
                for giveaway in expired_giveaways:
                    cursor.execute('''
                        UPDATE giveaways SET status = 'ended'
                        WHERE giveaway_id = ?
                    ''', (giveaway['giveaway_id'],))
                
                conn.commit()
                return expired_giveaways
        except Exception as e:
            print(f"Error ending expired giveaways: {e}")
            return []
    
    def delete_giveaway(self, giveaway_id: str) -> bool:
        """Delete a giveaway"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('DELETE FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                cursor.execute('DELETE FROM giveaway_entries WHERE giveaway_id = ?', (giveaway_id,))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error deleting giveaway: {e}")
            return False