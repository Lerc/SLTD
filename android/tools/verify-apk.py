#!/usr/bin/env python3
"""Check that the APK's web assets match srv exactly, including deleted files."""

import argparse
from pathlib import Path
from zipfile import ZipFile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    source = root / "srv"
    with ZipFile(args.apk) as apk:
        expected = {
            "assets/web/" + file.relative_to(source).as_posix(): file
            for file in source.rglob("*") if file.is_file()
        }
        packaged = {
            name for name in apk.namelist()
            if name.startswith("assets/web/") and not name.endswith("/")
        }
        missing = expected.keys() - packaged
        extra = packaged - expected.keys()
        changed = [name for name in expected.keys() & packaged
                   if apk.read(name) != expected[name].read_bytes()]
        if missing or extra or changed:
            raise SystemExit(f"Asset mismatch: missing={sorted(missing)}, "
                             f"extra={sorted(extra)}, changed={sorted(changed)}")
        if apk.read("assets/legal/LICENSE") != (root / "LICENSE").read_bytes():
            raise SystemExit("Bundled license does not match LICENSE")
        host = root / "android/app/src/main/assets/shell/host.js"
        if apk.read("assets/shell/host.js") != host.read_bytes():
            raise SystemExit("Bundled host adapter is stale")
    print(f"PASS {args.apk}: all {len(expected)} srv files, license, and host adapter match")


if __name__ == "__main__":
    main()
