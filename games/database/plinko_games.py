# games/database/plinko_games.py
import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / 'data' / 'plinko.db'

def get_db():
    """Get database connection"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Games table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plinko_games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            round_hash TEXT UNIQUE NOT NULL,
            user_id INTEGER,
            username TEXT,
            bet_amount INTEGER,
            multiplier REAL,
            win_amount INTEGER,
            risk_level TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Stats table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plinko_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_players INTEGER DEFAULT 0,
            total_games INTEGER DEFAULT 0,
            biggest_multiplier REAL DEFAULT 0,
            biggest_win INTEGER DEFAULT 0,
            total_bet_amount INTEGER DEFAULT 0,
            total_win_amount INTEGER DEFAULT 0,
            last_player TEXT,
            last_time TIMESTAMP,
            current_hash TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert default stats if empty
    cursor.execute('SELECT COUNT(*) FROM plinko_stats')
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO plinko_stats (total_players, total_games, current_hash)
            VALUES (0, 0, ?)
        ''', (datetime.now().strftime('%Y%m%d%H%M%S'),))
    
    conn.commit()
    conn.close()

def save_game_result(data):
    """Save game result to database"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Insert game
    cursor.execute('''
        INSERT INTO plinko_games (round_hash, user_id, username, bet_amount, multiplier, win_amount, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (
        data['round_hash'],
        data.get('user_id'),
        data.get('username'),
        data['bet_amount'],
        data['multiplier'],
        data['win_amount'],
        data['risk_level']
    ))
    
    # Update stats
    # Get unique players count
    cursor.execute('SELECT COUNT(DISTINCT user_id) FROM plinko_games WHERE user_id IS NOT NULL')
    total_players = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM plinko_games')
    total_games = cursor.fetchone()[0]
    
    # Get biggest multiplier
    cursor.execute('SELECT MAX(multiplier) FROM plinko_games')
    biggest_multiplier = cursor.fetchone()[0] or 0
    
    # Get biggest win
    cursor.execute('SELECT MAX(win_amount) FROM plinko_games')
    biggest_win = cursor.fetchone()[0] or 0
    
    # Get total bet and win
    cursor.execute('SELECT SUM(bet_amount), SUM(win_amount) FROM plinko_games')
    total_bet, total_win = cursor.fetchone()
    
    # Get last player
    cursor.execute('''
        SELECT username, created_at FROM plinko_games 
        ORDER BY created_at DESC LIMIT 1
    ''')
    last = cursor.fetchone()
    
    cursor.execute('''
        UPDATE plinko_stats SET
            total_players = ?,
            total_games = ?,
            biggest_multiplier = ?,
            biggest_win = ?,
            total_bet_amount = ?,
            total_win_amount = ?,
            last_player = ?,
            last_time = ?,
            current_hash = ?,
            updated_at = CURRENT_TIMESTAMP
    ''', (
        total_players, total_games, biggest_multiplier, biggest_win,
        total_bet or 0, total_win or 0,
        last['username'] if last else None,
        last['created_at'] if last else None,
        data['round_hash']
    ))
    
    conn.commit()
    conn.close()
    
    return True

def get_stats():
    """Get current stats"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT total_players, total_games, biggest_multiplier, biggest_win,
               total_bet_amount, total_win_amount, last_player, last_time, current_hash
        FROM plinko_stats ORDER BY id DESC LIMIT 1
    ''')
    
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {
            'total_players': row['total_players'],
            'total_games': row['total_games'],
            'biggest_multiplier': row['biggest_multiplier'],
            'biggest_win': row['biggest_win'],
            'total_bet_amount': row['total_bet_amount'],
            'total_win_amount': row['total_win_amount'],
            'last_player': row['last_player'],
            'last_time': row['last_time'],
            'current_hash': row['current_hash']
        }
    
    return {
        'total_players': 0,
        'total_games': 0,
        'biggest_multiplier': 0,
        'biggest_win': 0,
        'total_bet_amount': 0,
        'total_win_amount': 0,
        'last_player': None,
        'last_time': None,
        'current_hash': None
    }

def get_history(limit=50):
    """Get game history"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT round_hash, user_id, username, bet_amount, multiplier, win_amount, risk_level, created_at
        FROM plinko_games
        ORDER BY created_at DESC
        LIMIT ?
    ''', (limit,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

# Initialize database on import
init_db()