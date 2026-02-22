import os
import secrets
import string
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, abort
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Import dari database.py - pastikan OrderItem diimport
from database import db, init_db, Owner, Website, Category, Product, Customer, Order, OrderItem, Setting

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))

# PERBAIKAN: Gunakan absolute path untuk database
basedir = os.path.abspath(os.path.dirname(__file__))
db_path = os.path.join(basedir, 'instance', 'database.db')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + db_path
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'owner_login'

# ============= PASTIKAN FOLDER INSTANCE ADA =============
os.makedirs(os.path.join(basedir, 'instance'), exist_ok=True)
os.makedirs(os.path.join(basedir, 'templates', 'owner'), exist_ok=True)
os.makedirs(os.path.join(basedir, 'templates', 'store'), exist_ok=True)
os.makedirs(os.path.join(basedir, 'static', 'css'), exist_ok=True)
os.makedirs(os.path.join(basedir, 'static', 'js'), exist_ok=True)

# Set permission untuk folder instance
try:
    os.chmod(os.path.join(basedir, 'instance'), 0o777)
except:
    pass

# Initialize database
with app.app_context():
    try:
        db.create_all()
        print("✅ Database tables created successfully")
        init_db(app)
        print("✅ Database initialized successfully")
    except Exception as e:
        print(f"❌ Database error: {e}")

# ============= HELPER FUNCTIONS =============
def generate_endpoint(name):
    """Generate unique endpoint from name"""
    import re
    if not name:
        return secrets.token_hex(4)
    
    # Convert to lowercase, replace spaces with hyphens, remove special chars
    base = re.sub(r'[^a-z0-9\s-]', '', name.lower())
    base = re.sub(r'[\s-]+', '-', base).strip('-')
    
    if not base:
        base = 'store'
    
    # Add random string for uniqueness
    random_str = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    endpoint = f"{base}-{random_str}"
    
    # Check if exists
    while Website.query.filter_by(endpoint=endpoint).first():
        random_str = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
        endpoint = f"{base}-{random_str}"
    
    return endpoint

def format_currency(amount, currency='IDR'):
    """Format currency"""
    if amount is None:
        amount = 0
    if currency == 'IDR':
        return f"Rp {amount:,.0f}".replace(',', '.')
    return f"${amount:,.2f}"

# ============= LOGIN MANAGER =============
@login_manager.user_loader
def load_user(user_id):
    return db.session.get(Owner, int(user_id))

# ============= DECORATORS =============
def owner_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return redirect(url_for('owner_login'))
        return f(*args, **kwargs)
    return decorated_function

def website_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        endpoint = kwargs.get('endpoint')
        website = Website.query.filter_by(endpoint=endpoint, is_active=True).first()
        if not website:
            abort(404)
        return f(website=website, *args, **kwargs)
    return decorated_function

# ============= OWNER ROUTES =============
@app.route('/')
def index():
    """Redirect to owner login"""
    if current_user.is_authenticated:
        return redirect(url_for('owner_dashboard'))
    return redirect(url_for('owner_login'))

@app.route('/owner/login', methods=['GET', 'POST'])
def owner_login():
    """Owner login page"""
    if request.method == 'POST':
        if request.is_json:
            data = request.json
        else:
            data = request.form
        
        username = data.get('username')
        password = data.get('password')
        
        owner = Owner.query.filter_by(username=username).first()
        
        if owner and owner.check_password(password):
            login_user(owner)
            owner.last_login = datetime.utcnow()
            db.session.commit()
            
            if request.is_json:
                return jsonify({
                    'success': True,
                    'redirect': url_for('owner_dashboard')
                })
            else:
                return redirect(url_for('owner_dashboard'))
        
        if request.is_json:
            return jsonify({
                'success': False,
                'message': 'Username atau password salah'
            })
        else:
            return render_template('owner/login.html', error='Username atau password salah')
    
    return render_template('owner/login.html')

@app.route('/owner/logout')
@login_required
def owner_logout():
    """Owner logout"""
    logout_user()
    return redirect(url_for('owner_login'))

