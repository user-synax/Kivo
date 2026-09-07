"use client";
import { useState } from "react";
import { X } from "lucide-react";

const BACKGROUNDS = [
  { id:"default", label:"Default", class:"bg-[var(--bg-surface)] text-[var(--text-primary)]" },
  { id:"accent", label:"Accent", class:"bg-[var(--accent)] text-white" },
  { id:"sunset", label:"Sunset", class:"bg-gradient-to-br from-orange-500 to-pink-500 text-white" },
  { id:"ocean", label:"Ocean", class:"bg-gradient-to-br from-sky-600 to-teal-500 text-white" },
  { id:"forest", label:"Forest", class:"bg-gradient-to-br from-emerald-700 to-lime-600 text-white" },
  { id:"midnight", label:"Midnight", class:"bg-gradient-to-br from-slate-800 to-zinc-900 text-white" },
];

export function StatusCreateModal({ open, onClose, onSubmit }) {
  const [text,setText]=useState("");
  const [bg,setBg]=useState("default");
  if(!open) return null;
  const cur = BACKGROUNDS.find(b=>b.id===bg)||BACKGROUNDS[0];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">New status</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-[var(--hover)]"><X className="h-4 w-4"/></button>
        </div>
        <div className={`mx-4 rounded-xl p-6 text-center text-[18px] font-medium leading-tight ${cur.class}`} style={{minHeight:160, display:"flex", alignItems:"center", justifyContent:"center"}}>
          {text.trim() || "Preview"}
        </div>
        <div className="px-4 pt-3">
          <textarea value={text} onChange={e=>setText(e.target.value.slice(0,280))} placeholder="What's on your mind?" maxLength={280} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[var(--text-muted)]">{text.length}/280</span>
            <span className="text-[11px] text-[var(--text-muted)]">Visible to friends for 24h</span>
          </div>
          <div className="flex gap-1.5 pt-3 flex-wrap">
            {BACKGROUNDS.map(b=>(
              <button key={b.id} type="button" onClick={()=>setBg(b.id)} className={`h-8 flex-1 rounded-full border text-[11px] font-medium ${bg===b.id?"border-[var(--accent)] ring-2 ring-[var(--accent)]/30":"border-[var(--border)]"} ${b.class}`}>{b.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-[13px] font-medium">Cancel</button>
          <button disabled={!text.trim()} onClick={()=>{onSubmit?.({text:text.trim(), background:bg}); setText(""); setBg("default");}} className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-[13px] font-semibold text-[var(--on-accent)] disabled:opacity-40">Share</button>
        </div>
      </div>
    </div>
  );
}
