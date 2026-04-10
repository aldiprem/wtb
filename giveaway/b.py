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
from telethon.tl.types import (
    InputStickerSetEmojiDefaultStatuses, 
    InputStickerSetPremiumGifts,
    KeyboardButtonRequestPeer,
    RequestPeerTypeBroadcast,
    RequestPeerTypeChat,
    MessageService
)
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

DEFAULT_DELIMITERS['^^'] = lambda *a, **k: MessageEntityBlockquote(*a, **k)
user_state = {}
user_chats = {}
loading_message = {}
JAKARTA_TZ = pytz.timezone('Asia/Jakarta')

db = GiveawayDatabase()
bot = TelegramClient('giveaway_bot_session', API_ID, API_HASH)

def get_jakarta_time() -> datetime:
    """Get current time in Asia/Jakarta timezone"""
    return datetime.now(JAKARTA_TZ)

def format_jakarta_time(dt: datetime) -> str:
    """Format datetime to readable string with WIB"""
    return dt.strftime('%d %B %Y %H:%M:%S WIB')

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

bot.parse_mode = AaycoBot()

async def check_bot_access(chat_id: int) -> tuple:
    """
    Check if bot has access to the chat and if user is admin
    Returns: (has_access, is_admin, error_message)
    """
    try:
        # Coba get entity untuk cek akses
        entity = await bot.get_entity(chat_id)
        
        # Cek apakah bot bisa mengirim pesan
        try:
            await bot.send_message(chat_id, "test")
            # Hapus pesan test
            async for msg in bot.iter_messages(chat_id, limit=1):
                if msg.text == "test":
                    await msg.delete()
                    break
        except Exception as e:
            return False, False, f"Bot tidak memiliki akses mengirim pesan ke chat ini, Dipastikan bot sudah menjadi admin dan setidaknya anda adalah sebagian dari admin atu owner dari chat ID tersebut.**"
        
        # Cek apakah user adalah admin
        try:
            # Coba dapatkan participant info
            from telethon.tl.functions.channels import GetParticipantRequest
            from telethon.tl.types import ChannelParticipantAdmin, ChannelParticipantCreator
            
            participant = await bot(GetParticipantRequest(
                channel=chat_id,
                participant=entity  # Atau bisa pakai user_id
            ))
            
            is_admin = isinstance(participant.participant, (ChannelParticipantAdmin, ChannelParticipantCreator))
            
            if not is_admin:
                return True, False, "Anda bukan admin di chat ini! Bot hanya bisa digunakan oleh admin chat."
            
            return True, True, "OK"
            
        except Exception as e:
            # Mungkin group biasa tanpa channel
            try:
                # Untuk group biasa, coba cek permisson
                from telethon.tl.functions.messages import GetFullChatRequest
                full_chat = await bot(GetFullChatRequest(chat_id=-chat_id))
                
                # Cek admin list
                is_admin = False
                for participant in full_chat.full_chat.participants.participants:
                    if participant.user_id == event.sender_id:
                        is_admin = True
                        break
                
                if not is_admin:
                    return True, False, "Anda bukan admin di group ini! Bot hanya bisa digunakan oleh admin group."
                
                return True, True, "OK"
            except:
                return True, False, "Tidak dapat memverifikasi status admin. Pastikan Anda adalah admin chat ini."
                
    except Exception as e:
        return False, False, f"Bot tidak dapat mengakses chat ini: {str(e)[:100]}"

