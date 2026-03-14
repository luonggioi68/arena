import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, serverTimestamp } from 'firebase/firestore';
import { Activity, Play, Trophy, Loader2, AlertTriangle, Zap, Flame, Target, Volume2, VolumeX, Info, X, BookOpen } from 'lucide-react';

export default function TugOfWarHost() {
    const router = useRouter();
    const { id: examId } = router.query;

    const [errorMsg, setErrorMsg] = useState(null);
    const [session, setSession] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [quizTitle, setQuizTitle] = useState('');
    const [questions, setQuestions] = useState([]);
    
    const [timeSetting, setTimeSetting] = useState(5);
    const [timeLeft, setTimeLeft] = useState(300);
    const timerRef = useRef(null);
    const isInitialized = useRef(false);

    const [isMuted, setIsMuted] = useState(false);
    const [showRules, setShowRules] = useState(false); // STATE BẬT/TẮT HƯỚNG DẪN
    
    const bgmRef = useRef(null);
    const winAudioRef = useRef(null);
    const fireworksFired = useRef(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            bgmRef.current = new Audio('https://cdn.pixabay.com/audio/2022/10/25/audio_40b08db6c8.mp3');
            bgmRef.current.loop = true;
            bgmRef.current.volume = 0.5;
            
            winAudioRef.current = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7443c.mp3');
            winAudioRef.current.volume = 0.8;
        }
    }, []);

    useEffect(() => {
        if (bgmRef.current) bgmRef.current.muted = isMuted;
        if (winAudioRef.current) winAudioRef.current.muted = isMuted;
    }, [isMuted]);

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
        if (session?.status === 'PLAYING') {
            if (!isMuted) bgmRef.current?.play().catch(e => console.log("Trình duyệt chặn Autoplay:", e));
        } else if (session?.status === 'FINISHED') {
            bgmRef.current?.pause();
            if (!fireworksFired.current) {
                if (!isMuted) winAudioRef.current?.play().catch(e => console.log(e));
                triggerFireworks();
                fireworksFired.current = true;
            }
        }
    }, [session?.status, isMuted]);

    useEffect(() => {
        if (!router.isReady) return; 
        if (!examId) return setErrorMsg("Không tìm thấy ID đề thi trên đường dẫn (URL)!");
        if (isInitialized.current) return;
        isInitialized.current = true;

        const initGame = async () => {
            try {
                const examSnap = await getDoc(doc(firestore, 'quizzes', examId));
                if (examSnap.exists()) {
                    setQuizTitle(examSnap.data().title);
                    const qData = examSnap.data().questions || [];
                    const validQuestions = qData.filter(q => q.type === 'MCQ' || q.type === 'TF');
                    setQuestions(validQuestions);
                } else {
                    throw new Error("Không tìm thấy đề thi này trong CSDL.");
                }

                const pin = Math.floor(1000 + Math.random() * 9000).toString();
                const newSessionRef = doc(collection(firestore, 'game_sessions_tug'));
                
                await setDoc(newSessionRef, {
                    pin: pin,
                    examId: examId,
                    status: 'WAITING', 
                    ropePosition: 0,
                    winMargin: 15, 
                    redScore: 0,
                    blueScore: 0,
                    blueQIndex: 0,
                    redQIndex: 0,
                    blueFinishedCount: 0, 
                    redFinishedCount: 0,  
                    redPlayers: [],  
                    bluePlayers: [], 
                    winner: null,
                    createdAt: serverTimestamp()
                });

                setSessionId(newSessionRef.id);
            } catch (error) {
                setErrorMsg(error.message);
            }
        };

        initGame();
    }, [router.isReady, examId]);

    useEffect(() => {
        if (!sessionId) return;

        const unsub = onSnapshot(doc(firestore, 'game_sessions_tug', sessionId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSession(data);

                if (data.status === 'PLAYING') {
                    const totalBlue = data.bluePlayers?.length || 0;
                    const totalRed = data.redPlayers?.length || 0;
                    const blueDone = data.blueFinishedCount || 0;
                    const redDone = data.redFinishedCount || 0;

                    const isBlueAllDone = totalBlue > 0 && blueDone >= totalBlue;
                    const isRedAllDone = totalRed > 0 && redDone >= totalRed;
                    const hasPlayers = totalBlue > 0 || totalRed > 0;

                    if (data.ropePosition >= data.winMargin) {
                        handleEndGame('RED');
                    } 
                    else if (data.ropePosition <= -data.winMargin) {
                        handleEndGame('BLUE');
                    } 
                    else if (hasPlayers && (totalBlue === 0 || isBlueAllDone) && (totalRed === 0 || isRedAllDone)) {
                        let winner = 'DRAW';
                        if (data.ropePosition > 0) winner = 'RED';
                        else if (data.ropePosition < 0) winner = 'BLUE';
                        handleEndGame(winner);
                    }
                }
            } else {
                setErrorMsg("Phiên chơi đã bị xóa hoặc không tồn tại.");
            }
        });

        return () => unsub();
    }, [sessionId]);

    useEffect(() => {
        if (session?.status === 'PLAYING' && timeLeft > 0) {
            timerRef.current = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);

            if (timeLeft % 3 === 0 && sessionId) {
                updateDoc(doc(firestore, 'game_sessions_tug', sessionId), { 
                    syncTimeLeft: timeLeft 
                }).catch(e => console.log("Lỗi đồng bộ:", e));
            }

        } else if (timeLeft === 0 && session?.status === 'PLAYING') {
            const winner = session.ropePosition > 0 ? 'RED' : (session.ropePosition < 0 ? 'BLUE' : 'DRAW');
            handleEndGame(winner);
        }

        return () => clearInterval(timerRef.current);
    }, [session?.status, timeLeft, sessionId]);

    const handleStartGame = async () => {
        try {
            setTimeLeft(timeSetting * 60);
            await updateDoc(doc(firestore, 'game_sessions_tug', sessionId), { 
                status: 'PLAYING',
                syncTimeLeft: timeSetting * 60
            });
            if (!isMuted) bgmRef.current?.play().catch(e => console.log(e));
        } catch (err) {
            setErrorMsg("Không thể bắt đầu game: " + err.message);
        }
    };

    const handleEndGame = async (winnerTeam) => {
        clearInterval(timerRef.current);
        await updateDoc(doc(firestore, 'game_sessions_tug', sessionId), { 
            status: 'FINISHED',
            winner: winnerTeam 
        });
    };

    const calculateImageOffset = () => {
        if (!session) return 0;
        const margin = session.winMargin || 15;
        const pos = Math.max(Math.min(session.ropePosition, margin), -margin);
        return (pos / margin) * 35; 
    };

    if (errorMsg) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white p-6 text-center">
            <AlertTriangle size={80} className="text-red-500 mb-6 animate-pulse" />
            <h2 className="text-3xl font-black text-red-500 uppercase mb-4 tracking-widest">LỖI KHỞI TẠO!</h2>
            <div className="bg-red-500/10 text-red-400 p-6 rounded-2xl border border-red-500/30 font-mono text-sm max-w-2xl">{errorMsg}</div>
        </div>
    );

    if (!session) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-cyan-400">
            <Loader2 className="animate-spin mb-4" size={60}/>
            <p className="font-bold animate-pulse text-slate-300 tracking-widest uppercase">Đang thiết lập đấu trường...</p>
        </div>
    );

    const currentSeconds = session.status === 'WAITING' ? timeSetting * 60 : timeLeft;
    const displayMins = String(Math.floor(currentSeconds / 60)).padStart(2, '0');
    const displaySecs = String(currentSeconds % 60).padStart(2, '0');

    let blueCurrentQ = null;
    let redCurrentQ = null;
    let isBlueFinished = false;
    let isRedFinished = false;
    let currentBlueIndexToDisplay = 0;
    let currentRedIndexToDisplay = 0;
    
    if (questions.length > 0 && session) {
        const totalBlue = session.bluePlayers?.length || 1;
        const totalRed = session.redPlayers?.length || 1;
        
        const blueDone = session.blueFinishedCount || 0;
        const redDone = session.redFinishedCount || 0;

        isBlueFinished = (blueDone >= totalBlue && session.bluePlayers?.length > 0);
        isRedFinished = (redDone >= totalRed && session.redPlayers?.length > 0);

        if (!isBlueFinished) {
            const blueAvg = Math.floor((session.blueQIndex || 0) / totalBlue);
            currentBlueIndexToDisplay = Math.min(blueAvg, questions.length - 1);
            blueCurrentQ = questions[currentBlueIndexToDisplay];
        }

        if (!isRedFinished) {
            const redAvg = Math.floor((session.redQIndex || 0) / totalRed);
            currentRedIndexToDisplay = Math.min(redAvg, questions.length - 1);
            redCurrentQ = questions[currentRedIndexToDisplay];
        }
    }

    return (
        <div className="h-screen bg-[#020617] text-white flex flex-col font-sans overflow-hidden relative selection:bg-orange-500 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            
            {/* VÙNG ÁNH SÁNG */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-cyan-600/10 blur-[150px] rounded-full pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/10 blur-[150px] rounded-full pointer-events-none"></div>

            {/* POPUP HƯỚNG DẪN CHƠI */}
            {showRules && (
                <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-[#0a0a0a] border-2 border-orange-500/50 rounded-3xl p-6 md:p-8 max-w-3xl w-full shadow-[0_0_50px_rgba(249,115,22,0.4)] relative">
                        <button onClick={() => setShowRules(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full">
                            <X size={24} />
                        </button>
                        
                        <h2 className="text-2xl md:text-3xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-600 mb-6 flex items-center gap-3">
                            <BookOpen className="text-orange-500" /> HƯỚNG DẪN CHIẾN ĐẤU
                        </h2>
                        
                        <div className="space-y-4 text-sm md:text-base text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                            <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/10 shadow-inner">
                                <h3 className="text-orange-400 font-black mb-2 uppercase tracking-widest text-xs flex items-center gap-2"><Target size={16}/> 1. Nhiệm vụ</h3>
                                <p>Học sinh quét mã QR hoặc truy cập trang, nhập <strong>Mã Phòng</strong> và chọn phe (<strong>Tia Chớp</strong> hoặc <strong>Tinh Hoa</strong>). Trả lời các câu hỏi để giúp đội mình lôi sợi dây về phía sân nhà.</p>
                            </div>

                            <div className="bg-cyan-900/20 p-5 rounded-2xl border border-cyan-500/30 shadow-inner">
                                <h3 className="text-cyan-400 font-black mb-2 uppercase tracking-widest text-xs flex items-center gap-2"><Zap size={16}/> 2. Cơ chế tích điểm</h3>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li>Trả lời <strong className="text-green-400">ĐÚNG</strong>: Cộng 1 lực kéo cho Đội. Dây sẽ nhích về một nhịp.</li>
                                    <li>Trả lời <strong className="text-red-500">SAI</strong>: Bị <strong className="text-red-400">đóng băng 3 giây</strong>, không được cộng điểm và chuyển luôn sang câu mới.</li>
                                </ul>
                            </div>

                            <div className="bg-red-900/20 p-5 rounded-2xl border border-red-500/30 shadow-inner">
                                <h3 className="text-red-400 font-black mb-2 uppercase tracking-widest text-xs flex items-center gap-2"><Trophy size={16}/> 3. Cách thức Phân thắng bại</h3>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li><strong className="text-yellow-400">Thắng Knock-out:</strong> Một đội quá áp đảo, kéo tuột dây về biên (chênh lệch 15 điểm) sẽ kết thúc game ngay lập tức.</li>
                                    <li><strong className="text-yellow-400">Hết giờ:</strong> Khi đồng hồ về 00:00, đội nào đang lợi thế về vị trí dây sẽ thắng.</li>
                                    <li><strong className="text-yellow-400">Hoàn thành bài:</strong> Toàn bộ học sinh hai bên đều đã giải xong tất cả mật lệnh, hệ thống sẽ chốt điểm hiện tại.</li>
                                </ul>
                            </div>
                        </div>

                        <button onClick={() => setShowRules(false)} className="w-full mt-6 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-black py-4 rounded-xl uppercase tracking-widest transition-all hover:scale-[1.02] shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                            ĐÃ HIỂU RÕ LUẬT!
                        </button>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <header className="p-2 md:p-3 flex justify-between items-center border-b border-orange-500/30 z-30 bg-[#0a0a0a]/90 backdrop-blur-xl shadow-lg shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-br from-yellow-400 to-red-600 p-2 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        <Flame size={20} className="text-white animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                            ARENA KÉO CO
                        </h1>
                        <p className="text-orange-400 font-black tracking-[0.2em] text-[8px] md:text-[10px] mt-0.5 drop-shadow-md">
                            SỨC MẠNH LÀ CHIẾN THẮNG
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4 bg-black/50 p-2 rounded-xl border border-white/10 shadow-inner">
                    <div className="flex flex-col items-end gap-1">
                        <p className="text-slate-400 font-bold tracking-widest text-[8px] md:text-[10px] uppercase flex items-center gap-2">
                            Mã Phòng: <span className="text-white text-xl md:text-2xl font-black bg-slate-800 px-2 py-0.5 rounded border border-slate-600 shadow-[0_0_10px_rgba(255,255,255,0.2)]">{session.pin}</span>
                        </p>
                        {session.status === 'WAITING' && (
                            <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                                <label className="text-[8px] font-bold text-orange-400 uppercase tracking-widest">Thi Đấu (Phút):</label>
                                <input type="number" min="1" max="60" value={timeSetting} onChange={(e) => setTimeSetting(parseInt(e.target.value) || 5)} className="w-10 bg-black border border-orange-500 text-white font-black text-center rounded outline-none focus:ring-2 focus:ring-orange-500 text-xs" />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 border-l border-white/10 pl-3 md:pl-4">
                        
                        {/* NÚT HƯỚNG DẪN CHƠI */}
                        <button 
                            onClick={() => setShowRules(true)}
                            className="p-2 md:p-3 rounded-lg border border-orange-500/50 bg-orange-500/20 text-orange-400 hover:scale-105 transition-all shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                            title="Hướng dẫn luật chơi"
                        >
                            <Info size={20} />
                        </button>

                        <button 
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-2 md:p-3 rounded-lg border flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)] hover:scale-105'}`}
                            title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                        >
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>

                        <div className="text-center">
                            <p className="text-[8px] text-slate-400 uppercase font-bold tracking-widest">Đồng Hồ</p>
                            <p className={`text-2xl md:text-3xl font-black font-mono drop-shadow-[0_0_10px_currentColor] ${timeLeft <= 60 && session.status === 'PLAYING' ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                                {displayMins}:{displaySecs}
                            </p>
                        </div>
                        {session.status === 'WAITING' && (
                            <button onClick={handleStartGame} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white px-4 py-2 rounded-lg font-black uppercase text-sm shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:scale-105 transition-all flex items-center gap-1 border border-red-400/50 group">
                                <Flame fill="currentColor" size={16} className="group-hover:animate-bounce"/> BẮT ĐẦU
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* MÀN HÌNH KẾT THÚC */}
            {session.status === 'FINISHED' && (
                <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center animate-in zoom-in duration-500">
                    <Trophy size={180} className="text-yellow-400 mb-8 drop-shadow-[0_0_80px_rgba(250,204,21,1)] animate-bounce" />
                    <h2 className={`text-7xl md:text-9xl font-black uppercase italic tracking-tighter mb-4 drop-shadow-[0_0_30px_currentColor] ${session.winner === 'RED' ? 'text-red-500' : session.winner === 'BLUE' ? 'text-cyan-400' : 'text-white'}`}>
                        {session.winner === 'RED' ? 'TINH HOA THẮNG!' : session.winner === 'BLUE' ? 'TIA CHỚP THẮNG!' : 'TRẬN HÒA!'}
                    </h2>
                    <p className="text-4xl text-slate-300 font-black tracking-widest mt-6">
                        Tỉ số: <span className="text-cyan-400">TIA CHỚP ({session.blueScore})</span> - <span className="text-red-500">TINH HOA ({session.redScore})</span>
                    </p>
                    <button onClick={() => { bgmRef.current?.pause(); winAudioRef.current?.pause(); router.push('/dashboard'); }} className="mt-16 bg-white text-black px-12 py-5 rounded-2xl font-black text-2xl uppercase hover:scale-110 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                        Trở về Căn Cứ
                    </button>
                </div>
            )}

            {/* KHU VỰC MAIN */}
            <main className="flex-1 flex flex-col relative p-4 gap-4 overflow-hidden">
                <div className="w-full flex justify-between z-30 shrink-0">
                    <div className="flex flex-col w-1/3 max-w-[250px]">
                        <div className="flex items-center gap-3 bg-[#0a192f]/80 backdrop-blur p-2 md:p-3 rounded-2xl border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-cyan-950 flex items-center justify-center border-2 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)] shrink-0">
                                <Zap size={20} className="text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,1)]"/>
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-black text-cyan-400 uppercase tracking-widest drop-shadow-md">TIA CHỚP</h2>
                                <p className="text-xl md:text-2xl font-black text-white leading-none">
                                    {session.status === 'WAITING' ? `${session.bluePlayers?.length || 0} Lính` : `${session.blueScore} Điểm`}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end w-1/3 max-w-[250px]">
                        <div className="flex items-center gap-3 bg-[#2a0808]/80 backdrop-blur p-2 md:p-3 rounded-2xl border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.4)] flex-row-reverse text-right">
                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-950 flex items-center justify-center border-2 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] shrink-0">
                                <Flame size={20} className="text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,1)]"/>
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-black text-red-500 uppercase tracking-widest drop-shadow-md">TINH HOA</h2>
                                <p className="text-xl md:text-2xl font-black text-white leading-none">
                                    {session.status === 'WAITING' ? `${session.redPlayers?.length || 0} Lính` : `${session.redScore} Điểm`}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex justify-between relative z-20 overflow-hidden min-h-0">
                    
                    {/* TRÁI: ĐỘI TIA CHỚP */}
                    <div className={`w-[32%] flex flex-col bg-[#0a192f]/80 backdrop-blur-md border-2 border-cyan-500/50 rounded-3xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-opacity duration-500 overflow-hidden ${session.status === 'PLAYING' ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="flex items-center gap-2 mb-3 border-b border-cyan-500/30 pb-2 shrink-0">
                            <Target size={18} className="text-cyan-400" />
                            <h3 className="font-black text-cyan-400 uppercase tracking-widest text-sm">Mật lệnh {currentBlueIndexToDisplay + 1}</h3>
                        </div>
                        {blueCurrentQ ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <h2 className="text-lg md:text-xl font-black text-white leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: blueCurrentQ.q }} />
                                {blueCurrentQ.img && !blueCurrentQ.q.includes('[img]') && (
                                    <img src={blueCurrentQ.img} alt="Hình" className="max-h-32 mt-3 rounded-xl border border-slate-700 mx-auto" />
                                )}
                                
                                {blueCurrentQ.a && blueCurrentQ.a.length > 0 && (
                                    <div className="mt-4 flex flex-col gap-2">
                                        {blueCurrentQ.a.map((opt, idx) => (
                                            <div key={idx} className="flex items-start gap-2 bg-cyan-950/40 p-2 rounded-xl border border-cyan-500/30 shadow-inner">
                                                <span className="font-black text-cyan-400 bg-black/80 w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs shadow-[0_0_10px_rgba(6,182,212,0.4)] mt-0.5">
                                                    {['A','B','C','D'][idx]}
                                                </span>
                                                <div className="flex flex-col text-left text-slate-200">
                                                    <span dangerouslySetInnerHTML={{ __html: opt }} className="text-sm font-bold leading-snug break-words"/>
                                                    {blueCurrentQ.aImages && blueCurrentQ.aImages[idx] && (
                                                        <img src={blueCurrentQ.aImages[idx]} className="max-h-12 mt-1 rounded object-contain border border-slate-700"/>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 italic text-sm">Đang tải mật lệnh...</div>
                        )}
                    </div>

                    {/* GIỮA: HOẠT ẢNH KÉO CO */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                        <div className="absolute left-1/2 top-0 bottom-8 w-[4px] bg-yellow-400 z-0 border-l-[4px] border-dashed border-yellow-200/50 -translate-x-1/2 shadow-[0_0_30px_rgba(250,204,21,1)]"></div>
                        <div 
                            className="z-20 transition-transform duration-700 ease-out flex justify-center drop-shadow-[0_30px_50px_rgba(0,0,0,0.8)] h-[50%] md:h-[65%] w-max"
                            style={{ transform: `translateX(${calculateImageOffset()}%)` }}
                        >
                            <img src="/images/keo-co.png" alt="Kéo co" className="h-full w-auto object-contain" />
                        </div>
                        <div className="absolute bottom-2 w-[60%] h-4 bg-black rounded-full z-30 border border-white/20 shadow-[0_0_20px_rgba(0,0,0,0.8)] overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)] w-1/2"></div>
                            <div className="absolute right-0 top-0 bottom-0 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] w-1/2"></div>
                            <div 
                                className="absolute top-1/2 w-8 h-8 bg-yellow-400 rounded-full border-4 border-black shadow-[0_0_30px_rgba(250,204,21,1)] transition-all duration-700 ease-out flex items-center justify-center"
                                style={{ left: `calc(50% + ${(session?.ropePosition / session?.winMargin) * 50}%)`, transform: 'translate(-50%, -50%)' }}
                            >
                                <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                            </div>
                        </div>
                    </div>

                    {/* PHẢI: ĐỘI TINH HOA */}
                    <div className={`w-[32%] flex flex-col bg-[#2a0808]/80 backdrop-blur-md border-2 border-red-500/50 rounded-3xl p-4 shadow-[0_0_30px_rgba(239,68,68,0.2)] transition-opacity duration-500 overflow-hidden ${session.status === 'PLAYING' ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="flex items-center gap-2 mb-3 border-b border-red-500/30 pb-2 shrink-0 flex-row-reverse text-right">
                            <Target size={18} className="text-red-500" />
                            <h3 className="font-black text-red-500 uppercase tracking-widest text-sm">Mật lệnh {currentRedIndexToDisplay + 1}</h3>
                        </div>
                        {redCurrentQ ? (
                            <div className="flex-1 overflow-y-auto custom-scrollbar pl-2 text-right">
                                <h2 
                                    className="text-lg md:text-xl font-black text-white leading-relaxed break-words"
                                    dangerouslySetInnerHTML={{ __html: redCurrentQ.q }}
                                />
                                {redCurrentQ.img && !redCurrentQ.q.includes('[img]') && (
                                    <img src={redCurrentQ.img} alt="Hình" className="max-h-32 mt-3 rounded-xl border border-slate-700 mx-auto" />
                                )}

                                {redCurrentQ.a && redCurrentQ.a.length > 0 && (
                                    <div className="mt-4 flex flex-col gap-2">
                                        {redCurrentQ.a.map((opt, idx) => (
                                            <div key={idx} className="flex items-start gap-2 bg-red-950/40 p-2 rounded-xl border border-red-500/30 shadow-inner flex-row-reverse">
                                                <span className="font-black text-red-500 bg-black/80 w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs shadow-[0_0_10px_rgba(239,68,68,0.4)] mt-0.5">
                                                    {['A','B','C','D'][idx]}
                                                </span>
                                                <div className="flex flex-col text-right text-slate-200">
                                                    <span dangerouslySetInnerHTML={{ __html: opt }} className="text-sm font-bold leading-snug break-words"/>
                                                    {redCurrentQ.aImages && redCurrentQ.aImages[idx] && (
                                                        <img src={redCurrentQ.aImages[idx]} className="max-h-12 mt-1 rounded object-contain border border-slate-700 ml-auto"/>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-500 italic text-sm">Đang tải mật lệnh...</div>
                        )}
                    </div>

                </div>
            </main>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 10px; }
            `}</style>
        </div>
    );
}