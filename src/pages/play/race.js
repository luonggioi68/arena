import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { ref, get, set, onValue, update, push, onDisconnect, remove } from 'firebase/database';
import { Trophy, ShieldAlert, CheckCircle, X, Flame, Zap, Shield, Flag, Lock, Target, Swords, ArrowLeft, Send, Clock, Check, LogOut, Sparkles, Gem, Loader2, Volume2, VolumeX, Ban } from 'lucide-react';
import confetti from 'canvas-confetti';
import MathRender from '@/components/MathRender'; 

export default function BietDoiArenaPlayer() {
  const router = useRouter();
  const { pin: queryPin } = router.query;
  const [pin, setPin] = useState(queryPin || '');
  const [teamName, setTeamName] = useState('');
  const [joined, setJoined] = useState(false);
  const [teamId, setTeamId] = useState(null);
  
  const [roomData, setRoomData] = useState(null);
  const [forceEnd, setForceEnd] = useState(false); // State kích hoạt màn hình kết thúc

  // State Gameplay
  const [currentIdx, setCurrentIdx] = useState(null);
  const [multiplier, setMultiplier] = useState(1); 
  const [freezeTime, setFreezeTime] = useState(0);
  const [localTimeLeft, setLocalTimeLeft] = useState(0); 
  
  // State trả lời & Âm thanh
  const [tfSelection, setTfSelection] = useState({});
  const [saInput, setSaInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const bgmRef = useRef(null);

  // --- HỆ THỐNG ÂM THANH ---
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
      audio.play().catch(e => console.log("SFX Error:", e));
  };

  const toggleMute = () => {
      if (bgmRef.current) {
          if (isMuted) bgmRef.current.play().catch(() => {});
          else bgmRef.current.pause();
      }
      setIsMuted(!isMuted);
  };

  // --- HÀM RENDER VĂN BẢN KÈM ẢNH INLINE ---
  const renderWithInlineImage = (text, imgUrl) => {
    if (!text) return null;
    if (text.includes('[img]') && imgUrl) {
        const parts = text.split('[img]');
        return (
            <span>
                {parts.map((part, index) => (
                    <span key={index}>
                        <MathRender content={part} />
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
    return <MathRender content={text} />;
  };

  // --- LOGIC GIA NHẬP ---
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!pin || !teamName) return;
    const snap = await get(ref(db, `rooms/${pin}`));
    if (!snap.exists()) return alert("Mật mã chiến dịch sai!");
    
    const data = snap.val();
    if (data.status === 'FINISHED') return alert("Chiến dịch đã kết thúc!");

    const teamsRef = ref(db, `rooms/${pin}/teams`);
    const newTeamRef = push(teamsRef);
    const newId = newTeamRef.key;

    onDisconnect(newTeamRef).remove();

    await set(newTeamRef, { 
        id: newId, 
        name: teamName, 
        score: 0, 
        currentQ: 0, 
        solved: {}, 
        isFinished: false 
    });
    
    setTeamId(newId); 
    setJoined(true);

    if (!isMuted && bgmRef.current) {
        bgmRef.current.play().catch(e => console.log("Autoplay prevented:", e));
    }
  };

  const handleLeave = async () => {
      if (pin && teamId) {
          try { await remove(ref(db, `rooms/${pin}/teams/${teamId}`)); } catch (e) {}
      }
      if (bgmRef.current) bgmRef.current.pause();
      router.push('/');
  };

  // --- LOGIC GAMEPLAY & ĐỒNG BỘ ---
  useEffect(() => {
    if (!joined || !pin) return;
    const roomRef = ref(db, `rooms/${pin}`);
    
    return onValue(roomRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setRoomData(data);

        // 1. Kiểm tra Global Lock khi đang làm bài
        if (currentIdx !== null) {
             const globalSolved = data.globalSolved || {};
             if (globalSolved[currentIdx] && globalSolved[currentIdx] !== teamId) {
                 alert("⚠️ Chậm chân rồi! Câu hỏi đã bị đội khác chiếm lĩnh!");
                 setCurrentIdx(null);
             }
        }

        // 2. Logic kiểm tra "Hết nước đi" (No Moves Left)
        if (teamId && data.teams && data.teams[teamId] && data.quizData) {
            const myTeam = data.teams[teamId];
            const globalSolved = data.globalSolved || {};
            const mySolved = myTeam.solved || {};
            const totalQuestions = data.quizData.length;

            let hasAvailableMove = false;
            for (let i = 0; i < totalQuestions; i++) {
                // Một câu hỏi còn "khả dụng" nếu:
                // Chưa bị khóa Global bởi người khác VÀ Mình chưa trả lời (đúng hoặc sai)
                const isGloballyLocked = globalSolved[i] && globalSolved[i] !== teamId;
                const isLocallyLocked = mySolved[i]; // 'correct' or 'wrong'
                
                if (!isGloballyLocked && !isLocallyLocked) {
                    hasAvailableMove = true;
                    break;
                }
            }

            // Nếu không còn nước đi nào và chưa đánh dấu finished -> Cập nhật lên DB
            if (!hasAvailableMove && !myTeam.isFinished) {
                update(ref(db, `rooms/${pin}/teams/${teamId}`), { 
                    isFinished: true,
                    finishedAt: Date.now()
                });
            }
        }

        // 3. Logic Kết thúc Game (2 người trở lên hết câu hỏi)
        if (data.teams) {
            const teamsArr = Object.values(data.teams);
            const finishedCount = teamsArr.filter(t => t.isFinished).length;
            const totalPlayers = teamsArr.length;
            
            // Điều kiện kết thúc: Phòng đóng HOẶC (Có >= 2 người xong) HOẶC (Chơi 1 mình và đã xong)
            if (data.status === 'FINISHED' || (totalPlayers > 1 && finishedCount >= 2) || (totalPlayers === 1 && finishedCount === 1)) {
                setForceEnd(true);
                setCurrentIdx(null);
                if (bgmRef.current) bgmRef.current.pause();
            }
        }

        if (data.teams && teamId && !data.teams[teamId]) {
            alert("Bạn đã rời khỏi chiến dịch!");
            router.push('/');
        }
      } else {
          alert("Chiến dịch hủy!");
          router.push('/');
      }
    });
  }, [joined, pin, teamId, currentIdx]);

  useEffect(() => {
      const isPlaying = roomData?.status === 'RACING' || roomData?.status === 'PLAYING';
      
      if (isPlaying && roomData?.startTime && roomData?.duration) {
          const durationMs = roomData.duration * 1000;
          const endTime = roomData.startTime + durationMs;

          const interval = setInterval(() => {
              const now = Date.now();
              const diffSeconds = Math.floor((endTime - now) / 1000);
              
              if (diffSeconds <= 0) {
                  setLocalTimeLeft(0);
                  setCurrentIdx(null);
                  clearInterval(interval);
              } else {
                  setLocalTimeLeft(diffSeconds);
              }
          }, 500);
          
          return () => clearInterval(interval);
      }
  }, [roomData?.status, roomData?.startTime, roomData?.duration]);

  useEffect(() => {
    if (freezeTime > 0) {
      const t = setInterval(() => setFreezeTime(f => f - 1), 1000);
      return () => clearInterval(t);
    }
  }, [freezeTime]);

  useEffect(() => {
      setTfSelection({});
      setSaInput("");
      setMultiplier(1); 
  }, [currentIdx]);

  const toggleMultiplier = (val) => {
      if (multiplier === val) setMultiplier(1); 
      else setMultiplier(val);
  };

  // --- XỬ LÝ NỘP BÀI ---
  const handleSubmitAnswer = (payload) => {
    if (!roomData?.quizData || currentIdx === null) return;
    
    // Check lần cuối xem có ai giải ĐÚNG chưa
    if (roomData.globalSolved && roomData.globalSolved[currentIdx]) {
        alert("Câu này vừa bị đội khác trả lời xong!");
        setCurrentIdx(null);
        return;
    }

    const q = roomData.quizData[currentIdx];
    let basePoints = 0; 

    // Logic chấm điểm
    if (q.type === 'MCQ') {
        if (payload === q.correct) basePoints = 100;
    }
    else if (q.type === 'SA') {
        if (String(saInput).trim().toLowerCase() === String(q.correct).trim().toLowerCase()) basePoints = 100;
    }
    else if (q.type === 'TF') {
        let matches = 0;
        q.items.forEach((item, idx) => { if (String(tfSelection[idx]) === String(item.isTrue)) matches++; });
        if (matches === 4) basePoints = 100;
        else if (matches === 3) basePoints = 50;
        else if (matches === 2) basePoints = 25;
        else if (matches === 1) basePoints = 10;
    }

    let finalDelta = 0;
    const team = roomData.teams[teamId];
    const updates = {};
    const totalQuestions = roomData.quizData.length;

    if (basePoints > 0) {
        // --- TRƯỜNG HỢP: TRẢ LỜI ĐÚNG ---
        finalDelta = basePoints * multiplier; 
        playSFX('correct'); 
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.7 }, colors: ['#d946ef', '#22d3ee', '#facc15', '#f43f5e'], scalar: 1.2 });

        updates[`teams/${teamId}/score`] = (team.score || 0) + finalDelta;
        
        let solvedCount = 0;
        if(team.solved) {
            solvedCount = Object.keys(team.solved).length;
        }
        updates[`teams/${teamId}/currentQ`] = solvedCount + 1;
        
        // Đánh dấu CÁ NHÂN: "correct"
        updates[`teams/${teamId}/solved/${currentIdx}`] = "correct";

        // [QUAN TRỌNG] Đánh dấu TOÀN CỤC: Khóa câu hỏi với tất cả mọi người
        updates[`globalSolved/${currentIdx}`] = teamId;

    } else {
        // --- TRƯỜNG HỢP: TRẢ LỜI SAI ---
        playSFX('wrong'); 
        
        // Đánh dấu CÁ NHÂN: "wrong" -> Để khóa bản thân không được trả lời lại
        updates[`teams/${teamId}/solved/${currentIdx}`] = "wrong";

        // Tăng số câu đã tương tác
        let solvedCount = 0;
        if(team.solved) {
            solvedCount = Object.keys(team.solved).length;
        }
        updates[`teams/${teamId}/currentQ`] = solvedCount + 1;
    }

    update(ref(db, `rooms/${pin}`), updates);
    
    // Đóng cửa sổ ngay lập tức để tìm câu khác
    setCurrentIdx(null);
  };

  const globalStyles = `
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  `;

  if (!joined) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-purple-500 selection:text-white">
      {/* (Phần Login giữ nguyên) */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#222_1px,transparent_1px),linear-gradient(to_bottom,#222_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20"></div>
      <div className="bg-[#0a0a0a]/90 backdrop-blur-xl p-8 rounded-3xl border border-purple-500/50 shadow-[0_0_60px_rgba(168,85,247,0.3)] w-full max-w-md text-center relative z-10 animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-cyan-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.5)] rotate-3 hover:rotate-0 transition-all duration-500"><Shield size={48} className="text-white drop-shadow-md" strokeWidth={2.5}/></div>
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 italic uppercase tracking-tighter mb-2 animate-pulse">Biệt Đội Arena</h1>
        <form onSubmit={handleJoin} className="space-y-4">
          <input value={pin} onChange={e=>setPin(e.target.value)} className="w-full bg-[#111] p-4 rounded-xl text-center font-black text-3xl text-cyan-400 outline-none border-2 border-slate-800 focus:border-cyan-500 transition-all font-mono tracking-widest placeholder:text-slate-800" placeholder="000000"/>
          <input value={teamName} onChange={e=>setTeamName(e.target.value)} className="w-full bg-[#111] p-4 rounded-xl text-center font-bold text-xl text-white outline-none border-2 border-slate-800 focus:border-purple-500 transition-all uppercase placeholder:text-slate-800" placeholder="TÊN CHIẾN BINH"/>
          <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-black py-5 rounded-xl text-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-95 transition-all uppercase italic flex items-center justify-center gap-2 border border-white/10"><Swords size={24}/> THAM CHIẾN</button>
        </form>
      </div>
    </div>
  );

  if (!roomData || !roomData.teams?.[teamId]) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={50}/></div>;

  const questions = roomData.quizData || [];
  const team = roomData.teams[teamId];
  const q = questions[currentIdx];

  // --- UI: LOBBY ---
  if (roomData.status === 'LOBBY') return (
    <div className="h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 text-center bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className="animate-in zoom-in duration-500 relative">
          <div className="absolute inset-0 bg-purple-500 blur-[80px] opacity-20"></div>
          <Target size={120} className="text-cyan-400 mb-8 mx-auto animate-spin-slow drop-shadow-[0_0_40px_#22d3ee] relative z-10"/>
          <h2 className="text-3xl md:text-5xl font-black italic uppercase mb-4 tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">Căn cứ tập kết</h2>
          <div className="bg-purple-900/20 border border-purple-500/50 px-8 py-3 rounded-full inline-block mb-10 backdrop-blur-md">
             <p className="text-purple-400 font-bold uppercase text-xs md:text-sm tracking-[0.2em] animate-pulse">Chờ lệnh tổng tiến công...</p>
          </div>
          <div className="bg-[#111] px-12 py-6 rounded-2xl border border-white/10 shadow-2xl relative z-10"><span className="text-slate-500 text-xs font-bold uppercase block mb-2 tracking-widest">Định danh</span><span className="text-3xl md:text-4xl font-black text-white uppercase drop-shadow-md">{team.name}</span></div>
          <button onClick={handleLeave} className="mt-12 text-slate-500 hover:text-red-500 font-bold uppercase text-xs border border-slate-800 hover:border-red-900/50 hover:bg-red-900/10 px-6 py-3 rounded-xl transition flex items-center gap-2 mx-auto"><LogOut size={16}/> Rút lui</button>
      </div>
    </div>
  );

  // --- UI: FINISHED ---
  if (forceEnd || roomData.status === 'FINISHED') {
      const allTeams = Object.values(roomData.teams || {});
      const sortedTeams = allTeams.sort((a,b) => b.score - a.score);
      const myRank = sortedTeams.findIndex(t => t.id === teamId) + 1;
      const isRoomFinished = roomData.status === 'FINISHED';
      
      return (
        <div className="h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center animate-in zoom-in relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black pointer-events-none"></div>
          <Trophy size={140} className="text-yellow-400 mb-6 animate-bounce drop-shadow-[0_0_50px_#facc15] relative z-10"/>
          <h1 className="text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-600 mb-4 relative z-10">
              {isRoomFinished ? "TỔNG KẾT" : "HOÀN THÀNH!"}
          </h1>
          {!isRoomFinished && (<p className="text-cyan-400 font-bold uppercase tracking-widest mb-6 animate-pulse relative z-10">Bạn đã hoàn thành tất cả nhiệm vụ!</p>)}
          <div className="bg-[#111]/80 backdrop-blur-md p-8 rounded-[3rem] shadow-2xl border-2 border-purple-500/30 w-full max-w-sm relative z-10">
            <div className="mb-6"><p className="text-slate-500 font-bold text-xs uppercase tracking-[0.3em] mb-2">Hạng hiện tại</p><div className="text-7xl font-black text-white italic drop-shadow-lg">#{myRank}</div></div>
            <div className="w-full h-px bg-white/10 rounded-full mb-6"></div>
            <div><p className="text-slate-500 font-bold text-xs uppercase tracking-[0.3em] mb-2">Điểm số</p><p className="text-5xl font-black text-cyan-400 font-mono text-shadow-glow">{team.score}</p></div>
          </div>
          <button onClick={() => router.push('/')} className="mt-10 text-slate-500 hover:text-white font-bold uppercase tracking-widest text-sm relative z-10 transition border-b border-transparent hover:border-white">Về trang chủ</button>
        </div>
      );
  }

  // --- UI: GAME BOARD ---
  return (
    <div className="h-screen bg-[#050505] flex flex-col overflow-hidden text-white font-sans selection:bg-purple-500/50">
      <style>{globalStyles}</style>
      
      {/* HEADER */}
      <header className="h-[70px] md:h-[80px] bg-[#0a0a0a]/90 backdrop-blur-md border-b border-purple-900/30 px-3 md:px-6 flex justify-between items-center shadow-[0_5px_20px_rgba(0,0,0,0.8)] shrink-0 z-20">
        <div className="flex items-center gap-2 md:gap-4">
          <button onClick={handleLeave} className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition"><ArrowLeft size={20}/></button>
          <button onClick={toggleMute} className={`p-2 rounded-xl transition ${isMuted ? 'bg-red-900/20 text-red-500' : 'bg-white/5 text-cyan-400 hover:text-white'}`}>{isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>
        </div>
        <div className="flex flex-col items-center justify-center absolute left-1/2 -translate-x-1/2 pointer-events-none">
            <h1 className="text-lg md:text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 drop-shadow-[0_0_15px_rgba(168,85,247,0.6)] leading-none">BIỆT ĐỘI ARENA</h1>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">{teamName}</p>
        </div>
        <div className="flex items-center gap-3 md:gap-5">
             <div className="flex flex-col items-end">
                 <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Điểm số</span>
                 <div className="flex items-center gap-1">
                    <Gem size={16} className="text-yellow-400"/>
                    <span className="text-xl md:text-2xl font-black text-yellow-400 leading-none drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">{team.score}</span>
                 </div>
             </div>
             {localTimeLeft > 0 && (
                 <div className={`px-2 md:px-4 py-1 rounded-full font-black font-mono border flex items-center gap-2 shadow-[0_0_10px_inset_rgba(0,0,0,0.5)] ${localTimeLeft < 60 ? 'bg-red-950/50 border-red-500 text-red-500 animate-pulse' : 'bg-slate-900 border-slate-700 text-cyan-400'}`}>
                     <Clock size={16}/> <span className="text-sm md:text-lg">{Math.floor(localTimeLeft / 60)}:{String(localTimeLeft % 60).padStart(2, '0')}</span>
                 </div>
             )}
        </div>
      </header>

      <main className="flex-1 flex flex-col p-2 md:p-6 relative overflow-hidden bg-[radial-gradient(circle_at_bottom,_var(--tw-gradient-stops))] from-purple-900/10 via-[#050505] to-black">
        
        {currentIdx === null ? (
          /* === A. BẢN ĐỒ === */
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in">
            <h2 className="text-cyan-500 font-black text-xl md:text-3xl uppercase tracking-[0.2em] mb-4 md:mb-8 drop-shadow-[0_0_10px_#22d3ee] italic flex items-center gap-3">
                <Flag size={24} className="animate-bounce"/> Bản đồ nhiệm vụ
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 md:gap-4 w-full max-w-4xl px-2 overflow-y-auto max-h-[75vh] custom-scrollbar no-scrollbar">
              {questions.map((_, idx) => {
                // LOGIC HIỂN THỊ MỚI
                const myStatus = team.solved ? team.solved[idx] : null; 
                const isGlobalSolved = roomData.globalSolved && roomData.globalSolved[idx];
                
                // Bị khóa nếu: Đã có người trả lời đúng (bất kể ai) HOẶC mình đã làm sai
                const isLocked = isGlobalSolved || myStatus;
                
                let btnClass = "bg-gradient-to-br from-purple-900/40 to-slate-900 border-purple-500/50 text-white hover:border-cyan-400 hover:shadow-[0_0_20px_#22d3ee] hover:bg-purple-800/50 active:scale-95";
                let Icon = null;
                
                if (myStatus === "correct" || myStatus === true) {
                    btnClass = "bg-green-900/30 border-green-600 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)] cursor-not-allowed";
                    Icon = <CheckCircle size={32} className="mx-auto" />;
                } else if (myStatus === "wrong") {
                    btnClass = "bg-red-900/20 border-red-800 text-red-500 cursor-not-allowed grayscale opacity-70";
                    Icon = <Ban size={32} className="mx-auto" />; 
                } else if (isGlobalSolved) {
                    btnClass = "bg-slate-900/50 border-slate-700 text-slate-600 cursor-not-allowed grayscale";
                    Icon = <Lock size={32} className="mx-auto text-slate-500" />;
                }

                return (
                  <button key={idx} onClick={() => setCurrentIdx(idx)} disabled={isLocked} className={`aspect-square rounded-xl font-black text-2xl md:text-3xl transition-all relative overflow-hidden border backdrop-blur-sm touch-manipulation ${btnClass}`}>
                    {!isLocked && <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity"></div>}
                    {Icon ? Icon : <span className="drop-shadow-md">{idx + 1}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* === B. TRẢ LỜI CÂU HỎI === */
          <div className="flex-1 flex flex-col animate-in slide-in-from-bottom duration-300 h-full max-w-4xl mx-auto w-full overflow-hidden">
            
            <div className="flex items-center justify-between mb-2 shrink-0">
                <button onClick={() => setCurrentIdx(null)} className="py-2 px-3 text-slate-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-1 hover:text-white transition bg-white/5 rounded-lg border border-white/5"><ArrowLeft size={14}/> Quay lại</button>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${multiplier > 1 ? 'text-yellow-400' : 'text-green-400'}`}>{multiplier === 1 ? 'An toàn (+100/0)' : `Rủi ro (x${multiplier})`}</span>
            </div>

            <div className="flex gap-2 mb-2 shrink-0">
              {[2, 3, 5].map(m => (
                <button key={m} onClick={() => toggleMultiplier(m)} className={`flex-1 py-2 rounded-lg font-black text-sm border transition-all active:scale-95 flex items-center justify-center gap-1 ${multiplier === m ? (m === 5 ? 'bg-red-600 border-red-400 text-white' : 'bg-yellow-400 border-yellow-300 text-black') : 'bg-slate-900/80 border-slate-800 text-slate-600'}`}>
                    <span>X{m}</span> {m === 5 && <Flame size={12} className={multiplier === 5 ? 'animate-bounce' : ''} fill="currentColor"/>}
                </button>
              ))}
            </div>

            <div className="bg-[#0f172a]/90 backdrop-blur-xl rounded-xl border border-cyan-500/30 flex-1 flex flex-col shadow-[0_0_30px_rgba(34,211,238,0.1)] overflow-hidden relative">
              <div className="flex-1 overflow-y-auto no-scrollbar p-3">
                  <div className="text-center mb-4">
                      <h2 className={`text-xl md:text-3xl font-bold text-white leading-snug mb-3 ${q?.q.length > 100 ? 'text-lg md:text-2xl' : ''}`}>
                          {renderWithInlineImage(q?.q, q?.img)}
                      </h2>
                      
                      {q?.img && !q?.q.includes('[img]') && (
                          <div className="w-full flex justify-center mb-3">
                              <img 
                                  src={q.img} 
                                  className="max-h-40 md:max-h-60 max-w-full rounded border border-slate-800 bg-black object-contain" 
                              />
                          </div>
                      )}
                  </div>

                  <div className="w-full">
                    {q.type === 'MCQ' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q?.a.map((ans, i) => (
                              <button key={i} onClick={() => handleSubmitAnswer(i)} className="bg-slate-800/50 hover:bg-purple-900/40 text-slate-300 hover:text-white p-4 rounded-lg font-bold text-lg md:text-xl border border-slate-700 hover:border-purple-500 active:scale-[0.98] transition-all flex flex-col gap-2 shadow-sm group touch-manipulation text-left">
                                <div className="flex items-start gap-3 w-full">
                                    <span className="w-8 h-8 rounded bg-black/50 flex items-center justify-center text-sm font-black text-slate-500 group-hover:text-purple-400 border border-slate-700 shrink-0">{String.fromCharCode(65+i)}</span>
                                    <div className="leading-tight line-clamp-3 flex-1">
                                        {renderWithInlineImage(ans, q?.aImages?.[i])}
                                    </div>
                                </div>
                                {q?.aImages?.[i] && !ans.includes('[img]') && (
                                    <img src={q.aImages[i]} className="max-h-32 max-w-full rounded border border-slate-600 self-start mt-2" />
                                )}
                              </button>
                            ))}
                        </div>
                    )}

                    {q.type === 'TF' && (
                        <div className="bg-slate-900/50 rounded-lg border border-white/5 overflow-hidden">
                            <div className="divide-y divide-white/5">
                                {q.items.map((item, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-1 p-3 items-center">
                                        <div className="col-span-8 text-slate-300 font-bold text-base md:text-xl leading-tight pr-1">
                                            {renderWithInlineImage(item.text, item.img)}
                                            {item.img && !item.text.includes('[img]') && (
                                                <img src={item.img} className="max-h-32 max-w-full rounded border border-slate-600 mt-2 block" />
                                            )}
                                        </div>
                                        <div className="col-span-2 flex justify-center"><button onClick={() => setTfSelection(prev => ({...prev, [idx]: "true"}))} className={`w-10 h-10 rounded border transition-all flex items-center justify-center ${tfSelection[idx] === "true" ? 'bg-green-600 border-green-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-600'}`}><Check size={20}/></button></div>
                                        <div className="col-span-2 flex justify-center"><button onClick={() => setTfSelection(prev => ({...prev, [idx]: "false"}))} className={`w-10 h-10 rounded border transition-all flex items-center justify-center ${tfSelection[idx] === "false" ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-600'}`}><X size={20}/></button></div>
                                    </div>
                                ))}
                            </div>
                            <div className="p-3 border-t border-white/5"><button onClick={() => handleSubmitAnswer()} className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white py-3 rounded-lg font-black text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 hover:opacity-90"><Send size={20}/> Gửi bài</button></div>
                        </div>
                    )}

                    {q.type === 'SA' && (
                        <div className="mt-4">
                            <input value={saInput} onChange={(e) => setSaInput(e.target.value)} className="w-full bg-[#050505] border-2 border-slate-700 focus:border-cyan-500 p-4 rounded-lg text-white font-black text-2xl outline-none text-center mb-4 uppercase placeholder:text-slate-700 transition-colors" placeholder="NHẬP ĐÁP ÁN..."/>
                            <button onClick={() => handleSubmitAnswer()} className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white py-3 rounded-lg font-black text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 hover:opacity-90"><Send size={20}/> Gửi bài</button>
                        </div>
                    )}
                 </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {freezeTime > 0 && (
        <div className="fixed inset-0 z-[100] bg-red-950/90 flex flex-col items-center justify-center text-center backdrop-blur-xl animate-in zoom-in px-4">
          <ShieldAlert size={80} className="text-red-500 mb-4 animate-bounce drop-shadow-[0_0_30px_red]" />
          <h2 className="text-4xl font-black text-white mb-2 italic uppercase">BỊ PHẠT!</h2>
          <div className="text-[8rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-black leading-none font-mono">{freezeTime}</div>
          <p className="text-sm text-red-400 mt-2 uppercase tracking-[0.5em] font-bold animate-pulse">Hãy chờ đợi...</p>
        </div>
      )}
    </div>
  );
}