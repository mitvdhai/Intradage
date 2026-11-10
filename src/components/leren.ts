import { BookOpen, Camera, HelpCircle, PlayCircle } from "lucide-react";
import type { LeerType } from "@/lib/types";

export const TYPE_ICOON: Record<LeerType, typeof PlayCircle> = { video: PlayCircle, quiz: HelpCircle, module: BookOpen, challenge: Camera };
export const TYPE_LABEL: Record<LeerType, string> = { video: "Video", quiz: "Quiz", module: "Module", challenge: "Challenge" };
