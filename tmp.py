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

    # Siapkan data dengan nilai default
    colors = json.dumps(data.get('colors', {}))
    
    # Jika data banner tidak ada, set ke empty string
    banner = data.get('banner', '')
    
    if existing:
        # Update - hanya update field yang diberikan, preserve yang lain
        cursor.execute('''
        UPDATE tampilan SET
            banner = COALESCE(?, banner),
            colors = COALESCE(?, colors),
            font_family = COALESCE(?, font_family),
            font_size = COALESCE(?, font_size),
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            contact_whatsapp = COALESCE(?, contact_whatsapp),
            contact_telegram = COALESCE(?, contact_telegram),
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (
            data.get('banner'),
            colors,
            data.get('font_family'),
            data.get('font_size'),
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
            banner,
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
    """Khusus menyimpan warna - preserve data lain"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Get existing data first
    cursor.execute('SELECT * FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    colors = json.dumps(colors_data)
    
    if existing:
        # Update only colors, preserve other fields
        cursor.execute('''
        UPDATE tampilan SET 
            colors = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (colors, website_id))
    else:
        # Insert new record with default values
        cursor.execute('''
        INSERT INTO tampilan (website_id, colors, banner, font_family, font_size)
        VALUES (?, ?, ?, ?, ?)
        ''', (website_id, colors, '', 'Inter', 14))
    
    conn.commit()
    conn.close()
    return True
    
def update_tampilan(website_id, data):
    """Update existing tampilan data"""
    conn = get_db()
    cursor = conn.cursor()
    
    # First, get current data to preserve fields not being updated
    cursor.execute('SELECT * FROM tampilan WHERE website_id = ?', (website_id,))
    current = cursor.fetchone()
    
    if not current:
        conn.close()
        return False
    
    current_dict = dict(current)
    
    # Build SET clause with all fields that need to be updated
    set_clauses = []
    values = []
    
    # Handle banner - preserve if not being updated
    if 'banner' in data:
        set_clauses.append("banner = ?")
        values.append(data['banner'])
    else:
        # Keep existing banner
        set_clauses.append("banner = ?")
        values.append(current_dict['banner'])
    
    # Handle colors
    if 'colors' in data:
        set_clauses.append("colors = ?")
        values.append(json.dumps(data['colors']))
    else:
        set_clauses.append("colors = ?")
        values.append(current_dict['colors'])
    
    # Handle font_family
    if 'font_family' in data:
        set_clauses.append("font_family = ?")
        values.append(data['font_family'])
    else:
        set_clauses.append("font_family = ?")
        values.append(current_dict['font_family'])
    
    # Handle font_size
    if 'font_size' in data:
        set_clauses.append("font_size = ?")
        values.append(data['font_size'])
    else:
        set_clauses.append("font_size = ?")
        values.append(current_dict['font_size'])
    
    # Handle title
    if 'title' in data:
        set_clauses.append("title = ?")
        values.append(data['title'])
    else:
        set_clauses.append("title = ?")
        values.append(current_dict['title'])
    
    # Handle description
    if 'description' in data:
        set_clauses.append("description = ?")
        values.append(data['description'])
    else:
        set_clauses.append("description = ?")
        values.append(current_dict['description'])
    
    # Handle contact_whatsapp
    if 'contact_whatsapp' in data:
        set_clauses.append("contact_whatsapp = ?")
        values.append(data['contact_whatsapp'])
    else:
        set_clauses.append("contact_whatsapp = ?")
        values.append(current_dict['contact_whatsapp'])
    
    # Handle contact_telegram
    if 'contact_telegram' in data:
        set_clauses.append("contact_telegram = ?")
        values.append(data['contact_telegram'])
    else:
        set_clauses.append("contact_telegram = ?")
        values.append(current_dict['contact_telegram'])
    
    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
    
    query = f"UPDATE tampilan SET {', '.join(set_clauses)} WHERE website_id = ?"
    values.append(website_id)
    
    cursor.execute(query, values)
    conn.commit()
    conn.close()
    
    return True
