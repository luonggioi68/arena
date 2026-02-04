import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { ref, update, onValue } from 'firebase/database';
import { Trophy, Clock, Monitor, Car, Hammer, Building, Volume2, VolumeX, Shield, Flame, ArrowLeft, SkipForward, Loader2, Crown, Check, X, FileSpreadsheet } from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';

export default function ArenaHostController() {
  const router = useRouter();
  const { pin } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  
  const [gameState, setGameState] = useState('WAITING'); 
  const [players, setPlayers] = useState([]);
  const [timer, setTimer] = useState(0); 
  const [isPaused, setIsPaused] = useState(false); 
  const [viewMode, setViewMode] = useState('CLASSIC'); 
  const [isMuted, setIsMuted] = useState(false);
  const [gameConfig, setGameConfig] = useState({}); // Lưu cấu hình thời gian

  const bgmRef = useRef(null);

  // 1. KHỞI TẠO & LẮNG NGHE
  useEffect(() => {
    if (!pin) return;
    
    bgmRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'); 
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.5;

    const roomRef = ref(db, `rooms/${pin}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.quiz) setQuiz(data.quiz);
        if (data.viewMode) setViewMode(data.viewMode);
        if (data.config) setGameConfig(data.config); // Lấy cấu hình thời gian
        if (data.players) setPlayers(Object.values(data.players)); else setPlayers([]);
        
        const svState = data.gameState || 'WAITING';
        setGameState(prev => {
            if (prev !== svState) {
                // [CẬP NHẬT LOGIC TIMER]
                if (svState === 'PREPARE') {
                    // Câu đầu tiên chờ 3s (Bắt đầu), các câu sau chờ 1s
                    setTimer(data.currentQuestion === 0 ? 3 : 1); 
                }
                else if (svState === 'RESULT') {
                    setTimer(3); // Xem kết quả 3s
                }
                else if (svState === 'QUESTION' && data.quiz) {
                    const qType = data.quiz.questions[data.currentQuestion].type;
                    // Lấy thời gian từ config, nếu không có thì dùng mặc định
                    const time = data.config?.[`time${qType}`] || 15;
                    setTimer(time);
                }
            }
            return svState;
        });
        setCurrentQIndex(data.currentQuestion || 0);
      }
    });
    return () => {
        unsubscribe();
        if(bgmRef.current) bgmRef.current.pause();
    };
  }, [pin]);

  // 2. XỬ LÝ NHẠC
  useEffect(() => {
    if (bgmRef.current) {
        if (!isMuted && ['PREPARE', 'QUESTION'].includes(gameState)) {
            bgmRef.current.play().catch(e => console.log("Audio play failed"));
        } else {
            bgmRef.current.pause();
        }
    }
  }, [gameState, isMuted]);

  // 3. TIMER LOOP
  useEffect(() => {
    if (!['PREPARE', 'QUESTION', 'RESULT'].includes(gameState) || isPaused) return;
    const interval = setInterval(() => { setTimer((prev) => (prev > 0 ? prev - 1 : 0)); }, 1000);
    return () => clearInterval(interval);
  }, [gameState, isPaused]);

  // 4. CHUYỂN TRẠNG THÁI TỰ ĐỘNG
  useEffect(() => {
    if (timer === 0 && !isPaused && gameState) {
        if (gameState === 'PREPARE') update(ref(db, `rooms/${pin}`), { gameState: 'QUESTION' });
        else if (gameState === 'QUESTION') update(ref(db, `rooms/${pin}`), { gameState: 'RESULT' });
        else if (gameState === 'RESULT') {
            if (quiz && currentQIndex < quiz.questions.length - 1) 
                update(ref(db, `rooms/${pin}`), { gameState: 'PREPARE', currentQuestion: currentQIndex + 1 });
            else {
                update(ref(db, `rooms/${pin}`), { gameState: 'FINISHED' });
                confetti({ particleCount: 500, spread: 150, origin: { y: 0.6 } });
            }
        }
    }
  }, [timer]);

  const handleStartGame = () => update(ref(db, `rooms/${pin}`), { gameState: 'PREPARE', currentQuestion: 0 });
  const skipTimer = () => setTimer(0);
  const changeGameMode = (mode) => update(ref(db, `rooms/${pin}`), { viewMode: mode });
  const toggleMute = () => setIsMuted(!isMuted);

  const exportToExcel = () => {
    const data = players.sort((a,b) => b.score - a.score).map((p, i) => ({ "Hạng": i+1, "Tên": p.name, "Điểm": p.score }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KetQua");
    XLSX.writeFile(wb, `KetQua_Arena_${pin}.xlsx`);
  };

  const RacingView = () => (
      <div className="w-full h-full bg-slate-900/90 rounded-3xl p-6 border-2 border-orange-500/30 relative overflow-hidden flex flex-col justify-center shadow-[0_0_50px_rgba(249,115,22,0.1)]">
          <div className="absolute right-10 top-0 bottom-0 w-4 bg-yellow-400/20 z-0 flex items-center justify-center border-l-4 border-dashed border-yellow-400"><span className="rotate-90 text-xs font-black text-yellow-400 tracking-[1em] animate-pulse">FINISH</span></div>
          <div className="space-y-4 relative z-10 overflow-y-auto max-h-full pr-4 custom-scrollbar">
              {players.sort((a,b) => b.score - a.score).map((p, idx) => {
                  const qLength = quiz?.questions?.length || 1;
                  const progress = Math.min(90, (p.score / (qLength * 100)) * 90);
                  return (
                      <div key={p.id} className="relative h-14 bg-white/5 rounded-r-full flex items-center border-b border-white/10">
                          <div className="absolute transition-all duration-1000 ease-out flex items-center z-10" style={{ left: `${progress}%`, transform: 'translateX(-100%)' }}>
                              <div className="relative group">
                                <div className="absolute -top-8 right-0 bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap border border-orange-500">{p.name} ({p.score})</div>
                                <Car size={40} className={`text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] ${idx===0 ? 'text-yellow-400 scale-125' : ''}`} />
                                {idx===0 && <Flame className="absolute top-1 -left-4 text-orange-500 animate-bounce rotate-90" size={20} fill="currentColor"/>}
                              </div>
                          </div>
                          <div className="h-2 bg-gradient-to-r from-transparent to-orange-600/50 w-full absolute top-1/2 -translate-y-1/2"></div>
                      </div>
                  );
              })}
          </div>
      </div>
  );

  const GoldMinerView = () => (
    <div className="w-full h-full bg-[#3d2b1f] rounded-3xl p-6 border-4 border-[#8b5a2b] overflow-y-auto relative shadow-inner custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-wood.png')]">
       <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-x-4 gap-y-12 pt-10">
          {players.sort((a, b) => b.score - a.score).map((p, idx) => {
             const ropeLength = Math.min(150, 20 + p.score / 5); 
             return (
               <div key={p.id} className="flex flex-col items-center relative h-40 group">
                  <div className="absolute -top-8 w-12 h-12 bg-slate-800 rounded-lg border-2 border-gray-500 z-20 flex items-center justify-center shadow-lg">
                      <div className="w-8 h-8 bg-orange-500 rounded-full animate-spin-slow border-2 border-dashed border-black"></div>
                  </div>
                  <div className="absolute -top-14 bg-black/70 text-white text-[9px] font-bold px-2 py-0.5 rounded border border-yellow-600 z-30 truncate max-w-full">{p.name}</div>
                  <div className="w-1 bg-gray-400 transition-all duration-1000 ease-out relative z-10" style={{ height: `${ropeLength}px` }}></div>
                  <div className="relative z-20 transition-all duration-1000 ease-out animate-bounce-slow">
                      <div className={`bg-yellow-400 rounded-full border-2 border-yellow-600 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.6)] ${idx===0 ? 'w-16 h-16' : 'w-10 h-10'}`}>
                          <span className="font-black text-yellow-800 text-xs">{p.score}</span>
                      </div>
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full animate-ping"></div>
                  </div>
               </div>
             );
          })}
       </div>
    </div>
  );

  const TowerView = () => {
    const sortedPlayers = players.sort((a, b) => b.score - a.score);
    return (
      <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/wall-4-light.png')] bg-slate-900 rounded-3xl p-4 border-4 border-slate-700 relative flex items-end gap-4 overflow-x-auto custom-scrollbar shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/50 to-transparent pointer-events-none rounded-3xl"></div>
          <div className="absolute top-10 left-10 w-20 h-10 bg-white/10 blur-xl rounded-full animate-pulse"></div>
          {sortedPlayers.map((p, idx) => {
              const scoreBlocks = Math.floor(p.score / 50);
              const renderedBlocks = Math.min(12, scoreBlocks);
              return (
                  <div key={p.id} className="flex flex-col items-center justify-end h-full min-w-[80px] group relative z-10">
                       <div className="mb-1 text-center transition-all duration-500 group-hover:-translate-y-2 relative">
                           {idx === 0 && <Crown size={32} className="text-yellow-400 mx-auto mb-1 animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" fill="currentColor"/>}
                           <span className="block font-black text-[10px] text-white bg-slate-800 px-2 py-0.5 rounded-t-md uppercase truncate max-w-[70px] border-x border-t border-slate-600">{p.name}</span>
                           <div className="font-black text-yellow-400 text-xs bg-slate-900/80 px-2 py-0.5 rounded-b-md border-x border-b border-slate-600">{p.score}</div>
                       </div>
                       <div className="flex flex-col-reverse w-full items-center shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                           <div className="h-6 w-20 bg-gradient-to-b from-slate-600 to-slate-800 rounded-sm border-2 border-slate-500 flex items-center justify-center"><div className="w-16 h-2 bg-slate-900/30 rounded-full"></div></div>
                           {Array.from({ length: renderedBlocks }).map((_, i) => (
                               <div key={i} className="h-6 w-16 bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 border-x-2 border-t-2 border-slate-300/50 relative animate-in slide-in-from-bottom duration-500 group-hover:brightness-110" style={{animationDelay: `${i*0.1}s`}}>
                                   <div className="absolute inset-0 opacity-30 bg-[url('https://www.transparenttextures.com/patterns/brick-wall.png')] bg-[length:20px_20px]"></div>
                                   {i === renderedBlocks - 1 && <div className="absolute inset-0 bg-blue-500/20 animate-pulse"></div>}
                               </div>
                           ))}
                       </div>
                  </div>
              )
          })}
      </div>
    );
  };

  if (!gameState || !quiz) return <div className="h-screen bg-[#020617] flex items-center justify-center"><Loader2 className="animate-spin text-orange-500" size={40}/></div>;
  const currentQuestion = quiz?.questions?.[currentQIndex] || { q: "Đang tải...", a: [], type: 'MCQ' };

  return (
    <div className="h-screen bg-[#020617] text-white flex flex-col overflow-hidden font-sans selection:bg-orange-500 selection:text-white">
      <div className="h-[10vh] bg-slate-950/90 backdrop-blur-md px-6 flex justify-between items-center z-30 border-b border-white/10 shadow-xl">
        <div className="flex items-center gap-6">
            <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white"><ArrowLeft size={24}/></button>
            <div className="flex items-center gap-3">
              <div className="bg-orange-500 p-2 rounded-lg"><Shield size={24} className="text-white" fill="currentColor" /></div>
              <span className="text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-none hidden md:block">Chiến binh <span className="text-orange-500">Arena</span></span>
            </div>
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 ml-4 shadow-inner">
                {[{m:'CLASSIC', i:<Monitor size={16}/>}, {m:'RACING', i:<Car size={16}/>}, {m:'MINER', i:<Hammer size={16}/>}, {m:'TOWER', i:<Building size={16}/>}].map((item) => (
                  <button key={item.m} onClick={() => changeGameMode(item.m)} className={`p-2 rounded-lg transition-all ${viewMode === item.m ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{item.i}</button>
                ))}
            </div>
        </div>
        <div className="flex items-center gap-3">
            <button onClick={toggleMute} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-white/50 hover:text-white">{isMuted ? <VolumeX size={20}/> : <Volume2 size={20} className="text-green-400"/>}</button>
            {(gameState === 'QUESTION' || gameState === 'PREPARE') && <button onClick={skipTimer} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition text-white/50 hover:text-white"><SkipForward size={20}/></button>}
            <div className="bg-slate-900 px-6 py-2 rounded-xl border border-indigo-500/30 flex items-center gap-3 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                <span className={`text-3xl font-black font-mono tabular-nums ${timer <= 5 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>{timer}s</span>
                <Clock size={24} className={timer < 5 ? 'text-red-500' : 'text-indigo-400'} />
            </div>
        </div>
      </div>

      <main className="h-[90vh] p-4 flex flex-col overflow-hidden relative">
        {(gameState === 'WAITING' || gameState === 'LOBBY' || !gameState) && (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300 z-50">
                <div className="bg-slate-900/80 backdrop-blur-xl p-10 rounded-[3rem] border-2 border-indigo-500/30 shadow-2xl flex flex-col items-center w-full max-w-4xl">
                    <h2 className="text-2xl font-bold text-indigo-400 mb-4 uppercase tracking-widest animate-pulse">Đang đợi người chơi...</h2>
                    <div className="bg-[#020617] px-16 py-8 rounded-[2rem] border-4 border-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.3)] mb-8 text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <p className="text-slate-400 font-black text-sm uppercase tracking-widest mb-2">Mã PIN Tham Gia</p>
                        <h1 className="text-8xl font-black text-yellow-400 tracking-tighter drop-shadow-2xl font-mono">{pin}</h1>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300 mb-8 bg-white/5 px-6 py-2 rounded-full border border-white/10">
                        <Users size={24} className="text-indigo-400" />
                        <span className="font-bold text-xl"><span className="text-white text-2xl">{players.length}</span> người đã vào</span>
                    </div>
                    <button onClick={handleStartGame} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-12 py-5 rounded-2xl font-black text-2xl shadow-[0_10px_30px_rgba(16,185,129,0.4)] flex items-center gap-3 transform hover:scale-105 active:scale-95 transition-all uppercase italic">BẮT ĐẦU NGAY <Play fill="currentColor" size={24}/></button>
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-3 max-w-5xl">
                    {players.map((p) => (<div key={p.id} className="bg-white/10 backdrop-blur px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4"><img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`} className="w-6 h-6 rounded-full bg-slate-800" /><span className="font-bold text-sm">{p.name}</span></div>))}
                </div>
            </div>
        )}

        {gameState === 'PREPARE' && (
           <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300 z-10">
              <h2 className="text-3xl text-orange-400 mb-6 font-black uppercase italic tracking-[0.2em] animate-pulse">Sẵn sàng...</h2>
              <div className="w-64 h-64 rounded-full border-8 border-white/10 flex items-center justify-center bg-slate-900 shadow-[0_0_50px_rgba(249,115,22,0.4)]"><span className="text-[8rem] font-black text-white">{timer}</span></div>
           </div>
        )}

        {(gameState === 'QUESTION' || gameState === 'RESULT') && (
            <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500">
                {viewMode === 'CLASSIC' && (
                    <div className="h-auto min-h-[22vh] max-h-[35vh] bg-slate-900 p-6 rounded-[2rem] border border-slate-800 text-center flex items-center justify-center shadow-2xl shrink-0 relative group overflow-y-auto custom-scrollbar">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none"></div>
                        {currentQuestion.img && <img src={currentQuestion.img} className="h-24 w-auto rounded object-contain mr-4 border border-white/10"/>}
                        <h1 className={`text-xl md:text-3xl font-bold text-white leading-normal relative z-10 ${currentQuestion.q.includes('\n') ? 'whitespace-pre-wrap font-mono text-left text-lg' : 'italic'}`}>{currentQuestion.q}</h1>
                    </div>
                )}
                <div className="flex-1 min-h-0 relative z-10">
                    {viewMode === 'RACING' && <RacingView />}
                    {viewMode === 'MINER' && <GoldMinerView />}
                    {viewMode === 'TOWER' && <TowerView />}
                    {viewMode === 'CLASSIC' && (
                        <div className="h-full w-full">
                            {currentQuestion.type === 'MCQ' && (
                                <div className="h-full grid grid-cols-2 gap-4 pb-2">
                                    {currentQuestion.a.map((ans, idx) => (
                                        <div key={idx} className={`rounded-[2rem] flex flex-col items-center justify-center text-xl md:text-2xl font-bold text-white p-6 text-center border-b-[8px] shadow-xl transition-all ${gameState === 'RESULT' ? (idx === currentQuestion.correct ? 'bg-green-600 border-green-800 opacity-100 scale-105' : 'bg-slate-700 border-slate-900 opacity-50') : 'bg-indigo-600/90 border-indigo-900 hover:bg-indigo-600'}`}>
                                          <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/20 flex items-center justify-center text-sm font-black">{String.fromCharCode(65+idx)}</div>
                                          <span>{ans}</span>
                                          {currentQuestion.aImages?.[idx] && <img src={currentQuestion.aImages[idx]} className="h-20 w-auto mt-2 rounded bg-white p-1"/>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {currentQuestion.type === 'TF' && (
                                <div className="h-full bg-slate-800/60 rounded-[2rem] p-8 overflow-y-auto border-2 border-white/5">
                                    <table className="w-full text-2xl text-left text-white">
                                        <thead><tr className="border-b-2 border-white/10 text-slate-400 uppercase text-sm tracking-widest"><th className="py-4 pl-4">Nội dung</th><th className="py-4 text-center w-32">Đúng</th><th className="py-4 text-center w-32">Sai</th></tr></thead>
                                        <tbody>
                                            {currentQuestion.items.map((item, idx) => (
                                                <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                                                    <td className="py-6 pl-4 font-bold">{item.text}</td>
                                                    <td className="py-6 text-center"><div className={`w-10 h-10 rounded-lg mx-auto flex items-center justify-center ${gameState === 'RESULT' && item.isTrue ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' : 'bg-slate-700'}`}>{gameState === 'RESULT' && item.isTrue && <Check size={28} strokeWidth={4}/>}</div></td>
                                                    <td className="py-6 text-center"><div className={`w-10 h-10 rounded-lg mx-auto flex items-center justify-center ${gameState === 'RESULT' && !item.isTrue ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' : 'bg-slate-700'}`}>{gameState === 'RESULT' && !item.isTrue && <Check size={28} strokeWidth={4}/>}</div></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {currentQuestion.type === 'SA' && (
                                <div className="h-full flex flex-col items-center justify-center bg-slate-800/60 rounded-[2rem] border-2 border-dashed border-white/10">
                                    <div className="text-slate-400 uppercase font-black tracking-[0.5em] mb-6">ĐÁP ÁN CHÍNH XÁC</div>
                                    <div className="bg-white text-slate-950 text-6xl font-black px-16 py-8 rounded-3xl shadow-[0_10px_0_#cbd5e1] min-w-[60%] text-center uppercase tracking-wider">{gameState === 'RESULT' ? currentQuestion.correct : "???"}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {gameState === 'FINISHED' && (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-700 z-50">
                <Trophy size={120} className="text-yellow-400 mb-6 animate-bounce drop-shadow-[0_0_50px_rgba(250,204,21,0.6)]" />
                <h2 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-orange-400 italic uppercase mb-8 tracking-tighter">BẢNG XẾP HẠNG</h2>
                <div className="flex gap-4 mb-8">
                     <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 shadow-lg transition transform hover:-translate-y-1"><FileSpreadsheet size={20}/> Xuất Excel</button>
                     <button onClick={() => router.push('/dashboard')} className="bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-black hover:bg-white shadow-lg transition uppercase">Kết thúc</button>
                </div>
                <div className="bg-slate-900/90 backdrop-blur-xl p-6 rounded-[2rem] w-full max-w-2xl border border-white/10 shadow-2xl">
                    {players.sort((a,b) => b.score - a.score).slice(0,5).map((p, idx) => (
                        <div key={p.id} className={`flex justify-between items-center p-4 border-b border-white/5 last:border-0 rounded-xl mb-2 ${idx===0?'bg-yellow-500/10 border-yellow-500/30':''}`}>
                             <div className="flex items-center gap-4">
                                 <span className={`text-2xl w-8 text-center ${idx===0?'text-4xl':''}`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}</span>
                                 <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`} className="w-10 h-10 rounded-full bg-slate-800" />
                                 <span className="font-black text-lg uppercase italic tracking-tighter text-slate-200">{p.name}</span>
                             </div>
                             <span className="text-orange-400 font-black text-2xl">{p.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </main>
    </div>
  );
}