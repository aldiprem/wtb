# vcr.py - Database handler untuk voucher website VERSI MYSQL
import json
from datetime import datetime, timedelta
from db_config import get_db_connection

# ==================== FUNGSI DASAR ====================

def init_db():
    """Inisialisasi database MySQL untuk voucher"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabel untuk voucher
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS vouchers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        kode VARCHAR(100) NOT NULL,
        nama VARCHAR(255) NOT NULL,
        deskripsi TEXT,
        
        -- Masa berlaku
        start_date DATE,
        end_date DATE,
        start_time VARCHAR(5) DEFAULT '00:00',
        end_time VARCHAR(5) DEFAULT '23:59',
        no_expiry BOOLEAN DEFAULT 0,
        
        -- Pengaturan klaim
        target VARCHAR(50) DEFAULT 'all',
        limit_klaim INT DEFAULT 1,
        selected_users TEXT DEFAULT '[]',
        
        -- Status
        active BOOLEAN DEFAULT 1,
        expired BOOLEAN DEFAULT 0,
        
        -- Reward
        reward_type VARCHAR(50) NOT NULL,
        reward_data TEXT NOT NULL,
        
        -- Statistik
        total_claimed INT DEFAULT 0,
        total_used INT DEFAULT 0,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        UNIQUE KEY unique_voucher_code (website_id, kode),
        INDEX idx_vouchers_website (website_id),
        INDEX idx_vouchers_kode (website_id, kode),
        INDEX idx_vouchers_status (website_id, active, expired)
    )
    ''')
    
    # Tabel untuk klaim voucher (user yang mengklaim)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS voucher_claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_id INT NOT NULL,
        user_id BIGINT NOT NULL,
        user_username VARCHAR(255),
        user_name VARCHAR(255),
        claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        used BOOLEAN DEFAULT 0,
        used_at TIMESTAMP NULL,
        order_id INT,
        expired_at TIMESTAMP NULL,
        
        FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
        INDEX idx_claims_voucher (voucher_id),
        INDEX idx_claims_user (user_id)
    )
    ''')
    
    # Tabel untuk broadcast voucher
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS voucher_broadcasts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        voucher_id INT NOT NULL,
        target VARCHAR(50) NOT NULL,
        selected_users TEXT DEFAULT '[]',
        message TEXT,
        sent_count INT DEFAULT 0,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
        INDEX idx_broadcasts_voucher (voucher_id)
    )
    ''')
    
    # Tabel untuk aktivitas voucher
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS voucher_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        website_id INT NOT NULL,
        voucher_id INT,
        type VARCHAR(50) NOT NULL,
        description TEXT,
        meta_data TEXT DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
        FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE SET NULL,
        INDEX idx_activities_website (website_id),
        INDEX idx_activities_voucher (voucher_id),
        INDEX idx_activities_created (created_at)
    )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ MySQL Voucher database initialized successfully")

# ==================== FUNGSI UNTUK VOUCHER ====================

def save_voucher(website_id, data):
    """
    Menyimpan atau update voucher
    Returns: id voucher jika sukses, None jika gagal
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        voucher_id = data.get('id')
        
        # Siapkan reward_data sebagai JSON
        reward_data = json.dumps(data.get('reward', {}))
        
        # Siapkan selected_users sebagai JSON
        selected_users = json.dumps(data.get('selected_users', []))
        
        if voucher_id:
            # Update existing voucher
            cursor.execute('''
                UPDATE vouchers SET
                    kode = %s,
                    nama = %s,
                    deskripsi = %s,
                    start_date = %s,
                    end_date = %s,
                    start_time = %s,
                    end_time = %s,
                    no_expiry = %s,
                    target = %s,
                    limit_klaim = %s,
                    selected_users = %s,
                    active = %s,
                    reward_type = %s,
                    reward_data = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND website_id = %s
            ''', (
                data.get('kode'),
                data.get('nama'),
                data.get('deskripsi'),
                data.get('start_date'),
                data.get('end_date'),
                data.get('start_time', '00:00'),
                data.get('end_time', '23:59'),
                1 if data.get('no_expiry') else 0,
                data.get('target', 'all'),
                data.get('limit', 1),
                selected_users,
                1 if data.get('active', True) else 0,
                data.get('type'),
                reward_data,
                voucher_id,
                website_id
            ))
            
            # Log activity
            log_activity(conn, website_id, voucher_id, 'update', 
                        f'Voucher "{data.get("nama")}" diperbarui')
            
        else:
            # Insert new voucher
            cursor.execute('''
                INSERT INTO vouchers (
                    website_id, kode, nama, deskripsi,
                    start_date, end_date, start_time, end_time, no_expiry,
                    target, limit_klaim, selected_users,
                    active, reward_type, reward_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (
                website_id,
                data.get('kode'),
                data.get('nama'),
                data.get('deskripsi'),
                data.get('start_date'),
                data.get('end_date'),
                data.get('start_time', '00:00'),
                data.get('end_time', '23:59'),
                1 if data.get('no_expiry') else 0,
                data.get('target', 'all'),
                data.get('limit', 1),
                selected_users,
                1 if data.get('active', True) else 0,
                data.get('type'),
                reward_data
            ))
            voucher_id = cursor.lastrowid
            
            # Log activity
            log_activity(conn, website_id, voucher_id, 'create', 
                        f'Voucher baru dibuat: "{data.get("nama")}"')
        
        conn.commit()
        
        # Update status expired jika perlu
        check_expired_vouchers(website_id)
        
        return voucher_id
        
    except Exception as e:
        print(f"❌ Error saving voucher: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_vouchers(website_id, filters=None):
    """
    Mendapatkan semua voucher untuk website tertentu
    filters: dictionary dengan key 'active', 'expired', 'type', 'search'
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT * FROM vouchers WHERE website_id = %s"
        params = [website_id]
        
        if filters:
            if filters.get('active') is not None:
                query += " AND active = %s"
                params.append(1 if filters['active'] else 0)
            
            if filters.get('expired') is not None:
                query += " AND expired = %s"
                params.append(1 if filters['expired'] else 0)
            
            if filters.get('type'):
                query += " AND reward_type = %s"
                params.append(filters['type'])
            
            if filters.get('search'):
                query += " AND (nama LIKE %s OR kode LIKE %s)"
                params.append(f'%{filters["search"]}%')
                params.append(f'%{filters["search"]}%')
        
        query += " ORDER BY created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        vouchers = []
        for row in rows:
            voucher = dict(row)
            # Parse JSON fields
            try:
                voucher['reward_data'] = json.loads(voucher['reward_data'] or '{}')
            except:
                voucher['reward_data'] = {}
            try:
                voucher['selected_users'] = json.loads(voucher['selected_users'] or '[]')
            except:
                voucher['selected_users'] = []
            vouchers.append(voucher)
        
        return vouchers
        
    except Exception as e:
        print(f"❌ Error getting vouchers: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_voucher(voucher_id):
    """Mendapatkan voucher berdasarkan ID"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('SELECT * FROM vouchers WHERE id = %s', (voucher_id,))
        row = cursor.fetchone()
        
        if row:
            voucher = dict(row)
            try:
                voucher['reward_data'] = json.loads(voucher['reward_data'] or '{}')
            except:
                voucher['reward_data'] = {}
            try:
                voucher['selected_users'] = json.loads(voucher['selected_users'] or '[]')
            except:
                voucher['selected_users'] = []
            return voucher
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting voucher: {e}")
        return None
    finally:
        if conn:
            conn.close()

def get_voucher_by_code(website_id, kode):
    """Mendapatkan voucher berdasarkan kode"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT * FROM vouchers 
            WHERE website_id = %s AND kode = %s
        ''', (website_id, kode))
        
        row = cursor.fetchone()
        
        if row:
            voucher = dict(row)
            try:
                voucher['reward_data'] = json.loads(voucher['reward_data'] or '{}')
            except:
                voucher['reward_data'] = {}
            try:
                voucher['selected_users'] = json.loads(voucher['selected_users'] or '[]')
            except:
                voucher['selected_users'] = []
            return voucher
        
        return None
        
    except Exception as e:
        print(f"❌ Error getting voucher by code: {e}")
        return None
    finally:
        if conn:
            conn.close()

