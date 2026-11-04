#!/usr/bin/env python3
"""Point the DeepSeek Harness Umbrel app at a published image.

    update-app-store.py <app dir> <image@digest> <dsh version>

Rewrites the web service's image in docker-compose.yml, and in umbrel-app.yml
sets the app version and release notes. Leaves the files untouched when the
app already uses that image, so re-running a release changes nothing.

The app version is the dsh version. When the app already ships that dsh
version (a rebuild, e.g. for a launcher change, tagged v<dsh>-<n>), its -N
suffix goes up by one instead, so Umbrel always sees a new version.
"""

import re
import sys
from pathlib import Path

app_dir, image_ref, dsh_version = sys.argv[1:]
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
same_dsh = re.fullmatch(re.escape(dsh_version) + r"(?:-(\d+))?", current)
version = f"{dsh_version}-{int(same_dsh.group(1) or 0) + 1}" if same_dsh else dsh_version
manifest = re.sub(r'^version: ".*"$', f'version: "{version}"', manifest, count=1, flags=re.M)

release_url = f"https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v{dsh_version}"
if same_dsh:
    notes = (
        f"Rebuilds the app's image; DeepSeek Harness itself stays at {dsh_version}.\n"
        f"  Settings, your API key and sessions are kept.\n"
    )
else:
    notes = (
        f"Updates DeepSeek Harness to {dsh_version}. See what changed in DeepSeek's\n"
        f"  release notes: {release_url}\n"
    )
manifest, count = re.subn(r"^releaseNotes: >-\n(?:(?:  .*)?\n)*", f"releaseNotes: >-\n  {notes}", manifest, count=1, flags=re.M)
if count != 1:
    sys.exit(f"{manifest_path}: no releaseNotes block")
manifest_path.write_text(manifest)

print(f"App version {current} -> {version}, image {image_ref}")
