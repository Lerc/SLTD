#!/usr/bin/env python3
"""Check the store listing against F-Droid's fastlane metadata limits.

    python3 android/tools/check-fastlane.py

Also requires a changelog for the versionCode in app/build.gradle, so a
release cannot ship without its notes.
"""
import pathlib
import re
import sys

android = pathlib.Path(__file__).resolve().parent.parent
# F-Droid reads the listing only from the root of the source checkout.
listing = android.parent / 'fastlane/metadata/android'
limits = {'title.txt': 50, 'short_description.txt': 80, 'full_description.txt': 4000}
changelog_limit = 500

problems = []
locales = [path for path in listing.iterdir() if path.is_dir()]
if not locales:
    problems.append(f'no locales in {listing}')
for locale in locales:
    for name, limit in limits.items():
        path = locale / name
        if not path.exists():
            problems.append(f'{path.relative_to(android.parent)} is missing')
            continue
        text = path.read_text(encoding='utf-8').strip()
        if not text:
            problems.append(f'{path.relative_to(android.parent)} is empty')
        elif len(text) > limit:
            problems.append(f'{path.relative_to(android.parent)} has {len(text)} characters; the limit is {limit}')
    for path in sorted((locale / 'changelogs').glob('*.txt')):
        length = len(path.read_text(encoding='utf-8').strip())
        if length > changelog_limit:
            problems.append(f'{path.relative_to(android.parent)} has {length} characters; the limit is {changelog_limit}')

gradle = (android / 'app/build.gradle').read_text(encoding='utf-8')
version_code = re.search(r'versionCode\s+(\d+)', gradle).group(1)
for locale in locales:
    if locale.name == 'en-US' and not (locale / 'changelogs' / f'{version_code}.txt').exists():
        problems.append(f'{locale.name} has no changelog for versionCode {version_code}')

for problem in problems:
    print('FAIL', problem)
if problems:
    sys.exit(1)
print(f'PASS fastlane metadata for {len(locales)} locale(s), versionCode {version_code}')
