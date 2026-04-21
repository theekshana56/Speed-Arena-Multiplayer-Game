const fs = require('fs');

const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';
const outputFile = 'd:/Speed arena multiplayer GITHUB/Speed-Arena-Multiplayer-Game/frontend/src/game/levels/track_forest.json';

const GUID_MAP = {
  "add96481182103d4cac11b3b73a803e4": "checkpoint",
  "41fb831aad69f1040b7433b0c6dd53f9": "road-1",
  "29a5fc35d22a31c4e85e218bb8efd1f0": "road-2",
  "8bbb4bdb4d10476479c5f2d118a7e802": "start-pos",
  "9ba98c7e85630404b811d74690e6b02f": "start-pos",
  "78933ba53b70f0e4f9602b2d63644729": "tree-1",
  "9ab2fcafe35d1d5458c2cff7c711562e": "tree-1",
  "a3d38e52f3cc07040804e0f4ce79b6a5": "tree-1"
};

const content = fs.readFileSync(unityFile, 'utf8');
const blocks = content.split('--- !u!');

const results = [];

blocks.forEach(block => {
  // We care about PrefabInstances (1001) that contain many nested objects (modifications)
  if (!block.startsWith('1001')) return;

  // Each PrefabInstance block contains a list of modifications
  // Modifications start with "- target:"
  const modParts = block.split('    - target:');
  
  // We'll store objects seen in this PREFAB INSTANCE by their nested fileID
  const localObjects = {}; // fileID -> { guid, x, y, rot, isFinishLine }

  modParts.forEach(mod => {
    const guidMatch = mod.match(/guid: ([a-f0-9]+)/);
    const fileIdMatch = mod.match(/{fileID: (\d+)/);
    
    if (guidMatch && fileIdMatch && GUID_MAP[guidMatch[1]]) {
      const guid = guidMatch[1];
      const fid = fileIdMatch[1];
      
      if (!localObjects[fid]) {
        localObjects[fid] = { guid, x: 0, y: 0, rot: 0, isFinishLine: false };
      }

      // Check current modified property
      const lines = mod.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('m_LocalPosition.x')) {
          const v = mod.match(/value: ([-0-9.]+)/);
          if (v) localObjects[fid].x = parseFloat(v[1]);
        }
        if (l.includes('m_LocalPosition.y')) {
          const v = mod.match(/value: ([-0-9.]+)/);
          if (v) localObjects[fid].y = parseFloat(v[1]);
        }
        if (l.includes('m_LocalPosition.z')) {
           // For 2D top-down, Z is usually our Y
           const v = mod.match(/value: ([-0-9.]+)/);
           if (v) localObjects[fid].y = parseFloat(v[1]);
        }
        if (l.includes('m_LocalEulerAnglesHint.z')) {
          const v = mod.match(/value: ([-0-9.]+)/);
          if (v) localObjects[fid].rot = parseFloat(v[1]);
        }
        if (l.includes('isFinishLine') && mod.includes('value: 1')) {
          localObjects[fid].isFinishLine = true;
        }
      });
      if (mod.includes('value: StartFinish')) localObjects[fid].isFinishLine = true;
    }
  });

  // Export local objects identified in this prefab
  Object.values(localObjects).forEach(obj => {
    let type = GUID_MAP[obj.guid];
    if (type === 'checkpoint' && obj.isFinishLine) type = 'finish-line-1';
    results.push({ type, x: obj.x, y: obj.y, rot: obj.rot });
  });
});

fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`COMPREHENSIVE EXTRACTION: Successfully captured ${results.length} nested objects!`);
