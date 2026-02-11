import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { ref, get, set, onValue, update, runTransaction, onDisconnect, remove } from 'firebase/database';
import { Zap, Shield, Lock, CheckCircle, XCircle, Trophy, User, Home, Ban, Check, X, Send, Star, Clock, Flame, Crown, Volume2, VolumeX, Loader2 } from 'lucide-react';
// Import MathRender
import MathRender from '@/components/MathRender'; 

export default function LightningArenaPlayer() {
  const router = useRouter();
  const { pin: queryPin } = router.query;
  const [pin, setPin] = useState(queryPin || '');
  
  const [name, setName] = useState('');
  const [joined, setJoined] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  
  const [roomData, setRoomData] = useState(null);
  const [questions, setQuestions] = useState([]);
  
  const [activeQ, setActiveQ] = useState(null);
  const [feedback, setFeedback] = useState(null); 
  const [failedQuestions, setFailedQuestions] = useState([]);
  
  const [localScore, setLocalScore] = useState(0); 
  const [timeLeft, setTimeLeft] = useState(0);
  const [isMuted, setIsMuted] = useState(true); 
  const bgmRef = useRef(null); 

  const [serverOffset, setServerOffset] = useState(0);

  const [mcqSelection, setMcqSelection] = useState(null);
  const [tfSelection, setTfSelection] = useState({});
  const [saInput, setSaInput] = useState("");

  // HÀM RENDER VĂN BẢN KÈM ẢNH INLINE
  const renderWithInlineImage = (text, imgUrl) => {
    if (!text) return null;
    
    // Nếu có thẻ [img] và có link ảnh
    if (text.includes('[img]') && imgUrl) {
        const parts = text.split('[img]');
        return (
            <span>
                {parts.map((part, index) => (
                    <span key={index}>
                        <MathRender content={part} />
                        {/* Chèn ảnh vào giữa các đoạn text */}
                        {index < parts.length - 1 && (
                            <img 
                                src={imgUrl} 
                                className="inline-block align-middle mx-1 max-h-12 border rounded bg-white shadow-sm" 
                                alt="minh-hoa"
                            />
                        )}
                    </span>
                ))}
            </span>
        );
    }
    
    // Mặc định trả về Component hiển thị toán
    return <MathRender content={text} />;
  };

  useEffect(() => {
      if (queryPin) setPin(queryPin);
  }, [queryPin]);

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

  useEffect(() => {
      const offsetRef = ref(db, ".info/serverTimeOffset");
      const unsub = onValue(offsetRef, (snap) => {
          setServerOffset(snap.val() || 0);
      });
      return () => unsub();
  }, []);

  const playSFX = (type) => {
      if (isMuted) return;
      const audio = new Audio(type === 'correct' ? '/sounds/correct.mp3' : '/sounds/wrong.mp3');
      audio.volume = 1.0;
      audio.play().catch(() => {});
  };

  const toggleMute = () => {
      if (bgmRef.current) {
          if (isMuted) bgmRef.current.play().catch(() => {});
          else bgmRef.current.pause();
      }
      setIsMuted(!isMuted);
  };

  useEffect(() => {
      if (roomData?.status === 'PLAYING' && roomData.startTime) {
          const duration = (roomData.duration || 300) * 1000; 
          const endTime = roomData.startTime + duration;

          const interval = setInterval(() => {
              const now = Date.now() + serverOffset;
              const diff = Math.floor((endTime - now) / 1000);
              
              setTimeLeft(diff > 0 ? diff : 0);
              if (diff <= 0) clearInterval(interval);
          }, 1000);

          return () => clearInterval(interval);
      }
  }, [roomData?.status, roomData?.startTime, serverOffset]);

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
          }, 2000); 
          return () => clearTimeout(timer);
      }
  }, [feedback]);

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

  if (!joined) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 font-sans bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
      <div className="bg-slate-900/90 border-2 border-orange-500/50 p-8 rounded-[2rem] w-full max-w-md text-center shadow-[0_0_50px_rgba(234,88,12,0.3)] relative overflow-hidden backdrop-blur-md animate-in zoom-in">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-red-500 to-orange-500"></div>
          <div className="relative mb-6">
              <div className="absolute inset-0 bg-orange-500 blur-[60px] opacity-20 animate-pulse"></div>
              <Zap size={70} className="text-yellow-400 mx-auto drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] relative z-10" fill="currentColor"/>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-red-600 drop-shadow-sm">NHANH NHƯ CHỚP</h1>
          <p className="text-orange-200/60 font-bold text-[10px] uppercase tracking-[0.4em] mb-8">Lightning Arena</p>
          <form onSubmit={handleJoin} className="space-y-4 relative z-10">
              {!queryPin && <input value={pin} onChange={e=>setPin(e.target.value)} className="w-full bg-black/60 border-2 border-slate-700 text-yellow-400 text-center text-3xl font-black p-4 rounded-xl outline-none focus:border-orange-500 placeholder-slate-700 tracking-widest font-mono shadow-inner transition-colors" placeholder="000000"/>}
              <input value={name} onChange={e=>setName(e.target.value)} className="w-full bg-black/60 border-2 border-slate-700 text-white text-center text-xl font-bold p-4 rounded-xl outline-none focus:border-orange-500 uppercase placeholder-slate-700 shadow-inner transition-colors" placeholder="TÊN CHIẾN BINH"/>
              <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-black py-4 rounded-xl text-xl uppercase italic shadow-lg hover:shadow-orange-500/40 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2 group">
                  <Flame size={24} className="group-hover:animate-bounce" fill="currentColor"/> VÀO TRẬN
              </button>
          </form>
      </div>
    </div>
  );

  if (!roomData) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-orange-500"><Loader2 className="animate-spin" size={40}/></div>;

  if (roomData.status === 'LOBBY') return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-center p-6 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
          <Shield size={100} className="text-cyan-400 mb-6 drop-shadow-[0_0_20px_rgba(34,211,238,0.5)] animate-bounce-slow"/>
          <h2 className="text-3xl font-black text-white uppercase italic mb-4 tracking-tight">Xin chào <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">{name}</span></h2>
          <div className="text-cyan-100 font-bold text-sm bg-cyan-950/50 px-8 py-4 rounded-full border border-cyan-500/30 animate-pulse flex items-center gap-2">
              <Loader2 className="animate-spin" size={16}/> Đang chờ tín hiệu...
          </div>
          <button onClick={handleLeave} className="mt-12 text-slate-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest border-b border-transparent hover:border-red-500 transition pb-1">Rời khỏi</button>
      </div>
  );

  if (roomData.status === 'FINISHED') {
      return (
          <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-center text-white p-4 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
              <div className="relative mb-6">
                  <div className="absolute inset-0 bg-yellow-500 blur-[60px] opacity-30"></div>
                  <Trophy size={120} className="text-yellow-400 relative z-10 drop-shadow-[0_10px_20px_rgba(250,204,21,0.5)] animate-bounce"/>
              </div>
              <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-200 to-orange-500 italic uppercase mb-2 tracking-tighter drop-shadow-md">TỔNG KẾT</h1>
              <div className="bg-slate-900/80 border border-white/10 p-8 rounded-[2rem] shadow-2xl mt-6 w-full max-w-sm backdrop-blur-md">
                  <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-2">Điểm số đạt được</p>
                  <p className="text-6xl font-black text-white font-mono leading-none">{localScore}</p>
              </div>
              <button onClick={() => router.push('/')} className="mt-10 text-slate-400 hover:text-white border-b border-slate-700 hover:border-white pb-1 font-bold uppercase text-xs tracking-widest transition">Về Trang Chủ</button>
          </div>
      );
  }

  // --- GAME BOARD ---
  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="h-[70px] bg-slate-950 border-b border-orange-900/40 flex justify-between items-center px-4 shrink-0 relative shadow-[0_5px_20px_rgba(0,0,0,0.5)] z-20">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-yellow-500 via-red-600 to-orange-500 shadow-[0_0_10px_#f97316]"></div>
            <div className="flex items-center gap-2 z-10">
                <button onClick={handleLeave} className="bg-slate-900 hover:bg-slate-800 p-2 rounded-lg text-slate-400 hover:text-white border border-slate-800 transition"><Home size={18}/></button>
                <button onClick={toggleMute} className={`p-2 rounded-lg border transition ${isMuted ? 'text-red-500 bg-red-950/30 border-red-900/50' : 'text-cyan-400 bg-cyan-950/30 border-cyan-900/50'}`}>
                    {isMuted ? <VolumeX size={18}/> : <Volume2 size={18}/>}
                </button>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <h1 className="hidden md:flex items-center gap-2 text-2xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-orange-500 to-red-600 drop-shadow-[0_2px_0px_rgba(0,0,0,1)]" style={{textShadow: "0 0 20px rgba(234,88,12,0.4)"}}>
                    <Zap className="text-yellow-400 fill-yellow-400 drop-shadow-md animate-pulse" size={24} />
                    NHANH NHƯ CHỚP
                </h1>
                <div className="md:hidden">
                     <Zap className="text-orange-500 fill-yellow-400 drop-shadow-[0_0_10px_rgba(234,88,12,0.8)]" size={32} />
                </div>
            </div>
            <div className="flex items-center gap-3 z-10">
                <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-full shadow-inner">
                    <User size={14} className="text-slate-400"/>
                    <span className="text-xs font-bold text-slate-200 uppercase truncate max-w-[100px]">{name}</span>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 font-mono font-black text-lg shadow-inner ${timeLeft <= 10 ? 'bg-red-950/80 border-red-500 text-red-500 animate-pulse' : 'bg-slate-900 border-slate-700 text-cyan-400'}`}>
                    <Clock size={16}/><span>{formatTime(timeLeft)}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-0.5">Điểm</span>
                    <div className="text-xl font-black text-yellow-400 leading-none drop-shadow-md flex items-center gap-1">
                        {localScore} <Flame size={12} className="text-orange-500 fill-orange-500" />
                    </div>
                </div>
            </div>
        </header>

        {/* MAIN GAME */}
        <main className="flex-1 p-4 overflow-y-auto bg-[#020617]">
            <div className="max-w-7xl mx-auto pt-4 md:pt-8">
                <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
                    {questions.map((q, idx) => {
                        const qState = roomData.questionsState?.[idx] || {};
                        const isSolved = !!qState.winner;
                        const isMine = qState.winner === playerId;
                        const hasFailed = failedQuestions.includes(idx);

                        let bgClass = 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700 hover:border-cyan-500 hover:text-cyan-400'; 
                        if (isSolved) {
                            if (isMine) bgClass = 'bg-green-600 border-green-400 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)] z-10'; 
                            else bgClass = 'bg-slate-900 border-slate-800 text-slate-700 opacity-50 cursor-not-allowed'; 
                        } else if (hasFailed) {
                            bgClass = 'bg-red-950/50 border-red-900 text-red-700 opacity-60 cursor-not-allowed'; 
                        }

                        return (
                            <button key={idx} disabled={isSolved || hasFailed} onClick={() => handleSelectQuestion(idx)} 
                                className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all active:scale-95 duration-200 ${bgClass}`}>
                                {isSolved ? (
                                    <>{isMine ? <CheckCircle size={28} strokeWidth={3}/> : <Lock size={20}/>}<span className="text-[9px] mt-1 font-black truncate w-full px-1 text-center uppercase tracking-wider">{isMine ? 'YOU' : qState.winnerName}</span></>
                                ) : hasFailed ? (<Ban size={24}/>) : (<span className="text-2xl font-black drop-shadow-md">{idx + 1}</span>)}
                            </button>
                        )
                    })}
                </div>
            </div>
        </main>

     {activeQ && (
            <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-2 animate-in fade-in zoom-in duration-200">
                <div className="bg-slate-900 w-full max-w-xl rounded-2xl border-2 border-slate-600 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[95vh] overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-600"></div>
                    
                    <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-950/50">
                        <span className="text-cyan-400 font-black uppercase text-sm tracking-widest border border-cyan-500/30 px-3 py-1 rounded-full bg-cyan-950/30">Nhiệm vụ #{activeQ.index + 1}</span>
                        <button onClick={() => setActiveQ(null)} className="text-slate-500 hover:text-white bg-white/5 hover:bg-red-600 p-2 rounded-full transition"><X size={18}/></button>
                    </div>
                    
                    {feedback && (
                        <div className={`p-6 text-center text-white font-black text-3xl uppercase italic tracking-tighter absolute inset-0 z-50 flex items-center justify-center flex-col gap-2 bg-slate-900/95 backdrop-blur-sm animate-in zoom-in ${feedback === 'CORRECT' ? 'text-green-400' : 'text-red-500'}`}>
                            {feedback === 'CORRECT' ? <><CheckCircle size={60}/> CHÍNH XÁC!<span className="text-lg font-bold text-white not-italic mt-2">+100 điểm</span></> : feedback === 'LATE' ? <><Clock size={60}/> CHẬM TAY RỒI!</> : <><XCircle size={60}/> SAI RỒI!</>}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-6">
                        {/* HIỂN THỊ CÂU HỎI (ĐÃ SỬA LỖI) */}
                        <div className="text-center mb-6">
                            <h2 className="text-xl md:text-2xl font-bold text-white leading-relaxed">
                                {renderWithInlineImage(activeQ.q, activeQ.img)}
                            </h2>
                            {/* Hiển thị ảnh khối nếu không có thẻ [img] trong text */}
                            {activeQ.img && !activeQ.q.includes('[img]') && (
                                <img src={activeQ.img} className="mx-auto mt-4 max-h-48 w-auto object-contain rounded-xl border-2 border-slate-700 bg-black shadow-lg"/>
                            )}
                        </div>

                        {activeQ.type === 'MCQ' && (
                            <div className="grid gap-3">
                                {activeQ.a.map((ans, i) => (
                                    <button key={i} onClick={() => setMcqSelection(i)} className={`p-4 rounded-xl border-2 text-left font-bold text-lg transition-all active:scale-[0.98] flex gap-3 ${mcqSelection === i ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 hover:border-slate-500'}`}>
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${mcqSelection === i ? 'bg-white text-indigo-700' : 'bg-slate-900 text-slate-500'}`}>{String.fromCharCode(65+i)}</span>
                                        <div className="flex-1">
                                            <span>{renderWithInlineImage(ans, activeQ.aImages?.[i])}</span>
                                            {activeQ.aImages?.[i] && !ans.includes('[img]') && (
                                                <img src={activeQ.aImages[i]} className="h-16 w-auto mt-2 rounded border border-slate-600 bg-white p-0.5" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeQ.type === 'TF' && (
                            <div className="space-y-3">
                                {activeQ.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700">
                                        <div className="flex-1 mr-4">
                                            <span className="text-sm md:text-base font-bold text-slate-200 leading-tight block">
                                                {renderWithInlineImage(item.text, item.img)}
                                            </span>
                                            {item.img && !item.text.includes('[img]') && (
                                                <img src={item.img} className="h-12 mt-2 rounded border border-slate-600" />
                                            )}
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button onClick={() => setTfSelection(p => ({...p, [idx]: "true"}))} className={`w-10 h-10 rounded-lg border-2 font-black transition-all ${tfSelection[idx] === "true" ? 'bg-green-600 border-green-400 text-white shadow-lg' : 'bg-slate-900 border-slate-600 text-slate-600 hover:bg-slate-700'}`}>Đ</button>
                                            <button onClick={() => setTfSelection(p => ({...p, [idx]: "false"}))} className={`w-10 h-10 rounded-lg border-2 font-black transition-all ${tfSelection[idx] === "false" ? 'bg-red-600 border-red-400 text-white shadow-lg' : 'bg-slate-900 border-slate-600 text-slate-600 hover:bg-slate-700'}`}>S</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeQ.type === 'SA' && (
                            <input value={saInput} onChange={(e) => setSaInput(e.target.value)} className="w-full bg-slate-800 border-2 border-slate-600 p-5 rounded-2xl text-white text-center font-black text-2xl uppercase outline-none focus:border-cyan-500 focus:bg-slate-700 placeholder-slate-600 tracking-widest shadow-inner transition-all" placeholder="NHẬP ĐÁP ÁN"/>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-700 bg-slate-950">
                        <button onClick={handleSubmitAnswer} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black py-4 rounded-xl text-xl uppercase tracking-[0.2em] shadow-lg active:scale-[0.98] transition-transform border-t border-white/10 flex items-center justify-center gap-2 group">
                            <Send size={24} className="group-hover:-translate-y-1 transition-transform"/> CHỐT ĐÁP ÁN
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}