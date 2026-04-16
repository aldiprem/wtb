# giveaway/services/create_service.py - Create Giveaway Service (Fixed)

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
create_bp = Blueprint('create', __name__, url_prefix='/api/giveaway')

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

# Bot client reference (will be set from main app)
bot_client = None

def set_bot_client(client):
    """Set bot client reference for sending messages"""
    global bot_client
    bot_client = client

def get_jakarta_time() -> datetime:
    """Get current time in Asia/Jakarta timezone"""
    if JAKARTA_TZ:
        return datetime.now(JAKARTA_TZ)
    return datetime.now()

def format_jakarta_time(dt: datetime) -> str:
    """Format datetime to readable string with WIB"""
    return dt.strftime('%d %B %Y %H:%M:%S WIB')

def generate_giveaway_id() -> str:
    """Generate unique giveaway ID"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

def generate_giveaway_code() -> str:
    """Generate 15 digit numeric code for giveaway"""
    return ''.join(random.choices(string.digits, k=15))

def validate_chat_access(chat_id: int, user_id: int) -> dict:
    """
    Validate if bot has access and user is admin
    This is a mock function - actual validation uses telethon client
    """
    try:
        # This would use the bot client to check
        # For now, return success for demo
        return {
            'success': True,
            'has_access': True,
            'is_admin': True,
            'chat_title': str(chat_id),
            'chat_type': 'channel' if str(chat_id).startswith('-100') else 'group',
            'visibility': 'private',
            'username': None,
            'invite_link': None
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


# ==================== HELPER FUNCTIONS FOR ASYNC OPERATIONS ====================

def run_async(coro):
    """Run async function in sync context"""
    try:
        # Try to get running loop
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running loop, create new one
        return asyncio.run(coro)
    else:
        # Already in async context, create task
        return asyncio.create_task(coro)


async def send_message_async(chat_id: int, message_text: str):
    """Send message using bot client asynchronously"""
    if bot_client:
        return await bot_client.send_message(chat_id, message_text)
    return None


async def edit_message_async(chat_id: int, message_id: int, text: str, buttons):
    """Edit message using bot client asynchronously"""
    if bot_client:
        from telethon import Button
        return await bot_client.edit_message(chat_id, message_id, text=text, buttons=buttons)
    return None


async def send_to_channel_async(channel: str, message: str):
    """Send message to channel using bot client asynchronously"""
    if bot_client:
        return await bot_client.send_message(channel, message)
    return None


def send_sync_message(chat_id: int, message_text: str):
    """Send message synchronously"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(send_message_async(chat_id, message_text))
        loop.close()
        return result
    except Exception as e:
        print(f"Error sending message: {e}")
        return None


