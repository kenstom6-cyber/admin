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
    const oldKey = document.getElementById('oldKey').value;
    const newKey = document.getElementById('newKey').value;
    const confirmKey = document.getElementById('confirmKey').value;
    
    if (!oldKey || !newKey || !confirmKey) {
        alert('Vui lòng điền đầy đủ thông tin!');
        return;
    }
    
    if (newKey !== confirmKey) {
        alert('Key mới và xác nhận không khớp!');
        return;
    }
    
    if (newKey.length < 8) {
        alert('Key mới phải có ít nhất 8 ký tự!');
        return;
    }
    
    try {
        const response = await fetch('/api/change-server-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Server-Key': currentServerKey
            },
            body: JSON.stringify({ oldKey, newKey })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(result.message);
            closeModal();
            document.getElementById('serverKey').value = newKey;
            currentServerKey = newKey;
        } else {
            const error = await response.json();
            alert('Lỗi: ' + error.error);
        }
    } catch (error) {
        alert('Lỗi khi đổi key!');
        console.error(error);
    }
}

// Modal functions
function showChangeKeyModal() {
    if (!currentServerKey) {
        alert('Vui lòng kết nối với Server Key trước!');
        return;
    }
    
    document.getElementById('changeKeyModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('changeKeyModal').style.display = 'none';
    document.getElementById('keyDetailModal').style.display = 'none';
    
    // Clear modal inputs
    document.getElementById('oldKey').value = '';
    document.getElementById('newKey').value = '';
    document.getElementById('confirmKey').value = '';
}

// Event listeners for search and filter
document.getElementById('searchKey').addEventListener('input', loadKeys);
document.getElementById('filterStatus').addEventListener('change', loadKeys);

// Auto-connect if server key is saved in localStorage
document.addEventListener('DOMContentLoaded', function() {
    const savedKey = localStorage.getItem('serverKey');
    if (savedKey) {
        document.getElementById('serverKey').value = savedKey;
        connectServer();
    }
});

// Save server key when changed
document.getElementById('serverKey').addEventListener('change', function() {
    if (currentServerKey) {
        localStorage.setItem('serverKey', currentServerKey);
    }
});
// ... (giữ nguyên phần trước)

// Hiển thị section
function showSection(sectionId) {
    // Ẩn tất cả sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Hiện section được chọn
    document.getElementById(`${sectionId}-section`).classList.add('active');
    
    // Cập nhật tiêu đề
    const titles = {
        'dashboard': 'Dashboard',
        'create-keys': 'Tạo Key Mới',
        'manage-keys': 'Quản lý Key',
        'validate-key': 'Kiểm tra Key',
        'server-config': 'Cấu hình Server',
        'api-docs': 'API & Shell Script'
    };
    
    document.getElementById('pageTitle').textContent = titles[sectionId];
    
    // Cập nhật menu active
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.querySelector(`.menu-item[onclick="showSection('${sectionId}')"]`).classList.add('active');
    
    // Load dữ liệu nếu cần
    if (sectionId === 'dashboard') {
        loadRecentActivity();
    }
}

// Tạo server key mới
async function generateServerKey() {
    if (!confirm('Bạn có chắc muốn tạo Server Key mới? Key cũ sẽ bị vô hiệu hóa.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/generate-server-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Server-Key': currentServerKey
            },
            body: JSON.stringify({ length: 32 })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`Server Key mới đã được tạo:\n\n${result.serverKey}\n\n${result.message}`);
            
            // Cập nhật input
            document.getElementById('serverKey').value = result.serverKey;
            currentServerKey = result.serverKey;
            localStorage.setItem('serverKey', result.serverKey);
            
            // Cập nhật trạng thái
            updateServerStatus(true);
        } else {
            const error = await response.json();
            alert('Lỗi: ' + error.error);
        }
    } catch (error) {
        alert('Lỗi khi tạo Server Key!');
        console.error(error);
    }
}

