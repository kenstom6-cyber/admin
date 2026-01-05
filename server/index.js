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
// ... (giữ nguyên phần đầu)

// Thêm endpoint mới cho shell script
app.get('/api/shell-script/:type', (req, res) => {
    const { type } = req.params;
    const scripts = {
        'validate': `#!/bin/bash

# Remote Key Manager - Validate Key Script
# Usage: ./validate.sh YOUR_KEY

KEY="$1"
SERVER_URL="${req.protocol}://${req.get('host')}"

if [ -z "$KEY" ]; then
    echo "Usage: $0 <key>"
    exit 1
fi

RESPONSE=$(curl -s -X POST "$SERVER_URL/api/validate" \\
  -H "Content-Type: application/json" \\
  -d "{\\"key\\": \\"$KEY\\"}")

VALID=$(echo $RESPONSE | grep -o '"valid":true')

if [ ! -z "$VALID" ]; then
    echo "✅ Key hợp lệ"
    EXPIRES=$(echo $RESPONSE | grep -o '"expiresAt":"[^"]*"' | cut -d'"' -f4)
    echo "📅 Hết hạn: $(date -d "$EXPIRES" '+%d/%m/%Y %H:%M')"
    NOTE=$(echo $RESPONSE | grep -o '"note":"[^"]*"' | cut -d'"' -f4)
    if [ ! -z "$NOTE" ]; then
        echo "📝 Ghi chú: $NOTE"
    fi
    exit 0
else
    echo "❌ Key không hợp lệ"
    MSG=$(echo $RESPONSE | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    echo "📝 Lý do: $MSG"
    exit 1
fi`,

        'create_keys': `#!/bin/bash

# Remote Key Manager - Create Keys Script
# Usage: ./create_keys.sh SERVER_KEY COUNT DAYS [NOTE]

SERVER_KEY="$1"
COUNT="$2"
DAYS="$3"
NOTE="$4"
SERVER_URL="${req.protocol}://${req.get('host')}"

if [ -z "$SERVER_KEY" ] || [ -z "$COUNT" ] || [ -z "$DAYS" ]; then
    echo "Usage: $0 <server_key> <count> <days> [note]"
    exit 1
fi

RESPONSE=$(curl -s -X POST "$SERVER_URL/api/keys/create" \\
  -H "X-Server-Key: $SERVER_KEY" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"count\\": $COUNT,
    \\"duration\\": $DAYS,
    \\"note\\": \\"$NOTE\\"
  }")

if echo $RESPONSE | grep -q '"success":true'; then
    echo "✅ Đã tạo $COUNT key thành công"
    echo "$RESPONSE" | grep -o '"key":"[^"]*"' | cut -d'"' -f4 | while read KEY; do
        echo "🔑 $KEY"
    done
else
    echo "❌ Lỗi khi tạo key"
    ERROR=$(echo $RESPONSE | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "📝 Chi tiết: $ERROR"
    exit 1
fi`,

        'manage_keys': `#!/bin/bash

# Remote Key Manager - Manage Keys Script
# Usage: ./manage_keys.sh SERVER_KEY [ACTION] [KEY_ID]

SERVER_KEY="$1"
ACTION="$2"
KEY_ID="$3"
SERVER_URL="${req.protocol}://${req.get('host')}"

if [ -z "$SERVER_KEY" ]; then
    echo "Usage:"
    echo "  $0 <server_key> list"
    echo "  $0 <server_key> lock <key_id>"
    echo "  $0 <server_key> unlock <key_id>"
    echo "  $0 <server_key> suspend <key_id>"
    echo "  $0 <server_key> delete <key_id>"
    exit 1
fi

case $ACTION in
    "list")
        curl -s -X GET "$SERVER_URL/api/keys" \\
          -H "X-Server-Key: $SERVER_KEY" \\
          -H "Content-Type: application/json" | jq .
        ;;
    "lock")
        curl -s -X PUT "$SERVER_URL/api/keys/$KEY_ID/status" \\
          -H "X-Server-Key: $SERVER_KEY" \\
          -H "Content-Type: application/json" \\
          -d '{"status": "locked"}'
        ;;
    "unlock")
        curl -s -X PUT "$SERVER_URL/api/keys/$KEY_ID/status" \\
          -H "X-Server-Key: $SERVER_KEY" \\
          -H "Content-Type: application/json" \\
          -d '{"status": "active"}'
        ;;
    "suspend")
        curl -s -X PUT "$SERVER_URL/api/keys/$KEY_ID/status" \\
          -H "X-Server-Key: $SERVER_KEY" \\
          -H "Content-Type: application/json" \\
          -d '{"status": "suspended"}'
        ;;
    "delete")
        curl -s -X DELETE "$SERVER_URL/api/keys/$KEY_ID" \\
          -H "X-Server-Key: $SERVER_KEY"
        ;;
    *)
        echo "❌ Action không hợp lệ"
        exit 1
        ;;
esac

if [ $? -eq 0 ]; then
    echo "✅ Thao tác thành công"
else
    echo "❌ Thao tác thất bại"
    exit 1
fi`
    };

    if (scripts[type]) {
        res.set('Content-Type', 'text/x-shellscript');
        res.set('Content-Disposition', `attachment; filename="${type}.sh"`);
        res.send(scripts[type]);
    } else {
        res.status(404).json({ error: 'Script not found' });
    }
});

// API để lấy thông tin server cho shell script
app.get('/api/server-info', (req, res) => {
    const serverUrl = `${req.protocol}://${req.get('host')}`;
    res.json({
        serverUrl,
        apiEndpoints: {
            validate: `${serverUrl}/api/validate`,
            keys: `${serverUrl}/api/keys`,
            create: `${serverUrl}/api/keys/create`
        },
        exampleCommands: {
            validate: `curl -X POST ${serverUrl}/api/validate -H "Content-Type: application/json" -d '{"key":"YOUR_KEY"}'`,
            createKey: `curl -X POST ${serverUrl}/api/keys/create -H "X-Server-Key: YOUR_KEY" -H "Content-Type: application/json" -d '{"count":1,"duration":30}'`
        }
    });
});

// API tạo server key mới
app.post('/api/generate-server-key', (req, res) => {
    const { length = 32 } = req.body;
    
    // Tạo server key mới
    const newKey = generateKey(length);
    const db = readDatabase();
    
    if (!db) return res.status(500).json({ error: 'Database error' });
    
    // Lưu key đã mã hóa
    db.serverKey = bcrypt.hashSync(newKey, 10);
    writeDatabase(db);
    
    // Trả về key gốc (chỉ lần này)
    res.json({
        success: true,
        serverKey: newKey,
        message: 'Lưu Server Key này ở nơi an toàn! Nó sẽ không được hiển thị lại.'
    });
});

// ... (giữ nguyên phần còn lại)
