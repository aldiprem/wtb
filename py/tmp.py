# tmp.py - Database handler untuk tampilan website (VERSI DENGAN MULTIPLE BANNER, MULTIPLE PROMO, DAN FONT ANIMASI)
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

    # Create tampilan table with new structure including font animation columns
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tampilan (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER UNIQUE NOT NULL,
        logo TEXT,
        banners TEXT DEFAULT '[]',  -- JSON array untuk multiple banner
        promos TEXT DEFAULT '[]',    -- JSON array untuk multiple promo
        colors TEXT DEFAULT '{}',
        font_family TEXT DEFAULT 'Inter',
        font_size INTEGER DEFAULT 14,
        title TEXT,
        description TEXT,
        contact_whatsapp TEXT,
        contact_telegram TEXT,
        banner_positions TEXT DEFAULT '[]',  -- JSON array untuk posisi banner
        payment_notes TEXT DEFAULT '{}',
        banks TEXT DEFAULT '[]',
        ewallets TEXT DEFAULT '[]',
        qris TEXT DEFAULT '{}',
        crypto TEXT DEFAULT '{}',
        maintenance_message TEXT,
        
        -- KOLOM BARU UNTUK FONT & ANIMASI
        store_display_name TEXT DEFAULT 'Toko Online',
        font_animation TEXT DEFAULT 'none',
        animation_duration REAL DEFAULT 2,
        animation_delay REAL DEFAULT 0,
        animation_iteration TEXT DEFAULT 'infinite',
        
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Create promo table (OLD - untuk backward compatibility)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS promo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER UNIQUE NOT NULL,
        banner TEXT,
        description TEXT,
        end_date TEXT,
        end_time TEXT,
        never_end BOOLEAN DEFAULT 0,
        notes TEXT,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Create website_templates table for saving templates per website
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS website_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        template_code TEXT NOT NULL,
        template_name TEXT NOT NULL,
        template_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        UNIQUE(website_id, template_code)
    )
    ''')
    
    # Create index for website_templates
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_templates_website ON website_templates(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_templates_code ON website_templates(template_code)')

    conn.commit()
    conn.close()
    print("✅ Database tmp initialized with new structure (tables: tampilan, promo, website_templates)")

# Inisialisasi database
init_db()

# ==================== FUNGSI UNTUK TAMPILAN ====================

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
            try:
                data['banners'] = json.loads(data['banners'])
            except:
                data['banners'] = []
        else:
            data['banners'] = []
        
        # Parse promos
        if data['promos']:
            try:
                promos_data = json.loads(data['promos'])
                if isinstance(promos_data, list):
                    data['promos'] = promos_data
                else:
                    data['promos'] = []
            except:
                data['promos'] = []
        else:
            data['promos'] = []
        
        if data['colors']:
            try:
                data['colors'] = json.loads(data['colors'])
            except:
                data['colors'] = {}
        else:
            data['colors'] = {}
            
        if data['banner_positions']:
            try:
                data['banner_positions'] = json.loads(data['banner_positions'])
            except:
                data['banner_positions'] = []
        else:
            data['banner_positions'] = []
            
        if data['payment_notes']:
            try:
                data['payment_notes'] = json.loads(data['payment_notes'])
            except:
                data['payment_notes'] = {}
        else:
            data['payment_notes'] = {}
            
        if data['banks']:
            try:
                data['banks'] = json.loads(data['banks'])
            except:
                data['banks'] = []
        else:
            data['banks'] = []
            
        if data['ewallets']:
            try:
                data['ewallets'] = json.loads(data['ewallets'])
            except:
                data['ewallets'] = []
        else:
            data['ewallets'] = []
            
        if data['qris']:
            try:
                data['qris'] = json.loads(data['qris'])
            except:
                data['qris'] = {}
        else:
            data['qris'] = {}
            
        if data['crypto']:
            try:
                data['crypto'] = json.loads(data['crypto'])
            except:
                data['crypto'] = {}
        else:
            data['crypto'] = {}
        
        # Kolom font animasi sudah langsung tersedia sebagai field biasa
        # Tidak perlu di-parse karena bukan JSON
        
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
    promos = json.dumps(data.get('promos', []))
    banner_positions = json.dumps(data.get('banner_positions', []))
    payment_notes = json.dumps(data.get('payment_notes', {}))
    banks = json.dumps(data.get('banks', []))
    ewallets = json.dumps(data.get('ewallets', []))
    qris = json.dumps(data.get('qris', {}))
    crypto = json.dumps(data.get('crypto', {}))
    
    logo = data.get('logo', '')
    font_family = data.get('font_family', 'Inter')
    font_size = data.get('font_size', 14)
    title = data.get('title')
    description = data.get('description')
    contact_whatsapp = data.get('contact_whatsapp')
    contact_telegram = data.get('contact_telegram')
    maintenance_message = data.get('maintenance_message')
    
    # Data font animasi
    store_display_name = data.get('store_display_name', 'Toko Online')
    font_animation = data.get('font_animation', 'none')
    animation_duration = data.get('animation_duration', 2)
    animation_delay = data.get('animation_delay', 0)
    animation_iteration = data.get('animation_iteration', 'infinite')

    if existing:
        # Update
        cursor.execute('''
        UPDATE tampilan SET
            logo = COALESCE(?, logo),
            banners = COALESCE(?, banners),
            promos = COALESCE(?, promos),
            colors = COALESCE(?, colors),
            font_family = COALESCE(?, font_family),
            font_size = COALESCE(?, font_size),
            title = COALESCE(?, title),
            description = COALESCE(?, description),
            contact_whatsapp = COALESCE(?, contact_whatsapp),
            contact_telegram = COALESCE(?, contact_telegram),
            banner_positions = COALESCE(?, banner_positions),
            payment_notes = COALESCE(?, payment_notes),
            banks = COALESCE(?, banks),
            ewallets = COALESCE(?, ewallets),
            qris = COALESCE(?, qris),
            crypto = COALESCE(?, crypto),
            maintenance_message = COALESCE(?, maintenance_message),
            
            -- Update kolom font animasi
            store_display_name = COALESCE(?, store_display_name),
            font_animation = COALESCE(?, font_animation),
            animation_duration = COALESCE(?, animation_duration),
            animation_delay = COALESCE(?, animation_delay),
            animation_iteration = COALESCE(?, animation_iteration),
            
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (
            logo,
            banners,
            promos,
            colors,
            font_family,
            font_size,
            title,
            description,
            contact_whatsapp,
            contact_telegram,
            banner_positions,
            payment_notes,
            banks,
            ewallets,
            qris,
            crypto,
            maintenance_message,
            
            store_display_name,
            font_animation,
            animation_duration,
            animation_delay,
            animation_iteration,
            
            website_id
        ))
        result_id = existing['id']
    else:
        # Insert
        cursor.execute('''
        INSERT INTO tampilan (
            website_id, logo, banners, promos, colors, font_family, font_size,
            title, description, contact_whatsapp, contact_telegram, 
            banner_positions, payment_notes, banks, ewallets, qris, crypto,
            maintenance_message,
            
            -- Kolom font animasi
            store_display_name, font_animation, animation_duration, 
            animation_delay, animation_iteration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            website_id,
            logo,
            banners,
            promos,
            colors,
            font_family,
            font_size,
            title,
            description,
            contact_whatsapp,
            contact_telegram,
            banner_positions,
            payment_notes,
            banks,
            ewallets,
            qris,
            crypto,
            maintenance_message,
            
            store_display_name,
            font_animation,
            animation_duration,
            animation_delay,
            animation_iteration
        ))
        result_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return result_id

def save_colors(website_id, colors_data):
    """Khusus menyimpan warna"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    colors = json.dumps(colors_data)
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            colors = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (colors, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, colors, font_family, font_size, 
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, colors, 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

def save_banners(website_id, banners_data):
    """Khusus menyimpan multiple banner dengan posisi"""
    conn = get_db()
    cursor = conn.cursor()
    
    banners_json = json.dumps(banners_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            banners = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (banners_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, banners, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, banners_json, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

def save_logo(website_id, logo_url):
    """Khusus menyimpan logo"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            logo = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (logo_url, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, logo, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, logo_url, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

def save_font_anim(website_id, data):
    """Save font and animation settings"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            store_display_name = ?,
            font_family = ?,
            font_animation = ?,
            animation_duration = ?,
            animation_delay = ?,
            animation_iteration = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (
            data.get('store_display_name', 'Toko Online'),
            data.get('font_family', 'Inter'),
            data.get('animation', 'none'),
            data.get('animation_duration', 2),
            data.get('animation_delay', 0),
            data.get('animation_iteration', 'infinite'),
            website_id
        ))
    else:
        cursor.execute('''
        INSERT INTO tampilan (
            website_id, 
            store_display_name, font_family, font_animation, 
            animation_duration, animation_delay, animation_iteration,
            colors, font_family, font_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            website_id,
            data.get('store_display_name', 'Toko Online'),
            data.get('font_family', 'Inter'),
            data.get('animation', 'none'),
            data.get('animation_duration', 2),
            data.get('animation_delay', 0),
            data.get('animation_iteration', 'infinite'),
            '{}', 'Inter', 14
        ))
    
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
        # Jika tidak ada data, buat baru
        conn.close()
        return save_tampilan(website_id, data)

    current_dict = dict(current)

    # Parse JSON fields untuk mendapatkan nilai saat ini
    try:
        current_banners = json.loads(current_dict['banners']) if current_dict['banners'] else []
    except:
        current_banners = []
    
    try:
        current_promos = json.loads(current_dict['promos']) if current_dict['promos'] else []
    except:
        current_promos = []
        
    try:
        current_colors = json.loads(current_dict['colors']) if current_dict['colors'] else {}
    except:
        current_colors = {}
        
    try:
        current_banner_positions = json.loads(current_dict['banner_positions']) if current_dict['banner_positions'] else []
    except:
        current_banner_positions = []
        
    try:
        current_payment_notes = json.loads(current_dict['payment_notes']) if current_dict['payment_notes'] else {}
    except:
        current_payment_notes = {}
        
    try:
        current_banks = json.loads(current_dict['banks']) if current_dict['banks'] else []
    except:
        current_banks = []
        
    try:
        current_ewallets = json.loads(current_dict['ewallets']) if current_dict['ewallets'] else []
    except:
        current_ewallets = []
        
    try:
        current_qris = json.loads(current_dict['qris']) if current_dict['qris'] else {}
    except:
        current_qris = {}
        
    try:
        current_crypto = json.loads(current_dict['crypto']) if current_dict['crypto'] else {}
    except:
        current_crypto = {}

    # Siapkan nilai baru (gunakan data baru jika ada,否则 pakai yang lama)
    new_logo = data.get('logo', current_dict['logo'])
    new_banners = json.dumps(data.get('banners', current_banners))
    new_promos = json.dumps(data.get('promos', current_promos))
    new_colors = json.dumps(data.get('colors', current_colors))
    new_banner_positions = json.dumps(data.get('banner_positions', current_banner_positions))
    new_font_family = data.get('font_family', current_dict['font_family'])
    new_font_size = data.get('font_size', current_dict['font_size'])
    new_title = data.get('title', current_dict['title'])
    new_description = data.get('description', current_dict['description'])
    new_contact_whatsapp = data.get('contact_whatsapp', current_dict['contact_whatsapp'])
    new_contact_telegram = data.get('contact_telegram', current_dict['contact_telegram'])
    new_payment_notes = json.dumps(data.get('payment_notes', current_payment_notes))
    new_banks = json.dumps(data.get('banks', current_banks))
    new_ewallets = json.dumps(data.get('ewallets', current_ewallets))
    new_qris = json.dumps(data.get('qris', current_qris))
    new_crypto = json.dumps(data.get('crypto', current_crypto))
    new_maintenance_message = data.get('maintenance_message', current_dict['maintenance_message'])
    
    # Data font animasi
    new_store_display_name = data.get('store_display_name', current_dict.get('store_display_name', 'Toko Online'))
    new_font_animation = data.get('font_animation', current_dict.get('font_animation', 'none'))
    new_animation_duration = data.get('animation_duration', current_dict.get('animation_duration', 2))
    new_animation_delay = data.get('animation_delay', current_dict.get('animation_delay', 0))
    new_animation_iteration = data.get('animation_iteration', current_dict.get('animation_iteration', 'infinite'))

    # Update database
    cursor.execute('''
    UPDATE tampilan SET
        logo = ?,
        banners = ?,
        promos = ?,
        colors = ?,
        font_family = ?,
        font_size = ?,
        title = ?,
        description = ?,
        contact_whatsapp = ?,
        contact_telegram = ?,
        banner_positions = ?,
        payment_notes = ?,
        banks = ?,
        ewallets = ?,
        qris = ?,
        crypto = ?,
        maintenance_message = ?,
        
        -- Update kolom font animasi
        store_display_name = ?,
        font_animation = ?,
        animation_duration = ?,
        animation_delay = ?,
        animation_iteration = ?,
        
        updated_at = CURRENT_TIMESTAMP
    WHERE website_id = ?
    ''', (
        new_logo,
        new_banners,
        new_promos,
        new_colors,
        new_font_family,
        new_font_size,
        new_title,
        new_description,
        new_contact_whatsapp,
        new_contact_telegram,
        new_banner_positions,
        new_payment_notes,
        new_banks,
        new_ewallets,
        new_qris,
        new_crypto,
        new_maintenance_message,
        
        new_store_display_name,
        new_font_animation,
        new_animation_duration,
        new_animation_delay,
        new_animation_iteration,
        
        website_id
    ))

    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan payment notes
