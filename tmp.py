# tmp.py - Database handler untuk tampilan website (VERSI SEDERHANA)
import sqlite3
import json

DATABASE = 'tmp.db'

# ==================== FUNGSI DASAR ====================
def get_db():
    """Mendapatkan koneksi database"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create tampilan table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tampilan (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            website_id INTEGER UNIQUE NOT NULL,
            banner TEXT,
            colors TEXT DEFAULT '{}',
            font_family TEXT DEFAULT 'Inter',
            font_size INTEGER DEFAULT 14,
            title TEXT,
            description TEXT,
            contact_whatsapp TEXT,
            contact_telegram TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database tmp initialized")

# Inisialisasi database
init_db()

# ==================== FUNGSI UTAMA ====================
def get_tampilan(website_id):
    """Ambil data tampilan berdasarkan website_id"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM tampilan WHERE website_id = ?', (website_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    if row:
        data = dict(row)
        if data['colors']:
            data['colors'] = json.loads(data['colors'])
        return data
    return None

def save_tampilan(website_id, data):
    """Simpan atau update data tampilan"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    # Siapkan data
    colors = json.dumps(data.get('colors', {}))
    
    if existing:
        # Update
        cursor.execute('''
            UPDATE tampilan SET
                banner = ?,
                colors = ?,
                font_family = ?,
                font_size = ?,
                title = ?,
                description = ?,
                contact_whatsapp = ?,
                contact_telegram = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE website_id = ?
        ''', (
            data.get('banner'),
            colors,
            data.get('font_family', 'Inter'),
            data.get('font_size', 14),
            data.get('title'),
            data.get('description'),
            data.get('contact_whatsapp'),
            data.get('contact_telegram'),
            website_id
        ))
        result_id = existing['id']
    else:
        # Insert
        cursor.execute('''
            INSERT INTO tampilan (
                website_id, banner, colors, font_family, font_size,
                title, description, contact_whatsapp, contact_telegram
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            website_id,
            data.get('banner'),
            colors,
            data.get('font_family', 'Inter'),
            data.get('font_size', 14),
            data.get('title'),
            data.get('description'),
            data.get('contact_whatsapp'),
            data.get('contact_telegram')
        ))
        result_id = cursor.lastrowid
    
    conn.commit()
    conn.close()
    return result_id

def save_colors(website_id, colors_data):
    """Khusus menyimpan warna"""
    conn = get_db()
    cursor = conn.cursor()
    
    colors = json.dumps(colors_data)
    
    cursor.execute('''
        INSERT OR REPLACE INTO tampilan (website_id, colors)
        VALUES (?, ?)
    ''', (website_id, colors))
    
    conn.commit()
    conn.close()
    return True
