#!/usr/bin/env python3
"""
Service untuk menangani data gift_scanned dari database SQLite
"""
from flask import Blueprint, jsonify, request, send_from_directory
import sqlite3
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

gift_scanned_bp = Blueprint('gift_scanned', __name__)

# Path database - SESUAIKAN DENGAN LOKASI DATABASE ANDA
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATHS = [
    '/root/gift.db/gift.db',
    os.path.join('/root/gift.db', 'gift.db'),
    os.path.join(BASE_DIR, 'gift.db', 'gift.db'),
    os.path.join('/root', 'gift.db'),
    os.path.join(BASE_DIR, 'gift.db'),
    os.path.join(BASE_DIR, 'database', 'gift.db'),  # Tambahan
    '/app/gift.db',  # Untuk environment container
]

DB_PATH = None

def get_database_path():
    """Mencari dan mengembalikan path database yang valid"""
    global DB_PATH
    if DB_PATH and os.path.exists(DB_PATH):
        return DBPath
    
    for path in DATABASE_PATHS:
        if path and os.path.exists(path) and os.path.isfile(path):
            logger.info(f"✅ Database ditemukan: {path}")
            DB_PATH = path
            return path
    
    # Coba cari dengan pattern
    try:
        import glob
        patterns = ['*.db', 'gift*.db']
        for pattern in patterns:
            for found in glob.glob(f"/root/**/{pattern}", recursive=True):
                if found not in DATABASE_PATHS:
                    DATABASE_PATHS.append(found)
                    logger.info(f"✅ Database ditemukan via glob: {found}")
                    DB_PATH = found
                    return found
    except:
        pass
    
    logger.error("❌ Database gift.db tidak ditemukan!")
    for path in DATABASE_PATHS:
        logger.error(f"  - {path}")
    return None

def get_db_connection():
    """Membuat koneksi ke database SQLite"""
    db_path = get_database_path()
    if not db_path:
        return None
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        logger.error(f"❌ Gagal koneksi database: {e}")
        return None

# ==================== ROUTE STATIC HTML ====================

@gift_scanned_bp.route('/')
def serve_gift_scanned_page():
    """Halaman utama Gift Collection"""
    html_dir = os.path.join(BASE_DIR, 'html')
    if os.path.exists(os.path.join(html_dir, 'gift_scanned.html')):
        return send_from_directory(html_dir, 'gift_scanned.html')
    return "Gift page not found", 404

@gift_scanned_bp.route('/css/<path:filename>')
def serve_gift_css(filename):
    """Serve CSS files"""
    return send_from_directory(os.path.join(BASE_DIR, 'css'), filename)

@gift_scanned_bp.route('/js/<path:filename>')
def serve_gift_js(filename):
    """Serve JS files"""
    return send_from_directory(os.path.join(BASE_DIR, 'js'), filename)

# ==================== API ROUTES ====================

