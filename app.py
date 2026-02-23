from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import os
from datetime import datetime, timedelta
import hashlib
import secrets

app = Flask(__name__, static_folder='.')
CORS(app, origins='*', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
     allow_headers=['Content-Type', 'Accept', 'Authorization'], 
     supports_credentials=True)

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

# ==================== HELPER FUNCTIONS ====================
def hash_password(password):
    salt = secrets.token_hex(16)
    hash_obj = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${hash_obj.hex()}"

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

@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        with get_db() as db:
            db.execute('SELECT 1').fetchone()
            return jsonify({
                'status': 'healthy',
                'database': 'connected',
                'timestamp': datetime.now().isoformat()
            })
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/websites', methods=['GET'])
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
        
        hashed_password = hash_password(data['password'])
        start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
        end_date = data.get('end_date', calculate_end_date(start_date, 30))
        tunnel_url = request.host_url.rstrip('/')
        
        with get_db() as db:
            existing = db.execute('SELECT id FROM websites WHERE endpoint = ?', (endpoint,)).fetchone()
            if existing:
                return jsonify({'success': False, 'error': 'Endpoint exists'}), 400
            
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
            
            return jsonify({'success': True, 'website_id': website_id})
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    print("🚀 Starting Website Management API Server...")
    print(f"📅 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🔗 API available at: http://localhost:5050")
    print("📊 Database: websites.db")
    print("="*50)
    app.run(host='0.0.0.0', port=5050, debug=True)
