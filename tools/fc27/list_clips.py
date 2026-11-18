"""List named motion resources from a generated index; names are discovery hints, not semantic proof."""
import argparse
import json
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--work', type=Path, required=True)
parser.add_argument('--contains', default='')
parser.add_argument('--limit', type=int, default=50)
args = parser.parse_args()
rows = json.loads((args.work / 'motion-candidates.json').read_text(encoding='utf-8-sig'))
rows = [row for row in rows if args.contains.lower() in row['name'].lower()]
print('Matches:', len(rows))
for row in rows[:args.limit]:
    print(row['name'])
