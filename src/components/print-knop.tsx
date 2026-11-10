"use client";

import { Printer } from "lucide-react";

export function PrintKnop() {
  return <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-navy-700 px-3.5 py-2 text-sm font-semibold text-white print:hidden"><Printer size={15} /> Afdrukken / PDF</button>;
}
