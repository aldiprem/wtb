# ============================================================
# TAMBAHAN KE b.py  —  Battle Game Handler
# Salin blok ini ke b.py setelah import dan sebelum fungsi main()
# ============================================================

import asyncio
import aiohttp
from datetime import datetime
from typing import Dict
import logging

logger = logging.getLogger(__name__)

battle_state = {}
battle_timers: Dict[int, Dict[str, datetime]] = {}

BATTLE_STEPS = [
    'prizes',
    'group',
    'deadline',
    'captcha',
    'confirm'
]

# ==================== BATTLE BUTTON HANDLER ====================

async def battle_menu_handler(event):
    """Handle tombol inline 'Battle Game'"""
    user_id = event.sender_id

    # Reset state
    battle_state[user_id] = {
        'step': None,
        'data': {
            'prizes': [],
            'group': None,
            'deadline_minutes': 5,
            'captcha': False
        }
    }

    await event.answer()
    await event.respond(
        "⚔️ **BATTLE GAME** ⚔️\n\n"
        "Pilih menu pengaturan Battle Game:\n\n"
        "Pesan terakhir di grup = pemenang!\n"
        "Jika tidak ada pesan selama batas waktu → winner ditentukan!",
        buttons=[
            [Button.inline("🎁 Edit Hadiah", b'battle_set_prizes')],
            [Button.inline("👥 Group / Comset", b'battle_set_group')],
            [Button.inline("⏱ Deadline (menit)", b'battle_set_deadline')],
            [Button.inline("🛡 Captcha", b'battle_toggle_captcha')],
            [Button.inline("▶️ Mulai Battle", b'battle_start')],
            [Button.inline("❌ Batal", b'battle_cancel')]
        ]
    )

async def battle_set_prizes(event):
    user_id = event.sender_id
    if user_id not in battle_state:
        battle_state[user_id] = {'step': None, 'data': {'prizes': [], 'group': None, 'deadline_minutes': 5, 'captcha': False}}

    battle_state[user_id]['step'] = 'prizes'
    await event.answer()
    await event.respond(
        "🎁 **Masukkan Hadiah Battle**\n\n"
        "Ketik hadiah, satu per baris.\n"
        "Contoh:\n"
        "`Plush Pepe\nNFT Username\nTelegram Premium`\n\n"
        "Jumlah hadiah = jumlah pemenang.",
        parse_mode='markdown'
    )

async def battle_set_group(event):
    user_id = event.sender_id
    if user_id not in battle_state:
        battle_state[user_id] = {'step': None, 'data': {'prizes': [], 'group': None, 'deadline_minutes': 5, 'captcha': False}}

    battle_state[user_id]['step'] = 'group'
    await event.answer()

    # Gunakan KeyboardButtonRequestPeer agar user bisa pilih group langsung
    from telethon.tl.types import KeyboardButtonRequestPeer, RequestPeerTypeChat
    await event.respond(
        "👥 **Pilih Group / Comset Target**\n\n"
        "Ketuk tombol di bawah untuk memilih group, atau ketik username/ID group.\n"
        "Contoh: `@mygroupusername` atau `-1001234567890`",
        buttons=[
            [KeyboardButtonRequestPeer(
                text="📌 Pilih Group",
                button_id=102,
                peer_type=RequestPeerTypeChat(has_username=False, is_forum=None, bot_participant=None, user_admin_rights=None, bot_admin_rights=None),
                max_quantity=1
            )],
            [Button.inline("❌ Batal Pilih", b'battle_menu_back')]
        ]
    )

async def battle_set_deadline(event):
    user_id = event.sender_id
    if user_id not in battle_state:
        battle_state[user_id] = {'step': None, 'data': {'prizes': [], 'group': None, 'deadline_minutes': 5, 'captcha': False}}

    battle_state[user_id]['step'] = 'deadline'
    await event.answer()
    await event.respond(
        "⏱ **Atur Deadline Battle**\n\n"
        "Berapa menit tanpa pesan baru = Battle berakhir?\n\n"
        "Ketik angka menit (1-60):\n"
        "Contoh: `5` (artinya 5 menit tanpa pesan = selesai)",
        parse_mode='markdown'
    )

