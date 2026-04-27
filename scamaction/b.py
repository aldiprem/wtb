#!/usr/bin/env python3
# bot.py — ScamAction Telegram Bot (Telethon)

#!/usr/bin/env python3
# bot.py — ScamAction Telegram Bot (Telethon)

import asyncio
import re
import sqlite3
from datetime import datetime

# Load environment variables FIRST
from dotenv import load_dotenv
import os

# Cari .env file dari /root/wtb/.env
env_path = '/root/wtb/.env'
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ Loaded .env from {env_path}")
else:
    load_dotenv()
    print("⚠️ .env not found at /root/wtb/.env, using defaults")

from telethon import TelegramClient, events, Button, types, errors
from telethon.extensions.markdown import DEFAULT_DELIMITERS
from telethon.tl.types import (
    MessageEntityBlockquote, MessageEntityCustomEmoji, MessageEntityTextUrl,
    MessageEntityPre, MessageEntitySpoiler, MessageEntityItalic,
    MessageEntityUnderline, MessageEntityCode, MessageEntityStrike, MessageEntityBold,
    ChannelParticipantCreator, ChannelParticipantAdmin
)
from telethon.extensions import markdown
from telethon.tl.functions.channels import JoinChannelRequest
from telethon.errors import (
    UserAlreadyParticipantError,
    FloodWaitError,
    PhoneNumberInvalidError,
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    SessionPasswordNeededError,
    PasswordHashInvalidError,
    RPCError
)

# ─── Config ───────────────────────────────────────────────────────────────────

API_ID       = int(os.getenv('API_ID', ""))
API_HASH     = os.getenv('API_HASH', "")
BOT_TOKEN    = os.getenv('SCAM_TOKEN', os.getenv('BOT_TOKEN', ""))
PHONE_NUMBER = os.getenv('PHONE_NUMBER', "")
OWNER_ID     = int(os.getenv('OWNER_ID', 7998861975))
CHANNEL_INFO = int(os.getenv('CHANNEL_INFO', -1002727091820))
GROUP_ADMINS = int(os.getenv('GROUP_ADMINS', -1003871235753))

print(f"\n📱 ScamAction Bot Config:")
print(f"   API_ID: {API_ID}")
print(f"   API_HASH: {API_HASH[:10]}...")
print(f"   BOT_TOKEN: {BOT_TOKEN[:15]}...")
print(f"   OWNER_ID: {OWNER_ID}")
print(f"   GROUP_ADMINS: {GROUP_ADMINS}\n")

# ─── DB imports ───────────────────────────────────────────────────────────────

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.data import (
    add_scan_channel, remove_scan_channel, get_scan_channels, reset_scan_channels,
    save_scanned_id, is_known_scammer, get_scammer_references, extract_telegram_ids,
    add_monitor_channel, get_monitor_channels, get_monitor_channel, toggle_monitor_channel,
    add_monitor_admin, remove_monitor_admin, reset_monitor_admins, get_monitor_admins,
    is_monitor_admin, save_report, mark_report_forwarded, save_monitor_alert, upsert_user,
)

# ─── Clients ──────────────────────────────────────────────────────────────────

DEFAULT_DELIMITERS['^^'] = lambda *a, **k: MessageEntityBlockquote(*a, **k, collapsed=False)

bot  = TelegramClient("scambot",  API_ID, API_HASH).start(bot_token=BOT_TOKEN)
ubot = TelegramClient("scamubot", API_ID, API_HASH)


# ─── Custom parse mode ────────────────────────────────────────────────────────

class AaycoBot:
    @staticmethod
    def parse(text):
        text, entities = markdown.parse(text)
        for i, e in enumerate(entities):
            if isinstance(e, MessageEntityTextUrl):
                url = e.url
                if url.startswith('tg://emoji?id='):
                    entities[i] = MessageEntityCustomEmoji(e.offset, e.length, int(url.split('=')[1]))
                elif url == 'spoiler':
                    entities[i] = types.MessageEntitySpoiler(e.offset, e.length)
                elif url == 'quote':
                    entities[i] = types.MessageEntityBlockquote(e.offset, e.length, collapsed=True)
                elif url == 'italic':
                    entities[i] = types.MessageEntityItalic(e.offset, e.length)
                elif url == 'underline':
                    entities[i] = types.MessageEntityUnderline(e.offset, e.length)
                elif url == 'code':
                    entities[i] = types.MessageEntityCode(e.offset, e.length)
                elif url == 'strike':
                    entities[i] = types.MessageEntityStrike(e.offset, e.length)
                elif url == 'bold':
                    entities[i] = types.MessageEntityBold(e.offset, e.length)
                elif url.startswith('pre:'):
                    entities[i] = MessageEntityPre(e.offset, e.length, url.split(':')[1])
        return text, entities

    @staticmethod
    def unparse(text, entities):
        for i, e in enumerate(entities or []):
            if isinstance(e, MessageEntityCustomEmoji):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, f'tg://emoji?id={e.document_id}')
            elif isinstance(e, types.MessageEntitySpoiler):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, 'spoiler')
            elif isinstance(e, MessageEntityBlockquote):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, 'quote')
            elif isinstance(e, MessageEntityItalic):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, 'italic')
            elif isinstance(e, MessageEntityUnderline):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, 'underline')
            elif isinstance(e, MessageEntityCode):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, 'code')
            elif isinstance(e, MessageEntityStrike):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, 'strike')
            elif isinstance(e, MessageEntityBold):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, 'bold')
            elif isinstance(e, MessageEntityPre):
                entities[i] = MessageEntityTextUrl(e.offset, e.length, f'pre:{e.language}')
        return markdown.unparse(text, entities)


