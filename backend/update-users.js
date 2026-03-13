const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

function generateUserNumber(users) {
  const existingNumbers = users
    .map(user => user.userNumber)
    .filter(number => number && number.startsWith('C'))
    .map(number => parseInt(number.substring(1), 10))
    .filter(num => !isNaN(num));
  
  const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  return 'C' + String(nextNumber).padStart(5, '0');
}

function generateUniqueId() {
  return 'UID_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function updateDb() {
  if (!fs.existsSync(DB_FILE)) {
    console.log('Database file not found');
    return;
  }
  
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const db = JSON.parse(raw);
    
    console.log('Found', db.users.length, 'users');
    
    db.users.forEach(user => {
      if (!user.uniqueId) {
        user.uniqueId = generateUniqueId();
        console.log('Added uniqueId to user:', user._id);
      }
      if (!user.userNumber) {
        user.userNumber = generateUserNumber(db.users);
        console.log('Added userNumber to user:', user._id, '->', user.userNumber);
      }
    });
    
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    console.log('Database updated successfully');
    
  } catch (error) {
    console.error('Error updating database:', error);
  }
}

updateDb();
