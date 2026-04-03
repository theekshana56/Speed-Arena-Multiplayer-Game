// Canonical path: unity-editor/Assets/TopDownRace/Scripts/DisableNpcRivalSpawningInMultiplayer.cs

using System;
using System.Reflection;
using UnityEngine;

namespace TopDownRace
{
    public class DisableNpcRivalSpawningInMultiplayer : MonoBehaviour
    {
        [Tooltip("If true, disables any component named `Rivals` found in the scene.")]
        public bool disableRivalsAi = true;

        [Tooltip("If true, tries to neutralize GameControl-style spawners by reflection.")]
        public bool neutralizeSpawnerFields = true;

        void Awake()
        {
            var netBridge = FindFirstObjectByType<TopDownRace.Net.NetworkBridge>();
            if (netBridge == null) return;

            if (disableRivalsAi)
            {
                foreach (var mb in FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None))
                {
                    if (mb == null) continue;
                    if (mb.GetType().Name == "Rivals")
                        mb.enabled = false;
                }
            }

            if (neutralizeSpawnerFields)
            {
                foreach (var mb in FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None))
                {
                    if (mb == null) continue;
                    if (mb.GetType().Name != "GameControl") continue;

                    try
                    {
                        var t = mb.GetType();
                        var flags = BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic;
                        var f = t.GetField("m_RivalCarPrefab", flags);
                        if (f != null && typeof(GameObject).IsAssignableFrom(f.FieldType))
                            f.SetValue(mb, null);
                    }
                    catch (Exception)
                    {
                        // ignore
                    }
                }
            }
        }
    }
}
