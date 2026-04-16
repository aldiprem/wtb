# giveaway/services/giveaway_service.py - PERBAIKAN TOTAL

import sqlite3
import json
import os
import random
import string
from datetime import datetime
from typing import Dict, List, Optional, Any
from flask import Blueprint, request, jsonify, g
from functools import wraps
import sys
from pathlib import Path

# APScheduler - import dengan aman (optional dependency)
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    import atexit
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    print("[WARNING] APScheduler not installed, scheduler disabled")

# Add root to path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from giveaway.database.giveaway import GiveawayDatabase

# Create blueprint
giveaway_bp = Blueprint('giveaway', __name__, url_prefix='/api/giveaway')

# Initialize database
db = GiveawayDatabase()

# ============ SCHEDULER ============
scheduler = None

if SCHEDULER_AVAILABLE:
    try:
        scheduler = BackgroundScheduler()
        
        def process_completed_checks():
            """Process completed user checks and update frontend"""
            try:
                # TODO: Implement WebSocket or SSE notification
                # Untuk sekarang hanya log
                print(f"[Scheduler] Checking for completed user states at {datetime.now()}")
            except Exception as e:
                print(f"[Scheduler] Error: {e}")
        
        scheduler.add_job(func=process_completed_checks, trigger="interval", seconds=1)
        scheduler.start()
        print("[INFO] Scheduler started successfully")
        
        # Cleanup on shutdown
        atexit.register(lambda: scheduler.shutdown() if scheduler else None)
    except Exception as e:
        print(f"[ERROR] Failed to start scheduler: {e}")
        scheduler = None
else:
    print("[INFO] Scheduler disabled - APScheduler not installed")
# ===================================


def validate_telegram_data(data: dict) -> tuple:
    """Validate and extract Telegram user data from WebApp initData"""
    try:
        user_id = data.get('id')
        username = data.get('username', '')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        
        if user_id:
            return True, user_id, username, first_name, last_name
        return False, None, None, None, None
    except Exception as e:
        print(f"Error validating telegram data: {e}")
        return False, None, None, None, None


