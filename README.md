# Quiz Siêu Nhân — Chơi Nhóm (Multiplayer + Mã PIN)

Bản nâng cấp thêm chế độ **chơi nhóm real-time** cho game Quiz Siêu Nhân của bạn,
dùng **Node.js + Socket.IO** làm server thật (không còn chỉ chạy 1 file HTML).

## Những gì được giữ nguyên
- `index.html`, `js.html`, `style.css` và toàn bộ hình ảnh — y hệt bản gốc.
- Chế độ "Chơi Một Mình" (localStorage) vẫn hoạt động như cũ, không đổi gì.
- Câu hỏi bạn đã tạo trong **Quản Lý Câu Hỏi** (`localStorage: pr_quiz_questions`)
  được tự động dùng làm ngân hàng câu hỏi khi tạo phòng chơi nhóm.

## Những gì được thêm mới
- `server.js` — server Node.js/Express/Socket.IO, giữ **toàn bộ trạng thái trận đấu,
  đáp án đúng và điểm số phía server** (client không thể gian lận điểm hay biết trước đáp án).
- `public/host.html` — màn hình Host: tạo phòng, hiện mã PIN 6 số, theo dõi người chơi
  vào phòng, bắt đầu/chuyển câu, xem thống kê từng câu, bảng xếp hạng, podium cuối trận.
- `public/player.html` — màn hình Người chơi: nhập PIN + tên, chờ trong lobby, trả lời
  câu hỏi bằng nút màu lớn dễ bấm trên điện thoại, xem kết quả & điểm nhận được.
- Trong Game Hub (`js.html`) có thêm thẻ **"Chơi Nhóm (Multiplayer)"** với 2 nút:
  Làm Host / Tham gia bằng PIN.

## Cách chạy

```bash
cd quizarena-multiplayer
npm install
npm start
```

Server chạy tại: `http://localhost:3000`

- Host mở: `http://localhost:3000/js.html` → bấm **Chơi Nhóm → Làm Host**
  (hoặc vào thẳng `http://localhost:3000/host.html`)
- Người chơi mở trên điện thoại: `http://localhost:3000/player.html`
  (điện thoại phải cùng mạng Wi-Fi với máy chạy server — dùng địa chỉ IP LAN của máy,
  ví dụ `http://192.168.1.10:3000/player.html` thay vì `localhost`)

## Luồng chơi nhóm

1. Host bấm **Tạo Phòng Chơi Nhóm** → nhận mã PIN 6 số.
2. Người chơi vào `player.html`, nhập PIN + tên → vào phòng chờ.
3. Host bấm **Bắt Đầu Trận Đấu** → câu hỏi đầu tiên hiện ra cho mọi người cùng lúc.
4. Người chơi bấm chọn đáp án — chỉ được trả lời **một lần**, điểm tính theo:
   - Trả lời đúng: `500 + tối đa 500 điểm thưởng theo tốc độ` (càng nhanh càng nhiều điểm).
   - Trả lời sai hoặc hết giờ: `0 điểm`.
   - Có thêm thưởng nhỏ cho chuỗi trả lời đúng liên tiếp (tối đa +100đ).
5. Khi hết giờ (hoặc mọi người đã trả lời), server tự chốt và gửi **kết quả + đáp án đúng**
   cho tất cả — trước đó không ai (kể cả host) nhận được đáp án đúng qua mạng.
6. Host bấm **Câu Tiếp Theo** để tiếp tục, hoặc **Kết Thúc Sớm**.
7. Hết câu hỏi → hiện bảng xếp hạng cuối cùng với 🥇🥈🥉.

## Giới hạn của bản MVP này (có thể mở rộng sau)
- Dữ liệu trận đấu lưu **trong bộ nhớ (in-memory)** — restart server sẽ mất phòng đang chơi
  (chưa dùng PostgreSQL/Redis). Phù hợp để chơi trong buổi học/sự kiện, không cho production lớn.
- Chưa có tài khoản đăng nhập, chưa có AI tạo quiz, chưa có trình soạn quiz kéo-thả nâng cao
  — đây là các phần lớn của bản spec "QuizArena" đầy đủ, có thể làm ở các bước tiếp theo nếu cần.
- Time limit mỗi câu lấy từ field `time_limit` của câu hỏi nếu có, mặc định 15 giây
  (giống hằng số `TIME_LIMIT` trong bản chơi một mình).

## Cấu trúc thư mục
```
quizarena-multiplayer/
├── package.json
├── package-lock.json
├── server.js              (server Node.js/Socket.IO — nguồn dữ liệu chính, giữ điểm & đáp án)
└── public/
    ├── index.html         (trang chào, không đổi)
    ├── js.html             (Game Hub — Chơi Một Mình + đã thêm nút vào Chơi Nhóm)
    ├── host.html            (màn hình host: tạo phòng, tạo/sửa câu hỏi, điều khiển trận đấu)
    ├── player.html          (màn hình người chơi: nhập PIN, trả lời, xem điểm)
    ├── style.css            (style dùng chung cho index.html / js.html)
    ├── anhnensieunhan.jpg   (ảnh nền trang chào)
    ├── dung.jpg             (ảnh feedback khi trả lời đúng)
    ├── sai.jpg              (ảnh feedback khi trả lời sai)
    └── hetgio.jpg           (ảnh feedback khi hết giờ)
```
