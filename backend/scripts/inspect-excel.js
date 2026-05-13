/**
 * Excel Inspector — reads all sheets and prints column names + sample rows
 */
const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', '..', 'PRICE LIST .xlsx');
console.log('Reading:', filePath);

const workbook = xlsx.readFile(filePath);
console.log('\n📋 Sheets found:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const ws = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(ws, { defval: '' });
  
  console.log(`\n═══ Sheet: "${sheetName}" ═══`);
  console.log(`  Rows: ${data.length}`);
  
  if (data.length > 0) {
    console.log('  Columns:', Object.keys(data[0]));
    console.log('\n  First 3 rows:');
    data.slice(0, 3).forEach((row, i) => {
      console.log(`  [${i+1}]`, JSON.stringify(row, null, 2).substring(0, 500));
    });
  }
});
