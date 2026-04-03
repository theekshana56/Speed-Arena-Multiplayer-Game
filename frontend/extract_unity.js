const fs = require('fs');
const UNITY_FILE = 'D:/Unity/Speed Arena 2D/Assets/TopDownRace/Scenes/Forest.unity';
const GUID_MAP = {
  '41fb831aad69f1040b7433b0c6dd53f9': 'road-1',
  '29a5fc35d22a31c4e85e218bb8efd1f0': 'road-2',
  'add96481182103d4cac11b3b73a803e4': 'checkpoint',
  '9ba98c7e85630404b811d74690e6b02f': 'start-position',
  '78933ba53b70f0e4f9602b2d63644729': 'tree-1'
};
try {
  let content = fs.readFileSync(UNITY_FILE, 'utf-8');
  let lines = content.split('\n');
  let results = [];
  let current = null;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.includes('--- !u!1001')) current = { type: null, x: 0, y: 0, rotation: 0 };
    if (current && line.includes('m_SourcePrefab:')) {
      let m = line.match(/guid: ([a-f0-9]{32})/);
      if (m && GUID_MAP[m[1]]) current.type = GUID_MAP[m[1]];
    }
    if (current && line.includes('propertyPath: m_LocalPosition.x')) {
      let m = lines[i+1].match(/value: ([\-0-9\.]+)/);
      if (m) current.x = parseFloat(m[1]);
    }
    if (current && line.includes('propertyPath: m_LocalPosition.y')) {
      let m = lines[i+1].match(/value: ([\-0-9\.]+)/);
      if (m) current.y = parseFloat(m[1]);
    }
    if (current && line.includes('propertyPath: m_LocalEulerAnglesHint.z')) {
      let m = lines[i+1].match(/value: ([\-0-9\.]+)/);
      if (m) current.rotation = parseFloat(m[1]);
    }
    if (line.trim() === '--- !u!' && current && current.type) {
      results.push(current);
      current = null;
    }
  }
  if (!fs.existsSync('src/game/levels')) fs.mkdirSync('src/game/levels', { recursive: true });
  fs.writeFileSync('src/game/levels/track_forest.json', JSON.stringify(results, null, 2));
  console.log('Extracted', results.length, 'items.');
} catch (e) {
  console.error(e);
}
