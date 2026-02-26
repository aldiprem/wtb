# tmp_font.py - Database handler untuk template font & animasi
import sqlite3
import json
import random
import string
from datetime import datetime

DATABASE = 'tmp_font.db'

# ==================== FUNGSI DASAR ====================
def get_db():
    """Mendapatkan koneksi database"""
    conn = sqlite3.connect(DATABASE, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database template font"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabel untuk template font & animasi
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS font_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_code TEXT UNIQUE NOT NULL,
        template_name TEXT NOT NULL,
        website_id INTEGER,
        user_id INTEGER,
        
        -- Data Font
        font_family TEXT NOT NULL,
        font_file_data TEXT,  -- Base64 data URL file TTF
        font_file_name TEXT,  -- Nama file asli
        font_weight INTEGER DEFAULT 400,
        font_style TEXT DEFAULT 'normal',
        font_size INTEGER DEFAULT 48,
        text_color TEXT DEFAULT '#ffffff',
        
        -- Data Animasi
        animation_type TEXT DEFAULT 'none',
        animation_duration REAL DEFAULT 2,
        animation_delay REAL DEFAULT 0,
        animation_iteration TEXT DEFAULT 'infinite',
        
        -- Preview Text
        preview_text TEXT DEFAULT 'Toko Online Premium',
        preview_subtext TEXT DEFAULT 'dengan Layanan Terbaik 24/7',
        
        -- Metadata
        is_public BOOLEAN DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        last_used TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Index untuk pencarian
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_template_code ON font_templates(template_code)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_template_name ON font_templates(template_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_id ON font_templates(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_id ON font_templates(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_animation ON font_templates(animation_type)')
    
    conn.commit()
    conn.close()
    print("✅ Font templates database initialized successfully")

# Inisialisasi database
init_db()

# ==================== FUNGSI GENERATE KODE ====================
def generate_template_code(length=35):
    """Generate random template code dengan panjang 35 karakter"""
    characters = string.ascii_letters + string.digits
    while True:
        code = ''.join(random.choice(characters) for _ in range(length))
        # Cek apakah kode sudah ada
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id FROM font_templates WHERE template_code = ?', (code,))
        existing = cursor.fetchone()
        conn.close()
        
        if not existing:
            return code

# ==================== FUNGSI CRUD TEMPLATE ====================

def save_template(template_name, font_family, font_file_data=None, font_file_name=None, 
                  font_weight=400, font_style='normal', font_size=48, text_color='#ffffff',
                  animation_type='none', animation_duration=2, animation_delay=0, 
                  animation_iteration='infinite', preview_text='Toko Online Premium',
                  preview_subtext='dengan Layanan Terbaik 24/7',
                  website_id=None, user_id=None, is_public=False):
    """
    Menyimpan template baru
    Returns: template_code jika sukses, None jika gagal
    """
    conn = None
    try:
        # Validasi data
        if not template_name or not font_family:
            print("❌ Validasi gagal: template_name atau font_family kosong")
            return None
        
        # Generate kode unik
        template_code = generate_template_code()
        print(f"📝 Generated template code: {template_code}")
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Log data yang akan disimpan
        print(f"📦 Menyimpan template: {template_name}")
        print(f"  - Font family: {font_family}")
        print(f"  - Font file: {font_file_name}")
        print(f"  - Font size: {font_size}")
        print(f"  - Animation: {animation_type}")
        
        cursor.execute('''
            INSERT INTO font_templates (
                template_code, template_name, website_id, user_id,
                font_family, font_file_data, font_file_name,
                font_weight, font_style, font_size, text_color,
                animation_type, animation_duration, animation_delay, animation_iteration,
                preview_text, preview_subtext, is_public
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            template_code,
            template_name,
            website_id,
            user_id,
            font_family,
            font_file_data,
            font_file_name,
            font_weight,
            font_style,
            font_size,
            text_color,
            animation_type,
            animation_duration,
            animation_delay,
            animation_iteration,
            preview_text,
            preview_subtext,
            1 if is_public else 0
        ))
        
        conn.commit()
        
        # Verifikasi data tersimpan
        cursor.execute("SELECT COUNT(*) as count FROM font_templates WHERE template_code = ?", (template_code,))
        count = cursor.fetchone()['count']
        print(f"✅ Verifikasi: {count} record tersimpan dengan code {template_code}")
        
        print(f"✅ Template saved with code: {template_code}")
        return template_code
        
    except sqlite3.IntegrityError as e:
        print(f"❌ Integrity error saving template: {e}")
        if conn:
            conn.rollback()
        return None
    except Exception as e:
        print(f"❌ Error saving template: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def update_template(template_code, template_name=None, font_family=None, font_file_data=None,
                    font_file_name=None, font_weight=None, font_style=None, font_size=None,
                    text_color=None, animation_type=None, animation_duration=None,
                    animation_delay=None, animation_iteration=None, preview_text=None,
                    preview_subtext=None, is_public=None):
    """
    Update template yang sudah ada
    Returns: True jika sukses, False jika gagal
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah template ada
        cursor.execute('SELECT id FROM font_templates WHERE template_code = ?', (template_code,))
        if not cursor.fetchone():
            return False
        
        updates = []
        params = []
        
        if template_name is not None:
            updates.append("template_name = ?")
            params.append(template_name)
        
        if font_family is not None:
            updates.append("font_family = ?")
            params.append(font_family)
        
        if font_file_data is not None:
            updates.append("font_file_data = ?")
            params.append(font_file_data)
        
        if font_file_name is not None:
            updates.append("font_file_name = ?")
            params.append(font_file_name)
        
        if font_weight is not None:
            updates.append("font_weight = ?")
            params.append(font_weight)
        
        if font_style is not None:
            updates.append("font_style = ?")
            params.append(font_style)
        
        if font_size is not None:
            updates.append("font_size = ?")
            params.append(font_size)
        
        if text_color is not None:
            updates.append("text_color = ?")
            params.append(text_color)
        
        if animation_type is not None:
            updates.append("animation_type = ?")
            params.append(animation_type)
        
        if animation_duration is not None:
            updates.append("animation_duration = ?")
            params.append(animation_duration)
        
        if animation_delay is not None:
            updates.append("animation_delay = ?")
            params.append(animation_delay)
        
        if animation_iteration is not None:
            updates.append("animation_iteration = ?")
            params.append(animation_iteration)
        
        if preview_text is not None:
            updates.append("preview_text = ?")
            params.append(preview_text)
        
        if preview_subtext is not None:
            updates.append("preview_subtext = ?")
            params.append(preview_subtext)
        
        if is_public is not None:
            updates.append("is_public = ?")
            params.append(1 if is_public else 0)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        
        if updates:
            query = f"UPDATE font_templates SET {', '.join(updates)} WHERE template_code = ?"
            params.append(template_code)
            cursor.execute(query, params)
            conn.commit()
            print(f"✅ Template {template_code} updated")
            return True
        
        return False
        
    except Exception as e:
        print(f"❌ Error updating template: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def get_template(template_code):
    """
    Mendapatkan template berdasarkan kode
    Returns: dict template atau None
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM font_templates 
            WHERE template_code = ?
        ''', (template_code,))
        
        row = cursor.fetchone()
        
        if row:
            # Update usage count
            cursor.execute('''
                UPDATE font_templates 
                SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                WHERE template_code = ?
            ''', (template_code,))
            conn.commit()
            
            return dict(row)
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting template: {e}")
        return None
    finally:
        if conn:
            conn.close()

def delete_template(template_code):
    """
    Menghapus template berdasarkan kode
    Returns: True jika sukses, False jika gagal
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM font_templates WHERE template_code = ?', (template_code,))
        deleted = cursor.rowcount > 0
        
        conn.commit()
        
        if deleted:
            print(f"✅ Template {template_code} deleted")
        return deleted
        
    except Exception as e:
        print(f"❌ Error deleting template: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def get_all_templates(limit=50, offset=0):
    """
    Mendapatkan semua template
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah tabel ada
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='font_templates'")
        if not cursor.fetchone():
            print("⚠️ Table font_templates tidak ditemukan!")
            return []
        
        # Hitung total data
        cursor.execute("SELECT COUNT(*) as count FROM font_templates")
        count = cursor.fetchone()['count']
        print(f"📊 Total templates in database: {count}")
        
        cursor.execute('''
            SELECT * FROM font_templates 
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        ''', (limit, offset))
        
        rows = cursor.fetchall()
        print(f"📊 Retrieved {len(rows)} templates from database")
        
        templates = []
        for row in rows:
            template = dict(row)
            # Parse JSON if needed (tidak ada JSON di tabel ini)
            templates.append(template)
        
        return templates
        
    except Exception as e:
        print(f"❌ Error getting templates: {e}")
        import traceback
        traceback.print_exc()  # Tambahkan stack trace untuk debugging
        return []
    finally:
        if conn:
            conn.close()

def search_templates(query, limit=20):
    """
    Mencari template berdasarkan nama atau kode
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE template_name LIKE ? OR template_code LIKE ?
            ORDER BY usage_count DESC, created_at DESC
            LIMIT ?
        ''', (f'%{query}%', f'%{query}%', limit))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error searching templates: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_popular_templates(limit=10):
    """
    Mendapatkan template paling populer berdasarkan usage_count
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE is_public = 1
            ORDER BY usage_count DESC, created_at DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error getting popular templates: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_user_templates(user_id, limit=50):
    """
    Mendapatkan semua template milik user tertentu
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        ''', (user_id, limit))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error getting user templates: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_website_templates(website_id, limit=50):
    """
    Mendapatkan semua template yang terkait dengan website tertentu
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE website_id = ? OR is_public = 1
            ORDER BY is_public DESC, usage_count DESC, created_at DESC
            LIMIT ?
        ''', (website_id, limit))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error getting website templates: {e}")
        return []
    finally:
        if conn:
            conn.close()

def check_template_exists(template_code):
    """
    Mengecek apakah template dengan kode tertentu ada
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT id FROM font_templates WHERE template_code = ?', (template_code,))
        return cursor.fetchone() is not None
        
    except Exception as e:
        print(f"❌ Error checking template: {e}")
        return False
    finally:
        if conn:
            conn.close()

def increment_usage_count(template_code):
    """
    Menambah usage count template
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE font_templates 
            SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
            WHERE template_code = ?
        ''', (template_code,))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        print(f"❌ Error incrementing usage count: {e}")
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI MIGRASI ====================

def migrate_database():
    """Migrasi database jika ada perubahan struktur"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah tabel sudah ada
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='font_templates'")
        if not cursor.fetchone():
            print("⚠️ Table font_templates not found, creating...")
            conn.close()
            init_db()
            return
        
        # Dapatkan daftar kolom yang sudah ada
        cursor.execute("PRAGMA table_info(font_templates)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        print("📊 Existing columns in font_templates:", existing_columns)
        
        # Kolom yang harus ada
        required_columns = {
            'font_family': 'TEXT NOT NULL',
            'font_file_data': 'TEXT',
            'font_file_name': 'TEXT',
            'font_weight': 'INTEGER DEFAULT 400',
            'font_style': 'TEXT DEFAULT "normal"',
            'font_size': 'INTEGER DEFAULT 48',
            'text_color': 'TEXT DEFAULT "#ffffff"',
            'animation_type': 'TEXT DEFAULT "none"',
            'animation_duration': 'REAL DEFAULT 2',
            'animation_delay': 'REAL DEFAULT 0',
            'animation_iteration': 'TEXT DEFAULT "infinite"',
            'preview_text': 'TEXT DEFAULT "Toko Online Premium"',
            'preview_subtext': 'TEXT DEFAULT "dengan Layanan Terbaik 24/7"',
            'website_id': 'INTEGER',
            'user_id': 'INTEGER',
            'is_public': 'BOOLEAN DEFAULT 0',
            'usage_count': 'INTEGER DEFAULT 0',
            'last_used': 'TIMESTAMP'
        }
        
        columns_added = []
        for col_name, col_type in required_columns.items():
            if col_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE font_templates ADD COLUMN {col_name} {col_type}"
                    cursor.execute(alter_sql)
                    columns_added.append(col_name)
                    print(f"✅ Column '{col_name}' added to font_templates")
                except Exception as e:
                    print(f"⚠️ Failed to add column '{col_name}': {e}")
        
        if columns_added:
            print(f"✅ Added columns: {', '.join(columns_added)}")
        else:
            print("✅ All columns already exist")
        
        conn.commit()
        print("✅ Font templates database migration completed")
        
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