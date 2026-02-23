from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import os
from datetime import datetime, timedelta
import hashlib
import secrets

app = Flask(__name__, static_folder='.')
# CORS lebih lengkap - tambahkan support untuk credentials
CORS(app, origins='*', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
     allow_headers=['Content-Type', 'Accept', 'Authorization'], 
     supports_credentials=True)

# ==================== DATABASE SETUP ====================
DATABASE = 'websites.db'

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    with get_db() as db:
        # Create websites table - tunnel_url tetap ada untuk kompatibilitas, tapi tidak wajib diisi
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
        
        # Create owners table
        db.execute('''
            CREATE TABLE IF NOT EXISTS owners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                username TEXT,
                first_name TEXT,
                last_name TEXT,
                is_premium BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create orders table
        db.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                website_id INTEGER NOT NULL,
                order_number TEXT UNIQUE NOT NULL,
                user_id INTEGER,
                username TEXT,
                customer_name TEXT,
                customer_email TEXT,
                customer_phone TEXT,
                items TEXT NOT NULL,
                total_amount INTEGER NOT NULL,
                payment_method TEXT,
                payment_status TEXT DEFAULT 'pending',
                order_status TEXT DEFAULT 'processing',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (website_id) REFERENCES websites (id) ON DELETE CASCADE
            )
        ''')
        
        # Create transactions table
        db.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                website_id INTEGER NOT NULL,
                amount INTEGER NOT NULL,
                payment_method TEXT,
                payment_proof TEXT,
                transaction_id TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
                FOREIGN KEY (website_id) REFERENCES websites (id) ON DELETE CASCADE
            )
        ''')
        
        print("✅ Database initialized successfully")

# Initialize database
init_db()

# ==================== HELPER FUNCTIONS ====================
def generate_order_number():
    """Generate unique order number"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    random = secrets.token_hex(4).upper()
    return f"ORD-{timestamp}-{random}"

def hash_password(password):
    """Hash password for storage"""
    salt = secrets.token_hex(16)
    hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${hash_obj.hex()}"

def verify_password(password, hashed):
    """Verify password against hash"""
    salt, hash_str = hashed.split('$')
    hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return hash_obj.hex() == hash_str

def calculate_end_date(start_date, days):
    """Calculate end date from start date and days"""
    if isinstance(start_date, str):
        start_date = datetime.strptime(start_date, '%Y-%m-%d')
    end_date = start_date + timedelta(days=int(days))
    return end_date.strftime('%Y-%m-%d')

# ==================== API ROUTES ====================

# Serve static files
@app.route('/')
def serve_index():
    return send_from_directory('.', 'dashboard.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# Handle OPTIONS requests for CORS
@app.route('/api/websites', methods=['OPTIONS'])
@app.route('/api/websites/<path:path>', methods=['OPTIONS'])
def handle_options(path=None):
    response = jsonify({'status': 'ok'})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Accept,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response, 200

# ==================== HEALTH CHECK ====================
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        with get_db() as db:
            db.execute('SELECT 1').fetchone()
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'timestamp': datetime.now().isoformat()
            })
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'database': 'disconnected',
            'error': str(e)
        }), 500

# ==================== WEBSITE API ====================

@app.route('/api/websites', methods=['GET'])
def get_websites():
    """Get all websites"""
    try:
        with get_db() as db:
            websites = db.execute('''
                SELECT * FROM websites ORDER BY created_at DESC
            ''').fetchall()
            
            # Convert to list of dicts
            result = []
            for w in websites:
                website_dict = dict(w)
                # Parse JSON fields
                website_dict['settings'] = json.loads(website_dict['settings'] or '{}')
                website_dict['products'] = json.loads(website_dict['products'] or '[]')
                website_dict['categories'] = json.loads(website_dict['categories'] or '[]')
                result.append(website_dict)
            
            return jsonify({
                'success': True,
                'websites': result
            })
    except Exception as e:
        print(f"❌ Error in get_websites: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>', methods=['GET'])
def get_website(website_id):
    """Get single website by ID"""
    try:
        with get_db() as db:
            website = db.execute('SELECT * FROM websites WHERE id = ?', (website_id,)).fetchone()
            
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            website_dict = dict(website)
            website_dict['settings'] = json.loads(website_dict['settings'] or '{}')
            website_dict['products'] = json.loads(website_dict['products'] or '[]')
            website_dict['categories'] = json.loads(website_dict['categories'] or '[]')
            
            return jsonify({
                'success': True,
                'website': website_dict
            })
    except Exception as e:
        print(f"❌ Error in get_website: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/endpoint/<string:endpoint>', methods=['GET'])
def get_website_by_endpoint(endpoint):
    """Get website by endpoint (for public access)"""
    try:
        with get_db() as db:
            website = db.execute('SELECT * FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
            
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            website_dict = dict(website)
            
            # Don't send sensitive data to public
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
            
            return jsonify({
                'success': True,
                'website': safe_data
            })
    except Exception as e:
        print(f"❌ Error in get_website_by_endpoint: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites', methods=['POST'])
def create_website():
    """Create new website"""
    try:
        data = request.json
        print(f"📥 Received data: {data}")
        
        # Validate required fields - tunnel_url tidak wajib lagi
        required = ['endpoint', 'bot_token', 'owner_id', 'username', 'password', 'email']
        missing_fields = []
        
        for field in required:
            if field not in data or data[field] is None or data[field] == '':
                missing_fields.append(field)
                print(f"❌ Missing field: {field}")
        
        if missing_fields:
            return jsonify({
                'success': False, 
                'error': f'Missing fields: {", ".join(missing_fields)}'
            }), 400
        
        # Validate endpoint format
        endpoint = data['endpoint'].strip().lower()
        if not endpoint.replace('-', '').isalnum():
            return jsonify({
                'success': False,
                'error': 'Endpoint can only contain letters, numbers, and hyphens'
            }), 400
        
        # Validate owner_id is integer
        try:
            owner_id = int(data['owner_id'])
        except (ValueError, TypeError):
            return jsonify({
                'success': False,
                'error': 'Owner ID must be a number'
            }), 400
        
        # Hash password
        hashed_password = hash_password(data['password'])
        
        # Calculate end date (default 30 days from now)
        start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
        end_date = data.get('end_date', calculate_end_date(start_date, 30))
        
        # Gunakan base URL sebagai tunnel_url (otomatis)
        base_url = request.host_url.rstrip('/')
        tunnel_url = base_url  # Gunakan URL server saat ini
        
        with get_db() as db:
            # Check if endpoint exists
            existing = db.execute('SELECT id FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
            if existing:
                return jsonify({
                    'success': False, 
                    'error': f'Endpoint "{endpoint}" already exists'
                }), 400
            
            # Insert new website - tunnel_url diisi otomatis
            cursor = db.execute('''
                INSERT INTO websites 
                (endpoint, bot_token, owner_id, username, password, email, tunnel_url, status, start_date, end_date, settings)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                endpoint,
                data['bot_token'].strip(),
                owner_id,
                data['username'].strip(),
                hashed_password,
                data['email'].strip().lower(),
                tunnel_url,  # Isi otomatis dengan base URL
                data.get('status', 'active'),
                start_date,
                end_date,
                json.dumps(data.get('settings', {}))
            ))
            
            website_id = cursor.lastrowid
            db.commit()
            
            print(f"✅ Website created with ID: {website_id}")
            
            return jsonify({
                'success': True,
                'message': 'Website created successfully',
                'website_id': website_id
            })
            
    except sqlite3.IntegrityError as e:
        print(f"❌ Database integrity error: {e}")
        return jsonify({
            'success': False,
            'error': 'Database error: Endpoint or data conflict'
        }), 400
    except Exception as e:
        print(f"❌ Error creating website: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/websites/<int:website_id>', methods=['PUT'])
def update_website(website_id):
    """Update website"""
    try:
        data = request.json
        
        with get_db() as db:
            # Get current website
            current = db.execute('SELECT * FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not current:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            # Build update query
            updates = []
            values = []
            
            update_fields = ['bot_token', 'owner_id', 'username', 'email', 'status']
            # Hapus tunnel_url dari update_fields karena tidak perlu diupdate
            
            for field in update_fields:
                if field in data:
                    updates.append(f"{field} = ?")
                    values.append(data[field])
            
            # Handle password update
            if data.get('password'):
                updates.append("password = ?")
                values.append(hash_password(data['password']))
            
            # Handle dates
            if data.get('start_date'):
                updates.append("start_date = ?")
                values.append(data['start_date'])
            
            if data.get('end_date'):
                updates.append("end_date = ?")
                values.append(data['end_date'])
            
            # Handle settings update
            if data.get('settings'):
                updates.append("settings = ?")
                values.append(json.dumps(data['settings']))
            
            # Always update updated_at
            updates.append("updated_at = CURRENT_TIMESTAMP")
            
            if updates:
                query = f"UPDATE websites SET {', '.join(updates)} WHERE id = ?"
                values.append(website_id)
                db.execute(query, values)
                db.commit()
            
            return jsonify({
                'success': True,
                'message': 'Website updated successfully'
            })
            
    except Exception as e:
        print(f"❌ Error updating website: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ... (rest of the code remains the same) ...

# ==================== MAIN ====================

if __name__ == '__main__':
    print("🚀 Starting Website Management API Server...")
    print(f"📅 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"🔗 API available at: http://localhost:5050")
    print(f"🔗 Base URL: http://localhost:5050 (akan digunakan sebagai tunnel_url)")
    print("📊 Database: websites.db")
    print("⚠️  Tunnel URL tidak perlu diisi lagi - akan otomatis menggunakan base URL")
    print("🌐 CORS enabled for all origins")
    app.run(host='0.0.0.0', port=5050, debug=True)