def update_voucher_status(voucher_id, active=None, expired=None):
    """Update status voucher"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if active is not None:
            updates.append("active = %s")
            params.append(1 if active else 0)
        
        if expired is not None:
            updates.append("expired = %s")
            params.append(1 if expired else 0)
        
        if updates:
            updates.append("updated_at = CURRENT_TIMESTAMP")
            query = f"UPDATE vouchers SET {', '.join(updates)} WHERE id = %s"
            params.append(voucher_id)
            cursor.execute(query, params)
            conn.commit()
            return True
        
        return False
        
    except Exception as e:
        print(f"❌ Error updating voucher status: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def delete_voucher(voucher_id):
    """Hapus voucher berdasarkan ID"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Dapatkan data voucher untuk log
        cursor.execute('SELECT nama FROM vouchers WHERE id = %s', (voucher_id,))
        voucher = cursor.fetchone()
        
        if not voucher:
            return False
        
        # Hapus voucher (claims dan broadcasts akan terhapus otomatis karena cascade)
        cursor.execute('DELETE FROM vouchers WHERE id = %s', (voucher_id,))
        deleted = cursor.rowcount > 0
        
        conn.commit()
        return deleted
        
    except Exception as e:
        print(f"❌ Error deleting voucher: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def check_expired_vouchers(website_id=None):
    """
    Memeriksa dan mengupdate status expired untuk voucher
    Jika website_id None, cek semua website
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        query = '''
            UPDATE vouchers 
            SET expired = 1, active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE no_expiry = 0 
            AND (end_date < CURDATE() 
                 OR (end_date = CURDATE() AND end_time < CURTIME()))
        '''
        
        if website_id:
            query += " AND website_id = %s"
            cursor.execute(query, (website_id,))
        else:
            cursor.execute(query)
        
        updated = cursor.rowcount
        conn.commit()
        
        if updated > 0:
            print(f"✅ {updated} voucher expired")
        
        return updated
        
    except Exception as e:
        print(f"❌ Error checking expired vouchers: {e}")
        if conn:
            conn.rollback()
        return 0
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK CLAIM ====================

def claim_voucher(voucher_id, user_id, user_username=None, user_name=None):
    """
    User mengklaim voucher
    Returns: dict dengan status dan message
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek voucher
        cursor.execute('''
            SELECT * FROM vouchers 
            WHERE id = %s AND active = 1 AND expired = 0
        ''', (voucher_id,))
        
        voucher = cursor.fetchone()
        if not voucher:
            return {'success': False, 'message': 'Voucher tidak tersedia'}
        
        # Cek limit klaim
        if voucher['total_claimed'] >= voucher['limit_klaim']:
            return {'success': False, 'message': 'Kuota voucher habis'}
        
        # Cek apakah user sudah pernah klaim
        cursor.execute('''
            SELECT id FROM voucher_claims 
            WHERE voucher_id = %s AND user_id = %s
        ''', (voucher_id, user_id))
        
        if cursor.fetchone():
            return {'success': False, 'message': 'Anda sudah mengklaim voucher ini'}
        
        # Cek target
        if voucher['target'] == 'manual':
            try:
                selected_users = json.loads(voucher['selected_users'] or '[]')
            except:
                selected_users = []
            if user_id not in selected_users:
                return {'success': False, 'message': 'Anda tidak berhak mengklaim voucher ini'}
        
        # Insert claim
        expiry_date = None
        if not voucher['no_expiry']:
            # Set expiry 30 days after claim (configurable)
            expiry_date = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
        
        cursor.execute('''
            INSERT INTO voucher_claims 
            (voucher_id, user_id, user_username, user_name, expired_at)
            VALUES (%s, %s, %s, %s, %s)
        ''', (voucher_id, user_id, user_username, user_name, expiry_date))
        
        # Update total claimed
        cursor.execute('''
            UPDATE vouchers 
            SET total_claimed = total_claimed + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (voucher_id,))
        
        # Log activity
        cursor.execute('''
            INSERT INTO voucher_activities 
            (website_id, voucher_id, type, description, meta_data)
            SELECT %s, %s, 'claim', %s, %s
        ''', (
            voucher['website_id'],
            voucher_id,
            f'User {user_username or user_id} mengklaim voucher',
            json.dumps({'user_id': user_id, 'username': user_username})
        ))
        
        conn.commit()
        
        return {
            'success': True, 
            'message': 'Voucher berhasil diklaim',
            'voucher': voucher
        }
        
    except Exception as e:
        print(f"❌ Error claiming voucher: {e}")
        if conn:
            conn.rollback()
        return {'success': False, 'message': str(e)}
    finally:
        if conn:
            conn.close()

def use_voucher(claim_id, order_id=None):
    """
    Menandai voucher sebagai digunakan
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE voucher_claims 
            SET used = 1, used_at = CURRENT_TIMESTAMP, order_id = %s
            WHERE id = %s AND used = 0
        ''', (order_id, claim_id))
        
        if cursor.rowcount == 0:
            return {'success': False, 'message': 'Claim tidak ditemukan atau sudah digunakan'}
        
        # Update total used di voucher
        cursor.execute('''
            UPDATE vouchers 
            SET total_used = total_used + 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = (SELECT voucher_id FROM voucher_claims WHERE id = %s)
        ''', (claim_id,))
        
        conn.commit()
        
        return {'success': True, 'message': 'Voucher digunakan'}
        
    except Exception as e:
        print(f"❌ Error using voucher: {e}")
        if conn:
            conn.rollback()
        return {'success': False, 'message': str(e)}
    finally:
        if conn:
            conn.close()

def get_voucher_claims(voucher_id, limit=50, offset=0):
    """Mendapatkan daftar klaim untuk voucher"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT * FROM voucher_claims 
            WHERE voucher_id = %s
            ORDER BY claimed_at DESC
            LIMIT %s OFFSET %s
        ''', (voucher_id, limit, offset))
        
        rows = cursor.fetchall()
        return rows
        
    except Exception as e:
        print(f"❌ Error getting voucher claims: {e}")
        return []
    finally:
        if conn:
            conn.close()

def get_user_claims(user_id, website_id=None, limit=50):
    """Mendapatkan semua klaim user"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = '''
            SELECT vc.*, v.kode, v.nama, v.reward_type, v.reward_data
            FROM voucher_claims vc
            JOIN vouchers v ON vc.voucher_id = v.id
            WHERE vc.user_id = %s
        '''
        params = [user_id]
        
        if website_id:
            query += " AND v.website_id = %s"
            params.append(website_id)
        
        query += " ORDER BY vc.claimed_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        claims = []
        for row in rows:
            claim = dict(row)
            try:
                claim['reward_data'] = json.loads(claim['reward_data'] or '{}')
            except:
                claim['reward_data'] = {}
            claims.append(claim)
        
        return claims
        
    except Exception as e:
        print(f"❌ Error getting user claims: {e}")
        return []
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK BROADCAST ====================

def save_broadcast(voucher_id, target, selected_users=None, message=None):
    """
    Menyimpan record broadcast
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        selected_users_json = json.dumps(selected_users or [])
        
        cursor.execute('''
            INSERT INTO voucher_broadcasts 
            (voucher_id, target, selected_users, message)
            VALUES (%s, %s, %s, %s)
        ''', (voucher_id, target, selected_users_json, message))
        
        broadcast_id = cursor.lastrowid
        
        # Log activity
        cursor.execute('''
            INSERT INTO voucher_activities 
            (website_id, voucher_id, type, description, meta_data)
            SELECT website_id, %s, 'broadcast', %s, %s
            FROM vouchers WHERE id = %s
        ''', (
            voucher_id,
            f'Broadcast voucher ke {target}',
            json.dumps({'target': target, 'count': len(selected_users) if selected_users else 'all'}),
            voucher_id
        ))
        
        conn.commit()
        return broadcast_id
        
    except Exception as e:
        print(f"❌ Error saving broadcast: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def get_broadcasts(voucher_id=None, limit=50):
    """Mendapatkan daftar broadcast"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT * FROM voucher_broadcasts"
        params = []
        
        if voucher_id:
            query += " WHERE voucher_id = %s"
            params.append(voucher_id)
        
        query += " ORDER BY sent_at DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        broadcasts = []
        for row in rows:
            broadcast = dict(row)
            try:
                broadcast['selected_users'] = json.loads(broadcast['selected_users'] or '[]')
            except:
                broadcast['selected_users'] = []
            broadcasts.append(broadcast)
        
        return broadcasts
        
    except Exception as e:
        print(f"❌ Error getting broadcasts: {e}")
        return []
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK AKTIVITAS ====================

def log_activity(conn, website_id, voucher_id, type, description, meta_data=None):
    """Internal function untuk log activity"""
    try:
        cursor = conn.cursor()
        meta_json = json.dumps(meta_data or {})
        
        cursor.execute('''
            INSERT INTO voucher_activities 
            (website_id, voucher_id, type, description, meta_data)
            VALUES (%s, %s, %s, %s, %s)
        ''', (website_id, voucher_id, type, description, meta_json))
        
    except Exception as e:
        print(f"❌ Error logging activity: {e}")

def get_activities(website_id, filters=None, limit=50, offset=0):
    """
    Mendapatkan aktivitas voucher
    filters: dictionary dengan key 'type', 'voucher_id', 'start_date', 'end_date'
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        query = "SELECT * FROM voucher_activities WHERE website_id = %s"
        params = [website_id]
        
        if filters:
            if filters.get('type'):
                query += " AND type = %s"
                params.append(filters['type'])
            
            if filters.get('voucher_id'):
                query += " AND voucher_id = %s"
                params.append(filters['voucher_id'])
            
            if filters.get('start_date'):
                query += " AND DATE(created_at) >= %s"
                params.append(filters['start_date'])
            
            if filters.get('end_date'):
                query += " AND DATE(created_at) <= %s"
                params.append(filters['end_date'])
        
        query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
        params.append(limit)
        params.append(offset)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        activities = []
        for row in rows:
            activity = dict(row)
            try:
                activity['meta_data'] = json.loads(activity['meta_data'] or '{}')
            except:
                activity['meta_data'] = {}
            activities.append(activity)
        
        return activities
        
    except Exception as e:
        print(f"❌ Error getting activities: {e}")
        return []
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK STATISTIK ====================

def get_statistics(website_id, period='all'):
    """
    Mendapatkan statistik voucher
    period: 'all', 'today', 'week', 'month'
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        stats = {
            'total_vouchers': 0,
            'active_vouchers': 0,
            'total_claims': 0,
            'total_used': 0,
            'unique_users': 0,
            'total_reward': 0,
            'daily_claims': []
        }
        
        # Total vouchers
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN active = 1 AND expired = 0 THEN 1 ELSE 0 END) as active
            FROM vouchers WHERE website_id = %s
        ''', (website_id,))
        
        row = cursor.fetchone()
        if row:
            stats['total_vouchers'] = row['total'] or 0
            stats['active_vouchers'] = row['active'] or 0
        
        # Total claims and used
        cursor.execute('''
            SELECT 
                COUNT(*) as claims,
                SUM(CASE WHEN used = 1 THEN 1 ELSE 0 END) as used_count
            FROM voucher_claims vc
            JOIN vouchers v ON vc.voucher_id = v.id
            WHERE v.website_id = %s
        ''', (website_id,))
        
        row = cursor.fetchone()
        if row:
            stats['total_claims'] = row['claims'] or 0
            stats['total_used'] = row['used_count'] or 0
        
        # Unique users
        cursor.execute('''
            SELECT COUNT(DISTINCT user_id) as unique_users
            FROM voucher_claims vc
            JOIN vouchers v ON vc.voucher_id = v.id
            WHERE v.website_id = %s
        ''', (website_id,))
        
        row = cursor.fetchone()
        if row:
            stats['unique_users'] = row['unique_users'] or 0
        
        # Daily claims (last 7 days)
        cursor.execute('''
            SELECT 
                DATE(vc.claimed_at) as claim_date,
                COUNT(*) as count
            FROM voucher_claims vc
            JOIN vouchers v ON vc.voucher_id = v.id
            WHERE v.website_id = %s
                AND vc.claimed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(vc.claimed_at)
            ORDER BY claim_date
        ''', (website_id,))
        
        rows = cursor.fetchall()
        stats['daily_claims'] = rows
        
        return stats
        
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return stats
    finally:
        if conn:
            conn.close()

