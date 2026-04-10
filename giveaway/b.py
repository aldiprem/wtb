import os
import asyncio
import random
import string
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telethon import TelegramClient, events, Button, types
import sys
import logging
from telethon.tl.functions.messages import GetStickerSetRequest
from telethon.tl.types import InputStickerSetEmojiDefaultStatuses, InputStickerSetPremiumGifts
from telethon.extensions import markdown
from telethon.tl.types import (
    MessageEntityCustomEmoji, 
    MessageEntityTextUrl, 
    MessageEntityPre,
    MessageEntitySpoiler,
    MessageEntityBlockquote,
    MessageEntityItalic,
    MessageEntityUnderline,
    MessageEntityCode,
    MessageEntityStrike,
    MessageEntityBold
)
from telethon.extensions.markdown import DEFAULT_DELIMITERS
from telethon.tl.types import MessageEntityBlockquote
from pathlib import Path
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)
sys.path.append('/root/wtb')
from giveaway.database.giveaway import GiveawayDatabase
import pytz

# Logging seperti fragment_bot.py
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
API_ID = int(os.getenv("API_ID", 0))
API_HASH = os.getenv("API_HASH", "")
BOT_TOKEN = os.getenv("BOT_GIVEAWAY", "")

DEFAULT_DELIMITERS['^^'] = lambda *a, **k: MessageEntityBlockquote(*a, **k, collapsed=False)
user_state = {}

db = GiveawayDatabase()
bot = TelegramClient('giveaway_bot_session', API_ID, API_HASH)

def generate_giveaway_id():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=10))

class AaycoBot:
    @staticmethod
    def parse(text):
        text, entities = markdown.parse(text)
        for i, e in enumerate(entities):
            if ((isinstance(e, MessageEntityTextUrl)) and e.url.startswith('tg://emoji?id=')):
                entities[i] = MessageEntityCustomEmoji(e.offset, e.length, int(e.url.split('=')[1]))
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url == 'spoiler'):
                entities[i] = types.MessageEntitySpoiler(e.offset, e.length)
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url == 'quote'):
                entities[i] = types.MessageEntityBlockquote(e.offset, e.length, collapsed=True)
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url == 'italic'):
                entities[i] = types.MessageEntityItalic(e.offset, e.length)
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url == 'underline'):
                entities[i] = types.MessageEntityUnderline(e.offset, e.length)
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url == 'code'):
                entities[i] = types.MessageEntityCode(e.offset, e.length)
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url == 'strike'):
                entities[i] = types.MessageEntityStrike(e.offset, e.length)
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url == 'bold'):
                entities[i] = types.MessageEntityBold(e.offset, e.length)
            elif ((isinstance(e, MessageEntityTextUrl)) and e.url.startswith('pre:')):
                entities[i] = MessageEntityPre(e.offset, e.length, str(e.url.split(':')[1]))
        return text, entities
    
    @staticmethod
    def unparse(text, entities):
        for i, e in enumerate(entities or []):
            if isinstance(e, MessageEntityCustomEmoji):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, f'tg://emoji?id={e.document_id}')
            elif isinstance(e, types.MessageEntitySpoiler):
                entities[i] = types.MessageEntityTextUrl(e.offset, e.length, 'spoiler')
            elif ((isinstance(e, MessageEntityBlockquote))):
                entities[i] = types.MessageEntityTextUrl(e.offset, e.length, 'quote')
            elif ((isinstance(e, MessageEntityItalic))):
                entities[i] = types.MessageEntityTextUrl(e.offset, e.length, 'italic')
            elif ((isinstance(e, MessageEntityUnderline))):
                entities[i] = types.MessageEntityTextUrl(e.offset, e.length, 'underline')
            elif ((isinstance(e, MessageEntityCode))):
                entities[i] = types.MessageEntityTextUrl(e.offset, e.length, 'code')
            elif ((isinstance(e, MessageEntityStrike))):
                entities[i] = types.MessageEntityTextUrl(e.offset, e.length, 'strike')
            elif ((isinstance(e, MessageEntityBold))):
                entities[i] = types.MessageEntityTextUrl(e.offset, e.length, 'bold')
            elif isinstance(e, MessageEntityPre):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, f'pre:{e.language}')
        return markdown.unparse(text, entities)

# Set parse_mode untuk bot
bot.parse_mode = AaycoBot()

