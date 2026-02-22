#!/usr/bin/env python3
"""
Simple HTTP Server untuk testing game Auto Block Builder 3D
Run with: python server.py
"""

import http.server
import socketserver
import webbrowser
import os
from pathlib import Path

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]} {args[1]} {args[2]}")

    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def check_files():
    """Check if all required files exist"""
    required_files = ['index.html', 'css/style.css', 'js/game.js']
    missing_files = []
    
    for file in required_files:
        if not os.path.exists(os.path.join(DIRECTORY, file)):
            missing_files.append(file)
    
    if missing_files:
        print("⚠️  Warning: File berikut tidak ditemukan:")
        for file in missing_files:
            print(f"   - {file}")
        print("   Pastikan struktur folder benar:")
        print("   ./")
        print("   ├── index.html")
        print("   ├── server.py")
        print("   ├── css/")
        print("   │   └── style.css")
        print("   └── js/")
        print("       └── game.js")
        return False
    
    print("✅ Semua file required ditemukan!")
    return True

def show_info():
    """Display server information"""
    print("\n" + "="*60)
    print("🚀 AUTO BLOCK BUILDER 3D - SERVER")
    print("="*60)
    print(f"📁 Directory: {DIRECTORY}")
    print(f"🌐 Local URL: http://localhost:{PORT}")
    print(f"📡 Network URL: http://{get_local_ip()}:{PORT}")
    print("\n🎮 Kontrol Game:")
    print("   - Tekan 'R' untuk reset manual")
    print("   - Tekan 'L' untuk simulasi like")
    print("   - Tekan 'G' untuk simulasi hadiah kecil")
    print("   - Tekan 'B' untuk simulasi hadiah besar")
    print("\n📊 TikTok Integration Ready!")
    print("   Like 1000 = Speed Boost")
    print("   Like 5000 = Reset")
    print("   Hadiah Kecil = +5 Random Blocks")
    print("   Hadiah Besar = Instant Win")
    print("\n🌐 Tunnel URL kamu:")
    print("   https://benefits-structural-train-taking.trycloudflare.com")
    print("="*60 + "\n")

def get_local_ip():
    """Get local IP address"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def main():
    print("\n" + "="*60)
    print("🖥️  MEMULAI SERVER...")
    print("="*60)
    
    # Check files
    if not check_files():
        print("\n❌ Perbaiki struktur folder terlebih dahulu!")
        return
    
    # Show info
    show_info()
    
    # Start server
    try:
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            print(f"✨ Server running at http://localhost:{PORT}")
            print("🔴 Tekan Ctrl+C untuk menghentikan server\n")
            print("📢 Untuk akses via internet:")
            print(f"   https://benefits-structural-train-taking.trycloudflare.com")
            print("   (Pastikan tunnel masih running di terminal lain)\n")
            
            # Auto-open browser
            webbrowser.open(f"http://localhost:{PORT}")
            
            # Keep server running
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n👋 Server dihentikan. Terima kasih!")
    except OSError as e:
        print(f"❌ Error: Port {PORT} sudah digunakan!")
        print("   Coba ganti PORT di file server.py")
    except Exception as e:
        print(f"❌ Error tidak terduga: {e}")

if __name__ == "__main__":
    main()
