# Chia sẻ View ra Internet

Cổng quản trị mặc định `8765` có quyền sửa cấu hình. Cổng chia sẻ View riêng mặc định `8766` chỉ phục vụ một khung đã chọn; mọi API quản trị và mọi yêu cầu ghi đều bị chặn ở máy chủ.

1. Giữ Sirocco Live chạy như bình thường.
2. Trong thư mục dự án, mở terminal thứ hai và chạy:

   ```sh
   npm run share:view -- icpc
   ```

   Có thể đổi `icpc` thành `nonpro`, `pro` hoặc mã khung tuỳ chọn. Xem thử tại `http://127.0.0.1:8766/view/icpc`.

3. Cấu hình tunnel trỏ đến **`http://127.0.0.1:8766`**, rồi gửi link `https://<domain-của-tunnel>/view/icpc` cho người xem. Không trỏ tunnel công khai vào cổng quản trị `8765`.

Người xem chỉ nhận code, Input và thông tin của thí sinh đang bật trong khung đã chọn. Đổi đường dẫn sang `/`, `/api/config`, `/api/export` hoặc nhóm khác không cấp quyền quản trị. Cập nhật trực tiếp vẫn dùng SSE; chọn tunnel hỗ trợ SSE, không dùng Cloudflare Quick Tunnel `trycloudflare.com` với phiên bản này.

Cổng này không yêu cầu tài khoản: bất kỳ ai truy cập được URL công khai đều có thể xem khung được chia sẻ. Đây là quyền đọc, không phải quyền quản trị. Thu hồi toàn bộ truy cập bằng cách dừng tiến trình chia sẻ/tunnel. Nếu cần giới hạn từng người xem, bổ sung xác thực tại tunnel hoặc ứng dụng.

Cổng View mặc định chỉ lắng nghe trên localhost để tunnel cùng máy kết nối vào. Với reverse proxy hoặc container, có thể chỉ định `--host 0.0.0.0`. Dùng `--port` để chạy nhiều cổng chia sẻ cho nhiều nhóm; dùng `--upstream http://127.0.0.1:<cổng-quản-trị>` nếu ứng dụng chính đổi cổng. Khi cần các tuỳ chọn này, gọi Node trực tiếp, ví dụ `node scripts/share-view.mjs --group pro --port 8767`.

Để host toàn bộ hệ thống, giữ dịch vụ quản trị trong mạng riêng và chỉ công khai cổng View. Cổng View không bổ sung đăng nhập cho một dịch vụ quản trị đang được công khai ở địa chỉ khác.
