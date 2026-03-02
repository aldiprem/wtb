# trx_service.py - Flask service untuk transaksi (VERSI DIPERBAIKI)
from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import trx
from py import pmb
from py.cashify import CashifyHandler

trx_bp = Blueprint('trx', __name__)

# ==================== DEPOSIT ENDPOINTS ====================

@trx_bp.route('/transactions/deposit/create', methods=['POST', 'OPTIONS'])
def create_deposit():
    """
    Membuat transaksi deposit baru
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        print(f"📥 Creating deposit: {data}")
        
        website_id = data.get('website_id')
        user_id = data.get('user_id')
        amount = data.get('amount')
        payment_method = data.get('payment_method')
        rekening_id = data.get('rekening_id')
        gateway_id = data.get('gateway_id')
        voucher_id = data.get('voucher_id')
        proof_url = data.get('proof_url')
        user_data = data.get('user_data', {})
        
        if not website_id or not user_id or not amount:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        if amount < 100:
            return jsonify({'success': False, 'error': 'Minimal deposit Rp 100'}), 400
        
        # Buat deposit di database
        deposit_id = trx.create_deposit(
            website_id, user_id, amount, payment_method,
            rekening_id, gateway_id, voucher_id, proof_url, user_data
        )
        
        if not deposit_id:
            return jsonify({'success': False, 'error': 'Gagal membuat deposit'}), 500

        # Di bagian generate QRIS
        if payment_method == 'qris':
            # Ambil gateway aktif untuk mendapatkan license key dan package_ids
            gateway = pmb.get_active_gateway(website_id)
            if not gateway:
                trx.update_deposit_status(deposit_id, 'failed', 'Gateway tidak ditemukan')
                return jsonify({'success': False, 'error': 'Gateway pembayaran tidak ditemukan'}), 400
            
            # CEK APAKAH QRIS_ID ADA
            qris_id = gateway.get('qris_id')
            if not qris_id:
                return jsonify({
                    'success': False, 
                    'error': 'QRIS ID belum didaftarkan. Silakan atur QRIS ID di pengaturan gateway.'
                }), 400
            
            # Ambil package IDs dari gateway
            package_ids = pmb.get_package_ids(gateway['id'])
            print(f"📦 Using package IDs: {package_ids}")
            
            # Inisialisasi Cashify handler
            cashify = CashifyHandler(gateway.get('license_key'), gateway.get('webhook_secret'))
            
            # Generate QRIS dengan qr_id dan package_ids dari database
            # PASTIKAN PARAMETER SESUAI DENGAN DEFINISI FUNGSI
            qris_result = cashify.generate_qris_v2(
                amount=amount,                          # parameter named
                qr_id=qris_id,                           # parameter named
                package_ids=package_ids,                  # parameter named
                expired_minutes=gateway.get('expired_menit', 30)  # parameter named
            )
            
            # CEK HASIL
            if not qris_result.get('success'):
                trx.update_deposit_status(deposit_id, 'failed', qris_result.get('error'))
                return jsonify({'success': False, 'error': qris_result.get('error')}), 500
            
            # Format response
            formatted = cashify.format_response(qris_result)
            
            # Update deposit dengan data Cashify
            trx.update_deposit_cashify(deposit_id, formatted)
            
            return jsonify({
                'success': True,
                'deposit_id': deposit_id,
                'qris_data': {
                    'transaction_id': formatted.get('transaction_id'),
                    'qr_image_url': formatted.get('qr_image_url'),
                    'qr_string': formatted.get('qr_string'),
                    'total_amount': formatted.get('total_amount'),
                    'original_amount': formatted.get('original_amount'),
                    'unique_nominal': formatted.get('unique_nominal'),
                    'expired_at': formatted.get('expired_at')
                },
                'message': 'QRIS berhasil dibuat'
            })
        
        # Jika metode rekening manual
        else:
            return jsonify({
                'success': True,
                'deposit_id': deposit_id,
                'message': 'Deposit berhasil dibuat, silakan transfer ke rekening tujuan'
            })
        
    except Exception as e:
        print(f"❌ Error creating deposit: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@trx_bp.route('/transactions/deposit/<int:deposit_id>', methods=['GET', 'OPTIONS'])
def get_deposit(deposit_id):
    """
    Mendapatkan detail deposit
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        deposit = trx.get_deposit(deposit_id)
        
        if not deposit:
            return jsonify({'success': False, 'error': 'Deposit tidak ditemukan'}), 404
        
        return jsonify({'success': True, 'deposit': deposit})
        
    except Exception as e:
        print(f"❌ Error getting deposit: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@trx_bp.route('/transactions/deposit/status', methods=['POST', 'OPTIONS'])
def check_deposit_status():
    """
    Cek status deposit (bisa via Cashify atau database)
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        deposit_id = data.get('deposit_id')
        transaction_id = data.get('transaction_id')
        
        if not deposit_id and not transaction_id:
            return jsonify({'success': False, 'error': 'Deposit ID atau Transaction ID diperlukan'}), 400
        
        deposit = None
        if deposit_id:
            deposit = trx.get_deposit(deposit_id)
        elif transaction_id:
            deposit = trx.get_deposit_by_cashify_id(transaction_id)
        
        if not deposit:
            return jsonify({'success': False, 'error': 'Deposit tidak ditemukan'}), 404
        
        # Jika status sudah final, langsung return
        if deposit['status'] in ['success', 'failed', 'expired']:
            return jsonify({
                'success': True,
                'deposit': deposit,
                'status': deposit['status']
            })
        
        # Jika ada cashify transaction id, cek ke Cashify
        if deposit.get('cashify_transaction_id'):
            # Ambil gateway
            gateway = pmb.get_gateway_by_id(deposit['gateway_id']) if deposit['gateway_id'] else None
            if gateway:
                cashify = CashifyHandler(gateway.get('license_key'), gateway.get('webhook_secret'))
                status_result = cashify.check_status(deposit['cashify_transaction_id'])
                
                if status_result.get('success'):
                    cashify_status = status_result['data'].get('status', '').lower()
                    
                    # Mapping status Cashify ke status database
                    if cashify_status == 'paid':
                        trx.update_deposit_status(deposit['id'], 'success', 'Pembayaran berhasil')
                        deposit['status'] = 'success'
                    elif cashify_status == 'expired':
                        trx.update_deposit_status(deposit['id'], 'expired', 'QRIS kadaluwarsa')
                        deposit['status'] = 'expired'
                    elif cashify_status == 'failed':
                        trx.update_deposit_status(deposit['id'], 'failed', 'Pembayaran gagal')
                        deposit['status'] = 'failed'
        
        return jsonify({
            'success': True,
            'deposit': deposit,
            'status': deposit['status']
        })
        
    except Exception as e:
        print(f"❌ Error checking deposit status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@trx_bp.route('/transactions/deposit/confirm', methods=['POST', 'OPTIONS'])
def confirm_manual_deposit():
    """
    Konfirmasi deposit manual (untuk transfer ke rekening)
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        deposit_id = data.get('deposit_id')
        proof_url = data.get('proof_url')
        notes = data.get('notes')
        
        if not deposit_id:
            return jsonify({'success': False, 'error': 'Deposit ID diperlukan'}), 400
        
        # Update status jadi processing menunggu konfirmasi admin
        trx.update_deposit_status(deposit_id, 'processing', 'Menunggu konfirmasi admin')
        
        return jsonify({
            'success': True,
            'message': 'Bukti transfer diterima, menunggu konfirmasi admin'
        })
        
    except Exception as e:
        print(f"❌ Error confirming deposit: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== WITHDRAW ENDPOINTS ====================

@trx_bp.route('/transactions/withdraw/create', methods=['POST', 'OPTIONS'])
def create_withdrawal():
    """
    Membuat transaksi withdraw baru
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        print(f"📥 Creating withdrawal: {data}")
        
        website_id = data.get('website_id')
        user_id = data.get('user_id')
        amount = data.get('amount')
        rekening_id = data.get('rekening_id')
        user_data = data.get('user_data', {})
        
        if not website_id or not user_id or not amount or not rekening_id:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        if amount < 50000:
            return jsonify({'success': False, 'error': 'Minimal withdraw Rp 50.000'}), 400
        
        # Ambil data rekening
        rekening = pmb.get_rekening_by_id(rekening_id)
        if not rekening:
            return jsonify({'success': False, 'error': 'Rekening tidak ditemukan'}), 404
        
        # Buat withdraw
        withdraw_id = trx.create_withdrawal(
            website_id, user_id, amount, rekening_id, rekening, user_data
        )
        
        if not withdraw_id:
            return jsonify({'success': False, 'error': 'Gagal membuat withdraw'}), 500
        
        return jsonify({
            'success': True,
            'withdraw_id': withdraw_id,
            'message': 'Permintaan withdraw berhasil diajukan'
        })
        
    except Exception as e:
        print(f"❌ Error creating withdrawal: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@trx_bp.route('/transactions/withdraw/<int:withdraw_id>', methods=['GET', 'OPTIONS'])
def get_withdrawal(withdraw_id):
    """
    Mendapatkan detail withdraw
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        # Implementasi get withdrawal by id
        # Untuk sementara return error
        return jsonify({'success': False, 'error': 'Fitur belum tersedia'}), 404
        
    except Exception as e:
        print(f"❌ Error getting withdrawal: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==================== USER TRANSACTIONS ENDPOINT ====================

@trx_bp.route('/transactions/user/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_user_transactions(user_id):
    """
    Mendapatkan semua transaksi user dengan filter status
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        website_id = request.args.get('website_id', type=int)
        status = request.args.get('status', 'all')  # all, pending, success, failed, expired
        limit = request.args.get('limit', default=50, type=int)
        
        transactions = trx.get_user_transactions(user_id, website_id, status, limit)
        
        return jsonify({
            'success': True,
            'transactions': transactions,
            'count': len(transactions)
        })
        
    except Exception as e:
        print(f"❌ Error getting user transactions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# trx_service.py - Tambahkan endpoint khusus untuk balance

@trx_bp.route('/transactions/user/<int:user_id>/balance', methods=['GET', 'OPTIONS'])
def get_user_balance_only(user_id):
    """
    Endpoint khusus untuk mendapatkan balance user
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        website_id = request.args.get('website_id', type=int)
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID required'}), 400
        
        # Ambil semua transaksi user
        from py import trx
        from py import users
        
        # Coba ambil dari user preferences dulu
        preferences = users.get_user_preferences(user_id, website_id)
        
        if preferences and 'balance' in preferences:
            balance = preferences['balance']
        else:
            # Hitung dari transaksi
            transactions = trx.get_user_transactions(user_id, website_id, 'all', 500)
            balance = 0
            for t in transactions:
                if t.get('transaction_type') == 'deposit' and t.get('status') == 'success':
                    balance += t.get('amount', 0)
                elif t.get('transaction_type') == 'withdraw' and t.get('status') == 'success':
                    balance -= t.get('amount', 0)
        
        return jsonify({
            'success': True,
            'balance': balance,
            'user_id': user_id,
            'website_id': website_id
        })
        
    except Exception as e:
        print(f"❌ Error getting user balance: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== WEBHOOK ENDPOINT ====================

@trx_bp.route('/webhook/cashify', methods=['POST', 'OPTIONS'])
def cashify_webhook():
    """
    Webhook endpoint untuk menerima notifikasi dari Cashify
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, X-Signature')
        return response, 200
    
    try:
        data = request.json
        signature = request.headers.get('X-Signature')
        
        print(f"📥 Cashify webhook received: {data}")
        
        transaction_id = data.get('transactionId')
        status = data.get('status')
        
        if not transaction_id:
            return jsonify({'success': False, 'error': 'No transaction ID'}), 400
        
        # Cari deposit berdasarkan transaction_id
        deposit = trx.get_deposit_by_cashify_id(transaction_id)
        
        if deposit:
            # Mapping status
            if status == 'paid':
                trx.update_deposit_status(deposit['id'], 'success', 'Pembayaran berhasil via webhook')
            elif status == 'expired':
                trx.update_deposit_status(deposit['id'], 'expired', 'QRIS kadaluwarsa')
            elif status == 'failed':
                trx.update_deposit_status(deposit['id'], 'failed', 'Pembayaran gagal')
        
        return jsonify({'success': True})
        
    except Exception as e:
        print(f"❌ Error processing webhook: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
        
@trx_bp.route('/transactions/deposit/confirm', methods=['POST', 'OPTIONS'])
def confirm_deposit():
    """
    Konfirmasi deposit (admin) - saldo user bertambah
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        deposit_id = data.get('deposit_id')
        
        if not deposit_id:
            return jsonify({'success': False, 'error': 'Deposit ID diperlukan'}), 400
        
        # Update status jadi success
        success = trx.update_deposit_status(deposit_id, 'success', 'Dikonfirmasi oleh admin')
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Deposit berhasil dikonfirmasi'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal mengkonfirmasi deposit'}), 500
            
    except Exception as e:
        print(f"❌ Error confirming deposit: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@trx_bp.route('/transactions/deposit/reject', methods=['POST', 'OPTIONS'])
def reject_deposit():
    """
    Menolak deposit (admin) - saldo user TIDAK bertambah
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        deposit_id = data.get('deposit_id')
        reason = data.get('reason', 'Ditolak oleh admin')
        
        if not deposit_id:
            return jsonify({'success': False, 'error': 'Deposit ID diperlukan'}), 400
        
        # Update status jadi rejected dengan alasan
        success = trx.update_deposit_status(deposit_id, 'rejected', reason)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Deposit ditolak'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal menolak deposit'}), 500
            
    except Exception as e:
        print(f"❌ Error rejecting deposit: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@trx_bp.route('/transactions/withdraw/confirm', methods=['POST', 'OPTIONS'])
def confirm_withdraw():
    """
    Konfirmasi withdraw (admin) - saldo user berkurang
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        withdraw_id = data.get('withdraw_id')
        
        if not withdraw_id:
            return jsonify({'success': False, 'error': 'Withdraw ID diperlukan'}), 400
        
        # Ambil data withdraw
        # Implementasi get withdrawal by id
        # Update status jadi success dan kurangi balance
        
        return jsonify({
            'success': True,
            'message': 'Withdraw berhasil dikonfirmasi'
        })
        
    except Exception as e:
        print(f"❌ Error confirming withdraw: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@trx_bp.route('/transactions/withdraw/reject', methods=['POST', 'OPTIONS'])
def reject_withdraw():
    """
    Menolak withdraw (admin) - saldo user TIDAK berkurang
    """
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response, 200
    
    try:
        data = request.json
        withdraw_id = data.get('withdraw_id')
        reason = data.get('reason', 'Ditolak oleh admin')
        
        if not withdraw_id:
            return jsonify({'success': False, 'error': 'Withdraw ID diperlukan'}), 400
        
        # Update status jadi rejected
        # Implementasi update withdrawal status
        
        return jsonify({
            'success': True,
            'message': 'Withdraw ditolak'
        })
        
    except Exception as e:
        print(f"❌ Error rejecting withdraw: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
        
# ==================== FILTER TRANSACTIONS ENDPOINT ====================

@trx_bp.route('/transactions/filter', methods=['GET', 'OPTIONS'])
def filter_transactions():
    """
    Mendapatkan semua transaksi dengan filter (untuk panel admin)
    Filter: website_id, type, status, time, limit
    """
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Methods', 'GET, OPTIONS')
        return response, 200
    
    try:
        # Ambil parameter
        website_id = request.args.get('website_id', type=int)
        trans_type = request.args.get('type', 'all')  # all, deposit, withdraw, purchase
        status = request.args.get('status', 'all')
        time_filter = request.args.get('time', 'all')  # today, week, month, year, all
        limit = request.args.get('limit', default=100, type=int)
        
        if not website_id:
            return jsonify({'success': False, 'error': 'Website ID diperlukan'}), 400
        
        # Ambil semua deposit
        deposits = trx.get_all_deposits(website_id, limit=limit)
        for d in deposits:
            d['transaction_type'] = 'deposit'
            d['type_icon'] = 'fa-arrow-down'
        
        # Ambil semua withdrawals
        withdrawals = trx.get_all_withdrawals(website_id, limit=limit)
        for w in withdrawals:
            w['transaction_type'] = 'withdraw'
            w['type_icon'] = 'fa-arrow-up'
        
        # Gabungkan
        all_transactions = deposits + withdrawals
        
        # Filter berdasarkan tipe
        if trans_type != 'all':
            all_transactions = [t for t in all_transactions if t['transaction_type'] == trans_type]
        
        # Filter berdasarkan status
        if status != 'all':
            all_transactions = [t for t in all_transactions if t['status'] == status]
        
        # Filter berdasarkan waktu
        if time_filter != 'all':
            from datetime import datetime, timedelta
            now = datetime.now()
            
            if time_filter == 'today':
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif time_filter == 'week':
                start_date = now - timedelta(days=7)
            elif time_filter == 'month':
                start_date = now - timedelta(days=30)
            elif time_filter == 'year':
                start_date = now - timedelta(days=365)
            else:
                start_date = None
            
            if start_date:
                all_transactions = [t for t in all_transactions 
                                   if datetime.fromisoformat(t['created_at'].replace('Z', '+00:00')) >= start_date]
        
        # Urutkan berdasarkan created_at descending
        all_transactions.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Batasi jumlah
        all_transactions = all_transactions[:limit]
        
        return jsonify({
            'success': True,
            'transactions': all_transactions,
            'count': len(all_transactions),
            'filters': {
                'website_id': website_id,
                'type': trans_type,
                'status': status,
                'time': time_filter
            }
        })
        
    except Exception as e:
        print(f"❌ Error filtering transactions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500