# giveaway/services/create_service.py - PERBAIKAN

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

# Add root to path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from giveaway.database.giveaway import GiveawayDatabase

# Create blueprint
create_bp = Blueprint('create', __name__)

# Initialize database
db = GiveawayDatabase()

# Configuration
JAKARTA_TZ = None
try:
    import pytz
    JAKARTA_TZ = pytz.timezone('Asia/Jakarta')
except ImportError:
    print("[WARNING] pytz not installed, using local time")
    from datetime import timezone
    JAKARTA_TZ = timezone(timedelta(hours=7))

OWNER_ID = int(os.getenv("OWNER_ID", 0))
CHANNEL_INFO = os.getenv("CHANNEL_INFO", "@giftfreebies")

_bot_client = None

def set_bot_client(client):
    """Set bot client reference for sending messages"""
    global _bot_client
    _bot_client = client
    print(f"[INFO] Bot client set in create_service: {_bot_client is not None}")

def get_bot_client():
    """Get bot client reference"""
    global _bot_client
    return _bot_client

def get_jakarta_time() -> datetime:
    if JAKARTA_TZ:
        return datetime.now(JAKARTA_TZ)
    return datetime.now()

def format_jakarta_time(dt: datetime) -> str:
    return dt.strftime('%d %B %Y %H:%M:%S WIB')

def generate_giveaway_id() -> str:
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

def generate_giveaway_code() -> str:
    return ''.join(random.choices(string.digits, k=15))


