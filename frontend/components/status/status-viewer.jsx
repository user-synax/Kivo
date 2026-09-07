"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, useReducedMotion } from "motion/react";

const BG_CLASS = { default:"bg-[var(--bg-surface)] text-[var(--text-primary)]", accent:"bg-[var(--accent)] text-white", sunset:"bg-gradient-to-br from-orange-500 to-pink-500 text-white", ocean:"bg-gradient-to-br from-sky-600 to-teal-500 text-white", forest:"bg-gradient-to-br from-emerald-700 to-lime-600 text-white", midnight:"bg-gradient-to-br from-slate-800 to-zinc-900 text-white" };

export function StatusViewer({ open, statuses, initialIndex=0, currentUserId, onClose, onDelete, onViewed }) {
  const [idx,setIdx]=useState(initialIndex);
  const reduce = useReducedMotion();
  useEffect(()=>{setIdx(initialIndex)},[initialIndex, open]);
  const cur = statuses?.[idx];
  const hasMedia = !!cur?.media?.url;
  const durationSec = hasMedia ? 5 : 4;

  const goPrev = ()=>{
    if(idx>0) setIdx(i=>i-1);
  };
  const goNext = ()=>{
    if(idx < statuses.length-1) setIdx(i=>i+1); else onClose?.();
  };

  useEffect(()=>{
    if(!open) return;
    const onKey = (e)=>{
      if(e.key==="ArrowLeft") { e.preventDefault(); goPrev(); }
      if(e.key==="ArrowRight") { e.preventDefault(); goNext(); }
      if(e.key==="Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return ()=> window.removeEventListener("keydown", onKey);
  },[open, idx, statuses.length]);

  useEffect(()=>{
    if(!open||!cur) return;
    onViewed?.(cur.id||cur._id);
    if(statuses.length===1 && durationSec===0) return;
    const t=setTimeout(()=>{ goNext(); }, durationSec*1000);
    return ()=>clearTimeout(t);
  },[open, cur, idx, statuses.length, hasMedia, durationSec]);

  if(!open||!cur) return null;
  const isMine = String(cur.userId||cur.user?._id)===String(currentUserId);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2 safe-top">
        <div className="flex flex-1 gap-1">
          {statuses.map((_,i)=>{
            const isCompleted = i < idx;
            const isActive = i === idx;
            return (
              <div key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/30">
                {isCompleted ? (
                  <div className="h-full w-full bg-white" />
                ) : isActive ? (
                    <motion.div
                      key={`p-${idx}`}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: reduce ? 0 : durationSec, ease: "linear" }}
                      className="h-full bg-white"
                    />
                ) : null}
              </div>
            );
          })}
        </div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-4 w-4"/></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-4">
        {/* Left / Right invisible tap zones + visible arrow buttons (desktop) */}
        <button type="button" aria-label="Previous" onClick={goPrev} className="absolute left-0 top-0 z-10 h-full w-[30%] cursor-pointer bg-transparent md:w-[20%]" />
        <button type="button" aria-label="Next" onClick={goNext} className="absolute right-0 top-0 z-10 h-full w-[30%] cursor-pointer bg-transparent md:w-[20%]" />
        <button type="button" aria-label="Previous status" onClick={goPrev} disabled={idx===0} className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25 disabled:opacity-20 md:flex">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Next status" onClick={goNext} className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25 md:flex">
          <ChevronRight className="h-5 w-5" />
        </button>

        {hasMedia ? (
          <div className="relative flex w-full max-w-[360px] max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl bg-black shadow-xl">
              <img src={cur.media.url} alt={cur.text || "status"} className="max-h-[70vh] w-full object-contain" draggable={false} />
            {cur.text ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                <p className="text-center text-[16px] font-medium leading-tight text-white drop-shadow">{cur.text}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`flex w-full max-w-[360px] min-h-[420px] items-center justify-center rounded-2xl p-8 text-center text-[22px] font-semibold leading-tight shadow-xl ${BG_CLASS[cur.background]||BG_CLASS.default}`}>
            {cur.text}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-white">
        <span className="text-[12px] opacity-80">{cur.createdAt?formatDistanceToNow(new Date(cur.createdAt),{addSuffix:true}):""} {isMine?`• ${cur.viewers?.length||0} views`:""} {hasMedia ? "• Photo" : ""}</span>
        {isMine ? <button onClick={()=>onDelete?.(cur.id||cur._id)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] hover:bg-white/20 flex items-center gap-1"><Trash2 className="h-3.5 w-3.5"/>Delete</button> : <span className="text-[11px] opacity-60">Visible to friends 24h</span>}
      </div>
    </div>
  );
}
