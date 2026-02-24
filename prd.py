# prd.py - Database handler untuk produk dengan struktur hierarki (VERSI BARU)
import sqlite3
import json
from datetime import datetime

DATABASE = 'products.db'

def get_db():
    conn = sqlite3.connect(DATABASE, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database produk dengan struktur baru"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Drop existing table if you want to reset structure (uncomment if needed)
    # cursor.execute('DROP TABLE IF EXISTS products')
    
    # Create products table with hierarchical structure
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        
        -- Level: Layanan
        layanan_id INTEGER,
        layanan_nama TEXT NOT NULL,
        layanan_gambar TEXT,
        layanan_banner TEXT,
        layanan_desc TEXT,
        layanan_catatan TEXT,
        
        -- Level: Aplikasi
        aplikasi_id INTEGER,
        aplikasi_nama TEXT,
        aplikasi_gambar TEXT,
        aplikasi_desc TEXT,
        aplikasi_catatan TEXT,
        
        -- Level: Item
        item_id INTEGER,
        item_nama TEXT,
        item_durasi_jumlah INTEGER DEFAULT 0,
        item_durasi_satuan TEXT DEFAULT 'hari',
        item_harga INTEGER DEFAULT 0,
        item_tipe TEXT DEFAULT 'seller', -- 'seller', 'buyer', or null
        item_metode TEXT DEFAULT 'directly', -- 'directly', 'request'
        item_stok TEXT DEFAULT '[]', -- JSON array untuk stok
        item_fields TEXT DEFAULT '[]', -- JSON array untuk fields
        item_ready BOOLEAN DEFAULT 1,
        
        -- Metadata
        aktif BOOLEAN DEFAULT 1,
        terjual INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_website ON products(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_layanan ON products(layanan_nama)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_aplikasi ON products(aplikasi_nama)')
    
    conn.commit()
    conn.close()
    print("✅ Products database initialized successfully")

# ==================== FUNGSI MIGRASI DATABASE ====================

def migrate_database():
    """Migrasi database ke struktur terbaru - menambahkan kolom yang belum ada"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah tabel products ada
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='products'")
        if not cursor.fetchone():
            print("⚠️ Tabel products belum ada, inisialisasi dulu...")
            conn.close()
            return False
        
        # Cek struktur tabel saat ini
        cursor.execute("PRAGMA table_info(products)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        print("📊 Existing columns:", existing_columns)
        
        # Daftar kolom yang harus ada (lengkap dari struktur terbaru)
        required_columns = {
            'layanan_nama': 'TEXT NOT NULL DEFAULT ""',
            'layanan_gambar': 'TEXT',
            'layanan_banner': 'TEXT',
            'layanan_desc': 'TEXT',
            'layanan_catatan': 'TEXT',
            'aplikasi_nama': 'TEXT',
            'aplikasi_gambar': 'TEXT',
            'aplikasi_desc': 'TEXT',
            'aplikasi_catatan': 'TEXT',
            'item_nama': 'TEXT',
            'item_durasi_jumlah': 'INTEGER DEFAULT 0',
            'item_durasi_satuan': 'TEXT DEFAULT "hari"',
            'item_harga': 'INTEGER DEFAULT 0',
            'item_tipe': 'TEXT DEFAULT "seller"',
            'item_metode': 'TEXT DEFAULT "directly"',
            'item_stok': 'TEXT DEFAULT "[]"',
            'item_fields': 'TEXT DEFAULT "[]"',
            'item_ready': 'BOOLEAN DEFAULT 1'
        }
        
        columns_added = []
        
        # Tambahkan kolom yang belum ada
        for col_name, col_type in required_columns.items():
            if col_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE products ADD COLUMN {col_name} {col_type}"
                    cursor.execute(alter_sql)
                    columns_added.append(col_name)
                    print(f"✅ Column '{col_name}' added successfully")
                except Exception as e:
                    print(f"❌ Failed to add column '{col_name}': {e}")
        
        # Buat ulang indexes jika perlu
        try:
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_website ON products(website_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_layanan ON products(layanan_nama)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_aplikasi ON products(aplikasi_nama)')
            print("✅ Indexes created/verified")
        except Exception as e:
            print(f"⚠️ Failed to create indexes: {e}")
        
        conn.commit()
        conn.close()
        
        if columns_added:
            print(f"✅ Migration complete. Added columns: {', '.join(columns_added)}")
        else:
            print("✅ Database already up to date. No columns added.")
        
        return True
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        return False

# ==================== FUNGSI UNTUK LAYANAN ====================

def get_layanan(website_id):
    """Ambil semua layanan unik untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT 
            layanan_id,
            layanan_nama,
            layanan_gambar,
            layanan_banner,
            layanan_desc,
            layanan_catatan
        FROM products 
        WHERE website_id = ? AND layanan_nama IS NOT NULL AND layanan_nama != ''
        ORDER BY layanan_nama
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    layanan = []
    seen = set()
    for row in rows:
        # Hindari duplikasi berdasarkan nama layanan
        if row['layanan_nama'] not in seen:
            seen.add(row['layanan_nama'])
            layanan.append(dict(row))
    
    return layanan

def get_aplikasi_by_layanan(website_id, layanan_nama):
    """Ambil semua aplikasi dalam layanan tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT
            aplikasi_id,
            aplikasi_nama,
            aplikasi_gambar,
            aplikasi_desc,
            aplikasi_catatan
        FROM products
        WHERE website_id = ? AND layanan_nama = ? AND aplikasi_nama IS NOT NULL AND aplikasi_nama != ''
        ORDER BY aplikasi_nama
    ''', (website_id, layanan_nama))
    
    rows = cursor.fetchall()
    conn.close()
    
    aplikasi = []
    seen = set()
    for row in rows:
        if row['aplikasi_nama'] not in seen:
            seen.add(row['aplikasi_nama'])
            aplikasi.append(dict(row))
    
    return aplikasi

def get_items_by_aplikasi(website_id, layanan_nama, aplikasi_nama):
    """Ambil semua item dalam aplikasi tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT *
        FROM products
        WHERE website_id = ? AND layanan_nama = ? AND aplikasi_nama = ? AND item_nama IS NOT NULL AND item_nama != ''
        ORDER BY id
    ''', (website_id, layanan_nama, aplikasi_nama))
    
    rows = cursor.fetchall()
    conn.close()
    
    items = []
    for row in rows:
        item = dict(row)
        item['item_stok'] = json.loads(item['item_stok'] or '[]')
        item['item_fields'] = json.loads(item['item_fields'] or '[]')
        items.append(item)
    
    return items

# ==================== FUNGSI CRUD ====================

def save_layanan(website_id, data):
    """Simpan atau update layanan"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Validasi data
        if not data.get('layanan_nama'):
            conn.close()
            return False
        
        # Cek apakah layanan sudah ada
        cursor.execute('''
            SELECT id FROM products 
            WHERE website_id = ? AND layanan_nama = ? AND (aplikasi_nama IS NULL OR aplikasi_nama = '')
        ''', (website_id, data['layanan_nama']))
        existing = cursor.fetchone()
        
        if existing:
            # Update layanan yang sudah ada
            cursor.execute('''
                UPDATE products SET
                    layanan_gambar = ?,
                    layanan_banner = ?,
                    layanan_desc = ?,
                    layanan_catatan = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = ? AND layanan_nama = ? AND (aplikasi_nama IS NULL OR aplikasi_nama = '')
            ''', (
                data.get('layanan_gambar', ''),
                data.get('layanan_banner', ''),
                data.get('layanan_desc', ''),
                data.get('layanan_catatan', ''),
                website_id,
                data['layanan_nama']
            ))
        else:
            # Insert layanan baru - dengan nilai default untuk kolom NOT NULL
            cursor.execute('''
                INSERT INTO products (
                    website_id, 
                    layanan_nama, 
                    layanan_gambar, 
                    layanan_banner, 
                    layanan_desc, 
                    layanan_catatan,
                    aplikasi_nama,
                    item_nama
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                data['layanan_nama'],
                data.get('layanan_gambar', ''),
                data.get('layanan_banner', ''),
                data.get('layanan_desc', ''),
                data.get('layanan_catatan', ''),
                '',  # aplikasi_nama default empty string
                ''   # item_nama default empty string
            ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Error in save_layanan: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def save_aplikasi(website_id, layanan_nama, data):
    """Simpan atau update aplikasi dalam layanan"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Validasi data
        if not data.get('aplikasi_nama') or not layanan_nama:
            if conn:
                conn.close()
            return False
        
        # Cek apakah aplikasi sudah ada
        cursor.execute('''
            SELECT id FROM products 
            WHERE website_id = ? AND layanan_nama = ? AND aplikasi_nama = ? AND item_nama IS NULL
        ''', (website_id, layanan_nama, data['aplikasi_nama']))
        existing = cursor.fetchone()
        
        if existing:
            # Update aplikasi yang sudah ada
            cursor.execute('''
                UPDATE products SET
                    aplikasi_gambar = ?,
                    aplikasi_desc = ?,
                    aplikasi_catatan = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = ? AND layanan_nama = ? AND aplikasi_nama = ? AND item_nama IS NULL
            ''', (
                data.get('aplikasi_gambar', ''),
                data.get('aplikasi_desc', ''),
                data.get('aplikasi_catatan', ''),
                website_id,
                layanan_nama,
                data['aplikasi_nama']
            ))
        else:
            # Insert aplikasi baru
            cursor.execute('''
                INSERT INTO products (
                    website_id,
                    layanan_nama,
                    aplikasi_nama,
                    aplikasi_gambar,
                    aplikasi_desc,
                    aplikasi_catatan,
                    item_nama
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                layanan_nama,
                data['aplikasi_nama'],
                data.get('aplikasi_gambar', ''),
                data.get('aplikasi_desc', ''),
                data.get('aplikasi_catatan', ''),
                ''  # item_nama default empty string
            ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Error in save_aplikasi: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def save_item(website_id, layanan_nama, aplikasi_nama, data):
    """Simpan atau update item dalam aplikasi"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Validasi data
        if not data.get('item_nama') or not layanan_nama or not aplikasi_nama:
            if conn:
                conn.close()
            return False
        
        if data.get('id'):
            # Update item yang sudah ada
            cursor.execute('''
                UPDATE products SET
                    item_nama = ?,
                    item_durasi_jumlah = ?,
                    item_durasi_satuan = ?,
                    item_harga = ?,
                    item_tipe = ?,
                    item_metode = ?,
                    item_stok = ?,
                    item_fields = ?,
                    item_ready = ?,
                    aktif = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                data['item_nama'],
                data.get('item_durasi_jumlah', 0),
                data.get('item_durasi_satuan', 'hari'),
                data.get('item_harga', 0),
                data.get('item_tipe', ''),
                data.get('item_metode', 'directly'),
                json.dumps(data.get('item_stok', [])),
                json.dumps(data.get('item_fields', [])),
                1 if data.get('item_ready', True) else 0,
                1 if data.get('aktif', True) else 0,
                data['id']
            ))
        else:
            # Insert item baru
            cursor.execute('''
                INSERT INTO products (
                    website_id,
                    layanan_nama,
                    aplikasi_nama,
                    item_nama,
                    item_durasi_jumlah,
                    item_durasi_satuan,
                    item_harga,
                    item_tipe,
                    item_metode,
                    item_stok,
                    item_fields,
                    item_ready,
                    aktif
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                layanan_nama,
                aplikasi_nama,
                data['item_nama'],
                data.get('item_durasi_jumlah', 0),
                data.get('item_durasi_satuan', 'hari'),
                data.get('item_harga', 0),
                data.get('item_tipe', ''),
                data.get('item_metode', 'directly'),
                json.dumps(data.get('item_stok', [])),
                json.dumps(data.get('item_fields', [])),
                1 if data.get('item_ready', True) else 0,
                1 if data.get('aktif', True) else 0
            ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Error in save_item: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def delete_layanan(website_id, layanan_nama):
    """Hapus seluruh layanan beserta aplikasi dan item di dalamnya"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        DELETE FROM products 
        WHERE website_id = ? AND layanan_nama = ?
    ''', (website_id, layanan_nama))
    
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def delete_aplikasi(website_id, layanan_nama, aplikasi_nama):
    """Hapus seluruh aplikasi beserta item di dalamnya"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        DELETE FROM products 
        WHERE website_id = ? AND layanan_nama = ? AND aplikasi_nama = ?
    ''', (website_id, layanan_nama, aplikasi_nama))
    
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def delete_item(item_id):
    """Hapus item berdasarkan ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM products WHERE id = ?', (item_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

def get_all_data(website_id):
    """Ambil semua data terstruktur untuk website"""
    layanan_list = get_layanan(website_id)
    
    result = []
    for layanan in layanan_list:
        layanan_data = dict(layanan)
        layanan_data['aplikasi'] = []
        
        aplikasi_list = get_aplikasi_by_layanan(website_id, layanan['layanan_nama'])
        
        for aplikasi in aplikasi_list:
            aplikasi_data = dict(aplikasi)
            aplikasi_data['items'] = get_items_by_aplikasi(
                website_id, 
                layanan['layanan_nama'], 
                aplikasi['aplikasi_nama']
            )
            layanan_data['aplikasi'].append(aplikasi_data)
        
        result.append(layanan_data)
    
    return result

# ==================== JALANKAN MIGRASI ====================

# Inisialisasi database
init_db()

# Jalankan migrasi untuk memastikan semua kolom ada
try:
    migrate_database()
except Exception as e:
    print(f"⚠️ Migration warning: {e}")