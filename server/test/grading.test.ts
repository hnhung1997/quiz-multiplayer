import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeTest, scoreLiveAnswer } from "../src/services/grading.service.ts";

/**
 * Bản gốc, chép nguyên từ `endQuestion()` trong server.js trước khi tái cấu trúc.
 * Đây là mốc so sánh: điểm số của người chơi không được đổi.
 */
function legacyScore(correct: boolean, elapsed: number, timeLimit: number, streakBefore: number) {
  let gained = 0;
  let streak = streakBefore;
  if (correct) {
    const timeFrac = Math.max(0, 1 - elapsed / (timeLimit * 1000));
    gained = Math.round(500 + 500 * timeFrac);
    streak = streakBefore + 1;
    gained += Math.min(streak - 1, 5) * 20;
  } else {
    streak = 0;
  }
  return { gained, streak };
}

test("điểm chơi trực tiếp khớp đúng công thức bản cũ", () => {
  let checked = 0;
  for (const correct of [true, false]) {
    for (const timeLimit of [4, 15, 30, 120]) {
      for (const streakBefore of [0, 1, 3, 5, 6, 12]) {
        for (const frac of [0, 0.001, 0.33, 0.5, 0.9999, 1, 1.5]) {
          const elapsedMs = Math.round(timeLimit * 1000 * frac);
          assert.deepEqual(
            scoreLiveAnswer({ correct, elapsedMs, timeLimitSec: timeLimit, previousStreak: streakBefore }),
            legacyScore(correct, elapsedMs, timeLimit, streakBefore),
            `sai lệch ở correct=${correct} tl=${timeLimit} streak=${streakBefore} elapsed=${elapsedMs}`
          );
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 336);
});

test("trả lời trễ hơn thời gian cho phép vẫn được điểm nền, không âm", () => {
  const r = scoreLiveAnswer({ correct: true, elapsedMs: 999_999, timeLimitSec: 10, previousStreak: 0 });
  assert.equal(r.gained, 500);
  assert.equal(r.streak, 1);
});

test("trả lời sai làm mất chuỗi", () => {
  const r = scoreLiveAnswer({ correct: false, elapsedMs: 0, timeLimitSec: 10, previousStreak: 7 });
  assert.deepEqual(r, { gained: 0, streak: 0 });
});

test("thưởng chuỗi bị chặn ở +100", () => {
  const big = scoreLiveAnswer({ correct: true, elapsedMs: 0, timeLimitSec: 10, previousStreak: 50 });
  const cap = scoreLiveAnswer({ correct: true, elapsedMs: 0, timeLimitSec: 10, previousStreak: 5 });
  assert.equal(big.gained, cap.gained);
  assert.equal(big.gained, 1000 + 100);
});

test("chấm bài kiểm tra: bỏ trống tính là sai", () => {
  const r = gradeTest([
    { questionId: "a", selectedOptionId: "o1", correctOptionId: "o1" },
    { questionId: "b", selectedOptionId: "o9", correctOptionId: "o2" },
    { questionId: "c", selectedOptionId: null, correctOptionId: "o3" },
  ]);
  assert.equal(r.correctCount, 1);
  assert.equal(r.totalQuestions, 3);
  assert.equal(r.score, 1);
  assert.equal(r.maxScore, 3);
  assert.ok(Math.abs(r.accuracy - 1 / 3) < 1e-9);
});

test("chấm bài rỗng không chia cho 0", () => {
  const r = gradeTest([]);
  assert.equal(r.accuracy, 0);
  assert.equal(r.maxScore, 0);
});
