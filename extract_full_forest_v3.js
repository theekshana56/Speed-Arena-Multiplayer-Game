const fs = require('fs');

const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';
const outputFile = 'd:/Speed arena multiplayer GITHUB/Speed-Arena-Multiplayer-Game/frontend/src/game/levels/track_forest.json';

const content = fs.readFileSync(unityFile, 'utf8');
const blocks = content.split('--- !u!');

const prefabs = {}; // ID -> { guid, isFinishLine }
const transforms = []; // { prefabRef, x, y, rot }

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

blocks.forEach(block => {
  const lines = block.split('\n');
  const header = lines[0];
  const idMatch = header.match(/&(\d+)/);
  if (!idMatch) return;
  const id = idMatch[1];

  if (header.startsWith('1001')) { // PrefabInstance
    let guid = '';
    let isFinishLine = false;
    block.split('\n').forEach((l, idx) => {
      if (l.includes('guid:')) {
        const m = l.match(/guid: ([a-f0-9]+)/);
        if (m) guid = m[1];
      }
      if (l.includes('isFinishLine') && lines[idx+1] && lines[idx+1].includes('value: 1')) {
        isFinishLine = true;
      }
      if (l.includes('value: StartFinish')) isFinishLine = true;
    });
    prefabs[id] = { guid, isFinishLine };
  } else if (header.startsWith('4')) { // Transform
    let prefabRef = '';
    let x=0, y=0, rot=0;
    block.split('\n').forEach((l, idx) => {
      if (l.includes('m_PrefabInstance:')) {
        const m = l.match(/fileID: (\d+)/);
        if (m) prefabRef = m[1];
      }
      if (l.includes('m_LocalPosition:')) {
         const m = l.match(/x: ([-0-9.]+), y: ([-0-9.]+), z: ([-0-9.]+)/);
         if (m) { x = parseFloat(m[1]); y = parseFloat(m[2]); }
      }
      // Or in modifications
      if (l.includes('m_LocalPosition.x') && lines[idx+1]) {
        const m = lines[idx+1].match(/value: ([-0-9.]+)/);
        if (m) x = parseFloat(m[1]);
      }
      if (l.includes('m_LocalPosition.y') && lines[idx+1]) {
        const m = lines[idx+1].match(/value: ([-0-9.]+)/);
        if (m) y = parseFloat(m[1]);
      }
      if (l.includes('m_LocalEulerAnglesHint.z') && lines[idx+1]) {
        const m = lines[idx+1].match(/value: ([-0-9.]+)/);
        if (m) rot = parseFloat(m[1]);
      }
    });
    if (prefabRef) transforms.push({ prefabRef, x, y, rot });
  }
});

const finalResults = transforms.map(t => {
  const p = prefabs[t.prefabRef];
  if (p && GUID_MAP[p.guid]) {
    let type = GUID_MAP[p.guid];
    if (type === 'checkpoint' && p.isFinishLine) type = 'finish-line-1';
    return { type, x: t.x, y: t.y, rot: t.rot };
  }
  return null;
}).filter(x => x !== null);

fs.writeFileSync(outputFile, JSON.stringify(finalResults, null, 2));
console.log(`Extracted ${finalResults.length} objects for the full Forest track!`);
