import os
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Owner(db.Model):
    """Model untuk owner (master admin)"""
    __tablename__ = 'owners'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    
    # Relasi ke websites
    websites = db.relationship('Website', backref='owner', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'websites_count': len(self.websites)
        }

class Website(db.Model):
    """Model untuk setiap website toko yang dibuat owner"""
    __tablename__ = 'websites'
    
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('owners.id'), nullable=False)
    
    # Informasi dasar
    name = db.Column(db.String(100), nullable=False)
    endpoint = db.Column(db.String(50), unique=True, nullable=False)  # String unik untuk URL
    description = db.Column(db.Text)
    logo_url = db.Column(db.String(200))
    favicon_url = db.Column(db.String(200))
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    is_public = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    
    # Pengaturan toko
    currency = db.Column(db.String(10), default='IDR')
    whatsapp_number = db.Column(db.String(20))
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    
    # Bot Telegram (per website bisa beda bot)
    telegram_bot_token = db.Column(db.String(100))
    telegram_bot_username = db.Column(db.String(100))
    telegram_chat_id = db.Column(db.String(50))  # ID admin untuk notifikasi
    
    # Tema dan tampilan
    theme_color = db.Column(db.String(20), default='#4f46e5')
    font_family = db.Column(db.String(50), default='Inter')
    layout = db.Column(db.String(20), default='modern')
    
    # Metadata
    meta_title = db.Column(db.String(200))
    meta_description = db.Column(db.Text)
    meta_keywords = db.Column(db.String(500))
    
    # Relasi ke data toko
    categories = db.relationship('Category', backref='website', lazy=True, cascade='all, delete-orphan')
    products = db.relationship('Product', backref='website', lazy=True, cascade='all, delete-orphan')
    orders = db.relationship('Order', backref='website', lazy=True, cascade='all, delete-orphan')
    customers = db.relationship('Customer', backref='website', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'endpoint': self.endpoint,
            'description': self.description,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'currency': self.currency,
            'whatsapp_number': self.whatsapp_number,
            'telegram_bot_username': self.telegram_bot_username,
            'theme_color': self.theme_color,
            'products_count': len(self.products),
            'orders_count': len(self.orders)
        }
    
    @property
    def url(self):
        """Mendapatkan URL lengkap website"""
        return f"/store/{self.endpoint}"

class Category(db.Model):
    """Kategori produk per website"""
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('websites.id'), nullable=False)
    
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(100))
    icon = db.Column(db.String(50))
    description = db.Column(db.Text)
    image_url = db.Column(db.String(200))
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relasi ke products
    products = db.relationship('Product', backref='category', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'icon': self.icon,
            'description': self.description,
            'image_url': self.image_url,
            'is_active': self.is_active,
            'sort_order': self.sort_order
        }

class Product(db.Model):
    """Produk per website"""
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('websites.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    
    # Informasi produk
    name = db.Column(db.String(200), nullable=False)
    slug = db.Column(db.String(200))
    description = db.Column(db.Text)
    price = db.Column(db.Float, nullable=False, default=0)
    compare_price = db.Column(db.Float)  # Harga sebelum diskon
    cost_price = db.Column(db.Float)  # Harga modal
    stock = db.Column(db.Integer, default=0)
    sku = db.Column(db.String(50))
    
    # Media
    image_url = db.Column(db.String(500))
    gallery = db.Column(db.Text)  # JSON array of image URLs
    
    # Status
    is_active = db.Column(db.Boolean, default=True)
    is_digital = db.Column(db.Boolean, default=True)
    is_featured = db.Column(db.Boolean, default=False)
    
    # Untuk produk digital
    digital_content = db.Column(db.Text)  # Link atau konten digital
    delivery_type = db.Column(db.String(20), default='auto')  # auto/manual
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'price': self.price,
            'compare_price': self.compare_price,
            'stock': self.stock,
            'image_url': self.image_url,
            'is_active': self.is_active,
            'is_digital': self.is_digital,
            'is_featured': self.is_featured,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None
        }

class Customer(db.Model):
    """Customer per website"""
    __tablename__ = 'customers'
    
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('websites.id'), nullable=False)
    
    # Informasi customer
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    whatsapp = db.Column(db.String(20))
    
    # Akun
    username = db.Column(db.String(50))
    password_hash = db.Column(db.String(200))
    
    # Telegram (untuk notifikasi)
    telegram_id = db.Column(db.String(50))
    telegram_username = db.Column(db.String(100))
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_order = db.Column(db.DateTime)
    
    # Relasi ke orders
    orders = db.relationship('Order', backref='customer', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'whatsapp': self.whatsapp,
            'username': self.username,
            'telegram_username': self.telegram_username,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'orders_count': len(self.orders)
        }

class Order(db.Model):
    """Pesanan per website"""
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    website_id = db.Column(db.Integer, db.ForeignKey('websites.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'))
    
    # Informasi pesanan
    order_number = db.Column(db.String(50), unique=True, nullable=False)
    total_amount = db.Column(db.Float, nullable=False, default=0)
    status = db.Column(db.String(20), default='pending')  # pending, paid, processing, completed, cancelled
    payment_status = db.Column(db.String(20), default='pending')
    payment_method = db.Column(db.String(50))
    payment_proof = db.Column(db.String(200))
    
    # Customer info (snapshot)
    customer_name = db.Column(db.String(100))
    customer_email = db.Column(db.String(100))
    customer_phone = db.Column(db.String(20))
    customer_whatsapp = db.Column(db.String(20))
    
    # Catatan
    notes = db.Column(db.Text)
    admin_notes = db.Column(db.Text)
    
    # Waktu
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    paid_at = db.Column(db.DateTime)
    processed_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    # Relasi ke items
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_number': self.order_number,
            'total_amount': self.total_amount,
            'status': self.status,
            'payment_status': self.payment_status,
            'customer_name': self.customer_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'items': [item.to_dict() for item in self.items]
        }

class OrderItem(db.Model):
    """Item dalam pesanan"""
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    
    product_id = db.Column(db.Integer)
    product_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    price = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)
    
    # Untuk produk digital
    delivery_status = db.Column(db.String(20), default='pending')
    delivery_data = db.Column(db.Text)  # JSON data
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'quantity': self.quantity,
            'price': self.price,
            'subtotal': self.subtotal
        }

class Setting(db.Model):
    """Pengaturan global"""
    __tablename__ = 'settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(100), unique=True, nullable=False)
    value = db.Column(db.Text)
    description = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, onupdate=datetime.utcnow)

def init_db(app):
    """Inisialisasi database"""
    with app.app_context():
        db.create_all()
        
        # Buat owner default jika belum ada
        if not Owner.query.filter_by(username='owner').first():
            owner = Owner(
                username='owner',
                email='owner@topupstore.com',
                full_name='Master Owner'
            )
            owner.set_password('owner123')
            db.session.add(owner)
            
            # Buat setting default
            settings = [
                Setting(key='site_name', value='TopUp Store Manager'),
                Setting(key='site_description', value='Manage your topup stores'),
                Setting(key='allow_registration', value='true'),
            ]
            for setting in settings:
                db.session.add(setting)
            
            db.session.commit()
            print("✅ Owner default created!")
