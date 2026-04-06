import os
import sys
import time
import ipaddress
import sqlite3
import hashlib
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, abort, redirect, session
from flask_cors import CORS
from db_config import get_db_connection
from collections import defaultdict, Counter
import logging

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
from services.image_service import image_bp
from services.frag_service import frag_bp

from fragment.database.data import (
    authenticate_panel_user, create_panel_session, validate_panel_session,
    delete_panel_session, get_panel_user_by_bot_token, get_all_stats,
    get_cloned_bots, get_bot_stats, get_bot_logs, get_user_stats,
    get_jakarta_time_iso, get_chart_data, get_recent_activities,
    get_all_users_with_stats
)

base_dir = os.path.abspath(os.path.dirname(__file__))

# Setup logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Database path untuk SQLite - path ke fragment/frag.db
DB_PATH = str(Path(__file__).parent / "fragment" / "frag.db")

# ==================== KONFIGURASI KEAMANAN ====================

# Rate limiting configuration
RATE_LIMIT_CONFIG = {
    'default': {'requests': 60, 'window': 60},      # 60 requests per minute
    'api': {'requests': 120, 'window': 60},         # 120 requests per minute untuk API
    'static': {'requests': 30, 'window': 60},       # 30 requests per minute untuk static
    'strict': {'requests': 10, 'window': 60},       # 10 requests per minute untuk path mencurigakan
}

# Path yang sangat mencurigakan (langsung blokir)
CRITICAL_BLOCKED_PATHS = [
    'wp-admin', 'wp-content', 'wp-includes', 'wordpress',
    'lander', 'sberbank', 'quiz', 'setup-config',
    'HNAP1', 'solr', 'cgi-bin', 'evox', 'sdk',
    'v2/_catalog', 'query', 'odinhttpcall',
    '.env', '.git', 'config.php', 'xmlrpc.php'
]

# Path yang mencurigakan (rate limit ketat)
SUSPICIOUS_PATHS = [
    '/admin', '/login', '/backup', '/dump', '/sql',
    '/phpmyadmin', '/pma', '/mysql', '/db',
    '/shell', '/cmd', '/exec', '/system'
]

# IP ranges yang diketahui jahat
SUSPICIOUS_IP_RANGES = [
    '164.90.0.0/16',   # DigitalOcean
    '64.225.0.0/16',   # DigitalOcean
    '167.71.0.0/16',   # DigitalOcean
    '209.38.0.0/16',   # DigitalOcean
    '104.248.0.0/16',  # DigitalOcean
    '45.55.0.0/16',    # DigitalOcean
    '159.89.0.0/16',   # DigitalOcean
    '138.68.0.0/16',   # DigitalOcean
]

# User-Agent yang mencurigakan
SUSPICIOUS_USER_AGENTS = [
    'nikto', 'sqlmap', 'masscan', 'nmap', 'wpscan',
    'python-requests', 'curl', 'wget', 'Go-http-client',
    'Mozilla/5.0 (compatible; Nmap Scripting Engine)',
    'ZmEu', 'Morfeus', 'Fucking Scanner'
]

# ==================== STATE UNTUK MONITORING ====================

request_counts = defaultdict(list)
attack_stats = defaultdict(lambda: {'count': 0, 'paths': Counter(), 'last_seen': 0})

# ==================== FUNGSI UTILITY KEAMANAN ====================

def is_cloudflare_ip(ip):
    """Cek apakah IP berasal dari Cloudflare"""
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
    """Cek apakah IP termasuk dalam blacklist"""
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
    """Cek apakah User-Agent mencurigakan"""
    user_agent = request.headers.get('User-Agent', '')
    user_agent_lower = user_agent.lower()
    
    for bad_ua in SUSPICIOUS_USER_AGENTS:
        if bad_ua.lower() in user_agent_lower:
            return True, bad_ua
    return False, None

def track_attack(ip, path):
    """Track serangan untuk monitoring"""
    attack_stats[ip]['count'] += 1
    attack_stats[ip]['paths'][path] += 1
    attack_stats[ip]['last_seen'] = int(time.time())