async def battle_toggle_captcha(event):
    user_id = event.sender_id
    if user_id not in battle_state:
        battle_state[user_id] = {'step': None, 'data': {'prizes': [], 'group': None, 'deadline_minutes': 5, 'captcha': False}}

    current = battle_state[user_id]['data']['captcha']
    battle_state[user_id]['data']['captcha'] = not current
    status = "✅ Aktif" if not current else "❌ Nonaktif"

    await event.answer(f"Captcha sekarang: {status}")
    await event.edit(
        f"🛡 **Captcha:** {status}\n\n"
        "Pilih menu pengaturan Battle Game:",
        buttons=[
            [Button.inline("🎁 Edit Hadiah", b'battle_set_prizes')],
            [Button.inline("👥 Group / Comset", b'battle_set_group')],
            [Button.inline("⏱ Deadline (menit)", b'battle_set_deadline')],
            [Button.inline("🛡 Captcha", b'battle_toggle_captcha')],
            [Button.inline("▶️ Mulai Battle", b'battle_start')],
            [Button.inline("❌ Batal", b'battle_cancel')]
        ]
    )

async def battle_menu_back(event):
    user_id = event.sender_id
    if user_id in battle_state:
        battle_state[user_id]['step'] = None
    await event.answer()
    await show_battle_menu(event, user_id)

async def battle_cancel(event):
    user_id = event.sender_id
    if user_id in battle_state:
        del battle_state[user_id]
    await event.answer("Battle dibatalkan")
    await event.delete()

async def battle_start(event):
    user_id = event.sender_id
    state = battle_state.get(user_id, {})
    data = state.get('data', {})

    prizes = data.get('prizes', [])
    group  = data.get('group')
    deadline = data.get('deadline_minutes', 5)

    if not prizes:
        await event.answer("❌ Hadiah belum diatur!", alert=True)
        return
    if not group:
        await event.answer("❌ Group belum dipilih!", alert=True)
        return

    await event.answer("⏳ Membuat Battle...")

    sender = await event.get_sender()
    payload = {
        'user_id': user_id,
        'username': getattr(sender, 'username', '') or '',
        'first_name': getattr(sender, 'first_name', '') or '',
        'last_name': getattr(sender, 'last_name', '') or '',
        'prizes': prizes,
        'group': group,
        'deadline_minutes': deadline,
        'captcha': data.get('captcha', False)
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                'http://localhost:5050/api/battle/create',
                json=payload
            ) as resp:
                result = await resp.json()

        if result.get('success'):
            battle_code = result['battle_code']
            battle_id   = result['battle_id']

            if user_id in battle_state:
                del battle_state[user_id]

            await event.respond(
                f"✅ **BATTLE BERHASIL DIBUAT!**\n\n"
                f"⚔️ Battle ID: `{battle_id}`\n"
                f"🔑 Battle Code: `{battle_code}`\n"
                f"🎁 Hadiah: {len(prizes)} item\n"
                f"⏱ Deadline: {deadline} menit\n\n"
                f"🔗 **Link MiniApp:**\n"
                f"https://t.me/freebiestbot/giveaway?startapp=battle_{battle_code}"
            )
        else:
            await event.respond(f"❌ Gagal membuat Battle: {result.get('error', 'Unknown error')}")
    except Exception as e:
        await event.respond(f"❌ Error: {str(e)[:200]}")

