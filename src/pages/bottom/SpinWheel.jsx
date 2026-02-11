import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, Plus, Upload, RotateCcw, 
  Users, Check, X, FileSpreadsheet, Type, Hash, 
  Flame, Trophy, Zap, Volume2, VolumeX, Sword, CheckSquare, Square,
  ArrowLeft // [THÊM MỚI] Import icon ArrowLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/router'; // [THÊM MỚI] Import useRouter

// --- CẤU HÌNH ÂM THANH ---
const AUDIO_SRC = {
  BGM: 'https://assets.mixkit.co/music/preview/mixkit-game-show-suspense-690.mp3', 
  SPIN: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  WIN: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3'
};

const NEON_COLORS = [
  '#FF0055', '#00E5FF', '#FFD500', '#7000FF', 
  '#FF4D00', '#00FF48', '#FF00AA', '#4D00FF'
];

export default function SpinWheelArena() {
  const router = useRouter(); // [THÊM MỚI] Khai báo router

  // --- STATE DỮ LIỆU ---
  const [entries, setEntries] = useState([]);
  const [inputMode, setInputMode] = useState('manual');
  const [textInput, setTextInput] = useState('');
  const [numStart, setNumStart] = useState(1);
  const [numEnd, setNumEnd] = useState(10);
  
  // State UI
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winner, setWinner] = useState(null);
  const [removeAfterSpin, setRemoveAfterSpin] = useState(false);
  
  // State Chế độ Xóa nhiều
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // State Âm thanh
  const [isMuted, setIsMuted] = useState(false);
  
  const canvasRef = useRef(null);
  const bgmRef = useRef(null);
  const spinSfxRef = useRef(null);
  const winSfxRef = useRef(null);

  // --- 1. KHỞI TẠO ---
  useEffect(() => {
    bgmRef.current = new Audio(AUDIO_SRC.BGM);
    bgmRef.current.loop = true; 
    bgmRef.current.volume = 0.3; 

    spinSfxRef.current = new Audio(AUDIO_SRC.SPIN);
    spinSfxRef.current.volume = 0.6;

    winSfxRef.current = new Audio(AUDIO_SRC.WIN);
    winSfxRef.current.volume = 1.0; 

    const savedData = localStorage.getItem('spinWheelArenaData');
    if (savedData) setEntries(JSON.parse(savedData));

    return () => {
      if (bgmRef.current) bgmRef.current.pause();
      if (spinSfxRef.current) spinSfxRef.current.pause();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('spinWheelArenaData', JSON.stringify(entries));
    drawWheel();
  }, [entries]);

  useEffect(() => {
    if (bgmRef.current) {
      if (isMuted) {
        bgmRef.current.pause();
        spinSfxRef.current.pause();
        winSfxRef.current.pause();
      } else {
        if (isSpinning) bgmRef.current.play().catch(()=>{});
      }
    }
  }, [isMuted]);

  // --- 2. LOGIC NHẬP LIỆU ---
  const handleManualInput = () => {
    const lines = textInput.split('\n').map(line => line.trim()).filter(line => line !== "");
    const newEntries = lines.map((label, index) => ({ id: Date.now() + index, label, active: true }));
    setEntries(prev => [...prev, ...newEntries]);
    setTextInput('');
  };
  const handleNumberInput = () => {
    const newEntries = [];
    for (let i = parseInt(numStart); i <= parseInt(numEnd); i++) {
      newEntries.push({ id: Date.now() + i, label: i.toString(), active: true });
    }
    setEntries(prev => [...prev, ...newEntries]);
  };
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const newEntries = [];
      data.forEach((row, idx) => {
        if (row[0]) newEntries.push({ id: Date.now() + idx, label: row[0].toString(), active: true });
      });
      setEntries(prev => [...prev, ...newEntries]);
    };
    reader.readAsBinaryString(file);
    e.target.value = null;
  };

  const toggleActive = (id) => setEntries(entries.map(e => e.id === id ? { ...e, active: !e.active } : e));
  const deleteEntry = (id) => setEntries(entries.filter(e => e.id !== id));
  const resetStatus = () => { setEntries(entries.map(e => ({ ...e, active: true }))); setRotation(0); setWinner(null); };
  
  const clearAll = () => { 
      if (confirm("Xóa toàn bộ danh sách?")) { 
          setEntries([]); setRotation(0); setWinner(null); setSelectedIds(new Set()); 
      }
  };

  // --- LOGIC XÓA NHIỀU ---
  const toggleSelection = (id) => {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
      setSelectedIds(newSelected);
  };

  const deleteSelected = () => {
      if (selectedIds.size === 0) return;
      if (confirm(`Bạn có chắc muốn xóa ${selectedIds.size} mục đã chọn?`)) {
          setEntries(entries.filter(e => !selectedIds.has(e.id)));
          setSelectedIds(new Set());
          setDeleteMode(false);
      }
  };

  // --- 4. VẼ CANVAS ---
  const drawWheel = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const activeEntries = entries.filter(e => e.active);
    const len = activeEntries.length;
    const size = 600; const center = size / 2; const radius = size / 2 - 20;
    
    canvas.width = size; canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    // Glow effect ring
    ctx.beginPath(); ctx.arc(center, center, radius + 10, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1a1a'; ctx.fill();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 10;
    ctx.shadowBlur = 20; ctx.shadowColor = '#fbbf24'; ctx.stroke(); ctx.shadowBlur = 0;

    if (len === 0) return;

    const arc = (2 * Math.PI) / len;
    activeEntries.forEach((entry, i) => {
      const angle = i * arc;
      ctx.beginPath(); ctx.moveTo(center, center);
      ctx.arc(center, center, radius, angle, angle + arc);
      ctx.fillStyle = NEON_COLORS[i % NEON_COLORS.length]; ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(center, center); ctx.rotate(angle + arc / 2);
      ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.font = "bold 24px Arial";
      ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 4;
      ctx.fillText(entry.label.substring(0, 18), radius - 30, 10);
      ctx.restore();
    });
  };

  // --- 5. HIỆU ỨNG BUNG LỤA (PHÁO HOA) ---
  const triggerGrandConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
      // Bắn từ 2 bên trái phải
      confetti({
        particleCount: 7,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: NEON_COLORS
      });
      confetti({
        particleCount: 7,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: NEON_COLORS
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  // --- 6. LOGIC QUAY ---
  const spin = () => {
    const activeEntries = entries.filter(e => e.active);
    if (activeEntries.length === 0) return alert("Danh sách trống!");
    if (isSpinning) return;

    setIsSpinning(true);
    setWinner(null);
    
    // Âm thanh bắt đầu
    if (!isMuted) {
      bgmRef.current.currentTime = 0;
      bgmRef.current.play().catch(()=>{}); 
      
      const spinInterval = setInterval(() => {
        if(Math.random() > 0.5) {
             spinSfxRef.current.currentTime = 0;
             spinSfxRef.current.play().catch(()=>{});
        }
      }, 150);
      spinSfxRef.current.interval = spinInterval;
    }

    const winnerIndex = Math.floor(Math.random() * activeEntries.length);
    const sliceAngle = 360 / activeEntries.length;
    const spins = 360 * 8; 
    const targetRotation = spins + (360 - (winnerIndex * sliceAngle) - (sliceAngle / 2));
    setRotation(rotation + targetRotation);

    setTimeout(() => {
      setIsSpinning(false);
      
      // Dừng nhạc quay, phát nhạc thắng
      if (!isMuted) {
        clearInterval(spinSfxRef.current.interval);
        bgmRef.current.pause();
        winSfxRef.current.currentTime = 0;
        winSfxRef.current.play().catch(()=>{});
      }
      
      const winnerEntry = activeEntries[winnerIndex];
      setWinner(winnerEntry);
      
      // KÍCH HOẠT HIỆU ỨNG BUNG LỤA
      triggerGrandConfetti();

      if (removeAfterSpin) {
        setEntries(prev => prev.map(e => e.id === winnerEntry.id ? { ...e, active: false } : e));
      }
    }, 5000);
  };

  return (
    <div className="h-screen bg-[#050505] text-white font-sans flex flex-col overflow-hidden relative selection:bg-orange-500 selection:text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/30 via-[#050505] to-black z-0 pointer-events-none"></div>
      
      {/* --- HEADER --- */}
      <header className="h-20 shrink-0 bg-black/80 backdrop-blur-md border-b border-orange-600/50 flex justify-between items-center px-6 z-20 shadow-[0_5px_20px_rgba(220,38,38,0.3)]">
        <div className="flex items-center gap-3">
          {/* [THÊM MỚI] NÚT VỀ TRANG CHỦ */}
          <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white transition p-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700 mr-2" title="Về trang chủ">
             <ArrowLeft size={24}/>
          </button>

          <div className="bg-gradient-to-br from-orange-500 to-red-600 p-2 rounded-lg shadow-lg animate-pulse">
            <Flame size={28} className="text-white" fill="currentColor"/>
          </div>
          <div>
            {/* [HIỆU ỨNG] LOGO RỰC LỬA - Dùng class CSS fire-text bên dưới */}
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text fire-text">
              VÒNG XOAY GỌI TÊN
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Arena Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className={`w-10 h-5 rounded-full p-1 transition-colors ${removeAfterSpin ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${removeAfterSpin ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </div>
            <input type="checkbox" className="hidden" checked={removeAfterSpin} onChange={e => setRemoveAfterSpin(e.target.checked)} />
            <span className="text-xs font-bold uppercase text-slate-400 group-hover:text-white transition">Loại sau khi quay</span>
          </label>
          <div className="h-8 w-[1px] bg-slate-700"></div>
          
          <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-full transition ${!isMuted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-slate-800 text-slate-500'}`} title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}>
            {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
          </button>
          
          <button onClick={resetStatus} className="p-2 bg-blue-900/50 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg border border-blue-800 transition" title="Reset"><RotateCcw size={20}/></button>
          <button onClick={clearAll} className="p-2 bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white rounded-lg border border-red-800 transition" title="Xóa hết"><Trash2 size={20}/></button>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex overflow-hidden z-10">
        
        {/* LEFT: TOOLS */}
        <aside className="w-96 bg-[#0a0a0a]/90 border-r border-slate-800 flex flex-col shadow-2xl z-20 backdrop-blur-sm h-full">
          {/* TABS */}
          <div className="flex border-b border-slate-800 shrink-0">
            {[
              { id: 'manual', icon: <Type size={16}/>, label: 'Nhập tay' },
              { id: 'number', icon: <Hash size={16}/>, label: 'Số TT' },
              { id: 'excel', icon: <FileSpreadsheet size={16}/>, label: 'Excel' }
            ].map(tab => (
              <button 
                key={tab.id} onClick={() => setInputMode(tab.id)}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-wide flex justify-center gap-2 transition-all relative ${inputMode === tab.id ? 'text-orange-500 bg-orange-500/10' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tab.icon} {tab.label}
                {inputMode === tab.id && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-orange-500 shadow-[0_0_10px_orange]"></div>}
              </button>
            ))}
          </div>

          {/* INPUT AREA */}
          <div className="p-5 border-b border-slate-800 bg-[#0f0f0f] shrink-0">
            {inputMode === 'manual' && (
              <div className="space-y-3">
                <textarea 
                  className="w-full bg-black/50 border border-slate-700 rounded-xl p-3 text-sm text-white focus:border-orange-500 outline-none transition font-mono"
                  rows="4" placeholder="Nhập tên, mỗi dòng một người..."
                  value={textInput} onChange={e => setTextInput(e.target.value)}
                />
                <button onClick={handleManualInput} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-xs font-black uppercase flex justify-center gap-2 border border-slate-700 transition active:scale-95"><Plus size={16}/> Thêm dữ liệu</button>
              </div>
            )}
            {inputMode === 'number' && (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Từ</label><input type="number" value={numStart} onChange={e => setNumStart(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-orange-500"/></div>
                  <div className="flex-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Đến</label><input type="number" value={numEnd} onChange={e => setNumEnd(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-orange-500"/></div>
                </div>
                <button onClick={handleNumberInput} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-xl text-xs font-black uppercase flex justify-center gap-2 border border-slate-700 transition active:scale-95"><Hash size={16}/> Tạo dãy số</button>
              </div>
            )}
            {inputMode === 'excel' && (
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 flex flex-col items-center justify-center bg-black/30 hover:bg-black/50 hover:border-orange-500/50 transition cursor-pointer relative group">
                <Upload className="text-slate-500 group-hover:text-orange-500 mb-2 transition" size={32}/>
                <span className="text-xs font-bold text-slate-400 group-hover:text-white uppercase">Chọn file Excel</span>
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer"/>
              </div>
            )}
          </div>

          {/* LIST HEADER with MULTI DELETE TOGGLE */}
          <div className="px-3 py-2 flex justify-between items-center bg-[#0a0a0a] z-10 border-b border-slate-800/50 shrink-0">
             <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Danh sách</span>
                 <span className="text-[10px] font-bold text-orange-500 bg-orange-900/20 px-1.5 rounded">{entries.filter(e => e.active).length} / {entries.length}</span>
             </div>
             
             {/* [MỚI] NÚT CHUYỂN CHẾ ĐỘ XÓA */}
             {deleteMode ? (
                 <button onClick={deleteSelected} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase px-2 py-1 rounded flex items-center gap-1">
                    <Trash2 size={12}/> Xóa ({selectedIds.size})
                 </button>
             ) : (
                 <button onClick={() => setDeleteMode(true)} className="text-slate-500 hover:text-white text-[10px] font-bold uppercase underline">
                    Chọn xóa
                 </button>
             )}
             
             {deleteMode && (
                 <button onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }} className="text-slate-500 hover:text-white text-[10px] ml-2">Hủy</button>
             )}
          </div>

          {/* LIST ITEMS */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 min-h-0">
            <div className="space-y-1">
              {entries.map((entry) => (
                <div key={entry.id} className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all ${deleteMode && selectedIds.has(entry.id) ? 'bg-red-900/30 border-red-800' : entry.active ? 'bg-slate-900 border-slate-800' : 'bg-black border-transparent opacity-40'}`}>
                  
                  {/* Item Content */}
                  <div 
                      className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1" 
                      onClick={() => {
                          if (deleteMode) toggleSelection(entry.id);
                          else toggleActive(entry.id);
                      }}
                  >
                    {/* Checkbox Icon */}
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 
                        ${deleteMode 
                            ? (selectedIds.has(entry.id) ? 'bg-red-600 border-red-500 text-white' : 'border-slate-600') 
                            : (entry.active ? 'bg-orange-600 border-orange-500 text-white' : 'border-slate-600')
                        }`}
                    >
                        {(deleteMode ? selectedIds.has(entry.id) : entry.active) && <Check size={10} strokeWidth={4}/>}
                    </div>
                    
                    <span className={`truncate text-sm font-bold ${entry.active ? 'text-slate-200' : 'text-slate-500 decoration-line-through'}`}>{entry.label}</span>
                  </div>

                  {/* Single Delete Button (Chỉ hiện khi không ở chế độ Delete Mode) */}
                  {!deleteMode && (
                      <button onClick={() => deleteEntry(entry.id)} className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><X size={14}/></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* RIGHT: ARENA */}
        <div className="flex-1 flex flex-col items-center justify-center relative p-8">
          <div className="relative transform scale-75 md:scale-100 transition-transform">
            <div className="absolute top-1/2 -right-8 -translate-y-1/2 z-30 drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
               <Sword size={64} className="text-slate-200 fill-slate-300 rotate-[-90deg] drop-shadow-md" strokeWidth={1.5} />
               <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-2 w-4 h-4 bg-orange-500 rounded-full animate-ping"></div>
            </div>
            <div style={{ transform: `rotate(${rotation}deg)`, transition: isSpinning ? 'transform 5s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none' }} className="rounded-full relative z-10">
              <canvas ref={canvasRef} className="rounded-full" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <button onClick={spin} disabled={isSpinning} className="w-24 h-24 rounded-full bg-gradient-to-br from-red-600 to-orange-600 border-4 border-black shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center justify-center group active:scale-95 transition-all disabled:grayscale disabled:opacity-80">
                <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping"></div>
                <span className="font-black text-white text-xl uppercase italic tracking-wider drop-shadow-md group-hover:scale-110 transition-transform">QUAY</span>
              </button>
            </div>
          </div>

          {winner && !isSpinning && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-[#111] border-2 border-yellow-500 p-10 rounded-[2rem] text-center shadow-[0_0_100px_rgba(234,179,8,0.5)] relative overflow-hidden animate-in zoom-in-50 duration-500 max-w-md w-full mx-4">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
                <Trophy size={80} className="text-yellow-400 mx-auto mb-4 animate-bounce drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                <h2 className="text-2xl font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Người chiến thắng</h2>
                <div className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-200 to-yellow-600 drop-shadow-2xl my-4 py-2">{winner.label}</div>
                <div className="flex gap-3 justify-center mt-8">
                  <button onClick={() => setWinner(null)} className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase tracking-wider transition border border-slate-600">Đóng</button>
                  <button onClick={() => { setWinner(null); spin(); }} className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg flex items-center gap-2"><Zap size={18}/> Quay tiếp</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- CSS STYLE INJECT --- */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
        
        /* Hiệu ứng Rực Lửa cho Tiêu Đề */
        .fire-text {
            background: linear-gradient(0deg, #f80 0%, #ff0 50%, #fff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            filter: drop-shadow(0 0 5px #f00);
            animation: burn 0.5s infinite alternate;
        }
        @keyframes burn {
            from { filter: drop-shadow(0 0 5px #f00) drop-shadow(0 0 10px #f80); }
            to { filter: drop-shadow(0 0 15px #ff0) drop-shadow(0 0 20px #f00); }
        }
      `}</style>
    </div>
  );
}