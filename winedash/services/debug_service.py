# services/debug_service.py - Update endpoint untuk menggunakan database

import sqlite3
import sys
from pathlib import Path
from datetime import datetime
from flask import Blueprint, request, jsonify
from collections import defaultdict

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from winedash.database.web import WinedashDatabase

debug_bp = Blueprint('debug', __name__, url_prefix='/api/winedash/debug')
db = WinedashDatabase()

# In-memory fallback jika database tidak tersedia
console_logs = defaultdict(list)
network_requests = defaultdict(list)
MAX_LOGS_PER_USER = 1000


@debug_bp.route('/users', methods=['GET', 'OPTIONS'])
def get_active_users():
    """Get list of active users with logs"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        users = {}
        
        # Get users from debug_logs table
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT user_id, COUNT(*) as count, MAX(created_at) as last_log
                FROM debug_logs
                GROUP BY user_id
                ORDER BY last_log DESC
                LIMIT 50
            ''')
            rows = cursor.fetchall()
            for row in rows:
                users[row[0]] = {
                    'user_id': row[0],
                    'console_count': row[1],
                    'network_count': 0,
                    'last_log': row[2]
                }
        
        # Get users from network_requests table
        cursor.execute('''
            SELECT user_id, COUNT(*) as count, MAX(timestamp) as last_log
            FROM debug_network
            GROUP BY user_id
            ORDER BY last_log DESC
            LIMIT 50
        ''')
        rows = cursor.fetchall()
        for row in rows:
            if row[0] in users:
                users[row[0]]['network_count'] = row[1]
            else:
                users[row[0]] = {
                    'user_id': row[0],
                    'console_count': 0,
                    'network_count': row[1],
                    'last_log': row[2]
                }
        
        users_list = list(users.values())
        return jsonify({
            'success': True,
            'users': users_list
        })
        
    except Exception as e:
        print(f"Error getting active users: {e}")
        # Fallback to in-memory
        users = {}
        for user_id in console_logs.keys():
            users[user_id] = {
                'user_id': user_id,
                'console_count': len(console_logs.get(user_id, [])),
                'network_count': len(network_requests.get(user_id, [])),
                'last_log': console_logs.get(user_id, [])[-1]['timestamp'] if console_logs.get(user_id) else None
            }
        for user_id in network_requests.keys():
            if user_id not in users:
                users[user_id] = {
                    'user_id': user_id,
                    'console_count': 0,
                    'network_count': len(network_requests.get(user_id, [])),
                    'last_log': network_requests.get(user_id, [])[-1]['timestamp'] if network_requests.get(user_id) else None
                }
        
        users_list = list(users.values())
        users_list.sort(key=lambda x: x.get('last_log') or '', reverse=True)
        
        return jsonify({
            'success': True,
            'users': users_list[:50]
        })


@debug_bp.route('/console/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_console_logs(user_id):
    """Get console logs for user"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        # Try to get from database first
        logs = db.get_debug_logs(user_id)
        if logs:
            return jsonify({
                'success': True,
                'logs': logs,
                'total': len(logs)
            })
    except Exception as e:
        print(f"Database error: {e}")
    
    # Fallback to in-memory
    logs = console_logs.get(user_id, [])
    return jsonify({
        'success': True,
        'logs': logs[-200:],
        'total': len(logs)
    })


@debug_bp.route('/console/add', methods=['POST', 'OPTIONS'])
def add_console_log():
    """Add console log (called by client)"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        logs = data.get('logs')
        if logs and isinstance(logs, list):
            for log in logs:
                db.add_debug_log(
                    user_id=user_id,
                    log_type=log.get('type', 'log'),
                    message=log.get('message', ''),
                    url=log.get('url', '')
                )
                # Also store in memory
                console_logs[user_id].append({
                    'id': len(console_logs[user_id]),
                    'type': log.get('type', 'log'),
                    'message': log.get('message', ''),
                    'url': log.get('url', ''),
                    'timestamp': log.get('timestamp', datetime.now().isoformat())
                })
                if len(console_logs[user_id]) > MAX_LOGS_PER_USER:
                    console_logs[user_id] = console_logs[user_id][-MAX_LOGS_PER_USER:]
        else:
            log_type = data.get('type', 'log')
            message = data.get('message', '')
            url = data.get('url', '')
            db.add_debug_log(user_id, log_type, message, url)
            console_logs[user_id].append({
                'id': len(console_logs[user_id]),
                'type': log_type,
                'message': message,
                'url': url,
                'timestamp': datetime.now().isoformat()
            })
            if len(console_logs[user_id]) > MAX_LOGS_PER_USER:
                console_logs[user_id] = console_logs[user_id][-MAX_LOGS_PER_USER:]
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Error adding console log: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@debug_bp.route('/console/clear/<int:user_id>', methods=['POST', 'OPTIONS'])
def clear_console_logs(user_id):
    """Clear console logs for user"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        db.clear_debug_logs(user_id)
        console_logs[user_id] = []
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@debug_bp.route('/network/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_network_requests(user_id):
    """Get network requests for user"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        requests = network_requests.get(user_id, [])
        return jsonify({
            'success': True,
            'requests': requests[-200:],
            'total': len(requests)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@debug_bp.route('/network/add', methods=['POST', 'OPTIONS'])
def add_network_request():
    """Add network request (called by client)"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        request_data = {
            'id': len(network_requests[user_id]),
            'method': data.get('method', 'GET'),
            'url': data.get('url', ''),
            'status': data.get('status'),
            'requestBody': data.get('requestBody'),
            'responseBody': data.get('responseBody'),
            'duration': data.get('duration'),
            'timestamp': data.get('timestamp', datetime.now().isoformat())
        }
        
        network_requests[user_id].append(request_data)
        
        if len(network_requests[user_id]) > MAX_LOGS_PER_USER:
            network_requests[user_id] = network_requests[user_id][-MAX_LOGS_PER_USER:]
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"Error adding network request: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@debug_bp.route('/network/clear/<int:user_id>', methods=['POST', 'OPTIONS'])
def clear_network_requests(user_id):
    """Clear network requests for user"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        network_requests[user_id] = []
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@debug_bp.route('/storage/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_storage_data(user_id):
    """Get storage data for user (placeholder)"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        return jsonify({
            'success': True,
            'localStorage': {},
            'sessionStorage': {},
            'message': 'Storage capture requires client-side instrumentation'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@debug_bp.route('/storage/clear/<int:user_id>', methods=['POST', 'OPTIONS'])
def clear_storage(user_id):
    """Clear storage data (placeholder)"""
    if request.method == 'OPTIONS':
        return _options_response()
    
    try:
        return jsonify({'success': True, 'message': 'Storage cleared'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _options_response():
    """Helper untuk CORS preflight"""
    response = jsonify({'success': True})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    return response