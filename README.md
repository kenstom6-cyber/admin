# Remote Key Manager

Hệ thống quản lý Key từ xa với các tính năng:
- Khóa/Mở khóa/Xóa/Tạm ngưng Key online
- Tạo Key số lượng tùy chỉnh với thời hạn
- Server Key bảo mật
- Lưu trữ dữ liệu bền vững
- Hỗ trợ Render.com và GitHub

## Triển khai trên Render.com

1. Fork repository này
2. Đăng nhập vào Render.com
3. Tạo new Web Service
4. Connect với repository
5. Deploy tự động

## Mặc định
- Server Key mặc định: `admin123`
- **Lưu ý**: Đổi Server Key ngay sau khi triển khai!

## API Endpoints
- `GET /api/keys` - Lấy danh sách keys
- `POST /api/keys/create` - Tạo keys mới
- `PUT /api/keys/:id/status` - Cập nhật trạng thái
- `DELETE /api/keys/:id` - Xóa key
- `POST /api/validate` - Kiểm tra key
