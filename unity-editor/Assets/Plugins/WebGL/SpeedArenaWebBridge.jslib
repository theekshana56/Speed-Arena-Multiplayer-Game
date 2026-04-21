// Canonical path: unity-editor/Assets/Plugins/WebGL/SpeedArenaWebBridge.jslib
//
// WebGL: NetworkBridge (C#) calls SpeedArenaPublishCarState(json) -> this function.
// React: UnityRaceCanvas sets window.__speedArenaBridge.onLocalCarState; must match this name.
//
// Calls into the browser: window.__speedArenaBridge.onLocalCarState(json)

mergeInto(LibraryManager.library, {
  SpeedArenaPublishCarState: function (ptr) {
    var json = UTF8ToString(ptr);
    try {
      if (typeof window !== 'undefined' && window.__speedArenaBridge &&
          typeof window.__speedArenaBridge.onLocalCarState === 'function') {
        window.__speedArenaBridge.onLocalCarState(json);
      }
    } catch (e) {
      console.error('[SpeedArenaWebBridge] onLocalCarState', e);
    }
  },
});