# ==================== INISIALISASI FLASK APP ====================

app = Flask(__name__, static_folder='.')
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Konfigurasi CORS
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
    """Middleware keamanan terintegrasi"""
    client_ip = request.remote_addr
    path = request.path
    method = request.method
    
    # BLOCK CRITICAL PATHS
    path_lower = path.lower()
    for bad_path in CRITICAL_BLOCKED_PATHS:
        if bad_path in path_lower:
            track_attack(client_ip, path)
            print(f"🚫 CRITICAL BLOCK: {method} {path} from {client_ip}")
            abort(404)
    
    # BLOCK SUSPICIOUS IP RANGES
    if not is_cloudflare_ip(client_ip):
        if is_ip_blocked(client_ip):
            track_attack(client_ip, path)
            print(f"🚫 IP BLOCKED: {client_ip} from {path}")
            abort(403)
    
    # CHECK SUSPICIOUS USER-AGENT
    is_suspicious, bad_ua = is_suspicious_user_agent()
    if is_suspicious and not path.startswith('/api/'):
        track_attack(client_ip, path)
        print(f"⚠️ SUSPICIOUS UA: {client_ip} -> {bad_ua} on {path}")
    
    # RATE LIMITING
    current_time = time.time()
    
    if path.startswith('/api/'):
        limit_config = RATE_LIMIT_CONFIG['api']
    elif path.startswith(('/css/', '/js/', '/html/', '/static/', '/fragment/')):
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
    """Tambahkan security headers ke response"""
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

# ==================== FRAGMENT BOT DASHBOARD ROUTES ====================

# Session validation decorator
def require_session(f):
    """Decorator to validate panel session"""
    def wrapper(*args, **kwargs):
        session_token = request.headers.get('X-Session-Token')
        if not session_token:
            return jsonify({'success': False, 'error': 'No session token'}), 401
        
        user_session = validate_panel_session(session_token)
        if not user_session:
            return jsonify({'success': False, 'error': 'Invalid or expired session'}), 401
        
        request.user_session = user_session
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__
    return wrapper

# Fragment static routes
@app.route('/fragment/login')
def fragment_login_page():
    """Halaman login untuk Fragment Bot Admin"""
    # Cek apakah sudah login via session cookie
    session_token = request.cookies.get('session_token')
    if session_token:
        user_session = validate_panel_session(session_token)
        if user_session:
            return redirect('/fragment/dashboard')
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), 'login.html')

@app.route('/fragment/dashboard')
def fragment_dashboard_page():
    """Halaman dashboard Fragment Bot Admin"""
    session_token = request.args.get('user') or request.cookies.get('session_token')
    
    if not session_token:
        return redirect('/fragment/login')
    
    user_session = validate_panel_session(session_token)
    if not user_session:
        return redirect('/fragment/login')
    
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), 'dashboard.html')

