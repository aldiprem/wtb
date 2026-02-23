# tampilan.py - Database handler untuk tampilan website
import sqlite3
import json
from datetime import datetime

DATABASE = 'tampilan.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_tampilan_db():
    """Inisialisasi database tampilan"""
    with get_db() as db:
        # Create tampilan table
        db.execute('''
            CREATE TABLE IF NOT EXISTS tampilan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                website_id INTEGER NOT NULL,
                banner TEXT,
                promo_banner TEXT,
                colors TEXT DEFAULT '{}',
                font_family TEXT DEFAULT 'Inter',
                font_size INTEGER DEFAULT 14,
                title TEXT,
                description TEXT,
                contact_whatsapp TEXT,
                contact_telegram TEXT,
                seo_title TEXT,
                seo_description TEXT,
                seo_keywords TEXT,
                payments TEXT DEFAULT '{}',
                maintenance_enabled INTEGER DEFAULT 0,
                maintenance_message TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE,
                UNIQUE(website_id)
            )
        ''')
        
        # Create bank_accounts table
        db.execute('''
            CREATE TABLE IF NOT EXISTS bank_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tampilan_id INTEGER NOT NULL,
                bank_name TEXT,
                account_number TEXT,
                account_holder TEXT,
                enabled INTEGER DEFAULT 1,
                FOREIGN KEY (tampilan_id) REFERENCES tampilan(id) ON DELETE CASCADE
            )
        ''')
        
        # Create ewallet_accounts table
        db.execute('''
            CREATE TABLE IF NOT EXISTS ewallet_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tampilan_id INTEGER NOT NULL,
                provider TEXT,
                phone_number TEXT,
                enabled INTEGER DEFAULT 1,
                FOREIGN KEY (tampilan_id) REFERENCES tampilan(id) ON DELETE CASCADE
            )
        ''')
        
        # Create qris table
        db.execute('''
            CREATE TABLE IF NOT EXISTS qris (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tampilan_id INTEGER NOT NULL,
                image_url TEXT,
                enabled INTEGER DEFAULT 1,
                FOREIGN KEY (tampilan_id) REFERENCES tampilan(id) ON DELETE CASCADE
            )
        ''')
        
        # Create crypto table
        db.execute('''
            CREATE TABLE IF NOT EXISTS crypto (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tampilan_id INTEGER NOT NULL,
                wallet_address TEXT,
                enabled INTEGER DEFAULT 0,
                FOREIGN KEY (tampilan_id) REFERENCES tampilan(id) ON DELETE CASCADE
            )
        ''')
        
        print("✅ Database tampilan initialized successfully")

# Inisialisasi database saat module di-load
init_tampilan_db()

# ==================== FUNGSI CRUD UNTUK TAMPILAN ====================

def get_tampilan_by_website_id(website_id):
    """Ambil data tampilan berdasarkan website_id"""
    with get_db() as db:
        tampilan = db.execute('SELECT * FROM tampilan WHERE website_id = ?', (website_id,)).fetchone()
        
        if not tampilan:
            return None
            
        tampilan_dict = dict(tampilan)
        
        # Parse JSON fields
        tampilan_dict['colors'] = json.loads(tampilan_dict['colors'] or '{}')
        tampilan_dict['payments'] = json.loads(tampilan_dict['payments'] or '{}')
        
        # Get bank accounts
        banks = db.execute('SELECT * FROM bank_accounts WHERE tampilan_id = ?', (tampilan_dict['id'],)).fetchall()
        tampilan_dict['banks'] = [dict(bank) for bank in banks]
        
        # Get e-wallet accounts
        ewallets = db.execute('SELECT * FROM ewallet_accounts WHERE tampilan_id = ?', (tampilan_dict['id'],)).fetchall()
        tampilan_dict['ewallets'] = [dict(ewallet) for ewallet in ewallets]
        
        # Get QRIS
        qris = db.execute('SELECT * FROM qris WHERE tampilan_id = ?', (tampilan_dict['id'],)).fetchone()
        tampilan_dict['qris'] = dict(qris) if qris else None
        
        # Get crypto
        crypto = db.execute('SELECT * FROM crypto WHERE tampilan_id = ?', (tampilan_dict['id'],)).fetchone()
        tampilan_dict['crypto'] = dict(crypto) if crypto else None
        
        return tampilan_dict

