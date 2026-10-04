#!/bin/bash
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="$repo_dir/ios/build/OfflineTravelDemo.app"
mkdir -p "$output_dir"
sdk_dir="$(xcrun --sdk iphonesimulator --show-sdk-path)"
xcrun swiftc -parse-as-library -sdk "$sdk_dir" -target arm64-apple-ios17.0-simulator "$repo_dir/fixtures/iphone/OfflineBundle.swift" "$repo_dir/ios/OfflineTravelDemo/ModelInference.swift" "$repo_dir/ios/OfflineTravelDemo/TravelModel.swift" "$repo_dir/ios/OfflineTravelDemo/OfflineTravelApp.swift" -o "$output_dir/OfflineTravelDemo"
cp "$repo_dir/fixtures/iphone/offline_travel_bundle_v1.json" "$output_dir/"
cp "$repo_dir/fixtures/iphone/apollo_context_packet_v1.txt" "$output_dir/"
cp "$repo_dir/fixtures/iphone/OfflineTravelBundleFCO.json" "$output_dir/OfflineTravelBundleFCO.json"
cat > "$output_dir/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>works.biobit.baymax.offlinetravel.demo</string>
<key>CFBundleExecutable</key><string>OfflineTravelDemo</string>
<key>CFBundleName</key><string>OfflineTravelDemo</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>LSRequiresIPhoneOS</key><true/>
<key>MinimumOSVersion</key><string>17.0</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>UILaunchScreen</key><dict/>
</dict></plist>
PLIST
codesign --force --sign - "$output_dir"
echo "SIMULATOR_APP=$output_dir"