def generate_participation_token() -> str:
    """Generate unique token for participation"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))


# ==================== ROUTES ====================

@giveaway_bp.route('/info/<giveaway_code>', methods=['GET'])
def get_giveaway_info(giveaway_code):
    """Get giveaway information by code"""
    try:
        # Ambil dari tabel on_giveaway
        giveaway = db.get_on_giveaway(giveaway_code)
        
        if not giveaway:
            return jsonify({
                'success': False,
                'error': 'Giveaway tidak ditemukan'
            }), 404
        
        # Check if giveaway is expired
        now = datetime.now().isoformat()
        is_expired = giveaway['end_time'] <= now
        
        # Get participants count
        participants_count = len(giveaway.get('participants', []))
        
        # Get giveaway_id untuk mengambil data tambahan
        giveaway_id = giveaway.get('giveaway_id', '')
        
        # 🔥 AMBIL LANGSUNG DARI DATABASE DENGAN KONEKSI BARU
        syarat = 'None'
        links = []
        captcha = 'Off'
        
        try:
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                
                # Ambil syarat
                cursor.execute("SELECT syarat FROM giveaways WHERE giveaway_id = ?", (giveaway_id,))
                row = cursor.fetchone()
                if row and row[0]:
                    syarat = row[0]
                    print(f"[DEBUG] Found syarat for {giveaway_id}: {syarat}")
                else:
                    print(f"[DEBUG] No syarat found for {giveaway_id}, using default 'None'")
                
                # Ambil link
                cursor.execute("SELECT link FROM giveaways WHERE giveaway_id = ?", (giveaway_id,))
                row = cursor.fetchone()
                if row and row[0]:
                    links = [l.strip() for l in row[0].split('\n') if l.strip()]
                    print(f"[DEBUG] Found links for {giveaway_id}: {links}")
                
                # Ambil captcha
                cursor.execute("SELECT captcha FROM giveaways WHERE giveaway_id = ?", (giveaway_id,))
                row = cursor.fetchone()
                if row and row[0]:
                    captcha = row[0]
                    print(f"[DEBUG] Found captcha for {giveaway_id}: {captcha}")
                    
        except Exception as e:
            print(f"[ERROR] Failed to get additional data: {e}")
            import traceback
            traceback.print_exc()
        
        # Parse prize into list
        prize_lines = [p.strip() for p in giveaway['prize'].split('\n') if p.strip()]
        
        print(f"[DEBUG] Final response - syarat: {syarat}, links: {len(links)}, captcha: {captcha}")
        
        return jsonify({
            'success': True,
            'giveaway': {
                'code': giveaway['giveaway_code'],
                'id': giveaway['giveaway_id'],
                'prize': prize_lines,
                'winners_count': giveaway['winners_count'],
                'start_time': giveaway['start_time'],
                'end_time': giveaway['end_time'],
                'status': 'expired' if is_expired else giveaway['status'],
                'participants_count': participants_count,
                'links': links,
                'syarat': syarat,
                'captcha': captcha
            }
        })
        
    except Exception as e:
        print(f"Error getting giveaway info: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@giveaway_bp.route('/participate', methods=['POST'])
def participate_giveaway():
    """User participates in giveaway"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'Data tidak lengkap'
            }), 400
        
        giveaway_code = data.get('giveaway_code')
        user_data = data.get('user', {})
        
        # Validate user data
        is_valid, user_id, username, first_name, last_name = validate_telegram_data(user_data)
        
        # Ambil photo_url dari user_data
        photo_url = user_data.get('photo_url', '')
        
        if not is_valid or not user_id:
            return jsonify({
                'success': False,
                'error': 'Data user tidak valid'
            }), 400
        
        # Get giveaway
        giveaway = db.get_on_giveaway(giveaway_code)
        
        if not giveaway:
            return jsonify({
                'success': False,
                'error': 'Giveaway tidak ditemukan'
            }), 404
        
        # Check if expired
        now = datetime.now().isoformat()
        if giveaway['end_time'] <= now:
            return jsonify({
                'success': False,
                'error': 'Giveaway sudah berakhir'
            }), 400
        
        # Check if already participated
        participants = giveaway.get('participants', [])
        if user_id in participants:
            return jsonify({
                'success': False,
                'error': 'Anda sudah berpartisipasi dalam giveaway ini'
            }), 400
        
        # Save user to database with photo_url
        db.save_user(
            user_id=user_id,
            username=username or "",
            first_name=first_name or "",
            last_name=last_name or "",
            photo_url=photo_url or ""
        )
        
        # Add participant
        success = db.add_participant_to_on_giveaway(
            giveaway_code=giveaway_code,
            user_id=user_id,
            username=username or "",
            first_name=first_name or ""
        )
        
        if success:
            # Generate participation token
            token = generate_participation_token()
            
            return jsonify({
                'success': True,
                'message': 'Berhasil berpartisipasi!',
                'participant_number': len(participants) + 1,
                'token': token
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Gagal menambahkan partisipasi'
            }), 500
        
    except Exception as e:
        print(f"Error in participate_giveaway: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@giveaway_bp.route('/check-participation/<giveaway_code>/<int:user_id>', methods=['GET'])
def check_participation(giveaway_code, user_id):
    """Check if user has participated in giveaway"""
    try:
        giveaway = db.get_on_giveaway(giveaway_code)
        
        if not giveaway:
            return jsonify({
                'success': False,
                'error': 'Giveaway tidak ditemukan'
            }), 404
        
        participants = giveaway.get('participants', [])
        has_participated = user_id in participants
        
        return jsonify({
            'success': True,
            'has_participated': has_participated,
            'participants_count': len(participants)
        })
        
    except Exception as e:
        print(f"Error checking participation: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@giveaway_bp.route('/participants/<giveaway_code>', methods=['GET'])
def get_participants(giveaway_code):
    """Get list of participants (admin only)"""
    try:
        giveaway = db.get_on_giveaway(giveaway_code)
        
        if not giveaway:
            return jsonify({
                'success': False,
                'error': 'Giveaway tidak ditemukan'
            }), 404
        
        participants = giveaway.get('participants', [])
        
        # Get detailed user info with photo_url
        participants_detail = []
        for user_id in participants:
            user = db.get_user(user_id)
            if user:
                participants_detail.append({
                    'user_id': user['user_id'],
                    'username': user['username'],
                    'first_name': user['first_name'],
                    'last_name': user['last_name'],
                    'photo_url': user.get('photo_url', '')
                })
            else:
                participants_detail.append({
                    'user_id': user_id,
                    'username': None,
                    'first_name': None,
                    'last_name': None,
                    'photo_url': ''
                })
        
        return jsonify({
            'success': True,
            'participants': participants_detail,
            'total': len(participants_detail)
        })
        
    except Exception as e:
        print(f"Error getting participants: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@giveaway_bp.route('/stats', methods=['GET'])
def get_giveaway_stats():
    """Get giveaway statistics"""
    try:
        active_count = len(db.get_active_on_giveaways())
        
        # Get total participants across all active giveaways
        total_participants = 0
        active_giveaways = db.get_active_on_giveaways()
        
        for giveaway in active_giveaways:
            total_participants += len(giveaway.get('participants', []))
        
        return jsonify({
            'success': True,
            'stats': {
                'active_giveaways': active_count,
                'total_participants': total_participants
            }
        })
        
    except Exception as e:
        print(f"Error getting stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== DEBUG ENDPOINT ====================

@giveaway_bp.route('/debug/<giveaway_code>', methods=['GET'])
def debug_giveaway(giveaway_code):
    """Debug endpoint to check raw data"""
    try:
        giveaway = db.get_on_giveaway(giveaway_code)
        
        if not giveaway:
            return jsonify({'error': 'Not found'}), 404
        
        giveaway_id = giveaway.get('giveaway_id', '')
        
        # Ambil data langsung dari tabel giveaways
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Cek semua kolom di giveaways
            cursor.execute("PRAGMA table_info(giveaways)")
            columns = [col[1] for col in cursor.fetchall()]
            
            result = {}
            for col in ['syarat', 'link', 'captcha']:
                if col in columns and giveaway_id:
                    cursor.execute(f'SELECT {col} FROM giveaways WHERE giveaway_id = ?', (giveaway_id,))
                    row = cursor.fetchone()
                    result[col] = row[0] if row else None
                else:
                    result[col] = 'column_not_exists'
        
        return jsonify({
            'giveaway_code': giveaway_code,
            'giveaway_id': giveaway_id,
            'from_on_giveaway': {
                'prize': giveaway.get('prize'),
                'winners_count': giveaway.get('winners_count'),
                'participants_count': len(giveaway.get('participants', []))
            },
            'from_giveaways_table': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@giveaway_bp.route('/user-stats/<int:user_id>', methods=['GET'])
def get_user_stats(user_id):
    """Get user statistics: created, participated, won giveaways"""
    try:
        # Hitung giveaway yang dibuat user
        created_count = 0
        participated_count = 0
        won_count = 0
        
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            
            # Giveaway yang dibuat
            cursor.execute("SELECT COUNT(*) FROM on_giveaway WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()
            created_count = row[0] if row else 0
            
            # Giveaway yang diikuti
            cursor.execute("SELECT participants FROM on_giveaway")
            rows = cursor.fetchall()
            for row in rows:
                if row[0]:
                    participants = json.loads(row[0])
                    if user_id in participants:
                        participated_count += 1
            
            # Giveaway yang dimenangkan
            cursor.execute("SELECT winners FROM on_giveaway")
            rows = cursor.fetchall()
            for row in rows:
                if row[0]:
                    winners = json.loads(row[0])
                    if user_id in winners:
                        won_count += 1
        
        return jsonify({
            'success': True,
            'created_count': created_count,
            'participated_count': participated_count,
            'won_count': won_count
        })
    except Exception as e:
        print(f"Error getting user stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@giveaway_bp.route('/chats/<giveaway_code>', methods=['GET'])
def get_giveaway_chats(giveaway_code):
    """Get list of chat IDs for a giveaway"""
    try:
        # Ambil giveaway dari on_giveaway
        giveaway = db.get_on_giveaway(giveaway_code)
        
        if not giveaway:
            return jsonify({
                'success': False,
                'error': 'Giveaway tidak ditemukan'
            }), 404
        
        giveaway_id = giveaway.get('giveaway_id', '')
        
        if not giveaway_id:
            return jsonify({
                'success': False,
                'error': 'Giveaway ID tidak ditemukan'
            }), 404

        # Ambil chat info dari database
        chats = db.get_chat_info_by_giveaway_id(giveaway_id)
        
        return jsonify({
            'success': True,
            'chats': chats,
            'total': len(chats)
        })
        
    except Exception as e:
        print(f"Error getting giveaway chats: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
@giveaway_bp.route('/bot-info/<username>', methods=['GET'])
def get_bot_info(username):
    """Get bot information by username"""
    try:
        # Hapus @ jika ada di depan username
        clean_username = username.lstrip('@')
        
        # Coba ambil dari cache database terlebih dahulu
        bot_info = None
        try:
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                
                # Cek apakah tabel bot_info ada, jika tidak buat
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS bot_info (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        bot_name TEXT,
                        first_name TEXT,
                        photo_url TEXT,
                        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                conn.commit()
                
                # Cari di database
                cursor.execute('SELECT username, bot_name, first_name, photo_url FROM bot_info WHERE username = ?', (clean_username,))
                row = cursor.fetchone()
                if row:
                    bot_info = {
                        'username': row[0],
                        'bot_name': row[1],
                        'first_name': row[2],
                        'photo_url': row[3]
                    }
        except Exception as e:
            print(f"Error reading bot cache: {e}")
        
        if bot_info:
            return jsonify({
                'success': True,
                'bot': bot_info,
                'cached': True
            })
        
        # Jika tidak ada di cache, kembalikan informasi dasar
        # (Untuk mendapatkan foto profil bot secara realtime, diperlukan akses ke Telegram API)
        # Kita kembalikan informasi dasar dengan placeholder
        
        # Parse nama bot dari username
        bot_name = clean_username.replace('_', ' ').title()
        
        return jsonify({
            'success': True,
            'bot': {
                'username': clean_username,
                'bot_name': bot_name,
                'first_name': bot_name,
                'photo_url': f'https://ui-avatars.com/api/?name={clean_username[0:2]}&background=40a7e3&color=fff&size=100&rounded=true&bold=true&length=2'
            },
            'cached': False
        })
        
    except Exception as e:
        print(f"Error getting bot info: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    
# ==================== USER CHECK STATE ROUTES ====================

@giveaway_bp.route('/user-state', methods=['POST'])
def save_user_check_state():
    """Save user check state when user opens giveaway page"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        giveaway_code = data.get('giveaway_code')
        giveaway_id = data.get('giveaway_id')
        user_id = data.get('user_id')
        username = data.get('username', '')
        first_name = data.get('first_name', '')
        total_chats = data.get('total_chats', 0)
        
        if not giveaway_code or not giveaway_id or not user_id:
            return jsonify({'success': False, 'error': 'Parameter tidak lengkap'}), 400
        
        success = db.save_user_check_state(
            giveaway_id=giveaway_id,
            giveaway_code=giveaway_code,
            user_id=user_id,
            username=username,
            first_name=first_name,
            total_chats=total_chats
        )
        
        return jsonify({
            'success': success,
            'message': 'User state saved' if success else 'Failed to save'
        })
        
    except Exception as e:
        print(f"Error in save_user_check_state: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@giveaway_bp.route('/user-state/<giveaway_code>/<int:user_id>', methods=['GET'])
def get_user_check_state(giveaway_code, user_id):
    """Get user check state for frontend polling"""
    try:
        state = db.get_user_check_state(giveaway_code, user_id)
        
        if not state:
            return jsonify({
                'success': True,
                'status': 'pending',
                'is_all_member': False,
                'joined_chats': [],
                'total_chats': 0
            })
        
        return jsonify({
            'success': True,
            'status': state['status'],
            'is_all_member': state['is_all_member'],
            'joined_chats': state['joined_chats'],
            'total_chats': state['total_chats'],
            'updated_at': state['updated_at']
        })
        
    except Exception as e:
        print(f"Error in get_user_check_state: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@giveaway_bp.route('/pending-checks', methods=['GET'])
def get_pending_checks():
    """Get pending user checks for bot to process"""
    try:
        limit = request.args.get('limit', 10, type=int)
        pending_checks = db.get_pending_user_checks(limit)
        
        # Untuk setiap pending check, ambil chat_info
        for check in pending_checks:
            chats = db.get_chat_info_by_giveaway_id(check['giveaway_id'])
            check['chats'] = chats
        
        return jsonify({
            'success': True,
            'checks': pending_checks,
            'total': len(pending_checks)
        })
        
    except Exception as e:
        print(f"Error in get_pending_checks: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@giveaway_bp.route('/update-check-result', methods=['POST'])
def update_check_result():
    """Update user check result from bot"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        check_id = data.get('check_id')
        is_all_member = data.get('is_all_member', False)
        joined_chats = data.get('joined_chats', [])
        status = data.get('status')  # optional: 'done' or 'reject'
        
        if not check_id:
            return jsonify({'success': False, 'error': 'check_id required'}), 400
        
        success = db.update_user_check_result(check_id, is_all_member, joined_chats, status)
        
        return jsonify({
            'success': success,
            'message': 'Check result updated' if success else 'Failed to update'
        })
        
    except Exception as e:
        print(f"Error in update_check_result: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@giveaway_bp.route('/force-subs', methods=['GET'])
def get_force_subs():
    force_subs = db.get_all_force_subs()
    return jsonify({'success': True, 'force_subs': force_subs})

@giveaway_bp.route('/invite-links', methods=['GET'])
def get_invite_links():
    """Get all invite links for private chats"""
    try:
        with sqlite3.connect(db.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS chat_invite_links (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id TEXT UNIQUE NOT NULL,
                    invite_link TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.commit()
            
            cursor.execute('SELECT chat_id, invite_link FROM chat_invite_links')
            rows = cursor.fetchall()
            
            invite_links = [{'chat_id': row[0], 'invite_link': row[1]} for row in rows]
            
            return jsonify({
                'success': True,
                'invite_links': invite_links
            })
    except Exception as e:
        print(f"Error getting invite links: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500