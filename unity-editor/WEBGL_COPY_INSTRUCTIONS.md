# Copy Unity WebGL build into the React app

The game in the browser is **not** updated until you copy the Unity **Build** output into `frontend/public/unity-build/`.

## After each WebGL build

1. In Unity: **File → Build Settings → WebGL → Build** (choose any output folder, e.g. `D:\Builds\SpeedArenaWebGL`).
2. From the repo root, run PowerShell:

```powershell
cd "unity-editor"
.\copy-webgl-to-frontend.ps1 -UnityWebGlBuildFolder "D:\Builds\SpeedArenaWebGL"
```

Use the folder that **directly contains** the `Build` subfolder (Unity’s default layout: `.../SpeedArenaWebGL/Build/unity-build.data`, etc.).

3. Restart or hard-refresh the frontend dev server page (Ctrl+F5) so cached `.data` / `.wasm` are not reused.

4. Optional — verify required files are present:

```powershell
.\unity-editor\verify-webgl-in-frontend.ps1
```

This checks for `unity-build.data`, `unity-build.wasm`, and the loader/framework next to them (names must match [`UnityRaceCanvas.jsx`](../frontend/src/components/UnityRaceCanvas.jsx)).

## What the script does

`copy-webgl-to-frontend.ps1` merges the Unity output into `frontend/public/unity-build/` (overwrites matching files). It does not run Unity; you must build in the Editor first.
