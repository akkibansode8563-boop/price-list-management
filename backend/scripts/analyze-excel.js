/**
 * Deep Excel Analyzer — stats, unique values, price ranges
 */
const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'PRICE LIST .xlsx');
const workbook = xlsx.readFile(filePath);
const ws = workbook.Sheets['Sheet2'];
const data = xlsx.utils.sheet_to_json(ws, { defval: '' });

console.log(`\nTotal rows: ${data.length}`);

// Product Groups (categories)
const groups = {};
data.forEach(r => {
  const g = (r['Product Group'] || 'UNKNOWN').trim();
  groups[g] = (groups[g] || 0) + 1;
});
const sortedGroups = Object.entries(groups).sort((a,b) => b[1]-a[1]);
console.log(`\nUnique Product Groups: ${sortedGroups.length}`);
console.log('Top 20 groups:');
sortedGroups.slice(0, 20).forEach(([g, c]) => console.log(`  ${c.toString().padStart(5)} | ${g}`));

// PM Codes
const pms = {};
data.forEach(r => {
  const pm = (r['ProductManager Code'] || 'UNASSIGNED').trim();
  pms[pm] = (pms[pm] || 0) + 1;
});
console.log(`\nProductManager Codes (${Object.keys(pms).length} unique):`);
Object.entries(pms).sort((a,b) => b[1]-a[1]).forEach(([pm, c]) => 
  console.log(`  ${c.toString().padStart(5)} | ${pm}`)
);

// Price stats
const withPrice = data.filter(r => r['NLC'] > 0);
const withMOP = data.filter(r => r['MOP'] > 0);
console.log(`\nRows with NLC > 0: ${withPrice.length}`);
console.log(`Rows with MOP > 0: ${withMOP.length}`);
console.log(`Rows with both = 0: ${data.filter(r => r['NLC'] === 0 && r['MOP'] === 0).length}`);

// NLC price range
if (withPrice.length > 0) {
  const prices = withPrice.map(r => r['NLC']);
  console.log(`\nNLC price range: ₹${Math.min(...prices).toLocaleString()} — ₹${Math.max(...prices).toLocaleString()}`);
  console.log(`Avg NLC: ₹${(prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2)}`);
}

// Sample rows with prices
console.log('\nSample rows with prices:');
withPrice.slice(0, 5).forEach(r => console.log(JSON.stringify(r)));

// Duplicate item codes
const codes = data.map(r => (r['Item Code '] || '').trim());
const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
console.log(`\nDuplicate Item Codes: ${dupes.length}`);
if (dupes.length > 0) console.log('First 5 dupes:', [...new Set(dupes)].slice(0,5));
