# giveaway/services/battle_service.py
# Flask Blueprint untuk Battle Game

import sqlite3
import json
import os
import random
import string
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from flask import Blueprint, request, jsonify
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from giveaway.database.battle import BattleDatabase

battle_bp = Blueprint('battle', __name__)
db = BattleDatabase()

# ==================== HELPERS ====================

def generate_battle_id() -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

def generate_battle_code() -> str:
    return ''.join(random.choices(string.digits, k=15))

try:
    import pytz
    JAKARTA_TZ = pytz.timezone('Asia/Jakarta')
except ImportError:
    from datetime import timezone
    JAKARTA_TZ = timezone(timedelta(hours=7))

def get_jakarta_time() -> datetime:
    return datetime.now(JAKARTA_TZ)

def format_jakarta_time(dt: datetime) -> str:
    return dt.strftime('%d %B %Y %H:%M:%S WIB')

_bot_client = None

def set_battle_bot_client(client):
    global _bot_client
    _bot_client = client
    print(f"[BattleService] Bot client set: {_bot_client is not None}")

def get_bot_client():
    return _bot_client


# ==================== ROUTES ====================

# -------- CREATE BATTLE --------
@battle_bp.route('/create', methods=['POST', 'OPTIONS'])
def create_battle():
    if request.method == 'OPTIONS':
        r = jsonify({'success': True})
        r.headers.add('Access-Control-Allow-Origin', '*')
        r.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        r.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return r

    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400

        user_id     = data.get('user_id')
        username    = data.get('username', '')
        first_name  = data.get('first_name', '')
        last_name   = data.get('last_name', '')
        prizes      = data.get('prizes', [])        # list string
        group       = data.get('group', {})          # {chat_id, title, username}
        deadline    = int(data.get('deadline_minutes', 5))
        captcha     = data.get('captcha', False)

        if not user_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        if not prizes:
            return jsonify({'success': False, 'error': 'Minimal satu hadiah diperlukan'}), 400
        if not group or not group.get('chat_id'):
            return jsonify({'success': False, 'error': 'Group / Comset diperlukan'}), 400

        battle_id   = generate_battle_id()
        battle_code = generate_battle_code()
        formatted_prize = '\n'.join([f"{i+1}. {p}" for i, p in enumerate(prizes)])
        winners_count   = len(prizes)
        captcha_status  = 'On' if captcha else 'Off'

        end_time = get_jakarta_time() + timedelta(minutes=deadline)

        ok = db.create_battle(
            battle_id      = battle_id,
            battle_code    = battle_code,
            creator_id     = user_id,
            group_id       = int(group['chat_id']),
            group_title    = group.get('title', ''),
            group_username = group.get('username', ''),
            prize          = formatted_prize,
            winners_count  = winners_count,
            deadline_minutes = deadline,
            end_time       = end_time.isoformat(),
            captcha        = captcha_status
        )

        if not ok:
            return jsonify({'success': False, 'error': 'Gagal menyimpan battle'}), 500

        # Kirim pesan via bot jika tersedia
        bot_client = get_bot_client()
        creator_name = f"{first_name} {last_name}".strip() or username or str(user_id)

        prize_display = '\n'.join([f"  {i+1}. {p}" for i, p in enumerate(prizes)])

        message_text = f"""
⚔️ **BATTLE GAME DIMULAI!** ⚔️

━━━━━━━━━━━━━━━━━━━━━
🎁 **HADIAH:**
{prize_display}
━━━━━━━━━━━━━━━━━━━━━
📜 **CARA MENANG:**
Kirim pesan terakhir di grup ini!
Setelah {deadline} menit tidak ada pesan masuk, pengirim pesan terakhir menang!

🏆 Pemenang dipilih berurutan dari pesan terakhir
━━━━━━━━━━━━━━━━━━━━━
👤 **CREATOR:** [{creator_name}](tg://user?id={user_id})
⏰ **DEADLINE:** {deadline} menit tanpa pesan = MENANG
⌛ **BERAKHIR MAX:** {format_jakarta_time(end_time)}
━━━━━━━━━━━━━━━━━━━━━
#{battle_id}"""

        msg_id = None
        if bot_client:
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                from telethon import Button
                btn = [[Button.url(
                    text="⚔️ Lihat Battle",
                    url=f"https://t.me/freebiestbot/giveaway?startapp=battle_{battle_code}"
                )]]
                msg = loop.run_until_complete(
                    bot_client.send_message(int(group['chat_id']), message_text, buttons=btn)
                )
                loop.close()
                msg_id = msg.id
            except Exception as e:
                print(f"[BattleService] Error sending message: {e}")

        if msg_id:
            with sqlite3.connect(db.db_path) as conn:
                conn.execute(
                    'UPDATE battles SET message_id=? WHERE battle_id=?',
                    (msg_id, battle_id)
                )
                conn.commit()

        return jsonify({
            'success': True,
            'message': 'Battle berhasil dibuat!',
            'battle_id': battle_id,
            'battle_code': battle_code,
            'end_time': end_time.isoformat()
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# -------- GET BATTLE INFO --------
@battle_bp.route('/info/<battle_code>', methods=['GET'])
def get_battle_info(battle_code):
    try:
        battle = db.get_battle(battle_code)
        if not battle:
            return jsonify({'success': False, 'error': 'Battle tidak ditemukan'}), 404

        now = get_jakarta_time().isoformat()
        is_expired = battle['end_time'] <= now or battle['is_ended']

        prize_lines = [p.strip() for p in battle['prize'].split('\n') if p.strip()]
        messages    = db.get_battle_messages(battle['battle_id'])
        participants = db.get_participants(battle['battle_id'])

        # Urutkan pesan dari terbaru ke terlama
        messages_sorted = sorted(messages, key=lambda x: x['sent_at'], reverse=True)

        # Pasangkan hadiah ke slot leaderboard
        leaderboard = []
        for i, msg in enumerate(messages_sorted[:battle['winners_count']]):
            prize_for_slot = prize_lines[i] if i < len(prize_lines) else None
            leaderboard.append({
                'rank': i + 1,
                'user_id': msg['user_id'],
                'username': msg['username'],
                'first_name': msg['first_name'],
                'last_name': msg['last_name'],
                'photo_url': msg['photo_url'],
                'message_id': msg['message_id'],
                'message_text': msg['message_text'],
                'sent_at': msg['sent_at'],
                'prize': prize_for_slot,
                'is_winner': msg['is_winner']
            })

        return jsonify({
            'success': True,
            'battle': {
                'code': battle['battle_code'],
                'id': battle['battle_id'],
                'prize': prize_lines,
                'winners_count': battle['winners_count'],
                'group_id': battle['group_id'],
                'group_title': battle['group_title'],
                'group_username': battle['group_username'],
                'deadline_minutes': battle['deadline_minutes'],
                'end_time': battle['end_time'],
                'status': 'ended' if is_expired else 'active',
                'is_ended': bool(battle['is_ended']),
                'participants_count': len(participants),
                'message_id': battle['message_id'],
                'captcha': battle['captcha']
            },
            'leaderboard': leaderboard,
            'participants_count': len(participants)
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# -------- GET PARTICIPANTS --------
@battle_bp.route('/participants/<battle_code>', methods=['GET'])
def get_participants(battle_code):
    try:
        battle = db.get_battle(battle_code)
        if not battle:
            return jsonify({'success': False, 'error': 'Battle tidak ditemukan'}), 404

        participants = db.get_participants(battle['battle_id'])
        return jsonify({
            'success': True,
            'participants': participants,
            'total': len(participants)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# -------- RECORD MESSAGE (dipanggil oleh bot saat ada pesan masuk di grup) --------
@battle_bp.route('/record-message', methods=['POST'])
def record_message():
    """Bot memanggil endpoint ini setiap ada pesan baru di grup yang punya battle aktif"""
    try:
        data = request.get_json()
        battle_id   = data.get('battle_id')
        user_id     = data.get('user_id')
        username    = data.get('username', '')
        first_name  = data.get('first_name', '')
        last_name   = data.get('last_name', '')
        photo_url   = data.get('photo_url', '')
        message_id  = data.get('message_id')
        message_text = data.get('message_text', '')
        sent_at     = data.get('sent_at', datetime.now().isoformat())

        if not all([battle_id, user_id, message_id]):
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400

        # Simpan snapshot pesan terbaru user
        db.upsert_message(
            battle_id, user_id, username, first_name, last_name,
            photo_url, message_id, message_text, sent_at
        )

        # Update participants
        db.upsert_participant(
            battle_id, user_id, username, first_name, last_name,
            photo_url, message_id, sent_at
        )

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# -------- END BATTLE (dipanggil bot saat deadline habis) --------
@battle_bp.route('/end/<battle_id>', methods=['POST'])
def end_battle(battle_id):
    try:
        battle = db.get_battle_by_id(battle_id)
        if not battle:
            return jsonify({'success': False, 'error': 'Battle tidak ditemukan'}), 404

        if battle['is_ended']:
            return jsonify({'success': False, 'error': 'Battle sudah berakhir'}), 400

        prize_lines = [p.strip() for p in battle['prize'].split('\n') if p.strip()]
        messages    = db.get_battle_messages(battle_id)
        messages_sorted = sorted(messages, key=lambda x: x['sent_at'], reverse=True)

        winners = []
        for i, msg in enumerate(messages_sorted[:battle['winners_count']]):
            prize_for_slot = prize_lines[i] if i < len(prize_lines) else '-'
            db.set_message_rank(battle_id, msg['user_id'], i + 1, prize_for_slot, 1 if i == 0 else 0)
            winners.append({
                'rank': i + 1,
                'user_id': msg['user_id'],
                'username': msg['username'],
                'first_name': msg['first_name'],
                'prize': prize_for_slot,
                'message_id': msg['message_id']
            })

        winner_ids = [w['user_id'] for w in winners]
        winner_prizes = [w['prize'] for w in winners]
        db.mark_winners(battle_id, winner_ids, winner_prizes)
        db.end_battle(battle_id)

        return jsonify({
            'success': True,
            'winners': winners,
            'total_participants': len(db.get_participants(battle_id))
        })
    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# -------- GET ACTIVE BATTLES BY GROUP --------
@battle_bp.route('/active-by-group/<int:group_id>', methods=['GET'])
def active_by_group(group_id):
    """Dipakai bot untuk cek battle aktif di grup tertentu"""
    try:
        battles = db.get_active_battles()
        filtered = [b for b in battles if b['group_id'] == group_id]
        return jsonify({'success': True, 'battles': filtered})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# -------- RECENT BATTLES --------
@battle_bp.route('/recent', methods=['GET'])
def recent_battles():
    try:
        limit = request.args.get('limit', 10, type=int)
        battles = db.get_recent_battles(limit)
        result = []
        for b in battles:
            prize_lines = [p.strip() for p in b['prize'].split('\n') if p.strip()]
            result.append({
                'battle_code': b['battle_code'],
                'battle_id': b['battle_id'],
                'group_title': b['group_title'],
                'prize_lines': prize_lines[:3],
                'deadline_minutes': b['deadline_minutes'],
                'status': b['status'],
                'created_at': b['created_at'],
                'participants_count': len(db.get_participants(b['battle_id']))
            })
        return jsonify({'success': True, 'battles': result})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# -------- USER STATS --------
@battle_bp.route('/user-stats/<int:user_id>', methods=['GET'])
def user_stats(user_id):
    try:
        stats = db.get_user_battle_stats(user_id)
        return jsonify({'success': True, 'stats': stats})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500