import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime
from db_config import get_db_connection # Import koneksi MySQL

# Import semua blueprint
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

CORS(app, 
     origins=['http://companel.shop', 'https://companel.shop'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['*'],
     supports_credentials=True)

@app.before_request
def before_request():
    if request.headers.get('X-Forwarded-Proto') == 'https':
        request.environ['wsgi.url_scheme'] = 'https'
    print(f"📥 {request.method} {request.path} - {request.remote_addr}")

@app.route('/', methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path=None):
    return app.make_default_options_response()

# Register Blueprints
app.register_blueprint(website_bp, url_prefix='/api')
app.register_blueprint(vcr_bp, url_prefix='/api')
app.register_blueprint(pmb_bp, url_prefix='/api')
app.register_blueprint(prd_bp, url_prefix='/api')
app.register_blueprint(ssl_bp, url_prefix='/api')
app.register_blueprint(tmp_bp, url_prefix='/api')
app.register_blueprint(tmp_font_bp, url_prefix='/api')
app.register_blueprint(trx_bp, url_prefix='/api')
app.register_blueprint(user_bp, url_prefix='/api')

# --- STATIC ROUTES ---
@app.route('/')
def serve_index():
    return send_from_directory(os.path.join(base_dir, 'html'), 'dashboard.html')

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory(os.path.join(base_dir, 'html'), 'dashboard.html')

@app.route('/admins/<string:endpoint>')
def serve_panel(endpoint):
    return send_from_directory(os.path.join(base_dir, 'html'), 'panel.html')

@app.route('/website/<string:endpoint>')
def serve_website(endpoint):
    return send_from_directory(base_dir, 'website.html')

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(base_dir, 'css'), filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(base_dir, 'js'), filename)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(base_dir, path)

@app.route('/tampilan')
def serve_tampilan():
    return send_from_directory('.', 'tampilan.html')

@app.route('/panel')
def serve_panel():
    return send_from_directory('.', 'panel.html')

# --- DATABASE INIT & HEALTH ---
def init_mysql_tables():
    """Inisialisasi tabel utama jika belum ada"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Contoh satu tabel, lakukan hal yang sama untuk tabel lain (users, trx, dll)
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
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({'status': 'healthy', 'mysql': 'connected', 'timestamp': datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

if __name__ == '__main__':
    init_mysql_tables()
    PORT = 5050
    print("="*60)
    print(f"🚀 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 Public Domain: http://companel.shop")
    print("📊 Database: MySQL (wtb_database)")
    print("="*60)
    app.run(host='0.0.0.0', port=PORT, debug=False)