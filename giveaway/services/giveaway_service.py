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

# Add root to path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from giveaway.database.giveaway import GiveawayDatabase

# Create blueprint
giveaway_bp = Blueprint('giveaway', __name__, url_prefix='/api/giveaway')

# Initialize database
db = GiveawayDatabase()


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
        
        # Save user to database
        db.save_user(
            user_id=user_id,
            username=username or "",
            first_name=first_name or "",
            last_name=last_name or ""
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
        
        # Get detailed user info
        participants_detail = []
        for user_id in participants:
            user = db.get_user(user_id)
            if user:
                participants_detail.append({
                    'user_id': user['user_id'],
                    'username': user['username'],
                    'first_name': user['first_name'],
                    'last_name': user['last_name']
                })
            else:
                participants_detail.append({
                    'user_id': user_id,
                    'username': None,
                    'first_name': None,
                    'last_name': None
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
    
@giveaway_bp.route('/check-membership/<giveaway_code>/<int:user_id>', methods=['GET'])
def check_membership(giveaway_code, user_id):
    """Check if user is member of all required chats for a giveaway (realtime via bot)"""
    try:
        giveaway = db.get_on_giveaway(giveaway_code)
        if not giveaway:
            return jsonify({'success': False, 'error': 'Giveaway tidak ditemukan'}), 404
        
        giveaway_id = giveaway.get('giveaway_id', '')
        if not giveaway_id:
            return jsonify({'success': False, 'error': 'Giveaway ID tidak ditemukan'}), 404
        
        # Ambil chat info dari database
        chats = db.get_chat_info_by_giveaway_id(giveaway_id)
        
        if not chats:
            return jsonify({
                'success': True,
                'member_status': True,
                'joined_chats': [],
                'total_chats': 0,
                'message': 'Tidak ada chat yang perlu diikuti'
            })
        
        # Kirim request ke bot untuk cek keanggotaan via Telegram API
        bot_token = os.getenv("BOT_GIVEAWAY")
        
        # Simpan request ke database terlebih dahulu
        check_id = db.add_pending_membership_check(giveaway_id, user_id, [c['chat_id'] for c in chats])
        
        # Kirim pesan ke bot untuk memproses (via webhook atau API)
        # Kita akan menggunakan pendekatan: bot akan membaca pending_checks setiap beberapa detik
        # Atau kita bisa langsung memanggil bot via sendMessage ke chat admin
        
        # Untuk sementara, kembalikan status dari database yang sudah ada
        # Jika belum ada data, kembalikan False
        is_member = db.check_user_all_memberships(giveaway_id, user_id)
        
        return jsonify({
            'success': True,
            'member_status': is_member,
            'joined_chats': [],
            'total_chats': len(chats),
            'message': 'Member' if is_member else 'Not member'
        })
        
    except Exception as e:
        print(f"Error checking membership: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@giveaway_bp.route('/verify-membership/<giveaway_code>/<int:user_id>', methods=['GET'])
def verify_membership(giveaway_code, user_id):
    """Verify user membership in all required chats before participation (realtime via bot)"""
    try:
        giveaway = db.get_on_giveaway(giveaway_code)
        if not giveaway:
            return jsonify({'success': False, 'error': 'Giveaway tidak ditemukan'}), 404
        
        giveaway_id = giveaway.get('giveaway_id', '')
        if not giveaway_id:
            return jsonify({'success': False, 'error': 'Giveaway ID tidak ditemukan'}), 404
        
        chats = db.get_chat_info_by_giveaway_id(giveaway_id)
        
        if not chats:
            return jsonify({'success': True, 'verified': True, 'message': 'Tidak ada chat yang perlu diikuti'})
        
        # Verifikasi real-time dengan memanggil bot langsung
        # Kita akan menggunakan mekanisme: bot akan memproses pending check dengan priority tinggi
        
        # Tambahkan pending check dengan priority tinggi
        check_id = db.add_pending_membership_check(giveaway_id, user_id, [c['chat_id'] for c in chats], priority=2)
        
        # Trigger bot untuk segera memproses (opsional: kirim pesan ke bot)
        bot_token = os.getenv("BOT_GIVEAWAY")
        admin_chat_id = os.getenv("ADMIN_CHAT_ID")  # Set di .env
        
        if bot_token and admin_chat_id:
            import requests
            try:
                # Kirim pesan ke bot untuk memproses pending checks
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    'chat_id': admin_chat_id,
                    'text': '/process_checks'
                }
                requests.post(url, json=payload, timeout=2)
            except:
                pass
        
        # Tunggu sebentar untuk hasil (max 3 detik)
        import time
        for i in range(6):  # 6 x 0.5 = 3 detik
            result = db.get_pending_check_result(check_id)
            if result is not None:
                return jsonify({
                    'success': True,
                    'verified': result['is_member'],
                    'total_chats': len(chats),
                    'message': 'Bergabung' if result['is_member'] else 'Silakan bergabung ke semua chat terlebih dahulu'
                })
            time.sleep(0.5)
        
        # Jika timeout, cek dari database yang sudah ada
        is_member = db.check_user_all_memberships(giveaway_id, user_id)
        
        return jsonify({
            'success': True,
            'verified': is_member,
            'total_chats': len(chats),
            'message': 'Bergabung' if is_member else 'Silakan bergabung ke semua chat terlebih dahulu'
        })
        
    except Exception as e:
        print(f"Error verifying membership: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@giveaway_bp.route('/trigger-membership-check/<giveaway_code>/<int:user_id>', methods=['POST'])
def trigger_membership_check(giveaway_code, user_id):
    """Manually trigger membership check for a user"""
    try:
        giveaway = db.get_on_giveaway(giveaway_code)
        if not giveaway:
            return jsonify({'success': False, 'error': 'Giveaway tidak ditemukan'}), 404
        
        giveaway_id = giveaway.get('giveaway_id', '')
        if not giveaway_id:
            return jsonify({'success': False, 'error': 'Giveaway ID tidak ditemukan'}), 404
        
        chats = db.get_chat_info_by_giveaway_id(giveaway_id)
        
        if not chats:
            return jsonify({'success': True, 'message': 'Tidak ada chat yang perlu dicek'})
        
        # Tambahkan pending check dengan priority tinggi
        check_id = db.add_pending_membership_check(
            giveaway_id, user_id, [c['chat_id'] for c in chats], priority=3
        )
        
        return jsonify({
            'success': True,
            'check_id': check_id,
            'message': 'Pengecekan keanggotaan dimulai'
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500