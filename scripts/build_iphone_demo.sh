#!/bin/bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$repo_dir/scripts/generate_iphone_project.py" >/dev/null
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/baymax-iphone-mirror.XXXXXX")"
xcodebuild -project "$repo_dir/ios/OfflineTravelDemo.xcodeproj" -target OfflineTravelDemo -configuration Debug -sdk iphoneos CODE_SIGNING_ALLOWED=NO SYMROOT="$build_dir/products" OBJROOT="$build_dir/objects" build
app="$build_dir/products/Debug-iphoneos/OfflineTravelDemo.app"
test -d "$app"
echo "IPHONEOS_APP=$app"
echo "SIGNING=UNSIGNED_SELECT_TEAM_IN_XCODE"
