# giveaway/services/giveaway_service.py
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
    """
    Validate and extract Telegram user data from WebApp initData
    Returns: (is_valid, user_id, username, first_name, last_name)
    """
    try:
        # For now, accept data from request body
        # In production, you should verify the hash with bot token
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
        
        # Get links and requirements
        giveaway_id = giveaway.get('giveaway_id', '')
        links = db.get_links_list(giveaway_id) if giveaway_id else []
        syarat = db.get_syarat(giveaway_id) if giveaway_id else 'None'
        captcha = db.get_captcha(giveaway_id) if giveaway_id else 'Off'
        
        # Parse prize into list
        prize_lines = [p.strip() for p in giveaway['prize'].split('\n') if p.strip()]
        
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