#!/usr/bin/env python3
import os
import sys
import time
import ipaddress
import secrets
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort, redirect
from flask_cors import CORS
from collections import defaultdict, Counter
import logging
import requests
import sqlite3
import sys

# ==================== INTEGRASI JASEB USERBOT MANAGER ====================

JASEB_DIR = '/root/jaseb'
JASEB_DB_PATH = os.path.join(JASEB_DIR, 'jaseb.db')
if JASEB_DIR not in sys.path:
    sys.path.insert(0, JASEB_DIR)

# Menambahkan direktori root ke path
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT_DIR)

# Import semua blueprint dari folder services (dengan error handling)
website_bp = None
vcr_bp = None
pmb_bp = None
prd_bp = None
ssl_bp = None
tmp_bp = None
tmp_font_bp = None
trx_bp = None
user_bp = None
image_bp = None
frag_bp = None
tgs_bp = None
gift_scanned_bp = None
plinko_bp = None
giveaway_bp = None
crash_bp = None
games_bp = None
create_bp = None
winedash_bp = None
offers_bp = None
auctions_bp = None
debug_bp = None
admin_bp = None
market_bp = None
scam_bp = None
cek_ip_bp = None

try:
    from services.website_service import website_bp
    print("✅ website_service imported")
except ImportError as e:
    print(f"⚠️ website_service skipped: {e}")

try:
    from services.vcr_service import vcr_bp
    print("✅ vcr_service imported")
except ImportError as e:
    print(f"⚠️ vcr_service skipped: {e}")

try:
    from services.pmb_service import pmb_bp
    print("✅ pmb_service imported")
except ImportError as e:
    print(f"⚠️ pmb_service skipped: {e}")

try:
    from services.prd_service import prd_bp
    print("✅ prd_service imported")
except ImportError as e:
    print(f"⚠️ prd_service skipped: {e}")

try:
    from services.ssl_service import ssl_bp
    print("✅ ssl_service imported")
except ImportError as e:
    print(f"⚠️ ssl_service skipped: {e}")

try:
    from services.tmp_service import tmp_bp
    print("✅ tmp_service imported")
except ImportError as e:
    print(f"⚠️ tmp_service skipped: {e}")

try:
    from services.tmp_font_service import tmp_font_bp
    print("✅ tmp_font_service imported")
except ImportError as e:
    print(f"⚠️ tmp_font_service skipped: {e}")

try:
    from services.trx_service import trx_bp
    print("✅ trx_service imported")
except ImportError as e:
    print(f"⚠️ trx_service skipped: {e}")

try:
    from services.users_service import user_bp
    print("✅ users_service imported")
except ImportError as e:
    print(f"⚠️ users_service skipped: {e}")

try:
    from services.image_service import image_bp
    print("✅ image_service imported")
except ImportError as e:
    print(f"⚠️ image_service skipped: {e}")

try:
    from services.frag_service import frag_bp
    print("✅ frag_service imported")
except ImportError as e:
    print(f"⚠️ frag_service skipped: {e}")

try:
    from services.tgs_service import tgs_bp
    print("✅ tgs_service imported")
except ImportError as e:
    print(f"⚠️ tgs_service skipped: {e}")

try:
    from games.services.games_plinko_service import plinko_bp
    print("✅ games_plinko_service imported")
except ImportError as e:
    print(f"⚠️ games_plinko_service skipped: {e}")

try:
    from giveaway.services.giveaway_service import giveaway_bp
    print("✅ giveaway_service imported")
except ImportError as e:
    print(f"⚠️ giveaway_service first attempt failed: {e}")
    try:
        import importlib.util as _ilu
        _gsvc_path = os.path.join(ROOT_DIR, "giveaway", "services", "giveaway_service.py")
        if os.path.exists(_gsvc_path):
            _spec = _ilu.spec_from_file_location("giveaway_service", _gsvc_path)
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            giveaway_bp = _mod.giveaway_bp
            print("✅ giveaway_service imported via spec")
        else:
            print(f"⚠️ giveaway_service not found at {_gsvc_path}")
            giveaway_bp = None
    except Exception as e2:
        print(f"⚠️ giveaway_service skipped: {e2}")
        giveaway_bp = None

try:
    from services.crash_service import crash_bp
    print("✅ crash_service imported")
except ImportError as e:
    print(f"⚠️ crash_service skipped: {e}")

try:
    from games.services.games_service import games_bp
    print("✅ games_service imported")
except ImportError as e:
    print(f"⚠️ games_service skipped: {e}")

try:
    from giveaway.services.create_service import create_bp, set_bot_client
    print("✅ create_service imported")
except ImportError as e:
    print(f"⚠️ create_service first attempt failed: {e}")
    try:
        import importlib.util as _ilu
        _csvc_path = os.path.join(ROOT_DIR, "giveaway", "services", "create_service.py")
        if os.path.exists(_csvc_path):
            _spec = _ilu.spec_from_file_location("create_service", _csvc_path)
            _mod = _ilu.module_from_spec(_spec)
            _spec.loader.exec_module(_mod)
            create_bp = _mod.create_bp
            set_bot_client = _mod.set_bot_client
            print("✅ create_service imported via spec")
        else:
            print(f"⚠️ create_service not found at {_csvc_path}")
            create_bp = None
            set_bot_client = None
    except Exception as e2:
        print(f"⚠️ create_service skipped: {e2}")
        create_bp = None
        set_bot_client = None

try:
    from winedash.services.web_service import winedash_bp
    print("✅ winedash_web_service imported")
except ImportError as e:
    print(f"⚠️ winedash_web_service skipped: {e}")

try:
    from winedash.services.offers_service import offers_bp
    print("✅ offers_service imported")
except ImportError as e:
    print(f"⚠️ offers_service skipped: {e}")

try:
    from winedash.services.auctions_service import auctions_bp
    print("✅ auctions_service imported")
except ImportError as e:
    print(f"⚠️ auctions_service skipped: {e}")

try:
    from winedash.services.debug_service import debug_bp
    print("✅ debug_service imported")
except ImportError as e:
    print(f"⚠️ debug_service skipped: {e}")

try:
    from winedash.services.admin_service import admin_bp
    print("✅ admin_service imported")
except ImportError as e:
    print(f"⚠️ admin_service skipped: {e}")

try:
    from winedash.services.market_service import market_bp
    print("✅ market_service imported")
except ImportError as e:
    print(f"⚠️ market_service skipped: {e}")

try:
    from giveaway.services.battle_service import battle_bp
    print("✅ battle_service imported")
except ImportError as e:
    print(f"⚠️ battle_service skipped: {e}")

try:
    from services.source_code_service import get_winedash_source_logic
    print("✅ source_code_service imported")
except ImportError as e:
    print(f"⚠️ source_code_service skipped: {e}")
    def get_winedash_source_logic():
        return "<p>Source code viewer temporarily unavailable</p>"

try:
    from scamaction.services.data_service import scam_bp
    print("✅ scamaction.data_service imported")
except ImportError as e:
    print(f"⚠️ scamaction.data_service skipped: {e}")

try:
    from giveaway.services.cek_ip_service import cek_ip_bp
    print("✅ cek_ip_service imported")
except ImportError as e:
    print(f"⚠️ cek_ip_service skipped: {e}")

try:
    from services.gift_scanned_service import gift_scanned_bp
    print("✅ gift_scanned_service imported")
except ImportError as e:
    print(f"⚠️ gift_scanned_service import error: {e}")
    try:
        import importlib.util
        gift_scanned_path = os.path.join(ROOT_DIR, 'services', 'gift_scanned_service.py')
        if os.path.exists(gift_scanned_path):
            spec = importlib.util.spec_from_file_location("gift_scanned_service", gift_scanned_path)
            gift_scanned_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(gift_scanned_module)
            gift_scanned_bp = gift_scanned_module.gift_scanned_bp
            print("✅ gift_scanned_service imported via spec")
        else:
            print(f"⚠️ gift_scanned_service file not found at {gift_scanned_path}")
            gift_scanned_bp = None
    except Exception as e2:
        print(f"⚠️ gift_scanned_service second import failed: {e2}")
        gift_scanned_bp = None

