# users.py - Database handler untuk user Telegram
import sqlite3
import json
from datetime import datetime

DATABASE = 'users.db'

# ==================== FUNGSI DASAR ====================

def get_db():
    """Mendapatkan koneksi database"""
    conn = sqlite3.connect(DATABASE, timeout=30)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database user"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Tabel untuk menyimpan data user Telegram
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        photo_url TEXT,
        language_code TEXT,
        is_bot BOOLEAN DEFAULT 0,
        is_premium BOOLEAN DEFAULT 0,
        last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Tabel untuk menyimpan preferensi user per website
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        website_id INTEGER NOT NULL,
        balance INTEGER DEFAULT 0,
        total_deposit INTEGER DEFAULT 0,
        total_withdraw INTEGER DEFAULT 0,
        total_purchase INTEGER DEFAULT 0,
        settings TEXT DEFAULT '{}',
        is_blocked BOOLEAN DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        UNIQUE(user_id, website_id)
    )
    ''')
    
    # Tabel untuk menyimpan alamat/identitas tambahan user
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_addresses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        website_id INTEGER NOT NULL,
        address_type TEXT NOT NULL, -- 'shipping', 'billing', etc
        recipient_name TEXT,
        phone_number TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        country TEXT DEFAULT 'Indonesia',
        is_default BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Tabel untuk log aktivitas user
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        website_id INTEGER,
        action_type TEXT NOT NULL, -- 'login', 'deposit', 'withdraw', 'purchase', 'claim_voucher', etc
        description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        meta_data TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_id ON users(id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_preferences_website ON user_preferences(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_logs(user_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_activity_website ON user_activity_logs(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_logs(created_at)')
    
    conn.commit()
    conn.close()
    print("✅ Users database initialized successfully")

# Inisialisasi database
init_db()

# ==================== FUNGSI UTAMA USER ====================

def get_or_create_user(user_data):
    """
    Mendapatkan user yang sudah ada atau membuat baru
    Args:
        user_data: dict dengan keys: user_id, username, first_name, last_name, photo_url, dll
    Returns: dict data user atau None jika gagal
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        user_id = user_data.get('user_id')
        if not user_id:
            return None
        
        # Cek apakah user sudah ada
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update last login dan data jika berubah
            cursor.execute('''
                UPDATE users SET
                    username = COALESCE(?, username),
                    first_name = COALESCE(?, first_name),
                    last_name = COALESCE(?, last_name),
                    photo_url = COALESCE(?, photo_url),
                    language_code = COALESCE(?, language_code),
                    last_login = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (
                user_data.get('username'),
                user_data.get('first_name'),
                user_data.get('last_name'),
                user_data.get('photo_url'),
                user_data.get('language_code'),
                user_id
            ))
            
            # Ambil data terbaru
            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
            user = dict(cursor.fetchone())
            
            # Log activity
            log_user_activity(conn, user_id, None, 'login', 'User logged in')
            
        else:
            # Insert user baru
            cursor.execute('''
                INSERT INTO users (
                    id, username, first_name, last_name, photo_url, 
                    language_code, is_bot, is_premium
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                user_id,
                user_data.get('username'),
                user_data.get('first_name'),
                user_data.get('last_name'),
                user_data.get('photo_url'),
                user_data.get('language_code'),
                1 if user_data.get('is_bot') else 0,
                1 if user_data.get('is_premium') else 0
            ))
            
            # Ambil data yang baru diinsert
            cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
            user = dict(cursor.fetchone())
            
            # Log activity
            log_user_activity(conn, user_id, None, 'register', 'New user registered')
        
        conn.commit()
        return user
        
    except Exception as e:
        print(f"❌ Error in get_or_create_user: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_user(user_id):
    """
    Mendapatkan data user berdasarkan ID
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        
        return dict(row) if row else None
        
    except Exception as e:
        print(f"❌ Error getting user: {e}")
        return None
    finally:
        if conn:
            conn.close()

def update_user(user_id, update_data):
    """
    Update data user
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah user ada
        cursor.execute('SELECT id FROM users WHERE id = ?', (user_id,))
        if not cursor.fetchone():
            return False
        
        updates = []
        params = []
        
        allowed_fields = ['username', 'first_name', 'last_name', 'photo_url', 
                         'language_code', 'is_bot', 'is_premium']
        
        for field in allowed_fields:
            if field in update_data:
                updates.append(f"{field} = ?")
                params.append(update_data[field])
        
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
            params.append(user_id)
            cursor.execute(query, params)
            conn.commit()
            return True
        
        return False
        
    except Exception as e:
        print(f"❌ Error updating user: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def delete_user(user_id):
    """
    Hapus user (soft delete dengan menandai is_deleted?)
    Untuk sekarang hard delete dulu
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))
        deleted = cursor.rowcount > 0
        
        conn.commit()
        return deleted
        
    except Exception as e:
        print(f"❌ Error deleting user: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def search_users(query, limit=20):
    """
    Mencari user berdasarkan username, first_name, atau last_name
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        search_term = f"%{query}%"
        cursor.execute('''
            SELECT * FROM users 
            WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ?
            ORDER BY last_login DESC
            LIMIT ?
        ''', (search_term, search_term, search_term, limit))
        
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error searching users: {e}")
        return []
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI USER PREFERENCES ====================

def get_user_preferences(user_id, website_id):
    """
    Mendapatkan preferensi user untuk website tertentu
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM user_preferences
            WHERE user_id = ? AND website_id = ?
        ''', (user_id, website_id))
        
        row = cursor.fetchone()
        
        if row:
            data = dict(row)
            data['settings'] = json.loads(data['settings'] or '{}')
            return data
        else:
            # Buat default preferences
            return create_user_preferences(user_id, website_id)
        
    except Exception as e:
        print(f"❌ Error getting user preferences: {e}")
        return None
    finally:
        if conn:
            conn.close()

