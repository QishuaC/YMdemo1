const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

function generateProductNumber(products) {
  const existingNumbers = products
    .map(product => product.productNumber)
    .filter(number => number && number.startsWith('P'))
    .map(number => parseInt(number.substring(1), 10))
    .filter(num => !isNaN(num));
  
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return 'P' + String(nextNumber).padStart(6, '0');
}

console.log('开始修复数据库...');
const raw = fs.readFileSync(DB_FILE, 'utf-8');
const db = JSON.parse(raw);

let fixedCount = 0;
db.products.forEach((product) => {
  if (!product.productNumber) {
    product.productNumber = generateProductNumber(db.products);
    fixedCount++;
    console.log(`已修复商品: ${product.name}, 新ID: ${product.productNumber}`);
  }
});

if (fixedCount > 0) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`修复完成！共修复 ${fixedCount} 个商品。`);
} else {
  console.log('所有商品都已有 productNumber，无需修复。');
}
