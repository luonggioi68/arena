import { useState, useEffect, useRef, useMemo } from 'react'; 
import { useRouter } from 'next/router';
import Link from 'next/link'; 
import { firestore } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'; 
import useAuthStore from '@/store/useAuthStore'; 
import { 
    FileText, ArrowLeft, CircleDashed, Gift, Grid3X3, CheckCircle, 
    XCircle, Lock, RefreshCcw, Gamepad2, Package, X, 
    DollarSign, Phone, Users, Bot, Trophy, Map, Check 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import JourneyGame from './journey';
import MathRender from '@/components/MathRender'; 

const styles = `
  .perspective-1000 { perspective: 1000px; }
  .transform-style-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
  .flip-card-inner { position: relative; width: 100%; height: 100%; text-align: center; transition: transform 0.6s; transform-style: preserve-3d; }
  .flipped .flip-card-inner { transform: rotateY(180deg); }
  .flip-card-front, .flip-card-back { position: absolute; width: 100%; height: 100%; -webkit-backface-visibility: hidden; backface-visibility: hidden; border-radius: 1rem; display: flex; align-items: center; justify-content: center; flex-direction: column; }
  .flip-card-front { background: linear-gradient(135deg, #f97316, #ef4444); color: white; }
  .flip-card-back { background-color: white; color: black; transform: rotateY(180deg); border: 4px solid #3b82f6; padding: 8px; }
  
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-card { animation: fadeInUp 0.5s ease-out forwards; }
  .mil-answer-clip { clip-path: polygon(5% 0, 95% 0, 100% 50%, 95% 100%, 5% 100%, 0 50%); }
  @media (min-width: 768px) {
    .mil-answer-clip { clip-path: polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%); }
  }
  .mil-gradient { background: radial-gradient(circle, #1e3a8a 0%, #020617 100%); }
  .animate-flash { animation: flash 0.5s infinite; }
  @keyframes flash { 0% { background-color: #fbbf24; } 50% { background-color: #d97706; } 100% { background-color: #fbbf24; } }
`;

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
                        {/* Chèn ảnh vào giữa */}
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

export default function ArcadeMode() {
  const router = useRouter();
  
  // [ĐÃ SỬA LỖI] Gộp khai báo biến tại đây (id, game, from)
  const { id, game, from } = router.query;

  const [quiz, setQuiz] = useState(null);
  const [mode, setMode] = useState('MENU'); 
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuthStore();

  const handleAddXP = async (amount = 50) => {
      if (!user) return; 
      try {
          const studentRef = doc(firestore, "student_profiles", user.uid);
          await updateDoc(studentRef, {
              totalScore: increment(amount)
          });
      } catch (e) {
          console.error("Lỗi cộng điểm:", e);
      }
  };

  useEffect(() => {
      if (router.isReady && game) {
          setMode(game);
      }
  }, [router.isReady, game]);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(firestore, "quizzes", id)).then((snap) => {
        if (snap.exists()) setQuiz(snap.data());
        setLoading(false);
    });
  }, [id]);

  // HÀM XỬ LÝ QUAY LẠI (Sửa logic điều hướng)
  const handleBack = () => {
      // ƯU TIÊN 1: Nếu có cờ 'from=dashboard' -> Về thẳng Kho Vũ Khí
      if (from === 'dashboard') {
          router.push('/dashboard'); 
          return;
      }

      // ƯU TIÊN 2: Mặc định về Lobby (Sảnh chọn game)
      if (id) {
          router.push(`/arcade/lobby/${id}`);
      } 
      // DỰ PHÒNG: Về trang luyện tập học sinh
      else {
          router.push('/training');
      }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white font-bold text-xl"><div className="animate-spin mr-2">⏳</div> Đang tải dữ liệu...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans overflow-hidden flex flex-col">
      <style>{styles}</style>
      
      {/* HEADER */}
      {mode !== 'MILLIONAIRE' && (
          <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-700 shadow-md z-50 relative shrink-0">
            <button onClick={handleBack} className="flex items-center gap-2 hover:text-yellow-400 font-bold transition uppercase text-sm">
                <ArrowLeft size={20} /> {from === 'dashboard' ? 'Về Kho Vũ Khí' : (mode === 'MENU' ? 'Quay lại Lớp' : 'Chọn game khác')}
            </button>
            <h1 className="text-lg md:text-xl font-black truncate max-w-md uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {quiz?.title} <span className="text-slate-500 mx-2">|</span> KHO GAME - VUI HỌC 
            </h1>
          </div>
      )}

      {/* MENU CHỌN GAME */}
      {mode === 'MENU' && (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center custom-scrollbar">
            <div className="max-w-6xl w-full">
                <div className="text-center mb-10">
                    <Gamepad2 size={60} className="mx-auto mb-4 text-purple-500"/>
                    <h1 className="text-3xl md:text-5xl font-black mb-2 text-white uppercase italic tracking-tighter">CHỌN THỬ THÁCH</h1>
                    <p className="text-slate-400 text-sm md:text-base">Vừa học vừa chơi - Sảng khoái tinh thần</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 px-4 pb-10">
                    <GameCard title="Arena Thi Online" desc="Mô phỏng thi thật" icon={<FileText size={48}/>} color="from-red-600 to-rose-900" onClick={() => router.push(`/arcade/exam/${id}`)} delay={0} special={true} />
                    <GameCard title="Triệu Phú" desc="Trí tuệ & Kịch tính" icon={<DollarSign size={48}/>} color="from-blue-600 to-indigo-900" onClick={() => setMode('MILLIONAIRE')} delay={100} special={true} />
                    <GameCard title="Vòng Quay" desc="Ngẫu nhiên & May mắn" icon={<CircleDashed size={48}/>} color="from-pink-500 to-rose-600" onClick={() => setMode('WHEEL')} delay={200} />
                    
                    {/* Game 4: Hành Trình Vượt Ải */}
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl overflow-hidden border-2 border-indigo-500/30 group hover:border-indigo-400 transition-all shadow-2xl animate-card h-64 flex flex-col relative" style={{ animationDelay: '300ms' }}>
                        <div className="h-32 bg-slate-800 relative overflow-hidden">
                             <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-indigo-600 opacity-80"></div>
                             <Map className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20 rotate-12" size={80} />
                             <span className="absolute top-3 right-3 bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg animate-bounce">Mới</span>
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between bg-[#0f172a]">
                            <div>
                                <h3 className="text-lg font-black text-white uppercase leading-tight mb-1">Hành Trình Vượt Ải</h3>
                                <p className="text-slate-400 text-[10px] uppercase font-bold">Phiêu lưu & Chinh phục</p>
                            </div>
                            <button onClick={() => setMode('JOURNEY')} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold uppercase text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2">
                                <Gamepad2 size={16}/> Chơi Ngay
                            </button>
                        </div>
                    </div>

                    <GameCard title="Hộp Bí Mật" desc="Hồi hộp & Bất ngờ" icon={<Gift size={48}/>} color="from-violet-500 to-purple-600" onClick={() => setMode('BOX')} delay={400} />
                  
                </div>
            </div>
        </div>
      )}

      {/* KHU VỰC RENDER GAME */}
      <div className="flex-1 relative bg-slate-900 overflow-hidden">
        {mode === 'WHEEL' && <LuckyWheelGame questions={quiz.questions} onAddXP={handleAddXP} onExit={handleBack}/>}
        {mode === 'BOX' && <MysteryBoxGame questions={quiz.questions} onAddXP={handleAddXP} onExit={handleBack}/>}
        {mode === 'MATCH' && <MemoryMatchGame questions={quiz.questions} onAddXP={handleAddXP} onExit={handleBack} />}
        {mode === 'MILLIONAIRE' && <MillionaireGame questions={quiz.questions} onAddXP={handleAddXP} onExit={handleBack}/>}
        {mode === 'JOURNEY' && <JourneyGame questions={quiz.questions} onBack={handleBack} onExit={handleBack} />}
      </div>
    </div>
  );
}

