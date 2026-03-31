# trx.py - Database handler untuk transaksi (deposit, withdraw) VERSI MYSQL
import json
from datetime import datetime, timedelta
from db_config import get_db_connection

# ==================== FUNGSI DASAR ====================

def init_db():
    """Inisialisasi database MySQL untuk transaksi"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabel untuk transaksi deposit
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS deposits (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        user_id INT NOT NULL,
        user_username VARCHAR(255),
        user_first_name VARCHAR(255),
        user_last_name VARCHAR(255),
        
        -- Detail transaksi
        amount INT NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        rekening_id INT,
        gateway_id INT,
        
        -- Status transaksi
        status VARCHAR(50) DEFAULT 'pending',
        status_message TEXT,
        
        -- Data Cashify
        cashify_transaction_id VARCHAR(255) UNIQUE,
        cashify_reference_id VARCHAR(255),
        cashify_qr_string TEXT,
        cashify_qr_image_url TEXT,
        cashify_original_amount INT,
        cashify_total_amount INT,
        cashify_unique_nominal INT,
        cashify_expired_at TIMESTAMP NULL,
        
        -- Kolom tambahan
        voucher_id INT,
        proof_url TEXT,
        rekening_logo TEXT,
        rekening_nama VARCHAR(255),
        rekening_nomor VARCHAR(100),
        rekening_pemilik VARCHAR(255),
        rejection_reason TEXT,
        rejected_at TIMESTAMP NULL,
        
        -- Metadata
        notes TEXT,
        processed_at TIMESTAMP NULL,
        expired_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        INDEX idx_deposits_website (website_id),
        INDEX idx_deposits_user (user_id),
        INDEX idx_deposits_status (status),
        INDEX idx_deposits_cashify (cashify_transaction_id)
    )
    ''')
    
    # Tabel untuk transaksi withdraw
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        user_id INT NOT NULL,
        user_username VARCHAR(255),
        user_first_name VARCHAR(255),
        user_last_name VARCHAR(255),
        
        -- Detail withdraw
        amount INT NOT NULL,
        rekening_id INT NOT NULL,
        rekening_nama VARCHAR(255),
        rekening_nomor VARCHAR(100),
        rekening_pemilik VARCHAR(255),
        rekening_logo TEXT,
        
        -- Status
        status VARCHAR(50) DEFAULT 'pending',
        status_message TEXT,
        
        -- Metadata
        notes TEXT,
        processed_by INT,
        processed_notes TEXT,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        INDEX idx_withdrawals_website (website_id),
        INDEX idx_withdrawals_user (user_id),
        INDEX idx_withdrawals_status (status)
    )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ MySQL Transactions database initialized successfully")

# ==================== FUNGSI UNTUK DEPOSIT ====================

def create_deposit(website_id, user_id, amount, payment_method, rekening_id=None, gateway_id=None, voucher_id=None, proof_url=None, user_data=None):
    """
    Membuat transaksi deposit baru
    Returns: id deposit jika sukses, None jika gagal
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Hitung waktu expired (30 menit untuk qris, 1 jam untuk manual)
        expired_at = None
        if payment_method == 'qris':
            expired_at = (datetime.now() + timedelta(minutes=30)).strftime('%Y-%m-%d %H:%M:%S')
        else:
            expired_at = (datetime.now() + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')
        
        username = user_data.get('username') if user_data else None
        first_name = user_data.get('first_name') if user_data else None
        last_name = user_data.get('last_name') if user_data else None
        
        # Ambil data rekening jika ada
        rekening_logo = None
        rekening_nama = None
        rekening_nomor = None
        rekening_pemilik = None
        
        if rekening_id and payment_method != 'qris':
            from py import pmb
            rekening = pmb.get_rekening_by_id(rekening_id)
            if rekening:
                rekening_logo = rekening.get('logo_url')
                rekening_nama = rekening.get('nama')
                rekening_nomor = rekening.get('nomor')
                rekening_pemilik = rekening.get('pemilik')
        
        cursor.execute('''
            INSERT INTO deposits (
                website_id, user_id, user_username, user_first_name, user_last_name,
                amount, payment_method, rekening_id, gateway_id, status, expired_at,
                voucher_id, proof_url, rekening_logo, rekening_nama, rekening_nomor, rekening_pemilik
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            website_id, user_id, username, first_name, last_name,
            amount, payment_method, rekening_id, gateway_id, 'pending', expired_at,
            voucher_id, proof_url, rekening_logo, rekening_nama, rekening_nomor, rekening_pemilik
        ))
        
        deposit_id = cursor.lastrowid
        conn.commit()
        return deposit_id
        
    except Exception as e:
        print(f"❌ Error creating deposit: {e}")
        import traceback
        traceback.print_exc()
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
        conn = get_db_connection()
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
                cashify_transaction_id = %s,
                cashify_reference_id = %s,
                cashify_qr_string = %s,
                cashify_qr_image_url = %s,
                cashify_original_amount = %s,
                cashify_total_amount = %s,
                cashify_unique_nominal = %s,
                cashify_expired_at = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
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
    """Update status deposit"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Ambil data deposit dulu
        cursor.execute('SELECT * FROM deposits WHERE id = %s', (deposit_id,))
        deposit = cursor.fetchone()
        
        if not deposit:
            print(f"❌ Deposit dengan ID {deposit_id} tidak ditemukan")
            return False
        
        # Tentukan processed_at - semua status final memiliki timestamp
        processed_at = None
        if status in ['success', 'failed', 'expired', 'rejected']:
            processed_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"📅 Setting processed_at untuk status {status}: {processed_at}")
        
        # Update status di database
        cursor.execute('''
            UPDATE deposits SET
                status = %s,
                status_message = %s,
                processed_at = COALESCE(%s, processed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (status, status_message, processed_at, deposit_id))
        
        # Jika status success, update balance user
        if status == 'success':
            from py import users
            print(f"💰 Updating balance for user {deposit['user_id']} on website {deposit['website_id']} with amount {deposit['amount']}")
            
            new_balance = users.update_user_balance(
                user_id=deposit['user_id'],
                website_id=deposit['website_id'],
                amount=deposit['amount'],
                operation='add',
                transaction_type='deposit'
            )
            
            if new_balance is not None:
                print(f"✅ Balance updated successfully: {new_balance}")
            else:
                print(f"❌ Failed to update balance")
        
        # Log untuk status rejected
        elif status == 'rejected':
            print(f"❌ Deposit {deposit_id} ditolak. Alasan: {status_message}")
        
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"✅ Status deposit {deposit_id} berhasil diupdate menjadi {status}")
            return True
        else:
            print(f"⚠️ Tidak ada perubahan status untuk deposit {deposit_id}")
            return False
        
    except Exception as e:
        print(f"❌ Error updating deposit status: {e}")
        import traceback
        traceback.print_exc()
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('SELECT * FROM deposits WHERE id = %s', (deposit_id,))
        row = cursor.fetchone()
        
        return row
        
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('SELECT * FROM deposits WHERE cashify_transaction_id = %s', (transaction_id,))
        row = cursor.fetchone()
        
        return row
        
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT * FROM deposits WHERE user_id = %s"
        params = [user_id]
        
        if website_id:
            query += " AND website_id = %s"
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
        
        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return rows
        
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
        conn = get_db_connection()
        cursor = conn.cursor()
        
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            UPDATE deposits 
            SET status = 'expired', updated_at = CURRENT_TIMESTAMP
            WHERE status = 'pending' AND expired_at < %s
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

def get_all_deposits(website_id, limit=100):
    """
    Mendapatkan semua deposit untuk website tertentu (untuk admin panel)
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT * FROM deposits 
            WHERE website_id = %s 
            ORDER BY created_at DESC
            LIMIT %s
        ''', (website_id, limit))
        
        rows = cursor.fetchall()
        return rows
        
    except Exception as e:
        print(f"❌ Error getting all deposits: {e}")
        return []
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
        conn = get_db_connection()
        cursor = conn.cursor()
        
        username = user_data.get('username') if user_data else None
        first_name = user_data.get('first_name') if user_data else None
        last_name = user_data.get('last_name') if user_data else None
        
        cursor.execute('''
            INSERT INTO withdrawals (
                website_id, user_id, user_username, user_first_name, user_last_name,
                amount, rekening_id, rekening_nama, rekening_nomor, rekening_pemilik,
                status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
        conn = get_db_connection()
        cursor = conn.cursor()
        
        processed_at = None
        if status in ['success', 'failed']:
            processed_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            UPDATE withdrawals SET
                status = %s,
                status_message = %s,
                processed_at = COALESCE(%s, processed_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
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
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT * FROM withdrawals WHERE user_id = %s"
        params = [user_id]
        
        if website_id:
            query += " AND website_id = %s"
            params.append(website_id)
        
        if status and status != 'all':
            if status == 'pending':
                query += " AND status IN ('pending', 'processing')"
            elif status == 'success':
                query += " AND status = 'success'"
            elif status == 'failed':
                query += " AND status = 'failed'"
        
        query += " ORDER BY created_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return rows
        
    except Exception as e:
        print(f"❌ Error getting user withdrawals: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_all_withdrawals(website_id, limit=100):
    """
    Mendapatkan semua withdrawals untuk website tertentu (untuk admin panel)
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT * FROM withdrawals 
            WHERE website_id = %s 
            ORDER BY created_at DESC
            LIMIT %s
        ''', (website_id, limit))
        
        rows = cursor.fetchall()
        return rows
        
    except Exception as e:
        print(f"❌ Error getting all withdrawals: {e}")
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

# ==================== FUNGSI MIGRASI ====================

def migrate_database():
    """
    Migrasi database MySQL dengan menambahkan kolom baru jika belum ada
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah tabel deposits ada
        cursor.execute("SHOW TABLES LIKE 'deposits'")
        if not cursor.fetchone():
            print("⚠️ Tabel deposits belum ada, inisialisasi dulu...")
            conn.close()
            init_db()
            return
        
        # Dapatkan daftar kolom yang sudah ada di tabel deposits
        cursor.execute("SHOW COLUMNS FROM deposits")
        existing_columns = [col['Field'] for col in cursor.fetchall()]
        
        print("📊 Existing columns in deposits:", existing_columns)
        
        # Kolom baru yang harus ada
        new_columns = {
            'voucher_id': 'INT',
            'proof_url': 'TEXT',
            'rekening_logo': 'TEXT',
            'rekening_nama': 'VARCHAR(255)',
            'rekening_nomor': 'VARCHAR(100)',
            'rekening_pemilik': 'VARCHAR(255)',
            'rejection_reason': 'TEXT',
            'rejected_at': 'TIMESTAMP NULL'
        }
        
        columns_added = []
        for col_name, col_type in new_columns.items():
            if col_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE deposits ADD COLUMN {col_name} {col_type}"
                    cursor.execute(alter_sql)
                    columns_added.append(col_name)
                    print(f"✅ Column '{col_name}' added to deposits table")
                except Exception as e:
                    print(f"❌ Failed to add column '{col_name}': {e}")
        
        if columns_added:
            print(f"✅ Added columns: {', '.join(columns_added)}")
        else:
            print("✅ All columns already exist")
        
        # Cek apakah tabel withdrawals ada
        cursor.execute("SHOW TABLES LIKE 'withdrawals'")
        if cursor.fetchone():
            cursor.execute("SHOW COLUMNS FROM withdrawals")
            existing_withdraw_columns = [col['Field'] for col in cursor.fetchall()]
            
            new_withdraw_columns = {
                'rekening_logo': 'TEXT',
                'processed_by': 'INT',
                'processed_notes': 'TEXT'
            }
            
            for col_name, col_type in new_withdraw_columns.items():
                if col_name not in existing_withdraw_columns:
                    try:
                        alter_sql = f"ALTER TABLE withdrawals ADD COLUMN {col_name} {col_type}"
                        cursor.execute(alter_sql)
                        print(f"✅ Column '{col_name}' added to withdrawals table")
                    except Exception as e:
                        print(f"❌ Failed to add column '{col_name}': {e}")
        
        conn.commit()
        print("✅ MySQL Transactions database migration completed successfully")
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# ==================== INISIALISASI ====================

# Inisialisasi database
try:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES LIKE 'deposits'")
    table_exists = cursor.fetchone()
    conn.close()
    
    if not table_exists:
        init_db()
    else:
        print("✅ MySQL transactions tables already exist, checking migration...")
        migrate_database()
        check_expired_deposits()
        
except Exception as e:
    print(f"⚠️ Database init warning: {e}")