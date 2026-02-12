import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { 
    Flame, Zap, Trophy, MessageSquare, Clock, 
    Play, Square, Lock, Settings, Users, RotateCcw, Loader2,
    Home, Plus, Trash2, Calendar, CheckCircle2,
    Sword, Shield, Skull, Crosshair, Target, Ghost, Gem, Crown, Rocket, Star, Hash, Type
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- FIREBASE IMPORTS ---
import { firestore, auth } from '@/lib/firebase'; 
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// --- DANH SÁCH ICON GAME ---
const GAME_ICONS = [Sword, Shield, Skull, Zap, Crosshair, Target, Ghost, Gem, Crown, Rocket, Star, Flame, Trophy];

export default function VoteArena() {
  const router = useRouter();
  
  // --- 1. INIT ---
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);
  const SESSION_ID = "live"; 

  // --- 2. STATE DỮ LIỆU ---
  const [status, setStatus] = useState('SETUP'); 
  const [topic, setTopic] = useState("CHỦ ĐỀ BÌNH CHỌN");
  const [iconMode, setIconMode] = useState('ABC'); // ABC | 123 | GAME | AVATAR
  
  const [useSchedule, setUseSchedule] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);

  const [options, setOptions] = useState([
    { id: 1, label: "Lựa chọn A", seed: "A", votes: 0, percent: 0 },
    { id: 2, label: "Lựa chọn B", seed: "B", votes: 0, percent: 0 },
  ]);

  // --- 3. STATE UI ---
  const [selectedId, setSelectedId] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const timerRef = useRef(null);

  // TÍNH TỔNG SỐ PHIẾU
  const totalVotes = options.reduce((acc, curr) => acc + curr.votes, 0);

  // XỬ LÝ SẮP XẾP KHI KẾT THÚC (SORT DESCENDING)
  const displayOptions = status === 'ENDED' 
      ? [...options].sort((a, b) => b.votes - a.votes) 
      : options;

  // --- AUTH CHECK ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
        setIsTeacher(!!user); 
        setLoading(false);
    });
    return () => unsub();
  }, []);

  // --- REALTIME LISTENER ---
  useEffect(() => {
    const sessionRef = doc(firestore, "vote_sessions", SESSION_ID);
    const unsub = onSnapshot(sessionRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setStatus(data.status);
            setTopic(data.topic);
            setOptions(data.options || []);
            setIconMode(data.iconMode || 'ABC'); 
            
            if(data.endTime) setEndTime(data.endTime);
            if(data.startTime) setStartTime(data.startTime);
            
            if(data.status === 'ACTIVE' && data.endTime) {
                const now = new Date().getTime();
                const end = new Date(data.endTime).getTime();
                setTimeLeft(Math.max(0, Math.floor((end - now) / 1000)));
            } else {
               if(data.timeLeft) setTimeLeft(data.timeLeft);
            }
        } else {
            if (isTeacher) initSession();
        }
    });
    return () => unsub();
  }, [isTeacher]);

  // --- LOGIC TIME ---
  useEffect(() => {
      if(isTeacher && (startTime || endTime)) {
          const checkInterval = setInterval(() => {
              const now = new Date().getTime();
              const start = startTime ? new Date(startTime).getTime() : 0;
              const end = endTime ? new Date(endTime).getTime() : 0;
              
              if(status === 'SCHEDULED' && start > 0 && now >= start && (!end || now < end)) {
                  updateSession({ status: 'ACTIVE' });
              }
              
              if(status === 'ACTIVE' && end > 0 && now >= end) {
                  updateSession({ status: 'ENDED' });
                  clearInterval(checkInterval);
              }
          }, 1000);
          return () => clearInterval(checkInterval);
      }
  }, [isTeacher, startTime, endTime, status]);

  useEffect(() => {
    if (status === 'ACTIVE' && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => prev > 0 ? prev - 1 : 0), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [status, timeLeft]);

  useEffect(() => { if (status === 'ENDED') triggerGrandConfetti(); }, [status]);

  // --- DATABASE HELPERS ---
  const initSession = async () => {
      await setDoc(doc(firestore, "vote_sessions", SESSION_ID), {
          topic: "BÌNH CHỌN MỚI",
          status: "SETUP",
          iconMode: 'ABC',
          options: [
            { id: 1, label: "Phương án 1", seed: Math.random(), votes: 0, percent: 0 },
            { id: 2, label: "Phương án 2", seed: Math.random(), votes: 0, percent: 0 },
          ]
      });
  };

  const updateSession = async (data) => {
      await updateDoc(doc(firestore, "vote_sessions", SESSION_ID), data);
  };

  // --- ACTIONS ---
  const handleStartVote = async () => {
    if (!topic.trim()) return alert("Vui lòng nhập chủ đề!");
    const resetOptions = options.map(o => ({...o, votes: 0, percent: 0}));
    const updateData = { options: resetOptions, status: 'ACTIVE' };
    
    if(useSchedule && startTime && endTime) {
        updateData.startTime = startTime; updateData.endTime = endTime;
        updateData.status = (new Date(startTime) > new Date()) ? 'SCHEDULED' : 'ACTIVE';
    } else {
        updateData.startTime = null; updateData.endTime = null; updateData.timeLeft = 300; 
    }
    await updateSession(updateData);
  };

  const handleEndVote = async () => { await updateSession({ status: 'ENDED' }); };
  const handleReset = async () => {
    await updateSession({ status: 'SETUP', startTime: null, endTime: null, timeLeft: 0 });
    setHasVoted(false); setSelectedId(null);
  };

  const addOption = () => {
      const newOpt = { id: Date.now(), label: "", seed: Math.random(), votes: 0, percent: 0 };
      const newOpts = [...options, newOpt];
      setOptions(newOpts); updateSession({ options: newOpts });
  };

  const removeOption = (id) => {
      const newOpts = options.filter(o => o.id !== id);
      setOptions(newOpts); updateSession({ options: newOpts });
  };

  const randomizeIcon = (idx) => {
      const newOpts = [...options];
      newOpts[idx].seed = Math.random();
      setOptions(newOpts); updateSession({ options: newOpts });
  };

  const changeIconMode = (mode) => {
      setIconMode(mode);
      updateSession({ iconMode: mode });
  };

  const handleSelect = (id) => { if (status !== 'ACTIVE' || hasVoted || isTeacher) return; setSelectedId(id); };

  const handleSubmitVote = async () => {
    if (!selectedId) return;
    setHasVoted(true);
    const docRef = doc(firestore, "vote_sessions", SESSION_ID);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        const currentData = docSnap.data();
        const newOptions = currentData.options.map(opt => opt.id === selectedId ? { ...opt, votes: opt.votes + 1 } : opt);
        const total = newOptions.reduce((acc, cur) => acc + cur.votes, 0);
        const finalOptions = newOptions.map(opt => ({ ...opt, percent: total === 0 ? 0 : Math.round((opt.votes / total) * 100) }));
        await updateDoc(docRef, { options: finalOptions });
    }
  };

  // --- RENDER HELPERS ---
  const renderIcon = (index, seed) => {
      if (iconMode === 'ABC') return <span className="font-black text-2xl text-orange-500 drop-shadow-md">{String.fromCharCode(65 + index)}</span>;
      if (iconMode === '123') return <span className="font-black text-2xl text-orange-500 drop-shadow-md">{index + 1}</span>;
      if (iconMode === 'GAME') {
          const iconIndex = Math.floor((typeof seed === 'number' ? seed : index) * 100) % GAME_ICONS.length;
          const GameIcon = GAME_ICONS[iconIndex];
          return <GameIcon className="text-orange-400 drop-shadow-md" size={28} />;
      }
      if (iconMode === 'AVATAR') return <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} alt="icon" className="w-full h-full object-cover" />;
      return null;
  };

  const formatTime = (seconds) => {
    if(seconds <= 0 || isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const triggerGrandConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#ff0000', '#ffa500', '#ffff00', '#ff4500'];
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  if (loading) return <div className="h-screen bg-[#020202] text-white flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40}/></div>;

  return (
    <div className="h-screen bg-[#020202] text-white font-sans flex flex-col relative overflow-hidden selection:bg-orange-500 selection:text-black">
      
      {/* BACKGROUND GRAPHICS */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-700/40 via-[#050202] to-black z-0 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-orange-900/30 to-transparent z-0 pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 animate-pulse z-50 shadow-[0_0_20px_rgba(255,100,0,0.7)]"></div>

      {/* --- HEADER (COMPACT 2/3) --- */}
      <header className="relative z-20 flex flex-col shrink-0 bg-black/60 backdrop-blur-md border-b border-orange-600/50 shadow-[0_4px_15px_rgba(234,88,12,0.4)]">
        {/* Row 1 */}
        <div className="flex items-center justify-between px-3 pt-2 pb-0 w-full">
            <button onClick={() => router.push('/')} className="p-1.5 bg-slate-900/80 hover:bg-orange-700 rounded-lg text-orange-300 hover:text-white transition-all border border-orange-900 hover:border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.3)] group">
                <Home size={16} className="group-hover:scale-110 transition-transform" strokeWidth={2.5} />
            </button>
            {isTeacher ? (
                <div className="px-2 py-0.5 rounded-full bg-orange-600/80 border border-orange-400 text-[9px] font-black uppercase text-white shadow-sm">Teacher</div>
            ) : (
                <div className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-600 text-[9px] font-black uppercase text-slate-400">Student</div>
            )}
        </div>

        {/* Row 2 */}
        <div className="flex flex-col items-center justify-center pb-2 -mt-3">
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter fire-text drop-shadow-[0_0_15px_rgba(255,100,0,0.8)] leading-none select-none">
            VOTE
            </h1>
            <div className="mt-0.5 flex flex-col items-center">
                {status === 'SCHEDULED' && <span className="text-yellow-500 font-bold uppercase text-[10px] animate-pulse flex items-center justify-center gap-1"><Clock size={10}/> Sắp diễn ra</span>}
                {status === 'ACTIVE' && (
                    <div className="inline-flex items-center gap-1.5 bg-orange-950/60 px-3 py-0.5 rounded-full border border-orange-500 text-orange-300 shadow-[0_0_10px_rgba(249,115,22,0.4)] animate-pulse">
                        <Clock size={12} className="animate-spin-slow text-yellow-400"/>
                        <span className="font-mono font-black text-sm tracking-wider text-yellow-300">{formatTime(timeLeft)}</span>
                    </div>
                )}
                {status === 'ENDED' && <span className="text-red-500 font-black uppercase text-xs tracking-widest drop-shadow-[0_0_8px_rgba(220,38,38,0.8)] flex items-center justify-center gap-1"><Lock size={12}/> KẾT THÚC</span>}
                
                {(status === 'ACTIVE' || status === 'ENDED') && (
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1 animate-in slide-in-from-top-1">
                        <Users size={10} className="text-orange-500"/> Tổng phiếu: <span className="text-white">{totalVotes}</span>
                    </div>
                )}
            </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 px-4 pt-4 pb-24 z-10 flex flex-col w-full max-w-lg mx-auto overflow-hidden">
        
        {/* TOPIC */}
        <div className="mb-4 text-center shrink-0 relative">
            {isTeacher && status === 'SETUP' ? (
                // [FIX] Bỏ class 'uppercase' để nhập gì hiển thị nấy
                <input 
                    value={topic}
                    onChange={(e) => { setTopic(e.target.value); updateSession({ topic: e.target.value }); }}
                    className="w-full bg-slate-900/80 text-center text-lg font-black text-white border-2 border-orange-500/50 focus:border-orange-400 outline-none py-3 px-4 rounded-xl placeholder:text-slate-500 transition-all shadow-lg"
                    placeholder="Nhập chủ đề bình chọn..."
                />
            ) : (
                <div className="bg-gradient-to-r from-transparent via-orange-900/40 to-transparent border-y border-orange-500/30 py-2">
                    {/* [FIX] Bỏ 'uppercase', thêm 'break-words' để xuống dòng khi dài */}
                    <h2 className="text-lg md:text-xl font-black text-white leading-tight drop-shadow-lg break-words">{topic}</h2>
                </div>
            )}
        </div>

        {/* OPTIONS LIST */}
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 p-1">
          {displayOptions.map((opt, index) => {
            const isSelected = selectedId === opt.id;
            const showResult = status === 'ENDED' || (isTeacher && status === 'ACTIVE');
            const isWinner = showResult && opt.percent > 0 && opt.percent >= Math.max(...options.map(o => o.percent));

            return (
              <div 
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`
                  relative group overflow-hidden rounded-xl border-2 transition-all duration-300 shrink-0
                  ${!isTeacher && status === 'ACTIVE' && !hasVoted ? 'cursor-pointer hover:border-orange-400 hover:bg-slate-900/80' : 'cursor-default'}
                  ${isSelected && status === 'ACTIVE' ? 'border-orange-500 bg-gradient-to-r from-orange-900/60 to-red-900/60 shadow-lg scale-[1.02]' : 'border-slate-800/80 bg-slate-900/40'}
                  ${status === 'SETUP' ? 'border-dashed border-slate-600/60' : ''}
                  ${status === 'ENDED' ? 'transition-transform duration-700 ease-out' : ''}
                `}
                style={{ order: status === 'ENDED' ? -opt.votes : 0 }} 
              >
                {/* Result Bar */}
                {showResult && (
                  <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${isWinner ? 'bg-gradient-to-r from-red-700 via-orange-600 to-yellow-500' : 'bg-slate-700/50'}`} style={{ width: `${opt.percent}%` }}></div>
                )}

                <div className="relative p-3 flex items-center gap-3 z-10">
                  {/* ICON */}
                  <div 
                    onClick={() => isTeacher && status === 'SETUP' && (iconMode === 'GAME' || iconMode === 'AVATAR') && randomizeIcon(index)}
                    className={`
                        w-12 h-12 rounded-xl shrink-0 border-2 overflow-hidden relative transition-all flex items-center justify-center bg-black/40
                        ${isWinner ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.7)] scale-110' : isSelected ? 'border-orange-400' : 'border-slate-700'} 
                        ${isTeacher && status === 'SETUP' && (iconMode === 'GAME' || iconMode === 'AVATAR') ? 'cursor-pointer hover:border-orange-500 hover:shadow-[0_0_10px_orange]' : ''}
                    `}
                  >
                    {renderIcon(index, opt.seed)}
                    {isTeacher && status === 'SETUP' && (iconMode === 'GAME' || iconMode === 'AVATAR') && <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100"><RotateCcw size={16} className="text-orange-300"/></div>}
                    {isWinner && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Trophy size={20} className="text-yellow-300 drop-shadow-md animate-bounce"/></div>}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    {isTeacher && status === 'SETUP' ? (
                        <input 
                            value={opt.label}
                            onChange={(e) => {
                                const newOpts = options.map(o => o.id === opt.id ? {...o, label: e.target.value} : o);
                                setOptions(newOpts);
                            }}
                            onBlur={() => updateSession({ options })} 
                            // [FIX] Bỏ 'uppercase' để giữ nguyên kiểu chữ
                            className="w-full bg-transparent font-bold text-white outline-none text-base placeholder:text-slate-600 border-b border-orange-500/30 focus:border-orange-500 pb-1"
                            placeholder="Nhập nội dung..."
                        />
                    ) : (
                        // [FIX] Thay 'truncate' bằng 'break-words whitespace-pre-wrap' để xuống dòng, bỏ 'uppercase'
                        <h3 className={`font-bold text-base break-words whitespace-pre-wrap ${isSelected ? 'text-orange-300 drop-shadow-[0_0_5px_orange]' : 'text-slate-200'}`}>{opt.label}</h3>
                    )}
                    {showResult && <div className="text-[10px] text-slate-300 font-bold mt-0.5 flex items-center gap-1"><Users size={10}/> {opt.votes} phiếu</div>}
                  </div>

                  {/* Right Action */}
                  <div className="text-right shrink-0 flex items-center gap-2">
                    {showResult ? (
                      <span className={`text-lg font-black italic ${isWinner ? 'text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]' : 'text-slate-400'}`}>{opt.percent}%</span>
                    ) : (
                        !isTeacher && status === 'ACTIVE' && (
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'border-orange-500 bg-orange-500 shadow-[0_0_10px_orange]' : 'border-slate-600 bg-slate-800'}`}>
                                {isSelected && <CheckCircle2 size={16} className="text-white" strokeWidth={3}/>}
                            </div>
                        )
                    )}
                    {isTeacher && status === 'SETUP' && (
                        <button onClick={(e) => { e.stopPropagation(); removeOption(opt.id); }} className="text-slate-500 hover:text-red-500 p-1.5 hover:bg-red-900/30 rounded-md transition-colors"><Trash2 size={18}/></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {isTeacher && status === 'SETUP' && (
              <button onClick={addOption} className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-orange-500 bg-slate-900/50 hover:bg-orange-900/20 rounded-xl text-slate-400 hover:text-orange-400 transition-all flex items-center justify-center gap-2 text-sm font-bold uppercase group shadow-[0_0_10px_transparent] hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]">
                  <Plus size={18} className="group-hover:scale-125 transition-transform"/> Thêm lựa chọn
              </button>
          )}
        </div>

        {/* --- SETTINGS AREA --- */}
        {isTeacher && status === 'SETUP' && (
            <div className="mt-3 space-y-3 animate-in slide-in-from-bottom-2">
                {/* ICON MODE */}
                <div className="bg-slate-900/90 border-2 border-slate-700 p-3 rounded-xl shadow-xl flex gap-2 overflow-x-auto">
                    {[
                        { id: 'ABC', icon: <Type size={16}/>, label: 'ABC' },
                        { id: '123', icon: <Hash size={16}/>, label: '123' },
                        { id: 'GAME', icon: <Sword size={16}/>, label: 'GAME' },
                        { id: 'AVATAR', icon: <Users size={16}/>, label: 'AVATAR' },
                    ].map(m => (
                        <button 
                            key={m.id} 
                            onClick={() => changeIconMode(m.id)}
                            className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-1 transition-all ${iconMode === m.id ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        >
                            {m.icon} {m.label}
                        </button>
                    ))}
                </div>

                {/* SCHEDULE */}
                <div className="bg-slate-900/90 border-2 border-slate-700 p-3 rounded-xl shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-orange-400 uppercase flex items-center gap-2"><Calendar size={14}/> Hẹn giờ tự động</span>
                        <label className="relative inline-flex items-center cursor-pointer group">
                            <input type="checkbox" checked={useSchedule} onChange={(e) => setUseSchedule(e.target.checked)} className="sr-only peer"/>
                            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600 group-hover:shadow-[0_0_10px_orange]"></div>
                        </label>
                    </div>
                    {useSchedule && (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[9px] text-slate-400 uppercase block mb-1 font-bold">Bắt đầu</label>
                                <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-black border border-slate-600 focus:border-orange-500 rounded p-1.5 text-[10px] text-white outline-none font-bold"/>
                            </div>
                            <div>
                                <label className="text-[9px] text-slate-400 uppercase block mb-1 font-bold">Kết thúc</label>
                                <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-black border border-slate-600 focus:border-orange-500 rounded p-1.5 text-[10px] text-white outline-none font-bold"/>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

      </main>

      {/* --- FOOTER CONTROLS --- */}
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black via-[#0a0500] to-transparent z-20">
        {isTeacher && (
            <div className="flex gap-2">
                {status === 'SETUP' && (
                    <button onClick={handleStartVote} className="flex-1 py-3.5 bg-gradient-to-r from-orange-600 via-red-600 to-orange-700 rounded-xl font-black uppercase tracking-widest shadow-[0_0_25px_rgba(234,88,12,0.6)] hover:scale-[1.02] active:scale-95 transition-all text-white text-sm md:text-base flex items-center justify-center gap-2 border-2 border-orange-400">
                        <Play size={20} fill="currentColor" className="animate-pulse"/> {useSchedule && startTime ? 'Lên lịch & Kích hoạt' : 'BẮT ĐẦU NGAY'}
                    </button>
                )}
                {(status === 'ACTIVE' || status === 'SCHEDULED') && (
                    <button onClick={handleEndVote} className="flex-1 py-3.5 bg-slate-800 hover:bg-red-700 border-2 border-slate-600 hover:border-red-500 rounded-xl font-black uppercase tracking-widest transition-all text-white shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_25px_rgba(220,38,38,0.6)] text-sm md:text-base flex items-center justify-center gap-2 group active:scale-95">
                        <Square size={18} fill="currentColor" className="group-hover:animate-ping"/> KẾT THÚC
                    </button>
                )}
                {status === 'ENDED' && (
                    <button onClick={handleReset} className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 border-2 border-slate-700 hover:border-orange-500 rounded-xl font-bold uppercase text-slate-300 hover:text-orange-300 transition-all text-sm md:text-base flex items-center justify-center gap-2 shadow-lg active:scale-95">
                        <RotateCcw size={18}/> TẠO BÌNH CHỌN MỚI
                    </button>
                )}
            </div>
        )}

        {!isTeacher && status === 'ACTIVE' && !hasVoted && (
            <button onClick={handleSubmitVote} disabled={!selectedId} className={`w-full py-3.5 rounded-xl font-black text-lg uppercase italic tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 border-2 ${!selectedId ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed border-slate-700' : 'bg-gradient-to-r from-orange-600 via-red-600 to-yellow-600 text-white hover:scale-[1.02] active:scale-95 border-orange-400 shadow-[0_0_30px_rgba(234,88,12,0.6)] animate-pulse'}`}>
                GỬI BÌNH CHỌN <Zap size={22} fill="currentColor" className={selectedId ? 'animate-bounce' : ''} />
            </button>
        )}

        {!isTeacher && hasVoted && status === 'ACTIVE' && (
            <div className="text-center text-sm text-green-400 font-bold uppercase flex items-center justify-center gap-2 bg-slate-900/90 py-3 rounded-xl border-2 border-green-600/50 shadow-[0_0_20px_rgba(34,197,94,0.3)] animate-in zoom-in">
                <CheckCircle2 size={18} className="text-green-500 animate-pulse"/> Đã gửi phiếu! Chờ kết quả chiến đấu...
            </div>
        )}
        
        {!isTeacher && (status === 'SETUP' || status === 'SCHEDULED') && (
            <div className="text-center text-xs text-orange-400 animate-pulse font-bold uppercase bg-black/40 py-2 rounded-lg flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin"/> {status === 'SCHEDULED' ? `Trận đấu bắt đầu lúc: ${new Date(startTime).toLocaleTimeString()}` : 'Đang chờ hiệu lệnh từ Giáo viên...'}
            </div>
        )}
      </div>

      <style jsx global>{`
        .fire-text {
            background: linear-gradient(0deg, #ff8a00 0%, #ff2e00 50%, #fff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 15px rgba(255, 80, 0, 0.8));
            animation: textBurn 1.5s infinite alternate cubic-bezier(0.45, 0.05, 0.55, 0.95);
        }
        @keyframes textBurn {
            0% { filter: drop-shadow(0 0 10px rgba(255, 69, 0, 0.6)) brightness(1); transform: scale(1); }
            100% { filter: drop-shadow(0 0 25px rgba(255, 140, 0, 1)) brightness(1.2); transform: scale(1.02); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: linear-gradient(to bottom, #ff4500, #ff8c00); border-radius: 10px; }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: invert(1) sepia(1) saturate(5) hue-rotate(350deg); cursor: pointer; opacity: 0.8; }
        input[type="datetime-local"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
      `}</style>
    </div>
  );
}