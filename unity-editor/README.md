# Unity bridge assets (merge into your Unity project)

This folder mirrors a **Unity `Assets/` subtree** so you can copy it into an existing project without hunting loose files.

## Layout

| Path | Purpose |
|------|---------|
| `Assets/TopDownRace/Scripts/NetworkBridge.cs` | WebGL bridge; `Awake` forces GameObject name `SpeedArenaNetBridge` for React `SendMessage`. |
| `Assets/TopDownRace/Scripts/DisableTrackSelectorInMultiplayer.cs` | Hides track UI / disables selector scripts in multiplayer. Use **Extra UI / Script Name Hints** if built-in names miss your scene. |
| `Assets/TopDownRace/Scripts/DisableNpcRivalSpawningInMultiplayer.cs` | Disables `Rivals` AI and nulls `m_RivalCarPrefab` on `GameControl` when possible. |
| `Assets/TopDownRace/Scripts/DisableNpcRivalsInMultiplayer.cs` | Deactivates objects tagged `Rival` or with a `Rivals` component. |
| `Assets/Plugins/WebGL/SpeedArenaWebBridge.jslib` | Publishes car JSON to `window.__speedArenaBridge`. |
| `Assets/TopDownRace/Editor/TrackLayoutImporter.cs` | Editor menu to import track JSON (optional). |

## Merge steps

1. Copy `Assets/TopDownRace` and `Assets/Plugins` from this folder into your Unity project’s `Assets/` (merge folders).
2. Let Unity import; resolve any compile errors (your game scripts must expose types referenced by `TrackLayoutImporter`, e.g. `Checkpoint`, `RaceTrackControl`, or remove that file if unused).
3. Add **NetworkBridge** to an active GameObject (name is corrected at runtime to `SpeedArenaNetBridge`). The bridge uses **DontDestroyOnLoad** so it survives `LoadMap` scene loads; assign **Local Player Tag** on the car in Forest/Desert/Snow (see [`UNITY_BUILD_CHECKLIST.md`](UNITY_BUILD_CHECKLIST.md)). Assign **Remote Car Prefab** for other players’ cars (recommended). If it is empty, the bridge spawns a **visible white-sprite placeholder** tinted by `carColor` so remotes are never invisible; optional `Resources/SpeedArenaRemoteCar` prefab is used when present. React sends **`gridSlot` (0–3)** in `SetLocalIdentity` and in car-state JSON; the bridge publishes **`gridSlot`** over WebGL. Optionally assign **`startGridSlots`** (four transforms) so the local car snaps to the correct grid box on load.
4. Add the three `Disable*` components to a persistent GameObject (e.g. next to `GameControl`).
5. **File → Build Settings → WebGL → Build**, then run `copy-webgl-to-frontend.ps1` (see `WEBGL_COPY_INSTRUCTIONS.md`).
6. Hard-refresh the browser so the new `.data` / `.wasm` load.

See also `MULTIPLAYER_4P_SETUP.txt` and `COORDINATES.txt`.
