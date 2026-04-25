# /root/wtb/services/jaseb/panel_service.py
import sys
import os
from datetime import datetime
from flask import Blueprint, request, jsonify

# Add path ke database Jaseb
JASEB_DIR = '/root/jaseb'
if JASEB_DIR not in sys.path:
    sys.path.insert(0, JASEB_DIR)

# Import database dari Jaseb
try:
    from database.data import db
    print("✅ Jaseb database imported successfully")
except ImportError as e:
    print(f"⚠️ Failed to import Jaseb database: {e}")
    db = None

# Buat blueprint dengan url_prefix yang benar
panel_bp = Blueprint('panel', __name__, url_prefix='/jaseb/api/panel')


@panel_bp.route('/dashboard', methods=['GET'])
def get_dashboard():
    """Get dashboard statistics"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        stats = db.get_stats()
        
        # Get active sebar count
        sebar_result = db.execute_query(
            "SELECT COUNT(*) as count FROM jaseb_userbot_sebar WHERE is_running = 1"
        )
        active_sebar = sebar_result.fetchone()['count'] if sebar_result else 0
        
        # Get pending queue count
        pending_queue = db.get_pending_queue_count()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_users': stats.get('total_users', 0),
                'active_sessions': stats.get('active_sessions', 0),
                'total_groups': stats.get('total_groups', 0),
                'total_messages': stats.get('users_with_message', 0),
                'active_sebar': active_sebar,
                'pending_queue': pending_queue
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/logs', methods=['GET'])
def get_logs():
    """Get activity logs"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        limit = request.args.get('limit', 50, type=int)
        logs = db.get_activity_logs(limit=limit)
        return jsonify({'success': True, 'data': logs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/status', methods=['GET'])
def get_user_status(user_id):
    """Get userbot status for a user"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        session = db.get_userbot_session(user_id)
        session_active = session is not None and session.get('is_active', 0) == 1
        
        sebar_status = db.get_sebar_status(user_id)
        mode = db.get_mode(user_id)
        
        return jsonify({
            'success': True,
            'session_active': session_active,
            'phone_number': session.get('phone_number') if session else None,
            'is_running': sebar_status,
            'mode': mode.get('mode_type', 'send')
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/stats', methods=['GET'])
def get_user_stats(user_id):
    """Get user statistics"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        groups = db.get_user_groups(user_id)
        message = db.get_message(user_id)
        delay = db.get_delay(user_id)
        
        db.update_user_activity(user_id)
        
        return jsonify({
            'success': True,
            'groups': len(groups),
            'has_message': message is not None,
            'has_delay': delay is not None,
            'last_active': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/groups', methods=['GET'])
def get_user_groups_endpoint(user_id):
    """Get user groups"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        groups = db.get_user_groups(user_id)
        return jsonify({'success': True, 'groups': groups})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/groups/<int:group_id>', methods=['DELETE'])
def delete_user_group(user_id, group_id):
    """Delete a group for user"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        db.delete_group(user_id, group_id)
        return jsonify({'success': True, 'message': 'Group deleted'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/mode', methods=['GET'])
def get_user_mode_endpoint(user_id):
    """Get user mode"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        mode = db.get_mode(user_id)
        return jsonify({'success': True, 'mode': mode.get('mode_type', 'send')})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/mode', methods=['POST'])
def set_user_mode_endpoint(user_id):
    """Set user mode"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        data = request.json
        mode_type = data.get('mode', 'send')
        
        if mode_type not in ['send', 'forward']:
            return jsonify({'success': False, 'error': 'Invalid mode'}), 400
        
        db.save_mode(user_id, mode_type)
        return jsonify({'success': True, 'message': f'Mode set to {mode_type}'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/message', methods=['GET'])
def get_user_message_endpoint(user_id):
    """Get user message"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        message = db.get_message(user_id)
        return jsonify({'success': True, 'message': message})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/message', methods=['POST'])
def set_user_message_endpoint(user_id):
    """Save user message"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        data = request.json
        message_text = data.get('message_text', '')
        
        if not message_text:
            return jsonify({'success': False, 'error': 'Message text required'}), 400
        
        db.save_message(user_id, message_text)
        return jsonify({'success': True, 'message': 'Message saved'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/message', methods=['DELETE'])
def delete_user_message_endpoint(user_id):
    """Delete user message"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        db.delete_message(user_id)
        return jsonify({'success': True, 'message': 'Message deleted'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/delay', methods=['GET'])
def get_user_delay_endpoint(user_id):
    """Get user delay settings"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        delay = db.get_delay(user_id)
        return jsonify({'success': True, 'delay': delay})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/delay', methods=['POST'])
def set_user_delay_endpoint(user_id):
    """Save user delay settings"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        data = request.json
        delay_text = data.get('delay_text', '')
        
        if not delay_text:
            return jsonify({'success': False, 'error': 'Delay text required'}), 400
        
        delay_seconds = parse_delay_text(delay_text)
        
        if delay_seconds <= 0:
            return jsonify({'success': False, 'error': 'Invalid delay format'}), 400
        
        db.save_delay(user_id, delay_seconds, delay_text)
        return jsonify({'success': True, 'message': 'Delay saved'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/delay/toggle', methods=['POST'])
def toggle_user_delay_mode_endpoint(user_id):
    """Toggle delay mode between delay and instant"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        new_mode = db.toggle_delay_mode(user_id)
        return jsonify({'success': True, 'mode': new_mode})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/sebar/status', methods=['GET'])
def get_sebar_status_endpoint(user_id):
    """Get sebar status for user"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        is_running = db.get_sebar_status(user_id)
        return jsonify({'success': True, 'is_running': is_running})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/sebar/start', methods=['POST'])
def start_sebar_endpoint(user_id):
    """Start sebar for user"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        groups = db.get_user_groups(user_id)
        if not groups:
            return jsonify({'success': False, 'error': 'Tidak ada grup yang tersimpan'}), 400
        
        message = db.get_message(user_id)
        if not message:
            return jsonify({'success': False, 'error': 'Tidak ada pesan yang tersimpan'}), 400
        
        delay = db.get_delay(user_id)
        if not delay:
            return jsonify({'success': False, 'error': 'Tidak ada pengaturan jeda'}), 400
        
        db.set_sebar_status(user_id, True)
        db.add_activity_log(user_id, 'sebar_start', 'User started sebar process')
        
        return jsonify({'success': True, 'message': 'Sebar dimulai'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/sebar/stop', methods=['POST'])
def stop_sebar_endpoint(user_id):
    """Stop sebar for user"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        db.set_sebar_status(user_id, False)
        db.add_activity_log(user_id, 'sebar_stop', 'User stopped sebar process')
        
        return jsonify({'success': True, 'message': 'Sebar dihentikan'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/sebar/stats', methods=['GET'])
def get_sebar_stats_endpoint(user_id):
    """Get sebar statistics for user"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        groups = db.get_user_groups(user_id)
        sebar_status = db.get_sebar_status(user_id)
        
        logs = db.get_activity_logs(user_id, limit=100)
        success_count = sum(1 for log in logs if log.get('action') == 'sebar_success')
        failed_count = sum(1 for log in logs if log.get('action') == 'sebar_failed')
        
        return jsonify({
            'success': True,
            'total_groups': len(groups),
            'success': success_count,
            'failed': failed_count,
            'is_running': sebar_status
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@panel_bp.route('/user/<int:user_id>/sebar/logs', methods=['GET'])
def get_sebar_logs_endpoint(user_id):
    """Get sebar logs for user"""
    try:
        if db is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
            
        logs = db.get_activity_logs(user_id, limit=50)
        return jsonify({'success': True, 'data': logs})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def parse_delay_text(delay_text):
    """Parse delay text to seconds"""
    import re
    delay_text = delay_text.lower().strip()
    total_seconds = 0
    
    patterns = [
        (r'(\d+)\s*(?:tahun|thn|year|yr)\b', 31536000),
        (r'(\d+)\s*(?:bulan|bln|month|mo)\b', 2592000),
        (r'(\d+)\s*(?:minggu|mgg|week|wk)\b', 604800),
        (r'(\d+)\s*(?:hari|hr|day|d)\b', 86400),
        (r'(\d+)\s*(?:jam|j|hour|h)\b', 3600),
        (r'(\d+)\s*(?:menit|mnt|minute|min|m)\b', 60),
        (r'(\d+)\s*(?:detik|dtk|second|sec|s)\b', 1)
    ]
    
    for pattern, multiplier in patterns:
        matches = re.findall(pattern, delay_text)
        for match in matches:
            total_seconds += int(match) * multiplier
    
    if total_seconds == 0:
        numbers = re.findall(r'(\d+)', delay_text)
        if numbers:
            total_seconds = int(numbers[0])
    
    return total_seconds