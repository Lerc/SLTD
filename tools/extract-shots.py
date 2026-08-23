#!/usr/bin/env python3
"""Read sltd-browser.sh output on stdin; write SHOT lines out as PNG files."""
import base64
import re
import sys

outdir = sys.argv[1]
for raw in sys.stdin:
    line = re.sub(r'^\[[^\]]*\]\s*', '', raw.rstrip('\n'))
    if line.startswith('SHOT\t'):
        _, name, data = line.split('\t', 2)
        png = base64.b64decode(data[data.find('base64,') + 7:])
        path = f'{outdir}/{name}.png'
        with open(path, 'wb') as f:
            f.write(png)
        print(f'wrote {path} ({len(png)} bytes)')
    else:
        print(line)
