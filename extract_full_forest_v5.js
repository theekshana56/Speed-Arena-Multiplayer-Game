const fs = require('fs');

const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';
const outputFile = 'd:/Speed arena multiplayer GITHUB/Speed-Arena-Multiplayer-Game/frontend/src/game/levels/track_forest.json';

const content = fs.readFileSync(unityFile, 'utf8');
const blocks = content.split('--- !u!');

const results = [];

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

// First, map IDs of Transforms to their positions/rotations
const transformMap = {}; // TransformID -> { x, y, rot }
// Then map GameObjects to their TransformIDs
const goMap = {}; // GOID -> TransformID
// Then map PrefabInstances to their IDs and properties
const prefabMap = {}; // PrefabID -> { guid, isFinishLine, x, y, rot }

blocks.forEach(block => {
  const lines = block.split('\n');
  const header = lines[0];
  const idMatch = header.match(/&(\d+)/);
  if (!idMatch) return;
  const id = idMatch[1];
  const type = header.split(' ')[0];

  if (type === '1') { // GameObject
    let transID = '';
    let guid = '';
    lines.forEach(l => {
      if (l.includes('component: {fileID:')) {
        const m = l.match(/fileID: (\d+)/);
        if (m) transID = m[1];
      }
      if (l.includes('m_CorrespondingSourceObject:')) {
        const m = l.match(/guid: ([a-f0-9]+)/);
        if (m) guid = m[1];
      }
    });
    // Store GO
    if (guid && GUID_MAP[guid]) {
       prefabMap[id] = { guid, type: 'go', transID };
    }
  } else if (type === '4') { // Transform
     let x=0, y=0, rot=0, goID='';
     lines.forEach((l, idx) => {
       if (l.includes('m_GameObject:')) {
         const m = l.match(/fileID: (\d+)/);
         if (m) goID = m[1];
       }
       if (l.includes('m_LocalPosition')) {
         const m = l.match(/x: ([-0-9.]+), y: ([-0-9.]+), z: ([-0-9.]+)/);
         if (m) { x = parseFloat(m[1]); y = parseFloat(m[3]); } // Unity Z is 2D Y
       }
       // Modifications
       if (l.includes('m_LocalPosition.x')) {
         const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
         if (v) x = parseFloat(v[1]);
       }
       if (l.includes('m_LocalPosition.z')) {
         const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
         if (v) y = parseFloat(v[1]);
       }
       if (l.includes('m_LocalEulerAnglesHint.z')) {
         const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
         if (v) rot = parseFloat(v[1]);
       }
     });
     transformMap[id] = { x, y, rot, goID };
  } else if (type === '1001') { // PrefabInstance
    let guid = '';
    let x=0, y=0, rot=0;
    let isFinishLine = false;
    lines.forEach((l, idx) => {
       if (l.includes('m_SourcePrefab:')) {
         const m = l.match(/guid: ([a-f0-9]+)/);
         if (m) guid = m[1];
       }
       // Modifications in instance
       if (l.includes('m_LocalPosition.x')) {
         const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
         if (v) x = parseFloat(v[1]);
       }
       if (l.includes('m_LocalPosition.z')) {
         const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
         if (v) y = parseFloat(v[1]);
       }
       if (l.includes('m_LocalEulerAnglesHint.z')) {
         const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
         if (v) rot = parseFloat(v[1]);
       }
       if (l.includes('isFinishLine') && lines[idx+1]?.includes('value: 1')) {
         isFinishLine = true;
       }
       if (l.includes('value: StartFinish')) isFinishLine = true;
    });
    if (guid && GUID_MAP[guid]) {
      prefabMap[id] = { guid, type: 'pi', x, y, rot, isFinishLine };
    }
  }
});

// Build results
Object.values(prefabMap).forEach(p => {
  if (p.type === 'pi') {
    let t = GUID_MAP[p.guid];
    if (t === 'checkpoint' && p.isFinishLine) t = 'finish-line-1';
    results.push({ type: t, x: p.x, y: p.y, rot: p.rot });
  } else if (p.type === 'go') {
    // GameObjects might have their transform elsewhere
    // Wait! Let's just look at every Transform that has a PrefabInstance ref
    // v3 script did that.
  }
});

// Robust alternative: Check all transforms that have a prefab instance or GO with guid
// Let's just use the fact that if a GUID appears in the file, it's an object.
// I'll scan for all "m_LocalPosition.x" property modifications and look back up for the guid.

console.log(`Extracted preliminary ${results.length} objects.`);

// REAL LAST DITCH: Scan file for blocks split by --- !u!1001 or --- !u!1 (unpacked prefabs)
// AND capture the FIRST local position modification seen in THAT block.

const simpleResults = [];
blocks.forEach(block => {
  const guidMatch = block.match(/guid: ([a-f0-9]+)/);
  if (guidMatch && GUID_MAP[guidMatch[1]]) {
    const guid = guidMatch[1];
    let x=0, y=0, rot=0;
    let isFinishLine = block.includes('value: 1') && block.includes('isFinishLine');
    if (block.includes('value: StartFinish')) isFinishLine = true;

    // Find first x
    let m = block.match(/m_LocalPosition.x[\s\S]*?value: ([-0-9.]+)/);
    if (m) x = parseFloat(m[1]);
    // Find first z (Y in our 2D)
    m = block.match(/m_LocalPosition.z[\s\S]*?value: ([-0-9.]+)/);
    if (m) y = parseFloat(m[1]);
    // Rotation
    m = block.match(/m_LocalEulerAnglesHint.z[\s\S]*?value: ([-0-9.]+)/);
    if (m) rot = parseFloat(m[1]);

    let type = GUID_MAP[guid];
    if (type === 'checkpoint' && isFinishLine) type = 'finish-line-1';
    simpleResults.push({ type, x, y, rot });
  }
});

fs.writeFileSync(outputFile, JSON.stringify(simpleResults, null, 2));
console.log(`Total extracted: ${simpleResults.length}`);
