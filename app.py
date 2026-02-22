import os
import secrets
import string
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, abort
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

from database import db, init_db, Owner, Website, Category, Product, Customer, Order, Setting

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///instance/database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'owner_login'

# Initialize database
with app.app_context():
    db.create_all()
    init_db(app)

# ============= HELPER FUNCTIONS =============
def generate_endpoint(name):
    """Generate unique endpoint from name"""
    import re
    # Convert to lowercase, replace spaces with hyphens, remove special chars
    base = re.sub(r'[^a-z0-9\s-]', '', name.lower())
    base = re.sub(r'[\s-]+', '-', base).strip('-')
    
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
    if currency == 'IDR':
        return f"Rp {amount:,.0f}".replace(',', '.')
    return f"${amount:,.2f}"

# ============= LOGIN MANAGER =============
@login_manager.user_loader
def load_user(user_id):
    return Owner.query.get(int(user_id))

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
        data = request.json if request.is_json else request.form
        username = data.get('username')
        password = data.get('password')
        
        owner = Owner.query.filter_by(username=username).first()
        
        if owner and owner.check_password(password):
            login_user(owner)
            owner.last_login = datetime.utcnow()
            db.session.commit()
            
            return jsonify({
                'success': True,
                'redirect': url_for('owner_dashboard')
            })
        
        return jsonify({
            'success': False,
            'message': 'Username atau password salah'
        })
    
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
    return render_template('owner/websites.html', websites=websites)

@app.route('/owner/websites/create', methods=['GET', 'POST'])
@login_required
def owner_website_create():
    """Create new website"""
    if request.method == 'POST':
        data = request.json if request.is_json else request.form
        
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
        
        return jsonify({
            'success': True,
            'message': 'Website created successfully',
            'website': website.to_dict(),
            'redirect': url_for('owner_website_edit', id=website.id)
        })
    
    return render_template('owner/website-create.html')

@app.route('/owner/websites/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def owner_website_edit(id):
    """Edit website"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    
    if request.method == 'POST':
        data = request.json if request.is_json else request.form
        
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
        website.is_active = data.get('is_active', 'true') == 'true'
        website.is_public = data.get('is_public', 'true') == 'true'
        
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
        
        return jsonify({
            'success': True,
            'message': 'Website updated successfully'
        })
    
    return render_template('owner/website-edit.html', website=website)

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

@app.route('/owner/websites/<int:id>/products')
@login_required
def owner_website_products(id):
    """Manage products for website"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    products = Product.query.filter_by(website_id=id).order_by(Product.created_at.desc()).all()
    categories = Category.query.filter_by(website_id=id, is_active=True).all()
    
    return render_template('owner/products.html', 
                         website=website, 
                         products=products,
                         categories=categories)

@app.route('/owner/websites/<int:id>/orders')
@login_required
def owner_website_orders(id):
    """Manage orders for website"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    orders = Order.query.filter_by(website_id=id).order_by(Order.created_at.desc()).all()
    
    return render_template('owner/orders.html', website=website, orders=orders)

@app.route('/owner/websites/<int:id>/customers')
@login_required
def owner_website_customers(id):
    """Manage customers for website"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    customers = Customer.query.filter_by(website_id=id).order_by(Customer.created_at.desc()).all()
    
    return render_template('owner/customers.html', website=website, customers=customers)

@app.route('/owner/websites/<int:id>/settings')
@login_required
def owner_website_settings(id):
    """Website settings"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    return render_template('owner/website-settings.html', website=website)

@app.route('/owner/websites/<int:id>/preview')
@login_required
def owner_website_preview(id):
    """Preview website"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    return redirect(url_for('store_index', endpoint=website.endpoint))

# ============= API ROUTES FOR WEBSITE MANAGEMENT =============
@app.route('/api/owner/websites/<int:id>/products', methods=['GET', 'POST', 'PUT', 'DELETE'])
@login_required
def api_website_products(id):
    """API for product management"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    
    if request.method == 'GET':
        products = Product.query.filter_by(website_id=id).all()
        return jsonify([p.to_dict() for p in products])
    
    elif request.method == 'POST':
        data = request.json
        
        product = Product(
            website_id=id,
            category_id=data.get('category_id'),
            name=data['name'],
            description=data.get('description'),
            price=data['price'],
            compare_price=data.get('compare_price'),
            stock=data.get('stock', 0),
            image_url=data.get('image_url'),
            is_digital=data.get('is_digital', True),
            is_featured=data.get('is_featured', False)
        )
        
        db.session.add(product)
        db.session.commit()
        
        return jsonify({'success': True, 'product': product.to_dict()})
    
    elif request.method == 'PUT':
        data = request.json
        product = Product.query.filter_by(id=data['id'], website_id=id).first_or_404()
        
        product.name = data.get('name', product.name)
        product.description = data.get('description', product.description)
        product.price = data.get('price', product.price)
        product.compare_price = data.get('compare_price', product.compare_price)
        product.stock = data.get('stock', product.stock)
        product.category_id = data.get('category_id', product.category_id)
        product.image_url = data.get('image_url', product.image_url)
        product.is_active = data.get('is_active', product.is_active)
        product.is_featured = data.get('is_featured', product.is_featured)
        
        db.session.commit()
        
        return jsonify({'success': True})
    
    elif request.method == 'DELETE':
        product_id = request.args.get('product_id')
        product = Product.query.filter_by(id=product_id, website_id=id).first_or_404()
        
        db.session.delete(product)
        db.session.commit()
        
        return jsonify({'success': True})

@app.route('/api/owner/websites/<int:id>/categories', methods=['GET', 'POST', 'PUT', 'DELETE'])
@login_required
def api_website_categories(id):
    """API for category management"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    
    if request.method == 'GET':
        categories = Category.query.filter_by(website_id=id).all()
        return jsonify([c.to_dict() for c in categories])
    
    elif request.method == 'POST':
        data = request.json
        
        category = Category(
            website_id=id,
            name=data['name'],
            icon=data.get('icon'),
            description=data.get('description'),
            image_url=data.get('image_url'),
            sort_order=data.get('sort_order', 0)
        )
        
        db.session.add(category)
        db.session.commit()
        
        return jsonify({'success': True, 'category': category.to_dict()})
    
    elif request.method == 'PUT':
        data = request.json
        category = Category.query.filter_by(id=data['id'], website_id=id).first_or_404()
        
        category.name = data.get('name', category.name)
        category.icon = data.get('icon', category.icon)
        category.description = data.get('description', category.description)
        category.image_url = data.get('image_url', category.image_url)
        category.is_active = data.get('is_active', category.is_active)
        category.sort_order = data.get('sort_order', category.sort_order)
        
        db.session.commit()
        
        return jsonify({'success': True})
    
    elif request.method == 'DELETE':
        category_id = request.args.get('category_id')
        category = Category.query.filter_by(id=category_id, website_id=id).first_or_404()
        
        db.session.delete(category)
        db.session.commit()
        
        return jsonify({'success': True})

@app.route('/api/owner/websites/<int:id>/orders/<int:order_id>/status', methods=['POST'])
@login_required
def api_update_order_status(id, order_id):
    """Update order status"""
    website = Website.query.filter_by(id=id, owner_id=current_user.id).first_or_404()
    order = Order.query.filter_by(id=order_id, website_id=id).first_or_404()
    
    data = request.json
    new_status = data.get('status')
    
    if new_status in ['pending', 'paid', 'processing', 'completed', 'cancelled']:
        order.status = new_status
        
        if new_status == 'paid':
            order.paid_at = datetime.utcnow()
        elif new_status == 'processing':
            order.processed_at = datetime.utcnow()
        elif new_status == 'completed':
            order.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'success': True})
    
    return jsonify({'success': False, 'message': 'Invalid status'})

