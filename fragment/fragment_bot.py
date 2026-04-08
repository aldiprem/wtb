# master_bot.py - Master Bot for managing cloned bots
import os
import json
import base64
import asyncio
import logging
import subprocess
import sys
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import os
import tempfile
from telethon.tl.types import DocumentAttributeFilename, DocumentAttributeSticker
from dotenv import load_dotenv
from telethon import TelegramClient, events, Button

# Import database functions
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fragment.database.data import (
    init_database, get_master_stats, get_owner_stats,
    create_panel_user, authenticate_panel_user, get_panel_user,
    add_user_balance, deduct_user_balance, get_user_balance,
    add_cloned_bot, get_cloned_bots, get_bot_by_token,
    update_bot_status, remove_cloned_bot, get_bot_logs,
    log_owner_activity, get_owner_activities,
    create_deposit, update_deposit_status,
    save_bot_fragment_config, get_bot_fragment_config,
    save_bot_wallet_config, get_bot_wallet_config,
    create_panel_session, validate_panel_session, delete_panel_session
)

# ===================== LOAD ENVIRONMENT =====================
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# ===================== KONFIGURASI =====================
API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

# Owner ID (only you)
OWNER_ID = int(os.getenv("OWNER_ID", 0))

# Logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Store running bot processes
running_bots: Dict[str, subprocess.Popen] = {}

# Bot instance
bot = TelegramClient('master_bot_session', API_ID, API_HASH)

# Rental price per bot (in IDR or TON)
BOT_RENTAL_PRICE = int(os.getenv("BOT_RENTAL_PRICE", 100000))  # 100k IDR per month


# ==================== HELPER FUNCTIONS ====================

async def is_owner(user_id: int) -> bool:
    return user_id == OWNER_ID


def get_bot_script_path() -> str:
    return os.path.join(os.path.dirname(__file__), "fragment_bot.py")


async def start_cloned_bot(bot_token: str, bot_username: str) -> bool:
    """Start a cloned bot process"""
    try:
        if bot_token in running_bots:
            proc = running_bots[bot_token]
            if proc.poll() is None:
                logger.info(f"Bot {bot_username} already running")
                return True
        
        env = os.environ.copy()
        env["BOT_TOKEN"] = bot_token
        env["IS_CLONE"] = "true"
        env["MASTER_BOT_TOKEN"] = BOT_TOKEN
        env["PYTHONPATH"] = str(Path(__file__).parent.parent)

        proc = subprocess.Popen(
            [sys.executable, get_bot_script_path()], 
            env=env, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True,
            cwd=str(Path(__file__).parent.parent)
        )
        running_bots[bot_token] = proc
        await update_bot_status(bot_token, 'running', proc.pid)
        logger.info(f"✅ Started cloned bot: {bot_username} (PID: {proc.pid})")
        
        # Monitor process
        asyncio.create_task(monitor_bot_process(bot_token, bot_username, proc))
        return True
    except Exception as e:
        logger.error(f"Error starting cloned bot: {e}")
        await update_bot_status(bot_token, 'error')
        return False


async def stop_cloned_bot(bot_token: str, bot_username: str) -> bool:
    """Stop a cloned bot process"""
    try:
        if bot_token in running_bots:
            proc = running_bots[bot_token]
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
            del running_bots[bot_token]
        await update_bot_status(bot_token, 'stopped')
        logger.info(f"✅ Stopped cloned bot: {bot_username}")
        return True
    except Exception as e:
        logger.error(f"Error stopping cloned bot: {e}")
        return False


async def monitor_bot_process(bot_token: str, bot_username: str, proc: subprocess.Popen):
    """Monitor bot process output"""
    try:
        async def read_output(pipe, log_level):
            for line in iter(pipe.readline, ''):
                if line:
                    from fragment.database.data import add_bot_log_sync
                    add_bot_log_sync(bot_token, log_level, line.strip())
        
        loop = asyncio.get_event_loop()
        loop.run_in_executor(None, read_output, proc.stdout, "INFO")
        loop.run_in_executor(None, read_output, proc.stderr, "ERROR")
        
        await loop.run_in_executor(None, proc.wait)
        
        if bot_token in running_bots:
            del running_bots[bot_token]
        await update_bot_status(bot_token, 'stopped')
        logger.info(f"Bot {bot_username} process ended")
    except Exception as e:
        logger.error(f"Error monitoring bot {bot_username}: {e}")
        await update_bot_status(bot_token, 'error')


