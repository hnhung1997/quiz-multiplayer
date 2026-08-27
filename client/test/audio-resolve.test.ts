import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOOP_NAMES,
  SOUND_NAMES,
  isLoopName,
  isSoundName,
  parseManifest,
  resolveSource,
} from "../src/lib/audio/resolve.ts";

/*
 * Đây là phần duy nhất của hệ thống âm thanh kiểm tự động được — phần còn lại
 * cần AudioContext mà Node không có. `resolve.ts` cố ý không import gì để chạy
 * được ở đây.
 */

test("không có manifest thì mọi âm đều tổng hợp", () => {
  const manifest = parseManifest(undefined);
  assert.deepEqual(manifest, {});
  for (const name of SOUND_NAMES) {
    assert.deepEqual(resolveSource(name, manifest), { kind: "synth" }, name);
  }
});

test("manifest hợp lệ thì tên được khai báo chuyển sang dùng tệp", () => {
  const manifest = parseManifest({ correct: "correct.mp3", lobby: "nhac-cho.ogg" });
  assert.deepEqual(resolveSource("correct", manifest), { kind: "file", url: "/sounds/correct.mp3" });
  assert.deepEqual(resolveSource("lobby", manifest), { kind: "file", url: "/sounds/nhac-cho.ogg" });
  // Tên không khai báo vẫn tổng hợp — trộn lẫn được.
  assert.deepEqual(resolveSource("wrong", manifest), { kind: "synth" });
});

test("manifest hỏng không làm vỡ gì, chỉ quay về âm tổng hợp", () => {
  for (const bad of [null, "chuỗi", 42, [], [1, 2], true]) {
    assert.deepEqual(parseManifest(bad), {}, JSON.stringify(bad));
  }
});

test("bỏ qua tên âm không có thật và giá trị sai kiểu", () => {
  const manifest = parseManifest({
    khong_ton_tai: "x.mp3",
    correct: 123,
    wrong: "",
    timeout: "   ",
    reveal: "reveal.mp3",
  });
  assert.deepEqual(manifest, { reveal: "reveal.mp3" });
});

test("chặn tên tệp trỏ ra ngoài thư mục sounds", () => {
  const manifest = parseManifest({
    correct: "../../secret.mp3",
    wrong: "/etc/passwd",
    timeout: "sub\\dir.mp3",
    join: "nested/file.mp3",
    reveal: ".hidden.mp3",
    podium: "ok.mp3",
  });
  assert.deepEqual(manifest, { podium: "ok.mp3" }, "chỉ tên trơn mới được nhận");
});

test("cắt khoảng trắng thừa quanh tên tệp", () => {
  assert.deepEqual(parseManifest({ correct: "  a.mp3  " }), { correct: "a.mp3" });
});

test("danh mục tên âm nhất quán", () => {
  assert.equal(new Set(SOUND_NAMES).size, SOUND_NAMES.length, "không được trùng tên");
  for (const loop of LOOP_NAMES) {
    assert.ok(SOUND_NAMES.includes(loop), `${loop} phải nằm trong SOUND_NAMES`);
    assert.ok(isLoopName(loop));
  }
  assert.ok(isSoundName("correct"));
  assert.ok(!isSoundName("khong_co"));
  assert.ok(!isLoopName("correct"), "âm một tiếng không phải vòng lặp");
});
