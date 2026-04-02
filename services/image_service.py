# services/image_service.py - Perbaikan dengan dynamic endpoint parameter

from flask import Blueprint, request, jsonify, send_file, abort
import os
import secrets
import hashlib
from datetime import datetime
from db_config import get_db_connection, IMAGE_BASE_URL

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
    """Generate hash 35 karakter untuk gambar"""
    random_bytes = secrets.token_bytes(20)
    hash_str = hashlib.sha256(random_bytes).hexdigest()
    return hash_str[:35]

def save_image_file(file_data, file_extension):
    """Simpan file gambar ke disk dan return hash"""
    image_hash = generate_image_hash()
    filename = f"{image_hash}.{file_extension}"
    filepath = os.path.join(IMAGE_DIR, filename)
    
    with open(filepath, 'wb') as f:
        f.write(file_data)
    
    # Simpan metadata ke database
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO images (hash, filename, size, created_at)
            VALUES (%s, %s, %s, NOW())
        ''', (image_hash, filename, len(file_data)))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"⚠️ Failed to save image metadata: {e}")
    
    return image_hash

def get_image_path(image_hash):
    """Dapatkan path file dari hash"""
    for ext in ALLOWED_EXTENSIONS:
        filepath = os.path.join(IMAGE_DIR, f"{image_hash}.{ext}")
        if os.path.exists(filepath):
            return filepath
    return None

def get_website_endpoint(website_id):
    """Ambil endpoint website berdasarkan ID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT endpoint FROM websites WHERE id = %s', (website_id,))
        row = cursor.fetchone()
        conn.close()
        return row['endpoint'] if row else None
    except Exception as e:
        print(f"❌ Error getting website endpoint: {e}")
        return None

@image_bp.route('/upload', methods=['POST'])
def upload_image():
    """
    Upload gambar
    Request body: 
        - image: file (form-data)
        - website_id: int (opsional, untuk mengetahui endpoint)
        - website_endpoint: string (opsional, alternatif)
    """
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'success': False, 'error': 'No file selected'}), 400
        
        # Dapatkan endpoint website
        website_endpoint = None
        
        # Coba dari parameter website_endpoint
        if request.form.get('website_endpoint'):
            website_endpoint = request.form.get('website_endpoint')
        # Coba dari website_id
        elif request.form.get('website_id'):
            website_id = int(request.form.get('website_id'))
            website_endpoint = get_website_endpoint(website_id)
        # Coba dari JSON body (jika ada)
        elif request.is_json:
            data = request.get_json()
            if data.get('website_endpoint'):
                website_endpoint = data.get('website_endpoint')
            elif data.get('website_id'):
                website_endpoint = get_website_endpoint(data.get('website_id'))
        
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
        
        # Buat URL dengan endpoint sebagai parameter
        image_url = f"{IMAGE_BASE_URL}{website_endpoint}={image_hash}"
        
        return jsonify({
            'success': True,
            'hash': image_hash,
            'endpoint': website_endpoint,
            'url': image_url
        })
        
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@image_bp.route('/ii', methods=['GET'])
def serve_image():
    """
    Serve gambar berdasarkan parameter endpoint
    URL format: /ii?{endpoint}={hash}
    Contoh: /ii?companel=abc123def456...
    """
    # Ambil semua parameter query
    query_params = request.args
    
    if not query_params:
        abort(404)
    
    # Cari parameter pertama yang bukan standar
    image_hash = None
    endpoint = None
    
    for key, value in query_params.items():
        # Parameter dengan panjang value 35 karakter (hash)
        if len(value) == 35 and value.isalnum():
            image_hash = value
            endpoint = key
            break
    
    if not image_hash:
        abort(404)
    
    filepath = get_image_path(image_hash)
    
    if not filepath:
        abort(404)
    
    # Tentukan mimetype
    ext = filepath.rsplit('.', 1)[-1].lower()
    mimetype = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp'
    }.get(ext, 'application/octet-stream')
    
    return send_file(filepath, mimetype=mimetype)

@image_bp.route('/info/<hash>', methods=['GET'])
def get_image_info(hash):
    """Dapatkan info gambar"""
    filepath = get_image_path(hash)
    if not filepath:
        return jsonify({'success': False, 'error': 'Image not found'}), 404
    
    stat = os.stat(filepath)
    return jsonify({
        'success': True,
        'hash': hash,
        'size': stat.st_size,
        'created': datetime.fromtimestamp(stat.st_ctime).isoformat()
    })