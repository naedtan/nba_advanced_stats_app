from nba_api.stats.endpoints import leaguedashteamshotlocations
import pandas as pd

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.nba.com/'
}

try:
    # Try passing measure_type_detailed_defense='Opponent' to LeagueDashTeamShotLocations
    # This is a guess, but worth trying.
    print("Attempting LeagueDashTeamShotLocations with measure_type_detailed_defense='Opponent'...")
    shots = leaguedashteamshotlocations.LeagueDashTeamShotLocations(
        season='2025-26',
        measure_type_simple='Opponent', # Maybe this?
        per_mode_detailed='PerGame',
        headers=HEADERS
    ).get_data_frames()[0]
    
    print("Columns:", shots.columns.tolist())
    if len(shots) > 0:
        print("First row keys:", shots.iloc[0].keys())

except Exception as e:
    print("Error with measure_type_simple='Opponent':", e)

try:
    # Check available endpoints
    from nba_api.stats import endpoints
    print("\nEndpoints with 'Opp' in name:")
    for name in dir(endpoints):
        if 'Opp' in name:
            print(name)

except Exception as e:
    print(e)
