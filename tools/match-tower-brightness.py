#!/usr/bin/env python3
"""Reproduce the historical specialist tower brightness comparison.

Run from any directory. Requires Pillow, NumPy and Matplotlib. Adjusted images
are written under evaluations/tower-art/brightness/regenerated, alongside the
comparison reports. Current game assets are generated with tools/TowerMod.mjs.
"""
import json
import os
from pathlib import Path

import numpy as np
from PIL import Image

os.environ.setdefault('MPLCONFIGDIR', '/tmp/sltd-mpl')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / 'srv/images'
REPORT = ROOT / 'evaluations/tower-art/brightness'
ORIGINALS = REPORT / 'originals'
OUTPUT = REPORT / 'regenerated'
COEFFICIENTS = np.array([2126, 7152, 722], dtype=np.int64)


def read(path):
    return np.array(Image.open(path).convert('RGBA'))


def luma(rgba):
    # Integer keys avoid float ties; divide by 10,000 for sRGB luma in 0–255.
    return rgba[..., :3].astype(np.int64) @ COEFFICIENTS


def distribution(rgba):
    visible = rgba[..., 3] > 0
    values, inverse = np.unique(luma(rgba)[visible], return_inverse=True)
    weights = np.bincount(inverse, weights=rgba[..., 3][visible].astype(float))
    return values, weights / weights.sum()


def reference_distribution(prefix):
    # Equal weight per tower, independent of source dimensions/occupied area.
    parts = [distribution(read(IMAGES / f'{prefix}{i}.png')) for i in (1, 2, 3)]
    values, inverse = np.unique(np.concatenate([v for v, _ in parts]), return_inverse=True)
    weights = np.bincount(inverse, weights=np.concatenate([w / 3 for _, w in parts]))
    return values, weights


def match(rgba, reference):
    source_values, source_weights = distribution(rgba)
    ref_values, ref_weights = reference
    # Mid-ranks keep identical source colors identical; no spatial dithering.
    quantiles = np.cumsum(source_weights) - source_weights / 2
    mapped = np.interp(quantiles, np.cumsum(ref_weights), ref_values) / 10000
    source_luma = luma(rgba) / 10000
    desired = np.interp(source_luma * 10000, source_values, mapped)
    rgb = rgba[..., :3].astype(float)
    peak = rgb.max(axis=-1)
    # Scale RGB together while in gamut. For saturated highlights, mix toward
    # white only as far as necessary to achieve the requested luma (same hue).
    gain = np.minimum(desired / np.maximum(source_luma, 1e-9), 255 / np.maximum(peak, 1e-9))
    adjusted = rgb * gain[..., None]
    achieved = adjusted @ (COEFFICIENTS / 10000)
    white = np.clip((desired - achieved) / np.maximum(255 - achieved, 1e-9), 0, 1)
    adjusted += (255 - adjusted) * white[..., None]
    result = rgba.copy()
    visible = rgba[..., 3] > 0
    result[..., :3][visible] = np.rint(adjusted[visible]).clip(0, 255).astype(np.uint8)
    assert np.array_equal(result[..., 3], rgba[..., 3]), 'Alpha changed'
    assert np.array_equal(result[~visible], rgba[~visible]), 'Transparent pixels changed'
    return result


def stats(rgba):
    values, weights = distribution(rgba)
    values = values / 10000
    histogram = np.bincount(np.rint(values).astype(int), weights=weights, minlength=256)
    return {
        'mean': float(values @ weights),
        'nearBlackPercent': float(100 * weights[values < 8].sum()),
        'brightPercent': float(100 * weights[values >= 160].sum()),
        'histogram': histogram.tolist(),
    }


def average(items):
    return {key: np.mean([item[key] for item in items], axis=0).tolist()
            for key in ('mean', 'nearBlackPercent', 'brightPercent', 'histogram')}


def plot(report):
    fig, axes = plt.subplots(2, 2, figsize=(13, 8), layout='constrained')
    edges = [0, 8, 32, 64, 128, 160, 192, 224, 256]
    x = np.arange(len(edges) - 1)
    for row, layer in enumerate(('Body', 'Turret')):
        for offset, key, title, color in [(-.26, 'reference', 'Originals', '#268878'),
                                         (0, 'before', 'Generated before', '#bd7736'),
                                         (.26, 'after', 'Adjusted', '#6354b0')]:
            hist = np.array(report['summary'][layer][key]['histogram'])
            axes[row, 0].plot(np.arange(256), np.cumsum(hist), label=title, color=color)
            axes[row, 1].bar(x + offset, [100 * hist[a:b].sum() for a, b in zip(edges, edges[1:])],
                             width=.26, label=title, color=color)
        axes[row, 0].set(title=layer + ' — cumulative distribution', xlabel='Source sRGB luma',
                        ylabel='Fraction of visible pixels', xlim=(0, 255), ylim=(0, 1))
        axes[row, 1].set(title=layer + ' — brightness histogram', xlabel='Source sRGB luma bin',
                        ylabel='Visible pixels (%)', xticks=x,
                        xticklabels=[f'{a}–{b-1}' for a, b in zip(edges, edges[1:])])
        for axis in axes[row]:
            axis.legend()
    fig.suptitle('Tower source brightness: original references / generated / adjusted\n'
                 'Alpha-weighted foreground; equal weight per tower; bodies and weapons matched separately', fontsize=14)
    fig.savefig(REPORT / 'histogram-comparison.png', dpi=150)
    plt.close(fig)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    references = {name: stats(read(IMAGES / (name + '.png')))
                  for name in ('Tower1', 'Gun1', 'Tower2', 'Gun2', 'Tower3', 'Gun3')}
    targets = [reference_distribution('Tower'), reference_distribution('Gun')]
    report = {'metric': 'Rec.709-weighted sRGB luma, 0–255; alpha-weighted foreground',
              'references': references, 'towers': {}, 'summary': {}}
    originals = sorted(ORIGINALS.glob('*.png'))
    if not originals:
        raise FileNotFoundError(f'Historical originals are missing from {ORIGINALS}')
    for original in originals:
        path = OUTPUT / original.name
        rgba = read(original)
        assert rgba.shape[1] == 2 * rgba.shape[0], 'Expected two square atlas cells'
        half = rgba.shape[1] // 2
        frames = [rgba[:, :half], rgba[:, half:]]
        adjusted = [match(frame, target) for frame, target in zip(frames, targets)]
        result = np.concatenate(adjusted, axis=1)
        assert np.array_equal(result[..., 3], rgba[..., 3])
        Image.fromarray(result).save(path, optimize=True)
        saved = read(path)
        assert np.array_equal(saved, result), 'PNG round-trip changed pixels'
        report['towers'][path.stem] = {
            layer: {'before': stats(before), 'after': stats(after)}
            for layer, before, after in zip(('Body', 'Turret'), frames, adjusted)
        }
    for layer, prefix in [('Body', 'Tower'), ('Turret', 'Gun')]:
        summary = {'reference': average([references[f'{prefix}{i}'] for i in (1, 2, 3)])}
        for stage in ('before', 'after'):
            summary[stage] = average([tower[layer][stage] for tower in report['towers'].values()])
        report['summary'][layer] = summary
        print(layer, {stage: {k: round(v, 2) for k, v in stats.items() if k != 'histogram'}
                      for stage, stats in summary.items()})
    (REPORT / 'comparison.json').write_text(json.dumps(report, indent=2) + '\n')
    plot(report)


if __name__ == '__main__':
    main()
