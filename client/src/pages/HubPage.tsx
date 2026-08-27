import { Link } from "react-router-dom";
import { Dices, Gamepad2, Library, Monitor, PencilRuler, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Tile {
  to: string;
  icon: typeof Dices;
  title: string;
  desc: string;
  cta: string;
}

const SOLO: Tile[] = [
  {
    to: "/solo",
    icon: Gamepad2,
    title: "Chơi một mình",
    desc: "Luyện tập với ngân hàng câu hỏi lưu trong trình duyệt này.",
    cta: "Chơi ngay",
  },
  {
    to: "/solo/manage",
    icon: PencilRuler,
    title: "Soạn câu hỏi",
    desc: "Thêm, sửa, xoá câu hỏi cho chế độ chơi một mình.",
    cta: "Mở trình soạn",
  },
  {
    to: "/spinner",
    icon: Dices,
    title: "Quay số may mắn",
    desc: "Bốc thăm ngẫu nhiên một cái tên trong danh sách.",
    cta: "Quay ngay",
  },
];

const GROUP: Tile[] = [
  {
    to: "/quizzes",
    icon: Library,
    title: "Thư viện quiz",
    desc: "Duyệt các bộ quiz công khai, chơi nhóm hoặc làm bài kiểm tra.",
    cta: "Xem thư viện",
  },
  {
    to: "/host",
    icon: Monitor,
    title: "Làm host",
    desc: "Mở phòng từ một bộ quiz và điều khiển trận đấu.",
    cta: "Mở phòng",
  },
  {
    to: "/play",
    icon: Smartphone,
    title: "Tham gia bằng PIN",
    desc: "Nhập mã PIN 6 số để vào phòng của host.",
    cta: "Vào phòng",
  },
];

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.to} className="flex flex-col">
          <CardHeader>
            <t.icon className="mb-2 size-7 text-primary" aria-hidden />
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.desc}</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full">
              <Link to={t.to}>{t.cta}</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function HubPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl font-bold">Trung tâm trò chơi</h1>
        <p className="mt-1 text-muted-foreground">Chọn cách bạn muốn học hôm nay.</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Một mình</h2>
        <TileGrid tiles={SOLO} />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold">Cùng cả lớp</h2>
        <TileGrid tiles={GROUP} />
      </section>
    </div>
  );
}