// Tải shell script
function downloadScript(type) {
    if (!currentServerKey) {
        alert('Vui lòng kết nối với Server Key trước!');
        return;
    }
    
    const url = `/api/shell-script/${type}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}.sh`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Reset form tạo key
function resetCreateForm() {
    document.getElementById('keyCount').value = 1;
    document.getElementById('keyLength').value = 16;
    document.getElementById('keyDuration').value = 30;
    document.getElementById('keyPrefix').value = '';
    document.getElementById('keyNote').value = '';
    document.getElementById('keyPreview').style.display = 'none';
}

// Sao chép key đã tạo
function copyCreatedKeys() {
    const previewContent = document.getElementById('previewContent').textContent;
    navigator.clipboard.writeText(previewContent).then(() => {
        showNotification('Đã sao chép tất cả key!');
    });
}

// Hiển thị thông báo
function showNotification(message, type = 'info') {
    // Tạo notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Thêm vào body
    document.body.appendChild(notification);
    
    // Hiển thị
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Tự động ẩn
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Cập nhật trạng thái server
function updateServerStatus(connected) {
    const statusIndicator = document.querySelector('.status-indicator .dot');
    const statusText = document.querySelector('.status-indicator span');
    
    if (connected) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Đã kết nối';
    } else {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Ngắt kết nối';
    }
}

// Tải hoạt động gần đây
function loadRecentActivity() {
    if (!allKeys.length) return;
    
    const activityList = document.getElementById('activityList');
    const recentKeys = [...allKeys]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
    
    activityList.innerHTML = '';
    
    recentKeys.forEach(key => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        let icon = 'key';
        let text = `Key mới: ${key.key.substring(0, 8)}...`;
        
        if (key.history && key.history.length > 0) {
            const lastAction = key.history[key.history.length - 1];
            text = `${lastAction.action}: ${key.key.substring(0, 8)}...`;
            
            if (lastAction.action.includes('khóa')) icon = 'lock';
            else if (lastAction.action.includes('mở')) icon = 'unlock';
            else if (lastAction.action.includes('tạm')) icon = 'pause';
        }
        
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="activity-info">
                <p>${text}</p>
                <div class="activity-time">
                    ${new Date(key.createdAt).toLocaleDateString('vi-VN')}
                </div>
            </div>
        `;
        
        activityList.appendChild(activityItem);
    });
}

// Lưu cài đặt
async function saveSettings() {
    const settings = {
        maxKeys: parseInt(document.getElementById('maxKeys').value),
        defaultExpiry: parseInt(document.getElementById('defaultExpiry').value),
        autoCleanup: document.getElementById('autoCleanup').checked
    };
    
    try {
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Server-Key': currentServerKey
            },
            body: JSON.stringify({ settings })
        });
        
        if (response.ok) {
            showNotification('Đã lưu cài đặt!', 'success');
        } else {
            showNotification('Lỗi khi lưu cài đặt!', 'error');
        }
    } catch (error) {
        showNotification('Lỗi kết nối!', 'error');
    }
}

// Hiển thị/ẩn server key
function toggleKeyVisibility() {
    const keyDisplay = document.querySelector('.key-display span');
    const eyeButton = document.querySelector('.btn-show i');
    
    if (keyDisplay.textContent.includes('•')) {
        keyDisplay.textContent = currentServerKey;
        eyeButton.className = 'fas fa-eye-slash';
    } else {
        keyDisplay.textContent = '••••••••••••••••';
        eyeButton.className = 'fas fa-eye';
    }
}

// Cập nhật hàm connectServer
async function connectServer() {
    const serverKey = document.getElementById('serverKey').value;
    if (!serverKey) {
        showNotification('Vui lòng nhập Server Key!', 'warning');
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
            loadRecentActivity();
            updateServerStatus(true);
            showNotification('Kết nối thành công!', 'success');
            
            // Lưu vào localStorage
            localStorage.setItem('serverKey', serverKey);
            
            // Hiển thị số lượng thông báo
            const expiredCount = allKeys.filter(k => 
                new Date(k.expiresAt) < new Date()
            ).length;
            document.getElementById('notificationCount').textContent = expiredCount;
        } else {
            const error = await response.json();
            showNotification('Lỗi: ' + error.error, 'error');
            updateServerStatus(false);
            currentServerKey = '';
        }
    } catch (error) {
        showNotification('Lỗi kết nối đến server!', 'error');
        updateServerStatus(false);
        console.error(error);
    }
}

// Thêm CSS cho notification
const style = document.createElement('style');
style.textContent = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 10px;
    transform: translateX(150%);
    transition: transform 0.3s ease;
    z-index: 3000;
    min-width: 300px;
}

.notification.show {
    transform: translateX(0);
}

.notification-success {
    border-left: 4px solid var(--success);
}

.notification-error {
    border-left: 4px solid var(--danger);
}

.notification-warning {
    border-left: 4px solid var(--warning);
}

.notification i {
    font-size: 20px;
}

.notification-success i {
    color: var(--success);
}

.notification-error i {
    color: var(--danger);
}

.notification-warning i {
    color: var(--warning);
}
`;

document.head.appendChild(style);

// Khởi tạo
document.addEventListener('DOMContentLoaded', function() {
    // Load saved server key
    const savedKey = localStorage.getItem('serverKey');
    if (savedKey) {
        document.getElementById('serverKey').value = savedKey;
        connectServer();
    }
    
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Enter key để kết nối
    document.getElementById('serverKey').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') connectServer();
    });
    
    // Real-time search
    document.getElementById('searchKey').addEventListener('input', loadKeys);
    document.getElementById('filterStatus').addEventListener('change', loadKeys);
    document.getElementById('sortBy').addEventListener('change', loadKeys);
}

// ... (giữ nguyên các hàm khác)
