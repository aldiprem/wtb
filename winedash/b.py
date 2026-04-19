#!/usr/bin/env python3
# b.py - Bot untuk verifikasi username marketplace

import os
import asyncio
import random
import string
import base64
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from telethon import TelegramClient, events, Button, types, errors
import logging
import sqlite3
import json
import sys
import time

# Load environment - cari .env di root project
env_path = Path(__file__).parent.parent / '.env'
if not env_path.exists():
    env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configuration
API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_WINEDASH", "")
WINEDASH_TOKEN = os.getenv("WINEDASH_TOKEN", "")

# VALIDASI: Pastikan API_ID dan API_HASH tidak kosong
if API_ID == 0 or not API_HASH:
    print("ERROR: API_ID atau API_HASH tidak ditemukan di .env!")
    print(f"API_ID: {API_ID}")
    print(f"API_HASH: {API_HASH}")
    print("Pastikan file .env di /root/wtb/.env memiliki API_ID dan API_HASH")
    sys.exit(1)

if not BOT_TOKEN:
    print("ERROR: BOT_WINEDASH tidak ditemukan di .env!")
    print("Pastikan file .env memiliki BOT_WINEDASH=bot_token_here")
    sys.exit(1)

# Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Database path
DB_PATH = "/root/wtb/winedash/database/winedash.db"

# Bot client
bot = TelegramClient('winedash_bot_session', API_ID, API_HASH)
processed_pending_ids = set()
processed_pending_ids = {}

# ==================== DATABASE FUNCTIONS ====================

def init_pending_table():
    """Initialize pending_usernames table if not exists"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pending_usernames (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    category TEXT,
                    price DECIMAL(20, 8) NOT NULL,
                    seller_id INTEGER NOT NULL,
                    seller_wallet TEXT,
                    verification_type TEXT DEFAULT 'channel',
                    verification_code TEXT,
                    status TEXT DEFAULT 'pending',
                    target_chat_id TEXT,
                    target_chat_title TEXT,
                    created_at TIMESTAMP,
                    expires_at TIMESTAMP,
                    confirmed_at TIMESTAMP
                )
            ''')
            conn.commit()
            logger.info("✅ pending_usernames table initialized")
    except Exception as e:
        logger.error(f"Error initializing pending table: {e}")

def get_pending_username(pending_id: int):
    """Get pending username details"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, username, category, price, seller_id, seller_wallet,
                       verification_type, verification_code, status
                FROM pending_usernames WHERE id = ?
            ''', (pending_id,))
            row = cursor.fetchone()
            if row:
                return {
                    'id': row[0],
                    'username': row[1],
                    'category': row[2],
                    'price': float(row[3]),
                    'seller_id': row[4],
                    'seller_wallet': row[5],
                    'verification_type': row[6],
                    'verification_code': row[7],
                    'status': row[8]
                }
            return None
    except Exception as e:
        logger.error(f"Error getting pending username: {e}")
        return None

def update_pending_verification(pending_id: int, chat_id: str, chat_title: str, v_type: str):
    """Update pending username with chat info"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE pending_usernames 
                SET target_chat_id = ?, target_chat_title = ?, verification_type = ?
                WHERE id = ?
            ''', (chat_id, chat_title, v_type, pending_id))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error updating pending: {e}")
        return False

def update_pending_code(pending_id: int, code: str):
    """Update verification code for user type"""
    try:
        expires_at = (datetime.now() + timedelta(minutes=5)).isoformat()
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE pending_usernames 
                SET verification_code = ?, expires_at = ?
                WHERE id = ?
            ''', (code, expires_at, pending_id))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error updating code: {e}")
        return False

def get_pending_by_username(username: str) -> dict:
    """Get pending record by username"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, seller_id, status, verification_type, verification_code
                FROM pending_usernames WHERE username = ? AND status = 'pending'
            ''', (username,))
            row = cursor.fetchone()
            if row:
                return {
                    'id': row[0],
                    'seller_id': row[1],
                    'status': row[2],
                    'verification_type': row[3],
                    'verification_code': row[4]
                }
            return None
    except Exception as e:
        logger.error(f"Error: {e}")
        return None

