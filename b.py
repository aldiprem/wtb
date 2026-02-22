from telethon import TelegramClient, events
import asyncio
from datetime import datetime
from loguru import logger
import re

from config import *
from database import init_db
from ai import AIEngine

# Inisialisasi
logger.add("wtb_bot.log", rotation="10 MB")
init_db()
ai = AIEngine(GEMINI_API_KEY)

# Database pesan yang sudah diproses
processed_wtb = set()
processed_messages = set()  # Untuk cegah double process

class WTBBot:
    def __init__(self):
        self.client = TelegramClient('wtb_session', API_ID, API_HASH)
        self.channels_to_watch = []
        self.me = None  # Akan diisi setelah login
        self.owner_id = OWNER_ID  # Dari config
    
    async def start(self):
        """Mulai bot"""
        await self.client.start(phone=PHONE_NUMBER)
        self.me = await self.client.get_me()
        logger.info(f"✅ Bot started as {self.me.first_name} (ID: {self.me.id})")
        
        # Handler untuk SEMUA PESAN MASUK
        @self.client.on(events.NewMessage)
        async def handle_all_messages(event):
            await self.handle_message(event)
        
        logger.info("🎯 Bot SIAP. Ajari saya dengan chat biasa!")
        await self.send_startup_message()
        await self.client.run_until_disconnected()
    
    async def send_startup_message(self):
        """Kirim pesan siap ke owner"""
        await self.client.send_message(self.owner_id,
            "🤖 **Bot AI Siap Belajar**\n\n"
            f"Owner ID: {self.owner_id}\n"
            f"Bot ID: {self.me.id}\n\n"
            "**Cara menggunakan:**\n"
            "1. Ajari saya dengan chat biasa\n"
            "2. 'pantau channel @nama' untuk tambah channel\n"
            "3. Tanya saya tentang produk yang sudah diajar"
        )
    
    async def handle_message(self, event):
        """Handle semua pesan yang masuk"""
        message = event.message
        
        # CEK 1: Jangan proses pesan dari bot sendiri
        if not message or not message.text:
            return
        
        # CEK 2: Jangan proses pesan dari diri sendiri (outgoing)
        if message.out:
            return
        
        # CEK 3: Cegah duplikasi
        message_key = f"{message.chat_id}_{message.id}"
        if message_key in processed_messages:
            return
        processed_messages.add(message_key)
        
        # Dapatkan info pengirim
        sender = await event.get_sender()
        sender_id = sender.id
        chat = await event.get_chat()
        chat_id = chat.id
        
        # LOG untuk debugging
        logger.info(f"📩 Pesan dari ID: {sender_id} (Owner: {sender_id == self.owner_id}) di chat {chat_id}")
        
        # KALAU DARI OWNER - Mode Belajar & Tanya Jawab
        if sender_id == self.owner_id:
            response = await self.handle_owner_message(message)
            if response:
                await message.reply(response)
        
        # KALAU DARI CHANNEL YANG DIPANTAU - Mode WTB
        elif chat_id in self.channels_to_watch or f"@{chat.username}" in self.channels_to_watch:
            await self.handle_wtb_message(message, chat)
        
        # Selain itu, abaikan
    
    async def handle_owner_message(self, message):
        """Handle pesan dari OWNER (belajar DAN tanya jawab)"""
        text = message.text
        
        # Perintah khusus
        if text.startswith('pantau channel'):
            channel = text.split('@')[-1].strip()
            if channel:
                channel_full = f'@{channel}'
                if channel_full not in self.channels_to_watch:
                    self.channels_to_watch.append(channel_full)
                    return f"✅ Sekarang saya akan pantau {channel_full}"
                else:
                    return f"✅ {channel_full} sudah dipantau"
            return "❌ Format: pantau channel @nama_channel"
        
        # Selain itu, proses dengan AI (mode owner)
        response = ai.process_user_message(text, is_owner=True)
        return response
    
    async def handle_wtb_message(self, message, chat):
        """Handle pesan WTB dari channel yang dipantau"""
        # Cek duplikasi WTB
        if message.id in processed_wtb:
            return
        processed_wtb.add(message.id)
        
        channel_name = chat.username or str(chat.id)
        logger.info(f"📨 WTB di {channel_name}: {message.text[:50]}...")
        
        # Tanya AI: Harus respon?
        decision = ai.should_respond_to_wtb(message.text, channel_name)
        
        if decision.get("should_respond"):
            response_text = ai.generate_response(
                message.text,
                decision["product"],
                channel_name
            )
            
            # Kirim ke COMSET
            try:
                await message.reply(response_text)
                logger.success(f"✅ Respon dikirim: {response_text[:50]}...")
            except Exception as e:
                logger.error(f"Gagal kirim: {e}")
        else:
            logger.info(f"🤐 Diam: {decision.get('reason', 'Tidak cocok')}")

async def main():
    bot = WTBBot()
    await bot.start()

if __name__ == "__main__":
    asyncio.run(main())
