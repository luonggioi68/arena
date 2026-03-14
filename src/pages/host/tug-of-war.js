import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, collection, serverTimestamp } from 'firebase/firestore';
import { Activity, Play, Trophy, Loader2, AlertTriangle, Zap, Flame } from 'lucide-react';

export default function TugOfWarHost() {
    const router = useRouter();
    const { id: examId } = router.query;

    const [errorMsg, setErrorMsg] = useState(null);
    const [session, setSession] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [quizTitle, setQuizTitle] = useState('');
    
    const [timeSetting, setTimeSetting] = useState(5);
    const [timeLeft, setTimeLeft] = useState(300);
    const timerRef = useRef(null);
    const isInitialized = useRef(false);

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
                    redPlayers: [],  
                    bluePlayers: [], 
                    winner: null,
                    createdAt: serverTimestamp()
                });

                setSessionId(newSessionRef.id);
            } catch (error) {
                console.error("Lỗi khởi tạo game:", error);
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
                    if (data.ropePosition >= data.winMargin) handleEndGame('RED');
                    if (data.ropePosition <= -data.winMargin) handleEndGame('BLUE');
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
        } else if (timeLeft === 0 && session?.status === 'PLAYING') {
            const winner = session.ropePosition > 0 ? 'RED' : (session.ropePosition < 0 ? 'BLUE' : 'DRAW');
            handleEndGame(winner);
        }

        return () => clearInterval(timerRef.current);
    }, [session?.status, timeLeft]);

    const handleStartGame = async () => {
        try {
            setTimeLeft(timeSetting * 60);
            // LƯU MỐC THỜI GIAN KẾT THÚC (END TIME) ĐỂ MÁY HỌC SINH ĐỒNG BỘ
            const endTime = Date.now() + (timeSetting * 60 * 1000); 
            
            await updateDoc(doc(firestore, 'game_sessions_tug', sessionId), { 
                status: 'PLAYING',
                endTime: endTime // <-- Truyền lên Firebase
            });
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
        return (pos / margin) * 40; 
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

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans overflow-hidden relative selection:bg-orange-500 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            
            <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-600/20 blur-[150px] rounded-full pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/20 blur-[150px] rounded-full pointer-events-none"></div>

            <header className="p-4 md:p-6 flex justify-between items-center border-b border-orange-500/30 z-10 bg-[#0a0a0a]/80 backdrop-blur-xl shadow-[0_4px_30px_rgba(239,68,68,0.2)] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-yellow-400 to-red-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                        <Flame size={36} className="text-white animate-pulse" />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-600 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                            ARENA KÉO CO
                        </h1>
                        <p className="text-orange-400 font-black tracking-[0.3em] text-xs md:text-sm mt-1 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]">
                            SỨC MẠNH LÀ CHIẾN THẮNG
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6 bg-black/50 p-3 rounded-2xl border border-white/10 shadow-inner">
                    <div className="flex flex-col items-end gap-2">
                        <p className="text-slate-400 font-bold tracking-widest text-xs uppercase flex items-center gap-2">
                            Mã Phòng: <span className="text-white text-3xl font-black bg-slate-800 px-3 py-1 rounded-lg border border-slate-600 shadow-[0_0_15px_rgba(255,255,255,0.2)]">{session.pin}</span>
                        </p>
                        
                        {session.status === 'WAITING' && (
                            <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-orange-500/30 shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                                <label className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Thi Đấu (Phút):</label>
                                <input
                                    type="number" min="1" max="60"
                                    value={timeSetting}
                                    onChange={(e) => setTimeSetting(parseInt(e.target.value) || 5)}
                                    className="w-14 bg-black border border-orange-500 text-white font-black text-center rounded outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4 border-l border-white/10 pl-6">
                        <div className="text-center">
                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Đồng Hồ</p>
                            <p className={`text-4xl font-black font-mono drop-shadow-[0_0_10px_currentColor] ${timeLeft <= 60 && session.status === 'PLAYING' ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                                {displayMins}:{displaySecs}
                            </p>
                        </div>
                        {session.status === 'WAITING' && (
                            <button onClick={handleStartGame} className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white px-8 py-4 rounded-xl font-black uppercase text-xl shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:scale-105 transition-all flex items-center gap-2 border border-red-400/50 group">
                                <Flame fill="currentColor" size={24} className="group-hover:animate-bounce"/> BẮT ĐẦU CHIẾN
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {session.status === 'FINISHED' && (
                <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center animate-in zoom-in duration-500">
                    <Trophy size={180} className="text-yellow-400 mb-8 drop-shadow-[0_0_80px_rgba(250,204,21,1)] animate-bounce" />
                    <h2 className={`text-7xl md:text-9xl font-black uppercase italic tracking-tighter mb-4 drop-shadow-[0_0_30px_currentColor] ${session.winner === 'RED' ? 'text-red-500' : session.winner === 'BLUE' ? 'text-cyan-400' : 'text-white'}`}>
                        {session.winner === 'RED' ? 'TINH HOA THẮNG!' : session.winner === 'BLUE' ? 'TIA CHỚP THẮNG!' : 'TRẬN HÒA!'}
                    </h2>
                    <p className="text-4xl text-slate-300 font-black tracking-widest mt-6">
                        Tỉ số: <span className="text-cyan-400">TIA CHỚP ({session.blueScore})</span> - <span className="text-red-500">TINH HOA ({session.redScore})</span>
                    </p>
                    <button onClick={() => router.push('/dashboard')} className="mt-16 bg-white text-black px-12 py-5 rounded-2xl font-black text-2xl uppercase hover:scale-110 transition-transform shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                        Trở về Căn Cứ
                    </button>
                </div>
            )}

            <main className="flex-1 flex flex-col relative overflow-hidden">
                <div className="w-full flex justify-between px-10 pt-8 z-10 shrink-0">
                    
                    <div className="flex flex-col gap-2 max-w-sm">
                        <div className="flex items-center gap-4 bg-[#0a192f]/80 backdrop-blur p-4 rounded-2xl border-2 border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)] min-w-[280px]">
                            <div className="w-20 h-20 rounded-full bg-cyan-950 flex items-center justify-center border-4 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.8)] shrink-0">
                                <Zap size={40} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,1)]"/>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-cyan-400 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">TIA CHỚP</h2>
                                <p className="text-4xl font-black text-white">
                                    {session.status === 'WAITING' ? `${session.bluePlayers?.length || 0} Lính` : `${session.blueScore} Điểm`}
                                </p>
                            </div>
                        </div>
                        {session.status === 'WAITING' && (
                            <div className="flex flex-wrap gap-1 mt-2 max-h-32 overflow-y-auto">
                                {session.bluePlayers?.map((name, i) => (
                                    <span key={i} className="bg-cyan-950 border border-cyan-500/50 text-cyan-300 text-[10px] font-black px-2 py-1 rounded shadow-[0_0_10px_rgba(6,182,212,0.2)] animate-in fade-in zoom-in">{name}</span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 max-w-sm items-end">
                        <div className="flex items-center gap-4 bg-[#2a0808]/80 backdrop-blur p-4 rounded-2xl border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)] text-right flex-row-reverse min-w-[280px]">
                            <div className="w-20 h-20 rounded-full bg-red-950 flex items-center justify-center border-4 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] shrink-0">
                                <Flame size={40} className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,1)]"/>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-red-500 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">TINH HOA</h2>
                                <p className="text-4xl font-black text-white">
                                    {session.status === 'WAITING' ? `${session.redPlayers?.length || 0} Lính` : `${session.redScore} Điểm`}
                                </p>
                            </div>
                        </div>
                        {session.status === 'WAITING' && (
                            <div className="flex flex-wrap gap-1 mt-2 justify-end max-h-32 overflow-y-auto flex-row-reverse">
                                {session.redPlayers?.map((name, i) => (
                                    <span key={i} className="bg-red-950 border border-red-500/50 text-red-300 text-[10px] font-black px-2 py-1 rounded shadow-[0_0_10px_rgba(239,68,68,0.2)] animate-in fade-in zoom-in">{name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="absolute inset-0 top-40 flex items-center justify-center overflow-hidden">
                    <div className="absolute left-1/2 top-0 bottom-0 w-[4px] bg-yellow-400 z-0 border-l-[4px] border-dashed border-yellow-200/50 -translate-x-1/2 shadow-[0_0_30px_rgba(250,204,21,1)]"></div>
                    
                    <div 
                        className="absolute top-1/2 left-1/2 z-20 transition-transform duration-700 ease-out flex justify-center drop-shadow-[0_30px_50px_rgba(0,0,0,0.8)] h-[60%] md:h-[75%] w-max"
                        style={{ transform: `translate(calc(-50% + ${calculateImageOffset()}%), -50%)` }}
                    >
                        <img src="/images/keo-co.png" alt="Kéo co" className="h-full w-auto object-contain" />
                    </div>
                    
                    <div className="absolute bottom-16 w-[70%] h-4 bg-black rounded-full z-10 border border-white/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)] overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.8)] w-1/2"></div>
                        <div className="absolute right-0 top-0 bottom-0 bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)] w-1/2"></div>
                        <div 
                            className="absolute top-1/2 w-10 h-10 bg-yellow-400 rounded-full border-4 border-black shadow-[0_0_30px_rgba(250,204,21,1)] transition-all duration-700 ease-out flex items-center justify-center"
                            style={{ left: `calc(50% + ${(session.ropePosition / session.winMargin) * 50}%)`, transform: 'translate(-50%, -50%)' }}
                        >
                            <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}