def get_pending_by_seller(seller_id: int):
    """Get all pending usernames for a seller"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, username, category, price, verification_type, verification_code, status, created_at
                FROM pending_usernames 
                WHERE seller_id = ? AND status = 'pending'
                ORDER BY created_at DESC
            ''', (seller_id,))
            rows = cursor.fetchall()
            results = []
            for row in rows:
                results.append({
                    'id': row[0],
                    'username': row[1],
                    'category': row[2],
                    'price': float(row[3]),
                    'verification_type': row[4],
                    'verification_code': row[5],
                    'status': row[6],
                    'created_at': row[7]
                })
            return results
    except Exception as e:
        logger.error(f"Error getting pending by seller: {e}")
        return []

def reject_pending(pending_id: int):
    """Reject pending username"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE pending_usernames SET status = 'rejected'
                WHERE id = ?
            ''', (pending_id,))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error rejecting pending: {e}")
        return False

# ==================== HELPER FUNCTIONS ====================

def generate_otp() -> str:
    """Generate 6 digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

async def check_bot_access(chat_id: int) -> bool:
    """Check if bot can send messages to chat"""
    try:
        await bot.send_message(chat_id, "🔍 Testing bot access...")
        return True
    except Exception as e:
        logger.error(f"Bot cannot send to {chat_id}: {e}")
        return False

async def check_username_exists(username: str) -> bool:
    """Check if username already exists in marketplace"""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM usernames WHERE username = ? AND status = "available"', (username,))
            return cursor.fetchone() is not None
    except Exception as e:
        logger.error(f"Error checking username: {e}")
        return False

# ==================== VERIFICATION HANDLERS ====================

async def send_channel_verification(chat_id: int, username: str, price: float, pending_id: int):
    """Send verification message to channel/group with inline button"""
    try:
        message = f"""
🔐 **VERIFIKASI USERNAME BARU**

Username: `{username}`
Harga: `{price} TON`

Username ini ingin didaftarkan ke marketplace. 
Klik tombol di bawah untuk **MENERIMA** atau **MENOLAK**.

⚠️ *Hanya admin/owner yang dapat melakukan verifikasi!*
"""
        
        buttons = [
            [
                Button.inline("✅ TERIMA", data=f"verify_accept:{pending_id}:{username}"),
                Button.inline("❌ TOLAK", data=f"verify_reject:{pending_id}:{username}")
            ]
        ]
        
        await bot.send_message(chat_id, message, buttons=buttons)
        logger.info(f"Sent verification request to {chat_id} for username {username}")
        return True
    except Exception as e:
        logger.error(f"Error sending channel verification: {e}")
        return False

async def send_user_verification(user_id: int, username: str, price: float, pending_id: int, otp: str):
    """Send OTP verification to user"""
    try:
        message = f"""
🔐 **VERIFIKASI USERNAME BARU**

Username: `{username}`
Harga: `{price} TON`

**Kode OTP Anda:** `{otp}`

Masukkan kode di atas di halaman Storage untuk menyelesaikan verifikasi.

⏰ *Kode berlaku selama 5 menit.*
"""
        
        await bot.send_message(user_id, message)
        logger.info(f"Sent OTP to user {user_id} for username {username}")
        return True
    except Exception as e:
        logger.error(f"Error sending user verification: {e}")
        return False

# ==================== CALLBACK HANDLERS ====================
@bot.on(events.CallbackQuery(pattern=r"verify_accept:(\d+):(.+)"))
async def handle_verify_accept(event):
    """Handle accept verification from channel/group admin"""
    pending_id = int(event.pattern_match.group(1))
    username = event.pattern_match.group(2)
    
    # Get pending record
    pending = get_pending_username(pending_id)
    if not pending:
        await event.answer("Data tidak ditemukan!", alert=True)
        return
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Dapatkan data pending
            cursor.execute('''
                SELECT username, price, seller_id, seller_wallet, category
                FROM pending_usernames WHERE id = ? AND status = 'pending'
            ''', (pending_id,))
            row = cursor.fetchone()
            
            if not row:
                await event.answer("Data tidak ditemukan!", alert=True)
                return
            
            pending_username, price, seller_id, seller_wallet, category = row
            
            # Cek apakah username sudah ada di usernames
            cursor.execute('SELECT id FROM usernames WHERE username = ?', (pending_username,))
            if cursor.fetchone():
                await event.answer("Username sudah ada!", alert=True)
                return
            
            # Pindahkan ke tabel usernames
            now = datetime.now().isoformat()
            cursor.execute('''
                INSERT INTO usernames (username, category, price, seller_id, seller_wallet, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'available', ?)
            ''', (pending_username, category, price, seller_id, seller_wallet, now))
            
            # Hapus dari pending
            cursor.execute('DELETE FROM pending_usernames WHERE id = ?', (pending_id,))
            
            conn.commit()
            
            await event.answer("✅ Username berhasil diverifikasi!", alert=True)
            await event.edit("✅ **USERNAME TERVERIFIKASI!**\n\nUsername telah ditambahkan ke marketplace.")
            
            # Notify seller
            try:
                await bot.send_message(
                    seller_id,
                    f"✅ **Username {username} telah diverifikasi!**\n\n"
                    f"Username sekarang tersedia di marketplace dengan harga {price} TON."
                )
            except:
                pass
                
    except Exception as e:
        logger.error(f"Error confirming pending: {e}")
        await event.answer("Gagal verifikasi!", alert=True)


@bot.on(events.CallbackQuery(pattern=r"verify_reject:(\d+):(.+)"))
async def handle_verify_reject(event):
    """Handle reject verification from channel/group admin"""
    pending_id = int(event.pattern_match.group(1))
    username = event.pattern_match.group(2)
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Dapatkan seller_id sebelum hapus
            cursor.execute('SELECT seller_id FROM pending_usernames WHERE id = ?', (pending_id,))
            row = cursor.fetchone()
            seller_id = row[0] if row else None
            
            # Hapus pending record
            cursor.execute('DELETE FROM pending_usernames WHERE id = ?', (pending_id,))
            conn.commit()
            
            await event.answer("❌ Username ditolak!", alert=True)
            await event.edit("❌ **USERNAME DITOLAK!**\n\nUsername tidak akan ditambahkan ke marketplace.")
            
            # Notify seller
            if seller_id:
                try:
                    await bot.send_message(
                        seller_id,
                        f"❌ **Username {username} ditolak!**\n\n"
                        f"Admin channel/group tidak menyetujui penjualan username ini."
                    )
                except:
                    pass
                
    except Exception as e:
        logger.error(f"Error rejecting pending: {e}")
        await event.answer("Gagal menolak!", alert=True)

# ==================== MAIN BOT ====================
async def process_pending_verifications():
    """Process pending verifications from Flask"""
    import aiohttp
    
    await asyncio.sleep(5)
    
    while True:
        try:
            # Bersihkan processed IDs yang sudah lebih dari 5 menit
            current_time = time.time()
            to_remove = []
            for pid, timestamp in processed_pending_ids.items():
                if current_time - timestamp > 300:  # 5 menit
                    to_remove.append(pid)
            for pid in to_remove:
                del processed_pending_ids[pid]
            
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:5050/api/winedash/username/pending/list') as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for pending in data.get('pendings', []):
                            pending_id = pending.get('id')
                            
                            # Skip jika sudah diproses dalam 5 menit terakhir
                            if pending_id in processed_pending_ids:
                                continue
                            
                            # Proses hanya yang statusnya 'pending' dan belum diproses (target_chat_id kosong)
                            if (pending.get('status') == 'pending' and 
                                not pending.get('target_chat_id')):
                                
                                # Tandai sebagai sedang diproses
                                processed_pending_ids[pending_id] = current_time
                                
                                try:
                                    await process_verification(session, pending)
                                except Exception as e:
                                    logger.error(f"Error processing pending {pending_id}: {e}")
                                    # Jika gagal, hapus dari dict agar bisa dicoba lagi nanti
                                    processed_pending_ids.pop(pending_id, None)
                                
                                # Beri jeda antar proses agar tidak terlalu cepat
                                await asyncio.sleep(2)
                        
        except aiohttp.ClientConnectorError:
            logger.debug("Flask server not ready yet...")
        except Exception as e:
            logger.error(f"Error processing: {e}")
        
        await asyncio.sleep(5)

async def process_verification(session, pending):
    """Process single verification"""
    pending_id = pending['id']
    username = pending['username']
    price = pending['price']
    seller_id = pending['seller_id']
    
    logger.info(f"Processing verification for {username} (pending_id: {pending_id})")
    
    # Cek lagi apakah sudah diproses (double check)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT target_chat_id, verification_type FROM pending_usernames WHERE id = ?', (pending_id,))
        row = cursor.fetchone()
        if row and row[0]:
            logger.info(f"Pending {pending_id} already has target_chat_id, skipping...")
            return
        
        # Jika verification_type sudah ditentukan sebelumnya (bukan 'auto'), gunakan itu
        existing_v_type = row[1] if row else None
    
    # Check if username already exists in marketplace
    if await check_username_exists(username):
        reject_pending(pending_id)
        try:
            await bot.send_message(seller_id, f"❌ Username @{username} sudah ada di marketplace!")
        except:
            pass
        return
        
    # Dapatkan entity type dan foto profil
    entity_type, chat_id, title, photo_bytes = await check_entity_type_with_photo(username)
    
    # Simpan photo_bytes ke database jika ada
    if photo_bytes and len(photo_bytes) > 0:
        import base64
        photo_base64 = f"data:image/jpeg;base64,{base64.b64encode(photo_bytes).decode('ascii')}"
        await save_profile_photo_to_server(username, photo_base64)
        logger.info(f"✅ Saved profile photo for {username} to database")
    
    if not entity_type:
        reject_pending(pending_id)
        try:
            await bot.send_message(seller_id, f"❌ Username @{username} tidak ditemukan!")
        except:
            pass
        return
    
    logger.info(f"Detected entity type for @{username}: {entity_type} (chat_id: {chat_id})")
    
    # Kirim notifikasi ke seller tentang tipe yang terdeteksi
    try:
        type_emoji = "📢" if entity_type in ['channel', 'group', 'supergroup'] else "👤"
        await bot.send_message(
            seller_id,
            f"{type_emoji} Username @{username} terdeteksi sebagai **{entity_type.upper()}**\n\n"
            f"Bot akan mengirim verifikasi sesuai tipe ini."
        )
    except:
        pass
    
    # Check bot access for channels/groups
    if entity_type in ['channel', 'group', 'supergroup']:
        # Cek apakah bot bisa mengirim pesan ke chat
        if not await check_bot_access(chat_id):
            try:
                await bot.send_message(seller_id, f"❌ Bot tidak memiliki akses ke @{username}! Pastikan bot sudah menjadi admin.")
            except:
                pass
            return
        
        # Update pending with chat info - verification_type sesuai entity
        update_pending_verification(pending_id, str(chat_id), title, entity_type)
        
        # Send verification message to channel/group
        await send_channel_verification(chat_id, username, price, pending_id)
        
        try:
            await bot.send_message(seller_id, f"✅ Verifikasi telah dikirim ke @{username}!\n\nTunggu admin channel/group untuk mengkonfirmasi.")
        except:
            pass
        
    else:  # User
        # Generate OTP
        otp = generate_otp()
        update_pending_code(pending_id, otp)
        update_pending_verification(pending_id, str(chat_id), title, 'user')
        
        # Send OTP to user
        await send_user_verification(chat_id, username, price, pending_id, otp)
        
        try:
            await bot.send_message(seller_id, f"✅ Kode OTP 6 digit telah dikirim ke DM @{username}!\n\nMasukkan kode di halaman Storage untuk verifikasi.")
        except:
            pass

async def check_entity_type_with_photo(username: str):
    """Check if username is channel, group, or user, and get profile photo bytes"""
    try:
        if not username:
            return None, None, None, None
        
        # Bersihkan username
        username_clean = username.lstrip('@').strip()
        
        # Coba get entity
        entity = await bot.get_entity(username_clean)
        
        # Download profile photo ke bytes
        photo_bytes = None
        try:
            # Method 1: download_profile_photo
            photo_bytes = await bot.download_profile_photo(entity, file=bytes)
            if photo_bytes and len(photo_bytes) > 0:
                logger.info(f"✅ Downloaded profile photo for {username_clean}, size: {len(photo_bytes)} bytes")
        except Exception as e:
            logger.debug(f"Method 1 failed for {username_clean}: {e}")
        
        # Method 2: download_media (fallback)
        if not photo_bytes or len(photo_bytes) == 0:
            try:
                photo_bytes = await bot.download_media(entity, file=bytes)
                if photo_bytes and len(photo_bytes) > 0:
                    logger.info(f"✅ Downloaded media for {username_clean}, size: {len(photo_bytes)} bytes")
            except Exception as e:
                logger.debug(f"Method 2 failed for {username_clean}: {e}")
        
        # Tentukan tipe entity
        if hasattr(entity, 'broadcast') and entity.broadcast:
            return 'channel', entity.id, getattr(entity, 'title', username_clean), photo_bytes
        elif hasattr(entity, 'megagroup') and entity.megagroup:
            return 'supergroup', entity.id, getattr(entity, 'title', username_clean), photo_bytes
        elif hasattr(entity, 'participants_count'):
            return 'group', entity.id, getattr(entity, 'title', username_clean), photo_bytes
        else:
            user_name = getattr(entity, 'first_name', username_clean)
            if hasattr(entity, 'last_name') and entity.last_name:
                user_name = f"{user_name} {entity.last_name}"
            return 'user', entity.id, user_name, photo_bytes
            
    except errors.UsernameNotOccupiedError:
        logger.error(f"Username {username} not found")
        return None, None, None, None
    except errors.FloodWaitError as e:
        logger.error(f"Rate limited: wait {e.seconds} seconds")
        return None, None, None, None
    except Exception as e:
        logger.error(f"Error getting entity for {username}: {e}")
        return None, None, None, None

async def process_pending_verifications():
    """Process pending verifications from Flask"""
    import aiohttp
    
    await asyncio.sleep(5)
    
    while True:
        try:
            # Bersihkan processed IDs yang sudah lebih dari 5 menit
            current_time = time.time()
            to_remove = []
            for pid, timestamp in processed_pending_ids.items():
                if current_time - timestamp > 300:  # 5 menit
                    to_remove.append(pid)
            for pid in to_remove:
                del processed_pending_ids[pid]
            
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:5050/api/winedash/username/pending/list') as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for pending in data.get('pendings', []):
                            pending_id = pending.get('id')
                            
                            # Skip jika sudah diproses dalam 5 menit terakhir
                            if pending_id in processed_pending_ids:
                                continue
                            
                            # Proses hanya yang statusnya 'pending' dan belum diproses (target_chat_id kosong)
                            if (pending.get('status') == 'pending' and 
                                not pending.get('target_chat_id')):
                                
                                # Tandai sebagai sedang diproses
                                processed_pending_ids[pending_id] = current_time
                                
                                try:
                                    await process_verification(session, pending)
                                except Exception as e:
                                    logger.error(f"Error processing pending {pending_id}: {e}")
                                    # Jika gagal, hapus dari dict agar bisa dicoba lagi nanti
                                    processed_pending_ids.pop(pending_id, None)
                                
                                # Beri jeda antar proses agar tidak terlalu cepat
                                await asyncio.sleep(2)
                        
        except aiohttp.ClientConnectorError:
            logger.debug("Flask server not ready yet...")
        except Exception as e:
            logger.error(f"Error processing: {e}")
        
        await asyncio.sleep(5)

# Tambahkan fungsi ini di bagian HELPER FUNCTIONS

async def get_profile_photo_url(entity, is_big: bool = False):
    """Get profile photo URL from entity (user, chat, or channel)"""
    try:
        # Get full entity if needed
        if hasattr(entity, 'input_entity'):
            full_entity = await bot.get_entity(entity.id)
        else:
            full_entity = entity
        
        # Get profile photos
        photos = await bot.get_profile_photos(full_entity, limit=1)
        
        if photos and len(photos) > 0:
            photo = photos[0]
            # Get the appropriate photo size
            if is_big and hasattr(photo, 'sizes'):
                # Find the biggest size
                biggest = max(photo.sizes, key=lambda s: getattr(s, 'size', 0))
                return await _get_photo_url(bot, biggest)
            elif hasattr(photo, 'sizes') and len(photo.sizes) > 0:
                # Get the smallest thumbnail
                return await _get_photo_url(bot, photo.sizes[0])
        
        # Return default avatar URL if no photo
        return None
    except Exception as e:
        logger.error(f"Error getting profile photo for {entity}: {e}")
        return None

async def _get_photo_url(client, photo_size):
    """Helper to get download URL for photo size"""
    try:
        # For newer Telegram versions, we can construct a URL
        # This is a fallback - actual download would require file reference
        if hasattr(photo_size, 'location'):
            # Try to get a direct URL (not always available)
            return None
        return None
    except:
        return None

async def check_entity_type(username: str):
    """Check if username is channel, group, or user, and get profile photo"""
    try:
        if not username:
            return None, None, None, None
        
        # Coba get entity
        entity = await bot.get_entity(username)
        
        # Download profile photo ke bytes
        photo_url = None
        photo_bytes = None
        try:
            photo_bytes = await bot.download_profile_photo(entity, file=bytes)
            if photo_bytes and len(photo_bytes) > 0:
                import base64
                photo_url = f"data:image/jpeg;base64,{base64.b64encode(photo_bytes).decode('ascii')}"
                logger.info(f"✅ Downloaded profile photo for {username}, size: {len(photo_bytes)} bytes")
        except Exception as e:
            logger.debug(f"No profile photo for {username}: {e}")
        
        # Tentukan tipe entity
        if hasattr(entity, 'broadcast') and entity.broadcast:
            return 'channel', entity.id, getattr(entity, 'title', username), photo_url
        elif hasattr(entity, 'megagroup') and entity.megagroup:
            return 'supergroup', entity.id, getattr(entity, 'title', username), photo_url
        elif hasattr(entity, 'participants_count'):
            return 'group', entity.id, getattr(entity, 'title', username), photo_url
        else:
            user_name = getattr(entity, 'first_name', username)
            if hasattr(entity, 'last_name') and entity.last_name:
                user_name = f"{user_name} {entity.last_name}"
            return 'user', entity.id, user_name, photo_url
            
    except Exception as e:
        logger.error(f"Error getting entity for {username}: {e}")
        return None, None, None, None


async def save_profile_photo_to_server(username: str, photo_url: str):
    """Send profile photo to Flask server to save in database"""
    if not photo_url:
        return
    
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post('http://localhost:5050/api/winedash/profile-photo/save', 
                                   json={'username': username, 'photo_url': photo_url}) as resp:
                if resp.status == 200:
                    logger.info(f"✅ Profile photo saved to database for {username}")
                else:
                    logger.warning(f"Failed to save profile photo for {username}")
    except Exception as e:
        logger.error(f"Error saving profile photo to server: {e}")

@bot.on(events.NewMessage(pattern=r'^/get(?:\s+@?(\S+))?$'))
async def handle_get_profile(event):
    """Handle /get command to fetch profile photo"""
    # Parse command
    cmd_parts = event.raw_text.strip().split()
    
    # Cek apakah ada parameter username
    if len(cmd_parts) < 2:
        await event.reply("📸 **Profile Photo Bot**\n\n"
                         "Usage: `/get @username`\n"
                         "Example: `/get @telegram`\n\n"
                         "Supports: Users, Channels, Groups")
        return
    
    # Ambil target (bisa dengan atau tanpa @)
    target = cmd_parts[1].strip()
    
    # Remove @ if present at the beginning only
    if target.startswith('@'):
        target = target[1:]
    
    # Validasi target tidak kosong
    if not target:
        await event.reply("❌ Please provide a username!\n\nUsage: `/get @username`")
        return
    
    # Send initial message
    msg = await event.reply(f"🔍 Fetching profile photo for @{target}...")
    
    try:
        # Get entity info
        entity = await bot.get_entity(target)
        
        # Determine entity type
        if hasattr(entity, 'broadcast') and entity.broadcast:
            entity_type = "Channel"
            entity_name = getattr(entity, 'title', target)
        elif hasattr(entity, 'megagroup') and entity.megagroup:
            entity_type = "Supergroup"
            entity_name = getattr(entity, 'title', target)
        elif hasattr(entity, 'participants_count'):
            entity_type = "Group"
            entity_name = getattr(entity, 'title', target)
        else:
            entity_type = "User"
            entity_name = getattr(entity, 'first_name', target)
            if hasattr(entity, 'last_name') and entity.last_name:
                entity_name = f"{entity_name} {entity.last_name}"
        
        # Get profile photo - multiple methods
        photo_bytes = None
        
        # Method 1: download_profile_photo
        try:
            photo_bytes = await bot.download_profile_photo(entity, file=bytes)
            if photo_bytes and len(photo_bytes) > 0:
                logger.info(f"✅ Method 1 success for @{target}, size: {len(photo_bytes)} bytes")
        except Exception as e:
            logger.debug(f"Method 1 failed for @{target}: {e}")
        
        # Method 2: download_media (fallback)
        if not photo_bytes or len(photo_bytes) == 0:
            try:
                photo_bytes = await bot.download_media(entity, file=bytes)
                if photo_bytes and len(photo_bytes) > 0:
                    logger.info(f"✅ Method 2 success for @{target}, size: {len(photo_bytes)} bytes")
            except Exception as e:
                logger.debug(f"Method 2 failed for @{target}: {e}")
        
        # If no photo found
        if not photo_bytes or len(photo_bytes) == 0:
            await msg.edit(f"❌ **No Profile Photo**\n\n"
                          f"**Target:** @{target}\n"
                          f"**Type:** {entity_type}\n"
                          f"**Name:** {entity_name}\n\n"
                          f"This {entity_type.lower()} doesn't have a profile photo.")
            return
        
        # Get file size
        file_size_kb = len(photo_bytes) / 1024
        
        # Convert to base64 for database
        import base64
        photo_base64 = f"data:image/jpeg;base64,{base64.b64encode(photo_bytes).decode('ascii')}"
        
        # Save to database via Flask API
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.post('http://localhost:5050/api/winedash/profile-photo/save',
                                       json={'username': target, 'photo_url': photo_base64}) as resp:
                    if resp.status == 200:
                        logger.info(f"✅ Profile photo saved to database for @{target}")
                    else:
                        logger.warning(f"Failed to save photo for @{target}: {resp.status}")
        except Exception as e:
            logger.error(f"Error saving to database: {e}")
        
        # Send photo directly
        await bot.send_file(
            event.chat_id,
            photo_bytes,
            caption=f"📸 **Profile Photo Found!**\n\n"
                   f"**Target:** @{target}\n"
                   f"**Type:** {entity_type}\n"
                   f"**Name:** {entity_name}\n"
                   f"**Size:** {file_size_kb:.1f} KB",
            force_document=False
        )
        
        await msg.delete()
        
    except errors.UsernameNotOccupiedError:
        await msg.edit(f"❌ **Username not found**\n\n"
                      f"Username `@{target}` does not exist on Telegram.")
    except errors.FloodWaitError as e:
        await msg.edit(f"⚠️ **Rate limited**\n\n"
                      f"Please wait {e.seconds} seconds before trying again.")
    except Exception as e:
        logger.error(f"Error in /get command: {e}")
        await msg.edit(f"❌ **Error:** {str(e)}")

@bot.on(events.NewMessage(pattern=r'^/getprofile(@?\S+)?$'))
async def handle_get_profile_via_api(event):
    """Handle /getprofile command for API - fetch and save profile photo to database"""
    # Parse command
    cmd_parts = event.raw_text.strip().split()
    
    if len(cmd_parts) < 2:
        await event.reply("Usage: `/getprofile @username`")
        return
    
    target = cmd_parts[1].strip()
    if target.startswith('@'):
        target = target[1:]
    
    if not target:
        await event.reply("Please provide a username!")
        return
    
    msg = await event.reply(f"🔍 Fetching profile photo for @{target}...")
    
    try:
        entity = await bot.get_entity(target)
        
        # Download photo
        photo_bytes = None
        try:
            photo_bytes = await bot.download_profile_photo(entity, file=bytes)
        except:
            pass
        
        if not photo_bytes:
            try:
                photo_bytes = await bot.download_media(entity, file=bytes)
            except:
                pass
        
        if not photo_bytes:
            await msg.edit(f"❌ No profile photo found for @{target}")
            return
        
        # Convert to base64
        import base64
        photo_base64 = f"data:image/jpeg;base64,{base64.b64encode(photo_bytes).decode('ascii')}"
        
        # Save to database via API
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post('http://localhost:5050/api/winedash/profile-photo/save',
                                   json={'username': target, 'photo_url': photo_base64}) as resp:
                if resp.status == 200:
                    await msg.edit(f"✅ Profile photo for @{target} saved to database!")
                    logger.info(f"Saved profile photo for @{target} via /getprofile command")
                else:
                    await msg.edit(f"⚠️ Failed to save photo for @{target}")
                    
    except errors.UsernameNotOccupiedError:
        await msg.edit(f"❌ Username @{target} not found")
    except Exception as e:
        logger.error(f"Error in /getprofile: {e}")
        await msg.edit(f"❌ Error: {str(e)}")

async def main():
    logger.info("🚀 Starting Winedash Bot...")
    
    # Initialize database table
    init_pending_table()
    
    # Start bot
    await bot.start(bot_token=BOT_TOKEN)
    logger.info("✅ Winedash Bot is running")
    logger.info(f"Bot username: {(await bot.get_me()).username}")
    
    # Start processing pending verifications
    asyncio.create_task(process_pending_verifications())
    
    await bot.run_until_disconnected()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Bot dihentikan")
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}")