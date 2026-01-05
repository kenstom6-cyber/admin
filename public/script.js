let currentServerKey = '';
let allKeys = [];

// Connect to server
async function connectServer() {
    const serverKey = document.getElementById('serverKey').value;
    if (!serverKey) {
        alert('Vui lòng nhập Server Key!');
        return;
    }
    
    currentServerKey = serverKey;
    
    try {
        const response = await fetch('/api/keys', {
            headers: {
                'X-Server-Key': serverKey
            }
        });
        
        if (response.ok) {
            allKeys = await response.json();
            loadKeys();
            loadStats();
            alert('Kết nối thành công!');
        } else {
            const error = await response.json();
            alert('Lỗi: ' + error.error);
            currentServerKey = '';
        }
    } catch (error) {
        alert('Lỗi kết nối đến server!');
        console.error(error);
    }
}

// Load keys into table
function loadKeys() {
    const searchTerm = document.getElementById('searchKey').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;
    
    let filteredKeys = allKeys;
    
    // Apply search filter
    if (searchTerm) {
        filteredKeys = filteredKeys.filter(key => 
            key.key.toLowerCase().includes(searchTerm) ||
            key.note.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply status filter
    if (filterStatus !== 'all') {
        filteredKeys = filteredKeys.filter(key => key.status === filterStatus);
    }
    
    const tbody = document.getElementById('keysBody');
    tbody.innerHTML = '';
    
    filteredKeys.forEach(key => {
        const row = document.createElement('tr');
        
        // Status badge
        let statusBadge = '';
        let statusClass = '';
        switch(key.status) {
            case 'active':
                statusBadge = 'Đang hoạt động';
                statusClass = 'status-active';
                break;
            case 'locked':
                statusBadge = 'Đã khóa';
                statusClass = 'status-locked';
                break;
            case 'suspended':
                statusBadge = 'Tạm ngưng';
                statusClass = 'status-suspended';
                break;
        }
        
        // Format dates
        const created = new Date(key.createdAt).toLocaleDateString('vi-VN');
        const expires = new Date(key.expiresAt).toLocaleDateString('vi-VN');
        const lastUsed = key.lastUsed ? 
            new Date(key.lastUsed).toLocaleDateString('vi-VN') : 
            'Chưa sử dụng';
        
        row.innerHTML = `
            <td>
                <strong>${key.key}</strong>
                ${key.note ? `<br><small>${key.note}</small>` : ''}
            </td>
            <td><span class="status-badge ${statusClass}">${statusBadge}</span></td>
            <td>${created}</td>
            <td>${expires}</td>
            <td>${lastUsed}</td>
            <td>
                <div class="action-buttons">
                    ${key.status === 'active' ? 
                        `<button class="action-btn btn-lock" onclick="updateKeyStatus('${key.id}', 'locked')">
                            <i class="fas fa-lock"></i> Khóa
                        </button>
                        <button class="action-btn btn-suspend" onclick="updateKeyStatus('${key.id}', 'suspended')">
                            <i class="fas fa-pause"></i> Tạm ngưng
                        </button>` :
                        `<button class="action-btn btn-unlock" onclick="updateKeyStatus('${key.id}', 'active')">
                            <i class="fas fa-unlock"></i> Mở khóa
                        </button>`
                    }
                    <button class="action-btn btn-delete" onclick="deleteKey('${key.id}')">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                    <button class="action-btn" onclick="showKeyDetails('${key.id}')">
                        <i class="fas fa-info-circle"></i> Chi tiết
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/stats', {
            headers: {
                'X-Server-Key': currentServerKey
            }
        });
        
        if (response.ok) {
            const stats = await response.json();
            document.getElementById('totalKeys').textContent = stats.total;
            document.getElementById('activeKeys').textContent = stats.active;
            document.getElementById('lockedKeys').textContent = stats.locked;
            document.getElementById('suspendedKeys').textContent = stats.suspended;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Create new keys
async function createKeys() {
    if (!currentServerKey) {
        alert('Vui lòng kết nối với Server Key trước!');
        return;
    }
    
    const count = parseInt(document.getElementById('keyCount').value);
    const duration = parseInt(document.getElementById('keyDuration').value);
    const note = document.getElementById('keyNote').value;
    
    if (count < 1 || count > 100) {
        alert('Số lượng key phải từ 1 đến 100!');
        return;
    }
    
    if (duration < 1) {
        alert('Thời hạn phải lớn hơn 0!');
        return;
    }
    
    try {
        const response = await fetch('/api/keys/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Server-Key': currentServerKey
            },
            body: JSON.stringify({ count, duration, note })
        });
        
        if (response.ok) {
            const result = await response.json();
            allKeys = [...allKeys, ...result.keys];
            loadKeys();
            loadStats();
            
            // Show created keys
            const keysList = result.keys.map(k => k.key).join('\n');
            alert(`Đã tạo ${count} key thành công!\n\n${keysList}`);
            
            // Clear form
            document.getElementById('keyNote').value = '';
        } else {
            const error = await response.json();
            alert('Lỗi: ' + error.error);
        }
    } catch (error) {
        alert('Lỗi khi tạo key!');
        console.error(error);
    }
}

// Update key status
async function updateKeyStatus(keyId, status) {
    if (!currentServerKey) {
        alert('Vui lòng kết nối với Server Key trước!');
        return;
    }
    
    if (!confirm(`Bạn có chắc muốn ${status === 'locked' ? 'khóa' : 
        status === 'suspended' ? 'tạm ngưng' : 'mở khóa'} key này?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/keys/${keyId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Server-Key': currentServerKey
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // Update local data
            const index = allKeys.findIndex(k => k.id === keyId);
            if (index !== -1) {
                allKeys[index] = result.key;
            }
            
            loadKeys();
            loadStats();
        } else {
            const error = await response.json();
            alert('Lỗi: ' + error.error);
        }
    } catch (error) {
        alert('Lỗi khi cập nhật trạng thái!');
        console.error(error);
    }
}

// Delete key
async function deleteKey(keyId) {
    if (!currentServerKey) {
        alert('Vui lòng kết nối với Server Key trước!');
        return;
    }
    
    if (!confirm('Bạn có chắc muốn xóa key này? Hành động này không thể hoàn tác!')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/keys/${keyId}`, {
            method: 'DELETE',
            headers: {
                'X-Server-Key': currentServerKey
            }
        });
        
        if (response.ok) {
            // Remove from local data
            allKeys = allKeys.filter(k => k.id !== keyId);
            loadKeys();
            loadStats();
            alert('Đã xóa key thành công!');
        } else {
            const error = await response.json();
            alert('Lỗi: ' + error.error);
        }
    } catch (error) {
        alert('Lỗi khi xóa key!');
        console.error(error);
    }
}

// Validate key
async function validateKey() {
    const key = document.getElementById('validateKey').value.trim();
    
    if (!key) {
        alert('Vui lòng nhập key để kiểm tra!');
        return;
    }
    
    try {
        const response = await fetch('/api/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ key })
        });
        
        const result = await response.json();
        const resultDiv = document.getElementById('validationResult');
        
        if (result.valid) {
            resultDiv.innerHTML = `
                <div class="valid-result">
                    <h4><i class="fas fa-check-circle"></i> Key hợp lệ!</h4>
                    <p><strong>Key:</strong> ${key}</p>
                    <p><strong>Hết hạn:</strong> ${new Date(result.expiresAt).toLocaleDateString('vi-VN')}</p>
                    ${result.note ? `<p><strong>Ghi chú:</strong> ${result.note}</p>` : ''}
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="invalid-result">
                    <h4><i class="fas fa-times-circle"></i> Key không hợp lệ!</h4>
                    <p><strong>Lý do:</strong> ${result.message}</p>
                </div>
            `;
        }
        
        resultDiv.style.display = 'block';
    } catch (error) {
        alert('Lỗi khi kiểm tra key!');
        console.error(error);
    }
}

// Show key details
function showKeyDetails(keyId) {
    const key = allKeys.find(k => k.id === keyId);
    if (!key) return;
    
    const modal = document.getElementById('keyDetailModal');
    const detailsDiv = document.getElementById('keyDetails');
    
    const historyHTML = key.history.map(item => `
        <div class="history-item">
            <strong>${new Date(item.timestamp).toLocaleString('vi-VN')}</strong>
            <br>${item.action}
        </div>
    `).join('');
    
    detailsDiv.innerHTML = `
        <p><strong>Key:</strong> ${key.key}</p>
        <p><strong>Trạng thái:</strong> ${key.status}</p>
        <p><strong>Ngày tạo:</strong> ${new Date(key.createdAt).toLocaleString('vi-VN')}</p>
        <p><strong>Hết hạn:</strong> ${new Date(key.expiresAt).toLocaleString('vi-VN')}</p>
        <p><strong>Lần dùng cuối:</strong> ${key.lastUsed ? 
            new Date(key.lastUsed).toLocaleString('vi-VN') : 'Chưa sử dụng'}</p>
        ${key.note ? `<p><strong>Ghi chú:</strong> ${key.note}</p>` : ''}
        
        <h4>Lịch sử:</h4>
        <div class="history-list">
            ${historyHTML || '<p>Không có lịch sử</p>'}
        </div>
    `;
    
    modal.style.display = 'flex';
}

// Change server key
async function changeServerKey() {
    const oldKey = document.getElementById('old
