# ssl.py - Database handler untuk sosial settings (Telegram, Links, Force Subscribe)
import sqlite3
import json
from datetime import datetime

DATABASE = 'social.db'

# ==================== FUNGSI DASAR ====================
def get_db():
    """Mendapatkan koneksi database"""
    conn = sqlite3.connect(DATABASE, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database sosial"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabel untuk Telegram settings
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS telegram (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER UNIQUE NOT NULL,
        
        -- Channel
        channel_link TEXT,
        channel_username TEXT,
        channel_id TEXT,
        channel_desc TEXT,
        channel_active BOOLEAN DEFAULT 0,
        
        -- Testimoni Channel
        testi_link TEXT,
        testi_username TEXT,
        testi_id TEXT,
        testi_active BOOLEAN DEFAULT 0,
        
        -- Contact
        contact_username TEXT,
        contact_user_id INTEGER,
        contact_link TEXT,
        contact_active BOOLEAN DEFAULT 1,
        
        -- Bot
        bot_username TEXT,
        bot_link TEXT,
        bot_id INTEGER,
        bot_command TEXT DEFAULT '/start',
        bot_active BOOLEAN DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Tabel untuk Links & Rnk
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER UNIQUE NOT NULL,
        
        -- Rnk
        rnk_link TEXT,
        rnk_code TEXT,
        rnk_active BOOLEAN DEFAULT 0,
        
        -- Social Media
        instagram TEXT,
        facebook TEXT,
        tiktok TEXT,
        youtube TEXT,
        whatsapp TEXT,
        email TEXT,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Tabel untuk Force Subscribe
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS force_subscribe (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        
        -- Channel/Group Info
        type TEXT NOT NULL, -- 'channel', 'group', 'supergroup'
        nama TEXT NOT NULL,
        username TEXT NOT NULL,
        link TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        description TEXT,
        active BOOLEAN DEFAULT 1,
        
        -- Order (urutan tampilan)
        sort_order INTEGER DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Tabel untuk Global Force Settings
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS force_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER UNIQUE NOT NULL,
        
        global_active BOOLEAN DEFAULT 0,
        check_interval INTEGER DEFAULT 30,
        warning_message TEXT DEFAULT '⚠️ Anda harus subscribe channel berikut terlebih dahulu:',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_telegram_website ON telegram(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_links_website ON links(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_force_website ON force_subscribe(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_force_settings_website ON force_settings(website_id)')
    
    conn.commit()
    conn.close()
    print("✅ Database social initialized successfully")

# Inisialisasi database
init_db()

# ==================== FUNGSI UNTUK TELEGRAM ====================

def get_telegram(website_id):
    """Ambil data telegram untuk website"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM telegram WHERE website_id = ?', (website_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return dict(row) if row else None

def save_telegram(website_id, data):
    """Simpan atau update data telegram"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah sudah ada
        cursor.execute('SELECT id FROM telegram WHERE website_id = ?', (website_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update
            cursor.execute('''
                UPDATE telegram SET
                    channel_link = ?,
                    channel_username = ?,
                    channel_id = ?,
                    channel_desc = ?,
                    channel_active = ?,
                    
                    testi_link = ?,
                    testi_username = ?,
                    testi_id = ?,
                    testi_active = ?,
                    
                    contact_username = ?,
                    contact_user_id = ?,
                    contact_link = ?,
                    contact_active = ?,
                    
                    bot_username = ?,
                    bot_link = ?,
                    bot_id = ?,
                    bot_command = ?,
                    bot_active = ?,
                    
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = ?
            ''', (
                data.get('channel_link', ''),
                data.get('channel_username', ''),
                data.get('channel_id', ''),
                data.get('channel_desc', ''),
                1 if data.get('channel_active', False) else 0,
                
                data.get('testi_link', ''),
                data.get('testi_username', ''),
                data.get('testi_id', ''),
                1 if data.get('testi_active', False) else 0,
                
                data.get('contact_username', ''),
                data.get('contact_user_id'),
                data.get('contact_link', ''),
                1 if data.get('contact_active', True) else 0,
                
                data.get('bot_username', ''),
                data.get('bot_link', ''),
                data.get('bot_id'),
                data.get('bot_command', '/start'),
                1 if data.get('bot_active', False) else 0,
                
                website_id
            ))
        else:
            # Insert
            cursor.execute('''
                INSERT INTO telegram (
                    website_id,
                    channel_link, channel_username, channel_id, channel_desc, channel_active,
                    testi_link, testi_username, testi_id, testi_active,
                    contact_username, contact_user_id, contact_link, contact_active,
                    bot_username, bot_link, bot_id, bot_command, bot_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                data.get('channel_link', ''),
                data.get('channel_username', ''),
                data.get('channel_id', ''),
                data.get('channel_desc', ''),
                1 if data.get('channel_active', False) else 0,
                
                data.get('testi_link', ''),
                data.get('testi_username', ''),
                data.get('testi_id', ''),
                1 if data.get('testi_active', False) else 0,
                
                data.get('contact_username', ''),
                data.get('contact_user_id'),
                data.get('contact_link', ''),
                1 if data.get('contact_active', True) else 0,
                
                data.get('bot_username', ''),
                data.get('bot_link', ''),
                data.get('bot_id'),
                data.get('bot_command', '/start'),
                1 if data.get('bot_active', False) else 0
            ))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"❌ Error in save_telegram: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK LINKS & RNK ====================

def get_links(website_id):
    """Ambil data links untuk website"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM links WHERE website_id = ?', (website_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return dict(row) if row else None

def save_links(website_id, data):
    """Simpan atau update data links"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah sudah ada
        cursor.execute('SELECT id FROM links WHERE website_id = ?', (website_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update
            cursor.execute('''
                UPDATE links SET
                    rnk_link = ?,
                    rnk_code = ?,
                    rnk_active = ?,
                    instagram = ?,
                    facebook = ?,
                    tiktok = ?,
                    youtube = ?,
                    whatsapp = ?,
                    email = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = ?
            ''', (
                data.get('rnk_link', ''),
                data.get('rnk_code', ''),
                1 if data.get('rnk_active', False) else 0,
                data.get('instagram', ''),
                data.get('facebook', ''),
                data.get('tiktok', ''),
                data.get('youtube', ''),
                data.get('whatsapp', ''),
                data.get('email', ''),
                website_id
            ))
        else:
            # Insert
            cursor.execute('''
                INSERT INTO links (
                    website_id,
                    rnk_link, rnk_code, rnk_active,
                    instagram, facebook, tiktok, youtube, whatsapp, email
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                data.get('rnk_link', ''),
                data.get('rnk_code', ''),
                1 if data.get('rnk_active', False) else 0,
                data.get('instagram', ''),
                data.get('facebook', ''),
                data.get('tiktok', ''),
                data.get('youtube', ''),
                data.get('whatsapp', ''),
                data.get('email', '')
            ))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"❌ Error in save_links: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK FORCE SUBSCRIBE ====================

def get_all_force(website_id):
    """Ambil semua force subscribe untuk website"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM force_subscribe 
        WHERE website_id = ? 
        ORDER BY sort_order ASC, created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_active_force(website_id):
    """Ambil force subscribe yang aktif"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM force_subscribe 
        WHERE website_id = ? AND active = 1
        ORDER BY sort_order ASC, created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_force_by_id(force_id):
    """Ambil force subscribe berdasarkan ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM force_subscribe WHERE id = ?', (force_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return dict(row) if row else None

def save_force(website_id, data):
    """Simpan atau update force subscribe"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        force_id = data.get('id')
        
        if force_id:
            # Update
            cursor.execute('''
                UPDATE force_subscribe SET
                    type = ?,
                    nama = ?,
                    username = ?,
                    link = ?,
                    chat_id = ?,
                    description = ?,
                    active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND website_id = ?
            ''', (
                data.get('type', 'channel'),
                data.get('nama', ''),
                data.get('username', ''),
                data.get('link', ''),
                data.get('chat_id', ''),
                data.get('description', ''),
                1 if data.get('active', True) else 0,
                force_id,
                website_id
            ))
        else:
            # Dapatkan sort_order terbesar
            cursor.execute('''
                SELECT MAX(sort_order) as max_order 
                FROM force_subscribe WHERE website_id = ?
            ''', (website_id,))
            result = cursor.fetchone()
            next_order = (result['max_order'] or 0) + 1
            
            # Insert
            cursor.execute('''
                INSERT INTO force_subscribe (
                    website_id, type, nama, username, link, chat_id, description, active, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                data.get('type', 'channel'),
                data.get('nama', ''),
                data.get('username', ''),
                data.get('link', ''),
                data.get('chat_id', ''),
                data.get('description', ''),
                1 if data.get('active', True) else 0,
                next_order
            ))
            force_id = cursor.lastrowid
        
        conn.commit()
        return force_id
        
    except Exception as e:
        print(f"❌ Error in save_force: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def delete_force(force_id):
    """Hapus force subscribe"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM force_subscribe WHERE id = ?', (force_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

def update_force_order(website_id, ordered_ids):
    """Update urutan force subscribe"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        for order, force_id in enumerate(ordered_ids):
            cursor.execute('''
                UPDATE force_subscribe SET
                    sort_order = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND website_id = ?
            ''', (order, force_id, website_id))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Error in update_force_order: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK FORCE SETTINGS ====================

def get_force_settings(website_id):
    """Ambil global force settings"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM force_settings WHERE website_id = ?', (website_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return dict(row) if row else {
        'global_active': False,
        'check_interval': 30,
        'warning_message': '⚠️ Anda harus subscribe channel berikut terlebih dahulu:'
    }

def save_force_settings(website_id, data):
    """Simpan global force settings"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah sudah ada
        cursor.execute('SELECT id FROM force_settings WHERE website_id = ?', (website_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update
            cursor.execute('''
                UPDATE force_settings SET
                    global_active = ?,
                    check_interval = ?,
                    warning_message = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = ?
            ''', (
                1 if data.get('global_active', False) else 0,
                data.get('check_interval', 30),
                data.get('warning_message', ''),
                website_id
            ))
        else:
            # Insert
            cursor.execute('''
                INSERT INTO force_settings (
                    website_id, global_active, check_interval, warning_message
                ) VALUES (?, ?, ?, ?)
            ''', (
                website_id,
                1 if data.get('global_active', False) else 0,
                data.get('check_interval', 30),
                data.get('warning_message', '')
            ))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"❌ Error in save_force_settings: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK MIGRASI ====================

def migrate_database():
    """Migrasi database ke struktur terbaru"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek tabel-tabel yang mungkin kurang kolomnya
        tables_to_check = {
            'telegram': [
                ('channel_link', 'TEXT'),
                ('channel_username', 'TEXT'),
                ('channel_id', 'TEXT'),
                ('channel_desc', 'TEXT'),
                ('channel_active', 'BOOLEAN DEFAULT 0'),
                ('testi_link', 'TEXT'),
                ('testi_username', 'TEXT'),
                ('testi_id', 'TEXT'),
                ('testi_active', 'BOOLEAN DEFAULT 0'),
                ('contact_username', 'TEXT'),
                ('contact_user_id', 'INTEGER'),
                ('contact_link', 'TEXT'),
                ('contact_active', 'BOOLEAN DEFAULT 1'),
                ('bot_username', 'TEXT'),
                ('bot_link', 'TEXT'),
                ('bot_id', 'INTEGER'),
                ('bot_command', 'TEXT DEFAULT "/start"'),
                ('bot_active', 'BOOLEAN DEFAULT 0')
            ],
            'links': [
                ('rnk_link', 'TEXT'),
                ('rnk_code', 'TEXT'),
                ('rnk_active', 'BOOLEAN DEFAULT 0'),
                ('instagram', 'TEXT'),
                ('facebook', 'TEXT'),
                ('tiktok', 'TEXT'),
                ('youtube', 'TEXT'),
                ('whatsapp', 'TEXT'),
                ('email', 'TEXT')
            ],
            'force_subscribe': [
                ('type', 'TEXT NOT NULL DEFAULT "channel"'),
                ('nama', 'TEXT NOT NULL'),
                ('username', 'TEXT NOT NULL'),
                ('link', 'TEXT NOT NULL'),
                ('chat_id', 'TEXT NOT NULL'),
                ('description', 'TEXT'),
                ('active', 'BOOLEAN DEFAULT 1'),
                ('sort_order', 'INTEGER DEFAULT 0')
            ],
            'force_settings': [
                ('global_active', 'BOOLEAN DEFAULT 0'),
                ('check_interval', 'INTEGER DEFAULT 30'),
                ('warning_message', 'TEXT')
            ]
        }
        
        for table, columns in tables_to_check.items():
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if cursor.fetchone():
                cursor.execute(f"PRAGMA table_info({table})")
                existing_columns = [col[1] for col in cursor.fetchall()]
                
                for col_name, col_type in columns:
                    if col_name not in existing_columns:
                        try:
                            alter_sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
                            cursor.execute(alter_sql)
                            print(f"✅ Column '{col_name}' added to {table}")
                        except Exception as e:
                            print(f"⚠️ Failed to add column '{col_name}' to {table}: {e}")
            else:
                print(f"⚠️ Table {table} not found, skipping migration")
        
        conn.commit()
        print("✅ Database migration completed successfully")
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# Jalankan migrasi
try:
    migrate_database()
except Exception as e:
    print(f"⚠️ Migration warning: {e}")