# ============= STORE ROUTES (Dynamic based on endpoint) =============
@app.route('/store/<endpoint>')
@website_required
def store_index(website):
    """Store homepage"""
    products = Product.query.filter_by(website_id=website.id, is_active=True, is_featured=True).limit(8).all()
    categories = Category.query.filter_by(website_id=website.id, is_active=True).all()
    
    return render_template('store/index.html', 
                         website=website,
                         products=products,
                         categories=categories,
                         format_currency=format_currency)

@app.route('/store/<endpoint>/products')
@website_required
def store_products(website):
    """Products page"""
    category_id = request.args.get('category', type=int)
    search = request.args.get('search')
    
    query = Product.query.filter_by(website_id=website.id, is_active=True)
    
    if category_id:
        query = query.filter_by(category_id=category_id)
    
    if search:
        query = query.filter(Product.name.contains(search) | Product.description.contains(search))
    
    products = query.order_by(Product.created_at.desc()).all()
    categories = Category.query.filter_by(website_id=website.id, is_active=True).all()
    
    return render_template('store/products.html',
                         website=website,
                         products=products,
                         categories=categories,
                         selected_category=category_id,
                         search=search,
                         format_currency=format_currency)

@app.route('/store/<endpoint>/product/<int:product_id>')
@website_required
def store_product_detail(website, product_id):
    """Product detail page"""
    product = Product.query.filter_by(id=product_id, website_id=website.id, is_active=True).first_or_404()
    related = Product.query.filter_by(website_id=website.id, category_id=product.category_id, is_active=True)\
                    .filter(Product.id != product.id).limit(4).all()
    
    return render_template('store/product-detail.html',
                         website=website,
                         product=product,
                         related=related,
                         format_currency=format_currency)

@app.route('/store/<endpoint>/cart')
@website_required
def store_cart(website):
    """Cart page"""
    return render_template('store/cart.html', website=website, format_currency=format_currency)

@app.route('/store/<endpoint>/checkout')
@website_required
def store_checkout(website):
    """Checkout page"""
    return render_template('store/checkout.html', website=website, format_currency=format_currency)