# Fragment API Routes
@app.route('/api/fragment/login', methods=['POST'])
def fragment_login_api():
    """API login untuk Fragment Bot Admin"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'Username dan password wajib diisi'}), 400
        
        user = authenticate_panel_user(username, password)
        if not user:
            return jsonify({'success': False, 'error': 'Username atau password salah'}), 401
        
        # Create session
        session_token = create_panel_session(
            user['id'], 
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        
        if not session_token:
            return jsonify({'success': False, 'error': 'Gagal membuat session'}), 500
        
        return jsonify({
            'success': True,
            'session_token': session_token,
            'user': {
                'id': user['id'],
                'username': user['username']
            }
        })
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/fragment/logout', methods=['POST'])
@require_session
def fragment_logout_api():
    """API logout untuk Fragment Bot Admin"""
    session_token = request.headers.get('X-Session-Token')
    delete_panel_session(session_token)
    return jsonify({'success': True})

@app.route('/api/fragment/profile', methods=['GET'])
@require_session
def fragment_profile_api():
    """API untuk mendapatkan profil user yang sedang login"""
    user_session = request.user_session
    return jsonify({
        'success': True,
        'profile': {
            'id': user_session['user_id'],
            'username': user_session['username'],
            'bot_token': user_session.get('bot_token'),
            'created_at': get_jakarta_time_iso(),
            'last_login': get_jakarta_time_iso()
        }
    })

@app.route('/api/fragment/dashboard/stats', methods=['GET'])
@require_session
def fragment_dashboard_stats_api():
    """API untuk mendapatkan statistik dashboard"""
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        
        # Get bot info
        bots = get_cloned_bots()
        total_bots = len(bots)
        running_bots = len([b for b in bots if b.get('status') == 'running'])
        
        # Get overall stats
        all_stats = get_all_stats(bot_token)
        
        # Get chart data (7 days)
        chart_data = get_chart_data(bot_token, days=7)
        
        # Get recent activities
        activities = get_recent_activities(bot_token, limit=20)
        
        return jsonify({
            'success': True,
            'stats': {
                'total_bots': total_bots,
                'running_bots': running_bots,
                'total_users': all_stats.get('total_users', 0),
                'total_stars': all_stats.get('total_stars', 0),
                'total_volume': all_stats.get('total_volume_idr', 0),
                'total_purchases': all_stats.get('total_purchases', 0),
                'today_purchases': all_stats.get('today_purchases', 0),
                'today_stars': all_stats.get('today_stars', 0),
                'today_volume': all_stats.get('today_volume_idr', 0)
            },
            'chart': {
                'labels': chart_data.get('labels', []),
                'values': chart_data.get('values', [])
            },
            'activities': [
                {
                    'id': a.get('id'),
                    'message': a.get('details', a.get('action', '')),
                    'timestamp': a.get('timestamp'),
                    'icon': 'star' if 'stars' in str(a.get('details', '')) else 'user'
                }
                for a in activities
            ]
        })
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/fragment/bot/info', methods=['GET'])
@require_session
def fragment_bot_info_api():
    """API untuk mendapatkan informasi bot yang terkait dengan user"""
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        
        # Get bot info from cloned_bots
        bots = get_cloned_bots()
        bot_info = None
        
        for bot in bots:
            if bot_token and bot.get('bot_token') == bot_token:
                bot_info = bot
                break
            elif not bot_token:
                # If no specific bot token, return first bot
                bot_info = bot
                break
        
        if bot_info:
            stats = get_bot_stats(bot_info['bot_token'])
            return jsonify({
                'success': True,
                'bot': {
                    'id': bot_info.get('id'),
                    'bot_token': bot_info.get('bot_token'),
                    'bot_username': bot_info.get('bot_username'),
                    'bot_name': bot_info.get('bot_name'),
                    'status': bot_info.get('status'),
                    'created_at': bot_info.get('created_at'),
                    'last_started': bot_info.get('last_started'),
                    'last_stopped': bot_info.get('last_stopped'),
                    'stats': stats
                }
            })
        
        return jsonify({'success': True, 'bot': None})
    except Exception as e:
        logger.error(f"Error getting bot info: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/fragment/users/list', methods=['GET'])
@require_session
def fragment_users_list_api():
    """API untuk mendapatkan daftar user beserta statistiknya"""
    try:
        user_session = request.user_session
        bot_token = user_session.get('bot_token')
        limit = request.args.get('limit', 50, type=int)
        
        users = get_all_users_with_stats(bot_token, limit)
        
        return jsonify({
            'success': True,
            'users': users,
            'total': len(users)
        })
    except Exception as e:
        logger.error(f"Error getting users list: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/fragment/bots/list', methods=['GET'])
@require_session
def fragment_bots_list_api():
    """API untuk mendapatkan daftar semua bot clone"""
    try:
        bots = get_cloned_bots()
        
        # Add stats for each bot
        for bot in bots:
            stats = get_bot_stats(bot['bot_token'])
            bot['stats'] = stats
        
        return jsonify({
            'success': True,
            'bots': bots,
            'total': len(bots)
        })
    except Exception as e:
        logger.error(f"Error getting bots list: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/fragment/bot/logs', methods=['GET'])
@require_session
def fragment_bot_logs_api():
    """API untuk mendapatkan log bot"""
    try:
        bot_username = request.args.get('bot_username')
        limit = request.args.get('limit', 50, type=int)
        
        if not bot_username:
            return jsonify({'success': False, 'error': 'bot_username required'}), 400
        
        logs = get_bot_logs(bot_username, limit)
        
        return jsonify({
            'success': True,
            'logs': [
                {
                    'level': log[0],
                    'message': log[1],
                    'timestamp': log[2]
                }
                for log in logs
            ]
        })
    except Exception as e:
        logger.error(f"Error getting bot logs: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== MONITORING ENDPOINTS ====================

@app.route('/api/admin/security/stats', methods=['GET'])
def get_security_stats():
    """Endpoint untuk melihat statistik serangan"""
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

@app.route('/api/admin/security/clear', methods=['POST'])
def clear_security_stats():
    """Reset statistik keamanan"""
    global attack_stats, request_counts
    attack_stats.clear()
    request_counts.clear()
    return jsonify({'success': True, 'message': 'Security statistics cleared'})

# ==================== ROUTE REGISTRATION ====================

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
app.register_blueprint(image_bp, url_prefix='/api/images')
app.register_blueprint(frag_bp)

# ==================== ROUTE DEBUG ====================

@app.route('/api/debug/routes', methods=['GET'])
def debug_routes():
    """Debug endpoint to list all registered routes"""
    routes = []
    for rule in app.url_map.iter_rules():
        if not rule.endpoint.startswith('serve_'):
            routes.append({
                'endpoint': rule.endpoint,
                'methods': list(rule.methods),
                'path': str(rule)
            })
    return jsonify({'routes': routes})

# ==================== ROUTE UNTUK IMAGE SERVICE ====================

@app.route('/ii', methods=['GET'])
def serve_image_direct():
    """Route untuk mengakses gambar dengan format /ii?premy=hash"""
    try:
        from services.image_service import serve_image
        return serve_image()
    except Exception as e:
        print(f"❌ Error serving image: {e}")
        return "Image service error", 500

# ==================== STATIC ROUTES ====================

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

@app.route('/fragment')
def serve_fragment_page():
    return send_from_directory(os.path.join(base_dir, 'fragment', 'html'), 'frag.html')

# Static file routes untuk fragment
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

# ==================== DATABASE INIT ====================

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
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS security_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ip VARCHAR(45) NOT NULL,
                path VARCHAR(500) NOT NULL,
                method VARCHAR(10),
                user_agent TEXT,
                reason VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_security_ip (ip),
                INDEX idx_security_created (created_at)
            )
        ''')
        
        conn.commit()
        cursor.close()
        conn.close()
        print("✅ MySQL Tables checked/initialized")
    except Exception as e:
        print(f"❌ MySQL Init Error: {e}")

# ==================== HEALTH CHECK ====================

@app.route('/api/health')
def health_check():
    """Endpoint untuk memantau kesehatan server"""
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({
            'status': 'healthy',
            'mysql': 'connected',
            'timestamp': datetime.now().isoformat(),
            'security': {
                'active_rate_limits': len(request_counts),
                'total_attacks_tracked': sum(d['count'] for d in attack_stats.values())
            }
        })
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    init_mysql_tables()
    
    PORT = 5050
    print("="*60)
    print(f"🚀 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 Public Domain: https://companel.shop")
    print("📊 Database: MySQL (wtb_database) & SQLite (fragment/frag.db)")
    print("🛡️ Security Features: Enabled")
    print("="*60)
    print("\n📋 Fragment Dashboard Routes:")
    print("   GET  /fragment/login")
    print("   GET  /fragment/dashboard")
    print("   POST /api/fragment/login")
    print("   POST /api/fragment/logout")
    print("   GET  /api/fragment/profile")
    print("   GET  /api/fragment/dashboard/stats")
    print("   GET  /api/fragment/bot/info")
    print("   GET  /api/fragment/users/list")
    print("   GET  /api/fragment/bots/list")
    print("   GET  /api/fragment/bot/logs")
    print("="*60)
    
    app.run(host='0.0.0.0', port=PORT, debug=False)