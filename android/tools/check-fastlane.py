#!/usr/bin/env python3
"""Check the store listing against F-Droid's fastlane metadata limits.

    python3 android/tools/check-fastlane.py

Also applies the style rules `fdroid lint` uses for a recipe's Summary and
Description, which it never sees here because F-Droid takes them from this
listing, and requires a changelog for the versionCode in app/build.gradle, so a
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

# From fdroidserver's lint.py regex_checks, applied to the whole summary and to
# each description line as `fdroid lint` applies them.
summary_rules = [
    (re.compile(r'.*\b(free software|open source)\b.*', re.IGNORECASE),
     'no need to specify that the app is Free Software'),
    (re.compile(r'.*((your|for).*android|android.*(app|device|client|port|version))', re.IGNORECASE),
     'no need to specify that the app is for Android'),
    (re.compile(r'.*[a-z0-9][.!?]( |$)'), 'punctuation should be avoided'),
    (re.compile(r'^\s'), 'unnecessary leading space'),
    (re.compile(r'.*\s$'), 'unnecessary trailing space'),
]
description_rules = [
    (re.compile(r'.*\bhttp://'), 'use https:// links'),
    (re.compile(r'\s*[*#][^ .]'), 'invalid bulleted list'),
    (re.compile(r'^\s'), 'unnecessary leading space'),
    (re.compile(r'.*\s$'), 'unnecessary trailing space'),
]

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
    # F-Droid strips only the summary's newlines and keeps the description as is.
    summary_path = locale / 'short_description.txt'
    if summary_path.exists():
        summary = summary_path.read_text(encoding='utf-8').strip('\n')
        title_path = locale / 'title.txt'
        if title_path.exists() and summary.lower() == title_path.read_text(encoding='utf-8').strip().lower():
            problems.append(f'{summary_path.relative_to(android.parent)} is just the app name')
        for rule, message in summary_rules:
            if rule.match(summary):
                problems.append(f'{summary_path.relative_to(android.parent)}: {message}')
    description_path = locale / 'full_description.txt'
    if description_path.exists():
        description = description_path.read_text(encoding='utf-8')
        for number, line in enumerate(description.splitlines(), 1):
            for rule, message in description_rules:
                if rule.match(line):
                    problems.append(f'{description_path.relative_to(android.parent)} line {number}: {message}')
        if description != description.rstrip() + '\n':
            problems.append(f'{description_path.relative_to(android.parent)}: end with a single newline')
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
