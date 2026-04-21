// Canonical path: unity-editor/Assets/TopDownRace/Scripts/DisableTrackSelectorInMultiplayer.cs
// Hides in-game track UI and disables selector scripts when NetworkBridge is present.
// If built-in name hints miss your Hierarchy, add substrings in Extra UI / Script Name Hints in the Inspector.

using UnityEngine;

namespace TopDownRace
{
    public class DisableTrackSelectorInMultiplayer : MonoBehaviour
    {
        [Tooltip("If true, disables selector scripts as well as UI objects.")]
        public bool disableScripts = true;

        [Tooltip("If true, hides selector UI objects by name.")]
        public bool hideUiObjects = true;

        [Tooltip("Extra substrings to match against Transform names (manual fallback when built-in hints miss).")]
        [SerializeField] string[] extraUiNameHints;

        [Tooltip("Extra substrings to match against MonoBehaviour type names.")]
        [SerializeField] string[] extraScriptNameHints;

        static readonly string[] UiNameHints =
        {
            "Tracks",
            "TrackSelector",
            "MapSelector",
            "TrackSelect",
            "MapSelect",
        };

        static readonly string[] ScriptNameHints =
        {
            "TrackSelector",
            "TracksSelector",
            "MapSelector",
            "TrackSelect",
            "MapSelect",
            "SceneSelector",
            "TrackManager",
        };

        static bool MatchesAnySubstring(string value, string[] builtin, string[] extra)
        {
            if (string.IsNullOrEmpty(value)) return false;
            for (int i = 0; i < builtin.Length; i++)
            {
                if (value.Contains(builtin[i]))
                    return true;
            }
            if (extra != null)
            {
                for (int i = 0; i < extra.Length; i++)
                {
                    if (!string.IsNullOrEmpty(extra[i]) && value.Contains(extra[i]))
                        return true;
                }
            }
            return false;
        }

        void Start()
        {
            var netBridge = FindFirstObjectByType<TopDownRace.Net.NetworkBridge>();
            if (netBridge == null) return;

            if (disableScripts)
            {
                foreach (var mb in FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None))
                {
                    if (mb == null) continue;
                    var typeName = mb.GetType().Name;
                    if (MatchesAnySubstring(typeName, ScriptNameHints, extraScriptNameHints))
                        mb.enabled = false;
                }
            }

            if (hideUiObjects)
            {
                var transforms = FindObjectsByType<Transform>(FindObjectsSortMode.None);
                foreach (var t in transforms)
                {
                    if (t == null) continue;
                    var n = t.name;
                    if (MatchesAnySubstring(n, UiNameHints, extraUiNameHints))
                        t.gameObject.SetActive(false);
                }
            }
        }
    }
}
