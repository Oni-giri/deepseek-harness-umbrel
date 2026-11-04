#!/usr/bin/env python3
"""Point the DeepSeek Harness Umbrel app at a published image.

    update-app-store.py <app dir> <image@digest> <dsh version> <image version>

Rewrites the web service's image in docker-compose.yml, and in umbrel-app.yml
sets the app version and release notes. Leaves the files untouched when the
app already uses that image, so re-running a release changes nothing.

The app version is the image version (which is the dsh version for releases
made by update.yml). If the app already has that version, for a re-release of
the same dsh version, it gets a -1, -2, ... suffix instead.
"""

import re
import sys
from pathlib import Path

app_dir, image_ref, dsh_version, image_version = sys.argv[1:]
compose_path = Path(app_dir, "docker-compose.yml")
manifest_path = Path(app_dir, "umbrel-app.yml")

compose = compose_path.read_text()
image_line = re.compile(r"^(\s*image: )ghcr\.io/oni-giri/deepseek-harness:\S+$", re.M)
if not image_line.search(compose):
    sys.exit(f"{compose_path}: no ghcr.io/oni-giri/deepseek-harness image line")
if image_line.search(compose).group(0).strip() == f"image: {image_ref}":
    print(f"The app already uses {image_ref}")
    sys.exit(0)
compose_path.write_text(image_line.sub(lambda m: m.group(1) + image_ref, compose, count=1))

manifest = manifest_path.read_text()
current = re.search(r'^version: "(.*)"$', manifest, re.M).group(1)
version = image_version
if current == image_version or current.startswith(image_version + "-"):
    suffix = re.fullmatch(re.escape(image_version) + r"(?:-(\d+))?", current)
    version = f"{image_version}-{int(suffix.group(1) or 0) + 1}" if suffix else f"{image_version}-1"
manifest = re.sub(r'^version: ".*"$', f'version: "{version}"', manifest, count=1, flags=re.M)

notes = (
    f"Updates DeepSeek Harness to {dsh_version}. See what changed in DeepSeek's\n"
    f"  release notes: https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v{dsh_version}\n"
)
manifest, count = re.subn(r"^releaseNotes: >-\n(?:(?:  .*)?\n)*", f"releaseNotes: >-\n  {notes}", manifest, count=1, flags=re.M)
if count != 1:
    sys.exit(f"{manifest_path}: no releaseNotes block")
manifest_path.write_text(manifest)

print(f"App version {current} -> {version}, image {image_ref}")
