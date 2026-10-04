#!/bin/zsh
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
python3 "$repo_dir/scripts/generate_iphone_project.py" >/dev/null
build_root="/tmp/baymax-offline-device-build"
obj_root="/tmp/baymax-offline-device-obj"
rm -rf "$build_root" "$obj_root"
xcodebuild   -project "$repo_dir/ios/OfflineTravelDemo.xcodeproj"   -target OfflineTravelDemo   -configuration Debug   -sdk iphoneos   CODE_SIGNING_ALLOWED=NO   SYMROOT="$build_root"   OBJROOT="$obj_root"   build
app="$(find "$build_root" -type d -name 'OfflineTravelDemo.app' | head -1)"
test -n "$app"
echo "IPHONEOS_APP=$app"
