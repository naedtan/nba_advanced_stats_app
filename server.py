from flask import Flask, jsonify
from flask_cors import CORS
from nba_api.stats.endpoints import playergamelog, leaguedashplayershotlocations, scoreboardv2, commonallplayers, commonplayerinfo, leaguedashteamstats, leaguedashoppptshot, leaguedashteamshotlocations
from nba_api.stats.static import players as static_players
from datetime import datetime, timedelta
from functools import lru_cache
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nba.com/'
}

# Teams we want to show in the sidebar (ALL 30 TEAMS)
TARGET_TEAMS = {
    1610612737: 'ATL', 1610612738: 'BOS', 1610612739: 'CLE', 1610612740: 'NOP',
    1610612741: 'CHI', 1610612742: 'DAL', 1610612743: 'DEN', 1610612744: 'GSW',
    1610612745: 'HOU', 1610612746: 'LAC', 1610612747: 'LAL', 1610612748: 'MIA',
    1610612749: 'MIL', 1610612750: 'MIN', 1610612751: 'BKN', 1610612752: 'NYK',
    1610612753: 'ORL', 1610612754: 'IND', 1610612755: 'PHI', 1610612756: 'PHX',
    1610612757: 'POR', 1610612758: 'SAC', 1610612759: 'SAS', 1610612760: 'OKC',
    1610612761: 'TOR', 1610612762: 'UTA', 1610612763: 'MEM', 1610612764: 'WAS',
    1610612765: 'DET', 1610612766: 'CHA'
}

# Full Team Map for Opponent lookup
TEAM_MAP = TARGET_TEAMS.copy()

@app.route('/')
def health_check():
    return jsonify({"message": "NBA Backend is running!", "status": "success"})

# --- Roster Endpoint ---
@app.route('/api/roster')
@lru_cache(maxsize=1) 
def get_roster():
    try:
        # Get all active players (Season 2025-26)
        roster = commonallplayers.CommonAllPlayers(
            is_only_current_season=1, 
            season='2025-26',
            headers=HEADERS
        ).get_data_frames()[0]
        
        players_list = []
        for _, p in roster.iterrows():
            pid = p['PERSON_ID']
            tid = p['TEAM_ID']
            team_code = TEAM_MAP.get(tid, 'NBA')
            if team_code != 'NBA':
                players_list.append({
                    "id": str(pid),
                    "name": p['DISPLAY_FIRST_LAST'],
                    "team": team_code,
                    "img": f"https://cdn.nba.com/headshots/nba/latest/1040x760/{pid}.png"
                })
        return jsonify(players_list)
    except Exception as e:
        print(f"Error fetching roster: {e}")
        return jsonify([])

# --- Schedule Endpoint ---
@app.route('/api/schedule')
@lru_cache(maxsize=4)
def get_schedule():
    schedule_data = {}
    today = datetime.now()
    
    for i in range(7):
        check_date = today + timedelta(days=i)
        date_str = check_date.strftime('%Y-%m-%d')
        
        # FIX: Use Month Day format (e.g. "Nov 28")
        day_label = check_date.strftime('%b %d')

        try:
            board = scoreboardv2.ScoreboardV2(game_date=date_str, headers=HEADERS, timeout=5).get_data_frames()[0]
            if board.empty: continue

            for _, game in board.iterrows():
                home_id = int(game['HOME_TEAM_ID'])
                away_id = int(game['VISITOR_TEAM_ID'])
                
                tracked_team_abbr = None
                opponent_id = None
                is_home = False

                if home_id in TARGET_TEAMS:
                    tracked_team_abbr = TARGET_TEAMS[home_id]
                    opponent_id = away_id
                    is_home = True
                elif away_id in TARGET_TEAMS:
                    tracked_team_abbr = TARGET_TEAMS[away_id]
                    opponent_id = home_id
                    is_home = False
                
                if tracked_team_abbr and tracked_team_abbr not in schedule_data:
                    opp_code = TEAM_MAP.get(opponent_id, "NBA")
                    status_text = game['GAME_STATUS_TEXT']
                    display_time = str(status_text).replace(" ET", "").strip()
                    
                    schedule_data[tracked_team_abbr] = {
                        "opponent": opp_code,
                        "isHome": is_home,
                        "time": display_time,
                        "day": day_label,
                        "sortOrder": i,
                        "opponentId": int(opponent_id)
                    }
        except Exception as e:
            continue

    return jsonify(schedule_data)

