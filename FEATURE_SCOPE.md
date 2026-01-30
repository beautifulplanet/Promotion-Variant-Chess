# Feature Scope: UI Overhaul & Debug Mode

## ✅ COMPLETED

### 1. Debug Menu (press ` to toggle)
- ELO slider (100-10000)
- Era dropdown (jump to any of 20 eras)
- Piece style selector (ready for implementation)
- Force Win/Lose buttons (test story popups)
- FPS counter toggle

### 2. Taller Main Window
- Canvas height: 650 → 750
- Sidebar matches

### 3. Newspaper Background Redesign
- Removed cluttered 12-column layout
- Now 4 large readable story cards around game
- Clean header with title

### 4. Win/Lose Story Popup System
- 8 WIN stories (celebratory/sarcastic)
- 8 LOSE stories (self-deprecating)
- Animated popup on game end
- Auto-dismiss after 4 seconds

---

## 🔧 TODO

### 5. Chess Piece Style Menu
**Goal:** Allow players to switch between different piece styles

### Styles to Implement:
- **Classic 3D** (current) - Staunton-style PBR pieces
- **Fantasy 3D** - NEW: Glowing magical pieces with particle effects
- **Newspaper 2D** (current) - Unicode chess symbols  
- **Fantasy 2D** - NEW: Stylized hand-drawn fantasy pieces

### UI Location:
- Settings gear icon in sidebar → opens modal
- Or use debug menu selector
- Persist choice in save file

---

## 6. Graphics Improvements (Subway Surfer Style)

### What Subway Surfer Does Well:
1. **Bright, saturated colors** - Not realistic, but visually punchy
2. **Cel-shading / toon shading** - Distinct outlines
3. **Bloom/glow effects** - Makes things pop
4. **Simple geometry with bold textures** - Low poly but stylized
5. **Consistent art direction** - Everything fits the same style
6. **Smooth 60fps** - Never drops frames

### Recommended Improvements:
1. Add **bloom post-processing** (THREE.UnrealBloomPass)
2. Add **outline effect** on selected pieces
3. Increase **color saturation** in era palettes
4. Add **bounce animations** when pieces move
5. Add **particle bursts** on captures
6. Simplify environment assets (fewer polygons, bolder shapes)

---

## 6. Win/Lose Story Bank

### WIN Stories (Celebratory/Sarcastic):
```
1. "LOCAL GENIUS DEFEATS MACHINE, DEMANDS PARADE"
   Subhead: "It was a close game," lies victor
   
2. "OPPONENT RAGE-QUITS; CALLS IT 'TACTICAL RESIGNATION'"
   Subhead: Sources confirm they were losing badly

3. "BRILLIANT MOVE DISCOVERED TO BE COMPLETE ACCIDENT"
   Subhead: "I meant to do that," claims winner

4. "CHECKMATE DELIVERED WITH UNNECESSARY FLOURISH"
   Subhead: Winner took 47 seconds to make obvious move

5. "VICTORY LAP AROUND LIVING ROOM REPORTED"
   Subhead: Cat unimpressed
```

### LOSE Stories (Self-Deprecating):
```
1. "I WAS WINNING UNTIL I WASN'T"
   Subhead: A post-mortem analysis by someone in denial

2. "COMPUTER CHEATING SUSPECTED BY LOSER"
   Subhead: "It knew all my moves somehow"

3. "MOUSE SLIP BLAMED FOR 47TH CONSECUTIVE LOSS"
   Subhead: Mouse manufacturer issues no comment

4. "I COULD HAVE WON IF I PLAYED DIFFERENTLY"
   Subhead: Yes, that's how it works

5. "PLAYER DISCOVERS CHESS IS ACTUALLY HARD"
   Subhead: "Why didn't anyone warn me?"
```

---

## Implementation Order:
1. ✅ Debug menu (helps test everything else)
2. Taller window + newspaper layout fixes
3. Piece style menu + Fantasy pieces
4. Win/Lose story popup system
5. Graphics improvements (bloom, outlines)

---

## Files to Modify:
- `index.html` - Layout, debug panel, newspaper
- `main.ts` - Debug controls, story system
- `renderer3d.ts` - Piece styles, bloom, outlines
- `constants.ts` - New settings
- `saveSystem.ts` - Persist piece style choice
