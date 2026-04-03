const fs = require('fs');

const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';
const outputFile = 'd:/Speed arena multiplayer GITHUB/Speed-Arena-Multiplayer-Game/frontend/src/game/levels/track_forest.json';

const content = fs.readFileSync(unityFile, 'utf8');
// Split by the start of any YAML object
const blocks = content.split('--- !u!');

const finalResults = [];

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
  if (!block.startsWith('1001')) return; // Only interested in PrefabInstances

  let guid = '';
  // Check for guid
  const guidMatch = block.match(/guid: ([a-f0-9]+)/);
  if (guidMatch) guid = guidMatch[1];
  
  if (!GUID_MAP[guid]) return;

  // Extract modifications
  let x=0, y=0, rot=0;
  let isFinishLine = false;

  const lines = block.split('\n');
  for(let i=0; i<lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('m_LocalPosition.x')) {
      const v = lines[i+1]?.match(/value: ([-0-9.]+)/);
      if(v) x = parseFloat(v[1]);
    }
    if (line.includes('m_LocalPosition.y')) {
      const v = lines[i+1]?.match(/value: ([-0-9.]+)/);
      if(v) y = parseFloat(v[1]);
    }
    if (line.includes('m_LocalPosition.z')) {
        // In 2D scenes, Z might be used for Y or sorting. 
        // But usually it's X/Y. Let's stick to X/Y for now based on Unity 2D standard.
        // Wait! In my previous successful Forest extraction, Z was used as Y? 
        // Let's check my first script: currentObject.y = parseFloat(coords[3]); (Z)
        // YES! Unity Z is 2D Y.
    }
    // Re-check Z for Y mapping
    if (line.includes('m_LocalPosition.z')) {
      const v = lines[i+1]?.match(/value: ([-0-9.]+)/);
      if(v) y = parseFloat(v[1]); // Unity Z is our 2D Y
    }

    if (line.includes('m_LocalEulerAnglesHint.z')) {
      const v = lines[i+1]?.match(/value: ([-0-9.]+)/);
      if(v) rot = parseFloat(v[1]);
    }
    if (line.includes('isFinishLine') && lines[i+1]?.includes('value: 1')) {
      isFinishLine = true;
    }
  }

  // Handle name based finish line flag
  if (block.includes('value: StartFinish') || block.includes('value: FinishLine')) {
    isFinishLine = true;
  }

  let type = GUID_MAP[guid];
  if (type === 'checkpoint' && isFinishLine) type = 'finish-line-1';

  finalResults.push({ type, x, y, rot });
});

fs.writeFileSync(outputFile, JSON.stringify(finalResults, null, 2));
console.log(`Successfully extracted ${finalResults.length} objects for the full Forest track!`);
