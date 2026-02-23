# tmp.py - Database handler untuk tampilan website (VERSI DENGAN MULTIPLE BANNER)
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
    """Inisialisasi database dengan struktur baru"""
    conn = get_db()
    cursor = conn.cursor()

    # Drop existing table if needed (uncomment if you want to reset)
    # cursor.execute('DROP TABLE IF EXISTS tampilan')
    
    # Create tampilan table with new structure
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tampilan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER UNIQUE NOT NULL,
        logo TEXT,
        banners TEXT DEFAULT '[]',  -- JSON array untuk multiple banner
        colors TEXT DEFAULT '{}',
        font_family TEXT DEFAULT 'Inter',
        font_size INTEGER DEFAULT 14,
        title TEXT,
        description TEXT,
        contact_whatsapp TEXT,
        contact_telegram TEXT,
        banner_positions TEXT DEFAULT '[]',  -- JSON array untuk posisi banner
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()
    conn.close()
    print("✅ Database tmp initialized with new structure")

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
        # Parse JSON fields
        if data['banners']:
            data['banners'] = json.loads(data['banners'])
        if data['colors']:
            data['colors'] = json.loads(data['colors'])
        if data['banner_positions']:
            data['banner_positions'] = json.loads(data['banner_positions'])
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
    banners = json.dumps(data.get('banners', []))
    banner_positions = json.dumps(data.get('banner_positions', []))
    
    logo = data.get('logo', '')

    if existing:
        # Update
        cursor.execute('''
        UPDATE tampilan SET
            logo = COALESCE(?, logo),
            banners = COALESCE(?, banners),
            colors = COALESCE(?, colors),
            font_family = COALESCE(?, font_family),
            font_size = COALESCE(?, font_size),
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            contact_whatsapp = COALESCE(?, contact_whatsapp),
            contact_telegram = COALESCE(?, contact_telegram),
            banner_positions = COALESCE(?, banner_positions),
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (
            logo,
            banners,
            colors,
            data.get('font_family'),
            data.get('font_size'),
            data.get('title'),
            data.get('description'),
            data.get('contact_whatsapp'),
            data.get('contact_telegram'),
            banner_positions,
            website_id
        ))
        result_id = existing['id']
    else:
        # Insert
        cursor.execute('''
        INSERT INTO tampilan (
            website_id, logo, banners, colors, font_family, font_size,
            title, description, contact_whatsapp, contact_telegram, banner_positions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            website_id,
            logo,
            banners,
            colors,
            data.get('font_family', 'Inter'),
            data.get('font_size', 14),
            data.get('title'),
            data.get('description'),
            data.get('contact_whatsapp'),
            data.get('contact_telegram'),
            banner_positions
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

def save_banners(website_id, banners_data, positions_data=None):
    """Khusus menyimpan multiple banner dan posisinya"""
    conn = get_db()
    cursor = conn.cursor()
    
    banners = json.dumps(banners_data)
    positions = json.dumps(positions_data) if positions_data else '[]'
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            banners = ?,
            banner_positions = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (banners, positions, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, banners, banner_positions, colors, font_family, font_size)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (website_id, banners, positions, '{}', 'Inter', 14))
    
    conn.commit()
    conn.close()
    return True

def save_logo(website_id, logo_url):
    """Khusus menyimpan logo"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
    INSERT OR REPLACE INTO tampilan (website_id, logo)
    VALUES (?, ?)
    ''', (website_id, logo_url))
    
    conn.commit()
    conn.close()
    return True

def update_tampilan(website_id, data):
    """Update existing tampilan data dengan preserve semua field"""
    conn = get_db()
    cursor = conn.cursor()

    # First, get current data to preserve fields not being updated
    cursor.execute('SELECT * FROM tampilan WHERE website_id = ?', (website_id,))
    current = cursor.fetchone()

    if not current:
        conn.close()
        return False

    current_dict = dict(current)

    # Parse JSON fields
    for field in ['banners', 'colors', 'banner_positions']:
        if current_dict[field]:
            try:
                current_dict[field] = json.loads(current_dict[field])
            except:
                current_dict[field] = {} if field == 'colors' else []

    # Build SET clause
    set_clauses = []
    values = []

    # Logo
    if 'logo' in data:
        set_clauses.append("logo = ?")
        values.append(data['logo'])
    else:
        set_clauses.append("logo = ?")
        values.append(current_dict['logo'])

    # Banners
    if 'banners' in data:
        set_clauses.append("banners = ?")
        values.append(json.dumps(data['banners']))
    else:
        set_clauses.append("banners = ?")
        values.append(json.dumps(current_dict['banners']))

    # Colors
    if 'colors' in data:
        set_clauses.append("colors = ?")
        values.append(json.dumps(data['colors']))
    else:
        set_clauses.append("colors = ?")
        values.append(json.dumps(current_dict['colors']))

    # Banner positions
    if 'banner_positions' in data:
        set_clauses.append("banner_positions = ?")
        values.append(json.dumps(data['banner_positions']))
    else:
        set_clauses.append("banner_positions = ?")
        values.append(json.dumps(current_dict['banner_positions']))

    # Font family
    if 'font_family' in data:
        set_clauses.append("font_family = ?")
        values.append(data['font_family'])
    else:
        set_clauses.append("font_family = ?")
        values.append(current_dict['font_family'])

    # Font size
    if 'font_size' in data:
        set_clauses.append("font_size = ?")
        values.append(data['font_size'])
    else:
        set_clauses.append("font_size = ?")
        values.append(current_dict['font_size'])

    # Title
    if 'title' in data:
        set_clauses.append("title = ?")
        values.append(data['title'])
    else:
        set_clauses.append("title = ?")
        values.append(current_dict['title'])

    # Description
    if 'description' in data:
        set_clauses.append("description = ?")
        values.append(data['description'])
    else:
        set_clauses.append("description = ?")
        values.append(current_dict['description'])

    # Contact WhatsApp
    if 'contact_whatsapp' in data:
        set_clauses.append("contact_whatsapp = ?")
        values.append(data['contact_whatsapp'])
    else:
        set_clauses.append("contact_whatsapp = ?")
        values.append(current_dict['contact_whatsapp'])

    # Contact Telegram
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
