const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('../public'));

// Database file path
const DB_FILE = path.join(__dirname, 'database.json');

// Initialize database
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      serverKey: bcrypt.hashSync('admin123', 10),
      keys: [],
      settings: {
        defaultDuration: 30, // days
        keyLength: 16,
        maxKeys: 1000
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
  }
}

// Read database
function readDatabase() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return null;
  }
}

// Write to database
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Generate random key
function generateKey(length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Middleware to verify server key
function verifyServerKey(req, res, next) {
  const serverKey = req.headers['x-server-key'];
  if (!serverKey) {
    return res.status(401).json({ error: 'Server key required' });
  }

  const db = readDatabase();
  if (!db) {
    return res.status(500).json({ error: 'Database error' });
  }

  if (!bcrypt.compareSync(serverKey, db.serverKey)) {
    return res.status(403).json({ error: 'Invalid server key' });
  }

  next();
}

// Initialize database on startup
initDatabase();

// API Routes

// Get all keys
app.get('/api/keys', verifyServerKey, (req, res) => {
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'Database error' });
  res.json(db.keys);
});

// Create multiple keys
app.post('/api/keys/create', verifyServerKey, (req, res) => {
  const { count, duration, note } = req.body;
  const db = readDatabase();
  
  if (!db) return res.status(500).json({ error: 'Database error' });
  
  const newKeys = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const key = {
      id: uuidv4(),
      key: generateKey(db.settings.keyLength),
      status: 'active',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + (duration || db.settings.defaultDuration) * 24 * 60 * 60 * 1000).toISOString(),
      lastUsed: null,
      note: note || '',
      history: []
    };
    
    db.keys.push(key);
    newKeys.push(key);
  }
  
  writeDatabase(db);
  res.json({ success: true, keys: newKeys });
});

// Update key status
app.put('/api/keys/:id/status', verifyServerKey, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'Database error' });
  
  const key = db.keys.find(k => k.id === id);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  
  key.status = status;
  key.history.push({
    action: `Status changed to ${status}`,
    timestamp: new Date().toISOString()
  });
  
  writeDatabase(db);
  res.json({ success: true, key });
});

// Delete key
app.delete('/api/keys/:id', verifyServerKey, (req, res) => {
  const { id } = req.params;
  
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'Database error' });
  
  const index = db.keys.findIndex(k => k.id === id);
  if (index === -1) return res.status(404).json({ error: 'Key not found' });
  
  db.keys.splice(index, 1);
  writeDatabase(db);
  res.json({ success: true });
});

// Validate key (for client use)
app.post('/api/validate', (req, res) => {
  const { key } = req.body;
  
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'Database error' });
  
  const keyData = db.keys.find(k => k.key === key);
  if (!keyData) {
    return res.json({ valid: false, message: 'Key không tồn tại' });
  }
  
  if (keyData.status !== 'active') {
    return res.json({ 
      valid: false, 
      message: `Key đang bị ${keyData.status === 'locked' ? 'khóa' : 'tạm ngưng'}` 
    });
  }
  
  const now = new Date();
  if (new Date(keyData.expiresAt) < now) {
    keyData.status = 'expired';
    writeDatabase(db);
    return res.json({ valid: false, message: 'Key đã hết hạn' });
  }
  
  // Update last used
  keyData.lastUsed = now.toISOString();
  keyData.history.push({
    action: 'Validated',
    timestamp: now.toISOString()
  });
  
  writeDatabase(db);
  res.json({ 
    valid: true, 
    message: 'Key hợp lệ',
    expiresAt: keyData.expiresAt,
    note: keyData.note
  });
});

// Update settings
app.put('/api/settings', verifyServerKey, (req, res) => {
  const { settings } = req.body;
  
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'Database error' });
  
  db.settings = { ...db.settings, ...settings };
  writeDatabase(db);
  res.json({ success: true, settings: db.settings });
});

// Get statistics
app.get('/api/stats', verifyServerKey, (req, res) => {
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'Database error' });
  
  const stats = {
    total: db.keys.length,
    active: db.keys.filter(k => k.status === 'active').length,
    locked: db.keys.filter(k => k.status === 'locked').length,
    suspended: db.keys.filter(k => k.status === 'suspended').length,
    expired: db.keys.filter(k => new Date(k.expiresAt) < new Date()).length
  };
  
  res.json(stats);
});

// Change server key
app.post('/api/change-server-key', verifyServerKey, (req, res) => {
  const { oldKey, newKey } = req.body;
  
  const db = readDatabase();
  if (!db) return res.status(500).json({ error: 'Database error' });
  
  // Verify old key
  if (!bcrypt.compareSync(oldKey, db.serverKey)) {
    return res.status(400).json({ error: 'Old key is incorrect' });
  }
  
  // Update to new key
  db.serverKey = bcrypt.hashSync(newKey, 10);
  writeDatabase(db);
  
  res.json({ success: true, message: 'Server key updated successfully' });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Default server key: admin123`);
  console.log(`Change this key immediately in the admin panel!`);
});
