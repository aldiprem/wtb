import os

def get_winedash_source_logic():
    # Path folder winedash
    base_path = os.path.join(os.getcwd(), 'winedash')
    # Ekstensi yang diizinkan
    allowed_extensions = {'.py', '.js', '.html', '.css', '.json'}
    
    output_html = ""
    
    if not os.path.exists(base_path):
        return "<p>Folder winedash tidak ditemukan</p>"

    # Scan folder secara rekursif
    for root, dirs, files in os.walk(base_path):
        for file in sorted(files):
            if any(file.endswith(ext) for ext in allowed_extensions):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, os.getcwd())
                
                try:
                    with open(full_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        # Ganti karakter HTML agar tidak tereksekusi di browser
                        safe_content = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                        
                        # Buat blok teks biasa agar mudah dibaca AI
                        output_html += f'''
                        <div class="file-block">
                            <div class="file-header">--- START OF FILE {rel_path} ---</div>
                            <pre class="code-raw">{safe_content}</pre>
                            <div class="file-footer">--- END OF FILE {rel_path} ---</div>
                        </div>
                        '''
                except Exception as e:
                    continue
                    
    return output_html