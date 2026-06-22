#!/bin/bash

# Ensure we exit on any failure
set -e

# Automatically generate a key if one doesn't exist
if [ ! -f "tauri.key" ]; then
    echo "======================================"
    echo "🔑 Generating new Tauri signing keys..."
    echo "======================================"
    npx tauri signer generate --password "" --write-keys ./tauri.key
    echo "Keys generated! Your private key is in tauri.key and public key is in tauri.key.pub."
    echo ""
    echo "IMPORTANT: The public key inside src-tauri/tauri.conf.json must match the one in tauri.key.pub!"
    echo "If you just generated this, make sure you update the tauri.conf.json file with the new public key."
fi

# Load the private key into the environment so Tauri uses it to generate the .tar.gz and .sig files!
export TAURI_SIGNING_PRIVATE_KEY=$(cat tauri.key)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""

echo "======================================"
echo "🍏 Building for macOS (Native)"
echo "======================================"
# We explicitly build only the App bundle (-b app) to avoid the broken internal Tauri dmg builder
npm run tauri build -- -b app

echo "======================================"
echo "📦 Packaging macOS Installers & Updates..."
echo "======================================"
# Generate the beautifully formatted DMG manually
create-dmg \
  --volname "LuaDepot Installer" \
  --window-pos 200 120 \
  --window-size 600 400 \
  --icon-size 100 \
  --icon "LuaDepot.app" 150 190 \
  --app-drop-link 450 190 \
  LuaDepot.dmg \
  src-tauri/target/release/bundle/macos/LuaDepot.app

# Manually compress and sign the .app for the auto-updater
cd src-tauri/target/release/bundle/macos
tar -czf LuaDepot.app.tar.gz LuaDepot.app
npx tauri signer sign LuaDepot.app.tar.gz
cd ../../../../..

echo "======================================"
echo "🪟 Building for Windows (Cross-Compile)"
echo "======================================"
npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc -b nsis

echo "======================================"
echo "📦 Packaging Windows Updates..."
echo "======================================"
cd src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis
zip -j LuaDepot_0.1.0_x64-setup.exe.zip LuaDepot_0.1.0_x64-setup.exe
npx tauri signer sign LuaDepot_0.1.0_x64-setup.exe.zip
cd ../../../../../../..

echo "======================================"
echo "🐧 Linux Builds"
echo "======================================"
echo "⚠️ Your Mac cannot natively generate Linux apps. For Linux releases, please use the GitHub Actions workflow we created!"

echo "======================================"
echo "✅ Local builds completed!"
echo "======================================"

OUTPUT_DIR="$HOME/Downloads/LuaDepot_Releases"
WEBSITE_DIR="$OUTPUT_DIR/Website_Installers"
UPDATER_DIR="$OUTPUT_DIR/Auto_Updater_Files"

echo "📂 Organizing files for upload..."
mkdir -p "$WEBSITE_DIR"
mkdir -p "$UPDATER_DIR"

# 1. Website Release (Full Installers)
mv LuaDepot.dmg "$WEBSITE_DIR/" 2>/dev/null || true
cp src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/LuaDepot_0.1.0_x64-setup.exe "$WEBSITE_DIR/" 2>/dev/null || true

# 2. App Auto-Updater (Patches)
cp src-tauri/target/release/bundle/macos/LuaDepot.app.tar.gz "$UPDATER_DIR/" 2>/dev/null || true
cp src-tauri/target/release/bundle/macos/LuaDepot.app.tar.gz.sig "$UPDATER_DIR/" 2>/dev/null || true

cp src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/LuaDepot_0.1.0_x64-setup.exe.zip "$UPDATER_DIR/" 2>/dev/null || true
cp src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/LuaDepot_0.1.0_x64-setup.exe.zip.sig "$UPDATER_DIR/" 2>/dev/null || true

echo "🎉 Done! Your files have been organized into two folders."
echo "👉 Open Finder and go to: $OUTPUT_DIR"
