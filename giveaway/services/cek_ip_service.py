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

DASHBOARD_HTML = '''
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>IP Tracker Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: #0a0e27;
            color: #e0e0e0;
            padding: 20px;
            min-height: 100vh;
        }
        .container { max-width: 1400px; margin: auto; }
        h1 { color: #00ff88; margin-bottom: 10px; border-left: 4px solid #00ff88; padding-left: 20px; font-size: 24px; }
        .subtitle { color: #888; margin-bottom: 30px; padding-left: 24px; font-size: 14px; }
        .stats { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
        .stat-card {
            background: #11162e; padding: 20px; border-radius: 15px;
            flex: 1; min-width: 150px; border: 1px solid #1f2a4e;
        }
        .stat-card h3 { color: #888; font-size: 13px; margin-bottom: 10px; }
        .stat-card .number { font-size: 32px; font-weight: bold; color: #00ff88; }
        table { width: 100%; border-collapse: collapse; background: #11162e; border-radius: 15px; overflow: hidden; }
        th { background: #1a2340; padding: 14px 12px; text-align: left; font-size: 12px; color: #888; font-weight: 600; }
        td { padding: 12px; border-bottom: 1px solid #1f2a4e; font-size: 13px; }
        tr:hover { background: #1a2340; }
        .user-cell { display: flex; align-items: center; gap: 10px; }
        .user-avatar {
            width: 36px; height: 36px; border-radius: 50%;
            background: linear-gradient(135deg, #40a7e3, #2d8bcb);
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; flex-shrink: 0;
        }
        .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .user-avatar i { font-size: 16px; color: white; }
        .user-name { font-weight: 600; font-size: 14px; }
        .user-username { font-size: 11px; color: #40a7e3; }
        .ip-cell { font-family: monospace; color: #00ff88; font-weight: 600; }
        .location-badge {
            display: flex; align-items: center; gap: 4px;
            font-size: 12px;
        }
        .map-link { color: #ffaa00; text-decoration: none; font-size: 11px; margin-left: 6px; }
        .map-link:hover { text-decoration: underline; }
        .refresh-btn {
            background: #00ff88; color: #0a0e27; border: none;
            padding: 10px 24px; border-radius: 10px; cursor: pointer;
            margin-bottom: 20px; font-weight: 600; font-size: 14px;
        }
        .refresh-btn:hover { background: #00cc66; }
        .empty-state { text-align: center; padding: 50px; color: #666; }
        .empty-state i { font-size: 48px; margin-bottom: 16px; display: block; }
        @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        .live-dot { animation: blink 1s infinite; color: #ff4444; }
        .time-cell { font-size: 11px; color: #888; white-space: nowrap; }
        .device-cell { font-size: 10px; color: #666; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 768px) {
            .stats { flex-direction: column; }
            table { font-size: 11px; }
            th, td { padding: 8px 6px; }
            .user-name { font-size: 12px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📍 IP TRACKER DASHBOARD</h1>
        <div class="subtitle">
            Real-time IP Logger dengan Identifikasi User Telegram |
            Total Tertangkap: <strong>{{ stats.total }}</strong> <span class="live-dot">● LIVE</span>
        </div>
        <div class="stats">
            <div class="stat-card">
                <h3><i class="fas fa-globe"></i> Total Captures</h3>
                <div class="number">{{ stats.total }}</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-network-wired"></i> Unique IPs</h3>
                <div class="number">{{ stats.unique_ips }}</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-users"></i> Unique Users</h3>
                <div class="number">{{ stats.unique_users }}</div>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-calendar-day"></i> Hari Ini</h3>
                <div class="number">{{ stats.today_count }}</div>
            </div>
        </div>
        <button class="refresh-btn" onclick="location.reload()">
            <i class="fas fa-sync-alt"></i> Refresh Data
        </button>
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
                    <td class="time-cell">{{ item.created_at[:16] if item.created_at else '-' }}</td>
                    <td><span class="ip-cell">{{ item.ip }}</span></td>
                    <td>
                        <span class="location-badge">
                            <i class="fas fa-map-marker-alt" style="color: #ff4444;"></i>
                            {{ item.city or 'Unknown' }}, {{ item.country or 'Unknown' }}
                        </span>
                        {% if item.lat and item.lon and item.lat != 0 %}
                        <a href="https://www.google.com/maps?q={{ item.lat }},{{ item.lon }}" target="_blank" class="map-link">
                            <i class="fas fa-external-link-alt"></i> Maps
                        </a>
                        {% endif %}
                    </td>
                    <td style="font-size: 11px; color: #aaa;">{{ item.isp or '-' }}</td>
                    <td>
                        {% if item.user_id %}
                        <div class="user-cell">
                            <div class="user-avatar">
                                {% if item.photo_url %}
                                <img src="{{ item.photo_url }}" alt="avatar" onerror="this.innerHTML='<i class=\\'fas fa-user\\'></i>'">
                                {% else %}
                                <i class="fas fa-user"></i>
                                {% endif %}
                            </div>
                            <div>
                                <div class="user-name">{{ item.first_name or '' }} {{ item.last_name or '' }}</div>
                                <div class="user-username">
                                    {% if item.username %}@{{ item.username }}{% else %}ID: {{ item.user_id }}{% endif %}
                                </div>
                            </div>
                        </div>
                        {% else %}
                        <span style="color: #666;">Non-Telegram</span>
                        {% endif %}
                    </td>
                    <td class="device-cell" title="{{ item.user_agent or '' }}">
                        {{ (item.user_agent or 'Unknown')[:50] }}{% if (item.user_agent or '')|length > 50 %}...{% endif %}
                    </td>
                </tr>
                {% else %}
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>Belum ada data IP yang terekam</p>
                            <p style="font-size: 12px; margin-top: 8px;">Data akan muncul setelah user membuka halaman giveaway</p>
                        </div>
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>
    <script>
        setTimeout(() => location.reload(), 30000);
    </script>
</body>
</html>
'''

