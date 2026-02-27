from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import vcr

vcr_bp = Blueprint('vcr', __name__)

@vcr_bp.route('/voucher/<int:website_id>', methods=['GET'])
def get_vouchers(website_id):
    """
    Mendapatkan semua voucher untuk website tertentu
    """
    try:
        # Ambil parameter filter
        active = request.args.get('active')
        expired = request.args.get('expired')
        type_filter = request.args.get('type')
        search = request.args.get('search')
        
        filters = {}
        if active is not None:
            filters['active'] = active.lower() == 'true'
        if expired is not None:
            filters['expired'] = expired.lower() == 'true'
        if type_filter:
            filters['type'] = type_filter
        if search:
            filters['search'] = search
        
        vouchers = vcr.get_vouchers(website_id, filters)
        
        return jsonify({
            'success': True,
            'vouchers': vouchers,
            'count': len(vouchers)
        })
        
    except Exception as e:
        print(f"❌ Error getting vouchers: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>/<int:voucher_id>', methods=['GET'])
def get_voucher(website_id, voucher_id):
    """
    Mendapatkan voucher berdasarkan ID
    """
    try:
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        # Ambil claims
        claims = vcr.get_voucher_claims(voucher_id, limit=100)
        
        return jsonify({
            'success': True,
            'voucher': voucher,
            'claims': claims
        })
        
    except Exception as e:
        print(f"❌ Error getting voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>', methods=['POST'])
def save_voucher(website_id):
    """
    Menyimpan atau update voucher
    """
    try:
        data = request.json
        print(f"📥 Saving voucher for website {website_id}: {data.get('nama')}")
        
        # Validasi data
        if not data.get('kode'):
            return jsonify({'success': False, 'error': 'Kode voucher diperlukan'}), 400
        
        if not data.get('nama'):
            return jsonify({'success': False, 'error': 'Nama voucher diperlukan'}), 400
        
        if not data.get('type'):
            return jsonify({'success': False, 'error': 'Tipe reward diperlukan'}), 400
        
        # Cek kode unik (jika baru atau kode diubah)
        if not data.get('id'):
            existing = vcr.get_voucher_by_code(website_id, data['kode'])
            if existing:
                return jsonify({'success': False, 'error': 'Kode voucher sudah digunakan'}), 400
        
        voucher_id = vcr.save_voucher(website_id, data)
        
        if voucher_id:
            return jsonify({
                'success': True,
                'voucher_id': voucher_id,
                'message': f'Voucher "{data["nama"]}" berhasil disimpan'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal menyimpan voucher'}), 500
            
    except Exception as e:
        print(f"❌ Error saving voucher: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>/<int:voucher_id>', methods=['PUT'])
def update_voucher_status(website_id, voucher_id):
    """
    Update status voucher (active/inactive)
    """
    try:
        data = request.json
        print(f"📥 Updating voucher {voucher_id} status")
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        active = data.get('active')
        expired = data.get('expired')
        
        success = vcr.update_voucher_status(voucher_id, active, expired)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Status voucher diperbarui'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal memperbarui status'}), 500
            
    except Exception as e:
        print(f"❌ Error updating voucher status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>/<int:voucher_id>', methods=['DELETE'])
def delete_voucher(website_id, voucher_id):
    """
    Hapus voucher
    """
    try:
        print(f"📥 Deleting voucher {voucher_id}")
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        success = vcr.delete_voucher(voucher_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Voucher berhasil dihapus'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal menghapus voucher'}), 500
            
    except Exception as e:
        print(f"❌ Error deleting voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>/claims/<int:voucher_id>', methods=['GET'])
def get_voucher_claims(website_id, voucher_id):
    """
    Mendapatkan daftar klaim untuk voucher
    """
    try:
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        claims = vcr.get_voucher_claims(voucher_id, limit, offset)
        
        return jsonify({
            'success': True,
            'claims': claims,
            'count': len(claims)
        })
        
    except Exception as e:
        print(f"❌ Error getting voucher claims: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>/broadcast', methods=['POST'])
def broadcast_voucher(website_id):
    """
    Broadcast voucher ke target tertentu
    """
    try:
        data = request.json
        print(f"📥 Broadcasting voucher: {data.get('voucher_id')}")
        
        voucher_id = data.get('voucher_id')
        target = data.get('target', 'all')
        selected_users = data.get('selected_users', [])
        message = data.get('message')
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        broadcast_id = vcr.save_broadcast(voucher_id, target, selected_users, message)
        
        if broadcast_id:
            return jsonify({
                'success': True,
                'broadcast_id': broadcast_id,
                'message': 'Broadcast berhasil dikirim'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal mengirim broadcast'}), 500
            
    except Exception as e:
        print(f"❌ Error broadcasting voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>/statistics', methods=['GET'])
def get_voucher_statistics(website_id):
    """
    Mendapatkan statistik voucher
    """
    try:
        period = request.args.get('period', 'all')
        
        statistics = vcr.get_statistics(website_id, period)
        top_vouchers = vcr.get_top_vouchers(website_id, 5)
        
        return jsonify({
            'success': True,
            'statistics': statistics,
            'top_vouchers': top_vouchers
        })
        
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/<int:website_id>/activities', methods=['GET'])
def get_voucher_activities(website_id):
    """
    Mendapatkan aktivitas voucher
    """
    try:
        type_filter = request.args.get('type')
        voucher_id = request.args.get('voucher_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        filters = {}
        if type_filter:
            filters['type'] = type_filter
        if voucher_id:
            filters['voucher_id'] = voucher_id
        if start_date:
            filters['start_date'] = start_date
        if end_date:
            filters['end_date'] = end_date
        
        activities = vcr.get_activities(website_id, filters, limit, offset)
        
        return jsonify({
            'success': True,
            'activities': activities,
            'count': len(activities)
        })
        
    except Exception as e:
        print(f"❌ Error getting activities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/claim', methods=['POST'])
def claim_voucher_public():
    """
    Endpoint publik untuk klaim voucher (dari user)
    """
    try:
        data = request.json
        print(f"📥 Claiming voucher: {data.get('kode')}")
        
        website_id = data.get('website_id')
        kode = data.get('kode')
        user_id = data.get('user_id')
        user_username = data.get('username')
        user_name = data.get('name')
        
        if not website_id or not kode or not user_id:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        # Cari voucher berdasarkan kode
        voucher = vcr.get_voucher_by_code(website_id, kode)
        if not voucher:
            return jsonify({'success': False, 'error': 'Voucher tidak ditemukan'}), 404
        
        result = vcr.claim_voucher(voucher['id'], user_id, user_username, user_name)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error claiming voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/use', methods=['POST'])
def use_voucher_public():
    """
    Endpoint publik untuk menggunakan voucher (saat checkout)
    """
    try:
        data = request.json
        print(f"📥 Using voucher claim: {data.get('claim_id')}")
        
        claim_id = data.get('claim_id')
        order_id = data.get('order_id')
        
        if not claim_id:
            return jsonify({'success': False, 'error': 'Claim ID diperlukan'}), 400
        
        result = vcr.use_voucher(claim_id, order_id)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error using voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@vcr_bp.route('/voucher/user/<int:user_id>', methods=['GET'])
def get_user_claims(user_id):
    """
    Mendapatkan semua klaim user
    """
    try:
        website_id = request.args.get('website_id', type=int)
        limit = request.args.get('limit', default=50, type=int)
        
        claims = vcr.get_user_claims(user_id, website_id, limit)
        
        return jsonify({
            'success': True,
            'claims': claims,
            'count': len(claims)
        })
        
    except Exception as e:
        print(f"❌ Error getting user claims: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500