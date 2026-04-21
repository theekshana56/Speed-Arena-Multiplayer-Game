const fs = require('fs');
const path = require('path');

const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Desert.unity';
const outputFile = 'd:/Speed arena multiplayer GITHUB/Speed-Arena-Multiplayer-Game/frontend/src/game/levels/track_desert.json';

if (!fs.existsSync(unityFile)) {
  console.error('Desert.unity not found at:', unityFile);
  process.exit(1);
}

const content = fs.readFileSync(unityFile, 'utf8');
const lines = content.split('\n');

const results = [];
let currentObject = null;

lines.forEach((line, index) => {
  if (line.includes('m_Name:')) {
    const name = line.split('m_Name:')[1].trim();
    currentObject = { name, x: 0, y: 0, rot: 0 };
  }
  
  if (currentObject && line.includes('m_LocalPosition:')) {
    const coords = line.match(/x: ([-0-9.]+), y: ([-0-9.]+), z: ([-0-9.]+)/);
    if (coords) {
      currentObject.x = parseFloat(coords[1]);
      currentObject.y = parseFloat(coords[3]); // Z in Unity is Y in 2D top-down
    }
  }

  if (currentObject && line.includes('m_LocalRotation:')) {
     const rotMatch = line.match(/x: ([-0-9.]+), y: ([-0-9.]+), z: ([-0-9.]+), w: ([-0-9.]+)/);
     if (rotMatch) {
       // Simplified rotation extraction (Z axis for 2D)
       // We'll use the object name to infer the rotation if it's a fixed-rot sprite, 
       // but Unity usually stores quat. Let's just track it.
     }
  }

  if (line.trim() === '' && currentObject) {
    // Map object names to our sprite types
    let type = '';
    if (currentObject.name.toLowerCase().includes('road')) type = 'road-1';
    if (currentObject.name.toLowerCase().includes('bend')) type = 'road-bend-1';
    if (currentObject.name.toLowerCase().includes('tree')) type = 'tree-1';
    if (currentObject.name.toLowerCase().includes('cactus')) type = 'cactus-1';
    if (currentObject.name.toLowerCase().includes('finish')) type = 'finish-line-1';
    if (currentObject.name.toLowerCase().includes('start')) type = 'start-pos';
    if (currentObject.name.toLowerCase().includes('checkpoint')) type = 'checkpoint';

    if (type) {
      results.push({
        type,
        x: currentObject.x,
        y: currentObject.y,
        rot: 0 // Will need manual or deeper extraction for rotation
      });
    }
    currentObject = null;
  }
});

fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
console.log(`Extracted ${results.length} objects to ${outputFile}`);