async def menu_create_giveaway(event, user_id: int = None):
    """Display the create giveaway menu with current data"""
    if user_id is None:
        user_id = event.sender_id
    
    user = await event.client.get_entity(user_id)
    first_name = getattr(user, 'first_name', '') or ""
    last_name = getattr(user, 'last_name', '') or ""
    fullname = f"{first_name} {last_name}".strip()
    mention = f"[{fullname}](tg://user?id={user_id})"
    
    # Get username
    if hasattr(user, 'username') and user.username:
        username = user.username
    elif hasattr(user, 'usernames') and user.usernames:
        username = user.usernames[0].username
    else:
        username = None

    # Kirim pesan loading dengan try-except
    msg_self = None
    try:
        msg_self = await event.respond("[⌛](tg://emoji?id=5386367538735104399) **__Wait...__**", buttons=Button.clear())
    except Exception as e:
        logger.warning(f"Failed to send loading message: {e}")

    # Get data from user_state
    state = user_state.get(user_id, {})
    saved_chats = state.get('saved_chats', [])
    chat_id = state.get('chat_id', '')
    chat_title = state.get('chat_title', '')
    hadiah_list = state.get('hadiah', [])
    durasi = state.get('durasi', '')
    link = state.get('link', '')
    syarat = state.get('syarat', '')
    captcha = state.get('captcha', 'Off')
    
    # Format hadiah dengan nomor urut
    if hadiah_list:
        hadiah_formatted = '\n'.join([f"{i+1}. {h}" for i, h in enumerate(hadiah_list)])
    else:
        hadiah_formatted = '-'
    
    # Tampilkan SEMUA chat yang tersimpan
    if saved_chats:
        chats_display = ""
        for i, chat in enumerate(saved_chats, 1):
            c_title = chat.get('title', '-')
            c_id = chat.get('chat_id', '-')
            chats_display += f"{i}. **{c_title}** (`{c_id}`)\n"
    else:
        chats_display = "-"
    
    msg = f"""
🎁 **PENGATURAN CREATE GIVEAWAY**

**Pembuat:** {mention} (@{username or '-'})
**Hadiah:** 
^^{hadiah_formatted}^^
**Chat ID:**
{chats_display}
**Durasi:** {durasi if durasi else '-'}
**Syarat Link:** 
{link if link else '-'}
**Syarat Join:** {syarat if syarat else '-'}
**Captcha:** {captcha}
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

    if msg_self is not None:
        try:
            await msg_self.delete()
        except Exception as e:
            logger.warning(f"Failed to delete loading message: {e}")
    
    # Kirim pesan menu
    if hasattr(event, 'edit') and callable(getattr(event, 'edit', None)):
        try:
            await event.edit(msg, buttons=buttons)
        except Exception as e:
            logger.warning(f"Failed to edit message: {e}")
            await event.respond(msg, buttons=buttons)
    else:
        await event.respond(msg, buttons=buttons)

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

    if is_admin:
        buttons.append([Button.inline("⚙️ Admin Panel", data="admin_panel")])
    
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(pattern="^profil$"))
async def profile(event):
    user = await event.get_sender()
    user_id = user.id
    
    user_data = db.get_user(user_id)
    
    if user_data:
        first_seen = user_data.get('first_seen', 'Unknown')
        last_seen = user_data.get('last_seen', 'Unknown')
        
        # Format waktu ke Jakarta timezone jika bukan string kosong
        if first_seen and first_seen != 'Unknown':
            try:
                dt = datetime.fromisoformat(first_seen)
                first_seen = dt.astimezone(JAKARTA_TZ).strftime('%d %B %Y %H:%M:%S WIB')
            except:
                pass
                
        if last_seen and last_seen != 'Unknown':
            try:
                dt = datetime.fromisoformat(last_seen)
                last_seen = dt.astimezone(JAKARTA_TZ).strftime('%d %B %Y %H:%M:%S WIB')
            except:
                pass
        
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

    await event.delete()
    await event.respond(msg, buttons=buttons)

@bot.on(events.CallbackQuery(pattern="^create_giveaway$"))
async def create_giveaway(event):
    user = await event.get_sender()
    user_id = user.id

    # JANGAN hapus user_state sepenuhnya, hanya reset action
    if user_id not in user_state:
        user_state[user_id] = {}
    else:
        # Reset hanya action, pertahankan data lain
        user_state[user_id]['action'] = None
        user_state[user_id]['step'] = None
    
    # Pastikan saved_chats tetap ada dari user_chats
    if user_id in user_chats and user_chats[user_id]:
        user_state[user_id]['saved_chats'] = user_chats[user_id]
        # Gunakan chat pertama sebagai default jika belum ada
        if not user_state[user_id].get('chat_id'):
            user_state[user_id]['chat_id'] = user_chats[user_id][0]['chat_id']
            user_state[user_id]['chat_title'] = user_chats[user_id][0].get('title', '')
    
    # Hapus loading message jika ada
    if user_id in loading_message:
        try:
            await bot.delete_messages(user_id, loading_message[user_id])
        except:
            pass
        del loading_message[user_id]

    await menu_create_giveaway(event)

@bot.on(events.CallbackQuery(pattern="^add_link$"))
async def add_link(event):
    user_id = event.sender_id
    
    user_state[user_id] = user_state.get(user_id, {})
    user_state[user_id]['action'] = 'waiting_link'
    user_state[user_id]['step'] = 'input_link'
    
    msg = """
