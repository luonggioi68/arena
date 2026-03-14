import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, increment, onSnapshot, arrayUnion, getDoc } from 'firebase/firestore';
import { ShieldAlert, Zap, Flame, Loader2, Trophy, AlertTriangle, Clock, Target, Volume2, VolumeX } from 'lucide-react';

export default function TugOfWarPlayer() {
    const router = useRouter();
    const { pin } = router.query;

    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [session, setSession] = useState(null);
    const [questions, setQuestions] = useState([]);
    
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [questionCounter, setQuestionCounter] = useState(1);
    
    const [playerName, setPlayerName] = useState('');
    const [team, setTeam] = useState(null); 
    const [isJoined, setIsJoined] = useState(false);
    
    const [isFrozen, setIsFrozen] = useState(false);
    const [freezeTimer, setFreezeTimer] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);

    // === STATE & REFS CHO ÂM THANH / PHÁO HOA ===
    const [isMuted, setIsMuted] = useState(false); // Mặc định bật tiếng
    const bgmRef = useRef(null);
    const correctAudioRef = useRef(null);
    const wrongAudioRef = useRef(null);
    const winAudioRef = useRef(null);
    const fireworksFired = useRef(false);

    // 1. Khởi tạo Audio khi load trang
    useEffect(() => {
        if (typeof window !== 'undefined') {
            bgmRef.current = new Audio('https://cdn.pixabay.com/audio/2022/10/25/audio_40b08db6c8.mp3');
            bgmRef.current.loop = true;
            bgmRef.current.volume = 0.3; 
            
            correctAudioRef.current = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3');
            wrongAudioRef.current = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_79fa982e56.mp3');
            winAudioRef.current = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3');
        }
    }, []);

    // 2. Xử lý Nút Tắt/Mở tiếng cho tất cả Audio
    useEffect(() => {
        if (bgmRef.current) bgmRef.current.muted = isMuted;
        if (correctAudioRef.current) correctAudioRef.current.muted = isMuted;
        if (wrongAudioRef.current) wrongAudioRef.current.muted = isMuted;
        if (winAudioRef.current) winAudioRef.current.muted = isMuted;

        // Nếu người dùng chủ động Unmute khi đang chơi, hãy thử play lại BGM
        if (!isMuted && session?.status === 'PLAYING') {
            bgmRef.current?.play().catch(e => console.log(e));
        }
    }, [isMuted, session?.status]);

    const triggerFireworks = () => {
        import('canvas-confetti').then((module) => {
            const confetti = module.default;
            const duration = 5 * 1000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#06b6d4', '#ef4444', '#facc15'] });
                confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#06b6d4', '#ef4444', '#facc15'] });
                if (Date.now() < end) requestAnimationFrame(frame);
            };
            frame();
        });
    };

    useEffect(() => {
        if (!router.isReady) return;
        if (!pin) { setErrorMsg("Không tìm thấy mã PIN!"); setLoading(false); return; }

        let unsubSnapshot = null;
        const fetchSession = async () => {
            try {
                const q = query(collection(firestore, 'game_sessions_tug'), where('pin', '==', pin));
                const snap = await getDocs(q);
                
                if (!snap.empty) {
                    const sessionDoc = snap.docs[0];
                    const sessionData = { id: sessionDoc.id, ...sessionDoc.data() };
                    
                    unsubSnapshot = onSnapshot(doc(firestore, 'game_sessions_tug', sessionDoc.id), (docSnap) => {
                        if(docSnap.exists()) {
                            const data = { id: docSnap.id, ...docSnap.data() };
                            setSession(data);
                            
                            if (data.status === 'PLAYING' && !isMuted) {
                                bgmRef.current?.play().catch(e => console.log(e));
                            } else if (data.status === 'FINISHED') {
                                bgmRef.current?.pause();
                                if (!fireworksFired.current) {
                                    if (data.winner === team || data.winner === 'DRAW') {
                                        if (!isMuted) winAudioRef.current?.play().catch(e => console.log(e));
                                        triggerFireworks();
                                    }
                                    fireworksFired.current = true;
                                }
                            }
                        }
                    });

                    const quizSnap = await getDoc(doc(firestore, 'quizzes', sessionData.examId));
                    if (quizSnap.exists()) {
                        const qData = quizSnap.data().questions || [];
                        const validQuestions = qData.filter(q => q.type === 'MCQ' || q.type === 'TF');
                        setQuestions(validQuestions);
                    }
                } else { setErrorMsg("Mã PIN không tồn tại hoặc phòng đã đóng!"); }
            } catch (err) { setErrorMsg(err.message); } finally { setLoading(false); }
        };

        fetchSession();
        return () => { if (unsubSnapshot) unsubSnapshot(); };
    }, [router.isReady, pin, team, isMuted]);

    useEffect(() => {
        let interval;
        if (session?.status === 'PLAYING' && session?.endTime) {
            interval = setInterval(() => {
                const now = Date.now();
                const distance = session.endTime - now;
                if (distance <= 0) { clearInterval(interval); setTimeLeft(0); } 
                else { setTimeLeft(Math.floor(distance / 1000)); }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [session?.status, session?.endTime]);

    useEffect(() => {
        let interval;
        if (isFrozen && freezeTimer > 0) {
            interval = setInterval(() => setFreezeTimer(prev => prev - 1), 1000);
        } else if (freezeTimer === 0 && isFrozen) { setIsFrozen(false); }
        return () => clearInterval(interval);
    }, [isFrozen, freezeTimer]);

    const handleJoinTeam = async (selectedTeam) => {
        if (!playerName.trim()) return alert('Vui lòng nhập tên chiến binh!');
        setTeam(selectedTeam);
        setIsJoined(true); 

        // Khởi động Audio để vượt Autoplay block
        if (!isMuted) {
            bgmRef.current?.play().then(() => { if (session?.status !== 'PLAYING') bgmRef.current.pause(); }).catch(e => console.log(e));
        }

        try {
            const teamField = selectedTeam === 'RED' ? 'redPlayers' : 'bluePlayers';
            await updateDoc(doc(firestore, 'game_sessions_tug', session.id), { [teamField]: arrayUnion(playerName) });
        } catch (err) { alert("Lỗi tham gia: " + err.message); }
    };

    const handleAnswer = async (selectedOptionText, optionIndex) => {
        if (isFrozen || session?.status !== 'PLAYING') return;

        const currentQ = questions[currentQIndex] || {};
        let isCorrect = false;

        if (currentQ.correct !== undefined && currentQ.correct === optionIndex) isCorrect = true;
        else if (currentQ.correct === selectedOptionText) isCorrect = true;

        const teamScoreField = team === 'RED' ? 'redScore' : 'blueScore';
        const teamIndexField = team === 'RED' ? 'redQIndex' : 'blueQIndex';

        if (isCorrect) {
            if (!isMuted && correctAudioRef.current) {
                correctAudioRef.current.currentTime = 0;
                correctAudioRef.current.play().catch(e => console.log(e));
            }

            const ropeMove = team === 'RED' ? 1 : -1;
            try {
                await updateDoc(doc(firestore, 'game_sessions_tug', session.id), {
                    ropePosition: increment(ropeMove),
                    [teamScoreField]: increment(1),
                    [teamIndexField]: increment(1) 
                });
                setCurrentQIndex((prev) => (prev + 1) % questions.length);
                setQuestionCounter(prev => prev + 1);
            } catch (err) { console.error(err); }
        } else {
            if (!isMuted && wrongAudioRef.current) {
                wrongAudioRef.current.currentTime = 0;
                wrongAudioRef.current.play().catch(e => console.log(e));
            }

            setIsFrozen(true);
            setFreezeTimer(3);
            try { await updateDoc(doc(firestore, 'game_sessions_tug', session.id), { [teamIndexField]: increment(1) }); } catch (err) { console.error(err); }
            setCurrentQIndex((prev) => (prev + 1) % questions.length); 
            setQuestionCounter(prev => prev + 1);
        }
    };

    const calculateImageOffset = () => {
        if (!session) return 0;
        const margin = session.winMargin || 15;
        const pos = Math.max(Math.min(session.ropePosition, margin), -margin);
        return (pos / margin) * 40; 
    };

    const displayMins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const displaySecs = String(timeLeft % 60).padStart(2, '0');

    if (loading) return <div className="h-[100dvh] flex items-center justify-center bg-[#020617] text-cyan-400"><Loader2 className="animate-spin" size={48}/></div>;
    
    if (errorMsg) return (
        <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#020617] text-white p-6 text-center">
            <AlertTriangle size={60} className="text-red-500 mb-4 animate-pulse" />
            <h2 className="text-2xl font-black text-red-500 uppercase mb-2">LỖI!</h2>
            <p className="text-slate-300 bg-red-500/20 p-4 rounded-xl border border-red-500/50">{errorMsg}</p>
        </div>
    );

    if (!isJoined) {
        return (
            <div className="h-[100dvh] bg-[#020617] text-white flex flex-col p-6 relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/20 blur-[120px] rounded-full pointer-events-none"></div>
                
                <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full gap-6 relative z-10">
                    <div className="text-center mb-4">
                        <div className="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-400 to-red-600 rounded-3xl border-2 border-white/20 shadow-[0_0_30px_rgba(239,68,68,0.8)] flex items-center justify-center mb-4">
                            <Flame size={40} className="text-white animate-pulse" />
                        </div>
                        <h1 className="text-4xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">ARENA KÉO CO</h1>
                        <p className="text-orange-400 mt-2 font-black tracking-[0.3em] text-xs drop-shadow-md">SỨC MẠNH LÀ CHIẾN THẮNG</p>
                    </div>

                    <div className="bg-[#0a0a0a]/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl">
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest text-center">Tên Chiến Binh</label>
                        <input type="text" placeholder="Nhập tên của bạn..." value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full bg-black border-2 border-slate-700 p-4 rounded-2xl text-white font-black text-xl text-center outline-none focus:border-orange-500 transition-all shadow-inner" maxLength={20} />

                        <p className="text-xs font-bold text-slate-400 mt-8 mb-3 uppercase tracking-widest text-center">Chọn Phe Tranh Tài</p>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleJoinTeam('BLUE')} className="bg-[#0a192f] hover:bg-cyan-900 text-cyan-400 p-4 rounded-2xl font-black border-2 border-cyan-500 transition-all flex flex-col items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] active:scale-95 group">
                                <Zap size={36} className="group-hover:animate-bounce drop-shadow-[0_0_5px_currentColor]"/> <span className="uppercase tracking-widest text-sm">TIA CHỚP</span>
                            </button>
                            <button onClick={() => handleJoinTeam('RED')} className="bg-[#2a0808] hover:bg-red-900 text-red-500 p-4 rounded-2xl font-black border-2 border-red-500 transition-all flex flex-col items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] active:scale-95 group">
                                <Flame size={36} className="group-hover:animate-bounce drop-shadow-[0_0_5px_currentColor]"/> <span className="uppercase tracking-widest text-sm">TINH HOA</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const themeColor = team === 'RED' ? 'text-red-500' : 'text-cyan-400';
    const themeBorder = team === 'RED' ? 'border-red-500' : 'border-cyan-400';
    const themeBg = team === 'RED' ? 'bg-red-950/50' : 'bg-cyan-950/50';
    const themeShadow = team === 'RED' ? 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'shadow-[0_0_20px_rgba(6,182,212,0.3)]';

    if (session.status === 'WAITING' || session.status === 'FINISHED') {
        return (
            <div className={`h-[100dvh] bg-[#020617] text-white flex flex-col items-center justify-center p-6 text-center border-4 ${themeBorder} shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]`}>
                {session.status === 'WAITING' ? (
                    <>
                        <Loader2 size={80} className={`mx-auto mb-6 animate-spin ${themeColor}`}/>
                        <h2 className={`text-4xl font-black uppercase tracking-widest mb-2 drop-shadow-lg ${themeColor}`}>Đang chờ Host</h2>
                        <p className="text-slate-400 font-bold text-lg">Hãy nhìn lên màn hình chính. Chuẩn bị tinh thần!</p>
                    </>
                ) : (
                    <>
                        {session.winner === team ? (
                            <div className="animate-in zoom-in duration-300">
                                <Trophy size={120} className="mx-auto mb-6 text-yellow-400 drop-shadow-[0_0_40px_rgba(250,204,21,1)] animate-bounce" />
                                <h2 className="text-5xl md:text-6xl font-black uppercase text-green-400 tracking-widest drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]">THẮNG RỒI!</h2>
                                <p className="text-white mt-4 font-black text-xl bg-black/50 px-6 py-3 rounded-xl border border-white/10">Quá đỉnh, {playerName}!</p>
                            </div>
                        ) : session.winner === 'DRAW' ? (
                            <h2 className="text-5xl font-black uppercase text-slate-300 tracking-widest drop-shadow-lg">HÒA NHAU!</h2>
                        ) : (
                            <div>
                                <h2 className="text-5xl md:text-6xl font-black uppercase text-slate-600 tracking-widest drop-shadow-lg">THUA MẤT RỒI!</h2>
                                <p className="text-slate-400 mt-4 font-bold text-lg bg-black/50 px-6 py-3 rounded-xl border border-white/10">Lần sau kéo mạnh hơn nhé!</p>
                            </div>
                        )}
                        <button onClick={() => { bgmRef.current?.pause(); winAudioRef.current?.pause(); router.push('/'); }} className="mt-12 bg-white text-black px-10 py-4 rounded-xl font-black uppercase hover:scale-105 transition shadow-[0_0_30px_rgba(255,255,255,0.4)]">Thoát Căn Cứ</button>
                    </>
                )}
            </div>
        );
    }

    const currentQ = questions[currentQIndex] || {};
    const questionText = currentQ.q || "Câu hỏi không có nội dung";
    const optionList = currentQ.a || [];

    return (
        <div className="h-[100dvh] bg-[#0a0a0a] text-white flex flex-col font-sans relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            
            <header className="p-2 md:p-3 flex justify-between items-center border-b border-white/10 z-10 bg-[#0a0a0a]/90 backdrop-blur-xl shadow-lg shrink-0">
                <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-br from-yellow-400 to-red-600 p-2 rounded-xl shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                        <Flame size={16} className="text-white animate-pulse" />
                    </div>
                    <div className="hidden sm:block"> 
                        <h1 className="text-base md:text-lg font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600">ARENA KÉO CO</h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${themeBorder} ${themeBg} ${themeShadow}`}>
                        {team === 'RED' ? <Flame size={14} className="text-red-500"/> : <Zap size={14} className="text-cyan-400"/>}
                        <div className="flex flex-col items-end">
                            <span className={`font-black uppercase tracking-widest text-[10px] md:text-xs ${themeColor}`}>{team === 'RED' ? 'TINH HOA' : 'TIA CHỚP'}</span>
                            <span className="text-[9px] text-slate-300 truncate max-w-[80px]">{playerName}</span>
                        </div>
                    </div>

                    <div className="flex gap-1 md:gap-2">
                        
                        {/* NÚT TẮT/BẬT ÂM THANH CHO MOBILE */}
                        <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`px-2 md:px-3 py-1.5 rounded-xl border flex flex-col items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)] active:scale-95'}`}
                        >
                            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>

                        <div className="bg-slate-900 border border-slate-700 px-2 md:px-3 py-1 md:py-1.5 rounded-xl flex flex-col items-center justify-center">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1"><Clock size={10}/> Thời gian</span>
                            <span className={`font-mono font-black text-xs md:text-sm mt-0.5 ${timeLeft <= 60 ? 'text-red-500 animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : 'text-green-400'}`}>{session.status === 'PLAYING' ? `${displayMins}:${displaySecs}` : '--:--'}</span>
                        </div>
                        <div className="bg-black border border-white/20 px-2 md:px-3 py-1 md:py-1.5 rounded-xl flex flex-col items-center justify-center shadow-inner">
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1"><Target size={10}/> Điểm</span>
                            <span className="font-mono font-black text-xs md:text-sm text-white mt-0.5">{team === 'RED' ? session.redScore : session.blueScore}</span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="w-full h-20 md:h-32 bg-black relative overflow-hidden border-b-2 border-slate-800 flex items-center justify-center shrink-0 shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
                <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-yellow-400 z-10 border-l-[2px] border-dashed border-yellow-200 opacity-80 -translate-x-1/2 shadow-[0_0_10px_rgba(250,204,21,1)]"></div>
                <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-gradient-to-r from-cyan-600/20 to-transparent"></div>
                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l from-red-600/20 to-transparent"></div>

                <div className="absolute top-1/2 left-1/2 z-20 transition-transform duration-500 ease-out flex items-center justify-center drop-shadow-[0_10px_10px_rgba(0,0,0,1)] h-[85%] w-max" style={{ transform: `translate(calc(-50% + ${calculateImageOffset()}%), -50%)` }}>
                    <img src="/images/keo-co.png" alt="Học sinh kéo co" className="h-full w-auto object-contain" />
                </div>
            </div>

            <div className="flex-1 flex flex-col p-2 md:p-4 gap-2 md:gap-3 overflow-hidden relative">
                
                <div className={`bg-[#111] p-3 md:p-5 rounded-2xl border-2 ${themeBorder} text-left shadow-[0_0_20px_rgba(0,0,0,0.8)] shrink-0 flex flex-col max-h-[45%] overflow-hidden relative`}>
                    <div className={`absolute top-0 left-0 w-full h-1 ${team === 'RED' ? 'bg-red-500' : 'bg-cyan-400'} shrink-0`}></div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="mb-1 flex items-center"><span className={`text-[10px] md:text-sm font-black uppercase tracking-widest ${themeColor} drop-shadow-md`}>MẬT LỆNH SỐ {questionCounter}:</span></div>
                        <h2 className="text-lg md:text-2xl font-black leading-snug text-white break-words w-full drop-shadow-md" dangerouslySetInnerHTML={{ __html: questionText }} />
                        {currentQ.img && !questionText.includes('[img]') && (<img src={currentQ.img} alt="Minh họa" className="max-h-24 md:max-h-40 mt-2 rounded-xl border border-slate-700 object-contain shadow-lg" />)}
                    </div>
                </div>

                <div className="flex-1 flex flex-col md:grid md:grid-cols-2 gap-2 overflow-hidden pb-1">
                    {optionList.length > 0 ? (
                        optionList.map((opt, idx) => {
                            const labels = ['A', 'B', 'C', 'D'];
                            return (
                                <button key={idx} onClick={() => handleAnswer(opt, idx)} className={`bg-[#0a0a0a] hover:${team === 'RED' ? 'bg-red-950/40' : 'bg-cyan-950/40'} text-white rounded-xl md:rounded-2xl font-bold text-sm md:text-lg p-2 md:p-3 text-left border border-slate-800 active:bg-slate-700 transition-colors flex items-center gap-3 shadow-lg flex-1 overflow-hidden group`}>
                                    <span className={`bg-black w-8 h-8 md:w-12 md:h-12 text-sm md:text-xl rounded-lg md:rounded-xl flex items-center justify-center shrink-0 font-black border border-white/10 group-hover:border-transparent ${themeColor} group-hover:scale-110 transition-transform`}>{labels[idx] || '-'}</span>
                                    <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar max-h-full">
                                        <span dangerouslySetInnerHTML={{ __html: opt }} className="break-words leading-tight"/>
                                        {currentQ.aImages && currentQ.aImages[idx] && (<img src={currentQ.aImages[idx]} alt="Hình đáp án" className="h-8 md:h-14 mt-1 rounded object-contain"/>)}
                                    </div>
                                </button>
                            );
                        })
                    ) : (<div className="text-center text-slate-500 p-4 border border-dashed border-slate-700 rounded-xl flex-1 flex items-center justify-center">Không tìm thấy danh sách đáp án</div>)}
                </div>

                {isFrozen && (
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center animate-in fade-in duration-200 rounded-2xl m-2 border-2 border-red-600 shadow-[0_0_50px_rgba(239,68,68,0.5)]">
                        <AlertTriangle size={60} className="text-red-500 mb-3 animate-bounce drop-shadow-[0_0_20px_rgba(239,68,68,1)]" />
                        <h2 className="text-2xl md:text-3xl font-black text-red-500 uppercase tracking-widest mb-1 text-center drop-shadow-md">ĐÓNG BĂNG!</h2>
                        <p className="text-slate-400 font-bold mb-6 text-sm text-center px-4">Lệch nhịp rồi! Chờ reset năng lượng...</p>
                        <div className="w-20 h-20 md:w-28 md:h-28 rounded-full border-[8px] border-slate-900 border-t-red-500 flex items-center justify-center animate-spin shadow-[0_0_40px_rgba(239,68,68,0.8)]">
                            <div className="w-16 h-16 md:w-24 md:h-24 bg-black rounded-full flex items-center justify-center absolute animate-none" style={{ animationDirection: 'reverse' }}>
                                <span className="text-4xl md:text-6xl font-black text-white font-mono drop-shadow-[0_0_10px_currentColor]">{freezeTimer}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 10px; }
            `}</style>
        </div>
    );
}