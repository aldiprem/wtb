from flask import Blueprint, request, jsonify, send_file
import tempfile
import os
import base64
import zipfile
import json
import uuid

# Buat blueprint untuk API /tgs
tgs_bp = Blueprint('tgs', __name__, url_prefix='/tgs')

# Konfigurasi
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'tgs'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ==================== API ENDPOINTS ====================

@tgs_bp.route('/api/upload', methods=['POST'])
def api_upload_sticker():
    """
    Upload file .tgs
    Digunakan untuk: upload via drag & drop atau klik
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Only .tgs files allowed'}), 400
    
    try:
        # Simpan ke temp file
        with tempfile.NamedTemporaryFile(suffix='.tgs', delete=False) as f:
            temp_path = f.name
            file.save(temp_path)
        
        # Baca file sebagai base64 untuk dikirim ke frontend
        with open(temp_path, 'rb') as f:
            file_data = base64.b64encode(f.read()).decode('utf-8')
        
        file_size = os.path.getsize(temp_path)
        
        # Hapus temp file setelah dibaca
        os.unlink(temp_path)
        
        return jsonify({
            'success': True,
            'filename': file.filename,
            'size': file_size,
            'size_kb': round(file_size / 1024, 2),
            'data': file_data
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@tgs_bp.route('/api/upload-multiple', methods=['POST'])
def api_upload_multiple_stickers():
    """
    Upload multiple file .tgs sekaligus
    Digunakan untuk: add more stickers
    """
    if 'files' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400
    
    files = request.files.getlist('files')
    results = []
    
    for file in files:
        if file and allowed_file(file.filename):
            try:
                with tempfile.NamedTemporaryFile(suffix='.tgs', delete=False) as f:
                    temp_path = f.name
                    file.save(temp_path)
                
                with open(temp_path, 'rb') as f:
                    file_data = base64.b64encode(f.read()).decode('utf-8')
                
                file_size = os.path.getsize(temp_path)
                os.unlink(temp_path)
                
                results.append({
                    'success': True,
                    'filename': file.filename,
                    'size': file_size,
                    'size_kb': round(file_size / 1024, 2),
                    'data': file_data
                })
            except Exception as e:
                results.append({
                    'success': False,
                    'filename': file.filename,
                    'error': str(e)
                })
    
    return jsonify({
        'success': True,
        'files': results,
        'total': len(results)
    })


@tgs_bp.route('/api/save-composition', methods=['POST'])
def api_save_composition():
    """
    Menyimpan komposisi sticker (posisi, ukuran, rotasi)
    """
    data = request.json
    composition = data.get('composition', {})
    
    try:
        # Generate ID unik untuk session
        session_id = str(uuid.uuid4())
        
        # Simpan komposisi ke temp file JSON
        temp_path = os.path.join(UPLOAD_FOLDER, f'composition_{session_id}.json')
        with open(temp_path, 'w') as f:
            json.dump({
                'session_id': session_id,
                'timestamp': __import__('time').time(),
                'composition': composition
            }, f)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'composition': composition,
            'saved': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@tgs_bp.route('/api/load-composition/<session_id>', methods=['GET'])
def api_load_composition(session_id):
    """
    Load komposisi sticker yang sudah disimpan
    """
    try:
        temp_path = os.path.join(UPLOAD_FOLDER, f'composition_{session_id}.json')
        
        if not os.path.exists(temp_path):
            return jsonify({'error': 'Composition not found'}), 404
        
        with open(temp_path, 'r') as f:
            data = json.load(f)
        
        return jsonify({
            'success': True,
            'composition': data.get('composition', {})
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@tgs_bp.route('/api/export-zip', methods=['POST'])
def api_export_as_zip():
    """
    Export semua sticker sebagai zip file
    """
    data = request.json
    stickers_data = data.get('stickers', [])
    
    if not stickers_data:
        return jsonify({'error': 'No stickers to export'}), 400
    
    zip_path = None
    
    try:
        # Buat zip file sementara
        zip_path = os.path.join(UPLOAD_FOLDER, f'stickers_export_{uuid.uuid4().hex[:8]}.zip')
        
        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for idx, sticker in enumerate(stickers_data):
                if sticker.get('data'):
                    # Decode base64 ke binary
                    file_data = base64.b64decode(sticker['data'])
                    filename = sticker.get('filename', f'sticker_{idx+1}.tgs')
                    zipf.writestr(filename, file_data)
        
        # Kirim file zip
        return send_file(
            zip_path,
            as_attachment=True,
            download_name='stickers_export.zip',
            mimetype='application/zip'
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@tgs_bp.route('/api/sticker-info', methods=['POST'])
def api_get_sticker_info():
    """
    Mendapatkan info sticker dari File ID Telegram
    """
    data = request.json
    file_id = data.get('file_id')
    
    if not file_id:
        return jsonify({'error': 'No file_id provided'}), 400
    
    # Catatan: File ID Telegram perlu diakses via bot token
    # Untuk sekarang return placeholder
    return jsonify({
        'success': True,
        'file_id': file_id,
        'note': 'File ID harus diproses via bot Telegram @fragment_stars_bot',
        'url': f'https://companel.shop/tgs?file_id={file_id}'
    })


@tgs_bp.route('/api/convert-fileid', methods=['POST'])
def api_convert_fileid():
    """
    Konversi File ID Telegram ke file .tgs (integrasi dengan bot)
    """
    data = request.json
    file_id = data.get('file_id')
    bot_token = data.get('bot_token')
    
    if not file_id:
        return jsonify({'error': 'No file_id provided'}), 400
    
    # Ini memerlukan bot token untuk download dari Telegram API
    # Endpoint ini sebagai placeholder untuk integrasi nanti
    return jsonify({
        'success': False,
        'error': 'Feature requires bot integration. Use @fragment_stars_bot on Telegram',
        'file_id': file_id
    }), 501


@tgs_bp.route('/api/cleanup', methods=['POST'])
def api_cleanup():
    """
    Membersihkan temporary files
    """
    data = request.json
    session_id = data.get('session_id')
    
    try:
        if session_id:
            temp_path = os.path.join(UPLOAD_FOLDER, f'composition_{session_id}.json')
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        
        return jsonify({'success': True, 'message': 'Cleanup completed'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== HEALTH CHECK ====================

@tgs_bp.route('/api/health', methods=['GET'])
def api_health_check():
    """Cek status API service"""
    return jsonify({
        'status': 'running',
        'service': 'TGS Sticker API Service',
        'version': '1.0.0',
        'endpoints': [
            'POST /tgs/api/upload',
            'POST /tgs/api/upload-multiple',
            'POST /tgs/api/save-composition',
            'GET  /tgs/api/load-composition/<session_id>',
            'POST /tgs/api/export-zip',
            'POST /tgs/api/sticker-info',
            'POST /tgs/api/convert-fileid',
            'POST /tgs/api/cleanup',
            'GET  /tgs/api/health'
        ]
    })