# services/debug_service.py
import sqlite3
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from collections import defaultdict
import threading
import time

debug_bp = Blueprint('debug', __name__, url_prefix='/api/winedash/debug')

# Store logs per user
console_logs = defaultdict(list)
network_requests = defaultdict(list)
MAX_LOGS_PER_USER = 500

def add_console_log(user_id, log_type, message):
    """Add console log for user"""
    try:
        logs = console_logs[user_id]
        logs.append({
            'id': len(logs),
            'type': log_type,
            'message': str(message),
            'timestamp': datetime.now().isoformat()
        })
        # Keep only last MAX_LOGS_PER_USER
        if len(logs) > MAX_LOGS_PER_USER:
            console_logs[user_id] = logs[-MAX_LOGS_PER_USER:]
        return True
    except Exception as e:
        print(f"Error adding console log: {e}")
        return False

def add_network_request(user_id, method, url, status=None, request_body=None, response_body=None, duration=None):
    """Add network request for user"""
    try:
        requests = network_requests[user_id]
        requests.append({
            'id': len(requests),
            'method': method,
            'url': url,
            'status': status,
            'requestBody': request_body,
            'responseBody': response_body,
            'duration': duration,
            'timestamp': datetime.now().isoformat()
        })
        if len(requests) > MAX_LOGS_PER_USER:
            network_requests[user_id] = requests[-MAX_LOGS_PER_USER:]
        return True
    except Exception as e:
        print(f"Error adding network request: {e}")
        return False

# ==================== API ENDPOINTS ====================

@debug_bp.route('/console/<int:user_id>', methods=['GET'])
def get_console_logs(user_id):
    """Get console logs for user"""
    try:
        logs = console_logs.get(user_id, [])
        return jsonify({
            'success': True,
            'logs': logs[-100:],  # Last 100 logs
            'total': len(logs)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@debug_bp.route('/console/add', methods=['POST'])
def add_console_log():
    """Add console log (called by client)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        log_type = data.get('type', 'log')
        message = data.get('message', '')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        add_console_log(user_id, log_type, message)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@debug_bp.route('/console/clear/<int:user_id>', methods=['POST'])
def clear_console_logs(user_id):
    """Clear console logs for user"""
    try:
        console_logs[user_id] = []
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@debug_bp.route('/network/<int:user_id>', methods=['GET'])
def get_network_requests(user_id):
    """Get network requests for user"""
    try:
        requests = network_requests.get(user_id, [])
        return jsonify({
            'success': True,
            'requests': requests[-100:],  # Last 100 requests
            'total': len(requests)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@debug_bp.route('/network/add', methods=['POST'])
def add_network_request():
    """Add network request (called by client)"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        method = data.get('method', 'GET')
        url = data.get('url', '')
        status = data.get('status')
        request_body = data.get('requestBody')
        response_body = data.get('responseBody')
        duration = data.get('duration')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'user_id required'}), 400
        
        add_network_request(user_id, method, url, status, request_body, response_body, duration)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@debug_bp.route('/network/clear/<int:user_id>', methods=['POST'])
def clear_network_requests(user_id):
    """Clear network requests for user"""
    try:
        network_requests[user_id] = []
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@debug_bp.route('/storage/<int:user_id>', methods=['GET'])
def get_storage_data(user_id):
    """Get localStorage and sessionStorage data (simulated)"""
    try:
        # This would need to be captured from client
        # For now, return empty
        return jsonify({
            'success': True,
            'localStorage': {},
            'sessionStorage': {},
            'message': 'Storage data capture requires client-side instrumentation'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@debug_bp.route('/storage/clear/<int:user_id>', methods=['POST'])
def clear_storage(user_id):
    """Clear storage data (simulated)"""
    try:
        return jsonify({'success': True, 'message': 'Storage cleared'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500