bot.parse_mode = AaycoBot()

# ─── State ────────────────────────────────────────────────────────────────────

user_state: dict = {}          # user_id → state string
report_msgs: dict = {}         # user_id → list of msg_ids (temp)
scan_select: dict = {}         # user_id → set of selected channel_ids
confirm_msg: dict = {}         # user_id → msg_id of last confirm prompt

# ─── Helpers ──────────────────────────────────────────────────────────────────

def is_owner(uid): return uid == OWNER_ID

def can_manage(uid, chat_id):
    return is_owner(uid) or is_monitor_admin(chat_id, uid)

def build_channel_list_text(channels):
    if not channels:
        return "_(belum ada channel)_"
    lines = []
    for c in channels:
        name = c.get('channel_name') or str(c['channel_id'])
        un   = f" @{c['username']}" if c.get('username') else ""
        lines.append(f"• `{c['channel_id']}` — **{name}**{un}")
    return "\n".join(lines)


# ─── /start ───────────────────────────────────────────────────────────────────

@bot.on(events.NewMessage(pattern="^/start$"))
async def start(event):
    user = await event.get_sender()
    uid  = user.id
    fn   = (user.first_name or "") + " " + (user.last_name or "")
    upsert_user(uid, fn.strip(), user.username)

    mention = f"[{fn.strip()}](tg://user?id={uid})"
    msg = (
        f"[🥷](tg://emoji?id=4972331312716186702) **Selamat datang {mention}!**\n\n"
        "__Bot ini berfungsi untuk mengatur dan mengirim laporan penipu, "
        "serta memantau penipu di channel/group Anda.__\n\n"
        "Silakan pilih menu di bawah:"
    )
    buttons = [
        [Button.inline("✍ Lapor Penipuan", data="lapor")],
        [Button.inline("🖥 Monitor", data="monitor"),
         Button.inline("🔍 Scan Channel", data="scan_menu")],
        [Button.inline("📊 Statistik", data="stats")],
    ]
    await event.respond(msg, buttons=buttons)

# ─── /scan command ────────────────────────────────────────────────────────────

@bot.on(events.NewMessage(pattern="^/scan$"))
async def cmd_scan(event):
    if not is_owner(event.sender_id): 
        return
    
    channels = get_scan_channels()
    if not channels:
        await event.reply("❌ Belum ada channel yang tersimpan. Tambah dengan `+ch <id>`")
        return

    scan_select[event.sender_id] = set()
    text = "🔍 **Pilih channel yang ingin di-scan:**\n_(klik untuk select, ✅ = dipilih)_\n\n"
    text += build_channel_list_text(channels)

    await event.reply(text, buttons=_build_scan_buttons(channels, set()))

def _build_scan_buttons(channels, selected):
    rows = []
    row = []
    for i, ch in enumerate(channels):
        cid = ch['channel_id']
        label = ("✅ " if cid in selected else "") + str(cid)
        row.append(Button.inline(label, data=f"scan_toggle_{cid}"))
        if len(row) == 4:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([
        Button.inline("🔙 Batal", data="main_menu"),
        Button.inline("▶ Mulai Scan", data="scan_confirm"),
    ])
    return rows

@bot.on(events.CallbackQuery(pattern=r"^scan_toggle_(-?\d+)$"))
async def scan_toggle(event):
    if not is_owner(event.sender_id): 
        return
    
    cid = int(event.pattern_match.group(1))
    sel = scan_select.get(event.sender_id, set())
    sel.symmetric_difference_update({cid})
    scan_select[event.sender_id] = sel

    channels = get_scan_channels()
    await event.edit(buttons=_build_scan_buttons(channels, sel))

