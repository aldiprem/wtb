# tmp_font.py - Database handler untuk template font & animasi VERSI MYSQL
import json
import random
import string
from datetime import datetime
from db_config import get_db_connection

# ==================== FUNGSI DASAR ====================

def init_db():
    """Inisialisasi database MySQL untuk template font"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabel untuk template font & animasi
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS font_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        template_code VARCHAR(35) UNIQUE NOT NULL,
        template_name VARCHAR(255) NOT NULL,
        website_id INT,
        user_id INT,
        
        -- Data Font
        font_family VARCHAR(255) NOT NULL,
        font_file_data LONGTEXT,
        font_file_name VARCHAR(255),
        font_weight INT DEFAULT 400,
        font_style VARCHAR(50) DEFAULT 'normal',
        font_size INT DEFAULT 48,
        text_color VARCHAR(20) DEFAULT '#ffffff',
        
        -- Data Animasi
        animation_type VARCHAR(50) DEFAULT 'none',
        animation_duration FLOAT DEFAULT 2,
        animation_delay FLOAT DEFAULT 0,
        animation_iteration VARCHAR(50) DEFAULT 'infinite',
        
        -- Preview Text
        preview_text TEXT DEFAULT 'Toko Online Premium',
        preview_subtext TEXT DEFAULT 'dengan Layanan Terbaik 24/7',
        
        -- Metadata
        is_public BOOLEAN DEFAULT 0,
        usage_count INT DEFAULT 0,
        last_used TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_template_code (template_code),
        INDEX idx_template_name (template_name(191)),
        INDEX idx_website_id (website_id),
        INDEX idx_user_id (user_id),
        INDEX idx_animation (animation_type)
    )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ MySQL Font templates database initialized successfully")

# ==================== FUNGSI GENERATE KODE ====================

def generate_template_code(length=35):
    """Generate random template code dengan panjang 35 karakter"""
    characters = string.ascii_letters + string.digits
    conn = get_db_connection()
    
    while True:
        code = ''.join(random.choice(characters) for _ in range(length))
        # Cek apakah kode sudah ada
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id FROM font_templates WHERE template_code = %s', (code,))
        existing = cursor.fetchone()
        
        if not existing:
            conn.close()
            return code
        
    conn.close()

# ==================== FUNGSI CRUD TEMPLATE ====================

def save_template(template_name, font_family, font_file_data=None, font_file_name=None, 
                  font_weight=400, font_style='normal', font_size=48, text_color='#ffffff',
                  animation_type='none', animation_duration=2, animation_delay=0, 
                  animation_iteration='infinite', preview_text='Toko Online Premium',
                  preview_subtext='dengan Layanan Terbaik 24/7',
                  website_id=None, user_id=None, is_public=False):
    """
    Menyimpan template baru ke database MySQL
    Returns: template_code jika sukses, None jika gagal
    """
    conn = None
    try:
        # 1. Validasi data input
        if not template_name or not font_family:
            print("❌ Validasi gagal: template_name atau font_family kosong")
            return None
        
        # 2. Generate kode unik untuk template
        template_code = generate_template_code()
        print(f"📝 Generated template code: {template_code}")
        
        conn = get_db_connection()
        # PERBAIKAN: Tambahkan dictionary=True agar hasil fetch berupa dict
        cursor = conn.cursor(dictionary=True) 
        
        # Log data yang akan disimpan
        print(f"📦 Menyimpan template: {template_name}")
        print(f"  - Font family: {font_family}")
        print(f"  - Font file: {font_file_name}")
        print(f"  - Font size: {font_size}")
        print(f"  - Animation: {animation_type}")
        
        # 3. Eksekusi query INSERT
        cursor.execute('''
            INSERT INTO font_templates (
                template_code, template_name, website_id, user_id,
                font_family, font_file_data, font_file_name,
                font_weight, font_style, font_size, text_color,
                animation_type, animation_duration, animation_delay, animation_iteration,
                preview_text, preview_subtext, is_public
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
        
        # 4. Commit transaksi
        conn.commit()
        
        # 5. Verifikasi data tersimpan
        cursor.execute("SELECT COUNT(*) as count FROM font_templates WHERE template_code = %s", (template_code,))
        count = cursor.fetchone()
        
        # Sekarang baris ini aman dari error "tuple indices must be integers"
        if count and count['count'] > 0:
            print(f"✅ Verifikasi: {count['count']} record tersimpan dengan code {template_code}")
            print(f"✅ Template saved with code: {template_code}")
            return template_code
        else:
            print(f"⚠️ Verifikasi gagal: Data tidak ditemukan setelah disimpan.")
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah template ada
        cursor.execute('SELECT id FROM font_templates WHERE template_code = %s', (template_code,))
        if not cursor.fetchone():
            return False
        
        updates = []
        params = []
        
        if template_name is not None:
            updates.append("template_name = %s")
            params.append(template_name)
        
        if font_family is not None:
            updates.append("font_family = %s")
            params.append(font_family)
        
        if font_file_data is not None:
            updates.append("font_file_data = %s")
            params.append(font_file_data)
        
        if font_file_name is not None:
            updates.append("font_file_name = %s")
            params.append(font_file_name)
        
        if font_weight is not None:
            updates.append("font_weight = %s")
            params.append(font_weight)
        
        if font_style is not None:
            updates.append("font_style = %s")
            params.append(font_style)
        
        if font_size is not None:
            updates.append("font_size = %s")
            params.append(font_size)
        
        if text_color is not None:
            updates.append("text_color = %s")
            params.append(text_color)
        
        if animation_type is not None:
            updates.append("animation_type = %s")
            params.append(animation_type)
        
        if animation_duration is not None:
            updates.append("animation_duration = %s")
            params.append(animation_duration)
        
        if animation_delay is not None:
            updates.append("animation_delay = %s")
            params.append(animation_delay)
        
        if animation_iteration is not None:
            updates.append("animation_iteration = %s")
            params.append(animation_iteration)
        
        if preview_text is not None:
            updates.append("preview_text = %s")
            params.append(preview_text)
        
        if preview_subtext is not None:
            updates.append("preview_subtext = %s")
            params.append(preview_subtext)
        
        if is_public is not None:
            updates.append("is_public = %s")
            params.append(1 if is_public else 0)
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        
        if updates:
            query = f"UPDATE font_templates SET {', '.join(updates)} WHERE template_code = %s"
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT * FROM font_templates 
            WHERE template_code = %s
        ''', (template_code,))
        
        row = cursor.fetchone()
        
        if row:
            # Update usage count
            cursor.execute('''
                UPDATE font_templates 
                SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
                WHERE template_code = %s
            ''', (template_code,))
            conn.commit()
            
            return row
        
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
        if not template_code or len(template_code.strip()) == 0:
            print("❌ Template code is empty")
            return False
            
        template_code = template_code.strip()
        print(f"🗑️ Attempting to delete template: {template_code}")
        
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah template ada terlebih dahulu
        cursor.execute('SELECT id, template_name, website_id, user_id FROM font_templates WHERE template_code = %s', (template_code,))
        existing = cursor.fetchone()
        
        if not existing:
            print(f"❌ Template not found: {template_code}")
            return False
        
        print(f"✅ Template found: {existing['template_name']} (ID: {existing['id']})")
        print(f"📋 Template ownership: website_id={existing['website_id']}, user_id={existing['user_id']}")
        
        # Hapus template
        cursor.execute('DELETE FROM font_templates WHERE template_code = %s', (template_code,))
        deleted = cursor.rowcount > 0
        
        if deleted:
            print(f"✅ Template {template_code} deleted ({cursor.rowcount} rows affected)")
            conn.commit()
            
            # Verifikasi penghapusan
            cursor.execute('SELECT COUNT(*) as count FROM font_templates WHERE template_code = %s', (template_code,))
            verify = cursor.fetchone()
            if verify['count'] == 0:
                print(f"✅ Verification passed: Template {template_code} completely deleted")
                return True
            else:
                print(f"⚠️ Verification failed: Template {template_code} still exists ({verify['count']} records)")
                return False
        else:
            print(f"❌ No rows deleted for template: {template_code}")
            return False
        
    except Exception as e:
        print(f"❌ Error deleting template: {e}")
        import traceback
        traceback.print_exc()
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah tabel ada
        cursor.execute("SHOW TABLES LIKE 'font_templates'")
        if not cursor.fetchone():
            print("⚠️ Table font_templates tidak ditemukan!")
            return []
        
        # Hitung total data
        cursor.execute("SELECT COUNT(*) as count FROM font_templates")
        count = cursor.fetchone()
        print(f"📊 Total templates in database: {count['count']}")
        
        cursor.execute('''
            SELECT * FROM font_templates 
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        ''', (limit, offset))
        
        rows = cursor.fetchall()
        print(f"📊 Retrieved {len(rows)} templates from database")
        
        return rows
        
    except Exception as e:
        print(f"❌ Error getting templates: {e}")
        import traceback
        traceback.print_exc()
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE template_name LIKE %s OR template_code LIKE %s
            ORDER BY usage_count DESC, created_at DESC
            LIMIT %s
        ''', (f'%{query}%', f'%{query}%', limit))
        
        rows = cursor.fetchall()
        return rows
        
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE is_public = 1
            ORDER BY usage_count DESC, created_at DESC
            LIMIT %s
        ''', (limit,))
        
        rows = cursor.fetchall()
        return rows
        
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
        ''', (user_id, limit))
        
        rows = cursor.fetchall()
        return rows
        
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT id, template_code, template_name, website_id, user_id,
                   font_family, font_file_name, font_weight, font_size, text_color,
                   animation_type, animation_duration, animation_delay, animation_iteration,
                   preview_text, preview_subtext, is_public, usage_count,
                   created_at, updated_at, last_used
            FROM font_templates 
            WHERE website_id = %s OR is_public = 1
            ORDER BY is_public DESC, usage_count DESC, created_at DESC
            LIMIT %s
        ''', (website_id, limit))
        
        rows = cursor.fetchall()
        return rows
        
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('SELECT id FROM font_templates WHERE template_code = %s', (template_code,))
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
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE font_templates 
            SET usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
            WHERE template_code = %s
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
    """Migrasi database MySQL jika ada perubahan struktur"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah tabel sudah ada
        cursor.execute("SHOW TABLES LIKE 'font_templates'")
        if not cursor.fetchone():
            print("⚠️ Table font_templates not found, creating...")
            conn.close()
            init_db()
            return
        
        # Dapatkan daftar kolom yang sudah ada
        cursor.execute("SHOW COLUMNS FROM font_templates")
        existing_columns = [col['Field'] for col in cursor.fetchall()]
        
        print("📊 Existing columns in font_templates:", existing_columns)
        
        # Kolom yang harus ada
        required_columns = {
            'font_family': 'VARCHAR(255) NOT NULL',
            'font_file_data': 'LONGTEXT',
            'font_file_name': 'VARCHAR(255)',
            'font_weight': 'INT DEFAULT 400',
            'font_style': 'VARCHAR(50) DEFAULT "normal"',
            'font_size': 'INT DEFAULT 48',
            'text_color': 'VARCHAR(20) DEFAULT "#ffffff"',
            'animation_type': 'VARCHAR(50) DEFAULT "none"',
            'animation_duration': 'FLOAT DEFAULT 2',
            'animation_delay': 'FLOAT DEFAULT 0',
            'animation_iteration': 'VARCHAR(50) DEFAULT "infinite"',
            'preview_text': 'TEXT',
            'preview_subtext': 'TEXT',
            'website_id': 'INT',
            'user_id': 'INT',
            'is_public': 'BOOLEAN DEFAULT 0',
            'usage_count': 'INT DEFAULT 0',
            'last_used': 'TIMESTAMP NULL'
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
        print("✅ MySQL Font templates database migration completed")
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# ==================== INISIALISASI ====================

# Inisialisasi database
try:
    # Cek apakah tabel sudah ada
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES LIKE 'font_templates'")
    table_exists = cursor.fetchone()
    conn.close()
    
    if not table_exists:
        init_db()
    else:
        print("✅ MySQL font_templates table already exist, checking migration...")
        migrate_database()
        
except Exception as e:
    print(f"⚠️ Database init warning: {e}")