async def show_battle_menu(event, user_id):
    data = battle_state.get(user_id, {}).get('data', {})
    prizes = data.get('prizes', [])
    group  = data.get('group')
    deadline = data.get('deadline_minutes', 5)
    captcha = data.get('captcha', False)

    summary = (
        f"🎁 Hadiah: {len(prizes)} item\n"
        f"👥 Group: {group['title'] if group else 'Belum dipilih'}\n"
        f"⏱ Deadline: {deadline} menit\n"
        f"🛡 Captcha: {'On' if captcha else 'Off'}"
    )

    await event.respond(
        f"⚔️ **BATTLE GAME**\n\n{summary}\n\nPilih menu:",
        buttons=[
            [Button.inline("🎁 Edit Hadiah", b'battle_set_prizes')],
            [Button.inline("👥 Group / Comset", b'battle_set_group')],
            [Button.inline("⏱ Deadline (menit)", b'battle_set_deadline')],
            [Button.inline("🛡 Captcha", b'battle_toggle_captcha')],
            [Button.inline("▶️ Mulai Battle", b'battle_start')],
            [Button.inline("❌ Batal", b'battle_cancel')]
        ]
    )


# ==================== TEXT HANDLER UNTUK BATTLE STATE ====================

async def handle_battle_text_input(event):
    user_id = event.sender_id
    state = battle_state.get(user_id)
    if not state or not state.get('step'):
        return  # Bukan dalam alur battle

    step = state['step']
    text = event.text.strip()

    if step == 'prizes':
        prizes = [p.strip() for p in text.split('\n') if p.strip()]
        battle_state[user_id]['data']['prizes'] = prizes
        battle_state[user_id]['step'] = None
        await event.respond(
            f"✅ **{len(prizes)} hadiah disimpan:**\n" +
            '\n'.join([f"{i+1}. {p}" for i, p in enumerate(prizes)]) +
            "\n\nKetuk /battle untuk kembali ke menu.",
            buttons=[[Button.inline("🔙 Kembali ke Menu", b'battle_menu_back')]]
        )

    elif step == 'group':
        # User ketik manual
        chat_input = text
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    'http://localhost:5050/api/giveaway/validate-chat',
                    json={'chat_input': chat_input, 'user_id': user_id}
                ) as resp:
                    result = await resp.json()

            if result.get('success') and result.get('has_access'):
                battle_state[user_id]['data']['group'] = {
                    'chat_id': result['chat_id'],
                    'title': result.get('chat_title', chat_input),
                    'username': result.get('username', '')
                }
                battle_state[user_id]['step'] = None
                await event.respond(
                    f"✅ Group **{result.get('chat_title', chat_input)}** dipilih!",
                    buttons=[[Button.inline("🔙 Kembali ke Menu", b'battle_menu_back')]]
                )
            else:
                await event.respond(f"❌ Group tidak ditemukan: {result.get('error', 'Tidak bisa diakses')}")
        except Exception as e:
            await event.respond(f"❌ Error validasi group: {str(e)[:200]}")

    elif step == 'deadline':
        try:
            minutes = int(text)
            if minutes < 1 or minutes > 1440:
                await event.respond("❌ Masukkan angka antara 1-1440 menit")
                return
            battle_state[user_id]['data']['deadline_minutes'] = minutes
            battle_state[user_id]['step'] = None
            await event.respond(
                f"✅ Deadline diatur ke **{minutes} menit**!",
                buttons=[[Button.inline("🔙 Kembali ke Menu", b'battle_menu_back')]]
            )
        except ValueError:
            await event.respond("❌ Masukkan angka yang valid")


# ==================== MONITOR PESAN DI GROUP UNTUK BATTLE ====================

# Simpan {group_id: {battle_id: last_message_time}}
battle_timers: Dict[int, Dict[str, datetime]] = {}

