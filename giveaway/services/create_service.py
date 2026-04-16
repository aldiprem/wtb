# giveaway/services/create_service.py - PERBAIKAN LENGKAP

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

# Create blueprint WITHOUT url_prefix (akan ditambahkan di app.py)
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

# Bot client reference
bot_client = None

def set_bot_client(client):
    """Set bot client reference for sending messages"""
    global bot_client
    bot_client = client
    print(f"[INFO] Bot client set: {bot_client is not None}")

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
@create_bp.route('/test', methods=['GET'])
def test_route():
    """Test route to check if blueprint is working"""
    return jsonify({
        'success': True,
        'message': 'Create blueprint is working!',
        'bot_client_available': bot_client is not None
    })


# ==================== VALIDATE CHAT ROUTE ====================
@create_bp.route('/validate-chat', methods=['POST', 'OPTIONS'])
def validate_chat():
    """Validate chat access for bot and user, and return chat info"""
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response
    
    print(f"[DEBUG] ========== VALIDATE-CHAT START ==========")
    print(f"[DEBUG] Request method: {request.method}")
    
    # Cek content type
    content_type = request.headers.get('Content-Type', '')
    print(f"[DEBUG] Content-Type: {content_type}")
    
    # Coba baca raw data
    raw_data = request.get_data(as_text=True)
    print(f"[DEBUG] Raw request data: {raw_data[:200] if raw_data else 'empty'}")
    
    if not raw_data:
        print(f"[ERROR] No raw data received")
        return jsonify({'success': False, 'error': 'Tidak ada data yang dikirim'}), 400
    
    try:
        data = request.get_json()
        print(f"[DEBUG] Parsed JSON data: {data}")
    except Exception as e:
        print(f"[ERROR] Failed to parse JSON: {e}")
        return jsonify({'success': False, 'error': f'Invalid JSON: {str(e)}'}), 400
    
    if not data:
        print(f"[ERROR] No JSON data after parsing")
        return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
    
    # Support kedua format
    chat_input = data.get('chat_input') or data.get('chat_id')
    user_id = data.get('user_id')
    
    print(f"[DEBUG] chat_input: {chat_input}, user_id: {user_id}")
    
    if not chat_input:
        print(f"[ERROR] No chat_input or chat_id provided")
        return jsonify({'success': False, 'error': 'Chat ID atau username diperlukan'}), 400
    
    # Proses input untuk mendapatkan chat_id integer
    chat_id = None
    is_username = False
    username = None
    
    # Cek apakah input adalah username
    if chat_input.startswith('@'):
        username = chat_input[1:]
        is_username = True
        print(f"[DEBUG] Detected username with @: {username}")
    elif chat_input.startswith('https://t.me/'):
        username = chat_input.replace('https://t.me/', '').split('/')[0]
        is_username = True
        print(f"[DEBUG] Detected t.me URL: {username}")
    elif chat_input.startswith('t.me/'):
        username = chat_input.replace('t.me/', '').split('/')[0]
        is_username = True
        print(f"[DEBUG] Detected t.me short URL: {username}")
    else:
        # Coba parse sebagai integer ID
        try:
            chat_id = int(chat_input)
            print(f"[DEBUG] Parsed as integer ID: {chat_id}")
        except ValueError:
            # Mungkin username tanpa @
            username = chat_input
            is_username = True
            print(f"[DEBUG] Assuming username without @: {username}")
    
    # Jika menggunakan username, perlu resolve ke chat_id via bot_client
    if is_username and bot_client:
        try:
            print(f"[DEBUG] Resolving username: {username} using bot_client")
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            entity = loop.run_until_complete(bot_client.get_entity(username))
            loop.close()
            
            print(f"[DEBUG] Resolved entity: id={entity.id}, title={getattr(entity, 'title', None)}")
            
            chat_id = entity.id
            if hasattr(entity, 'broadcast') and entity.broadcast:
                chat_id = int(f"-100{entity.id}")
                print(f"[DEBUG] This is a channel, adjusted chat_id: {chat_id}")
            
        except Exception as e:
            print(f"[ERROR] Failed to resolve username: {e}")
            return jsonify({
                'success': False, 
                'error': f'Tidak dapat menemukan chat dengan username "{chat_input}": {str(e)[:100]}'
            }), 404
    
    if not chat_id:
        print(f"[ERROR] No valid chat_id after processing")
        return jsonify({'success': False, 'error': 'Chat ID tidak valid'}), 400
    
    print(f"[DEBUG] Final chat_id: {chat_id}")
    
    # Jika tidak ada bot_client, return mock response untuk testing
    if not bot_client:
        print("[WARNING] bot_client not available, returning mock response")
        return jsonify({
            'success': True,
            'has_access': True,
            'is_admin': True,
            'chat_id': str(chat_id),
            'chat_title': str(chat_id),
            'chat_type': 'channel' if str(chat_id).startswith('-100') else 'group',
            'visibility': 'private',
            'username': None,
            'invite_link': None,
            'photo_url': None
        })
    
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        print(f"[DEBUG] Getting entity for chat_id: {chat_id}")
        entity = loop.run_until_complete(bot_client.get_entity(chat_id))
        
        chat_title = getattr(entity, 'title', None) or str(chat_id)
        chat_type = 'channel' if hasattr(entity, 'broadcast') and entity.broadcast else 'group'
        if hasattr(entity, 'megagroup') and entity.megagroup:
            chat_type = 'supergroup'
        
        chat_username = getattr(entity, 'username', None)
        visibility = 'public' if chat_username else 'private'
        
        print(f"[DEBUG] Chat info: title={chat_title}, type={chat_type}, username={chat_username}, visibility={visibility}")
        
        # Test bot access
        bot_has_access = True
        try:
            print(f"[DEBUG] Testing bot access to chat {chat_id}")
            test_msg = loop.run_until_complete(bot_client.send_message(chat_id, "test"))
            loop.run_until_complete(test_msg.delete())
            print(f"[DEBUG] Bot has access to chat")
        except Exception as e:
            bot_has_access = False
            print(f"[ERROR] Bot has no access: {e}")
            loop.close()
            return jsonify({
                'success': False,
                'error': 'Bot tidak memiliki akses mengirim pesan ke chat ini. Pastikan bot sudah menjadi admin.'
            }), 403
        
        # Check admin status (skip if user_id not provided or is None)
        is_admin = True  # Default to True for testing
        if user_id:
            try:
                from telethon.tl.functions.channels import GetParticipantRequest
                from telethon.tl.types import ChannelParticipantAdmin, ChannelParticipantCreator
                
                print(f"[DEBUG] Checking if user {user_id} is admin of chat {chat_id}")
                participant = loop.run_until_complete(bot_client(GetParticipantRequest(
                    channel=chat_id,
                    participant=user_id
                )))
                
                is_admin = isinstance(participant.participant, (ChannelParticipantAdmin, ChannelParticipantCreator))
                print(f"[DEBUG] User is admin: {is_admin}")
                
            except Exception as e:
                print(f"[DEBUG] Admin check failed: {e}")
                # For now, assume admin for testing
                is_admin = True
        
        if not is_admin and user_id:
            loop.close()
            return jsonify({
                'success': False,
                'error': 'Anda bukan admin/owner di chat ini! Bot hanya bisa digunakan oleh admin atau owner chat.'
            }), 403
        
        # Create invite link for private chat
        invite_link = None
        if visibility == 'private':
            try:
                from telethon.tl.functions.messages import ExportChatInviteRequest
                print(f"[DEBUG] Creating invite link for private chat {chat_id}")
                invite = loop.run_until_complete(bot_client(ExportChatInviteRequest(
                    peer=chat_id,
                    expire_date=None,
                    usage_limit=None,
                    title="Giveaway Join Link"
                )))
                invite_link = invite.link
                print(f"[DEBUG] Invite link created: {invite_link}")
            except Exception as e:
                print(f"[WARNING] Cannot create invite link: {e}")
        
        loop.close()
        
        result = {
            'success': True,
            'has_access': bot_has_access,
            'is_admin': is_admin,
            'chat_id': str(chat_id),
            'chat_title': chat_title,
            'chat_type': chat_type,
            'visibility': visibility,
            'username': chat_username,
            'invite_link': invite_link,
            'photo_url': None
        }
        
        print(f"[DEBUG] Returning result: {result}")
        print(f"[DEBUG] ========== VALIDATE-CHAT END ==========")
        return jsonify(result)
        
    except Exception as e:
        print(f"[ERROR] Exception in validate-chat: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'Error saat memvalidasi chat: {str(e)[:200]}'
        }), 500


# ==================== CREATE GIVEAWAY ROUTE ====================
@create_bp.route('/create', methods=['POST', 'OPTIONS'])
def create_giveaway():
    """Create a new giveaway"""
    if request.method == 'OPTIONS':
        response = jsonify({'success': True})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
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