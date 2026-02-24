# products_db.py - Database handler untuk produk dengan struktur hierarki
import sqlite3
import json
from datetime import datetime

DATABASE = 'products.db'

def get_db():
    """Mendapatkan koneksi database"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Inisialisasi database produk dengan struktur baru"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create products table with hierarchical structure
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        website_id INTEGER NOT NULL,
        
        -- Level 1: Layanan
        layanan TEXT NOT NULL,
        layanan_gambar TEXT,
        layanan_desc TEXT,
        
        -- Level 2: Aplikasi
        aplikasi TEXT NOT NULL,
        aplikasi_gambar TEXT,
        aplikasi_desc TEXT,
        
        -- Level 3: Item
        item_nama TEXT NOT NULL,
        item_durasi TEXT,
        harga INTEGER NOT NULL DEFAULT 0,
        fitur TEXT DEFAULT 'biasa',
        
        -- Method
        method TEXT NOT NULL CHECK(method IN ('directly', 'request')),
        
        -- Stok untuk directly (JSON array)
        stok TEXT DEFAULT '[]',
        
        -- Fields untuk request (JSON array)
        fields TEXT DEFAULT '[]',
        
        -- Status
        aktif BOOLEAN DEFAULT 1,
        terjual INTEGER DEFAULT 0,
        
        -- Metadata
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (website_id) REFERENCES websites(id) ON DELETE CASCADE
    )
    ''')
    
    # Create index for faster queries
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_website ON products(website_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_layanan ON products(layanan)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_products_aplikasi ON products(aplikasi)')
    
    conn.commit()
    conn.close()
    print("✅ Products database initialized successfully")

# Inisialisasi database
init_db()

# ==================== FUNGSI UTAMA ====================

def get_products(website_id):
    """Ambil semua produk untuk website tertentu"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM products 
        WHERE website_id = ? 
        ORDER BY layanan, aplikasi, item_nama
    ''', (website_id,))
    
    rows = cursor.fetchall()
    conn.close()
    
    products = []
    for row in rows:
        product = dict(row)
        # Parse JSON fields
        product['stok'] = json.loads(product['stok'] or '[]')
        product['fields'] = json.loads(product['fields'] or '[]')
        products.append(product)
    
    return products

def get_product(product_id):
    """Ambil satu produk berdasarkan ID"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM products WHERE id = ?', (product_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        product = dict(row)
        product['stok'] = json.loads(product['stok'] or '[]')
        product['fields'] = json.loads(product['fields'] or '[]')
        return product
    return None

def add_product(website_id, data):
    """Tambah produk baru"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Prepare data
    stok_json = json.dumps(data.get('stok', []))
    fields_json = json.dumps(data.get('fields', []))
    
    cursor.execute('''
        INSERT INTO products (
            website_id, layanan, layanan_gambar, layanan_desc,
            aplikasi, aplikasi_gambar, aplikasi_desc,
            item_nama, item_durasi, harga, fitur,
            method, stok, fields, aktif
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        website_id,
        data.get('layanan', ''),
        data.get('layanan_gambar', ''),
        data.get('layanan_desc', ''),
        data.get('aplikasi', ''),
        data.get('aplikasi_gambar', ''),
        data.get('aplikasi_desc', ''),
        data.get('item_nama', ''),
        data.get('item_durasi', ''),
        data.get('harga', 0),
        data.get('fitur', 'biasa'),
        data.get('method', 'directly'),
        stok_json,
        fields_json,
        1 if data.get('aktif', True) else 0
    ))
    
    product_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return product_id

def update_product(product_id, data):
    """Update produk yang sudah ada"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Build update query dynamically
    updates = []
    values = []
    
    update_fields = [
        'layanan', 'layanan_gambar', 'layanan_desc',
        'aplikasi', 'aplikasi_gambar', 'aplikasi_desc',
        'item_nama', 'item_durasi', 'harga', 'fitur',
        'method', 'aktif'
    ]
    
    for field in update_fields:
        if field in data:
            updates.append(f"{field} = ?")
            values.append(data[field])
    
    # Handle JSON fields
    if 'stok' in data:
        updates.append("stok = ?")
        values.append(json.dumps(data['stok']))
    
    if 'fields' in data:
        updates.append("fields = ?")
        values.append(json.dumps(data['fields']))
    
    if 'terjual' in data:
        updates.append("terjual = ?")
        values.append(data['terjual'])
    
    updates.append("updated_at = CURRENT_TIMESTAMP")
    
    if updates:
        query = f"UPDATE products SET {', '.join(updates)} WHERE id = ?"
        values.append(product_id)
        cursor.execute(query, values)
        conn.commit()
    
    conn.close()
    return True

def delete_product(product_id):
    """Hapus produk"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM products WHERE id = ?', (product_id,))
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    
    return deleted

def get_products_by_layanan(website_id):
    """Ambil produk yang dikelompokkan berdasarkan layanan"""
    products = get_products(website_id)
    
    grouped = {}
    for p in products:
        layanan = p['layanan']
        if layanan not in grouped:
            grouped[layanan] = {
                'gambar': p['layanan_gambar'],
                'desc': p['layanan_desc'],
                'aplikasi': {}
            }
        
        aplikasi = p['aplikasi']
        if aplikasi not in grouped[layanan]['aplikasi']:
            grouped[layanan]['aplikasi'][aplikasi] = {
                'gambar': p['aplikasi_gambar'],
                'desc': p['aplikasi_desc'],
                'items': []
            }
        
        grouped[layanan]['aplikasi'][aplikasi]['items'].append(p)
    
    return grouped

def get_products_stats(website_id):
    """Dapatkan statistik produk"""
    products = get_products(website_id)
    
    total = len(products)
    aktif = sum(1 for p in products if p['aktif'])
    terjual = sum(p.get('terjual', 0) for p in products)
    
    # Stok menipis untuk method directly
    low_stock = sum(1 for p in products 
                   if p['aktif'] and p['method'] == 'directly' 
                   and len(p.get('stok', [])) > 0 
                   and len(p.get('stok', [])) <= 5)
    
    return {
        'total': total,
        'aktif': aktif,
        'terjual': terjual,
        'low_stock': low_stock
    }

def add_stok(product_id, stok_data):
    """Tambah stok ke produk directly"""
    product = get_product(product_id)
    if not product or product['method'] != 'directly':
        return False
    
    current_stok = product.get('stok', [])
    new_stok = current_stok + stok_data
    
    return update_product(product_id, {'stok': new_stok})

def remove_stok(product_id, index):
    """Hapus stok berdasarkan index"""
    product = get_product(product_id)
    if not product or product['method'] != 'directly':
        return False
    
    current_stok = product.get('stok', [])
    if 0 <= index < len(current_stok):
        current_stok.pop(index)
        return update_product(product_id, {'stok': current_stok})
    
    return False

def consume_stok(product_id):
    """Ambil 1 stok untuk dijual (reduce stock)"""
    product = get_product(product_id)
    if not product or product['method'] != 'directly':
        return None
    
    current_stok = product.get('stok', [])
    if not current_stok:
        return None
    
    # Ambil stok pertama
    stok_item = current_stok.pop(0)
    
    # Update stok dan increment terjual
    update_product(product_id, {
        'stok': current_stok,
        'terjual': product.get('terjual', 0) + 1
    })
    
    return stok_item
