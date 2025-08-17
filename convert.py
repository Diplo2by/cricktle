import pandas as pd
import json
import os
from collections import defaultdict
import re


def clean_numeric_value(value):
    """Clean and convert numeric values, handling '-', '*', and other non-numeric characters"""
    if pd.isna(value) or value == "-" or value == "":
        return 0

    # Convert to string and remove common non-numeric characters
    str_val = str(value).replace("*", "").replace(",", "").strip()

    # Handle cases like "50.25*" or "100-"
    str_val = re.sub(r"[^\d\.]", "", str_val)

    try:
        if "." in str_val:
            return float(str_val)
        else:
            return int(str_val) if str_val else 0
    except (ValueError, TypeError):
        return 0


def determine_era(span):
    """Determine era based on playing span"""
    if pd.isna(span) or span == "-":
        return "Unknown"

    # Extract years from span (e.g., "2008-2023" or "1999-2011")
    years = re.findall(r"\d{4}", str(span))
    if not years:
        return "Unknown"

    # Use the last year of career to determine era
    last_year = int(years[-1])

    if last_year >= 2010:
        return "Modern"
    elif last_year >= 1990:
        return "Classic"
    else:
        return "Vintage"


def get_country_from_name(player_name):
    """Extract country from player name in format: Player Name (Country1/Country2/etc)"""

    # Regional/multi-national teams to exclude (prefer actual countries)
    exclude_teams = {"Asia", "ICC", "Afr", "Africa", "World", "Rest", "XI"}

    # Country code to full name mapping
    country_mapping = {
        "SL": "Sri Lanka",
        "SA": "South Africa",
        "WI": "West Indies",
        "NZ": "New Zealand",
        "AUS": "Australia",
        "INDIA": "India",
        "ENG": "England",
        "PAK": "Pakistan",
        "BDESH": "Bangladesh",
        "ZIM": "Zimbabwe",
        "AFG": "Afghanistan",
        "IRE": "Ireland",
        "SCOT": "Scotland",
        "Neth": "Netherlands",
        "UAE": "UAE",
        "KENYA": "Kenya",
        "Can": "Canada",
        "Ber": "Bermuda",
        "USA": "USA",
        "Nep": "Nepal",
        "HKG": "Hong Kong",
        "Oman": "Oman",
        "PNG": "Papua New Guinea",
        "NAM": "Namibia",
    }

    # Extract country info from parentheses
    if "(" in player_name and ")" in player_name:
        # Get the content within parentheses
        country_part = player_name.split("(")[1].split(")")[0]

        # Split by '/' to handle multiple countries
        countries = [c.strip() for c in country_part.split("/")]

        # Filter out excluded regional teams and find valid country
        valid_countries = []
        for country in countries:
            # Skip excluded regional teams
            if country not in exclude_teams:
                # Check if it's a country code that needs mapping
                if country in country_mapping:
                    valid_countries.append(country_mapping[country])
                else:
                    # It's likely already a full country name
                    valid_countries.append(country)

        # Return the first valid country found
        if valid_countries:
            return valid_countries[0]

    # Fallback: try to extract country from common patterns without parentheses
    common_patterns = {
        "India": "India",
        "Australia": "Australia",
        "England": "England",
        "Pakistan": "Pakistan",
        "South Africa": "South Africa",
        "West Indies": "West Indies",
        "Sri Lanka": "Sri Lanka",
        "New Zealand": "New Zealand",
        "Bangladesh": "Bangladesh",
        "Zimbabwe": "Zimbabwe",
    }

    for pattern, country in common_patterns.items():
        if pattern.lower() in player_name.lower():
            return country

    return "Unknown"


def determine_role(batting_stats, bowling_stats, fielding_stats):
    """Determine player role based on their statistics"""

    # Get key stats
    batting_avg = batting_stats.get("Ave", 0)
    bowling_avg = bowling_stats.get("Ave", 0)
    wickets = bowling_stats.get("Wkts", 0)
    runs = batting_stats.get("Runs", 0)
    dismissals = fielding_stats.get("Dis", 0)
    stumpings = fielding_stats.get("St", 0)

    # Wicket-keeper logic
    if stumpings > 5 or (dismissals > 20 and stumpings > 0):
        return "Wicket-keeper"

    # All-rounder logic
    if (runs > 1000 and wickets > 20) or (
        batting_avg > 25 and bowling_avg > 0 and bowling_avg < 35 and wickets > 10
    ):
        return "All-rounder"

    # Bowler logic
    if wickets > runs / 100 and wickets > 50:  # More wickets than runs per 100
        return "Bowler"
    elif wickets > 100:
        return "Bowler"

    # Default to batsman
    return "Batsman"


