import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { ref, get, set, onValue, update, runTransaction, onDisconnect, remove } from 'firebase/database';
import { Zap, Shield, Lock, CheckCircle, XCircle, Trophy, User, ArrowRight, Loader2, AlertCircle, Home, Ban, Check, X, Send, Star, Clock, Flame, Crown, Sparkles, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LightningArenaPlayer() {
  const router = useRouter();
  const { pin: queryPin } = router.query;
  const [pin, setPin] = useState(queryPin || '');
  
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  
  const [roomData, setRoomData] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  // State Gameplay
  const [activeQ, setActiveQ] = useState(null);
  const [feedback, setFeedback] = useState(null); 
  const [failedQuestions, setFailedQuestions] = useState([]);
  
  // State UI & Audio
  const [localScore, setLocalScore] = useState(0); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMuted, setIsMuted] = useState(false); 
  const bgmRef = useRef(null); 

  // State input
  const [mcqSelection, setMcqSelection] = useState(null);
  const [tfSelection, setTfSelection] = useState({});
  const [saInput, setSaInput] = useState("");

  useEffect(() => {
      if (queryPin) setPin(queryPin);
  }, [queryPin]);

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
      audio.play().catch(e => console.log("Audio play error:", e));
  };

  const toggleMute = () => {
      if (bgmRef.current) {
          if (isMuted) bgmRef.current.play().catch(() => {});
          else bgmRef.current.pause();
      }
      setIsMuted(!isMuted);
  };

  // --- ĐỒNG HỒ ---
  useEffect(() => {
      if (roomData?.status === 'PLAYING' && roomData.startTime) {
          const duration = (roomData.duration || 300) * 1000; 
          const endTime = roomData.startTime + duration;

          const interval = setInterval(() => {
              const now = Date.now();
              const diff = Math.floor((endTime - now) / 1000);
              setTimeLeft(diff > 0 ? diff : 0);
              if (diff <= 0) clearInterval(interval);
          }, 1000);

          return () => clearInterval(interval);
      }
  }, [roomData?.status, roomData?.startTime, roomData?.duration]);

  const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
      if (feedback) {
          const timer = setTimeout(() => {
              setActiveQ(null);
              setFeedback(null);
          }, 2500); 
          return () => clearTimeout(timer);
      }
  }, [feedback]);

  // --- LOGIC GAMEPLAY ---
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!pin || !name.trim()) return alert("Vui lòng nhập tên!");
    const snap = await get(ref(db, `rooms/${pin}`));
    if (!snap.exists()) return alert("Mã phòng không tồn tại!");
    const data = snap.val();
    if (data.type !== 'LIGHTNING') return alert("Sai phòng game!");
    if (data.status === 'FINISHED') return alert("Trò chơi đã kết thúc!");

    const newId = 'user_' + Date.now();
    setPlayerId(newId);
    
    const playerRef = ref(db, `rooms/${pin}/players/${newId}`);
    onDisconnect(playerRef).remove();

    update(playerRef, {
        id: newId, name: name.toUpperCase(), score: 0, captured: 0, wrongCount: 0
    });
    
    setJoined(true);

    if (!isMuted && bgmRef.current) {
        bgmRef.current.play().catch(e => console.log("Autoplay blocked:", e));
    }
  };

  const handleLeave = async () => {
      if (pin && playerId) {
          try { await remove(ref(db, `rooms/${pin}/players/${playerId}`)); } catch (e) {}
      }
      if (bgmRef.current) bgmRef.current.pause(); 
      router.push('/');
  };

  useEffect(() => {
      if (!joined || !pin || !playerId) return; 
      const roomRef = ref(db, `rooms/${pin}`);
      return onValue(roomRef, (snap) => {
          const data = snap.val();
          if (data) {
              setRoomData(data);
              setQuestions(data.quizData || []);
              if (data.players && data.players[playerId]) setLocalScore(data.players[playerId].score);
              
              if (activeQ && !feedback) {
                  const currentQState = data.questionsState?.[activeQ.index];
                  if (currentQState?.winner && currentQState.winner !== playerId) {
                      setFeedback('LATE');
                      playSFX('wrong'); 
                  }
              }
              if (data.status === 'FINISHED') {
                  setActiveQ(null);
                  if (bgmRef.current) bgmRef.current.pause();
                  playSFX('correct'); 
                  confetti({ particleCount: 300, spread: 150, origin: { y: 0.6 } });
              }
          } else { alert("Phòng hủy!"); router.push('/'); }
      });
  }, [joined, pin, activeQ, feedback, playerId]); 

  const handleSelectQuestion = (index) => {
      if (roomData?.status !== 'PLAYING') return;
      if (roomData.questionsState && roomData.questionsState[index]?.winner) return; 
      if (failedQuestions.includes(index)) return;
      setMcqSelection(null); setTfSelection({}); setSaInput("");
      setActiveQ({ ...questions[index], index: index }); setFeedback(null); 
  };

  const checkAnswer = () => {
      if (!activeQ) return false;
      const type = activeQ.type;
      if (type === 'MCQ') return mcqSelection !== null && String(mcqSelection) === String(activeQ.correct);
      if (type === 'SA') return saInput.trim().toLowerCase() === String(activeQ.correct).trim().toLowerCase();
      if (type === 'TF') return activeQ.items.every((item, idx) => String(tfSelection[idx]) === String(item.isTrue));
      return false;
  };

  const handleSubmitAnswer = async () => {
      if (!activeQ || feedback) return; 
      if (activeQ.type === 'MCQ' && mcqSelection === null) return alert("Chưa chọn đáp án!");
      if (activeQ.type === 'SA' && !saInput.trim()) return alert("Chưa nhập đáp án!");
      if (activeQ.type === 'TF' && Object.keys(tfSelection).length < activeQ.items.length) return alert("Chưa làm xong!");

      const isCorrect = checkAnswer();

      if (isCorrect) {
          const qRef = ref(db, `rooms/${pin}/questionsState/${activeQ.index}`);
          try {
              const result = await runTransaction(qRef, (curr) => {
                  if (curr === null) return { winner: playerId, winnerName: name };
                  if (curr.winner) return; 
                  return { winner: playerId, winnerName: name };
              });

              if (result.committed) {
                  setFeedback('CORRECT');
                  playSFX('correct'); 
                  try { confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#fbbf24', '#ef4444'] }); } catch(e){}
                  setLocalScore(prev => prev + 100);
                  const pRef = ref(db, `rooms/${pin}/players/${playerId}`);
                  get(pRef).then(snap => {
                      const p = snap.val();
                      update(pRef, { score: (p.score || 0) + 100, captured: (p.captured || 0) + 1 });
                  });
              } else { 
                  setFeedback('LATE');
                  playSFX('wrong'); 
              }
          } catch (e) { setFeedback('LATE'); }
      } else {
          setFeedback('WRONG');
          playSFX('wrong'); 
          setFailedQuestions(prev => [...prev, activeQ.index]); 
          const pRef = ref(db, `rooms/${pin}/players/${playerId}`);
          get(pRef).then(snap => {
              const p = snap.val();
              update(pRef, { wrongCount: (p.wrongCount || 0) + 1 });
          });
      }
  };

  // --- UI ---
  if (!joined) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 font-sans bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
      <div className="bg-slate-900/90 backdrop-blur-xl p-8 md:p-10 rounded-[2rem] border-2 border-orange-500 shadow-[0_0_80px_rgba(249,115,22,0.4)] w-full max-w-md text-center animate-in zoom-in relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-600"></div>
          <div className="mb-6 relative inline-block">
              <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-40 animate-pulse"></div>
              <Zap size={70} className="text-yellow-400 relative z-10 drop-shadow-lg" fill="currentColor"/>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-red-600 italic uppercase tracking-tighter mb-2" style={{textShadow: '0 2px 10px rgba(234,88,12,0.5)'}}>NHANH NHƯ CHỚP</h1>
          <p className="text-orange-200 font-bold uppercase tracking-[0.4em] text-xs mb-8">Lightning Arena</p>

          <form onSubmit={handleJoin} className="space-y-4 relative z-20">
              {!queryPin && <input value={pin} onChange={e=>setPin(e.target.value)} className="w-full bg-black/50 border-2 border-slate-700 text-yellow-400 text-center text-3xl font-black p-4 rounded-xl outline-none focus:border-yellow-500 tracking-widest placeholder:text-slate-700 font-mono" placeholder="000000"/>}
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-black/50 border-2 border-slate-700 text-white text-center text-xl font-bold p-4 rounded-xl outline-none focus:border-orange-500 uppercase placeholder:text-slate-700" placeholder="TÊN CHIẾN BINH"/>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-black py-4 rounded-xl text-xl uppercase italic hover:scale-105 transition shadow-[0_0_30px_rgba(220,38,38,0.5)] flex items-center justify-center gap-2 group"><Flame size={24} className="group-hover:animate-bounce"/> CHIẾN NGAY</button>
          </form>
      </div>
    </div>
  );

  if (!roomData) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={50}/></div>;

  if (roomData.status === 'LOBBY') return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <div className="animate-bounce mb-8 relative">
              <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-20"></div>
              <Shield size={120} className="text-cyan-400 drop-shadow-[0_0_20px_#22d3ee]"/>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white uppercase mb-4 italic tracking-tight">Xin chào <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{name}</span></h2>
          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-sm bg-slate-900/80 px-6 py-3 rounded-full border border-slate-700 animate-pulse">
              <Loader2 className="animate-spin" size={16}/> Đang chờ tín hiệu...
          </div>
          <button onClick={handleLeave} className="mt-12 text-slate-500 hover:text-red-500 font-bold uppercase text-sm border border-slate-800 hover:border-red-500 px-6 py-2 rounded-lg transition">Rời khỏi</button>
      </div>
  );

  if (roomData.status === 'FINISHED') {
      const myScore = roomData.players?.[playerId]?.score || localScore; 
      const myRank = (() => {
          if (!roomData?.players || !playerId) return 0;
          const sorted = Object.values(roomData.players).sort((a, b) => b.score - a.score);
          return sorted.findIndex(p => p.id === playerId) + 1;
      })();
      const rankColor = myRank === 1 ? 'text-yellow-400' : myRank === 2 ? 'text-gray-300' : myRank === 3 ? 'text-orange-400' : 'text-slate-400';
      const rankText = myRank === 1 ? 'VÔ ĐỊCH' : myRank === 2 ? 'Á QUÂN' : myRank === 3 ? 'QUÝ QUÂN' : `HẠNG ${myRank}`;

      return (
          <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] overflow-hidden relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-900/20 via-[#020617] to-black pointer-events-none"></div>
              <div className="relative z-10 animate-in zoom-in duration-700">
                  <div className="mb-6 relative inline-block">
                      <div className={`absolute inset-0 blur-3xl opacity-50 ${myRank === 1 ? 'bg-yellow-500' : 'bg-blue-500'}`}></div>
                      {myRank === 1 ? <Crown size={120} className="text-yellow-400 animate-bounce drop-shadow-lg"/> : <Trophy size={100} className={`${rankColor} drop-shadow-lg`}/>}
                  </div>
                  <h1 className={`text-6xl md:text-8xl font-black uppercase italic mb-2 tracking-tighter ${rankColor} drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)]`}>{rankText}</h1>
                  <div className="bg-slate-900/80 border-2 border-white/10 p-8 md:p-12 rounded-[3rem] shadow-2xl relative overflow-hidden group mt-8 max-w-lg mx-auto backdrop-blur-md">
                      <div className="grid grid-cols-2 gap-8 text-left">
                          <div><p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mb-1">Tổng điểm</p><p className="text-4xl md:text-5xl font-black text-white font-mono">{myScore}</p></div>
                          <div><p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mb-1">Số câu chiếm</p><p className="text-4xl md:text-5xl font-black text-cyan-400 font-mono">{roomData.players?.[playerId]?.captured || 0}</p></div>
                      </div>
                  </div>
              </div>
              <button onClick={() => router.push('/')} className="mt-12 text-slate-500 hover:text-white font-bold uppercase border-b border-transparent hover:border-white transition flex items-center gap-2 relative z-10"><Home size={18}/> Về Trang Chủ</button>
          </div>
      );
  }

  // --- GAME BOARD ---
  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans flex flex-col overflow-hidden relative selection:bg-yellow-500 selection:text-black">
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/10 via-[#050505] to-black pointer-events-none"></div>
        
        {/* [MỚI] LỚP BACKGROUND LOGO (NẰM DƯỚI CÙNG, KHÔNG CUỘN) */}
        <div className="fixed top-[80px] left-0 w-full h-[40vh] flex flex-col items-center justify-center z-0 pointer-events-none opacity-100 animate-in zoom-in duration-700">
            <div className="relative">
                <div className="absolute inset-0 bg-yellow-500 blur-[80px] opacity-20 animate-pulse"></div>
                <Zap size={150} className="text-yellow-400 drop-shadow-[0_0_50px_rgba(250,204,21,0.5)] animate-bounce-slow mx-auto" strokeWidth={1} fill="currentColor"/>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-600 italic uppercase tracking-tighter drop-shadow-2xl text-center mt-4 leading-none">NHANH NHƯ<br/>CHỚP</h1>
            <p className="text-orange-200/50 font-bold uppercase tracking-[0.5em] text-xs mt-4">Tốc độ sấm sét</p>
        </div>

        <header className="h-[70px] md:h-[80px] bg-slate-900/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-4 md:px-6 shrink-0 shadow-lg relative z-30">
            <div className="flex items-center gap-3">
                <button onClick={handleLeave} className="bg-white/5 p-2 md:p-2.5 rounded-xl hover:bg-red-600 hover:text-white transition text-slate-400"><Home size={20}/></button>
                <button onClick={toggleMute} className={`p-2 md:p-2.5 rounded-xl transition ${isMuted ? 'bg-red-900/30 text-red-500' : 'bg-white/5 text-cyan-400 hover:text-white'}`}>
                    {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
                </button>
                {/* [FIX] Ẩn text trên mobile để Header gọn hơn */}
                <div className="hidden md:flex items-center gap-3 pl-4 border-l border-white/10">
                    <div className="bg-gradient-to-br from-yellow-400 to-red-600 p-2 rounded-lg shadow-md transform -skew-x-12"><Zap size={20} className="text-white fill-white transform skew-x-12"/></div>
                    <div><h1 className="text-xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-red-500 leading-none">NHANH NHƯ CHỚP</h1></div>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-full border-2 shadow-[0_0_20px_inset_rgba(0,0,0,0.5)] transition-all ${timeLeft <= 30 ? 'bg-red-950/80 border-red-500 text-red-500 animate-pulse scale-110' : 'bg-slate-950 border-slate-700 text-cyan-400'}`}><Clock size={18}/><span className="font-mono font-black text-lg md:text-xl tracking-widest">{formatTime(timeLeft)}</span></div>
                <div className="flex flex-col items-end"><span className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-widest">Điểm</span><span className="text-2xl md:text-3xl font-black text-yellow-400 leading-none drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] transition-all transform key={localScore}">{localScore}</span></div>
            </div>
        </header>

        {/* [MỚI] MAIN SCROLL: Đẩy content xuống thấp (pt-[250px]) để lộ logo */}
        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
            <div className="w-full max-w-7xl mx-auto px-4 md:px-6 pt-[250px] md:pt-[100px] pb-32">
                <div className="bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-white/10 p-4 md:p-6 shadow-2xl">
                    <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 md:gap-3">
                        {questions.map((q, idx) => {
                            const qState = roomData.questionsState?.[idx] || {};
                            const isSolved = !!qState.winner;
                            const isMine = qState.winner === playerId;
                            const hasFailed = failedQuestions.includes(idx);

                            return (
                                <button key={idx} disabled={isSolved || hasFailed} onClick={() => handleSelectQuestion(idx)} 
                                    className={`aspect-square rounded-lg md:rounded-xl relative flex flex-col items-center justify-center transition-all duration-300 transform border backdrop-blur-sm touch-manipulation
                                        ${isSolved 
                                            ? (isMine ? 'bg-gradient-to-br from-green-600/80 to-emerald-900/90 border-green-400/80 shadow-[0_0_20px_#22c55e] scale-95 z-0' : 'bg-slate-900/50 border-slate-800 opacity-40 grayscale scale-90 z-0') 
                                            : (hasFailed ? 'bg-red-950/40 border-red-900/50 opacity-60 cursor-not-allowed' : 'bg-gradient-to-br from-white/10 to-white/5 border-white/20 hover:border-cyan-400 hover:shadow-[0_0_25px_#22d3ee] hover:bg-cyan-900/40 hover:scale-105 hover:z-20 active:scale-95')
                                        }`}>
                                    {!isSolved && !hasFailed && (<><div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity rounded-xl"></div><Sparkles size={12} className="absolute top-1 right-1 text-cyan-200 opacity-0 group-hover:opacity-100 animate-pulse"/></>)}
                                    {isSolved ? (<>{isMine ? <CheckCircle size={18} className="text-green-300 drop-shadow-md mb-1"/> : <Lock size={14} className="text-slate-500 mb-1"/>}<div className={`text-[7px] md:text-[8px] font-black uppercase px-1 py-0.5 rounded w-[90%] truncate text-center ${isMine ? 'bg-green-950 text-green-400' : 'bg-transparent text-slate-500'}`}>{isMine ? 'YOU' : qState.winnerName}</div></>) : hasFailed ? (<Ban size={20} className="text-red-800"/>) : (<span className="text-lg md:text-2xl font-black text-white/90 drop-shadow-md group-hover:text-white transition-colors">{idx + 1}</span>)}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </main>

        {activeQ && (
            <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 animate-in fade-in duration-200">
                <div className={`bg-[#0f172a] w-full max-w-2xl rounded-2xl border border-cyan-500/50 shadow-2xl relative flex flex-col max-h-[95vh] overflow-hidden`}>
                    
                    {/* FEEDBACK OVERLAYS */}
                    {feedback === 'CORRECT' && <div className="absolute inset-0 z-[60] bg-gradient-to-br from-green-600 to-emerald-950 flex flex-col items-center justify-center animate-in zoom-in duration-300 text-white"><Star size={80} className="text-yellow-300 animate-spin-slow mb-4"/><h2 className="text-4xl md:text-5xl font-black uppercase italic">XUẤT SẮC!</h2><p className="text-emerald-100 font-bold text-lg md:text-xl mt-2">+100 ĐIỂM</p></div>}
                    {feedback === 'WRONG' && <div className="absolute inset-0 z-[60] bg-gradient-to-br from-red-600 to-rose-950 flex flex-col items-center justify-center animate-in zoom-in text-white"><XCircle size={80} className="animate-shake mb-4"/><h2 className="text-4xl md:text-5xl font-black uppercase italic">SAI RỒI!</h2><p className="text-red-100 font-bold text-lg mt-2">Mất lượt!</p></div>}
                    {feedback === 'LATE' && <div className="absolute inset-0 z-[60] bg-gradient-to-br from-orange-500 to-red-900 flex flex-col items-center justify-center animate-in zoom-in text-white"><AlertCircle size={80} className="animate-pulse mb-4"/><h2 className="text-4xl md:text-5xl font-black uppercase italic">CHẬM TAY!</h2><p className="text-orange-100 font-bold text-lg mt-2">Đã bị cướp!</p></div>}

                    <button onClick={() => setActiveQ(null)} className="absolute top-3 right-3 bg-slate-800 p-1.5 rounded-full hover:bg-red-500 transition z-50 text-white"><X size={18}/></button>
                    
                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 relative z-10">
                        <div className="text-center mb-4">
                            <span className="bg-cyan-900/30 text-cyan-400 font-black uppercase text-[9px] px-3 py-1 rounded-full mb-2 inline-block border border-cyan-500/30">NV #{activeQ.index + 1}</span>
                            <h2 className="text-lg md:text-xl font-bold text-white leading-tight">{activeQ.q}</h2>
                            {activeQ.img && <img src={activeQ.img} className="mx-auto mt-3 rounded-lg border-2 border-slate-800 max-h-32 object-contain bg-black"/>}
                        </div>

                        {activeQ.type === 'MCQ' && (
                            <div className="grid grid-cols-1 gap-2">
                                {activeQ.a.map((ans, i) => (
                                    <button key={i} onClick={() => setMcqSelection(i)} className={`border p-3 rounded-xl font-bold text-sm text-left transition-all active:scale-95 flex items-center gap-3 touch-manipulation ${mcqSelection === i ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'}`}>
                                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${mcqSelection === i ? 'bg-white text-indigo-600' : 'bg-black/40'}`}>{String.fromCharCode(65+i)}</span>
                                        <span className="flex-1 leading-tight">{ans}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeQ.type === 'TF' && (
                            <div className="bg-slate-800/50 rounded-xl border border-white/10 overflow-hidden">
                                <div className="divide-y divide-white/5">
                                    {activeQ.items.map((item, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-1 p-2 items-center">
                                            <div className="col-span-8 text-xs font-bold text-white">{item.text}</div>
                                            <div className="col-span-2 flex justify-center"><button onClick={() => setTfSelection(prev => ({...prev, [idx]: "true"}))} className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${tfSelection[idx] === "true" ? 'bg-green-600 border-green-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-600'}`}><Check size={16}/></button></div>
                                            <div className="col-span-2 flex justify-center"><button onClick={() => setTfSelection(prev => ({...prev, [idx]: "false"}))} className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${tfSelection[idx] === "false" ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-600'}`}><X size={16}/></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeQ.type === 'SA' && (
                            <div className="mt-4">
                                <input value={saInput} onChange={(e) => setSaInput(e.target.value)} className="w-full bg-[#050505] border-2 border-slate-700 p-4 rounded-xl text-white font-bold text-lg outline-none focus:border-cyan-500 text-center uppercase" placeholder="NHẬP ĐÁP ÁN..."/>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-white/10 bg-[#0f172a] z-40 shrink-0">
                        <button onClick={handleSubmitAnswer} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl text-lg shadow-lg flex items-center justify-center gap-2 border-t border-white/20 active:translate-y-1 transition-all uppercase tracking-wider touch-manipulation">
                            <Send size={20}/> CHỐT
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}