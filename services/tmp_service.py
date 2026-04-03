from flask import Blueprint, request, jsonify
import sys
import os
import re
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import tmp
from db_config import get_db_connection

tmp_bp = Blueprint('tmp', __name__)

@tmp_bp.route('/tampilan/<int:website_id>', methods=['GET'])
def get_tampilan(website_id):
    try:
        print(f"🔍 Fetching tampilan for website_id: {website_id}")
        data = tmp.get_tampilan(website_id)
        
        if data:
            print(f"✅ Tampilan data found for website {website_id}")
            return jsonify({'success': True, 'tampilan': data})
        else:
            # Jika data tidak ada, buat data default
            print(f"ℹ️ No tampilan data for website {website_id}, creating default")
            default_data = {
                'colors': {},
                'banners': [],
                'promos': [],
                'store_display_name': 'Toko Online',
                'font_family': 'Inter',
                'font_size': 14,
                'font_animation': 'none'
            }
            # Simpan default data
            tmp.save_tampilan(website_id, default_data)
            return jsonify({'success': True, 'tampilan': default_data})
            
    except Exception as e:
        print(f"❌ Error in get_tampilan: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/colors', methods=['POST'])
def save_colors(website_id):
    try:
        data = request.json
        print(f"🎨 Saving colors for website {website_id}: {data}")
        
        tmp.save_colors(website_id, data)
        return jsonify({'success': True, 'message': 'Colors saved successfully'})
    except Exception as e:
        print(f"❌ Error saving colors: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/banners', methods=['POST'])
def save_banners(website_id):
    try:
        data = request.json
        print(f"🎨 Saving banners for website {website_id}: {len(data.get('banners', []))} banners")
        print(f"📦 Raw banners data: {data}")
        
        banners = data.get('banners', [])
        
        # Validasi setiap banner
        for idx, banner in enumerate(banners):
            if 'hash' not in banner and 'url' not in banner:
                return jsonify({
                    'success': False, 
                    'error': f'Banner #{idx+1} must have either hash or url'
                }), 400
        
        # Simpan banners
        success = tmp.save_banners(website_id, banners)
        
        if success:
            return jsonify({
                'success': True, 
                'message': f'{len(banners)} banners saved successfully'
            })
        else:
            return jsonify({
                'success': False, 
                'error': 'Failed to save banners'
            }), 500
            
    except Exception as e:
        print(f"❌ Error saving banners: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/banners/<int:banner_index>', methods=['DELETE'])
def delete_banner(website_id, banner_index):
    try:
        existing = tmp.get_tampilan(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
        
        banners = existing.get('banners', [])
        if banner_index < 0 or banner_index >= len(banners):
            return jsonify({'success': False, 'error': 'Banner not found'}), 404
        
        banners.pop(banner_index)
        tmp.save_banners(website_id, banners)
        return jsonify({'success': True, 'message': 'Banner deleted successfully'})
    except Exception as e:
        print(f"❌ Error deleting banner: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/logo', methods=['POST'])
def save_logo(website_id):
    try:
        data = request.json
        print(f"🎨 ========== SAVE LOGO ==========")
        print(f"🎨 Saving logo for website {website_id}")
        print(f"📦 Logo data received: {data}")
        
        # Cek apakah ada logo_hash atau logo_url
        new_logo_hash = data.get('logo_hash') or data.get('hash') or data.get('url', '')
        
        # Jika tidak ada logo_hash, coba ekstrak dari logo_url
        if not new_logo_hash and data.get('logo_url'):
            new_logo_hash = data.get('logo_url')
        
        print(f"🖼️ New logo value: {new_logo_hash[:50] if new_logo_hash else 'empty'}...")
        
        # ==================== HAPUS LOGO LAMA ====================
        # Ambil logo lama dari database sebelum diupdate
        old_tampilan = tmp.get_tampilan(website_id)
        old_logo_hash = old_tampilan.get('logo') if old_tampilan else None
        
        print(f"🗑️ Old logo hash: {old_logo_hash}")
        
        # Jika ada logo lama dan berbeda dengan logo baru, hapus file gambarnya
        if old_logo_hash and old_logo_hash != new_logo_hash:
            # Cek apakah old_logo_hash adalah hash 35 karakter (bukan URL atau base64)
            if old_logo_hash and len(old_logo_hash) == 35 and re.match(r'^[a-f0-9]{35}$', old_logo_hash, re.IGNORECASE):
                try:
                    from services.image_service import delete_image_file
                    delete_image_file(old_logo_hash)
                    print(f"✅ Old logo file deleted: {old_logo_hash}")
                except ImportError:
                    print(f"⚠️ image_service not found, skipping file deletion")
                except Exception as e:
                    print(f"⚠️ Failed to delete old logo file: {e}")
            else:
                print(f"⚠️ Old logo is not a hash (maybe URL or base64), skipping file deletion")
        
        # ==================== SIMPAN LOGO BARU ====================
        if new_logo_hash:
            # Simpan hash atau URL ke database
            result = tmp.save_logo(website_id, new_logo_hash)
            if result:
                return jsonify({'success': True, 'message': 'Logo saved successfully', 'logo_hash': new_logo_hash})
            else:
                return jsonify({'success': False, 'error': 'Failed to save logo'}), 500
        else:
            # Simpan empty string jika tidak ada logo
            tmp.save_logo(website_id, '')
            return jsonify({'success': True, 'message': 'Logo cleared'})
            
    except Exception as e:
        print(f"❌ Error saving logo: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/logo/clear', methods=['POST'])
def clear_logo(website_id):
    """Menghapus logo website"""
    try:
        # Ambil logo lama
        old_tampilan = tmp.get_tampilan(website_id)
        old_logo_hash = old_tampilan.get('logo') if old_tampilan else None
        
        if old_logo_hash and len(old_logo_hash) == 35:
            from services.image_service import delete_image_file
            delete_image_file(old_logo_hash)
        
        # Kosongkan kolom logo di database
        tmp.save_logo(website_id, '')
        
        return jsonify({'success': True, 'message': 'Logo cleared successfully'})
    except Exception as e:
        print(f"❌ Error clearing logo: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/all', methods=['GET'])
def get_all_tampilan_data(website_id):
    """Endpoint gabungan untuk semua data tampilan dalam 1 request"""
    try:
        from py import tmp
        
        # Ambil semua data dalam 1 koneksi
        tampilan_data = tmp.get_tampilan(website_id)
        templates_data = tmp.get_website_templates(website_id)
        
        return jsonify({
            'success': True,
            'tampilan': tampilan_data,
            'templates': templates_data
        })
    except Exception as e:
        print(f"❌ Error getting all data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/banners/reorder', methods=['POST'])
def reorder_banners(website_id):
    try:
        data = request.json
        new_order = data.get('order', [])
        
        existing = tmp.get_tampilan(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
        
        banners = existing.get('banners', [])
        if len(new_order) == len(banners):
            new_banners = [banners[i] for i in new_order]
            tmp.save_banners(website_id, new_banners)
            return jsonify({'success': True, 'message': 'Banners reordered successfully'})
        else:
            return jsonify({'success': False, 'error': 'Invalid order'}), 400
    except Exception as e:
        print(f"❌ Error reordering banners: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/promos', methods=['GET'])
def get_promos(website_id):
    try:
        data = tmp.get_promos(website_id)
        return jsonify({'success': True, 'promos': data})
    except Exception as e:
        print(f"❌ Error getting promos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/promos', methods=['POST'])
def save_promos(website_id):
    try:
        data = request.json
        print(f"🎨 Saving promos for website {website_id}: {len(data.get('promos', []))} promos")
        
        promos = data.get('promos', [])
        for promo in promos:
            if 'title' not in promo or not promo['title']:
                return jsonify({'success': False, 'error': 'Each promo must have a title'}), 400
            if 'banner' not in promo or not promo['banner']:
                return jsonify({'success': False, 'error': 'Each promo must have a banner URL'}), 400
        
        tmp.save_promos(website_id, promos)
        return jsonify({'success': True, 'message': f'{len(promos)} promos saved successfully'})
    except Exception as e:
        print(f"❌ Error saving promos: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/promos/<int:promo_index>', methods=['DELETE'])
def delete_promo(website_id, promo_index):
    try:
        existing = tmp.get_promos(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Promos not found'}), 404
        
        if promo_index < 0 or promo_index >= len(existing):
            return jsonify({'success': False, 'error': 'Promo not found'}), 404
        
        existing.pop(promo_index)
        tmp.save_promos(website_id, existing)
        return jsonify({'success': True, 'message': 'Promo deleted successfully'})
    except Exception as e:
        print(f"❌ Error deleting promo: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/promos/reorder', methods=['POST'])
def reorder_promos(website_id):
    try:
        data = request.json
        new_order = data.get('order', [])
        
        existing = tmp.get_promos(website_id)
        if not existing:
            return jsonify({'success': False, 'error': 'Promos not found'}), 404
        
        if len(new_order) == len(existing):
            new_promos = [existing[i] for i in new_order]
            tmp.save_promos(website_id, new_promos)
            return jsonify({'success': True, 'message': 'Promos reordered successfully'})
        else:
            return jsonify({'success': False, 'error': 'Invalid order'}), 400
    except Exception as e:
        print(f"❌ Error reordering promos: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/font-anim', methods=['POST'])
def save_font_anim(website_id):
    """Save font and animation settings"""
    try:
        data = request.json
        print(f"🎨 Saving font animation for website {website_id}")
        
        tmp.save_font_anim(website_id, data)
        return jsonify({'success': True, 'message': 'Font animation saved successfully'})
    except Exception as e:
        print(f"❌ Error saving font animation: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/font-style', methods=['POST'])
def save_font_style(website_id):
    """
    Menyimpan font style untuk target tertentu (store_name, headings, body, all_text)
    """
    try:
        data = request.json
        
        # Validasi data
        target = data.get('target')
        template_code = data.get('template_code')
        
        if not target or not template_code:
            return jsonify({'success': False, 'error': 'Target dan template code diperlukan'}), 400
        
        # Ambil data template dari database font
        try:
            from py import tmp_font
            template_data = tmp_font.get_template(template_code)
            if not template_data:
                return jsonify({'success': False, 'error': 'Template tidak ditemukan'}), 404
        except ImportError:
            # Jika tmp_font belum ada, gunakan data dari request
            template_data = {
                'font_family': data.get('font_family', 'Inter'),
                'font_size': data.get('font_size', 16),
                'animation_type': data.get('font_animation', 'none'),
                'animation_duration': data.get('animation_duration', 2),
                'animation_delay': data.get('animation_delay', 0),
                'animation_iteration': data.get('animation_iteration', 'infinite')
            }
        
        # Siapkan data update berdasarkan target
        update_data = {}
        
        if target == 'store_name' or target == 'all_text':
            update_data = {
                'font_family': template_data.get('font_family', 'Inter'),
                'font_size': template_data.get('font_size', 16),
                'font_animation': template_data.get('animation_type', 'none'),
                'animation_duration': template_data.get('animation_duration', 2),
                'animation_delay': template_data.get('animation_delay', 0),
                'animation_iteration': template_data.get('animation_iteration', 'infinite')
            }
        elif target == 'headings':
            # Untuk headings, kita simpan di settings (JSON)
            current = tmp.get_tampilan(website_id)
            settings = current.get('settings', {}) if current else {}
            
            settings['heading_font_family'] = template_data.get('font_family', 'Inter')
            settings['heading_font_size'] = template_data.get('font_size', 16)
            settings['heading_font_animation'] = template_data.get('animation_type', 'none')
            
            update_data = {'settings': settings}
            
        elif target == 'body':
            # Untuk body text
            current = tmp.get_tampilan(website_id)
            settings = current.get('settings', {}) if current else {}
            
            settings['body_font_family'] = template_data.get('font_family', 'Inter')
            settings['body_font_size'] = template_data.get('font_size', 16)
            settings['body_font_animation'] = template_data.get('animation_type', 'none')
            
            update_data = {'settings': settings}
        else:
            return jsonify({'success': False, 'error': 'Target tidak valid'}), 400
        
        # Simpan ke database
        success = tmp.save_font_style(website_id, update_data, target)
        
        if success:
            return jsonify({'success': True, 'message': f'Font style diterapkan ke {target}'})
        else:
            return jsonify({'success': False, 'error': 'Gagal menyimpan font style'}), 500
            
    except Exception as e:
        print(f"❌ Error saving font style: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/templates', methods=['GET'])
def get_website_templates(website_id):
    try:
        templates = tmp.get_website_templates(website_id)
        return jsonify({'success': True, 'templates': templates})
    except Exception as e:
        print(f"❌ Error getting website templates: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/templates', methods=['POST'])
def save_website_template(website_id):
    try:
        data = request.json
        print(f"📥 Saving template data: {data.keys()}")  # Debug
        
        # Perbaiki: ambil template_name, bukan name
        template_name = data.get('template_name', 'Default Name')
        template_code = data.get('template_code')
        template_data = data.get('template_data')
        
        if not template_data:
            return jsonify({'success': False, 'error': 'Data template kosong'}), 400
        
        if not template_code:
            return jsonify({'success': False, 'error': 'Template code diperlukan'}), 400
        
        print(f"📝 Saving template: {template_name} ({template_code})")
        
        # Gunakan fungsi yang sudah diperbaiki di tmp.py
        success = tmp.save_website_template(website_id, template_code, template_name, template_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Template saved'})
        else:
            return jsonify({'success': False, 'error': 'Gagal simpan ke DB'}), 500
    except Exception as e:
        print(f"❌ Error saving template: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/templates/<int:template_id>', methods=['DELETE'])
def delete_website_template(website_id, template_id):
    try:
        success = tmp.delete_website_template(template_id)
        if success:
            return jsonify({'success': True, 'message': 'Template deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
    except Exception as e:
        print(f"❌ Error deleting website template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/apply-template', methods=['POST'])
def apply_template(website_id):
    try:
        data = request.json
        template_code = data.get('template_code')
        
        try:
            from py import tmp_font
            template_data = tmp_font.get_template(template_code)
        except ImportError:
            # Jika tmp_font tidak ada, gunakan data dari request
            template_data = data.get('template_data', {})
        
        if not template_data:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
        
        tampilan_update = {
            'font_family': template_data.get('font_family', 'Inter'),
            'font_size': template_data.get('font_size', 16),
            'store_display_name': template_data.get('preview_text', 'Toko Online'),
            'font_animation': template_data.get('animation_type', 'none'),
            'animation_duration': template_data.get('animation_duration', 2),
            'animation_delay': template_data.get('animation_delay', 0),
            'animation_iteration': template_data.get('animation_iteration', 'infinite')
        }
        
        tmp.update_tampilan(website_id, tampilan_update)
        return jsonify({'success': True, 'message': 'Template applied successfully'})
        
    except Exception as e:
        print(f"❌ Error applying template: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/font-preview', methods=['POST'])
def get_font_preview(website_id):
    """
    Mendapatkan data template untuk preview (tanpa menyimpan)
    """
    try:
        data = request.json
        template_code = data.get('template_code')
        
        if not template_code:
            return jsonify({'success': False, 'error': 'Template code diperlukan'}), 400
        
        try:
            from py import tmp_font
            template_data = tmp_font.get_template(template_code)
        except ImportError:
            # Jika tmp_font tidak ada, gunakan data dari request
            template_data = {
                'font_family': data.get('font_family', 'Inter'),
                'font_size': data.get('font_size', 16),
                'font_weight': data.get('font_weight', 'normal'),
                'font_style': data.get('font_style', 'normal'),
                'text_color': data.get('text_color', '#ffffff'),
                'animation_type': data.get('animation_type', 'none'),
                'animation_duration': data.get('animation_duration', 2),
                'animation_delay': data.get('animation_delay', 0),
                'animation_iteration': data.get('animation_iteration', 'infinite'),
                'preview_text': data.get('preview_text', 'Toko Online')
            }
        
        if not template_data:
            return jsonify({'success': False, 'error': 'Template tidak ditemukan'}), 404
        
        # Kembalikan data template
        preview_data = {
            'font_family': template_data.get('font_family', 'Inter'),
            'font_size': template_data.get('font_size', 16),
            'font_weight': template_data.get('font_weight', 'normal'),
            'font_style': template_data.get('font_style', 'normal'),
            'text_color': template_data.get('text_color', '#ffffff'),
            'animation_type': template_data.get('animation_type', 'none'),
            'animation_duration': template_data.get('animation_duration', 2),
            'animation_delay': template_data.get('animation_delay', 0),
            'animation_iteration': template_data.get('animation_iteration', 'infinite'),
            'preview_text': template_data.get('preview_text', 'Toko Online')
        }
        
        # Sertakan font file data jika ada
        if template_data.get('font_file_data'):
            preview_data['font_file_data'] = template_data['font_file_data']
        
        return jsonify({'success': True, 'template': preview_data})
        
    except Exception as e:
        print(f"❌ Error getting font preview: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
    
@tmp_bp.route('/tampilan/<int:website_id>/banner-settings', methods=['GET'])
def get_banner_settings(website_id):
    """Mendapatkan semua pengaturan banner untuk website"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT banner_index, catatan, is_hidden 
            FROM banner_settings 
            WHERE website_id = %s 
            ORDER BY banner_index ASC
        ''', (website_id,))
        
        settings = cursor.fetchall()
        conn.close()
        
        return jsonify({'success': True, 'settings': settings})
    except Exception as e:
        print(f"❌ Error getting banner settings: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/banner-settings', methods=['POST'])
def save_banner_settings(website_id):
    """Menyimpan pengaturan banner (catatan dan status hide)"""
    try:
        data = request.json
        banner_index = data.get('banner_index')
        catatan = data.get('catatan', '')
        is_hidden = data.get('is_hidden', 0)
        
        if banner_index is None:
            return jsonify({'success': False, 'error': 'banner_index required'}), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO banner_settings (website_id, banner_index, catatan, is_hidden)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                catatan = VALUES(catatan),
                is_hidden = VALUES(is_hidden),
                updated_at = CURRENT_TIMESTAMP
        ''', (website_id, banner_index, catatan, is_hidden))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Banner setting saved'})
    except Exception as e:
        print(f"❌ Error saving banner setting: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/banner-settings/<int:banner_index>', methods=['DELETE'])
def delete_banner_setting(website_id, banner_index):
    """Menghapus pengaturan banner"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM banner_settings 
            WHERE website_id = %s AND banner_index = %s
        ''', (website_id, banner_index))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Banner setting deleted'})
    except Exception as e:
        print(f"❌ Error deleting banner setting: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500