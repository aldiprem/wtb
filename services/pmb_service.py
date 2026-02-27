from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import pmb

pmb_bp = Blueprint('pmb', __name__)

@pmb_bp.route('/payments/rekening/<int:website_id>', methods=['GET'])
def get_rekening(website_id):
    try:
        rekening = pmb.get_all_rekening(website_id)
        return jsonify({'success': True, 'rekening': rekening})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@pmb_bp.route('/payments/rekening/<int:website_id>', methods=['POST'])
def save_rekening(website_id):
    try:
        data = request.json
        
        rekening_id = pmb.save_rekening(website_id, data)
        if rekening_id:
            return jsonify({'success': True, 'id': rekening_id, 'message': 'Rekening saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save rekening'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@pmb_bp.route('/payments/rekening/<int:rekening_id>', methods=['DELETE'])
def delete_rekening(rekening_id):
    try:
        success = pmb.delete_rekening(rekening_id)
        if success:
            return jsonify({'success': True, 'message': 'Rekening deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Rekening not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@pmb_bp.route('/payments/gateway/<int:website_id>', methods=['GET'])
def get_gateway(website_id):
    try:
        gateway = pmb.get_all_gateway(website_id)
        return jsonify({'success': True, 'gateway': gateway})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@pmb_bp.route('/payments/gateway/<int:website_id>', methods=['POST'])
def save_gateway(website_id):
    try:
        data = request.json
        
        gateway_id = pmb.save_gateway(website_id, data)
        if gateway_id:
            return jsonify({'success': True, 'id': gateway_id, 'message': 'Gateway saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save gateway'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@pmb_bp.route('/payments/gateway/<int:gateway_id>', methods=['DELETE'])
def delete_gateway(gateway_id):
    try:
        success = pmb.delete_gateway(gateway_id)
        if success:
            return jsonify({'success': True, 'message': 'Gateway deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Gateway not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500