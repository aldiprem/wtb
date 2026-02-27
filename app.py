import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, timedelta
import hashlib
import secrets
import traceback
from py import tmp
from py import prd
from py import pmb
from py import ssl
from py import tmp_font
from py import vcr

app = Flask(__name__, static_folder='.')

# Konfigurasi CORS yang longgar untuk development dengan tunnel
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

# ==================== DATABASE SETUP ====================
DATABASE = 'website.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with get_db() as db:
        db.execute('''
            CREATE TABLE IF NOT EXISTS websites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                endpoint TEXT UNIQUE NOT NULL,
                bot_token TEXT NOT NULL,
                owner_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                email TEXT NOT NULL,
                tunnel_url TEXT,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                start_date DATE,
                end_date DATE,
                settings TEXT DEFAULT '{}',
                products TEXT DEFAULT '[]',
                categories TEXT DEFAULT '[]'
            )
        ''')
        print("✅ Database initialized successfully")

init_db()

def hash_password(password):
    salt = secrets.token_hex(16)
    hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${hash_obj.hex()}"

def verify_password(password, hashed):
    salt, hash_str = hashed.split('$')
    hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return hash_obj.hex() == hash_str

def calculate_end_date(start_date, days):
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
    end_date = start_date + timedelta(days=int(days))
    return end_date.strftime('%Y-%m-%d')

# ==================== API ROUTES ====================

@app.route('/')
def serve_index():
    return send_from_directory('.', 'html/dashboard.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/health', methods=['GET', 'OPTIONS'])
def health_check():
    try:
        with get_db() as db:
            db.execute('SELECT 1').fetchone()
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'timestamp': datetime.now().isoformat(),
                'scheme': request.scheme,
                'host': request.host
            })
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/websites', methods=['GET', 'OPTIONS'])
def get_websites():
    try:
        with get_db() as db:
            websites = db.execute('SELECT * FROM websites ORDER BY created_at DESC').fetchall()
            result = []
            for w in websites:
                website_dict = dict(w)
                website_dict['settings'] = json.loads(website_dict['settings'] or '{}')
                website_dict['products'] = json.loads(website_dict['products'] or '[]')
                website_dict['categories'] = json.loads(website_dict['categories'] or '[]')
                result.append(website_dict)
            return jsonify({'success': True, 'websites': result})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>', methods=['GET', 'OPTIONS'])
