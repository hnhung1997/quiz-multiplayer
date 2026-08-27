/**
 * Trạng thái phòng chơi, giữ trong bộ nhớ.
 *
 * Có chủ đích: ván đang chạy KHÔNG đọc/ghi CSDL ở đường nóng. CSDL chỉ được
 * ghi ở các mốc (mở phòng, chốt câu, kết thúc), nên một cú nghẽn mạng tới
 * Supabase không thể làm treo ván đấu. Khởi động lại tiến trình vẫn mất phòng
 * đang chơi — giống hệt bản cũ.
 */
import { LIMITS } from "@quiz/shared";

export type RoomState = "lobby" | "question" | "reveal" | "ended";

/** Câu hỏi kèm đáp án đúng — chỉ tồn tại phía máy chủ. */
export interface RoomQuestion {
  id: string;
  text: string;
  explanation: string | null;
  imageCorrect: string;
  imageWrong: string;
  timeLimit: number;
  options: Array<{ id: string; text: string; color: string | null; isCorrect: boolean }>;
  /** Vị trí đáp án đúng. Không bao giờ gửi ra ngoài trước lúc chốt câu. */
  correctIndex: number;
}

export interface RoomPlayer {
  socketId: string;
  name: string;
  score: number;
  streak: number;
  /** Số câu trả lời đúng, đếm ngay lúc chốt từng câu. */
  correctCount: number;
  connected: boolean;
  /** null nếu là khách chơi không đăng nhập. */
  userId: string | null;
  /** Hàng `attempts` tương ứng, tạo khi ván bắt đầu. */
  attemptId: string | null;
}

export interface Room {
  pin: string;
  hostSocketId: string;
  hostUserId: string;
  quizId: string;
  quizTitle: string;
  sessionId: string | null;
  questions: RoomQuestion[];
  state: RoomState;
  currentIndex: number;
  players: Map<string, RoomPlayer>;
  timer: NodeJS.Timeout | null;
  questionStartAt: number | null;
  currentAnswers: Map<string, { idx: number; elapsedMs: number }>;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  /** PIN 6 chữ số chưa được dùng bởi phòng nào đang sống. */
  generatePin(): string {
    let pin: string;
    do {
      pin = String(Math.floor(100000 + Math.random() * 900000));
    } while (this.rooms.has(pin));
    return pin;
  }

  create(room: Room): Room {
    this.rooms.set(room.pin, room);
    return room;
  }

  get(pin: string | null | undefined): Room | undefined {
    return pin ? this.rooms.get(pin) : undefined;
  }

  delete(pin: string): void {
    const room = this.rooms.get(pin);
    if (room) this.clearTimer(room);
    this.rooms.delete(pin);
  }

  clearTimer(room: Room): void {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
  }

  /** Tên trong một phòng phải là duy nhất — client dò kết quả của mình theo tên. */
  isNameTaken(room: Room, name: string): boolean {
    const lower = name.toLowerCase();
    return Array.from(room.players.values()).some((p) => p.name.toLowerCase() === lower);
  }

  canJoin(room: Room): { ok: true } | { ok: false; error: string } {
    if (room.state !== "lobby") return { ok: false, error: "Ván chơi đã bắt đầu, không thể vào thêm." };
    if (room.players.size >= LIMITS.PLAYERS_PER_ROOM_MAX) return { ok: false, error: "Phòng đã đầy." };
    return { ok: true };
  }

  /** Danh sách người chơi gửi ra ngoài, sắp theo điểm giảm dần. */
  publicPlayers(room: Room) {
    return Array.from(room.players.values())
      .map((p) => ({
        id: p.socketId,
        name: p.name,
        score: p.score,
        connected: p.connected,
        userId: p.userId,
      }))
      .sort((a, b) => b.score - a.score);
  }

  currentQuestion(room: Room): RoomQuestion | undefined {
    return room.questions[room.currentIndex];
  }

  /** Mọi người đã trả lời → chốt sớm, không cần chờ hết giờ. */
  everyoneAnswered(room: Room): boolean {
    return room.players.size > 0 && room.currentAnswers.size >= room.players.size;
  }

  size(): number {
    return this.rooms.size;
  }
}

export const roomManager = new RoomManager();
