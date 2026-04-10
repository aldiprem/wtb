import time
import random
import threading
import json
from flask import Blueprint, Response

crash_bp = Blueprint('crash_bp', __name__)

# --- STATE GAME GLOBAL ---
game_state = {
    "status": "WAITING", # WAITING, PLAYING, CRASHED
    "multiplier": 1.00,
    "time_left": 5 # Countdown untuk waiting
}

def game_loop():
    """Background task untuk menjalankan logika game terus-menerus"""
    global game_state
    while True:
        # FASE 1: MENUNGGU
        game_state["status"] = "WAITING"
        game_state["multiplier"] = 1.00
        for i in range(5, 0, -1):
            game_state["time_left"] = i
            time.sleep(1)

        # FASE 2: BERMAIN (ROKET TERBANG)
        game_state["status"] = "PLAYING"
        # Roket akan meledak di angka random antara 1.01x dan 10.00x
        crash_point = random.uniform(1.01, 10.00) 
        speed = 0.001
        
        while game_state["status"] == "PLAYING":
            game_state["multiplier"] += speed
            speed += 0.0001 # Kecepatan eksponensial

            if game_state["multiplier"] >= crash_point:
                game_state["multiplier"] = crash_point
                game_state["status"] = "CRASHED"
            
            time.sleep(0.05) # Loop jalan setiap 50ms (real-time)

        # FASE 3: MELEDAK
        time.sleep(3) # Tampilkan teks meledak selama 3 detik sebelum restart

# Jalankan game loop di thread terpisah agar tidak memblokir Flask
thread = threading.Thread(target=game_loop, daemon=True)
thread.start()

# --- ENDPOINT SSE (Server-Sent Events) ---
@crash_bp.route('/stream')
def stream():
    """Endpoint ini diakses JS via EventSource untuk mendapatkan live update"""
    def event_stream():
        while True:
            # Mengirim data JSON ke frontend setiap 50ms
            yield f"data: {json.dumps(game_state)}\n\n"
            time.sleep(0.05)
            
    return Response(event_stream(), mimetype="text/event-stream")

# --- ENDPOINT TARUHAN (MOCKUP) ---
# Anda bisa menghubungkan ini ke database user & saldo Anda nanti
@crash_bp.route('/bet', methods=['POST'])
def place_bet():
    return {"status": "success", "message": "Bet placed"}

@crash_bp.route('/cashout', methods=['POST'])
def cashout():
    return {"status": "success", "message": "Cashed out"}