@app.route('/api/player/<player_id>')
def get_player_stats(player_id):
    try:
        season = '2025-26'
        
        # 1. Get Stats
        gamelog = playergamelog.PlayerGameLog(
            player_id=player_id, 
            season=season, 
            headers=HEADERS
        ).get_data_frames()[0]
        
        if gamelog.empty: return jsonify({"error": f"No games found"}), 404

        for col in ['PTS', 'REB', 'AST']: gamelog[col] = pd.to_numeric(gamelog[col])
        gamelog['PRA'] = gamelog['PTS'] + gamelog['REB'] + gamelog['AST']
        gamelog['PTS_REB'] = gamelog['PTS'] + gamelog['REB']
        gamelog['PTS_AST'] = gamelog['PTS'] + gamelog['AST']
        gamelog['REB_AST'] = gamelog['REB'] + gamelog['AST']

        # 2. Get Player Info
        p_info = commonplayerinfo.CommonPlayerInfo(player_id=player_id, headers=HEADERS).get_data_frames()[0]
        p_name = p_info.iloc[0]['DISPLAY_FIRST_LAST']

        stats = {
            "name": p_name,
            "ppg": round(gamelog['PTS'].mean(), 1),
            "rpg": round(gamelog['REB'].mean(), 1),
            "apg": round(gamelog['AST'].mean(), 1),
            "avg_pra": round(gamelog['PRA'].mean(), 1),
            "avg_pts_reb": round(gamelog['PTS_REB'].mean(), 1),
            "avg_pts_ast": round(gamelog['PTS_AST'].mean(), 1),
            "avg_reb_ast": round(gamelog['REB_AST'].mean(), 1),
        }

        def get_opponent(matchup_str):
            return matchup_str.split(' ')[-1] if matchup_str else "-"

        # 3. Recent Games
        cols = ['GAME_DATE', 'MATCHUP', 'PTS', 'REB', 'AST', 'WL', 'PRA', 'PTS_REB', 'PTS_AST', 'REB_AST']
        available_cols = [c for c in cols if c in gamelog.columns]
        recent = gamelog.head(20)[available_cols].copy()
        recent['OPP'] = recent['MATCHUP'].apply(get_opponent)
        
        # 4. Shot Zones
        all_zone = leaguedashplayershotlocations.LeagueDashPlayerShotLocations(
            season=season, per_mode_detailed='PerGame', headers=HEADERS
        ).get_data_frames()[0]
        
        # Robust Flattening
        if isinstance(all_zone.columns, pd.MultiIndex):
            all_zone.columns = ['_'.join([str(c) for c in col if c]).strip().replace(' ', '_') for col in all_zone.columns.values]
        else:
             all_zone.columns = [str(c).replace(' ', '_') for c in all_zone.columns]

        p_zone = all_zone[all_zone['PLAYER_ID'] == int(player_id)]

        def get_val(col): return p_zone.iloc[0].get(col, 0) if not p_zone.empty else 0
        
        zones = {
            "ra": {"pct": get_val('Restricted_Area_FG_PCT')*100, "fga": get_val('Restricted_Area_FGA')},
            "paint": {"pct": get_val('In_The_Paint_(Non-RA)_FG_PCT')*100, "fga": get_val('In_The_Paint_(Non-RA)_FGA')},
            "mid": {"pct": get_val('Mid-Range_FG_PCT')*100, "fga": get_val('Mid-Range_FGA')},
            "lc3": {"pct": get_val('Left_Corner_3_FG_PCT')*100, "fga": get_val('Left_Corner_3_FGA')},
            "rc3": {"pct": get_val('Right_Corner_3_FG_PCT')*100, "fga": get_val('Right_Corner_3_FGA')},
            "ab3": {"pct": get_val('Above_the_Break_3_FG_PCT')*100, "fga": get_val('Above_the_Break_3_FGA')}
        }

        return jsonify({ "stats": stats, "recentGames": recent.to_dict(orient='records'), "zones": zones })

    except Exception as e:
        print(f"Error processing player {player_id}: {e}")
        return jsonify({"error": str(e)}), 500

# --- Defense Rankings Endpoint ---
@app.route('/api/defense_ranks')
@lru_cache(maxsize=1)
def get_league_defense_ranks():
    try:
        # Get Opponent Shooting by Zone using LeagueDashTeamShotLocations with measure_type_simple='Opponent'
        opp_shooting = leaguedashteamshotlocations.LeagueDashTeamShotLocations(
            season='2025-26',
            measure_type_simple='Opponent',
            per_mode_detailed='PerGame',
            headers=HEADERS
        ).get_data_frames()[0]

        # Flatten MultiIndex columns
        # Columns are like ('Restricted Area', 'OPP_FG_PCT')
        # We want to rename them to something easier to work with
        
        # Create a copy to avoid SettingWithCopy warnings if any
        df = opp_shooting.copy()
        
        # Flatten columns
        new_cols = []
        for col in df.columns:
            if isinstance(col, tuple):
                zone, stat = col
                if zone == '':
                    new_cols.append(stat)
                else:
                    new_cols.append(f"{zone}_{stat}")
            else:
                new_cols.append(col)
        
        df.columns = new_cols
        
        # Map our zone keys to the API column prefixes
        # API Zones: 'Restricted Area', 'In The Paint (Non-RA)', 'Mid-Range', 'Left Corner 3', 'Right Corner 3', 'Above the Break 3'
        zone_map = {
            "ra": "Restricted Area",
            "paint": "In The Paint (Non-RA)",
            "mid": "Mid-Range",
            "lc3": "Left Corner 3",
            "rc3": "Right Corner 3",
            "ab3": "Above the Break 3"
        }
        
        # Calculate ranks for each zone based on OPP_FG_PCT
        # Lower OPP_FG_PCT is better defense (Rank 1)
        for key, prefix in zone_map.items():
            col_name = f"{prefix}_OPP_FG_PCT"
            if col_name in df.columns:
                df[f"{key}_rank"] = df[col_name].rank(ascending=True, method='min')
            else:
                df[f"{key}_rank"] = 15 # Default mid-rank if missing

        result = {}
        for _, row in df.iterrows():
            team_id = int(row['TEAM_ID'])
            abbr = TEAM_MAP.get(team_id, row.get('TEAM_ABBREVIATION', 'UNK'))
            
            ranks = {
                "ra": int(row['ra_rank']),
                "paint": int(row['paint_rank']),
                "mid": int(row['mid_rank']),
                "lc3": int(row['lc3_rank']),
                "rc3": int(row['rc3_rank']),
                "ab3": int(row['ab3_rank'])
            }
            result[abbr] = ranks

        return jsonify(result)

    except Exception as e:
        print(f"Error fetching defense ranks: {e}")
        return jsonify({})

if __name__ == '__main__':
    print("🏀 Optimized NBA Backend running on http://localhost:5000")
    app.run(debug=True, port=5000)