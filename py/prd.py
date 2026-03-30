# prd.py - Database handler untuk produk dengan struktur hierarki (VERSI MYSQL)
import json
from datetime import datetime
from db_config import get_db_connection

# ==================== FUNGSI DASAR ====================

def init_db():
    """Inisialisasi database MySQL untuk produk dengan struktur baru"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create products table with hierarchical structure
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        
        -- Level: Layanan
        layanan_id INT,
        layanan_nama VARCHAR(255) NOT NULL DEFAULT '',
        layanan_gambar TEXT,
        layanan_banner TEXT,
        layanan_desc TEXT,
        layanan_catatan TEXT,
        
        -- Level: Aplikasi
        aplikasi_id INT,
        aplikasi_nama VARCHAR(255),
        aplikasi_gambar TEXT,
        aplikasi_desc TEXT,
        aplikasi_catatan TEXT,
        
        -- Level: Item
        item_id INT,
        item_nama VARCHAR(255),
        item_durasi_jumlah INT DEFAULT 0,
        item_durasi_satuan VARCHAR(50) DEFAULT 'hari',
        item_harga INT DEFAULT 0,
        item_tipe VARCHAR(50) DEFAULT 'seller',
        item_metode VARCHAR(50) DEFAULT 'directly',
        item_stok TEXT DEFAULT '[]',
        item_fields TEXT DEFAULT '[]',
        item_ready BOOLEAN DEFAULT 1,
        
        -- Metadata
        aktif BOOLEAN DEFAULT 1,
        terjual INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        INDEX idx_products_website (website_id),
        INDEX idx_products_layanan (layanan_nama(191)),
        INDEX idx_products_aplikasi (aplikasi_nama(191))
    )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ MySQL Products database initialized successfully")

# ==================== FUNGSI MIGRASI DATABASE ====================

def migrate_database():
    """Migrasi database MySQL ke struktur terbaru - menambahkan kolom yang belum ada"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah tabel products ada
        cursor.execute("SHOW TABLES LIKE 'products'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("⚠️ Tabel products belum ada, inisialisasi dulu...")
            conn.close()
            init_db()
            return True
        
        # Dapatkan daftar kolom yang sudah ada
        cursor.execute("SHOW COLUMNS FROM products")
        existing_columns = [col['Field'] for col in cursor.fetchall()]
        
        print("📊 Existing columns:", existing_columns)
        
        # CEK APAKAH MASIH ADA KOLOM LAMA
        if 'layanan' in existing_columns:
            print("⚠️ Kolom lama 'layanan' ditemukan. Melakukan migrasi khusus...")
            
            # Backup data terlebih dahulu
            cursor.execute("SELECT * FROM products")
            rows = cursor.fetchall()
            
            # Drop tabel lama
            cursor.execute("DROP TABLE products")
            
            # Buat tabel baru dengan struktur yang benar
            cursor.execute('''
                CREATE TABLE products (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    website_id INT NOT NULL,
                    
                    -- Level: Layanan
                    layanan_id INT,
                    layanan_nama VARCHAR(255) NOT NULL DEFAULT '',
                    layanan_gambar TEXT,
                    layanan_banner TEXT,
                    layanan_desc TEXT,
                    layanan_catatan TEXT,
                    
                    -- Level: Aplikasi
                    aplikasi_id INT,
                    aplikasi_nama VARCHAR(255),
                    aplikasi_gambar TEXT,
                    aplikasi_desc TEXT,
                    aplikasi_catatan TEXT,
                    
                    -- Level: Item
                    item_id INT,
                    item_nama VARCHAR(255),
                    item_durasi_jumlah INT DEFAULT 0,
                    item_durasi_satuan VARCHAR(50) DEFAULT 'hari',
                    item_harga INT DEFAULT 0,
                    item_tipe VARCHAR(50) DEFAULT 'seller',
                    item_metode VARCHAR(50) DEFAULT 'directly',
                    item_stok TEXT DEFAULT '[]',
                    item_fields TEXT DEFAULT '[]',
                    item_ready BOOLEAN DEFAULT 1,
                    
                    -- Metadata
                    aktif BOOLEAN DEFAULT 1,
                    terjual INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
                    INDEX idx_products_website (website_id),
                    INDEX idx_products_layanan (layanan_nama(191)),
                    INDEX idx_products_aplikasi (aplikasi_nama(191))
                )
            ''')
            
            # Insert ulang data jika ada
            if rows:
                for row in rows:
                    layanan_value = row.get('layanan', '')
                    
                    cursor.execute('''
                        INSERT INTO products (
                            id, website_id,
                            layanan_nama, layanan_gambar, layanan_banner, layanan_desc, layanan_catatan,
                            aplikasi_nama, aplikasi_gambar, aplikasi_desc, aplikasi_catatan,
                            item_nama, item_durasi_jumlah, item_durasi_satuan, item_harga,
                            item_tipe, item_metode, item_stok, item_fields, item_ready,
                            aktif, terjual, created_at, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        row.get('id'),
                        row.get('website_id'),
                        layanan_value,
                        row.get('layanan_gambar', ''),
                        row.get('layanan_banner', ''),
                        row.get('layanan_desc', ''),
                        row.get('layanan_catatan', ''),
                        row.get('aplikasi_nama', ''),
                        row.get('aplikasi_gambar', ''),
                        row.get('aplikasi_desc', ''),
                        row.get('aplikasi_catatan', ''),
                        row.get('item_nama', ''),
                        row.get('item_durasi_jumlah', 0),
                        row.get('item_durasi_satuan', 'hari'),
                        row.get('item_harga', 0),
                        row.get('item_tipe', 'seller'),
                        row.get('item_metode', 'directly'),
                        row.get('item_stok', '[]'),
                        row.get('item_fields', '[]'),
                        row.get('item_ready', 1),
                        row.get('aktif', 1),
                        row.get('terjual', 0),
                        row.get('created_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
                        row.get('updated_at', datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                    ))
                
                print(f"✅ {len(rows)} baris data berhasil dimigrasi")
            else:
                print("ℹ️ Tidak ada data yang perlu dimigrasi")
            
            print("✅ Migrasi kolom 'layanan' ke 'layanan_nama' selesai")
        
        # Migrasi normal: tambahkan kolom yang belum ada
        else:
            required_columns = {
                'layanan_nama': 'VARCHAR(255) NOT NULL DEFAULT ""',
                'layanan_gambar': 'TEXT',
                'layanan_banner': 'TEXT',
                'layanan_desc': 'TEXT',
                'layanan_catatan': 'TEXT',
                'aplikasi_nama': 'VARCHAR(255)',
                'aplikasi_gambar': 'TEXT',
                'aplikasi_desc': 'TEXT',
                'aplikasi_catatan': 'TEXT',
                'item_nama': 'VARCHAR(255)',
                'item_durasi_jumlah': 'INT DEFAULT 0',
                'item_durasi_satuan': 'VARCHAR(50) DEFAULT "hari"',
                'item_harga': 'INT DEFAULT 0',
                'item_tipe': 'VARCHAR(50) DEFAULT "seller"',
                'item_metode': 'VARCHAR(50) DEFAULT "directly"',
                'item_stok': 'TEXT DEFAULT "[]"',
                'item_fields': 'TEXT DEFAULT "[]"',
                'item_ready': 'BOOLEAN DEFAULT 1'
            }
            
            columns_added = []
            for col_name, col_type in required_columns.items():
                if col_name not in existing_columns:
                    try:
                        alter_sql = f"ALTER TABLE products ADD COLUMN {col_name} {col_type}"
                        cursor.execute(alter_sql)
                        columns_added.append(col_name)
                        print(f"✅ Column '{col_name}' added successfully")
                    except Exception as e:
                        print(f"❌ Failed to add column '{col_name}': {e}")
        
        # Buat ulang indexes
        try:
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_website ON products(website_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_layanan ON products(layanan_nama(191))')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_aplikasi ON products(aplikasi_nama(191))')
            print("✅ Indexes created/verified")
        except Exception as e:
            print(f"⚠️ Failed to create indexes: {e}")
        
        conn.commit()
        print("✅ Database migration completed successfully")
        return True
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK LAYANAN ====================

def get_layanan(website_id):
    """Ambil semua layanan unik untuk website tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        SELECT DISTINCT 
            layanan_id,
            layanan_nama,
            layanan_gambar,
            layanan_banner,
            layanan_desc,
            layanan_catatan
        FROM products 
        WHERE website_id = %s AND layanan_nama IS NOT NULL AND layanan_nama != ''
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
            layanan.append(row)
    
    return layanan

def get_aplikasi_by_layanan(website_id, layanan_nama):
    """Ambil semua aplikasi dalam layanan tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        SELECT DISTINCT
            aplikasi_id,
            aplikasi_nama,
            aplikasi_gambar,
            aplikasi_desc,
            aplikasi_catatan
        FROM products
        WHERE website_id = %s AND layanan_nama = %s AND aplikasi_nama IS NOT NULL AND aplikasi_nama != ''
        ORDER BY aplikasi_nama
    ''', (website_id, layanan_nama))
    
    rows = cursor.fetchall()
    conn.close()
    
    aplikasi = []
    seen = set()
    for row in rows:
        if row['aplikasi_nama'] not in seen:
            seen.add(row['aplikasi_nama'])
            aplikasi.append(row)
    
    return aplikasi

def get_items_by_aplikasi(website_id, layanan_nama, aplikasi_nama):
    """Ambil semua item dalam aplikasi tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        SELECT *
        FROM products
        WHERE website_id = %s AND layanan_nama = %s AND aplikasi_nama = %s AND item_nama IS NOT NULL AND item_nama != ''
        ORDER BY id
    ''', (website_id, layanan_nama, aplikasi_nama))
    
    rows = cursor.fetchall()
    conn.close()
    
    items = []
    for row in rows:
        item = dict(row)
        # Parse JSON fields
        try:
            item['item_stok'] = json.loads(item['item_stok'] or '[]')
        except:
            item['item_stok'] = []
        try:
            item['item_fields'] = json.loads(item['item_fields'] or '[]')
        except:
            item['item_fields'] = []
        items.append(item)
    
    return items

# ==================== FUNGSI CRUD ====================

def save_layanan(website_id, data):
    """Simpan atau update layanan"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Validasi data
        if not data.get('layanan_nama'):
            conn.close()
            return False
        
        # Cek apakah layanan sudah ada
        cursor.execute('''
            SELECT id FROM products 
            WHERE website_id = %s AND layanan_nama = %s AND (aplikasi_nama IS NULL OR aplikasi_nama = '')
        ''', (website_id, data['layanan_nama']))
        existing = cursor.fetchone()
        
        if existing:
            # Update layanan yang sudah ada
            cursor.execute('''
                UPDATE products SET
                    layanan_gambar = %s,
                    layanan_banner = %s,
                    layanan_desc = %s,
                    layanan_catatan = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = %s AND layanan_nama = %s AND (aplikasi_nama IS NULL OR aplikasi_nama = '')
            ''', (
                data.get('layanan_gambar', ''),
                data.get('layanan_banner', ''),
                data.get('layanan_desc', ''),
                data.get('layanan_catatan', ''),
                website_id,
                data['layanan_nama']
            ))
        else:
            # Insert layanan baru
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
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                website_id,
                data['layanan_nama'],
                data.get('layanan_gambar', ''),
                data.get('layanan_banner', ''),
                data.get('layanan_desc', ''),
                data.get('layanan_catatan', ''),
                '',
                ''
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Validasi data
        if not data.get('aplikasi_nama') or not layanan_nama:
            if conn:
                conn.close()
            return False
        
        # Cek apakah aplikasi sudah ada
        cursor.execute('''
            SELECT id FROM products 
            WHERE website_id = %s AND layanan_nama = %s AND aplikasi_nama = %s AND (item_nama IS NULL OR item_nama = '')
        ''', (website_id, layanan_nama, data['aplikasi_nama']))
        existing = cursor.fetchone()
        
        if existing:
            # Update aplikasi yang sudah ada
            cursor.execute('''
                UPDATE products SET
                    aplikasi_gambar = %s,
                    aplikasi_desc = %s,
                    aplikasi_catatan = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = %s AND layanan_nama = %s AND aplikasi_nama = %s AND (item_nama IS NULL OR item_nama = '')
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
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''', (
                website_id,
                layanan_nama,
                data['aplikasi_nama'],
                data.get('aplikasi_gambar', ''),
                data.get('aplikasi_desc', ''),
                data.get('aplikasi_catatan', ''),
                ''
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Validasi data
        if not data.get('item_nama') or not layanan_nama or not aplikasi_nama:
            if conn:
                conn.close()
            return False
        
        if data.get('id'):
            # Update item yang sudah ada
            cursor.execute('''
                UPDATE products SET
                    item_nama = %s,
                    item_durasi_jumlah = %s,
                    item_durasi_satuan = %s,
                    item_harga = %s,
                    item_tipe = %s,
                    item_metode = %s,
                    item_stok = %s,
                    item_fields = %s,
                    item_ready = %s,
                    aktif = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
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
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        DELETE FROM products 
        WHERE website_id = %s AND layanan_nama = %s
    ''', (website_id, layanan_nama))
    
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def delete_aplikasi(website_id, layanan_nama, aplikasi_nama):
    """Hapus seluruh aplikasi beserta item di dalamnya"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        DELETE FROM products 
        WHERE website_id = %s AND layanan_nama = %s AND aplikasi_nama = %s
    ''', (website_id, layanan_nama, aplikasi_nama))
    
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

def delete_item(item_id):
    """Hapus item berdasarkan ID"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('DELETE FROM products WHERE id = %s', (item_id,))
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
try:
    # Cek apakah tabel products ada
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES LIKE 'products'")
    table_exists = cursor.fetchone()
    conn.close()
    
    if not table_exists:
        init_db()
    else:
        print("✅ MySQL products tables already exist, checking migration...")
        migrate_database()
        
except Exception as e:
    print(f"⚠️ Database init warning: {e}")