@app.route('/owner/dashboard')
@login_required
def owner_dashboard():
    """Owner dashboard"""
    websites = Website.query.filter_by(owner_id=current_user.id).all()
    
    # Statistik
    total_websites = len(websites)
    total_products = sum(len(w.products) for w in websites)
    total_orders = sum(len(w.orders) for w in websites)
    total_customers = sum(len(w.customers) for w in websites)
    
    # Recent websites
    recent_websites = Website.query.filter_by(owner_id=current_user.id)\
                         .order_by(Website.created_at.desc()).limit(5).all()
    
    return render_template('owner/dashboard.html',
                         current_user=current_user,
                         websites=websites,
                         total_websites=total_websites,
                         total_products=total_products,
                         total_orders=total_orders,
                         total_customers=total_customers,
                         recent_websites=recent_websites)

@app.route('/owner/websites')
@login_required
def owner_websites():
    """List all websites"""
    websites = Website.query.filter_by(owner_id=current_user.id)\
                 .order_by(Website.created_at.desc()).all()
    return render_template('owner/websites.html', 
                         current_user=current_user,
                         websites=websites)

@app.route('/owner/websites/create', methods=['GET', 'POST'])
@login_required
def owner_website_create():
    """Create new website"""
    if request.method == 'POST':
        if request.is_json:
            data = request.json
        else:
            data = request.form
        
        # Generate endpoint from name
        endpoint = generate_endpoint(data.get('name'))
        
        # Create website
        website = Website(
            owner_id=current_user.id,
            name=data.get('name'),
            endpoint=endpoint,
            description=data.get('description'),
            currency=data.get('currency', 'IDR'),
            whatsapp_number=data.get('whatsapp_number'),
            email=data.get('email'),
            theme_color=data.get('theme_color', '#4f46e5'),
            telegram_bot_token=data.get('telegram_bot_token'),
            telegram_bot_username=data.get('telegram_bot_username'),
            telegram_chat_id=data.get('telegram_chat_id')
        )
        
        db.session.add(website)
        db.session.commit()
        
        if request.is_json:
            return jsonify({
                'success': True,
                'message': 'Website created successfully',
                'website': website.to_dict(),
                'redirect': url_for('owner_website_edit', id=website.id)
            })
        else:
            return redirect(url_for('owner_website_edit', id=website.id))
    
    return render_template('owner/website-create.html', current_user=current_user)

@app.route('/owner/websites/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def owner_website_edit(id):
    """Edit website"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    
    if request.method == 'POST':
        if request.is_json:
            data = request.json
        else:
            data = request.form
        
        website.name = data.get('name', website.name)
        website.description = data.get('description', website.description)
        website.currency = data.get('currency', website.currency)
        website.whatsapp_number = data.get('whatsapp_number')
        website.email = data.get('email')
        website.phone = data.get('phone')
        website.address = data.get('address')
        website.theme_color = data.get('theme_color', website.theme_color)
        website.font_family = data.get('font_family', website.font_family)
        website.layout = data.get('layout', website.layout)
        website.is_active = data.get('is_active', 'true') == 'true' or data.get('is_active') == True
        website.is_public = data.get('is_public', 'true') == 'true' or data.get('is_public') == True
        
        # Bot settings
        website.telegram_bot_token = data.get('telegram_bot_token')
        website.telegram_bot_username = data.get('telegram_bot_username')
        website.telegram_chat_id = data.get('telegram_chat_id')
        
        # Meta
        website.meta_title = data.get('meta_title')
        website.meta_description = data.get('meta_description')
        website.meta_keywords = data.get('meta_keywords')
        
        # Logo
        website.logo_url = data.get('logo_url')
        website.favicon_url = data.get('favicon_url')
        
        db.session.commit()
        
        if request.is_json:
            return jsonify({
                'success': True,
                'message': 'Website updated successfully'
            })
        else:
            return redirect(url_for('owner_websites'))
    
    return render_template('owner/website-edit.html', 
                         current_user=current_user,
                         website=website)

@app.route('/owner/websites/<int:id>/delete', methods=['POST'])
@login_required
def owner_website_delete(id):
    """Delete website"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    
    db.session.delete(website)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'message': 'Website deleted successfully'
    })

# ... (routes lainnya tetap sama, lanjutkan dari sini)

# ============= ERROR HANDLERS =============
@app.errorhandler(404)
def not_found_error(error):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Internal server error'}), 500
    return render_template('500.html'), 500

if __name__ == '__main__':
    print("""
    ╔══════════════════════════════════════════╗
    ║     TopUp Store Manager - Owner Panel    ║
    ╚══════════════════════════════════════════╝
    
    📝 Owner Login:
    Username: owner
    Password: owner123
    
    🌐 Server running at: http://0.0.0.0:5555
    """)
    
    app.run(debug=True, host='0.0.0.0', port=5555)
