"use client";
import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const BG_CLASS = { default:"bg-[var(--bg-surface)] text-[var(--text-primary)]", accent:"bg-[var(--accent)] text-white", sunset:"bg-gradient-to-br from-orange-500 to-pink-500 text-white", ocean:"bg-gradient-to-br from-sky-600 to-teal-500 text-white", forest:"bg-gradient-to-br from-emerald-700 to-lime-600 text-white", midnight:"bg-gradient-to-br from-slate-800 to-zinc-900 text-white" };

export function StatusViewer({ open, statuses, initialIndex=0, currentUserId, onClose, onDelete, onViewed }) {
  const [idx,setIdx]=useState(initialIndex);
  useEffect(()=>{setIdx(initialIndex)},[initialIndex, open]);
  const cur = statuses?.[idx];
  useEffect(()=>{
    if(!open||!cur) return;
    onViewed?.(cur.id||cur._id);
    if(statuses.length<=1) return;
    const t=setTimeout(()=>{ if(idx < statuses.length-1) setIdx(i=>i+1); else onClose?.(); }, 3000);
    return ()=>clearTimeout(t);
  },[open, cur, idx, statuses.length]);
  if(!open||!cur) return null;
  const isMine = String(cur.userId||cur.user?._id)===String(currentUserId);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-1 gap-1">
          {statuses.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<=idx?"bg-white":"bg-white/30"}`} />)}
        </div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-4 w-4"/></button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className={`flex w-full max-w-[360px] min-h-[420px] items-center justify-center rounded-2xl p-8 text-center text-[22px] font-semibold leading-tight shadow-xl ${BG_CLASS[cur.background]||BG_CLASS.default}`}>
          {cur.text}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-white">
        <span className="text-[12px] opacity-80">{cur.createdAt?formatDistanceToNow(new Date(cur.createdAt),{addSuffix:true}):""} {isMine?`• ${cur.viewers?.length||0} views`:""}</span>
        {isMine ? <button onClick={()=>onDelete?.(cur.id||cur._id)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] hover:bg-white/20 flex items-center gap-1"><Trash2 className="h-3.5 w-3.5"/>Delete</button> : <span className="text-[11px] opacity-60">Visible to friends 24h</span>}
      </div>
    </div>
  );
}