def get_top_vouchers(website_id, limit=5):
    """Mendapatkan voucher terpopuler berdasarkan klaim"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT 
                id, kode, nama, reward_type,
                total_claimed, total_used
            FROM vouchers
            WHERE website_id = %s
            ORDER BY total_claimed DESC
            LIMIT %s
        ''', (website_id, limit))
        
        rows = cursor.fetchall()
        return rows
        
    except Exception as e:
        print(f"❌ Error getting top vouchers: {e}")
        return []
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI MIGRASI ====================

def migrate_database():
    """Migrasi database MySQL ke struktur terbaru"""
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Cek apakah tabel vouchers ada
        cursor.execute("SHOW TABLES LIKE 'vouchers'")
        if not cursor.fetchone():
            print("⚠️ Tabel vouchers belum ada, inisialisasi dulu...")
            conn.close()
            init_db()
            return
        
        # Dapatkan daftar kolom yang sudah ada di tabel vouchers
        cursor.execute("SHOW COLUMNS FROM vouchers")
        existing_columns = [col['Field'] for col in cursor.fetchall()]
        
        print("📊 Existing columns in vouchers:", existing_columns)
        
        # Kolom yang mungkin kurang
        required_columns = {
            'start_time': "VARCHAR(5) DEFAULT '00:00'",
            'end_time': "VARCHAR(5) DEFAULT '23:59'",
            'no_expiry': 'BOOLEAN DEFAULT 0',
            'selected_users': "TEXT DEFAULT '[]'",
            'expired': 'BOOLEAN DEFAULT 0',
            'total_claimed': 'INT DEFAULT 0',
            'total_used': 'INT DEFAULT 0'
        }
        
        columns_added = []
        for col_name, col_type in required_columns.items():
            if col_name not in existing_columns:
                try:
                    alter_sql = f"ALTER TABLE vouchers ADD COLUMN {col_name} {col_type}"
                    cursor.execute(alter_sql)
                    columns_added.append(col_name)
                    print(f"✅ Column '{col_name}' added to vouchers table")
                except Exception as e:
                    print(f"❌ Failed to add column '{col_name}': {e}")
        
        if columns_added:
            print(f"✅ Added columns: {', '.join(columns_added)}")
        
        # Cek tabel voucher_claims
        cursor.execute("SHOW TABLES LIKE 'voucher_claims'")
        if cursor.fetchone():
            cursor.execute("SHOW COLUMNS FROM voucher_claims")
            existing_claims_columns = [col['Field'] for col in cursor.fetchall()]
            
            claims_columns = {
                'expired_at': 'TIMESTAMP NULL',
                'order_id': 'INT'
            }
            
            for col_name, col_type in claims_columns.items():
                if col_name not in existing_claims_columns:
                    try:
                        alter_sql = f"ALTER TABLE voucher_claims ADD COLUMN {col_name} {col_type}"
                        cursor.execute(alter_sql)
                        print(f"✅ Column '{col_name}' added to voucher_claims table")
                    except Exception as e:
                        print(f"❌ Failed to add column '{col_name}': {e}")
        
        conn.commit()
        print("✅ MySQL Voucher database migration completed successfully")
        
    except Exception as e:
        print(f"⚠️ Migration error: {e}")
        import traceback
        traceback.print_exc()
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

# ==================== FUNGSI UNTUK UPDATE OTOMATIS ====================

def scheduled_expiry_check():
    """
    Fungsi yang bisa dipanggil secara berkala (misalnya via cron)
    untuk mengecek voucher yang expired
    """
    try:
        updated = check_expired_vouchers()
        print(f"✅ Scheduled expiry check completed: {updated} vouchers expired")
    except Exception as e:
        print(f"❌ Error in scheduled expiry check: {e}")

# ==================== INISIALISASI ====================

# Inisialisasi database
try:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SHOW TABLES LIKE 'vouchers'")
    table_exists = cursor.fetchone()
    conn.close()
    
    if not table_exists:
        init_db()
    else:
        print("✅ MySQL vouchers tables already exist, checking migration...")
        migrate_database()
        check_expired_vouchers()
        
except Exception as e:
    print(f"⚠️ Database init warning: {e}")