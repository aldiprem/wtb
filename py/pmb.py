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
        
@pmb_bp.route('/payments/rekening/<int:website_id>/limited', methods=['GET'])
def get_rekening_limited(website_id):
    """
    Mendapatkan rekening dengan limit (untuk tampilan awal)
    """
    try:
        limit = request.args.get('limit', default=4, type=int)
        rekening = pmb.get_all_rekening(website_id)
        
        # Batasi hanya 4 rekening
        limited = rekening[:limit]
        has_more = len(rekening) > limit
        
        return jsonify({
            'success': True, 
            'rekening': limited,
            'total': len(rekening),
            'has_more': has_more,
            'limit': limit
        })
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
        
# Di pmb_service.py, tambahkan endpoint baru:

def get_package_ids(gateway_id):
    """
    Mendapatkan package IDs dari gateway
    Returns: list of package ids
    """
    conn = None
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT package_ids FROM gateway WHERE id = ?', (gateway_id,))
        row = cursor.fetchone()
        
        if row and row['package_ids']:
            # Parse JSON
            try:
                package_ids = json.loads(row['package_ids'])
                if isinstance(package_ids, list):
                    return package_ids
                else:
                    return ["com.gojek.gopaymerchant"]
            except:
                return ["com.gojek.gopaymerchant"]
        return ["com.gojek.gopaymerchant"]  # default
        
    except Exception as e:
        print(f"❌ Error getting package_ids: {e}")
        return ["com.gojek.gopaymerchant"]
    finally:
        if conn:
            conn.close()

@pmb_bp.route('/payments/gateway/<int:gateway_id>/package-ids', methods=['GET', 'PUT', 'OPTIONS'])
def manage_gateway_packages(gateway_id):
    """
    Mendapatkan atau mengupdate package IDs untuk gateway tertentu
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        from py.pmb import get_package_ids, update_package_ids, get_gateway_by_id
        
        if request.method == 'GET':
            package_ids = get_package_ids(gateway_id)
            gateway = get_gateway_by_id(gateway_id)
            
            return jsonify({
                'success': True,
                'gateway_id': gateway_id,
                'package_ids': package_ids,
                'gateway': gateway
            })
        
        elif request.method == 'PUT':
            data = request.json
            package_ids = data.get('package_ids', [])
            
            if not isinstance(package_ids, list):
                return jsonify({'success': False, 'error': 'package_ids harus berupa array'}), 400
            
            # Validasi package IDs
            from py.pmb import AVAILABLE_PACKAGE_IDS
            valid_ids = [p['id'] for p in AVAILABLE_PACKAGE_IDS]
            for pid in package_ids:
                if pid not in valid_ids:
                    return jsonify({'success': False, 'error': f'Package ID {pid} tidak valid'}), 400
            
            success = update_package_ids(gateway_id, package_ids)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': 'Package IDs updated successfully',
                    'package_ids': package_ids
                })
            else:
                return jsonify({'success': False, 'error': 'Gateway not found'}), 404
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500