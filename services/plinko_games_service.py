# services/plinko_games_service.py
from flask import Blueprint, request, jsonify
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from games.database.plinko_games import save_game_result, get_stats, get_history

plinko_bp = Blueprint('plinko', __name__)

@plinko_bp.route('/plinko/stats', methods=['GET'])
def plinko_stats():
    """Get Plinko statistics"""
    try:
        stats = get_stats()
        return jsonify({
            'success': True,
            **stats
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@plinko_bp.route('/plinko/history', methods=['GET'])
def plinko_history():
    """Get Plinko game history"""
    try:
        limit = request.args.get('limit', 50, type=int)
        history = get_history(limit)
        return jsonify({
            'success': True,
            'history': history
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@plinko_bp.route('/plinko/save', methods=['POST'])
def plinko_save():
    """Save Plinko game result"""
    try:
        data = request.get_json()
        
        required = ['bet_amount', 'multiplier', 'win_amount', 'round_hash', 'risk_level']
        for field in required:
            if field not in data:
                return jsonify({'success': False, 'error': f'Missing field: {field}'}), 400
        
        result = save_game_result(data)
        
        if result:
            return jsonify({'success': True, 'message': 'Game saved successfully'})
        else:
            return jsonify({'success': False, 'error': 'Failed to save game'}), 500
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500