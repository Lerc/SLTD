#!/usr/bin/env python3
"""Split palette-probe output into PNG files and JSON sample data."""
import base64
import json
import re
import sys

outdir = sys.argv[1]
for raw in sys.stdin:
    line = re.sub(r'^\[[^\]]*\]\s*', '', raw.rstrip('\n'))
    if line.startswith('SHOT\t'):
        _, name, data = line.split('\t', 2)
        png = base64.b64decode(data[data.find('base64,') + 7:])
        with open(f'{outdir}/{name}.png', 'wb') as f:
            f.write(png)
        print(f'  wrote {name}.png ({len(png)} bytes)')
    elif line.startswith('DATA\t'):
        _, name, data = line.split('\t', 2)
        with open(f'{outdir}/{name}.json', 'w') as f:
            json.dump(json.loads(data), f, indent=2)
        print(f'  wrote {name}.json')
    elif line.strip():
        print(f'  {line}')
