const fs = require('fs');
const path = require('path');

// Read all CSS files in .output/public
function findCssFiles(dir) {
  const results = [];
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...findCssFiles(fullPath));
      } else if (file.endsWith('.css')) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore
  }
  return results;
}

const outputDir = path.join(__dirname, '.output', 'public');
const cssFiles = findCssFiles(outputDir);

if (cssFiles.length === 0) {
  console.log('No CSS files found in .output/public');
  process.exit(1);
}

let foundNew = false;
let foundOld = false;

for (const file of cssFiles) {
  const content = fs.readFileSync(file, 'utf8');

  // Check for new palette
  if (content.includes('11269d') || content.includes('0c1b70') || content.includes('2e43c4')) {
    foundNew = true;
    console.log(`✓ New palette (#11269D family) found in ${path.basename(file)}`);
  }

  // Check for old palette
  if (content.includes('1313cf') || content.includes('0202d4')) {
    foundOld = true;
    console.log(`✗ Old palette (#1313CF / #0202D4) still present in ${path.basename(file)}`);
  }
}

console.log('');
if (foundNew && !foundOld) {
  console.log('✓ Palette verification passed: only the new #11269D family is present.');
  process.exit(0);
} else if (foundNew && foundOld) {
  console.log('⚠ Both old and new palette hexes found. The recolor may be incomplete.');
  process.exit(1);
} else if (!foundNew && foundOld) {
  console.log('✗ Only the old palette found. The new palette did not make it into the build.');
  process.exit(1);
} else {
  console.log('? No palette hexes found at all. This is unexpected.');
  process.exit(1);
}