try:
    import sys
    sys.path.insert(0, '/root/wtb')
    from services.jaseb.panel_service import panel_bp
    print("✅ panel_service imported from /root/wtb/services/jaseb/")
except ImportError as e:
    print(f"⚠️ panel_service import error: {e}")
    panel_bp = None

try:
    from tracker.services.data_tracker_service import data_tracker_bp
    print("✅ data_tracker_service imported")
except ImportError as e:
    print(f"⚠️ data_tracker_service skipped: {e}")
    data_tracker_bp = None

base_dir = os.path.abspath(os.path.dirname(__file__))

# Pastikan sub-path giveaway bisa di-import
_giveaway_dir = os.path.join(base_dir, 'giveaway')
if _giveaway_dir not in sys.path:
    sys.path.insert(0, _giveaway_dir)
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ==================== KONFIGURASI KEAMANAN ====================

RATE_LIMIT_CONFIG = {
    'default': {'requests': 60, 'window': 60},
    'api': {'requests': 120, 'window': 60},
    'static': {'requests': 30, 'window': 60},
    'strict': {'requests': 10, 'window': 60},
}

CRITICAL_BLOCKED_PATHS = [
    'wp-admin', 'wp-content', 'wp-includes', 'wordpress',
    'lander', 'sberbank', 'quiz', 'setup-config',
    'HNAP1', 'solr', 'cgi-bin', 'evox', 'sdk',
    'v2/_catalog', 'query', 'odinhttpcall',
    '.env', '.git', 'config.php', 'xmlrpc.php'
]

SUSPICIOUS_PATHS = [
    '/admin', '/login', '/backup', '/dump', '/sql',
    '/phpmyadmin', '/pma', '/mysql', '/db',
    '/shell', '/cmd', '/exec', '/system'
]

SUSPICIOUS_IP_RANGES = [
    '164.90.0.0/16', '64.225.0.0/16', '167.71.0.0/16',
    '209.38.0.0/16', '104.248.0.0/16', '45.55.0.0/16',
    '159.89.0.0/16', '138.68.0.0/16',
]

SUSPICIOUS_USER_AGENTS = [
    'nikto', 'sqlmap', 'masscan', 'nmap', 'wpscan',
    'python-requests', 'curl', 'wget', 'Go-http-client',
    'Mozilla/5.0 (compatible; Nmap Scripting Engine)',
    'ZmEu', 'Morfeus', 'Fucking Scanner'
]

request_counts = defaultdict(list)
attack_stats = defaultdict(lambda: {'count': 0, 'paths': Counter(), 'last_seen': 0})

# ==================== FUNGSI UTILITY KEAMANAN ====================

def is_cloudflare_ip(ip):
    cloudflare_ranges = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22',
        '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18',
        '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22',
        '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
        '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'
    ]
    try:
        ip_obj = ipaddress.ip_address(ip)
        for range_str in cloudflare_ranges:
            if ip_obj in ipaddress.ip_network(range_str):
                return True
    except:
        pass
    return False

def is_ip_blocked(ip):
    if is_cloudflare_ip(ip):
        return False
    if ip in ['127.0.0.1', 'localhost']:
        return False
    try:
        ip_obj = ipaddress.ip_address(ip)
        for range_str in SUSPICIOUS_IP_RANGES:
            if ip_obj in ipaddress.ip_network(range_str):
                return True
    except:
        pass
    return False

def is_suspicious_user_agent():
    user_agent = request.headers.get('User-Agent', '')
    user_agent_lower = user_agent.lower()
    for bad_ua in SUSPICIOUS_USER_AGENTS:
        if bad_ua.lower() in user_agent_lower:
            return True, bad_ua
    return False, None

def track_attack(ip, path):
    attack_stats[ip]['count'] += 1
    attack_stats[ip]['paths'][path] += 1
    attack_stats[ip]['last_seen'] = int(time.time())

# ==================== INISIALISASI FLASK APP ====================

app = Flask(__name__, static_folder='.')
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

