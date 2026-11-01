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

## Bản 1.6: Kiểu ICPC/IOI, Real Name và hiệu ứng kết quả

- Trong **Điểm thi đấu → Kiểu hiển thị**, chọn **Theo contest**, **ICPC** hoặc **IOI**. ICPC hiện `AC` cho từng bài đã giải, tổng số bài và penalty; IOI hiện điểm số. Lựa chọn này không đổi cơ chế chấm trên website thi.
- Ô **Real Name** nằm cạnh nickname Codeforces/VNOJ. Họ tên hiển thị trên đầu ô code và cạnh nickname ở thanh thành tích; bỏ trống sẽ dùng tên ô đang có. Dữ liệu cũ, link và phiên đã ghim được giữ lại.
- Kết quả mới phủ xanh/đỏ toàn ô thí sinh và hiện nhãn ngắn. ICPC: AC xanh, kết quả không AC đỏ. IOI: tăng điểm so với lượt nộp trước cùng bài hoặc đạt điểm tối đa xanh; thấp điểm hơn đỏ; bằng điểm dưới mức tối đa không phát hiệu ứng. Nếu lịch sử API bị giới hạn và không có lượt trước của bài đó, dùng điểm BXH lúc kết nối làm mốc. Đang chấm, dữ liệu cũ, tải lại trang và đổi hạng không phát lại; với dữ liệu từng lượt nộp, chấm lại cùng mã bài nộp cũng không phát lại. Khi chỉ theo BXH, ứng dụng chỉ biết thay đổi trên BXH, không phân biệt được mọi trường hợp chấm lại.
- Có công tắc hiệu ứng, **Sound effect**, âm lượng và nút **Thử xanh / AC**, **Thử đỏ**. Âm thanh được tổng hợp tại máy, không tải từ dịch vụ ngoài. Sound mặc định tắt. Khi bật, mở nguồn phát và bấm **Bật âm thanh kết quả** một lần để trình duyệt cho phép phát. Với OBS/Streamlabs, dùng Interact/Tương tác nguồn để bấm nút, rồi đưa âm thanh Browser Source vào mixer theo cấu hình phần mềm phát sóng.
- Hiệu ứng dùng opacity và chuyển vị ngắn theo token Animate UI bằng CSS; chế độ giảm chuyển động giữ màu/fade và bỏ chuyển vị. Nút thử chỉ tác động bản xem trước, không tạo bài nộp hay đổi điểm thật.
- Codeforces đọc kết quả từng submission qua API, lọc đúng phiên đã chọn. VNOJ công khai chỉ cho biết điểm tốt nhất và số lần sai; hiệu ứng theo BXH hoạt động với thay đổi thấy được, nhưng không suy ra một lần nộp IOI thấp điểm hơn từ tổng điểm không đổi.
- **VNOJ Companion** đi kèm trong `companion/vnoj`: ghép nối để đọc kết quả phiên thi ảo đang đăng nhập trên cùng máy và nhận cả lượt thấp điểm hơn. [Hướng dẫn tiện ích](companion/vnoj/README.md). Chưa ghép nối sẽ có nhãn “Theo thay đổi BXH”; đã nối sẽ hiện “Kết quả từng lượt nộp”. Tiện ích chưa hỗ trợ gửi từ máy thí sinh khác đến máy BTC.

## VNOJ và phiên thi ảo

- Trong **Điểm thi đấu**, chọn nguồn **VNOJ · ICPC**, bật theo dõi và nhập link `https://oj.vnoi.info/contest/<mã contest>`.
- Nhập username VNOJ cho thí sinh rồi lưu. Bộ chọn phiên sẽ hiện các lượt chính thức/thi ảo đọc được từ BXH công khai. Chọn đúng lượt rồi lưu lại để ghim mã tham gia; nhiều lượt không tự chọn theo điểm cao nhất. Nếu phiên đã ghim biến mất, ứng dụng báo chưa tìm thấy và không đổi sang lượt khác.
- Nguồn live ghép code/Input USACO với số bài, penalty, hạng và điểm từng bài từ VNOJ. Hạng theo BXH công khai gồm các phiên thi ảo, không phải BXH riêng giữa các thí sinh trên live. Theo dõi độc lập với code; lấy lại điểm mỗi 15–180 giây theo thiết lập và thời gian cache của VNOJ.
- Hiện hỗ trợ BXH công khai trên `oj.vnoi.info`, thể thức ICPC và IOI. Không cần khoá API hoặc cookie cho BXH công khai. BXH riêng tư cần đăng nhập chưa được hỗ trợ. Dữ liệu đóng băng được giữ theo nguồn; kết quả riêng từng lượt thi ảo cần Companion, không suy ra từ tổng điểm.
- Cấu hình Codeforces/Gym tiếp tục hoạt động; mỗi khung có nguồn điểm riêng. Trường cấu hình `codeforces.provider` dùng để phân biệt nguồn, giữ tương thích với file cấu hình cũ.

## Khung phát tuỳ chọn

- Có sẵn ba khung **Không chuyên**, **Chuyên Tin**, **ICPC**. Dùng **Thêm khung** để tạo nguồn theo tên tuỳ chọn; mỗi nguồn giữ bố cục, cỡ chữ và contest riêng.
- Nút quản lý cạnh tên khung cho phép đổi tên hoặc xoá. Đổi tên giữ nguyên link Browser Source. Khi xoá khung có thí sinh, chọn khung đích để giữ toàn bộ tên, link USACO và handle. Có tối đa 12 khung và 16 thí sinh trong một phiên.
- Cấu hình 1.3 được chuyển sang phiên bản 2 và thêm ICPC một lần. Các nguồn đã xoá sẽ không tự xuất hiện lại. Xuất/nhập cấu hình giữ các khung tuỳ chọn.
- Giao diện quản trị dùng nền trung tính, chữ sáng và thanh bên bám đầy chiều cao màn hình khi cuộn. Thanh điều hướng đưa tới nguồn phát, thí sinh, điểm và cấu hình. Lưu các thiết lập hình ảnh giữ nguyên iframe xem trước.
- Nguồn live dùng bảng màu than đồng nhất cho code, Input và thành tích. Thanh điểm nền tối, tổng điểm vàng cát, bài đạt điểm xanh dịu; handle và điểm từng bài ở trái, tổng điểm và lượt nộp ở phải. Ô nhỏ tự xếp lại để giữ handle dễ đọc. Bố cục tự tính số cột/hàng theo số thí sinh.
- Hoạt ảnh theo hướng dẫn Animate UI cho CSS: phản hồi nút, chuyển khung, mở/đóng dialog và đổi điểm. Dùng các curve/timing theo vai trò, tôn trọng `prefers-reduced-motion`; giữ native dialog cho quản lý focus và Escape. Dùng tween CSS thay cho spring React; không thêm React hoặc gói Animate UI vào ứng dụng JavaScript thuần.

### Thành tích Codeforces trên nguồn live

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
- Nguồn ICPC: <http://127.0.0.1:8765/view/icpc>

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
