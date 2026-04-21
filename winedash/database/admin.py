# winedash/database/admin.py
import sqlite3
from datetime import datetime
from typing import List, Dict, Optional, Any
import pytz
import os

class AdminDatabase:
    def __init__(self, db_path: str = "/root/wtb/winedash/database/winedash.db"):
        self.db_path = db_path
        self.timezone = pytz.timezone('Asia/Jakarta')
        self.init_admin_tables()
    
    def _get_now(self) -> str:
        return datetime.now(self.timezone).isoformat()
    
    def init_admin_tables(self):
        """Initialize admin logs table"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Admin logs table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        admin_id INTEGER NOT NULL,
                        action TEXT NOT NULL,
                        target_type TEXT,
                        target_id TEXT,
                        details TEXT,
                        ip_address TEXT,
                        user_agent TEXT,
                        created_at TIMESTAMP
                    )
                ''')
                
                # Admin settings table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS admin_settings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        setting_key TEXT UNIQUE NOT NULL,
                        setting_value TEXT,
                        updated_at TIMESTAMP
                    )
                ''')
                
                conn.commit()
                print("✅ Admin tables initialized")
                
        except Exception as e:
            print(f"Error initializing admin tables: {e}")
    
    def log_admin_action(self, admin_id: int, action: str, target_type: str = None,
                         target_id: str = None, details: str = None,
                         ip_address: str = None, user_agent: str = None) -> bool:
        """Log admin action"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                cursor.execute('''
                    INSERT INTO admin_logs 
                    (admin_id, action, target_type, target_id, details, ip_address, user_agent, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (admin_id, action, target_type, target_id, details, ip_address, user_agent, now))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error logging admin action: {e}")
            return False
    
    def get_admin_logs(self, limit: int = 100) -> List[Dict]:
        """Get admin action logs"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT l.*, u.username, u.first_name
                    FROM admin_logs l
                    LEFT JOIN users u ON l.admin_id = u.user_id
                    ORDER BY l.created_at DESC
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            print(f"Error getting admin logs: {e}")
            return []
    
    def get_all_users(self, limit: int = 200) -> List[Dict]:
        """Get all users with additional info"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT u.*,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id) as total_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id AND status = 'available') as listed_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id AND status = 'unlisted') as unlisted_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id AND status = 'on_auction') as auction_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE buyer_id = u.user_id AND status = 'sold') as purchased_usernames,
                           (SELECT COUNT(*) FROM pending_usernames WHERE seller_id = u.user_id AND status = 'pending') as pending_usernames,
                           (SELECT COUNT(*) FROM auctions WHERE owner_id = u.user_id) as total_auctions,
                           (SELECT COUNT(*) FROM auctions WHERE owner_id = u.user_id AND status = 'active') as active_auctions,
                           (SELECT COUNT(*) FROM auctions WHERE owner_id = u.user_id AND status = 'ended') as ended_auctions,
                           (SELECT COUNT(*) FROM bids WHERE user_id = u.user_id) as total_bids,
                           (SELECT COUNT(*) FROM offers WHERE owner_id = u.user_id AND status = 'pending') as pending_offers_received,
                           (SELECT COUNT(*) FROM offers WHERE bidder_id = u.user_id AND status = 'pending') as pending_offers_sent
                    FROM users u
                    ORDER BY u.user_id DESC
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                users = []
                for row in rows:
                    user = dict(row)
                    # Convert decimal to float
                    if user.get('balance'):
                        user['balance'] = float(user['balance'])
                    if user.get('total_deposit'):
                        user['total_deposit'] = float(user['total_deposit'])
                    if user.get('total_withdraw'):
                        user['total_withdraw'] = float(user['total_withdraw'])
                    users.append(user)
                return users
        except Exception as e:
            print(f"Error getting all users: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_all_usernames(self, limit: int = 500) -> List[Dict]:
        """Get all usernames with seller/buyer info"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT u.*,
                           s.username as seller_username,
                           s.first_name as seller_name,
                           b.username as buyer_username,
                           b.first_name as buyer_name,
                           (SELECT COUNT(*) FROM auctions WHERE username_id = u.id) as auction_count
                    FROM usernames u
                    LEFT JOIN users s ON u.seller_id = s.user_id
                    LEFT JOIN users b ON u.buyer_id = b.user_id
                    ORDER BY u.id DESC
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                usernames = []
                for row in rows:
                    username = dict(row)
                    if username.get('price'):
                        username['price'] = float(username['price'])
                    usernames.append(username)
                return usernames
        except Exception as e:
            print(f"Error getting all usernames: {e}")
            return []
    
    def get_all_pending_usernames(self, limit: int = 200) -> List[Dict]:
        """Get all pending usernames"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT p.*, u.username as seller_username, u.first_name as seller_name
                    FROM pending_usernames p
                    LEFT JOIN users u ON p.seller_id = u.user_id
                    WHERE p.status = 'pending'
                    ORDER BY p.created_at DESC
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                pendings = []
                for row in rows:
                    pending = dict(row)
                    if pending.get('price'):
                        pending['price'] = float(pending['price'])
                    pendings.append(pending)
                return pendings
        except Exception as e:
            print(f"Error getting pending usernames: {e}")
            return []
    
    def get_all_auctions(self, limit: int = 200) -> List[Dict]:
        """Get all auctions with details"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT a.*,
                           u.username as owner_username,
                           u.first_name as owner_name,
                           w.username as winner_username,
                           w.first_name as winner_name,
                           (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
                    FROM auctions a
                    LEFT JOIN users u ON a.owner_id = u.user_id
                    LEFT JOIN users w ON a.winner_id = w.user_id
                    ORDER BY a.created_at DESC
                    LIMIT ?
                ''', (limit,))
                
                rows = cursor.fetchall()
                auctions = []
                for row in rows:
                    auction = dict(row)
                    if auction.get('start_price'):
                        auction['start_price'] = float(auction['start_price'])
                    if auction.get('current_price'):
                        auction['current_price'] = float(auction['current_price'])
                    if auction.get('min_increment'):
                        auction['min_increment'] = float(auction['min_increment'])
                    if auction.get('winning_bid'):
                        auction['winning_bid'] = float(auction['winning_bid'])
                    auctions.append(auction)
                return auctions
        except Exception as e:
            print(f"Error getting auctions: {e}")
            return []
    
    def update_user_balance_admin(self, user_id: int, amount: float, is_add: bool = True) -> bool:
        """Update user balance by admin"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                now = self._get_now()
                
                if is_add:
                    cursor.execute('''
                        UPDATE users SET balance = balance + ?, total_deposit = total_deposit + ?
                        WHERE user_id = ?
                    ''', (amount, amount, user_id))
                else:
                    cursor.execute('''
                        UPDATE users SET balance = balance - ?, total_withdraw = total_withdraw + ?
                        WHERE user_id = ? AND balance >= ?
                    ''', (amount, amount, user_id, amount))
                
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error updating user balance: {e}")
            return False
    
    def get_system_stats(self) -> Dict:
        """Get system statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Total users
                cursor.execute("SELECT COUNT(*) FROM users")
                total_users = cursor.fetchone()[0] or 0
                
                # Total usernames
                cursor.execute("SELECT COUNT(*) FROM usernames")
                total_usernames = cursor.fetchone()[0] or 0
                
                # Listed usernames
                cursor.execute("SELECT COUNT(*) FROM usernames WHERE status = 'available'")
                listed_usernames = cursor.fetchone()[0] or 0
                
                # Sold usernames
                cursor.execute("SELECT COUNT(*) FROM usernames WHERE status = 'sold'")
                sold_usernames = cursor.fetchone()[0] or 0
                
                # Total volume (sum of sold prices)
                cursor.execute("SELECT SUM(price) FROM usernames WHERE status = 'sold'")
                total_volume = cursor.fetchone()[0] or 0
                
                # Total deposits
                cursor.execute("SELECT SUM(amount) FROM deposits WHERE status = 'completed'")
                total_deposits = cursor.fetchone()[0] or 0
                
                # Total withdrawals
                cursor.execute("SELECT SUM(amount) FROM withdrawals WHERE status = 'completed'")
                total_withdrawals = cursor.fetchone()[0] or 0
                
                # Active auctions
                cursor.execute("SELECT COUNT(*) FROM auctions WHERE status = 'active'")
                active_auctions = cursor.fetchone()[0] or 0
                
                # Ended auctions
                cursor.execute("SELECT COUNT(*) FROM auctions WHERE status = 'ended'")
                ended_auctions = cursor.fetchone()[0] or 0
                
                # Pending offers
                cursor.execute("SELECT COUNT(*) FROM offers WHERE status = 'pending'")
                pending_offers = cursor.fetchone()[0] or 0
                
                # Pending usernames
                cursor.execute("SELECT COUNT(*) FROM pending_usernames WHERE status = 'pending'")
                pending_usernames = cursor.fetchone()[0] or 0
                
                return {
                    'total_users': total_users,
                    'total_usernames': total_usernames,
                    'listed_usernames': listed_usernames,
                    'sold_usernames': sold_usernames,
                    'total_volume': float(total_volume),
                    'total_deposits': float(total_deposits),
                    'total_withdrawals': float(total_withdrawals),
                    'active_auctions': active_auctions,
                    'ended_auctions': ended_auctions,
                    'pending_offers': pending_offers,
                    'pending_usernames': pending_usernames
                }
        except Exception as e:
            print(f"Error getting system stats: {e}")
            return {}
    
    def get_user_detail(self, user_id: int) -> Optional[Dict]:
        """Get detailed user information"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT u.*,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id) as total_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id AND status = 'available') as listed_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id AND status = 'unlisted') as unlisted_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE seller_id = u.user_id AND status = 'on_auction') as auction_usernames,
                           (SELECT COUNT(*) FROM usernames WHERE buyer_id = u.user_id AND status = 'sold') as purchased_usernames,
                           (SELECT COUNT(*) FROM pending_usernames WHERE seller_id = u.user_id AND status = 'pending') as pending_usernames,
                           (SELECT COUNT(*) FROM auctions WHERE owner_id = u.user_id) as total_auctions,
                           (SELECT COUNT(*) FROM auctions WHERE owner_id = u.user_id AND status = 'active') as active_auctions,
                           (SELECT COUNT(*) FROM auctions WHERE owner_id = u.user_id AND status = 'ended') as ended_auctions,
                           (SELECT COUNT(*) FROM bids WHERE user_id = u.user_id) as total_bids,
                           (SELECT SUM(bid_amount) FROM bids WHERE user_id = u.user_id) as total_bid_amount,
                           (SELECT COUNT(*) FROM offers WHERE owner_id = u.user_id AND status = 'pending') as pending_offers_received,
                           (SELECT COUNT(*) FROM offers WHERE bidder_id = u.user_id AND status = 'pending') as pending_offers_sent
                    FROM users u
                    WHERE u.user_id = ?
                ''', (user_id,))
                
                row = cursor.fetchone()
                if row:
                    user = dict(row)
                    if user.get('balance'):
                        user['balance'] = float(user['balance'])
                    if user.get('total_deposit'):
                        user['total_deposit'] = float(user['total_deposit'])
                    if user.get('total_withdraw'):
                        user['total_withdraw'] = float(user['total_withdraw'])
                    if user.get('total_bid_amount'):
                        user['total_bid_amount'] = float(user['total_bid_amount'])
                    return user
                return None
        except Exception as e:
            print(f"Error getting user detail: {e}")
            return None
    
    def get_user_usernames(self, user_id: int) -> List[Dict]:
        """Get all usernames owned by user"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT u.*,
                           (SELECT COUNT(*) FROM auctions WHERE username_id = u.id) as auction_count
                    FROM usernames u
                    WHERE u.seller_id = ?
                    ORDER BY u.id DESC
                ''', (user_id,))
                
                rows = cursor.fetchall()
                usernames = []
                for row in rows:
                    username = dict(row)
                    if username.get('price'):
                        username['price'] = float(username['price'])
                    usernames.append(username)
                return usernames
        except Exception as e:
            print(f"Error getting user usernames: {e}")
            return []
    
    def get_user_transactions(self, user_id: int, limit: int = 50) -> List[Dict]:
        """Get user transactions"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT * FROM transactions
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                ''', (user_id, limit))
                
                rows = cursor.fetchall()
                transactions = []
                for row in rows:
                    tx = dict(row)
                    if tx.get('amount'):
                        tx['amount'] = float(tx['amount'])
                    transactions.append(tx)
                return transactions
        except Exception as e:
            print(f"Error getting user transactions: {e}")
            return []
    
    def delete_username_admin(self, username_id: int) -> bool:
        """Delete username by admin"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Get username first
                cursor.execute('SELECT username FROM usernames WHERE id = ?', (username_id,))
                row = cursor.fetchone()
                if not row:
                    return False
                
                username = row[0]
                
                # Delete username
                cursor.execute('DELETE FROM usernames WHERE id = ?', (username_id,))
                
                # Also delete from pending if exists
                cursor.execute('DELETE FROM pending_usernames WHERE username = ?', (username,))
                
                conn.commit()
                return True
        except Exception as e:
            print(f"Error deleting username: {e}")
            return False
    
    def delete_user_admin(self, user_id: int) -> bool:
        """Delete user by admin (only if no transactions)"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Check if user has transactions
                cursor.execute('SELECT COUNT(*) FROM transactions WHERE user_id = ?', (user_id,))
                tx_count = cursor.fetchone()[0] or 0
                
                if tx_count > 0:
                    return False
                
                # Delete user
                cursor.execute('DELETE FROM users WHERE user_id = ?', (user_id,))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error deleting user: {e}")
            return False