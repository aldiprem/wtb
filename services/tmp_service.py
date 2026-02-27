from flask import Blueprint, request, jsonify
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from py import tmp

tmp_bp = Blueprint('tmp', __name__)

@tmp_bp.route('/tampilan/<int:website_id>', methods=['GET'])
def get_tampilan(website_id):
    try:
        data = tmp.get_tampilan(website_id)
        if data:
            return jsonify({'success': True, 'tampilan': data})
        else:
            return jsonify({'success': False, 'error': 'Tampilan not found'}), 404
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/colors', methods=['POST'])
def save_colors(website_id):
    try:
        data = request.json
        
        tmp.save_colors(website_id, data)
        return jsonify({'success': True, 'message': 'Colors saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/banners', methods=['POST'])
def save_banners(website_id):
    try:
        data = request.json
        
        banners = data.get('banners', [])
        for banner in banners:
            if 'url' not in banner:
                return jsonify({'success': False, 'error': 'Each banner must have a URL'}), 400
        
        tmp.save_banners(website_id, banners)
        return jsonify({'success': True, 'message': f'{len(banners)} banners saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
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
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/logo', methods=['POST'])
def save_logo(website_id):
    try:
        data = request.json
        
        logo_url = data.get('url', '')
        if logo_url and not (logo_url.lower().endswith('.png') or logo_url.startswith('data:image/png')):
            return jsonify({'success': False, 'error': 'Logo must be PNG format'}), 400
        
        tmp.save_logo(website_id, logo_url)
        return jsonify({'success': True, 'message': 'Logo saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
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
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/promos', methods=['GET'])
def get_promos(website_id):
    try:
        data = tmp.get_promos(website_id)
        return jsonify({'success': True, 'promos': data})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@tmp_bp.route('/tampilan/<int:website_id>/promos', methods=['POST'])
def save_promos(website_id):
    try:
        data = request.json
        
        promos = data.get('promos', [])
        for promo in promos:
            if 'title' not in promo or not promo['title']:
                return jsonify({'success': False, 'error': 'Each promo must have a title'}), 400
            if 'banner' not in promo or not promo['banner']:
                return jsonify({'success': False, 'error': 'Each promo must have a banner URL'}), 400
        
        tmp.save_promos(website_id, promos)
        return jsonify({'success': True, 'message': f'{len(promos)} promos saved successfully'})
    except Exception as e:
        print(f"❌ Error: {str(e)}")
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
        print(f"❌ Error: {str(e)}")
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
        print(f"❌ Error: {str(e)}")
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
        from py import tmp_font
        template_data = tmp_font.get_template(template_code)
        if not template_data:
            return jsonify({'success': False, 'error': 'Template tidak ditemukan'}), 404
        
        # Siapkan data update berdasarkan target
        update_data = {}
        
        if target == 'store_name' or target == 'all_text':
            update_data = {
                'font_family': template_data['font_family'],
                'font_size': template_data['font_size'],
                'font_animation': template_data['animation_type'],
                'animation_duration': template_data['animation_duration'],
                'animation_delay': template_data['animation_delay'],
                'animation_iteration': template_data['animation_iteration']
            }
        elif target == 'headings':
            # Untuk headings, kita simpan di settings (JSON) karena tidak ada kolom khusus
            # Ambil settings saat ini
            current = tmp.get_tampilan(website_id)
            settings = current.get('settings', {}) if current else {}
            
            # Update settings
            settings['heading_font_family'] = template_data['font_family']
            settings['heading_font_size'] = template_data['font_size']
            settings['heading_font_animation'] = template_data['animation_type']
            
            update_data = {'settings': settings}
            
        elif target == 'body':
            # Untuk body text
            current = tmp.get_tampilan(website_id)
            settings = current.get('settings', {}) if current else {}
            
            settings['body_font_family'] = template_data['font_family']
            settings['body_font_size'] = template_data['font_size']
            settings['body_font_animation'] = template_data['animation_type']
            
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
        print(f"📥 Saving template for website {website_id}: {data.get('template_name')}")
        
        template_code = data.get('template_code')
        template_name = data.get('template_name')
        template_data = data.get('template_data')
        
        if not template_code or not template_name or not template_data:
            return jsonify({'success': False, 'error': 'Data tidak lengkap'}), 400
        
        success = tmp.save_website_template(website_id, template_code, template_name, template_data)
        
        if success:
            return jsonify({'success': True, 'message': 'Template saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save template'}), 500
            
    except Exception as e:
        print(f"❌ Error saving website template: {e}")
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
        
        from py import tmp_font
        template_data = tmp_font.get_template(template_code)
        if not template_data:
            return jsonify({'success': False, 'error': 'Template not found'}), 404
        
        tampilan_update = {
            'font_family': template_data['font_family'],
            'font_size': template_data['font_size'],
            'store_display_name': template_data['preview_text'],
            'font_animation': template_data['animation_type'],
            'animation_duration': template_data['animation_duration'],
            'animation_delay': template_data['animation_delay'],
            'animation_iteration': template_data['animation_iteration']
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
        
        from py import tmp_font
        template_data = tmp_font.get_template(template_code)
        if not template_data:
            return jsonify({'success': False, 'error': 'Template tidak ditemukan'}), 404
        
        # Kembalikan data template (tanpa file font jika terlalu besar)
        preview_data = {
            'font_family': template_data['font_family'],
            'font_size': template_data['font_size'],
            'font_weight': template_data['font_weight'],
            'font_style': template_data['font_style'],
            'text_color': template_data['text_color'],
            'animation_type': template_data['animation_type'],
            'animation_duration': template_data['animation_duration'],
            'animation_delay': template_data['animation_delay'],
            'animation_iteration': template_data['animation_iteration'],
            'preview_text': template_data['preview_text']
        }
        
        # Sertakan font file data jika ada (untuk preview)
        if template_data.get('font_file_data'):
            preview_data['font_file_data'] = template_data['font_file_data']
        
        return jsonify({'success': True, 'template': preview_data})
        
    except Exception as e:
        print(f"❌ Error getting font preview: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500