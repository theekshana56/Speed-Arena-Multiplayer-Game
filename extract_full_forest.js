const fs = require('fs');

const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';
const outputFile = 'd:/Speed arena multiplayer GITHUB/Speed-Arena-Multiplayer-Game/frontend/src/game/levels/track_forest.json';

if (!fs.existsSync(unityFile)) {
  console.error('Forest.unity not found at:', unityFile);
  process.exit(1);
}

const content = fs.readFileSync(unityFile, 'utf8');
const lines = content.split('\n');

const results = [];
let currentInstance = null;

// Map GUIDs to internal types
const GUID_MAP = {
  '41fb831aad69f1040b7433b0c6dd53f9': 'road-1',
  '29a5fc35d22a31c4e85e218bb8efd1f0': 'road-2',
  '9ba98c7e85630404b811d74690e6b02f': 'start-pos',
  'add96481182103d4cac11b3b73a803e4': 'checkpoint',
  '78933ba53b70f0e4f9602b2d63644729': 'tree-1',
  'feb33066d45903d4c9180136e445295f': 'ui-joystick',
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
      const nextLine = lines[i + 1];
      const match = nextLine.match(/value: ([-0-9.]+)/);
      if (match) currentInstance.x = parseFloat(match[1]);
    }
    if (line.includes('propertyPath: m_LocalPosition.y')) {
      const nextLine = lines[i + 1];
      const match = nextLine.match(/value: ([-0-9.]+)/);
      if (match) currentInstance.y = parseFloat(match[1]);
    }
    if (line.includes('propertyPath: m_LocalRotation.z')) {
      const nextLine = lines[i + 1];
      const match = nextLine.match(/value: ([-0-9.]+)/);
      if (match) {
        // Simple rotation mapping
        // Unity modifications usually store quaternions or property paths.
        // If it's a 2D scene, Z is the main rotation.
      }
    }
    if (line.includes('propertyPath: m_LocalEulerAnglesHint.z')) {
       const nextLine = lines[i + 1];
       const match = nextLine.match(/value: ([-0-9.]+)/);
       if (match) currentInstance.rot = parseFloat(match[1]);
    }
    if (line.includes('propertyPath: isFinishLine')) {
      const nextLine = lines[i + 1];
      const match = nextLine.match(/value: ([0-9]+)/);
      if (match) currentInstance.isFinishLine = match[1] === '1';
    }
    if (line.includes('value: FinishLine') || line.includes('value: StartFinish')) {
       currentInstance.isFinishLine = true;
    }
  }
  i++;
}
finalizeInstance(currentInstance);

// Post-processing to map isFinishLine back to type if needed
results.forEach(it => {
  if (it.type === 'checkpoint' && it.isFinishLine) {
    it.type = 'finish-line-1';
  }
});

fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`Extracted ${results.length} objects to ${outputFile}`);