# ==================== COMMAND HANDLERS ====================

@bot.on(events.NewMessage(pattern='/start'))
async def start_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ **Akses Ditolak!**\n\nBot ini hanya untuk owner.")
        return
    
    welcome_text = (
        "🌟 **Master Bot - Fragment Stars Bot Manager** 🌟\n\n"
        "Bot ini digunakan untuk mengelola bot clone Fragment Stars.\n\n"
        "**Commands:**\n"
        "/adduser <username> <password> - Tambah user baru\n"
        "/listusers - Lihat semua user\n"
        "/userstats <username> - Lihat statistik user\n"
        "/addbalance <username> <amount> - Tambah saldo user\n"
        "/createbot <user_id> <bot_token> [username] - Buat bot untuk user\n"
        "/listbots - Lihat semua bot\n"
        "/startbot <bot_username> - Jalankan bot\n"
        "/stopbot <bot_username> - Hentikan bot\n"
        "/delbot <bot_username> - Hapus bot\n"
        "/botlog <bot_username> - Lihat log bot\n"
        "/stats - Statistik master\n"
        "/ownerstats <username> - Statistik owner\n"
    )
    
    await event.respond(welcome_text, parse_mode='markdown')


@bot.on(events.NewMessage(pattern='/adduser'))
async def add_user_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 3:
        await event.respond("❌ Format: `/adduser <username> <password> [owner_name] [email]`")
        return
    
    username = parts[1]
    password = parts[2]
    owner_name = parts[3] if len(parts) > 3 else None
    email = parts[4] if len(parts) > 4 else None
    
    new_user_id = await create_panel_user(username, password, owner_name, email)
    
    if new_user_id:
        await event.respond(
            f"✅ **User berhasil ditambahkan!**\n\n"
            f"Username: {username}\n"
            f"User ID: {new_user_id}\n"
            f"Saldo: 0\n\n"
            f"User dapat login di panel web dengan username dan password tersebut."
        )
        await log_owner_activity(OWNER_ID, "add_user", f"Added user {username}")
    else:
        await event.respond("❌ Gagal menambahkan user. Username mungkin sudah ada.")


