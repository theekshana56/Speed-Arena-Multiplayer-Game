#if UNITY_EDITOR
// Canonical path: unity-editor/Assets/TopDownRace/Editor/TrackLayoutImporter.cs
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace TopDownRace.Editor
{
    public static class TrackLayoutImporter
    {
        const string JsonResourcePath = "Assets/TopDownRace/Resources/track_forest.json";
        const string TrackRootName = "TrackRoot_Generated";
        /// <summary>Must match frontend GameCanvas FOREST_SCALE (world px per JSON unit).</summary>
        const float ForestScale = 20f;

        static readonly string[] PrefabPaths =
        {
            "Assets/TopDownRace/Prefabs/Gameplay/Road-1.prefab",
            "Assets/TopDownRace/Prefabs/Gameplay/Road-2.prefab",
            "Assets/TopDownRace/Prefabs/Gameplay/Checkpoint.prefab",
            "Assets/TopDownRace/Prefabs/Gameplay/StartPosition.prefab",
            "Assets/TopDownRace/Prefabs/Gameplay/SideGround.prefab",
            "Assets/TopDownRace/Prefabs/Gameplay/Plant-1.prefab",
        };

        [MenuItem("TopDownRace/Import Track From JSON")]
        public static void ImportTrack()
        {
            if (!File.Exists(JsonResourcePath))
            {
                EditorUtility.DisplayDialog(
                    "Track import",
                    "Missing " + JsonResourcePath + "\nRun Speed-Arena: npm run generate-track (in frontend)",
                    "OK");
                return;
            }

            foreach (var p in PrefabPaths)
            {
                if (AssetDatabase.LoadAssetAtPath<GameObject>(p) == null)
                {
                    EditorUtility.DisplayDialog("Track import", "Missing prefab: " + p, "OK");
                    return;
                }
            }

            var text = File.ReadAllText(JsonResourcePath);
            text = text.Trim();
            if (text.StartsWith("["))
                text = "{\"items\":" + text + "}";

            var data = JsonUtility.FromJson<TrackForestWrapper>(text);
            if (data?.items == null || data.items.Length == 0)
            {
                EditorUtility.DisplayDialog("Track import", "JSON parse failed or empty.", "OK");
                return;
            }

            var scene = SceneManager.GetActiveScene();
            if (!scene.isLoaded)
            {
                EditorUtility.DisplayDialog("Track import", "Open a scene first (e.g. Forest).", "OK");
                return;
            }

            var root = GameObject.Find(TrackRootName);
            if (root == null)
            {
                root = new GameObject(TrackRootName);
                Undo.RegisterCreatedObjectUndo(root, "Create TrackRoot");
            }
            else
            {
                var old = new List<GameObject>();
                for (var i = 0; i < root.transform.childCount; i++)
                    old.Add(root.transform.GetChild(i).gameObject);
                foreach (var o in old)
                    Undo.DestroyObjectImmediate(o);
            }

            var road1 = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPaths[0]);
            var road2 = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPaths[1]);
            var chkPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPaths[2]);
            var startPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPaths[3]);
            var sidePrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPaths[4]);
            var plantPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPaths[5]);

            var checkpointsForRtc = new List<Checkpoint>();
            var startTransforms = new List<Transform>();

            foreach (var item in data.items)
            {
                var t = item.type ?? "";
                GameObject prefab = null;
                if (t == "road-1") prefab = road1;
                else if (t == "road-2") prefab = road2;
                else if (t == "checkpoint") prefab = chkPrefab;
                else if (t == "finish-line-1") prefab = chkPrefab;
                else if (t == "start-pos") prefab = startPrefab;
                else if (t == "side-ground-1") prefab = sidePrefab;
                else if (t == "tree-1") prefab = plantPrefab;

                if (prefab == null)
                    continue;

                var go = (GameObject)PrefabUtility.InstantiatePrefab(prefab, root.transform);
                go.name = $"{t}-{item.name}";
                var pos = new Vector3(item.x * ForestScale, -item.y * ForestScale, 0f);
                go.transform.localPosition = pos;
                go.transform.localRotation = Quaternion.Euler(0f, 0f, item.rot);

                if (t == "checkpoint")
                {
                    var c = go.GetComponent<Checkpoint>();
                    if (c != null)
                    {
                        c.m_ID = item.id;
                        c.isFinishLine = false;
                        checkpointsForRtc.Add(c);
                    }
                }
                else if (t == "finish-line-1")
                {
                    var c = go.GetComponent<Checkpoint>();
                    if (c != null)
                    {
                        c.m_ID = 0;
                        c.isFinishLine = true;
                        checkpointsForRtc.Add(c);
                    }
                }
                else if (t == "start-pos")
                {
                    startTransforms.Add(go.transform);
                }

                Undo.RegisterCreatedObjectUndo(go, "Track piece");
            }

            checkpointsForRtc.Sort((a, b) => a.m_ID.CompareTo(b.m_ID));

            var rtcGo = GameObject.Find("track-control");
            if (rtcGo != null)
            {
                var rtc = rtcGo.GetComponent<RaceTrackControl>();
                if (rtc != null)
                {
                    var so = new SerializedObject(rtc);
                    var cp = so.FindProperty("m_Checkpoints");
                    cp.ClearArray();
                    for (var i = 0; i < checkpointsForRtc.Count; i++)
                    {
                        cp.InsertArrayElementAtIndex(i);
                        cp.GetArrayElementAtIndex(i).objectReferenceValue = checkpointsForRtc[i];
                    }

                    var sp = so.FindProperty("m_StartPositions");
                    sp.ClearArray();
                    for (var i = 0; i < startTransforms.Count; i++)
                    {
                        sp.InsertArrayElementAtIndex(i);
                        sp.GetArrayElementAtIndex(i).objectReferenceValue = startTransforms[i];
                    }

                    so.ApplyModifiedProperties();
                }
            }

            EditorSceneManager.MarkSceneDirty(scene);
            EditorUtility.DisplayDialog(
                "Track import",
                $"Imported {data.items.Length} items. Checkpoints wired: {checkpointsForRtc.Count}. Start grid: {startTransforms.Count}.",
                "OK");
        }

        [Serializable]
        class TrackForestWrapper
        {
            public TrackItemJson[] items;
        }

        [Serializable]
        class TrackItemJson
        {
            public string type;
            public float x;
            public float y;
            public float rot;
            public string name;
            public int id;
        }
    }
}
#endif
