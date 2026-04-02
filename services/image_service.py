# services/image_service.py
from flask import Blueprint, request, jsonify, send_file, abort
import os
import secrets
import hashlib
from datetime import datetime
from db_config import get_db_connection

image_bp = Blueprint('image', __name__)

# Konfigurasi
IMAGE_DIR = '/var/www/images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024

def init_image_dir():
    if not os.path.exists(IMAGE_DIR):
        os.makedirs(IMAGE_DIR, mode=0o755, exist_ok=True)
        print(f"✅ Created image directory: {IMAGE_DIR}")

def generate_image_hash():
    random_bytes = secrets.token_bytes(20)
    hash_str = hashlib.sha256(random_bytes).hexdigest()
    return hash_str[:35]

def save_image_file(file_data, file_extension):
    image_hash = generate_image_hash()
    filename = f"{image_hash}.{file_extension}"
    filepath = os.path.join(IMAGE_DIR, filename)
    
    with open(filepath, 'wb') as f:
        f.write(file_data)
    
    return image_hash

def delete_image_file(image_hash):
    """
    Menghapus file gambar berdasarkan hash
    Returns: True jika berhasil dihapus, False jika file tidak ditemukan
    """
    if not image_hash or len(image_hash) != 35:
        return False
    
    deleted = False
    for ext in ALLOWED_EXTENSIONS:
        filepath = os.path.join(IMAGE_DIR, f"{image_hash}.{ext}")
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                print(f"🗑️ Deleted old image file: {filepath}")
                deleted = True
            except Exception as e:
                print(f"⚠️ Failed to delete old image: {e}")
    
    # Hapus juga metadata dari database jika ada
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM images WHERE hash = %s', (image_hash,))
        conn.commit()
        conn.close()
        print(f"🗑️ Deleted image metadata for hash: {image_hash}")
    except Exception as e:
        print(f"⚠️ Failed to delete image metadata: {e}")
    
    return deleted

@image_bp.route('/upload', methods=['POST'])
def upload_image():
    """Upload gambar ke server"""
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Dapatkan endpoint website
        website_endpoint = request.form.get('website_endpoint')
        
        if not website_endpoint:
            return jsonify({'success': False, 'error': 'Website endpoint required'}), 400
        
        # Cek ekstensi
        ext = file.filename.rsplit('.', 1)[-1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({'success': False, 'error': f'Format tidak didukung. Gunakan: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        # Baca file
        file_data = file.read()
        
        # Cek ukuran
        if len(file_data) > MAX_FILE_SIZE:
            return jsonify({'success': False, 'error': 'File terlalu besar. Maksimal 5MB'}), 400
        
        # Simpan file
        image_hash = save_image_file(file_data, ext)
        
        # Buat URL
        image_url = f"https://companel.shop/ii?{website_endpoint}={image_hash}"
        
        return jsonify({
            'success': True,
            'hash': image_hash,
            'endpoint': website_endpoint,
            'url': image_url
        })
        
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def serve_image():
    """Fungsi untuk serving gambar (bisa dipanggil dari route manapun)"""
    from flask import request, send_file, abort
    import os
    
    query_params = request.args
    
    if not query_params:
        abort(404)
    
    image_hash = None
    for key, value in query_params.items():
        if len(value) == 35 and value.isalnum():
            image_hash = value
            break
    
    if not image_hash:
        abort(404)
    
    IMAGE_DIR = '/var/www/images'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
    
    for ext in ALLOWED_EXTENSIONS:
        filepath = os.path.join(IMAGE_DIR, f"{image_hash}.{ext}")
        if os.path.exists(filepath):
            mimetype = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'webp': 'image/webp'
            }.get(ext, 'application/octet-stream')
            return send_file(filepath, mimetype=mimetype)
    
    abort(404)