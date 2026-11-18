"""Compare regenerated motion JSON with the checked-in reference without normalizing away errors."""
import argparse
import json
import math
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--actual', type=Path, required=True)
parser.add_argument('--reference', type=Path, required=True)
parser.add_argument('--tolerance', type=float, default=1e-6)
args = parser.parse_args()
actual = json.loads(args.actual.read_text(encoding='utf-8-sig'))
reference = json.loads(args.reference.read_text(encoding='utf-8-sig'))
# Probe bookkeeping changed from a tail offset to an explicit padding length.
# Compare every runtime field and sample; ignore only these two named debug fields.
for document in (actual, reference):
    for clip in document['clips'].values():
        clip.pop('removeAt', None)
        clip.pop('padding', None)
summary = {'ignoredDebugFields': ['removeAt', 'padding'], 'numbers': 0, 'maxAbsoluteDifference': 0.0, 'tolerance': args.tolerance}
def compare(a, b, path):
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            raise ValueError(f'{path}: dictionary keys differ')
        for key in a:
            compare(a[key], b[key], path + '.' + key)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            raise ValueError(f'{path}: lengths differ')
        for i, (x, y) in enumerate(zip(a, b)):
            compare(x, y, f'{path}[{i}]')
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
        if not math.isfinite(a) or not math.isfinite(b):
            raise ValueError(f'{path}: non-finite value')
        difference = abs(a - b)
        summary['numbers'] += 1
        summary['maxAbsoluteDifference'] = max(summary['maxAbsoluteDifference'], difference)
        if difference > args.tolerance:
            raise ValueError(f'{path}: {a} != {b}, difference {difference}')
    elif a != b:
        raise ValueError(f'{path}: values differ')
compare(actual, reference, '$')
print(json.dumps({'passed': True, **summary}))
