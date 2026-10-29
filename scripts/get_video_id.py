import sqlite3
import argparse
from pathlib import Path



QUERY = """

"""


def main():
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", type=Path, default=Path("pipeline.db"))
     
    args = parser.parse_args()
    
    query = QUERY.format()
    
    
    with sqlite3.connect(
        args.db
    ) as conn:
        conn.row_factory = sqlite3.Row
        
        rows = conn.execute(query).fetchall()
    
    
    for row in rows:
        print(dict(row))
    print(f"\n{len(rows)} clip(s) total")
    




