import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
import os
from pathlib import Path

class CekIpDatabase:
    def __init__(self, db_path: str = None):
        if db_path is None:
            ROOT_DIR = Path(__file__).parent.parent
            db_path = str(ROOT_DIR / 'giveaway' / 'database' / 'giveaway.db')
        self.db_path = db_path
        self.init_tables()

    def get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_tables(self):
        with self.get_conn() as conn:
            cursor = conn.cursor()

            # Tabel ip_tracking
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ip_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ip TEXT NOT NULL,
                    country TEXT,
                    city TEXT,
                    lat REAL,
                    lon REAL,
                    isp TEXT,
                    user_agent TEXT,
                    user_id INTEGER,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    photo_url TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(ip, user_id)
                )
            ''')

            # Index untuk mempercepat query
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_ip_tracking_ip ON ip_tracking(ip)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_ip_tracking_user_id ON ip_tracking(user_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_ip_tracking_created_at ON ip_tracking(created_at)')

            conn.commit()
            print("[CekIpDB] Tables initialized")

    def save_ip_tracking(self, data: dict) -> bool:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO ip_tracking 
                    (ip, country, city, lat, lon, isp, user_agent, user_id, username, first_name, last_name, photo_url, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    data.get('ip'),
                    data.get('country'),
                    data.get('city'),
                    data.get('lat', 0),
                    data.get('lon', 0),
                    data.get('isp'),
                    data.get('user_agent'),
                    data.get('user_id'),
                    data.get('username'),
                    data.get('first_name'),
                    data.get('last_name'),
                    data.get('photo_url'),
                    datetime.now().isoformat()
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"[CekIpDB] Error saving ip tracking: {e}")
            return False

    def get_all_ip_tracking(self, limit: int = 100) -> List[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM ip_tracking 
                    ORDER BY created_at DESC 
                    LIMIT ?
                ''', (limit,))
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"[CekIpDB] Error getting ip tracking: {e}")
            return []

    def get_ip_tracking_by_user(self, user_id: int) -> List[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM ip_tracking 
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                ''', (user_id,))
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"[CekIpDB] Error getting ip tracking by user: {e}")
            return []

    def get_ip_tracking_by_ip(self, ip: str) -> List[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM ip_tracking 
                    WHERE ip = ?
                    ORDER BY created_at DESC
                ''', (ip,))
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"[CekIpDB] Error getting ip tracking by ip: {e}")
            return []

    def get_statistics(self) -> Dict:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                
                # Total records
                cursor.execute('SELECT COUNT(*) FROM ip_tracking')
                total = cursor.fetchone()[0] or 0
                
                # Unique IPs
                cursor.execute('SELECT COUNT(DISTINCT ip) FROM ip_tracking')
                unique_ips = cursor.fetchone()[0] or 0
                
                # Unique users (Telegram users only)
                cursor.execute('SELECT COUNT(DISTINCT user_id) FROM ip_tracking WHERE user_id IS NOT NULL')
                unique_users = cursor.fetchone()[0] or 0
                
                # Today's captures
                today = datetime.now().strftime('%Y-%m-%d')
                cursor.execute('''
                    SELECT COUNT(*) FROM ip_tracking 
                    WHERE date(created_at) = ?
                ''', (today,))
                today_count = cursor.fetchone()[0] or 0
                
                return {
                    'total': total,
                    'unique_ips': unique_ips,
                    'unique_users': unique_users,
                    'today_count': today_count
                }
        except Exception as e:
            print(f"[CekIpDB] Error getting statistics: {e}")
            return {
                'total': 0,
                'unique_ips': 0,
                'unique_users': 0,
                'today_count': 0
            }