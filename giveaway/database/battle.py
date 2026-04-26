# giveaway/database/battle.py
# Database layer untuk Battle Game

import sqlite3
import json
import os
import random
import string
from datetime import datetime
from typing import Dict, List, Optional, Any
from pathlib import Path


class BattleDatabase:
    def __init__(self, db_path: str = None):
        if db_path is None:
            ROOT_DIR = Path(__file__).parent.parent.parent
            db_path = str(ROOT_DIR / 'giveaway' / 'database' / 'giveaway.db')
        self.db_path = db_path
        self.init_tables()

    def get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_tables(self):
        """Buat tabel battle jika belum ada"""
        with self.get_conn() as conn:
            cursor = conn.cursor()

            # Tabel battle utama
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS battles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    battle_id TEXT UNIQUE NOT NULL,
                    battle_code TEXT UNIQUE NOT NULL,
                    creator_id INTEGER NOT NULL,
                    group_id INTEGER,
                    group_title TEXT,
                    group_username TEXT,
                    prize TEXT NOT NULL,
                    winners_count INTEGER DEFAULT 1,
                    deadline_minutes INTEGER DEFAULT 5,
                    end_time TEXT,
                    captcha TEXT DEFAULT 'Off',
                    status TEXT DEFAULT 'active',
                    message_id INTEGER,
                    created_at TEXT NOT NULL,
                    is_ended INTEGER DEFAULT 0
                )
            ''')

            # Tabel pesan battle (snapshot pesan terakhir saat battle berakhir)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS battle_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    battle_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    photo_url TEXT,
                    message_id INTEGER NOT NULL,
                    message_text TEXT,
                    sent_at TEXT NOT NULL,
                    rank INTEGER,
                    prize_won TEXT,
                    is_winner INTEGER DEFAULT 0,
                    FOREIGN KEY (battle_id) REFERENCES battles(battle_id)
                )
            ''')

            # Tabel peserta battle (semua yang berpartisipasi / mengirim pesan)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS battle_participants (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    battle_id TEXT NOT NULL,
                    user_id INTEGER NOT NULL,
                    username TEXT,
                    first_name TEXT,
                    last_name TEXT,
                    photo_url TEXT,
                    joined_at TEXT NOT NULL,
                    message_count INTEGER DEFAULT 0,
                    last_message_id INTEGER,
                    last_message_at TEXT,
                    is_winner INTEGER DEFAULT 0,
                    prize_won TEXT,
                    UNIQUE(battle_id, user_id),
                    FOREIGN KEY (battle_id) REFERENCES battles(battle_id)
                )
            ''')

            conn.commit()
            print("[BattleDB] Tables initialized")

    # ==================== BATTLE CRUD ====================

    def create_battle(
        self,
        battle_id: str,
        battle_code: str,
        creator_id: int,
        group_id: int,
        group_title: str,
        group_username: str,
        prize: str,
        winners_count: int,
        deadline_minutes: int,
        end_time: str,
        captcha: str,
        message_id: int = None
    ) -> bool:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO battles
                    (battle_id, battle_code, creator_id, group_id, group_title,
                     group_username, prize, winners_count, deadline_minutes,
                     end_time, captcha, status, message_id, created_at, is_ended)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
                ''', (
                    battle_id, battle_code, creator_id, group_id, group_title,
                    group_username, prize, winners_count, deadline_minutes,
                    end_time, captcha, 'active', message_id,
                    datetime.now().isoformat()
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"[BattleDB] create_battle error: {e}")
            return False

    def get_battle(self, battle_code: str) -> Optional[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM battles WHERE battle_code = ?', (battle_code,))
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            print(f"[BattleDB] get_battle error: {e}")
            return None

    def get_battle_by_id(self, battle_id: str) -> Optional[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM battles WHERE battle_id = ?', (battle_id,))
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            print(f"[BattleDB] get_battle_by_id error: {e}")
            return None

    def end_battle(self, battle_id: str) -> bool:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'UPDATE battles SET status = ?, is_ended = 1 WHERE battle_id = ?',
                    ('ended', battle_id)
                )
                conn.commit()
                return True
        except Exception as e:
            print(f"[BattleDB] end_battle error: {e}")
            return False

    def get_active_battles(self) -> List[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT * FROM battles WHERE status = ? AND is_ended = 0 ORDER BY created_at DESC',
                    ('active',)
                )
                return [dict(r) for r in cursor.fetchall()]
        except Exception as e:
            print(f"[BattleDB] get_active_battles error: {e}")
            return []

    def get_recent_battles(self, limit: int = 10) -> List[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT * FROM battles ORDER BY created_at DESC LIMIT ?',
                    (limit,)
                )
                return [dict(r) for r in cursor.fetchall()]
        except Exception as e:
            print(f"[BattleDB] get_recent_battles error: {e}")
            return []

    # ==================== MESSAGES ====================

    def upsert_message(
        self,
        battle_id: str,
        user_id: int,
        username: str,
        first_name: str,
        last_name: str,
        photo_url: str,
        message_id: int,
        message_text: str,
        sent_at: str
    ) -> bool:
        """Simpan / update snapshot pesan user dalam battle"""
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                # Cek apakah user sudah ada
                cursor.execute(
                    'SELECT id FROM battle_messages WHERE battle_id = ? AND user_id = ?',
                    (battle_id, user_id)
                )
                existing = cursor.fetchone()

                if existing:
                    cursor.execute('''
                        UPDATE battle_messages
                        SET username=?, first_name=?, last_name=?, photo_url=?,
                            message_id=?, message_text=?, sent_at=?
                        WHERE battle_id=? AND user_id=?
                    ''', (
                        username, first_name, last_name, photo_url,
                        message_id, message_text, sent_at,
                        battle_id, user_id
                    ))
                else:
                    cursor.execute('''
                        INSERT INTO battle_messages
                        (battle_id, user_id, username, first_name, last_name,
                         photo_url, message_id, message_text, sent_at)
                        VALUES (?,?,?,?,?,?,?,?,?)
                    ''', (
                        battle_id, user_id, username, first_name, last_name,
                        photo_url, message_id, message_text, sent_at
                    ))
                conn.commit()
                return True
        except Exception as e:
            print(f"[BattleDB] upsert_message error: {e}")
            return False

    def get_battle_messages(self, battle_id: str) -> List[Dict]:
        """Ambil semua snapshot pesan battle, diurutkan dari terbaru"""
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT * FROM battle_messages WHERE battle_id = ? ORDER BY sent_at DESC',
                    (battle_id,)
                )
                return [dict(r) for r in cursor.fetchall()]
        except Exception as e:
            print(f"[BattleDB] get_battle_messages error: {e}")
            return []

    def set_message_rank(self, battle_id: str, user_id: int, rank: int, prize_won: str, is_winner: int) -> bool:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE battle_messages
                    SET rank=?, prize_won=?, is_winner=?
                    WHERE battle_id=? AND user_id=?
                ''', (rank, prize_won, is_winner, battle_id, user_id))
                conn.commit()
                return True
        except Exception as e:
            print(f"[BattleDB] set_message_rank error: {e}")
            return False

    # ==================== PARTICIPANTS ====================

    def upsert_participant(
        self,
        battle_id: str,
        user_id: int,
        username: str,
        first_name: str,
        last_name: str,
        photo_url: str,
        message_id: int = None,
        message_at: str = None
    ) -> bool:
        """Tambah / update peserta battle"""
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT id, message_count FROM battle_participants WHERE battle_id=? AND user_id=?',
                    (battle_id, user_id)
                )
                existing = cursor.fetchone()

                if existing:
                    new_count = (existing['message_count'] or 0) + 1
                    cursor.execute('''
                        UPDATE battle_participants
                        SET username=?, first_name=?, last_name=?, photo_url=?,
                            message_count=?, last_message_id=?, last_message_at=?
                        WHERE battle_id=? AND user_id=?
                    ''', (
                        username, first_name, last_name, photo_url,
                        new_count, message_id, message_at,
                        battle_id, user_id
                    ))
                else:
                    cursor.execute('''
                        INSERT INTO battle_participants
                        (battle_id, user_id, username, first_name, last_name,
                         photo_url, joined_at, message_count, last_message_id, last_message_at)
                        VALUES (?,?,?,?,?,?,?,1,?,?)
                    ''', (
                        battle_id, user_id, username, first_name, last_name,
                        photo_url, datetime.now().isoformat(), message_id, message_at
                    ))
                conn.commit()
                return True
        except Exception as e:
            print(f"[BattleDB] upsert_participant error: {e}")
            return False

    def get_participants(self, battle_id: str) -> List[Dict]:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT * FROM battle_participants WHERE battle_id=? ORDER BY last_message_at DESC',
                    (battle_id,)
                )
                return [dict(r) for r in cursor.fetchall()]
        except Exception as e:
            print(f"[BattleDB] get_participants error: {e}")
            return []

    def mark_winners(self, battle_id: str, winner_user_ids: List[int], prizes: List[str]) -> bool:
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                for uid, prize in zip(winner_user_ids, prizes):
                    cursor.execute('''
                        UPDATE battle_participants
                        SET is_winner=1, prize_won=?
                        WHERE battle_id=? AND user_id=?
                    ''', (prize, battle_id, uid))
                conn.commit()
                return True
        except Exception as e:
            print(f"[BattleDB] mark_winners error: {e}")
            return False

    def get_user_battle_stats(self, user_id: int) -> Dict:
        """Statistik battle untuk user tertentu"""
        try:
            with self.get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT COUNT(DISTINCT battle_id) FROM battle_participants WHERE user_id=?',
                    (user_id,)
                )
                participated = cursor.fetchone()[0] or 0

                cursor.execute(
                    'SELECT COUNT(DISTINCT battle_id) FROM battle_participants WHERE user_id=? AND is_winner=1',
                    (user_id,)
                )
                won = cursor.fetchone()[0] or 0

                cursor.execute(
                    'SELECT COUNT(*) FROM battles WHERE creator_id=?',
                    (user_id,)
                )
                created = cursor.fetchone()[0] or 0

                return {'created': created, 'participated': participated, 'won': won}
        except Exception as e:
            print(f"[BattleDB] get_user_battle_stats error: {e}")
            return {'created': 0, 'participated': 0, 'won': 0}