// prisma/seed.js
// Tạo tài khoản mẫu + một bộ câu hỏi công khai để có dữ liệu chơi thử ngay.
// Chạy lại nhiều lần vẫn an toàn (idempotent, dùng upsert theo email/tiêu đề).

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Bảng màu mặc định, khớp DEFAULT_COLORS trong các trang hiện tại.
const DEFAULT_COLORS = ["#e03434", "#ff6fcf", "#2f9eff", "#3fc05f", "#ffd24a", "#9b6bff"];

// Lấy nguyên văn từ SAMPLE_QUESTIONS trong public/host.html.
const SAMPLE_QUESTIONS = [
  {
    text: "Ai là đội trưởng của nhóm Power Rangers Ngũ Long Thần?",
    options: ["Đỏ", "Xanh dương", "Vàng", "Hồng"],
    correct: 0,
    explanation: "Ranger màu Đỏ luôn là đội trưởng trong hầu hết các mùa.",
  },
  {
    text: "Zord của Ranger Xanh Lá thường mang hình dáng con vật nào?",
    options: ["Khủng long Bạo chúa", "Rồng", "Voi ma mút", "Sư tử"],
    correct: 1,
    explanation: "Ranger Xanh Lá thường gắn liền với Dragonzord.",
  },
  {
    text: "Trong nhiều mùa, Ranger màu nào có vai trò hỗ trợ/nhanh nhẹn?",
    options: ["Hồng", "Đỏ", "Đen", "Vàng"],
    correct: 0,
    explanation: "Ranger Hồng thường đảm nhiệm vai trò linh hoạt, hỗ trợ đội hình.",
  },
];

async function upsertUser({ email, username, displayName, role, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: { displayName, role, username },
    create: { email, username, displayName, role, passwordHash },
  });
}

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@quiz.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "change-me-now";

  const admin = await upsertUser({
    email: adminEmail,
    username: "admin",
    displayName: "Quản trị viên",
    role: "ADMIN",
    password: adminPassword,
  });

  const teacher = await upsertUser({
    email: "teacher@quiz.local",
    username: "giaovien",
    displayName: "Cô Giáo Demo",
    role: "TEACHER",
    password: "teacher123",
  });

  await upsertUser({
    email: "student@quiz.local",
    username: "hocsinh",
    displayName: "Học Sinh Demo",
    role: "STUDENT",
    password: "student123",
  });

  // Ngân hàng câu hỏi mẫu thuộc về giáo viên demo.
  const BANK_TITLE = "Ngân hàng mẫu — Siêu Nhân";
  let bank = await prisma.questionBank.findFirst({
    where: { ownerId: teacher.id, title: BANK_TITLE },
  });
  if (!bank) {
    bank = await prisma.questionBank.create({
      data: {
        ownerId: teacher.id,
        title: BANK_TITLE,
        description: "Bộ câu hỏi khởi động, chuyển từ SAMPLE_QUESTIONS của bản cũ.",
        visibility: "PUBLIC",
      },
    });
  }

  // Xoá câu hỏi cũ của ngân hàng mẫu rồi tạo lại, để seed luôn cho kết quả giống nhau.
  await prisma.question.deleteMany({ where: { bankId: bank.id } });

  const questions = [];
  for (const [i, q] of SAMPLE_QUESTIONS.entries()) {
    questions.push(
      await prisma.question.create({
        data: {
          bankId: bank.id,
          text: q.text,
          explanation: q.explanation,
          position: i,
          timeLimit: 15,
          points: 1000,
          options: {
            create: q.options.map((text, idx) => ({
              position: idx,
              text,
              color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
              isCorrect: idx === q.correct,
            })),
          },
        },
      })
    );
  }

  // Bộ quiz công khai, ai cũng thấy trong thư viện.
  const QUIZ_TITLE = "Quiz Siêu Nhân — Bản Demo";
  let quiz = await prisma.quiz.findFirst({
    where: { ownerId: teacher.id, title: QUIZ_TITLE },
  });
  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: {
        ownerId: teacher.id,
        title: QUIZ_TITLE,
        description: "Ba câu hỏi khởi động về Power Rangers. Chơi nhóm hoặc làm bài kiểm tra đều được.",
        visibility: "PUBLIC",
        isPublished: true,
        allowTestMode: true,
        publishedAt: new Date(),
      },
    });
  }

  await prisma.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
  await prisma.quizQuestion.createMany({
    data: questions.map((q, i) => ({ quizId: quiz.id, questionId: q.id, position: i })),
  });

  console.log("✅ Seed xong:");
  console.log(`   admin   : ${admin.email} / ${adminPassword}`);
  console.log(`   teacher : ${teacher.email} / teacher123`);
  console.log(`   student : student@quiz.local / student123`);
  console.log(`   quiz    : "${quiz.title}" (${questions.length} câu, PUBLIC)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed thất bại:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
