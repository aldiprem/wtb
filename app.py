import os
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
from datetime import datetime, timedelta
import hashlib
import secrets
import tmp
import traceback
import prd

app = Flask(__name__, static_folder='.')

# Konfigurasi CORS yang longgar untuk development dengan tunnel
CORS(app, 
     origins='*',  # Izinkan semua origin untuk testing
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['*'],
     supports_credentials=True)

# Middleware untuk menangani proxy headers dari Cloudflare
@app.before_request
def before_request():
    # Jika ada header X-Forwarded-Proto, gunakan itu
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
        # Create websites table
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
        print(f"📥 Request headers: {dict(request.headers)}")
        print(f"📥 Request origin: {request.headers.get('Origin', 'None')}")

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

        # Validasi email
        if '@' not in data['email'] or '.' not in data['email']:
            return jsonify({'success': False, 'error': 'Invalid email'}), 400

        # Validasi bot token
        if ':' not in data['bot_token']:
            return jsonify({'success': False, 'error': 'Invalid bot token'}), 400

        hashed_password = hash_password(data['password'])
        start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
        end_date = data.get('end_date', calculate_end_date(start_date, 30))
        
        # Gunakan host URL dari request
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

@app.route('/api/websites/<int:website_id>/products', methods=['GET', 'OPTIONS'])
def get_products(website_id):
    try:
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            return jsonify({'success': True, 'products': products})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/products', methods=['POST'])
def add_product(website_id):
    try:
        data = request.json
        
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            
            new_id = 1
            if products:
                new_id = max([p.get('id', 0) for p in products]) + 1
            
            new_product = {
                'id': new_id,
                'name': data.get('name'),
                'description': data.get('description'),
                'price': data.get('price'),
                'stock': data.get('stock', 0),
                'sold': 0,
                'category': data.get('category'),
                'image': data.get('image'),
                'images': data.get('images', []),
                'variants': data.get('variants', []),
                'notes': data.get('notes', ''),
                'active': data.get('active', True),
                'featured': data.get('featured', False),
                'created_at': datetime.now().isoformat()
            }
            
            products.append(new_product)
            
            db.execute('UPDATE websites SET products = ? WHERE id = ?',
                      (json.dumps(products), website_id))
            db.commit()
            
            return jsonify({'success': True, 'product': new_product})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/products/<int:product_id>', methods=['PUT'])
