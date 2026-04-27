# services/data_service.py — ScamAction Flask Blueprint (API only)
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Blueprint, request, jsonify
from database.data import (
    add_scan_channel, remove_scan_channel, get_scan_channels, reset_scan_channels,
    get_all_scanned_ids, get_scammer_references, is_known_scammer, get_stats,
    get_monitor_channels, get_monitor_channel, toggle_monitor_channel,
    add_monitor_admin, remove_monitor_admin, reset_monitor_admins, get_monitor_admins,
    get_reports, get_monitor_alerts, get_all_users, get_user,
)
import json
import sqlite3

scam_bp = Blueprint('scamaction', __name__, url_prefix='/api/scamaction')

def get_channel_link(channel_id, msg_id):
    """Mendapatkan link channel (public jika ada username)"""
    channels = get_scan_channels()
    for ch in channels:
        if ch['channel_id'] == channel_id:
            username = ch.get('username')
            if username:
                return f"https://t.me/{username}/{msg_id}"
            break
    
    channel_id_str = str(channel_id)
    if channel_id_str.startswith('-100'):
        channel_id_str = channel_id_str[4:]
    return f"https://t.me/c/{channel_id_str}/{msg_id}"

# ─── Dashboard / Stats ────────────────────────────────────────────────────────

@scam_bp.route('/stats', methods=['GET'])
def api_stats():
    try:
        return jsonify({'success': True, 'data': get_stats()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ─── Scan Channels ────────────────────────────────────────────────────────────

@scam_bp.route('/channels', methods=['GET'])
def api_get_channels():
    try:
        return jsonify({'success': True, 'data': get_scan_channels()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/channels', methods=['POST'])
def api_add_channel():
    try:
        body = request.json or {}
        channel_id   = int(body.get('channel_id', 0))
        channel_name = body.get('channel_name', '')
        username     = body.get('username', '')
        if not channel_id:
            return jsonify({'success': False, 'error': 'channel_id required'}), 400
        add_scan_channel(channel_id, channel_name, username)
        return jsonify({'success': True, 'message': f'Channel {channel_id} ditambahkan'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/channels/<int:channel_id>', methods=['DELETE'])
def api_remove_channel(channel_id):
    try:
        remove_scan_channel(channel_id)
        return jsonify({'success': True, 'message': f'Channel {channel_id} dihapus'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/channels/reset', methods=['POST'])
def api_reset_channels():
    try:
        reset_scan_channels()
        return jsonify({'success': True, 'message': 'Semua channel di-reset'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ─── Scanned IDs ──────────────────────────────────────────────────────────────

@scam_bp.route('/scanned', methods=['GET'])
def api_all_scanned():
    try:
        ids = get_all_scanned_ids()
        return jsonify({'success': True, 'data': ids, 'total': len(ids)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/scanned/<int:user_id>', methods=['GET'])
def api_scammer_refs(user_id):
    try:
        refs = get_scammer_references(user_id)
        return jsonify({'success': True, 'is_scammer': bool(refs), 'data': refs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/check/<int:user_id>', methods=['GET'])
def api_check(user_id):
    try:
        known = is_known_scammer(user_id)
        refs  = get_scammer_references(user_id) if known else []
        return jsonify({'success': True, 'is_scammer': known, 'references': refs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ─── Monitor Channels ─────────────────────────────────────────────────────────

@scam_bp.route('/monitor', methods=['GET'])
def api_monitor_list():
    try:
        added_by = request.args.get('added_by', type=int)
        data = get_monitor_channels(added_by)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/monitor/<int:chat_id>', methods=['GET'])
def api_monitor_detail(chat_id):
    try:
        ch = get_monitor_channel(chat_id)
        if not ch:
            return jsonify({'success': False, 'error': 'Not found'}), 404
        admins = get_monitor_admins(chat_id)
        return jsonify({'success': True, 'data': ch, 'admins': admins})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/monitor/<int:chat_id>/toggle', methods=['POST'])
def api_toggle_monitor(chat_id):
    try:
        new_state = toggle_monitor_channel(chat_id)
        return jsonify({'success': True, 'is_active': new_state})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/monitor/<int:chat_id>/admins', methods=['GET'])
def api_get_admins(chat_id):
    try:
        return jsonify({'success': True, 'data': get_monitor_admins(chat_id)})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/monitor/<int:chat_id>/admins', methods=['POST'])
def api_add_admin(chat_id):
    try:
        body = request.json or {}
        uid = int(body.get('user_id', 0))
        if not uid:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        add_monitor_admin(chat_id, uid)
        return jsonify({'success': True, 'message': f'Admin {uid} ditambahkan'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/monitor/<int:chat_id>/admins/<int:user_id>', methods=['DELETE'])
def api_remove_admin(chat_id, user_id):
    try:
        remove_monitor_admin(chat_id, user_id)
        return jsonify({'success': True, 'message': f'Admin {user_id} dihapus'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/monitor/<int:chat_id>/admins/reset', methods=['POST'])
def api_reset_admins(chat_id):
    try:
        reset_monitor_admins(chat_id)
        return jsonify({'success': True, 'message': 'Semua admin di-reset'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ─── Reports ──────────────────────────────────────────────────────────────────

@scam_bp.route('/reports', methods=['GET'])
def api_reports():
    try:
        uid = request.args.get('user_id', type=int)
        data = get_reports(uid, limit=100)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ─── Monitor Alerts ───────────────────────────────────────────────────────────

@scam_bp.route('/alerts', methods=['GET'])
def api_alerts():
    try:
        data = get_monitor_alerts(limit=100)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ─── Users ────────────────────────────────────────────────────────────────────

@scam_bp.route('/users', methods=['GET'])
def api_users():
    try:
        return jsonify({'success': True, 'data': get_all_users()})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@scam_bp.route('/users/<int:user_id>', methods=['GET'])
def api_user_detail(user_id):
    try:
        u = get_user(user_id)
        if not u:
            return jsonify({'success': False, 'error': 'Not found'}), 404
        return jsonify({'success': True, 'data': u})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
# ─── Scan Results API ─────────────────────────────────────────────────────────

@scam_bp.route('/scan_results/<token>', methods=['GET'])
def get_scan_results(token):
    """API untuk mengambil hasil scan berdasarkan token"""
    try:
        db_path = '/root/wtb/scamaction/scamaction.db'
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Cek tabel scan_results
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scan_results'")
        if not cur.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'No results found'}), 404
        
        cur.execute("""
            SELECT scan_token, monitor_chat_id, monitor_chat_name, scan_channel_id, scan_channel_name, format_text, found_ids, created_at, expires_at
            FROM scan_results WHERE scan_token = ? AND expires_at > datetime('now')
        """, (token,))
        
        row = cur.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'success': False, 'error': 'Link expired or not found'}), 404
        
        found_ids = json.loads(row['found_ids']) if row['found_ids'] else {}
        
        # Untuk setiap ID, cari info user dan referensi
        results = []
        for user_id, info in found_ids.items():
            # Cek apakah user terdata di database
            is_known = is_known_scammer(int(user_id))
            refs = get_scammer_references(int(user_id)) if is_known else []
            
            # Format referensi
            ref_list = []
            for r in refs:
                ch_link = get_channel_link(r['channel_id'], r['msg_id'])
                ref_list.append({
                    'channel_name': r['channel_name'],
                    'msg_id': r['msg_id'],
                    'link': ch_link
                })
            
            results.append({
                'user_id': int(user_id),
                'is_known': is_known,
                'references': ref_list,
                'source_msg_id': info.get('msg_id'),
                'source_text': info.get('text', '')
            })
        
        return jsonify({
            'success': True,
            'data': {
                'token': row['scan_token'],
                'monitor_chat_name': row['monitor_chat_name'],
                'scan_channel_name': row['scan_channel_name'],
                'format_text': row['format_text'],
                'created_at': row['created_at'],
                'expires_at': row['expires_at'],
                'total_found': len(results),
                'results': results
            }
        })
        
    except Exception as e:
        print(f"Error in get_scan_results: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500