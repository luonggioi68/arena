import React, { useState, useEffect, useRef } from 'react';
import { 
  Trash2, Plus, Upload, RotateCcw, 
  Users, Check, X, FileSpreadsheet, Type, Hash, 
  Flame, Trophy, Zap, Volume2, VolumeX, Sword, CheckSquare, Square,
  ArrowLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/router';

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
  const router = useRouter();

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
    
    // Gán width height thật để vẽ sắc nét, CSS sẽ lo việc thu phóng
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
      confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 }, colors: NEON_COLORS });
      confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 }, colors: NEON_COLORS });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  // --- 6. LOGIC QUAY ---
  const spin = () => {
    const activeEntries = entries.filter(e => e.active);
    if (activeEntries.length === 0) return alert("Danh sách trống!");
    if (isSpinning) return;

    setIsSpinning(true);
    setWinner(null);
    
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
      
      if (!isMuted) {
        clearInterval(spinSfxRef.current.interval);
        bgmRef.current.pause();
        winSfxRef.current.currentTime = 0;
        winSfxRef.current.play().catch(()=>{});
      }
      
      const winnerEntry = activeEntries[winnerIndex];
      setWinner(winnerEntry);
      triggerGrandConfetti();

      if (removeAfterSpin) {
        setEntries(prev => prev.map(e => e.id === winnerEntry.id ? { ...e, active: false } : e));
      }
    }, 5000);
  };

  return (
    // [CẬP NHẬT] Dùng h-[100dvh] để fix lỗi Safari trên iPhone, chống vỡ layout
    <div className="h-[100dvh] bg-[#050505] text-white font-sans flex flex-col overflow-hidden relative selection:bg-orange-500 selection:text-white">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/30 via-[#050505] to-black z-0 pointer-events-none"></div>
      
      {/* --- HEADER CHUẨN RESPONSIVE --- */}
      <header className="shrink-0 bg-black/80 backdrop-blur-md border-b border-orange-600/50 flex flex-col sm:flex-row justify-between items-center px-3 py-2 sm:px-6 sm:h-20 z-20 shadow-[0_5px_20px_rgba(220,38,38,0.3)] gap-2 sm:gap-0">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
              <button onClick={() => router.push('/')} className="text-slate-400 hover:text-white transition p-1.5 sm:p-2 rounded-lg hover:bg-slate-800 border border-transparent hover:border-slate-700" title="Về trang chủ">
                 <ArrowLeft size={20} className="sm:w-6 sm:h-6"/>
              </button>
              <div className="bg-gradient-to-br from-orange-500 to-red-600 p-1.5 sm:p-2 rounded-lg shadow-lg animate-pulse">
                <Flame size={20} className="sm:w-7 sm:h-7 text-white" fill="currentColor"/>
              </div>
              <div>
                <h1 className="text-lg sm:text-3xl font-black italic uppercase tracking-tighter text-transparent bg-clip-text fire-text leading-tight">
                  VÒNG XOAY GỌI TÊN
                </h1>
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em] leading-tight">Arena Edition</p>
              </div>
          </div>
          
          {/* Nút cài đặt hiển thị trên mobile ở góc trên cùng bên phải */}
          <div className="flex items-center gap-2 sm:hidden">
              <button onClick={() => setIsMuted(!isMuted)} className={`p-1.5 rounded-full transition ${!isMuted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-slate-800 text-slate-500'}`}>
                {isMuted ? <VolumeX size={16}/> : <Volume2 size={16}/>}
              </button>
          </div>
        </div>

        {/* Khu vực công cụ bên phải (Máy tính) / Hàng thứ 2 (Mobile) */}
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 sm:gap-4">
          <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer group">
            <div className={`w-8 sm:w-10 h-4 sm:h-5 rounded-full p-0.5 sm:p-1 transition-colors relative ${removeAfterSpin ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${removeAfterSpin ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'}`}></div>
            </div>
            <input type="checkbox" className="hidden" checked={removeAfterSpin} onChange={e => setRemoveAfterSpin(e.target.checked)} />
            <span className="text-[10px] sm:text-xs font-bold uppercase text-slate-400 group-hover:text-white transition">Xóa khi trúng</span>
          </label>
          
          <div className="h-5 sm:h-8 w-[1px] bg-slate-700 hidden sm:block"></div>
          
          <div className="flex gap-2">
              <button onClick={() => setIsMuted(!isMuted)} className={`hidden sm:block p-2 rounded-full transition ${!isMuted ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'bg-slate-800 text-slate-500'}`} title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}>
                {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
              </button>
              <button onClick={resetStatus} className="p-1.5 sm:p-2 bg-blue-900/50 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg border border-blue-800 transition flex items-center justify-center" title="Reset"><RotateCcw size={16} className="sm:w-5 sm:h-5"/></button>
              <button onClick={clearAll} className="p-1.5 sm:p-2 bg-red-900/50 text-red-400 hover:bg-red-600 hover:text-white rounded-lg border border-red-800 transition flex items-center justify-center" title="Xóa hết"><Trash2 size={16} className="sm:w-5 sm:h-5"/></button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT: RESPONSIVE LAYOUT --- */}
      {/* Mobile: flex-col (Vòng xoay trên, list dưới). Desktop: flex-row (List trái, vòng xoay phải) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden z-10">
        
        {/* KHU VỰC VÒNG XOAY: Đẩy lên trên cùng trên Mobile */}
        <div className="flex-[0.8] lg:flex-[1.2] flex flex-col items-center justify-center relative p-2 sm:p-6 min-h-[300px] lg:min-h-0 order-1 lg:order-2">
          
          {/* Căn chỉnh kích thước Vòng Xoay bằng max-w và aspect-square */}
          <div className="relative w-full max-w-[280px] sm:max-w-[400px] lg:max-w-[550px] aspect-square mx-auto flex items-center justify-center">
            
            {/* Cây Kiếm Chỉ Vị Trí */}
            <div className="absolute top-1/2 -right-2 sm:-right-4 lg:-right-8 -translate-y-1/2 z-30 drop-shadow-[0_0_15px_rgba(0,0,0,0.8)]">
               <Sword className="text-slate-200 fill-slate-300 rotate-[-90deg] drop-shadow-md w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20" strokeWidth={1.5} />
               <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1 sm:-translate-x-2 w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 bg-orange-500 rounded-full animate-ping"></div>
            </div>
            
            <div style={{ transform: `rotate(${rotation}deg)`, transition: isSpinning ? 'transform 5s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none' }} className="rounded-full w-full h-full relative z-10">
              <canvas ref={canvasRef} className="w-full h-full rounded-full" />
            </div>

            {/* Nút Bấm "QUAY" Ở Giữa */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <button onClick={spin} disabled={isSpinning} className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full bg-gradient-to-br from-red-600 to-orange-600 border-2 sm:border-4 border-black shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center justify-center group active:scale-95 transition-all disabled:grayscale disabled:opacity-80">
                <div className="absolute inset-0 rounded-full border border-white/20 animate-ping"></div>
                <span className="font-black text-white text-sm sm:text-base lg:text-xl uppercase italic tracking-wider drop-shadow-md group-hover:scale-110 transition-transform">QUAY</span>
              </button>
            </div>
          </div>

          {/* Popup Chiến Thắng */}
          {winner && !isSpinning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
              <div className="bg-[#111] border-2 border-yellow-500 p-6 sm:p-10 rounded-[2rem] text-center shadow-[0_0_100px_rgba(234,179,8,0.5)] relative overflow-hidden animate-in zoom-in-50 duration-500 max-w-md w-full">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
                <Trophy className="w-16 h-16 sm:w-20 sm:h-20 text-yellow-400 mx-auto mb-4 animate-bounce drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
                <h2 className="text-lg sm:text-2xl font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Người chiến thắng</h2>
                <div className="text-3xl sm:text-5xl lg:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-yellow-200 to-yellow-600 drop-shadow-2xl my-2 py-2 leading-tight break-words">{winner.label}</div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                  <button onClick={() => setWinner(null)} className="w-full sm:w-auto px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold uppercase tracking-wider transition border border-slate-600 text-sm">Đóng</button>
                  <button onClick={() => { setWinner(null); spin(); }} className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 text-sm"><Zap size={18}/> Quay tiếp</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KHU VỰC CÔNG CỤ NHẬP LIỆU: Nằm dưới (Mobile) hoặc Nằm trái (Desktop) */}
        <aside className="w-full lg:w-[400px] bg-[#0a0a0a]/90 border-t lg:border-t-0 lg:border-r border-slate-800 flex flex-col shadow-[0_-10px_20px_rgba(0,0,0,0.5)] lg:shadow-2xl z-20 backdrop-blur-sm h-1/2 lg:h-full shrink-0 order-2 lg:order-1">
          {/* TABS */}
          <div className="flex border-b border-slate-800 shrink-0">
            {[
              { id: 'manual', icon: <Type size={14} className="sm:w-4 sm:h-4"/>, label: 'Nhập tay' },
              { id: 'number', icon: <Hash size={14} className="sm:w-4 sm:h-4"/>, label: 'Số TT' },
              { id: 'excel', icon: <FileSpreadsheet size={14} className="sm:w-4 sm:h-4"/>, label: 'Excel' }
            ].map(tab => (
              <button 
                key={tab.id} onClick={() => setInputMode(tab.id)}
                className={`flex-1 py-3 sm:py-4 text-[11px] sm:text-xs font-bold uppercase tracking-wide flex justify-center items-center gap-1 sm:gap-2 transition-all relative ${inputMode === tab.id ? 'text-orange-500 bg-orange-500/10' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tab.icon} {tab.label}
                {inputMode === tab.id && <div className="absolute bottom-0 left-0 w-full h-[2px] bg-orange-500 shadow-[0_0_10px_orange]"></div>}
              </button>
            ))}
          </div>

          {/* INPUT AREA */}
          <div className="p-3 sm:p-5 border-b border-slate-800 bg-[#0f0f0f] shrink-0">
            {inputMode === 'manual' && (
              <div className="space-y-2 sm:space-y-3">
                <textarea 
                  className="w-full bg-black/50 border border-slate-700 rounded-xl p-2 sm:p-3 text-xs sm:text-sm text-white focus:border-orange-500 outline-none transition font-mono"
                  rows="2" placeholder="Nhập tên, mỗi dòng một người..."
                  value={textInput} onChange={e => setTextInput(e.target.value)}
                />
                <button onClick={handleManualInput} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 sm:py-3 rounded-xl text-xs font-black uppercase flex justify-center items-center gap-2 border border-slate-700 transition active:scale-95"><Plus size={16}/> Thêm dữ liệu</button>
              </div>
            )}
            {inputMode === 'number' && (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex gap-2 sm:gap-3">
                  <div className="flex-1"><label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">Từ số</label><input type="number" value={numStart} onChange={e => setNumStart(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-orange-500"/></div>
                  <div className="flex-1"><label className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">Đến số</label><input type="number" value={numEnd} onChange={e => setNumEnd(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded-lg p-2 text-white font-bold outline-none focus:border-orange-500"/></div>
                </div>
                <button onClick={handleNumberInput} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 sm:py-3 rounded-xl text-xs font-black uppercase flex justify-center gap-2 border border-slate-700 transition active:scale-95"><Hash size={16}/> Tạo dãy số</button>
              </div>
            )}
            {inputMode === 'excel' && (
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-4 sm:p-6 flex flex-col items-center justify-center bg-black/30 hover:bg-black/50 hover:border-orange-500/50 transition cursor-pointer relative group">
                <Upload className="text-slate-500 group-hover:text-orange-500 mb-1 sm:mb-2 transition w-6 h-6 sm:w-8 sm:h-8"/>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 group-hover:text-white uppercase">Chọn file Excel</span>
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
             
             <div className="flex items-center gap-2">
                 {deleteMode ? (
                     <button onClick={deleteSelected} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold uppercase px-2 py-1.5 rounded flex items-center gap-1 shadow-md">
                        <Trash2 size={12}/> Xóa ({selectedIds.size})
                     </button>
                 ) : (
                     <button onClick={() => setDeleteMode(true)} className="text-slate-400 hover:text-white text-[10px] font-bold uppercase underline">
                        Chọn xóa
                     </button>
                 )}
                 
                 {deleteMode && (
                     <button onClick={() => { setDeleteMode(false); setSelectedIds(new Set()); }} className="text-slate-500 hover:text-white text-[10px] ml-1 bg-slate-800 px-2 py-1.5 rounded">Hủy</button>
                 )}
             </div>
          </div>

          {/* LIST ITEMS - Cuộn linh hoạt */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 min-h-0 pb-10">
            <div className="space-y-1">
              {entries.map((entry) => (
                <div key={entry.id} className={`group flex items-center justify-between p-2 sm:p-2.5 rounded-lg border transition-all ${deleteMode && selectedIds.has(entry.id) ? 'bg-red-900/30 border-red-800' : entry.active ? 'bg-slate-900 border-slate-800' : 'bg-black border-transparent opacity-40'}`}>
                  
                  {/* Item Content */}
                  <div 
                      className="flex items-center gap-2 sm:gap-3 overflow-hidden cursor-pointer flex-1" 
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
                    
                    <span className={`truncate text-xs sm:text-sm font-bold ${entry.active ? 'text-slate-200' : 'text-slate-500 decoration-line-through'}`}>{entry.label}</span>
                  </div>

                  {/* Single Delete Button */}
                  {!deleteMode && (
                      <button onClick={() => deleteEntry(entry.id)} className="text-slate-600 hover:text-red-500 p-1 sm:opacity-0 sm:group-hover:opacity-100 transition"><X size={14}/></button>
                  )}
                </div>
              ))}
              {entries.length === 0 && (
                  <div className="text-center text-slate-600 text-xs italic mt-4">Chưa có người tham gia...</div>
              )}
            </div>
          </div>
        </aside>

      </main>

      {/* --- CSS STYLE INJECT --- */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; } 
        @media (min-width: 768px) { .custom-scrollbar::-webkit-scrollbar { width: 6px; } }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #ea580c; }
        
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