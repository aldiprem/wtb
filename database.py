import sqlite3
import json
from datetime import datetime
from loguru import logger

DB_PATH = 'ai.db'

def get_db():
    """Dapatkan koneksi database"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Biar bisa akses seperti dictionary
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
    
    # Buat tabel memories
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_type TEXT NOT NULL,
            content TEXT NOT NULL,
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
    
    @staticmethod
    def get_recent(limit=50):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM conversations ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        conn.close()
        return rows

class Memory:
    """Model untuk memories"""
    @staticmethod
    def create(memory_type, content, source_conversation_id=None):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO memories (memory_type, content, source_conversation_id, created_at) VALUES (?, ?, ?, ?)",
            (memory_type, content, source_conversation_id, datetime.now())
        )
        conn.commit()
        last_id = cursor.lastrowid
        conn.close()
        return last_id
    
    @staticmethod
    def get_all(limit=50):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        conn.close()
        return rows
    
    @staticmethod
    def get_by_content_contains(text, limit=20):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
            (f'%{text}%', limit)
        )
        rows = cursor.fetchall()
        conn.close()
        return rows
    
    @staticmethod
    def get_by_type(memory_type, limit=50):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM memories WHERE memory_type = ? ORDER BY created_at DESC LIMIT ?",
            (memory_type, limit)
        )
        rows = cursor.fetchall()
        conn.close()
        return rows
