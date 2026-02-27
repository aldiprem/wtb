# pmb.py - Database handler untuk pembayaran (rekening dan gateway)
import sqlite3
import json
from datetime import datetime

DATABASE = 'pmb.db'

# ==================== FUNGSI DASAR ====================
def get_db():
    """Mendapatkan koneksi database"""
    conn = sqlite3.connect(DATABASE, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database pembayaran"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabel untuk rekening bank/e-wallet
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS rekening (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        logo_url TEXT NOT NULL,
        nama TEXT NOT NULL,
        nomor TEXT NOT NULL,
        pemilik TEXT NOT NULL,
        deskripsi TEXT,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Tabel untuk payment gateway (Cashify)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS gateway (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        nama TEXT DEFAULT 'Cashify',
        license_key TEXT NOT NULL,
        webhook_secret TEXT NOT NULL,
        qris_id TEXT,
        expired_menit INTEGER DEFAULT 30,
        warna_qr TEXT DEFAULT '#000000',
        ukuran_qr INTEGER DEFAULT 420,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_rekening_website ON rekening(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_gateway_website ON gateway(website_id)')
    
    conn.commit()
    conn.close()
    print("✅ Database payments initialized successfully")

# Inisialisasi database
init_db()

# ==================== FUNGSI UNTUK REKENING ====================

def get_all_rekening(website_id):
    """Ambil semua rekening untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM rekening 
        WHERE website_id = ? 
        ORDER BY active DESC, created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_active_rekening(website_id):
    """Ambil semua rekening aktif untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM rekening 
        WHERE website_id = ? AND active = 1
        ORDER BY created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_rekening_by_id(rekening_id):
    """Ambil rekening berdasarkan ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM rekening WHERE id = ?', (rekening_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return dict(row) if row else None

def save_rekening(website_id, data):
    """Simpan atau update rekening"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        rekening_id = data.get('id')
        
        if rekening_id:
            # Update existing rekening
            cursor.execute('''
                UPDATE rekening SET
                    logo_url = ?,
                    nama = ?,
                    nomor = ?,
                    pemilik = ?,
                    deskripsi = ?,
                    active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND website_id = ?
            ''', (
                data.get('logo_url', ''),
                data.get('nama', ''),
                data.get('nomor', ''),
                data.get('pemilik', ''),
                data.get('deskripsi', ''),
                1 if data.get('active', True) else 0,
                rekening_id,
                website_id
            ))
        else:
            # Insert new rekening
            cursor.execute('''
                INSERT INTO rekening (
                    website_id, logo_url, nama, nomor, pemilik, deskripsi, active
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                data.get('logo_url', ''),
                data.get('nama', ''),
                data.get('nomor', ''),
                data.get('pemilik', ''),
                data.get('deskripsi', ''),
                1 if data.get('active', True) else 0
            ))
            rekening_id = cursor.lastrowid
        
        conn.commit()
        return rekening_id
        
    except Exception as e:
        print(f"❌ Error in save_rekening: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def delete_rekening(rekening_id):
    """Hapus rekening berdasarkan ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM rekening WHERE id = ?', (rekening_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

# ==================== FUNGSI UNTUK GATEWAY ====================

def get_all_gateway(website_id):
    """Ambil semua gateway untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM gateway 
        WHERE website_id = ? 
        ORDER BY active DESC, created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

def get_active_gateway(website_id):
    """Ambil gateway aktif untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM gateway 
        WHERE website_id = ? AND active = 1
        ORDER BY created_at DESC
        LIMIT 1
    ''', (website_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return dict(row) if row else None

def get_gateway_by_id(gateway_id):
    """Ambil gateway berdasarkan ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM gateway WHERE id = ?', (gateway_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return dict(row) if row else None

def save_gateway(website_id, data):
    """Simpan atau update gateway"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        gateway_id = data.get('id')
        
        # Validasi ukuran QR (harus persegi)
        ukuran_qr = int(data.get('ukuran_qr', 420))
        
        if gateway_id:
            # Update existing gateway
            cursor.execute('''
                UPDATE gateway SET
                    license_key = ?,
                    webhook_secret = ?,
                    qris_id = ?,
                    expired_menit = ?,
                    warna_qr = ?,
                    ukuran_qr = ?,
                    active = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND website_id = ?
            ''', (
                data.get('license_key', ''),
                data.get('webhook_secret', ''),
                data.get('qris_id', ''),
                int(data.get('expired_menit', 30)),
                data.get('warna_qr', '#000000'),
                ukuran_qr,
                1 if data.get('active', True) else 0,
                gateway_id,
                website_id
            ))
        else:
            # Insert new gateway
            cursor.execute('''
                INSERT INTO gateway (
                    website_id, nama, license_key, webhook_secret, qris_id,
                    expired_menit, warna_qr, ukuran_qr, active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                'Cashify',
                data.get('license_key', ''),
                data.get('webhook_secret', ''),
                data.get('qris_id', ''),
                int(data.get('expired_menit', 30)),
                data.get('warna_qr', '#000000'),
                ukuran_qr,
                1 if data.get('active', True) else 0
            ))
            gateway_id = cursor.lastrowid
        
        conn.commit()
        return gateway_id
        
    except Exception as e:
        print(f"❌ Error in save_gateway: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def delete_gateway(gateway_id):
    """Hapus gateway berdasarkan ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM gateway WHERE id = ?', (gateway_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

def update_gateway_status(gateway_id, active):
    """Update status aktif gateway"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('UPDATE gateway SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (1 if active else 0, gateway_id))
    updated = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return updated

# Di pmb.py, tambahkan fungsi-fungsi berikut:

# ==================== FUNGSI UNTUK PACKAGE IDS ====================

def get_package_ids(gateway_id):
    """
    Mendapatkan package IDs dari gateway
    Returns: list of package ids
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT package_ids FROM gateway WHERE id = ?', (gateway_id,))
        row = cursor.fetchone()
        
        if row and row['package_ids']:
            return json.loads(row['package_ids'])
        return ["com.gojek.gopaymerchant"]  # default
        
    except Exception as e:
        print(f"❌ Error getting package_ids: {e}")
        return ["com.gojek.gopaymerchant"]
    finally:
        if conn:
            conn.close()

def update_package_ids(gateway_id, package_ids):
    """
    Update package IDs untuk gateway
    Args:
        package_ids: list of strings (contoh: ["id.dana", "com.gojek.gopaymerchant"])
    Returns: True jika sukses
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        package_ids_json = json.dumps(package_ids)
        
        cursor.execute('''
            UPDATE gateway SET
                package_ids = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (package_ids_json, gateway_id))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        print(f"❌ Error updating package_ids: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# Daftar package ID yang tersedia (untuk referensi)
AVAILABLE_PACKAGE_IDS = [
    {"id": "id.dana", "name": "DANA Bisnis"},
    {"id": "id.bmri.livinmerchant", "name": "Livin Mandiri"},
    {"id": "com.gojek.gopaymerchant", "name": "GoPay Merchant"},
    {"id": "com.bca.msb", "name": "BCA Merchant"},
    {"id": "id.co.bri.merchant", "name": "BRI Merchant"},
    {"id": "com.shopeepay.merchant.id", "name": "ShopeePay"},
    {"id": "id.co.bni.merchant", "name": "BNI Merchant"},
    {"id": "com.cimbedc", "name": "CIMB Niaga"},
    {"id": "com.orderkuota.app", "name": "Order Kuota"}
]

def get_available_package_ids():
    """
    Mendapatkan daftar semua package ID yang tersedia
    Returns: list of dict
    """
    return AVAILABLE_PACKAGE_IDS

def get_package_ids(gateway_id):
    """
    Mendapatkan package IDs dari gateway
    Returns: list of package ids
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT package_ids FROM gateway WHERE id = ?', (gateway_id,))
        row = cursor.fetchone()
        
        if row and row['package_ids']:
            # Parse JSON
            try:
                package_ids = json.loads(row['package_ids'])
                if isinstance(package_ids, list):
                    return package_ids
                else:
                    return ["com.gojek.gopaymerchant"]
            except:
                return ["com.gojek.gopaymerchant"]
        return ["com.gojek.gopaymerchant"]  # default
        
    except Exception as e:
        print(f"❌ Error getting package_ids: {e}")
        return ["com.gojek.gopaymerchant"]
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK MIGRASI ====================

def migrate_database():
    """Migrasi database ke struktur terbaru"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah tabel rekening ada
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='rekening'")
        if not cursor.fetchone():
            print("⚠️ Tabel rekening belum ada, inisialisasi dulu...")
            conn.close()
            init_db()
            return
        
        # Cek kolom yang mungkin kurang
        tables_to_check = {
            'rekening': [
                ('logo_url', 'TEXT NOT NULL'),
                ('nama', 'TEXT NOT NULL'),
                ('nomor', 'TEXT NOT NULL'),
                ('pemilik', 'TEXT NOT NULL'),
                ('deskripsi', 'TEXT'),
                ('active', 'BOOLEAN DEFAULT 1')
            ],
            'gateway': [
                ('nama', 'TEXT DEFAULT "Cashify"'),
                ('license_key', 'TEXT NOT NULL'),
                ('webhook_secret', 'TEXT NOT NULL'),
                ('qris_id', 'TEXT'),
                ('expired_menit', 'INTEGER DEFAULT 30'),
                ('warna_qr', 'TEXT DEFAULT "#000000"'),
                ('ukuran_qr', 'INTEGER DEFAULT 420'),
                ('active', 'BOOLEAN DEFAULT 1')
            ]
        }
        
        for table, columns in tables_to_check.items():
            cursor.execute(f"PRAGMA table_info({table})")
            existing_columns = [col[1] for col in cursor.fetchall()]
            
            for col_name, col_type in columns:
                if col_name not in existing_columns:
                    try:
                        alter_sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
                        cursor.execute(alter_sql)
                        print(f"✅ Column '{col_name}' added to {table}")
                    except Exception as e:
                        print(f"⚠️ Failed to add column '{col_name}' to {table}: {e}")
        
        conn.commit()
        print("✅ Database migration completed successfully")
        # Tambahkan kolom package_ids di tabel gateway
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gateway'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(gateway)")
            existing_columns = [col[1] for col in cursor.fetchall()]
            
            if 'package_ids' not in existing_columns:
                cursor.execute("ALTER TABLE gateway ADD COLUMN package_ids TEXT DEFAULT '[\"com.gojek.gopaymerchant\"]'")
                print("✅ Column 'package_ids' added to gateway table")
        
        conn.commit()
        print("✅ Database migration completed successfully")
        
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