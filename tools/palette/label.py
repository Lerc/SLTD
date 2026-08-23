#!/usr/bin/env python3
"""Annotate captured glow-probe charts with the parameters that produced them.

Labels are drawn *after* capture, onto the PNG, so no label text ever passes
through the bloom shader and contaminates the measurement.

Each chart gets an extended canvas: the captured frame on the left, a legend
listing input -> output for every swatch on the right, plus a header naming the
glow settings in force.

    tools/palette/label.py [outdir]
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
LABELLED = os.path.join(OUTDIR, 'labelled')

ROW_H = 30             # legend entry height (two text lines)
COL_W = 300            # legend column width
HEADER_H = 96
BG = (18, 18, 22)
FG = (232, 232, 238)
DIM = (150, 150, 162)
ACCENT = (120, 220, 255)


def font(size, bold=False):
    names = [
        'DejaVuSansMono-Bold.ttf' if bold else 'DejaVuSansMono.ttf',
        'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf',
    ]
    for n in names:
        for base in ('/usr/share/fonts/truetype/dejavu/',
                     '/usr/share/fonts/TTF/', '/usr/share/fonts/'):
            p = os.path.join(base, n)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()


F_TITLE = font(24, True)
F_SUB = font(15)
F_MONO = font(14)
F_SMALL = font(12)


def swatch(draw, x, y, rgb, size=13):
    draw.rectangle([x, y, x + size, y + size], fill=tuple(rgb),
                   outline=(90, 90, 100))


def describe(s):
    """One-line parameter description for a sampled region."""
    kind = s.get('kind')
    lvl = int(round(s.get('level', 0) * 100))
    if kind == 'line':
        return f"{s['hue']:<8} {lvl:>3}%  w={s['width']:<2}"
    if kind == 'block':
        return f"{s['hue']:<8} {lvl:>3}%  fill"
    if kind in ('bar', 'thinline'):
        tag = 'bar' if kind == 'bar' else '1px'
        return f"grey {s['input'][0]:>3}     {tag}"
    if kind == 'size':
        return f"square {s['size']:>2}px {lvl:>3}%"
    return f"{kind:<10} {lvl:>3}%"


def label_chart(name):
    png = os.path.join(OUTDIR, f'{name}.png')
    js = os.path.join(OUTDIR, f'{name}.json')
    if not (os.path.exists(png) and os.path.exists(js)):
        return None

    with open(js) as f:
        data = json.load(f)
    samples = data['samples']
    st = data['settings']

    src = Image.open(png).convert('RGB')

    # Legend is laid out in as many columns as it takes to fit the height.
    rows_per_col = max(1, (src.height - 20) // ROW_H)
    ncols = max(1, (len(samples) + rows_per_col - 1) // rows_per_col)
    panel_w = ncols * COL_W + 32

    title = {
        'ramp': 'Greyscale ramp — solid bar vs 1px line',
        'blocks': 'Solid blocks — hue x brightness',
        'context': 'Feature size vs brightness — small features never reach full brightness',
    }.get(name, f"Lines — {data.get('arg') or ''}: width x brightness")

    subtitle = (f"glow: threshold={st['threshold']}  bloom={st['bloom']}  "
                f"blurLevel={st['blurLevel']}  exposure={st['exposure']}")
    caption = ("left: captured post-glow frame   right: input RGB (as drawn) "
               "-> output RGB (measured on screen)")

    # Canvas must fit the header text as well as the image + legend.
    text_w = 32 + max(F_TITLE.getlength(title), F_SUB.getlength(subtitle),
                      F_SMALL.getlength(caption))
    W = int(max(src.width + panel_w, text_w))
    H = max(src.height, min(len(samples), rows_per_col) * ROW_H + 20) + HEADER_H
    out = Image.new('RGB', (W, H), BG)
    out.paste(src, (0, HEADER_H))
    d = ImageDraw.Draw(out)

    d.text((16, 14), title, font=F_TITLE, fill=FG)
    d.text((16, 46), subtitle, font=F_SUB, fill=ACCENT)
    d.text((16, 66), caption, font=F_SMALL, fill=DIM)

    # Legend
    x0 = src.width + 16
    d.text((x0, HEADER_H - 22), "  parameters          input  ->  output",
           font=F_SMALL, fill=DIM)

    for i, s in enumerate(samples):
        col, row = divmod(i, rows_per_col)
        x = x0 + col * COL_W
        y = HEADER_H + 6 + row * ROW_H

        inp = s['input']
        outp = s['output']
        swatch(d, x, y + 1, inp)
        swatch(d, x + 17, y + 1, outp)
        d.text((x + 38, y), describe(s), font=F_MONO, fill=FG)
        d.text((x + 38, y + ROW_H // 2 - 1),
               f"  {inp[0]:>3},{inp[1]:>3},{inp[2]:>3} -> {outp[0]:>3},{outp[1]:>3},{outp[2]:>3}",
               font=F_SMALL, fill=DIM)

    os.makedirs(LABELLED, exist_ok=True)
    dest = os.path.join(LABELLED, f'{name}.png')
    out.save(dest)
    return dest


def main():
    names = [f[:-5] for f in sorted(os.listdir(OUTDIR)) if f.endswith('.json')]
    if not names:
        print(f'no chart data in {OUTDIR}', file=sys.stderr)
        return 1
    for n in names:
        dest = label_chart(n)
        if dest:
            print(f'wrote {dest}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
