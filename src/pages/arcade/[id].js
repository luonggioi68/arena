import { useState, useEffect, useRef, useMemo } from 'react'; // [ĐÃ SỬA] Thêm useMemo
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, CircleDashed, LayoutGrid, Gift, Grid3X3, CheckCircle, XCircle, Lock, RefreshCcw, Gamepad2, Package, X, Check } from 'lucide-react';
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
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-700 shadow-md z-50 relative">
        <button onClick={() => mode === 'MENU' ? router.push('/dashboard') : setMode('MENU')} className="flex items-center gap-2 hover:text-yellow-400 font-bold transition uppercase text-sm">
            <ArrowLeft size={20} /> {mode === 'MENU' ? 'Về Dashboard' : 'Chọn game khác'}
        </button>
        <h1 className="text-lg md:text-xl font-black truncate max-w-md uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            {quiz?.title} <span className="text-slate-500 mx-2">|</span> ARCADE
        </h1>
      </div>

      {/* MENU CHỌN GAME */}
      {mode === 'MENU' && (
        <div className="h-[90vh] overflow-y-auto p-4 md:p-8 flex items-center justify-center">
            <div className="max-w-6xl w-full">
                <div className="text-center mb-10">
                    <Gamepad2 size={60} className="mx-auto mb-4 text-purple-500"/>
                    <h1 className="text-4xl md:text-5xl font-black mb-2 text-white uppercase italic tracking-tighter">CHỌN THỬ THÁCH</h1>
                    <p className="text-slate-400">Vừa học vừa chơi - Sảng khoái tinh thần</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                    <GameCard title="Vòng Quay" desc="Ngẫu nhiên & May mắn" icon={<CircleDashed size={48}/>} color="from-pink-500 to-rose-600" onClick={() => setMode('WHEEL')} delay={0} />
                    <GameCard title="Lật Ô Chữ" desc="Chiến thuật & Đồng đội" icon={<LayoutGrid size={48}/>} color="from-emerald-500 to-teal-600" onClick={() => setMode('FLIP')} delay={100} />
                    <GameCard title="Hộp Bí Mật" desc="Hồi hộp & Bất ngờ" icon={<Gift size={48}/>} color="from-violet-500 to-purple-600" onClick={() => setMode('BOX')} delay={200} />
                    <GameCard title="Tìm Cặp" desc="Trí nhớ & Phản xạ" icon={<Grid3X3 size={48}/>} color="from-orange-400 to-amber-500" onClick={() => setMode('MATCH')} delay={300} />
                </div>
            </div>
        </div>
      )}

      {/* CÁC GAME */}
      <div className="h-[calc(100vh-70px)] relative bg-slate-900">
        {mode === 'WHEEL' && <LuckyWheelGame questions={quiz.questions} />}
        {mode === 'FLIP' && <FlipCardGame questions={quiz.questions} />}
        {mode === 'BOX' && <MysteryBoxGame questions={quiz.questions} />}
        {mode === 'MATCH' && <MemoryMatchGame questions={quiz.questions} />}
      </div>
    </div>
  );
}

const GameCard = ({ title, desc, icon, color, onClick, delay }) => (
    <button 
        onClick={onClick} 
        className={`group relative h-64 bg-gradient-to-br ${color} rounded-3xl p-6 flex flex-col items-center justify-center hover:scale-105 transition-all duration-300 shadow-2xl border-4 border-white/10 hover:border-white/40 animate-card`}
        style={{ animationDelay: `${delay}ms` }}
    >
        <div className="mb-4 p-4 bg-black/20 rounded-full group-hover:rotate-12 transition duration-500 shadow-inner text-white">{icon}</div>
        <h2 className="text-2xl font-black uppercase text-center mb-2 drop-shadow-md text-white tracking-tight">{title}</h2>
        <p className="text-white/90 text-xs font-bold uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">{desc}</p>
    </button>
);

// --- COMPONENT POPUP TRẢ LỜI CÂU HỎI (ĐÃ FIX LỖI 100%) ---
function InteractiveQuestion({ data, onClose, gameType }) {
    const [selectedIdx, setSelectedIdx] = useState(null); 
    const [isLocked, setIsLocked] = useState(false); 
    const [isCorrect, setIsCorrect] = useState(null); 
    const labels = ['A', 'B', 'C', 'D'];

    // [QUAN TRỌNG] Tạo danh sách đáp án an toàn
    // Nếu data.a tồn tại -> Dùng nó
    // Nếu không (hoặc bị lỗi) -> Tự tạo danh sách ['A', 'B', 'C', 'D'] để không bị crash
    const safeOptions = useMemo(() => {
        if (data && Array.isArray(data.a) && data.a.length > 0) {
            return data.a;
        }
        // Fallback nếu không có đáp án (để tránh lỗi map)
        return ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"];
    }, [data]);

    const handleSelect = (idx) => { if (!isLocked) setSelectedIdx(idx); };

    const handleLock = () => {
        setIsLocked(true);
        if (selectedIdx === null) return;
        
        // Mặc định so sánh index (MCQ)
        // Lưu ý: data.correct phải là số index (0, 1, 2, 3)
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
                    
                    {/* LUÔN RENDER DẠNG TRẮC NGHIỆM (MCQ) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        {safeOptions.map((ans, idx) => {
                            let statusClass = "bg-slate-800 border-slate-700 hover:bg-slate-700";
                            
                            if (!isLocked && selectedIdx === idx) statusClass = "bg-indigo-600 border-indigo-500 shadow-lg scale-[1.02]"; 
                            
                            if (isLocked) {
                                // Logic hiển thị kết quả
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
        // [CẬP NHẬT] Luôn coi là MCQ để lấy đáp án
        // Nếu là MCQ -> Lấy data.a[correct]
        // Nếu là SA/TF mà thầy ép thành MCQ thì nó sẽ tự map
        const generatedCards = [];
        questions.forEach((q, idx) => {
            // Thẻ 1: Câu hỏi
            generatedCards.push({ id: `q-${idx}`, pairId: idx, type: 'QUESTION', content: q.q, img: q.img });
            
            // Thẻ 2: Đáp án
            let ansContent = "???";
            if (q.a && q.a.length > 0 && q.correct !== undefined) {
                ansContent = q.a[q.correct];
            } else if (q.correct) {
                ansContent = q.correct; // Dự phòng cho SA
            }

            generatedCards.push({ 
                id: `a-${idx}`, 
                pairId: idx, 
                type: 'ANSWER', 
                content: ansContent, 
                isImg: typeof ansContent === 'string' && ansContent.startsWith('http') 
            });
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