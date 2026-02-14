import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, update } from 'firebase/database';
import { Shield, Flag, Users, Clock, Swords, Flame, Target, Zap, Trophy, Home, RotateCcw, CheckCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

// Màu sắc quân đoàn
const TEAM_COLORS = [
    { bg: 'bg-orange-700', border: 'border-orange-500', shadow: 'shadow-orange-600/50', text: 'text-orange-100' },
    { bg: 'bg-blue-700', border: 'border-blue-500', shadow: 'shadow-blue-600/50', text: 'text-blue-100' },
    { bg: 'bg-red-700', border: 'border-red-500', shadow: 'shadow-red-600/50', text: 'text-red-100' },
    { bg: 'bg-emerald-700', border: 'border-emerald-500', shadow: 'shadow-emerald-600/50', text: 'text-emerald-100' },
    { bg: 'bg-purple-700', border: 'border-purple-500', shadow: 'shadow-purple-600/50', text: 'text-purple-100' },
    { bg: 'bg-yellow-600', border: 'border-yellow-500', shadow: 'shadow-yellow-600/50', text: 'text-yellow-100' }
];

export default function BietDoiArenaHost() {
  const router = useRouter();
  const { id } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [pin, setPin] = useState('');
  const [teams, setTeams] = useState([]);
  const [gameState, setGameState] = useState('LOBBY'); 
  const [initialTime, setInitialTime] = useState(15); 
  const [timeLeft, setTimeLeft] = useState(900); 

  // 1. KHỞI TẠO PHÒNG
  useEffect(() => {
    if (!id) return;
    getDoc(doc(firestore, "quizzes", id)).then((snap) => {
        if (snap.exists()) setQuiz(snap.data());
    });
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(generatedPin);
    
    // Khởi tạo phòng với globalSolved rỗng
    set(ref(db, `rooms/${generatedPin}`), { 
        status: 'LOBBY', 
        type: 'RACE', 
        createdAt: Date.now(),
        globalSolved: {} // Reset trạng thái khóa câu hỏi toàn cục
    });

    return onValue(ref(db, `rooms/${generatedPin}/teams`), (snap) => {
        if (snap.exists()) {
            setTeams(Object.values(snap.val()).map((t, i) => ({
                ...t, color: TEAM_COLORS[i % TEAM_COLORS.length]
            })));
        } else {
            setTeams([]);
        }
    });
  }, [id]);

  // 2. KẾT THÚC GAME
  const finishGame = () => {
    if (gameState === 'FINISHED') return; 
    setGameState('FINISHED');
    update(ref(db, `rooms/${pin}`), { status: 'FINISHED' });
    
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  // 3. LOGIC TỰ ĐỘNG KẾT THÚC
  useEffect(() => {
      if (gameState !== 'RACING') return;

      const finishedCount = teams.filter(t => t.isFinished).length;
      const totalTeams = teams.length;

      if (totalTeams > 0) {
          if ((totalTeams === 1 && finishedCount === 1) || (totalTeams >= 2 && finishedCount >= 2)) {
              finishGame();
          }
      }
  }, [teams, gameState]);

  // 4. ĐỒNG HỒ ĐẾM NGƯỢC
  useEffect(() => {
    if (gameState !== 'RACING') return;
    const interval = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                finishGame(); 
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState, pin]);

  // 5. BẮT ĐẦU
  const startGame = () => {
    if (teams.length === 0) return alert("Chưa có quân đoàn nào tham chiến!");
    const durationInSeconds = initialTime * 60;
    setTimeLeft(durationInSeconds);
    setGameState('RACING');
    
    update(ref(db, `rooms/${pin}`), { 
        status: 'RACING', 
        quizData: quiz.questions, 
        startTime: Date.now(),
        duration: durationInSeconds,
        globalSolved: {} 
    });
  };

  if (!quiz) return <div className="h-screen bg-slate-950 flex items-center justify-center text-orange-500 font-black animate-pulse">ĐANG KẾT NỐI...</div>;

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans selection:bg-orange-500/30">
      
      {/* HEADER TỐI ƯU MOBILE */}
      <header className="min-h-[80px] md:h-[12vh] bg-slate-900/80 backdrop-blur-md border-b-2 border-orange-600/50 px-4 pt-4 pb-2 md:pt-0 md:pb-0 md:px-8 flex justify-between items-center shadow-[0_0_30px_rgba(234,88,12,0.3)] z-20 relative shrink-0">
        <div className="flex items-center gap-2 md:gap-4 relative z-10">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2 md:p-3 rounded-xl md:rounded-2xl shadow-lg border border-orange-400/50 relative hidden sm:block">
             <Shield size={24} className="text-white md:w-8 md:h-8" fill="currentColor" />
             <Flame size={16} className="text-yellow-300 absolute bottom-1 right-1 animate-bounce md:w-5 md:h-5" fill="currentColor"/>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-black italic tracking-tighter uppercase leading-tight md:leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-orange-200 to-orange-500">
              BIỆT ĐỘI ARENA
            </h1>
            <p className="text-orange-500/70 text-[8px] md:text-xs font-bold tracking-[0.1em] md:tracking-[0.3em] uppercase">Chiến trường rực lửa</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-6 relative z-10">
            {gameState !== 'FINISHED' && (
                <div className="flex flex-col items-end">
                    <span className="text-slate-400 text-[9px] md:text-[10px] font-bold uppercase tracking-widest">Mã phòng</span>
                    <span className="text-3xl md:text-5xl font-black text-yellow-400 font-mono tracking-widest drop-shadow-[0_0_15px_rgba(250,204,21,0.6)] leading-none mt-1">{pin}</span>
                </div>
            )}
             {gameState === 'RACING' && (
                <div className="bg-slate-800/80 border-2 border-orange-500/50 p-1.5 md:p-3 rounded-lg md:rounded-xl flex items-center gap-1 md:gap-2 shadow-[inset_0_0_20px_rgba(234,88,12,0.2)]">
                    <Clock className="text-orange-500 animate-spin-slow w-4 h-4 md:w-6 md:h-6" />
                    <span className="text-xl md:text-2xl font-mono font-bold text-white">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
                </div>
            )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-6 relative z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden flex flex-col">
        
        {/* LOBBY */}
        {gameState === 'LOBBY' && (
          <div className="h-full flex flex-col items-center justify-center relative animate-in fade-in overflow-y-auto custom-scrollbar">
             <div className="text-center mb-6 md:mb-8 relative z-10 mt-6 md:mt-0">
                 <Target className="w-16 h-16 md:w-20 md:h-20 text-orange-600/30 absolute -top-8 md:-top-10 left-1/2 -translate-x-1/2 animate-pulse"/>
                 <h2 className="text-3xl md:text-5xl font-black mb-2 md:mb-4 italic uppercase tracking-tighter text-white drop-shadow-lg mt-2">Trung tâm chỉ huy</h2>
                 <p className="text-sm md:text-xl text-orange-400 font-bold flex items-center gap-2 justify-center">
                    <Users className="animate-bounce w-4 h-4 md:w-6 md:h-6"/> Đã tập kết: {teams.length} Quân đoàn
                 </p>
             </div>
             
             <div className="relative z-10 mb-8 md:mb-10 bg-slate-900/80 p-3 md:p-4 rounded-2xl border-2 border-orange-600/30 shadow-xl flex items-center gap-3 md:gap-4">
                 <div className="bg-orange-600/20 p-2 rounded-lg"><Clock className="text-orange-500 w-5 h-5 md:w-6 md:h-6" /></div>
                 <div className="flex flex-col">
                    <label className="text-[9px] md:text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Thời gian (Phút)</label>
                    <input type="number" value={initialTime} onChange={(e) => setInitialTime(Number(e.target.value))} className="bg-transparent text-2xl md:text-3xl font-black text-white outline-none w-20 md:w-full border-b-2 border-slate-700 focus:border-orange-500 font-mono text-center md:text-left" min="1" max="180"/>
                 </div>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 w-full max-w-5xl mb-8 md:mb-14 relative z-10 max-h-[40vh] overflow-y-auto custom-scrollbar p-2">
                {teams.map((t, i) => (
                    <div key={i} className={`${t.color.bg} ${t.color.border} border-b-4 p-3 md:p-5 rounded-xl md:rounded-2xl font-black text-center text-sm md:text-xl shadow-xl flex items-center justify-center gap-2 md:gap-3 ${t.color.text} animate-in zoom-in`}>
                        <Swords size={18} className="md:w-5 md:h-5 shrink-0"/> <span className="truncate">{t.name}</span>
                    </div>
                ))}
             </div>
             
             <button onClick={startGame} className="group relative bg-gradient-to-r from-orange-600 to-red-600 px-10 py-4 md:px-20 md:py-6 rounded-full font-black text-xl md:text-3xl shadow-[0_0_40px_rgba(234,88,12,0.6)] hover:scale-105 transition-all uppercase italic tracking-wider z-10 mb-8 md:mb-0">
                 <span className="relative flex items-center gap-2 md:gap-3"><Zap fill="currentColor" className="w-5 h-5 md:w-8 md:h-8"/> XUẤT KÍCH</span>
             </button>
          </div>
        )}

        {/* RACING VIEW */}
        {gameState === 'RACING' && (
          <div className="h-full flex flex-col gap-4 md:gap-6 relative z-10">
              <div className="flex-1 bg-slate-900/60 backdrop-blur-md rounded-[2rem] md:rounded-[3rem] p-4 md:p-10 border-2 border-orange-600/20 relative overflow-hidden shadow-inner flex flex-col justify-center">
                  
                  {/* Đường đích */}
                  <div className="absolute right-4 md:right-16 top-0 bottom-0 w-2 md:w-3 bg-gradient-to-b from-orange-500/10 via-orange-500/80 to-orange-500/10 blur-sm z-0 flex items-center justify-center border-x border-orange-400/50 animate-pulse"></div>
                  
                  <div className="space-y-4 md:space-y-6 relative z-10 w-full overflow-y-auto max-h-full pr-2 md:pr-4 custom-scrollbar">
                      {sortedTeams.map((team, idx) => {
                          const progress = Math.min(90, ((team.currentQ || 0) / (quiz.questions.length || 10)) * 90);
                          const isNearEnd = progress > 50;

                          return (
                              <div key={team.id} className="relative h-14 md:h-16 flex items-center w-full group mt-4 md:mt-0">
                                  <div className="absolute inset-0 bg-slate-800/50 rounded-xl md:rounded-2xl border border-white/5 overflow-hidden w-full"></div>
                                  <div className={`absolute inset-y-0 left-0 ${team.color.bg} opacity-40 rounded-l-xl md:rounded-l-2xl transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }}></div>
                                  
                                  {/* Container Di Chuyển */}
                                  <div 
                                      className={`absolute transition-all duration-1000 ease-out flex items-center gap-2 md:gap-4 z-20 ${isNearEnd ? '-translate-x-full flex-row-reverse' : ''}`} 
                                      style={{ left: `${progress}%` }}
                                  >
                                      {/* Avatar */}
                                      <div className={`${team.color.bg} ${team.color.border} border-2 p-1.5 md:p-2 rounded-lg md:rounded-xl shadow-lg relative ${team.color.shadow} group-hover:scale-110 transition-transform shrink-0`}>
                                          {idx === 0 && <Flame className="absolute -top-4 -left-2 md:-top-6 md:-left-2 text-orange-500 animate-bounce w-5 h-5 md:w-6 md:h-6" fill="currentColor" />}
                                          {team.isFinished && <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-green-500 text-white rounded-full p-0.5 md:p-1 border border-slate-900 z-10 animate-bounce"><Flag className="w-3 h-3 md:w-3.5 md:h-3.5" fill="currentColor"/></div>}
                                          <Users className={`${team.color.text} w-5 h-5 md:w-6 md:h-6`} />
                                      </div>

                                      {/* Bảng điểm */}
                                      <div className="bg-slate-900/90 border-2 border-slate-700 px-2 py-1 md:px-3 md:py-1 rounded-lg md:rounded-xl shadow-xl backdrop-blur-sm whitespace-nowrap flex flex-col">
                                          <div className="flex items-center gap-1 md:gap-2">
                                              <p className={`font-black text-[9px] md:text-xs uppercase ${team.color.text.replace('100','400')} truncate max-w-[80px] md:max-w-[150px]`}>{team.name}</p>
                                              {team.isFinished && <span className="text-[8px] md:text-[10px] bg-green-600 text-white px-1 md:px-1.5 rounded font-bold">DONE</span>}
                                          </div>
                                          <div className="flex gap-1 md:gap-2 text-[10px] md:text-xs">
                                              <span className="text-white font-bold">{team.currentQ}/{quiz.questions.length}</span>
                                              <span className="text-yellow-400 font-black italic border-l border-white/20 pl-1 md:pl-2">{team.score}đ</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
              
              <div className="flex justify-end">
                <button onClick={finishGame} className="bg-red-600/20 hover:bg-red-600 border border-red-500 text-red-100 px-4 py-2 md:px-6 md:py-2 rounded-xl font-bold uppercase text-[10px] md:text-xs backdrop-blur-md transition-colors">Kết thúc sớm</button>
              </div>
          </div>
        )}

        {/* FINISHED VIEW */}
        {gameState === 'FINISHED' && (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-500 relative overflow-y-auto custom-scrollbar pb-6">
                <Trophy className="w-16 h-16 md:w-24 md:h-24 text-yellow-400 mb-2 md:mb-4 animate-bounce drop-shadow-[0_0_50px_rgba(250,204,21,0.8)]" />
                <h2 className="text-3xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-orange-500 italic uppercase mb-6 md:mb-8 drop-shadow-lg text-center leading-tight">
                    TỔNG KẾT CHIẾN DỊCH
                </h2>

                <div className="flex items-end justify-center gap-2 md:gap-4 mb-8 md:mb-10 w-full max-w-4xl h-[30vh] md:h-[40vh]">
                    {sortedTeams[1] && (
                        <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom duration-700 delay-100">
                             <div className="text-slate-400 font-black text-sm md:text-2xl mb-1 md:mb-2">🥈 Hạng 2</div>
                             <div className="w-full bg-slate-700 h-[18vh] md:h-[25vh] rounded-t-xl md:rounded-t-3xl border-t-2 md:border-t-4 border-slate-500 flex flex-col items-center justify-start p-2 md:p-4 shadow-2xl relative">
                                 <div className="text-sm md:text-3xl font-black text-white uppercase mb-1 text-center truncate w-full">{sortedTeams[1].name}</div>
                                 <div className="text-xs md:text-2xl font-bold text-slate-300">{sortedTeams[1].score}đ</div>
                             </div>
                        </div>
                    )}
                    {sortedTeams[0] && (
                        <div className="flex flex-col items-center w-1/3 z-10 animate-in slide-in-from-bottom duration-700">
                             <Flame className="text-orange-500 mb-1 md:mb-2 animate-pulse w-8 h-8 md:w-10 md:h-10" fill="currentColor"/>
                             <div className="text-yellow-400 font-black text-lg md:text-4xl mb-1 md:mb-2 drop-shadow-lg text-center">🥇 QUÁN QUÂN</div>
                             <div className="w-full bg-gradient-to-b from-yellow-500 to-orange-600 h-[25vh] md:h-[35vh] rounded-t-xl md:rounded-t-3xl border-t-2 md:border-t-4 border-yellow-300 flex flex-col items-center justify-start p-3 md:p-6 shadow-[0_0_50px_rgba(234,88,12,0.5)] relative">
                                 <div className="text-lg md:text-4xl font-black text-white uppercase mb-1 md:mb-2 text-center drop-shadow-md truncate w-full">{sortedTeams[0].name}</div>
                                 <div className="text-xl md:text-5xl font-black text-yellow-100">{sortedTeams[0].score}đ</div>
                             </div>
                        </div>
                    )}
                    {sortedTeams[2] && (
                        <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom duration-700 delay-200">
                             <div className="text-orange-700 font-black text-sm md:text-2xl mb-1 md:mb-2">🥉 Hạng 3</div>
                             <div className="w-full bg-orange-900 h-[12vh] md:h-[20vh] rounded-t-xl md:rounded-t-3xl border-t-2 md:border-t-4 border-orange-700 flex flex-col items-center justify-start p-2 md:p-4 shadow-2xl relative">
                                 <div className="text-xs md:text-2xl font-black text-white uppercase mb-1 text-center truncate w-full">{sortedTeams[2].name}</div>
                                 <div className="text-[10px] md:text-xl font-bold text-orange-200">{sortedTeams[2].score}đ</div>
                             </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 z-50 w-full sm:w-auto px-4">
                     <button onClick={() => router.push('/dashboard')} className="w-full sm:w-auto bg-slate-800 text-white border-2 border-slate-600 px-6 py-3 md:px-8 md:py-3 rounded-full font-black text-sm md:text-lg hover:bg-slate-700 transition flex justify-center items-center gap-2 uppercase">
                        <Home size={18} className="md:w-5 md:h-5"/> Về Trung Tâm
                     </button>
                     <button onClick={() => router.reload()} className="w-full sm:w-auto bg-orange-600 text-white px-6 py-3 md:px-8 md:py-3 rounded-full font-black text-sm md:text-lg hover:bg-orange-500 transition shadow-lg flex justify-center items-center gap-2 uppercase">
                        <RotateCcw size={18} className="md:w-5 md:h-5"/> Tái Đấu
                     </button>
                </div>
            </div>
        )}
      </main>

      {/* CSS Ẩn thanh cuộn nhưng vẫn vuốt được */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        @media (min-width: 768px) { .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; } }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}