async def monitor_group_messages(event):
    """Pantau pesan di group — jika ada battle aktif, catat pesan"""
    chat_id = event.chat_id
    sender  = await event.get_sender()
    if not sender or getattr(sender, 'bot', False):
        return

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f'http://localhost:5050/api/battle/active-by-group/{abs(chat_id)}'
            ) as resp:
                result = await resp.json()

        battles_in_group = result.get('battles', [])
        if not battles_in_group:
            return

        user_id    = sender.id
        username   = getattr(sender, 'username', '') or ''
        first_name = getattr(sender, 'first_name', '') or ''
        last_name  = getattr(sender, 'last_name', '') or ''
        sent_at    = event.date.isoformat() if event.date else datetime.now().isoformat()

        # Ambil photo url (avatar)
        photo_url = ''
        try:
            photos = await bot.get_profile_photos(sender.id, limit=1)
            if photos:
                from telethon.tl.functions.photos import GetUserPhotosRequest
                photo_url = f"https://t.me/i/userpic/320/{username}.jpg" if username else ''
        except:
            pass

        for battle in battles_in_group:
            battle_id = battle['battle_id']

            # Catat pesan via API
            async with aiohttp.ClientSession() as session:
                await session.post('http://localhost:5050/api/battle/record-message', json={
                    'battle_id': battle_id,
                    'user_id': user_id,
                    'username': username,
                    'first_name': first_name,
                    'last_name': last_name,
                    'photo_url': photo_url,
                    'message_id': event.id,
                    'message_text': event.text[:200] if event.text else '',
                    'sent_at': sent_at
                })

            # Update timer
            if chat_id not in battle_timers:
                battle_timers[chat_id] = {}
            battle_timers[chat_id][battle_id] = datetime.now()

    except Exception as e:
        logger.error(f"[BattleMonitor] Error: {e}")


# ==================== DEADLINE CHECKER UNTUK BATTLE ====================

async def check_battle_deadlines():
    """Cek setiap 30 detik apakah ada battle yang deadlinenya habis"""
    await asyncio.sleep(5)
    while True:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get('http://localhost:5050/api/battle/recent?limit=50') as resp:
                    result = await resp.json()

            for battle in result.get('battles', []):
                if battle['status'] != 'active':
                    continue

                # Cek timer deadline (menit tanpa pesan)
                gid  = None
                bid  = battle.get('battle_id') or battle.get('battle_code')
                # Cari group_id dari state
                for group_id, timers in battle_timers.items():
                    if bid in timers:
                        gid = group_id
                        last_msg_time = timers[bid]
                        deadline_min = battle.get('deadline_minutes', 5)
                        elapsed = (datetime.now() - last_msg_time).total_seconds() / 60

                        if elapsed >= deadline_min:
                            # End battle
                            logger.info(f"[BattleDeadline] Ending battle {bid} after {elapsed:.1f} min silence")
                            async with aiohttp.ClientSession() as session:
                                async with session.post(
                                    f'http://localhost:5050/api/battle/end/{bid}'
                                ) as resp:
                                    end_result = await resp.json()

                            if end_result.get('success') and gid:
                                winners = end_result.get('winners', [])
                                await announce_battle_winners(gid, bid, winners)

                            del battle_timers[group_id][bid]
                        break

        except Exception as e:
            logger.error(f"[BattleDeadlineChecker] Error: {e}")

        await asyncio.sleep(30)


async def announce_battle_winners(group_id: int, battle_id: str, winners: list):
    """Umumkan pemenang battle ke group"""
    if not winners:
        await bot.send_message(group_id, "⚔️ **Battle berakhir!**\nTidak ada pesan — tidak ada pemenang.")
        return

    lines = [f"🏆 **BATTLE BERAKHIR!** 🏆\n"]
    for w in winners:
        name = w.get('first_name', '') + ' ' + (w.get('last_name') or '')
        uname = f"@{w['username']}" if w.get('username') else f"[{name.strip()}](tg://user?id={w['user_id']})"
        lines.append(f"#{w['rank']} {uname} — 🎁 {w['prize']}")

    await bot.send_message(group_id, '\n'.join(lines), link_preview=False)


# ==================== REGISTRASI DI main() ====================
# Di dalam fungsi main(), tambahkan:
#   asyncio.create_task(check_battle_deadlines())
# Dan pastikan battle_bp sudah diregister di app.py:
#   from giveaway.services.battle_service import battle_bp
#   app.register_blueprint(battle_bp, url_prefix='/api/battle')