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
    """
    API: Mendapatkan semua data gift dengan pagination
    Query params:
      - page: halaman (default: 1)
      - limit: jumlah per halaman (default: 50)
      - search: kata kunci pencarian (optional)
    """
    try:
        # Parameter
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        search = request.args.get('search', '', type=str).strip()
        
        # Validasi
        if page < 1:
            page = 1
        if limit < 1:
            limit = 50
        if limit > 200:
            limit = 200
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'success': False,
                'error': 'Database tidak ditemukan. Pastikan sudah menjalankan /scan',
                'data': [],
                'total': 0,
                'page': page,
                'total_pages': 0
            }), 500
        
        cur = conn.cursor()
        
        # Cek apakah tabel ada
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gift_scanned'")
        if not cur.fetchone():
            conn.close()
            return jsonify({
                'success': False,
                'error': 'Tabel gift_scanned belum ada. Jalankan /scan terlebih dahulu',
                'data': [],
                'total': 0,
                'page': page,
                'total_pages': 0
            }), 404
        
        # Hitung total data
        if search:
            cur.execute(
                "SELECT COUNT(*) as total FROM gift_scanned WHERE slug LIKE ? OR text LIKE ?",
                (f'%{search}%', f'%{search}%')
            )
        else:
            cur.execute("SELECT COUNT(*) as total FROM gift_scanned")
        
        total = cur.fetchone()['total']
        total_pages = max(1, (total + limit - 1) // limit)
        
        # Validasi halaman
        if page > total_pages:
            page = total_pages
        
        offset = (page - 1) * limit
        
        # Ambil data
        if search:
            cur.execute(
                """SELECT slug, message_id, text, rowid 
                   FROM gift_scanned 
                   WHERE slug LIKE ? OR text LIKE ?
                   ORDER BY slug 
                   LIMIT ? OFFSET ?""",
                (f'%{search}%', f'%{search}%', limit, offset)
            )
        else:
            cur.execute(
                """SELECT slug, message_id, text, rowid 
                   FROM gift_scanned 
                   ORDER BY slug 
                   LIMIT ? OFFSET ?""",
                (limit, offset)
            )
        
        rows = cur.fetchall()
        
        # Format data
        gift_list = []
        for row in rows:
            slug = row['slug']
            
            # Parse nama dan nomor dari slug (format: Nama-Nomor)
            parts = slug.rsplit('-', 1)
            if len(parts) == 2 and parts[1].isdigit():
                gift_name = parts[0]
                gift_number = parts[1]
            else:
                gift_name = slug
                gift_number = ''
            
            # URL Lottie dan Fragment
            lottie_url = f"https://nft.fragment.com/gift/{slug}.lottie.json"
            fragment_url = f"https://nft.fragment.com/gift/{slug}"
            
            # Text preview
            text = row['text'] if row['text'] else ''
            text_preview = text[:150] + '...' if len(text) > 150 else text
            
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'text': text,
                'text_preview': text_preview,
                'lottie_url': lottie_url,
                'fragment_url': fragment_url
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
            'data': [],
            'total': 0,
            'page': 1,
            'total_pages': 0
        }), 500

@gift_scanned_bp.route('/api/detail/<slug>')
def api_get_gift_detail(slug):
    """API: Mendapatkan detail satu gift berdasarkan slug"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        cur.execute(
            "SELECT slug, message_id, text, rowid FROM gift_scanned WHERE slug = ?",
            (slug,)
        )
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
                'text': row['text'],
                'lottie_url': f"https://nft.fragment.com/gift/{row['slug']}.lottie.json",
                'fragment_url': f"https://nft.fragment.com/gift/{row['slug']}"
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
    """API: Mendapatkan semua unique names untuk filter"""
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
        
        cur = conn.cursor()
        cur.execute("SELECT slug FROM gift_scanned")
        slugs = cur.fetchall()
        conn.close()
        
        unique_names = set()
        for row in slugs:
            parts = row['slug'].rsplit('-', 1)
            if len(parts) == 2 and parts[1].isdigit():
                unique_names.add(parts[0])
            else:
                unique_names.add(row['slug'])
        
        return jsonify({
            'success': True,
            'names': sorted(list(unique_names))
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
