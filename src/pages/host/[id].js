import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { db, firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, set, onValue, update } from 'firebase/database'; 
import { Users, ArrowLeft, Loader2, Play } from 'lucide-react';
import useAuthStore from '@/store/useAuthStore'; // Import auth store

export default function HostLobby() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuthStore();
  const [quiz, setQuiz] = useState(null);
  const [pin, setPin] = useState('');
  const [players, setPlayers] = useState([]);
  const [gameConfig, setGameConfig] = useState({ timeMCQ: 15, timeTF: 15, timeSA: 30 }); // Mặc định

  useEffect(() => {
    if (!id || !user) return;
    
    // 1. Lấy dữ liệu đề thi
    getDoc(doc(firestore, "quizzes", id)).then((snap) => {
      if (snap.exists()) setQuiz(snap.data());
    });

    // 2. Lấy cấu hình thời gian của giáo viên
    getDoc(doc(firestore, "user_configs", user.uid)).then((snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setGameConfig({
                timeMCQ: data.timeMCQ || 15,
                timeTF: data.timeTF || 15,
                timeSA: data.timeSA || 30
            });
        }
    });

    // 3. Tạo mã PIN
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    setPin(newPin);

    // 4. Khởi tạo phòng (Chưa lưu config ngay, lưu lúc start game)
    const roomRef = ref(db, `rooms/${newPin}`);
    set(roomRef, {
      gameState: 'WAITING',
      currentQuestion: 0,
      viewMode: 'CLASSIC',
      quizId: id,
      quiz: null, 
      createdAt: Date.now()
    });

    const playersRef = ref(db, `rooms/${newPin}/players`);
    return onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        setPlayers(Object.values(snapshot.val()));
      } else {
        setPlayers([]);
      }
    });
  }, [id, user]);

  useEffect(() => {
    if (quiz && pin) {
      update(ref(db, `rooms/${pin}`), { quiz: quiz });
    }
  }, [quiz, pin]);

  const startGame = async () => {
    if (players.length === 0) {
        if(!confirm("Chưa có ai vào phòng, thầy vẫn muốn bắt đầu chứ?")) return;
    }
    // [CẬP NHẬT] Lưu cấu hình thời gian vào phòng
    await update(ref(db, `rooms/${pin}`), { 
        gameState: 'PREPARE',
        currentQuestion: 0,
        config: gameConfig 
    });
    router.push(`/host/game/${pin}`);
  };

  if (!quiz) return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col gap-3 items-center justify-center font-bold">
        <Loader2 className="animate-spin text-indigo-500" size={40}/>
        <span>Đang khởi tạo đấu trường...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute top-6 left-6">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white transition font-bold uppercase tracking-widest"><ArrowLeft size={20}/> Quay lại</button>
      </div>

      <h1 className="text-2xl font-bold text-indigo-400 mb-2 uppercase tracking-tighter italic animate-pulse">SẴN SÀNG TRIỆU TẬP...</h1>
      <div className="bg-slate-800 p-8 rounded-[3rem] shadow-2xl border-b-[12px] border-indigo-600 mb-10 w-full max-w-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
        <p className="text-slate-400 font-bold mb-2 uppercase">Mã PIN tham gia:</p>
        <div className="text-8xl font-black text-yellow-400 tracking-tighter drop-shadow-lg font-mono">{pin}</div>
      </div>

      <div className="flex items-center gap-2 mb-6 bg-white/5 px-6 py-2 rounded-full border border-white/10">
        <Users className="text-indigo-400" />
        <span className="text-2xl font-black">{players.length} chiến binh đã vào</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mb-12">
        {players.map((p, i) => (
          <div key={i} className="bg-white/10 p-4 rounded-2xl font-bold text-xl animate-in zoom-in uppercase italic border border-white/5 flex items-center justify-center">
              {p.name}
          </div>
        ))}
      </div>

      <button onClick={startGame} className="bg-green-500 hover:bg-green-400 px-16 py-6 rounded-full font-black text-3xl shadow-[0_10px_0_#15803d] hover:translate-y-1 hover:shadow-[0_5px_0_#15803d] transition-all uppercase italic active:scale-95 flex items-center gap-2">
          VÀO PHÒNG ĐIỀU KHIỂN <Play fill="currentColor"/>
      </button>
      
      <p className="mt-10 text-slate-500 font-medium">Học sinh nhập PIN tại: <span className="text-white font-bold">/play</span></p>
    </div>
  );
}