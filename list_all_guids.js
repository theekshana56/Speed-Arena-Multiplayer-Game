const fs = require('fs');
const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';

const content = fs.readFileSync(unityFile, 'utf8');
const guidRegex = /guid: ([a-f0-9]{32})/g;
let match;
const guids = {};

while ((match = guidRegex.exec(content)) !== null) {
  const g = match[1];
  guids[g] = (guids[g] || 0) + 1;
}

const entries = Object.entries(guids).sort((a,b) => b[1] - a[1]);
entries.forEach(([g, c]) => {
  console.log(`${g}: ${c}`);
});
