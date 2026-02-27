import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from datetime import datetime

# Import semua blueprint dari service folder
from services.website_service import website_bp
from services.vcr_service import vcr_bp
from services.pmb_service import pmb_bp
from services.prd_service import prd_bp
from services.ssl_service import ssl_bp
from services.tmp_service import tmp_bp
from services.tmp_font_service import tmp_font_bp
from services.trx_service import trx_bp

app = Flask(__name__, static_folder='.')

# Konfigurasi CORS
CORS(app, 
     origins='*',
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['*'],
     supports_credentials=True)

# Middleware untuk menangani proxy headers dari Cloudflare
@app.before_request
def before_request():
    if request.headers.get('X-Forwarded-Proto') == 'https':
        request.environ['wsgi.url_scheme'] = 'https'
    print(f"📥 {request.method} {request.path} - {request.remote_addr}")

# Handler untuk preflight OPTIONS requests
@app.route('/', methods=['OPTIONS'])
@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path=None):
    response = app.make_default_options_response()
    return response

# Register semua blueprint
app.register_blueprint(website_bp, url_prefix='/api')
app.register_blueprint(vcr_bp, url_prefix='/api')
app.register_blueprint(pmb_bp, url_prefix='/api')
app.register_blueprint(prd_bp, url_prefix='/api')
app.register_blueprint(ssl_bp, url_prefix='/api')
app.register_blueprint(tmp_bp, url_prefix='/api')
app.register_blueprint(tmp_font_bp, url_prefix='/api')

# Routes untuk file statis
@app.route('/')
def serve_index():
    return send_from_directory('.', 'html/dashboard.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/website/<string:endpoint>')
def serve_website(endpoint):
    return send_from_directory('.', 'website.html')

@app.route('/panel/<string:endpoint>')
def serve_panel(endpoint):
    return send_from_directory('.', 'html/panel.html')

@app.route('/format')
def serve_format():
    return send_from_directory('.', 'html/format.html')

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory('.', 'html/dashboard.html')

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory('css', filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory('js', filename)

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    try:
        return jsonify({
            'status': 'healthy',
            'database': 'connected',
            'timestamp': datetime.now().isoformat(),
            'scheme': request.scheme,
            'host': request.host
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/debug', methods=['GET'])
def debug_info():
    return jsonify({
        'headers': dict(request.headers),
        'scheme': request.scheme,
        'host': request.host,
        'host_url': request.host_url,
        'path': request.path,
        'full_path': request.full_path,
        'url': request.url,
        'base_url': request.base_url,
        'remote_addr': request.remote_addr,
        'method': request.method
    })

if __name__ == '__main__':
    print("="*60)
    print("🚀 Starting Website Management API Server...")
    print(f"📅 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🔗 API available at: http://localhost:5050")
    print("📊 Databases: website.db, vcr.db, pmb.db, products.db, social.db, tmp.db, tmp_font.db")
    print("="*60)
    print("💡 Gunakan tunnel Cloudflare untuk akses publik:")
    print("   cloudflared tunnel --url http://localhost:5050")
    print("="*60)
    print("📡 Server is running... Press CTRL+C to stop")
    print("="*60)
    app.run(host='0.0.0.0', port=5050, debug=True)