@cek_ip_bp.route('/dashboard')
def dashboard():
    """Halaman dashboard untuk melihat data tracking IP"""
    print(f"[CEK-IP] Dashboard accessed from {request.remote_addr}")
    data = db.get_all_ip_tracking(limit=200)
    stats = db.get_statistics()
    return render_template_string(DASHBOARD_HTML, data=data, stats=stats)

@cek_ip_bp.route('/track', methods=['POST'])
def track_ip():
    """Endpoint untuk tracking IP (dengan data Telegram user)"""
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
        
        return jsonify({'success': True, 'message': 'IP tracked successfully'})
    except Exception as e:
        print(f"[IP Track Error] {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@cek_ip_bp.route('/track-direct', methods=['POST'])
def track_ip_direct():
    """Endpoint tracking langsung TANPA CAPTCHA — dipanggil dari giveaway.js"""
    try:
        req_data = request.get_json()
        user = req_data.get('user', {})
        geo = req_data.get('geo', {})
        ua = req_data.get('user_agent', 'Unknown')
        ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        
        if geo.get('ip') and geo.get('ip') != 'unknown':
            city = geo.get('city', 'Unknown')
            country = geo.get('country', 'Unknown')
            lat = geo.get('lat', 0)
            lon = geo.get('lon', 0)
            isp = geo.get('isp', geo.get('org', 'Unknown'))
        else:
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
            'data': {'ip': ip, 'location': f'{city}, {country}'}
        })
    except Exception as e:
        print(f"[IP Track Direct Error] {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@cek_ip_bp.route('/user/<int:user_id>')
def get_user_ips(user_id):
    data = db.get_ip_tracking_by_user(user_id)
    return jsonify({'success': True, 'user_id': user_id, 'total': len(data), 'data': data})

@cek_ip_bp.route('/ip/<ip>')
def get_ip_info(ip):
    data = db.get_ip_tracking_by_ip(ip)
    return jsonify({'success': True, 'ip': ip, 'total': len(data), 'data': data})

@cek_ip_bp.route('/stats')
def get_stats():
    stats = db.get_statistics()
    return jsonify({'success': True, 'stats': stats})