CORS(app, 
     origins=['http://companel.shop', 'https://companel.shop', 
              'http://localhost:5050', 'http://127.0.0.1:5050',
              'http://207.180.194.191:5050'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['*'],
     supports_credentials=True)

# ==================== MIDDLEWARE KEAMANAN ====================

@app.before_request
def security_middleware():
    client_ip = request.remote_addr
    path = request.path
    method = request.method
    
    path_lower = path.lower()
    for bad_path in CRITICAL_BLOCKED_PATHS:
        if bad_path in path_lower:
            track_attack(client_ip, path)
            print(f"🚫 CRITICAL BLOCK: {method} {path} from {client_ip}")
            abort(404)
    
    if not is_cloudflare_ip(client_ip):
        if is_ip_blocked(client_ip):
            track_attack(client_ip, path)
            print(f"🚫 IP BLOCKED: {client_ip} from {path}")
            abort(403)
    
    is_suspicious, bad_ua = is_suspicious_user_agent()
    if is_suspicious and not path.startswith('/api/'):
        track_attack(client_ip, path)
        print(f"⚠️ SUSPICIOUS UA: {client_ip} -> {bad_ua} on {path}")
    
    current_time = time.time()
    
    if path.startswith('/api/'):
        limit_config = RATE_LIMIT_CONFIG['api']
    elif path.startswith(('/css/', '/js/', '/html/', '/static/', '/fragment/', '/games/')):
        limit_config = RATE_LIMIT_CONFIG['static']
    elif any(bad in path_lower for bad in SUSPICIOUS_PATHS):
        limit_config = RATE_LIMIT_CONFIG['strict']
    else:
        limit_config = RATE_LIMIT_CONFIG['default']
    
    request_counts[client_ip] = [
        t for t in request_counts[client_ip] 
        if current_time - t < limit_config['window']
    ]
    
    if len(request_counts[client_ip]) > limit_config['requests']:
        track_attack(client_ip, path)
        print(f"🚫 RATE LIMITED: {client_ip}")
        abort(429)
    
    request_counts[client_ip].append(current_time)
    print(f"📥 {method} {path} - {client_ip}")

@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

# ==================== ERROR HANDLERS ====================

@app.errorhandler(403)
def forbidden_handler(e):
    return jsonify({'error': 'Access forbidden'}), 403

@app.errorhandler(404)
def not_found_handler(e):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': 'Too many requests', 'retry_after': 60}), 429

@app.errorhandler(500)
def internal_error_handler(e):
    return jsonify({'error': 'Internal server error'}), 500

# ==================== ROUTE REGISTRATION ====================

# Register semua blueprint yang berhasil diimport
if website_bp:
    app.register_blueprint(website_bp, url_prefix='/api')
if vcr_bp:
    app.register_blueprint(vcr_bp, url_prefix='/api')
if pmb_bp:
    app.register_blueprint(pmb_bp, url_prefix='/api')
if prd_bp:
    app.register_blueprint(prd_bp, url_prefix='/api')
if ssl_bp:
    app.register_blueprint(ssl_bp, url_prefix='/api')
if tmp_bp:
    app.register_blueprint(tmp_bp, url_prefix='/api')
if tmp_font_bp:
    app.register_blueprint(tmp_font_bp, url_prefix='/api')
if trx_bp:
    app.register_blueprint(trx_bp, url_prefix='/api')
if user_bp:
    app.register_blueprint(user_bp, url_prefix='/api')
if image_bp:
    app.register_blueprint(image_bp, url_prefix='/api/images')
if frag_bp:
    app.register_blueprint(frag_bp)
if tgs_bp:
    app.register_blueprint(tgs_bp)
if plinko_bp:
    app.register_blueprint(plinko_bp)
if giveaway_bp:
    app.register_blueprint(giveaway_bp, url_prefix='/api/giveaway')
if crash_bp:
    app.register_blueprint(crash_bp, url_prefix='/api/crash')
if games_bp:
    app.register_blueprint(games_bp)
if create_bp:
    app.register_blueprint(create_bp, url_prefix='/api/giveaway')
if battle_bp:
    app.register_blueprint(battle_bp, url_prefix='/api/battle')
if winedash_bp:
    app.register_blueprint(winedash_bp, url_prefix='/api/winedash')
if offers_bp:
    app.register_blueprint(offers_bp)
if auctions_bp:
    app.register_blueprint(auctions_bp)
if debug_bp:
    app.register_blueprint(debug_bp)
if admin_bp:
    app.register_blueprint(admin_bp)
if market_bp:
    app.register_blueprint(market_bp)
if panel_bp:
    app.register_blueprint(panel_bp)
if scam_bp:
    app.register_blueprint(scam_bp)

if cek_ip_bp:
    app.register_blueprint(cek_ip_bp, url_prefix='/api/cek-ip')

if gift_scanned_bp:
    app.register_blueprint(gift_scanned_bp)
    print("✅ Gift Scanned blueprint registered (no prefix)")
else:
    print("⚠️ Gift Scanned blueprint NOT registered - service unavailable")

if data_tracker_bp:
    app.register_blueprint(data_tracker_bp, url_prefix='/tracker')
    print("✅ data_tracker_bp registered at /tracker")

# ==================== SCAMACTION STATIC ROUTES ====================

# Route untuk halaman panel ScamAction
@app.route('/scamaction')
@app.route('/scamaction/')
@app.route('/scamaction/panel')
def serve_scamaction_panel():
    """Halaman utama ScamAction Panel"""
    scamaction_html_dir = os.path.join(base_dir, 'scamaction', 'html')
    if os.path.exists(os.path.join(scamaction_html_dir, 'panel.html')):
        return send_from_directory(scamaction_html_dir, 'panel.html')
    return "Panel not found", 404

# Route untuk CSS ScamAction
@app.route('/scamaction/css/<path:filename>')
def serve_scamaction_css(filename):
    """Serve CSS files for ScamAction Panel"""
    scamaction_css_dir = os.path.join(base_dir, 'scamaction', 'css')
    if os.path.exists(os.path.join(scamaction_css_dir, filename)):
        return send_from_directory(scamaction_css_dir, filename)
    return "CSS file not found", 404

# Route untuk JS ScamAction
@app.route('/scamaction/js/<path:filename>')
def serve_scamaction_js(filename):
    """Serve JS files for ScamAction Panel"""
    scamaction_js_dir = os.path.join(base_dir, 'scamaction', 'js')
    if os.path.exists(os.path.join(scamaction_js_dir, filename)):
        return send_from_directory(scamaction_js_dir, filename)
    return "JS file not found", 404

# ==================== SCAN RESULTS MINIAPP ====================

@app.route('/scanning')
def serve_scanning_page():
    """Halaman MiniApp untuk melihat hasil scan"""
    return send_from_directory(os.path.join(base_dir, 'scamaction', 'html'), 'scan_results.html')

# ==================== GIFT SCANNED STATIC ROUTES ====================

# Route untuk mengakses file CSS Gift Scanned
@app.route('/css/gift_scanned.css')
def serve_gift_scanned_css():
    """Serve CSS for Gift Scanned page"""
    css_path = os.path.join(base_dir, 'css', 'gift_scanned.css')
    if os.path.exists(css_path):
        return send_from_directory(os.path.join(base_dir, 'css'), 'gift_scanned.css')
    else:
        # Fallback jika file tidak ada di folder css
        return send_from_directory(base_dir, 'gift_scanned.css')

# Route untuk mengakses file JS Gift Scanned
@app.route('/js/gift_scanned.js')
def serve_gift_scanned_js():
    """Serve JS for Gift Scanned page"""
    js_path = os.path.join(base_dir, 'js', 'gift_scanned.js')
    if os.path.exists(js_path):
        return send_from_directory(os.path.join(base_dir, 'js'), 'gift_scanned.js')
    else:
        # Fallback jika file tidak ada di folder js
        return send_from_directory(base_dir, 'gift_scanned.js')

# Route untuk halaman utama Gift Scanned
@app.route('/gift-scam')
@app.route('/gift-scam/')
def serve_gift_scanned_page():
    """Halaman utama Gift Scanned Collection"""
    html_path = os.path.join(base_dir, 'html', 'gift_scanned.html')
    if os.path.exists(html_path):
        return send_from_directory(os.path.join(base_dir, 'html'), 'gift_scanned.html')
    else:
        # Fallback ke root
        return send_from_directory(base_dir, 'gift_scanned.html')

# Route untuk Gift Scanned dari path yang sudah ada (biar kompatibel)
@app.route('/gift-scanned')
@app.route('/gift-scanned/')
def serve_gift_scanned_legacy():
    """Legacy route for Gift Scanned page"""
    return serve_gift_scanned_page()

# Route /gift-scam dihandle oleh serve_gift_scanned_page di atas

# ==================== ROUTE UNTUK PANEL JASEB ====================

@app.route('/jaseb/panel')
def serve_jaseb_panel():
    """Halaman utama panel Jaseb"""
    try:
        panel_path = os.path.join(JASEB_DIR, 'html', 'panel.html')
        if os.path.exists(panel_path):
            return send_from_directory(os.path.join(JASEB_DIR, 'html'), 'panel.html')
        
        return f"Panel not found at {panel_path}", 404
    except Exception as e:
        logger.error(f"Error serving jaseb panel: {e}")
        return f"Error: {str(e)}", 500

# ==================== ROUTE UNTUK STATIC FILES PANEL ====================

@app.route('/jaseb/css/<path:filename>')
def serve_jaseb_css(filename):
    """Serve CSS files for Jaseb Panel"""
    css_dir = os.path.join(JASEB_DIR, 'css')
    css_path = os.path.join(css_dir, filename)
    if os.path.exists(css_path):
        return send_from_directory(css_dir, filename)
    return f"CSS file not found: {filename}", 404

@app.route('/jaseb/js/<path:filename>')
def serve_jaseb_js(filename):
    """Serve JS files for Jaseb Panel"""
    js_dir = os.path.join(JASEB_DIR, 'js')
    js_path = os.path.join(js_dir, filename)
    if os.path.exists(js_path):
        return send_from_directory(js_dir, filename)
    return f"JS file not found: {filename}", 404

@app.route('/jaseb/images/<path:filename>')
def serve_jaseb_images(filename):
    """Serve images for Jaseb Panel"""
    images_dir = os.path.join(JASEB_DIR, 'images')
    images_path = os.path.join(images_dir, filename)
    if os.path.exists(images_path):
        return send_from_directory(images_dir, filename)
    return f"Image file not found: {filename}", 404

@app.route('/jaseb/database/<path:filename>')
def serve_jaseb_database(filename):
    """Serve database files for Jaseb Panel (if needed)"""
    db_dir = os.path.join(JASEB_DIR, 'database')
    db_path = os.path.join(db_dir, filename)
    if os.path.exists(db_path):
        return send_from_directory(db_dir, filename)
    return f"Database file not found: {filename}", 404

# ==================== API ROUTE UNTUK PANEL JASEB ====================

@app.route('/jaseb/api/panel/dashboard', methods=['GET'])
def jaseb_panel_dashboard():
    """API endpoint for Jaseb panel dashboard"""
    try:
        import sqlite3
        db_path = JASEB_DB_PATH
        if not os.path.exists(db_path):
            db_path = os.path.join(JASEB_DIR, 'jaseb.db')
        
        if not os.path.exists(db_path):
            return jsonify({'success': False, 'error': 'Database not found'}), 500
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Get stats - simpan hasil fetchone() ke variabel
        cursor.execute("SELECT COUNT(*) as count FROM jaseb_users")
        row = cursor.fetchone()
        total_users = row['count'] if row else 0
        
        cursor.execute("SELECT COUNT(*) as count FROM jaseb_userbot_sessions WHERE is_active = 1")
        row = cursor.fetchone()
        active_sessions = row['count'] if row else 0
        
        cursor.execute("SELECT COUNT(*) as count FROM jaseb_userbot_groups WHERE is_active = 1")
        row = cursor.fetchone()
        total_groups = row['count'] if row else 0
        
        cursor.execute("SELECT COUNT(*) as count FROM jaseb_userbot_messages")
        row = cursor.fetchone()
        total_messages = row['count'] if row else 0
        
        cursor.execute("SELECT COUNT(*) as count FROM jaseb_userbot_sebar WHERE is_running = 1")
        row = cursor.fetchone()
        active_sebar = row['count'] if row else 0
        
        cursor.execute("SELECT COUNT(*) as count FROM jaseb_group_join_queue WHERE status = 'pending'")
        row = cursor.fetchone()
        pending_queue = row['count'] if row else 0
        
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_users': total_users,
                'active_sessions': active_sessions,
                'total_groups': total_groups,
                'total_messages': total_messages,
                'active_sebar': active_sebar,
                'pending_queue': pending_queue
            }
        })
    except Exception as e:
        logger.error(f"Error in jaseb_panel_dashboard: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/jaseb/api/panel/logs', methods=['GET'])
def jaseb_panel_logs():
    """API endpoint for Jaseb panel logs"""
    try:
        limit = request.args.get('limit', 50, type=int)
        
        # Langsung gunakan database, tidak perlu import panel_service
        db_path = JASEB_DB_PATH
        if not os.path.exists(db_path):
            db_path = os.path.join(JASEB_DIR, 'jaseb.db')
        
        if not os.path.exists(db_path):
            return jsonify({'success': False, 'error': 'Database not found'}), 500
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM jaseb_activity_logs 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (limit,))
        
        logs = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'success': True, 'data': logs})
    except Exception as e:
        logger.error(f"Error in jaseb_panel_logs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/jaseb/api/panel/user/<int:user_id>/status', methods=['GET'])
def jaseb_panel_user_status(user_id):
    """API endpoint for user status"""
    try:
        db_path = JASEB_DB_PATH
        if not os.path.exists(db_path):
            db_path = os.path.join(JASEB_DIR, 'jaseb.db')
        
        if not os.path.exists(db_path):
            return jsonify({'success': False, 'error': 'Database not found'}), 500
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM jaseb_userbot_sessions WHERE user_id = ?", (user_id,))
        session = cursor.fetchone()  # Simpan ke variabel
        
        session_active = session is not None and session['is_active'] == 1 if session else False
        
        cursor.execute("SELECT is_running FROM jaseb_userbot_sebar WHERE user_id = ?", (user_id,))
        sebar = cursor.fetchone()  # Simpan ke variabel
        is_running = sebar['is_running'] == 1 if sebar else False
        
        cursor.execute("SELECT mode_type FROM jaseb_userbot_mode WHERE user_id = ?", (user_id,))
        mode = cursor.fetchone()  # Simpan ke variabel
        
        conn.close()
        
        return jsonify({
            'success': True,
            'session_active': session_active,
            'phone_number': session['phone_number'] if session else None,
            'is_running': is_running,
            'mode': mode['mode_type'] if mode else 'send'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/jaseb/api/panel/user/<int:user_id>/groups', methods=['GET'])
def jaseb_panel_user_groups(user_id):
    """API endpoint for user groups"""
    try:
        db_path = JASEB_DB_PATH
        if not os.path.exists(db_path):
            db_path = os.path.join(JASEB_DIR, 'jaseb.db')
        
        if not os.path.exists(db_path):
            return jsonify({'success': False, 'error': 'Database not found'}), 500
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM jaseb_userbot_groups 
            WHERE user_id = ? AND is_active = 1 
            ORDER BY added_at DESC
        """, (user_id,))
        
        groups = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'success': True, 'groups': groups})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== WINEDASH ROUTES ====================
@app.route('/winedash/gift-scammer')
def serve_gift_scanned():
    """Halaman Gift Scammer Winedash"""
    return send_from_directory(os.path.join(base_dir, 'html'), 'gift_scanned.html')

@app.route('/winedash/market-auctions')
def serve_winedash_market_auctions():
    """Halaman Market Auctions Winedash"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'html'), 'market-auctions.html')

@app.route('/winedash/admin')
def serve_winedash_admin():
    """Halaman Admin Panel Winedash"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'html'), 'admin.html')

@app.route('/winedash/debug')
def serve_debug_page():
    """Halaman debug console untuk melihat logs user"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'html'), 'debug.html')

@app.route('/winedash/offers')
def serve_winedash_offers():
    """Halaman Offers Winedash"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'html'), 'offers.html')

@app.route('/winedash/storage')
def serve_winedash_storage():
    """Halaman Storage Winedash"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'html'), 'storage.html')

@app.route('/winedash')
@app.route('/winedash/')
def serve_winedash_page():
    """Halaman utama Winedash Marketplace"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'html'), 'web.html')

@app.route('/winedash/css/<path:filename>')
def serve_winedash_css(filename):
    """Serve CSS files for Winedash"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'css'), filename)

@app.route('/winedash/js/<path:filename>')
def serve_winedash_js(filename):
    """Serve JS files for Winedash"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'js'), filename)

@app.route('/winedash/database/<path:filename>')
def serve_winedash_database(filename):
    """Serve database files (if needed)"""
    return send_from_directory(os.path.join(base_dir, 'winedash', 'database'), filename)

@app.route('/winedash/tonconnect-manifest.json')
def serve_winedash_ton_manifest():
    """Serve TON Connect manifest for Winedash"""
    manifest = {
        "url": "https://companel.shop",
        "name": "Winedash",
        "iconUrl": "https://companel.shop/winedash/images/logo.png",
        "termsOfUseUrl": "https://companel.shop/terms",
        "privacyPolicyUrl": "https://companel.shop/privacy"
    }
    return jsonify(manifest)

@app.route('/giveaway/battle')
def battle_page():
    return send_from_directory('giveaway/static', 'battle.html')

@app.route('/giveaways')
def serve_giveaways_page():
    """Halaman Giveaways"""
    return send_from_directory(os.path.join(base_dir, 'giveaway', 'html'), 'giveaway.html')

@app.route('/cek-ip/dashboard')
def serve_cek_ip_dashboard():
    """Redirect ke dashboard tracking IP"""
    return redirect('/api/cek-ip/dashboard')

@app.route('/giveaway/create')
def serve_giveaway_create_page():
    """Halaman Create Giveaway"""
    return send_from_directory(os.path.join(base_dir, 'giveaway', 'html'), 'create.html')

@app.route('/giveaway')
def serve_giveaway_page():
    """Halaman Lobby Giveaway"""
    return send_from_directory(os.path.join(base_dir, 'giveaway', 'html'), 'lobby.html')

@app.route('/crash')
def serve_crash_page():
    """Halaman Crash Game"""
    return send_from_directory(os.path.join(base_dir, 'games', 'html'), 'crash.html')

@app.route('/giveaway/css/<path:filename>')
def serve_giveaway_css(filename):
    """Serve CSS files for Giveaway"""
    return send_from_directory(os.path.join(base_dir, 'giveaway', 'css'), filename)

@app.route('/giveaway/js/<path:filename>')
def serve_giveaway_js(filename):
    """Serve JS files for Giveaway"""
    return send_from_directory(os.path.join(base_dir, 'giveaway', 'js'), filename)

@app.route('/games')
def serve_games_page():
    """Halaman Games"""
    return send_from_directory(os.path.join(base_dir, 'games', 'html'), 'games.html')

@app.route('/games/css/<path:filename>')
def serve_games_css(filename):
    """Serve CSS files for Games"""
    return send_from_directory(os.path.join(base_dir, 'games', 'css'), filename)

@app.route('/games/js/<path:filename>')
def serve_games_js(filename):
    """Serve JS files for Games"""
    return send_from_directory(os.path.join(base_dir, 'games', 'js'), filename)

@app.route('/games/database/<path:filename>')
def serve_games_database(filename):
    """Serve database files (if needed)"""
    return send_from_directory(os.path.join(base_dir, 'games', 'database'), filename)

@app.route('/plinko-games')
def serve_plinko_games():
    """Halaman Plinko Games"""
    return send_from_directory(os.path.join(base_dir, 'games', 'html'), 'plinko_games.html')

@app.route('/profile')
def serve_profile_page():
    """Halaman profil user"""
    return send_from_directory(os.path.join(base_dir, 'games', 'html'), 'profil.html')

# ==================== ROUTE UNTUK ICON MANIFEST ====================

@app.route('/tonconnect-manifest.json')
def serve_tonconnect_manifest():
    manifest = {
        "url": "https://companel.shop",
        "name": "BarackGift",
        "iconUrl": "https://companel.shop/image/logo-manifest.jpg",
        "termsOfUseUrl": "https://companel.shop/terms",
        "privacyPolicyUrl": "https://companel.shop/privacy"
    }
    return jsonify(manifest)

# ==================== ROUTE UNTUK IMAGE SERVICE ====================

@app.route('/ii', methods=['GET'])
def serve_image_direct():
    try:
        from services.image_service import serve_image
        return serve_image()
    except Exception as e:
        print(f"❌ Error serving image: {e}")
        return "Image service error", 500

@app.route('/winedash/photo/<string:username>')
def serve_winedash_photo(username):
    """Serve profile photo preview page"""
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Profile Photo - @{username}</title>
        <style>
            body {{
                background: #0a0a0a;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
            }}
            .container {{
                text-align: center;
            }}
            .photo-container {{
                background: #111111;
                border-radius: 24px;
                padding: 20px;
                display: inline-block;
                box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            }}
            img {{
                max-width: 300px;
                max-height: 300px;
                border-radius: 20px;
                object-fit: cover;
            }}
            .username {{
                color: white;
                margin-top: 16px;
                font-size: 18px;
                font-weight: 600;
            }}
            .error {{
                color: #ef4444;
                font-size: 14px;
            }}
            .loading {{
                color: #a0a0a0;
                font-size: 14px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="photo-container">
                <div id="photoContainer">
                    <div class="loading">Loading profile photo...</div>
                </div>
                <div class="username">@{username}</div>
            </div>
        </div>
        <script>
            fetch('/api/winedash/profile-photo/{username}')
                .then(res => res.json())
                .then(data => {{
                    if (data.success && data.photo_url) {{
                        document.getElementById('photoContainer').innerHTML = 
                            `<img src="${{data.photo_url}}" alt="@{username}">`;
                    }} else {{
                        document.getElementById('photoContainer').innerHTML = 
                            `<div class="error">No profile photo found</div>`;
                    }}
                }})
                .catch(err => {{
                    document.getElementById('photoContainer').innerHTML = 
                        `<div class="error">Error loading photo</div>`;
                }});
        </script>
    </body>
    </html>
    '''

# ==================== STATIC ROUTES (WEBSITE) ====================

@app.route('/')
def serve_dashboard():
    return send_from_directory(os.path.join(base_dir, 'html'), 'web-lobby.html')

@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/tampilan')
def serve_tampilan_page():
    html_dir = os.path.join(base_dir, 'html')
    if os.path.exists(os.path.join(html_dir, 'tampilan.html')):
        return send_from_directory(html_dir, 'tampilan.html')
    return send_from_directory(base_dir, 'tampilan.html')

@app.route('/panel')
def serve_main_panel():
    html_dir = os.path.join(base_dir, 'html')
    if os.path.exists(os.path.join(html_dir, 'panel.html')):
        return send_from_directory(html_dir, 'panel.html')
    return send_from_directory(base_dir, 'panel.html')

# ==================== TRACKER ROUTES ====================

@app.route('/simpang-44')
def serve_tracker_main():
    return send_from_directory(os.path.join(base_dir, 'tracker', 'html'), 'tracker.html')

@app.route('/tracker-data')
def serve_tracker_data():
    return send_from_directory(os.path.join(base_dir, 'tracker', 'html'), 'data-tracker.html')

# ==================== TAMBAHKAN ROUTE VIEW TRACKER ====================
@app.route('/tracker/view')
def tracker_view_page():
    """Halaman tracking untuk endpoint unik - menggunakan blueprint atau langsung"""
    from urllib.parse import unquote
    
    token_raw = request.args.get('token', '')
    # Decode URL encoding (mengubah %2B kembali menjadi +)
    token = unquote(token_raw)
    
    if not token:
        return '''
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Not Found</title>
        <style>body{background:#0a0f1e;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;}</style>
        </head>
        <body><div style="text-align:center"><h1>🔒 404</h1><p>Link tidak valid.</p></div></body>
        </html>
        ''', 404
    
    # Import blueprint function
    try:
        from tracker.services.data_tracker_service import view_tracker
        # Override token yang sudah di-decode
        request.args = dict(request.args)
        request.args['token'] = token
        return view_tracker()
    except ImportError:
        # Fallback: akses database langsung
        import sqlite3
        
        DB_PATH = os.path.join(base_dir, 'tracker', 'database', 'tracker.db')
        
        if not os.path.exists(DB_PATH):
            DB_PATH = os.path.join(base_dir, 'tracker', 'database', 'tracker.db')
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT endpoint_id, endpoint_name, is_used, used_by_ip 
            FROM tracker_data WHERE endpoint_token = ?
        ''', (token,))
        
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return '''
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>Not Found</title>
            <style>body{background:#0a0f1e;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;}</style>
            </head>
            <body><div style="text-align:center"><h1>🔒 404</h1><p>Link tidak valid atau sudah expired.</p><p>Token: ''' + token + '''</p></div></body>
            </html>
            ''', 404
        
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr).split(',')[0].strip()
        
        if row['is_used'] == 1:
            if row['used_by_ip'] != client_ip:
                conn.close()
                return '''
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"><title>Link Sudah Digunakan</title>
                <style>body{background:#0a0f1e;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;}</style>
                </head>
                <body><div style="text-align:center"><h1>🔒 403</h1><p>Link ini sudah digunakan oleh orang lain.</p><p>Setiap link hanya bisa digunakan 1 orang pertama.</p></div></body>
                </html>
                ''', 403
        
        if row['is_used'] == 0:
            cursor.execute('''
                UPDATE tracker_data 
                SET is_used = 1, used_by_ip = ?, used_at = CURRENT_TIMESTAMP
                WHERE endpoint_token = ?
            ''', (client_ip, token))
            conn.commit()
        
        conn.close()
        
        # Render halaman tracker
        return f'''
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ANGKASA TRACKER PRO</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
            <style>
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                body {{
                    font-family: 'Inter', sans-serif;
                    background: radial-gradient(circle at 20% 30%, #0a0f1e, #03050b);
                    min-height: 100vh;
                    padding: 24px 16px;
                    color: #eef5ff;
                }}
                .container {{ max-width: 800px; margin: 0 auto; }}
                .glow-header {{ text-align: center; margin-bottom: 40px; }}
                .glow-header h1 {{
                    font-size: 2.8rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #c084fc, #60a5fa, #f472b6);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                }}
                .card {{
                    background: rgba(15, 25, 45, 0.65);
                    backdrop-filter: blur(12px);
                    border-radius: 28px;
                    padding: 22px;
                    border: 1px solid rgba(96, 165, 250, 0.25);
                }}
                .info-row {{
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }}
                .info-label {{ color: #9ca8cf; }}
                .info-value {{ font-weight: 600; font-family: monospace; }}
                .map-link {{ color: #7aa2f7; text-decoration: none; }}
                .status-badge {{
                    padding: 8px 12px;
                    border-radius: 36px;
                    text-align: center;
                    margin-top: 12px;
                    background: rgba(0,0,0,0.4);
                }}
                .success {{ background: rgba(34,197,94,0.2); color: #86efac; }}
                .error {{ background: rgba(239,68,68,0.2); color: #fca5a5; }}
            </style>
        </head>
        <body>
        <div class="container">
            <div class="glow-header">
                <h1>🛸 ANGKASA TRACKER PRO</h1>
                <p>IP Geolocation Master | Auto Track Tanpa Izin</p>
            </div>
            <div class="card">
                <h3>🌍 DATA LOKASI ANDA</h3>
                <div id="tracker-data">
                    <div class="info-row"><span class="info-label">🌐 IP Publik</span><span class="info-value" id="ip">Memuat...</span></div>
                    <div class="info-row"><span class="info-label">📌 Koordinat</span><span class="info-value" id="coord">-</span></div>
                    <div class="info-row"><span class="info-label">📍 Lokasi</span><span class="info-value" id="location">-</span></div>
                    <div class="info-row"><span class="info-label">📡 ISP</span><span class="info-value" id="isp">-</span></div>
                    <div class="info-row"><span class="info-label">📱 Perangkat</span><span class="info-value" id="device">-</span></div>
                    <div class="info-row"><span class="info-label">💻 OS & Browser</span><span class="info-value" id="browser">-</span></div>
                </div>
                <div id="status" class="status-badge">⏳ Mengirim data...</div>
            </div>
        </div>
        <script>
            async function trackAndSend() {{
                const statusDiv = document.getElementById('status');
                const endpointId = '{row["endpoint_id"]}';
                try {{
                    const resp = await fetch('https://ipapi.co/json/');
                    const data = await resp.json();
                    
                    document.getElementById('ip').innerText = data.ip;
                    if (data.latitude && data.longitude) {{
                        document.getElementById('coord').innerHTML = `${{data.latitude}}, ${{data.longitude}} <a href="https://www.google.com/maps?q=${{data.latitude}},${{data.longitude}}" target="_blank" class="map-link">🗺️ peta</a>`;
                    }}
                    let location = data.city || '';
                    if (data.region) location += location ? `, ${{data.region}}` : data.region;
                    if (data.country_name) location += location ? `, ${{data.country_name}}` : data.country_name;
                    document.getElementById('location').innerText = location || '-';
                    document.getElementById('isp').innerText = data.org || '-';
                    
                    const ua = navigator.userAgent;
                    let device = 'Desktop';
                    if (/Mobile|Android|iPhone|iPod/i.test(ua)) device = 'Mobile';
                    else if (/iPad|Tablet/i.test(ua)) device = 'Tablet';
                    document.getElementById('device').innerText = device;
                    
                    let os = 'Unknown';
                    if (ua.includes('Windows NT 10.0')) os = 'Windows 11/10';
                    else if (ua.includes('Mac OS X')) os = 'macOS';
                    else if (ua.includes('Android')) os = 'Android';
                    else if (/(iPhone|iPad|iPod)/.test(ua)) os = 'iOS';
                    document.getElementById('browser').innerText = os;
                    
                    const sendResp = await fetch(window.location.origin + '/tracker/api/track', {{
                        method: 'POST',
                        headers: {{ 'Content-Type': 'application/json' }},
                        body: JSON.stringify({{
                            endpoint_id: endpointId,
                            geo_data: data,
                            device_info: {{ device: device, os: os, browser: os }}
                        }})
                    }});
                    
                    const result = await sendResp.json();
                    if (result.success) {{
                        statusDiv.innerHTML = '✅ Data berhasil dikirim!';
                        statusDiv.className = 'status-badge success';
                    }} else {{
                        statusDiv.innerHTML = '⚠️ ' + (result.error || 'Gagal mengirim data');
                        statusDiv.className = 'status-badge error';
                    }}
                }} catch(e) {{
                    statusDiv.innerHTML = '❌ Error: ' + e.message;
                    statusDiv.className = 'status-badge error';
                }}
            }}
            trackAndSend();
        </script>
        </body>
        </html>
        '''

@app.route('/tracker/html/<path:filename>')
def serve_tracker_html(filename):
    tracker_html_dir = os.path.join(base_dir, 'tracker', 'html')
    if os.path.exists(os.path.join(tracker_html_dir, filename)):
        return send_from_directory(tracker_html_dir, filename)
    return "File not found", 404

@app.route('/tracker/css/<path:filename>')
def serve_tracker_css(filename):
    tracker_css_dir = os.path.join(base_dir, 'tracker', 'css')
    if os.path.exists(os.path.join(tracker_css_dir, filename)):
        return send_from_directory(tracker_css_dir, filename)
    return "File not found", 404

@app.route('/tracker/js/<path:filename>')
def serve_tracker_js(filename):
    tracker_js_dir = os.path.join(base_dir, 'tracker', 'js')
    if os.path.exists(os.path.join(tracker_js_dir, filename)):
        return send_from_directory(tracker_js_dir, filename)
    return "File not found", 404

@app.route('/format')
def serve_main_format():
    html_dir = os.path.join(base_dir, 'html')
    if os.path.exists(os.path.join(html_dir, 'format.html')):
        return send_from_directory(html_dir, 'format.html')
    return send_from_directory(base_dir, 'format.html')

@app.route('/admins/<string:endpoint>')
def serve_admin_panel(endpoint):
    return send_from_directory(os.path.join(base_dir, 'html'), 'panel.html')

@app.route('/website/<string:endpoint>')
def serve_website(endpoint):
    return send_from_directory(base_dir, 'website.html')

@app.route('/forcemode/ask-forceubot')
def forcemode_ask_forceubot():
    """Halaman penjelasn forceubot"""
    return send_from_directory(os.path.join(base_dir, 'forcemode', 'html'), 'ask-forceubot.html')

@app.route('/fragment/pay')
def fragment_pay_page():
    """Halaman pembayaran QRIS"""
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), 'pay-lobby.html')

@app.route('/fragment')
def serve_fragment_page():
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), 'lobby.html')

@app.route('/fragment/login')
def fragment_login_page():
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), 'login.html')

@app.route('/tgs')
def serve_tgs_page():
    """Halaman untuk test file .tgs"""
    return send_from_directory(os.path.join(base_dir, 'html'), 'tgs.html')

@app.route('/fragment/dashboard')
def fragment_dashboard_page():
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), 'dashboard.html')

@app.route('/fragment/css/<path:filename>')
def serve_fragment_css(filename):
    return send_from_directory(os.path.join(base_dir, 'fragment', 'css'), filename)

@app.route('/fragment/js/<path:filename>')
def serve_fragment_js(filename):
    return send_from_directory(os.path.join(base_dir, 'fragment', 'js'), filename)

@app.route('/fragment/html/<path:filename>')
def serve_fragment_html(filename):
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), filename)

@app.route('/html/<path:subfolder>/<filename>')
def serve_html_subfolder(subfolder, filename):
    target_dir = os.path.join(base_dir, 'html', subfolder)
    return send_from_directory(target_dir, filename)

@app.route('/html/<filename>')
def serve_html_root(filename):
    target_dir = os.path.join(base_dir, 'html')
    return send_from_directory(target_dir, filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(base_dir, 'js'), filename)

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(base_dir, 'css'), filename)

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(base_dir, path)

# ==================== LOBBY ROUTES ====================

@app.route('/web=<endpoint>')
def serve_web_dekstop(endpoint=None):
    return send_from_directory(os.path.join(base_dir, 'html'), 'web-lobby.html')

@app.route('/mobile')
def serve_web_mobile():
    return send_from_directory(os.path.join(base_dir, 'html'), 'web-mobile.html')

# ==================== MONITORING ENDPOINTS ====================

@app.route('/api/admin/security/stats', methods=['GET'])
def get_security_stats():
    stats = []
    now = int(time.time())
    for ip, data in attack_stats.items():
        if now - data['last_seen'] < 3600:
            stats.append({
                'ip': ip,
                'is_cloudflare': is_cloudflare_ip(ip),
                'total_attacks': data['count'],
                'last_seen': datetime.fromtimestamp(data['last_seen']).isoformat(),
                'top_paths': dict(data['paths'].most_common(10))
            })
    stats.sort(key=lambda x: x['total_attacks'], reverse=True)
    return jsonify({
        'success': True,
        'total_active_attackers': len(stats),
        'attackers': stats[:50],
        'rate_limit_stats': {
            'total_ips_in_memory': len(request_counts),
            'config': RATE_LIMIT_CONFIG
        }
    })

@app.route('/api/bot/sticker/<file_id>')
def get_bot_sticker(file_id):
    return jsonify({'error': 'Not implemented yet'}), 404

@app.route('/api/admin/security/clear', methods=['POST'])
def clear_security_stats():
    global attack_stats, request_counts
    attack_stats.clear()
    request_counts.clear()
    return jsonify({'success': True, 'message': 'Security statistics cleared'})

@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'security': {
            'active_rate_limits': len(request_counts),
            'total_attacks_tracked': sum(d['count'] for d in attack_stats.values())
        }
    })

@app.route('/api/notify-withdraw', methods=['POST'])
def notify_withdraw():
    """Kirim notifikasi withdraw ke user via Telegram Bot"""
    data = request.json
    telegram_id = data.get('telegram_id')
    amount = data.get('amount')
    wallet_address = data.get('wallet_address')
    
    BOT_TOKEN = os.getenv('BOT_TOKEN', '')
    
    if not BOT_TOKEN:
        return jsonify({'success': False, 'error': 'Bot token not configured'}), 500
    
    message = f"""✅ *WITHDRAW BERHASIL!*
    
Jumlah: *{amount} TON*
Wallet: `{wallet_address}`

Dana telah dikirim ke wallet TON Anda.
Terima kasih telah menggunakan BarackGift! 🎉
"""
    
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': telegram_id,
            'text': message,
            'parse_mode': 'Markdown'
        }
        response = requests.post(url, json=payload, timeout=10)
        return jsonify({'success': True, 'response': response.json()})
    except Exception as e:
        print(f"Error sending notification: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/image/<path:filename>')
def serve_image_files(filename):
    """Serve image files including .tgs"""
    return send_from_directory('image', filename)

@app.route('/image/gifts/<path:filename>')
def serve_gift_tgs(filename):
    """Serve TGS files for gifts with cache headers"""
    tgs_path = os.path.join(base_dir, 'image', 'gifts', filename)
    if os.path.exists(tgs_path):
        response = send_from_directory(os.path.join(base_dir, 'image', 'gifts'), filename)
        # Add cache headers to reduce repeated requests
        response.headers['Cache-Control'] = 'public, max-age=3600'
        response.headers['ETag'] = str(os.path.getmtime(tgs_path))
        return response
    return jsonify({'error': 'File not found'}), 404

# ==================== GIFT SCANNED API ROUTES (DIRECT) ====================
# Ini adalah fallback langsung jika blueprint gagal

def get_gift_db_connection():
    """Koneksi ke database gift.db"""
    db_paths = [
        '/root/gift.db/gift.db',
        '/root/gift.db',
        os.path.join(base_dir, 'gift.db', 'gift.db'),
        os.path.join(base_dir, 'gift.db'),
    ]
    
    for db_path in db_paths:
        if os.path.exists(db_path) and os.path.isfile(db_path):
            try:
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                print(f"✅ Gift DB connected: {db_path}")
                return conn
            except:
                pass
    print("❌ Gift DB not found!")
    return None

@app.route('/gift-scam/api/stats', methods=['GET'])
def gift_scam_stats():
    """API stats untuk gift scanned"""
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM gift_scanned")
        total = cur.fetchone()['count']
        
        # Hitung unique names
        cur.execute("SELECT slug FROM gift_scanned")
        slugs = cur.fetchall()
        unique_names = set()
        for row in slugs:
            parts = row['slug'].rsplit('-', 1)
            if len(parts) == 2 and parts[1].isdigit():
                unique_names.add(parts[0])
            else:
                unique_names.add(row['slug'])
        
        conn.close()
        return jsonify({
            'success': True,
            'stats': {
                'total': total,
                'unique': len(unique_names)
            }
        })
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/gift-scam/api/names', methods=['GET'])
def gift_scam_names():
    """API daftar unique names"""
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("SELECT slug FROM gift_scanned")
        slugs = cur.fetchall()
        conn.close()
        
        name_counts = {}
        for row in slugs:
            parts = row['slug'].rsplit('-', 1)
            name = parts[0] if len(parts) == 2 and parts[1].isdigit() else row['slug']
            name_counts[name] = name_counts.get(name, 0) + 1
        
        sorted_names = sorted(name_counts.keys())
        
        return jsonify({
            'success': True,
            'names': sorted_names,
            'name_counts': name_counts
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/gift-scam/api/list', methods=['GET'])
def gift_scam_list():
    """API daftar gift dengan pagination"""
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan', 'data': [], 'total': 0}), 500
    
    try:
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 50, type=int)
        search = request.args.get('search', '', type=str).strip()
        
        if page < 1: page = 1
        if limit > 5000: limit = 5000
        
        cur = conn.cursor()
        
        # Cek apakah tabel ada
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gift_scanned'")
        if not cur.fetchone():
            conn.close()
            return jsonify({'success': False, 'error': 'Tabel tidak ditemukan', 'data': [], 'total': 0}), 404
        
        # Cek kolom yang ada
        cur.execute("PRAGMA table_info(gift_scanned)")
        existing_cols = [col[1] for col in cur.fetchall()]
        
        # Build query
        if search:
            cur.execute("""
                SELECT COUNT(*) as total FROM gift_scanned 
                WHERE slug LIKE ? OR text LIKE ?
            """, (f'%{search}%', f'%{search}%'))
        else:
            cur.execute("SELECT COUNT(*) as total FROM gift_scanned")
        
        total = cur.fetchone()['total']
        
        offset = (page - 1) * limit
        
        if search:
            cur.execute("""
                SELECT slug, message_id, text, rowid FROM gift_scanned 
                WHERE slug LIKE ? OR text LIKE ?
                ORDER BY slug
                LIMIT ? OFFSET ?
            """, (f'%{search}%', f'%{search}%', limit, offset))
        else:
            cur.execute("""
                SELECT slug, message_id, text, rowid FROM gift_scanned 
                ORDER BY slug
                LIMIT ? OFFSET ?
            """, (limit, offset))
        
        rows = cur.fetchall()
        conn.close()
        
        gift_list = []
        for row in rows:
            slug = row['slug']
            parts = slug.rsplit('-', 1)
            gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else slug
            gift_number = parts[1] if len(parts) == 2 and parts[1].isdigit() else ''
            
            lottie_url = f"https://nft.fragment.com/gift/{slug}.lottie.json"
            fragment_url = f"https://nft.fragment.com/gift/{slug}"
            
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'text': row['text'] or '',
                'lottie_url': lottie_url,
                'fragment_url': fragment_url,
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': total,
            'page': page,
            'total_pages': max(1, (total + limit - 1) // limit) if limit > 0 else 1,
            'has_next': page * limit < total
        })
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'error': str(e), 'data': []}), 500

@app.route('/gift-scam/api/detail/<slug>', methods=['GET'])
def gift_scam_detail(slug):
    """API detail gift"""
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT slug, message_id, text, rowid, sender_id 
            FROM gift_scanned WHERE slug = ?
        """, (slug,))
        row = cur.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'success': False, 'error': 'Gift tidak ditemukan'}), 404
        
        parts = row['slug'].rsplit('-', 1)
        gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else row['slug']
        
        return jsonify({
            'success': True,
            'data': {
                'id': row['rowid'],
                'slug': row['slug'],
                'name': gift_name,
                'message_id': row['message_id'],
                'sender_id': row['sender_id'] if 'sender_id' in row.keys() else None,
                'text': row['text'] or '',
                'lottie_url': f"https://nft.fragment.com/gift/{slug}.lottie.json",
                'fragment_url': f"https://nft.fragment.com/gift/{slug}"
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/gift-scam/api/by-message/<int:message_id>', methods=['GET'])
def gift_scam_by_message(message_id):
    """API gift berdasarkan message_id"""
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
    
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT slug, message_id, rowid FROM gift_scanned WHERE message_id = ?
            ORDER BY slug
        """, (message_id,))
        rows = cur.fetchall()
        conn.close()
        
        gift_list = []
        for row in rows:
            slug = row['slug']
            parts = slug.rsplit('-', 1)
            gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else slug
            gift_number = parts[1] if len(parts) == 2 and parts[1].isdigit() else ''
            
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'lottie_url': f"https://nft.fragment.com/gift/{slug}.lottie.json",
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/gift-scam/api/by-user/<int:user_id>', methods=['GET'])
def gift_scam_by_user(user_id):
    """API gift berdasarkan sender_id"""
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan'}), 500
    
    try:
        cur = conn.cursor()
        # Cek apakah kolom sender_id ada
        cur.execute("PRAGMA table_info(gift_scanned)")
        cols = [col[1] for col in cur.fetchall()]
        
        if 'sender_id' not in cols:
            conn.close()
            return jsonify({'success': False, 'error': 'Kolom sender_id tidak ada', 'data': []}), 404
        
        cur.execute("""
            SELECT slug, message_id, rowid, sender_id FROM gift_scanned WHERE sender_id = ?
            ORDER BY slug
        """, (user_id,))
        rows = cur.fetchall()
        conn.close()
        
        gift_list = []
        for row in rows:
            slug = row['slug']
            parts = slug.rsplit('-', 1)
            gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else slug
            gift_number = parts[1] if len(parts) == 2 and parts[1].isdigit() else ''
            
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'sender_id': row['sender_id'],
                'lottie_url': f"https://nft.fragment.com/gift/{slug}.lottie.json",
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/gift-scam/api/filter', methods=['GET'])
def gift_scam_filter():
    """API filter gift berdasarkan nama"""
    filter_names = request.args.get('names', '', type=str).strip()
    
    if not filter_names:
        return jsonify({'success': False, 'error': 'Parameter names diperlukan', 'data': []}), 400
    
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan', 'data': []}), 500
    
    try:
        names_list = [n.strip() for n in filter_names.split(',') if n.strip()]
        
        # Build query untuk multiple names
        like_conditions = ' OR '.join(['slug LIKE ?'] * len(names_list))
        params = [f'{name}-%' for name in names_list]
        
        cur = conn.cursor()
        cur.execute(f"""
            SELECT slug, message_id, text, rowid FROM gift_scanned 
            WHERE {like_conditions}
            ORDER BY slug
        """, params)
        
        rows = cur.fetchall()
        conn.close()
        
        gift_list = []
        for row in rows:
            slug = row['slug']
            parts = slug.rsplit('-', 1)
            gift_name = parts[0] if len(parts) == 2 and parts[1].isdigit() else slug
            gift_number = parts[1] if len(parts) == 2 and parts[1].isdigit() else ''
            
            gift_list.append({
                'id': row['rowid'],
                'slug': slug,
                'name': gift_name,
                'number': gift_number,
                'message_id': row['message_id'],
                'text': row['text'] or '',
                'lottie_url': f"https://nft.fragment.com/gift/{slug}.lottie.json",
                'fragment_url': f"https://nft.fragment.com/gift/{slug}"
            })
        
        return jsonify({
            'success': True,
            'data': gift_list,
            'total': len(gift_list),
            'filter_names': names_list
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e), 'data': []}), 500

@app.route('/gift-scam/api/senders', methods=['GET'])
def gift_scam_senders():
    """API daftar unique sender IDs"""
    conn = get_gift_db_connection()
    if not conn:
        return jsonify({'success': False, 'error': 'Database tidak ditemukan', 'senders': [], 'sender_counts': {}}), 500
    
    try:
        cur = conn.cursor()
        
        # Cek apakah kolom sender_id ada
        cur.execute("PRAGMA table_info(gift_scanned)")
        cols = [col[1] for col in cur.fetchall()]
        
        if 'sender_id' not in cols:
            conn.close()
            return jsonify({'success': True, 'senders': [], 'sender_counts': {}})
        
        # Ambil semua sender_id unique
        cur.execute("""
            SELECT sender_id, COUNT(*) as count 
            FROM gift_scanned 
            WHERE sender_id IS NOT NULL AND sender_id != ''
            GROUP BY sender_id 
            ORDER BY sender_id
        """)
        rows = cur.fetchall()
        conn.close()
        
        senders = []
        sender_counts = {}
        for row in rows:
            sender_id = row[0]
            if sender_id:
                senders.append(sender_id)
                sender_counts[sender_id] = row[1]
        
        return jsonify({
            'success': True,
            'senders': senders,
            'sender_counts': sender_counts
        })
        
    except Exception as e:
        print(f"Error in /gift-scam/api/senders: {e}")
        return jsonify({'success': False, 'error': str(e), 'senders': [], 'sender_counts': {}}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    PORT = 5050
    print("="*60)
    print(f"🚀 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 Public Domain: https://companel.shop")
    print("🛡️ Security Features: Enabled")
    print("="*60)
    print("\n📋 Registered Blueprints (API):")
    if website_bp: print("   - website_bp (/api/websites)")
    if vcr_bp: print("   - vcr_bp (/api/voucher)")
    if pmb_bp: print("   - pmb_bp (/api/payments)")
    if prd_bp: print("   - prd_bp (/api/products)")
    if ssl_bp: print("   - ssl_bp (/api/social)")
    if tmp_bp: print("   - tmp_bp (/api/tampilan)")
    if tmp_font_bp: print("   - tmp_font_bp (/api/font-templates)")
    if trx_bp: print("   - trx_bp (/api/transactions)")
    if user_bp: print("   - user_bp (/api/user)")
    if image_bp: print("   - image_bp (/api/images)")
    if frag_bp: print("   - frag_bp (/api/fragment)")
    if gift_scanned_bp: print("   - gift_scanned_bp (no prefix)")
    print("="*60)
    print("\n📋 Gift Scanned Routes:")
    print("   GET  /gift-scam")
    print("   GET  /gift-scam/")
    print("   GET  /gift-scanned")
    print("   GET  /css/gift_scanned.css")
    print("   GET  /js/gift_scanned.js")
    print("="*60)
    print("\n📋 Static Website Routes:")
    print("   GET  /")
    print("   GET  /panel")
    print("   GET  /tampilan")
    print("   GET  /format")
    print("   GET  /mobile")
    print("   GET  /web=<endpoint>")
    print("   GET  /fragment/login")
    print("   GET  /fragment/dashboard")
    print("="*60)
    
    app.run(host='0.0.0.0', port=PORT, debug=False)