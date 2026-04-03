const fs = require('fs');
const unityFile = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';

const content = fs.readFileSync(unityFile, 'utf8');
const lines = content.split('\n');

const guidToNames = {};
let currentGuid = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('m_SourcePrefab:')) {
    const match = line.match(/guid: ([a-f0-9]+)/);
    if (match) currentGuid = match[1];
  }
  if (currentGuid && line.includes('value:')) {
    const nameMatch = line.match(/value: (.*)/);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (!guidToNames[currentGuid]) guidToNames[currentGuid] = new Set();
      guidToNames[currentGuid].add(name);
    }
  }
}

Object.entries(guidToNames).forEach(([guid, names]) => {
  console.log(`GUID: ${guid} -> Names: ${Array.from(names).join(', ')}`);
});