[🔗](tg://emoji?id=5199749070830197566) **PENGATURAN LINK GIVEAWAY**

__Silakan kirim input link yang ingin anda gunakan, gunakan format seperti contoh dibawah ini. Setiap link harus diawali dengan `https://t.me/` atau `t.me/`.__

**Format link yang valid:**
^^- `https://t.me/username`
- `t.me/username`
- `https://t.me/joinchat/xxxxx`
- `https://t.me/usernamebot/MiniApp`^^

**Contoh input multiple link (satu per baris):**
^^`https://t.me/channel1
https://t.me/channel2
t.me/groupmember`^^

[⚠](tg://emoji?id=5314346928660554905) **Catatan:**
- Setiap link harus diawali dengan `https://t.me/` atau `t.me/`
- Pisahkan setiap link dengan baris baru (Enter)

__Klik Batalkan jika ingin dibatalkan.__
"""

    buttons = [
        [Button.inline("❌ Batalkan", data="create_giveaway")]
    ]
    
    await event.delete()
    await event.respond(msg, buttons=buttons)


@bot.on(events.NewMessage)
async def handle_link_input(event):
    user_id = event.sender_id

    # Cek apakah user sedang dalam state waiting_link
    if user_id not in user_state:
        return
    
    state = user_state[user_id]
    if state.get('action') != 'waiting_link':
        return

    # Cek apakah pesan dari user yang sama
    if event.sender_id != user_id:
        return

    # Cek jika pesan adalah command
    if event.raw_text.startswith('/'):
        return

    link_input = event.raw_text.strip()
    
    if not link_input:
        await event.reply("[⚠](tg://emoji?id=5314346928660554905) **Link tidak boleh kosong. Silakan kirim ulang atau klik batalkan.**")
        return
    
    # Pisahkan berdasarkan newline menjadi multiple link
    links = [l.strip() for l in link_input.split('\n') if l.strip()]
    
    # Validasi setiap link
    invalid_links = []
    valid_links = []
    
    for link in links:
        if GiveawayDatabase.validate_link(link):
            valid_links.append(link)
        else:
            invalid_links.append(link)
    
    if invalid_links:
        invalid_msg = "\n".join(invalid_links[:5])
        await event.reply(f"[⚠](tg://emoji?id=5314346928660554905) **Format link tidak valid!**\n\nLink berikut tidak valid:\n{invalid_msg}\n\nLink harus diawali dengan `https://t.me/` atau `t.me/`")
        return
    
    if not valid_links:
        await event.reply("[⚠](tg://emoji?id=5314346928660554905) **Tidak ada link yang valid!**\n\nPastikan setiap link diawali dengan `https://t.me/` atau `t.me/`")
        return
    
    # Format link untuk disimpan (satu per baris)
    formatted_links = '\n'.join(valid_links)
    
    # Simpan ke user_state
    user_state[user_id]['link'] = formatted_links
    user_state[user_id]['action'] = None
    user_state[user_id]['step'] = None
    
    # Kirim notifikasi sukses
    links_count = len(valid_links)
    msg_self = await event.reply(f"[✅](tg://emoji?id=5262880537416054812) **{links_count} link berhasil disimpan!**")
    
    # Hapus pesan input user
    try:
        await event.delete()
    except:
        pass
    
    # Buat FakeEvent untuk refresh menu
    class FakeEvent:
        def __init__(self, uid, b):
            self.sender_id = uid
            self.client = b
            self.chat_id = uid
        
        async def edit(self, text, buttons=None):
            await self.client.send_message(self.sender_id, text, buttons=buttons)
        
        async def respond(self, text, buttons=None):
            await self.client.send_message(self.sender_id, text, buttons=buttons)
    
    fake_event = FakeEvent(user_id, bot)
    
    # Panggil menu_create_giveaway
    await menu_create_giveaway(fake_event, user_id)
    
    # Hapus notifikasi setelah 3 detik
    await asyncio.sleep(3)
    await msg_self.delete()

@bot.on(events.CallbackQuery(pattern="^add_durasi$"))
async def add_durasi(event):
    user_id = event.sender_id
    
    user_state[user_id] = user_state.get(user_id, {})
    user_state[user_id]['action'] = 'waiting_durasi'
    user_state[user_id]['step'] = 'input_durasi'

    msg = """

    """

    msg = """
[⏳](tg://emoji?id=5451732530048802485) **PENGATURAN DURASI GIVEAWAY**

__Silakan kirim input durasi yang ingin anda menggunakan format deadline / countdown seperti contoh dibawah ini.__

**Format 1 (Durasi Relatif):**
^^Contoh: `1 jam`, `2 jam 30 menit`, `3 hari`, `1 minggu`, `2 bulan`^^
**Format 2 (Tanggal & Waktu):**
^^Contoh: `11.04.2026 11:00`^^

__Klik Batalkan jika ingin dibatalkan.__
"""

    buttons = [
        [Button.inline("❌ Batalkan", data="create_giveaway")]
    ]
    
    await event.delete()
    await event.respond(msg, buttons=buttons)


@bot.on(events.NewMessage)
async def handle_durasi_input(event):
    user_id = event.sender_id

    # Cek apakah user sedang dalam state waiting_durasi
    if user_id not in user_state:
        return
    
    state = user_state[user_id]
    if state.get('action') != 'waiting_durasi':
        return

    # Cek apakah pesan dari user yang sama
    if event.sender_id != user_id:
        return

    # Cek jika pesan adalah command
    if event.raw_text.startswith('/'):
        return

    durasi_input = event.raw_text.strip()
    
    if not durasi_input:
        await event.reply("[⚠](tg://emoji?id=5314346928660554905) **__Durasi tidak boleh kosong. Silakan kirim ulang atau klik batalkan.__**")
        return
    
    now = get_jakarta_time()
    end_time = None
    durasi_text = ""
    minutes = 0
    
    # Coba parse sebagai format tanggal (opsi 2)
    import re
    date_pattern = r'^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$'
    date_match = re.match(date_pattern, durasi_input)
    
    if date_match:
        # Format: DD.MM.YYYY HH:MM
        day = int(date_match.group(1))
        month = int(date_match.group(2))
        year = int(date_match.group(3))
        hour = int(date_match.group(4))
        minute = int(date_match.group(5))
        
        try:
            # Buat datetime dengan timezone Jakarta
            end_time = JAKARTA_TZ.localize(datetime(year, month, day, hour, minute))
            
            # Validasi tidak boleh waktu yang sudah lalu
            if end_time <= now:
                await event.reply("[⚠](tg://emoji?id=5314346928660554905) Waktu tidak boleh kurang dari atau sama dengan waktu sekarang! Silakan kirim ulang.")
                return
            
            # Format durasi teks
            durasi_text = end_time.strftime('%d.%m.%Y %H:%M WIB')
            
        except ValueError as e:
            await event.reply(f"[⚠](tg://emoji?id=5314346928660554905) Tanggal tidak valid: {e}. Silakan kirim ulang.")
            return
    else:
        # Coba parse sebagai durasi relatif (opsi 1)
        minutes = GiveawayDatabase.parse_duration_text(durasi_input)

        
        if minutes <= 0:
            await event.reply("[⚠](tg://emoji?id=5314346928660554905) Format durasi tidak valid. Silakan kirim ulang.\n\nContoh: `1 jam`, `2 jam 30 menit`, `3 hari`")
            return
        
        # Hitung end_time
        end_time = now + timedelta(minutes=minutes)
        durasi_text = durasi_input
    
    # Simpan ke user_state
    user_state[user_id]['durasi_raw'] = durasi_input
    user_state[user_id]['durasi'] = durasi_text
    user_state[user_id]['end_time'] = end_time.isoformat()
    user_state[user_id]['minutes'] = minutes if minutes > 0 else int((end_time - now).total_seconds() / 60)
    user_state[user_id]['action'] = None
    user_state[user_id]['step'] = None
    
    # Kirim notifikasi sukses
    msg_self = await event.reply(f"[✅](tg://emoji?id=5262880537416054812) **Durasi berhasil disimpan: `{end_time.strftime('%d %B %Y %H:%M:%S WIB')}`**")

    try:
        await event.delete()
    except:
        pass
    
    # Buat FakeEvent untuk refresh menu
    class FakeEvent:
        def __init__(self, uid, b):
            self.sender_id = uid
            self.client = b
            self.chat_id = uid
        
        async def edit(self, text, buttons=None):
            await self.client.send_message(self.sender_id, text, buttons=buttons)
        
        async def respond(self, text, buttons=None):
            await self.client.send_message(self.sender_id, text, buttons=buttons)
    
    fake_event = FakeEvent(user_id, bot)

    await menu_create_giveaway(fake_event, user_id)

    await asyncio.sleep(3)
    await msg_self.delete()

@bot.on(events.CallbackQuery(pattern="^add_chat$"))
async def add_chat(event):
    if not event.is_private:
        return await event.answer("Gunakan perintah ini di private chat.", alert=True)
    
    user_id = event.sender_id
    
    # Set state
    if user_id not in user_state:
        user_state[user_id] = {}
    user_state[user_id]['action'] = 'waiting_peer_selection'
    user_state[user_id]['step'] = 'select_chat'
    
    # Create peer buttons for channel and group selection
    peer_buttons = [
        [
            KeyboardButtonRequestPeer(
                text="📢 Select Channel",
                button_id=1,
                peer_type=RequestPeerTypeBroadcast(),
                max_quantity=1
            ),
            KeyboardButtonRequestPeer(
                text="💬 Select Group",
                button_id=2,
                peer_type=RequestPeerTypeChat(),
                max_quantity=1
            )
        ]
    ]
    
    # Get existing chats from user_chats
    existing_chats = user_chats.get(user_id, [])
    
    # Create inline buttons for managing chats
    inline_buttons = []
    
    if existing_chats:
        inline_buttons.append([Button.inline("🗑 HAPUS SATU", data="delete_chat:one")])
        inline_buttons.append([Button.inline("🗑️ HAPUS SEMUA", data="delete_chat:all")])
    
    inline_buttons.append([Button.inline("✅ SELESAI", data="chat_done"),
                           Button.inline("🔙 KEMBALI", data="create_giveaway")])
    
    msg = """
[📨](tg://emoji?id=5406631276042002796) **TAMBAH CHAT TARGET GIVEAWAY**

[⚠](tg://emoji?id=5474438063637669983) **Syarat Chat yang bisa ditambahkan:**
1. Bot harus menjadi **admin** di chat tersebut
2. Anda harus menjadi **admin** di chat tersebut
3. Bot harus memiliki izin **mengirim pesan**

[📌](tg://emoji?id=5397782960512444700) **Cara menambahkan:**
- Klik tombol "📢 Select Channel" untuk channel
- Klik tombol "💬 Select Group" untuk group
- Pilih chat yang ingin ditambahkan

__Klik SELESAI jika sudah selesai menambahkan.__
"""
    
    # Build reply markup
    peer_markup = bot.build_reply_markup(peer_buttons)
    
    await event.delete()
    
    # Send message with peer buttons
    loading_msg = await event.respond(msg, buttons=peer_markup)
    loading_message[user_id] = loading_msg.id
    
    # Show existing chats
    if existing_chats:
        chats_text = "📋 **Chat yang sudah tersimpan:**\n\n"
        for i, chat in enumerate(existing_chats, 1):
            title = chat.get('title', '-')
            chat_id = chat.get('chat_id', '-')
            chat_type = chat.get('chat_type', '-')
            chats_text += f"{i}. [{chat_type}] {title}\n   `{chat_id}`\n"
        
        await event.respond(chats_text, buttons=inline_buttons)
    else:
        await event.respond("Belum ada chat yang tersimpan. Silakan pilih channel/group di atas.", buttons=inline_buttons)

@bot.on(events.Raw)
async def handle_peer_selection(event):
    """Handle peer selection from keyboard button"""
    if not hasattr(event, 'message') or not isinstance(event.message, MessageService):
        return
    
    msg = event.message
    if not hasattr(msg, 'action') or not msg.action:
        return
    
    # Check if it's a peer selection
    if not hasattr(msg.action, 'button_id'):
        return
    
    # Get user_id from message
    if hasattr(msg.peer_id, 'user_id'):
        user_id = msg.peer_id.user_id
    else:
        return
    
    # Check if user is in waiting state
    if user_id not in user_state or user_state[user_id].get('action') != 'waiting_peer_selection':
        return
    
    # Get the peer from action
    if not hasattr(msg.action, 'peers') or not msg.action.peers:
        return
    
    peer = msg.action.peers[0]
    button_id = msg.action.button_id
    
    # Determine chat type and ID
    chat_id = None
    chat_type = "Unknown"
    username = None
    title = None
    
    try:
        if hasattr(peer, 'channel_id'):
            # Channel
            chat_id = f"-100{peer.channel_id}"
            chat_type = "Channel"
        elif hasattr(peer, 'chat_id'):
            # Group
            chat_id = str(-peer.chat_id) if peer.chat_id > 0 else str(peer.chat_id)
            chat_type = "Group"
        else:
            return
        
        # Get entity for more info
        try:
            entity = await bot.get_entity(int(chat_id))
            username = getattr(entity, 'username', None)
            title = getattr(entity, 'title', None)
            if hasattr(entity, 'megagroup') and entity.megagroup:
                chat_type = "Supergroup"
        except:
            pass
        
        # ========== CEK AKSES BOT DAN ADMIN ==========
        # Cek akses bot
        try:
            test_msg = await bot.send_message(int(chat_id), "✅ Bot sedang melakukan pengecekan akses...")
            await test_msg.delete()
            bot_has_access = True
        except Exception as e:
            bot_has_access = False
            error_msg = f"**Bot tidak memiliki akses ke chat ini. Pastikan bot sudah menjadi admin di chat.**"
            await bot.send_message(user_id, f"❌ **Gagal Menambahkan Chat!**\n\n{error_msg}")
            # Delete the service message
            try:
                await bot.delete_messages(msg.chat_id, msg.id)
            except:
                pass
            return
        
        # Cek apakah user adalah admin
        is_admin = False
        try:
            from telethon.tl.functions.channels import GetParticipantRequest
            from telethon.tl.types import ChannelParticipantAdmin, ChannelParticipantCreator
            
            participant = await bot(GetParticipantRequest(
                channel=int(chat_id),
                participant=user_id
            ))
            
            is_admin = isinstance(participant.participant, (ChannelParticipantAdmin, ChannelParticipantCreator))
            
        except Exception as e:
            # Coba cek untuk group biasa
            try:
                from telethon.tl.functions.messages import GetFullChatRequest
                full_chat = await bot(GetFullChatRequest(chat_id=-int(chat_id)))
                for participant in full_chat.full_chat.participants.participants:
                    if participant.user_id == user_id:
                        is_admin = True
                        break
            except:
                is_admin = False
        
        if not is_admin:
            error_msg = "Anda bukan admin di chat ini! Bot hanya bisa digunakan oleh admin chat."
            await bot.send_message(user_id, f"❌ **Gagal Menambahkan Chat!**\n\n{error_msg}")
            # Delete the service message
            try:
                await bot.delete_messages(msg.chat_id, msg.id)
            except:
                pass
            return
        
        # ========== LANJUTKAN PENYIMPANAN ==========
        # Get existing chats from user_chats
        existing_chats = user_chats.get(user_id, [])
        already_exists = any(c['chat_id'] == chat_id for c in existing_chats)

        if not already_exists:
            # Add to user_chats
            if user_id not in user_chats:
                user_chats[user_id] = []
            
            user_chats[user_id].append({
                'chat_id': chat_id,
                'chat_type': chat_type,
                'username': username,
                'title': title
            })
            
            # Delete the service message
            try:
                await bot.delete_messages(msg.chat_id, msg.id)
            except:
                pass
            
            # Send success message
            await bot.send_message(
                user_id,
                f"✅ **Berhasil Ditambahkan!**\n\n"
                f"• Tipe: {chat_type}\n"
                f"• ID: `{chat_id}`\n"
                f"• Nama: {title or '-'}\n"
                f"• Username: @{username if username else '-'}\n\n"
                f"✅ Bot memiliki akses\n"
                f"✅ Anda adalah admin"
            )
            
            # Simpan ke user_state untuk ditampilkan di menu
            # Gunakan chat pertama sebagai default
            user_state[user_id]['chat_id'] = chat_id
            user_state[user_id]['chat_title'] = title or ''
            
            # Refresh menu
            class FakeEvent:
                def __init__(self, uid, b):
                    self.sender_id = uid
                    self.client = b
                
                async def edit(self, text, buttons=None):
                    pass
                
                async def respond(self, text, buttons=None):
                    await self.client.send_message(self.sender_id, text, buttons=buttons)
            
            fake_event = FakeEvent(user_id, bot)
        else:
            await bot.send_message(user_id, f"⚠️ Chat `{chat_id}` sudah ada dalam daftar!")
            
    except Exception as e:
        logger.error(f"Error handling peer selection: {e}")
        await bot.send_message(user_id, f"❌ Error: {str(e)[:100]}")

@bot.on(events.CallbackQuery(pattern="^delete_chat:"))
async def delete_chat_handler(event):
    user_id = event.sender_id
    action = event.data.decode().split(':')[1]
    
    existing_chats = user_chats.get(user_id, [])
    
    if not existing_chats:
        await event.answer("Tidak ada chat yang tersimpan!", alert=True)
        return
    
    if action == "one":
        # Build list of chats to delete
        buttons = []
        for i, chat in enumerate(existing_chats, 1):
            title = chat.get('title', '-')
            buttons.append([Button.inline(f"{i}. {title}", data=f"del_chat:{i}")])
        buttons.append([Button.inline("🔙 Kembali", data="add_chat")])
        
        await event.edit("Pilih chat yang akan dihapus:", buttons=buttons)
    
    elif action == "all":
        user_chats[user_id] = []
        user_state[user_id]['chat_id'] = ''
        user_state[user_id]['chat_title'] = ''
        await event.answer("✅ Semua chat telah dihapus!", alert=True)
        await add_chat(event)


@bot.on(events.CallbackQuery(pattern="^del_chat:"))
async def confirm_delete_chat(event):
    user_id = event.sender_id
    index = int(event.data.decode().split(':')[1])
    
    existing_chats = user_chats.get(user_id, [])
    
    if index <= len(existing_chats):
        deleted = existing_chats.pop(index - 1)
        await event.answer(f"✅ Chat {deleted.get('title', '-')} telah dihapus!", alert=True)
        
        # Update default chat jika yang dihapus adalah chat yang sedang dipilih
        if user_state[user_id].get('chat_id') == deleted.get('chat_id'):
            if existing_chats:
                user_state[user_id]['chat_id'] = existing_chats[0]['chat_id']
                user_state[user_id]['chat_title'] = existing_chats[0].get('title', '')
            else:
                user_state[user_id]['chat_id'] = ''
                user_state[user_id]['chat_title'] = ''
    
    await add_chat(event)

@bot.on(events.CallbackQuery(pattern="^chat_done$"))
async def chat_done(event):
    user_id = event.sender_id
    
    # Clear loading message
    if user_id in loading_message:
        try:
            await bot.delete_messages(user_id, loading_message[user_id])
        except:
            pass
        del loading_message[user_id]
    
    # Clear state action
    if user_id not in user_state:
        user_state[user_id] = {}
    
    user_state[user_id]['action'] = None
    user_state[user_id]['step'] = None
    
    # Simpan semua chat yang tersimpan ke state
    all_chats = user_chats.get(user_id, [])
    user_state[user_id]['saved_chats'] = all_chats
    
    if all_chats:
        # Gunakan chat pertama sebagai default
        user_state[user_id]['chat_id'] = all_chats[0]['chat_id']
        user_state[user_id]['chat_title'] = all_chats[0].get('title', '')
    
    # Refresh menu
    await menu_create_giveaway(event, user_id)

@bot.on(events.CallbackQuery(pattern="^add_hadiah$"))
async def add_hadiah(event):
    user_id = event.sender_id
    
    user_state[user_id] = user_state.get(user_id, {})
    user_state[user_id]['action'] = 'waiting_hadiah'
    user_state[user_id]['step'] = 'input_hadiah'
    
    msg = """
[🎁](tg://emoji?id=5199749070830197566) **TAMBAH HADIAH**

__Silakan kirim input text hadiah yang ingin anda gunakan, gunakan contoh format dibawah ini jika ingin menggunakan lebih dari 1 hadiah.__

[🚨](tg://emoji?id=4971975844042900171) **Contoh:**
^^`Plush Pepe
NFT Username
Telegram Premium 1 Bulan
Telegram Premium 1 Tahun`^^

**__Klik Batalkan jika ingin dibatalkan.__**
    """

    buttons = [
        [Button.inline("❌ Batalkan", data="create_giveaway")]
    ]
    
    await event.delete()
    await event.respond(msg, buttons=buttons)

@bot.on(events.NewMessage)
async def handle_hadiah_input(event):
    user_id = event.sender_id

    # Cek apakah user sedang dalam state waiting_hadiah
    if user_id not in user_state:
        return
    
    state = user_state[user_id]
    if state.get('action') != 'waiting_hadiah':
        return

    # Cek apakah pesan dari user yang sama
    if event.sender_id != user_id:
        return

    # Cek jika pesan adalah command (mulai dengan /)
    if event.raw_text.startswith('/'):
        return

    text = event.raw_text.strip()
    
    # Pisahkan berdasarkan newline
    hadiah_list = [h.strip() for h in text.split('\n') if h.strip()]
    
    if not hadiah_list:
        await event.reply("⚠️ Hadiah tidak boleh kosong. Silakan kirim ulang atau klik batalkan")
        return

    # Simpan hadiah ke user_state
    user_state[user_id]['hadiah'] = hadiah_list
    user_state[user_id]['action'] = None
    user_state[user_id]['step'] = None
    
    # Kirim notifikasi sukses
    msg_self = await event.reply("✅ Hadiah berhasil disimpan!")
    
    # Hapus pesan input user
    try:
        await event.delete()
    except:
        pass
    
    # === PERBAIKAN DI SINI ===
    # Buat FakeEvent dengan method respond yang benar
    class FakeEvent:
        def __init__(self, uid, b):
            self.sender_id = uid
            self.client = b
            self.chat_id = uid
        
        async def edit(self, text, buttons=None):
            # Kirim pesan baru karena tidak bisa edit
            await self.client.send_message(self.sender_id, text, buttons=buttons)
        
        async def respond(self, text, buttons=None):
            await self.client.send_message(self.sender_id, text, buttons=buttons)
    
    fake_event = FakeEvent(user_id, bot)
    
    # Panggil menu_create_giveaway
    await menu_create_giveaway(fake_event, user_id)
    
    # Hapus notifikasi setelah 3 detik
    await asyncio.sleep(3)
    await msg_self.delete()

@bot.on(events.CallbackQuery(pattern="^kembali$"))
async def kembali(event):
    user = await event.get_sender()
    user_id = user.id 

    msg_self = None
    try:
        msg_self = await event.respond("[⌛](tg://emoji?id=5386367538735104399) **__Wait...__**", buttons=Button.clear())
    except Exception as e:
        logger.warning(f"Failed to send loading message: {e}")

    if user_id in user_state:
        # Simpan saved_chats yang sudah ada sebelum dihapus
        saved_chats = user_state[user_id].get('saved_chats', [])
        chat_id = user_state[user_id].get('chat_id', '')
        chat_title = user_state[user_id].get('chat_title', '')
        hadiah_list = user_state[user_id].get('hadiah', [])
        durasi = user_state[user_id].get('durasi', '')
        link = user_state[user_id].get('link', '')
        syarat = user_state[user_id].get('syarat', '')
        captcha = user_state[user_id].get('captcha', 'Off')
        
        # Reset state tapi pertahankan data
        user_state[user_id] = {
            'saved_chats': saved_chats,
            'chat_id': chat_id,
            'chat_title': chat_title,
            'hadiah': hadiah_list,
            'durasi': durasi,
            'link': link,
            'syarat': syarat,
            'captcha': captcha
        }

    if user_id in loading_message:
        try:
            await bot.delete_messages(user_id, loading_message[user_id])
        except:
            pass
        del loading_message[user_id]

    await event.delete()
    
    # Hapus pesan loading jika ada
    if msg_self is not None:
        try:
            await msg_self.delete()
        except:
            pass
    
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