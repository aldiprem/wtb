import google.generativeai as genai
from database import Session, Conversation, Memory
from datetime import datetime
import json
from loguru import logger

class AIEngine:
    def __init__(self, api_key):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        # System prompt: AI TIDAK TAHU APA-APA
        self.system_prompt = """Anda adalah AI baru lahir yang TIDAK TAHU APA-AP tentang bisnis.

Yang Anda tahu:
- Saya akan mengajari Anda SEMUANYA melalui percakapan
- Setiap percakapan dengan saya akan disimpan sebagai MEMORI
- Saat merespon WTB, Anda HARUS menggunakan memori yang sudah saya ajarkan
- JANGAN PERNAH mengada-ada di luar yang saya ajarkan
- Jika tidak yakin, lebih baik DIAM daripada salah

Anda akan saya ajarkan tentang:
- Produk apa saja yang saya jual
- Harga dan pricelist
- Gaya promosi yang saya suka
- Cara merespon yang benar
- Kapan harus diam

Mulai dengan ingatan kosong."""
        
        self.chat = self.model.start_chat(history=[
            {"role": "user", "parts": [self.system_prompt]},
            {"role": "model", "parts": ["Saya siap belajar. Silakan ajari saya SEMUANYA dari awal."]}
        ])
    
    def process_user_message(self, message_text):
        """
        Proses semua pesan dari Anda (pemilik)
        AI akan menyimpannya sebagai memori
        """
        session = Session()
        
        # Simpan pesan Anda ke database
        user_msg = Conversation(
            role='user',
            message=message_text,
            created_at=datetime.now()
        )
        session.add(user_msg)
        session.flush()  # Dapatkan ID
        
        # AI menganalisis: ini lagi ngajarin apa?
        analysis_prompt = f"""
Pemilik berkata: "{message_text}"

Analisis pesan ini:
1. Apa yang sedang diajarkan? (produk baru / pricelist / gaya promosi / aturan)
2. Ringkas inti ajarannya
3. Kata kunci penting

Format JSON:
{{
    "teaching_type": "product/pricelist/style/rule/other",
    "summary": "ringkasan singkat",
    "keywords": ["kata1", "kata2"]
}}
"""
        try:
            analysis = json.loads(self.model.generate_content(analysis_prompt).text)
            
            # Simpan sebagai memori
            memory = Memory(
                memory_type=analysis['teaching_type'],
                content=f"User: {message_text}\nRingkasan: {analysis['summary']}",
                source_conversation_id=user_msg.id,
                created_at=datetime.now()
            )
            session.add(memory)
            session.commit()
            
            # Generate respons konfirmasi
            response = f"📝 Saya catat: {analysis['summary']}"
            
            # Simpan respons AI
            ai_msg = Conversation(
                role='assistant',
                message=response,
                context=json.dumps({"teaching": analysis['teaching_type']}),
                created_at=datetime.now()
            )
            session.add(ai_msg)
            session.commit()
            
            return response
            
        except Exception as e:
            logger.error(f"Error: {e}")
            return "Maaf, saya gagal memproses. Coba lagi?"
        finally:
            session.close()
    
    def should_respond_to_wtb(self, wtb_message, channel_name):
        """
        Memutuskan apakah perlu respon berdasarkan YANG SUDAH DIAJARKAN
        """
        session = Session()
        
        # Ambil SEMUA memori yang pernah diajarkan
        all_memories = session.query(Memory).order_by(Memory.created_at.desc()).limit(50).all()
        
        # Konteks dari database
        context = {
            "memori_yang_diajarkan": [
                {
                    "type": m.memory_type,
                    "content": m.content
                } for m in all_memories
            ]
        }
        
        prompt = f"""
Pesan WTB dari channel {channel_name}:
"{wtb_message}"

INILAH SATU-SATUNYA PENGETAHUAN SAYA:
{json.dumps(context, indent=2)}

Tugas:
1. Apakah pesan WTB ini sesuai dengan APAPUN yang sudah diajarkan pemilik?
2. Jika sesuai, apa produknya?
3. Jika TIDAK sesuai sama sekali dengan yang diajarkan, jawab should_respond: false

INGAT: Saya TIDAK BOLEH respon jika belum pernah diajarkan!

Format JSON WAJIB:
{{
    "should_respond": true/false,
    "product": "nama produk jika cocok, null jika tidak",
    "reason": "penjelasan singkat"
}}
"""
        try:
            response = self.model.generate_content(prompt)
            result = json.loads(response.text)
            
            if result.get("should_respond"):
                logger.info(f"✅ Akan respon: {result['product']} - {result['reason']}")
            else:
                logger.info(f"❌ Tidak respon: {result.get('reason', 'Belum diajarkan')}")
            
            return result
        except Exception as e:
            logger.error(f"Error: {e}")
            return {"should_respond": False, "reason": "Error, lebih baik diam"}
        finally:
            session.close()
    
    def generate_response(self, wtb_message, product_name, channel_name):
        """
        Generate respons berdasarkan MEMORI yang diajarkan
        """
        session = Session()
        
        # Ambil semua memori terkait produk ini
        memories = session.query(Memory).filter(
            Memory.content.contains(product_name) | 
            Memory.memory_type.in_(['style', 'rule'])
        ).order_by(Memory.created_at.desc()).limit(20).all()
        
        prompt = f"""
Pesan WTB: "{wtb_message}"
Channel: {channel_name}
Produk yang cocok: {product_name}

INILAH YANG PERNAH DIAJARKAN PEMILIK:
{chr(10).join([f"- {m.content}" for m in memories])}

TUGAS:
Buat RESPON PROMOSI dengan aturan WAJIB:
1. HANYA gunakan informasi dari yang diajarkan di atas
2. JANGAN menambahkan informasi baru
3. Gaya bahasa harus seperti yang diajarkan
4. Jika ada pricelist, sertakan
5. JANGAN OOT (Out of Topic)
6. Bahasa santai, seperti orang biasa

RESPON LANGSUNG:
"""
        try:
            response = self.model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error: {e}")
            return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
        finally:
            session.close()