def edit_sync_message(chat_id: int, message_id: int, text: str, buttons):
    """Edit message synchronously"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(edit_message_async(chat_id, message_id, text, buttons))
        loop.close()
        return result
    except Exception as e:
        print(f"Error editing message: {e}")
        return None


def send_sync_to_channel(channel: str, message: str):
    """Send to channel synchronously"""
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(send_to_channel_async(channel, message))
        loop.close()
        return result
    except Exception as e:
        print(f"Error sending to channel: {e}")
        return None


# ==================== API ROUTES ====================

@create_bp.route('/validate-chat', methods=['POST'])
def validate_chat():
    """Validate chat access for bot and user"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        chat_id = data.get('chat_id')
        user_id = data.get('user_id')
        
        if not chat_id:
            return jsonify({'success': False, 'error': 'Chat ID diperlukan'}), 400
        
        # Convert to int if needed
        try:
            chat_id_int = int(chat_id)
        except ValueError:
            chat_id_int = chat_id
        
        # Validate using bot client (if available)
        if bot_client:
            try:
                # This would be the actual validation using telethon
                # For now, return mock response
                result = {
                    'success': True,
                    'has_access': True,
                    'is_admin': True,
                    'chat_title': str(chat_id),
                    'chat_type': 'channel' if str(chat_id).startswith('-100') else 'group',
                    'visibility': 'private',
                    'username': None,
                    'invite_link': None
                }
                
                if result['success']:
                    return jsonify(result)
                else:
                    return jsonify({'success': False, 'error': result.get('error', 'Akses ditolak')}), 403
                    
            except Exception as e:
                return jsonify({'success': False, 'error': str(e)}), 500
        else:
            # Bot client not available - return mock success for testing
            return jsonify({
                'success': True,
                'has_access': True,
                'is_admin': True,
                'chat_title': str(chat_id),
                'chat_type': 'channel' if str(chat_id).startswith('-100') else 'group',
                'visibility': 'private',
                'username': None,
                'invite_link': None
            })
            
    except Exception as e:
        print(f"Error validating chat: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@create_bp.route('/create', methods=['POST'])
def create_giveaway():
    """Create a new giveaway"""
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
                    0,  # message_id sementara
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
        
        # Send messages to each chat
        sent_messages = []
        creator_name = f"{first_name} {last_name}".strip() or username or str(user_id)
        creator_mention = f"[{creator_name}](tg://user?id={user_id})"
        
        # Get force subs for requirement
        force_subs = db.get_all_force_subs()
        force_subs_chat_ids = [fs['chat_id'] for fs in force_subs]
        
        current_syarat = syarat
        if force_subs_chat_ids and syarat == 'None':
            current_syarat = ', '.join(force_subs_chat_ids)
        elif force_subs_chat_ids:
            existing = [s.strip() for s in syarat.split(',')]
            for fs in force_subs_chat_ids:
                if fs not in existing:
                    existing.append(fs)
            current_syarat = ', '.join(existing)
        
        # Format link text for message
        link_text_display = ""
        if links:
            link_text_display = "🔗 **ADS LINK:**\n" + "\n".join([f"   {i+1}. {l}" for i, l in enumerate(links)])
        
        # Prepare chat info display
        channel_chats_info = []
        
        for chat in chats:
            chat_id = int(chat.get('chat_id'))
            chat_title = chat.get('title', 'Unknown')
            chat_username = chat.get('username', '')
            visibility = chat.get('visibility', 'private')
            invite_link = chat.get('invite_link', None)
            
            # Format chat display
            if visibility == 'private' and invite_link:
                chat_display = f"📺 **CHAT ID:** [{chat_title}]({invite_link}) (`{chat_id}`)"
                channel_chats_info.append(f"• {chat_title} ([klik]({invite_link}))")
            elif chat_username:
                chat_display = f"📺 **CHAT ID:** [{chat_title}](https://t.me/{chat_username}) (`{chat_id}`)"
                channel_chats_info.append(f"• {chat_title} (@{chat_username})")
            else:
                chat_display = f"📺 **CHAT ID:** {chat_title} (`{chat_id}`)"
                channel_chats_info.append(f"• {chat_title} (ID: {chat_id})")
            
            # Build message text
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
                # Send message using bot client if available
                if bot_client:
                    # Create new event loop for sync context
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    msg = loop.run_until_complete(bot_client.send_message(chat_id, message_text))
                    loop.close()
                else:
                    # Mock for testing
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
                    
                    # Create new event loop for sync context
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
        
        # Send notification to channel info
        try:
            channel_prize_text = '\n'.join([f"   {i+1}. {p}" for i, p in enumerate(prizes)])
            channel_chats_text = '\n'.join(channel_chats_info)
            
            force_subs_text = ""
            if force_subs:
                force_subs_list = []
                for fs in force_subs:
                    fs_title = fs.get('title') or f"Force Sub {fs['chat_id']}"
                    fs_username = fs.get('username')
                    fs_invite_link = fs.get('invite_link')
                    if fs_invite_link:
                        force_subs_list.append(f"   • {fs_title} ([klik]({fs_invite_link}))")
                    elif fs_username:
                        force_subs_list.append(f"   • {fs_title} (@{fs_username})")
                    else:
                        force_subs_list.append(f"   • {fs_title} (ID: {fs['chat_id']})")
                force_subs_text = "\n📢 **FORCE SUBS:**\n" + '\n'.join(force_subs_list)
            
            channel_message = f"""
🎉 **GIVEAWAY DIBUAT!** 🎉

━━━━━━━━━━━━━━━━━━━━━
🆔 **ID GIVEAWAY:** `{giveaway_id}`
🔢 **KODE GIVEAWAY:** `{first_giveaway_code}`
👤 **CREATOR:** {creator_name} (@{username or '-'})
━━━━━━━━━━━━━━━━━━━━━
🎁 **HADIAH:**
^{channel_prize_text}^
━━━━━━━━━━━━━━━━━━━━━
📺 **TARGET CHAT:**
{channel_chats_text}
{force_subs_text}
━━━━━━━━━━━━━━━━━━━━━
⏰ **BERAKHIR:** {format_jakarta_time(end_time)}
━━━━━━━━━━━━━━━━━━━━━
#{giveaway_id}
"""
            
            if bot_client:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                loop.run_until_complete(bot_client.send_message(CHANNEL_INFO, channel_message))
                loop.close()
            
        except Exception as e:
            print(f"Error sending to channel info: {e}")
        
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
    
# giveaway/services/create_service.py - Tambahkan endpoint ini

@create_bp.route('/fetch-chat-entity', methods=['POST'])
def fetch_chat_entity():
    """Fetch chat entity information by chat ID"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        chat_id = data.get('chat_id')
        user_id = data.get('user_id')
        
        if not chat_id:
            return jsonify({'success': False, 'error': 'Chat ID diperlukan'}), 400
        
        # Convert to int
        try:
            chat_id_int = int(chat_id)
        except ValueError:
            chat_id_int = chat_id
        
        result = {
            'success': False,
            'error': 'Bot client not available'
        }
        
        if bot_client:
            try:
                # Create new event loop for sync context
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                async def fetch_entity():
                    # Get entity
                    entity = await bot_client.get_entity(chat_id_int)
                    
                    # Determine chat type
                    from telethon.tl.types import Channel, Chat
                    chat_type = "unknown"
                    if isinstance(entity, Channel):
                        chat_type = "channel" if entity.broadcast else "supergroup"
                    elif isinstance(entity, Chat):
                        chat_type = "group"
                    
                    # Check visibility
                    username = getattr(entity, 'username', None)
                    visibility = "public" if username else "private"
                    
                    # Get invite link for private chat
                    invite_link = None
                    if visibility == "private":
                        try:
                            invite = await bot_client(functions.messages.ExportChatInviteRequest(
                                peer=chat_id_int,
                                expire_date=None,
                                usage_limit=None,
                                title="Giveaway Join Link"
                            ))
                            invite_link = invite.link
                        except Exception as e:
                            print(f"Failed to create invite link: {e}")
                    
                    # Get photo URL if available
                    photo_url = None
                    if hasattr(entity, 'photo') and entity.photo:
                        if hasattr(entity.photo, 'photo_id'):
                            # Try to get photo URL
                            photo_url = f"https://t.me/{username}" if username else None
                    
                    # Get member count if available
                    member_count = None
                    try:
                        if hasattr(entity, 'participants_count'):
                            member_count = entity.participants_count
                        elif hasattr(entity, 'usernames'):
                            # Try to get via GetFullChannelRequest
                            full = await bot_client(functions.channels.GetFullChannelRequest(channel=entity))
                            if hasattr(full, 'full_chat') and hasattr(full.full_chat, 'participants_count'):
                                member_count = full.full_chat.participants_count
                    except Exception as e:
                        print(f"Failed to get member count: {e}")
                    
                    return {
                        'success': True,
                        'chat_id': str(chat_id_int),
                        'title': getattr(entity, 'title', str(chat_id_int)),
                        'username': username,
                        'type': chat_type,
                        'visibility': visibility,
                        'invite_link': invite_link,
                        'photo_url': photo_url,
                        'member_count': member_count
                    }
                
                result = loop.run_until_complete(fetch_entity())
                loop.close()
                
            except Exception as e:
                result = {
                    'success': False,
                    'error': str(e)
                }
        else:
            # Mock response for testing
            result = {
                'success': True,
                'chat_id': str(chat_id),
                'title': f"Chat {chat_id}",
                'username': None,
                'type': 'channel' if str(chat_id).startswith('-100') else 'group',
                'visibility': 'private',
                'invite_link': None,
                'photo_url': None,
                'member_count': None
            }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error fetching chat entity: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500