def create_or_update_tampilan(website_id, data):
    """Buat atau update data tampilan untuk website_id tertentu"""
    with get_db() as db:
        # Cek apakah sudah ada
        existing = db.execute('SELECT id FROM tampilan WHERE website_id = ?', (website_id,)).fetchone()
        
        colors = json.dumps(data.get('colors', {}))
        payments = json.dumps(data.get('payments', {}))
        
        if existing:
            # Update
            db.execute('''
                UPDATE tampilan SET
                    banner = ?,
                    promo_banner = ?,
                    colors = ?,
                    font_family = ?,
                    font_size = ?,
                    title = ?,
                    description = ?,
                    contact_whatsapp = ?,
                    contact_telegram = ?,
                    seo_title = ?,
                    seo_description = ?,
                    seo_keywords = ?,
                    payments = ?,
                    maintenance_enabled = ?,
                    maintenance_message = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE website_id = ?
            ''', (
                data.get('banner'),
                data.get('promo_banner'),
                colors,
                data.get('font_family', 'Inter'),
                data.get('font_size', 14),
                data.get('title'),
                data.get('description'),
                data.get('contact_whatsapp'),
                data.get('contact_telegram'),
                data.get('seo_title'),
                data.get('seo_description'),
                data.get('seo_keywords'),
                payments,
                1 if data.get('maintenance_enabled') else 0,
                data.get('maintenance_message'),
                website_id
            ))
            tampilan_id = existing['id']
        else:
            # Insert
            cursor = db.execute('''
                INSERT INTO tampilan (
                    website_id, banner, promo_banner, colors, font_family, font_size,
                    title, description, contact_whatsapp, contact_telegram,
                    seo_title, seo_description, seo_keywords, payments,
                    maintenance_enabled, maintenance_message
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                data.get('banner'),
                data.get('promo_banner'),
                colors,
                data.get('font_family', 'Inter'),
                data.get('font_size', 14),
                data.get('title'),
                data.get('description'),
                data.get('contact_whatsapp'),
                data.get('contact_telegram'),
                data.get('seo_title'),
                data.get('seo_description'),
                data.get('seo_keywords'),
                payments,
                1 if data.get('maintenance_enabled') else 0,
                data.get('maintenance_message')
            ))
            tampilan_id = cursor.lastrowid
        
        db.commit()
        return tampilan_id

def save_bank_accounts(tampilan_id, banks):
    """Simpan data bank accounts"""
    with get_db() as db:
        # Hapus data lama
        db.execute('DELETE FROM bank_accounts WHERE tampilan_id = ?', (tampilan_id,))
        
        # Insert data baru
        for bank in banks:
            if bank.get('enabled'):
                db.execute('''
                    INSERT INTO bank_accounts (tampilan_id, bank_name, account_number, account_holder, enabled)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    tampilan_id,
                    bank.get('name'),
                    bank.get('account'),
                    bank.get('holder'),
                    1 if bank.get('enabled') else 0
                ))
        
        db.commit()

def save_ewallet_accounts(tampilan_id, ewallets):
    """Simpan data e-wallet accounts"""
    with get_db() as db:
        db.execute('DELETE FROM ewallet_accounts WHERE tampilan_id = ?', (tampilan_id,))
        
        for ewallet in ewallets:
            if ewallet.get('enabled'):
                db.execute('''
                    INSERT INTO ewallet_accounts (tampilan_id, provider, phone_number, enabled)
                    VALUES (?, ?, ?, ?)
                ''', (
                    tampilan_id,
                    ewallet.get('provider'),
                    ewallet.get('number'),
                    1 if ewallet.get('enabled') else 0
                ))
        
        db.commit()

def save_qris(tampilan_id, qris_data):
    """Simpan data QRIS"""
    with get_db() as db:
        db.execute('DELETE FROM qris WHERE tampilan_id = ?', (tampilan_id,))
        
        if qris_data and qris_data.get('enabled'):
            db.execute('''
                INSERT INTO qris (tampilan_id, image_url, enabled)
                VALUES (?, ?, ?)
            ''', (
                tampilan_id,
                qris_data.get('url'),
                1 if qris_data.get('enabled') else 0
            ))
        
        db.commit()

def save_crypto(tampilan_id, crypto_data):
    """Simpan data crypto"""
    with get_db() as db:
        db.execute('DELETE FROM crypto WHERE tampilan_id = ?', (tampilan_id,))
        
        if crypto_data and crypto_data.get('enabled'):
            db.execute('''
                INSERT INTO crypto (tampilan_id, wallet_address, enabled)
                VALUES (?, ?, ?)
            ''', (
                tampilan_id,
                crypto_data.get('address'),
                1 if crypto_data.get('enabled') else 0
            ))
        
        db.commit()