def update_product(website_id, product_id):
    try:
        data = request.json
        
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            
            updated = False
            for i, product in enumerate(products):
                if product.get('id') == product_id:
                    products[i].update(data)
                    updated = True
                    break
            
            if not updated:
                return jsonify({'success': False, 'error': 'Product not found'}), 404
            
            db.execute('UPDATE websites SET products = ? WHERE id = ?',
                      (json.dumps(products), website_id))
            db.commit()
            
            return jsonify({'success': True, 'message': 'Product updated successfully'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/products/<int:product_id>', methods=['DELETE'])
def delete_product(website_id, product_id):
    try:
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            
            new_products = [p for p in products if p.get('id') != product_id]
            
            if len(new_products) == len(products):
                return jsonify({'success': False, 'error': 'Product not found'}), 404
            
            db.execute('UPDATE websites SET products = ? WHERE id = ?',
                      (json.dumps(new_products), website_id))
            db.commit()
            
            return jsonify({'success': True, 'message': 'Product deleted successfully'})
            
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
        
        # Validasi format bot token
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
    """Menampilkan halaman website publik berdasarkan endpoint"""
    # Validasi apakah endpoint ada di database
    with get_db() as db:
        website = db.execute('SELECT * FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
        if not website:
            return "Website not found", 404
    # Kirim file website.html
    return send_from_directory('.', 'website.html')

@app.route('/panel/<string:endpoint>')
def serve_panel(endpoint):
    """Menampilkan halaman panel admin berdasarkan endpoint"""
    # Validasi apakah endpoint ada di database
    with get_db() as db:
        website = db.execute('SELECT * FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
        if not website:
            return "Website not found", 404
    # Kirim file panel.html
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

# ==================== ROUTES UNTUK TAMPILAN (VERSI BARU) ====================

@app.route('/api/tampilan/<int:website_id>', methods=['GET'])
def get_tampilan(website_id):
    """Get tampilan data by website_id"""
    try:
        data = tmp.get_tampilan(website_id)
        if data:
            return jsonify({'success': True, 'tampilan': data})
        else:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/colors', methods=['POST'])
def save_colors(website_id):
    """Save color settings"""
    try:
        data = request.json
        print(f"🎨 Received colors data: {data}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Simpan warna - ini akan preserve banner karena menggunakan fungsi khusus
        tmp.save_colors(website_id, data)
        
        return jsonify({'success': True, 'message': 'Colors saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/banners', methods=['POST'])
def save_banners(website_id):
    """Save multiple banners with positions"""
    try:
        data = request.json
        print(f"🖼️ Received banners data: {data}")
        
        # Validasi website exists
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        banners = data.get('banners', [])
        
        # Validasi banners
        for banner in banners:
            if 'url' not in banner:
                return jsonify({'success': False, 'error': 'Each banner must have a URL'}), 400
        
        # Save banners - ini hanya akan update banners, field lain tetap
        tmp.save_banners(website_id, banners)
        
        return jsonify({'success': True, 'message': f'{len(banners)} banners saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/banners/<int:banner_index>', methods=['DELETE'])
def delete_banner(website_id, banner_index):
    """Delete a specific banner"""
    try:
        print(f"🗑️ Deleting banner at index {banner_index}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Get existing tampilan
        existing = tmp.get_tampilan(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
        
        banners = existing.get('banners', [])
        
        if banner_index < 0 or banner_index >= len(banners):
            return jsonify({'success': False, 'error': 'Banner not found'}), 404
        
        # Remove banner
        banners.pop(banner_index)
        
        # Save updated banners
        tmp.save_banners(website_id, banners)
        
        return jsonify({'success': True, 'message': 'Banner deleted successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/font', methods=['POST'])
def save_font(website_id):
    """Save font settings - preserve banner"""
    try:
        data = request.json
        print(f"🔤 Received font data: {data}")
        
        # Validasi website exists
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Gunakan fungsi khusus untuk font
        tmp.save_font(
            website_id, 
            data.get('family', 'Inter'), 
            data.get('size', 14)
        )
        
        return jsonify({'success': True, 'message': 'Font saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/general', methods=['POST'])
def save_general(website_id):
    """Save general settings - preserve banner"""
    try:
        data = request.json
        print(f"⚙️ Received general data: {data}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Gunakan fungsi khusus untuk general settings
        tmp.save_general(
            website_id,
            data.get('title'),
            data.get('description'),
            data.get('contact', {}).get('whatsapp'),
            data.get('contact', {}).get('telegram')
        )
        
        return jsonify({'success': True, 'message': 'General settings saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/seo', methods=['POST'])
def save_seo(website_id):
    """Save SEO settings"""
    try:
        data = request.json
        print(f"🔍 Received SEO data: {data}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Store SEO data in website settings instead of tampilan
        current = get_db().execute('SELECT settings FROM websites WHERE id = ?', (website_id,)).fetchone()
        settings = json.loads(current['settings'] or '{}')
        
        # Update SEO settings
        settings['seo'] = {
            'title': data.get('title', ''),
            'description': data.get('description', ''),
            'keywords': data.get('keywords', '')
        }
        
        # Save back to website
        get_db().execute('UPDATE websites SET settings = ? WHERE id = ?',
                        (json.dumps(settings), website_id))
        get_db().commit()
        
        return jsonify({'success': True, 'message': 'SEO settings saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/payments', methods=['POST'])
def save_payments(website_id):
    """Save payment methods settings - preserve banner"""
    try:
        data = request.json
        print(f"💳 Received payment data: {data}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Convert payment data to tampilan format
        banks = []
        if data.get('bank', {}).get('enabled'):
            banks.append({
                'enabled': True,
                'bank_name': data.get('bank', {}).get('name', 'BCA'),
                'account': data.get('bank', {}).get('account', ''),
                'holder': data.get('bank', {}).get('holder', '')
            })
        
        ewallets = []
        if data.get('ewallet', {}).get('enabled'):
            ewallets.append({
                'enabled': True,
                'provider': data.get('ewallet', {}).get('provider', 'DANA'),
                'number': data.get('ewallet', {}).get('number', '')
            })
        
        qris = {
            'enabled': data.get('qris', {}).get('enabled', False),
            'url': data.get('qris', {}).get('url', '')
        }
        
        crypto = {
            'enabled': data.get('crypto', {}).get('enabled', False),
            'address': data.get('crypto', {}).get('address', '')
        }
        
        # Store payment data in website settings (JSON field)
        current = get_db().execute('SELECT settings FROM websites WHERE id = ?', (website_id,)).fetchone()
        settings = json.loads(current['settings'] or '{}')
        
        # Update payment settings
        settings['payments'] = {
            'bank': data.get('bank', {}),
            'ewallet': data.get('ewallet', {}),
            'qris': qris,
            'crypto': crypto
        }
        
        # Save back to website
        get_db().execute('UPDATE websites SET settings = ? WHERE id = ?',
                        (json.dumps(settings), website_id))
        get_db().commit()
        
        # Save to tampilan using specialized function - ini akan preserve banner
        tmp.save_payment_methods(website_id, banks, ewallets, qris, crypto)
        
        return jsonify({'success': True, 'message': 'Payment settings saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/payment-notes', methods=['POST'])
def save_payment_notes(website_id):
    """Save payment notes"""
    try:
        data = request.json
        print(f"📝 Received payment notes: {data}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Gunakan fungsi khusus untuk payment notes
        tmp.save_payment_notes(website_id, {
            'payment': data.get('payment', ''),
            'confirmation': data.get('confirmation', '')
        })
        
        return jsonify({'success': True, 'message': 'Payment notes saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/maintenance', methods=['POST'])
def save_maintenance(website_id):
    """Save maintenance mode settings"""
    try:
        data = request.json
        print(f"🔧 Received maintenance data: {data}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Store maintenance settings in website's main record
        get_db().execute('UPDATE websites SET status = ? WHERE id = ?',
                        ('maintenance' if data.get('enabled') else 'active', website_id))
        get_db().commit()
        
        # Store message in tampilan using specialized function
        tmp.save_maintenance(
            website_id,
            data.get('enabled', False),
            data.get('message', 'Website sedang dalam perbaikan')
        )
        
        return jsonify({'success': True, 'message': 'Maintenance settings saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK MULTIPLE BANNER DAN LOGO ====================

@app.route('/api/tampilan/<int:website_id>/logo', methods=['POST'])
def save_logo(website_id):
    """Save logo"""
    try:
        data = request.json
        print(f"🖼️ Received logo data: {data}")
        
        # Validasi website exists
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Validasi format PNG (cek dari URL atau data URL)
        logo_url = data.get('url', '')
        if logo_url and not (logo_url.lower().endswith('.png') or logo_url.startswith('data:image/png')):
            return jsonify({'success': False, 'error': 'Logo must be PNG format'}), 400
        
        # Save logo - ini hanya update logo, field lain tetap
        tmp.save_logo(website_id, logo_url)
        
        return jsonify({'success': True, 'message': 'Logo saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/banners/reorder', methods=['POST'])
def reorder_banners(website_id):
    """Reorder banners"""
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
        
        # Reorder based on new_order
        if len(new_order) == len(banners):
            new_banners = [banners[i] for i in new_order]
            
            tmp.save_banners(website_id, new_banners)
            
            return jsonify({'success': True, 'message': 'Banners reordered successfully'})
        else:
            return jsonify({'success': False, 'error': 'Invalid order'}), 400
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:website_id>', methods=['GET'])
def api_get_products(website_id):
    """Get all products for a website"""
    try:
        products = prd.get_products(website_id)
        stats = prd.get_products_stats(website_id)
        return jsonify({
            'success': True,
            'products': products,
            'stats': stats
        })
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/grouped/<int:website_id>', methods=['GET'])
def api_get_products_grouped(website_id):
    """Get products grouped by layanan and aplikasi"""
    try:
        grouped = prd.get_products_by_layanan(website_id)
        return jsonify({
            'success': True,
            'grouped': grouped
        })
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:website_id>', methods=['POST'])
def api_add_product(website_id):
    """Add new product"""
    try:
        data = request.json
        print(f"📦 Adding product for website {website_id}:", data)
        
        # Validate required fields
        required = ['layanan', 'aplikasi', 'item_nama', 'harga', 'method']
        missing = [f for f in required if f not in data]
        if missing:
            return jsonify({'success': False, 'error': f'Missing: {missing}'}), 400
        
        product_id = prd.add_product(website_id, data)
        
        return jsonify({
            'success': True,
            'product_id': product_id,
            'message': 'Product added successfully'
        })
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['PUT'])
def api_update_product(product_id):
    """Update existing product"""
    try:
        data = request.json
        print(f"📦 Updating product {product_id}:", data)
        
        success = prd.update_product(product_id, data)
        
        if success:
            return jsonify({'success': True, 'message': 'Product updated successfully'})
        else:
            return jsonify({'success': False, 'error': 'Product not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
def api_delete_product(product_id):
    """Delete product"""
    try:
        success = prd.delete_product(product_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Product deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Product not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/stok', methods=['POST'])
def api_add_stok(product_id):
    """Add stock to product"""
    try:
        data = request.json
        stok_data = data.get('stok', [])
        
        if not stok_data:
            return jsonify({'success': False, 'error': 'No stock data provided'}), 400
        
        success = prd.add_stok(product_id, stok_data)
        
        if success:
            return jsonify({'success': True, 'message': f'{len(stok_data)} stock items added'})
        else:
            return jsonify({'success': False, 'error': 'Product not found or not direct method'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/stok/<int:index>', methods=['DELETE'])
def api_remove_stok(product_id, index):
    """Remove specific stock item"""
    try:
        success = prd.remove_stok(product_id, index)
        
        if success:
            return jsonify({'success': True, 'message': 'Stock removed successfully'})
        else:
            return jsonify({'success': False, 'error': 'Product not found or invalid index'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>/consume-stok', methods=['POST'])
def api_consume_stok(product_id):
    """Consume one stock item (for checkout)"""
    try:
        stok_item = prd.consume_stok(product_id)
        
        if stok_item:
            return jsonify({
                'success': True,
                'stok_item': stok_item,
                'message': 'Stock consumed successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'No stock available'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK PRODUK (VERSI BARU) ====================

@app.route('/api/products/layanan/<int:website_id>', methods=['GET'])
def api_get_layanan(website_id):
    """Get all layanan"""
    try:
        layanan = prd.get_layanan(website_id)
        return jsonify({'success': True, 'layanan': layanan})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/aplikasi/<int:website_id>/<path:layanan_nama>', methods=['GET'])
def api_get_aplikasi(website_id, layanan_nama):
    """Get all aplikasi in a layanan"""
    try:
        aplikasi = prd.get_aplikasi_by_layanan(website_id, layanan_nama)
        return jsonify({'success': True, 'aplikasi': aplikasi})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/items/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['GET'])
def api_get_items(website_id, layanan_nama, aplikasi_nama):
    """Get all items in an aplikasi"""
    try:
        items = prd.get_items_by_aplikasi(website_id, layanan_nama, aplikasi_nama)
        return jsonify({'success': True, 'items': items})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/all/<int:website_id>', methods=['GET'])
def api_get_all_data(website_id):
    """Get all structured data"""
    try:
        data = prd.get_all_data(website_id)
        return jsonify({'success': True, 'data': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/layanan/<int:website_id>', methods=['POST'])
def api_save_layanan(website_id):
    """Save or update layanan"""
    try:
        data = request.json
        print(f"📦 Saving layanan for website {website_id}:", data)
        
        if 'layanan_nama' not in data:
            return jsonify({'success': False, 'error': 'Layanan name required'}), 400
        
        success = prd.save_layanan(website_id, data)
        
        return jsonify({'success': success, 'message': 'Layanan saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/aplikasi/<int:website_id>/<path:layanan_nama>', methods=['POST'])
def api_save_aplikasi(website_id, layanan_nama):
    """Save or update aplikasi in layanan"""
    try:
        data = request.json
        print(f"📦 Saving aplikasi for {layanan_nama}:", data)
        
        if 'aplikasi_nama' not in data:
            return jsonify({'success': False, 'error': 'Aplikasi name required'}), 400
        
        success = prd.save_aplikasi(website_id, layanan_nama, data)
        
        return jsonify({'success': success, 'message': 'Aplikasi saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/item/<int:website_id>/<path:layanan_nama>/<path:aplikasi_nama>', methods=['POST'])
def api_save_item(website_id, layanan_nama, aplikasi_nama):
    """Save or update item in aplikasi"""
    try:
        data = request.json
        print(f"📦 Saving item for {layanan_nama} - {aplikasi_nama}:", data)
        
        if 'item_nama' not in data:
            return jsonify({'success': False, 'error': 'Item name required'}), 400
        
        success = prd.save_item(website_id, layanan_nama, aplikasi_nama, data)
        
        return jsonify({'success': success, 'message': 'Item saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/layanan/<int:website_id>/<path:layanan_nama>', methods=['DELETE'])
def api_delete_layanan(website_id, layanan_nama):
    """Delete layanan"""
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
    """Delete aplikasi"""
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
    """Delete item"""
    try:
        success = prd.delete_item(item_id)
        
        if success:
            return jsonify({'success': True, 'message': 'Item deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Item not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK PROMO (REVISED - MULTIPLE) ====================

@app.route('/api/tampilan/<int:website_id>/promos', methods=['GET'])
def get_promos(website_id):
    """Get all promos for a website"""
    try:
        data = tmp.get_promos(website_id)
        return jsonify({'success': True, 'promos': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promos', methods=['POST'])
def save_promos(website_id):
    """Save all promos for a website"""
    try:
        data = request.json
        print(f"📢 Received promos data for website {website_id}:", data)
        
        # Validasi website exists
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        promos = data.get('promos', [])
        
        # Validasi setiap promo
        for promo in promos:
            if 'title' not in promo or not promo['title']:
                return jsonify({'success': False, 'error': 'Each promo must have a title'}), 400
            if 'banner' not in promo or not promo['banner']:
                return jsonify({'success': False, 'error': 'Each promo must have a banner URL'}), 400
        
        # Simpan semua promos
        result = tmp.save_promos(website_id, promos)
        
        return jsonify({'success': True, 'message': f'{len(promos)} promos saved successfully', 'count': result})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promos/<int:promo_index>', methods=['DELETE'])
def delete_promo(website_id, promo_index):
    """Delete a specific promo"""
    try:
        print(f"🗑️ Deleting promo at index {promo_index}")
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Get existing promos
        existing = tmp.get_promos(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Promos not found'}), 404
        
        if promo_index < 0 or promo_index >= len(existing):
            return jsonify({'success': False, 'error': 'Promo not found'}), 404
        
        # Remove promo
        existing.pop(promo_index)
        
        # Save updated promos
        tmp.save_promos(website_id, existing)
        
        return jsonify({'success': True, 'message': 'Promo deleted successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promos/reorder', methods=['POST'])
def reorder_promos(website_id):
    """Reorder promos"""
    try:
        data = request.json
        new_order = data.get('order', [])
        
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        existing = tmp.get_promos(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Promos not found'}), 404
        
        # Reorder based on new_order
        if len(new_order) == len(existing):
            new_promos = [existing[i] for i in new_order]
            tmp.save_promos(website_id, new_promos)
            return jsonify({'success': True, 'message': 'Promos reordered successfully'})
        else:
            return jsonify({'success': False, 'error': 'Invalid order'}), 400
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK ORDERS ====================

@app.route('/api/orders/website/<int:website_id>', methods=['GET', 'OPTIONS'])
def get_orders_by_website(website_id):
    """Get orders for a specific website"""
    try:
        # Untuk sementara return empty array karena belum ada tabel orders
        # Nanti bisa diintegrasikan dengan database orders
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
    """Get orders for a specific user (customer)"""
    try:
        return jsonify({
            'success': True, 
            'orders': [],
            'message': 'Orders feature coming soon'
        })
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ROUTES UNTUK PROMO LAMA (BACKWARD COMPATIBILITY) ====================

@app.route('/api/tampilan/<int:website_id>/promo', methods=['GET'])
def get_promo_old(website_id):
    """Get promo data by website_id (old single promo format)"""
    try:
        # Try to get from new format first
        promos = tmp.get_promos(website_id)
        if promos and len(promos) > 0:
            # Return first promo for backward compatibility
            return jsonify({'success': True, 'promo': promos[0]})
        else:
            return jsonify({'success': False, 'error': 'Promo not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promo', methods=['POST'])
def save_promo_old(website_id):
    """Save or update promo settings (old single promo format)"""
    try:
        data = request.json
        print(f"📢 Received promo data for website {website_id}:", data)
        
        # Validasi website exists
        website = get_db().execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
        if not website:
            return jsonify({'success': False, 'error': 'Website not found'}), 404
        
        # Convert old format to new format
        promo = {
            'title': data.get('title', 'Promo'),
            'banner': data.get('banner', ''),
            'description': data.get('description', ''),
            'end_date': data.get('end_date'),
            'end_time': data.get('end_time'),
            'never_end': data.get('never_end', False),
            'notes': data.get('notes', ''),
            'active': data.get('active', True)
        }
        
        # Get existing promos
        existing = tmp.get_promos(website_id)
        
        if existing and len(existing) > 0:
            # Update first promo
            existing[0] = promo
            tmp.save_promos(website_id, existing)
        else:
            # Create new promos array
            tmp.save_promos(website_id, [promo])
        
        return jsonify({'success': True, 'message': 'Promo saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/tampilan/<int:website_id>/promo', methods=['DELETE'])
def delete_promo_old(website_id):
    """Delete promo settings (old single promo format)"""
    try:
        # Delete all promos
        tmp.save_promos(website_id, [])
        return jsonify({'success': True, 'message': 'Promo deleted successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
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