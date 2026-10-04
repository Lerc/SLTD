#!/usr/bin/env python3
"""Rebuild creep bar evaluations using tools/render-creep.py and live game glow."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).resolve().parent
TYPES = ['Basic', 'Zipper', 'Flyer', 'Ball', 'BigBall', 'Spikey', 'Mender',
         'Splitter', 'Shieldbug', 'Skimmer', 'Capacitor', 'Bulwark']
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'


def table(name, title, subtitle, cases, native=False):
    size = 128 if native else 384
    margin, gap, caption = 20, 16, 72
    columns = 4
    width = margin * 2 + columns * size + (columns - 1) * gap
    rows = (len(cases) + columns - 1) // columns
    header = 104
    image = Image.new('RGB', (width, header + rows * (size + caption + gap) + margin), '#071216')
    draw = ImageDraw.Draw(image)
    draw.text((margin, 16), title, font=ImageFont.truetype(FONT, 22 if native else 30), fill='#d4eeeb')
    draw.text((margin, 60), subtitle, font=ImageFont.truetype(FONT, 13 if native else 18), fill='#98bac4')
    for i, case in enumerate(cases):
        x = margin + (i % columns) * (size + gap)
        y = header + (i // columns) * (size + caption + gap)
        with Image.open(OUTPUT / (case['name'] + '.png')) as source:
            source = source.convert('RGB')
            if native:
                source = source.resize((size, size), Image.Resampling.NEAREST)
            image.paste(source, (x, y))
        draw.rectangle((x, y + size, x + size - 1, y + size + caption), fill='#16292e')
        draw.text((x + 8, y + size + 6), case['label'],
                  font=ImageFont.truetype(FONT, 13 if native else 22), fill='#d4eeeb')
        draw.text((x + 8, y + size + 36), case['caption'],
                  font=ImageFont.truetype(FONT, 10 if native else 15), fill='#98bac4')
    image.save(OUTPUT / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--jobs', type=int, default=3)
    args = parser.parse_args()
    source = """
require('./srv/nodemain.js');
const names = JSON.parse(process.argv[1]);
process.stdout.write(JSON.stringify(names.map(name => {
  const c = new globalThis[name]({preview:true});
  return {name, hitPoints:c.hitPoints, maxShield:c.maxShield};
})));
"""
    stats = json.loads(subprocess.check_output(['node', '-e', source, json.dumps(TYPES)], cwd=ROOT, text=True))
    cases, roster, critical, states, effects = [], [], [], [], []
    for info in stats:
        name, hp, shield = info['name'], info['hitPoints'], info['maxShield']
        for fraction, group, suffix in [(0.65, roster, ''), (0.10, critical, '-critical')]:
            state = {'damage': hp * (1 - fraction)}
            caption = f'Health {fraction:.0%}'
            if shield:
                state['shield'] = shield * fraction
                caption += f' | Shield {fraction:.0%}'
            if name == 'Flyer':
                state['boostCharge'] = fraction
                caption += f' | Energy {fraction:.0%}'
            case = dict(name=name + suffix, type=name, state=state, label=name, caption=caption)
            group.append(case)
            cases.append(case)
        if shield or name == 'Flyer':
            for label, fraction in [('full', 1), ('half', 0.5), ('low', 0.1), ('empty', 0)]:
                state = {'damage': hp * 0.35}
                state['shield' if shield else 'boostCharge'] = shield * fraction if shield else fraction
                case = dict(name=f'states/{name}-{label}', type=name, state=state,
                            label=f'{name} / {label}', caption=f'Health 65% | {"Shield" if shield else "Energy"} {fraction:.0%}')
                states.append(case)
                cases.append(case)
    lookup = {info['name']: info for info in stats}
    for name in ['Shieldbug', 'Skimmer', 'Capacitor', 'Bulwark']:
        info = lookup[name]
        case = dict(name=f'effects/{name}-impact', type=name,
                    state={'damage': info['hitPoints'] * 0.35, 'shield': info['maxShield'] * 0.35,
                           'shieldFlash': 1, 'shieldHitPoints': info['maxShield'] * 0.8},
                    label=f'{name} / impact', caption='Health 65% | Shield 35% / lost trace')
        effects.append(case)
        cases.append(case)
    for name, state, label, caption in [
        ('Capacitor', {'shield': lookup['Capacitor']['maxShield'] / 2, 'shieldRechargeTicks': 0},
         'Capacitor / charging', 'Health 65% | Shield 50% / arcs'),
        ('Flyer', {'boostCharge': 1, 'boostTicks': 120}, 'Flyer / full boost', 'Health 65% | Energy 100% / exhaust'),
        ('Flyer', {'boostCharge': 0.5, 'boostTicks': 60}, 'Flyer / half boost', 'Health 65% | Energy 50% / exhaust'),
        ('Flyer', {'boostCharge': 0.1, 'boostTicks': 12}, 'Flyer / low boost', 'Health 65% | Energy 10% / exhaust'),
    ]:
        state['damage'] = lookup[name]['hitPoints'] * 0.35
        case = dict(name='effects/' + label.replace(' / ', '-').replace(' ', '-'), type=name,
                    state=state, label=label, caption=caption)
        effects.append(case)
        cases.append(case)
    (OUTPUT / 'requests.json').write_text(json.dumps(cases, indent=2) + '\n')

    def render(case):
        path = OUTPUT / case['name']
        path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([sys.executable, str(ROOT / 'tools/render-creep.py'), case['type'],
                        '--state', json.dumps(case['state']), '--size', '384', '--zoom', '3',
                        '--output', str(path.with_suffix('.png')), '--metadata', str(path.with_suffix('.json'))],
                       cwd=ROOT, check=True, capture_output=True, text=True)
        return case['name']

    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = [executor.submit(render, case) for case in cases]
        for i, future in enumerate(as_completed(futures), 1):
            try:
                print(f'{i}/{len(cases)} {future.result()}', flush=True)
            except subprocess.CalledProcessError as error:
                raise RuntimeError(error.stderr or error.stdout) from error
    table('creep-table.png', 'CREEP BAR REVIEW', 'Current sizes | health, shield and energy at 65% | 3x native pixels', roster)
    table('native-table.png', 'CREEP BARS / NATIVE', 'Actual game pixel size | bank and health at 65%', roster, native=True)
    table('critical-table.png', 'CREEP BARS / CRITICAL', 'Health and banks at 10% | 3x native pixels', critical)
    table('bar-states.png', 'SHIELD AND ENERGY STATES', 'Full / half / low / empty | health at 65% | 3x native pixels', states)
    table('effect-states.png', 'BARS DURING EFFECTS', 'Shield impact / Capacitor charging / Flyer boost | 3x native pixels', effects)
    print('Wrote five comparison sheets, 52 renders and their metadata.', flush=True)


if __name__ == '__main__':
    main()
