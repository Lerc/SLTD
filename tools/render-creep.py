#!/usr/bin/env python3
"""Render one creep to PNG using the game's current scripts and a fresh Chrome process."""
import argparse
import base64
import functools
import html
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def creep_types():
    parents = dict(re.findall(r'class\s+(\w+)\s+extends\s+(\w+)', (ROOT / 'srv/entities.js').read_text()))
    def is_creep(name):
        while name in parents:
            name = parents[name]
            if name == 'Creep':
                return True
        return False
    return sorted(name for name in parents if is_creep(name))


def finite_positive(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError('must be a finite positive number')
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('type', nargs='?', help='creep class name; see --list-types')
    parser.add_argument('--list-types', action='store_true')
    parser.add_argument('--state', default='{}', help='JSON object or @path/to/state.json (visual property overrides)')
    parser.add_argument('-o', '--output', type=Path, default=Path('creep.png'))
    parser.add_argument('--size', type=int, default=384, help='square PNG size in pixels (default: 384)')
    parser.add_argument('--zoom', type=finite_positive, default=3, help='enlargement AFTER glow, 1 = native game pixels (default: 3)')
    parser.add_argument('--difficulty', type=finite_positive, default=1, help='health/shield scaling before state overrides')
    parser.add_argument('--background', default='#030708', help='background input color, #RRGGBB, before glow')
    parser.add_argument('--no-bars', action='store_true', help='omit health and shield points indicators')
    parser.add_argument('--no-glow', action='store_true', help='export the raw drawing before post-processing')
    parser.add_argument('--metadata', type=Path, help='also write resolved visual state and render settings to JSON')
    parser.add_argument('--browser', default=os.environ.get('SLTD_CHROME'), help='Chrome/Chromium executable (or SLTD_CHROME)')
    args = parser.parse_args()
    types = creep_types()
    if args.list_types:
        print('\n'.join(types))
        return
    if args.type not in types:
        parser.error('choose a creep type: ' + ', '.join(types))
    if not 32 <= args.size <= 2048:
        parser.error('--size must be between 32 and 2048')
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', args.background):
        parser.error('--background must be #RRGGBB')
    if args.output.suffix.lower() != '.png':
        parser.error('--output must end in .png')
    if args.metadata and args.metadata.resolve() == args.output.resolve():
        parser.error('--metadata must be a different file from --output')
    try:
        state_text = Path(args.state[1:]).read_text() if args.state.startswith('@') else args.state
        state = json.loads(state_text)
        if not isinstance(state, dict):
            raise ValueError('state must be a JSON object')
        json.dumps(state, allow_nan=False)
    except (OSError, ValueError) as error:
        parser.error(str(error))
    browser = args.browser or next((shutil.which(name) for name in ('google-chrome', 'chromium', 'chromium-browser') if shutil.which(name)), None)
    if not browser:
        parser.error('Chrome/Chromium not found; provide --browser PATH or SLTD_CHROME')
    request = dict(type=args.type, state=state, size=args.size, zoom=args.zoom, difficulty=args.difficulty,
                   background=args.background, bars=not args.no_bars, glow=not args.no_glow)

    # Use the actual entry point, assets and init(), but intercept onload before
    # the first frame. No bridge connection, running game, or copied renderer.
    page = (ROOT / 'srv/index.html').read_text()
    page = re.sub(r'<script>window\.WSB\s*=.*?</script>', '', page)
    page = re.sub(r'<script src="wsb-client\.js[^"]*"></script>', '', page)
    page = page.replace('</head>', '<script src="/__creep__/render.js"></script></head>')

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            path = urlsplit(self.path).path
            routes = {
                '/': ('text/html', page.encode()),
                '/__creep__/request.json': ('application/json', json.dumps(request, allow_nan=False).encode()),
                '/__creep__/render.js': ('text/javascript', (ROOT / 'tools/render-creep.js').read_bytes()),
            }
            if path not in routes:
                return super().do_GET()
            content_type, data = routes[path]
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(data)

    with ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT / 'srv'))) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            with tempfile.TemporaryDirectory(prefix='sltd-creep-') as profile:
                command = [browser, '--headless=new', '--disable-dev-shm-usage', '--no-first-run',
                           '--no-default-browser-check', '--disable-background-networking',
                           '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                           '--user-data-dir=' + profile, '--virtual-time-budget=5000', '--dump-dom',
                           f'http://127.0.0.1:{server.server_port}/']
                result = subprocess.run(command, capture_output=True, text=True, timeout=45)
        finally:
            server.shutdown()
            thread.join()
    match = re.search(r'<pre id="creep-render-result">(.*?)</pre>', result.stdout, re.S)
    if result.returncode or not match:
        raise RuntimeError('Browser rendering failed. ' + (result.stderr[-2400:] or 'No render result returned.'))
    response = json.loads(html.unescape(match.group(1)))
    if 'error' in response:
        raise RuntimeError(response['error'])
    png = base64.b64decode(response['png'], validate=True)
    if not png.startswith(b'\x89PNG\r\n\x1a\n'):
        raise RuntimeError('Browser did not return a PNG')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(png)
    if args.metadata:
        args.metadata.parent.mkdir(parents=True, exist_ok=True)
        args.metadata.write_text(json.dumps(response['metadata'], indent=2) + '\n')
    print(f'Wrote {args.output} ({args.size}×{args.size}, {args.type})')


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        print(f'error: {error}', file=sys.stderr)
        sys.exit(1)
