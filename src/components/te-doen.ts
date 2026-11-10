import { CheckCircle2, ClipboardCheck, ClipboardList, Gift, GraduationCap, MessageSquareHeart, Repeat, UserCheck } from "lucide-react";
import type { TeDoe } from "@/lib/data";

export const TE_DOEN_ICOON: Record<TeDoe["soort"], typeof CheckCircle2> = {
  bericht: CheckCircle2, leren: GraduationCap, beoordelen: ClipboardCheck, ruil: Repeat, zelfbeoordeling: UserCheck,
  enquete: MessageSquareHeart, actiepunt: ClipboardList, beloning: Gift,
};