const GameCard = ({ title, desc, icon, color, onClick, delay, special }) => (
    <button onClick={onClick} className={`group relative h-64 bg-gradient-to-br ${color} rounded-3xl p-6 flex flex-col items-center justify-center hover:scale-105 transition-all duration-300 shadow-2xl border-4 ${special ? 'border-yellow-400 animate-pulse' : 'border-white/10'} hover:border-white/40 animate-card`} style={{ animationDelay: `${delay}ms` }}>
        {special && <div className="absolute -top-3 -right-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase shadow-lg animate-bounce">Hot</div>}
        <div className="mb-4 p-4 bg-black/20 rounded-full group-hover:rotate-12 transition duration-500 shadow-inner text-white">{icon}</div>
        <h2 className="text-xl md:text-2xl font-black uppercase text-center mb-2 drop-shadow-md text-white tracking-tight">{title}</h2>
        <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">{desc}</p>
    </button>
);

// ====================================================================================
// GAME COMPONENTS
// ====================================================================================

// GAME: AI LÀ TRIỆU PHÚ
function MillionaireGame({ questions, onExit, onAddXP }) { 
    const [level, setLevel] = useState(0); 
    const [status, setStatus] = useState('PLAYING'); 
    const [selectedAns, setSelectedAns] = useState(null); 
    const [tfSelection, setTfSelection] = useState({});   
    const [saInput, setSaInput] = useState("");
    const [locked, setLocked] = useState(false); 
    const [lifelines, setLifelines] = useState({ fifty: true, phone: true, audience: true, ai: true });
    const [hiddenOptions, setHiddenOptions] = useState([]); 
    const [modal, setModal] = useState(null);

    useEffect(() => {
        if (status === 'WIN') {
            onAddXP(500); 
        } else if (status === 'WALK_AWAY') {
            const xpEarned = level * 10; 
            if (xpEarned > 0) onAddXP(xpEarned);
        }
    }, [status]);

    const audioRefs = useRef({
        bg: new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3'),
        correct: new Audio('https://actions.google.com/sounds/v1/cartoon/magic_chime.ogg'),
        wrong: new Audio('https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg'),
        lock: new Audio('https://actions.google.com/sounds/v1/cartoon/pop_cork.ogg')
    });

    useEffect(() => {
        const bgAudio = audioRefs.current.bg;
        bgAudio.loop = true;
        bgAudio.volume = 0.3;
        bgAudio.play().catch(() => {});
        return () => { bgAudio.pause(); bgAudio.currentTime = 0; };
    }, []);

    const REWARDS = [
        "200.000", "400.000", "600.000", "1.000.000", "2.000.000", 
        "3.000.000", "6.000.000", "10.000.000", "14.000.000", "22.000.000", 
        "30.000.000", "40.000.000", "60.000.000", "85.000.000", "100.000.000"
    ];

    const moneyTree = useMemo(() => {
        const ladder = [];
        for (let i = 0; i < 15; i++) {
            ladder.push({ level: i, money: REWARDS[i], safe: (i + 1) % 5 === 0 });
        }
        return ladder.reverse(); 
    }, []);

    const currentMoneyDisplay = REWARDS[level] || REWARDS[REWARDS.length - 1];
    const currentQ = questions[level];
    
    useEffect(() => {
        if (!currentQ && status === 'PLAYING') {
             setStatus('WIN');
             audioRefs.current.bg.pause();
             confetti({ particleCount: 500, spread: 150, origin: { y: 0.6 } });
        }
    }, [currentQ, status]);

    const options = useMemo(() => {
        if (!currentQ) return [];
        if (currentQ.type === 'MCQ' && currentQ.a) return currentQ.a;
        return ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"]; 
    }, [currentQ]);

    const getAnswerLabel = (idx) => String.fromCharCode(65 + idx);

    const handleSelectMCQ = (idx) => {
        if (locked || hiddenOptions.includes(idx)) return;
        setSelectedAns(idx);
    };

    const handleSelectTF = (idx, value) => {
        if (locked) return;
        setTfSelection(prev => ({ ...prev, [idx]: value }));
    };

    const handleLock = () => {
        if (currentQ.type === 'MCQ' && selectedAns === null) return;
        if (currentQ.type === 'TF' && currentQ.items && Object.keys(tfSelection).length < currentQ.items.length) return;
        if (currentQ.type === 'SA' && !saInput.trim()) return;
        setLocked(true);
        audioRefs.current.lock.play();
        audioRefs.current.bg.volume = 0.1;

        setTimeout(() => {
            let isCorrect = false;
            if (currentQ.type === 'MCQ') {
                const correctIdx = parseInt(currentQ.correct); 
                isCorrect = (selectedAns === correctIdx);
            } else if (currentQ.type === 'TF') {
                isCorrect = currentQ.items.every((item, idx) => {
                    return String(item.isTrue) === tfSelection[idx];
                });
            }
            else if (currentQ.type === 'SA') {
                const userAnswer = saInput.trim().toLowerCase();
                const trueAnswer = String(currentQ.correct).trim().toLowerCase();
                isCorrect = (userAnswer === trueAnswer);
            }
            if (isCorrect) {
                audioRefs.current.correct.play();
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
                setTimeout(() => {
                    if (level < questions.length - 1 && level < 14) {
                        setLevel(prev => prev + 1);
                        setLocked(false);
                        setSelectedAns(null);
                        setTfSelection({});
                        setHiddenOptions([]);
                        setSaInput("");
                        audioRefs.current.bg.volume = 0.3;
                    } else {
                        setStatus('WIN');
                        audioRefs.current.bg.pause();
                        confetti({ particleCount: 500, spread: 150, origin: { y: 0.6 } });
                    }
                }, 2000);
            } else {
                audioRefs.current.wrong.play();
                audioRefs.current.bg.pause();
                setStatus('LOSE');
            }
        }, 2500);
    };

    const handleWalkAway = () => {
        if (confirm("Bạn chắc chắn muốn dừng cuộc chơi và bảo toàn tiền thưởng?")) {
            setStatus('WALK_AWAY');
            audioRefs.current.bg.pause();
        }
    }

    const use5050 = () => {
        if (!lifelines.fifty || locked || currentQ.type !== 'MCQ') return;
        setLifelines(prev => ({ ...prev, fifty: false }));
        const correctIdx = parseInt(currentQ.correct);
        const wrongs = [0, 1, 2, 3].filter(i => i !== correctIdx);
        const shuffledWrongs = wrongs.sort(() => 0.5 - Math.random()).slice(0, 2);
        setHiddenOptions(shuffledWrongs);
    };

    const useAudience = () => {
        if (!lifelines.audience || locked) return;
        setLifelines(prev => ({ ...prev, audience: false }));
        let stats = [0, 0, 0, 0];
        if (currentQ.type === 'MCQ') {
            const correctIdx = parseInt(currentQ.correct);
            stats[correctIdx] = 40 + Math.floor(Math.random() * 40); 
            let remaining = 100 - stats[correctIdx];
            [0, 1, 2, 3].forEach(i => {
                if (i !== correctIdx) {
                    if (hiddenOptions.includes(i)) stats[i] = 0; 
                    else {
                        const r = Math.floor(Math.random() * remaining);
                        stats[i] = r;
                        remaining -= r;
                    }
                }
            });
            const lastWrong = stats.findIndex((v, i) => i !== correctIdx && !hiddenOptions.includes(i) && v === 0);
            if(lastWrong !== -1) stats[lastWrong] += remaining;
        } else {
            stats = [25, 25, 25, 25];
        }
        setModal({ type: 'AUDIENCE', data: stats });
    };

    const usePhone = () => {
        if (!lifelines.phone || locked) return;
        setLifelines(prev => ({ ...prev, phone: false }));
        let finalAns = 0;
        if (currentQ.type === 'MCQ') {
            const correctIdx = parseInt(currentQ.correct);
            const isCorrect = Math.random() > 0.3; 
            finalAns = isCorrect ? correctIdx : Math.floor(Math.random() * 4);
        }
        setModal({ type: 'PHONE', data: finalAns });
    };

    const useAI = () => {
        if (!lifelines.ai || locked) return;
        setLifelines(prev => ({ ...prev, ai: false }));
        let suggestion = 0;
        if (currentQ.type === 'MCQ') {
            const correctIdx = parseInt(currentQ.correct);
            const isSmart = Math.random() > 0.1;
            suggestion = isSmart ? correctIdx : Math.floor(Math.random() * 4);
        }
        setModal({ type: 'AI', data: { suggestion, confidence: 85 + Math.floor(Math.random()*14) } });
    };

    if (status === 'WIN' || status === 'LOSE' || status === 'WALK_AWAY') {
        let prize = "0";
        if (status === 'WIN') {
            prize = REWARDS[level] || REWARDS[REWARDS.length-1]; 
        } else if (status === 'WALK_AWAY') {
            if (level > 0) prize = REWARDS[level - 1];
        } else { 
            if (level >= 10) prize = REWARDS[9]; 
            else if (level >= 5) prize = REWARDS[4]; 
            else prize = "0";
        }

        return (
            <div className="h-screen w-full mil-gradient flex flex-col items-center justify-center text-white z-50 fixed top-0 left-0 animate-in zoom-in duration-500">
                <Trophy size={120} className="text-yellow-400 mb-6 animate-bounce drop-shadow-[0_0_50px_rgba(250,204,21,0.8)]"/>
                <h1 className="text-6xl font-black mb-4 uppercase text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-lg">
                    {status === 'WIN' ? "TRIỆU PHÚ!" : status === 'WALK_AWAY' ? "DỪNG CUỘC CHƠI" : "RẤT TIẾC!"}
                </h1>
                
                <div className="flex flex-col items-center gap-2 mb-10">
                    <span className="text-lg uppercase tracking-widest text-slate-300 font-bold">Bạn nhận được tiền thưởng</span>
                    <div className="text-7xl font-black text-yellow-400 bg-black/40 px-12 py-8 rounded-3xl border-4 border-yellow-600 shadow-[0_0_60px_rgba(234,179,8,0.5)] mt-4 animate-pulse">
                        {prize} <span className="text-3xl align-top text-white">VND</span>
                    </div>
                </div>
                <button onClick={onExit} className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 px-10 py-4 rounded-full font-black uppercase transition shadow-xl text-xl flex items-center gap-3">
                    <RefreshCcw size={24}/> Chơi Lại
                </button>
            </div>
        );
    }

    if (!currentQ) return null; 

    return (
        <div className="h-full w-full mil-gradient text-white flex flex-col md:flex-row overflow-hidden font-sans relative">
            <div className="flex-1 flex flex-col relative z-10 p-2 md:p-6 overflow-y-auto custom-scrollbar h-full">
                <div className="flex justify-between items-center mb-2 shrink-0">
                    <div onClick={handleWalkAway} className="bg-black/40 rounded-full px-4 py-2 border border-white/20 flex items-center gap-2 cursor-pointer hover:bg-red-900/50 transition">
                        <X size={20}/> <span className="font-bold text-sm uppercase text-slate-300 hidden md:inline">Dừng</span>
                    </div>
                    <div className="flex flex-col items-center justify-center relative z-20">
                        <div className="bg-gradient-to-b from-blue-600 to-blue-900 rounded-full px-6 md:px-8 py-2 md:py-3 border-4 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)] min-w-[150px] md:min-w-[200px] text-center transform hover:scale-105 transition duration-300">
                            <span className="text-xl md:text-3xl font-black text-white drop-shadow-md">{currentMoneyDisplay}</span>
                        </div>
                    </div>
                    <div className="w-16 md:w-32"></div>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center py-4">
                    <div className="w-full bg-blue-900/90 border-2 border-slate-300 rounded-2xl p-4 md:p-8 text-center shadow-[0_0_40px_rgba(30,58,138,0.6)] relative mb-4 mil-answer-clip min-h-[120px] flex flex-col items-center justify-center">
                        <div className="absolute -left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
                        <h2 className="text-lg md:text-2xl font-bold leading-relaxed relative z-10 drop-shadow-md px-6 md:px-0">
                            {renderWithInlineImage(currentQ.q, currentQ.img)}
                        </h2>
                    </div>
                    {/* Ảnh khối cho câu hỏi nếu không có inline */}
                    {currentQ.img && !currentQ.q.includes('[img]') && (
                        <img src={currentQ.img} className="max-h-32 md:max-h-48 rounded-lg border-2 border-white/20 mb-4 bg-black/50 object-contain shadow-lg" />
                    )}
                </div>

                <div className="w-full max-w-5xl mx-auto mb-4 min-h-fit md:min-h-[160px] flex items-center justify-center">
                    {currentQ.type === 'MCQ' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 w-full">
                            {options.map((opt, idx) => {
                                const isHidden = hiddenOptions.includes(idx);
                                const isSelected = selectedAns === idx;
                                const isCorrect = parseInt(currentQ.correct) === idx;
                                let bgClass = "bg-slate-900 from-slate-800 to-slate-900 hover:from-blue-800 hover:to-blue-900"; 
                                if (isSelected) bgClass = "bg-yellow-600 from-yellow-600 to-orange-600 text-black animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.5)]"; 
                                if (locked && isCorrect) bgClass = "bg-green-600 from-green-500 to-emerald-700 animate-flash text-white shadow-[0_0_30px_rgba(34,197,94,0.8)] border-green-300"; 
                                if (locked && isSelected && !isCorrect) bgClass = "bg-red-600 from-red-600 to-rose-700 text-white animate-shake"; 
                                return (
                                    <button key={idx} onClick={() => handleSelectMCQ(idx)} disabled={locked || isHidden} className={`relative p-3 md:p-5 rounded-full border-2 ${isSelected ? 'border-yellow-400' : 'border-white/30'} flex items-center transition-all duration-200 group bg-gradient-to-b ${bgClass} ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100 shadow-lg'}`}>
                                        <span className={`font-black text-yellow-400 mr-2 md:mr-4 text-base md:text-xl ${isSelected || (locked && isCorrect) ? 'text-white' : ''}`}>{getAnswerLabel(idx)}:</span>
                                        {/* [UPDATED] Đáp án MCQ: Inline + Block fallback */}
                                        <span className="font-bold text-sm md:text-lg text-left flex-1 flex flex-col">
                                            {renderWithInlineImage(opt, currentQ.aImages?.[idx])}
                                            {currentQ.aImages?.[idx] && !opt.includes('[img]') && (
                                                <img src={currentQ.aImages[idx]} className="h-12 w-auto mt-1 rounded bg-white p-0.5 self-start" />
                                            )}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {currentQ.type === 'TF' && (
                        <div className="w-full bg-slate-900/80 p-4 rounded-2xl border-2 border-blue-500/30">
                            <div className="space-y-3">
                                {currentQ.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-slate-800 p-3 rounded-xl border border-white/10">
                                        {/* [UPDATED] Nội dung TF: Inline + Block fallback */}
                                        <span className="flex-1 font-bold text-base mr-4">
                                            {renderWithInlineImage(item.text, item.img)}
                                            {item.img && !item.text.includes('[img]') && (
                                                <img src={item.img} className="h-12 mt-1 rounded border border-white/20 block" />
                                            )}
                                        </span>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleSelectTF(idx, "true")} disabled={locked} className={`w-12 h-12 rounded-lg font-black border-2 transition-all ${tfSelection[idx] === "true" ? (locked && String(item.isTrue) === "true" ? 'bg-green-600 border-green-400' : locked && String(item.isTrue) !== "true" ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400 scale-110') : 'bg-slate-900 border-slate-700 text-slate-500'}`}>Đ</button>
                                            <button onClick={() => handleSelectTF(idx, "false")} disabled={locked} className={`w-12 h-12 rounded-lg font-black border-2 transition-all ${tfSelection[idx] === "false" ? (locked && String(item.isTrue) === "false" ? 'bg-green-600 border-green-400' : locked && String(item.isTrue) !== "false" ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400 scale-110') : 'bg-slate-900 border-slate-700 text-slate-500'}`}>S</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {currentQ.type === 'SA' && (
                        <div className="w-full max-w-2xl px-4">
                            <input 
                                value={saInput}
                                onChange={(e) => setSaInput(e.target.value)}
                                disabled={locked}
                                placeholder="NHẬP CÂU TRẢ LỜI CỦA BẠN..."
                                className={`
                                    w-full py-4 px-6 text-center text-xl md:text-3xl font-black uppercase rounded-full border-4 outline-none shadow-2xl transition-all duration-300
                                    ${locked 
                                        ? (saInput.trim().toLowerCase() === String(currentQ.correct).trim().toLowerCase()
                                            ? 'bg-green-600 border-green-400 text-white shadow-[0_0_50px_rgba(34,197,94,0.6)] scale-105' 
                                            : 'bg-red-600 border-red-400 text-white opacity-80') 
                                        : 'bg-slate-900/80 border-blue-500 text-yellow-400 focus:border-yellow-400 focus:shadow-[0_0_30px_rgba(234,179,8,0.5)] placeholder-slate-600' 
                                    }
                                `}
                            />
                            {locked && saInput.trim().toLowerCase() !== String(currentQ.correct).trim().toLowerCase() && (
                                <div className="mt-4 bg-yellow-500 text-black font-bold p-3 rounded-xl text-center animate-in slide-in-from-top shadow-lg">
                                    ĐÁP ÁN ĐÚNG: <span className="text-xl uppercase font-black">
                                        {renderWithInlineImage(currentQ.correct)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="h-16 flex justify-center items-center shrink-0">
                    {!locked && (<button onClick={handleLock} className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-black py-3 px-12 rounded-full text-xl shadow-[0_0_30px_rgba(234,179,8,0.8)] hover:scale-110 active:scale-95 transition-transform uppercase tracking-widest border-2 border-white animate-in zoom-in fade-in duration-300">CHỐT ĐÁP ÁN</button>)}
                </div>

                <div className={`flex justify-center gap-4 md:gap-8 mt-4 pb-4 ${currentQ.type === 'TF' ? 'opacity-50 pointer-events-none grayscale' : ''} shrink-0`}>
                    <LifelineButton icon={<div className="font-bold text-lg">50:50</div>} label="50:50" active={lifelines.fifty} onClick={use5050} />
                    <LifelineButton icon={<Users size={20}/>} label="Khán giả" active={lifelines.audience} onClick={useAudience} />
                    <LifelineButton icon={<Phone size={20}/>} label="Gọi điện" active={lifelines.phone} onClick={usePhone} />
                    <LifelineButton icon={<Bot size={20}/>} label="Hỏi AI" active={lifelines.ai} onClick={useAI} special />
                </div>
            </div>

            <div className="hidden md:flex w-72 bg-[#020617]/80 backdrop-blur-md border-l border-white/10 flex-col">
                <div className="p-4 text-center border-b border-white/10">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mục tiêu</div>
                    <div className="text-3xl font-black text-yellow-400">100 TRIỆU</div>
                </div>
                <div className="flex-1 flex flex-col-reverse justify-end p-4 gap-1 overflow-y-auto custom-scrollbar">
                    {moneyTree.map((m) => (
                        <div key={m.level} className={`flex justify-between items-center px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-300 ${m.level === level ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white scale-110 shadow-lg border border-yellow-400 z-10 my-1' : m.level < level ? 'text-slate-600' : m.safe ? 'text-white' : 'text-slate-400'}`}>
                            <span className={`${m.level === level ? 'text-white' : 'text-orange-500'} w-6`}>{m.level + 1}</span>
                            <span className={m.safe ? 'text-yellow-400' : ''}>{m.money}</span>
                        </div>
                    ))}
                </div>
            </div>

            {modal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
                    <div className="bg-slate-900 border-2 border-blue-500 rounded-2xl p-6 max-w-md w-full animate-in zoom-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-center text-yellow-400 mb-4 uppercase border-b border-white/10 pb-2">
                            {modal.type === 'AUDIENCE' && "Ý kiến khán giả"}
                            {modal.type === 'PHONE' && "Gọi điện thoại"}
                            {modal.type === 'AI' && "AI Phân tích"}
                        </h3>
                        {modal.type === 'AUDIENCE' && (
                            <div className="flex justify-around items-end h-40 gap-2">
                                {modal.data.map((percent, i) => (
                                    <div key={i} className="w-12 flex flex-col justify-end items-center">
                                        <div className="text-xs font-bold mb-1">{percent}%</div>
                                        <div className="w-full bg-blue-500 rounded-t-md transition-all duration-1000" style={{height: `${percent}%`}}></div>
                                        <div className="text-yellow-400 font-bold mt-1">{getAnswerLabel(i)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {modal.type === 'PHONE' && (
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black font-bold text-2xl">User</div>
                                <div className="bg-white text-black p-3 rounded-r-xl rounded-bl-xl text-sm">"Alo! Theo tớ nghĩ thì đáp án là <span className="font-black text-blue-600 text-lg">{getAnswerLabel(modal.data)}</span> nhé. Chắc chắn 80% đó!"</div>
                            </div>
                        )}
                        {modal.type === 'AI' && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-cyan-400"><Bot size={32} /><span className="font-mono text-sm">AI System analyzing...</span></div>
                                <p className="text-sm">Dựa trên cơ sở dữ liệu, tôi phân tích thấy đáp án <span className="font-black text-yellow-400 text-xl">{getAnswerLabel(modal.data.suggestion)}</span> có xác suất chính xác cao nhất.</p>
                                <div className="w-full bg-slate-700 h-2 rounded-full mt-2"><div className="bg-green-500 h-2 rounded-full" style={{width: `${modal.data.confidence}%`}}></div></div>
                                <div className="text-right text-xs text-green-400 mt-1">Độ tin cậy: {modal.data.confidence}%</div>
                            </div>
                        )}
                        <button onClick={() => setModal(null)} className="w-full mt-6 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg font-bold">Đóng</button>
                    </div>
                </div>
            )}
        </div>
    );
}
const LifelineButton = ({ icon, label, active, onClick, special }) => (
    <div className="flex flex-col items-center gap-1 group cursor-pointer" onClick={onClick}>
        <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full border-2 flex items-center justify-center transition-all ${active ? (special ? 'bg-purple-600 border-purple-400 hover:bg-purple-500' : 'bg-blue-900 border-blue-400 hover:bg-blue-800') : 'bg-slate-800 border-slate-600 opacity-50 cursor-not-allowed'} relative`}>
            {icon}
            {!active && <div className="absolute inset-0 flex items-center justify-center text-red-500"><X size={32} strokeWidth={3}/></div>}
        </div>
        <span className={`text-[10px] uppercase font-bold ${active ? 'text-slate-300' : 'text-slate-600'}`}>{label}</span>
    </div>
);

// ---------------- GAME: VÒNG QUAY MAY MẮN ----------------
function LuckyWheelGame({ questions, onAddXP, onExit }) {
    const [activeQuestions, setActiveQuestions] = useState(questions); 
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState(null);
    const [rotation, setRotation] = useState(0);
    const canvasRef = useRef(null);

    const handleSpin = () => {
        if (spinning || activeQuestions.length === 0) return;
        setSpinning(true);
        setResult(null);
        const randomSpins = 360 * (5 + Math.random() * 5); 
        const totalRotation = rotation + randomSpins + Math.random() * 360;
        setRotation(totalRotation);

        setTimeout(() => {
            setSpinning(false);
            const sliceSize = 360 / activeQuestions.length; 
            const index = Math.floor(((360 - (totalRotation % 360) + 90) % 360) / sliceSize);
            setResult(activeQuestions[index % activeQuestions.length]); 
        }, 5000);
    };

    const handleCloseModal = (isCorrect) => {
        if (isCorrect === true) {
            onAddXP(50); 
            setActiveQuestions(prev => prev.filter(q => q !== result));
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        setResult(null);
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const size = 500;
        const center = size / 2;
        const radius = size / 2 - 20;
        const total = activeQuestions.length; 
        
        canvas.width = size; canvas.height = size;
        if (total === 0) return;

        const slice = (2 * Math.PI) / total;
        const colors = ['#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#f97316'];
        
        activeQuestions.forEach((q, i) => {
            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, i * slice, (i + 1) * slice);
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#0f172a";
            ctx.stroke();
            ctx.save();
            ctx.translate(center, center);
            ctx.rotate(i * slice + slice / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = "#fff";
            ctx.font = "bold 24px Arial";
            ctx.fillText((i + 1).toString(), radius - 40, 10);
            ctx.restore();
        });
    }, [activeQuestions]);

    if (activeQuestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full animate-in zoom-in p-4 text-center">
                <div className="text-8xl mb-4 animate-bounce">🏆</div>
                <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-6 uppercase drop-shadow-sm">Hoàn thành xuất sắc!</h2>
                <p className="text-slate-400 mb-8 text-lg">Bạn đã chinh phục tất cả câu hỏi trong vòng quay may mắn.</p>
                <div className="flex flex-col md:flex-row gap-4 w-full max-w-md">
                    <button onClick={() => setActiveQuestions(questions)} className="flex-1 bg-white text-slate-900 px-6 py-4 rounded-xl font-bold hover:bg-gray-100 flex items-center justify-center gap-2 shadow-lg transition hover:-translate-y-1"><RefreshCcw size={20}/> Chơi lại</button>
                    <button onClick={onExit} className="flex-1 bg-slate-800 text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-700 flex items-center justify-center gap-2 shadow-lg transition hover:-translate-y-1 border border-slate-600"><ArrowLeft size={20}/> Về Sảnh</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full relative overflow-hidden py-10">
            <div className="absolute top-[10%] md:top-[5%] z-20 text-6xl text-yellow-400 drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">▼</div>
            <div className="relative transform transition-transform cubic-bezier(0.1, 0.7, 0.1, 1)" style={{ transform: `rotate(${rotation}deg)`, transitionDuration: '5000ms' }}>
                <canvas ref={canvasRef} className="rounded-full shadow-2xl border-8 border-slate-800 w-[300px] h-[300px] md:w-[500px] md:h-[500px]" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-16 h-16 md:w-20 md:h-20 rounded-full shadow-inner border-4 border-slate-200 flex items-center justify-center font-black text-slate-900 text-xl">Edu</div>
            </div>
            <button onClick={handleSpin} disabled={spinning} className="mt-8 md:mt-12 bg-gradient-to-r from-pink-500 to-orange-500 px-12 py-4 rounded-full font-black text-2xl shadow-[0_0_30px_rgba(236,72,153,0.5)] hover:scale-110 active:scale-95 transition disabled:opacity-50 disabled:scale-100 text-white border-4 border-white/20">{spinning ? 'ĐANG QUAY...' : 'QUAY NGAY'}</button>
            {result && <InteractiveQuestion data={result} onClose={handleCloseModal} gameType="WHEEL" />}
        </div>
    );
}

// ---------------- GAME: HỘP QUÀ BÍ MẬT ----------------
function MysteryBoxGame({ questions, onAddXP, onExit }) {
    const [boxes, setBoxes] = useState(questions.map((q, i) => ({ ...q, id: i, opened: false })));
    const [currentGift, setCurrentGift] = useState(null);
    const [finished, setFinished] = useState(false);

    useEffect(() => {
        if (boxes.length > 0 && boxes.every(b => b.opened) && !finished) {
            setTimeout(() => {
                setFinished(true);
                onAddXP(200); 
                confetti({ particleCount: 300, spread: 120, origin: { y: 0.6 } });
            }, 500);
        }
    }, [boxes, finished, onAddXP]);

    const handleResult = (isCorrect) => {
        if (isCorrect === true) {
            setBoxes(boxes.map(b => b.id === currentGift.id ? { ...b, opened: true } : b));
            onAddXP(50); 
        }
        setCurrentGift(null);
    };

    const handleReset = () => {
        setBoxes(questions.map((q, i) => ({ ...q, id: i, opened: false })));
        setFinished(false);
    };

    if (finished) {
        const totalXP = (questions.length * 50) + 200;
        return (
            <div className="flex flex-col items-center justify-center h-full animate-in zoom-in duration-500 text-center p-4">
                <div className="text-8xl mb-6 animate-bounce drop-shadow-2xl">🎁</div>
                <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-pink-500 mb-2 uppercase drop-shadow-sm">XUẤT SẮC!</h2>
                <p className="text-slate-300 text-sm md:text-lg mb-6 font-bold uppercase tracking-widest">Bạn đã mở khóa toàn bộ hộp bí mật</p>
                <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border border-yellow-500/30 p-4 rounded-2xl mb-8 flex flex-col items-center shadow-lg animate-pulse">
                    <span className="text-yellow-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Tổng phần thưởng</span>
                    <div className="text-4xl font-black text-yellow-300 drop-shadow-md">+{totalXP} XP</div>
                </div>
                <button onClick={handleReset} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-10 py-4 rounded-full font-black uppercase shadow-[0_0_30px_rgba(147,51,234,0.5)] transition transform hover:scale-105 flex items-center gap-3 border-2 border-white/20"><RefreshCcw size={24} /> Chơi Lại</button>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 h-full flex justify-center overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8 w-full max-w-6xl content-start">
                {boxes.map((box, idx) => (
                    <div key={idx} onClick={() => !box.opened && setCurrentGift(box)} className={`cursor-pointer transition-all duration-500 transform ${box.opened ? 'opacity-50 grayscale scale-95 cursor-default' : 'hover:scale-110 hover:-translate-y-2'}`}>
                        <div className="relative aspect-square">
                            {box.opened ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80 rounded-2xl border-2 border-slate-600"><CheckCircle size={48} className="text-green-500 mb-2"/><span className="text-sm font-bold text-gray-400 uppercase">Đã mở</span></div>
                            ) : (
                                <div className="w-full h-full bg-gradient-to-b from-purple-500 to-indigo-600 rounded-2xl shadow-2xl border-b-8 border-indigo-900 flex items-center justify-center relative group">
                                    <div className="absolute top-0 w-full h-1/3 bg-purple-400 rounded-t-2xl border-b-4 border-black/10 z-10"></div>
                                    <Gift size={56} className="text-yellow-400 drop-shadow-xl transform group-hover:scale-125 transition duration-300"/>
                                    <span className="absolute bottom-2 right-3 font-black text-2xl text-white/30">#{idx + 1}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {currentGift && <InteractiveQuestion data={currentGift} onClose={handleResult} gameType="BOX" />}
        </div>
    );
}



// --- COMPONENT POPUP TRẢ LỜI CÂU HỎI (Dùng cho Wheel & Box) ---
// --- COMPONENT POPUP TRẢ LỜI CÂU HỎI (ĐÃ FIX LỖI ẨN ĐÁP ÁN CHO BOX) ---
function InteractiveQuestion({ data, onClose, gameType }) {
    const [selectedIdx, setSelectedIdx] = useState(null); 
    const [saInput, setSaInput] = useState("");
    const [tfSelection, setTfSelection] = useState({});
    
    const [isLocked, setIsLocked] = useState(false); 
    const [isCorrect, setIsCorrect] = useState(null); 
    const labels = ['A', 'B', 'C', 'D'];

    // Kiểm tra xem game có phải loại cần giấu đáp án khi sai không
    const isHiddenMode = gameType === 'WHEEL' || gameType === 'BOX';

    const handleLock = () => {
        setIsLocked(true);
        let correct = false;

        if (data.type === 'MCQ') {
            if (selectedIdx === null) return;
            correct = parseInt(data.correct) === selectedIdx;
        } 
        else if (data.type === 'SA') {
            const userAnswer = saInput.trim().toUpperCase();
            const trueAnswer = String(data.correct).trim().toUpperCase();
            correct = userAnswer === trueAnswer;
        }
        else if (data.type === 'TF') {
            const allCorrect = data.items.every((item, idx) => {
                const userChoice = tfSelection[idx];
                const trueKey = String(item.isTrue);
                return userChoice === trueKey;
            });
            correct = allCorrect;
        }

        setIsCorrect(correct);

        if (correct) {
            confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
            setTimeout(() => onClose(true), 1500);
        }
    };

    const handleFinish = () => onClose(isCorrect); 

    const getButtonLabel = () => {
        if (isCorrect) return "Đang xử lý..."; 
        if (isHiddenMode) return "Đóng lại (Thử lại sau)";
        return "Thử lại sau";
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-[#1e293b] text-white p-6 md:p-8 rounded-[2rem] max-w-4xl w-full text-center relative max-h-[90vh] flex flex-col shadow-2xl border-4 border-indigo-500/50">
                <button onClick={() => onClose(null)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full hover:bg-red-500 transition z-10"><X size={20}/></button>
                
                <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
                    <span className="text-xs font-black text-indigo-400 mb-2 uppercase tracking-[0.2em] block">
                        {data.type === 'MCQ' ? 'TRẮC NGHIỆM' : data.type === 'TF' ? 'ĐÚNG / SAI' : 'TRẢ LỜI NGẮN'}
                    </span>
                    
                    <div className="text-lg md:text-2xl font-bold mb-6 leading-snug whitespace-pre-wrap">
                        {renderWithInlineImage(data.q, data.img)}
                    </div>

                    {/* --- HIỂN THỊ TRẮC NGHIỆM --- */}
                    {data.type === 'MCQ' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            {data.a.map((ans, idx) => {
                                let statusClass = "bg-slate-800 border-slate-700 hover:bg-slate-700";
                                if (!isLocked && selectedIdx === idx) statusClass = "bg-indigo-600 border-indigo-500 shadow-lg scale-[1.02]"; 
                                
                                if (isLocked) {
                                    const correctIndex = parseInt(data.correct);
                                    if (idx === correctIndex) {
                                        // NẾU SAI VÀ LÀ CHẾ ĐỘ GIẤU -> KHÔNG HIỆN MÀU XANH ĐÁP ÁN ĐÚNG
                                        if (isHiddenMode && !isCorrect) {
                                            statusClass = "bg-slate-800 border-slate-700 opacity-30 grayscale"; 
                                        } else {
                                            statusClass = "bg-green-600 border-green-500 shadow-xl scale-105 z-10"; 
                                        }
                                    }
                                    else if (!isCorrect && idx === selectedIdx) statusClass = "bg-red-600 border-red-500 opacity-80";
                                    else statusClass = "bg-slate-800 border-slate-700 opacity-30 grayscale";
                                }
                                return (
                                    <div key={idx} onClick={() => !isLocked && setSelectedIdx(idx)} className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center min-h-[60px] ${statusClass}`}>
                                        <div className="absolute left-4 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center font-black text-sm">{labels[idx]}</div>
                                        <div className="pl-10 w-full flex justify-center text-base font-bold flex-col items-center">
                                            {renderWithInlineImage(ans, data.aImages?.[idx])}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* --- HIỂN THỊ ĐÚNG SAI --- */}
                    {data.type === 'TF' && (
                        <div className="space-y-2 mb-4 text-left">
                            {data.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-800 p-3 rounded-xl border border-slate-700">
                                    <div className="flex-1 mr-4 font-bold text-sm md:text-base">
                                        {renderWithInlineImage(item.text, item.img)}
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        {/* ẨN VIỀN XANH KHI SAI TRONG CHẾ ĐỘ GIẤU */}
                                        <button onClick={() => !isLocked && setTfSelection(p => ({...p, [idx]: "true"}))} className={`w-10 h-10 rounded-lg border-2 font-black transition-all ${tfSelection[idx] === "true" ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900 border-slate-600 text-slate-500'} ${isLocked && (!isHiddenMode || isCorrect) && item.isTrue === true ? 'ring-2 ring-green-500' : ''}`}>Đ</button>
                                        <button onClick={() => !isLocked && setTfSelection(p => ({...p, [idx]: "false"}))} className={`w-10 h-10 rounded-lg border-2 font-black transition-all ${tfSelection[idx] === "false" ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-900 border-slate-600 text-slate-500'} ${isLocked && (!isHiddenMode || isCorrect) && item.isTrue === false ? 'ring-2 ring-green-500' : ''}`}>S</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* --- HIỂN THỊ TRẢ LỜI NGẮN (SA) --- */}
                    {data.type === 'SA' && (
                        <div className="mb-4">
                            <input value={saInput} onChange={(e) => setSaInput(e.target.value)} disabled={isLocked} className={`w-full bg-slate-900 border-4 p-4 rounded-2xl text-center font-black text-2xl uppercase outline-none placeholder-slate-600 ${isLocked ? (isCorrect ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400') : 'border-indigo-500 focus:shadow-[0_0_20px_#6366f1]'}`} placeholder="NHẬP ĐÁP ÁN..."/>
                            
                            {/* CHỈ HIỆN ĐÁP ÁN ĐÚNG NẾU KHÔNG PHẢI CHẾ ĐỘ GIẤU */}
                            {isLocked && !isCorrect && !isHiddenMode && (
                                <div className="mt-3 text-green-400 font-bold animate-pulse text-lg">
                                    Đáp án đúng: {data.correct}
                                </div>
                            )}
                            
                            {/* THÔNG BÁO SAI NHƯNG KHÔNG HIỆN ĐÁP ÁN */}
                            {isLocked && !isCorrect && isHiddenMode && (
                                <div className="mt-3 text-orange-400 font-bold animate-pulse text-lg">
                                    😢 Chưa chính xác, hãy suy nghĩ thêm nhé!
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-white/10 mt-2">
                    {!isLocked ? (
                        <button onClick={handleLock} className="w-full py-3 rounded-xl font-black text-lg shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.01] transition-all"><Lock size={20}/> CHỐT ĐÁP ÁN</button>
                    ) : (
                        <div className="animate-in slide-in-from-bottom fade-in duration-300">
                            <div className={`py-2 text-xl font-black uppercase mb-2 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                                {isCorrect ? "🎉 CHÍNH XÁC!" : "😢 SAI RỒI!"}
                            </div>
                            {!isCorrect && (
                                <button onClick={handleFinish} className="w-full bg-white text-slate-900 font-black py-3 rounded-xl shadow-xl hover:bg-gray-100 transition uppercase tracking-widest">{getButtonLabel()}</button>
                            )}
                            {isCorrect && (<div className="text-slate-400 text-sm animate-pulse">Đang mở quà...</div>)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}