import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, onSnapshot, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Clock, CheckCircle, XCircle, AlertTriangle, User, Trophy, ArrowLeft, Home, Zap, Shield, Target, EyeOff, Lock, AlertOctagon, Flame } from 'lucide-react';
import confetti from 'canvas-confetti';
import MathRender from '@/components/MathRender'; 

export default function ExamRoom() {
  const router = useRouter();
  const { id, name, dob, class: className } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [scoreData, setScoreData] = useState({ score: 0, detail: [] });
  
  // State Thời gian & Gian lận
  const [timeLeft, setTimeLeft] = useState(0); 
  const [violationCount, setViolationCount] = useState(0);
  const [isCheatDetected, setIsCheatDetected] = useState(false); 
  const MAX_VIOLATIONS = 3; 

  const violationsRef = useRef(0);
  const isSubmittingRef = useRef(false);
  const lastViolationTimeRef = useRef(0);

  // --- HÀM RENDER VĂN BẢN KÈM ẢNH INLINE ---
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

  // 1. LOAD ĐỀ
 // 1. LOAD ĐỀ (REALTIME BẰNG ONSNAPSHOT)
  useEffect(() => {
    if (!id) return;
    
    // onSnapshot giúp lắng nghe mọi thay đổi từ phía Giáo viên (kể cả việc Bật/Tắt xem đáp án)
    const unsubscribe = onSnapshot(doc(firestore, "quizzes", id), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Nếu GV đóng thi mà HS chưa nộp bài thì mới văng ra ngoài
            if (data.status !== 'OPEN' && !submitted) {
                alert("Đề thi này đã đóng!");
                router.push('/');
                return;
            }
            
            // Cập nhật state quiz liên tục (để nhận cờ choPhepXemDapAn mới nhất)
            setQuiz(data);

            // Cập nhật câu hỏi và thời gian (CHỈ LÀM 1 LẦN để không bị trộn lại đề khi đang xem)
            setQuestions(prev => {
                if (prev.length > 0) return prev; // Đã load rồi thì giữ nguyên thứ tự cũ
                
                const durationMinutes = data.duration || 45;
                setTimeLeft(durationMinutes * 60);

                const formatQuestions = (qs) => qs.map(q => {
                    if(q.type === 'TF') {
                        return { ...q, items: q.items.map(i => ({...i, img: i.img || ''})) }
                    }
                    return q;
                });

                const p1 = formatQuestions(data.questions.filter(q => q.type === 'MCQ')).sort(() => Math.random() - 0.5);
                const p2 = formatQuestions(data.questions.filter(q => q.type === 'TF')).sort(() => Math.random() - 0.5);
                const p3 = formatQuestions(data.questions.filter(q => q.type === 'SA')).sort(() => Math.random() - 0.5);
                
                return [...p1, ...p2, ...p3];
            });
            
            setLoading(false);
        }
    }, (error) => {
        console.error("Lỗi tải đề:", error);
        setLoading(false);
    });

    // Cleanup listener khi học sinh thoát khỏi phòng thi
    return () => unsubscribe();
  }, [id, submitted, router]);

  // 2. CHỐNG GIAN LẬN
  useEffect(() => {
    if (loading || submitted) return;

    const handleViolation = (reason) => {
        if (submitted || isSubmittingRef.current) return;

        const now = Date.now();
        if (now - lastViolationTimeRef.current < 3000) return;

        lastViolationTimeRef.current = now;
        
        violationsRef.current += 1;
        setViolationCount(violationsRef.current);
        setIsCheatDetected(true);
        setTimeout(() => setIsCheatDetected(false), 2000);

        if (violationsRef.current >= MAX_VIOLATIONS) {
            alert(`⛔ VI PHẠM QUÁ ${MAX_VIOLATIONS} LẦN! TỰ ĐỘNG NỘP BÀI.`);
            handleSubmit(true, "Gian lận quá giới hạn");
        } else {
            alert(`⚠️ CẢNH BÁO (${violationsRef.current}/${MAX_VIOLATIONS}): ${reason}`);
        }
    };

    const handleVisibilityChange = () => { if (document.hidden) handleViolation("Rời màn hình!"); };
    const handleBlur = () => { handleViolation("Mất tập trung!"); };
    const preventCopy = (e) => { e.preventDefault(); return false; };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", preventCopy);
    document.addEventListener("copy", preventCopy);
    document.addEventListener("paste", preventCopy);
    document.addEventListener("cut", preventCopy);

    return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("blur", handleBlur);
        document.removeEventListener("contextmenu", preventCopy);
        document.removeEventListener("copy", preventCopy);
        document.removeEventListener("paste", preventCopy);
        document.removeEventListener("cut", preventCopy);
    };
  }, [loading, submitted]);

  // 3. ĐỒNG HỒ
  useEffect(() => {
    if (loading || submitted || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { handleSubmit(true, "Hết giờ làm bài"); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, submitted, timeLeft]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
// 3.5 BẢO VỆ NÚT BACK VÀ F5 (CHỐNG MẤT BÀI)
  useEffect(() => {
    if (loading || submitted) return;

    // A. Chặn học sinh bấm F5 (Tải lại trang) hoặc Tắt hẳn tab
    const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = 'Bạn đang làm bài thi! Nếu tải lại trang, toàn bộ kết quả sẽ bị mất.';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // B. Chặn học sinh bấm nút Back/Forward của trình duyệt (Cơ chế của Next.js)
    const handleRouteChangeStart = (url) => {
        // Nếu không phải đang trong quá trình nộp bài hợp lệ
        if (!isSubmittingRef.current) {
            const confirmLeave = window.confirm("⛔ CẢNH BÁO: Bạn đang trong thời gian làm bài!\n\nNếu bạn rời khỏi trang này, bài làm của bạn sẽ TỰ ĐỘNG ĐƯỢC NỘP với số điểm hiện tại. Bạn có chắc chắn muốn thoát?");
            
            if (confirmLeave) {
                // Nếu học sinh chọn "OK" -> Ép hệ thống tự động nộp bài luôn
                handleSubmit(true, "Thoát trang đột ngột");
            } else {
                // Nếu học sinh chọn "Cancel" -> Hủy lệnh Back, giữ học sinh ở lại trang thi
                router.events.emit('routeChangeError');
                throw 'Hủy chuyển trang để bảo vệ bài thi.';
            }
        }
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);

    // Dọn dẹp sự kiện khi component unmount
    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        router.events.off('routeChangeStart', handleRouteChangeStart);
    };
  }, [loading, submitted, answers]); // Thêm 'answers' vào đây để khi ép nộp bài, nó lấy được đáp án mới nhất
  // 4. LOGIC
  const handleAnswer = (qId, value, subIndex = null) => {
    if (submitted) return;
    setAnswers(prev => {
      if (subIndex !== null) {
        const currentGroup = prev[qId] || {};
        return { ...prev, [qId]: { ...currentGroup, [subIndex]: value } };
      }
      return { ...prev, [qId]: value };
    });
  };

  const calculateScore = () => {
    let totalScore = 0;
    const detail = [];
    const config = quiz.scoreConfig || { p1: 6, p3: 1 }; 

    const p1Count = questions.filter(q => q.type === 'MCQ').length;
    const p3Count = questions.filter(q => q.type === 'SA').length;
    
    const scorePerP1 = p1Count > 0 ? (config.p1 / p1Count) : 0;
    const scorePerP3 = p3Count > 0 ? (config.p3 / p3Count) : 0;

    questions.forEach(q => {
        let earned = 0;
        let isCorrect = false;

        if (q.type === 'MCQ') {
            if (answers[q.id] == q.correct) { 
                earned = scorePerP1;
                isCorrect = true;
            }
        }
        else if (q.type === 'TF') {
            let correctCount = 0;
            const userAns = answers[q.id] || {};
            q.items.forEach((item, idx) => {
                if (String(userAns[idx]) === String(item.isTrue)) correctCount++;
            });
            if (correctCount === 1) earned = 0.1;
            else if (correctCount === 2) earned = 0.25;
            else if (correctCount === 3) earned = 0.5;
            else if (correctCount === 4) { earned = 1.0; isCorrect = true; }
        }
        else if (q.type === 'SA') {
            const userText = String(answers[q.id] || "").trim().toLowerCase();
            const correctText = String(q.correct || "").trim().toLowerCase();
            if (userText && userText === correctText) {
                earned = scorePerP3;
                isCorrect = true;
            }
        }
        totalScore += earned;
        detail.push({ qId: q.id, earned, isCorrect });
    });

    return { totalScore: Math.min(10, totalScore.toFixed(2)), detail }; 
  };

  const handleSubmit = async (autoSubmit = false, reason = "Nộp chủ động") => {
    isSubmittingRef.current = true;

    if (!autoSubmit) {
        if (!confirm("Bạn chắc chắn muốn nộp bài?")) {
            setTimeout(() => { isSubmittingRef.current = false; }, 500);
            return;
        }
    }
    
    const result = calculateScore();
    setScoreData({ score: result.totalScore, detail: result.detail });
    setSubmitted(true);

    if (result.totalScore >= 5 && violationCount < MAX_VIOLATIONS) {
        const duration = 3000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 } });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 } });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }

    try {
        await addDoc(collection(firestore, "exam_results"), {
            examId: id,
            studentName: name,
            studentDob: dob,
            studentClass: className,
            score: result.totalScore,
            answers: answers, 
            detail: result.detail,
            violations: violationCount, 
            submitReason: reason, 
            submittedAt: serverTimestamp()
        });
    } catch (e) { console.error("Lỗi lưu điểm", e); }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white"><div className="animate-spin mr-3">⌛</div> Đang tải dữ liệu chiến trường...</div>;

  return (
    <div className={`min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-orange-500 selection:text-white pb-24 transition-colors duration-300 ${isCheatDetected ? 'bg-red-900/50' : ''}`}>
      
      {isCheatDetected && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-red-600/90 backdrop-blur-sm animate-pulse">
              <div className="text-center text-white">
                  <AlertOctagon size={100} className="mx-auto mb-4"/>
                  <h1 className="text-5xl font-black uppercase">CẢNH BÁO GIAN LẬN!</h1>
                  <p className="text-2xl mt-2 font-bold">Quay lại bài làm ngay lập tức!</p>
              </div>
          </div>
      )}

      <div className="fixed top-0 left-0 right-0 bg-[#1e293b]/95 backdrop-blur border-b border-white/10 z-50 px-3 md:px-4 py-2 shadow-2xl flex justify-between items-center h-16">
        <div className="flex items-center gap-2">
            <div className="bg-orange-600 p-1.5 rounded-lg shadow-[0_0_15px_#ea580c] animate-pulse">
                <Flame size={20} className="text-yellow-300" fill="currentColor"/>
            </div>
            <h1 className="hidden md:block text-xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 drop-shadow-[0_2px_2px_rgba(220,38,38,0.8)] leading-none">
                ARENA THI ONLINE
            </h1>
        </div>

        <div className="flex items-center gap-3 bg-slate-800/60 border border-white/10 px-3 py-1 rounded-full mx-2 flex-1 md:flex-none justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white border border-white/20 shrink-0">
                <User size={16}/>
            </div>
            <div className="flex flex-col">
                <span className="font-bold text-white uppercase text-xs md:text-sm leading-none truncate max-w-[120px] md:max-w-[200px]">{name}</span>
                <span className="text-[10px] text-slate-400 font-mono leading-tight">{dob}</span>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <div className={`flex items-center px-2 py-1 rounded-lg border text-xs font-bold ${violationCount > 0 ? 'bg-red-500 text-white border-red-400' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                <EyeOff size={14} className="md:mr-1"/> 
                <span>{violationCount}/{MAX_VIOLATIONS}</span>
            </div>

            {!submitted ? (
                <div className={`px-2 md:px-3 py-1 rounded-lg border font-mono font-bold text-sm md:text-base flex items-center gap-1 ${timeLeft < 300 ? 'bg-red-500/10 border-red-500 text-red-500 animate-pulse' : 'bg-emerald-500/10 border-emerald-500 text-emerald-400'}`}>
                    <Clock size={16}/> {formatTime(timeLeft)}
                </div>
            ) : (
                <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-lg border border-yellow-500/50 font-bold text-xs uppercase flex items-center gap-1">
                    <Trophy size={14}/>
                </div>
            )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto mt-20 px-3 md:px-4 space-y-6 md:space-y-8 select-none"> 
        <div className="text-center mb-6">
            <h1 className="text-xl md:text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">{quiz?.title}</h1>
            <div className="inline-flex gap-2 text-[10px] font-bold">
                <span className="bg-indigo-600 text-white px-2 py-1 rounded uppercase">Mã đề: {quiz?.code}</span>
                <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded uppercase">Lớp: {className}</span>
            </div>
        </div>
{/* CẢNH BÁO NẾU BỊ KHÓA ĐÁP ÁN */}
{submitted && !quiz?.choPhepXemDapAn && (
    <div className="bg-slate-900/80 border border-slate-700 p-6 rounded-2xl text-center mb-6 animate-in zoom-in">
        <Shield size={40} className="mx-auto text-slate-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-300">Tính năng xem đáp án đã bị khóa</h2>
        
    </div>
)}
        {questions.map((q, index) => {
            const isQCorrect = submitted && scoreData.detail.find(d => d.qId === q.id)?.isCorrect;
            const earnedPoints = submitted ? scoreData.detail.find(d => d.qId === q.id)?.earned : 0;

            return (
            <div key={q.id} className={`relative bg-[#1e293b] rounded-xl md:rounded-2xl border-2 overflow-hidden transition-all ${
               submitted 
    ? (quiz?.choPhepXemDapAn 
        ? (isQCorrect ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]') 
        : 'border-slate-700/50 opacity-70') // Nếu không cho xem, làm mờ đi
    : 'border-white/10 hover:border-indigo-500/50'
            }`}>
                <div className="bg-slate-800/50 px-4 py-2 md:px-5 md:py-3 border-b border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className={`text-[10px] md:text-xs font-black px-2 py-1 rounded uppercase ${
                            q.type === 'MCQ' ? 'bg-blue-600 text-white' : 
                            q.type === 'TF' ? 'bg-orange-600 text-white' : 'bg-purple-600 text-white'
                        }`}>
                            {q.type === 'MCQ' ? 'P1' : q.type === 'TF' ? 'P2' : 'P3'} - Câu {index + 1}
                        </span>
                        {submitted && quiz?.choPhepXemDapAn && <span className="text-xs font-bold text-yellow-400">+{parseFloat(earnedPoints).toFixed(2)}đ</span>}
                    </div>
                </div>

                <div className="p-3 md:p-5">
                    <div className="mb-4">
                        {/* 1. HIỂN THỊ NỘI DUNG VĂN BẢN TRƯỚC */}
                        <h3 className="text-base md:text-lg font-bold text-white leading-relaxed whitespace-pre-line mb-3">
                            {renderWithInlineImage(q.q, q.img)}
                        </h3>

                        {/* 2. HIỂN THỊ ẢNH SAU (Nếu không dùng thẻ [img]) */}
                        {/* CSS MỚI: Căn giữa, giới hạn chiều cao nhưng max-width 100% để hiển thị tốt ảnh lớn */}
                        {q.img && !q.q.includes('[img]') && (
                            <div className="w-full flex justify-center mb-3">
                                <img 
                                    src={q.img} 
                                    className="max-w-full h-auto max-h-80 md:max-h-96 rounded-lg border border-white/10 object-contain bg-black/20" 
                                    alt="Minh họa câu hỏi"
                                />
                            </div>
                        )}
                    </div>

                    {q.type === 'MCQ' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.a.map((ans, aIdx) => {
                                const isSelected = answers[q.id] == aIdx;
                                const isCorrectAns = q.correct == aIdx;
                                
                                let btnClass = "border-2 border-slate-700 bg-slate-800/50 hover:bg-slate-700";
                                if (submitted) {
    if (quiz?.choPhepXemDapAn) {
        if (isCorrectAns) btnClass = "border-green-500 bg-green-500/20 text-green-400";
        else if (isSelected && !isCorrectAns) btnClass = "border-red-500 bg-red-500/20 text-red-400"; 
        else btnClass = "border-slate-700 opacity-50";
    } else {
        if (isSelected) btnClass = "border-indigo-500 bg-indigo-600/50 text-white"; // Giữ lại phần học sinh chọn nhưng không tô đúng sai
        else btnClass = "border-slate-700 opacity-50";
    }
}

                                return (
                                    <button 
                                        key={aIdx} 
                                        onClick={() => handleAnswer(q.id, aIdx)}
                                        disabled={submitted}
                                        className={`p-4 md:p-5 rounded-xl text-left font-bold transition-all flex flex-col gap-2 ${btnClass} active:scale-95 touch-manipulation`}
                                    >   
                                        <div className="flex items-start gap-3 w-full">
                                            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs shrink-0 font-black uppercase mt-0.5">
                                                {String.fromCharCode(65 + aIdx)}
                                            </div>
                                            <div className="text-lg md:text-xl leading-snug flex-1">
                                                {renderWithInlineImage(ans, q.aImages?.[aIdx])}
                                            </div>
                                        </div>
                                        {/* CSS MỚI CHO ĐÁP ÁN: max-w-full để không bị tràn */}
                                        {q.aImages?.[aIdx] && !ans.includes('[img]') && (
                                            <img 
                                                src={q.aImages[aIdx]} 
                                                className="max-w-full h-auto max-h-48 rounded object-contain mt-2 self-start border border-white/10" 
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {q.type === 'TF' && (
                        <div className="border border-white/10 rounded-xl overflow-hidden overflow-x-auto">
                            <table className="w-full text-sm text-left min-w-[300px]">
                                <thead className="bg-slate-900 text-slate-400 uppercase font-black text-[10px] md:text-xs">
                                    <tr>
                                        <th className="px-3 py-3">Nội dung</th>
                                        <th className="px-2 py-3 text-center w-12 md:w-16">Đúng</th>
                                        <th className="px-2 py-3 text-center w-12 md:w-16">Sai</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {q.items.map((item, idx) => {
                                        const userChoice = answers[q.id]?.[idx]; 
                                        const trueKey = String(item.isTrue);
                                        const isRowCorrect = String(userChoice) === trueKey;
                                        let rowClass = "hover:bg-white/5";
if (submitted && quiz?.choPhepXemDapAn) rowClass = isRowCorrect ? "bg-green-500/10" : "bg-red-500/10";

                                        return (
                                            <tr key={idx} className={rowClass}>
                                                <td className="px-3 py-4 font-medium text-slate-200 text-base md:text-lg">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex gap-2">
                                                            <span className="font-bold text-slate-500 shrink-0">{String.fromCharCode(97+idx)})</span>
                                                            <div>{renderWithInlineImage(item.text, item.img)}</div>
                                                        </div>
                                                        {/* CSS MỚI CHO TF: max-w-full */}
                                                        {item.img && !item.text.includes('[img]') && (
                                                            <img 
                                                                src={item.img} 
                                                                className="max-w-full h-auto max-h-48 mt-1 ml-6 rounded border border-slate-600 block" 
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-center px-1 align-top pt-4">
    <button onClick={() => handleAnswer(q.id, "true", idx)} disabled={submitted} className={`w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 transition-all inline-flex items-center justify-center touch-manipulation ${userChoice === "true" ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'} ${submitted && quiz?.choPhepXemDapAn && item.isTrue === true ? 'ring-2 ring-green-400' : ''}`}>{userChoice === "true" && <CheckCircle size={18} className="text-white"/>}</button>
</td>
<td className="text-center px-1 align-top pt-4">
    <button onClick={() => handleAnswer(q.id, "false", idx)} disabled={submitted} className={`w-8 h-8 md:w-10 md:h-10 rounded-lg border-2 transition-all inline-flex items-center justify-center touch-manipulation ${userChoice === "false" ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600'} ${submitted && quiz?.choPhepXemDapAn && item.isTrue === false ? 'ring-2 ring-green-400' : ''}`}>{userChoice === "false" && <CheckCircle size={18} className="text-white"/>}</button>
</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {q.type === 'SA' && (
    <div>
        <input type="text" className={`w-full bg-[#0f172a] border-2 p-4 md:p-5 rounded-xl outline-none font-bold text-xl md:text-2xl placeholder-slate-600 uppercase ${submitted ? (quiz?.choPhepXemDapAn ? (isQCorrect ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400') : 'border-indigo-500 text-indigo-400') : 'border-slate-700 focus:border-indigo-500 text-white'}`} placeholder="NHẬP ĐÁP ÁN..." value={answers[q.id] || ''} onChange={(e) => handleAnswer(q.id, e.target.value)} disabled={submitted} />
        {submitted && quiz?.choPhepXemDapAn && !isQCorrect && (
            <div className="mt-3 text-base font-bold text-green-400 flex items-center gap-2 animate-pulse">
                <Target size={20}/> 
                <span>Đáp án đúng:</span> 
                <span className="text-lg">
                    {renderWithInlineImage(q.correct)}
                </span>
            </div>
        )}
                        </div>
                    )}
                </div>
            </div>
            );
        })}
    </main>

      <div className="fixed bottom-0 left-0 right-0 p-3 md:p-4 bg-[#020617]/90 backdrop-blur border-t border-white/10 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center gap-4">
            {!submitted ? (
                <button onClick={() => handleSubmit(false, "Nộp chủ động")} className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-lg md:text-xl shadow-lg uppercase italic flex items-center justify-center gap-2 transform hover:scale-[1.02] active:scale-[0.98] transition-all touch-manipulation">
                    <Zap fill="currentColor" /> NỘP BÀI CHIẾN ĐẤU
                </button>
            ) : (
                <div className="w-full flex gap-3 animate-in slide-in-from-bottom-10">
                    <div className="flex-1 bg-slate-800 text-white py-3 rounded-xl md:rounded-2xl flex flex-col items-center justify-center border border-white/10">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng điểm</span>
                        <span className={`text-2xl md:text-3xl font-black ${scoreData.score >= 5 ? 'text-green-400' : 'text-red-400'}`}>{scoreData.score}</span>
                    </div>
                    <button onClick={() => router.push('/')} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl md:rounded-2xl font-black uppercase italic flex items-center justify-center gap-2 shadow-lg touch-manipulation">
                        <Home size={20}/> Về trung tâm
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}