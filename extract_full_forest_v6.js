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

blocks.forEach(block => {
  const guidMatch = block.match(/guid: ([a-f0-9]+)/);
  if (guidMatch && GUID_MAP[guidMatch[1]]) {
    const guid = guidMatch[1];
    let x=0, y=0, rot=0;
    let isFinishLine = block.includes('value: 1') && block.includes('isFinishLine');
    if (block.includes('value: StartFinish')) isFinishLine = true;

    const lines = block.split('\n');
    lines.forEach((line, idx) => {
      // Direct position (GameObject Transform)
      if (line.includes('m_LocalPosition')) {
         const m = line.match(/x: ([-0-9.]+), y: ([-0-9.]+)/);
         if (m) { x = parseFloat(m[1]); y = parseFloat(m[2]); }
      }
      
      // Modification position (PrefabInstance)
      if (line.includes('m_LocalPosition.x')) {
        const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
        if(v) x = parseFloat(v[1]);
      }
      if (line.includes('m_LocalPosition.y')) {
        const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
        if(v) y = parseFloat(v[1]);
      }
      if (line.includes('m_LocalEulerAnglesHint.z')) {
        const v = lines[idx+1]?.match(/value: ([-0-9.]+)/);
        if(v) rot = parseFloat(v[1]);
      }
    });

    let type = GUID_MAP[guid];
    if (type === 'checkpoint' && isFinishLine) type = 'finish-line-1';
    results.push({ type, x, y, rot });
  }
});

fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`FINAL EXTRACTION: ${results.length} objects for the full Forest track!`);