@bot.on(events.CallbackQuery(pattern="^scan_confirm$"))
async def scan_confirm(event):
    if not is_owner(event.sender_id): 
        return
    
    sel = scan_select.get(event.sender_id, set())
    if not sel:
        await event.answer("⚠ Pilih minimal 1 channel dulu!", alert=True)
        return

    await event.edit("⏳ Scanning sedang berjalan...\n📡 Menggunakan userbot untuk mengambil data...")
    
    total = 0
    stats = []
    
    for cid in sel:
        try:
            # Gunakan ubot (userbot) untuk scan, bukan bot
            ch = await ubot.get_entity(cid)
            cname = getattr(ch, 'title', str(cid))
            
            stats.append(f"\n📡 Scanning **{cname}**...")
            await event.edit("⏳ Scanning sedang berjalan...\n" + "\n".join(stats[-5:]))
            
            async for msg in ubot.iter_messages(cid, limit=None):
                if msg.text:
                    ids = extract_telegram_ids(msg.text)
                    for uid in ids:
                        save_scanned_id(uid, cid, cname, msg.id)
                        total += 1
            
            stats.append(f"✅ {cname}: selesai")
            
        except FloodWaitError as e:
            wait_time = min(e.seconds, 60)
            stats.append(f"⚠️ Rate limit, tunggu {wait_time} detik...")
            await event.edit("⏳ Scanning sedang berjalan...\n" + "\n".join(stats[-5:]))
            await asyncio.sleep(wait_time)
            
        except UserAlreadyParticipantError:
            stats.append(f"⚠️ {cname}: Userbot sudah jadi member")
            
        except Exception as e:
            stats.append(f"❌ {cname}: {str(e)[:50]}")
            print(f"Error scanning {cid}: {e}")

    await event.edit(
        f"✅ **Scan selesai!**\n\n"
        f"**Total ID ditemukan:** `{total}`\n"
        f"**Channel di-scan:** `{len(sel)}`\n\n"
        + "\n".join(stats[-10:]),
        buttons=[[Button.inline("🔙 Menu Utama", data="main_menu")]]
    )

# ─── Monitor (bot ditambah ke group/channel) ──────────────────────────────────

@bot.on(events.ChatAction())
async def on_chat_action(event):
    """Deteksi bot ditambahkan ke group/channel."""
    try:
        chat = await event.get_chat()
        
        # Jika channel / broadcast, skip
        if getattr(chat, "broadcast", False):
            print(f"[DEBUG] Chat {chat.id} is broadcast, skipping")
            return
        
        # Ambil chat_id
        chat_id = event.chat_id
        me = await bot.get_me()
        bot_id = me.id
        
        print(f"[DEBUG] on_chat_action: chat_id={chat_id}, bot_id={bot_id}")
        print(f"[DEBUG] event.user_added={event.user_added}, event.user_id={event.user_id}")
        
        # Cek apakah bot ditambahkan
        if event.user_added and event.user_id == bot_id:
            # Dapatkan siapa yang menambahkan bot
            adder = event.sender_id if event.sender_id else OWNER_ID
            
            cid = chat.id
            cname = getattr(chat, 'title', str(cid))
            cun = getattr(chat, 'username', '') or ''
            
            print(f"[DEBUG] Bot added to {cname} ({cid}) by {adder}")
            
            # Simpan ke database
            add_monitor_channel(cid, cname, cun, adder)
            
            # Kirim notifikasi ke user yang menambahkan
            try:
                await bot.send_message(
                    adder,
                    f"[🖥](tg://emoji?id=5197264711437389632) **Bot ditambahkan ke {cname}**\n\n"
                    f"ID: `{cid}`\n"
                    f"Username: @{cun if cun else '-'}\n\n"
                    f"Monitor telah diaktifkan. Gunakan tombol **Monitor** di /start untuk mengaturnya."
                )
                print(f"[DEBUG] Notification sent to {adder}")
            except Exception as e:
                print(f"[ERROR] Failed to send notification to {adder}: {e}")
            
            # Kirim juga ke owner
            try:
                await bot.send_message(
                    OWNER_ID,
                    f"[🤖] Bot ditambahkan ke **{cname}** (`{cid}`)\nDitambahkan oleh: `{adder}`"
                )
            except Exception as e:
                print(f"[ERROR] Failed to notify owner: {e}")
                
    except Exception as e:
        print(f"[ERROR] on_chat_action: {e}")
        import traceback
        traceback.print_exc()

