# VNOJ Companion cho Sirocco Live

Tiện ích Chrome/Edge Manifest V3 dành cho thí sinh thi ảo VNOJ và Sirocco Live chạy trên **cùng máy**. Nó đọc kết quả của phiên đang đăng nhập bằng yêu cầu cùng nguồn tới VNOJ, rồi gửi các bản ghi kết quả đến `http://127.0.0.1:8765/api/vnoj/bridge`. Không đọc code, không sao chép cookie, không gửi thông tin đăng nhập sang Sirocco hoặc dịch vụ khác.

1. Trong Sirocco Live chọn VNOJ, nhập contest và username, chọn đúng mã phiên rồi lưu.
2. Mở `chrome://extensions` (Edge: `edge://extensions`), bật Developer mode, chọn Load unpacked/Tải tiện ích đã giải nén và chọn **thư mục này**.
3. Trong Sirocco, nút **VNOJ Companion** cung cấp mã ghép nối. Nhập mã trong popup tiện ích.
4. Trên trình duyệt đó, đăng nhập tài khoản thí sinh vào VNOJ và mở trang contest của phiên đang thi ảo. Giữ tab mở; tiện ích đọc lại khoảng 10 giây/lần. Popup báo username và mã phiên đã nối.

Khi vừa kết nối, dữ liệu cũ làm mốc và không phát hiệu ứng. Các kết quả mới sau đó mới được xét. Mã ghép nối đổi khi khởi động lại Sirocco hoặc chọn Thu hồi kết nối. Thí sinh dùng máy khác chưa thể gửi vào máy BTC bằng tiện ích này; không mở cổng ứng dụng ra Internet.

Nếu không dùng Companion, vẫn có điểm/BXH công khai và hiệu ứng theo thay đổi điểm hoặc số lần sai của BXH. BXH chỉ giữ điểm tốt nhất nên không đủ để phát hiện mọi lượt nộp IOI thấp điểm hơn hoặc lỗi biên dịch. Khi thiếu dữ liệu, ứng dụng không bịa kết quả. Companion hiện hỗ trợ dữ liệu `own` của **phiên thi ảo đang tham gia**, không phải cookie tài khoản BTC hoặc một phiên cũ bất kỳ.
