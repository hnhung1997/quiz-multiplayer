# Quiz Siêu Nhân

Trò chơi quiz nhiều người chơi kiểu Kahoot, kèm ngân hàng câu hỏi, thư viện quiz và chế độ làm bài kiểm tra.
Kết quả của cả hai chế độ đều được lưu theo tài khoản để xem lại và phân tích.

## Tính năng

- **Chơi nhóm real-time** — host mở phòng, người chơi vào bằng mã PIN 6 số trên điện thoại. Tính điểm theo
  tốc độ trả lời, có thưởng chuỗi đúng liên tiếp.
- **Chế độ kiểm tra** — cả đề hiện ra một lần như tờ giấy thi, làm xong nộp một lần, máy chủ chấm và chỉ ra
  từng câu sai kèm giải thích.
- **Ngân hàng câu hỏi** — soạn một lần, dùng lại cho nhiều bộ quiz.
- **Thư viện quiz** — bộ quiz công khai ai cũng chơi được, bộ riêng tư chỉ chủ sở hữu thấy.
- **Tài khoản & phân quyền** — học sinh / giáo viên / quản trị.
- **Thống kê cho giáo viên** — câu nào cả lớp hay sai, đáp án nhiễu nào đang đánh lừa nhiều người.
- **Giao diện sáng/tối** — theo lựa chọn hoặc theo hệ điều hành.
- **Chơi một mình** — luyện tập ngay trên trình duyệt, không cần tài khoản, và quay số may mắn chọn tên.

## Chạy thử

Cần Node.js ≥ 22 (khuyến nghị 24+) và một cơ sở dữ liệu PostgreSQL (dự án này dùng Supabase gói free).

```bash
npm install
cp .env.example .env       # điền mật khẩu CSDL và JWT_SECRET
npm run db:migrate         # tạo bảng
npm run db:seed            # tài khoản mẫu + một bộ quiz công khai

npm run dev                # mở http://localhost:5173
```

Tài khoản mẫu sau khi seed:

| Vai trò | Đăng nhập | Mật khẩu |
|---|---|---|
| Quản trị | `admin@quiz.local` | theo `SEED_ADMIN_PASSWORD` trong `.env` |
| Giáo viên | `teacher@quiz.local` | `teacher123` |
| Học sinh | `student@quiz.local` | `student123` |

Chạy bản production:

```bash
npm run build && npm start   # http://localhost:3000
```

Người chơi trên điện thoại cần cùng mạng Wi-Fi với máy chạy server, dùng địa chỉ IP LAN
(ví dụ `http://192.168.1.10:3000`) thay cho `localhost`.

## Cấu hình cơ sở dữ liệu (Supabase)

Cổng quyết định cách kết nối:

| Biến | Cổng | Chế độ | Dùng cho |
|---|---|---|---|
| `DATABASE_URL` | 6543 | transaction pooler | ứng dụng đang chạy — **bắt buộc** `?pgbouncer=true` |
| `DIRECT_URL` | 5432 | session pooler | chỉ dùng cho `prisma migrate` |

Cổng 6543 không hỗ trợ prepared statement nên thiếu `pgbouncer=true` là Prisma sẽ lỗi chập chờn lúc tải cao,
còn migrate thì không chạy được qua cổng này. Nhớ mã hoá URL nếu mật khẩu có ký tự `@ : / ? # & %`.

## Lệnh thường dùng

```bash
npm run dev          # Express :3000 + Vite :5173
npm run build        # build giao diện React
npm start            # chạy bản đã build
npm test             # kiểm thử logic (không cần CSDL, không cần máy chủ)
npm run test:e2e     # kiểm thử đầu-cuối (cần máy chủ đang chạy + CSDL đã seed)
npm run typecheck    # kiểm tra kiểu toàn bộ
npm run db:studio    # xem dữ liệu bằng Prisma Studio
```

## Kiến trúc

```
shared/   schema zod + kiểu TypeScript dùng chung cho cả hai phía
server/   Express + Socket.IO + Prisma (TypeScript, Node chạy thẳng, không cần build)
client/   Vite + React 19 + Tailwind v4 + shadcn/ui
prisma/   schema.prisma + seed
```

**Nguyên tắc quan trọng nhất:** máy chủ không bao giờ gửi đáp án đúng ra ngoài trước khi câu hỏi kết thúc.
Sự kiện `new_question` chỉ có nội dung câu hỏi; đề bài ở chế độ kiểm tra được lược bỏ `isCorrect`; mọi việc
chấm điểm đều nằm ở máy chủ. Có kiểm thử tự động canh giữ nguyên tắc này ở cả hai tầng: `server/test/answer-key.test.ts` kiểm tra hàm
tạo dữ liệu, còn `server/test/e2e/live.e2e.ts` bắt gói tin thật trên đường truyền.

Chi tiết kiến trúc, quy ước và các quyết định thiết kế nằm trong [CLAUDE.md](./CLAUDE.md).
