import { test } from "node:test";
import assert from "node:assert/strict";
import { correctIndexOf, normalizeLegacyQuestion, toQuestionDto } from "../src/utils/question.mapper.ts";
import { LIMITS } from "@quiz/shared";

const dbQuestion = {
  id: "q1",
  text: "Ai là đội trưởng?",
  explanation: "Vì màu đỏ.",
  imageCorrect: "dung.jpg",
  imageWrong: "sai.jpg",
  timeLimit: 15,
  points: 1000,
  position: 0,
  options: [
    { id: "o1", position: 0, text: "Đỏ", color: "#e03434", isCorrect: true },
    { id: "o2", position: 1, text: "Xanh", color: "#2f9eff", isCorrect: false },
  ],
};

/*
 * Bất biến quan trọng nhất của ứng dụng: đáp án đúng không rời máy chủ trước
 * khi câu hỏi kết thúc. Nếu bài kiểm tra này đỏ, đừng nới lỏng nó — hãy sửa
 * chỗ gọi.
 */
test("includeAnswer=false không để lộ đáp án đúng dưới bất kỳ dạng nào", () => {
  const dto = toQuestionDto(dbQuestion, false);
  const json = JSON.stringify(dto);

  assert.ok(!("isCorrect" in (dto.options[0] as object)), "không được có khoá isCorrect");
  assert.ok(!json.includes("isCorrect"), "JSON không được chứa 'isCorrect'");
  assert.ok(!json.includes("true"), "JSON không được chứa giá trị true nào");
  assert.equal(dto.options.length, 2, "vẫn phải giữ đủ lựa chọn");
  assert.equal(dto.options[0]!.text, "Đỏ");
});

test("includeAnswer=true trả đáp án cho tác giả và cho bài đã chấm", () => {
  const dto = toQuestionDto(dbQuestion, true);
  assert.equal(dto.options[0]!.isCorrect, true);
  assert.equal(dto.options[1]!.isCorrect, false);
});

test("lựa chọn luôn được sắp theo position, không theo thứ tự mảng", () => {
  const shuffled = { ...dbQuestion, options: [...dbQuestion.options].reverse() };
  assert.equal(toQuestionDto(shuffled, false).options[0]!.text, "Đỏ");
  assert.equal(correctIndexOf(shuffled), 0);
});

test("nhập dữ liệu cũ: cắt gọt đúng giới hạn", () => {
  const q = normalizeLegacyQuestion({
    q: "x".repeat(9999),
    opts: Array.from({ length: 20 }, (_, i) => ({ text: `đáp án ${i}`, color: i })),
    a: 999,
    explanation: "y".repeat(9999),
    time_limit: 99999,
  });
  assert.ok(q);
  assert.equal(q.text.length, LIMITS.QUESTION_TEXT_MAX);
  assert.equal(q.options.length, LIMITS.OPTIONS_MAX);
  assert.equal(q.explanation!.length, LIMITS.EXPLANATION_MAX);
  assert.equal(q.timeLimit, LIMITS.TIME_LIMIT_DEFAULT, "thời gian vô lý phải rơi về mặc định");
  assert.equal(q.options.filter((o) => o.isCorrect).length, 1, "phải có đúng một đáp án đúng");
  assert.equal(q.options[0]!.isCorrect, true, "chỉ số vượt phạm vi phải kẹp về 0");
});

test("nhập dữ liệu cũ: loại bỏ câu không dùng được", () => {
  assert.equal(normalizeLegacyQuestion({ q: "", opts: [{ text: "a" }, { text: "b" }], a: 0 }), null);
  assert.equal(normalizeLegacyQuestion({ q: "Câu hỏi", opts: [{ text: "chỉ một" }], a: 0 }), null);
});

test("nhập dữ liệu cũ: màu dạng số cũ vẫn hiểu được", () => {
  const q = normalizeLegacyQuestion({
    q: "Câu hỏi",
    opts: [{ text: "a", color: 0 }, { text: "b", color: "#123456" }],
    a: 1,
  });
  assert.equal(q!.options[0]!.color, "#e03434", "số 0 là chỉ số vào bảng màu mặc định");
  assert.equal(q!.options[1]!.color, "#123456", "chuỗi hex giữ nguyên");
  assert.equal(q!.options[1]!.isCorrect, true);
});