@bot.on(events.NewMessage(pattern='/listusers'))
async def list_users_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    from fragment.database.data import get_cloned_bots  # local import
    
    conn = None
    try:
        import sqlite3
        from fragment.database.data import DB_PATH
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, username, owner_name, balance, created_at, expires_at 
            FROM panel_users ORDER BY created_at DESC
        """)
        rows = cursor.fetchall()
        conn.close()
        
        if not rows:
            await event.respond("📭 Belum ada user.")
            return
        
        text = "👥 **Daftar User**\n\n"
        for r in rows:
            # Get bot count for this user
            cursor2 = conn.cursor() if conn else None
            if conn:
                cursor2 = conn.cursor()
                cursor2.execute("SELECT COUNT(*) FROM cloned_bots WHERE owner_id = ?", (r[0],))
                bot_count = cursor2.fetchone()[0]
                conn.close()
            else:
                bot_count = 0
            
            expires = r[5][:10] if r[5] else "Permanent"
            text += f"**ID:** {r[0]}\n"
            text += f"**Username:** {r[1]}\n"
            text += f"**Nama:** {r[2] or '-'}\n"
            text += f"**Saldo:** {r[3]:,}\n"
            text += f"**Bot:** {bot_count}\n"
            text += f"**Expired:** {expires}\n\n"
        
        await event.respond(text, parse_mode='markdown')
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        await event.respond(f"❌ Error: {e}")


@bot.on(events.NewMessage(pattern='/addbalance'))
async def add_balance_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 3:
        await event.respond("❌ Format: `/addbalance <username> <amount>`")
        return
    
    username = parts[1]
    amount = int(parts[2])
    
    import sqlite3
    from fragment.database.data import DB_PATH
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM panel_users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        await event.respond(f"❌ User {username} tidak ditemukan.")
        return
    
    success = await add_user_balance(row[0], amount)
    
    if success:
        new_balance = await get_user_balance(row[0])
        await event.respond(f"✅ **Saldo ditambahkan!**\n\nUser: {username}\nTambah: {amount}\nSaldo baru: {new_balance}")
        await log_owner_activity(OWNER_ID, "add_balance", f"Added {amount} to {username}")
    else:
        await event.respond("❌ Gagal menambahkan saldo.")


@bot.on(events.NewMessage(pattern='/createbot'))
async def create_bot_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 3:
        await event.respond("❌ Format: `/createbot <user_id> <bot_token> [bot_username]`")
        return
    
    target_user_id = int(parts[1])
    bot_token = parts[2]
    bot_username = parts[3] if len(parts) > 3 else None
    
    # Validate bot token
    await event.respond("⏳ **Mengecek bot token...**")
    
    try:
        temp_client = TelegramClient(f'temp_{user_id}', API_ID, API_HASH)
        await temp_client.start(bot_token=bot_token)
        me = await temp_client.get_me()
        await temp_client.disconnect()
        
        bot_username = bot_username or me.username or f"bot_{me.id}"
        bot_name = me.first_name or "Fragment Stars Bot"
        
        # Check user balance
        balance = await get_user_balance(target_user_id)
        
        if balance < BOT_RENTAL_PRICE:
            await event.respond(
                f"❌ **Saldo tidak cukup!**\n\n"
                f"User ID {target_user_id} memiliki saldo: {balance}\n"
                f"Harga sewa bot: {BOT_RENTAL_PRICE}\n"
                f"Kekurangan: {BOT_RENTAL_PRICE - balance}"
            )
            return
        
        # Deduct balance
        await deduct_user_balance(target_user_id, BOT_RENTAL_PRICE)
        
        # Add bot
        success = await add_cloned_bot(bot_token, bot_username, bot_name, target_user_id)
        
        if success:
            # Auto start the bot
            await start_cloned_bot(bot_token, bot_username)
            
            await event.respond(
                f"✅ **Bot Berhasil Dibuat!**\n\n"
                f"**User ID:** {target_user_id}\n"
                f"**Bot Username:** @{bot_username}\n"
                f"**Bot Name:** {bot_name}\n"
                f"**Token:** `{bot_token[:20]}...`\n\n"
                f"Biaya sewa: {BOT_RENTAL_PRICE}\n"
                f"Sisa saldo user: {balance - BOT_RENTAL_PRICE}\n\n"
                f"Bot sudah berjalan."
            )
            await log_owner_activity(OWNER_ID, "create_bot", f"Created bot {bot_username} for user {target_user_id}")
        else:
            # Refund balance
            await add_user_balance(target_user_id, BOT_RENTAL_PRICE)
            await event.respond("❌ Gagal menyimpan bot ke database!")
    except Exception as e:
        await event.respond(f"❌ **Error:** Bot token tidak valid!\n\n{str(e)[:100]}")
        logger.error(f"Error validating bot token: {e}")


@bot.on(events.NewMessage(pattern='/listbots'))
async def list_bots_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    bots = await get_cloned_bots()
    
    if not bots:
        await event.respond("📭 **Belum ada bot yang dibuat.**\n\nGunakan `/createbot` untuk membuat bot.")
        return
    
    text = "🤖 **Daftar Bot Clone**\n\n"
    for bot in bots:
        status_emoji = "🟢" if bot['status'] == 'running' else "🔴"
        text += f"{status_emoji} **@{bot['bot_username']}**\n"
        text += f"   • Nama: {bot['bot_name']}\n"
        text += f"   • Owner ID: {bot['owner_id']}\n"
        text += f"   • Status: {bot['status']}\n"
        if bot['pid']:
            text += f"   • PID: {bot['pid']}\n"
        text += "\n"
    
    await event.respond(text, parse_mode='markdown')


@bot.on(events.NewMessage(pattern='/startbot'))
async def start_bot_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 2:
        await event.respond("❌ Gunakan: `/startbot <bot_username>`")
        return
    
    bot_username = parts[1]
    bots = await get_cloned_bots()
    
    for bot_item in bots:
        if bot_item['bot_username'] == bot_username:
            if bot_item['status'] == 'running':
                await event.respond(f"⚠️ Bot @{bot_username} sudah berjalan!")
                return
            
            success = await start_cloned_bot(bot_item['bot_token'], bot_username)
            if success:
                await event.respond(f"✅ Bot @{bot_username} berhasil dijalankan!")
            else:
                await event.respond(f"❌ Gagal menjalankan bot @{bot_username}!")
            return
    
    await event.respond(f"❌ Bot @{bot_username} tidak ditemukan!")


@bot.on(events.NewMessage(pattern='/stopbot'))
async def stop_bot_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 2:
        await event.respond("❌ Gunakan: `/stopbot <bot_username>`")
        return
    
    bot_username = parts[1]
    bots = await get_cloned_bots()
    
    for bot_item in bots:
        if bot_item['bot_username'] == bot_username:
            if bot_item['status'] != 'running':
                await event.respond(f"⚠️ Bot @{bot_username} tidak sedang berjalan!")
                return
            
            success = await stop_cloned_bot(bot_item['bot_token'], bot_username)
            if success:
                await event.respond(f"✅ Bot @{bot_username} berhasil dihentikan!")
            else:
                await event.respond(f"❌ Gagal menghentikan bot @{bot_username}!")
            return
    
    await event.respond(f"❌ Bot @{bot_username} tidak ditemukan!")


@bot.on(events.NewMessage(pattern='/delbot'))
async def delete_bot_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 2:
        await event.respond("❌ Gunakan: `/delbot <bot_username>`")
        return
    
    bot_username = parts[1]
    bots = await get_cloned_bots()
    
    for bot_item in bots:
        if bot_item['bot_username'] == bot_username:
            if bot_item['status'] == 'running':
                await stop_cloned_bot(bot_item['bot_token'], bot_username)
            
            success = await remove_cloned_bot(bot_item['bot_token'])
            if success:
                await event.respond(f"✅ Bot @{bot_username} berhasil dihapus!")
            else:
                await event.respond(f"❌ Gagal menghapus bot @{bot_username}!")
            return
    
    await event.respond(f"❌ Bot @{bot_username} tidak ditemukan!")


@bot.on(events.NewMessage(pattern='/botlog'))
async def bot_log_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 2:
        await event.respond("❌ Gunakan: `/botlog <bot_username> [limit]`")
        return
    
    bot_username = parts[1]
    limit = int(parts[2]) if len(parts) > 2 else 20
    
    bots = await get_cloned_bots()
    bot_token = None
    
    for bot_item in bots:
        if bot_item['bot_username'] == bot_username:
            bot_token = bot_item['bot_token']
            break
    
    if not bot_token:
        await event.respond(f"❌ Bot @{bot_username} tidak ditemukan!")
        return
    
    logs = await get_bot_logs(bot_token, limit)
    
    if not logs:
        await event.respond(f"📭 Tidak ada log untuk bot @{bot_username}")
        return
    
    text = f"📋 **Log Bot @{bot_username}** (last {len(logs)})\n\n"
    for log_item in reversed(logs):
        emoji = "ℹ️" if log_item['level'] == "INFO" else "⚠️" if log_item['level'] == "WARNING" else "❌"
        text += f"{emoji} {log_item['timestamp'][11:19]} [{log_item['level']}] {log_item['message'][:100]}\n"
    
    if len(text) > 4000:
        text = text[:4000] + "\n\n... (truncated)"
    
    await event.respond(text, parse_mode='markdown')


@bot.on(events.NewMessage(pattern='/stats'))
async def stats_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    stats = await get_master_stats()
    
    text = (
        "📊 **Master Bot Statistics**\n\n"
        f"👥 **Total Users:** {stats.get('total_users', 0)}\n"
        f"🤖 **Total Bots:** {stats.get('total_bots', 0)}\n"
        f"🟢 **Running Bots:** {stats.get('running_bots', 0)}\n"
        f"💰 **Total Revenue:** Rp {stats.get('total_revenue', 0):,}\n"
        f"⭐ **Total Stars Sold:** {stats.get('total_stars', 0):,}\n"
        f"📈 **Total Volume:** {stats.get('total_volume', 0):.2f} TON"
    )
    
    await event.respond(text, parse_mode='markdown')


@bot.on(events.NewMessage(pattern='/ownerstats'))
async def owner_stats_handler(event):
    user_id = event.sender_id
    
    if not await is_owner(user_id):
        await event.respond("❌ Akses ditolak!")
        return
    
    parts = event.message.text.split()
    if len(parts) < 2:
        await event.respond("❌ Gunakan: `/ownerstats <username>`")
        return
    
    username = parts[1]
    
    import sqlite3
    from fragment.database.data import DB_PATH
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM panel_users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        await event.respond(f"❌ User {username} tidak ditemukan!")
        return
    
    stats = await get_owner_stats(row[0])
    user_info = await get_panel_user(row[0])
    
    text = (
        f"📊 **Statistik Owner: {username}**\n\n"
        f"👤 **Nama:** {user_info.get('owner_name', '-') if user_info else '-'}\n"
        f"💰 **Saldo:** {user_info.get('balance', 0) if user_info else 0:,}\n"
        f"📅 **Expired:** {user_info.get('expires_at', '-')[:10] if user_info else '-'}\n\n"
        f"🤖 **Total Bot:** {stats.get('total_bots', 0)}\n"
        f"🟢 **Running Bot:** {stats.get('running_bots', 0)}\n"
        f"⭐ **Stars Terjual:** {stats.get('total_stars', 0):,}\n"
        f"📈 **Volume:** {stats.get('total_volume', 0):.2f} TON\n"
        f"💰 **Total Deposit:** Rp {stats.get('total_deposits', 0):,}"
    )
    
    await event.respond(text, parse_mode='markdown')

@bot.on(events.NewMessage)
async def sticker_to_file_handler(event):
    """Menerima sticker dan mengirim balik sebagai file .tgs"""
    
    if not event.sticker:
        return
    
    sticker = event.sticker
    
    # Cek apakah animated sticker dari mime_type
    mime_type = getattr(sticker, 'mime_type', '')
    is_animated = mime_type == 'application/x-tgsticker'
    
    if not is_animated:
        await event.reply("❌ Kirimkan animated sticker (.tgs) yang bergerak!")
        return
    
    # Kirim pesan proses
    progress_msg = await event.reply("⏳ **Mengunduh sticker...**")
    
    try:
        # Dapatkan dimensi dari atribut
        width = getattr(sticker, 'width', 512)
        height = getattr(sticker, 'height', 512)
        
        # Dapatkan emoji dari attributes
        emoji = '-'
        for attr in getattr(sticker, 'attributes', []):
            if isinstance(attr, DocumentAttributeSticker):
                emoji = getattr(attr, 'alt', '-') or '-'
                break
        
        # Buat file temporary
        with tempfile.NamedTemporaryFile(suffix='.tgs', delete=False) as tmp_file:
            temp_path = tmp_file.name
        
        # Download sticker ke file temporary
        await event.client.download_media(sticker, temp_path)
        
        # Cek ukuran file
        file_size = os.path.getsize(temp_path)
        
        # Nama file
        safe_emoji = emoji.replace('/', '_').replace('\\', '_') if emoji else 'sticker'
        file_name = f"sticker_{sticker.id}_{safe_emoji}.tgs"
        
        # Kirim sebagai file dokumen
        await event.reply(
            file=temp_path,
            caption=(
                f"✅ **Sticker .tgs**\n\n"
                f"📏 Resolusi: {width}x{height}\n"
                f"😀 Emoji: {emoji}\n"
                f"📦 Ukuran: {file_size:,} bytes ({file_size/1024:.1f} KB)\n"
                f"🆔 File ID: `{sticker.id}`\n\n"
                f"📎 **File:** `{file_name}`"
            ),
            attributes=[
                DocumentAttributeFilename(file_name)
            ]
        )
        
        # Hapus file temporary
        os.unlink(temp_path)
        await progress_msg.delete()
        
    except Exception as e:
        await progress_msg.edit(f"❌ Error: {str(e)[:200]}")
        logger.error(f"Error processing sticker: {e}")


@bot.on(events.NewMessage(pattern='/tgs'))
async def tgs_command_handler(event):
    """Command /tgs - reply ke sticker untuk dapat file"""
    
    reply_msg = await event.get_reply_message()
    
    if not reply_msg or not reply_msg.sticker:
        await event.reply("❌ **Gunakan:** `/tgs` sebagai reply ke animated sticker!\n\nCara: reply sticker animated lalu ketik /tgs")
        return
    
    sticker = reply_msg.sticker
    
    # Cek animated sticker
    mime_type = getattr(sticker, 'mime_type', '')
    is_animated = mime_type == 'application/x-tgsticker'
    
    if not is_animated:
        await event.reply("❌ Hanya animated sticker (.tgs) yang didukung!")
        return
    
    progress_msg = await event.reply("⏳ **Mengunduh sticker...**")
    
    try:
        # Dapatkan dimensi
        width = getattr(sticker, 'width', 512)
        height = getattr(sticker, 'height', 512)
        
        # Dapatkan emoji
        emoji = '-'
        for attr in getattr(sticker, 'attributes', []):
            if isinstance(attr, DocumentAttributeSticker):
                emoji = getattr(attr, 'alt', '-') or '-'
                break
        
        # Download ke temporary file
        with tempfile.NamedTemporaryFile(suffix='.tgs', delete=False) as tmp_file:
            temp_path = tmp_file.name
        
        await event.client.download_media(sticker, temp_path)
        
        file_size = os.path.getsize(temp_path)
        safe_emoji = emoji.replace('/', '_').replace('\\', '_') if emoji else 'sticker'
        file_name = f"sticker_{sticker.id}_{safe_emoji}.tgs"
        
        # Kirim sebagai file
        await event.reply(
            file=temp_path,
            caption=(
                f"✅ **File .tgs Sticker**\n\n"
                f"📏 Resolusi: {width}x{height}\n"
                f"😀 Emoji: {emoji}\n"
                f"📦 Ukuran: {file_size:,} bytes ({file_size/1024:.1f} KB)\n"
                f"🆔 File ID: `{sticker.id}`\n\n"
                f"📎 **Download:** `{file_name}`"
            ),
            attributes=[
                DocumentAttributeFilename(file_name)
            ]
        )
        
        os.unlink(temp_path)
        await progress_msg.delete()
        
    except Exception as e:
        await progress_msg.edit(f"❌ Error: {str(e)[:200]}")
        logger.error(f"Error in /tgs command: {e}")

# ==================== MAIN ====================

async def main():
    logger.info("🚀 Starting Master Bot...")
    
    # Initialize database
    init_database()
    
    # Check if owner account exists, if not create default
    import sqlite3
    from fragment.database.data import DB_PATH
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM panel_users LIMIT 1")
    has_user = cursor.fetchone()
    conn.close()
    
    if not has_user:
        # Create default owner account
        default_username = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
        default_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
        await create_panel_user(default_username, default_password, "Master Owner", "owner@example.com", 365)
        logger.info(f"✅ Default admin created: {default_username} / {default_password}")
    
    # Start master bot
    await bot.start(bot_token=BOT_TOKEN)
    logger.info("✅ Master Bot is running")
    
    # Auto start all running bots
    bots = await get_cloned_bots('running')
    for bot_item in bots:
        await start_cloned_bot(bot_item['bot_token'], bot_item['bot_username'])
    
    await bot.run_until_disconnected()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Master Bot dihentikan")
        # Stop all cloned bots
        for bot_token, proc in running_bots.items():
            if proc.poll() is None:
                proc.terminate()
        running_bots.clear()
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}")