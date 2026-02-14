import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { db } from '@/lib/firebase';
import { ref, update, onValue } from 'firebase/database';
import { Trophy, Clock, Monitor, Car, Hammer, Building, Volume2, VolumeX, Shield, Flame, ArrowLeft, SkipForward, Loader2, Crown, Check, X, FileSpreadsheet, Flag } from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';
import MathRender from '@/components/MathRender'; 

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
  const [gameConfig, setGameConfig] = useState({}); 

  const bgmRef = useRef(null);

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
                            <img src={imgUrl} className="inline-block align-middle mx-1 max-h-16 border rounded bg-white shadow-sm" alt="minh-hoa" />
                        )}
                    </span>
                ))}
            </span>
        );
    }
    return <MathRender content={text} />;
  };

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
        if (data.config) setGameConfig(data.config);
        if (data.players) setPlayers(Object.values(data.players)); else setPlayers([]);
        
        const svState = data.gameState || 'WAITING';
        setGameState(prev => {
            if (prev !== svState) {
                if (svState === 'PREPARE') setTimer(data.currentQuestion === 0 ? 3 : 1); 
                else if (svState === 'RESULT') setTimer(3); 
                else if (svState === 'QUESTION' && data.quiz) {
                    const qType = data.quiz.questions[data.currentQuestion].type;
                    const time = data.config?.[`time${qType}`] || 15;
                    setTimer(time);
                }
            }
            return svState;
        });
        setCurrentQIndex(data.currentQuestion || 0);
      }
    });
    return () => { unsubscribe(); if(bgmRef.current) bgmRef.current.pause(); };
  }, [pin]);

  useEffect(() => {
    if (['PREPARE', 'QUESTION', 'RESULT'].includes(gameState)) {
        if (players.length === 0) {
            update(ref(db, `rooms/${pin}`), { gameState: 'FINISHED' });
            alert("⚠️ Đã hết người chơi! Game kết thúc.");
            router.push('/dashboard');
        }
    }
  }, [players, gameState, pin, router]);

  useEffect(() => {
    if (bgmRef.current) {
        if (!isMuted && ['PREPARE', 'QUESTION'].includes(gameState)) bgmRef.current.play().catch(e => console.log("Audio play failed"));
        else bgmRef.current.pause();
    }
  }, [gameState, isMuted]);

  useEffect(() => {
    if (!['PREPARE', 'QUESTION', 'RESULT'].includes(gameState) || isPaused) return;
    const interval = setInterval(() => { setTimer((prev) => (prev > 0 ? prev - 1 : 0)); }, 1000);
    return () => clearInterval(interval);
  }, [gameState, isPaused]);

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
  
  const handleEarlyFinish = () => {
      if (confirm("⚠️ KẾT THÚC SỚM?\nBạn có chắc muốn dừng trận đấu và vinh danh ngay lập tức?")) {
          confetti({ particleCount: 300, spread: 100, origin: { y: 0.6 } });
          update(ref(db, `rooms/${pin}`), { gameState: 'FINISHED' });
      }
  };

  const changeGameMode = (mode) => update(ref(db, `rooms/${pin}`), { viewMode: mode });
  const toggleMute = () => setIsMuted(!isMuted);

  const exportToExcel = () => {
    const data = players.sort((a,b) => b.score - a.score).map((p, i) => ({ "Hạng": i+1, "Tên": p.name, "Điểm": p.score }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KetQua");
    XLSX.writeFile(wb, `KetQua_Arena_${pin}.xlsx`);
  };

  // --- CÁC GIAO DIỆN VIEW MODE ---
  const RacingView = () => (
      <div className="w-full h-full bg-slate-900/90 rounded-3xl p-4 md:p-6 border-2 border-orange-500/30 relative overflow-hidden flex flex-col justify-center shadow-[0_0_50px_rgba(249,115,22,0.1)]">
          <div className="absolute right-6 md:right-10 top-0 bottom-0 w-4 bg-yellow-400/20 z-0 flex items-center justify-center border-l-4 border-dashed border-yellow-400"><span className="rotate-90 text-[10px] md:text-xs font-black text-yellow-400 tracking-[0.5em] md:tracking-[1em] animate-pulse">FINISH</span></div>
          <div className="space-y-4 relative z-10 overflow-y-auto max-h-full pr-2 md:pr-4 custom-scrollbar">
              {players.sort((a,b) => b.score - a.score).map((p, idx) => {
                  const qLength = quiz?.questions?.length || 1;
                  const progress = Math.min(85, (p.score / (qLength * 100)) * 85);
                  return (
                      <div key={p.id} className="relative h-12 md:h-14 bg-white/5 rounded-r-full flex items-center border-b border-white/10 mt-4 md:mt-0">
                          <div className="absolute transition-all duration-1000 ease-out flex items-center z-10" style={{ left: `${progress}%`, transform: 'translateX(-100%)' }}>
                              <div className="relative group">
                                <div className="absolute -top-6 right-0 bg-black/80 text-white text-[8px] md:text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap border border-orange-500">{p.name} ({p.score})</div>
                                <Car size={32} className={`text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] md:w-10 md:h-10 ${idx===0 ? 'text-yellow-400 scale-125' : ''}`} />
                                {idx===0 && <Flame className="absolute top-0 md:top-1 -left-3 md:-left-4 text-orange-500 animate-bounce rotate-90 w-4 h-4 md:w-5 md:h-5" fill="currentColor"/>}
                              </div>
                          </div>
                          <div className="h-1.5 md:h-2 bg-gradient-to-r from-transparent to-orange-600/50 w-full absolute top-1/2 -translate-y-1/2"></div>
                      </div>
                  );
              })}
          </div>
      </div>
  );

  const GoldMinerView = () => (
    <div className="w-full h-full bg-[#3d2b1f] rounded-3xl p-4 md:p-6 border-4 border-[#8b5a2b] overflow-y-auto relative shadow-inner custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-wood.png')]">
       <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-2 md:gap-x-4 gap-y-10 md:gap-y-12 pt-8 md:pt-10">
          {players.sort((a, b) => b.score - a.score).map((p, idx) => {
             const ropeLength = Math.min(150, 20 + p.score / 5); 
             return (
               <div key={p.id} className="flex flex-col items-center relative h-32 md:h-40 group mt-4">
                  <div className="absolute -top-6 md:-top-8 w-8 h-8 md:w-12 md:h-12 bg-slate-800 rounded-lg border-2 border-gray-500 z-20 flex items-center justify-center shadow-lg">
                      <div className="w-5 h-5 md:w-8 md:h-8 bg-orange-500 rounded-full animate-spin-slow border-2 border-dashed border-black"></div>
                  </div>
                  <div className="absolute -top-12 md:-top-14 bg-black/70 text-white text-[8px] md:text-[9px] font-bold px-1.5 md:px-2 py-0.5 rounded border border-yellow-600 z-30 truncate max-w-[80px] md:max-w-full text-center">{p.name}</div>
                  <div className="w-0.5 md:w-1 bg-gray-400 transition-all duration-1000 ease-out relative z-10" style={{ height: `${ropeLength}px` }}></div>
                  <div className="relative z-20 transition-all duration-1000 ease-out animate-bounce-slow">
                      <div className={`bg-yellow-400 rounded-full border-2 border-yellow-600 flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.6)] ${idx===0 ? 'w-12 h-12 md:w-16 md:h-16' : 'w-8 h-8 md:w-10 md:h-10'}`}>
                          <span className="font-black text-yellow-800 text-[10px] md:text-xs">{p.score}</span>
                      </div>
                      <div className="absolute -top-1 -right-1 w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-ping"></div>
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
      <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/wall-4-light.png')] bg-slate-900 rounded-3xl p-4 border-4 border-slate-700 relative flex items-end gap-2 md:gap-4 overflow-x-auto custom-scrollbar shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/50 to-transparent pointer-events-none rounded-3xl"></div>
          <div className="absolute top-10 left-10 w-20 h-10 bg-white/10 blur-xl rounded-full animate-pulse"></div>
          {sortedPlayers.map((p, idx) => {
              const scoreBlocks = Math.floor(p.score / 50);
              const renderedBlocks = Math.min(12, scoreBlocks);
              return (
                  <div key={p.id} className="flex flex-col items-center justify-end h-full min-w-[60px] md:min-w-[80px] group relative z-10">
                       <div className="mb-1 text-center transition-all duration-500 group-hover:-translate-y-2 relative">
                           {idx === 0 && <Crown className="w-6 h-6 md:w-8 md:h-8 text-yellow-400 mx-auto mb-1 animate-bounce drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" fill="currentColor"/>}
                           <span className="block font-black text-[8px] md:text-[10px] text-white bg-slate-800 px-1.5 md:px-2 py-0.5 rounded-t-md uppercase truncate max-w-[50px] md:max-w-[70px] border-x border-t border-slate-600">{p.name}</span>
                           <div className="font-black text-yellow-400 text-[10px] md:text-xs bg-slate-900/80 px-1 md:px-2 py-0.5 rounded-b-md border-x border-b border-slate-600">{p.score}</div>
                       </div>
                       <div className="flex flex-col-reverse w-full items-center shadow-[0_10px_20px_rgba(0,0,0,0.5)]">
                           <div className="h-4 md:h-6 w-14 md:w-20 bg-gradient-to-b from-slate-600 to-slate-800 rounded-sm border-2 border-slate-500 flex items-center justify-center"><div className="w-10 md:w-16 h-1 md:h-2 bg-slate-900/30 rounded-full"></div></div>
                           {Array.from({ length: renderedBlocks }).map((_, i) => (
                               <div key={i} className="h-4 md:h-6 w-12 md:w-16 bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 border-x border-t md:border-x-2 md:border-t-2 border-slate-300/50 relative animate-in slide-in-from-bottom duration-500 group-hover:brightness-110" style={{animationDelay: `${i*0.1}s`}}>
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
      
      {/* HEADER: RESPONSIVE */}
      <div className="min-h-[8vh] md:min-h-[10vh] bg-slate-950/90 backdrop-blur-md px-2 md:px-6 py-2 flex flex-wrap justify-between items-center z-30 border-b border-white/10 shadow-xl gap-2">
        <div className="flex items-center gap-2 md:gap-6">
            <button onClick={() => router.push('/dashboard')} className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white"><ArrowLeft size={20} className="md:w-6 md:h-6"/></button>
            <div className="hidden sm:flex items-center gap-2 md:gap-3">
              <div className="bg-orange-500 p-1.5 md:p-2 rounded-lg"><Shield size={20} className="md:w-6 md:h-6 text-white" fill="currentColor" /></div>
              <span className="text-sm md:text-xl lg:text-2xl font-black italic tracking-tighter uppercase leading-none hidden lg:block">Chiến binh <span className="text-orange-500">Arena</span></span>
            </div>
            {/* View Mode Buttons */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 sm:ml-4 shadow-inner">
                {[{m:'CLASSIC', i:<Monitor size={14} className="md:w-4 md:h-4"/>}, {m:'RACING', i:<Car size={14} className="md:w-4 md:h-4"/>}, {m:'MINER', i:<Hammer size={14} className="md:w-4 md:h-4"/>}, {m:'TOWER', i:<Building size={14} className="md:w-4 md:h-4"/>}].map((item) => (
                  <button key={item.m} onClick={() => changeGameMode(item.m)} className={`p-1.5 md:p-2 rounded-lg transition-all ${viewMode === item.m ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>{item.i}</button>
                ))}
            </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <button onClick={toggleMute} className="p-1.5 md:p-2 bg-white/10 rounded-full hover:bg-white/20 transition text-white/50 hover:text-white">{isMuted ? <VolumeX size={16} className="md:w-5 md:h-5"/> : <Volume2 size={16} className="md:w-5 md:h-5 text-green-400"/>}</button>
            
            {['PREPARE', 'QUESTION', 'RESULT'].includes(gameState) && (
                <div className="flex gap-1 md:gap-2">
                    <button onClick={handleEarlyFinish} className="bg-red-500/20 hover:bg-red-600 p-1.5 md:p-2 rounded-full transition text-red-400 hover:text-white border border-red-500/30" title="Kết thúc sớm & Vinh danh">
                        <Flag size={16} className="md:w-5 md:h-5"/>
                    </button>
                    {gameState !== 'RESULT' && (
                        <button onClick={skipTimer} className="bg-white/10 hover:bg-white/20 p-1.5 md:p-2 rounded-full transition text-white/50 hover:text-white" title="Bỏ qua thời gian">
                            <SkipForward size={16} className="md:w-5 md:h-5"/>
                        </button>
                    )}
                </div>
            )}

            <div className="bg-slate-900 px-3 py-1.5 md:px-6 md:py-2 rounded-xl border border-indigo-500/30 flex items-center gap-1.5 md:gap-3 shadow-[0_0_15px_rgba(99,102,241,0.2)] shrink-0">
                <span className={`text-xl md:text-3xl font-black font-mono tabular-nums ${timer <= 5 ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>{timer}s</span>
                <Clock size={16} className={`md:w-6 md:h-6 ${timer < 5 ? 'text-red-500' : 'text-indigo-400'}`} />
            </div>
        </div>
      </div>

     <main className="flex-1 p-2 md:p-4 flex flex-col overflow-hidden relative">
        
        {/* LOBBY */}
        {(gameState === 'WAITING' || gameState === 'LOBBY' || !gameState) && (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300 z-50 overflow-y-auto custom-scrollbar pb-10">
                <div className="bg-slate-900/80 backdrop-blur-xl p-6 md:p-10 rounded-3xl md:rounded-[3rem] border-2 border-indigo-500/30 shadow-2xl flex flex-col items-center w-full max-w-4xl mt-4 md:mt-0">
                    <h2 className="text-lg md:text-2xl font-bold text-indigo-400 mb-2 md:mb-4 uppercase tracking-widest animate-pulse text-center">Đang đợi người chơi...</h2>
                    <div className="bg-[#020617] px-8 py-6 md:px-16 md:py-8 rounded-3xl md:rounded-[2rem] border-4 border-indigo-600 shadow-[0_0_50px_rgba(79,70,229,0.3)] mb-6 md:mb-8 text-center relative overflow-hidden group w-full sm:w-auto">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        <p className="text-slate-400 font-black text-xs md:text-sm uppercase tracking-widest mb-1 md:mb-2">Mã PIN Tham Gia</p>
                        <h1 className="text-6xl sm:text-7xl md:text-8xl font-black text-yellow-400 tracking-tighter drop-shadow-2xl font-mono">{pin}</h1>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 text-slate-300 mb-6 md:mb-8 bg-white/5 px-4 py-1.5 md:px-6 md:py-2 rounded-full border border-white/10">
                        <Users className="text-indigo-400 w-5 h-5 md:w-6 md:h-6" />
                        <span className="font-bold text-base md:text-xl"><span className="text-white text-xl md:text-2xl">{players.length}</span> người đã vào</span>
                    </div>
                    <button onClick={handleStartGame} className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white px-8 py-4 md:px-12 md:py-5 rounded-2xl font-black text-lg md:text-2xl shadow-[0_10px_30px_rgba(16,185,129,0.4)] flex items-center justify-center gap-2 md:gap-3 transform hover:scale-105 active:scale-95 transition-all uppercase italic">BẮT ĐẦU NGAY</button>
                </div>
                <div className="mt-6 md:mt-8 flex flex-wrap justify-center gap-2 md:gap-3 max-w-5xl">
                    {players.map((p) => (<div key={p.id} className="bg-white/10 backdrop-blur px-3 md:px-4 py-1.5 md:py-2 rounded-xl border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4"><img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`} className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-800" /><span className="font-bold text-xs md:text-sm">{p.name}</span></div>))}
                </div>
            </div>
        )}

        {/* PREPARE */}
        {gameState === 'PREPARE' && (
           <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-300 z-10">
              <h2 className="text-xl md:text-3xl text-orange-400 mb-4 md:mb-6 font-black uppercase italic tracking-[0.1em] md:tracking-[0.2em] animate-pulse">Sẵn sàng...</h2>
              <div className="w-40 h-40 md:w-64 md:h-64 rounded-full border-[6px] md:border-8 border-white/10 flex items-center justify-center bg-slate-900 shadow-[0_0_50px_rgba(249,115,22,0.4)]"><span className="text-[5rem] md:text-[8rem] font-black text-white">{timer}</span></div>
           </div>
        )}

        {/* QUESTION & RESULT */}
        {(gameState === 'QUESTION' || gameState === 'RESULT') && (
            <div className="flex flex-col h-full gap-2 md:gap-4 animate-in fade-in duration-500 pb-2">
                {viewMode === 'CLASSIC' && (
                    <div className="h-auto min-h-[20vh] max-h-[35vh] md:max-h-[40vh] bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-slate-800 text-center flex flex-col items-center justify-center shadow-2xl shrink-0 relative group overflow-y-auto custom-scrollbar">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none"></div>
                        <div className={`text-base md:text-3xl font-bold text-white leading-relaxed md:leading-normal relative z-10 overflow-x-auto break-words hide-scrollbar pb-1 w-full ${currentQuestion.q.includes('\n') ? 'whitespace-pre-wrap font-mono text-left text-sm md:text-lg' : 'italic'}`}>
                            {renderWithInlineImage(currentQuestion.q, currentQuestion.img)}
                        </div>
                        {currentQuestion.img && !currentQuestion.q.includes('[img]') && (
                            <img src={currentQuestion.img} className="max-h-32 md:max-h-48 w-auto rounded object-contain mt-2 md:mt-4 border border-white/10"/>
                        )}
                    </div>
                )}
                <div className="flex-1 min-h-0 relative z-10">
                    {viewMode === 'RACING' && <RacingView />}
                    {viewMode === 'MINER' && <GoldMinerView />}
                    {viewMode === 'TOWER' && <TowerView />}
                    
                    {viewMode === 'CLASSIC' && (
                        <div className="h-full w-full overflow-y-auto custom-scrollbar">
                            {/* Trắc nghiệm - Xếp dọc trên điện thoại */}
                            {currentQuestion.type === 'MCQ' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 pb-2">
                                    {currentQuestion.a.map((ans, idx) => (
                                        <div key={idx} className={`rounded-2xl md:rounded-[2rem] flex flex-col items-center justify-center text-sm md:text-2xl font-bold text-white p-3 md:p-6 text-center border-b-[4px] md:border-b-[8px] shadow-xl transition-all relative ${gameState === 'RESULT' ? (idx === currentQuestion.correct ? 'bg-green-600 border-green-800 opacity-100 scale-[1.02]' : 'bg-slate-700 border-slate-900 opacity-50') : 'bg-indigo-600/90 border-indigo-900 hover:bg-indigo-600'} min-h-[80px]`}>
                                          <div className="absolute top-2 left-2 md:top-4 md:left-4 w-6 h-6 md:w-10 md:h-10 rounded-full bg-black/20 flex items-center justify-center text-xs md:text-sm font-black">{String.fromCharCode(65+idx)}</div>
                                          <div className="w-full px-6 overflow-x-auto break-words hide-scrollbar pb-1">
                                             {renderWithInlineImage(ans, currentQuestion.aImages?.[idx])}
                                          </div>
                                          {currentQuestion.aImages?.[idx] && !ans.includes('[img]') && <img src={currentQuestion.aImages[idx]} className="max-h-16 md:max-h-20 w-auto mt-2 rounded bg-white p-1"/>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {/* Đúng/Sai - Table cuộn */}
                            {currentQuestion.type === 'TF' && (
                                <div className="bg-slate-800/60 rounded-2xl md:rounded-[2rem] p-2 md:p-8 border-2 border-white/5 overflow-hidden flex flex-col h-full">
                                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                                        <table className="w-full text-sm md:text-2xl text-left text-white min-w-[300px]">
                                            <thead><tr className="border-b-2 border-white/10 text-slate-400 uppercase text-xs md:text-sm tracking-widest"><th className="py-2 md:py-4 pl-2 md:pl-4">Nội dung</th><th className="py-2 md:py-4 text-center w-16 md:w-32">Đúng</th><th className="py-2 md:py-4 text-center w-16 md:w-32">Sai</th></tr></thead>
                                            <tbody>
                                                {currentQuestion.items.map((item, idx) => (
                                                    <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition">
                                                        <td className="py-3 md:py-6 pl-2 md:pl-4 font-bold max-w-[200px] overflow-x-auto break-words hide-scrollbar">
                                                            {renderWithInlineImage(item.text, item.img)}
                                                            {item.img && !item.text.includes('[img]') && <img src={item.img} className="max-h-16 mt-2 rounded border border-white/10"/>}
                                                        </td>
                                                        <td className="py-3 md:py-6 text-center"><div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg mx-auto flex items-center justify-center ${gameState === 'RESULT' && item.isTrue ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' : 'bg-slate-700'}`}>{gameState === 'RESULT' && item.isTrue && <Check className="w-5 h-5 md:w-7 md:h-7" strokeWidth={4}/>}</div></td>
                                                        <td className="py-3 md:py-6 text-center"><div className={`w-8 h-8 md:w-10 md:h-10 rounded-lg mx-auto flex items-center justify-center ${gameState === 'RESULT' && !item.isTrue ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' : 'bg-slate-700'}`}>{gameState === 'RESULT' && !item.isTrue && <Check className="w-5 h-5 md:w-7 md:h-7" strokeWidth={4}/>}</div></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            {/* Trả lời ngắn */}
                            {currentQuestion.type === 'SA' && (
                                <div className="h-full min-h-[150px] flex flex-col items-center justify-center bg-slate-800/60 rounded-2xl md:rounded-[2rem] border-2 border-dashed border-white/10 p-4">
                                    <div className="text-slate-400 uppercase font-black text-xs md:text-sm tracking-[0.2em] md:tracking-[0.5em] mb-4 md:mb-6 text-center">ĐÁP ÁN CHÍNH XÁC</div>
                                    <div className="bg-white text-slate-950 text-3xl md:text-6xl font-black px-6 py-4 md:px-16 md:py-8 rounded-2xl md:rounded-3xl shadow-[0_5px_0_#cbd5e1] md:shadow-[0_10px_0_#cbd5e1] min-w-[80%] md:min-w-[60%] text-center uppercase tracking-wider overflow-x-auto break-words hide-scrollbar">
                                        {gameState === 'RESULT' ? renderWithInlineImage(currentQuestion.correct) : "???"}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* FINISHED */}
        {gameState === 'FINISHED' && (
            <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-700 z-50 overflow-y-auto custom-scrollbar pb-10">
                <Trophy className="text-yellow-400 mb-4 md:mb-6 animate-bounce drop-shadow-[0_0_50px_rgba(250,204,21,0.6)] w-20 h-20 md:w-32 md:h-32" />
                <h2 className="text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-orange-400 italic uppercase mb-6 md:mb-8 tracking-tighter text-center leading-tight">BẢNG XẾP HẠNG</h2>
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-6 md:mb-8 w-full sm:w-auto px-4">
                     <button onClick={exportToExcel} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg transition transform hover:-translate-y-1 text-sm md:text-base"><FileSpreadsheet size={20}/> Xuất Excel</button>
                     <button onClick={() => router.push('/dashboard')} className="w-full sm:w-auto bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-black hover:bg-white shadow-lg transition uppercase text-center text-sm md:text-base">Kết thúc</button>
                </div>
                <div className="bg-slate-900/90 backdrop-blur-xl p-4 md:p-6 rounded-2xl md:rounded-[2rem] w-full max-w-2xl border border-white/10 shadow-2xl mx-2 md:mx-0">
                    {players.sort((a,b) => b.score - a.score).slice(0,5).map((p, idx) => (
                        <div key={p.id} className={`flex justify-between items-center p-3 md:p-4 border-b border-white/5 last:border-0 rounded-xl mb-1 md:mb-2 ${idx===0?'bg-yellow-500/10 border-yellow-500/30':''}`}>
                             <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                                 <span className={`text-lg md:text-2xl w-6 md:w-8 text-center shrink-0 ${idx===0?'text-2xl md:text-4xl':''}`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}</span>
                                 <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${p.name}`} className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 shrink-0" />
                                 <span className="font-black text-sm md:text-lg uppercase italic tracking-tighter text-slate-200 truncate">{p.name}</span>
                             </div>
                             <span className="text-orange-400 font-black text-lg md:text-2xl shrink-0 ml-2">{p.score}</span>
                        </div>
                    ))}
                    {players.length === 0 && <div className="text-center text-slate-500 py-6 text-sm">Chưa có người chơi nào.</div>}
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
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}