#!/bin/bash
# Puts Insider in /Applications as a real Mac app (main.swift: one window with a WebKit view showing index.html),
# so it runs without a browser and can be kept in the Dock.
# The game folder path is baked into Info.plist: re-run this script if the folder moves (or after changing main.swift).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-/Applications}/Insider.app"
rm -rf "$APP"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O "$ROOT/app/main.swift" -o "$APP/Contents/MacOS/Insider"
cp "$ROOT/app/icon.icns" "$APP/Contents/Resources/icon.icns"
cat > "$APP/Contents/Info.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Insider</string>
  <key>CFBundleDisplayName</key><string>Insider</string>
  <key>CFBundleIdentifier</key><string>eu.vandenbruwaene.insider</string>
  <key>CFBundleExecutable</key><string>Insider</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>GameFolder</key><string>$ROOT</string>
</dict></plist>
PL
codesign --force --sign - "$APP" >/dev/null 2>&1 || true
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
echo "installed: $APP"
# an alias in ~/Games (the Dock's Games folder), named without ".app"
if [ -d "$HOME/Games" ] && [ ! -e "$HOME/Games/Insider" ]; then
  osascript -e "tell application \"Finder\" to make alias file to POSIX file \"$APP\" at POSIX file \"$HOME/Games\"" >/dev/null
  mv "$HOME/Games/Insider.app" "$HOME/Games/Insider" 2>/dev/null || true
  echo "alias: ~/Games/Insider"
fi