@bot.on(events.ChatAction())
async def on_new_member(event):
    """Saat ada user baru bergabung ke channel/group yang di-monitor."""
    try:
        # Debug print
        print(f"[DEBUG] on_new_member triggered")
        print(f"[DEBUG] event.user_added={event.user_added}, event.user_joined={event.user_joined}")
        
        if not (event.user_added or event.user_joined):
            return
        
        chat = await event.get_chat()
        cid = chat.id
        
        print(f"[DEBUG] Chat ID: {cid}, Chat Title: {getattr(chat, 'title', 'Unknown')}")
        
        # Cek apakah channel ini di-monitor
        ch_data = get_monitor_channel(cid)
        print(f"[DEBUG] Monitor channel data: {ch_data}")
        
        if not ch_data:
            print(f"[DEBUG] Channel {cid} not in monitor list")
            return
        
        if not ch_data.get('is_active'):
            print(f"[DEBUG] Monitor for {cid} is inactive")
            return
        
        me = await bot.get_me()
        bot_id = me.id
        
        # Dapatkan daftar user yang bergabung
        users = event.users if hasattr(event, 'users') else []
        print(f"[DEBUG] Users joined: {[u.id for u in users if u]}")
        
        for user in users:
            if not user or user.id == bot_id:
                continue
            
            print(f"[DEBUG] Checking user {user.id} - is_scammer: {is_known_scammer(user.id)}")
                        
            if is_known_scammer(user.id):
                refs = get_scammer_references(user.id)
                save_monitor_alert(user.id, cid, ch_data['chat_name'])
                
                lines = []
                for r in refs:
                    channel_id_str = str(r['channel_id'])
                    if channel_id_str.startswith('-100'):
                        channel_id_str = channel_id_str[4:]
                    ch_link = f"https://t.me/c/{channel_id_str}/{r['msg_id']}"
                    lines.append(f"• [{r['channel_name']} — pesan #{r['msg_id']}]({ch_link})")
                
                # Ubah pesan dari "PENIPU" menjadi informasi
                msg = f"""📋 **INFORMASI USER ID TERDAFTAR**

            User ID: `{user.id}` bergabung ke **{ch_data['chat_name']}**

            **ID ini ditemukan di laporan:**
            {chr(10).join(lines) if lines else '_Tidak ada referensi_'}

            *Data ini berdasarkan laporan yang masuk ke sistem.*"""
                
                # Kirim notifikasi
                notif_targets = {ch_data['added_by']}
                for adm in get_monitor_admins(cid):
                    notif_targets.add(adm['user_id'])
                notif_targets.add(OWNER_ID)
                
                for target in notif_targets:
                    try:
                        await bot.send_message(target, msg, link_preview=False)
                    except Exception:
                        pass
                        
    except Exception as e:
        print(f"[ERROR] on_new_member: {e}")
        import traceback
        traceback.print_exc()

@bot.on(events.CallbackQuery(pattern="^monitor$"))
async def cb_monitor(event):
    uid = event.sender_id
    
    print(f"[DEBUG] cb_monitor called by user {uid}")
    
    # Ambil semua channel yang di-monitor (tanpa filter added_by)
    # Karena user bisa menjadi admin juga
    channels = get_monitor_channels(None)  # Ambil semua
    
    print(f"[DEBUG] All monitor channels: {channels}")
    
    # Filter channel yang user memiliki akses (sebagai admin atau owner)
    user_channels = []
    for ch in channels:
        if is_owner(uid) or is_monitor_admin(ch['chat_id'], uid) or ch['added_by'] == uid:
            user_channels.append(ch)
    
    print(f"[DEBUG] User accessible channels: {user_channels}")
    
    if not user_channels:
        await event.edit(
            "🖥 **Monitor**\n\n"
            "Belum ada channel/group yang dipantau.\n"
            "Tambahkan bot ke group/channel Anda, atau minta admin untuk menambahkan Anda.",
            buttons=[[Button.inline("🔙 Kembali", data="main_menu")]]
        )
        return
    
    buttons = []
    for c in user_channels:
        status_icon = "🟢" if c['is_active'] else "🔴"
        button_text = f"{status_icon} {c['chat_name']}"
        buttons.append([Button.inline(button_text, data=f"mon_detail_{c['chat_id']}")])
    
    buttons.append([Button.inline("🔙 Kembali", data="main_menu")])
    
    await event.edit("🖥 **Monitor — Pilih Channel/Group:**", buttons=buttons)

@bot.on(events.NewMessage(pattern="^/debug_monitor$"))
async def debug_monitor(event):
    if not is_owner(event.sender_id):
        return
    
    channels = get_monitor_channels(None)
    msg = "📋 **Monitor Channels Debug:**\n\n"
    if not channels:
        msg += "Tidak ada channel yang terdaftar!"
    else:
        for ch in channels:
            msg += f"• ID: `{ch['chat_id']}`\n"
            msg += f"  Name: {ch['chat_name']}\n"
            msg += f"  Active: {ch['is_active']}\n"
            msg += f"  Added By: `{ch['added_by']}`\n"
            msg += f"  Username: @{ch['chat_username'] or '-'}\n\n"
    
    await event.reply(msg)

