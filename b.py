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

class WTBBot:
    def __init__(self):
        self.client = TelegramClient('wtb_session', API_ID, API_HASH)
        self.channels_to_watch = []  # KOSONG! Anda akan isi via chat
        
    async def start(self):
        """Mulai bot"""
        await self.client.start(phone=PHONE_NUMBER)
        me = await self.client.get_me()
        logger.info(f"✅ Bot started as {me.first_name}")
        
        # Handler untuk PESAN ANDA (mengajari AI)
        @self.client.on(events.NewMessage(outgoing=True))
        async def handle_my_teaching(event):
            await self.process_teaching(event)
        
        # Handler untuk PESAN WTB (nanti diisi channelnya via chat)
        @self.client.on(events.NewMessage(chats=self.channels_to_watch))
        async def handle_wtb(event):
            await self.process_wtb(event)
        
        logger.info("🎯 Bot SIAP. Ajari saya dengan chat biasa!")
        await self.send_startup_message()
        await self.client.run_until_disconnected()
    
    async def send_startup_message(self):
        """Kirim pesan siap ke diri sendiri"""
        me = await self.client.get_me()
        await self.client.send_message(me.id, 
            "🤖 **Bot AI Siap Belajar**\n\n"
            "Cara menggunakan:\n"
            "1. **Ajari saya** dengan chat biasa\n"
            "   Contoh: 'saya jual diamond ML, harga 86=21k, 172=42k'\n"
            "   Contoh: 'kalau promosi ML pakai gaya santai ya'\n\n"
            "2. **Kasih tau channel yang dipantau**\n"
            "   Ketik: 'pantau channel @nama_channel'\n\n"
            "3. **Kasih aturan**\n"
            "   Contoh: 'kalau ada yang cari ML, balas dengan pricelist'\n"
            "   Contoh: 'jangan panjang-panjang promosinya'\n\n"
            "Saya akan ingat SEMUA yang Anda ajarkan!"
        )
    
    async def process_teaching(self, event):
        """Proses ketika ANDA ngajarin AI"""
        message = event.message
        if not message.text:
            return
        
        # Proses perintah khusus
        if message.text.startswith('pantau channel'):
            # Contoh: "pantau channel @basewib"
            channel = message.text.split('@')[-1].strip()
            if channel and channel not in self.channels_to_watch:
                self.channels_to_watch.append(f'@{channel}')
                await message.reply(f"✅ Sekarang saya akan pantau @{channel}")
                logger.info(f"📡 Mulai pantau @{channel}")
            return
        
        # Selain itu, anggap sebagai teaching
        response = ai.process_user_message(message.text)
        await message.reply(response)
    
    async def process_wtb(self, event):
        """Proses pesan WTB dari channel"""
        message = event.message
        
        # Cegah duplikasi
        if message.id in processed_wtb:
            return
        processed_wtb.add(message.id)
        
        if not message.text:
            return
        
        # Dapatkan info channel
        channel = await event.get_chat()
        channel_name = channel.username or str(channel.id)
        
        logger.info(f"📨 WTB di {channel_name}: {message.text[:50]}...")
        
        # Tanya AI: Harus respon?
        decision = ai.should_respond_to_wtb(message.text, channel_name)
        
        if decision.get("should_respond"):
            # Generate respon
            response_text = ai.generate_response(
                message.text,
                decision["product"],
                channel_name
            )
            
            # Kirim ke COMSET (reply ke pesan)
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
