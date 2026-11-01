# Sirocco Live

<img src="web/assets/sirocco-symbol.png" alt="Sirocco Team" width="88">

**A live coding broadcast studio for programming contests, by Sirocco Team.**

Công cụ local dành cho ban tổ chức: nhận code và input từ link chia sẻ **USACO Guide IDE**, dựng chữ trực tiếp, tự cuộn đến dòng vừa sửa và tạo hai nguồn hình để phát qua Streamlabs Desktop hoặc OBS Studio.

## Chạy bản web local

Yêu cầu **Node.js 22 trở lên**, npm và kết nối Internet để nhận dữ liệu USACO IDE.

```sh
git clone https://github.com/SmallChicken2k5/sirocco-live.git
cd sirocco-live
npm ci
npm run build
npm start
```

Mở [phòng điều khiển](http://127.0.0.1:8765/). Trên Windows, sau lần cài thư viện và build đầu tiên, có thể mở `START.vbs` cho các lần dùng tiếp theo. Bản `.exe` portable là bộ mở tùy chọn cho cùng ứng dụng web.

## Bản 1.3: Thành tích Codeforces trên nguồn live

- Gắn contest riêng cho mỗi nhóm và handle riêng cho mỗi thí sinh. Nguồn live hiển thị tổng điểm chính thức, điểm từng bài, thứ hạng khi có và kết quả lần nộp gần nhất.
- Gym dùng API Key/Secret của tài khoản có quyền xem contest. Có lựa chọn phiên thi chính thức, thi ảo, quản lý hoặc luyện tập để tránh ghép nhầm kết quả.
- Điểm cập nhật độc lập với code và input; mất mạng có nhãn dữ liệu cũ và thời gian kiểm tra. Thanh cỡ chữ có vùng kéo lớn hơn, hỗ trợ bàn phím và nút tăng/giảm đúng giới hạn.

### Sirocco Broadcast Studio

- Giao diện navy, vàng cát và cyan theo logo **Sirocco Team**. Logo gốc được giữ trong bộ tài nguyên; biểu tượng rút gọn nền trong dùng cho ứng dụng, nguồn phát và favicon.
- Font Geist có bộ ký tự tiếng Việt và icon Phosphor được lưu tại máy, không phụ thuộc CDN.
- Bố cục có nút chọn bằng hình, bộ chọn mật độ chữ và nút ẩn thiết lập để mở rộng bản xem trước. Lựa chọn ẩn thiết lập được nhớ trên trình duyệt.
- Chuyển nhóm, hộp thoại và thông báo có chuyển động ngắn; hỗ trợ cài đặt giảm chuyển động của hệ điều hành. Khung livestream không có animation nền hoặc animation mỗi lần nhận code.
- **Windows portable:** giải nén ZIP, mở `Sirocco Live.exe`. Runtime Node.js đi kèm. Biểu tượng ở khay hệ thống cho phép mở bảng điều khiển, mở từng nguồn và dừng tiến trình do bộ mở khởi chạy. Dữ liệu nằm riêng tại `%LOCALAPPDATA%\Sirocco Live\data`.
- Bản portable chưa ký số. Để chuyển cấu hình từ bản nguồn hiện tại, dùng Xuất cấu hình / Nhập cấu hình. ZIP phát hành không mang theo các link và tên thí sinh đã lưu.

Giữ các file `app/` và `runtime/` cạnh `.exe`. Bảng điều khiển vẫn dùng trình duyệt mặc định; Streamlabs/OBS nhận các link localhost như trước.

### Code và Input

- Cỡ chữ mặc định nhỏ hơn: **16px** cho không chuyên và **17px** cho chuyên Tin; chỉnh từ 10 đến 40px, có ba nút chọn nhanh và nút tăng/giảm.
- Mỗi ô thí sinh có **Input chỉ đọc**, đồng bộ từ tài liệu Input thật trên USACO. Đặt ở cạnh phải hoặc phía dưới, hoặc ẩn để dành trọn vùng cho code. Input có thanh cuộn riêng.
- **Output và tín hiệu Run chưa được hỗ trợ.** USACO không đồng bộ kết quả Run/stdout qua link share.
- Chỉnh bố cục/cỡ chữ/ô Input sẽ thay đổi **bản xem trước ngay lập tức**. Nguồn phát thật chỉ cập nhật sau khi bấm **Lưu & áp dụng** hoặc Ctrl+S. Có nút huỷ thay đổi.
- Trình soạn thảo không bị tạo lại khi chỉnh các thiết lập này; vị trí cuộn thủ công được giữ khi có thể. Xoá thí sinh có nút hoàn tác.

Sau khi nâng cấp, tải lại trang điều khiển và refresh Browser Source một lần để dùng giao diện mới. Link nguồn không đổi.

### Dựng bộ portable trên Windows

Trên Windows x64 có .NET Framework 4.8, chạy `npm run package:win`. Script dựng ứng dụng, đóng gói server cùng phụ thuộc, kèm runtime Node.js hiện tại, biên dịch bộ mở với .NET Framework, và tạo ZIP trong `release/`. ZIP không mang theo cấu hình và nhật ký của người tổ chức. Giấy phép thư viện và Node.js nằm trong `licenses/`.

Tham khảo thiết kế chuyển động: [Emil Kowalski](https://emilkowal.ski/ui/you-dont-need-animations), [Material motion](https://m3.material.io/styles/motion/overview/how-it-works). Tham khảo phân cấp giao diện: [Linear UI refresh](https://linear.app/changelog/2026-03-12-ui-refresh). Ứng dụng triển khai CSS và Web Animations riêng, không dùng bộ component của các sản phẩm trên.

## Mở và dùng

Trên máy đã cài Node.js 22 trở lên, mở **START.vbs** bằng cách nhấp đúp. Cửa sổ điều khiển mở tại:

- Phòng điều khiển: <http://127.0.0.1:8765/>
- Nguồn không chuyên: <http://127.0.0.1:8765/view/nonpro>
- Nguồn chuyên Tin: <http://127.0.0.1:8765/view/pro>

Sau lần cài đặt và build đầu tiên, không cần chạy lệnh khi sử dụng hằng ngày trên Windows. START.vbs tái sử dụng phiên đang chạy; máy chủ chạy ẩn. Dùng STOP.cmd khi muốn tắt nguồn. Tắt tab trình duyệt không tắt máy chủ.

1. Chọn nhóm, bấm **Thêm thí sinh**. Điền tên và dán link `https://ide.usaco.guide/<file-id>`.
2. Trên USACO IDE, chủ file cần đặt quyền chia sẻ cho người có link được đọc (`READ` hoặc `READ_WRITE`). Nên chọn quyền chỉ xem cho cuộc thi. Sirocco Live không thay đổi quyền chia sẻ và không đăng nhập tài khoản USACO của bạn.
3. Bấm **Lưu & áp dụng**. Chờ trạng thái **Đồng bộ** và kiểm tra code, input trong bản xem trước.
4. Điều chỉnh bố cục, cỡ chữ, xuống dòng, chế độ theo dõi và vị trí Input. Bấm **Lưu & áp dụng** để cập nhật các nguồn đang mở.
5. Trong Streamlabs, thêm **Browser Source**, nhập link nguồn của nhóm, đặt Width/Height bằng kích thước canvas, ví dụ **1920 × 1080**, FPS **30**. Tắt `Shutdown source when not visible` và `Refresh browser when scene becomes active`.
6. Streamlabs/OBS tiếp tục phát hoặc ghi hình theo thiết lập của bạn. Sirocco Live chỉ tạo nguồn hình; **không tự tạo buổi live, không giữ stream key và không tự phát lên YouTube**.

Hai buổi live ngang với hai nội dung khác nhau cần hai đầu ra độc lập của bộ phát. Cách đơn giản là dùng Streamlabs cho một nhóm và OBS cho nhóm còn lại. Công cụ này chạy cùng cả hai, không yêu cầu màn hình phụ, màn hình ảo, VDO.Ninja hoặc extension.

## Bố cục và tự cuộn

- **Lưới cân đối:** thích hợp nhóm bốn người; mỗi ô hiện code và Input nếu đang bật.
- **Cạnh nhau:** thích hợp nhóm hai người.
- **Một người nổi bật:** dùng nút **Nổi bật** ở hàng thí sinh để chọn người hiện lớn.
- **Tự luân phiên:** lần lượt phóng to từng người theo số giây đã chọn; những người còn lại vẫn có ô nhỏ.
- **Dòng vừa sửa:** đưa vị trí vừa thêm/xoá code vào khung nhìn và đánh dấu dòng tương ứng.
- **Con trỏ:** bám vị trí lựa chọn được USACO chia sẻ qua Yjs. Khi không có dữ liệu con trỏ, dùng dòng vừa sửa. Chọn con trỏ hoạt động gần nhất nếu có nhiều người mở và thao tác trên cùng một file. Công cụ không đảm bảo bám đúng chủ file trong tình huống nhiều người cùng điều khiển.
- **Cuộn thủ công:** dừng tự cuộn. Dùng Interact trong bộ phát hoặc mở link nguồn để cuộn.
- Cuộn bằng bánh xe/chạm khi đang tự bám sẽ tạm nhường điều khiển 8 giây; lần thay đổi code/con trỏ tiếp theo sau thời gian này sẽ tiếp tục tự bám.

Chữ của bản xem trước trong phòng điều khiển được thu nhỏ theo kích thước giao diện; nguồn thật dựng ở kích thước Browser Source. Mở link nguồn hoặc ghi thử để đánh giá chất lượng. Chia nhiều ô vẫn giới hạn diện tích đọc; tăng chữ hoặc dùng bố cục nổi bật khi cần.

## Lưu cấu hình và code

- Tên thí sinh, link share và bố cục được lưu ở `data/config.json` khi chạy từ mã nguồn; bản portable dùng `%LOCALAPPDATA%\Sirocco Live\data\config.json`.
- **Xuất/Nhập cấu hình** để sao lưu hoặc chuyển máy. File xuất có chứa link share; chỉ chia sẻ cho người cần quản lý cuộc thi.
- **Lưu code + input** tải JSON có nội dung hiện thời của các thí sinh đang bật, thời gian và trạng thái. Đây là ảnh chụp dữ liệu, **không phải video hoặc toàn bộ lịch sử sửa bài**.
- Khi thí sinh chuyển sang file USACO mới, cập nhật link tương ứng trong phòng điều khiển.
- Đường dẫn phụ `/view/candidate/<id>` hiển thị riêng một thí sinh đã có trong cấu hình.

## Kết nối và giới hạn

### Gắn thành tích Codeforces

Nút **Codeforces** trên thanh trên cùng mở màn hình kiểm tra kết nối. Nhập API Key và API Secret của tài khoản được quyền xem Gym, sau đó nhập link contest và handle cần thử. Thông tin đăng nhập Chrome không thay thế chữ ký API. Khoá được lưu riêng sau khi phép thử thành công; trên Windows, dữ liệu được bảo vệ bằng DPAPI của tài khoản Windows hiện tại. Trên Linux/macOS, file riêng có quyền `0600`.

API Key/Secret không nằm trong cấu hình cuộc thi, file Xuất cấu hình, SSE hay dữ liệu nguồn live. Để dùng khoá đã lưu, để trống hai ô khoá và bấm kiểm tra. Có thể xoá khoá ngay trong màn hình này. Không gửi khoá vào issue, commit hay ảnh chụp công khai.

1. Mở **Kết nối API**, nhập link Gym và kiểm tra bằng khoá của tài khoản được quyền xem. Dùng nút **Dùng contest cho nhóm** hoặc điền link trong mục **Thành tích Codeforces** của nhóm.
2. Bật theo dõi. Điền **Handle Codeforces** ở từng hàng thí sinh, chọn **Phiên thi** phù hợp và bấm **Lưu & áp dụng**. Tên hiển thị trên live và handle là hai trường độc lập. Nhóm chuyên Tin có thể dùng contest khác.
3. Chọn nhịp cập nhật từ 15 giây đến 3 phút. Nút **Cập nhật** yêu cầu một lượt mới. Các yêu cầu API dùng chung hàng đợi, cách nhau ít nhất 2,1 giây; nhóm đông người có thể cần lâu hơn một nhịp để lấy đủ lần nộp gần nhất.
4. Bật **Hiện điểm trên live** để hiện thành tích cạnh code. Tắt tuỳ chọn này để vẫn theo dõi ở phòng điều khiển. Bản xem trước áp dụng các thay đổi sau khi lưu và nhận dữ liệu tương ứng.

Tổng điểm và điểm từng bài lấy từ `contest.standings`, không cộng các lần nộp lại. Thông tin lần nộp gần nhất lấy từ tối đa 50 lần nộp gần nhất của handle trong contest, lọc theo phiên thi đã chọn. Nếu API không trả phiên hoặc lần nộp phù hợp, giao diện báo chưa có dữ liệu. Khi không có thứ hạng hợp lệ (ví dụ tài khoản quản lý hoặc luyện tập), nguồn không gán hạng. Cuộc thi IOI hiển thị điểm; ICPC hiển thị số bài và penalty. Không suy đoán điểm tối đa nếu API không cung cấp.

**Dùng quyền quản lý Gym** có thể đọc kết quả ẩn khỏi thí sinh, kể cả khi bảng điểm đóng băng; giao diện gắn nhãn quyền quản lý trên nguồn phát. Chỉ bật khi chủ động muốn phát dữ liệu này. Khi dùng bảng điểm công khai đang đóng băng, ứng dụng giữ kết quả standings và không lấy thêm verdict để tránh lộ kết quả sau giờ đóng băng.

Mất mạng tạm thời sẽ giữ điểm cuối với nhãn **Dữ liệu cũ**; lỗi quyền truy cập hoặc xoá khoá sẽ xoá điểm đang hiển thị. Chế độ demo không gọi API thật. Cấu hình xuất có contest, handle và lựa chọn phiên nhưng không có khoá; chuyển máy cần kết nối API lại.

Ứng dụng dùng cấu trúc hiện tại của [USACO IDE](https://github.com/cpinitiative/ide): metadata file trên Firebase, tài liệu `<file-id>.<language>` cho code và `<file-id>.input` cho Input trên máy chủ Yjs. Cần Internet để nhận dữ liệu. Không hỗ trợ phiên IDE cũ hoặc file chỉ chia sẻ cho tài khoản riêng. Không tải nội dung file đang có quyền `PRIVATE`.

Bộ nhận chỉ gửi yêu cầu đồng bộ và truy vấn vị trí con trỏ, **không gửi bản cập nhật code, không gửi con trỏ của BTC, không chạy hay nộp code**. Không dùng bộ liên kết hai chiều của trình soạn thảo. Quyền chia sẻ được kiểm tra lại mỗi 30 giây. Nếu mất kết nối, giữ bản code cuối và báo trạng thái; có nút kết nối lại.

Máy chủ chỉ lắng nghe `127.0.0.1`. Tất cả nguồn hình cùng dùng bộ nhận trên máy chủ, nên mở thêm bản xem trước không tạo thêm một phiên nhận USACO cho mỗi khung hình.

Đây là công cụ hỗ trợ phát sóng, không phải hệ thống giám sát chống gian lận, không đồng bộ cuộn màn hình thực của thí sinh và không tự theo file mới. Cơ chế upstream có thể thay đổi; hãy chạy thử trước ngày thi.

## Dành cho người bảo trì

```powershell
npm ci
npm run build
npm test
npm start
```

Chạy thử sáu thí sinh bằng dữ liệu minh hoạ trên **cổng riêng 8766**, không thay thế cấu hình thật:

```powershell
npm run demo
```

Có thể đổi cổng chạy thông thường bằng biến môi trường `PORT`. START.vbs mặc định dùng 8765. Để mở máy chủ mà không mở trình duyệt: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start.ps1 -NoBrowser`.

Các kiểm thử tự động dùng máy chủ Yjs mô phỏng tại localhost, kiểm tra đồng bộ ban đầu, cập nhật Code/Input, con trỏ, nối lại, quyền truy cập và các gói tin gửi ra để bảo đảm không có gói ghi code. API Codeforces được mô phỏng để kiểm tra chữ ký, chọn phiên thi, cập nhật SSE, đóng băng bảng điểm, lỗi quyền, dữ liệu cũ và huỷ lượt tải khi đổi cấu hình. Test không cần link thật, tài khoản hoặc khoá API. GitHub Actions chạy build và test trên Windows và Linux.

## Thương hiệu và thành phần bên thứ ba

Logo Sirocco thuộc Sirocco Team. Thông tin về tài nguyên và các nguồn tham khảo giao diện nằm trong [BRAND-NOTES](desktop/BRAND-NOTES.md). Dự án dùng CodeMirror, Yjs, ws, Geist và Phosphor; bộ portable kèm giấy phép các thành phần này và Node.js. Đây là dự án độc lập, không phải sản phẩm chính thức của USACO Guide.
