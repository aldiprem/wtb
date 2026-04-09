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
from flask import redirect
from collections import defaultdict, Counter
import logging

# Menambahkan direktori root ke path
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT_DIR)

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
from services.image_service import image_bp
from services.frag_service import frag_bp
from services.tgs_service import tgs_bp
from games.app import games_bp
from services.plinko_games_service import plinko_bp

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

# Register semua blueprint
app.register_blueprint(website_bp, url_prefix='/api')
app.register_blueprint(vcr_bp, url_prefix='/api')
app.register_blueprint(pmb_bp, url_prefix='/api')
app.register_blueprint(prd_bp, url_prefix='/api')
app.register_blueprint(ssl_bp, url_prefix='/api')
app.register_blueprint(tmp_bp, url_prefix='/api')
app.register_blueprint(tmp_font_bp, url_prefix='/api')
app.register_blueprint(trx_bp, url_prefix='/api')
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(image_bp, url_prefix='/api/images')
app.register_blueprint(frag_bp)
app.register_blueprint(games_bp, url_prefix='')
app.register_blueprint(tgs_bp)
app.register_blueprint(plinko_bp, url_prefix='/api')

@app.route('/plinko-games')
def serve_plinko_games():
    """Halaman Plinko Games"""
    return send_from_directory(os.path.join(base_dir, 'games', 'html'), 'plinko_games.html')

# ==================== ROUTES UNTUK GAMES ====================

@app.route('/games/css/<path:filename>')
def serve_games_css(filename):
    return send_from_directory(os.path.join(base_dir, 'games', 'css'), filename)

@app.route('/games/js/<path:filename>')
def serve_games_js(filename):
    return send_from_directory(os.path.join(base_dir, 'games', 'js'), filename)

@app.route('/games/<path:filename>')
def serve_games_static(filename):
    return send_from_directory(os.path.join(base_dir, 'games'), filename)

# ==================== ROUTE UNTUK IMAGE SERVICE ====================

@app.route('/ii', methods=['GET'])
def serve_image_direct():
    try:
        from services.image_service import serve_image
        return serve_image()
    except Exception as e:
        print(f"❌ Error serving image: {e}")
        return "Image service error", 500

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
    order_id = request.args.get('order_id', '')
    return redirect(f'/api/fragment/pay?order_id={order_id}')

# Route untuk fragment static files (hanya HTML/CSS/JS, BUKAN API)
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

# ==================== MAIN ====================

if __name__ == '__main__':
    PORT = 5050
    print("="*60)
    print(f"🚀 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 Public Domain: https://companel.shop")
    print("🛡️ Security Features: Enabled")
    print("="*60)
    print("\n📋 Registered Blueprints (API):")
    print("   - website_bp (/api/websites)")
    print("   - vcr_bp (/api/voucher)")
    print("   - pmb_bp (/api/payments)")
    print("   - prd_bp (/api/products)")
    print("   - ssl_bp (/api/social)")
    print("   - tmp_bp (/api/tampilan)")
    print("   - tmp_font_bp (/api/font-templates)")
    print("   - trx_bp (/api/transactions)")
    print("   - user_bp (/api/user)")
    print("   - image_bp (/api/images)")
    print("   - frag_bp (/api/fragment)")
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