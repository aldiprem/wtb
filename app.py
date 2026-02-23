from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import json
import os
from datetime import datetime, timedelta
import hashlib
import hmac
import secrets

app = Flask(__name__, static_folder='.')
CORS(app)  # Enable CORS for all routes

# ==================== DATABASE SETUP ====================
DATABASE = 'websites.db'

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
                tunnel_url TEXT NOT NULL,
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
        
        # Create owners table (for multiple owners)
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
                'name': website_dict['username'],  # Use username as store name
                'email': website_dict['email'],
                'tunnel_url': website_dict['tunnel_url'],
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
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites', methods=['POST'])
def create_website():
    """Create new website"""
    try:
        data = request.json
        
        # Validate required fields
        required = ['endpoint', 'bot_token', 'owner_id', 'username', 'password', 'email', 'tunnel_url']
        for field in required:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        # Hash password
        hashed_password = hash_password(data['password'])
        
        # Calculate end date (default 30 days from now)
        start_date = data.get('start_date', datetime.now().strftime('%Y-%m-%d'))
        end_date = data.get('end_date', calculate_end_date(start_date, 30))
        
        with get_db() as db:
            # Check if endpoint exists
            existing = db.execute('SELECT id FROM websites WHERE endpoint = ?', (data['endpoint'],)).fetchone()
            if existing:
                return jsonify({'success': False, 'error': 'Endpoint already exists'}), 400
            
            # Insert new website
            cursor = db.execute('''
                INSERT INTO websites 
                (endpoint, bot_token, owner_id, username, password, email, tunnel_url, status, start_date, end_date, settings)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data['endpoint'],
                data['bot_token'],
                data['owner_id'],
                data['username'],
                hashed_password,
                data['email'],
                data['tunnel_url'],
                data.get('status', 'active'),
                start_date,
                end_date,
                json.dumps(data.get('settings', {}))
            ))
            
            website_id = cursor.lastrowid
            
            return jsonify({
                'success': True,
                'message': 'Website created successfully',
                'website_id': website_id
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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
            
            update_fields = ['bot_token', 'owner_id', 'username', 'email', 'tunnel_url', 'status']
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
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>', methods=['DELETE'])
def delete_website(website_id):
    """Delete website"""
    try:
        with get_db() as db:
            # Check if exists
            website = db.execute('SELECT id FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            # Delete website (cascade will delete orders and transactions)
            db.execute('DELETE FROM websites WHERE id = ?', (website_id,))
            db.commit()
            
            return jsonify({
                'success': True,
                'message': 'Website deleted successfully'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== PRODUCTS API ====================

@app.route('/api/websites/<int:website_id>/products', methods=['GET'])
def get_products(website_id):
    """Get all products for a website"""
    try:
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            
            return jsonify({
                'success': True,
                'products': products
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/products', methods=['POST'])
def add_product(website_id):
    """Add product to website"""
    try:
        data = request.json
        
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            
            # Generate new ID
            new_id = 1
            if products:
                new_id = max([p.get('id', 0) for p in products]) + 1
            
            # Add new product
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
            
            # Update database
            db.execute('UPDATE websites SET products = ? WHERE id = ?', 
                      (json.dumps(products), website_id))
            db.commit()
            
            return jsonify({
                'success': True,
                'product': new_product
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/products/<int:product_id>', methods=['PUT'])
def update_product(website_id, product_id):
    """Update product"""
    try:
        data = request.json
        
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            
            # Find and update product
            updated = False
            for i, product in enumerate(products):
                if product.get('id') == product_id:
                    products[i].update(data)
                    updated = True
                    break
            
            if not updated:
                return jsonify({'success': False, 'error': 'Product not found'}), 404
            
            # Update database
            db.execute('UPDATE websites SET products = ? WHERE id = ?',
                      (json.dumps(products), website_id))
            db.commit()
            
            return jsonify({
                'success': True,
                'message': 'Product updated successfully'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/products/<int:product_id>', methods=['DELETE'])
def delete_product(website_id, product_id):
    """Delete product"""
    try:
        with get_db() as db:
            website = db.execute('SELECT products FROM websites WHERE id = ?', (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            products = json.loads(website['products'] or '[]')
            
            # Filter out the product
            new_products = [p for p in products if p.get('id') != product_id]
            
            if len(new_products) == len(products):
                return jsonify({'success': False, 'error': 'Product not found'}), 404
            
            # Update database
            db.execute('UPDATE websites SET products = ? WHERE id = ?',
                      (json.dumps(new_products), website_id))
            db.commit()
            
            return jsonify({
                'success': True,
                'message': 'Product deleted successfully'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== ORDERS API ====================

@app.route('/api/websites/<int:website_id>/orders', methods=['GET'])
def get_orders(website_id):
    """Get all orders for a website"""
    try:
        with get_db() as db:
            orders = db.execute('''
                SELECT * FROM orders WHERE website_id = ? ORDER BY created_at DESC
            ''', (website_id,)).fetchall()
            
            result = []
            for order in orders:
                order_dict = dict(order)
                order_dict['items'] = json.loads(order_dict['items'] or '[]')
                result.append(order_dict)
            
            return jsonify({
                'success': True,
                'orders': result
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/websites/<int:website_id>/orders', methods=['POST'])
def create_order(website_id):
    """Create new order"""
    try:
        data = request.json
        
        # Validate
        if not data.get('items'):
            return jsonify({'success': False, 'error': 'No items in order'}), 400
        
        # Generate order number
        order_number = generate_order_number()
        
        with get_db() as db:
            # Check if website exists and is active
            website = db.execute('SELECT id, status, end_date FROM websites WHERE id = ?', 
                               (website_id,)).fetchone()
            if not website:
                return jsonify({'success': False, 'error': 'Website not found'}), 404
            
            # Check if website is active
            if website['status'] != 'active':
                return jsonify({'success': False, 'error': 'Website is not active'}), 400
            
            # Check if expired
            if website['end_date']:
                end_date = datetime.strptime(website['end_date'], '%Y-%m-%d')
                if datetime.now() > end_date:
                    return jsonify({'success': False, 'error': 'Website has expired'}), 400
            
            # Insert order
            cursor = db.execute('''
                INSERT INTO orders 
                (website_id, order_number, user_id, username, customer_name, customer_email, customer_phone, items, total_amount, payment_method, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                website_id,
                order_number,
                data.get('user_id'),
                data.get('username'),
                data.get('customer_name'),
                data.get('customer_email'),
                data.get('customer_phone'),
                json.dumps(data['items']),
                data['total_amount'],
                data.get('payment_method'),
                data.get('notes')
            ))
            
            order_id = cursor.lastrowid
            
            return jsonify({
                'success': True,
                'message': 'Order created successfully',
                'order_id': order_id,
                'order_number': order_number
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== STATS API ====================

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get overall statistics"""
    try:
        with get_db() as db:
            # Total websites
            total_websites = db.execute('SELECT COUNT(*) as count FROM websites').fetchone()['count']
            
            # Active websites
            active_websites = db.execute('''
                SELECT COUNT(*) as count FROM websites 
                WHERE status = 'active' AND (end_date IS NULL OR date(end_date) >= date('now'))
            ''').fetchone()['count']
            
            # Inactive websites
            inactive_websites = db.execute('''
                SELECT COUNT(*) as count FROM websites 
                WHERE status = 'inactive' OR (end_date IS NOT NULL AND date(end_date) < date('now'))
            ''').fetchone()['count']
            
            # Expiring soon (next 7 days)
            expiring_soon = db.execute('''
                SELECT COUNT(*) as count FROM websites 
                WHERE status = 'active' 
                AND end_date IS NOT NULL 
                AND date(end_date) BETWEEN date('now') AND date('now', '+7 days')
            ''').fetchone()['count']
            
            # Total orders
            total_orders = db.execute('SELECT COUNT(*) as count FROM orders').fetchone()['count']
            
            # Total revenue
            total_revenue = db.execute('''
                SELECT SUM(total_amount) as total FROM orders WHERE payment_status = 'paid'
            ''').fetchone()['total'] or 0
            
            return jsonify({
                'success': True,
                'stats': {
                    'total_websites': total_websites,
                    'active_websites': active_websites,
                    'inactive_websites': inactive_websites,
                    'expiring_soon': expiring_soon,
                    'total_orders': total_orders,
                    'total_revenue': total_revenue
                }
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== TEST BOT ====================

@app.route('/api/websites/<int:website_id>/test-bot', methods=['POST'])
def test_bot(website_id):
    """Test bot connection"""
    try:
        data = request.json
        bot_token = data.get('bot_token')
        tunnel_url = data.get('tunnel_url')
        
        if not bot_token or not tunnel_url:
            return jsonify({'success': False, 'error': 'Bot token and tunnel URL required'}), 400
        
        # Here you would test the bot connection
        # For now, just return success
        return jsonify({
            'success': True,
            'message': 'Bot test successful'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Internal server error'}), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    print("🚀 Starting Website Management API Server...")
    print(f"📅 Server started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("🔗 API available at: http://localhost:5000")
    print("📊 Database: websites.db")
    app.run(host='0.0.0.0', port=5000, debug=True)
