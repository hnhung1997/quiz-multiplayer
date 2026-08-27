# Âm thanh của game

Mặc định **không cần tệp nào** ở đây. Toàn bộ âm thanh được sinh trực tiếp trong trình duyệt bằng Web Audio
API (`client/src/lib/audio/synth.ts`), nên game có tiếng ngay sau khi cài, không tốn KB tải thêm và không
vướng bản quyền của ai.

Thư mục này là chỗ để **thay** âm tổng hợp bằng tệp nhạc của riêng bạn.

## Cách thêm nhạc

1. Chép tệp âm thanh vào đúng thư mục này (`client/public/sounds/`).
2. Khai báo tên trong `manifest.json`:

```json
{
  "correct": "correct.mp3",
  "lobby": "nhac-phong-cho.mp3"
}
```

3. Tải lại trang. Tên nào có trong manifest thì dùng tệp, tên nào không có thì vẫn dùng âm tổng hợp — trộn
   lẫn thoải mái.

Định dạng: bất kỳ thứ gì trình duyệt giải mã được (`.mp3`, `.ogg`, `.wav`, `.m4a`). Tên tệp phải là tên trơn
nằm ngay trong thư mục này — không có `/`, không có `..`.

## Danh sách tên dùng được

| Tên | Khi nào kêu | Ghi chú |
|---|---|---|
| `countdown` | mỗi giây của 3 · 2 · 1 | nên ngắn dưới 0,3 giây |
| `tick` | 5 giây cuối mỗi câu hỏi | rất ngắn, sẽ kêu liên tục |
| `correct` | trả lời đúng | |
| `wrong` | trả lời sai | |
| `timeout` | hết giờ | |
| `join` | có người vào phòng chờ | chỉ màn host |
| `reveal` | công bố đáp án | |
| `podium` | kết thúc trận đấu | |
| `lobby` | **lặp** — nhạc phòng chờ | nên cắt sẵn để nối vòng cho mượt |
| `suspense` | **lặp** — trong lúc trả lời | nên cắt sẵn để nối vòng cho mượt |

Hai mục `lobby` và `suspense` phát lặp vô hạn. Tệp nào không được cắt gọn ở điểm nối sẽ nghe rõ chỗ giật mỗi
vòng — âm tổng hợp không bị vấn đề này vì nó được hẹn lịch theo đồng hồ của AudioContext.

## Bản quyền

**Chỉ thả vào đây nhạc mà bạn có quyền sử dụng**: nhạc bạn tự làm, nhạc đã mua giấy phép, hoặc nhạc phát
hành theo giấy phép cho phép (CC0, CC-BY…, nhớ ghi công nếu giấy phép yêu cầu).

Đừng chép nhạc từ Kahoot hay các sản phẩm thương mại khác vào đây — đó là tác phẩm có bản quyền của họ. Đây
cũng chính là lý do dự án chọn hướng tự tổng hợp âm thanh ngay từ đầu.

Thư mục này nằm trong `client/public/` nên mọi tệp bạn bỏ vào sẽ được đóng gói và phục vụ công khai cùng
ứng dụng.
