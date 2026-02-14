import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { db, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, update } from 'firebase/database';
import { Zap, Trophy, Flag, Lock, Home, Power, Clock, Shield, AlertTriangle, FileSpreadsheet, Download, Users } from 'lucide-react';
import confetti from 'canvas-confetti';
import * as XLSX from 'xlsx';

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

  // 3. LOGIC GAME LOOP
  useEffect(() => {
      if (roomData?.status === 'PLAYING') {
          const timer = setInterval(() => {
              setTimeLeft((prev) => {
                  if (prev <= 1) {
                      finishGame();
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);

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

  // 5. HELPER: GRID CONFIG TỐI ƯU MOBILE
  const getGridConfig = (total) => {
      if (total <= 12) return { cols: 'grid-cols-3 md:grid-cols-4', text: 'text-xl md:text-3xl' };
      if (total <= 24) return { cols: 'grid-cols-4 md:grid-cols-6', text: 'text-sm md:text-xl' };
      if (total <= 48) return { cols: 'grid-cols-6 md:grid-cols-8', text: 'text-xs md:text-sm' };
      return { cols: 'grid-cols-6 lg:grid-cols-10', text: 'text-[10px]' };
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

  const handleExportExcel = () => {
      if (!roomData?.players) return alert("Chưa có dữ liệu người chơi!");

      const dataToExport = sortedPlayers.map((p, index) => ({
          "Xếp Hạng": index + 1,
          "Tên Chiến Binh": p.name,
          "Tổng Điểm": p.score,
          "Số Ô Chiếm Được": p.captured || 0,
          "Số Câu Sai": p.wrongCount || 0
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KetQua");
      XLSX.writeFile(wb, `KetQua_Arena_${pin}.xlsx`);
  };

  const formatTime = (seconds) => {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!roomData) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500"><Zap size={60} className="animate-bounce"/></div>;

  return (
    <div className="min-h-screen lg:h-screen bg-[#050505] text-white font-sans overflow-y-auto lg:overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] flex flex-col pb-10 lg:pb-0">
      
      {/* HEADER: RESPONSIVE */}
      <header className="py-4 lg:h-[90px] flex flex-col lg:flex-row items-center justify-between px-4 lg:px-6 bg-slate-900/90 border-b border-cyan-500/30 shadow-lg relative z-20 shrink-0 gap-4 lg:gap-0">
          
          {/* Khu vực Trái: Nút Home, Tiêu đề, và Mã PIN (Trên Mobile) */}
          <div className="flex w-full lg:w-auto items-center justify-between lg:justify-start gap-4">
              <div className="flex items-center gap-2 lg:gap-4">
                  <button onClick={backToDashboard} className="bg-slate-800 p-2.5 lg:p-3 rounded-xl border border-slate-600 hover:bg-slate-700 transition"><Home size={20} className="lg:w-6 lg:h-6"/></button>
                  <div className="flex items-center gap-2 lg:gap-4">
                      <div className="bg-cyan-500 p-1.5 lg:p-2 rounded-xl"><Zap size={20} className="lg:w-7 lg:h-7 text-black fill-current"/></div>
                      <div><h1 className="text-xl lg:text-3xl font-black italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 truncate max-w-[140px] sm:max-w-none">NHANH NHƯ CHỚP</h1></div>
                  </div>
              </div>
              
              {/* PIN hiển thị trên Mobile để tiết kiệm không gian */}
              <div className="flex flex-col items-end lg:hidden">
                 <span className="text-[10px] font-bold text-slate-500 uppercase leading-tight">Mã Phòng</span>
                 <span className="text-3xl font-black text-yellow-400 font-mono leading-none">{pin}</span>
              </div>
          </div>

          {/* Khu vực Phải: Controls và Mã PIN (Trên PC) */}
          <div className="flex w-full lg:w-auto items-center justify-between lg:justify-end gap-4 lg:gap-8">
              
              {/* PIN hiển thị trên PC */}
              <div className="hidden lg:flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Mã Phòng</span>
                  <span className="text-5xl font-black text-yellow-400 font-mono leading-none">{pin}</span>
              </div>
              
              <div className="flex items-center justify-between w-full lg:w-auto gap-4 lg:border-l lg:border-white/10 lg:pl-8">
                  {roomData.status === 'LOBBY' && (
                      <div className="flex items-center justify-between lg:justify-start w-full gap-4">
                          <div className="flex flex-col items-center lg:items-start">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">Phút</label>
                              <input type="number" value={Math.floor(gameDuration / 60)} onChange={(e) => setGameDuration(Math.max(1, Number(e.target.value)) * 60)} className="bg-slate-800 text-white font-bold p-1 md:p-2 rounded border border-slate-600 w-16 text-center outline-none focus:border-cyan-500"/>
                          </div>
                          <button onClick={startGame} className="flex-1 lg:flex-none bg-green-600 hover:bg-green-500 text-white px-6 lg:px-8 py-2.5 lg:py-3 rounded-full font-black uppercase shadow-lg animate-pulse flex items-center justify-center gap-2 text-sm lg:text-base"><Zap size={20} fill="currentColor"/> BẮT ĐẦU</button>
                      </div>
                  )}
                  {roomData.status === 'PLAYING' && (
                      <div className="flex items-center justify-between w-full gap-4 lg:gap-6">
                          <div className={`flex items-center gap-2 text-3xl lg:text-4xl font-mono font-black ${timeLeft <= 30 ? 'text-red-500 animate-ping-slow' : 'text-cyan-400'}`}><Clock size={24} className="lg:w-8 lg:h-8"/> {formatTime(timeLeft)}</div>
                          <button onClick={manualEndGame} className="bg-red-600/20 hover:bg-red-600 border border-red-500 text-red-500 hover:text-white px-4 lg:px-6 py-2 rounded-full font-bold uppercase text-xs flex items-center gap-2 transition-colors"><Power size={16}/> <span className="hidden sm:inline">Kết thúc</span></button>
                      </div>
                  )}
                  {roomData.status === 'FINISHED' && (
                      <div className="w-full flex justify-center">
                          <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-6 py-2 rounded-full font-black uppercase flex items-center justify-center gap-2 animate-bounce text-sm lg:text-base"><Trophy size={20}/> ĐÃ KẾT THÚC</div>
                      </div>
                  )}
              </div>
          </div>
      </header>

      {/* MAIN: FLEX-COL TRÊN MOBILE, FLEX-ROW TRÊN PC */}
      <main className="flex-1 p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 overflow-hidden relative z-10">
          
          {/* CỘT BẢN ĐỒ TÀI NGUYÊN */}
          <div className="flex-1 bg-slate-900/60 rounded-[1.5rem] lg:rounded-[2.5rem] border border-white/10 p-4 lg:p-6 shadow-2xl backdrop-blur-md flex flex-col relative overflow-hidden min-h-[350px] lg:min-h-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 shrink-0">
                  <h3 className="text-cyan-400 font-black uppercase flex items-center gap-2 text-base lg:text-lg"><Flag size={18} className="lg:w-5 lg:h-5"/> Bản đồ ({quizQuestions.length} ô)</h3>
                  <div className="flex gap-4 text-[10px] lg:text-xs font-bold uppercase"><span className="flex items-center gap-1 text-slate-400"><div className="w-2.5 h-2.5 lg:w-3 lg:h-3 bg-slate-700 rounded border border-slate-600"></div> Chưa chiếm</span><span className="flex items-center gap-1 text-purple-400"><div className="w-2.5 h-2.5 lg:w-3 lg:h-3 bg-purple-900 rounded border border-purple-500"></div> Đã chiếm</span></div>
              </div>
              
              {/* Vùng Map cho phép scroll nếu chia quá nhiều dòng trên mobile */}
              <div className="flex-1 overflow-y-auto custom-scrollbar relative pr-1">
                  <div className={`w-full grid ${gridConfig.cols} gap-2 content-start pb-4`}>
                      {quizQuestions.map((_, idx) => { 
                          const qState = roomData.questionsState?.[idx] || {}; 
                          const hasWinner = !!qState.winner; 
                          return (
                              <div key={idx} className={`relative rounded-lg lg:rounded-xl border flex flex-col items-center justify-center transition-all shadow-md overflow-hidden aspect-video ${hasWinner ? 'bg-purple-900/80 border-purple-500' : 'bg-slate-800 border-slate-700 opacity-60'}`}>
                                  {hasWinner ? (
                                      <>
                                          <div className="absolute top-0.5 right-0.5 lg:top-1 lg:right-1"><Lock size={8} className="text-purple-300 lg:w-2.5 lg:h-2.5"/></div>
                                          <span className={`${gridConfig.text} font-black text-white z-10`}>{idx + 1}</span>
                                          <div className="absolute bottom-0 w-full bg-black/70 py-0.5 text-center"><span className="text-[6px] lg:text-[8px] font-black text-purple-300 uppercase truncate px-1 block">{qState.winnerName}</span></div>
                                      </>
                                  ) : (<span className={`${gridConfig.text} font-black text-slate-600`}>{idx + 1}</span>)}
                              </div>
                          ); 
                      })}
                  </div>
              </div>
          </div>

          {/* CỘT BẢNG XẾP HẠNG */}
          <div className="w-full lg:w-[350px] xl:w-[400px] h-[400px] lg:h-auto bg-black/40 rounded-[1.5rem] lg:rounded-[2.5rem] border-t-4 lg:border-t-0 lg:border-l-4 border-cyan-500 p-4 lg:p-6 flex flex-col shadow-2xl backdrop-blur-md shrink-0">
              <div className="flex justify-between items-center mb-4 lg:mb-6 border-b border-white/10 pb-3 lg:pb-4">
                  <div className="flex flex-col">
                      <h3 className="text-yellow-400 font-black uppercase flex items-center gap-2 text-base lg:text-xl"><Trophy size={20} className="lg:w-6 lg:h-6"/> Top Chiến Binh</h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex items-center gap-1"><Users size={12}/> {sortedPlayers.length} người chơi</span>
                  </div>
                  
                  <button 
                    onClick={handleExportExcel} 
                    className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg shadow-lg hover:shadow-emerald-500/30 transition-all flex items-center gap-2 group"
                    title="Xuất kết quả ra Excel"
                  >
                      <FileSpreadsheet size={18} className="group-hover:scale-110 transition-transform"/> 
                      <span className="text-[10px] lg:text-xs font-bold uppercase">Excel</span>
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 lg:space-y-3 custom-scrollbar pr-2 pb-2">
                  {sortedPlayers.map((p, idx) => (
                      <div key={p.id} className={`flex items-center justify-between p-3 lg:p-4 rounded-xl lg:rounded-2xl border relative overflow-hidden group ${idx === 0 ? 'bg-yellow-900/30 border-yellow-500/50' : 'bg-slate-800/60 border-white/5'}`}>
                          <div className={`absolute left-0 top-0 bottom-0 w-1 lg:w-1.5 ${idx === 0 ? 'bg-yellow-400' : 'bg-slate-600'}`}></div>
                          <div className="flex items-center gap-3 lg:gap-4 relative z-10 pl-2">
                              <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-lg lg:rounded-xl flex items-center justify-center font-black text-base lg:text-lg border shadow-inner ${idx === 0 ? 'bg-yellow-500 text-black border-yellow-300' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{idx + 1}</div>
                              <div>
                                  <div className="font-bold text-white uppercase text-sm lg:text-base truncate max-w-[120px] sm:max-w-[200px] lg:max-w-[140px]">{p.name}</div>
                                  <div className="text-[9px] lg:text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 lg:mt-1 font-bold uppercase">
                                      <Shield size={10}/> Chiếm: <span className="text-cyan-400">{p.captured || 0}</span>
                                      <span className="text-red-400 ml-2">Sai: {p.wrongCount || 0}</span>
                                  </div>
                              </div>
                          </div>
                          <div className="font-black text-cyan-400 text-xl lg:text-2xl relative z-10 font-mono">{p.score}</div>
                      </div>
                  ))}
                  {sortedPlayers.length === 0 && <div className="text-center text-slate-500 italic py-10 text-sm">Chưa có dữ liệu...</div>}
              </div>
          </div>
      </main>

      {/* CSS THANH CUỘN (Scrollbar) */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        @media (min-width: 1024px) { .custom-scrollbar::-webkit-scrollbar { width: 6px; } }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.2); }
      `}</style>
  </div>
  );
}