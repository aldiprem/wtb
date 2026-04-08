from flask import Blueprint, render_template, jsonify, request
from flask_cors import CORS
import os

games_bp = Blueprint('games', __name__, 
                     template_folder='.',
                     static_folder='.',
                     static_url_path='/games')

@games_bp.route('/games')
def games_page():
    """Halaman utama games"""
    return render_template('base.html')

@games_bp.route('/api/games/data')
def get_games_data():
    """API untuk mendapatkan data games (kosong untuk sekarang)"""
    return jsonify({
        'success': True,
        'message': 'Games page - Content will be added later',
        'data': []
    })

@games_bp.route('/api/market/data')
def get_market_data():
    """API untuk mendapatkan data market (kosong untuk sekarang)"""
    return jsonify({
        'success': True,
        'message': 'Market page - Content will be added later',
        'data': []
    })

@games_bp.route('/api/profile/data')
def get_profile_data():
    """API untuk mendapatkan data profil (kosong untuk sekarang)"""
    return jsonify({
        'success': True,
        'message': 'Profile page - Content will be added later',
        'data': {
            'username': None,
            'telegram_id': None,
            'is_authenticated': False
        }
    })