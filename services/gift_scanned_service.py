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
]

def get_database_path():
    """Mencari dan mengembalikan path database yang valid"""
    for path in DATABASE_PATHS:
        if os.path.exists(path) and os.path.isfile(path):
            logger.info(f"✅ Database ditemukan: {path}")
            return path
    
    logger.error("❌ Database gift.db tidak ditemukan!")
    logger.error("Paths yang dicari:")
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
        if limit > 200: limit = 200
        
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
        
        # ✅ Cek kolom yang ada di database
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = {col[1] for col in cur.fetchall()}
        
        # Build query
        where_clauses = []
        params = []
        
        if search:
            where_clauses.append("(slug LIKE ? OR text LIKE ?)")
            params.extend([f'%{search}%', f'%{search}%'])
            # Tambah model search jika kolom ada
            if 'model' in existing_cols:
                where_clauses[-1] = "(slug LIKE ? OR text LIKE ? OR model LIKE ?)"
                params.append(f'%{search}%')
        
        if filter_name:
            where_clauses.append("slug LIKE ?")
            params.append(f'{filter_name}-%')
        
        where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        # Count total
        cur.execute(f"SELECT COUNT(*) as total FROM gift_scanned {where_sql}", params)
        total = cur.fetchone()['total']
        total_pages = max(1, (total + limit - 1) // limit)
        
        if page > total_pages:
            page = total_pages
        
        offset = (page - 1) * limit
        
        # ✅ Build SELECT columns berdasarkan kolom yang ada
        select_cols = ['slug', 'message_id', 'text', 'rowid']
        
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
        cur.execute(f"""
            SELECT {select_sql}
            FROM gift_scanned 
            {where_sql}
            ORDER BY slug 
            LIMIT ? OFFSET ?
        """, params + [limit, offset])
        
        rows = cur.fetchall()
        
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
            
            # URL - cek dari db atau generate
            lottie_url = row['lottie_url'] if ('lottie_url' in row.keys() and row['lottie_url']) else f"https://nft.fragment.com/gift/{slug}.lottie.json"
            fragment_url = row['fragment_url'] if ('fragment_url' in row.keys() and row['fragment_url']) else f"https://nft.fragment.com/gift/{slug}"
            
            # Gunakan .get() untuk optional columns
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'sender_id': row['sender_id'] if 'sender_id' in row.keys() else None,
                'text': row['text'] or '',
                'model': row['model'] if 'model' in row.keys() and row['model'] else '',
                'model_rarity': row['model_rarity'] if 'model_rarity' in row.keys() else 0,
                'background': row['background'] if 'background' in row.keys() and row['background'] else '',
                'background_rarity': row['background_rarity'] if 'background_rarity' in row.keys() else 0,
                'symbol': row['symbol'] if 'symbol' in row.keys() and row['symbol'] else '',
                'symbol_rarity': row['symbol_rarity'] if 'symbol_rarity' in row.keys() else 0,
                'original_details': row['original_details'] if 'original_details' in row.keys() and row['original_details'] else '',
                'availability_issued': row['availability_issued'] if 'availability_issued' in row.keys() else 0,
                'availability_total': row['availability_total'] if 'availability_total' in row.keys() else 0,
                'lottie_url': lottie_url,
                'fragment_url': fragment_url,
                'scanned_at': None
            })
        
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
        
        # ✅ Cek kolom yang ada
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = {col[1] for col in cur.fetchall()}
        
        # Build SELECT
        select_cols = ['slug', 'message_id', 'text', 'rowid']
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
        
        return jsonify({
            'success': True,
            'data': {
                'id': row['rowid'],
                'slug': row['slug'],
                'name': gift_name,
                'message_id': row['message_id'],
                'sender_id': row['sender_id'] if 'sender_id' in row.keys() else None,
                'text': row['text'] or '',
                'model': row['model'] if 'model' in row.keys() and row['model'] else '',
                'model_rarity': row['model_rarity'] if 'model_rarity' in row.keys() else 0,
                'background': row['background'] if 'background' in row.keys() and row['background'] else '',
                'background_rarity': row['background_rarity'] if 'background_rarity' in row.keys() else 0,
                'symbol': row['symbol'] if 'symbol' in row.keys() and row['symbol'] else '',
                'symbol_rarity': row['symbol_rarity'] if 'symbol_rarity' in row.keys() else 0,
                'original_details': row['original_details'] if 'original_details' in row.keys() and row['original_details'] else '',
                'availability_issued': row['availability_issued'] if 'availability_issued' in row.keys() else 0,
                'availability_total': row['availability_total'] if 'availability_total' in row.keys() else 0,
                'lottie_url': row['lottie_url'] if ('lottie_url' in row.keys() and row['lottie_url']) else f"https://nft.fragment.com/gift/{slug}.lottie.json",
                'fragment_url': row['fragment_url'] if ('fragment_url' in row.keys() and row['fragment_url']) else f"https://nft.fragment.com/gift/{slug}"
            }
        })
        
    except Exception as e:
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
        total = cur.fetchone()['count']
        
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
        return jsonify({'success': False, 'error': str(e)}), 500

@gift_scanned_bp.route('/api/names')
def api_get_unique_names():
    """API: Mendapatkan semua unique names dengan total count dari database"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        
        # ✅ Cek apakah tabel gift_name_counts ada
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gift_name_counts'")
        
        if cur.fetchone():
            # Gunakan tabel khusus
            cur.execute("SELECT name, total_count FROM gift_name_counts ORDER BY name")
            rows = cur.fetchall()
            conn.close()
            
            names = [{'name': row['name'], 'count': row['total_count']} for row in rows]
            
            return jsonify({
                'success': True,
                'names': [n['name'] for n in names],
                'name_counts': {n['name']: n['count'] for n in names}
            })
        else:
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
        select_cols = ['slug', 'message_id', 'text', 'rowid']
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
            fragment_url = row['fragment_url'] if ('fragment_url' in row.keys() and row['fragment_url']) else f"https://nft.fragment.com/gift/{slug}"
            
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'lottie_url': lottie_url,
                'fragment_url': fragment_url,
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list)
        })
        
    except Exception as e:
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
        
        select_cols = ['slug', 'message_id', 'text', 'rowid']
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
            fragment_url = row['fragment_url'] if ('fragment_url' in row.keys() and row['fragment_url']) else f"https://nft.fragment.com/gift/{slug}"
            
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'sender_id': row['sender_id'] if 'sender_id' in row.keys() else None,
                'lottie_url': lottie_url,
                'fragment_url': fragment_url,
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list)
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500