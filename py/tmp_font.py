# tmp_font.py - Database handler untuk template font & animasi
import sqlite3
import json
import random
import string
from datetime import datetime

DATABASE = 'font_templates.db'

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
        font_data TEXT NOT NULL,
        animation_data TEXT NOT NULL,
        preview_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        last_used TIMESTAMP
    )
    ''')
    
    # Index untuk pencarian
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_template_code ON font_templates(template_code)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_template_name ON font_templates(template_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_website_id ON font_templates(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_user_id ON font_templates(user_id)')
    
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

def save_template(template_name, font_data, animation_data, preview_data, website_id=None, user_id=None, is_public=False):
    """
    Menyimpan template baru
    Returns: template_code jika sukses, None jika gagal
    """
    conn = None
    try:
        # Validasi data
        if not template_name or not font_data or not animation_data:
            return None
        
        # Generate kode unik
        template_code = generate_template_code()
        
        # Konversi ke JSON string
        font_json = json.dumps(font_data)
        anim_json = json.dumps(animation_data)
        preview_json = json.dumps(preview_data)
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO font_templates (
                template_code, template_name, website_id, user_id,
                font_data, animation_data, preview_data, is_public
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            template_code,
            template_name,
            website_id,
            user_id,
            font_json,
            anim_json,
            preview_json,
            1 if is_public else 0
        ))
        
        conn.commit()
        print(f"✅ Template saved with code: {template_code}")
        return template_code
        
    except Exception as e:
        print(f"❌ Error saving template: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def update_template(template_code, font_data=None, animation_data=None, preview_data=None, template_name=None):
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
        
        if font_data:
            updates.append("font_data = ?")
            params.append(json.dumps(font_data))
        
        if animation_data:
            updates.append("animation_data = ?")
            params.append(json.dumps(animation_data))
        
        if preview_data:
            updates.append("preview_data = ?")
            params.append(json.dumps(preview_data))
        
        if template_name:
            updates.append("template_name = ?")
            params.append(template_name)
        
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
            
            template = dict(row)
            # Parse JSON
            template['font_data'] = json.loads(template['font_data'])
            template['animation_data'] = json.loads(template['animation_data'])
            template['preview_data'] = json.loads(template['preview_data'])
            return template
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting template: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_all_templates(website_id=None, user_id=None, limit=50):
    """
    Mendapatkan semua template
    Bisa difilter berdasarkan website_id atau user_id
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = "SELECT * FROM font_templates WHERE 1=1"
        params = []
        
        if website_id:
            query += " AND (website_id = ? OR is_public = 1)"
            params.append(website_id)
        
        if user_id:
            query += " AND (user_id = ? OR is_public = 1)"
            params.append(user_id)
        
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        templates = []
        for row in rows:
            template = dict(row)
            # Parse JSON (hanya untuk preview, tidak full data)
            try:
                font_data = json.loads(template['font_data'])
                template['font_preview'] = font_data.get('family', 'Inter') if isinstance(font_data, dict) else 'Inter'
            except:
                template['font_preview'] = 'Inter'
            
            try:
                anim_data = json.loads(template['animation_data'])
                template['anim_preview'] = anim_data.get('name', 'None') if isinstance(anim_data, dict) else 'None'
            except:
                template['anim_preview'] = 'None'
            
            # Hapus data besar untuk list view
            template.pop('font_data', None)
            template.pop('animation_data', None)
            template.pop('preview_data', None)
            
            templates.append(template)
        
        return templates
        
    except Exception as e:
        print(f"❌ Error getting templates: {e}")
        return []
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

def search_templates(query, limit=20):
    """
    Mencari template berdasarkan nama
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM font_templates 
            WHERE template_name LIKE ? OR template_code LIKE ?
            ORDER BY usage_count DESC, created_at DESC
            LIMIT ?
        ''', (f'%{query}%', f'%{query}%', limit))
        
        rows = cursor.fetchall()
        
        templates = []
        for row in rows:
            template = dict(row)
            # Hanya ambil preview
            try:
                font_data = json.loads(template['font_data'])
                template['font_preview'] = font_data.get('family', 'Inter') if isinstance(font_data, dict) else 'Inter'
            except:
                template['font_preview'] = 'Inter'
            
            try:
                anim_data = json.loads(template['animation_data'])
                template['anim_preview'] = anim_data.get('name', 'None') if isinstance(anim_data, dict) else 'None'
            except:
                template['anim_preview'] = 'None'
            
            template.pop('font_data', None)
            template.pop('animation_data', None)
            template.pop('preview_data', None)
            
            templates.append(template)
        
        return templates
        
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
            SELECT * FROM font_templates 
            WHERE is_public = 1
            ORDER BY usage_count DESC, created_at DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        
        templates = []
        for row in rows:
            template = dict(row)
            try:
                font_data = json.loads(template['font_data'])
                template['font_preview'] = font_data.get('family', 'Inter') if isinstance(font_data, dict) else 'Inter'
            except:
                template['font_preview'] = 'Inter'
            
            try:
                anim_data = json.loads(template['animation_data'])
                template['anim_preview'] = anim_data.get('name', 'None') if isinstance(anim_data, dict) else 'None'
            except:
                template['anim_preview'] = 'None'
            
            template.pop('font_data', None)
            template.pop('animation_data', None)
            template.pop('preview_data', None)
            
            templates.append(template)
        
        return templates
        
    except Exception as e:
        print(f"❌ Error getting popular templates: {e}")
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

