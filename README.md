# 🌧️ Monsoon Rooftops (मानसूनी छतें) • Neo-Mumbai 2088

A fast-paced, atmospheric 3D rooftop runner built with **Three.js** and **JavaScript**, running directly in your web browser. Sprint across the rain-slicked rooftops of futuristic Mumbai, leap across gaps, grab all 5 glowing Energy Cells, and land safely on Helipad 01.

---

## 🎮 How to Play

### Objectives
- **Automatic Forward Sprint:** Your courier automatically runs forward across the rooftops.
- **Rooftop Leaps:** Jump over open gaps between buildings.
- **5 Energy Cells (⚡):** Collect all 5 floating energy cells across the course. Each can only be collected once per run.
- **Reach Helipad 01:** Successfully traverse the 975-meter handcrafted course (approx. 48–50 seconds) to complete the level.
- **Avoid Falling:** Falling into the monsoon mist triggers Game Over with an immediate restart option.

### Controls
| Platform | Action | Control |
|---|---|---|
| **Desktop** | **Jump** | **[Spacebar]** or **[Left Mouse Click]** |
| **Mobile** | **Jump** | **[Tap Screen]** or tap the on-screen **[JUMP]** button |
| **Both** | **Pause / Resume** | **[P]**, **[Escape]**, or the **[⏸]** button on the HUD |
| **Both** | **Toggle Audio** | Click the **[🔊 / 🔇]** button on the top-right |

> **Jump Mechanics:**
> - **Anti-Repeat Protection:** Holding down the jump key will *not* cause continuous jumping; you must release and press again.
> - **Coyote Time (140ms):** You can still jump for a fraction of a second after stepping off a rooftop ledge.
> - **Jump Buffer (140ms):** Tapping jump right before landing queues the jump to fire immediately upon touchdown.
> - **Reliable Landing:** Continuous descending collision detection ensures your courier never clips or tunnels through rooftops.

---

## 🚀 How to Start the Game (For Non-Developers)

The game runs locally using Node.js and Vite.

### Step 1: Open Terminal in the Game Folder
In your terminal or PowerShell, make sure you are inside the game folder:
```powershell
cd f:\Gemini_anti\game
```

### Step 2: Start the Local Server
Run this single command:
```powershell
npm run dev
```

### Step 3: Open in Your Browser
Once started, open your web browser (Chrome, Edge, Firefox, or Safari) and visit:
👉 **`http://localhost:5173`**

Click **"LAUNCH RUN"** to start playing!

---

## 🛠️ Project Structure
```
game/
├── index.html           # Main HTML page & responsive HUD overlays
├── package.json         # Project configuration & scripts
├── README.md            # Simple gameplay & startup instructions
├── screenshot.png       # Live in-game screenshot artifact
├── src/
│   ├── main.js          # Game entry point
│   ├── game.js          # State machine, render loop, camera follow
│   ├── player.js        # Courier physics, swept landing collision, coyote time
│   ├── level.js         # Handcrafted 16-platform course & 5 collectible cells
│   ├── environment.js   # Lighting, monsoon rain particles, skyline & props
│   ├── audio.js         # Procedural Web Audio API sound engine (no external audio files)
│   ├── constants.js     # Physics, dimensions, color palettes
│   ├── style.css        # Cyberpunk UI, responsive layouts, HUD
│   └── verify-level.js  # Mathematical physics gap-verification script
└── test/
    ├── simulation.js    # Unit & end-to-end physics test suite (40 tests)
    └── browser-test.js  # Headless Chrome E2E browser automation test
```

---

## 🧪 Running Automated Tests

To verify physics, collision detection, and level clearance:
```powershell
npm test
# or
node test/simulation.js
```

To run the full Chrome end-to-end browser test with 0 console errors:
```powershell
node test/browser-test.js
```
