"use client";
import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, X } from "lucide-react";

const BACKGROUNDS = [
  { id:"default", label:"Default", class:"bg-[var(--bg-surface)] text-[var(--text-primary)]" },
  { id:"accent", label:"Accent", class:"bg-[var(--accent)] text-white" },
  { id:"sunset", label:"Sunset", class:"bg-gradient-to-br from-orange-500 to-pink-500 text-white" },
  { id:"ocean", label:"Ocean", class:"bg-gradient-to-br from-sky-600 to-teal-500 text-white" },
  { id:"forest", label:"Forest", class:"bg-gradient-to-br from-emerald-700 to-lime-600 text-white" },
  { id:"midnight", label:"Midnight", class:"bg-gradient-to-br from-slate-800 to-zinc-900 text-white" },
];

export function StatusCreateModal({ open, onClose, onSubmit, uploading=false }) {
  const [text,setText]=useState("");
  const [bg,setBg]=useState("default");
  const [file,setFile]=useState(null);
  const [preview,setPreview]=useState(null);
  const fileInputRef = useRef(null);

  useEffect(()=>{
    if(!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return ()=> URL.revokeObjectURL(url);
  },[file]);

  // Reset internal state when the modal closes externally (upload success)
  useEffect(()=>{
    if(!open) {
      setText("");
      setBg("default");
      setFile(null);
      setPreview(null);
      if(fileInputRef.current) fileInputRef.current.value="";
    }
  },[open]);

  const reset = ()=>{
    setText("");
    setBg("default");
    setFile(null);
    setPreview(null);
    if(fileInputRef.current) fileInputRef.current.value="";
  };

  const handleClose = ()=>{
    if(uploading) return;
    reset();
    onClose?.();
  };

  const handleFileChange = (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;
    if(f.size > 30*1024*1024) { window.alert("File exceeds 30MB limit"); return; }
    const ok = ["image/jpeg","image/png","image/webp","image/gif"].includes(f.type);
    if(!ok) { window.alert(`Unsupported type ${f.type}`); return; }
    setFile(f);
  };

  const canSubmit = text.trim().length>0 || !!file;
  const cur = BACKGROUNDS.find(b=>b.id===bg)||BACKGROUNDS[0];
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={uploading ? undefined : handleClose}>
      <div onClick={e=>e.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">New status</h3>
          <div className="flex items-center gap-2">
            {uploading && <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</span>}
            <button onClick={handleClose} disabled={uploading} className="rounded-full p-1 hover:bg-[var(--hover)] disabled:opacity-40"><X className="h-4 w-4"/></button>
          </div>
        </div>

        <div className="mx-4 overflow-hidden rounded-xl border border-[var(--border)] bg-black" style={{minHeight:200}}>
          {file && preview ? (
            <div className="relative flex min-h-[200px] max-h-[320px] items-center justify-center bg-black">
              <img src={preview} alt="preview" className="max-h-[320px] w-full object-contain" />
              <button type="button" onClick={()=>{setFile(null); setPreview(null); if(fileInputRef.current) fileInputRef.current.value="";}} className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"><X className="h-4 w-4"/></button>
              {text.trim() && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-center text-[15px] font-medium leading-tight text-white drop-shadow">{text.trim()}</p>
                </div>
              )}
            </div>
          ) : (
            <div className={`flex min-h-[200px] items-center justify-center p-6 text-center text-[18px] font-medium leading-tight ${cur.class}`}>
              {text.trim() || "Preview"}
            </div>
          )}
        </div>

        <div className="px-4 pt-3">
          <textarea value={text} onChange={e=>setText(e.target.value.slice(0,280))} placeholder={file ? "Add a caption..." : "What's on your mind?"} maxLength={280} rows={file?2:3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[var(--text-muted)]">{text.length}/280</span>
            <span className="text-[11px] text-[var(--text-muted)]">Visible to friends for 24h</span>
          </div>
          {!file && (
            <div className="flex gap-1.5 pt-3 flex-wrap">
              {BACKGROUNDS.map(b=>(
                <button key={b.id} type="button" onClick={()=>setBg(b.id)} className={`h-8 flex-1 rounded-full border text-[11px] font-medium ${bg===b.id?"border-[var(--accent)] ring-2 ring-[var(--accent)]/30":"border-[var(--border)]"} ${b.class}`}>{b.label}</button>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-3">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} className="hidden" />
            <button type="button" onClick={()=>fileInputRef.current?.click()} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2 text-[12px] font-medium text-[var(--text-primary)] hover:bg-[var(--hover)]">
              <ImageIcon className="h-4 w-4" /> Photo
            </button>
            {file && <span className="flex items-center text-[11px] text-[var(--text-muted)] truncate max-w-[80px]">{file.name}</span>}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-4">
          <button onClick={handleClose} disabled={uploading} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-[13px] font-medium disabled:opacity-40">Cancel</button>
          <button disabled={!canSubmit || uploading} onClick={()=>{onSubmit?.({text:text.trim(), background:file? "default": bg, file}); if(!file) reset();}} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-2.5 text-[13px] font-semibold text-[var(--on-accent)] disabled:opacity-40">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Uploading…" : "Share"}
          </button>
        </div>
        {uploading && file && (
          <div className="px-4 pb-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div className="h-full w-full animate-pulse bg-[var(--accent)]" />
            </div>
            <p className="pt-1.5 text-center text-[11px] text-[var(--text-muted)]">Uploading {file.name} — { (file.size/1024/1024).toFixed(1)} MB — please keep this open</p>
          </div>
        )}
      </div>
    </div>
  );
}