# ==================== TEST ROUTE ====================
@create_bp.route('/test', methods=['GET', 'OPTIONS'])
def test_route():
    """Test route to check if blueprint is working"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        return response
    
    bot_client = get_bot_client()
    return jsonify({
        'success': True,
        'message': 'Create blueprint is working!',
        'bot_client_available': bot_client is not None
    })

# giveaway/services/create_service.py - VERSI SIMPLIFIED UNTUK TESTING

@create_bp.route('/validate-chat', methods=['POST', 'OPTIONS'])
def validate_chat():
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    data = request.get_json()
    chat_input = data.get('chat_input') or data.get('chat_id')
    
    if not chat_input:
        return jsonify({'success': False, 'error': 'Chat ID atau username diperlukan'}), 400
    
    # 🔥 MOCK RESPONSE UNTUK TESTING
    # Asumsikan chat valid dan user adalah admin
    return jsonify({
        'success': True,
        'has_access': True,
        'is_admin': True,
        'chat_id': chat_input if chat_input.startswith('-100') else f'-100{chat_input}',
        'chat_title': f'Chat {chat_input}',
        'chat_type': 'channel' if chat_input.startswith('-100') else 'group',
        'visibility': 'private',
        'username': None,
        'invite_link': None,
        'photo_url': None
    })

@create_bp.route('/validation-status/<validation_id>', methods=['GET'])
def get_validation_status(validation_id):
    """Cek status validasi chat"""
    with sqlite3.connect(db.db_path) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT status, result FROM pending_validations WHERE id = ?', (validation_id,))
        row = cursor.fetchone()
        
        if not row:
            return jsonify({'success': False, 'error': 'Validation not found'}), 404
        
        status, result_json = row
        if status == 'done' and result_json:
            result = json.loads(result_json)
            return jsonify({'success': True, 'status': 'done', 'result': result})
        elif status == 'error':
            return jsonify({'success': False, 'status': 'error', 'error': result_json})
        else:
            return jsonify({'success': False, 'status': 'pending'})

# ==================== CREATE GIVEAWAY ROUTE ====================
@create_bp.route('/create', methods=['POST', 'OPTIONS'])
def create_giveaway():
    """Create a new giveaway"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        # Extract data
        user_id = data.get('user_id')
        username = data.get('username', '')
        first_name = data.get('first_name', '')
        last_name = data.get('last_name', '')
        prizes = data.get('prizes', [])
        chats = data.get('chats', [])
        end_time_str = data.get('end_time')
        links = data.get('links', [])
        requirements = data.get('requirements', [])
        captcha = data.get('captcha', False)
        
        # Validate required fields
        if not user_id:
            return jsonify({'success': False, 'error': 'User ID diperlukan'}), 400
        
        if not prizes:
            return jsonify({'success': False, 'error': 'Minimal satu hadiah diperlukan'}), 400
        
        if not chats:
            return jsonify({'success': False, 'error': 'Minimal satu chat target diperlukan'}), 400
        
        if not end_time_str:
            return jsonify({'success': False, 'error': 'Durasi diperlukan'}), 400
        
        # Parse end time
        try:
            end_time = datetime.fromisoformat(end_time_str.replace('Z', '+00:00'))
        except Exception as e:
            return jsonify({'success': False, 'error': f'Format waktu tidak valid: {e}'}), 400
        
        # Format prize
        formatted_prize = '\n'.join([f"{i+1}. {p}" for i, p in enumerate(prizes)])
        winners_count = len(prizes)
        
        # Format syarat
        syarat = 'None'
        if requirements:
            syarat = ', '.join([r.capitalize() for r in requirements])
        
        # Format link
        link_text = '\n'.join(links) if links else ''
        
        # Captcha status
        captcha_status = 'On' if captcha else 'Off'
        
        # Generate IDs
        giveaway_id = generate_giveaway_id()
        
        # Save user to database
        db.save_user(
            user_id=user_id,
            username=username,
            first_name=first_name,
            last_name=last_name
        )
        
        # Save to giveaways table
        try:
            with sqlite3.connect(db.db_path) as conn:
                cursor = conn.cursor()
                
                # Ensure columns exist
                cursor.execute("PRAGMA table_info(giveaways)")
                columns = [col[1] for col in cursor.fetchall()]
                
                if 'syarat' not in columns:
                    cursor.execute("ALTER TABLE giveaways ADD COLUMN syarat TEXT DEFAULT 'None'")
                if 'link' not in columns:
                    cursor.execute("ALTER TABLE giveaways ADD COLUMN link TEXT DEFAULT ''")
                if 'captcha' not in columns:
                    cursor.execute("ALTER TABLE giveaways ADD COLUMN captcha TEXT DEFAULT 'Off'")
                
                # Insert into giveaways
                first_chat = chats[0]
                first_chat_id = int(first_chat.get('chat_id'))
                
                cursor.execute('''
                    INSERT INTO giveaways 
                    (giveaway_id, user_id, chat_id, message_id, prize, winners_count, end_time, status, syarat, link, captcha)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    giveaway_id,
                    user_id,
                    first_chat_id,
                    0,
                    formatted_prize,
                    winners_count,
                    end_time.isoformat(),
                    'active',
                    syarat,
                    link_text,
                    captcha_status
                ))
                conn.commit()
                
        except Exception as e:
            print(f"Error saving to giveaways table: {e}")
            return jsonify({'success': False, 'error': f'Gagal menyimpan data: {e}'}), 500
        
        # Save chat info for each chat
        for chat in chats:
            try:
                db.save_chat_info(
                    giveaway_id=giveaway_id,
                    chat_id=chat.get('chat_id'),
                    chat_title=chat.get('title', ''),
                    chat_username=chat.get('username', ''),
                    chat_photo_url='',
                    chat_type=chat.get('type', 'channel')
                )
            except Exception as e:
                print(f"Warning: Failed to save chat info: {e}")
        
        # Get force subs
        force_subs = db.get_all_force_subs()
        
        # Get bot client
        bot_client = get_bot_client()
        
        # Send messages to each chat
        sent_messages = []
        creator_name = f"{first_name} {last_name}".strip() or username or str(user_id)
        creator_mention = f"[{creator_name}](tg://user?id={user_id})"
        
        for chat in chats:
            chat_id = int(chat.get('chat_id'))
            chat_title = chat.get('title', 'Unknown')
            chat_username = chat.get('username', '')
            visibility = chat.get('visibility', 'private')
            invite_link = chat.get('invite_link', None)
            
            # Format chat display
            if visibility == 'private' and invite_link:
                chat_display = f"📺 **CHAT ID:** [{chat_title}]({invite_link}) (`{chat_id}`)"
            elif chat_username:
                chat_display = f"📺 **CHAT ID:** [{chat_title}](https://t.me/{chat_username}) (`{chat_id}`)"
            else:
                chat_display = f"📺 **CHAT ID:** {chat_title} (`{chat_id}`)"
            
            # Format link text
            link_text_display = ""
            if links:
                link_text_display = "🔗 **ADS LINK:**\n" + "\n".join([f"   {i+1}. {l}" for i, l in enumerate(links)])
            
            message_text = f"""
🎉 **GIVEAWAY STARTED** 🎉

━━━━━━━━━━━━━━━━━━━━━
🎁 **HADIAH:**
^{formatted_prize}^
━━━━━━━━━━━━━━━━━━━━━
{link_text_display if link_text_display else ''}

{chat_display}

👤 **CREATOR:** {creator_mention}
━━━━━━━━━━━━━━━━━━━━━
^^__Silakan klik tombol dibawah ini untuk berpartisipasi giveaway, Selamat bergabung dan semoga beruntung.__^^

⏰ **BERAKHIR:** {format_jakarta_time(end_time)}
━━━━━━━━━━━━━━━━━━━━━
#{giveaway_id}"""
            
            try:
                if bot_client:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    msg = loop.run_until_complete(bot_client.send_message(chat_id, message_text))
                    loop.close()
                else:
                    # Mock response for testing
                    msg = type('obj', (object,), {'id': 123456})()
                    print(f"[MOCK] Would send to {chat_id}: {message_text[:100]}...")
                
                sent_messages.append({
                    'chat_id': chat_id,
                    'message_id': msg.id,
                    'chat_title': chat_title,
                    'message': msg
                })
                
                # Save force subs to chat_info
                for fs in force_subs:
                    try:
                        db.save_chat_info(
                            giveaway_id=giveaway_id,
                            chat_id=fs['chat_id'],
                            chat_title=fs.get('title') or f"Force Sub {fs['chat_id']}",
                            chat_username=fs.get('username') or '',
                            chat_photo_url='',
                            chat_type=fs.get('chat_type', 'channel')
                        )
                    except Exception as e:
                        print(f"Warning: Failed to save force sub: {e}")
                        
            except Exception as e:
                print(f"Error sending to chat {chat_id}: {e}")
        
        if not sent_messages:
            return jsonify({'success': False, 'error': 'Gagal mengirim pesan ke semua chat'}), 500
        
        # Create on_giveaway records
        giveaway_codes = []
        for msg_info in sent_messages:
            giveaway_code = generate_giveaway_code()
            
            try:
                with sqlite3.connect(db.db_path) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        INSERT INTO on_giveaway 
                        (giveaway_code, giveaway_id, user_id, chat_id, message_id, prize, 
                        winners_count, start_time, end_time, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        giveaway_code,
                        giveaway_id,
                        user_id,
                        msg_info['chat_id'],
                        msg_info['message_id'],
                        formatted_prize,
                        winners_count,
                        get_jakarta_time().isoformat(),
                        end_time.isoformat(),
                        'active'
                    ))
                    conn.commit()
                    giveaway_codes.append(giveaway_code)
            except Exception as e:
                print(f"Error creating on_giveaway: {e}")
        
        # Update message with button
        first_giveaway_code = giveaway_codes[0] if giveaway_codes else None
        
        if first_giveaway_code and bot_client:
            for msg_info in sent_messages:
                try:
                    from telethon import Button
                    correct_buttons = [[
                        Button.url(
                            text="🎁 Ikuti Giveaway",
                            url=f"https://t.me/freebiestbot/giveaway?startapp={first_giveaway_code}"
                        )
                    ]]
                    
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    loop.run_until_complete(bot_client.edit_message(
                        msg_info['chat_id'],
                        msg_info['message_id'],
                        text=message_text,
                        buttons=correct_buttons
                    ))
                    loop.close()
                except Exception as e:
                    print(f"Error editing message: {e}")
        
        return jsonify({
            'success': True,
            'message': 'Giveaway berhasil dibuat!',
            'giveaway_id': giveaway_id,
            'giveaway_code': first_giveaway_code,
            'total_chats': len(sent_messages)
        })
        
    except Exception as e:
        print(f"Error creating giveaway: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500
    
@create_bp.route('/register-bot', methods=['POST'])
def register_bot():
    """Endpoint untuk bot mendaftarkan dirinya"""
    from flask import request
    data = request.get_json()
    bot_token = data.get('bot_token')
    
    # Simpan ke database bahwa bot sudah siap
    # Atau cukup return success
    print(f"[INFO] Bot registered with token: {bot_token}")
    
    # Set global variable (masih tetap di proses yang sama)
    global _bot_client_registered
    _bot_client_registered = True
    
    return jsonify({'success': True, 'message': 'Bot registered'})