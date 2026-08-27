import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudio } from "@/providers/audio-provider";

export function SoundToggle() {
  const { enabled, toggle } = useAudio();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Tắt âm thanh" : "Bật âm thanh"}
      title={enabled ? "Tắt âm thanh" : "Bật âm thanh"}
    >
      {enabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
    </Button>
  );
}
