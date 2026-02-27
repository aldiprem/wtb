# trx.py - Database handler untuk transaksi (deposit, withdraw)
import sqlite3
import json
from datetime import datetime, timedelta

DATABASE = 'trx.db'

# ==================== FUNGSI DASAR ====================
def get_db():
    """Mendapatkan koneksi database"""
    conn = sqlite3.connect(DATABASE, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database transaksi"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabel untuk transaksi deposit
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_username TEXT,
        user_first_name TEXT,
        user_last_name TEXT,
        
        -- Detail transaksi
        amount INTEGER NOT NULL,
        payment_method TEXT NOT NULL, -- 'rekening' atau 'qris'
        rekening_id INTEGER, -- ID rekening jika pakai transfer manual
        gateway_id INTEGER, -- ID gateway jika pakai qris
        
        -- Status transaksi
        status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'success', 'failed', 'expired'
        status_message TEXT,
        
        -- Data Cashify
        cashify_transaction_id TEXT UNIQUE,
        cashify_reference_id TEXT,
        cashify_qr_string TEXT,
        cashify_qr_image_url TEXT,
        cashify_original_amount INTEGER,
        cashify_total_amount INTEGER,
        cashify_unique_nominal INTEGER,
        cashify_expired_at TIMESTAMP,
        
        -- Metadata
        notes TEXT,
        processed_at TIMESTAMP,
        expired_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        FOREIGN KEY (rekening_id) REFERENCES rekening(id) ON DELETE SET NULL,
        FOREIGN KEY (gateway_id) REFERENCES gateway(id) ON DELETE SET NULL
    )
    ''')
    
    # Tabel untuk transaksi withdraw
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS withdrawals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_username TEXT,
        user_first_name TEXT,
        user_last_name TEXT,
        
        -- Detail withdraw
        amount INTEGER NOT NULL,
        rekening_id INTEGER NOT NULL,
        rekening_nama TEXT,
        rekening_nomor TEXT,
        rekening_pemilik TEXT,
        
        -- Status
        status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'success', 'failed'
        status_message TEXT,
        
        -- Metadata
        notes TEXT,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        FOREIGN KEY (rekening_id) REFERENCES rekening(id) ON DELETE SET NULL
    )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_deposits_website ON deposits(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_deposits_cashify ON deposits(cashify_transaction_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_withdrawals_website ON withdrawals(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status)')
    
    conn.commit()
    conn.close()
    print("✅ Transactions database initialized successfully")

# Inisialisasi database
init_db()

# ==================== FUNGSI UNTUK DEPOSIT ====================

def create_deposit(website_id, user_id, amount, payment_method, rekening_id=None, gateway_id=None, user_data=None):
    """
    Membuat transaksi deposit baru
    Returns: id deposit jika sukses, None jika gagal
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Hitung waktu expired (default 30 menit untuk qris, 24 jam untuk manual)
        expired_at = None
        if payment_method == 'qris':
            expired_at = (datetime.now() + timedelta(minutes=30)).strftime('%Y-%m-%d %H:%M:%S')
        else:
            expired_at = (datetime.now() + timedelta(hours=24)).strftime('%Y-%m-%d %H:%M:%S')
        
        username = user_data.get('username') if user_data else None
        first_name = user_data.get('first_name') if user_data else None
        last_name = user_data.get('last_name') if user_data else None
        
        cursor.execute('''
            INSERT INTO deposits (
                website_id, user_id, user_username, user_first_name, user_last_name,
                amount, payment_method, rekening_id, gateway_id, status, expired_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            website_id, user_id, username, first_name, last_name,
            amount, payment_method, rekening_id, gateway_id, 'pending', expired_at
        ))
        
        deposit_id = cursor.lastrowid
        conn.commit()
        return deposit_id
        
    except Exception as e:
        print(f"❌ Error creating deposit: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def update_deposit_cashify(deposit_id, cashify_data):
    """
    Update deposit dengan data Cashify setelah generate QRIS
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        expired_at = cashify_data.get('expired_at')
        if expired_at:
            # Parse format dari Cashify
            try:
                expired_dt = datetime.fromisoformat(expired_at.replace('Z', '+00:00'))
                expired_at = expired_dt.strftime('%Y-%m-%d %H:%M:%S')
            except:
                expired_at = (datetime.now() + timedelta(minutes=30)).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            UPDATE deposits SET
                cashify_transaction_id = ?,
                cashify_reference_id = ?,
                cashify_qr_string = ?,
                cashify_qr_image_url = ?,
                cashify_original_amount = ?,
                cashify_total_amount = ?,
                cashify_unique_nominal = ?,
                cashify_expired_at = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (
            cashify_data.get('transaction_id'),
            cashify_data.get('reference_id'),
            cashify_data.get('qr_string'),
            cashify_data.get('qr_image_url'),
            cashify_data.get('original_amount'),
            cashify_data.get('total_amount'),
            cashify_data.get('unique_nominal'),
            expired_at,
            deposit_id
        ))
        
        conn.commit()
        return True
        
    except Exception as e:
        print(f"❌ Error updating deposit cashify: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def update_deposit_status(deposit_id, status, status_message=None):
    """
    Update status deposit
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        processed_at = None
        if status in ['success', 'failed', 'expired']:
            processed_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            UPDATE deposits SET
                status = ?,
                status_message = ?,
                processed_at = COALESCE(?, processed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (status, status_message, processed_at, deposit_id))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        print(f"❌ Error updating deposit status: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def get_deposit(deposit_id):
    """
    Mendapatkan data deposit berdasarkan ID
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM deposits WHERE id = ?', (deposit_id,))
        row = cursor.fetchone()
        
        return dict(row) if row else None
        
    except Exception as e:
        print(f"❌ Error getting deposit: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_deposit_by_cashify_id(transaction_id):
    """
    Mendapatkan deposit berdasarkan cashify transaction ID
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM deposits WHERE cashify_transaction_id = ?', (transaction_id,))
        row = cursor.fetchone()
        
        return dict(row) if row else None
        
    except Exception as e:
        print(f"❌ Error getting deposit by cashify id: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_user_deposits(user_id, website_id=None, status=None, limit=50):
    """
    Mendapatkan semua deposit user dengan filter status
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = "SELECT * FROM deposits WHERE user_id = ?"
        params = [user_id]
        
        if website_id:
            query += " AND website_id = ?"
            params.append(website_id)
        
        if status and status != 'all':
            if status == 'pending':
                query += " AND status IN ('pending', 'processing')"
            elif status == 'success':
                query += " AND status = 'success'"
            elif status == 'failed':
                query += " AND status = 'failed'"
            elif status == 'expired':
                query += " AND status = 'expired'"
        
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error getting user deposits: {e}")
        return []
    finally:
        if conn:
            conn.close()

def check_expired_deposits():
    """
    Mengecek deposit yang expired dan mengupdate statusnya
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            UPDATE deposits 
            SET status = 'expired', updated_at = CURRENT_TIMESTAMP
            WHERE status = 'pending' AND expired_at < ?
        ''', (now,))
        
        updated = cursor.rowcount
        conn.commit()
        
        if updated > 0:
            print(f"✅ {updated} deposits expired")
        
        return updated
        
    except Exception as e:
        print(f"❌ Error checking expired deposits: {e}")
        if conn:
            conn.rollback()
        return 0
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK WITHDRAW ====================

def create_withdrawal(website_id, user_id, amount, rekening_id, rekening_data, user_data=None):
    """
    Membuat transaksi withdraw baru
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        username = user_data.get('username') if user_data else None
        first_name = user_data.get('first_name') if user_data else None
        last_name = user_data.get('last_name') if user_data else None
        
        cursor.execute('''
            INSERT INTO withdrawals (
                website_id, user_id, user_username, user_first_name, user_last_name,
                amount, rekening_id, rekening_nama, rekening_nomor, rekening_pemilik,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            website_id, user_id, username, first_name, last_name,
            amount, rekening_id,
            rekening_data.get('nama'), rekening_data.get('nomor'), rekening_data.get('pemilik'),
            'pending'
        ))
        
        withdraw_id = cursor.lastrowid
        conn.commit()
        return withdraw_id
        
    except Exception as e:
        print(f"❌ Error creating withdrawal: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def update_withdrawal_status(withdraw_id, status, status_message=None):
    """
    Update status withdraw
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        processed_at = None
        if status in ['success', 'failed']:
            processed_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            UPDATE withdrawals SET
                status = ?,
                status_message = ?,
                processed_at = COALESCE(?, processed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (status, status_message, processed_at, withdraw_id))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        print(f"❌ Error updating withdrawal status: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def get_user_withdrawals(user_id, website_id=None, status=None, limit=50):
    """
    Mendapatkan semua withdraw user dengan filter status
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = "SELECT * FROM withdrawals WHERE user_id = ?"
        params = [user_id]
        
        if website_id:
            query += " AND website_id = ?"
            params.append(website_id)
        
        if status and status != 'all':
            if status == 'pending':
                query += " AND status IN ('pending', 'processing')"
            elif status == 'success':
                query += " AND status = 'success'"
            elif status == 'failed':
                query += " AND status = 'failed'"
        
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error getting user withdrawals: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_user_transactions(user_id, website_id=None, status_filter='all', limit=50):
    """
    Mendapatkan semua transaksi user (deposit + withdraw) digabung
    """
    deposits = get_user_deposits(user_id, website_id, status_filter, limit)
    withdrawals = get_user_withdrawals(user_id, website_id, status_filter, limit)
    
    # Gabungkan dan beri tipe
    transactions = []
    
    for d in deposits:
        d['transaction_type'] = 'deposit'
        d['type_icon'] = 'fa-arrow-down'
        d['type_class'] = 'deposit'
        transactions.append(d)
    
    for w in withdrawals:
        w['transaction_type'] = 'withdraw'
        w['type_icon'] = 'fa-arrow-up'
        w['type_class'] = 'withdraw'
        transactions.append(w)
    
    # Urutkan berdasarkan created_at descending
    transactions.sort(key=lambda x: x['created_at'], reverse=True)
    
    return transactions[:limit]

# ==================== FUNGSI UTILITY ====================

def run_scheduled_checks():
    """
    Fungsi yang dipanggil secara berkala untuk mengecek deposit expired
    """
    try:
        updated = check_expired_deposits()
        print(f"✅ Scheduled check completed: {updated} deposits expired")
    except Exception as e:
        print(f"❌ Error in scheduled check: {e}")

# Jalankan pengecekan expired saat startup
try:
    check_expired_deposits()
except Exception as e:
    print(f"⚠️ Initial expiry check warning: {e}")