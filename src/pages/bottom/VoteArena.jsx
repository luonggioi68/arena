import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
    Flame, Zap, Trophy, MessageSquare, Clock, 
    Play, Square, Lock, Settings, Users, RotateCcw, 
    Home, Plus, Trash2, Calendar, CheckCircle, Edit, Medal, Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { onAuthStateChanged } from 'firebase/auth'; 
import { firestore, auth } from '@/lib/firebase'; 
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';

export default function VoteArena() {
  const router = useRouter();

  // --- 1. PHÂN QUYỀN ---
  const [isTeacher, setIsTeacher] = useState(false); 
  const [loading, setLoading] = useState(true);
  const VOTE_DOC_ID = 'arena_vote_session'; 

  // --- 2. DATA REALTIME ---
  const [topic, setTopic] = useState("ĐANG TẢI...");
  const [status, setStatus] = useState('SETUP'); 
  const [options, setOptions] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allowComment, setAllowComment] = useState(true);

  // --- 3. STATE LOCAL ---
  const [selectedId, setSelectedId] = useState(null);
  const [comment, setComment] = useState("");
  const [hasVoted, setHasVoted] = useState(false);
  const [timerText, setTimerText] = useState(""); 
  
  const timerRef = useRef(null);

  // --- AUTH ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsTeacher(!!user);
        setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- SYNC FIREBASE ---
  useEffect(() => {
    const docRef = doc(firestore, "system_vote", VOTE_DOC_ID);
    const unsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setTopic(data.topic || "CHỦ ĐỀ BÌNH CHỌN");
            setStatus(data.status || 'SETUP');
            setOptions(data.options || []);
            setStartTime(data.startTime || "");
            setEndTime(data.endTime || "");
            setAllowComment(data.allowComment ?? true);
        } else if (isTeacher) {
            // Tạo data mẫu nếu chưa có
            setDoc(docRef, {
                topic: "BÌNH CHỌN MỚI",
                status: 'SETUP',
                options: [
                    { id: 1, label: "Phương án A", type: 'avatar', val: 'Felix', votes: 0, percent: 0 },
                    { id: 2, label: "Phương án B", type: 'avatar', val: 'Aneka', votes: 0, percent: 0 }
                ],
                startTime: "", endTime: ""
            });
        }
    });
    return () => unsub();
  }, [isTeacher]);

  // --- TIMER LOGIC (ĐÃ SỬA: TỰ ĐỘNG KẾT THÚC) ---
  useEffect(() => {
    const handleTimeCheck = () => {
        // Nếu không có mốc thời gian -> Bỏ qua
        if (!startTime && !endTime) {
            setTimerText(null);
            return;
        }

        const now = new Date().getTime();
        const start = startTime ? new Date(startTime).getTime() : 0;
        const end = endTime ? new Date(endTime).getTime() : 0;

        // Chỉ xử lý hiển thị và auto-end khi đang ACTIVE
        if (status === 'ACTIVE') {
            // Nếu có đặt giờ Kết thúc
            if (endTime) {
                if (now >= end) {
                    setTimerText("ĐÃ KẾT THÚC");
                    
                    // [QUAN TRỌNG] Nếu là GV -> Gọi lệnh kết thúc lên Firebase
                    if (isTeacher) {
                        updateFirebase({ status: 'ENDED' });
                        triggerGrandConfetti();
                    }
                } else {
                    // Tính đếm ngược
                    const diff = end - now;
                    const h = Math.floor(diff / (1000 * 60 * 60));
                    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const s = Math.floor((diff % (1000 * 60)) / 1000);
                    setTimerText(`CÒN: ${h}h ${m}m ${s}s`);
                }
            } else {
                setTimerText("ĐANG DIỄN RA"); // Không đặt giờ kết thúc
            }
        } 
        else if (status === 'ENDED') {
            setTimerText("ĐÃ KẾT THÚC");
        }
        else if (status === 'SETUP' || status === 'PENDING') {
             if(startTime) setTimerText(`MỞ LÚC: ${new Date(startTime).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`);
        }
    };

    handleTimeCheck();
    timerRef.current = setInterval(handleTimeCheck, 1000);
    return () => clearInterval(timerRef.current);
  }, [startTime, endTime, status, isTeacher]); // Thêm isTeacher vào dependency

  // --- UPDATE FIREBASE ---
  const updateFirebase = async (data) => {
      try { await updateDoc(doc(firestore, "system_vote", VOTE_DOC_ID), data); } 
      catch (e) { console.error(e); }
  };

  // --- GV ACTIONS ---
  const handleManualStart = () => {
      if (!topic.trim()) return alert("Nhập chủ đề trước!");
      const resetOptions = options.map(o => ({...o, votes: 0, percent: 0}));
      // Lưu ý: startTime và endTime vẫn giữ nguyên giá trị từ input để logic đếm ngược hoạt động
      updateFirebase({ status: 'ACTIVE', options: resetOptions, startTime, endTime });
  };

  const handleManualEnd = () => {
      updateFirebase({ status: 'ENDED' });
      triggerGrandConfetti();
  };

  const handleReset = () => {
      updateFirebase({ status: 'SETUP' });
      setHasVoted(false);
      setSelectedId(null);
  };

  const syncOptions = (newOptions) => updateFirebase({ options: newOptions });
  const addOption = () => {
      const newId = Date.now();
      syncOptions([...options, { id: newId, label: "", type: 'letter', val: String.fromCharCode(65 + options.length), votes: 0, percent: 0 }]);
  };
  const removeOption = (id) => syncOptions(options.filter(o => o.id !== id));
  const updateOptionLabel = (id, text) => syncOptions(options.map(o => o.id === id ? { ...o, label: text } : o));
  const cycleIconType = (id) => {
      syncOptions(options.map(o => {
          if (o.id !== id) return o;
          if (o.type === 'avatar') return { ...o, type: 'letter', val: String.fromCharCode(65 + options.indexOf(o)) };
          if (o.type === 'letter') return { ...o, type: 'number', val: options.indexOf(o) + 1 };
          return { ...o, type: 'avatar', val: Math.random().toString(36).substring(7) };
      }));
  };

  // --- HS ACTIONS ---
  const handleSelect = (id) => {
      if (isTeacher) return; 
      if (status !== 'ACTIVE' || hasVoted) return; 
      setSelectedId(id);
  };

  const handleSubmitVote = async () => {
    if (!selectedId) return;
    if (status !== 'ACTIVE') {
        alert("Bình chọn đã kết thúc!");
        return;
    }

    setHasVoted(true); 
    const docRef = doc(firestore, "system_vote", VOTE_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
        const currentData = snap.data();
        if (currentData.status !== 'ACTIVE') return;

        const currentOptions = currentData.options;
        const newOpts = currentOptions.map(opt => opt.id === selectedId ? { ...opt, votes: opt.votes + 1 } : opt);
        const total = newOpts.reduce((acc, cur) => acc + cur.votes, 0);
        const finalOptions = newOpts.map(opt => ({
            ...opt,
            percent: total === 0 ? 0 : Math.round((opt.votes / total) * 100)
        }));
        await updateDoc(docRef, { options: finalOptions });
    }
  };

  // --- EFFECTS ---
  const triggerGrandConfetti = () => {
    const end = Date.now() + 3000;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#ff0000', '#ffa500'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#ff0000', '#ffa500'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const renderIcon = (opt) => {
      if (opt.type === 'avatar') return <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${opt.val}`} className="w-full h-full object-cover" />;
      if (opt.type === 'letter') return <span className="text-xl md:text-2xl font-black text-white">{opt.val}</span>;
      if (opt.type === 'number') return <span className="text-xl md:text-2xl font-black text-white">{opt.val}</span>;
  };

  // --- SORTING & RANKING (Xử lý hiển thị) ---
  // Nếu đã kết thúc: Sắp xếp theo phiếu giảm dần
  const displayOptions = status === 'ENDED' 
      ? [...options].sort((a, b) => b.votes - a.votes) 
      : options;

  if (loading) return <div className="h-screen bg-black flex items-center justify-center text-white">Đang tải dữ liệu...</div>;

  return (
    <div className="h-screen bg-[#050505] text-white font-sans flex flex-col relative overflow-hidden selection:bg-orange-500 selection:text-white">
      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#050505] to-black z-0 pointer-events-none"></div>

      {/* --- HEADER --- */}
      <header className="relative z-10 pt-4 pb-2 shrink-0 flex items-center justify-between px-4">
        <button onClick={() => router.push('/')} className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-xl border border-slate-700 transition group" title="Về trang chủ">
            <Home size={20} className="text-slate-400 group-hover:text-white"/>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center top-6 w-full pointer-events-none">
            <h3 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter fire-text drop-shadow-2xl animate-fire-breathe select-none text-center leading-none">
            VOTE
            </h3>
            {timerText && status === 'ACTIVE' && (
                <div className="bg-orange-950/90 border border-orange-500/50 px-4 py-1 rounded-full text-xs md:text-sm font-mono text-orange-400 animate-pulse mt-2 shadow-lg z-20">
                    {timerText}
                </div>
            )}
        </div>

        {isTeacher ? (
            <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center font-bold text-xs border-2 border-white shadow-lg z-20" title="Giáo viên">GV</div>
        ) : (
            <div className="w-10 h-10 z-20"></div> 
        )}
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 px-4 pt-28 md:pt-36 z-10 flex flex-col max-w-lg mx-auto w-full overflow-hidden pb-4">
        
        {/* TOPIC */}
        <div className="text-center shrink-0 mb-4">
            {isTeacher && status === 'SETUP' ? (
                <div className="space-y-4 animate-in slide-in-from-top-5">
                    <input 
                        value={topic} 
                        onChange={(e) => { setTopic(e.target.value); updateFirebase({ topic: e.target.value }); }}
                        className="w-full bg-transparent text-center text-xl font-bold text-white uppercase border-b border-slate-600 focus:border-orange-500 outline-none pb-2 placeholder:text-slate-600 transition-colors"
                        placeholder="NHẬP CHỦ ĐỀ..."
                    />
                    <div className="grid grid-cols-2 gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-700 shadow-lg">
                        <div className="flex flex-col">
                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Calendar size={10}/> Bắt đầu (Tùy chọn)</label>
                            <input type="datetime-local" value={startTime} onChange={(e) => { setStartTime(e.target.value); updateFirebase({ startTime: e.target.value }); }}
                                className="bg-black text-xs text-white p-2 rounded border border-slate-600 focus:border-orange-500 outline-none w-full font-mono cursor-pointer hover:border-slate-500 transition"/>
                        </div>
                        <div className="flex flex-col">
                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 flex items-center gap-1"><Lock size={10}/> Kết thúc (Tùy chọn)</label>
                            <input type="datetime-local" value={endTime} onChange={(e) => { setEndTime(e.target.value); updateFirebase({ endTime: e.target.value }); }}
                                className="bg-black text-xs text-white p-2 rounded border border-slate-600 focus:border-orange-500 outline-none w-full font-mono cursor-pointer hover:border-slate-500 transition"/>
                        </div>
                    </div>
                </div>
            ) : (
                <h2 className="text-xl md:text-2xl font-black text-white uppercase leading-tight drop-shadow-md pb-2 border-b-2 border-orange-500/30 inline-block px-6">
                    {topic}
                </h2>
            )}
        </div>

        {/* LIST OPTIONS */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
          {!isTeacher && status === 'SETUP' ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center animate-pulse border border-slate-700">
                      <Settings size={32} className="animate-spin-slow"/>
                  </div>
                  <p className="text-sm font-bold uppercase tracking-widest">Giáo viên đang chuẩn bị...</p>
              </div>
          ) : (
              <div className="space-y-3">
                {displayOptions.map((opt, index) => {
                    const isSelected = selectedId === opt.id;
                    // Logic hiện kết quả: Khi ENDED hoặc GV (khi Active)
                    const showResult = status === 'ENDED' || (isTeacher && status !== 'SETUP');
                    
                    // Logic Vinh Danh (Chỉ khi ENDED và có phiếu)
                    const maxVotes = Math.max(...options.map(o => o.votes));
                    const isWinner = status === 'ENDED' && opt.votes === maxVotes && opt.votes > 0;
                    const rank = status === 'ENDED' ? index + 1 : 0; // Rank theo thứ tự sort

                    return (
                    <div 
                        key={opt.id}
                        onClick={() => handleSelect(opt.id)}
                        className={`
                        relative group overflow-hidden rounded-xl border-2 transition-all duration-500 shrink-0 select-none
                        ${/* Cursor */ !isTeacher && status === 'ACTIVE' && !hasVoted ? 'cursor-pointer hover:border-slate-500 hover:bg-slate-900' : 'cursor-default'}
                        ${/* Select */ isSelected && status === 'ACTIVE' ? 'border-orange-500 bg-orange-900/30 scale-[1.01] shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'border-slate-800 bg-slate-900/60'}
                        ${/* Winner */ isWinner ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.6)] bg-gradient-to-r from-yellow-900/40 to-black z-10 scale-[1.02]' : ''}
                        `}
                    >
                        {/* Background Progress */}
                        {showResult && (
                            <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out opacity-30 ${isWinner ? 'bg-yellow-500' : 'bg-slate-500'}`} style={{ width: `${opt.percent}%` }}></div>
                        )}

                        <div className="relative p-3 flex items-center gap-3 z-10">
                            {/* RANKING BADGE (Khi ENDED) */}
                            {status === 'ENDED' && (
                                <div className={`absolute top-0 left-0 w-8 h-8 flex items-center justify-center font-black text-xs z-20 rounded-br-xl shadow-lg
                                    ${rank === 1 ? 'bg-yellow-500 text-black' : rank === 2 ? 'bg-slate-300 text-black' : rank === 3 ? 'bg-orange-700 text-white' : 'bg-slate-800 text-slate-500'}
                                `}>
                                    {rank === 1 ? <Crown size={14} fill="currentColor"/> : `#${rank}`}
                                </div>
                            )}

                            {/* Icon */}
                            <div 
                                onClick={(e) => { e.stopPropagation(); if(isTeacher && status==='SETUP') cycleIconType(opt.id); }}
                                className={`w-12 h-12 rounded-lg shrink-0 border flex items-center justify-center overflow-hidden relative transition-colors
                                    ${isTeacher && status === 'SETUP' ? 'cursor-pointer hover:border-orange-500' : ''}
                                    ${isWinner ? 'border-yellow-400 bg-yellow-500/20' : 'border-slate-600 bg-slate-800'}
                                    ${status === 'ENDED' ? 'ml-4' : ''} 
                                `}
                            >
                                {renderIcon(opt)}
                                {isTeacher && status === 'SETUP' && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold text-[10px]"><Edit size={14}/></div>}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                {isTeacher && status === 'SETUP' ? (
                                    <input 
                                        value={opt.label} onChange={(e) => updateOptionLabel(opt.id, e.target.value)}
                                        className="w-full bg-transparent font-bold uppercase text-white outline-none placeholder:text-slate-600 text-sm border-b border-transparent focus:border-slate-500"
                                        placeholder={`Lựa chọn ${index + 1}`}
                                    />
                                ) : (
                                    <div className="flex flex-col">
                                        <h3 className={`font-bold uppercase truncate text-sm ${isSelected ? 'text-orange-400' : isWinner ? 'text-yellow-400' : 'text-slate-200'}`}>
                                            {opt.label}
                                        </h3>
                                        {/* Result Bar */}
                                        {showResult && (
                                            <div className="flex items-center gap-2 mt-1 animate-in fade-in">
                                                <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                                    <div className={`h-full ${isWinner ? 'bg-yellow-400' : 'bg-orange-600'}`} style={{width: `${opt.percent}%`}}></div>
                                                </div>
                                                <span className={`text-[10px] font-mono ${isWinner ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}>{opt.votes} ({opt.percent}%)</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Actions Right */}
                            <div className="text-right shrink-0 flex items-center gap-2">
                                {isTeacher && status === 'SETUP' ? (
                                    <button onClick={(e) => { e.stopPropagation(); removeOption(opt.id); }} className="text-slate-600 hover:text-red-500 p-2"><Trash2 size={18}/></button>
                                ) : (
                                    status === 'ACTIVE' && !isTeacher && (
                                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-slate-600'}`}>
                                            {isSelected && <CheckCircle size={14} className="text-white" fill="currentColor"/>}
                                        </div>
                                    )
                                )}
                                
                                {status === 'ENDED' && isWinner && (
                                    <Trophy size={24} className="text-yellow-400 animate-bounce drop-shadow-[0_0_10px_gold]" fill="currentColor"/>
                                )}
                            </div>
                        </div>
                    </div>
                    );
                })}

                {isTeacher && status === 'SETUP' && (
                    <button onClick={addOption} className="w-full py-3 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-orange-500 hover:border-orange-500/50 flex items-center justify-center gap-2 text-xs font-bold uppercase transition hover:bg-slate-900/50">
                        <Plus size={16}/> Thêm lựa chọn
                    </button>
                )}
              </div>
          )}

          {/* INPUT Ý KIẾN */}
          {!isTeacher && status === 'ACTIVE' && !hasVoted && allowComment && (
            <div className="mt-4 animate-in slide-in-from-bottom-2">
                <label className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <MessageSquare size={12}/> Ý kiến khác
                </label>
                <textarea 
                    value={comment} onChange={(e) => setComment(e.target.value)}
                    placeholder="Nhập ý kiến..." rows="2"
                    className="w-full bg-slate-900/50 border-2 border-slate-700 rounded-xl p-3 text-sm text-white focus:border-orange-500 outline-none resize-none placeholder:text-slate-600"
                />
            </div>
          )}
          
          {isTeacher && status === 'SETUP' && (
              <div className="mt-4 flex items-center gap-2 justify-center pb-4">
                  <div onClick={() => { setAllowComment(!allowComment); updateFirebase({allowComment: !allowComment}); }} className={`w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors ${allowComment ? 'bg-green-600' : 'bg-slate-700'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${allowComment ? 'translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Cho phép nhập ý kiến</span>
              </div>
          )}
        </div>
      </main>

      {/* --- FOOTER --- */}
      <div className="shrink-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent z-20">
        {isTeacher && (
            <div className="flex gap-2">
                {status === 'SETUP' && (
                    <button onClick={handleManualStart} className="flex-1 py-3 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition text-white text-sm flex items-center justify-center gap-2">
                        <Play size={18} fill="currentColor"/> BẮT ĐẦU NGAY
                    </button>
                )}
                {(status === 'ACTIVE' || status === 'PENDING') && (
                    <button onClick={handleManualEnd} className="flex-1 py-3 bg-slate-800 hover:bg-red-600 border border-slate-600 hover:border-red-500 rounded-xl font-black uppercase tracking-widest transition text-white text-sm flex items-center justify-center gap-2">
                        <Square size={16} fill="currentColor"/> KẾT THÚC
                    </button>
                )}
                {status === 'ENDED' && (
                    <button onClick={handleReset} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-bold uppercase text-slate-300 text-sm flex items-center justify-center gap-2">
                        <RotateCcw size={16}/> SETUP LẠI
                    </button>
                )}
            </div>
        )}

        {!isTeacher && status === 'ACTIVE' && (
            !hasVoted ? (
                <button 
                    onClick={handleSubmitVote} disabled={!selectedId}
                    className={`w-full py-3 rounded-xl font-black text-sm uppercase italic tracking-widest shadow-lg transition-all flex items-center justify-center gap-2
                    ${!selectedId ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-gradient-to-r from-orange-600 to-red-600 text-white hover:scale-[1.02] active:scale-95 border border-orange-400 shadow-orange-500/40 animate-pulse'}`}
                >
                    GỬI BÌNH CHỌN <Zap size={18} fill="currentColor" />
                </button>
            ) : (
                <div className="w-full py-3 bg-green-900/30 border border-green-500/30 rounded-xl flex items-center justify-center gap-2 text-green-400 font-bold uppercase text-sm animate-in zoom-in">
                    <Users size={16}/> Đã gửi phiếu
                </div>
            )
        )}
        
        {!isTeacher && status === 'PENDING' && (
            <div className="w-full py-3 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center gap-2 text-slate-400 font-bold uppercase text-sm">
                <Clock size={16}/> Chờ bắt đầu...
            </div>
        )}

        {/* THÔNG BÁO CHO HỌC SINH KHI KẾT THÚC */}
        {!isTeacher && status === 'ENDED' && (
            <div className="w-full py-3 bg-slate-900 border border-yellow-500/30 rounded-xl flex items-center justify-center gap-2 text-yellow-500 font-bold uppercase text-sm shadow-[0_0_15px_rgba(234,179,8,0.2)] animate-in slide-in-from-bottom-2">
                <Trophy size={16} /> Kết quả bình chọn
            </div>
        )}
      </div>

      <style jsx global>{`
        .fire-text {
            background: linear-gradient(0deg, #ff9a00 0%, #ff5200 50%, #ff0000 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 10px rgba(255, 69, 0, 0.8));
            animation: burn 0.5s infinite alternate;
        }
        @keyframes burn {
            from { filter: drop-shadow(0 0 5px rgba(255, 0, 0, 0.6)) drop-shadow(0 0 10px #ff9a00); }
            to { filter: drop-shadow(0 0 15px rgba(255, 0, 0, 0.8)) drop-shadow(0 0 20px #ff5200); }
        }
        @keyframes breathe {
            0%, 100% { transform: scale(1) translateX(-50%); }
            50% { transform: scale(1.02) translateX(-50%); }
        }
        .animate-fire-breathe {
            animation: breathe 3s ease-in-out infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        
        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
            cursor: pointer;
        }
      `}</style>
    </div>
  );
}