@gift_scanned_bp.route('/api/list')
def api_get_gifts():
    """API: Mendapatkan semua data gift dengan pagination dan filter"""
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        search = request.args.get('search', '', type=str).strip()
        filter_name = request.args.get('filter_name', '', type=str).strip()
        
        if page < 1: page = 1
        if limit < 1: limit = 50
        if limit > 5000: limit = 5000  # Izinkan limit besar untuk initial load
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database tidak ditemukan',
                'data': [], 'total': 0, 'page': page, 'total_pages': 0
            }), 500
        
        cur = conn.cursor()
        
        # Cek tabel
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gift_scanned'")
        if not cur.fetchone():
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Tabel gift_scanned belum ada',
                'data': [], 'total': 0, 'page': page, 'total_pages': 0
            }), 404
        
        # Cek kolom yang ada di database
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = {col[1] for col in cur.fetchall()}
        logger.info(f"✅ Existing columns in gift_scanned: {existing_cols}")
        
        # Build query
        where_clauses = []
        params = []
        
        if search:
            # Cari di slug atau text
            where_clauses.append("(slug LIKE ? OR text LIKE ?)")
            params.extend([f'%{search}%', f'%{search}%'])
        
        if filter_name:
            where_clauses.append("slug LIKE ?")
            params.append(f'{filter_name}-%')
        
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Count total
        try:
            cur.execute(f"SELECT COUNT(*) as total FROM gift_scanned {where_sql}", params)
            total_row = cur.fetchone()
            total = total_row['total'] if total_row else 0
        except Exception as e:
            logger.error(f"Error counting: {e}")
            total = 0
        
        total_pages = max(1, (total + limit - 1) // limit) if total > 0 else 1
        
        if page > total_pages:
            page = total_pages
        
        offset = (page - 1) * limit
        
        # Build SELECT columns berdasarkan kolom yang ada
        select_cols = ['slug', 'message_id', 'text', 'rowid as id']
        
        optional_cols = ['sender_id', 'model', 'model_rarity', 
                        'background', 'background_rarity', 
                        'symbol', 'symbol_rarity',
                        'original_details', 
                        'availability_issued', 'availability_total',
                        'lottie_url', 'fragment_url']
        
        for col in optional_cols:
            if col in existing_cols:
                select_cols.append(col)
        
        select_sql = ', '.join(select_cols)
        
        # Ambil data
        query = f"""
            SELECT {select_sql}
            FROM gift_scanned 
            {where_sql}
            ORDER BY slug 
            LIMIT ? OFFSET ?
        """
        logger.info(f"Executing query: {query}")
        
        cur.execute(query, params + [limit, offset])
        rows = cur.fetchall()
        
        # Format data
        gift_list = []
        for row in rows:
            slug = row['slug']
            
            # Parse name dari slug
            parts = slug.rsplit('-', 1)
            if len(parts) == 2 and parts[1].isdigit():
                gift_name = parts[0]
                gift_number = parts[1]
            else:
                gift_name = slug
                gift_number = ''
            
            # URL lottie
            lottie_url = None
            if 'lottie_url' in row.keys() and row['lottie_url']:
                lottie_url = row['lottie_url']
            else:
                lottie_url = f"https://nft.fragment.com/gift/{slug}.lottie.json"
            
            # Fragment URL
            fragment_url = None
            if 'fragment_url' in row.keys() and row['fragment_url']:
                fragment_url = row['fragment_url']
            else:
                fragment_url = f"https://nft.fragment.com/gift/{slug}"
            
            gift_data = {
                'id': row['id'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'text': row['text'] or '',
                'lottie_url': lottie_url,
                'fragment_url': fragment_url,
            }
            
            # Tambah field opsional
            if 'sender_id' in row.keys():
                gift_data['sender_id'] = row['sender_id']
            if 'model' in row.keys():
                gift_data['model'] = row['model'] or ''
            if 'model_rarity' in row.keys():
                gift_data['model_rarity'] = row['model_rarity'] or 0
            if 'background' in row.keys():
                gift_data['background'] = row['background'] or ''
            if 'background_rarity' in row.keys():
                gift_data['background_rarity'] = row['background_rarity'] or 0
            if 'symbol' in row.keys():
                gift_data['symbol'] = row['symbol'] or ''
            if 'symbol_rarity' in row.keys():
                gift_data['symbol_rarity'] = row['symbol_rarity'] or 0
            if 'availability_issued' in row.keys():
                gift_data['availability_issued'] = row['availability_issued'] or 0
            if 'availability_total' in row.keys():
                gift_data['availability_total'] = row['availability_total'] or 0
            
            gift_list.append(gift_data)
        
        conn.close()
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': total,
            'page': page,
            'total_pages': total_pages,
            'limit': limit,
            'has_next': page < total_pages,
            'has_prev': page > 1
        })
        
    except Exception as e:
        logger.error(f"❌ Error di api_get_gifts: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'data': [], 'total': 0, 'page': 1, 'total_pages': 0
        }), 500