def get_user_templates(user_id, limit=50):
    """
    Mendapatkan semua template milik user tertentu
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM font_templates 
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        ''', (user_id, limit))
        
        rows = cursor.fetchall()
        
        templates = []
        for row in rows:
            template = dict(row)
            try:
                font_data = json.loads(template['font_data'])
                template['font_preview'] = font_data.get('family', 'Inter') if isinstance(font_data, dict) else 'Inter'
            except:
                template['font_preview'] = 'Inter'
            
            try:
                anim_data = json.loads(template['animation_data'])
                template['anim_preview'] = anim_data.get('name', 'None') if isinstance(anim_data, dict) else 'None'
            except:
                template['anim_preview'] = 'None'
            
            template.pop('font_data', None)
            template.pop('animation_data', None)
            template.pop('preview_data', None)
            
            templates.append(template)
        
        return templates
        
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
            SELECT * FROM font_templates 
            WHERE website_id = ? OR is_public = 1
            ORDER BY is_public DESC, usage_count DESC, created_at DESC
            LIMIT ?
        ''', (website_id, limit))
        
        rows = cursor.fetchall()
        
        templates = []
        for row in rows:
            template = dict(row)
            try:
                font_data = json.loads(template['font_data'])
                template['font_preview'] = font_data.get('family', 'Inter') if isinstance(font_data, dict) else 'Inter'
            except:
                template['font_preview'] = 'Inter'
            
            try:
                anim_data = json.loads(template['animation_data'])
                template['anim_preview'] = anim_data.get('name', 'None') if isinstance(anim_data, dict) else 'None'
            except:
                template['anim_preview'] = 'None'
            
            template.pop('font_data', None)
            template.pop('animation_data', None)
            template.pop('preview_data', None)
            
            templates.append(template)
        
        return templates
        
    except Exception as e:
        print(f"❌ Error getting website templates: {e}")
        return []
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
        
        # Cek kolom yang mungkin kurang
        cursor.execute("PRAGMA table_info(font_templates)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        # Kolom yang harus ada
        required_columns = {
            'website_id': 'INTEGER',
            'user_id': 'INTEGER',
            'is_public': 'BOOLEAN DEFAULT 0',
            'usage_count': 'INTEGER DEFAULT 0',
            'last_used': 'TIMESTAMP'
        }
        
        for col_name, col_type in required_columns.items():
            if col_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE font_templates ADD COLUMN {col_name} {col_type}"
                    cursor.execute(alter_sql)
                    print(f"✅ Column '{col_name}' added to font_templates")
                except Exception as e:
                    print(f"⚠️ Failed to add column '{col_name}': {e}")
        
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
