#!/usr/bin/env python3
# b_winedash.py - Bot untuk verifikasi username marketplace

import os
import asyncio
import random
import string
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from telethon import TelegramClient, events, Button
import logging
import sqlite3
import json
import sys

# Load environment
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configuration
API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_WINEDASH", "")  # Bot untuk winedash
WINEDASH_TOKEN = os.getenv("WINEDASH_TOKEN", "")  # Userbot token (opsional)

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

# ==================== DATABASE FUNCTIONS ====================

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

# ==================== HELPER FUNCTIONS ====================

def generate_otp() -> str:
    """Generate 6 digit OTP"""
    return ''.join(random.choices(string.digits, k=6))

async def check_entity_type(username: str):
    """Check if username is channel, group, or user"""
    try:
        entity = await bot.get_entity(username)
        
        if hasattr(entity, 'broadcast') and entity.broadcast:
            return 'channel', entity.id, getattr(entity, 'title', username)
        elif hasattr(entity, 'megagroup') and entity.megagroup:
            return 'supergroup', entity.id, getattr(entity, 'title', username)
        elif hasattr(entity, 'participants_count'):
            return 'group', entity.id, getattr(entity, 'title', username)
        else:
            return 'user', entity.id, getattr(entity, 'first_name', username)
    except Exception as e:
        logger.error(f"Error getting entity: {e}")
        return None, None, None

async def check_bot_access(chat_id: int) -> bool:
    """Check if bot can send messages to chat"""
    try:
        await bot.send_message(chat_id, "test")
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
    
    # Confirm in database
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            now = datetime.now().isoformat()
            
            # Move to usernames table
            cursor.execute('''
                INSERT INTO usernames (username, category, price, seller_id, seller_wallet, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'available', ?)
            ''', (username, pending['category'], pending['price'], 
                  pending['seller_id'], pending['seller_wallet'], now))
            
            # Update pending status
            cursor.execute('''
                UPDATE pending_usernames SET status = 'confirmed', confirmed_at = ? WHERE id = ?
            ''', (now, pending_id))
            
            conn.commit()
            
            await event.answer("✅ Username berhasil diverifikasi!", alert=True)
            await event.edit("✅ **USERNAME TERVERIFIKASI!**\n\nUsername telah ditambahkan ke marketplace.")
            
            # Notify seller
            try:
                await bot.send_message(
                    pending['seller_id'],
                    f"✅ **Username {username} telah diverifikasi!**\n\n"
                    f"Username sekarang tersedia di marketplace dengan harga {pending['price']} TON."
                )
            except:
                pass
                
    except Exception as e:
        logger.error(f"Error in accept verification: {e}")
        await event.answer("Gagal verifikasi!", alert=True)


@bot.on(events.CallbackQuery(pattern=r"verify_reject:(\d+):(.+)"))
async def handle_verify_reject(event):
    """Handle reject verification from channel/group admin"""
    pending_id = int(event.pattern_match.group(1))
    username = event.pattern_match.group(2)
    
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute('UPDATE pending_usernames SET status = "rejected" WHERE id = ?', (pending_id,))
            conn.commit()
        
        await event.answer("❌ Username ditolak!", alert=True)
        await event.edit("❌ **USERNAME DITOLAK!**\n\nUsername tidak akan ditambahkan ke marketplace.")
        
        # Notify seller
        pending = get_pending_username(pending_id)
        if pending:
            try:
                await bot.send_message(
                    pending['seller_id'],
                    f"❌ **Username {username} ditolak!**\n\n"
                    f"Admin channel/group tidak menyetujui penjualan username ini."
                )
            except:
                pass
                
    except Exception as e:
        logger.error(f"Error in reject verification: {e}")
        await event.answer("Gagal menolak!", alert=True)

# ==================== MAIN BOT ====================

async def process_pending_verifications():
    """Process pending verifications from Flask"""
    import aiohttp
    
    await asyncio.sleep(2)
    
    while True:
        try:
            async with aiohttp.ClientSession() as session:
                # Get pending from Flask
                async with session.get('http://localhost:5050/api/winedash/username/pending/list') as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        for pending in data.get('pendings', []):
                            if pending.get('verification_type') == 'pending_detect':
                                await process_verification(session, pending)
        except aiohttp.ClientConnectorError:
            pass
        except Exception as e:
            logger.error(f"Error processing: {e}")
        
        await asyncio.sleep(2)


async def process_verification(session, pending):
    """Process single verification"""
    pending_id = pending['id']
    username = pending['username']
    price = pending['price']
    seller_id = pending['seller_id']
    
    # Check if username already exists in marketplace
    if await check_username_exists(username):
        # Mark as rejected
        async with session.post('http://localhost:5050/api/winedash/username/pending/reject',
                                json={'pending_id': pending_id}) as resp:
            await bot.send_message(seller_id, f"❌ Username @{username} sudah ada di marketplace!")
        return
    
    # Check entity type
    entity_type, chat_id, title = await check_entity_type(username)
    
    if not entity_type:
        async with session.post('http://localhost:5050/api/winedash/username/pending/reject',
                                json={'pending_id': pending_id}) as resp:
            await bot.send_message(seller_id, f"❌ Username @{username} tidak ditemukan!")
        return
    
    # Check bot access
    if entity_type in ['channel', 'group', 'supergroup']:
        if not await check_bot_access(chat_id):
            await bot.send_message(seller_id, f"❌ Bot tidak memiliki akses ke @{username}! Pastikan bot sudah menjadi admin.")
            return
        
        # Update pending with chat info
        update_pending_verification(pending_id, str(chat_id), title, entity_type)
        
        # Send verification message to channel/group
        await send_channel_verification(chat_id, username, price, pending_id)
        
        await bot.send_message(seller_id, f"✅ Verifikasi telah dikirim ke @{username}!\n\nTunggu admin channel/group untuk mengkonfirmasi.")
        
    else:  # User
        # Generate OTP
        otp = generate_otp()
        update_pending_code(pending_id, otp)
        update_pending_verification(pending_id, str(chat_id), title, 'user')
        
        # Send OTP to user
        await send_user_verification(chat_id, username, price, pending_id, otp)
        
        await bot.send_message(seller_id, f"✅ Kode OTP telah dikirim ke @{username}!\n\nMasukkan kode di halaman Storage untuk verifikasi.")


async def main():
    logger.info("🚀 Starting Winedash Bot...")
    
    await bot.start(bot_token=BOT_TOKEN)
    logger.info("✅ Winedash Bot is running")
    
    # Start processing
    asyncio.create_task(process_pending_verifications())
    
    await bot.run_until_disconnected()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Bot dihentikan")
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}")