@bot.on(events.CallbackQuery(pattern=r"^mon_detail_(-?\d+)$"))
async def cb_mon_detail(event):
    cid = int(event.pattern_match.group(1))
    ch  = get_monitor_channel(cid)
    if not ch:
        await event.answer("Channel tidak ditemukan", alert=True)
        return

    admins = get_monitor_admins(cid)
    adm_text = ", ".join(f"`{a['user_id']}`" for a in admins) or "_belum ada_"
    status = "🟢 Aktif" if ch['is_active'] else "🔴 Nonaktif"

    text = (
        f"🖥 **{ch['chat_name']}**\n"
        f"ID: `{ch['chat_id']}`\n"
        f"Username: @{ch['chat_username'] or '-'}\n"
        f"Status: {status}\n"
        f"Ditambah oleh: `{ch['added_by']}`\n"
        f"Admin: {adm_text}"
    )
    toggle_label = "🔴 Nonaktifkan" if ch['is_active'] else "🟢 Aktifkan"
    buttons = [
        [Button.inline(toggle_label, data=f"mon_toggle_{cid}")],
        [Button.inline("🔍 SCAN MEMBERS", data=f"mon_scan_members:{cid}")],  # Tombol baru
        [Button.inline("➕ Add Admin", data=f"mon_addadmin_{cid}"),
         Button.inline("➖ Del Admin", data=f"mon_deladmin_{cid}")],
        [Button.inline("🔄 Reset Admin", data=f"mon_resetadmin_{cid}")],
        [Button.inline("🔙 Kembali", data="monitor")],
    ]
    await event.edit(text, buttons=buttons)

@bot.on(events.CallbackQuery(pattern=r"^mon_scan_members:(-?\d+)$"))
async def mon_scan_members(event):
    """Scan semua anggota group untuk cek di database"""
    cid = int(event.pattern_match.group(1))
    uid = event.sender_id
    
    # Cek permission
    ch_data = get_monitor_channel(cid)
    if not ch_data:
        await event.answer("Channel tidak ditemukan!", alert=True)
        return
    
    if not (is_owner(uid) or is_monitor_admin(cid, uid) or ch_data['added_by'] == uid):
        await event.answer("Anda tidak memiliki akses!", alert=True)
        return
    
    await event.edit("⏳ **Scanning anggota grup...**\n\nMohon tunggu, sedang memeriksa semua anggota...")
    
    try:
        # Dapatkan semua anggota grup
        participants = await bot.get_participants(cid)
        total = len(participants)
        
        found_users = []
        for i, user in enumerate(participants):
            if user.bot:
                continue
            
            if is_known_scammer(user.id):
                refs = get_scammer_references(user.id)
                found_users.append({
                    'id': user.id,
                    'first_name': user.first_name,
                    'username': user.username,
                    'refs': refs
                })
            
            # Update status setiap 50 user
            if i % 50 == 0:
                await event.edit(f"⏳ **Scanning anggota grup...**\n\nProgres: {i}/{total} anggota\nDitemukan: {len(found_users)} ID terdata")
        
        # Kirim hasil scan
        if found_users:
            msg = f"🔍 **HASIL SCAN ANGGOTA GRUP**\n\n"
            msg += f"**Grup:** {ch_data['chat_name']}\n"
            msg += f"**Total anggota:** {total}\n"
            msg += f"**ID terdata di database:** {len(found_users)}\n\n"
            
            for u in found_users[:20]:  # Max 20 hasil
                mention = f"[{u['first_name'] or u['id']}](tg://user?id={u['id']})"
                msg += f"• {mention} (`{u['id']}`)\n"
                for r in u['refs'][:2]:  # Max 2 referensi
                    channel_id_str = str(r['channel_id'])
                    if channel_id_str.startswith('-100'):
                        channel_id_str = channel_id_str[4:]
                    ch_link = f"https://t.me/c/{channel_id_str}/{r['msg_id']}"
                    msg += f"  └ [Ditemukan di {r['channel_name']}]({ch_link})\n"
                msg += "\n"
            
            if len(found_users) > 20:
                msg += f"\n*...dan {len(found_users) - 20} lainnya*"
            
            buttons = [[Button.inline("🔙 KEMBALI", data=f"mon_detail_{cid}")]]
            await event.edit(msg, buttons=buttons, link_preview=False)
        else:
            msg = f"✅ **HASIL SCAN ANGGOTA GRUP**\n\n"
            msg += f"**Grup:** {ch_data['chat_name']}\n"
            msg += f"**Total anggota:** {total}\n"
            msg += f"**ID terdata di database:** 0\n\n"
            msg += "Tidak ada ID yang terdata di database."
            
            buttons = [[Button.inline("🔙 KEMBALI", data=f"mon_detail_{cid}")]]
            await event.edit(msg, buttons=buttons)
            
    except Exception as e:
        await event.edit(f"❌ Error: {str(e)[:200]}")
        print(f"Error scanning members: {e}")

