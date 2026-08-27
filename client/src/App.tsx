import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { ProtectedRoute } from "@/components/protected-route";

import { LandingPage } from "@/pages/LandingPage";
import { HubPage } from "@/pages/HubPage";
import { SoloQuizPage } from "@/pages/SoloQuizPage";
import { QuestionManagerPage } from "@/pages/QuestionManagerPage";
import { SpinnerPage } from "@/pages/SpinnerPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { LibraryPage } from "@/pages/LibraryPage";
import { QuizDetailPage } from "@/pages/QuizDetailPage";
import { QuizEditorPage } from "@/pages/QuizEditorPage";
import { BanksPage } from "@/pages/BanksPage";
import { BankDetailPage } from "@/pages/BankDetailPage";
import { HostPage } from "@/pages/HostPage";
import { PlayPage } from "@/pages/PlayPage";
import { TestPage } from "@/pages/TestPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { QuizAnalyticsPage } from "@/pages/QuizAnalyticsPage";
import { AdminPage } from "@/pages/AdminPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export function App() {
  return (
    <Routes>
      {/* Trang chào đứng riêng, không dùng khung điều hướng. */}
      <Route path="/" element={<LandingPage />} />

      <Route element={<AppLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Chơi một mình — hoàn toàn trong trình duyệt, không cần tài khoản. */}
        <Route path="/hub" element={<HubPage />} />
        <Route path="/solo" element={<SoloQuizPage />} />
        <Route path="/solo/manage" element={<QuestionManagerPage />} />
        <Route path="/spinner" element={<SpinnerPage />} />

        {/* Thư viện: xem được khi chưa đăng nhập, chỉ thấy quiz công khai. */}
        <Route path="/quizzes" element={<LibraryPage />} />
        <Route path="/quizzes/:id" element={<QuizDetailPage />} />

        {/* Khách vẫn vào phòng bằng PIN được. */}
        <Route path="/play" element={<PlayPage />} />

        {/* Làm bài và xem kết quả: bắt buộc đăng nhập để gắn với tài khoản. */}
        <Route element={<ProtectedRoute />}>
          <Route path="/test/:quizId" element={<TestPage />} />
          <Route path="/results/:attemptId" element={<ResultsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Soạn nội dung và mở phòng: chỉ giáo viên/quản trị. */}
        <Route element={<ProtectedRoute roles={["TEACHER", "ADMIN"]} />}>
          <Route path="/quizzes/new" element={<QuizEditorPage />} />
          <Route path="/quizzes/:id/edit" element={<QuizEditorPage />} />
          <Route path="/banks" element={<BanksPage />} />
          <Route path="/banks/:id" element={<BankDetailPage />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/quizzes/:id/analytics" element={<QuizAnalyticsPage />} />
        </Route>

        <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
