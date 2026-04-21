const fs = require('fs');
const path = require('path');

const prefabsDir = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Prefabs/Gameplay';
const files = fs.readdirSync(prefabsDir);

const map = {};
files.forEach(f => {
  if (f.endsWith('.meta')) {
    const content = fs.readFileSync(path.join(prefabsDir, f), 'utf8');
    const match = content.match(/guid: ([a-f0-9]+)/);
    if (match) {
      const prefabName = f.replace('.prefab.meta', '').toLowerCase();
      map[match[1]] = prefabName;
    }
  }
});

console.log(JSON.stringify(map, null, 2));