@bot.on(events.CallbackQuery(pattern=r"^mon_toggle_(-?\d+)$"))
async def cb_mon_toggle(event):
    cid = int(event.pattern_match.group(1))
    new = toggle_monitor_channel(cid)
    label = "🟢 Diaktifkan" if new else "🔴 Dinonaktifkan"
    await event.answer(f"Monitor {label}", alert=False)
    await cb_mon_detail.__wrapped__(event) if hasattr(cb_mon_detail, '__wrapped__') else None
    # Refresh detail
    ch  = get_monitor_channel(cid)
    admins = get_monitor_admins(cid)
    adm_text = ", ".join(f"`{a['user_id']}`" for a in admins) or "_belum ada_"
    status = "🟢 Aktif" if ch['is_active'] else "🔴 Nonaktif"
    text = (
        f"🖥 **{ch['chat_name']}**\n"
        f"ID: `{ch['chat_id']}`\n"
        f"Status: {status}\n"
        f"Admin: {adm_text}"
    )
    toggle_label = "🔴 Nonaktifkan" if ch['is_active'] else "🟢 Aktifkan"
    buttons = [
        [Button.inline(toggle_label, data=f"mon_toggle_{cid}")],
        [Button.inline("➕ Add Admin", data=f"mon_addadmin_{cid}"),
         Button.inline("➖ Del Admin", data=f"mon_deladmin_{cid}")],
        [Button.inline("🔄 Reset Admin", data=f"mon_resetadmin_{cid}")],
        [Button.inline("🔙 Kembali", data="monitor")],
    ]
    await event.edit(text, buttons=buttons)


@bot.on(events.CallbackQuery(pattern=r"^mon_addadmin_(-?\d+)$"))
async def cb_mon_addadmin(event):
    cid = int(event.pattern_match.group(1))
    user_state[event.sender_id] = f"mon_addadmin_{cid}"
    await event.edit(
        f"➕ **Tambah Admin Monitor**\n\nKirim **user_id** admin yang ingin ditambahkan:",
        buttons=[[Button.inline("🔙 Batal", data=f"mon_detail_{cid}")]]
    )


@bot.on(events.CallbackQuery(pattern=r"^mon_deladmin_(-?\d+)$"))
async def cb_mon_deladmin(event):
    cid = int(event.pattern_match.group(1))
    user_state[event.sender_id] = f"mon_deladmin_{cid}"
    await event.edit(
        f"➖ **Hapus Admin Monitor**\n\nKirim **user_id** admin yang ingin dihapus:",
        buttons=[[Button.inline("🔙 Batal", data=f"mon_detail_{cid}")]]
    )


@bot.on(events.CallbackQuery(pattern=r"^mon_resetadmin_(-?\d+)$"))
async def cb_mon_resetadmin(event):
    cid = int(event.pattern_match.group(1))
    reset_monitor_admins(cid)
    await event.answer("✅ Semua admin di-reset", alert=False)


# ─── Scan Channel Management (Callback based) ─────────────────────────────────

@bot.on(events.CallbackQuery(pattern="^scan_menu$"))
async def cb_scan_menu(event):
    if not is_owner(event.sender_id):
        await event.answer("⛔ Hanya owner", alert=True)
        return
    
    channels = get_scan_channels()
    text = "🔍 **Manajemen Channel Scan**\n\n"
    
    if channels:
        text += "**Daftar Channel:**\n"
        for ch in channels:
            # Hitung jumlah ID yang discan dari channel ini
            count = get_scanned_count_by_channel(ch['channel_id'])
            text += f"• `{ch['channel_id']}` — **{ch['channel_name']}**\n"
            text += f"  └ 📊 {count} ID tersimpan\n"
    else:
        text += "_Belum ada channel yang tersimpan._"
    
    buttons = [
        [Button.inline("➕ ADD CHANNEL", data="scan:add")],
        [Button.inline("🗑 DELETE CHANNEL", data="scan:delete")],
        [Button.inline("📋 LIST CHANNEL", data="scan:list")],
        [Button.inline("🔙 KEMBALI", data="main_menu")]
    ]
    
    await event.edit(text, buttons=buttons)

@bot.on(events.CallbackQuery(pattern="^scan:add$"))
async def scan_add_channel(event):
    if not is_owner(event.sender_id):
        return
    
    user_state[event.sender_id] = "scan_add_waiting"
    await event.edit(
        "➕ **Tambah Channel Scan**\n\n"
        "Kirim **ID Channel** atau **username channel** yang ingin ditambahkan.\n\n"
        "Contoh: `-1001234567890` atau `@channelusername`",
        buttons=[[Button.inline("🔙 BATAL", data="scan_menu")]]
    )

