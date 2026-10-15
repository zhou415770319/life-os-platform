const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'user-data');
const goalsFile = path.join(dir, 'life-goals.json');
const goals = JSON.parse(fs.readFileSync(goalsFile, 'utf8'));
const before = goals.length;
const kept = goals.filter((g) => g.id !== '1a9166d8-dc29-4238-a16f-8e9abde602cd');
fs.writeFileSync(goalsFile, JSON.stringify(kept, null, 2), 'utf8');
console.log('goals removed:', before - kept.length, 'remaining:', kept.length);
