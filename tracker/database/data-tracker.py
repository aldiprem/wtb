#!/usr/bin/env python3
import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'tracker.db')

def init_tracker_db():
    """Inisialisasi database untuk tracker"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Tabel untuk menyimpan data tracking
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tracker_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint_id TEXT UNIQUE,
            endpoint_name TEXT,
            endpoint_token TEXT UNIQUE,
            visitor_ip TEXT,
            visitor_city TEXT,
            visitor_region TEXT,
            visitor_country TEXT,
            visitor_lat REAL,
            visitor_lon REAL,
            visitor_isp TEXT,
            visitor_device TEXT,
            visitor_os TEXT,
            visitor_browser TEXT,
            is_used INTEGER DEFAULT 0,
            used_by_ip TEXT,
            used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabel untuk log setiap kunjungan
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tracker_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint_id TEXT,
            visitor_ip TEXT,
            visitor_city TEXT,
            visitor_region TEXT,
            visitor_country TEXT,
            visitor_lat REAL,
            visitor_lon REAL,
            visitor_isp TEXT,
            visitor_device TEXT,
            visitor_os TEXT,
            visitor_browser TEXT,
            visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (endpoint_id) REFERENCES tracker_data(endpoint_id)
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Tracker database initialized")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

if __name__ == '__main__':
    init_tracker_db()