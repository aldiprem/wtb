import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
from db_config import get_db_connection  # Import koneksi MySQL

# Menambahkan direktori root ke path agar modul internal terbaca dengan benar
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Import semua blueprint dari folder services
from services.website_service import website_bp
from services.vcr_service import vcr_bp
from services.pmb_service import pmb_bp
from services.prd_service import prd_bp
from services.ssl_service import ssl_bp
from services.tmp_service import tmp_bp
from services.tmp_font_service import tmp_font_bp
from services.trx_service import trx_bp
from services.users_service import user_bp

base_dir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__, static_folder='.')

# Konfigurasi CORS yang mendukung domain panel Anda
CORS(app, 
     origins=['http://companel.shop', 'https://companel.shop'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['*'],
     supports_credentials=True)

@app.before_request
def before_request():
    """Memastikan skema URL tetap HTTPS saat berada di balik reverse proxy"""
    if request.headers.get('X-Forwarded-Proto') == 'https':
        request.environ['wsgi.url_scheme'] = 'https'
    print(f"📥 {request.method} {request.path} - {request.remote_addr}")

@app.route('/', methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path=None):
    """Menangani preflight request untuk CORS"""
    return app.make_default_options_response()

# Register Semua Blueprints dengan Prefix /api
app.register_blueprint(website_bp, url_prefix='/api')
app.register_blueprint(vcr_bp, url_prefix='/api')
app.register_blueprint(pmb_bp, url_prefix='/api')
app.register_blueprint(prd_bp, url_prefix='/api')
app.register_blueprint(ssl_bp, url_prefix='/api')
app.register_blueprint(tmp_bp, url_prefix='/api')
app.register_blueprint(tmp_font_bp, url_prefix='/api')
app.register_blueprint(trx_bp, url_prefix='/api')
app.register_blueprint(user_bp, url_prefix='/api')

# --- STATIC ROUTES (SERVING HTML) ---

@app.route('/')
@app.route('/dashboard')
def serve_dashboard():
    """Menyediakan halaman dashboard utama"""
    return send_from_directory(os.path.join(base_dir, 'html'), 'dashboard.html')

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/tampilan')
def serve_tampilan_page():
    """Menyediakan halaman pengaturan tampilan dengan pengecekan fallback"""
    html_dir = os.path.join(base_dir, 'html')
    if os.path.exists(os.path.join(html_dir, 'tampilan.html')):
        return send_from_directory(html_dir, 'tampilan.html')
    return send_from_directory(base_dir, 'tampilan.html')

@app.route('/panel')
def serve_main_panel():
    """Menyediakan halaman panel utama"""
    html_dir = os.path.join(base_dir, 'html')
    if os.path.exists(os.path.join(html_dir, 'panel.html')):
        return send_from_directory(html_dir, 'panel.html')
    return send_from_directory(base_dir, 'panel.html')

@app.route('/admins/<string:endpoint>')
def serve_admin_panel(endpoint):
    """Menyediakan panel untuk admin berdasarkan endpoint tertentu"""
    return send_from_directory(os.path.join(base_dir, 'html'), 'panel.html')

@app.route('/website/<string:endpoint>')
def serve_website(endpoint):
    """Menyediakan template utama website"""
    return send_from_directory(base_dir, 'website.html')

# --- RUTE UNTUK FILE STATIS DALAM SUBFOLDER ---

@app.route('/html/<path:subfolder>/<filename>')
def serve_html_subfolder(subfolder, filename):
    """Mengambil file HTML dari subdirektori di dalam /html/"""
    target_dir = os.path.join(base_dir, 'html', subfolder)
    return send_from_directory(target_dir, filename)

@app.route('/html/<filename>')
def serve_html_root(filename):
    """Mengambil file HTML dari root folder /html/"""
    target_dir = os.path.join(base_dir, 'html')
    return send_from_directory(target_dir, filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    """Menyediakan file JavaScript"""
    return send_from_directory(os.path.join(base_dir, 'js'), filename)

@app.route('/css/<path:filename>')
def serve_css(filename):
    """Menyediakan file CSS"""
    return send_from_directory(os.path.join(base_dir, 'css'), filename)

@app.route('/<path:path>')
def serve_static(path):
    """Catch-all route untuk file statis lainnya di root directory"""
    return send_from_directory(base_dir, path)

# --- DATABASE INIT & HEALTH CHECK ---

def init_mysql_tables():
    """Inisialisasi tabel utama MySQL jika belum tersedia"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS websites (
                id INT AUTO_INCREMENT PRIMARY KEY,
                endpoint VARCHAR(255) UNIQUE NOT NULL,
                bot_token TEXT NOT NULL,
                owner_id BIGINT NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        cursor.close()
        conn.close()
        print("✅ MySQL Tables checked/initialized")
    except Exception as e:
        print(f"❌ MySQL Init Error: {e}")

@app.route('/api/health')
def health_check():
    """Endpoint untuk memantau kesehatan server dan koneksi database"""
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({
            'status': 'healthy', 
            'mysql': 'connected', 
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy', 
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Jalankan inisialisasi tabel saat startup
    init_mysql_tables()
    
    PORT = 5050
    print("="*60)
    print(f"🚀 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 Public Domain: https://companel.shop")
    print("📊 Database: MySQL (wtb_database)")
    print("="*60)
    
    # Jalankan Flask app
    app.run(host='0.0.0.0', port=PORT, debug=False)