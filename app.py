import os
import sys
import time
import ipaddress
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_cors import CORS
from datetime import datetime
from db_config import get_db_connection
from collections import defaultdict, Counter

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

base_dir = os.path.abspath(os.path.dirname(__file__))

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

# IP ranges yang diketahui jahat (DigitalOcean, AWS, dll)
# Hati-hati: Jangan blokir IP Cloudflare (172.x.x.x, 162.x.x.x)
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
    # Jangan blokir Cloudflare IP
    if is_cloudflare_ip(ip):
        return False
    
    # Jangan blokir localhost
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

# Konfigurasi CORS yang mendukung domain panel Anda
CORS(app, 
     origins=['http://companel.shop', 'https://companel.shop', 'http://localhost:5050'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['*'],
     supports_credentials=True)

# ==================== MIDDLEWARE KEAMANAN ====================

@app.before_request
def security_middleware():
    """
    Middleware keamanan terintegrasi:
    1. Blokir path kritis
    2. Blokir IP mencurigakan
    3. Rate limiting
    4. Deteksi User-Agent mencurigakan
    """
    client_ip = request.remote_addr
    path = request.path
    method = request.method
    
    # ===== 1. BLOCK CRITICAL PATHS (langsung 404) =====
    path_lower = path.lower()
    for bad_path in CRITICAL_BLOCKED_PATHS:
        if bad_path in path_lower:
            track_attack(client_ip, path)
            print(f"🚫 CRITICAL BLOCK: {method} {path} from {client_ip} (matched: {bad_path})")
            abort(404)  # Return 404 seolah-olah tidak ada
    
    # ===== 2. BLOCK SUSPICIOUS IP RANGES =====
    # Jangan blokir Cloudflare IP
    if not is_cloudflare_ip(client_ip):
        if is_ip_blocked(client_ip):
            track_attack(client_ip, path)
            print(f"🚫 IP BLOCKED: {client_ip} from {path}")
            abort(403)
    
    # ===== 3. CHECK SUSPICIOUS USER-AGENT =====
    is_suspicious, bad_ua = is_suspicious_user_agent()
    if is_suspicious and not path.startswith('/api/'):
        # Jangan blokir API requests meskipun User-Agent mencurigakan
        # Tapi tetap track
        track_attack(client_ip, path)
        print(f"⚠️ SUSPICIOUS UA: {client_ip} -> {bad_ua} on {path}")
        # Untuk non-API, beri rate limit ketat (akan di-handle di step 4)
    
    # ===== 4. RATE LIMITING =====
    current_time = time.time()
    
    # Tentukan konfigurasi rate limit berdasarkan path
    if path.startswith('/api/'):
        limit_config = RATE_LIMIT_CONFIG['api']
    elif path.startswith(('/css/', '/js/', '/html/', '/static/')):
        limit_config = RATE_LIMIT_CONFIG['static']
    elif any(bad in path_lower for bad in SUSPICIOUS_PATHS):
        limit_config = RATE_LIMIT_CONFIG['strict']
    else:
        limit_config = RATE_LIMIT_CONFIG['default']
    
    # Bersihkan request lama
    request_counts[client_ip] = [
        t for t in request_counts[client_ip] 
        if current_time - t < limit_config['window']
    ]
    
    # Cek rate limit
    if len(request_counts[client_ip]) > limit_config['requests']:
        track_attack(client_ip, path)
        print(f"🚫 RATE LIMITED: {client_ip} - {len(request_counts[client_ip])} requests in {limit_config['window']}s")
        abort(429)
    
    request_counts[client_ip].append(current_time)
    
    # ===== 5. LOG UNTUK REQUEST NORMAL =====
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
    return jsonify({
        'error': 'Access forbidden',
        'message': 'Your IP has been blocked due to suspicious activity'
    }), 403

@app.errorhandler(404)
def not_found_handler(e):
    return jsonify({
        'error': 'Not found',
        'message': 'The requested resource was not found'
    }), 404

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        'error': 'Too many requests',
        'message': 'Please slow down and try again later',
        'retry_after': 60
    }), 429

@app.errorhandler(500)
def internal_error_handler(e):
    return jsonify({
        'error': 'Internal server error',
        'message': 'Something went wrong on our end'
    }), 500

# ==================== ENDPOINT MONITORING ====================

