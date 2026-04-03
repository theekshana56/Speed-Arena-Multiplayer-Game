// Canonical path in this repo: unity-editor/Assets/TopDownRace/Scripts/NetworkBridge.cs
// Merge this folder into your Unity project's Assets/.
// Add this component to any active GameObject; Awake renames it to "SpeedArenaNetBridge" for React SendMessage.
// Wire Local Player to your car root transform; optionally assign Remote Car Prefab.
// Call SetLapsCompleted from your lap / checkpoint logic (e.g. after RaceTrackControl fires).
//
// WebGL + React: DontDestroyOnLoad keeps this object alive across LoadMap scene loads.
// Set Local Player Tag (e.g. Player) on the car in Forest/Desert/Snow so the bridge re-binds after each track loads.

using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace TopDownRace.Net
{
    public class NetworkBridge : MonoBehaviour
    {
        const float PublishInterval = 1f / 30f;
        string _currentMapId = "";

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        static extern void SpeedArenaPublishCarState(string json);
#else
        static void SpeedArenaPublishCarState(string json) { Debug.Log("[NetworkBridge/WebGL stub] " + json); }
#endif

        [Serializable]
        class LocalIdentityPayload
        {
            public string playerId;
            public string roomId;
            public string carColor;
            public int gridSlot;
        }

        [Serializable]
        class ShaCarStateDto
        {
            public string playerId;
            public string roomId;
            public string carColor;
            public int gridSlot;
            public float x;
            public float y;
            public float angle;
            public float speed;
            public string status;
            public int lapsCompleted;
        }

        [Header("References")]
        [SerializeField] Transform localPlayer;
        [Tooltip("If set (e.g. Player), re-find the car after each LoadMap. Leave empty to use only the inspector Local Player reference (single-scene builds).")]
        [SerializeField] string localPlayerTag = "";
        [Tooltip("Optional: used for speed if present")]
        [SerializeField] Rigidbody2D localPlayerBody;
        [SerializeField] GameObject remoteCarPrefab;
        [Tooltip("Optional: four transforms (index 0–3) matching start grid slots. When set, local and remote snaps use gridSlot.")]
        [SerializeField] Transform[] startGridSlots;

        string _localPlayerId = "";
        string _roomId = "";
        string _carColor = "red";
        int _gridSlot;
        int _lapsCompleted;
        bool _isRacing;
        float _publishTimer;

        readonly Dictionary<string, Transform> _remoteRoots = new Dictionary<string, Transform>();

        static Sprite _remotePlaceholderSprite;

        /// <summary>
        /// Remote opponents should be driven only by network snapshots.
        /// If the prefab contains movement/AI/controllers or Rigidbody2D physics,
        /// Unity will "fight" our teleports and cars can jitter/warp rapidly.
        /// </summary>
        static void NeutralizeRemoteCar(GameObject go)
        {
            if (go == null) return;

            // Stop physics-based motion.
            var rbs = go.GetComponentsInChildren<Rigidbody2D>(true);
            for (int i = 0; i < rbs.Length; i++)
            {
                var rb = rbs[i];
                if (rb == null) continue;
                rb.isKinematic = true;
                rb.velocity = Vector2.zero;
                rb.angularVelocity = 0f;
            }

            // Stop any scripts from applying movement/input/AI.
            var mbs = go.GetComponentsInChildren<MonoBehaviour>(true);
            for (int i = 0; i < mbs.Length; i++)
            {
                var mb = mbs[i];
                if (mb == null) continue;
                mb.enabled = false;
            }
        }

        void Awake()
        {
            if (string.IsNullOrEmpty(gameObject.name) || gameObject.name != "SpeedArenaNetBridge")
                gameObject.name = "SpeedArenaNetBridge";

            DontDestroyOnLoad(gameObject);
            SceneManager.sceneLoaded += OnSceneLoaded;
            TryBindLocalPlayerFromScene();
        }

        void OnDestroy()
        {
            SceneManager.sceneLoaded -= OnSceneLoaded;
        }

        void OnSceneLoaded(Scene scene, LoadSceneMode mode)
        {
            TryBindLocalPlayerFromScene();
            TrySnapLocalPlayerToGridSlot();
        }

        /// <summary>
        /// Binds localPlayer after LoadMap (or first scene). Prefer Local Player Tag on the car in each track scene.
        /// </summary>
        void TryBindLocalPlayerFromScene()
        {
            if (!string.IsNullOrEmpty(localPlayerTag))
            {
                try
                {
                    var go = GameObject.FindGameObjectWithTag(localPlayerTag);
                    if (go != null)
                    {
                        localPlayer = go.transform;
                        localPlayerBody = go.GetComponent<Rigidbody2D>();
                        TrySnapLocalPlayerToGridSlot();
                        return;
                    }
                }
                catch (UnityException e)
                {
                    Debug.LogWarning("[NetworkBridge] Local Player Tag '" + localPlayerTag + "': " + e.Message);
                }
            }

            if (localPlayer != null)
                return;

            Debug.LogWarning("[NetworkBridge] Local player not bound — assign Local Player in the inspector, and for multi-scene / LoadMap set Local Player Tag and tag the car in Forest/Desert/Snow.");
        }

        void FixedUpdate()
        {
            if (string.IsNullOrEmpty(_localPlayerId) || localPlayer == null)
                return;

            _publishTimer += Time.fixedDeltaTime;
            if (_publishTimer < PublishInterval)
                return;
            _publishTimer = 0f;

            var wire = new ShaCarStateDto
            {
                playerId = _localPlayerId,
                roomId = _roomId,
                carColor = _carColor,
                gridSlot = Mathf.Clamp(_gridSlot, 0, 3),
                x = localPlayer.position.x,
                y = localPlayer.position.y,
                angle = localPlayer.eulerAngles.z,
                speed = localPlayerBody != null ? localPlayerBody.velocity.magnitude : 0f,
                status = _lapsCompleted >= 3 ? "FINISHED" : (_isRacing ? "RACING" : "WAITING"),
                lapsCompleted = _lapsCompleted
            };

            var json = JsonUtility.ToJson(wire);
            SpeedArenaPublishCarState(json);
        }

        /// <summary>Called from browser via SendMessage — JSON: {"playerId","roomId","carColor"}</summary>
        public void SetLocalIdentity(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            try
            {
                var id = JsonUtility.FromJson<LocalIdentityPayload>(json);
                if (id != null)
                {
                    _localPlayerId = id.playerId ?? "";
                    _roomId = id.roomId ?? "";
                    _carColor = string.IsNullOrEmpty(id.carColor) ? "red" : id.carColor;
                    _gridSlot = Mathf.Clamp(id.gridSlot, 0, 3);
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("[NetworkBridge] SetLocalIdentity parse: " + e.Message);
            }

            TrySnapLocalPlayerToGridSlot();
        }

        void TrySnapLocalPlayerToGridSlot()
        {
            if (localPlayer == null || startGridSlots == null || startGridSlots.Length == 0)
                return;
            var idx = Mathf.Clamp(_gridSlot, 0, startGridSlots.Length - 1);
            var slot = startGridSlots[idx];
            if (slot == null)
                return;
            var p = slot.position;
            localPlayer.position = new Vector3(p.x, p.y, localPlayer.position.z);
            var ez = slot.eulerAngles.z;
            localPlayer.rotation = Quaternion.Euler(0f, 0f, ez);
        }

        /// <summary>"1" / "true" = racing; anything else = waiting</summary>
        public void SetRacing(string flag)
        {
            _isRacing = flag == "1" || string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase);
        }

        public void SetLapsCompleted(int laps)
        {
            _lapsCompleted = Mathf.Max(0, laps);
        }

        /// <summary>
        /// Called from browser via SendMessage to switch Unity scenes.
        /// Requires scenes to be added to Unity Build Settings.
        /// mapId: "forest" | "desert" | "snow"
        /// </summary>
        public void LoadMap(string mapId)
        {
            if (string.IsNullOrEmpty(mapId)) return;
            mapId = mapId.Trim().ToLowerInvariant();
            if (_currentMapId == mapId) return;

            string sceneName = mapId switch
            {
                "forest" => "Forest",
                "desert" => "Desert",
                "snow" => "Snow",
                _ => ""
            };
            if (string.IsNullOrEmpty(sceneName)) return;

            // Avoid reloading if already on that scene.
            var active = SceneManager.GetActiveScene().name;
            if (string.Equals(active, sceneName, StringComparison.OrdinalIgnoreCase))
            {
                _currentMapId = mapId;
                return;
            }

            _currentMapId = mapId;
            SceneManager.LoadScene(sceneName);
        }

        /// <summary>React forwards each /topic/game-state body here.</summary>
        public void ApplyRemoteState(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            ShaCarStateDto dto;
            try
            {
                dto = JsonUtility.FromJson<ShaCarStateDto>(json);
            }
            catch
            {
                return;
            }

            if (dto == null || string.IsNullOrEmpty(dto.playerId) || dto.playerId == _localPlayerId)
                return;

            if (!string.IsNullOrEmpty(_roomId) && !string.IsNullOrEmpty(dto.roomId) &&
                !string.Equals(dto.roomId, _roomId, StringComparison.Ordinal))
                return;

            if (!_remoteRoots.TryGetValue(dto.playerId, out var t) || t == null)
            {
                GameObject go = InstantiateRemoteCar(dto.playerId, dto.carColor);
                if (go == null)
                    return;

                // Ensure remote cars are purely network-driven (no physics/controller jitter).
                NeutralizeRemoteCar(go);

                var rivals = go.GetComponent("Rivals") as Behaviour;
                if (rivals != null) rivals.enabled = false;

                t = go.transform;
                t.SetParent(transform, false);
                _remoteRoots[dto.playerId] = t;
            }

            ApplyCarColorToHierarchy(t, dto.carColor);
            t.position = new Vector3(dto.x, dto.y, t.position.z);
            t.rotation = Quaternion.Euler(0f, 0f, dto.angle);
        }

        GameObject InstantiateRemoteCar(string playerId, string carColorKey)
        {
            if (remoteCarPrefab != null)
            {
                var go = Instantiate(remoteCarPrefab);
                go.name = "Remote_" + playerId;
                return go;
            }

            var fallback = Resources.Load<GameObject>("SpeedArenaRemoteCar");
            if (fallback != null)
            {
                var go = Instantiate(fallback);
                go.name = "Remote_" + playerId;
                return go;
            }

            return CreatePlaceholderRemoteCar(playerId);
        }

        static GameObject CreatePlaceholderRemoteCar(string playerId)
        {
            if (_remotePlaceholderSprite == null)
            {
                var tex = Texture2D.whiteTexture;
                _remotePlaceholderSprite = Sprite.Create(
                    tex,
                    new Rect(0f, 0f, tex.width, tex.height),
                    new Vector2(0.5f, 0.5f),
                    100f);
            }

            var go = new GameObject("Remote_" + playerId);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = _remotePlaceholderSprite;
            sr.sortingOrder = 50;
            go.transform.localScale = new Vector3(1.8f, 0.9f, 1f);
            return go;
        }

        static void ApplyCarColorToHierarchy(Transform root, string carColorKey)
        {
            if (root == null) return;
            var c = ColorForCarKey(carColorKey);
            var srs = root.GetComponentsInChildren<SpriteRenderer>(true);
            for (var i = 0; i < srs.Length; i++)
            {
                if (srs[i] != null)
                    srs[i].color = c;
            }
        }

        static Color ColorForCarKey(string key)
        {
            if (string.IsNullOrEmpty(key)) return new Color(0.75f, 0.75f, 0.75f);
            switch (key.Trim().ToLowerInvariant())
            {
                case "red": return new Color(1f, 0.25f, 0.2f);
                case "blue": return new Color(0.2f, 0.65f, 1f);
                case "green": return new Color(0.2f, 0.95f, 0.55f);
                case "yellow": return new Color(1f, 0.85f, 0.2f);
                default: return new Color(0.85f, 0.85f, 0.9f);
            }
        }
    }
}