@bot.on(events.NewMessage)
async def handle_scan_add_input(event):
    uid = event.sender_id
    if user_state.get(uid) != "scan_add_waiting":
        return
    
    if event.raw_text.startswith('/'):
        return
    
    arg = event.raw_text.strip()
    msg = await event.reply("⏳ Memproses...")
    
    try:
        ch = await bot.get_entity(int(arg) if arg.lstrip('-').isdigit() else arg)
        cid = ch.id
        cname = getattr(ch, 'title', str(cid))
        cun = getattr(ch, 'username', '') or ''
        
        add_scan_channel(cid, cname, cun)
        
        # Userbot join ke channel
        try:
            ubot_entity = await ubot.get_entity(int(arg) if arg.lstrip('-').isdigit() else arg)
            await ubot(JoinChannelRequest(ubot_entity))
        except UserAlreadyParticipantError:
            pass
        except Exception as e:
            print(f"Userbot join error: {e}")
        
        await msg.edit(f"✅ Channel **{cname}** (`{cid}`) ditambahkan.")
        await asyncio.sleep(1)
        await cb_scan_menu(event)
        
    except FloodWaitError as e:
        await msg.edit(f"⚠️ Rate limit! Tunggu {e.seconds} detik.")
    except Exception as e:
        await msg.edit(f"❌ Gagal: `{e}`")
    
    user_state.pop(uid, None)

@bot.on(events.CallbackQuery(pattern="^scan:delete$"))
async def scan_delete_channel(event):
    if not is_owner(event.sender_id):
        return
    
    channels = get_scan_channels()
    if not channels:
        await event.answer("Tidak ada channel yang tersimpan!", alert=True)
        await cb_scan_menu(event)
        return
    
    buttons = []
    for ch in channels:
        buttons.append([Button.inline(f"🗑 {ch['channel_name']}", data=f"scan:delete_confirm:{ch['channel_id']}")])
    buttons.append([Button.inline("🔙 BATAL", data="scan_menu")])
    
    await event.edit("🗑 **Pilih channel yang akan dihapus:**", buttons=buttons)

@bot.on(events.CallbackQuery(pattern=r"^scan:delete_confirm:(-?\d+)$"))
async def scan_delete_confirm(event):
    if not is_owner(event.sender_id):
        return
    
    cid = int(event.pattern_match.group(1))
    remove_scan_channel(cid)
    await event.answer("Channel dihapus!", alert=True)
    await cb_scan_menu(event)

@bot.on(events.CallbackQuery(pattern="^scan:list$"))
async def scan_list_channel(event):
    if not is_owner(event.sender_id):
        return
    
    channels = get_scan_channels()
    if not channels:
        await event.answer("Tidak ada channel yang tersimpan!", alert=True)
        await cb_scan_menu(event)
        return
    
    text = "📋 **DETAIL CHANNEL SCAN**\n\n"
    for ch in channels:
        count = get_scanned_count_by_channel(ch['channel_id'])
        text += f"**{ch['channel_name']}**\n"
        text += f"├ ID: `{ch['channel_id']}`\n"
        text += f"├ Username: @{ch['username'] or '-'}\n"
        text += f"└ 📊 ID Tersimpan: {count}\n\n"
    
    buttons = [[Button.inline("🔙 KEMBALI", data="scan_menu")]]
    await event.edit(text, buttons=buttons)

def get_scanned_count_by_channel(channel_id):
    """Mendapatkan jumlah ID yang discan dari channel tertentu"""
    try:
        conn = sqlite3.connect('/root/wtb/scamaction/scamaction.db')
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT COUNT(DISTINCT user_id) as count FROM scanned_ids WHERE channel_id = ?", (channel_id,))
        row = cur.fetchone()
        conn.close()
        return row['count'] if row else 0
    except:
        return 0

@bot.on(events.CallbackQuery(pattern="^scan_start$"))
async def cb_scan_start(event):
    if not is_owner(event.sender_id): return
    channels = get_scan_channels()
    if not channels:
        await event.answer("Belum ada channel!", alert=True)
        return
    scan_select[event.sender_id] = set()
    await event.edit(
        "🔍 **Pilih channel yang ingin di-scan:**",
        buttons=_build_scan_buttons(channels, set())
    )


# ─── Callback: Lapor ─────────────────────────────────────────────────────────

@bot.on(events.CallbackQuery(pattern="^lapor$"))
async def cb_lapor(event):
    uid = event.sender_id
    user_state[uid]  = "laporan"
    report_msgs[uid] = []

    msg = (
        "[✍](tg://emoji?id=5197269100878907942) **__Format Laporan Penipuan__**\n\n"
        "`INFORMASI PENIPUAN\n"
        "— Username + ID penipu: \n"
        "— Username list: \n"
        "— Username detail: Frag / Non-Frag\n"
        "— Kasus jenis: Kecolongan / Di Tipu\n"
        "— Tanggal Kejadian:\n"
        "— Kronologi:`\n\n"
        "__Silakan kirim pesan laporan Anda sekarang. Bisa lebih dari 1 pesan dan menyertakan media.__"
    )
    await event.edit(msg, buttons=[[Button.inline("🔙 Batal", data="main_menu")]])