@app.route('/store/<endpoint>/orders')
@website_required
def store_orders(website):
    """Customer orders page"""
    return render_template('store/orders.html', website=website)

@app.route('/store/<endpoint>/order/<order_number>')
@website_required
def store_order_detail(website, order_number):
    """Order detail page"""
    order = Order.query.filter_by(website_id=website.id, order_number=order_number).first_or_404()
    return render_template('store/order-detail.html', website=website, order=order, format_currency=format_currency)

# ============= STORE API =============
@app.route('/api/store/<endpoint>/products', methods=['GET'])
@website_required
def api_store_products(website):
    """API to get products"""
    category = request.args.get('category')
    search = request.args.get('search')
    
    query = Product.query.filter_by(website_id=website.id, is_active=True)
    
    if category and category != 'all':
        query = query.filter_by(category_id=category)
    
    if search:
        query = query.filter(Product.name.contains(search))
    
    products = query.all()
    return jsonify([p.to_dict() for p in products])

@app.route('/api/store/<endpoint>/cart/add', methods=['POST'])
@website_required
def api_store_add_to_cart(website):
    """Add to cart"""
    data = request.json
    
    # Simple cart implementation using session
    if 'cart' not in session:
        session['cart'] = {}
    
    cart = session['cart']
    product_id = str(data['product_id'])
    
    if product_id in cart:
        cart[product_id]['quantity'] += data.get('quantity', 1)
    else:
        product = Product.query.get(data['product_id'])
        if product and product.is_active:
            cart[product_id] = {
                'id': product.id,
                'name': product.name,
                'price': product.price,
                'quantity': data.get('quantity', 1),
                'image': product.image_url
            }
    
    session['cart'] = cart
    session.modified = True
    
    return jsonify({
        'success': True,
        'cart_count': len(cart),
        'cart': cart
    })

@app.route('/api/store/<endpoint>/cart', methods=['GET'])
@website_required
def api_store_get_cart(website):
    """Get cart contents"""
    cart = session.get('cart', {})
    total = sum(item['price'] * item['quantity'] for item in cart.values())
    
    return jsonify({
        'items': list(cart.values()),
        'total': total,
        'count': len(cart)
    })

@app.route('/api/store/<endpoint>/cart/update', methods=['POST'])
@website_required
def api_store_update_cart(website):
    """Update cart item"""
    data = request.json
    cart = session.get('cart', {})
    
    product_id = str(data['product_id'])
    if product_id in cart:
        cart[product_id]['quantity'] = data['quantity']
        if cart[product_id]['quantity'] <= 0:
            del cart[product_id]
    
    session['cart'] = cart
    session.modified = True
    
    total = sum(item['price'] * item['quantity'] for item in cart.values())
    
    return jsonify({
        'success': True,
        'cart': list(cart.values()),
        'total': total
    })

@app.route('/api/store/<endpoint>/checkout', methods=['POST'])
@website_required
def api_store_checkout(website):
    """Process checkout"""
    data = request.json
    cart = session.get('cart', {})
    
    if not cart:
        return jsonify({'success': False, 'message': 'Cart is empty'})
    
    # Create customer
    customer = Customer(
        website_id=website.id,
        name=data['name'],
        email=data.get('email'),
        phone=data.get('phone'),
        whatsapp=data.get('whatsapp')
    )
    db.session.add(customer)
    db.session.flush()
    
    # Create order
    order_number = f"ORD{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{secrets.token_hex(4).upper()}"
    total_amount = sum(item['price'] * item['quantity'] for item in cart.values())
    
    order = Order(
        website_id=website.id,
        customer_id=customer.id,
        order_number=order_number,
        total_amount=total_amount,
        customer_name=data['name'],
        customer_email=data.get('email'),
        customer_phone=data.get('phone'),
        customer_whatsapp=data.get('whatsapp'),
        payment_method=data.get('payment_method'),
        notes=data.get('notes')
    )
    db.session.add(order)
    db.session.flush()
    
    # Create order items
    for product_id, item in cart.items():
        order_item = OrderItem(
            order_id=order.id,
            product_id=int(product_id),
            product_name=item['name'],
            quantity=item['quantity'],
            price=item['price'],
            subtotal=item['price'] * item['quantity']
        )
        db.session.add(order_item)
        
        # Update stock
        product = Product.query.get(int(product_id))
        if product:
            product.stock -= item['quantity']
    
    db.session.commit()
    
    # Clear cart
    session['cart'] = {}
    session.modified = True
    
    return jsonify({
        'success': True,
        'order_number': order_number,
        'redirect': url_for('store_order_detail', endpoint=website.endpoint, order_number=order_number)
    })

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
    # Create instance folder
    os.makedirs('instance', exist_ok=True)
    
    # Run app
    print("""
    ╔══════════════════════════════════════════╗
    ║     TopUp Store Manager - Owner Panel    ║
    ╚══════════════════════════════════════════╝
    
    📝 Owner Login:
    Username: Master
    Password: Asdf1234
    
    🌐 Server running at: http://127.0.0.1:5000
    """)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