def process_cricket_data(data_dir):
    """Process cricket data from CSV files and convert to desired format"""

    # Dictionary to store combined player data
    players_data = defaultdict(
        lambda: {
            "batting": {"ODI": {}, "T20": {}, "Test": {}},
            "bowling": {"ODI": {}, "T20": {}, "Test": {}},
            "fielding": {"ODI": {}, "T20": {}, "Test": {}},
        }
    )

    # File mappings
    formats = ["ODI", "T20", "Test"]
    categories = ["batting", "bowling", "fielding"]

    # Load all CSV files
    for category in categories:
        for format_type in formats:
            file_path = os.path.join(data_dir, category, f"{format_type.lower()}.csv")

            if os.path.exists(file_path):
                print(f"Processing {file_path}...")
                try:
                    df = pd.read_csv(file_path)

                    for _, row in df.iterrows():
                        player_name = str(row.get("Player", "")).strip()
                        if not player_name or player_name == "nan":
                            continue

                        # Store raw data for this player/format/category
                        players_data[player_name][category][format_type] = row.to_dict()

                except Exception as e:
                    print(f"Error processing {file_path}: {e}")
            else:
                print(f"File not found: {file_path}")

    # Convert to final format
    final_players = []

    for player_name, data in players_data.items():
        try:
            # Combine stats across all formats (prioritize Test, then ODI, then T20)
            combined_batting = {}
            combined_bowling = {}
            combined_fielding = {}

            # Combine batting stats
            total_runs = 0
            total_matches_batting = 0
            batting_avg = 0
            span = ""

            for fmt in ["Test", "ODI", "T20"]:
                if data["batting"][fmt]:
                    batting_data = data["batting"][fmt]
                    total_runs += clean_numeric_value(batting_data.get("Runs", 0))
                    total_matches_batting += clean_numeric_value(
                        batting_data.get("Mat", 0)
                    )
                    if not batting_avg and batting_data.get("Ave"):
                        batting_avg = clean_numeric_value(batting_data.get("Ave", 0))
                    if not span and batting_data.get("Span"):
                        span = batting_data.get("Span", "")

            combined_batting = {
                "Runs": total_runs,
                "Mat": total_matches_batting,
                "Ave": batting_avg,
                "Span": span,
            }

            # Combine bowling stats
            total_wickets = 0
            total_matches_bowling = 0
            bowling_avg = 0

            for fmt in ["Test", "ODI", "T20"]:
                if data["bowling"][fmt]:
                    bowling_data = data["bowling"][fmt]
                    total_wickets += clean_numeric_value(bowling_data.get("Wkts", 0))
                    total_matches_bowling += clean_numeric_value(
                        bowling_data.get("Mat", 0)
                    )
                    if not bowling_avg and bowling_data.get("Ave"):
                        bowling_avg = clean_numeric_value(bowling_data.get("Ave", 0))

            combined_bowling = {
                "Wkts": total_wickets,
                "Mat": total_matches_bowling,
                "Ave": bowling_avg,
            }

            # Combine fielding stats
            total_dismissals = 0
            total_stumpings = 0

            for fmt in ["Test", "ODI", "T20"]:
                if data["fielding"][fmt]:
                    fielding_data = data["fielding"][fmt]
                    total_dismissals += clean_numeric_value(fielding_data.get("Dis", 0))
                    total_stumpings += clean_numeric_value(fielding_data.get("St", 0))

            combined_fielding = {"Dis": total_dismissals, "St": total_stumpings}

            # Use the maximum matches across all categories
            total_matches = max(
                combined_batting.get("Mat", 0), combined_bowling.get("Mat", 0)
            )

            # Skip players with no significant stats or less than 100 matches
            if total_matches < 100 or (
                total_matches == 0 and total_runs == 0 and total_wickets == 0
            ):
                continue

            # Determine role
            role = determine_role(combined_batting, combined_bowling, combined_fielding)

            # Create final player object
            # Clean player name by removing country info in parentheses for display
            clean_name = (
                player_name.split("(")[0].strip() if "(" in player_name else player_name
            )

            player_obj = {
                "name": clean_name,
                "country": get_country_from_name(player_name),
                "role": role,
                "matches": total_matches,
                "runs": total_runs,
                "wickets": total_wickets,
                "average": (
                    batting_avg
                    if batting_avg > 0
                    else (bowling_avg if role == "Bowler" else 0)
                ),
                "era": determine_era(span),
            }

            final_players.append(player_obj)

        except Exception as e:
            print(f"Error processing player {player_name}: {e}")
            continue

    # Sort by total runs + wickets for better ordering
    final_players.sort(key=lambda x: x["runs"] + (x["wickets"] * 50), reverse=True)

    return final_players


def main():
    # Set your data directory path here
    data_dir = "cricket_data"  # Change this to your actual directory path

    print("Starting cricket data conversion...")
    print("Make sure your directory structure is:")
    print("cricket_data/")
    print("  ├── batting/")
    print("  │   ├── odi.csv")
    print("  │   ├── t20.csv")
    print("  │   └── test.csv")
    print("  ├── bowling/")
    print("  │   ├── odi.csv")
    print("  │   ├── t20.csv")
    print("  │   └── test.csv")
    print("  └── fielding/")
    print("      ├── odi.csv")
    print("      ├── t20.csv")
    print("      └── test.csv")
    print("-" * 50)

    # Process the data
    players = process_cricket_data(data_dir)

    print(f"\nProcessed {len(players)} players successfully!")

    # Save to JSON file
    output_file = "cricket_players.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(players, f, indent=2, ensure_ascii=False)

    print(f"Data saved to {output_file}")

    # Display first 5 players as sample
    print("\nSample of processed data (first 5 players):")
    for i, player in enumerate(players[:5]):
        print(
            f"{i+1}. {player['name']} - {player['role']} - {player['runs']} runs, {player['wickets']} wickets"
        )

    # Show some statistics
    print(f"\nStatistics:")
    print(f"Total players: {len(players)}")

    roles = {}
    eras = {}
    for player in players:
        roles[player["role"]] = roles.get(player["role"], 0) + 1
        eras[player["era"]] = eras.get(player["era"], 0) + 1

    print("Roles distribution:")
    for role, count in roles.items():
        print(f"  {role}: {count}")

    print("Era distribution:")
    for era, count in eras.items():
        print(f"  {era}: {count}")


if __name__ == "__main__":
    main()
