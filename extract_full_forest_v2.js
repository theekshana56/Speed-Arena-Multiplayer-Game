const fs = require('fs');

const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';
const outputFile = 'd:/Speed arena multiplayer GITHUB/Speed-Arena-Multiplayer-Game/frontend/src/game/levels/track_forest.json';

const content = fs.readFileSync(unityFile, 'utf8');
const lines = content.split('\n');

const results = [];
let currentInstance = null;

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

function finalizeInstance(inst) {
  if (inst && GUID_MAP[inst.guid]) {
    results.push({
      type: GUID_MAP[inst.guid],
      x: inst.x || 0,
      y: inst.y || 0,
      rot: inst.rot || 0,
      isFinishLine: inst.isFinishLine || false
    });
  }
}

let i = 0;
while (i < lines.length) {
  const line = lines[i];

  if (line.includes('--- !u!1001')) {
    finalizeInstance(currentInstance);
    currentInstance = { guid: '', x: 0, y: 0, rot: 0, isFinishLine: false };
  }

  if (currentInstance) {
    if (line.includes('m_SourcePrefab:')) {
      const match = line.match(/guid: ([a-f0-9]+)/);
      if (match) currentInstance.guid = match[1];
    }

    if (line.includes('propertyPath: m_LocalPosition.x')) {
      const vLine = lines[i + 1];
      const match = vLine.match(/value: ([-0-9.]+)/);
      if (match) currentInstance.x = parseFloat(match[1]);
    }
    if (line.includes('propertyPath: m_LocalPosition.y')) {
      const vLine = lines[i + 1];
      const match = vLine.match(/value: ([-0-9.]+)/);
      if (match) currentInstance.y = parseFloat(match[1]);
    }
    if (line.includes('propertyPath: m_LocalEulerAnglesHint.z')) {
      const vLine = lines[i + 1];
      const match = vLine.match(/value: ([-0-9.]+)/);
      if (match) currentInstance.rot = parseFloat(match[1]);
    }
    if (line.includes('propertyPath: isFinishLine')) {
      const vLine = lines[i + 1];
      const match = vLine.match(/value: ([0-9]+)/);
      if (match) currentInstance.isFinishLine = match[1] === '1';
    }
    if (line.includes('value: StartFinish')) {
       currentInstance.isFinishLine = true;
    }
  }
  i++;
}
finalizeInstance(currentInstance);

results.forEach(it => {
  if (it.type === 'checkpoint' && it.isFinishLine) {
    it.type = 'finish-line-1';
  }
});

fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`Extracted ${results.length} objects for the full Forest track.`);
