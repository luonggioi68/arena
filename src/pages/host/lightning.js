import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { db, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, update } from 'firebase/database';
import { Zap, Trophy, Flag, Lock, Home, Power, Clock, Shield, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LightningArenaHost() {
  const router = useRouter();
  const { id } = router.query;
  
  const [pin, setPin] = useState('');
  const [roomData, setRoomData] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  
  // Cấu hình game
  const [gameDuration, setGameDuration] = useState(300); 
  const [timeLeft, setTimeLeft] = useState(300);

  // 1. KHỞI TẠO PHÒNG
  useEffect(() => {
    if (!id) return;
    
    getDoc(doc(firestore, "quizzes", id)).then((snap) => {
        if (snap.exists()) {
            const qData = snap.data();
            const questions = qData.questions || [];
            setQuizQuestions(questions);
            
            const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
            setPin(generatedPin);
            
            const initialQuestions = questions.map(() => ({ winner: null, winnerName: null }));
            
            set(ref(db, `rooms/${generatedPin}`), { 
                status: 'LOBBY', 
                type: 'LIGHTNING', 
                quizData: questions,
                questionsState: initialQuestions,
                createdAt: Date.now() 
            });
        }
    });
  }, [id]);

  // 2. LẮNG NGHE DỮ LIỆU REALTIME
  useEffect(() => {
      if (!pin) return;
      const roomRef = ref(db, `rooms/${pin}`);
      return onValue(roomRef, (snap) => {
          const data = snap.val();
          if (data) {
              setRoomData(data);
          }
      });
  }, [pin]);

  // 3. LOGIC GAME LOOP (ĐỒNG HỒ & TỰ ĐỘNG KẾT THÚC)
  useEffect(() => {
      if (roomData?.status === 'PLAYING') {
          // A. Đếm ngược
          const timer = setInterval(() => {
              setTimeLeft((prev) => {
                  if (prev <= 1) {
                      finishGame();
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);

          // B. KIỂM TRA ĐIỀU KIỆN KẾT THÚC
          const totalQuestions = roomData.quizData?.length || 0;
          
          if (totalQuestions > 0 && roomData.questionsState) {
              const states = Array.isArray(roomData.questionsState) ? roomData.questionsState : Object.values(roomData.questionsState);
              const wonCount = states.filter(q => q && q.winner).length;

              if (wonCount >= totalQuestions) {
                  finishGame();
              } 
              else if (roomData.players) {
                  const players = Object.values(roomData.players);
                  if (players.length > 0) {
                      const allPlayersFinished = players.every(p => {
                          const pWrong = p.wrongCount || 0;
                          return (wonCount + pWrong) >= totalQuestions;
                      });

                      if (allPlayersFinished) {
                          finishGame();
                      }
                  }
              }
          }

          return () => clearInterval(timer);
      }
  }, [roomData?.status, roomData?.questionsState, roomData?.players]); 

  // 4. BẢNG XẾP HẠNG
  const sortedPlayers = useMemo(() => {
      if (!roomData?.players) return [];
      return Object.values(roomData.players).sort((a, b) => b.score - a.score);
  }, [roomData]); 

  // 5. HELPER: TÍNH TOÁN CỠ GRID TỰ ĐỘNG (KHÔNG CUỘN)
  const getGridConfig = (total) => {
      if (total <= 12) return { cols: 'grid-cols-4', text: 'text-3xl', p: 'p-4' };
      if (total <= 24) return { cols: 'grid-cols-6', text: 'text-xl', p: 'p-2' };
      if (total <= 48) return { cols: 'grid-cols-8', text: 'text-sm', p: 'p-1' };
      return { cols: 'grid-cols-10', text: 'text-[10px]', p: 'p-0.5' };
  }

  const gridConfig = getGridConfig(quizQuestions.length);

  // 6. ACTIONS
  const startGame = () => {
      update(ref(db, `rooms/${pin}`), { 
          status: 'PLAYING', 
          startTime: Date.now(),
          duration: gameDuration
      });
      setTimeLeft(gameDuration); 
  };

  const finishGame = () => {
      if (roomData?.status !== 'FINISHED') {
          update(ref(db, `rooms/${pin}`), { status: 'FINISHED' });
          confetti({ particleCount: 300, spread: 120, origin: { y: 0.6 } });
      }
  };

  const manualEndGame = () => {
      if(confirm("Dừng cuộc chơi ngay lập tức?")) finishGame();
  };

  const backToDashboard = () => {
      if(confirm("Rời khỏi phòng?")) router.push('/dashboard');
  };

  const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!roomData) return <div className="h-screen bg-black flex items-center justify-center text-cyan-500"><Zap size={60} className="animate-bounce"/></div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] flex flex-col">
      <header className="h-[90px] flex items-center justify-between px-6 bg-slate-900/90 border-b border-cyan-500/30 shadow-lg relative z-20 shrink-0">
          <div className="flex items-center gap-6">
              <button onClick={backToDashboard} className="bg-slate-800 p-3 rounded-xl border border-slate-600 hover:bg-slate-700 transition"><Home size={24}/></button>
              <div className="flex items-center gap-4">
                  <div className="bg-cyan-500 p-2 rounded-xl"><Zap size={28} className="text-black fill-current"/></div>
                  <div><h1 className="text-3xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">NHANH NHƯ CHỚP</h1></div>
              </div>
          </div>
          <div className="flex items-center gap-8">
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-slate-500 uppercase">Mã Phòng</span><span className="text-5xl font-black text-yellow-400 font-mono">{pin}</span></div>
              <div className="flex items-center gap-4 border-l border-white/10 pl-8">
                  {roomData.status === 'LOBBY' && (
                      <div className="flex items-center gap-4">
                          <div className="flex flex-col"><label className="text-[10px] font-bold text-slate-400 uppercase">Phút</label><input type="number" value={Math.floor(gameDuration / 60)} onChange={(e) => setGameDuration(Math.max(1, Number(e.target.value)) * 60)} className="bg-slate-800 text-white font-bold p-1 rounded border border-slate-600 w-16 text-center"/></div>
                          <button onClick={startGame} className="bg-green-600 hover:bg-green-500 text-white px-8 py-3 rounded-full font-black uppercase shadow-lg animate-pulse flex items-center gap-2"><Zap size={20} fill="currentColor"/> BẮT ĐẦU</button>
                      </div>
                  )}
                  {roomData.status === 'PLAYING' && (
                      <div className="flex items-center gap-6">
                          <div className={`flex items-center gap-2 text-4xl font-mono font-black ${timeLeft <= 30 ? 'text-red-500 animate-ping-slow' : 'text-cyan-400'}`}><Clock size={32}/> {formatTime(timeLeft)}</div>
                          <button onClick={manualEndGame} className="bg-red-600/20 hover:bg-red-600 border border-red-500 text-red-500 hover:text-white px-6 py-2 rounded-full font-bold uppercase text-xs flex items-center gap-2"><Power size={16}/> Kết thúc</button>
                      </div>
                  )}
                  {roomData.status === 'FINISHED' && <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-6 py-2 rounded-full font-black uppercase flex items-center gap-2 animate-bounce"><Trophy size={20}/> ĐÃ KẾT THÚC</div>}
              </div>
          </div>
      </header>

      <main className="flex-1 p-6 flex gap-6 overflow-hidden relative z-10">
          
          {/* CỘT TRÁI: BẢN ĐỒ TÀI NGUYÊN (KHÔNG CUỘN) */}
          <div className="flex-1 bg-slate-900/60 rounded-[2.5rem] border border-white/10 p-6 shadow-2xl backdrop-blur-md flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-center mb-4 shrink-0">
                  <h3 className="text-cyan-400 font-black uppercase flex items-center gap-2 text-lg"><Flag size={20}/> Bản đồ ({quizQuestions.length} ô)</h3>
                  <div className="flex gap-4 text-xs font-bold uppercase"><span className="flex items-center gap-1 text-slate-400"><div className="w-3 h-3 bg-slate-700 rounded border border-slate-600"></div> Chưa chiếm</span><span className="flex items-center gap-1 text-purple-400"><div className="w-3 h-3 bg-purple-900 rounded border border-purple-500"></div> Đã chiếm</span></div>
              </div>
              
              {/* KHU VỰC GRID: AUTO-FIT */}
              <div className="flex-1 overflow-hidden relative">
                  <div className={`w-full h-full grid ${gridConfig.cols} gap-2 content-start`}>
                      {quizQuestions.map((_, idx) => { 
                          const qState = roomData.questionsState?.[idx] || {}; 
                          const hasWinner = !!qState.winner; 
                          return (
                              <div key={idx} className={`relative rounded-xl border flex flex-col items-center justify-center transition-all shadow-md overflow-hidden aspect-video ${hasWinner ? 'bg-purple-900/80 border-purple-500' : 'bg-slate-800 border-slate-700 opacity-60'}`}>
                                  {hasWinner ? (
                                      <>
                                          <div className="absolute top-1 right-1"><Lock size={10} className="text-purple-300"/></div>
                                          <span className={`${gridConfig.text} font-black text-white z-10`}>{idx + 1}</span>
                                          <div className="absolute bottom-0 w-full bg-black/70 py-0.5 text-center"><span className="text-[8px] font-black text-purple-300 uppercase truncate px-1 block">{qState.winnerName}</span></div>
                                      </>
                                  ) : (<span className={`${gridConfig.text} font-black text-slate-600`}>{idx + 1}</span>)}
                              </div>
                          ); 
                      })}
                  </div>
              </div>
          </div>

          <div className="w-[400px] bg-black/40 rounded-[2.5rem] border-l-4 border-cyan-500 p-6 flex flex-col shadow-2xl backdrop-blur-md shrink-0">
              <h3 className="text-yellow-400 font-black uppercase mb-6 flex items-center gap-2 text-xl border-b border-white/10 pb-4"><Trophy size={24}/> Top Chiến Binh</h3>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-4">
                  {sortedPlayers.map((p, idx) => (
                      <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border relative overflow-hidden group ${idx === 0 ? 'bg-yellow-900/30 border-yellow-500/50' : 'bg-slate-800/60 border-white/5'}`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${idx === 0 ? 'bg-yellow-400' : 'bg-slate-600'}`}></div>
                          <div className="flex items-center gap-4 relative z-10 pl-2">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg border shadow-inner ${idx === 0 ? 'bg-yellow-500 text-black border-yellow-300' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{idx + 1}</div>
                              <div><div className="font-bold text-white uppercase text-base truncate max-w-[140px]">{p.name}</div><div className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 font-bold uppercase"><Shield size={10}/> Chiếm: <span className="text-cyan-400">{p.captured || 0}</span></div></div>
                          </div>
                          <div className="font-black text-cyan-400 text-2xl relative z-10 font-mono">{p.score}</div>
                      </div>
                  ))}
              </div>
          </div>
      </main>
  </div>
  );
}