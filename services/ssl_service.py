from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import ssl

ssl_bp = Blueprint('ssl', __name__)

@ssl_bp.route('/social/telegram/<int:website_id>', methods=['GET'])
def get_telegram(website_id):
    try:
        data = ssl.get_telegram(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/telegram/<int:website_id>', methods=['POST'])
def save_telegram(website_id):
    try:
        data = request.json
        
        success = ssl.save_telegram(website_id, data)
        if success:
            return jsonify({'success': True, 'message': 'Telegram settings saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/links/<int:website_id>', methods=['GET'])
def get_links(website_id):
    try:
        data = ssl.get_links(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/links/<int:website_id>', methods=['POST'])
def save_links(website_id):
    try:
        data = request.json
        
        success = ssl.save_links(website_id, data)
        if success:
            return jsonify({'success': True, 'message': 'Links saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/force/<int:website_id>', methods=['GET'])
def get_force(website_id):
    try:
        data = ssl.get_all_force(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/force/<int:website_id>', methods=['POST'])
def save_force(website_id):
    try:
        data = request.json
        
        force_id = ssl.save_force(website_id, data)
        if force_id:
            return jsonify({'success': True, 'id': force_id, 'message': 'Force subscribe saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/force/<int:force_id>', methods=['DELETE'])
def delete_force(force_id):
    try:
        success = ssl.delete_force(force_id)
        if success:
            return jsonify({'success': True, 'message': 'Force subscribe deleted'})
        else:
            return jsonify({'success': False, 'error': 'Force subscribe not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/force-settings/<int:website_id>', methods=['GET'])
def get_force_settings(website_id):
    try:
        data = ssl.get_force_settings(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@ssl_bp.route('/social/force-settings/<int:website_id>', methods=['POST'])
def save_force_settings(website_id):
    try:
        data = request.json
        
        success = ssl.save_force_settings(website_id, data)
        if success:
            return jsonify({'success': True, 'message': 'Force settings saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500