import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { ref, get, update, onValue, onDisconnect, remove } from 'firebase/database';
import { Trophy, Zap, Flame, Shield, Lock, Loader2, CheckCircle, XCircle, Swords, Star, Send, Clock, User, Check, X, LogOut, Award, Volume2, VolumeX, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ArenaPlayerController() {
  const router = useRouter();
  const { pin } = router.query;
  const [name, setName] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [joined, setJoined] = useState(false);
  
  const [gameData, setGameData] = useState(null); 
  const [quiz, setQuiz] = useState(null);         
  const [answer, setAnswer] = useState(null); 
  const [submitted, setSubmitted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);     
  const [shuffledOptions, setShuffledOptions] = useState([]);
  
  const [localTimer, setLocalTimer] = useState(0); 
  const currentQIndexRef = useRef(-1);

  // Audio State
  const [isMuted, setIsMuted] = useState(false);
  const bgmRef = useRef(null);

  // --- AUDIO SYSTEM ---
  useEffect(() => {
      bgmRef.current = new Audio('/sounds/bgm.mp3');
      bgmRef.current.loop = true;
      bgmRef.current.volume = 0.4;
      return () => {
          if (bgmRef.current) {
              bgmRef.current.pause();
              bgmRef.current = null;
          }
      };
  }, []);

  const playSFX = (type) => {
      if (isMuted) return;
      const audio = new Audio(type === 'correct' ? '/sounds/correct.mp3' : '/sounds/wrong.mp3');
      audio.volume = 1.0;
      audio.play().catch(e => console.log("SFX play failed", e));
  };

  const toggleMute = () => {
      if (bgmRef.current) {
          if (isMuted) bgmRef.current.play().catch(() => {});
          else bgmRef.current.pause();
      }
      setIsMuted(!isMuted);
  };

  // --- 1. LẮNG NGHE DỮ LIỆU ---
  useEffect(() => {
    if (!pin || !joined) return;
    const roomRef = ref(db, `rooms/${pin}`);
    
    return onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.players && playerId && !data.players[playerId]) {
            alert("Tín hiệu bị ngắt bởi trung tâm!");
            if (bgmRef.current) bgmRef.current.pause();
            router.push('/');
            return;
        }

        setGameData(data);
        if (data.quiz) setQuiz(data.quiz);
        
        const svState = data.gameState;
        
        if (svState === 'PREPARE') {
            setLocalTimer(data.currentQuestion === 0 ? 3 : 1);
        }
        else if (svState === 'RESULT') {
            setLocalTimer(3);
        }
        else if (svState === 'QUESTION' && data.quiz) {
            const qType = data.quiz.questions[data.currentQuestion].type;
            const time = data.config?.[`time${qType}`] || 15;
            setLocalTimer(time);
        }

      } else {
        alert("Đấu trường đã đóng cửa!");
        router.push('/');
      }
    });
  }, [pin, joined, playerId]);

  // --- 2. LOCAL TIMER ---
  useEffect(() => {
      if (localTimer > 0) {
          const interval = setInterval(() => setLocalTimer(p => p > 0 ? p - 1 : 0), 1000);
          return () => clearInterval(interval);
      }
  }, [localTimer]);

  // --- 3. GAME LOOP ---
  useEffect(() => {
    if (!gameData || !quiz) return;
    const state = gameData.gameState;
    const qIndex = gameData.currentQuestion;

    if (['LOBBY', 'WAITING', 'PREPARE'].includes(state)) {
      setSubmitted(false);
      setAnswer(null);
      setShowResult(false);
      setEarnedPoints(0);
    }

    if (state === 'QUESTION' && qIndex !== undefined) {
      if (currentQIndexRef.current !== qIndex) {
        const currentQ = quiz.questions[qIndex];
        if (currentQ.type === 'MCQ') {
            const shuffled = currentQ.a.map((val, idx) => ({ text: val, originalIndex: idx, img: currentQ.aImages?.[idx] })).sort(() => Math.random() - 0.5);
            setShuffledOptions(shuffled);
            setAnswer(null);
        } else if (currentQ.type === 'TF') setAnswer({}); 
        else if (currentQ.type === 'SA') setAnswer("");

        currentQIndexRef.current = qIndex;
        setSubmitted(false);
        setShowResult(false);
      }
    }

    if (state === 'RESULT' && !showResult) {
        setShowResult(true);
        if (submitted && answer !== null && playerId) {
            const currentQ = quiz.questions[qIndex];
            let points = 0;
            if (currentQ.type === 'MCQ' && answer === currentQ.correct) points = 100;
            else if (currentQ.type === 'SA' && String(answer).trim().toLowerCase() === String(currentQ.correct).trim().toLowerCase()) points = 100;
            else if (currentQ.type === 'TF') {
                let matches = 0;
                currentQ.items.forEach((item, idx) => { if (String(answer[idx]) === String(item.isTrue)) matches++; });
                if (matches === 4) points = 100; else if (matches === 3) points = 50; else if (matches === 2) points = 25; else if (matches === 1) points = 10;
            }
            
            setEarnedPoints(points);
            
            if (points > 0) {
                playSFX('correct');
                confetti({ 
                    particleCount: 150, 
                    spread: 70, 
                    origin: { y: 0.6 },
                    colors: ['#22d3ee', '#d946ef', '#f472b6', '#facc15']
                });
                update(ref(db, `rooms/${pin}/players/${playerId}`), { score: (gameData.players?.[playerId]?.score || 0) + points });
            } else {
                playSFX('wrong');
            }
        }
    }

    if (state === 'FINISHED') {
        if (bgmRef.current) bgmRef.current.pause();
        confetti({ particleCount: 300, spread: 100, origin: { y: 0.6 } });
    }
  }, [gameData, quiz, submitted, answer, playerId, pin, showResult]);

  // --- 4. JOIN & LEAVE ---
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim() || !pin) return;
    const snap = await get(ref(db, `rooms/${pin}`));
    if (!snap.exists()) return alert("Mã PIN không đúng!");
    
    const newId = 'p_' + Math.floor(Math.random() * 1000000);
    setPlayerId(newId);

    const playerRef = ref(db, `rooms/${pin}/players/${newId}`);
    
    onDisconnect(playerRef).remove();

    await update(playerRef, { 
        name: name.toUpperCase(), 
        score: 0, 
        id: newId, 
        joinedAt: Date.now() 
    });
    
    setJoined(true);

    if (!isMuted && bgmRef.current) {
        bgmRef.current.play().catch(e => console.log("Audio autoplay blocked"));
    }
  };

  const handleLeave = async () => {
      if (pin && playerId) {
          try {
              await remove(ref(db, `rooms/${pin}/players/${playerId}`));
          } catch (e) { console.error(e); }
      }
      if (bgmRef.current) bgmRef.current.pause();
      router.push('/');
  };

  const submitMCQ = (idx) => { if (!submitted) { setAnswer(idx); setSubmitted(true); } };
  const toggleTF = (idx, val) => { if (!submitted) setAnswer(prev => ({ ...prev, [idx]: val })); };
  const confirmSubmit = () => { if (!submitted) setSubmitted(true); };

  // --- STYLE VARIABLES ---
  const neonText = "text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400";
  const glassPanel = "bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 shadow-[0_0_40px_rgba(168,85,247,0.15)]";

  // --- UI: LOGIN SCREEN ---
  if (!joined) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500 selection:text-white">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-purple-600/20 blur-[120px] rounded-full pointer-events-none"></div>

      <div className={`relative z-10 w-full max-w-md p-8 md:p-10 rounded-[2.5rem] ${glassPanel} animate-in zoom-in duration-500`}>
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
             <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-purple-600 p-0.5 rounded-full shadow-[0_0_50px_rgba(6,182,212,0.6)] animate-bounce-slow">
                 <div className="w-full h-full bg-[#020617] rounded-full flex items-center justify-center">
                    <Swords size={40} className="text-white drop-shadow-md" />
                 </div>
             </div>
        </div>
        
        <div className="mt-12 text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-2 leading-none">
                <span className="text-white drop-shadow-md">CHIẾN BINH</span>
                <br/>
                <span className={neonText}>ARENA</span>
            </h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.4em] text-[10px]">Cyberpunk Edition</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-5">
          <div className="relative group">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none"/>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#0f172a] p-5 pl-14 rounded-2xl font-bold text-xl text-white outline-none border-2 border-slate-800 focus:border-cyan-500 focus:shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all uppercase placeholder:normal-case placeholder:text-slate-600" placeholder="NHẬP TÊN CHIẾN BINH..." autoFocus maxLength={12}/>
          </div>
          <button type="submit" className="w-full group relative px-8 py-5 font-black text-2xl text-white uppercase italic tracking-wider rounded-2xl overflow-hidden shadow-lg hover:shadow-cyan-500/40 transition-all">
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-600 to-purple-600 group-hover:scale-105 transition-transform duration-300"></div>
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center justify-center gap-3 drop-shadow-md">THAM CHIẾN <Swords className="rotate-12" size={24}/></span>
          </button>
        </form>
      </div>
    </div>
  );

  if (!gameData) return <div className="min-h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500" size={50}/></div>;
  const currentState = gameData.gameState || 'WAITING';

  // --- UI: MÀN HÌNH CHỜ ---
  if (['LOBBY', 'WAITING', 'PREPARE'].includes(currentState)) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white text-center p-6 font-sans bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] relative overflow-hidden">
         <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-transparent to-cyan-900/10 pointer-events-none"></div>
         
         {currentState === 'PREPARE' ? (
             <div className="animate-in zoom-in duration-300 relative z-10">
                 <h2 className="text-4xl md:text-5xl font-black text-cyan-400 uppercase italic tracking-widest mb-10 animate-pulse drop-shadow-[0_0_30px_#22d3ee]">Sẵn sàng!</h2>
                 <div className="text-[12rem] md:text-[18rem] font-black text-white leading-none drop-shadow-[0_0_80px_rgba(168,85,247,0.8)] animate-ping-slow font-mono">{localTimer}</div>
             </div>
         ) : (
             <div className="relative z-10 w-full max-w-md animate-in slide-in-from-bottom duration-500">
                <div className="mb-10 relative inline-block">
                    <div className="absolute inset-0 bg-cyan-500 blur-[60px] opacity-20 animate-pulse"></div>
                    <Shield size={100} className="text-white drop-shadow-2xl relative z-10" fill="currentColor"/>
                    <div className="absolute -bottom-2 -right-2 z-20 bg-[#020617] rounded-full p-1"><CheckCircle size={36} className="text-green-400 fill-green-900"/></div>
                </div>
                <h2 className="text-3xl md:text-4xl font-black mb-6 italic uppercase tracking-tighter text-slate-300">Đã kết nối!</h2>
                <div className={`p-6 rounded-3xl border border-white/10 bg-slate-900/80 shadow-2xl flex flex-col items-center gap-2 mb-10 relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest relative z-10">Chiến binh</span>
                    <span className={`text-4xl font-black uppercase ${neonText} drop-shadow-sm relative z-10 truncate w-full text-center`}>{name}</span>
                </div>
                <div className="flex items-center justify-center gap-3 text-cyan-300/80 animate-pulse mb-8">
                    <Loader2 className="animate-spin" size={18}/>
                    <p className="font-bold uppercase tracking-[0.2em] text-xs">Đang chờ hiệu lệnh...</p>
                </div>
                <button onClick={handleLeave} className="text-slate-500 hover:text-red-400 font-bold uppercase text-xs border border-slate-800 hover:border-red-900/50 bg-white/5 hover:bg-red-900/10 px-6 py-3 rounded-xl transition flex items-center gap-2 mx-auto"><LogOut size={16}/> Rút lui</button>
             </div>
         )}
      </div>
    );
  }

  // --- UI: GAMEPLAY ---
  if (currentState === 'QUESTION') {
    if (submitted) return (
        <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center text-white text-center p-4 font-sans">
            <div className="mb-8 relative">
                <div className="absolute inset-0 bg-purple-500 blur-[80px] opacity-20"></div>
                <Lock size={100} className="text-cyan-400 animate-bounce relative z-10 drop-shadow-[0_0_30px_#22d3ee]"/>
            </div>
            <h2 className="text-4xl md:text-5xl font-black italic uppercase text-white mb-4">ĐÃ KHÓA MỤC TIÊU</h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.3em] animate-pulse text-sm">Đang phân tích dữ liệu...</p>
        </div>
    );

    const q = quiz?.questions?.[gameData.currentQuestion];
    return (
      <div className="h-screen bg-[#020617] flex flex-col text-white font-sans overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
        {/* HEADER */}
        <div className="h-[auto] py-3 md:h-[90px] bg-[#0f172a]/90 backdrop-blur-md border-b border-purple-900/30 px-4 md:px-8 flex justify-between items-center shrink-0 relative z-20 shadow-[0_5px_30px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3">
                <button onClick={handleLeave} className="bg-white/5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-red-500/20 transition"><LogOut size={20}/></button>
                <button onClick={toggleMute} className={`p-2 rounded-xl transition ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-cyan-500/10 text-cyan-400'}`}>{isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
            </div>
            <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2 pointer-events-none">
                <h1 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 drop-shadow-md">CHIẾN BINH ARENA</h1>
                <div className="flex items-center gap-1 mt-1"><User size={10} className="text-slate-500"/><p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">{name}</p></div>
            </div>
            <div className="flex items-center gap-3 md:gap-5">
                <div className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-xl font-black font-mono text-xl md:text-2xl border-2 shadow-lg ${localTimer <= 5 ? 'bg-red-900/50 border-red-500 text-red-400 animate-pulse' : 'bg-slate-900/50 border-cyan-500/50 text-cyan-400'}`}>
                    <Clock size={20} className={localTimer <= 5 ? 'text-red-400' : 'text-cyan-400'}/> <span>{localTimer}</span>
                </div>
                <div className="hidden md:flex flex-col items-end">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Điểm số</span>
                    <div className="flex items-center gap-2">
                        <Zap size={18} className="text-yellow-400 fill-yellow-400 animate-pulse"/> 
                        <span className="font-black text-2xl text-yellow-400 drop-shadow-md">{gameData.players[playerId]?.score}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 pb-12 relative flex flex-col items-center">
            <div className="absolute inset-0 bg-gradient-to-t from-purple-900/10 via-transparent to-transparent pointer-events-none"></div>
            <div className="w-full max-w-4xl relative z-10 animate-in slide-in-from-bottom duration-500">
                <div className={`bg-[#1e293b]/60 backdrop-blur-xl text-white rounded-[2rem] p-6 md:p-8 mb-6 shadow-2xl border border-white/10 relative overflow-hidden group`}>
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500"></div>
                    <div className="absolute top-4 right-4 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-bold text-cyan-200 uppercase tracking-widest flex items-center gap-2">
                        <Star size={12} className="text-yellow-400" fill="currentColor"/> Nhiệm vụ #{gameData.currentQuestion + 1}
                    </div>
                    {q?.img && <img src={q.img} className="max-h-40 md:max-h-56 w-auto rounded-xl mx-auto mb-6 border-2 border-slate-700 shadow-lg bg-black/40 object-contain"/>}
                    <h2 className={`text-lg md:text-2xl font-bold text-center leading-relaxed drop-shadow-md text-slate-100 ${q?.q.includes('\n') ? 'whitespace-pre-wrap font-mono text-left text-base' : ''}`}>{q?.q}</h2>
                </div>

                {/* --- MCQ --- */}
                {q.type === 'MCQ' && (
                    <div className="grid grid-cols-1 gap-3 md:gap-4">
                        {shuffledOptions.map((item, idx) => (
                            <button key={idx} onClick={() => submitMCQ(item.originalIndex)} className="group relative w-full touch-manipulation">
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-600 to-purple-600 rounded-2xl shadow-[0_5px_0_#4c1d95] transition-all group-active:shadow-none group-active:translate-y-1 opacity-80 group-hover:opacity-100"></div>
                                <div className="relative bg-[#1e293b] p-4 md:p-5 rounded-2xl border-2 border-white/5 flex items-center gap-4 transition-all group-hover:bg-[#2e3b55] group-active:translate-y-1 group-active:border-purple-400">
                                    <span className="w-10 h-10 md:w-12 md:h-12 bg-black/40 rounded-xl flex items-center justify-center text-lg font-black text-slate-400 group-hover:text-white group-hover:bg-purple-500 transition shadow-inner border border-white/5 shrink-0">{String.fromCharCode(65+idx)}</span>
                                    <div className="flex-1 flex items-center font-bold text-base md:text-xl text-left text-slate-200 group-hover:text-white">
                                        {item.img ? <img src={item.img} className="h-16 rounded-lg bg-white p-1 shadow-sm"/> : <span>{item.text}</span>}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* --- TF --- */}
                {q.type === 'TF' && (
                    <div className="w-full">
                        <div className="bg-[#1e293b]/80 backdrop-blur rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                            <div className="bg-black/40 p-3 grid grid-cols-12 gap-2 text-[10px] md:text-xs font-black uppercase text-cyan-400 tracking-[0.2em] border-b border-white/10">
                                <div className="col-span-8">Nội dung</div>
                                <div className="col-span-2 text-center text-green-400">Đúng</div>
                                <div className="col-span-2 text-center text-red-400">Sai</div>
                            </div>
                            <div className="divide-y divide-white/5">
                                {q.items.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 p-3 md:p-4 items-center hover:bg-white/5 transition">
                                        <div className="col-span-8 font-bold text-sm md:text-base text-slate-200 leading-tight">{item.text}</div>
                                        <div className="col-span-2 flex justify-center"><button onClick={() => toggleTF(idx, "true")} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all active:scale-95 touch-manipulation ${answer?.[idx] === "true" ? 'bg-green-600 border-green-400 text-white shadow-[0_0_15px_#22c55e]' : 'bg-slate-800 border-slate-600 text-slate-600'}`}><Check size={20} strokeWidth={4}/></button></div>
                                        <div className="col-span-2 flex justify-center"><button onClick={() => toggleTF(idx, "false")} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all active:scale-95 touch-manipulation ${answer?.[idx] === "false" ? 'bg-red-600 border-red-400 text-white shadow-[0_0_15px_#ef4444]' : 'bg-slate-800 border-slate-600 text-slate-600'}`}><X size={20} strokeWidth={4}/></button></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button onClick={confirmSubmit} className="w-full mt-6 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black py-4 rounded-2xl text-xl shadow-lg uppercase italic tracking-wider flex items-center justify-center gap-3 active:scale-[0.98] transition-transform border border-white/10"><Send size={24}/> CHỐT ĐÁP ÁN</button>
                    </div>
                )}

                {/* --- SA --- */}
                {q.type === 'SA' && (
                    <div className="mt-8">
                        <input type="text" value={answer || ''} onChange={(e) => setAnswer(e.target.value)} className="w-full bg-[#0f172a] border-4 border-slate-700 focus:border-cyan-500 p-5 rounded-[2rem] text-white font-black text-2xl outline-none text-center mb-6 uppercase placeholder:text-slate-600 transition-colors shadow-inner" placeholder="NHẬP ĐÁP ÁN..."/>
                        <button onClick={confirmSubmit} className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-black py-4 rounded-2xl text-xl shadow-lg uppercase italic tracking-wider flex items-center justify-center gap-3 active:scale-[0.98] transition-transform border border-white/10"><Send size={24}/> GỬI TRẢ LỜI</button>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  }

  // --- UI: KẾT QUẢ VÒNG ---
  if (currentState === 'RESULT') {
    return (
      <div className={`min-h-screen flex flex-col font-sans transition-colors duration-500 relative overflow-hidden ${earnedPoints > 0 ? 'bg-emerald-950' : 'bg-rose-950'}`}>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-white relative z-10">
              <div className={`bg-[#020617]/60 backdrop-blur-2xl rounded-[3rem] p-10 md:p-14 shadow-2xl w-full max-w-md border-4 animate-in zoom-in duration-300 relative overflow-hidden ${earnedPoints > 0 ? 'border-emerald-500/50 shadow-[0_0_60px_rgba(16,185,129,0.3)]' : 'border-rose-500/50 shadow-[0_0_60px_rgba(244,63,94,0.3)]'}`}>
                  <div className="mb-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] scale-150 relative z-10">
                      {earnedPoints > 0 ? <CheckCircle size={100} className="text-emerald-400 animate-bounce-slow"/> : <XCircle size={100} className="text-rose-400 animate-shake"/>}
                  </div>
                  <h2 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter mb-6 text-white drop-shadow-lg leading-none">
                      {earnedPoints === 100 ? 'TUYỆT VỜI!' : earnedPoints > 0 ? 'KHÁ LẮM!' : 'SAI RỒI!'}
                  </h2>
                  {earnedPoints > 0 ? (
                      <div className="inline-flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-10 py-4 rounded-full font-black text-4xl italic shadow-lg border-b-4 border-green-800">
                          <Star size={32} fill="currentColor" className="animate-spin-slow text-yellow-300"/> +{earnedPoints}
                      </div>
                  ) : (<div className="text-xl font-bold opacity-60 uppercase tracking-[0.3em] bg-black/30 px-6 py-3 rounded-full border border-white/10">Cố gắng lần sau!</div>)}
              </div>
          </div>
      </div>
    );
  }

  // --- UI: TỔNG KẾT (ĐÃ LOẠI BỎ CHÍNH XÁC) ---
  if (currentState === 'FINISHED') {
    const finalScore = gameData.players?.[playerId]?.score || 0;
    const sorted = Object.values(gameData.players || {}).sort((a,b) => b.score - a.score);
    const rank = sorted.findIndex(p => p.id === playerId) + 1;

    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center text-white font-sans relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
        <div className="absolute inset-0 bg-gradient-to-t from-purple-900/40 via-transparent to-transparent pointer-events-none"></div>
        
        {/* Confetti container */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
             <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-yellow-400 animate-ping"></div>
             <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-cyan-400 animate-ping delay-700"></div>
        </div>

        <div className="relative z-10 animate-in zoom-in duration-500 w-full max-w-md">
            <div className="relative inline-block mb-10">
                <div className="absolute inset-0 bg-yellow-500 blur-[80px] opacity-40 animate-pulse"></div>
                <Trophy size={140} className="text-yellow-400 animate-bounce drop-shadow-[0_20px_40px_rgba(250,204,21,0.8)] relative z-10" />
            </div>
            <h1 className="text-6xl md:text-7xl font-black italic uppercase mb-10 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-200 to-orange-500 drop-shadow-2xl">
                TỔNG KẾT
            </h1>
            <div className="bg-[#0f172a]/80 backdrop-blur-xl border-4 border-purple-500/30 p-10 rounded-[3rem] shadow-[0_0_60px_rgba(168,85,247,0.2)] relative overflow-hidden">
                <div className="text-center border-b border-white/10 pb-6 mb-6">
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-1">Thứ hạng</p>
                    <div className="text-6xl font-black text-white italic drop-shadow-lg">#{rank}</div>
                </div>
                <div>
                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mb-2">Tổng điểm XP</p>
                    <p className="text-7xl font-black text-cyan-400 font-mono tracking-tighter drop-shadow-md leading-none">{finalScore}</p>
                </div>
            </div>
            <button onClick={() => router.push('/')} className="mt-12 text-slate-400 hover:text-white font-bold uppercase tracking-[0.3em] border-b-2 border-transparent hover:border-purple-500 transition pb-2 text-sm hover:scale-105 transform flex items-center gap-2 mx-auto">
                <LogOut size={16}/> Rời đấu trường
            </button>
        </div>
      </div>
    );
  }
  return null;
}