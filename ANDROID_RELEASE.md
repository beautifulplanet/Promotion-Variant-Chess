# Android / Google Play Store Release Guide

## Prerequisites

1. **Android Studio** — [Download](https://developer.android.com/studio)
   - During install, accept all SDK license agreements
   - Android Studio will install the Java JDK, Android SDK, and Gradle automatically
2. **Google Play Developer Account** — [$25 one-time fee](https://play.google.com/console/signup)

## Project Setup (Already Done)

The project uses **Capacitor** to wrap the web app as a native Android app.

| Config                | Value                    |
|-----------------------|--------------------------|
| App ID (package name) | `com.warchess.chronicle` |
| App Name              | War Chess                |
| Min SDK               | Android 7.0 (API 24)    |
| Target SDK            | API 36                   |
| Web dir               | `dist/`                  |

Icons and splash screens have been generated from the existing 512px icons into all required Android density buckets (mdpi → xxxhdpi).

## Quick Commands

```bash
# Sync web build → Android project
npm run android:sync

# Open in Android Studio (for signing, testing, debugging)
npm run android:open

# Run on connected device/emulator
npm run android:run

# Build release APK
npm run android:build

# Build release AAB (required for Play Store)
npm run android:bundle
```

## Step-by-Step: First Release

### 1. Install Android Studio
Download and install from https://developer.android.com/studio. Let it install default SDK components.

### 2. Set Environment Variables (Windows)
Add these to your system environment variables (or run in PowerShell):
```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
```

For permanent setup, add to System Environment Variables:
- `ANDROID_HOME` = `C:\Users\<you>\AppData\Local\Android\Sdk`
- Add to PATH: `%ANDROID_HOME%\platform-tools`

### 3. Sync & Open
```bash
npm run android:sync
npm run android:open
```

### 4. Generate a Signing Key
Google Play requires apps to be signed with a release key. Create one:

```bash
keytool -genkey -v -keystore war-chess-release.keystore -alias war-chess -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for passwords and identity info. **Save the keystore file and passwords somewhere safe** — you need them for every update.

### 5. Configure Signing in Android Studio
1. Open `android/` folder in Android Studio
2. Go to **Build → Generate Signed Bundle / APK**
3. Choose **Android App Bundle** (AAB) — required by Play Store since 2021
4. Select your keystore file, enter passwords
5. Choose **release** build variant
6. Click **Create**

The signed AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

### 6. Create Play Store Listing
1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in:
   - **App name**: War Chess - The Chess Chronicle
   - **Default language**: English (United States)
   - **App or game**: Game
   - **Free or paid**: Free
4. Accept declarations

### 7. Store Listing Content

**Title**: War Chess - The Chess Chronicle

**Short description** (80 chars max):
```
3D chess across 20 historical eras with AI opponents. Rise through time!
```

**Full description** (4000 chars max):
```
Journey through 20 stunning 3D eras in this unique chess experience! Battle AI opponents powered by Stockfish and a custom Rust WASM engine as you travel from the Stone Age to the distant Future.

★ 20 PROCEDURAL 3D WORLDS
Play chess in beautifully rendered environments from the Jurassic period through the Bronze Age, Medieval castles, Renaissance palaces, and beyond into the Future. Each era has unique visual themes, lighting, and atmospheric effects.

★ SMART AI OPPONENTS
Face off against AI powered by Stockfish and a custom Rust WebAssembly engine. The AI adapts to your skill level with an Elo rating system that grows as you improve.

★ PROMOTION VARIANT CHESS
A fresh twist on classic chess - earn additional pieces through gameplay! Build your inventory, deploy bonus pieces strategically, and develop your own opening strategies.

★ PROGRESSION SYSTEM
- Elo rating system tracks your improvement
- Level up to unlock new eras and features
- Streak bonuses reward consistent play
- Save and load your progress anytime

★ MULTIPLAYER
Create or join open tables to play against other players online. Each player brings their earned piece bank for fair, strategic matches.

★ NEWSPAPER THEME
The entire interface is styled as a classic newspaper front page - "Chess Wars Chronicle" - with game-reactive articles that respond to your moves, victories, and defeats.

★ FEATURES
• Full 3D chess with smooth camera controls
• Pan and orbit around the board
• Undo moves during single-player games
• Opening book recognition
• Move quality analysis
• Dark and light themes
• Works offline after first load
```

### 8. Screenshots
You'll need:
- **Phone**: At least 2 screenshots, 16:9 ratio (1080×1920 or similar)
- **7-inch tablet**: At least 1 screenshot (optional but recommended)
- **10-inch tablet**: At least 1 screenshot (optional but recommended)

Take screenshots from the app on an emulator or phone, showing:
1. The main chess board with newspaper layout
2. A game in progress with 3D pieces
3. Different era worlds (Jurassic, Medieval, Future, etc.)
4. The multiplayer open tables panel

### 9. Content Rating
1. Go to **Policy → App content → Content rating**
2. Fill out the IARC questionnaire
3. Expected rating: **Everyone** (no violence, no gambling, no user-generated content)

### 10. Privacy Policy
Your app already has one at `/privacy.html`. Set the Privacy Policy URL to:
```
https://your-vercel-domain.vercel.app/privacy.html
```

### 11. Upload & Review
1. Go to **Release → Production** (or start with **Internal testing** / **Closed testing**)
2. Click **Create new release**
3. Upload the `.aab` file
4. Add release notes:
   ```
   Initial release of War Chess - The Chess Chronicle!
   • 20 3D historical eras
   • AI powered by Stockfish + custom Rust WASM engine
   • Elo rating system
   • Multiplayer support
   • Full offline support
   ```
5. Submit for review

### Review Timeline
- **Internal testing**: Available immediately (up to 100 testers)
- **Closed/Open testing**: Usually 1-3 days review
- **Production**: Usually 1-7 days for first review

## Updating the App

For subsequent updates:

1. Bump version in `android/app/build.gradle`:
   ```gradle
   versionCode 2    // Increment by 1 each release
   versionName "1.1" // User-visible version
   ```
2. Build and sync:
   ```bash
   npm run android:sync
   npm run android:open
   ```
3. Generate signed AAB in Android Studio
4. Upload to Play Console

## Troubleshooting

**"SDK not found"**: Set `ANDROID_HOME` environment variable and restart your terminal.

**Gradle build fails**: Open `android/` in Android Studio and let it sync Gradle. Accept any SDK license agreements it prompts.

**White screen on device**: Run `npm run android:sync` to ensure the latest web build is copied.

**Icons look wrong**: Re-run the icon generation script or use Android Studio's Image Asset tool (right-click `res` → New → Image Asset).
