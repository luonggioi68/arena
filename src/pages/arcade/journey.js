import { useState, useEffect, useRef, useMemo } from 'react';
import Head from 'next/head';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import useAuthStore from '@/store/useAuthStore';
import { 
  ArrowLeft, Check, Flame, Lock, Star, Trophy, X, Zap, 
  Sword, Clock, RotateCcw, CheckCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
// Import MathRender
import MathRender from '@/components/MathRender'; 

// --- CẤU HÌNH NHÂN VẬT ---
const CHARACTERS = [
  { 
    id: 'warrior', name: 'Hỏa Chiến Binh', desc: 'Loại bỏ 1 đáp án sai', 
    icon: <Sword size={32} />, skillId: 'remove_wrong', 
    color: 'from-red-600 to-orange-600', bg: 'bg-red-900/40 border-red-500'
  },
  { 
    id: 'mage', name: 'Pháp Sư Lửa', desc: 'Xem gợi ý miễn phí', 
    icon: <Zap size={32} />, skillId: 'hint', 
    color: 'from-orange-500 to-yellow-500', bg: 'bg-orange-900/40 border-orange-500'
  },
  { 
    id: 'archer', name: 'Xạ Thủ', desc: '+15 giây thời gian', 
    icon: <Clock size={32} />, skillId: 'add_time', 
    color: 'from-yellow-600 to-amber-600', bg: 'bg-yellow-900/40 border-yellow-500'
  },
];

export default function JourneyGame({ questions, onBack }) {
  const { user } = useAuthStore();
  
  // --- HÀM RENDER VĂN BẢN KÈM ẢNH INLINE ---
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
                        {/* Nếu chưa phải phần cuối cùng thì chèn ảnh vào giữa */}
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
    
    // Mặc định trả về text chứa công thức toán
    return <MathRender content={text} />;
  };

  // --- TỰ ĐỘNG PHÂN BỔ CÂU HỎI VÀO CÁC ẢI ---
  const LEVEL_MAP = useMemo(() => {
    if (!questions || questions.length === 0) return [];
    
    if (questions.length < 3) {
        return [{ id: 1, title: "Quyết Chiến", minPass: 50, questions: questions }];
    }

    const chunkSize = Math.ceil(questions.length / 3);
    
    return [
      { id: 1, title: "Khởi Hành", minPass: 50, questions: questions.slice(0, chunkSize) },
      { id: 2, title: "Thử Thách", minPass: 60, questions: questions.slice(chunkSize, chunkSize * 2) },
      { id: 3, title: "Về Đích", minPass: 70, questions: questions.slice(chunkSize * 2) }
    ].filter(l => l.questions.length > 0);
  }, [questions]);

  // States Global
  const [gameState, setGameState] = useState('LOADING'); 
  const [userProgress, setUserProgress] = useState({ unlocked: [1], stars: {}, totalScore: 0 }); 
  const [currentLevelId, setCurrentLevelId] = useState(1);
  const [selectedChar, setSelectedChar] = useState(null);
  
  // Play States
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [history, setHistory] = useState([]);
  
  // Interaction States
  const [skillUsed, setSkillUsed] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [removedAnswers, setRemovedAnswers] = useState([]); 
  const [feedback, setFeedback] = useState(null); 
  
  // Input States
  const [inputSA, setInputSA] = useState("");
  const [tfSelection, setTfSelection] = useState({}); 
  
  const timerRef = useRef(null);

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if(!questions || questions.length === 0) { setGameState('LOADING'); return; }
    if (!user) { setGameState('MAP'); return; }
    
    const loadData = async () => {
        try {
            const docRef = doc(firestore, "arcade_journey", user.uid);
            const snap = await getDoc(docRef);
            const profileRef = doc(firestore, "student_profiles", user.uid);
            const profileSnap = await getDoc(profileRef);
            const currentXP = profileSnap.exists() ? (profileSnap.data().totalScore || 0) : 0;

            if (snap.exists()) {
                const data = snap.data();
                setUserProgress({ ...data, unlocked: data.unlocked?.length ? data.unlocked : [1], displayXP: currentXP });
            } else {
                const init = { unlocked: [1], stars: {}, totalScore: 0 };
                await setDoc(docRef, init);
                setUserProgress({ ...init, displayXP: currentXP });
            }
        } catch (e) { console.error(e); }
        setGameState('MAP');
    };
    loadData();
  }, [user, questions]);

  const allLevelsCompleted = useMemo(() => {
      if (!LEVEL_MAP || LEVEL_MAP.length === 0) return false;
      return LEVEL_MAP.every(level => (userProgress.stars[level.id] || 0) > 0);
  }, [LEVEL_MAP, userProgress.stars]);

  // --- 2. LOGIC GAME ---
  const handleStartLevel = () => {
    const level = LEVEL_MAP.find(l => l.id === currentLevelId);
    if (!level) return;

    setQIndex(0); setScore(0); setCombo(0); setHistory([]); 
    setSkillUsed(false); setHintVisible(false); 
    setRemovedAnswers([]); setFeedback(null); 
    setInputSA(""); setTfSelection({}); 
    
    setTimeLeft(level.questions.length * 90); 
    setGameState('PLAYING');
  };

  useEffect(() => {
    if (gameState === 'PLAYING' && timeLeft > 0) {
        timerRef.current = setInterval(() => setTimeLeft(t => t <= 1 ? (finishLevel(false), 0) : t - 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState, timeLeft]);

  const handleAnswer = (submitVal) => {
    if (feedback) return;
    const level = LEVEL_MAP.find(l => l.id === currentLevelId);
    if (!level || !level.questions[qIndex]) return;

    const q = level.questions[qIndex];
    let pointsEarned = 0;
    let isCorrect = false;

    if (q.type === 'MCQ') {
        isCorrect = (parseInt(submitVal) === parseInt(q.correct));
        if (isCorrect) pointsEarned = 100;
    } 
    else if (q.type === 'TF') {
        let correctCount = 0;
        const totalItems = q.items ? q.items.length : 0;
        if (q.items) {
            q.items.forEach((item, idx) => {
                const userChoice = tfSelection[idx];
                const trueKey = String(item.isTrue);
                if (userChoice === trueKey) correctCount++;
            });
        }
        pointsEarned = correctCount * 25; 
        isCorrect = correctCount === totalItems; 
        if (isCorrect) pointsEarned += 20; 
    } 
    else if (q.type === 'SA') {
        const userAns = String(submitVal).trim().toLowerCase();
        const trueAns = String(q.correct).trim().toLowerCase();
        isCorrect = userAns === trueAns;
        if (isCorrect) pointsEarned = 100;
    }

    if (pointsEarned > 0) {
        setScore(s => s + pointsEarned + (combo * 10));
        setCombo(c => c + 1);
        setFeedback('CORRECT');
    } else {
        setCombo(0);
        setFeedback('WRONG');
    }
    
    const newHistory = [...history, { qId: q.id, isCorrect }];
    setHistory(newHistory);

    setTimeout(() => {
        setFeedback(null); setHintVisible(false); setRemovedAnswers([]); setInputSA(""); setTfSelection({});
        
        if (qIndex < level.questions.length - 1) {
            setQIndex(i => i + 1);
        } else {
            finishCheck(newHistory);
        }
    }, 1500);
  };

  const handleRestart = async () => {
      if (!user) { alert("Vui lòng đăng nhập!"); return; }
      if (!confirm("Bạn có chắc muốn chơi lại từ đầu? Mọi tiến độ sẽ bị xóa.")) return;
      
      try {
          const journeyRef = doc(firestore, "arcade_journey", user.uid);
          await updateDoc(journeyRef, { unlocked: [1], stars: {} });
          setUserProgress(prev => ({ ...prev, unlocked: [1], stars: {} }));
          setCurrentLevelId(1);
          setGameState('MAP'); 
      } catch (e) { console.error("Lỗi Reset:", e); }
  };

  const finishCheck = (finalHistory) => {
      clearInterval(timerRef.current);
      const level = LEVEL_MAP.find(l => l.id === currentLevelId);
      const correctCount = finalHistory.filter(h => h.isCorrect).length;
      const passPercent = (correctCount / level.questions.length) * 100;
      finishLevel(passPercent >= level.minPass, passPercent);
  };

  const finishLevel = async (isPassed, percent) => {
      if (isPassed && user) {
          const isLastLevel = currentLevelId === LEVEL_MAP.length;
          const nextLevel = currentLevelId + 1;
          const newStars = percent >= 100 ? 3 : percent >= 80 ? 2 : 1;
          const bonusXP = isLastLevel ? 500 : 200; 
          const totalXPReceived = score + bonusXP;
          
          try {
            const journeyRef = doc(firestore, "arcade_journey", user.uid);
            const updateData = {
                [`stars.${currentLevelId}`]: newStars,
                totalScore: increment(totalXPReceived)
            };
            if (!isLastLevel) updateData.unlocked = arrayUnion(nextLevel);

            await updateDoc(journeyRef, updateData);
            
            const profileRef = doc(firestore, "student_profiles", user.uid);
            await updateDoc(profileRef, { totalScore: increment(totalXPReceived) });

            setUserProgress(prev => ({
                ...prev,
                unlocked: (!isLastLevel && !prev.unlocked.includes(nextLevel)) ? [...prev.unlocked, nextLevel] : prev.unlocked,
                stars: { ...prev.stars, [currentLevelId]: Math.max(newStars, prev.stars[currentLevelId] || 0) },
                displayXP: (prev.displayXP || 0) + totalXPReceived,
                totalScore: prev.totalScore + totalXPReceived
            }));
            
            if (isLastLevel) {
                const duration = 3000;
                const end = Date.now() + duration;
                (function frame() {
                    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
                    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
                    if (Date.now() < end) requestAnimationFrame(frame);
                }());
            } else {
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#ef4444', '#f59e0b', '#fbbf24'] });
            }
          } catch(e) { console.error("Lỗi XP:", e); }
      }
      setGameState(isPassed ? 'WIN' : 'LOSE');
  };

  const activateSkill = () => {
      if(skillUsed) return;
      setSkillUsed(true);
      if (selectedChar.id !== 'mage') setScore(s => Math.max(0, s - 20));
      
      if(selectedChar.skillId === 'hint') setHintVisible(true);
      if(selectedChar.skillId === 'add_time') setTimeLeft(t => t + 15);
      if(selectedChar.skillId === 'remove_wrong') {
         const q = LEVEL_MAP.find(l=>l.id===currentLevelId).questions[qIndex];
         if(q.type === 'MCQ') {
             const correctIdx = parseInt(q.correct);
             const wrongs = [0,1,2,3].filter(i => i !== correctIdx).slice(0, 2);
             setRemovedAnswers(wrongs);
         }
      }
  };

  if (gameState === 'LOADING') return <div className="h-full flex items-center justify-center text-orange-500 font-bold animate-pulse">Đang tải bản đồ...</div>;

  const currentLevelData = LEVEL_MAP.find(l=>l.id===currentLevelId);
  const currentQuestion = currentLevelData?.questions[qIndex];

  return (
    <div className="h-full bg-[#0f0202] text-white font-sans overflow-hidden relative selection:bg-orange-500/30">
      <Head><title>Hành Trình Vượt Ải</title></Head>
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-[#1a0505] to-black -z-10" />

      {/* --- MAP VIEW --- */}
      {gameState === 'MAP' && (
        <div className="max-w-md mx-auto pb-20 h-full relative overflow-y-auto custom-scrollbar">
            <div className="sticky top-0 z-50 bg-[#1a0505]/90 backdrop-blur-md p-4 border-b border-orange-500/30 flex justify-between items-center shadow-[0_0_20px_rgba(234,88,12,0.3)]">
                <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full text-orange-400"><ArrowLeft /></button>
                <h1 className="text-xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-t from-yellow-500 to-red-600 animate-pulse">HÀNH TRÌNH</h1>
                <div className="flex items-center gap-1 bg-orange-950 px-3 py-1 rounded-full border border-orange-500/50">
                    <Star size={14} className="text-yellow-400 fill-yellow-400"/> 
                    <span className="text-sm font-bold text-yellow-100">{userProgress.displayXP || 0} XP</span>
                </div>
            </div>
            
            <div className="p-8 space-y-12 relative mt-4">
                <div className="absolute left-1/2 top-10 bottom-10 w-1 bg-gradient-to-b from-red-800 via-orange-600 to-red-800 -translate-x-1/2 rounded-full shadow-[0_0_10px_orange]" />
                {LEVEL_MAP.map((level) => {
                    const unlocked = userProgress.unlocked.includes(level.id);
                    const stars = userProgress.stars[level.id] || 0;
                    const isCompleted = stars > 0; 

                    return (
                        <div key={level.id} className="relative flex flex-col items-center z-10">
                            <button 
                                onClick={() => { if(unlocked && !isCompleted) { setCurrentLevelId(level.id); setGameState('CHAR_SELECT'); }}}
                                disabled={!unlocked || isCompleted} 
                                className={`w-24 h-24 rounded-full border-4 flex items-center justify-center shadow-2xl transition-all relative group
                                    ${isCompleted ? 'bg-green-900/50 border-green-600 cursor-not-allowed grayscale' : 
                                      unlocked ? 'bg-gradient-to-br from-red-600 to-orange-500 border-yellow-400 animate-bounce hover:scale-110' : 'bg-slate-800 border-slate-700 opacity-70'}
                                `}
                            >
                                {isCompleted ? <CheckCircle size={40} className="text-green-400" /> : 
                                 unlocked ? <Flame size={40} className="text-yellow-200 fill-orange-500" /> : <Lock size={30} className="text-slate-500" />}
                                
                                {stars > 0 && <div className="absolute -top-3 flex gap-0.5 bg-black/80 px-2 py-0.5 rounded-full border border-yellow-500/50">{[1,2,3].map(s => <Star key={s} size={10} className={s<=stars?"text-yellow-400 fill-yellow-400":"text-slate-600"}/>)}</div>}
                            </button>
                            <div className={`mt-2 px-3 py-1 rounded-lg border text-xs font-bold uppercase ${isCompleted ? 'bg-green-900 border-green-600 text-green-200' : 'bg-black/60 border-orange-500/20 text-orange-200'}`}>{isCompleted ? "ĐÃ HOÀN THÀNH" : level.title}</div>
                        </div>
                    );
                })}
            </div>

            {allLevelsCompleted && (
                 <div className="fixed bottom-24 left-0 right-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom fade-in duration-500">
                     <div className="bg-[#1a0505]/95 border-2 border-yellow-500 p-6 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.4)] text-center backdrop-blur-md max-w-sm w-full">
                         <Trophy size={48} className="mx-auto text-yellow-400 mb-2 animate-bounce" />
                         <h3 className="text-xl font-black text-white uppercase mb-1">HUYỀN THOẠI!</h3>
                         <p className="text-slate-400 text-xs mb-4">Bạn đã chinh phục tất cả các ải.</p>
                         <button onClick={handleRestart} className="w-full py-3 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-bold uppercase text-white shadow-lg hover:scale-105 transition flex items-center justify-center gap-2"><RotateCcw size={18} /> Chơi lại từ đầu</button>
                     </div>
                 </div>
            )}
        </div>
      )}

      {/* --- CHARACTER SELECT --- */}
      {gameState === 'CHAR_SELECT' && (
          <div className="max-w-4xl mx-auto p-6 h-full flex flex-col justify-center overflow-y-auto">
              <button onClick={() => setGameState('MAP')} className="w-fit mb-4 text-orange-400 flex items-center gap-2"><ArrowLeft /> Quay lại Map</button>
              <h2 className="text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500 mb-8 uppercase">Chọn Chiến Binh</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  {CHARACTERS.map(c => (
                      <div key={c.id} onClick={() => setSelectedChar(c)} className={`cursor-pointer p-6 rounded-2xl border-2 relative transition-all ${selectedChar?.id===c.id ? 'bg-gradient-to-b from-slate-800 to-black border-yellow-500 shadow-[0_0_20px_orange]' : 'bg-slate-900/50 border-slate-700'}`}>
                          <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${c.color} flex items-center justify-center mb-4`}>{c.icon}</div>
                          <h3 className="font-bold uppercase text-white">{c.name}</h3>
                          <p className="text-xs text-slate-400 mt-1">{c.desc}</p>
                          {selectedChar?.id===c.id && <div className="absolute top-2 right-2 bg-yellow-500 text-black rounded-full p-0.5"><Check size={14}/></div>}
                      </div>
                  ))}
              </div>
              <button disabled={!selectedChar} onClick={handleStartLevel} className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 rounded-xl font-black uppercase text-xl shadow-lg disabled:opacity-50 hover:scale-105 transition">Bắt Đầu 🔥</button>
          </div>
      )}

      {/* --- PLAYING SCREEN --- */}
      {gameState === 'PLAYING' && (
          <div className="max-w-4xl mx-auto h-full flex flex-col relative z-10">
              <div className="p-4 flex justify-between items-center bg-[#1a0505]/90 border-b border-orange-500/20 shrink-0">
                  <button onClick={() => setGameState('MAP')}><X className="text-slate-400"/></button>
                  <div className="flex-1 mx-4 h-3 bg-slate-900 rounded-full border border-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-red-600 transition-all duration-1000" style={{width: `${(timeLeft/((currentLevelData?.questions.length || 1)*90))*100}%`}} />
                  </div>
                  <div className="font-mono font-black text-orange-500">{timeLeft}s</div>
              </div>

              <div className="flex-1 p-4 flex flex-col justify-start overflow-y-auto custom-scrollbar">
                  {feedback && <div className="absolute inset-0 flex items-center justify-center z-50 text-8xl drop-shadow-[0_0_20px_rgba(0,0,0,1)] animate-bounce">{feedback==='CORRECT' ? '✅' : '❌'}</div>}
                  
                  {currentQuestion ? (
                    <>
                        <div className="bg-gradient-to-b from-slate-900 to-black p-6 rounded-3xl border-2 border-orange-500/30 shadow-[0_0_40px_rgba(234,88,12,0.2)] mb-6 flex flex-col items-center justify-center text-center">
                            
                            {/* [UPDATE] Nội dung text trước */}
                            <div className="text-xl md:text-2xl font-bold text-white/90 leading-loose" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                {renderWithInlineImage(currentQuestion.q, currentQuestion.img)}
                            </div>

                            {/* [UPDATE] Ảnh khối sau (nếu không có [img]) */}
                            {currentQuestion.img && !currentQuestion.q.includes('[img]') && (
                                <img src={currentQuestion.img} className="max-h-48 max-w-full rounded-xl border border-white/20 mt-4 shadow-lg object-contain bg-black/50" alt="Question Image" />
                            )}
                        </div>

                        {hintVisible && (
                            <div className="mb-4 p-3 bg-yellow-900/40 border border-yellow-500/40 rounded-lg text-yellow-200 text-sm flex gap-2 animate-in slide-in-from-top">
                                <Zap size={16} /> <MathRender content={currentQuestion.hint || "Không có gợi ý"} />
                            </div>
                        )}

                        {(() => {
                            if(currentQuestion.type === 'MCQ') return (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(currentQuestion.a || []).map((ans, idx) => {
                                        if(removedAnswers.includes(idx)) return <div key={idx} className="bg-black/20 rounded-xl border border-white/5 opacity-30 flex items-center justify-center grayscale py-4">🚫 Đã loại bỏ</div>;
                                        return (
                                            <button key={idx} onClick={() => handleAnswer(idx)} className="p-4 bg-slate-800 hover:bg-gradient-to-r hover:from-orange-600 hover:to-red-600 rounded-xl border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 font-bold text-lg text-left flex items-center gap-3 transition-all">
                                                <span className="bg-white/10 w-8 h-8 rounded flex items-center justify-center text-sm shrink-0">{String.fromCharCode(65+idx)}</span>
                                                <div className="flex-1 text-lg leading-relaxed flex flex-col items-center justify-center" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                    {/* [UPDATE] Render đáp án inline + block fallback */}
                                                    {renderWithInlineImage(ans, currentQuestion.aImages?.[idx])}
                                                    {currentQuestion.aImages?.[idx] && !ans.includes('[img]') && (
                                                        <img src={currentQuestion.aImages[idx]} className="h-16 mt-2 object-contain rounded-md" alt="Answer Image" />
                                                    )}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            );

                            if(currentQuestion.type === 'TF') return (
                                <div className="space-y-6">
                                    <div className="grid gap-3">
                                        {(currentQuestion.items || []).map((item, idx) => (
                                            <div key={idx} className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 flex flex-col md:flex-row md:items-center gap-3 shadow-sm">
                                                <div className="flex-1 font-bold text-base md:text-lg pl-2 border-l-4 border-orange-500" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
                                                    <span className="text-orange-400 mr-2 font-black">{String.fromCharCode(97+idx)})</span>
                                                    {/* [UPDATE] Render nội dung TF */}
                                                    {renderWithInlineImage(item.text, item.img)}
                                                    {item.img && !item.text.includes('[img]') && (
                                                        <img src={item.img} className="h-12 mt-2 rounded border border-white/20 block" />
                                                    )}
                                                </div>
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setTfSelection(prev => ({...prev, [idx]: "true"}))} className={`px-4 py-2 rounded-lg font-black uppercase border-b-4 active:border-b-0 active:translate-y-1 transition-all ${tfSelection[idx] === "true" ? 'bg-blue-600 border-blue-800 text-white shadow-[0_0_15px_blue]' : 'bg-slate-700 border-slate-900 text-slate-400 hover:bg-slate-600'}`}>Đúng</button>
                                                    <button onClick={() => setTfSelection(prev => ({...prev, [idx]: "false"}))} className={`px-4 py-2 rounded-lg font-black uppercase border-b-4 active:border-b-0 active:translate-y-1 transition-all ${tfSelection[idx] === "false" ? 'bg-red-600 border-red-800 text-white shadow-[0_0_15px_red]' : 'bg-slate-700 border-slate-900 text-slate-400 hover:bg-slate-600'}`}>Sai</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => handleAnswer("SUBMIT_TF")} className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-black uppercase text-xl shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 hover:brightness-110 flex items-center justify-center gap-2"><CheckCircle size={24}/> Chốt Phương Án</button>
                                </div>
                            );

                            if(currentQuestion.type === 'SA') return (
                                <div className="flex flex-col gap-6 max-w-2xl mx-auto">
                                    <div className="relative group">
                                        <input value={inputSA} onChange={e=>setInputSA(e.target.value)} placeholder="Nhập câu trả lời..." className="w-full p-6 bg-slate-900 border-2 border-slate-600 rounded-2xl text-center text-2xl md:text-3xl font-bold focus:border-orange-500 outline-none shadow-inner placeholder:text-slate-700 transition-all focus:bg-black uppercase" style={{ fontFamily: '"Times New Roman", Times, serif' }}/>
                                        <div className="absolute inset-0 rounded-2xl ring-4 ring-orange-500/20 group-focus-within:ring-orange-500/50 pointer-events-none transition-all"></div>
                                    </div>
                                    <button onClick={()=>handleAnswer(inputSA)} disabled={!inputSA.trim()} className="py-4 bg-gradient-to-r from-orange-600 to-red-600 rounded-xl font-black uppercase text-xl border-b-4 border-orange-900 active:border-b-0 active:translate-y-1 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"><CheckCircle size={24}/> Chốt Đáp Án</button>
                                </div>
                            );
                        })()}
                    </>
                  ) : (<div className="text-center text-slate-500 animate-pulse">Đang tải dữ liệu...</div>)}
              </div>

              <div className="p-4 flex justify-center pb-8 shrink-0 border-t border-white/5 bg-[#0f0202]">
                  <button onClick={activateSkill} disabled={skillUsed} className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold uppercase transition-all ${skillUsed ? 'bg-slate-900 text-slate-600' : `bg-gradient-to-r ${selectedChar.color} shadow-[0_0_20px_orange] hover:scale-105`}`}>
                      {skillUsed ? 'Đã dùng kỹ năng' : <>{selectedChar.icon} {selectedChar.name} <span className="text-xs ml-1 bg-black/20 px-2 py-0.5 rounded">{selectedChar.id === 'mage' ? 'Miễn phí' : '-20đ'}</span></>}
                  </button>
              </div>
          </div>
      )}

      {/* --- RESULT SCREEN --- */}
      {(gameState === 'WIN' || gameState === 'LOSE') && (
          <div className="h-full flex items-center justify-center p-4 z-50 relative">
              <div className="bg-[#1a0505] border-4 border-orange-500/30 p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-in zoom-in">
                  <div className="w-24 h-24 mx-auto -mt-20 bg-slate-800 rounded-full border-4 border-[#1a0505] flex items-center justify-center shadow-xl mb-4">
                      {gameState==='WIN' ? <Trophy size={60} className="text-yellow-400"/> : <RotateCcw size={60} className="text-slate-400"/>}
                  </div>
                  <h2 className={`text-4xl font-black uppercase mb-2 ${gameState==='WIN'?'text-yellow-400':'text-slate-400'}`}>{gameState === 'WIN' ? (currentLevelId === LEVEL_MAP.length ? "PHÁ ĐẢO!" : "HOÀN THÀNH!") : "THẤT BẠI!"}</h2>
                  <p className="text-slate-400 mb-8 font-bold uppercase text-sm leading-relaxed px-4">{gameState === 'WIN' ? (currentLevelId === LEVEL_MAP.length ? "Chúc mừng! Bạn đã chinh phục toàn bộ thử thách." : `Bạn đã vượt qua ải ${LEVEL_MAP.find(l=>l.id===currentLevelId)?.title}. Sẵn sàng đi tiếp nào!`) : 'Đừng nản chí, thất bại là mẹ thành công!'}</p>
                  
                  {gameState === 'WIN' && <div className="flex justify-center gap-2 mb-8 bg-black/20 p-2 rounded-xl">{[1,2,3].map(i => <Star key={i} size={32} className={i<=(userProgress.stars[currentLevelId]||0)?"text-yellow-400 fill-yellow-400":"text-slate-700"}/>)}</div>}

                  <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800"><div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Điểm</div><div className="text-3xl font-black text-white">{score}</div></div>
                        <div className="bg-gradient-to-br from-orange-900 to-red-900 p-4 rounded-xl border border-orange-500/30"><div className="text-orange-300 text-[10px] font-bold uppercase tracking-wider">XP Nhận được</div><div className="text-3xl font-black text-yellow-300">+{gameState==='WIN' ? score + (currentLevelId === LEVEL_MAP.length ? 500 : 200) : 0}</div></div>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                      {gameState === 'WIN' ? (
                          currentLevelId === LEVEL_MAP.length ? (
                              <>
                                  <button onClick={onBack} className="w-full py-4 bg-yellow-600 rounded-xl font-black uppercase hover:bg-yellow-500 shadow-lg border-b-4 border-yellow-800 active:border-b-0 active:translate-y-1 text-black animate-pulse flex items-center justify-center gap-2 text-lg"><Trophy size={24}/> Nhận Thưởng & Thoát</button>
                                  <button onClick={handleRestart} className="w-full py-3 bg-slate-700 rounded-xl font-bold uppercase hover:bg-slate-600 border-2 border-slate-500 flex items-center justify-center gap-2 text-slate-300 text-sm"><RotateCcw size={16}/> Chơi lại hành trình (Reset)</button>
                              </>
                          ) : (
                              <div className="flex gap-3">
                                  <button onClick={()=>setGameState('MAP')} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold uppercase hover:bg-slate-700 text-sm">Xem Map</button>
                                  <button onClick={()=>{ setCurrentLevelId(c=>c+1); setGameState('CHAR_SELECT'); }} className="flex-1 py-3 bg-green-600 rounded-xl font-bold uppercase hover:bg-green-500 shadow-lg border-b-4 border-green-800 active:border-b-0 active:translate-y-1 text-sm flex items-center justify-center gap-1">Màn Kế Tiếp <ArrowLeft size={16} className="rotate-180"/></button>
                              </div>
                          )
                      ) : (
                          <div className="flex gap-3">
                              <button onClick={()=>setGameState('MAP')} className="flex-1 py-3 bg-slate-800 rounded-xl font-bold uppercase hover:bg-slate-700 text-sm">Về Map</button>
                              <button onClick={handleStartLevel} className="flex-1 py-3 bg-orange-600 rounded-xl font-bold uppercase hover:bg-orange-500 shadow-lg border-b-4 border-orange-800 active:border-b-0 active:translate-y-1 text-sm">Chơi lại ngay</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}