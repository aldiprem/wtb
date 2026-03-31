# tmp.py - Database handler untuk tampilan website (VERSI MYSQL)
import json
from db_config import get_db_connection

# ==================== FUNGSI DASAR ====================

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create tampilan table with new structure including font animation columns
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tampilan (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT UNIQUE NOT NULL,
        logo TEXT,
        banners TEXT DEFAULT '[]',
        promos TEXT DEFAULT '[]',
        colors TEXT DEFAULT '{}',
        font_family VARCHAR(100) DEFAULT 'Inter',
        font_size INT DEFAULT 14,
        title TEXT,
        description TEXT,
        contact_whatsapp VARCHAR(100),
        contact_telegram VARCHAR(100),
        banner_positions TEXT DEFAULT '[]',
        payment_notes TEXT DEFAULT '{}',
        banks TEXT DEFAULT '[]',
        ewallets TEXT DEFAULT '[]',
        qris TEXT DEFAULT '{}',
        crypto TEXT DEFAULT '{}',
        maintenance_message TEXT,
        
        -- KOLOM BARU UNTUK FONT & ANIMASI
        store_display_name VARCHAR(255) DEFAULT 'Toko Online',
        font_animation VARCHAR(50) DEFAULT 'none',
        animation_duration FLOAT DEFAULT 2,
        animation_delay FLOAT DEFAULT 0,
        animation_iteration VARCHAR(50) DEFAULT 'infinite',
        
        -- Kolom untuk font style per target
        store_font_family VARCHAR(100) DEFAULT 'Inter',
        store_font_size INT DEFAULT 14,
        store_font_animation VARCHAR(50) DEFAULT 'none',
        store_animation_duration FLOAT DEFAULT 2,
        store_animation_delay FLOAT DEFAULT 0,
        store_animation_iteration VARCHAR(50) DEFAULT 'infinite',
        
        heading_font_family VARCHAR(100) DEFAULT 'Inter',
        heading_font_size INT DEFAULT 14,
        heading_font_animation VARCHAR(50) DEFAULT 'none',
        heading_animation_duration FLOAT DEFAULT 2,
        heading_animation_delay FLOAT DEFAULT 0,
        heading_animation_iteration VARCHAR(50) DEFAULT 'infinite',
        
        body_font_family VARCHAR(100) DEFAULT 'Inter',
        body_font_size INT DEFAULT 14,
        body_font_animation VARCHAR(50) DEFAULT 'none',
        body_animation_duration FLOAT DEFAULT 2,
        body_animation_delay FLOAT DEFAULT 0,
        body_animation_iteration VARCHAR(50) DEFAULT 'infinite',
        
        settings TEXT DEFAULT '{}',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
    ''')

    # Create promo table (OLD - untuk backward compatibility)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS promo (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT UNIQUE NOT NULL,
        banner TEXT,
        description TEXT,
        end_date VARCHAR(50),
        end_time VARCHAR(50),
        never_end BOOLEAN DEFAULT 0,
        notes TEXT,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Create website_templates table for saving templates per website
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS website_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        template_code VARCHAR(100) NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        template_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        UNIQUE KEY unique_website_template (website_id, template_code)
    )
    ''')

    cursor.execute("ALTER TABLE website_templates MODIFY COLUMN template_data LONGTEXT")
    cursor.execute("ALTER TABLE tampilan MODIFY COLUMN settings LONGTEXT")
    cursor.execute("ALTER TABLE tampilan MODIFY COLUMN logo LONGTEXT")
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_templates_website ON website_templates(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_templates_code ON website_templates(template_code)')

    conn.commit()
    conn.close()
    print("✅ MySQL Database initialized with new structure (tables: tampilan, promo, website_templates)")

# ==================== FUNGSI UNTUK TAMPILAN ====================

def get_tampilan(website_id):
    """Ambil data tampilan berdasarkan website_id"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute('SELECT * FROM tampilan WHERE website_id = %s', (website_id,))
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
        
        if data['settings']:
            try:
                data['settings'] = json.loads(data['settings'])
            except:
                data['settings'] = {}
        else:
            data['settings'] = {}
        
        return data
    return None

def save_tampilan(website_id, data):
    """Simpan atau update data tampilan"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
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
    settings = json.dumps(data.get('settings', {}))
    
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
            logo = COALESCE(%s, logo),
            banners = COALESCE(%s, banners),
            promos = COALESCE(%s, promos),
            colors = COALESCE(%s, colors),
            font_family = COALESCE(%s, font_family),
            font_size = COALESCE(%s, font_size),
            title = COALESCE(%s, title),
            description = COALESCE(%s, description),
            contact_whatsapp = COALESCE(%s, contact_whatsapp),
            contact_telegram = COALESCE(%s, contact_telegram),
            banner_positions = COALESCE(%s, banner_positions),
            payment_notes = COALESCE(%s, payment_notes),
            banks = COALESCE(%s, banks),
            ewallets = COALESCE(%s, ewallets),
            qris = COALESCE(%s, qris),
            crypto = COALESCE(%s, crypto),
            maintenance_message = COALESCE(%s, maintenance_message),
            settings = COALESCE(%s, settings),
            
            store_display_name = COALESCE(%s, store_display_name),
            font_animation = COALESCE(%s, font_animation),
            animation_duration = COALESCE(%s, animation_duration),
            animation_delay = COALESCE(%s, animation_delay),
            animation_iteration = COALESCE(%s, animation_iteration)
        WHERE website_id = %s
        ''', (
            logo, banners, promos, colors, font_family, font_size,
            title, description, contact_whatsapp, contact_telegram,
            banner_positions, payment_notes, banks, ewallets, qris, crypto,
            maintenance_message, settings,
            store_display_name, font_animation, animation_duration,
            animation_delay, animation_iteration,
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
            maintenance_message, settings,
            store_display_name, font_animation, animation_duration, 
            animation_delay, animation_iteration
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
            settings,
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    colors = json.dumps(colors_data)
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            colors = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (colors, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, colors, font_family, font_size, 
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, colors, 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

def save_banners(website_id, banners_data):
    """Khusus menyimpan multiple banner dengan posisi"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    banners_json = json.dumps(banners_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            banners = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (banners_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, banners, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, banners_json, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

def save_logo(website_id, logo_url):
    """Khusus menyimpan logo"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            logo = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (logo_url, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, logo, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, logo_url, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

def save_font_anim(website_id, data):
    """Save font and animation settings"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            store_display_name = %s,
            font_family = %s,
            font_animation = %s,
            animation_duration = %s,
            animation_delay = %s,
            animation_iteration = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
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
            colors, font_size
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            website_id,
            data.get('store_display_name', 'Toko Online'),
            data.get('font_family', 'Inter'),
            data.get('animation', 'none'),
            data.get('animation_duration', 2),
            data.get('animation_delay', 0),
            data.get('animation_iteration', 'infinite'),
            '{}', 14
        ))
    
    conn.commit()
    conn.close()
    return True

def update_tampilan(website_id, data):
    """Update existing tampilan data dengan preserve semua field"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # First, get current data to preserve fields not being updated
    cursor.execute('SELECT * FROM tampilan WHERE website_id = %s', (website_id,))
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
        
    try:
        current_settings = json.loads(current_dict['settings']) if current_dict['settings'] else {}
    except:
        current_settings = {}

    # Siapkan nilai baru (gunakan data baru jika ada, jika tidak pakai yang lama)
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
    new_settings = json.dumps(data.get('settings', current_settings))
    
    # Data font animasi
    new_store_display_name = data.get('store_display_name', current_dict.get('store_display_name', 'Toko Online'))
    new_font_animation = data.get('font_animation', current_dict.get('font_animation', 'none'))
    new_animation_duration = data.get('animation_duration', current_dict.get('animation_duration', 2))
    new_animation_delay = data.get('animation_delay', current_dict.get('animation_delay', 0))
    new_animation_iteration = data.get('animation_iteration', current_dict.get('animation_iteration', 'infinite'))

    # Update database
    cursor.execute('''
    UPDATE tampilan SET
        logo = %s,
        banners = %s,
        promos = %s,
        colors = %s,
        font_family = %s,
        font_size = %s,
        title = %s,
        description = %s,
        contact_whatsapp = %s,
        contact_telegram = %s,
        banner_positions = %s,
        payment_notes = %s,
        banks = %s,
        ewallets = %s,
        qris = %s,
        crypto = %s,
        maintenance_message = %s,
        settings = %s,
        
        store_display_name = %s,
        font_animation = %s,
        animation_duration = %s,
        animation_delay = %s,
        animation_iteration = %s,
        
        updated_at = CURRENT_TIMESTAMP
    WHERE website_id = %s
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
        new_settings,
        
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    notes_json = json.dumps(notes_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            payment_notes = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (notes_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, payment_notes, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, notes_json, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan payment methods
def save_payment_methods(website_id, banks_data, ewallets_data, qris_data, crypto_data):
    """Khusus menyimpan payment methods"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    banks_json = json.dumps(banks_data)
    ewallets_json = json.dumps(ewallets_data)
    qris_json = json.dumps(qris_data)
    crypto_json = json.dumps(crypto_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            banks = %s,
            ewallets = %s,
            qris = %s,
            crypto = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (banks_json, ewallets_json, qris_json, crypto_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, banks, ewallets, qris, crypto, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, banks_json, ewallets_json, qris_json, crypto_json, '{}', 'Inter', 14, 
              'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan maintenance message
def save_maintenance(website_id, enabled, message):
    """Khusus menyimpan maintenance settings"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            maintenance_message = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (message if enabled else None, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, maintenance_message, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, message if enabled else None, '{}', 'Inter', 14, 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan font (lama)
def save_font(website_id, font_family, font_size):
    """Khusus menyimpan font settings"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            font_family = %s,
            font_size = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (font_family, font_size, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, font_family, font_size, colors,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, font_family, font_size, '{}', 'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# Fungsi khusus untuk menyimpan general settings
def save_general(website_id, title, description, contact_whatsapp, contact_telegram):
    """Khusus menyimpan general settings"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            title = %s,
            description = %s,
            contact_whatsapp = %s,
            contact_telegram = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (title, description, contact_whatsapp, contact_telegram, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, title, description, contact_whatsapp, contact_telegram, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (website_id, title, description, contact_whatsapp, contact_telegram, '{}', 'Inter', 14,
              'Toko Online', 'none', 2, 0, 'infinite'))
    
    conn.commit()
    conn.close()
    return True

# ==================== FUNGSI UNTUK PROMO (MULTIPLE) ====================

def get_promos(website_id):
    """Ambil semua data promo berdasarkan website_id"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute('SELECT promos FROM tampilan WHERE website_id = %s', (website_id,))
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    promos_json = json.dumps(promos_data)
    
    # Cek apakah sudah ada
    cursor.execute('SELECT id FROM tampilan WHERE website_id = %s', (website_id,))
    existing = cursor.fetchone()
    
    if existing:
        cursor.execute('''
        UPDATE tampilan SET
            promos = %s,
            updated_at = CURRENT_TIMESTAMP
        WHERE website_id = %s
        ''', (promos_json, website_id))
    else:
        cursor.execute('''
        INSERT INTO tampilan (website_id, promos, colors, font_family, font_size,
            store_display_name, font_animation, animation_duration, animation_delay, animation_iteration)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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

def save_website_template(website_id, name, template_data):
    """Fungsi simpan template website (untuk route /templates)"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        template_code = f"TMP-{website_id}-{name[:10]}" # Contoh generate code sederhana
        
        if isinstance(template_data, (dict, list)):
            template_data = json.dumps(template_data)

        sql = '''
            INSERT INTO website_templates (website_id, template_code, template_name, template_data)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE 
                template_name=VALUES(template_name), 
                template_data=VALUES(template_data)
        '''
        cursor.execute(sql, (website_id, template_code, name, template_data))
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Error saving website template: {e}")
        return False
    finally:
        if conn:
            conn.close()

def get_website_templates(website_id):
    """Mendapatkan semua template untuk website tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
    SELECT * FROM website_templates 
    WHERE website_id = %s 
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('DELETE FROM website_templates WHERE id = %s', (template_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

# ==================== FUNGSI FONT STYLE ====================

def save_font_style(website_id, data, target=None):
    """
    Menyimpan font style untuk website
    Args:
        website_id: ID website
        data: Dictionary berisi data font yang akan disimpan
        target: Target aplikasi (store_name, headings, body, all_text)
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah data sudah ada
        cursor.execute('SELECT * FROM tampilan WHERE website_id = %s', (website_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Data existing, lakukan update
            current = dict(existing)
            
            # Siapkan nilai update
            updates = []
            params = []
            
            # Update berdasarkan target
            if target == 'store_name':
                if 'font_family' in data:
                    updates.append("store_font_family = %s")
                    params.append(data['font_family'])
                if 'font_size' in data:
                    updates.append("store_font_size = %s")
                    params.append(data['font_size'])
                if 'font_animation' in data:
                    updates.append("store_font_animation = %s")
                    params.append(data['font_animation'])
                if 'animation_duration' in data:
                    updates.append("store_animation_duration = %s")
                    params.append(data['animation_duration'])
                if 'animation_delay' in data:
                    updates.append("store_animation_delay = %s")
                    params.append(data['animation_delay'])
                if 'animation_iteration' in data:
                    updates.append("store_animation_iteration = %s")
                    params.append(data['animation_iteration'])
            
            elif target == 'headings':
                if 'font_family' in data:
                    updates.append("heading_font_family = %s")
                    params.append(data['font_family'])
                if 'font_size' in data:
                    updates.append("heading_font_size = %s")
                    params.append(data['font_size'])
                if 'font_animation' in data:
                    updates.append("heading_font_animation = %s")
                    params.append(data['font_animation'])
                if 'animation_duration' in data:
                    updates.append("heading_animation_duration = %s")
                    params.append(data['animation_duration'])
                if 'animation_delay' in data:
                    updates.append("heading_animation_delay = %s")
                    params.append(data['animation_delay'])
                if 'animation_iteration' in data:
                    updates.append("heading_animation_iteration = %s")
                    params.append(data['animation_iteration'])
            
            elif target == 'body':
                if 'font_family' in data:
                    updates.append("body_font_family = %s")
                    params.append(data['font_family'])
                if 'font_size' in data:
                    updates.append("body_font_size = %s")
                    params.append(data['font_size'])
                if 'font_animation' in data:
                    updates.append("body_font_animation = %s")
                    params.append(data['font_animation'])
                if 'animation_duration' in data:
                    updates.append("body_animation_duration = %s")
                    params.append(data['animation_duration'])
                if 'animation_delay' in data:
                    updates.append("body_animation_delay = %s")
                    params.append(data['animation_delay'])
                if 'animation_iteration' in data:
                    updates.append("body_animation_iteration = %s")
                    params.append(data['animation_iteration'])
            
            elif target == 'all_text':
                # Update semua kolom
                if 'font_family' in data:
                    updates.append("font_family = %s")
                    updates.append("store_font_family = %s")
                    updates.append("heading_font_family = %s")
                    updates.append("body_font_family = %s")
                    params.extend([data['font_family']] * 4)
                if 'font_size' in data:
                    updates.append("font_size = %s")
                    updates.append("store_font_size = %s")
                    updates.append("heading_font_size = %s")
                    updates.append("body_font_size = %s")
                    params.extend([data['font_size']] * 4)
                if 'font_animation' in data:
                    updates.append("font_animation = %s")
                    updates.append("store_font_animation = %s")
                    updates.append("heading_font_animation = %s")
                    updates.append("body_font_animation = %s")
                    params.extend([data['font_animation']] * 4)
                if 'animation_duration' in data:
                    updates.append("animation_duration = %s")
                    updates.append("store_animation_duration = %s")
                    updates.append("heading_animation_duration = %s")
                    updates.append("body_animation_duration = %s")
                    params.extend([data['animation_duration']] * 4)
                if 'animation_delay' in data:
                    updates.append("animation_delay = %s")
                    updates.append("store_animation_delay = %s")
                    updates.append("heading_animation_delay = %s")
                    updates.append("body_animation_delay = %s")
                    params.extend([data['animation_delay']] * 4)
                if 'animation_iteration' in data:
                    updates.append("animation_iteration = %s")
                    updates.append("store_animation_iteration = %s")
                    updates.append("heading_animation_iteration = %s")
                    updates.append("body_animation_iteration = %s")
                    params.extend([data['animation_iteration']] * 4)
            
            # Update store display name jika ada
            if 'store_display_name' in data:
                updates.append("store_display_name = %s")
                params.append(data['store_display_name'])
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                query = f"UPDATE tampilan SET {', '.join(updates)} WHERE website_id = %s"
                params.append(website_id)
                cursor.execute(query, params)
        else:
            # Data belum ada, insert baru dengan semua kolom
            colors = json.dumps({})
            banners = json.dumps([])
            promos = json.dumps([])
            banner_positions = json.dumps([])
            payment_notes = json.dumps({})
            banks = json.dumps([])
            ewallets = json.dumps([])
            qris = json.dumps({})
            crypto = json.dumps({})
            settings = json.dumps({})
            
            # Ambil nilai dari data
            font_family = data.get('font_family', 'Inter')
            font_size = data.get('font_size', 14)
            font_animation = data.get('font_animation', 'none')
            animation_duration = data.get('animation_duration', 2)
            animation_delay = data.get('animation_delay', 0)
            animation_iteration = data.get('animation_iteration', 'infinite')
            store_display_name = data.get('store_display_name', 'Toko Online')
            
            cursor.execute('''
            INSERT INTO tampilan (
                website_id, logo, banners, promos, colors, font_family, font_size,
                title, description, contact_whatsapp, contact_telegram, 
                banner_positions, payment_notes, banks, ewallets, qris, crypto,
                maintenance_message, store_display_name, font_animation, 
                animation_duration, animation_delay, animation_iteration, settings,
                store_font_family, store_font_size, store_font_animation,
                store_animation_duration, store_animation_delay, store_animation_iteration,
                heading_font_family, heading_font_size, heading_font_animation,
                heading_animation_duration, heading_animation_delay, heading_animation_iteration,
                body_font_family, body_font_size, body_font_animation,
                body_animation_duration, body_animation_delay, body_animation_iteration
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                website_id, '', banners, promos, colors, font_family, font_size,
                None, None, None, None, banner_positions, payment_notes, 
                banks, ewallets, qris, crypto, None, store_display_name,
                font_animation, animation_duration, animation_delay, animation_iteration, settings,
                font_family, font_size, font_animation,
                animation_duration, animation_delay, animation_iteration,
                font_family, font_size, font_animation,
                animation_duration, animation_delay, animation_iteration,
                font_family, font_size, font_animation,
                animation_duration, animation_delay, animation_iteration
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
        SELECT 
            font_family, font_size, font_animation, 
            animation_duration, animation_delay, animation_iteration,
            store_display_name, settings
        FROM tampilan 
        WHERE website_id = %s
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

try:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES LIKE 'tampilan'")
    table_exists = cursor.fetchone()
    conn.close()
    
    if not table_exists:
        init_db()
    else:
        print("✅ MySQL tables already exist, skipping initialization")
except Exception as e:
    print(f"⚠️ Database check warning: {e}")