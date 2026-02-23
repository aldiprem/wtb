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
    return send_from_directory('.', 'dashboard.html')

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
    return send_from_directory('.', 'panel.html')

@app.route('/format')
def serve_format():
    return send_from_directory('.', 'format.html')

@app.route('/dashboard')
def serve_dashboard():
    return send_from_directory('.', 'dashboard.html')

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
        
        result = tmp.save_colors(website_id, data)
        
        return jsonify({'success': True, 'message': 'Colors saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
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