def create_user_preferences(user_id, website_id):
    """
    Membuat preferensi default untuk user di website tertentu
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO user_preferences (user_id, website_id, balance, settings)
            VALUES (?, ?, ?, ?)
        ''', (user_id, website_id, 0, json.dumps({})))
        
        conn.commit()
        
        return {
            'user_id': user_id,
            'website_id': website_id,
            'balance': 0,
            'total_deposit': 0,
            'total_withdraw': 0,
            'total_purchase': 0,
            'settings': {},
            'is_blocked': 0
        }
        
    except Exception as e:
        print(f"❌ Error creating user preferences: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

# users.py - Perbaiki fungsi update_user_balance

def update_user_balance(user_id, website_id, amount, operation='add', transaction_type=None):
    """
    Update balance user
    Args:
        operation: 'add' untuk menambah, 'subtract' untuk mengurangi
        transaction_type: 'deposit', 'withdraw', atau None
    Returns: balance baru atau None jika gagal
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah preferensi sudah ada
        cursor.execute('''
            SELECT id, balance, total_deposit, total_withdraw FROM user_preferences
            WHERE user_id = ? AND website_id = ?
        ''', (user_id, website_id))
        
        existing = cursor.fetchone()
        
        if existing:
            current = dict(existing)
            current_balance = current['balance']
            
            if operation == 'add':
                new_balance = current_balance + amount
                # Update balance dan total_deposit
                cursor.execute('''
                    UPDATE user_preferences SET
                        balance = ?,
                        total_deposit = total_deposit + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND website_id = ?
                ''', (new_balance, amount, user_id, website_id))
                print(f"💰 Balance added: +{amount}, new balance: {new_balance}")
                
            else:  # subtract
                new_balance = max(0, current_balance - amount)
                cursor.execute('''
                    UPDATE user_preferences SET
                        balance = ?,
                        total_withdraw = total_withdraw + ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND website_id = ?
                ''', (new_balance, amount, user_id, website_id))
                print(f"💰 Balance subtracted: -{amount}, new balance: {new_balance}")
        else:
            # Insert baru
            if operation == 'add':
                new_balance = amount
                cursor.execute('''
                    INSERT INTO user_preferences 
                    (user_id, website_id, balance, total_deposit)
                    VALUES (?, ?, ?, ?)
                ''', (user_id, website_id, new_balance, amount))
                print(f"💰 New user, balance set to: {new_balance}")
            else:
                new_balance = 0
                cursor.execute('''
                    INSERT INTO user_preferences 
                    (user_id, website_id, balance)
                    VALUES (?, ?, ?)
                ''', (user_id, website_id, new_balance))
                print(f"💰 New user, balance set to: {new_balance}")
        
        conn.commit()
        
        # Log activity
        action_desc = f'Balance {operation}: {amount}'
        if transaction_type:
            action_desc = f'{transaction_type}: {amount}'
        
        log_user_activity(conn, user_id, website_id, 'balance_update', 
                         action_desc, 
                         {'new_balance': new_balance, 'operation': operation})
        
        # Verifikasi balance tersimpan
        cursor.execute('''
            SELECT balance FROM user_preferences
            WHERE user_id = ? AND website_id = ?
        ''', (user_id, website_id))
        verified = cursor.fetchone()
        if verified and verified['balance'] == new_balance:
            print(f"✅ Balance verified in database: {verified['balance']}")
        else:
            print(f"⚠️ Balance verification failed: expected {new_balance}, got {verified['balance'] if verified else 'None'}")
        
        return new_balance
        
    except Exception as e:
        print(f"❌ Error updating user balance: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_user_balance(user_id, website_id):
    """
    Mendapatkan balance user untuk website tertentu
    Langsung dari database
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT balance FROM user_preferences
            WHERE user_id = ? AND website_id = ?
        ''', (user_id, website_id))
        
        row = cursor.fetchone()
        balance = row['balance'] if row else 0
        print(f"💰 Retrieved balance from DB for user {user_id}: {balance}")
        return balance
        
    except Exception as e:
        print(f"❌ Error getting user balance: {e}")
        return 0
    finally:
        if conn:
            conn.close()

def update_user_preferences(user_id, website_id, settings):
    """
    Update settings user
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        settings_json = json.dumps(settings)
        
        cursor.execute('''
            UPDATE user_preferences SET
                settings = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND website_id = ?
        ''', (settings_json, user_id, website_id))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        print(f"❌ Error updating user preferences: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def block_user(user_id, website_id, block=True, reason=None):
    """
    Block atau unblock user di website tertentu
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE user_preferences SET
                is_blocked = ?,
                notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND website_id = ?
        ''', (1 if block else 0, reason, user_id, website_id))
        
        conn.commit()
        return cursor.rowcount > 0
        
    except Exception as e:
        print(f"❌ Error blocking user: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI USER ADDRESSES ====================

def add_user_address(user_id, website_id, address_data):
    """
    Menambahkan alamat baru untuk user
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Jika ini alamat default, reset default lainnya
        if address_data.get('is_default'):
            cursor.execute('''
                UPDATE user_addresses SET is_default = 0
                WHERE user_id = ? AND website_id = ?
            ''', (user_id, website_id))
        
        cursor.execute('''
            INSERT INTO user_addresses (
                user_id, website_id, address_type, recipient_name,
                phone_number, address_line1, address_line2, city,
                state, postal_code, country, is_default
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            website_id,
            address_data.get('address_type', 'shipping'),
            address_data.get('recipient_name'),
            address_data.get('phone_number'),
            address_data.get('address_line1'),
            address_data.get('address_line2'),
            address_data.get('city'),
            address_data.get('state'),
            address_data.get('postal_code'),
            address_data.get('country', 'Indonesia'),
            1 if address_data.get('is_default') else 0
        ))
        
        address_id = cursor.lastrowid
        conn.commit()
        
        log_user_activity(conn, user_id, website_id, 'add_address', 
                         f'Added new address: {address_data.get("address_type")}')
        
        return address_id
        
    except Exception as e:
        print(f"❌ Error adding address: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_user_addresses(user_id, website_id, address_type=None):
    """
    Mendapatkan semua alamat user
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = "SELECT * FROM user_addresses WHERE user_id = ? AND website_id = ?"
        params = [user_id, website_id]
        
        if address_type:
            query += " AND address_type = ?"
            params.append(address_type)
        
        query += " ORDER BY is_default DESC, created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        return [dict(row) for row in rows]
        
    except Exception as e:
        print(f"❌ Error getting addresses: {e}")
        return []
    finally:
        if conn:
            conn.close()

def delete_user_address(address_id, user_id):
    """
    Hapus alamat user
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', 
                      (address_id, user_id))
        deleted = cursor.rowcount > 0
        
        conn.commit()
        return deleted
        
    except Exception as e:
        print(f"❌ Error deleting address: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI ACTIVITY LOGS ====================

def log_user_activity(conn, user_id, website_id, action_type, description, meta_data=None):
    """
    Internal function untuk log aktivitas user
    """
    try:
        cursor = conn.cursor()
        meta_json = json.dumps(meta_data or {})
        
        cursor.execute('''
            INSERT INTO user_activity_logs 
            (user_id, website_id, action_type, description, meta_data)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, website_id, action_type, description, meta_json))
        
    except Exception as e:
        print(f"❌ Error logging user activity: {e}")

def get_user_activities(user_id, website_id=None, limit=50, offset=0):
    """
    Mendapatkan aktivitas user
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        query = "SELECT * FROM user_activity_logs WHERE user_id = ?"
        params = [user_id]
        
        if website_id:
            query += " AND website_id = ?"
            params.append(website_id)
        
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        activities = []
        for row in rows:
            activity = dict(row)
            activity['meta_data'] = json.loads(activity['meta_data'] or '{}')
            activities.append(activity)
        
        return activities
        
    except Exception as e:
        print(f"❌ Error getting user activities: {e}")
        return []
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI STATISTIK ====================

def get_user_statistics(website_id=None):
    """
    Mendapatkan statistik user
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        stats = {
            'total_users': 0,
            'active_today': 0,
            'active_week': 0,
            'active_month': 0,
            'new_users_today': 0,
            'new_users_week': 0,
            'new_users_month': 0,
            'total_balance': 0
        }
        
        # Total users
        if website_id:
            cursor.execute('''
                SELECT COUNT(DISTINCT user_id) as total
                FROM user_preferences WHERE website_id = ?
            ''', (website_id,))
        else:
            cursor.execute('SELECT COUNT(*) as total FROM users')
        
        row = cursor.fetchone()
        stats['total_users'] = row['total'] or 0
        
        # Active today
        if website_id:
            cursor.execute('''
                SELECT COUNT(DISTINCT user_id) as total
                FROM user_activity_logs
                WHERE website_id = ? AND date(created_at) = date('now')
            ''', (website_id,))
        else:
            cursor.execute('''
                SELECT COUNT(DISTINCT user_id) as total
                FROM user_activity_logs
                WHERE date(created_at) = date('now')
            ''')
        row = cursor.fetchone()
        stats['active_today'] = row['total'] or 0
        
        # Total balance for website
        if website_id:
            cursor.execute('''
                SELECT SUM(balance) as total FROM user_preferences
                WHERE website_id = ?
            ''', (website_id,))
            row = cursor.fetchone()
            stats['total_balance'] = row['total'] or 0
        
        return stats
        
    except Exception as e:
        print(f"❌ Error getting user statistics: {e}")
        return stats
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI MIGRASI ====================

def migrate_database():
    """Migrasi database ke struktur terbaru"""
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Cek apakah tabel users ada
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print("⚠️ Tabel users belum ada, inisialisasi dulu...")
            conn.close()
            init_db()
            return
        
        # Dapatkan daftar kolom yang sudah ada di tabel users
        cursor.execute("PRAGMA table_info(users)")
        existing_columns = [col[1] for col in cursor.fetchall()]
        
        print("📊 Existing columns in users:", existing_columns)
        
        # Kolom yang mungkin kurang
        required_columns = {
            'language_code': 'TEXT',
            'is_bot': 'BOOLEAN DEFAULT 0',
            'is_premium': 'BOOLEAN DEFAULT 0'
        }
        
        for col_name, col_type in required_columns.items():
            if col_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"
                    cursor.execute(alter_sql)
                    print(f"✅ Column '{col_name}' added to users table")
                except Exception as e:
                    print(f"❌ Failed to add column '{col_name}': {e}")
        
        # Cek tabel user_preferences
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_preferences'")
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(user_preferences)")
            existing_pref_columns = [col[1] for col in cursor.fetchall()]
            
            pref_columns = {
                'total_deposit': 'INTEGER DEFAULT 0',
                'total_withdraw': 'INTEGER DEFAULT 0',
                'total_purchase': 'INTEGER DEFAULT 0',
                'is_blocked': 'BOOLEAN DEFAULT 0',
                'notes': 'TEXT'
            }
            
            for col_name, col_type in pref_columns.items():
                if col_name not in existing_pref_columns:
                    try:
                        alter_sql = f"ALTER TABLE user_preferences ADD COLUMN {col_name} {col_type}"
                        cursor.execute(alter_sql)
                        print(f"✅ Column '{col_name}' added to user_preferences table")
                    except Exception as e:
                        print(f"❌ Failed to add column '{col_name}': {e}")
        
        conn.commit()
        print("✅ Users database migration completed successfully")
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        import traceback
        traceback.print_exc()
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

# ==================== FUNGSI SCHEDULED ====================

def cleanup_old_logs(days=30):
    """
    Membersihkan log aktivitas yang lebih tua dari X hari
    Bisa dijalankan via cron
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM user_activity_logs
            WHERE created_at < datetime('now', ?)
        ''', (f'-{days} days',))
        
        deleted = cursor.rowcount
        conn.commit()
        
        if deleted > 0:
            print(f"✅ Cleaned up {deleted} old activity logs")
        
        return deleted
        
    except Exception as e:
        print(f"❌ Error cleaning up logs: {e}")
        if conn:
            conn.rollback()
        return 0
    finally:
        if conn:
            conn.close()