def get_website(website_id):
    try:
        with get_db() as db:
            website = db.execute('SELECT * FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            website_dict = dict(website)
            website_dict['settings'] = json.loads(website_dict['settings'] or '{}')
            website_dict['products'] = json.loads(website_dict['products'] or '[]')
            website_dict['categories'] = json.loads(website_dict['categories'] or '[]')
            
            return jsonify({'success': True, 'website': website_dict})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/endpoint/<string:endpoint>', methods=['GET', 'OPTIONS'])
def get_website_by_endpoint(endpoint):
    try:
        with get_db() as db:
            website = db.execute('SELECT * FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            website_dict = dict(website)
            
            safe_data = {
                'id': website_dict['id'],
                'endpoint': website_dict['endpoint'],
                'name': website_dict['username'],
                'email': website_dict['email'],
                'tunnel_url': website_dict['tunnel_url'] or '',
                'status': website_dict['status'],
                'settings': json.loads(website_dict['settings'] or '{}'),
                'products': json.loads(website_dict['products'] or '[]'),
                'categories': json.loads(website_dict['categories'] or '[]'),
                'created_at': website_dict['created_at']
            }
            
            return jsonify({'success': True, 'website': safe_data})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites', methods=['POST'])
def create_website():
    try:
        data = request.json
        print(f"📥 Received data: {data}")

        required = ['endpoint', 'bot_token', 'owner_id', 'username', 'password', 'email']
        missing = [f for f in required if f not in data or not data[f]]

        if missing:
            return jsonify({'success': False, 'error': f'Missing: {missing}'}), 400

        endpoint = data['endpoint'].strip().lower()
        if not endpoint.replace('-', '').isalnum():
            return jsonify({'success': False, 'error': 'Invalid endpoint'}), 400

        try:
            owner_id = int(data['owner_id'])
        except:
            return jsonify({'success': False, 'error': 'Owner ID must be number'}), 400

        if '@' not in data['email'] or '.' not in data['email']:
            return jsonify({'success': False, 'error': 'Invalid email'}), 400

        if ':' not in data['bot_token']:
            return jsonify({'success': False, 'error': 'Invalid bot token'}), 400

        hashed_password = hash_password(data['password'])
        start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
        end_date = data.get('end_date', calculate_end_date(start_date, 30))
        
        tunnel_url = request.host_url.rstrip('/')

        with get_db() as db:
            existing = db.execute('SELECT id FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
            if existing:
                return jsonify({'success': False, 'error': 'Endpoint already exists'}), 400

            cursor = db.execute('''
                INSERT INTO websites 
                (endpoint, bot_token, owner_id, username, password, email, tunnel_url, status, start_date, end_date, settings)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                endpoint, data['bot_token'].strip(), owner_id,
                data['username'].strip(), hashed_password,
                data['email'].strip().lower(), tunnel_url,
                'active', start_date, end_date,
                json.dumps(data.get('settings', {}))
            ))

            website_id = cursor.lastrowid
            db.commit()
            print(f"✅ Website created with ID: {website_id}")
            
            # Buat data tampilan default
            try:
                default_tampilan = {
                    'logo': '',
                    'banners': [],
                    'promos': [],
                    'colors': {
                        'primary': '#40a7e3',
                        'secondary': '#FFD700',
                        'background': '#0f0f0f',
                        'text': '#ffffff',
                        'card': '#1a1a1a',
                        'accent': '#10b981'
                    },
                    'font_family': 'Inter',
                    'font_size': 14,
                    'title': data['username'],
                    'description': f'Toko online {data["username"]}',
                    'contact_whatsapp': '',
                    'contact_telegram': ''
                }
                
                tmp.save_tampilan(website_id, default_tampilan)
                print(f"✅ Default tampilan created for website ID: {website_id}")
                
            except Exception as e:
                print(f"⚠️ Warning: Failed to create default tampilan: {e}")

            return jsonify({'success': True, 'website_id': website_id, 'message': 'Website created successfully'})

    except sqlite3.IntegrityError as e:
        print(f"❌ Database error: {str(e)}")
        return jsonify({'success': False, 'error': 'Database error: ' + str(e)}), 400
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>', methods=['PUT'])
def update_website(website_id):
    try:
        data = request.json
        
        with get_db() as db:
            current = db.execute('SELECT * FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not current:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            updates = []
            values = []
            
            update_fields = ['bot_token', 'owner_id', 'username', 'email', 'tunnel_url', 'status']
            for field in update_fields:
                if field in data:
                    updates.append(f"{field} = ?")
                    values.append(data[field])
            
            if data.get('password'):
                updates.append("password = ?")
                values.append(hash_password(data['password']))
            
            if data.get('start_date'):
                updates.append("start_date = ?")
                values.append(data['start_date'])
            
            if data.get('end_date'):
                updates.append("end_date = ?")
                values.append(data['end_date'])
            
            if data.get('settings'):
                updates.append("settings = ?")
                values.append(json.dumps(data['settings']))
            
            updates.append("updated_at = CURRENT_TIMESTAMP")
            
            if updates:
                query = f"UPDATE websites SET {', '.join(updates)} WHERE id = ?"
                values.append(website_id)
                db.execute(query, values)
                db.commit()
            
            return jsonify({'success': True, 'message': 'Website updated successfully'})
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>', methods=['DELETE'])
def delete_website(website_id):
    try:
        with get_db() as db:
            db.execute('DELETE FROM websites WHERE id = ?', (website_id,))
            db.commit()
            return jsonify({'success': True, 'message': 'Website deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/user/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_website_by_user(user_id):
    try:
        with get_db() as db:
            websites = db.execute('SELECT * FROM websites WHERE owner_id = ? ORDER BY created_at DESC', (user_id,)).fetchall()
            result = []
            for w in websites:
                website_dict = dict(w)
                website_dict['settings'] = json.loads(website_dict['settings'] or '{}')
                website_dict['products'] = json.loads(website_dict['products'] or '[]')
                website_dict['categories'] = json.loads(website_dict['categories'] or '[]')
                result.append(website_dict)
            return jsonify({'success': True, 'websites': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/test-bot', methods=['POST'])
def test_bot(website_id):
    try:
        data = request.json
        bot_token = data.get('bot_token')
        tunnel_url = data.get('tunnel_url')
        
        if not bot_token or not tunnel_url:
            return jsonify({'success': False, 'error': 'Bot token and tunnel URL required'}), 400
        
        if ':' not in bot_token:
            return jsonify({'success': False, 'error': 'Invalid bot token format'}), 400
        
        return jsonify({'success': True, 'message': 'Bot test successful'})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== DEBUG ROUTE ====================
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

# ==================== ROUTES UNTUK WEBSITE PUBLIK DAN PANEL ====================

@app.route('/website/<string:endpoint>')
def serve_website(endpoint):
    with get_db() as db:
        website = db.execute('SELECT * FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
        if not website:
            return "Website not found", 404
    return send_from_directory('.', 'website.html')

@app.route('/panel/<string:endpoint>')
def serve_panel(endpoint):
    with get_db() as db:
        website = db.execute('SELECT * FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
        if not website:
            return "Website not found", 404
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

# ==================== ROUTES UNTUK TAMPILAN ====================

@app.route('/api/tampilan/<int:website_id>', methods=['GET'])
def get_tampilan(website_id):
    try:
        data = tmp.get_tampilan(website_id)
        if data:
            return jsonify({'success': True, 'tampilan': data})
        else:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/colors', methods=['POST'])
def save_colors(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        tmp.save_colors(website_id, data)
        return jsonify({'success': True, 'message': 'Colors saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/banners', methods=['POST'])
def save_banners(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        banners = data.get('banners', [])
        for banner in banners:
            if 'url' not in banner:
                return jsonify({'success': False, 'error': 'Each banner must have a URL'}), 400
        
        tmp.save_banners(website_id, banners)
        return jsonify({'success': True, 'message': f'{len(banners)} banners saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/banners/<int:banner_index>', methods=['DELETE'])
def delete_banner(website_id, banner_index):
    try:
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        existing = tmp.get_tampilan(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
        
        banners = existing.get('banners', [])
        if banner_index < 0 or banner_index >= len(banners):
            return jsonify({'success': False, 'error': 'Banner not found'}), 404
        
        banners.pop(banner_index)
        tmp.save_banners(website_id, banners)
        return jsonify({'success': True, 'message': 'Banner deleted successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/font-anim', methods=['POST'])
def save_font_anim(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Deteksi apakah ini request dari fitur baru (dengan target)
        if 'target' in data and 'template_code' in data:
            # Redirect ke endpoint font-style
            return save_font_style(website_id)
        
        # Format data yang kompatibel dengan kedua versi
        font_data = {}
        
        # Ambil data dari request
        if 'store_display_name' in data:
            font_data['store_display_name'] = data['store_display_name']
        if 'font_family' in data:
            font_data['font_family'] = data['font_family']
        if 'font_size' in data:
            font_data['font_size'] = data['font_size']
        if 'font_animation' in data or 'animation' in data:
            font_data['font_animation'] = data.get('font_animation') or data.get('animation', 'none')
        if 'animation_duration' in data:
            font_data['animation_duration'] = data['animation_duration']
        if 'animation_delay' in data:
            font_data['animation_delay'] = data['animation_delay']
        if 'animation_iteration' in data:
            font_data['animation_iteration'] = data['animation_iteration']
        
        # Jika ada data settings (untuk headings/body)
        if 'settings' in data:
            font_data['settings'] = data['settings']
        
        success = tmp.save_font_style(website_id, font_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Font animation saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/logo', methods=['POST'])
def save_logo(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        logo_url = data.get('url', '')
        if logo_url and not (logo_url.lower().endswith('.png') or logo_url.startswith('data:image/png')):
            return jsonify({'success': False, 'error': 'Logo must be PNG format'}), 400
        
        tmp.save_logo(website_id, logo_url)
        return jsonify({'success': True, 'message': 'Logo saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/banners/reorder', methods=['POST'])
def reorder_banners(website_id):
    try:
        data = request.json
        new_order = data.get('order', [])
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        existing = tmp.get_tampilan(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
        
        banners = existing.get('banners', [])
        if len(new_order) == len(banners):
            new_banners = [banners[i] for i in new_order]
            tmp.save_banners(website_id, new_banners)
            return jsonify({'success': True, 'message': 'Banners reordered successfully'})
        else:
            return jsonify({'success': False, 'error': 'Invalid order'}), 400
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promos', methods=['GET'])
def get_promos(website_id):
    try:
        data = tmp.get_promos(website_id)
        return jsonify({'success': True, 'promos': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promos', methods=['POST'])
def save_promos(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        promos = data.get('promos', [])
        for promo in promos:
            if 'title' not in promo or not promo['title']:
                return jsonify({'success': False, 'error': 'Each promo must have a title'}), 400
            if 'banner' not in promo or not promo['banner']:
                return jsonify({'success': False, 'error': 'Each promo must have a banner URL'}), 400
        
        tmp.save_promos(website_id, promos)
        return jsonify({'success': True, 'message': f'{len(promos)} promos saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promos/<int:promo_index>', methods=['DELETE'])
def delete_promo(website_id, promo_index):
    try:
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        existing = tmp.get_promos(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Promos not found'}), 404
        
        if promo_index < 0 or promo_index >= len(existing):
            return jsonify({'success': False, 'error': 'Promo not found'}), 404
        
        existing.pop(promo_index)
        tmp.save_promos(website_id, existing)
        return jsonify({'success': True, 'message': 'Promo deleted successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promos/reorder', methods=['POST'])
def reorder_promos(website_id):
    try:
        data = request.json
        new_order = data.get('order', [])
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        existing = tmp.get_promos(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Promos not found'}), 404
        
        if len(new_order) == len(existing):
            new_promos = [existing[i] for i in new_order]
            tmp.save_promos(website_id, new_promos)
            return jsonify({'success': True, 'message': 'Promos reordered successfully'})
        else:
            return jsonify({'success': False, 'error': 'Invalid order'}), 400
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK PRODUK ====================

@app.route('/api/products/layanan/<int:website_id>', methods=['GET'])
def api_get_layanan(website_id):
    try:
        layanan = prd.get_layanan(website_id)
        return jsonify({'success': True, 'layanan': layanan})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/aplikasi/<int:website_id>/<path:layanan_nama>', methods=['GET'])
def api_get_aplikasi(website_id, layanan_nama):
    try:
        aplikasi = prd.get_aplikasi_by_layanan(website_id, layanan_nama)
        return jsonify({'success': True, 'aplikasi': aplikasi})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/items/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['GET'])
def api_get_items(website_id, layanan_nama, aplikasi_nama):
    try:
        items = prd.get_items_by_aplikasi(website_id, layanan_nama, aplikasi_nama)
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/all/<int:website_id>', methods=['GET'])
def api_get_all_data(website_id):
    try:
        data = prd.get_all_data(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/layanan/<int:website_id>', methods=['POST'])
def api_save_layanan(website_id):
    try:
        data = request.json
        if 'layanan_nama' not in data:
            return jsonify({'success': False, 'error': 'Layanan name required'}), 400
        
        success = prd.save_layanan(website_id, data)
        return jsonify({'success': success, 'message': 'Layanan saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/aplikasi/<int:website_id>/<path:layanan_nama>', methods=['POST'])
def api_save_aplikasi(website_id, layanan_nama):
    try:
        data = request.json
        if 'aplikasi_nama' not in data:
            return jsonify({'success': False, 'error': 'Aplikasi name required'}), 400
        
        success = prd.save_aplikasi(website_id, layanan_nama, data)
        return jsonify({'success': success, 'message': 'Aplikasi saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/item/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['POST'])
def api_save_item(website_id, layanan_nama, aplikasi_nama):
    try:
        data = request.json
        if 'item_nama' not in data:
            return jsonify({'success': False, 'error': 'Item name required'}), 400
        
        success = prd.save_item(website_id, layanan_nama, aplikasi_nama, data)
        return jsonify({'success': success, 'message': 'Item saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/layanan/<int:website_id>/<path:layanan_nama>', methods=['DELETE'])
def api_delete_layanan(website_id, layanan_nama):
    try:
        success = prd.delete_layanan(website_id, layanan_nama)
        if success:
            return jsonify({'success': True, 'message': 'Layanan deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Layanan not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/aplikasi/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['DELETE'])
def api_delete_aplikasi(website_id, layanan_nama, aplikasi_nama):
    try:
        success = prd.delete_aplikasi(website_id, layanan_nama, aplikasi_nama)
        if success:
            return jsonify({'success': True, 'message': 'Aplikasi deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Aplikasi not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/item/<int:item_id>', methods=['DELETE'])
def api_delete_item(item_id):
    try:
        success = prd.delete_item(item_id)
        if success:
            return jsonify({'success': True, 'message': 'Item deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Item not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK ORDERS ====================

@app.route('/api/orders/website/<int:website_id>', methods=['GET', 'OPTIONS'])
def get_orders_by_website(website_id):
    try:
        return jsonify({
            'success': True, 
            'orders': [],
            'message': 'Orders feature coming soon'
        })
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/orders/user/<int:user_id>', methods=['GET', 'OPTIONS'])
def get_orders_by_user(user_id):
    try:
        return jsonify({
            'success': True, 
            'orders': [],
            'message': 'Orders feature coming soon'
        })
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK SOSIAL ====================

@app.route('/api/social/telegram/<int:website_id>', methods=['GET'])
def get_telegram(website_id):
    try:
        data = ssl.get_telegram(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/telegram/<int:website_id>', methods=['POST'])
def save_telegram(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        success = ssl.save_telegram(website_id, data)
        if success:
            return jsonify({'success': True, 'message': 'Telegram settings saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/links/<int:website_id>', methods=['GET'])
def get_links(website_id):
    try:
        data = ssl.get_links(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/links/<int:website_id>', methods=['POST'])
def save_links(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        success = ssl.save_links(website_id, data)
        if success:
            return jsonify({'success': True, 'message': 'Links saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/force/<int:website_id>', methods=['GET'])
def get_force(website_id):
    try:
        data = ssl.get_all_force(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/force/<int:website_id>', methods=['POST'])
def save_force(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        force_id = ssl.save_force(website_id, data)
        if force_id:
            return jsonify({'success': True, 'id': force_id, 'message': 'Force subscribe saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/force/<int:force_id>', methods=['DELETE'])
def delete_force(force_id):
    try:
        success = ssl.delete_force(force_id)
        if success:
            return jsonify({'success': True, 'message': 'Force subscribe deleted'})
        else:
            return jsonify({'success': False, 'error': 'Force subscribe not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/force-settings/<int:website_id>', methods=['GET'])
def get_force_settings(website_id):
    try:
        data = ssl.get_force_settings(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/social/force-settings/<int:website_id>', methods=['POST'])
def save_force_settings(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        success = ssl.save_force_settings(website_id, data)
        if success:
            return jsonify({'success': True, 'message': 'Force settings saved'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK PEMBAYARAN ====================

@app.route('/api/payments/rekening/<int:website_id>', methods=['GET'])
def get_rekening(website_id):
    try:
        rekening = pmb.get_all_rekening(website_id)
        return jsonify({'success': True, 'rekening': rekening})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/payments/rekening/<int:website_id>', methods=['POST'])
def save_rekening(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        rekening_id = pmb.save_rekening(website_id, data)
        if rekening_id:
            return jsonify({'success': True, 'id': rekening_id, 'message': 'Rekening saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save rekening'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/payments/rekening/<int:rekening_id>', methods=['DELETE'])
def delete_rekening(rekening_id):
    try:
        success = pmb.delete_rekening(rekening_id)
        if success:
            return jsonify({'success': True, 'message': 'Rekening deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Rekening not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/payments/gateway/<int:website_id>', methods=['GET'])
def get_gateway(website_id):
    try:
        gateway = pmb.get_all_gateway(website_id)
        return jsonify({'success': True, 'gateway': gateway})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/payments/gateway/<int:website_id>', methods=['POST'])
def save_gateway(website_id):
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        gateway_id = pmb.save_gateway(website_id, data)
        if gateway_id:
            return jsonify({'success': True, 'id': gateway_id, 'message': 'Gateway saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save gateway'}), 500
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/payments/gateway/<int:gateway_id>', methods=['DELETE'])
def delete_gateway(gateway_id):
    try:
        success = pmb.delete_gateway(gateway_id)
        if success:
            return jsonify({'success': True, 'message': 'Gateway deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Gateway not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK FONT TEMPLATES ====================

@app.route('/api/font-templates/save', methods=['POST'])
def save_font_template():
    try:
        data = request.json
        print(f"📥 Saving font template: {data.get('template_name')}")
        print(f"📦 Data lengkap: {data.keys()}")
        
        if not data.get('template_name'):
            return jsonify({'success': False, 'error': 'Template name required'}), 400
        
        if not data.get('font_family'):
            return jsonify({'success': False, 'error': 'Font family required'}), 400
        
        # Log ukuran file font
        if data.get('font_file_data'):
            print(f"📏 Font file size: {len(data['font_file_data'])} characters")
        
        template_code = tmp_font.save_template(
            template_name=data['template_name'],
            font_family=data['font_family'],
            font_file_data=data.get('font_file_data'),
            font_file_name=data.get('font_file_name'),
            font_weight=data.get('font_weight', 400),
            font_style=data.get('font_style', 'normal'),
            font_size=data.get('font_size', 48),
            text_color=data.get('text_color', '#ffffff'),
            animation_type=data.get('animation_type', 'none'),
            animation_duration=data.get('animation_duration', 2),
            animation_delay=data.get('animation_delay', 0),
            animation_iteration=data.get('animation_iteration', 'infinite'),
            preview_text=data.get('preview_text', 'Toko Online Premium'),
            preview_subtext=data.get('preview_subtext', 'dengan Layanan Terbaik 24/7'),
            website_id=data.get('website_id'),
            user_id=data.get('user_id'),
            is_public=data.get('is_public', False)
        )
        
        if template_code:
            # Verifikasi template benar-benar tersimpan
            verify = tmp_font.get_template(template_code)
            if verify:
                print(f"✅ Verifikasi sukses: Template {template_code} ditemukan di database")
                return jsonify({
                    'success': True,
                    'template_code': template_code,
                    'message': f'Template "{data["template_name"]}" saved successfully'
                })
            else:
                print(f"⚠️ Verifikasi gagal: Template {template_code} tidak ditemukan setelah simpan")
                return jsonify({
                    'success': False, 
                    'error': 'Template saved but verification failed'
                }), 500
        else:
            print("❌ save_template returned None")
            return jsonify({'success': False, 'error': 'Failed to save template'}), 500
            
    except Exception as e:
        print(f"❌ Error saving template: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/font-templates/<template_code>', methods=['GET'])
def get_font_template(template_code):
    try:
        print(f"📥 Getting template: {template_code}")
        template = tmp_font.get_template(template_code)
        
        if template:
            return jsonify({'success': True, 'template': template})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error getting template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/font-templates/<template_code>', methods=['DELETE'])
def delete_font_template(template_code):
    try:
        print(f"📥 Deleting template: {template_code}")
        success = tmp_font.delete_template(template_code)
        
        if success:
            return jsonify({'success': True, 'message': 'Template deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error deleting template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/font-templates', methods=['GET'])
def get_all_font_templates():
    try:
        website_id = request.args.get('website_id', type=int)
        user_id = request.args.get('user_id', type=int)
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        popular = request.args.get('popular', default=False, type=bool)
        search = request.args.get('search', default=None, type=str)
        
        print(f"📥 Getting templates - search: {search}, popular: {popular}, limit: {limit}")
        
        if search:
            templates = tmp_font.search_templates(search, limit)
        elif popular:
            templates = tmp_font.get_popular_templates(limit)
        elif website_id:
            templates = tmp_font.get_website_templates(website_id, limit)
        elif user_id:
            templates = tmp_font.get_user_templates(user_id, limit)
        else:
            templates = tmp_font.get_all_templates(limit=limit, offset=offset)
        
        print(f"📤 Returning {len(templates)} templates")
        
        return jsonify({
            'success': True, 
            'templates': templates, 
            'count': len(templates)
        })
        
    except Exception as e:
        print(f"❌ Error getting templates: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False, 
            'error': str(e)
        }), 500

@app.route('/api/font-templates/verify/<template_code>', methods=['GET'])
def verify_font_template(template_code):
    try:
        template = tmp_font.get_template(template_code)
        if template:
            return jsonify({'success': True, 'template': template})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error verifying template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK TEMPLATE PER WEBSITE ====================

@app.route('/api/tampilan/<int:website_id>/templates', methods=['GET'])
def get_website_templates(website_id):
    try:
        templates = tmp.get_website_templates(website_id)
        return jsonify({'success': True, 'templates': templates})
    except Exception as e:
        print(f"❌ Error getting website templates: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/templates', methods=['POST'])
def save_website_template(website_id):
    try:
        data = request.json
        print(f"📥 Saving template for website {website_id}: {data.get('template_name')}")
        
        template_code = data.get('template_code')
        template_name = data.get('template_name')
        template_data = data.get('template_data')
        
        if not template_code or not template_name or not template_data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        success = tmp.save_website_template(website_id, template_code, template_name, template_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Template saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save template'}), 500
            
    except Exception as e:
        print(f"❌ Error saving website template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/templates/<int:template_id>', methods=['DELETE'])
def delete_website_template(website_id, template_id):
    try:
        success = tmp.delete_website_template(template_id)
        if success:
            return jsonify({'success': True, 'message': 'Template deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error deleting website template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/apply-template', methods=['POST'])
def apply_template(website_id):
    try:
        data = request.json
        template_code = data.get('template_code')
        
        template_data = tmp_font.get_template(template_code)
        if not template_data:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
        
        tampilan_update = {
            'font_family': template_data['font_family'],
            'font_size': template_data['font_size'],
            'store_display_name': template_data['preview_text'],
            'font_animation': template_data['animation_type'],
            'animation_duration': template_data['animation_duration'],
            'animation_delay': template_data['animation_delay'],
            'animation_iteration': template_data['animation_iteration']
        }
        
        tmp.update_tampilan(website_id, tampilan_update)
        return jsonify({'success': True, 'message': 'Template applied successfully'})
        
    except Exception as e:
        print(f"❌ Error applying template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK TAMPILAN (TAMBAHKAN ENDPOINT BARU) ====================

@app.route('/api/tampilan/<int:website_id>/font-style', methods=['POST'])
def save_font_style(website_id):
    """
    Menyimpan font style untuk target tertentu (store_name, headings, body, all_text)
    """
    try:
        data = request.json
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Validasi data
        target = data.get('target')
        template_code = data.get('template_code')
        
        if not target or not template_code:
            return jsonify({'success': False, 'error': 'Target dan template code diperlukan'}), 400
        
        # Ambil data template dari database font
        template_data = tmp_font.get_template(template_code)
        if not template_data:
            return jsonify({'success': False, 'error': 'Template tidak ditemukan'}), 404
        
        # Siapkan data update berdasarkan target
        update_data = {}
        
        if target == 'store_name' or target == 'all_text':
            update_data = {
                'font_family': template_data['font_family'],
                'font_size': template_data['font_size'],
                'font_animation': template_data['animation_type'],
                'animation_duration': template_data['animation_duration'],
                'animation_delay': template_data['animation_delay'],
                'animation_iteration': template_data['animation_iteration']
            }
        elif target == 'headings':
            # Untuk headings, kita simpan di settings (JSON) karena tidak ada kolom khusus
            # Ambil settings saat ini
            current = tmp.get_tampilan(website_id)
            settings = current.get('settings', {}) if current else {}
            
            # Update settings
            settings['heading_font_family'] = template_data['font_family']
            settings['heading_font_size'] = template_data['font_size']
            settings['heading_font_animation'] = template_data['animation_type']
            
            update_data = {'settings': settings}
            
        elif target == 'body':
            # Untuk body text
            current = tmp.get_tampilan(website_id)
            settings = current.get('settings', {}) if current else {}
            
            settings['body_font_family'] = template_data['font_family']
            settings['body_font_size'] = template_data['font_size']
            settings['body_font_animation'] = template_data['animation_type']
            
            update_data = {'settings': settings}
        else:
            return jsonify({'success': False, 'error': 'Target tidak valid'}), 400
        
        # Simpan ke database
        success = tmp.save_font_style(website_id, update_data, target)
        
        if success:
            return jsonify({'success': True, 'message': f'Font style diterapkan ke {target}'})
        else:
            return jsonify({'success': False, 'error': 'Gagal menyimpan font style'}), 500
            
    except Exception as e:
        print(f"❌ Error saving font style: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/font-preview', methods=['POST'])
def get_font_preview(website_id):
    """
    Mendapatkan data template untuk preview (tanpa menyimpan)
    """
    try:
        data = request.json
        template_code = data.get('template_code')
        
        if not template_code:
            return jsonify({'success': False, 'error': 'Template code diperlukan'}), 400
        
        template_data = tmp_font.get_template(template_code)
        if not template_data:
            return jsonify({'success': False, 'error': 'Template tidak ditemukan'}), 404
        
        # Kembalikan data template (tanpa file font jika terlalu besar)
        preview_data = {
            'font_family': template_data['font_family'],
            'font_size': template_data['font_size'],
            'font_weight': template_data['font_weight'],
            'font_style': template_data['font_style'],
            'text_color': template_data['text_color'],
            'animation_type': template_data['animation_type'],
            'animation_duration': template_data['animation_duration'],
            'animation_delay': template_data['animation_delay'],
            'animation_iteration': template_data['animation_iteration'],
            'preview_text': template_data['preview_text']
        }
        
        # Sertakan font file data jika ada (untuk preview)
        if template_data.get('font_file_data'):
            preview_data['font_file_data'] = template_data['font_file_data']
        
        return jsonify({'success': True, 'template': preview_data})
        
    except Exception as e:
        print(f"❌ Error getting font preview: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK VOUCHER ====================

@app.route('/api/voucher/<int:website_id>', methods=['GET'])
def get_vouchers(website_id):
    """
    Mendapatkan semua voucher untuk website tertentu
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Ambil parameter filter
        active = request.args.get('active')
        expired = request.args.get('expired')
        type_filter = request.args.get('type')
        search = request.args.get('search')
        
        filters = {}
        if active is not None:
            filters['active'] = active.lower() == 'true'
        if expired is not None:
            filters['expired'] = expired.lower() == 'true'
        if type_filter:
            filters['type'] = type_filter
        if search:
            filters['search'] = search
        
        vouchers = vcr.get_vouchers(website_id, filters)
        
        return jsonify({
            'success': True,
            'vouchers': vouchers,
            'count': len(vouchers)
        })
        
    except Exception as e:
        print(f"❌ Error getting vouchers: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>/<int:voucher_id>', methods=['GET'])
def get_voucher(website_id, voucher_id):
    """
    Mendapatkan voucher berdasarkan ID
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        # Ambil claims
        claims = vcr.get_voucher_claims(voucher_id, limit=100)
        
        return jsonify({
            'success': True,
            'voucher': voucher,
            'claims': claims
        })
        
    except Exception as e:
        print(f"❌ Error getting voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>', methods=['POST'])
def save_voucher(website_id):
    """
    Menyimpan atau update voucher
    """
    try:
        data = request.json
        print(f"📥 Saving voucher for website {website_id}: {data.get('nama')}")
        
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Validasi data
        if not data.get('kode'):
            return jsonify({'success': False, 'error': 'Kode voucher diperlukan'}), 400
        
        if not data.get('nama'):
            return jsonify({'success': False, 'error': 'Nama voucher diperlukan'}), 400
        
        if not data.get('type'):
            return jsonify({'success': False, 'error': 'Tipe reward diperlukan'}), 400
        
        # Cek kode unik (jika baru atau kode diubah)
        if not data.get('id'):
            existing = vcr.get_voucher_by_code(website_id, data['kode'])
            if existing:
                return jsonify({'success': False, 'error': 'Kode voucher sudah digunakan'}), 400
        
        voucher_id = vcr.save_voucher(website_id, data)
        
        if voucher_id:
            return jsonify({
                'success': True,
                'voucher_id': voucher_id,
                'message': f'Voucher "{data["nama"]}" berhasil disimpan'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal menyimpan voucher'}), 500
            
    except Exception as e:
        print(f"❌ Error saving voucher: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>/<int:voucher_id>', methods=['PUT'])
def update_voucher_status(website_id, voucher_id):
    """
    Update status voucher (active/inactive)
    """
    try:
        data = request.json
        print(f"📥 Updating voucher {voucher_id} status")
        
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        active = data.get('active')
        expired = data.get('expired')
        
        success = vcr.update_voucher_status(voucher_id, active, expired)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Status voucher diperbarui'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal memperbarui status'}), 500
            
    except Exception as e:
        print(f"❌ Error updating voucher status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>/<int:voucher_id>', methods=['DELETE'])
def delete_voucher(website_id, voucher_id):
    """
    Hapus voucher
    """
    try:
        print(f"📥 Deleting voucher {voucher_id}")
        
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        success = vcr.delete_voucher(voucher_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Voucher berhasil dihapus'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal menghapus voucher'}), 500
            
    except Exception as e:
        print(f"❌ Error deleting voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>/claims/<int:voucher_id>', methods=['GET'])
def get_voucher_claims(website_id, voucher_id):
    """
    Mendapatkan daftar klaim untuk voucher
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        claims = vcr.get_voucher_claims(voucher_id, limit, offset)
        
        return jsonify({
            'success': True,
            'claims': claims,
            'count': len(claims)
        })
        
    except Exception as e:
        print(f"❌ Error getting voucher claims: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>/broadcast', methods=['POST'])
def broadcast_voucher(website_id):
    """
    Broadcast voucher ke target tertentu
    """
    try:
        data = request.json
        print(f"📥 Broadcasting voucher: {data.get('voucher_id')}")
        
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        voucher_id = data.get('voucher_id')
        target = data.get('target', 'all')
        selected_users = data.get('selected_users', [])
        message = data.get('message')
        
        voucher = vcr.get_voucher(voucher_id)
        if not voucher or voucher['website_id'] != website_id:
            return jsonify({'success': False, 'error': 'Voucher not found'}), 404
        
        broadcast_id = vcr.save_broadcast(voucher_id, target, selected_users, message)
        
        if broadcast_id:
            return jsonify({
                'success': True,
                'broadcast_id': broadcast_id,
                'message': 'Broadcast berhasil dikirim'
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal mengirim broadcast'}), 500
            
    except Exception as e:
        print(f"❌ Error broadcasting voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>/statistics', methods=['GET'])
def get_voucher_statistics(website_id):
    """
    Mendapatkan statistik voucher
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        period = request.args.get('period', 'all')
        
        statistics = vcr.get_statistics(website_id, period)
        top_vouchers = vcr.get_top_vouchers(website_id, 5)
        
        return jsonify({
            'success': True,
            'statistics': statistics,
            'top_vouchers': top_vouchers
        })
        
    except Exception as e:
        print(f"❌ Error getting statistics: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/<int:website_id>/activities', methods=['GET'])
def get_voucher_activities(website_id):
    """
    Mendapatkan aktivitas voucher
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        type_filter = request.args.get('type')
        voucher_id = request.args.get('voucher_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', default=50, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        filters = {}
        if type_filter:
            filters['type'] = type_filter
        if voucher_id:
            filters['voucher_id'] = voucher_id
        if start_date:
            filters['start_date'] = start_date
        if end_date:
            filters['end_date'] = end_date
        
        activities = vcr.get_activities(website_id, filters, limit, offset)
        
        return jsonify({
            'success': True,
            'activities': activities,
            'count': len(activities)
        })
        
    except Exception as e:
        print(f"❌ Error getting activities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK CLAIM VOUCHER (PUBLIC) ====================

@app.route('/api/voucher/claim', methods=['POST'])
def claim_voucher_public():
    """
    Endpoint publik untuk klaim voucher (dari user)
    """
    try:
        data = request.json
        print(f"📥 Claiming voucher: {data.get('kode')}")
        
        website_id = data.get('website_id')
        kode = data.get('kode')
        user_id = data.get('user_id')
        user_username = data.get('username')
        user_name = data.get('name')
        
        if not website_id or not kode or not user_id:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        # Cari voucher berdasarkan kode
        voucher = vcr.get_voucher_by_code(website_id, kode)
        if not voucher:
            return jsonify({'success': False, 'error': 'Voucher tidak ditemukan'}), 404
        
        result = vcr.claim_voucher(voucher['id'], user_id, user_username, user_name)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error claiming voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/use', methods=['POST'])
def use_voucher_public():
    """
    Endpoint publik untuk menggunakan voucher (saat checkout)
    """
    try:
        data = request.json
        print(f"📥 Using voucher claim: {data.get('claim_id')}")
        
        claim_id = data.get('claim_id')
        order_id = data.get('order_id')
        
        if not claim_id:
            return jsonify({'success': False, 'error': 'Claim ID diperlukan'}), 400
        
        result = vcr.use_voucher(claim_id, order_id)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Error using voucher: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/voucher/user/<int:user_id>', methods=['GET'])
def get_user_claims(user_id):
    """
    Mendapatkan semua klaim user
    """
    try:
        website_id = request.args.get('website_id', type=int)
        limit = request.args.get('limit', default=50, type=int)
        
        claims = vcr.get_user_claims(user_id, website_id, limit)
        
        return jsonify({
            'success': True,
            'claims': claims,
            'count': len(claims)
        })
        
    except Exception as e:
        print(f"❌ Error getting user claims: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK WEBSITE PUBLIK (DATA DINAMIS) ====================

@app.route('/api/website/<int:website_id>/products', methods=['GET'])
def api_get_website_products(website_id):
    """
    Mendapatkan semua produk untuk website tertentu (format lengkap)
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        data = prd.get_all_data(website_id)
        
        return jsonify({
            'success': True,
            'data': data,
            'count': len(data)
        })
        
    except Exception as e:
        print(f"❌ Error getting website products: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/website/<int:website_id>/products/filtered', methods=['GET'])
def api_get_filtered_products(website_id):
    """
    Mendapatkan produk yang sudah difilter (untuk performance)
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Ambil semua data
        all_data = prd.get_all_data(website_id)
        
        # Flatten items untuk response yang lebih ringan
        items = []
        for layanan in all_data:
            if layanan.get('aplikasi'):
                for aplikasi in layanan['aplikasi']:
                    if aplikasi.get('items'):
                        for item in aplikasi['items']:
                            items.append({
                                'id': item.get('id'),
                                'item_nama': item.get('item_nama'),
                                'item_harga': item.get('item_harga'),
                                'item_durasi_jumlah': item.get('item_durasi_jumlah'),
                                'item_durasi_satuan': item.get('item_durasi_satuan'),
                                'item_tipe': item.get('item_tipe'),
                                'item_metode': item.get('item_metode'),
                                'item_stok': item.get('item_stok'),
                                'item_ready': item.get('item_ready', 1),
                                'layanan_nama': layanan.get('layanan_nama'),
                                'layanan_gambar': layanan.get('layanan_gambar'),
                                'aplikasi_nama': aplikasi.get('aplikasi_nama'),
                                'aplikasi_gambar': aplikasi.get('aplikasi_gambar'),
                                'terjual': item.get('terjual', 0),
                                'created_at': item.get('created_at')
                            })
        
        return jsonify({
            'success': True,
            'items': items,
            'count': len(items)
        })
        
    except Exception as e:
        print(f"❌ Error getting filtered products: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/website/<int:website_id>/promos', methods=['GET'])
def api_get_website_promos(website_id):
    """
    Mendapatkan semua promo untuk website tertentu
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Ambil dari tmp.py
        promos = tmp.get_promos(website_id)
        
        # Filter promo yang aktif
        active_promos = [p for p in promos if p.get('active', True)]
        
        return jsonify({
            'success': True,
            'promos': active_promos,
            'count': len(active_promos)
        })
        
    except Exception as e:
        print(f"❌ Error getting website promos: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/website/<int:website_id>/rekening', methods=['GET'])
def api_get_website_rekening(website_id):
    """
    Mendapatkan semua rekening aktif untuk website tertentu
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Ambil rekening aktif dari pmb.py
        rekening = pmb.get_active_rekening(website_id)
        
        return jsonify({
            'success': True,
            'rekening': rekening,
            'count': len(rekening)
        })
        
    except Exception as e:
        print(f"❌ Error getting website rekening: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/website/<int:website_id>/tampilan', methods=['GET'])
def api_get_website_tampilan(website_id):
    """
    Mendapatkan data tampilan lengkap untuk website
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Ambil data tampilan
        tampilan = tmp.get_tampilan(website_id)
        
        if not tampilan:
            # Buat default jika belum ada
            default_tampilan = {
                'logo': '',
                'banners': [],
                'promos': [],
                'colors': {
                    'primary': '#40a7e3',
                    'secondary': '#FFD700',
                    'background': '#0f0f0f',
                    'text': '#ffffff',
                    'card': '#1a1a1a',
                    'accent': '#10b981'
                },
                'font_family': 'Inter',
                'font_size': 14,
                'store_display_name': 'Toko Online',
                'font_animation': 'none',
                'animation_duration': 2,
                'animation_delay': 0,
                'animation_iteration': 'infinite'
            }
            return jsonify({'success': True, 'tampilan': default_tampilan})
        
        return jsonify({'success': True, 'tampilan': tampilan})
        
    except Exception as e:
        print(f"❌ Error getting website tampilan: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/website/<int:website_id>/activities', methods=['GET'])
def api_get_website_activities(website_id):
    """
    Mendapatkan aktivitas website (dari voucher, orders, dll)
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        limit = request.args.get('limit', default=50, type=int)
        
        # Ambil aktivitas dari voucher
        activities = vcr.get_activities(website_id, limit=limit)
        
        return jsonify({
            'success': True,
            'activities': activities,
            'count': len(activities)
        })
        
    except Exception as e:
        print(f"❌ Error getting website activities: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK USER AUTH ====================

@app.route('/api/user/check', methods=['POST'])
def api_check_user():
    """
    Cek atau buat user baru berdasarkan data Telegram
    """
    try:
        data = request.json
        user_id = data.get('user_id')
        username = data.get('username')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        photo_url = data.get('photo_url')
        
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID required'}), 400
        
        # Di sini bisa implementasi penyimpanan user ke database
        # Untuk sekarang, kita return sukses saja
        
        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'username': username,
                'first_name': first_name,
                'last_name': last_name,
                'photo_url': photo_url
            }
        })
        
    except Exception as e:
        print(f"❌ Error checking user: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK TRANSAKSI (DUMMY) ====================

@app.route('/api/transactions/user/<int:user_id>', methods=['GET'])
def api_get_user_transactions(user_id):
    """
    Mendapatkan transaksi user (dummy untuk sekarang)
    """
    try:
        website_id = request.args.get('website_id', type=int)
        
        # Return array kosong untuk sekarang
        return jsonify({
            'success': True,
            'transactions': [],
            'balance': 0
        })
        
    except Exception as e:
        print(f"❌ Error getting user transactions: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/transactions/deposit', methods=['POST'])
def api_deposit():
    """
    Endpoint untuk deposit (dummy)
    """
    try:
        data = request.json
        return jsonify({
            'success': True,
            'message': 'Deposit feature coming soon'
        })
        
    except Exception as e:
        print(f"❌ Error processing deposit: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/transactions/withdraw', methods=['POST'])
def api_withdraw():
    """
    Endpoint untuk withdraw (dummy)
    """
    try:
        data = request.json
        return jsonify({
            'success': True,
            'message': 'Withdraw feature coming soon'
        })
        
    except Exception as e:
        print(f"❌ Error processing withdraw: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK STATISTIK WEBSITE ====================

@app.route('/api/website/<int:website_id>/stats', methods=['GET'])
def api_get_website_stats(website_id):
    """
    Mendapatkan statistik website
    """
    try:
        # Cek website
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Hitung produk
        products_data = prd.get_all_data(website_id)
        total_products = 0
        for layanan in products_data:
            if layanan.get('aplikasi'):
                for aplikasi in layanan['aplikasi']:
                    if aplikasi.get('items'):
                        total_products += len(aplikasi['items'])
        
        # Hitung promo
        promos = tmp.get_promos(website_id)
        active_promos = len([p for p in promos if p.get('active', True)])
        
        # Hitung voucher (jika ada)
        vouchers = vcr.get_vouchers(website_id)
        active_vouchers = len([v for v in vouchers if v.get('active') and not v.get('expired')])
        
        return jsonify({
            'success': True,
            'stats': {
                'total_products': total_products,
                'total_layanan': len(products_data),
                'active_promos': active_promos,
                'active_vouchers': active_vouchers,
                'total_vouchers': len(vouchers)
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting website stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    print("="*60)
    print("🚀 Starting Website Management API Server...")
    print(f"📅 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🔗 API available at: http://localhost:5050")
    print("📊 Database: website.db")
    print("="*60)
    print("💡 Gunakan tunnel Cloudflare untuk akses publik:")
    print("   cloudflared tunnel --url http://localhost:5050")
    print("="*60)
    print("📡 Server is running... Press CTRL+C to stop")
    print("="*60)
    app.run(host='0.0.0.0', port=5050, debug=True)