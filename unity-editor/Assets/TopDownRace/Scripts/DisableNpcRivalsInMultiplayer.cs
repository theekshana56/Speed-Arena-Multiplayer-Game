// Canonical path: unity-editor/Assets/TopDownRace/Scripts/DisableNpcRivalsInMultiplayer.cs

using UnityEngine;

namespace TopDownRace
{
    public class DisableNpcRivalsInMultiplayer : MonoBehaviour
    {
        [Tooltip("If true, rivals are deactivated. If false, only their AI components are disabled.")]
        public bool deactivateRivals = true;

        void Start()
        {
            var netBridge = FindFirstObjectByType<TopDownRace.Net.NetworkBridge>();
            if (netBridge == null) return;

            var tagged = GameObject.FindGameObjectsWithTag("Rival");
            foreach (var go in tagged)
                DisableRival(go);

            foreach (var rivals in FindObjectsByType<MonoBehaviour>(FindObjectsSortMode.None))
            {
                if (rivals == null) continue;
                if (rivals.GetType().Name != "Rivals") continue;
                DisableRival(rivals.gameObject);
            }
        }

        void DisableRival(GameObject go)
        {
            if (go == null) return;
            if (deactivateRivals)
            {
                go.SetActive(false);
                return;
            }

            var rivals = go.GetComponent("Rivals") as Behaviour;
            if (rivals != null) rivals.enabled = false;
        }
    }
}
