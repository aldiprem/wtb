import google.generativeai as genai
from database import Session, Conversation, Memory
from datetime import datetime
import json
from loguru import logger
import re

class AIEngine:
    def __init__(self, api_key):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('models/gemini-2.5-flash')
        
        # System prompt: AI TIDAK TAHU APA-APA
        self.system_prompt = """Anda adalah AI asisten pribadi.

Anda memiliki DUA MODE:
1. MODE BELAJAR - Hanya untuk OWNER (pemilik)
2. MODE MENJAWAB - Untuk pelanggan di channel WTB

ATURAN PENTING:
- Jika owner bertanya tentang PRODUK/HARGA, Anda HARUS menjawab dari memori
- Jika owner memberi informasi BARU, Anda HARUS menyimpannya
- JANGAN tanya balik "mau diajarin apa?" kalau owner hanya bertanya
- BEDAKAN antara "mengajar" dan "bertanya"
"""
    
    def process_user_message(self, message_text, is_owner=True):
        """
        Proses pesan dari user (owner atau bukan)
        is_owner: True jika dari owner, False jika dari orang lain
        """
        session = Session()
        
        try:
            # Simpan pesan ke database
            user_msg = Conversation(
                role='user',
                message=message_text,
                created_at=datetime.now()
            )
            session.add(user_msg)
            session.flush()
            
            # CEK DULU: Apakah ini pertanyaan tentang produk yang sudah diajarkan?
            # Ambil semua memori yang ada
            all_memories = session.query(Memory).order_by(Memory.created_at.desc()).limit(50).all()
            
            if all_memories and is_owner:
                # Cek apakah ini pertanyaan (bukan perintah mengajar)
                check_prompt = f"""
Pesan dari OWNER: "{message_text}"

Tugas: Apakah ini PERTANYAAN tentang produk/harga yang SUDAH PERNAH diajarkan?
Atau ini adalah informasi BARU yang harus disimpan?

Memori yang sudah diajarkan:
{chr(10).join([f"- {m.content}" for m in all_memories[:10]])}

Format JSON:
{{
    "is_question": true/false,
    "related_product": "nama produk jika pertanyaan, null jika bukan",
    "reason": "alasan singkat"
}}
"""
                check_response = self.model.generate_content(check_prompt)
                check_result = json.loads(self._extract_json(check_response.text))
                
                # KALAU INI PERTANYAAN, JAWAB LANGSUNG!
                if check_result.get("is_question") and check_result.get("related_product"):
                    # Cari memori terkait produk ini
                    product_memories = [m for m in all_memories if check_result["related_product"].lower() in m.content.lower()]
                    
                    answer_prompt = f"""
Pertanyaan dari OWNER: "{message_text}"
Produk yang ditanyakan: {check_result['related_product']}

Memori terkait:
{chr(10).join([f"- {m.content}" for m in product_memories[:5]])}

Tugas: Jawab pertanyaan owner dengan INFORMASI dari memori di atas.
Gunakan bahasa santai, seperti ngobrol biasa.
Jika ada pricelist, sertakan.

JAWABAN:
"""
                    answer = self.model.generate_content(answer_prompt)
                    answer_text = answer.text.strip()
                    
                    # Simpan percakapan
                    ai_msg = Conversation(
                        role='assistant',
                        message=answer_text,
                        context=json.dumps({"type": "answer_to_owner"}),
                        created_at=datetime.now()
                    )
                    session.add(ai_msg)
                    session.commit()
                    
                    return answer_text
            
            # KALAU BUKAN PERTANYAAN, PROSES SEBAGAI PENGAJARAN
            analysis_prompt = f"""
Pemilik berkata: "{message_text}"

Analisis: Apakah ini informasi BARU yang harus disimpan?
Jika iya, apa yang diajarkan?

Format JSON:
{{
    "is_teaching": true/false,
    "teaching_type": "product/pricelist/style/rule/other",
    "summary": "ringkasan singkat jika teaching true",
    "keywords": ["kata1", "kata2"]
}}
"""
            response = self.model.generate_content(analysis_prompt)
            analysis = json.loads(self._extract_json(response.text))
            
            if analysis.get("is_teaching"):
                # Simpan sebagai memori
                memory = Memory(
                    memory_type=analysis['teaching_type'],
                    content=f"User: {message_text}\nRingkasan: {analysis['summary']}",
                    source_conversation_id=user_msg.id,
                    created_at=datetime.now()
                )
                session.add(memory)
                
                confirmation = f"📝 Saya catat: {analysis['summary']}"
                
                ai_msg = Conversation(
                    role='assistant',
                    message=confirmation,
                    context=json.dumps({"teaching": analysis['teaching_type']}),
                    created_at=datetime.now()
                )
                session.add(ai_msg)
                session.commit()
                
                return confirmation
            else:
                # Bukan teaching, mungkin pertanyaan yang tidak terkait produk
                return "Maaf, saya tidak mengerti. Coba tanya tentang produk yang sudah diajarkan?"
                
        except Exception as e:
            logger.error(f"Error di process_user_message: {e}")
            return "Maaf, saya error. Coba lagi nanti?"
        finally:
            session.close()
    
    def _extract_json(self, text):
        """Ekstrak JSON dari teks"""
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            return json_match.group()
        return text
    
    def should_respond_to_wtb(self, wtb_message, channel_name):
        """Memutuskan apakah perlu respon (untuk WTB)"""
        session = Session()
        
        try:
            all_memories = session.query(Memory).order_by(Memory.created_at.desc()).limit(50).all()
            
            if not all_memories:
                return {"should_respond": False, "reason": "Belum diajarkan apapun"}
            
            context = {
                "memori_yang_diajarkan": [
                    {"type": m.memory_type, "content": m.content[:200]}
                    for m in all_memories
                ]
            }
            
            prompt = f"""
Pesan WTB dari channel {channel_name}:
"{wtb_message}"

Produk yang dijual (dari memori):
{json.dumps(context, indent=2)}

Tugas: Apakah pesan ini mencari produk yang SESUAI dengan yang dijual?
Jika iya, produk apa?

Format JSON:
{{
    "should_respond": true/false,
    "product": "nama produk atau null",
    "reason": "penjelasan"
}}
"""
            response = self.model.generate_content(prompt)
            result = json.loads(self._extract_json(response.text))
            return result
            
        except Exception as e:
            logger.error(f"Error di should_respond: {e}")
            return {"should_respond": False, "reason": "Error"}
        finally:
            session.close()
    
    def generate_response(self, wtb_message, product_name, channel_name):
        """Generate respons untuk WTB"""
        session = Session()
        
        try:
            memories = session.query(Memory).filter(
                Memory.content.contains(product_name)
            ).order_by(Memory.created_at.desc()).limit(20).all()
            
            prompt = f"""
Pesan WTB: "{wtb_message}"
Channel: {channel_name}
Produk: {product_name}

Informasi produk dari memori:
{chr(10).join([f"- {m.content}" for m in memories])}

Buat RESPON PROMOSI yang:
1. Hanya pakai info dari memori
2. Bahasa santai, seperti orang biasa
3. Singkat dan to the point
4. Sertakan harga jika ada

RESPON:
"""
            response = self.model.generate_content(prompt)
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Error di generate_response: {e}")
            return f"Halo kak, saya bisa bantu untuk {product_name}. Chat aja ya :)"
        finally:
            session.close()