@gift_scanned_bp.route('/api/detail/<slug>')
def api_get_gift_detail(slug):
    """API: Mendapatkan detail lengkap satu gift"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        
        # Cek kolom yang ada
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = {col[1] for col in cur.fetchall()}
        
        # Build SELECT
        select_cols = ['slug', 'message_id', 'text', 'rowid as id']
        optional_cols = ['sender_id', 'model', 'model_rarity', 
                        'background', 'background_rarity', 
                        'symbol', 'symbol_rarity',
                        'original_details', 
                        'availability_issued', 'availability_total',
                        'lottie_url', 'fragment_url']
        
        for col in optional_cols:
            if col in existing_cols:
                select_cols.append(col)
        
        select_sql = ', '.join(select_cols)
        
        cur.execute(f"SELECT {select_sql} FROM gift_scanned WHERE slug = ?", (slug,))
        row = cur.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'success': False, 'error': 'Gift tidak ditemukan'}), 404
        
        parts = row['slug'].rsplit('-', 1)
        gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else row['slug']
        gift_number = parts[1] if len(parts) == 2 and parts[1].isdigit() else ''
        
        lottie_url = row['lottie_url'] if ('lottie_url' in row.keys() and row['lottie_url']) else f"https://nft.fragment.com/gift/{slug}.lottie.json"
        fragment_url = row['fragment_url'] if ('fragment_url' in row.keys() and row['fragment_url']) else f"https://nft.fragment.com/gift/{slug}"
        
        result = {
            'id': row['id'],
            'slug': row['slug'],
            'name': gift_name,
            'number': gift_number,
            'message_id': row['message_id'],
            'text': row['text'] or '',
            'lottie_url': lottie_url,
            'fragment_url': fragment_url,
        }
        
        if 'sender_id' in row.keys():
            result['sender_id'] = row['sender_id']
        if 'model' in row.keys():
            result['model'] = row['model'] or ''
        if 'model_rarity' in row.keys():
            result['model_rarity'] = row['model_rarity'] or 0
        if 'background' in row.keys():
            result['background'] = row['background'] or ''
        if 'background_rarity' in row.keys():
            result['background_rarity'] = row['background_rarity'] or 0
        if 'symbol' in row.keys():
            result['symbol'] = row['symbol'] or ''
        if 'symbol_rarity' in row.keys():
            result['symbol_rarity'] = row['symbol_rarity'] or 0
        if 'availability_issued' in row.keys():
            result['availability_issued'] = row['availability_issued'] or 0
        if 'availability_total' in row.keys():
            result['availability_total'] = row['availability_total'] or 0
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Error in detail: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@gift_scanned_bp.route('/api/stats')
def api_get_stats():
    """API: Mendapatkan statistik gift"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        
        # Total gift
        cur.execute("SELECT COUNT(*) as count FROM gift_scanned")
        total_row = cur.fetchone()
        total = total_row['count'] if total_row else 0
        
        # Unique names
        cur.execute("SELECT slug FROM gift_scanned")
        slugs = cur.fetchall()
        
        unique_names = set()
        for row in slugs:
            parts = row['slug'].rsplit('-', 1)
            if len(parts) == 2 and parts[1].isdigit():
                unique_names.add(parts[0])
            else:
                unique_names.add(row['slug'])
        
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total': total,
                'unique': len(unique_names)
            }
        })
        
    except Exception as e:
        logger.error(f"Error in stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@gift_scanned_bp.route('/api/names')
def api_get_unique_names():
    """API: Mendapatkan semua unique names dengan total count dari database"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        
        # Ambil semua slug
        cur.execute("SELECT slug FROM gift_scanned")
        slugs = cur.fetchall()
        conn.close()
        
        name_counts = {}
        for row in slugs:
            parts = row['slug'].rsplit('-', 1)
            name = parts[0] if len(parts) == 2 and parts[1].isdigit() else row['slug']
            name_counts[name] = name_counts.get(name, 0) + 1
        
        sorted_names = sorted(name_counts.keys())
        
        return jsonify({
            'success': True,
            'names': sorted_names,
            'name_counts': name_counts
        })
        
    except Exception as e:
        logger.error(f"Error in names: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@gift_scanned_bp.route('/api/by-message/<int:message_id>')
def api_get_gifts_by_message(message_id):
    """API: Mendapatkan semua gift dari message_id yang sama"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        
        # Cek kolom
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = {col[1] for col in cur.fetchall()}
        
        # Build SELECT
        select_cols = ['slug', 'message_id', 'rowid as id']
        
        if 'lottie_url' in existing_cols:
            select_cols.append('lottie_url')
        if 'sender_id' in existing_cols:
            select_cols.append('sender_id')
        
        select_sql = ', '.join(select_cols)
        
        cur.execute(f"""
            SELECT {select_sql}
            FROM gift_scanned 
            WHERE message_id = ?
            ORDER BY slug
        """, (message_id,))
        
        rows = cur.fetchall()
        conn.close()
        
        gift_list = []
        for row in rows:
            slug = row['slug']
            parts = slug.rsplit('-', 1)
            gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else slug
            gift_number = parts[1] if len(parts) == 2 and parts[1].isdigit() else ''
            
            lottie_url = row['lottie_url'] if ('lottie_url' in row.keys() and row['lottie_url']) else f"https://nft.fragment.com/gift/{slug}.lottie.json"
            
            gift_list.append({
                'id': row['id'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'lottie_url': lottie_url,
                'fragment_url': f"https://nft.fragment.com/gift/{slug}",
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list)
        })
        
    except Exception as e:
        logger.error(f"Error in by-message: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@gift_scanned_bp.route('/api/by-user/<int:user_id>')
def api_get_gifts_by_user(user_id):
    """API: Mendapatkan semua gift dari sender_id tertentu"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = {col[1] for col in cur.fetchall()}
        
        select_cols = ['slug', 'message_id', 'rowid as id']
        
        if 'lottie_url' in existing_cols:
            select_cols.append('lottie_url')
        
        select_sql = ', '.join(select_cols)
        
        cur.execute(f"""
            SELECT {select_sql}
            FROM gift_scanned 
            WHERE sender_id = ?
            ORDER BY slug
        """, (user_id,))
        
        rows = cur.fetchall()
        conn.close()
        
        gift_list = []
        for row in rows:
            slug = row['slug']
            parts = slug.rsplit('-', 1)
            gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else slug
            gift_number = parts[1] if len(parts) == 2 and parts[1].isdigit() else ''
            
            lottie_url = row['lottie_url'] if ('lottie_url' in row.keys() and row['lottie_url']) else f"https://nft.fragment.com/gift/{slug}.lottie.json"
            
            gift_list.append({
                'id': row['id'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'lottie_url': lottie_url,
                'fragment_url': f"https://nft.fragment.com/gift/{slug}",
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list)
        })
        
    except Exception as e:
        logger.error(f"Error in by-user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@gift_scanned_bp.route('/api/filter')
def api_get_gifts_by_filter():
    """API: Mendapatkan gift berdasarkan multiple filter names"""
    try:
        filter_names = request.args.get('names', '', type=str).strip()
        
        if not filter_names:
            return jsonify({
                'success': False,
                'error': 'Parameter names diperlukan',
                'data': [], 'total': 0
            }), 400
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database tidak ditemukan',
                'data': [], 'total': 0
            }), 500
        
        cur = conn.cursor()
        
        # Cek tabel
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gift_scanned'")
        if not cur.fetchone():
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Tabel gift_scanned belum ada',
                'data': [], 'total': 0
            }), 404
        
        # Cek kolom yang ada
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = {col[1] for col in cur.fetchall()}
        
        # Build SELECT columns
        select_cols = ['slug', 'message_id', 'text', 'rowid as id']
        optional_cols = ['sender_id', 'model', 'model_rarity', 
                        'background', 'background_rarity', 
                        'symbol', 'symbol_rarity',
                        'original_details', 
                        'availability_issued', 'availability_total',
                        'lottie_url', 'fragment_url']
        
        for col in optional_cols:
            if col in existing_cols:
                select_cols.append(col)
        
        select_sql = ', '.join(select_cols)
        
        # Parse filter names (comma separated)
        names_list = [n.strip() for n in filter_names.split(',') if n.strip()]
        
        if not names_list:
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Tidak ada nama filter valid',
                'data': [], 'total': 0
            }), 400
        
        # Build WHERE clause untuk multiple names
        like_clauses = []
        params = []
        for name in names_list:
            like_clauses.append("slug LIKE ?")
            params.append(f'{name}-%')
        
        where_sql = "WHERE " + " OR ".join(like_clauses)
        
        # Ambil semua data
        cur.execute(f"""
            SELECT {select_sql}
            FROM gift_scanned 
            {where_sql}
            ORDER BY slug
        """, params)
        
        rows = cur.fetchall()
        conn.close()
        
        # Format data
        gift_list = []
        for row in rows:
            slug = row['slug']
            
            parts = slug.rsplit('-', 1)
            if len(parts) == 2 and parts[1].isdigit():
                gift_name = parts[0]
                gift_number = parts[1]
            else:
                gift_name = slug
                gift_number = ''
            
            lottie_url = row['lottie_url'] if ('lottie_url' in row.keys() and row['lottie_url']) else f"https://nft.fragment.com/gift/{slug}.lottie.json"
            fragment_url = row['fragment_url'] if ('fragment_url' in row.keys() and row['fragment_url']) else f"https://nft.fragment.com/gift/{slug}"
            
            gift_list.append({
                'id': row['id'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'text': row['text'] or '',
                'lottie_url': lottie_url,
                'fragment_url': fragment_url,
            })
        
        logger.info(f"✅ Filter: {len(names_list)} names, found {len(gift_list)} gifts")
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list),
            'filter_names': names_list
        })
        
    except Exception as e:
        logger.error(f"❌ Error di api_get_gifts_by_filter: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e),
            'data': [], 'total': 0
        }), 500