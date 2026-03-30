from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import prd

prd_bp = Blueprint('prd', __name__)

@prd_bp.route('/products/layanan/<int:website_id>', methods=['GET'])
def api_get_layanan(website_id):
    try:
        layanan = prd.get_layanan(website_id)
        return jsonify({'success': True, 'layanan': layanan})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/aplikasi/<int:website_id>/<path:layanan_nama>', methods=['GET'])
def api_get_aplikasi(website_id, layanan_nama):
    try:
        aplikasi = prd.get_aplikasi_by_layanan(website_id, layanan_nama)
        return jsonify({'success': True, 'aplikasi': aplikasi})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/items/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['GET'])
def api_get_items(website_id, layanan_nama, aplikasi_nama):
    try:
        items = prd.get_items_by_aplikasi(website_id, layanan_nama, aplikasi_nama)
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/all/<int:website_id>', methods=['GET'])
def api_get_all_data(website_id):
    try:
        data = prd.get_all_data(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/layanan/<int:website_id>', methods=['POST'])
def api_save_layanan(website_id):
    try:
        data = request.json
        if 'layanan_nama' not in data:
            return jsonify({'success': False, 'error': 'Layanan name required'}), 400
        
        success = prd.save_layanan(website_id, data)
        if success:
            return jsonify({'success': True, 'message': 'Layanan saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save layanan'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/aplikasi/<int:website_id>/<path:layanan_nama>', methods=['POST'])
def api_save_aplikasi(website_id, layanan_nama):
    try:
        data = request.json
        if 'aplikasi_nama' not in data:
            return jsonify({'success': False, 'error': 'Aplikasi name required'}), 400
        
        success = prd.save_aplikasi(website_id, layanan_nama, data)
        if success:
            return jsonify({'success': True, 'message': 'Aplikasi saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save aplikasi'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/item/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['POST'])
def api_save_item(website_id, layanan_nama, aplikasi_nama):
    try:
        data = request.json
        if 'item_nama' not in data:
            return jsonify({'success': False, 'error': 'Item name required'}), 400
        
        success = prd.save_item(website_id, layanan_nama, aplikasi_nama, data)
        if success:
            return jsonify({'success': True, 'message': 'Item saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save item'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/layanan/<int:website_id>/<path:layanan_nama>', methods=['DELETE'])
def api_delete_layanan(website_id, layanan_nama):
    try:
        success = prd.delete_layanan(website_id, layanan_nama)
        if success:
            return jsonify({'success': True, 'message': 'Layanan deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Layanan not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/aplikasi/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['DELETE'])
def api_delete_aplikasi(website_id, layanan_nama, aplikasi_nama):
    try:
        success = prd.delete_aplikasi(website_id, layanan_nama, aplikasi_nama)
        if success:
            return jsonify({'success': True, 'message': 'Aplikasi deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Aplikasi not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@prd_bp.route('/products/item/<int:item_id>', methods=['DELETE'])
def api_delete_item(item_id):
    try:
        success = prd.delete_item(item_id)
        if success:
            return jsonify({'success': True, 'message': 'Item deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Item not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500