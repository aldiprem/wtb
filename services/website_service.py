from flask import Blueprint, request, jsonify
import sqlite3
import json
import hashlib
import secrets
from datetime import datetime, timedelta

website_bp = Blueprint('website', __name__)

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
        print("✅ Website database initialized successfully")

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

@website_bp.route('/websites', methods=['GET', 'OPTIONS'])
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

@website_bp.route('/websites/<int:website_id>', methods=['GET', 'OPTIONS'])
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

@website_bp.route('/websites/endpoint/<string:endpoint>', methods=['GET', 'OPTIONS'])
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

@website_bp.route('/websites', methods=['POST'])
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
            
            return jsonify({'success': True, 'website_id': website_id, 'message': 'Website created successfully'})

    except sqlite3.IntegrityError as e:
        print(f"❌ Database error: {str(e)}")
        return jsonify({'success': False, 'error': 'Database error: ' + str(e)}), 400
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@website_bp.route('/websites/<int:website_id>', methods=['PUT'])
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

@website_bp.route('/websites/<int:website_id>', methods=['DELETE'])
def delete_website(website_id):
    try:
        with get_db() as db:
            db.execute('DELETE FROM websites WHERE id = ?', (website_id,))
            db.commit()
            return jsonify({'success': True, 'message': 'Website deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@website_bp.route('/websites/user/<int:user_id>', methods=['GET', 'OPTIONS'])
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

@website_bp.route('/websites/<int:website_id>/test-bot', methods=['POST'])
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
        
@website_bp.route('/website/<int:website_id>/initial-data', methods=['GET'])
def get_initial_website_data(website_id):
    """
    Endpoint khusus untuk initial load website
    Menggabungkan semua data yang dibutuhkan dalam satu request
    """
    try:
        from py import prd, tmp, pmb, vcr, trx
        
        user_id = request.args.get('user_id', type=int)
        
        # Parallel query di backend (lebih cepat)
        import concurrent.futures
        
        with concurrent.futures.ThreadPoolExecutor() as executor:
            # Submit semua task
            future_products = executor.submit(prd.get_all_data, website_id)
            future_promos = executor.submit(tmp.get_promos, website_id)
            future_rekening = executor.submit(pmb.get_all_rekening, website_id)
            future_templates = executor.submit(tmp.get_website_templates, website_id)
            
            future_vouchers = None
            future_activities = None
            future_transactions = None
            
            if user_id:
                future_vouchers = executor.submit(vcr.get_user_claims, user_id, website_id, 50)
                future_activities = executor.submit(vcr.get_activities, website_id, None, 50, 0)
                future_transactions = executor.submit(trx.get_user_transactions, user_id, website_id, 'all', 50)
            
            # Ambil hasil
            products_data = future_products.result()
            promos_data = future_promos.result()
            rekening_data = future_rekening.result()
            templates_data = future_templates.result()
            
            user_vouchers = future_vouchers.result() if future_vouchers else []
            activities_data = future_activities.result() if future_activities else []
            transactions_data = future_transactions.result() if future_transactions else []
        
        return jsonify({
            'success': True,
            'data': {
                'products': products_data,
                'promos': promos_data,
                'rekening': rekening_data,
                'templates': templates_data,
                'user_vouchers': user_vouchers,
                'activities': activities_data,
                'transactions': transactions_data
            }
        })
        
    except Exception as e:
        print(f"❌ Error getting initial data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500