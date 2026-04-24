#!/usr/bin/env python3
import os
import sys
import time
import ipaddress
import secrets
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from collections import defaultdict, Counter
import logging
import requests

# ==================== INTEGRASI JASEB USERBOT MANAGER ====================

JASEB_DIR = '/root/jaseb'
if JASEB_DIR not in sys.path:
    sys.path.append(JASEB_DIR) # DIPERBAIKI: Menggunakan append agar tidak menimpa folder services utama

jaseb_api_bp = None
try:
    from services.data_service import jaseb_api_bp
    print("✅ Jaseb API blueprint imported successfully")
except ImportError as e1:
    print(f"⚠️ First import attempt failed: {e1}")
    try:
        # Coba dengan menambahkan path secara eksplisit
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            "data_service", 
            os.path.join(JASEB_DIR, "services", "data_service.py")
        )
        data_service = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(data_service)
        jaseb_api_bp = data_service.jaseb_api_bp
        print("✅ Jaseb API blueprint imported via spec")
    except Exception as e2:
        print(f"⚠️ Second import attempt failed: {e2}")
        jaseb_api_bp = None

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
    print(f"⚠️ giveaway_service skipped: {e}")

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
    print(f"⚠️ create_service skipped: {e}")

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
    from services.source_code_service import get_winedash_source_logic
    print("✅ source_code_service imported")
except ImportError as e:
    print(f"⚠️ source_code_service skipped: {e}")
    def get_winedash_source_logic():
        return "<p>Source code viewer temporarily unavailable</p>"

try:
    from services.gift_scanned_service import gift_scanned_bp
    print("✅ gift_scanned_service imported")
except ImportError as e:
    print(f"⚠️ gift_scanned_service skipped: {e}")

try:
    from services.panel_service import panel_bp
    print("✅ panel_service imported")
except ImportError as e:
    print(f"⚠️ panel_service skipped: {e}")
    panel_bp = None

base_dir = os.path.abspath(os.path.dirname(__file__))

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
if gift_scanned_bp:
    app.register_blueprint(gift_scanned_bp, url_prefix='/gift-scam')

# Register Jaseb API blueprint if available
if jaseb_api_bp:
    app.register_blueprint(jaseb_api_bp, url_prefix='/api/jaseb')
    print("✅ Jaseb API blueprint registered")

# ==================== ROUTE UNTUK JASEB DASHBOARD ====================

@app.route('/jaseb/panel')
def serve_jaseb_panel():
    try:
        panel_path = os.path.join(JASEB_DIR, 'html', 'panel.html')
        if os.path.exists(panel_path):
            return send_from_directory(os.path.join(JASEB_DIR, 'html'), 'panel.html')
        else:
            return f"Dashboard not found at {panel_path}", 404
    except Exception as e:
        logger.error(f"Error serving jaseb dashboard: {e}")
        return f"Error: {str(e)}", 500

@app.route('/jaseb/dashboard')
def serve_jaseb_dashboard():
    """Halaman utama Jaseb UserBot Manager"""
    try:
        dashboard_path = os.path.join(JASEB_DIR, 'html', 'dashboard.html')
        if os.path.exists(dashboard_path):
            return send_from_directory(os.path.join(JASEB_DIR, 'html'), 'dashboard.html')
        else:
            return f"Dashboard not found at {dashboard_path}", 404
    except Exception as e:
        logger.error(f"Error serving jaseb dashboard: {e}")
        return f"Error: {str(e)}", 500

# ==================== ROUTE UNTUK STATIC FILES JASEB ====================

@app.route('/jaseb/<path:filename>')
def serve_jaseb_path(filename):
    """Serve static files for Jaseb"""
    return send_from_directory(os.path.join(JASEB_DIR), filename)

@app.route('/jaseb/css/<path:filename>')
def serve_jaseb_css(filename):
    """Serve CSS files for Jaseb"""
    return send_from_directory(os.path.join(JASEB_DIR, 'css'), filename)

@app.route('/jaseb/js/<path:filename>')
def serve_jaseb_js(filename):
    """Serve JS files for Jaseb"""
    return send_from_directory(os.path.join(JASEB_DIR, 'js'), filename)

@app.route('/jaseb/images/<path:filename>')
def serve_jaseb_images(filename):
    """Serve images for Jaseb"""
    return send_from_directory(os.path.join(JASEB_DIR, 'images'), filename)

# ==================== JASEB API HEALTH CHECK ====================

@app.route('/api/jaseb/health', methods=['GET'])
def jaseb_health_check():
    """Health check endpoint for Jaseb integration"""
    try:
        from database.data import db
        stats = db.get_stats()
        return jsonify({
            'success': True,
            'status': 'healthy',
            'integration': 'active',
            'stats': stats,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/source-viewer')
def source_viewer_page():
    try:
        all_code_content = get_winedash_source_logic()
        template_path = os.path.join(base_dir, 'html', 'source-code.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            html_template = f.read()
        final_html = html_template.replace('{{ CONTENT }}', all_code_content)
        return final_html
    except Exception as e:
        return f"Error: {str(e)}", 500

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

@app.route('/giveaways')
def serve_giveaways_page():
    """Halaman Giveaways"""
    return send_from_directory(os.path.join(base_dir, 'giveaway', 'html'), 'giveaway.html')

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
    if jaseb_api_bp: print("   - jaseb_api_bp (/api/jaseb)")
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