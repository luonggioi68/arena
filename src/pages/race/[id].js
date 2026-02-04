import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, update } from 'firebase/database';
import { Shield, Flag, Users, Clock, Swords, Flame, Target, Zap, Trophy, Home, RotateCcw } from 'lucide-react';
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
    
    set(ref(db, `rooms/${generatedPin}`), { 
        status: 'LOBBY', 
        type: 'RACE', 
        createdAt: Date.now() 
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

  // 3. ĐỒNG HỒ ĐẾM NGƯỢC
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

  // 4. BẮT ĐẦU
  const startGame = () => {
    if (teams.length === 0) return alert("Chưa có quân đoàn nào tham chiến!");
    const durationInSeconds = initialTime * 60;
    setTimeLeft(durationInSeconds);
    setGameState('RACING');
    
    update(ref(db, `rooms/${pin}`), { 
        status: 'RACING', 
        quizData: quiz.questions, 
        startTime: Date.now(),
        duration: durationInSeconds 
    });
  };

  if (!quiz) return <div className="h-screen bg-slate-950 flex items-center justify-center text-orange-500 font-black animate-pulse">ĐANG KẾT NỐI...</div>;

  const sortedTeams = [...teams].sort((a, b) => b.score - a.score);

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col overflow-hidden font-sans selection:bg-orange-500/30">
      {/* HEADER */}
      <header className="h-[12vh] bg-slate-900/80 backdrop-blur-md border-b-2 border-orange-600/50 px-8 flex justify-between items-center shadow-[0_0_30px_rgba(234,88,12,0.3)] z-20 relative shrink-0">
        <div className="flex items-center gap-4 relative z-10">
          <div className="bg-gradient-to-br from-orange-500 to-red-600 p-3 rounded-2xl shadow-lg border border-orange-400/50 relative">
             <Shield size={32} className="text-white" fill="currentColor" />
             <Flame size={20} className="text-yellow-300 absolute bottom-1 right-1 animate-bounce" fill="currentColor"/>
          </div>
          <div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none text-transparent bg-clip-text bg-gradient-to-r from-white via-orange-200 to-orange-500">
              BIỆT ĐỘI ARENA
            </h1>
            <p className="text-orange-500/70 text-xs font-bold tracking-[0.3em] uppercase">Chiến trường rực lửa</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 relative z-10">
            {gameState !== 'FINISHED' && (
                <div className="flex flex-col items-end">
                    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Mật mã chiến dịch</span>
                    <span className="text-5xl font-black text-yellow-400 font-mono tracking-widest drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]">{pin}</span>
                </div>
            )}
             {gameState === 'RACING' && (
                <div className="bg-slate-800/80 border-2 border-orange-500/50 p-3 rounded-xl flex items-center gap-2 shadow-[inset_0_0_20px_rgba(234,88,12,0.2)]">
                    <Clock className="text-orange-500 animate-spin-slow" />
                    <span className="text-2xl font-mono font-bold text-white">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
                </div>
            )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-6 relative z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black overflow-hidden flex flex-col">
        {/* LOBBY */}
        {gameState === 'LOBBY' && (
          <div className="h-full flex flex-col items-center justify-center relative animate-in fade-in">
             <div className="text-center mb-8 relative z-10">
                 <Target size={80} className="text-orange-600/30 absolute -top-10 left-1/2 -translate-x-1/2 animate-pulse"/>
                 <h2 className="text-5xl font-black mb-4 italic uppercase tracking-tighter text-white drop-shadow-lg">Trung tâm chỉ huy</h2>
                 <p className="text-xl text-orange-400 font-bold flex items-center gap-2 justify-center">
                    <Users className="animate-bounce"/> Đã tập kết: {teams.length} Quân đoàn
                 </p>
             </div>
             
             <div className="relative z-10 mb-10 bg-slate-900/80 p-4 rounded-2xl border-2 border-orange-600/30 shadow-xl flex items-center gap-4">
                 <div className="bg-orange-600/20 p-2 rounded-lg"><Clock className="text-orange-500" size={24} /></div>
                 <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">Thời gian (Phút)</label>
                    <input type="number" value={initialTime} onChange={(e) => setInitialTime(Number(e.target.value))} className="bg-transparent text-3xl font-black text-white outline-none w-full border-b-2 border-slate-700 focus:border-orange-500 font-mono" min="1" max="180"/>
                 </div>
             </div>
             
             <div className="grid grid-cols-4 gap-6 w-full max-w-5xl mb-14 relative z-10 max-h-[40vh] overflow-y-auto custom-scrollbar p-2">
                {teams.map((t, i) => (
                    <div key={i} className={`${t.color.bg} ${t.color.border} border-b-4 p-5 rounded-2xl font-black text-center text-xl shadow-xl flex items-center justify-center gap-3 ${t.color.text} animate-in zoom-in`}>
                        <Swords size={20}/> {t.name}
                    </div>
                ))}
             </div>
             
             <button onClick={startGame} className="group relative bg-gradient-to-r from-orange-600 to-red-600 px-20 py-6 rounded-full font-black text-3xl shadow-[0_0_40px_rgba(234,88,12,0.6)] hover:scale-105 transition-all uppercase italic tracking-wider z-10">
                 <span className="relative flex items-center gap-3"><Zap fill="currentColor"/> XUẤT KÍCH</span>
             </button>
          </div>
        )}

        {/* RACING VIEW (ĐÃ SỬA LỖI CHE ĐIỂM) */}
        {gameState === 'RACING' && (
          <div className="h-full flex flex-col gap-6 relative z-10">
              <div className="flex-1 bg-slate-900/60 backdrop-blur-md rounded-[3rem] p-10 border-2 border-orange-600/20 relative overflow-hidden shadow-inner flex flex-col justify-center">
                  {/* Đường đích */}
                  <div className="absolute right-16 top-0 bottom-0 w-3 bg-gradient-to-b from-orange-500/10 via-orange-500/80 to-orange-500/10 blur-sm z-0 flex items-center justify-center border-x border-orange-400/50 animate-pulse"></div>
                  
                  <div className="space-y-6 relative z-10 w-full overflow-y-auto max-h-full pr-4 custom-scrollbar">
                      {sortedTeams.map((team, idx) => {
                          const progress = Math.min(95, ((team.currentQ || 0) / (quiz.questions.length || 10)) * 95);
                          // [LOGIC SỬA LỖI] Nếu > 55% thì đảo chiều hiển thị để không bị che điểm
                          const isNearEnd = progress > 55;

                          return (
                              <div key={team.id} className="relative h-16 flex items-center w-full group">
                                  <div className="absolute inset-0 bg-slate-800/50 rounded-2xl border border-white/5 overflow-hidden w-full"></div>
                                  <div className={`absolute inset-y-0 left-0 ${team.color.bg} opacity-40 rounded-l-2xl transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }}></div>
                                  
                                  {/* Container Di Chuyển */}
                                  <div 
                                      className={`absolute transition-all duration-1000 ease-out flex items-center gap-4 z-20 ${isNearEnd ? '-translate-x-full flex-row-reverse' : ''}`} 
                                      style={{ left: `${progress}%` }}
                                  >
                                      {/* Avatar (Giữ Icon Flame đi kèm Avatar) */}
                                      <div className={`${team.color.bg} ${team.color.border} border-2 p-2 rounded-xl shadow-lg relative ${team.color.shadow} group-hover:scale-110 transition-transform shrink-0`}>
                                          {idx === 0 && <Flame className="absolute -top-6 -left-2 text-orange-500 animate-bounce" size={24} fill="currentColor" />}
                                          <Users size={24} className={team.color.text} />
                                      </div>

                                      {/* Bảng điểm */}
                                      <div className="bg-slate-900/90 border-2 border-slate-700 px-3 py-1 rounded-xl shadow-xl backdrop-blur-sm whitespace-nowrap flex flex-col">
                                          <p className={`font-black text-xs uppercase ${team.color.text.replace('100','400')}`}>{team.name}</p>
                                          <div className="flex gap-2 text-xs">
                                              <span className="text-white font-bold">{team.currentQ}/{quiz.questions.length} câu</span>
                                              <span className="text-yellow-400 font-black italic border-l border-white/20 pl-2">{team.score}đ</span>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
              <button onClick={finishGame} className="absolute bottom-4 right-4 bg-red-600/20 hover:bg-red-600 border border-red-500 text-red-100 px-6 py-2 rounded-xl font-bold uppercase text-xs backdrop-blur-md transition-colors">Kết thúc sớm</button>
          </div>
        )}

        {/* FINISHED VIEW */}
        {gameState === 'FINISHED' && (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-500 relative">
                <Trophy size={100} className="text-yellow-400 mb-4 animate-bounce drop-shadow-[0_0_50px_rgba(250,204,21,0.8)]" />
                <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-orange-500 italic uppercase mb-8 drop-shadow-lg">
                    TỔNG KẾT CHIẾN DỊCH
                </h2>

                <div className="flex items-end justify-center gap-4 mb-10 w-full max-w-4xl h-[40vh]">
                    {sortedTeams[1] && (
                        <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom duration-700 delay-100">
                             <div className="text-slate-400 font-black text-2xl mb-2">🥈 Hạng 2</div>
                             <div className="w-full bg-slate-700 h-[25vh] rounded-t-3xl border-t-4 border-slate-500 flex flex-col items-center justify-start p-4 shadow-2xl relative">
                                 <div className="text-3xl font-black text-white uppercase mb-1 text-center truncate w-full">{sortedTeams[1].name}</div>
                                 <div className="text-2xl font-bold text-slate-300">{sortedTeams[1].score}đ</div>
                             </div>
                        </div>
                    )}
                    {sortedTeams[0] && (
                        <div className="flex flex-col items-center w-1/3 z-10 animate-in slide-in-from-bottom duration-700">
                             <Flame className="text-orange-500 mb-2 animate-pulse" size={40} fill="currentColor"/>
                             <div className="text-yellow-400 font-black text-4xl mb-2 drop-shadow-lg">🥇 QUÁN QUÂN</div>
                             <div className="w-full bg-gradient-to-b from-yellow-500 to-orange-600 h-[35vh] rounded-t-3xl border-t-4 border-yellow-300 flex flex-col items-center justify-start p-6 shadow-[0_0_50px_rgba(234,88,12,0.5)] relative">
                                 <div className="text-4xl font-black text-white uppercase mb-2 text-center drop-shadow-md truncate w-full">{sortedTeams[0].name}</div>
                                 <div className="text-5xl font-black text-yellow-100">{sortedTeams[0].score}đ</div>
                             </div>
                        </div>
                    )}
                    {sortedTeams[2] && (
                        <div className="flex flex-col items-center w-1/3 animate-in slide-in-from-bottom duration-700 delay-200">
                             <div className="text-orange-700 font-black text-2xl mb-2">🥉 Hạng 3</div>
                             <div className="w-full bg-orange-900 h-[20vh] rounded-t-3xl border-t-4 border-orange-700 flex flex-col items-center justify-start p-4 shadow-2xl relative">
                                 <div className="text-2xl font-black text-white uppercase mb-1 text-center truncate w-full">{sortedTeams[2].name}</div>
                                 <div className="text-xl font-bold text-orange-200">{sortedTeams[2].score}đ</div>
                             </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 z-50">
                     <button onClick={() => router.push('/dashboard')} className="bg-slate-800 text-white border-2 border-slate-600 px-8 py-3 rounded-full font-black text-lg hover:bg-slate-700 transition flex items-center gap-2 uppercase">
                        <Home size={20}/> Về Trung Tâm
                     </button>
                     <button onClick={() => router.reload()} className="bg-orange-600 text-white px-8 py-3 rounded-full font-black text-lg hover:bg-orange-500 transition shadow-lg flex items-center gap-2 uppercase">
                        <RotateCcw size={20}/> Tái Đấu
                     </button>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}