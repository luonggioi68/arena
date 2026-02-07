import { useState, useEffect, useRef, useMemo } from 'react'; 
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
    ArrowLeft, CircleDashed, LayoutGrid, Gift, Grid3X3, CheckCircle, 
    XCircle, Lock, RefreshCcw, Gamepad2, Package, X, Check, 
    DollarSign, Phone, Users, Bot, Divide, HelpCircle, Trophy 
} from 'lucide-react';
import confetti from 'canvas-confetti';

// --- CSS HIỆU ỨNG ---
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

  /* MILLIONAIRE SPECIFIC STYLES */
  .mil-answer-clip {
    clip-path: polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%);
  }
  .mil-gradient {
    background: radial-gradient(circle, #1e3a8a 0%, #020617 100%);
  }
  .animate-flash {
      animation: flash 0.5s infinite;
  }
  @keyframes flash {
      0% { background-color: #fbbf24; }
      50% { background-color: #d97706; }
      100% { background-color: #fbbf24; }
  }
`;

export default function ArcadeMode() {
  const router = useRouter();
  const { id } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [mode, setMode] = useState('MENU'); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(firestore, "quizzes", id)).then((snap) => {
        if (snap.exists()) setQuiz(snap.data());
        setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white font-bold text-xl">Đang tải dữ liệu...</div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans overflow-hidden">
      <style>{styles}</style>
      
      {/* HEADER */}
      {mode !== 'MILLIONAIRE' && (
          <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-700 shadow-md z-50 relative">
            <button onClick={() => mode === 'MENU' ? router.push('/dashboard') : setMode('MENU')} className="flex items-center gap-2 hover:text-yellow-400 font-bold transition uppercase text-sm">
                <ArrowLeft size={20} /> {mode === 'MENU' ? 'Về Dashboard' : 'Chọn game khác'}
            </button>
            <h1 className="text-lg md:text-xl font-black truncate max-w-md uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {quiz?.title} <span className="text-slate-500 mx-2">|</span> ARCADE
            </h1>
          </div>
      )}

      {/* MENU CHỌN GAME */}
      {mode === 'MENU' && (
        <div className="h-[90vh] overflow-y-auto p-4 md:p-8 flex items-center justify-center">
            <div className="max-w-6xl w-full">
                <div className="text-center mb-10">
                    <Gamepad2 size={60} className="mx-auto mb-4 text-purple-500"/>
                    <h1 className="text-4xl md:text-5xl font-black mb-2 text-white uppercase italic tracking-tighter">CHỌN THỬ THÁCH</h1>
                    <p className="text-slate-400">Vừa học vừa chơi - Sảng khoái tinh thần</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 px-4">
                    <GameCard title="Triệu Phú" desc="Trí tuệ & Kịch tính" icon={<DollarSign size={48}/>} color="from-blue-600 to-indigo-900" onClick={() => setMode('MILLIONAIRE')} delay={0} special={true} />
                    <GameCard title="Vòng Quay" desc="Ngẫu nhiên & May mắn" icon={<CircleDashed size={48}/>} color="from-pink-500 to-rose-600" onClick={() => setMode('WHEEL')} delay={100} />
                    <GameCard title="Lật Ô Chữ" desc="Chiến thuật & Đồng đội" icon={<LayoutGrid size={48}/>} color="from-emerald-500 to-teal-600" onClick={() => setMode('FLIP')} delay={200} />
                    <GameCard title="Hộp Bí Mật" desc="Hồi hộp & Bất ngờ" icon={<Gift size={48}/>} color="from-violet-500 to-purple-600" onClick={() => setMode('BOX')} delay={300} />
                    <GameCard title="Tìm Cặp" desc="Trí nhớ & Phản xạ" icon={<Grid3X3 size={48}/>} color="from-orange-400 to-amber-500" onClick={() => setMode('MATCH')} delay={400} />
                </div>
            </div>
        </div>
      )}

      {/* CÁC GAME */}
      <div className="h-full relative bg-slate-900">
        {mode === 'WHEEL' && <LuckyWheelGame questions={quiz.questions} />}
        {mode === 'FLIP' && <FlipCardGame questions={quiz.questions} />}
        {mode === 'BOX' && <MysteryBoxGame questions={quiz.questions} />}
        {mode === 'MATCH' && <MemoryMatchGame questions={quiz.questions} />}
        {mode === 'MILLIONAIRE' && <MillionaireGame questions={quiz.questions} onExit={() => setMode('MENU')} />}
      </div>
    </div>
  );
}

const GameCard = ({ title, desc, icon, color, onClick, delay, special }) => (
    <button 
        onClick={onClick} 
        className={`group relative h-64 bg-gradient-to-br ${color} rounded-3xl p-6 flex flex-col items-center justify-center hover:scale-105 transition-all duration-300 shadow-2xl border-4 ${special ? 'border-yellow-400 animate-pulse' : 'border-white/10'} hover:border-white/40 animate-card`}
        style={{ animationDelay: `${delay}ms` }}
    >
        {special && <div className="absolute -top-3 -right-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase shadow-lg animate-bounce">Hot</div>}
        <div className="mb-4 p-4 bg-black/20 rounded-full group-hover:rotate-12 transition duration-500 shadow-inner text-white">{icon}</div>
        <h2 className="text-xl md:text-2xl font-black uppercase text-center mb-2 drop-shadow-md text-white tracking-tight">{title}</h2>
        <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">{desc}</p>
    </button>
);

// ====================================================================================
// GAME: AI LÀ TRIỆU PHÚ (MILLIONAIRE)
// ====================================================================================
// ====================================================================================
// GAME: AI LÀ TRIỆU PHÚ (MILLIONAIRE) - ĐÃ SỬA LỖI HIỆN NÚT CHỐT
// ====================================================================================
// ====================================================================================
// GAME: AI LÀ TRIỆU PHÚ (MILLIONAIRE) - PHIÊN BẢN 100 TRIỆU + ÂM THANH
// ====================================================================================
// ====================================================================================
// GAME: AI LÀ TRIỆU PHÚ (MILLIONAIRE) - UPDATE GIAO DIỆN & TIỀN THƯỞNG
// ====================================================================================
// ====================================================================================
// GAME: AI LÀ TRIỆU PHÚ (MILLIONAIRE) - UPDATE 100 TRIỆU + HIỂN THỊ TIỀN
// ====================================================================================
function MillionaireGame({ questions, onExit }) {
    const [level, setLevel] = useState(0); 
    const [status, setStatus] = useState('PLAYING'); // PLAYING, WIN, LOSE, WALK_AWAY
    const [selectedAns, setSelectedAns] = useState(null); 
    const [locked, setLocked] = useState(false); 
    const [lifelines, setLifelines] = useState({ fifty: true, phone: true, audience: true, ai: true });
    const [hiddenOptions, setHiddenOptions] = useState([]); 
    const [modal, setModal] = useState(null);

    // --- CẤU HÌNH ÂM THANH ---
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

    // --- CẤU HÌNH THANG TIỀN (15 Mốc Chuẩn) ---
    // Mảng giá trị tiền thưởng cố định theo yêu cầu
    const REWARDS = [
        "200.000", "400.000", "600.000", "1.000.000", "2.000.000", 
        "3.000.000", "6.000.000", "10.000.000", "14.000.000", "22.000.000", 
        "30.000.000", "40.000.000", "60.000.000", "85.000.000", "100.000.000"
    ];

    const moneyTree = useMemo(() => {
        // Tạo thang tiền: Lấy tối đa 15 câu, hoặc lặp lại nếu ít câu hỏi (để luôn đủ 15 mốc hiển thị đẹp)
        // Tuy nhiên logic chơi sẽ dừng khi hết câu hỏi trong bộ đề.
        const ladder = [];
        for (let i = 0; i < 15; i++) {
            ladder.push({ 
                level: i, 
                money: REWARDS[i], 
                safe: (i + 1) % 5 === 0 // Mốc an toàn: 5, 10, 15
            });
        }
        return ladder.reverse(); // Đảo ngược để hiển thị (Cao nhất ở trên)
    }, []);

    // Số tiền hiện tại đang chinh phục
    const currentMoneyDisplay = REWARDS[level] || REWARDS[REWARDS.length - 1];

    const currentQ = questions[level];
    
    // Nếu hết câu hỏi trong bộ đề -> Chiến thắng (Dù chưa đến câu 15)
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

    // --- LOGIC GAMEPLAY ---
    const handleSelect = (idx) => {
        if (locked || hiddenOptions.includes(idx)) return;
        setSelectedAns(idx);
    };

    const handleLock = () => {
        if (selectedAns === null) return;
        setLocked(true);
        audioRefs.current.lock.play();
        audioRefs.current.bg.volume = 0.1;

        setTimeout(() => {
            const correctIdx = parseInt(currentQ.correct); 
            
            if (selectedAns === correctIdx) {
                // ĐÚNG
                audioRefs.current.correct.play();
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.8 } });
                
                setTimeout(() => {
                    // Check xem còn câu hỏi tiếp theo không
                    if (level < questions.length - 1 && level < 14) {
                        setLevel(prev => prev + 1);
                        setLocked(false);
                        setSelectedAns(null);
                        setHiddenOptions([]);
                        audioRefs.current.bg.volume = 0.3;
                    } else {
                        // Hết câu hỏi hoặc đạt đỉnh
                        setStatus('WIN');
                        audioRefs.current.bg.pause();
                        confetti({ particleCount: 500, spread: 150, origin: { y: 0.6 } });
                    }
                }, 2000);
            } else {
                // SAI
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

    // --- TRỢ GIÚP (GIỮ NGUYÊN) ---
    const use5050 = () => {
        if (!lifelines.fifty || locked) return;
        setLifelines(prev => ({ ...prev, fifty: false }));
        const correctIdx = parseInt(currentQ.correct);
        const wrongs = [0, 1, 2, 3].filter(i => i !== correctIdx);
        const shuffledWrongs = wrongs.sort(() => 0.5 - Math.random()).slice(0, 2);
        setHiddenOptions(shuffledWrongs);
    };

    const useAudience = () => {
        if (!lifelines.audience || locked) return;
        setLifelines(prev => ({ ...prev, audience: false }));
        const correctIdx = parseInt(currentQ.correct);
        let stats = [0, 0, 0, 0];
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
        setModal({ type: 'AUDIENCE', data: stats });
    };

    const usePhone = () => {
        if (!lifelines.phone || locked) return;
        setLifelines(prev => ({ ...prev, phone: false }));
        const correctIdx = parseInt(currentQ.correct);
        const isCorrect = Math.random() > 0.3; 
        const finalAns = isCorrect ? correctIdx : Math.floor(Math.random() * 4);
        setModal({ type: 'PHONE', data: finalAns });
    };

    const useAI = () => {
        if (!lifelines.ai || locked) return;
        setLifelines(prev => ({ ...prev, ai: false }));
        const correctIdx = parseInt(currentQ.correct);
        const isSmart = Math.random() > 0.1;
        const suggestion = isSmart ? correctIdx : Math.floor(Math.random() * 4);
        setModal({ type: 'AI', data: { suggestion, confidence: isSmart ? 85 + Math.floor(Math.random()*14) : 40 } });
    };

    // --- MÀN HÌNH KẾT THÚC ---
    if (status === 'WIN' || status === 'LOSE' || status === 'WALK_AWAY') {
        let prize = "0";
        
        if (status === 'WIN') {
            // Thắng: Nhận mức tiền của câu cuối cùng đã trả lời đúng
            // Nếu trả lời đúng câu 15 (index 14) -> nhận mức 14
            prize = REWARDS[level] || REWARDS[REWARDS.length-1]; 
        } else if (status === 'WALK_AWAY') {
            // Dừng chơi: Nhận mức tiền của câu trước đó
            if (level > 0) prize = REWARDS[level - 1];
        } else { 
            // Thua (LOSE): Về mốc an toàn gần nhất
            // Mốc an toàn: Câu 5 (index 4), Câu 10 (index 9)
            if (level >= 10) prize = REWARDS[9]; // 22 Triệu
            else if (level >= 5) prize = REWARDS[4]; // 2 Triệu
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

    if (!currentQ) return null; // Fallback an toàn

    return (
        <div className="h-screen w-full mil-gradient text-white flex flex-col md:flex-row overflow-hidden font-sans relative">
            
            {/* CỘT TRÁI: GAMEPLAY */}
            <div className="flex-1 flex flex-col relative z-10 p-4 md:p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-2">
                    <div onClick={handleWalkAway} className="bg-black/40 rounded-full px-4 py-2 border border-white/20 flex items-center gap-2 cursor-pointer hover:bg-red-900/50 transition">
                        <X size={20}/> <span className="font-bold text-sm uppercase text-slate-300">Dừng cuộc chơi</span>
                    </div>
                    {/* HIỂN THỊ TIỀN CÂU HIỆN TẠI (THAY CHO LOGO $) */}
                    <div className="flex flex-col items-center justify-center relative z-20">
                        <div className="bg-gradient-to-b from-blue-600 to-blue-900 rounded-full px-8 py-3 border-4 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)] min-w-[200px] text-center transform hover:scale-105 transition duration-300">
                            <span className="text-3xl font-black text-white drop-shadow-md">{currentMoneyDisplay}</span>
                        </div>
                    </div>
                    <div className="w-32"></div>
                </div>

                {/* Câu hỏi */}
                <div className="flex-1 flex flex-col justify-center items-center">
                    {currentQ.img && <img src={currentQ.img} className="max-h-40 rounded-lg border-2 border-white/20 mb-4 bg-black/50 object-contain shadow-lg" />}
                    <div className="w-full bg-blue-900/90 border-2 border-slate-300 rounded-2xl p-6 md:p-8 text-center shadow-[0_0_40px_rgba(30,58,138,0.6)] relative mb-4 mil-answer-clip">
                        <div className="absolute -left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"></div>
                        <h2 className="text-xl md:text-2xl font-bold leading-relaxed relative z-10 drop-shadow-md">{currentQ.q}</h2>
                    </div>
                </div>

                {/* Đáp án */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-5xl mx-auto mb-4">
                    {options.map((opt, idx) => {
                        const isHidden = hiddenOptions.includes(idx);
                        const isSelected = selectedAns === idx;
                        const isCorrect = parseInt(currentQ.correct) === idx;
                        
                        let bgClass = "bg-slate-900 from-slate-800 to-slate-900 hover:from-blue-800 hover:to-blue-900"; 
                        if (isSelected) bgClass = "bg-yellow-600 from-yellow-600 to-orange-600 text-black animate-pulse shadow-[0_0_20px_rgba(234,179,8,0.5)]"; 
                        if (locked && isCorrect) bgClass = "bg-green-600 from-green-500 to-emerald-700 animate-flash text-white shadow-[0_0_30px_rgba(34,197,94,0.8)] border-green-300"; 
                        if (locked && isSelected && !isCorrect) bgClass = "bg-red-600 from-red-600 to-rose-700 text-white animate-shake"; 

                        return (
                            <button 
                                key={idx} 
                                onClick={() => handleSelect(idx)}
                                disabled={locked || isHidden}
                                className={`relative p-4 md:p-5 rounded-full border-2 ${isSelected ? 'border-yellow-400' : 'border-white/30'} flex items-center transition-all duration-200 group bg-gradient-to-b ${bgClass} ${isHidden ? 'opacity-0 pointer-events-none' : 'opacity-100 shadow-lg'}`}
                            >
                                <span className={`font-black text-yellow-400 mr-4 text-xl ${isSelected || (locked && isCorrect) ? 'text-white' : ''}`}>{getAnswerLabel(idx)}:</span>
                                <span className="font-bold text-lg text-left flex-1">{opt}</span>
                            </button>
                        )
                    })}
                </div>

                {/* Nút Chốt */}
                <div className="h-16 flex justify-center items-center">
                    {selectedAns !== null && !locked && (
                        <button 
                            onClick={handleLock} 
                            className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-black py-3 px-12 rounded-full text-xl shadow-[0_0_30px_rgba(234,179,8,0.8)] hover:scale-110 active:scale-95 transition-transform uppercase tracking-widest border-2 border-white animate-in zoom-in fade-in duration-300"
                        >
                            CHỐT ĐÁP ÁN
                        </button>
                    )}
                </div>

                {/* Trợ giúp */}
                <div className="flex justify-center gap-4 md:gap-8 mt-4">
                    <LifelineButton icon={<div className="font-bold text-lg">50:50</div>} label="50:50" active={lifelines.fifty} onClick={use5050} />
                    <LifelineButton icon={<Users size={20}/>} label="Khán giả" active={lifelines.audience} onClick={useAudience} />
                    <LifelineButton icon={<Phone size={20}/>} label="Gọi điện" active={lifelines.phone} onClick={usePhone} />
                    <LifelineButton icon={<Bot size={20}/>} label="Hỏi AI" active={lifelines.ai} onClick={useAI} special />
                </div>
            </div>

            {/* CỘT PHẢI: THANG TIỀN */}
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

            {/* MODAL TRỢ GIÚP (Giữ nguyên) */}
            {modal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModal(null)}>
                    <div className="bg-slate-900 border-2 border-blue-500 rounded-2xl p-6 max-w-md w-full animate-in zoom-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-center text-yellow-400 mb-4 uppercase border-b border-white/10 pb-2">
                            {modal.type === 'AUDIENCE' && "Ý kiến khán giả"}
                            {modal.type === 'PHONE' && "Gọi điện thoại"}
                            {modal.type === 'AI' && "AI Phân tích"}
                        </h3>
                        {/* (Các case hiển thị modal giữ nguyên như code trước) */}
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
                                <div className="bg-white text-black p-3 rounded-r-xl rounded-bl-xl text-sm">
                                    "Alo! Theo tớ nghĩ thì đáp án là <span className="font-black text-blue-600 text-lg">{getAnswerLabel(modal.data)}</span> nhé. Chắc chắn 80% đó!"
                                </div>
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

// --- COMPONENT POPUP TRẢ LỜI CÂU HỎI CHUNG CHO CÁC GAME KHÁC ---
function InteractiveQuestion({ data, onClose, gameType }) {
    const [selectedIdx, setSelectedIdx] = useState(null); 
    const [isLocked, setIsLocked] = useState(false); 
    const [isCorrect, setIsCorrect] = useState(null); 
    const labels = ['A', 'B', 'C', 'D'];

    const safeOptions = useMemo(() => {
        if (data && Array.isArray(data.a) && data.a.length > 0) return data.a;
        return ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"];
    }, [data]);

    const handleSelect = (idx) => { if (!isLocked) setSelectedIdx(idx); };

    const handleLock = () => {
        setIsLocked(true);
        if (selectedIdx === null) return;
        
        const correct = parseInt(data.correct) === selectedIdx;
        setIsCorrect(correct);
        if (correct) confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } });
    };

    const handleFinish = () => onClose(isCorrect); 

    const getButtonLabel = () => {
        if (gameType === 'WHEEL') return "Hoàn thành (Xóa ô này)";
        return isCorrect ? "Đóng Lại (Tiếp tục)" : "Thử lại sau";
    };

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-[#1e293b] text-white p-6 md:p-8 rounded-[2rem] max-w-4xl w-full text-center relative max-h-[90vh] flex flex-col shadow-2xl border-4 border-indigo-500/50">
                <button onClick={() => onClose(null)} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full hover:bg-red-500 transition z-10"><X size={20}/></button>
                <div className="overflow-y-auto flex-1 pr-2">
                    <span className="text-xs font-black text-indigo-400 mb-2 uppercase tracking-[0.2em] block">Câu hỏi thử thách</span>
                    {data.img && <img src={data.img} className="h-40 mx-auto object-contain mb-4 rounded-xl border-2 border-white/10 shadow-lg bg-black/20" />}
                    <h1 className="text-xl md:text-2xl font-bold mb-6 leading-snug whitespace-pre-wrap">{data.q}</h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {safeOptions.map((ans, idx) => {
                            let statusClass = "bg-slate-800 border-slate-700 hover:bg-slate-700";
                            if (!isLocked && selectedIdx === idx) statusClass = "bg-indigo-600 border-indigo-500 shadow-lg scale-[1.02]"; 
                            if (isLocked) {
                                const correctIndex = parseInt(data.correct);
                                if (isCorrect && idx === correctIndex) statusClass = "bg-green-600 border-green-500 shadow-xl scale-105 z-10";
                                else if (!isCorrect && idx === selectedIdx) statusClass = "bg-red-600 border-red-500 opacity-80";
                                else statusClass = "bg-slate-800 border-slate-700 opacity-30 grayscale";
                            }
                            return (
                                <div key={idx} onClick={() => handleSelect(idx)} className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex items-center min-h-[60px] ${statusClass}`}>
                                    <div className="absolute left-4 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center font-black text-sm">{labels[idx]}</div>
                                    <div className="pl-10 w-full flex justify-center text-base font-bold">
                                        {typeof ans === 'string' && ans.startsWith('http') ? <img src={ans} className="h-12 object-contain" /> : ans}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="pt-4 border-t border-white/10 mt-2">
                    {!isLocked ? (
                        <button onClick={handleLock} className="w-full py-3 rounded-xl font-black text-lg shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.01] transition-all"><Lock size={20}/> CHỐT ĐÁP ÁN</button>
                    ) : (
                        <div className="animate-in slide-in-from-bottom fade-in duration-300">
                            <div className={`py-2 text-xl font-black uppercase mb-2 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>{isCorrect ? "🎉 CHÍNH XÁC!" : "😢 SAI RỒI!"}</div>
                            <button onClick={handleFinish} className="w-full bg-white text-slate-900 font-black py-3 rounded-xl shadow-xl hover:bg-gray-100 transition uppercase tracking-widest">{getButtonLabel()}</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------- GAME 1: VÒNG QUAY MAY MẮN ----------------
function LuckyWheelGame({ questions }) {
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
        if (isCorrect === true) setActiveQuestions(prev => prev.filter(q => q !== result));
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
        if (total === 0) { ctx.beginPath(); ctx.arc(center, center, radius, 0, 2 * Math.PI); ctx.fillStyle = "#334155"; ctx.fill(); return; }
        const slice = (2 * Math.PI) / total;
        const colors = ['#ec4899', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#f97316'];
        activeQuestions.forEach((q, i) => {
            ctx.beginPath(); ctx.moveTo(center, center); ctx.arc(center, center, radius, i * slice, (i + 1) * slice); ctx.fillStyle = colors[i % colors.length]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#0f172a"; ctx.stroke();
            ctx.save(); ctx.translate(center, center); ctx.rotate(i * slice + slice / 2); ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = "bold 24px Arial"; ctx.fillText((i + 1).toString(), radius - 40, 10); ctx.restore();
        });
    }, [activeQuestions]);

    if (activeQuestions.length === 0) return <div className="flex flex-col items-center justify-center h-full"><div className="text-8xl mb-4">🏆</div><h2 className="text-4xl font-black text-yellow-400 mb-6 uppercase">Hoàn thành!</h2><button onClick={() => setActiveQuestions(questions)} className="bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-gray-100 flex items-center gap-2 shadow-lg"><RefreshCcw /> Chơi lại</button></div>;

    return (
        <div className="flex flex-col items-center justify-center h-full relative overflow-hidden">
            <div className="absolute top-[5%] z-20 text-6xl text-yellow-400 drop-shadow-lg">▼</div>
            <div className="relative transform transition-transform duration-[5000ms] cubic-bezier(0.1, 0.7, 0.1, 1)" style={{ transform: `rotate(${rotation}deg)` }}>
                <canvas ref={canvasRef} className="rounded-full shadow-2xl border-4 border-slate-700" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white w-16 h-16 rounded-full shadow-inner border-4 border-slate-200 flex items-center justify-center font-black text-slate-900">Edu</div>
            </div>
            <button onClick={handleSpin} disabled={spinning} className="mt-8 bg-gradient-to-r from-pink-500 to-orange-500 px-12 py-4 rounded-full font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition disabled:opacity-50 text-white">{spinning ? '...' : 'QUAY NGAY'}</button>
            {result && <InteractiveQuestion data={result} onClose={handleCloseModal} gameType="WHEEL" />}
        </div>
    );
}

// ---------------- GAME 2: LẬT HÌNH ----------------
function FlipCardGame({ questions }) {
    const [cards, setCards] = useState(questions.map((q, i) => ({ ...q, id: i, status: null })));
    const [currentCard, setCurrentCard] = useState(null);
    const handleResult = (isCorrect) => {
        if (isCorrect !== null) setCards(cards.map(c => c.id === currentCard.id ? { ...c, status: isCorrect ? 'CORRECT' : 'WRONG' } : c));
        setCurrentCard(null);
    };
    return (
        <div className="p-8 h-full flex flex-col items-center">
            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 w-full max-w-6xl overflow-y-auto pb-20 custom-scrollbar">
                {cards.map((card, idx) => {
                    let style = "bg-gradient-to-br from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 border-white/10";
                    let content = <span className="drop-shadow-md">{idx + 1}</span>;
                    if (card.status === 'CORRECT') { style = "bg-green-600 border-green-400 opacity-90"; content = <CheckCircle size={40} className="mx-auto text-white"/>; }
                    else if (card.status === 'WRONG') { style = "bg-red-600 border-red-400 opacity-50 grayscale"; content = <XCircle size={40} className="mx-auto text-white"/>; }
                    return <button key={idx} onClick={() => !card.status && setCurrentCard(card)} disabled={card.status !== null} className={`relative aspect-square rounded-2xl shadow-xl text-4xl font-black transition transform hover:scale-105 border-4 ${style} flex items-center justify-center`}>{content}</button>
                })}
            </div>
            {currentCard && <InteractiveQuestion data={currentCard} onClose={handleResult} gameType="FLIP" />}
        </div>
    );
}

// ---------------- GAME 3: HỘP QUÀ BÍ MẬT ----------------
function MysteryBoxGame({ questions }) {
    const [boxes, setBoxes] = useState(questions.map((q, i) => ({ ...q, id: i, opened: false })));
    const [currentGift, setCurrentGift] = useState(null);
    const handleResult = (isCorrect) => {
        if (isCorrect === true) setBoxes(boxes.map(b => b.id === currentGift.id ? { ...b, opened: true } : b));
        setCurrentGift(null);
    };
    return (
        <div className="p-8 h-full flex justify-center overflow-y-auto">
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 w-full max-w-6xl">
                {boxes.map((box, idx) => (
                    <div key={idx} onClick={() => !box.opened && setCurrentGift(box)} className={`cursor-pointer transition-all duration-500 transform ${box.opened ? 'opacity-50 grayscale scale-95 cursor-default' : 'hover:scale-110 hover:-translate-y-4'}`}>
                        <div className="relative aspect-square">
                            {box.opened ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80 rounded-2xl border-2 border-slate-600"><CheckCircle size={48} className="text-green-500 mb-2"/><span className="text-sm font-bold text-gray-400 uppercase">Đã mở</span></div>
                            ) : (
                                <div className="w-full h-full bg-gradient-to-b from-purple-500 to-indigo-600 rounded-2xl shadow-2xl border-b-8 border-indigo-900 flex items-center justify-center relative group">
                                    <div className="absolute top-0 w-full h-1/3 bg-purple-400 rounded-t-2xl border-b-4 border-black/10 z-10"></div><Gift size={56} className="text-yellow-400 drop-shadow-xl transform group-hover:scale-125 transition duration-300"/><span className="absolute bottom-2 right-3 font-black text-2xl text-white/30">#{idx + 1}</span>
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

// ---------------- GAME 4: TÌM CẶP ----------------
function MemoryMatchGame({ questions }) {
    const [cards, setCards] = useState([]);
    const [flipped, setFlipped] = useState([]);
    const [solved, setSolved] = useState([]);

    useEffect(() => {
        const generatedCards = [];
        questions.forEach((q, idx) => {
            generatedCards.push({ id: `q-${idx}`, pairId: idx, type: 'QUESTION', content: q.q, img: q.img });
            let ansContent = "???";
            if (q.a && q.a.length > 0 && q.correct !== undefined) ansContent = q.a[q.correct];
            else if (q.correct) ansContent = q.correct;
            generatedCards.push({ id: `a-${idx}`, pairId: idx, type: 'ANSWER', content: ansContent, isImg: typeof ansContent === 'string' && ansContent.startsWith('http') });
        });
        setCards(generatedCards.sort(() => Math.random() - 0.5));
    }, [questions]);

    const handleCardClick = (card) => {
        if (flipped.length >= 2 || flipped.includes(card) || solved.includes(card.id)) return;
        const newFlipped = [...flipped, card];
        setFlipped(newFlipped);
        if (newFlipped.length === 2) {
            const [c1, c2] = newFlipped;
            if (c1.pairId === c2.pairId) {
                setTimeout(() => { setSolved(prev => [...prev, c1.id, c2.id]); setFlipped([]); confetti({ particleCount: 50, spread: 50, origin: { y: 0.6 } }); }, 500);
            } else setTimeout(() => setFlipped([]), 1000);
        }
    };

    return (
        <div className="p-8 h-full flex justify-center overflow-y-auto">
            <div className="grid grid-cols-4 md:grid-cols-6 gap-4 w-full max-w-7xl pb-20">
                {cards.map((card) => {
                    const isFlipped = flipped.includes(card) || solved.includes(card.id);
                    const isSolved = solved.includes(card.id);
                    return (
                        <div key={card.id} onClick={() => handleCardClick(card)} className={`perspective-1000 aspect-[3/4] cursor-pointer ${isFlipped ? 'flipped' : ''}`}>
                            <div className="flip-card-inner h-full w-full">
                                <div className="flip-card-front bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg border-2 border-white/20 flex items-center justify-center"><Package size={32} className="text-white opacity-80" /></div>
                                <div className={`flip-card-back h-full w-full bg-white text-slate-900 rounded-xl shadow-lg flex flex-col items-center justify-center p-2 border-4 ${isSolved ? 'border-green-500 bg-green-50' : 'border-blue-500'}`}>
                                    <span className={`text-[10px] font-black uppercase mb-1 ${card.type === 'QUESTION' ? 'text-blue-500' : 'text-green-600'}`}>{card.type === 'QUESTION' ? 'CÂU HỎI' : 'ĐÁP ÁN'}</span>
                                    <div className="flex-1 flex items-center justify-center overflow-hidden w-full">{card.isImg ? <img src={card.content} className="w-full h-full object-contain" /> : <p className="text-xs sm:text-sm font-bold line-clamp-4 leading-snug">{card.content}</p>}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}