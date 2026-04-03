# Unity build checklist (Forest / Desert / Snow + React)

The web app calls `SendMessage("SpeedArenaNetBridge", "LoadMap", "forest"|"desert"|"snow")`. [`NetworkBridge.LoadMap`](Assets/TopDownRace/Scripts/NetworkBridge.cs) maps those ids to **scene names** (case-sensitive for `SceneManager.LoadScene`):

| `mapId` from browser | Unity scene name |
|----------------------|------------------|
| `forest` | `Forest` |
| `desert` | `Desert` |
| `snow` | `Snow` |

## In Unity Editor

1. **File → Build Settings → Scenes In Build** must list every scene you want `LoadMap` to load.
2. Scene **asset names** must match the table above exactly (rename `.unity` assets if needed).
3. Put a **boot / first** scene at index 0 (the WebGL loader always starts there). That scene must contain `NetworkBridge` on a GameObject (renamed at runtime to `SpeedArenaNetBridge`).
4. Each track scene (`Forest`, `Desert`, `Snow`) should include the player car. For `LoadMap` to work after the first scene, either:
   - Set **Local Player Tag** on `NetworkBridge` and tag the car the same way in each scene, or  
   - Ensure each scene’s hierarchy is consistent with how you assign **Local Player** (see README).

## After changing scenes or scripts

Rebuild **WebGL**, then copy the full output into `frontend/public/unity-build/` using [`copy-webgl-to-frontend.ps1`](copy-webgl-to-frontend.ps1).
