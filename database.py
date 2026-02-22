import sqlite3
import json
from datetime import datetime
from loguru import logger

DB_PATH = 'ai.db'

def get_db():
    """Dapatkan koneksi database"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Buat tabel KOSONG"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Buat tabel conversations
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            message TEXT NOT NULL,
            context TEXT,
            created_at TIMESTAMP NOT NULL
        )
    ''')
    
    # Buat tabel memories (untuk semua info dari owner)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_type TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            source_conversation_id INTEGER,
            created_at TIMESTAMP NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database sqlite3 siap diisi")

class Conversation:
    """Model untuk conversations"""
    @staticmethod
    def create(role, message, context=None):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO conversations (role, message, context, created_at) VALUES (?, ?, ?, ?)",
            (role, message, json.dumps(context) if context else None, datetime.now())
        )
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id

class Memory:
    """Model untuk memories (semua info dari owner)"""
    @staticmethod
    def create(memory_type, content, category='general', source_conversation_id=None):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO memories (memory_type, content, category, source_conversation_id, created_at) VALUES (?, ?, ?, ?, ?)",
            (memory_type, content, category, source_conversation_id, datetime.now())
        )
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id
    
    @staticmethod
    def get_all(limit=100):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def search(query, limit=20):
        """Cari memori berdasarkan kata kunci"""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
            (f'%{query}%', limit)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
    
    @staticmethod
    def get_by_category(category, limit=50):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM memories WHERE category = ? ORDER BY created_at DESC LIMIT ?",
            (category, limit)
        )
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]