@app.route('/api/admin/security/stats', methods=['GET'])
def get_security_stats():
    """
    Endpoint untuk melihat statistik serangan (admin only)
    TODO: Tambahkan autentikasi admin
    """
    # Sementara tanpa auth untuk debugging
    # TODO: Tambahkan API key atau session check
    
    stats = []
    now = int(time.time())
    
    for ip, data in attack_stats.items():
        # Hanya tampilkan yang aktif dalam 1 jam terakhir
        if now - data['last_seen'] < 3600:
            stats.append({
                'ip': ip,
                'is_cloudflare': is_cloudflare_ip(ip),
                'total_attacks': data['count'],
                'last_seen': datetime.fromtimestamp(data['last_seen']).isoformat(),
                'top_paths': dict(data['paths'].most_common(10))
            })
    
    # Urutkan berdasarkan total attacks terbanyak
    stats.sort(key=lambda x: x['total_attacks'], reverse=True)
    
    return jsonify({
        'success': True,
        'total_active_attackers': len(stats),
        'attackers': stats[:50],  # Limit 50
        'rate_limit_stats': {
            'total_ips_in_memory': len(request_counts),
            'config': RATE_LIMIT_CONFIG
        }
    })

@app.route('/api/admin/security/clear', methods=['POST'])
def clear_security_stats():
    """
    Reset statistik keamanan (admin only)
    """
    # TODO: Tambahkan autentikasi admin
    
    global attack_stats, request_counts
    attack_stats.clear()
    request_counts.clear()
    
    return jsonify({
        'success': True,
        'message': 'Security statistics cleared'
    })

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

# ==================== ROUTE UNTUK IMAGE SERVICE (LANGSUNG) ====================
@app.route('/ii', methods=['GET'])
def serve_image_direct():
    """Route untuk mengakses gambar dengan format /ii?premy=hash"""
    try:
        from services.image_service import serve_image
        return serve_image()
    except Exception as e:
        print(f"❌ Error serving image: {e}")
        return "Image service error", 500

# ==================== STATIC ROUTES (SERVING HTML) ====================

@app.route('/')
@app.route('/dashboard')
def serve_dashboard():
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

# ==================== DATABASE INIT & HEALTH CHECK ====================

def init_mysql_tables():
    """Inisialisasi tabel utama MySQL jika belum tersedia"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Tabel websites
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
        
        # Tabel untuk security log (opsional)
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

def log_security_event(ip, path, method, user_agent, reason):
    """Log event keamanan ke database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO security_logs (ip, path, method, user_agent, reason)
            VALUES (%s, %s, %s, %s, %s)
        ''', (ip, path[:500], method, user_agent[:255] if user_agent else None, reason))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"⚠️ Failed to log security event: {e}")

@app.route('/api/health')
def health_check():
    """Endpoint untuk memantau kesehatan server dan koneksi database"""
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
        return jsonify({
            'status': 'unhealthy', 
            'error': str(e)
        }), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    # Jalankan inisialisasi tabel saat startup
    init_mysql_tables()
    
    PORT = 5050
    print("="*60)
    print(f"🚀 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 Public Domain: https://companel.shop")
    print("📊 Database: MySQL (wtb_database)")
    print("🛡️ Security Features: Enabled")
    print("="*60)
    print("\n📋 Registered API Routes:")
    for rule in app.url_map.iter_rules():
        if rule.endpoint not in ['static', 'serve_dashboard', 'serve_tampilan_page', 'serve_main_panel', 'serve_admin_panel', 'serve_website', 'serve_html_subfolder', 'serve_html_root', 'serve_js', 'serve_css', 'serve_static', 'favicon', 'handle_options', 'debug_routes', 'get_security_stats', 'clear_security_stats']:
            print(f"   {rule.methods} {rule}")
    print("="*60)
    print("\n🛡️ Security Configuration:")
    print(f"   - Critical blocked paths: {len(CRITICAL_BLOCKED_PATHS)} patterns")
    print(f"   - Suspicious IP ranges: {len(SUSPICIOUS_IP_RANGES)} ranges")
    print(f"   - Rate limiting: API(120/min), Default(60/min), Strict(10/min)")
    print("="*60)
    
    # Jalankan Flask app
    app.run(host='0.0.0.0', port=PORT, debug=False) 