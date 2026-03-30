# pmb.py - Database handler untuk pembayaran (rekening dan gateway) VERSI MYSQL
import json
from datetime import datetime
from db_config import get_db_connection

# ==================== FUNGSI DASAR ====================

def init_db():
    """Inisialisasi database MySQL untuk pembayaran"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabel untuk rekening bank/e-wallet
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS rekening (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        logo_url TEXT NOT NULL,
        nama VARCHAR(255) NOT NULL,
        nomor VARCHAR(100) NOT NULL,
        pemilik VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        INDEX idx_rekening_website (website_id)
    )
    ''')
    
    # Tabel untuk payment gateway (Cashify)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS gateway (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        nama VARCHAR(100) DEFAULT 'Cashify',
        license_key VARCHAR(255) NOT NULL,
        webhook_secret VARCHAR(255) NOT NULL,
        qris_id VARCHAR(100),
        expired_menit INT DEFAULT 30,
        warna_qr VARCHAR(20) DEFAULT '#000000',
        ukuran_qr INT DEFAULT 420,
        package_ids TEXT DEFAULT '["com.gojek.gopaymerchant"]',
        active BOOLEAN DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        INDEX idx_gateway_website (website_id)
    )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ MySQL Payments database initialized successfully (tables: rekening, gateway)")

# ==================== FUNGSI UNTUK REKENING ====================

def get_all_rekening(website_id):
    """Ambil semua rekening untuk website tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        SELECT * FROM rekening 
        WHERE website_id = %s 
        ORDER BY active DESC, created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return rows

def get_active_rekening(website_id):
    """Ambil semua rekening aktif untuk website tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        SELECT * FROM rekening 
        WHERE website_id = %s AND active = 1
        ORDER BY created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return rows

def get_rekening_by_id(rekening_id):
    """Ambil rekening berdasarkan ID"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('SELECT * FROM rekening WHERE id = %s', (rekening_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return row

def save_rekening(website_id, data):
    """Simpan atau update rekening"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        rekening_id = data.get('id')
        
        if rekening_id:
            # Update existing rekening
            cursor.execute('''
                UPDATE rekening SET
                    logo_url = %s,
                    nama = %s,
                    nomor = %s,
                    pemilik = %s,
                    deskripsi = %s,
                    active = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND website_id = %s
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
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('DELETE FROM rekening WHERE id = %s', (rekening_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

# ==================== FUNGSI UNTUK GATEWAY ====================

def get_all_gateway(website_id):
    """Ambil semua gateway untuk website tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        SELECT * FROM gateway 
        WHERE website_id = %s 
        ORDER BY active DESC, created_at DESC
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    return rows

def get_active_gateway(website_id):
    """Ambil gateway aktif untuk website tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('''
        SELECT * FROM gateway 
        WHERE website_id = %s AND active = 1
        ORDER BY created_at DESC
        LIMIT 1
    ''', (website_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    return row

def get_gateway_by_id(gateway_id):
    """Ambil gateway berdasarkan ID"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('SELECT * FROM gateway WHERE id = %s', (gateway_id,))
    row = cursor.fetchone()
    
    conn.close()
    
    return row

def save_gateway(website_id, data):
    """Simpan atau update gateway"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        gateway_id = data.get('id')
        
        # Validasi ukuran QR (harus persegi)
        ukuran_qr = int(data.get('ukuran_qr', 420))
        
        # Siapkan package_ids dalam format JSON
        package_ids = data.get('package_ids', ['com.gojek.gopaymerchant'])
        package_ids_json = json.dumps(package_ids)
        
        if gateway_id:
            # Update existing gateway
            cursor.execute('''
                UPDATE gateway SET
                    license_key = %s,
                    webhook_secret = %s,
                    qris_id = %s,
                    expired_menit = %s,
                    warna_qr = %s,
                    ukuran_qr = %s,
                    package_ids = %s,
                    active = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND website_id = %s
            ''', (
                data.get('license_key', ''),
                data.get('webhook_secret', ''),
                data.get('qris_id', ''),
                int(data.get('expired_menit', 30)),
                data.get('warna_qr', '#000000'),
                ukuran_qr,
                package_ids_json,
                1 if data.get('active', True) else 0,
                gateway_id,
                website_id
            ))
        else:
            # Insert new gateway
            cursor.execute('''
                INSERT INTO gateway (
                    website_id, nama, license_key, webhook_secret, qris_id,
                    expired_menit, warna_qr, ukuran_qr, package_ids, active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                website_id,
                'Cashify',
                data.get('license_key', ''),
                data.get('webhook_secret', ''),
                data.get('qris_id', ''),
                int(data.get('expired_menit', 30)),
                data.get('warna_qr', '#000000'),
                ukuran_qr,
                package_ids_json,
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
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('DELETE FROM gateway WHERE id = %s', (gateway_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return deleted

def update_gateway_status(gateway_id, active):
    """Update status aktif gateway"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute('UPDATE gateway SET active = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s', 
                   (1 if active else 0, gateway_id))
    updated = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    return updated

# ==================== FUNGSI UNTUK PACKAGE IDS ====================

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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('SELECT package_ids FROM gateway WHERE id = %s', (gateway_id,))
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

def update_package_ids(gateway_id, package_ids):
    """
    Update package IDs untuk gateway
    Args:
        package_ids: list of strings (contoh: ["id.dana", "com.gojek.gopaymerchant"])
    Returns: True jika sukses
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        package_ids_json = json.dumps(package_ids)
        
        cursor.execute('''
            UPDATE gateway SET
                package_ids = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
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

# ==================== FUNGSI UNTUK MIGRASI ====================

def migrate_database():
    """Migrasi database MySQL ke struktur terbaru"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah tabel rekening ada
        cursor.execute("SHOW TABLES LIKE 'rekening'")
        table_exists = cursor.fetchone()
        
        if not table_exists:
            print("⚠️ Tabel rekening belum ada, inisialisasi dulu...")
            conn.close()
            init_db()
            return
        
        # Cek kolom package_ids di tabel gateway
        cursor.execute("SHOW COLUMNS FROM gateway LIKE 'package_ids'")
        col_exists = cursor.fetchone()
        
        if not col_exists:
            cursor.execute("ALTER TABLE gateway ADD COLUMN package_ids TEXT DEFAULT '[\"com.gojek.gopaymerchant\"]'")
            print("✅ Column 'package_ids' added to gateway table")
        
        conn.commit()
        print("✅ MySQL Payments database migration completed successfully")
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# Jalankan inisialisasi database
try:
    # Cek apakah tabel sudah ada
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES LIKE 'rekening'")
    table_exists = cursor.fetchone()
    conn.close()
    
    if not table_exists:
        init_db()
    else:
        print("✅ MySQL payments tables already exist, checking migration...")
        migrate_database()
        
except Exception as e:
    print(f"⚠️ Database init warning: {e}")