@bot.on(events.NewMessage(pattern="^/start$"))
async def start(event):
    user = await event.get_sender()
    user_id = user.id
    first_name = user.first_name or ""
    last_name = user.last_name or ""
    fullname = f"{first_name} {last_name}".strip()
    
    # Get username
    if user.username:
        username = user.username
    elif getattr(user, "usernames", None):
        username = user.usernames[0].username
    else:
        username = None

    db.save_user(
        user_id=user_id,
        username=username or "",
        first_name=first_name,
        last_name=last_name
    )

    logger.info(f"User {user_id} (@{username}) started the bot")

    user_data = db.get_user(user_id)
    is_admin = user_data.get('is_admin', False) if user_data else False
    
    mention = f"[{fullname}](tg://user?id={user_id})"
    
    msg = f"""
[🥳](tg://emoji?id=5379995095758018461) **Selamat Datang, {mention}!**

__Bot ini adalah bot create giveaway, anda dapat membuat giveaway disini dan dengan fitur-fitur yang sudah di sediakan, Silakan klik tombol dibawah untuk menggunakan fitur-fitur bot.__
    """
    
    buttons = [
        [Button.inline("🎁 Buat Giveaway", data="create_giveaway")],
        [Button.inline("📊 Statistik", data="stats"),
         Button.inline("👤 Profil", data="profil")]
    ]
    
    # Tambahkan button admin jika user adalah admin
    if is_admin:
        buttons.append([Button.inline("⚙️ Admin Panel", data="admin_panel")])
    
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(pattern="^profil$"))
async def profile(event):
    user = await event.get_sender()
    user_id = user.id
    
    # Get user from database
    user_data = db.get_user(user_id)
    
    if user_data:
        first_seen = user_data.get('first_seen', 'Unknown')
        last_seen = user_data.get('last_seen', 'Unknown')
        is_admin = "✅ Ya" if user_data.get('is_admin') else "❌ Tidak"
        
        msg = f"""
👤 **PROFIL ANDA**

**User ID:** `{user_id}`
**Username:** @{user_data.get('username', '-')}
**Nama:** {user_data.get('first_name', '-')} {user_data.get('last_name', '-')}
**Admin:** {is_admin}
**First Seen:** {first_seen}
**Last Seen:** {last_seen}
        """
    else:
        msg = "❌ Data user tidak ditemukan"
    
    buttons = [[Button.inline("🔙 Kembali", data="kembali")]]
    await event.edit(msg, buttons=buttons)

@bot.on(events.CallbackQuery(pattern="^create_giveaway$"))
async def create_giveaway(event):
    user = await event.get_sender()
    user_id = user.id
    first_name = user.first_name or ""
    last_name = user.last_name or ""
    fullname = f"{first_name} {last_name}"
    mention = f"[{fullname}(tg://user?id={user_id})]"

    if user.username:
        username = user.username
    elif getattr(user, "usernames", None):
        username = user.usernames[0].username
    else:
        username = None

    msg = f"""
[🎁](tg://emoji?id=5199749070830197566) **PENGATURAN CREATE GIVEAWAY**

**Pembuat:** {mention} (@{username})
**Chat ID:** 
**Hadiah:** 
**Durasi:** 
**Syarat Link:** 
**Syarat Join:** 
**Captcha:** On/Off
    """

    buttons = [
        [Button.inline("🎁 Hadiah", data="add_hadiah"),
         Button.inline("📡 Chat ID", data="add_chat")],
        [Button.inline("⏳ Durasi", data="add_durasi"),
         Button.inline("🔗 Link", data="add_link")],
        [Button.inline("📨 Syarat", data="add_syarat"),
         Button.inline("🛡 Captcha", data="toggle_captcha")],
        [Button.inline("🔙 Kembali", data="kembali"),
         Button.inline("🔊 Start Giveaway", data="start_giveaway")]
    ]

    await event.delete()
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(pattern="^kembali$"))
async def kembali(event):
    user = await event.get_sender()
    user_id = user.id 

    if user_id in user_state:
        del user_state[user_id]

    await event.delete()
    await start(event)

# ==================== MAIN - SAMA PERSIS SEPERTI fragment_bot.py ====================
async def main():
    logger.info("🚀 Starting Giveaway Bot...")
    
    # Initialize database
    db.init_database()
    
    # Start master bot - SAMA PERSIS CARANYA
    await bot.start(bot_token=BOT_TOKEN)
    logger.info("✅ Giveaway Bot is running")

    await bot.run_until_disconnected()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Giveaway Bot dihentikan")
    except Exception as e:
        logger.error(f"❌ Error fatal: {e}")