def save_payment_notes(website_id, notes_data):
    """Khusus menyimpan payment notes"""
    conn = get_db()
    cursor = conn.cursor()
    
    notes_json = json.dumps(notes_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            payment_notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (notes_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, payment_notes, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, notes_json, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan payment methods
def save_payment_methods(website_id, banks_data, ewallets_data, qris_data, crypto_data):
    """Khusus menyimpan payment methods"""
    conn = get_db()
    cursor = conn.cursor()
    
    banks_json = json.dumps(banks_data)
    ewallets_json = json.dumps(ewallets_data)
    qris_json = json.dumps(qris_data)
    crypto_json = json.dumps(crypto_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            banks = ?,
            ewallets = ?,
            qris = ?,
            crypto = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (banks_json, ewallets_json, qris_json, crypto_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, banks, ewallets, qris, crypto, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, banks_json, ewallets_json, qris_json, crypto_json, '{}', 'Inter', 14, 
              'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan maintenance message
def save_maintenance(website_id, enabled, message):
    """Khusus menyimpan maintenance settings"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            maintenance_message = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (message if enabled else None, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, maintenance_message, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, message if enabled else None, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan font (lama)
def save_font(website_id, font_family, font_size):
    """Khusus menyimpan font settings"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            font_family = ?,
            font_size = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (font_family, font_size, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, font_family, font_size, colors,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, font_family, font_size, '{}', 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan general settings
def save_general(website_id, title, description, contact_whatsapp, contact_telegram):
    """Khusus menyimpan general settings"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            title = ?,
            description = ?,
            contact_whatsapp = ?,
            contact_telegram = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (title, description, contact_whatsapp, contact_telegram, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, title, description, contact_whatsapp, contact_telegram, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, title, description, contact_whatsapp, contact_telegram, '{}', 'Inter', 14,
              'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# ==================== FUNGSI UNTUK PROMO (MULTIPLE) ====================

def get_promos(website_id):
    """Ambil semua data promo berdasarkan website_id"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('SELECT promos FROM tampilan WHERE website_id = ?', (website_id,))
    row = cursor.fetchone()

    conn.close()

    if row and row['promos']:
        try:
            promos = json.loads(row['promos'])
            return promos
        except:
            return []
    return []

def save_promos(website_id, promos_data):
    """Simpan semua data promo"""
    conn = get_db()
    cursor = conn.cursor()
    
    promos_json = json.dumps(promos_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            promos = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = ?
        ''', (promos_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, promos, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (website_id, promos_json, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return len(promos_data)

# ==================== FUNGSI UNTUK PROMO LAMA (BACKWARD COMPATIBILITY) ====================

def get_promo(website_id):
    """Ambil data promo berdasarkan website_id (old single format)"""
    promos = get_promos(website_id)
    if promos and len(promos) > 0:
        return promos[0]
    return None

def save_promo(website_id, data):
    """Simpan atau update data promo (old single format)"""
    promos = get_promos(website_id)
    
    if promos and len(promos) > 0:
        promos[0] = data
    else:
        promos = [data]
    
    return save_promos(website_id, promos)

def delete_promo(website_id):
    """Hapus data promo (old single format)"""
    return save_promos(website_id, [])

# ==================== FUNGSI UNTUK TEMPLATE PER WEBSITE ====================

def save_website_template(website_id, template_code, template_name, template_data):
    """Menyimpan template untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah tabel website_templates sudah ada (seharusnya sudah dibuat di init_db)
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='website_templates'")
    if not cursor.fetchone():
        # Jika belum ada (fallback), buat tabel
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS website_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            website_id INTEGER NOT NULL,
            template_code TEXT NOT NULL,
            template_name TEXT NOT NULL,
            template_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
            UNIQUE(website_id, template_code)
        )
        ''')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_templates_website ON website_templates(website_id)')
    
    # Simpan data template
    cursor.execute('''
    INSERT OR REPLACE INTO website_templates 
    (website_id, template_code, template_name, template_data)
    VALUES (?, ?, ?, ?)
    ''', (website_id, template_code, template_name, json.dumps(template_data)))
    
    conn.commit()
    conn.close()
    return True

def get_website_templates(website_id):
    """Mendapatkan semua template untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah tabel ada
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='website_templates'")
    if not cursor.fetchone():
        conn.close()
        return []  # Return empty list if table doesn't exist
    
    cursor.execute('''
    SELECT * FROM website_templates 
    WHERE website_id = ? 
    ORDER BY created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    templates = []
    for row in rows:
        template = dict(row)
        try:
            template['template_data'] = json.loads(template['template_data'])
        except:
            template['template_data'] = {}
        templates.append(template)
    
    return templates

def delete_website_template(template_id):
    """Menghapus template dari website"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Cek apakah tabel ada
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='website_templates'")
    if not cursor.fetchone():
        conn.close()
        return False
    
    cursor.execute('DELETE FROM website_templates WHERE id = ?', (template_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

# ==================== FUNGSI MIGRASI ====================

# Di dalam fungsi migrate_database() di tmp.py, tambahkan:

def migrate_database():
    """Migrasi database dengan menambahkan kolom baru jika belum ada"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah tabel tampilan ada
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tampilan'")
        if not cursor.fetchone():
            print("⚠️ Tabel tampilan belum ada, inisialisasi dulu...")
            conn.close()
            init_db()
            return
        
        # Dapatkan daftar kolom yang sudah ada di tabel tampilan
        cursor.execute("PRAGMA table_info(tampilan)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        print("📊 Existing columns in tampilan:", existing_columns)
        
        # Kolom baru untuk font animasi
        new_columns = [
            ('store_display_name', 'TEXT DEFAULT "Toko Online"'),
            ('font_animation', 'TEXT DEFAULT "none"'),
            ('animation_duration', 'REAL DEFAULT 2'),
            ('animation_delay', 'REAL DEFAULT 0'),
            ('animation_iteration', 'TEXT DEFAULT "infinite"')
        ]
        
        # PERIKSA DAN TAMBAHKAN KOLOM settings JIKA BELUM ADA
        if 'settings' not in existing_columns:
            try:
                cursor.execute("ALTER TABLE tampilan ADD COLUMN settings TEXT DEFAULT '{}'")
                print("✅ Column 'settings' added to tampilan table")
            except Exception as e:
                print(f"❌ Failed to add column 'settings': {e}")
        
        # Tambahkan kolom font animasi
        columns_added = []
        for col_name, col_type in new_columns:
            if col_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE tampilan ADD COLUMN {col_name} {col_type}"
                    cursor.execute(alter_sql)
                    columns_added.append(col_name)
                    print(f"✅ Column '{col_name}' added to tampilan table")
                except Exception as e:
                    print(f"❌ Failed to add column '{col_name}': {e}")
        
        if columns_added:
            print(f"✅ Added columns: {', '.join(columns_added)}")
        else:
            print("✅ All font animation columns already exist")
        
        # Pastikan tabel website_templates ada
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS website_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            website_id INTEGER NOT NULL,
            template_code TEXT NOT NULL,
            template_name TEXT NOT NULL,
            template_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
            UNIQUE(website_id, template_code)
        )
        ''')
        
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_templates_website ON website_templates(website_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_templates_code ON website_templates(template_code)')
        print("✅ Table 'website_templates' created/verified")
        
        conn.commit()
        print("✅ Database migration completed successfully")
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# tmp.py - Tambahkan fungsi baru untuk menyimpan font style per target

def save_font_style(website_id, data, target=None):
    """
    Menyimpan font style untuk website
    Args:
        website_id: ID website
        data: Dictionary berisi data font yang akan disimpan
        target: Target aplikasi (store_name, headings, body, dll)
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah data sudah ada
        cursor.execute('SELECT * FROM tampilan WHERE website_id = ?', (website_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Data existing, lakukan update
            current = dict(existing)
            
            # Siapkan nilai update
            updates = []
            params = []
            
            # Update kolom font utama
            if 'font_family' in data:
                updates.append("font_family = ?")
                params.append(data['font_family'])
            if 'font_size' in data:
                updates.append("font_size = ?")
                params.append(data['font_size'])
            if 'font_animation' in data:
                updates.append("font_animation = ?")
                params.append(data['font_animation'])
            if 'animation_duration' in data:
                updates.append("animation_duration = ?")
                params.append(data['animation_duration'])
            if 'animation_delay' in data:
                updates.append("animation_delay = ?")
                params.append(data['animation_delay'])
            if 'animation_iteration' in data:
                updates.append("animation_iteration = ?")
                params.append(data['animation_iteration'])
            
            # Update store display name jika ada
            if 'store_display_name' in data:
                updates.append("store_display_name = ?")
                params.append(data['store_display_name'])
            
            # Update settings JSON jika ada (untuk headings/body)
            if 'settings' in data:
                # Parse settings saat ini
                try:
                    current_settings = json.loads(current['settings']) if current['settings'] else {}
                except:
                    current_settings = {}
                
                # Update dengan settings baru
                current_settings.update(data['settings'])
                updates.append("settings = ?")
                params.append(json.dumps(current_settings))
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                query = f"UPDATE tampilan SET {', '.join(updates)} WHERE website_id = ?"
                params.append(website_id)
                cursor.execute(query, params)
        else:
            # Data belum ada, insert baru
            # Siapkan data default
            colors = json.dumps({})
            banners = json.dumps([])
            promos = json.dumps([])
            banner_positions = json.dumps([])
            payment_notes = json.dumps({})
            banks = json.dumps([])
            ewallets = json.dumps([])
            qris = json.dumps({})
            crypto = json.dumps({})
            
            # Ambil nilai dari data
            font_family = data.get('font_family', 'Inter')
            font_size = data.get('font_size', 14)
            font_animation = data.get('font_animation', 'none')
            animation_duration = data.get('animation_duration', 2)
            animation_delay = data.get('animation_delay', 0)
            animation_iteration = data.get('animation_iteration', 'infinite')
            store_display_name = data.get('store_display_name', 'Toko Online')
            
            # Settings
            settings = data.get('settings', {})
            settings_json = json.dumps(settings)
            
            cursor.execute('''
            INSERT INTO tampilan (
                website_id, logo, banners, promos, colors, font_family, font_size,
                title, description, contact_whatsapp, contact_telegram, 
                banner_positions, payment_notes, banks, ewallets, qris, crypto,
                maintenance_message, store_display_name, font_animation, 
                animation_duration, animation_delay, animation_iteration, settings
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id, '', banners, promos, colors, font_family, font_size,
                None, None, None, None, banner_positions, payment_notes, 
                banks, ewallets, qris, crypto, None, store_display_name,
                font_animation, animation_duration, animation_delay, animation_iteration,
                settings_json
            ))
        
        conn.commit()
        print(f"✅ Font style saved for website {website_id}" + (f" (target: {target})" if target else ""))
        return True
        
    except Exception as e:
        print(f"❌ Error in save_font_style: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def get_font_settings(website_id):
    """
    Mendapatkan semua pengaturan font untuk website
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT 
            font_family, font_size, font_animation, 
            animation_duration, animation_delay, animation_iteration,
            store_display_name, settings
        FROM tampilan 
        WHERE website_id = ?
        ''', (website_id,))
        
        row = cursor.fetchone()
        
        if row:
            data = dict(row)
            # Parse settings JSON
            if data['settings']:
                try:
                    data['settings'] = json.loads(data['settings'])
                except:
                    data['settings'] = {}
            else:
                data['settings'] = {}
            
            return data
        return None
        
    except Exception as e:
        print(f"❌ Error in get_font_settings: {e}")
        return None
    finally:
        if conn:
            conn.close()

# Jalankan migrasi
try:
    migrate_database()
except Exception as e:
    print(f"⚠️ Migration warning: {e}")