# ─── Callback: Stats ──────────────────────────────────────────────────────────

@bot.on(events.CallbackQuery(pattern="^stats$"))
async def cb_stats(event):
    from database.data import get_stats
    s = get_stats()
    text = (
        "📊 **Statistik Bot**\n\n"
        f"🔍 Total ID Penipu di DB: `{s['total_scanned_ids']}`\n"
        f"📡 Channel Scan tersimpan: `{s['total_scan_channels']}`\n"
        f"🖥 Monitor aktif: `{s['total_monitor_channels']}`\n"
        f"🚨 Alert terkirim: `{s['total_alerts']}`\n"
        f"📝 Laporan masuk: `{s['total_reports']}`\n"
    )
    await event.edit(text, buttons=[[Button.inline("🔙 Kembali", data="main_menu")]])


# ─── Callback: main_menu ──────────────────────────────────────────────────────

@bot.on(events.CallbackQuery(pattern="^main_menu$"))
async def cb_main_menu(event):
    uid  = event.sender_id
    user_state.pop(uid, None)
    report_msgs.pop(uid, None)
    await event.delete()
    fake = type('E', (), {'respond': event.respond, 'get_sender': event.get_sender})()
    await start(fake)


# ─── Handle pesan biasa (laporan & state) ─────────────────────────────────────

@bot.on(events.NewMessage(func=lambda e: e.is_private and not e.message.text.startswith('/')))
async def handle_message(event):
    uid   = event.sender_id
    state = user_state.get(uid, "")

    # ── Laporan mode ──
    if state == "laporan":
        mid = event.message.id
        report_msgs.setdefault(uid, []).append(mid)

        # Hapus pesan konfirmasi lama
        if uid in confirm_msg:
            try:
                await bot.delete_messages(uid, confirm_msg[uid])
            except Exception:
                pass

        cm = await event.reply(
            "📋 **Pesan laporan diterima.**\nApakah laporan sudah selesai?\n"
            "_(Anda bisa kirim pesan lebih untuk ditambahkan ke laporan)_",
            buttons=[
                [Button.inline("✅ Konfirmasi & Kirim", data="lapor_konfirm")],
                [Button.inline("🔙 Batalkan Laporan", data="main_menu")],
            ]
        )
        confirm_msg[uid] = cm.id
        return

    # ── Admin state: tambah/hapus admin monitor ──
    if state.startswith("mon_addadmin_") or state.startswith("mon_deladmin_"):
        parts = state.split("_")
        action = parts[1]   # addadmin / deladmin
        cid    = int(parts[2])
        try:
            target_uid = int(event.message.text.strip())
        except ValueError:
            await event.reply("❌ Kirim angka user_id yang valid.")
            return

        if action == "addadmin":
            add_monitor_admin(cid, target_uid)
            await event.reply(f"✅ User `{target_uid}` ditambahkan sebagai admin monitor `{cid}`.")
        else:
            remove_monitor_admin(cid, target_uid)
            await event.reply(f"🗑 User `{target_uid}` dihapus dari admin monitor `{cid}`.")

        user_state.pop(uid, None)
        return


# ─── Konfirmasi laporan → forward ke GROUP_ADMINS ─────────────────────────────

@bot.on(events.CallbackQuery(pattern="^lapor_konfirm$"))
async def cb_lapor_konfirm(event):
    uid  = event.sender_id
    mids = report_msgs.get(uid, [])

    if not mids:
        await event.answer("⚠ Tidak ada pesan laporan!", alert=True)
        return

    user_state.pop(uid, None)
    confirm_msg.pop(uid, None)

    # Forward semua pesan ke GROUP_ADMINS
    for mid in mids:
        try:
            await bot.forward_messages(GROUP_ADMINS, mid, uid)
        except Exception as e:
            print(f"Forward error: {e}")

    rid = save_report(uid, mids)
    report_msgs.pop(uid, None)

    await event.edit(
        f"✅ **Laporan #{rid} berhasil dikirim!**\n"
        "Tim admin akan meninjau laporan Anda. Terima kasih.",
        buttons=[[Button.inline("🔙 Menu Utama", data="main_menu")]]
    )


# ─── Run ──────────────────────────────────────────────────────────────────────

async def main():
    await ubot.start(phone=PHONE_NUMBER)
    print("✅ ubot (userbot) started")
    print("✅ bot started")
    await bot.run_until_disconnected()

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        print("\n🛑 Bot ScamAction dihentikan oleh user")
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        loop.close()