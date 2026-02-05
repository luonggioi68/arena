import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '@/store/useAuthStore';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy, addDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { Flag, Plus, Trash2, LogOut, Edit, Loader2, Shield, Gamepad2, FileText, BarChart3, Download, Search, Swords, Lock, Unlock, RefreshCw, MessageSquare, ExternalLink, Settings, UserPlus, CheckCircle, Save, Key, Users, GraduationCap, Clock, Image, LayoutTemplate, Upload, X, Hash, Link as LinkIcon, FolderOpen, QrCode, CheckSquare, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';

const MASTER_EMAILS = ["luonggioi68@gmail.com"]; 

const UploadBox = ({ label, img, onClick, onClear, loading }) => (
    <div className="relative group">
        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">{label}</label>
        <div onClick={onClick} className="border-2 border-dashed border-slate-700 rounded-2xl p-4 bg-slate-900/50 hover:bg-slate-900 transition flex flex-col items-center justify-center h-40 relative group cursor-pointer overflow-hidden shadow-inner">
            {img ? (
                <>
                    <img src={img} className="w-full h-full object-contain rounded-xl"/>
                    <button onClick={(e) => {e.stopPropagation(); onClear()}} className="absolute top-2 right-2 bg-red-600 p-1.5 rounded-full text-white shadow-lg hover:scale-110 transition"><X size={16}/></button>
                </>
            ) : (
                <div className="text-center text-slate-500 group-hover:text-cyan-400 transition-colors">
                    {loading ? <Loader2 className="animate-spin mx-auto mb-2"/> : <Upload size={32} className="mx-auto mb-2 opacity-50"/>}
                    <p className="text-sm font-bold">{loading ? 'Đang tải...' : 'Chọn ảnh'}</p>
                </div>
            )}
        </div>
        <input type="file" className="hidden" accept="image/*" />
    </div>
);

export default function Dashboard() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [boards, setBoards] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssigns, setSelectedAssigns] = useState([]);
  
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Refs cho upload ảnh
  const topBannerInput = useRef(null);
  const leftBannerInput = useRef(null);
  const rightBannerInput = useRef(null);
  const logoTitleInput = useRef(null); // [NEW] Ref cho Logo

  const [userConfig, setUserConfig] = useState({ 
      cloudinaryName: 'dcnsjzq0i', 
      cloudinaryPreset: 'gameedu', 
      geminiKey: '', 
      geminiModel: 'gemini-3-flash-preview', 
      timeMCQ: 15, 
      timeTF: 30, 
      timeSA: 30,
      submissionCode: ''
  });
  
  // [NEW] Thêm logoTitleImage vào state
  const [homeConfig, setHomeConfig] = useState({ topBanner: '', leftBanner: '', rightBanner: '', logoTitleImage: '' });
  
  const [activeTab, setActiveTab] = useState('LIBRARY'); 
  const [filterExamId, setFilterExamId] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.push('/'); return; }
      
      let whitelist = [...MASTER_EMAILS];
      try {
          const snap = await getDocs(collection(firestore, "allowed_emails"));
          setAllowedEmails(snap.docs.map(d => ({ id: d.id, ...d.data() }))); 
          whitelist = [...whitelist, ...snap.docs.map(d => d.data().email)];
      } catch (e) {}
      
      if (!whitelist.includes(currentUser.email)) { alert(`Tài khoản chưa cấp quyền!`); await signOut(auth); router.push('/'); return; }
      
      setUser(currentUser);
      
      try {
          const configSnap = await getDoc(doc(firestore, "user_configs", currentUser.uid));
          if (configSnap.exists()) setUserConfig({ ...userConfig, ...configSnap.data() });
          const homeSnap = await getDoc(doc(firestore, "system_config", "homepage"));
          if (homeSnap.exists()) setHomeConfig(homeSnap.data());
      } catch (e) {}
      
      await Promise.all([ 
          fetchQuizzes(currentUser.uid), 
          fetchResults(currentUser.uid), 
          fetchBoards(currentUser.uid), 
          fetchAssignments(currentUser) 
      ]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, setUser]);

  const fetchAssignments = async (currentUser) => {
      try {
          const u = currentUser || user;
          const s = await getDocs(collection(firestore, "assignments"));
          let allData = s.docs.map(d => ({ id: d.id, ...d.data() }));
          allData.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));

          if (!MASTER_EMAILS.includes(u.email)) {
              allData = allData.filter(item => 
                  item.teacherEmail && item.teacherEmail.toLowerCase() === u.email.toLowerCase()
              );
          }
          setAssignments(allData);
      } catch (e) { console.error("Lỗi tải bài nộp:", e); }
  };

  const handleSelectAll = (e) => {
      if (e.target.checked) {
          setSelectedAssigns(filteredAssignments.map(a => a.id));
      } else {
          setSelectedAssigns([]);
      }
  };

  const handleSelectOne = (id) => {
      if (selectedAssigns.includes(id)) {
          setSelectedAssigns(selectedAssigns.filter(item => item !== id));
      } else {
          setSelectedAssigns([...selectedAssigns, id]);
      }
  };

  const handleDeleteBulk = async () => {
      if (selectedAssigns.length === 0) return;
      if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedAssigns.length} bài nộp này không?`)) return;
      
      setLoading(true);
      try {
          await Promise.all(selectedAssigns.map(id => deleteDoc(doc(firestore, "assignments", id))));
          
          setAssignments(prev => prev.filter(a => !selectedAssigns.includes(a.id)));
          setSelectedAssigns([]); 
      } catch (e) {
          console.error(e);
          alert("Lỗi khi xóa bài: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const fetchQuizzes = async (userId) => { try { const q = query(collection(firestore, "quizzes"), where("authorId", "==", userId)); const s = await getDocs(q); const list = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds); list.forEach(async (q) => { if (!q.code) { const c = Math.floor(1000 + Math.random() * 9000).toString(); await updateDoc(doc(firestore, "quizzes", q.id), { code: c }); q.code = c; } }); setQuizzes(list); } catch (e) {} };
  const fetchResults = async () => { try { const q = query(collection(firestore, "exam_results"), orderBy("submittedAt", "desc")); const s = await getDocs(q); setResults(s.docs.map(d => ({ id: d.id, ...d.data() }))); } catch (e) {} };
  const fetchBoards = async (userId) => { try { const q = query(collection(firestore, "interactive_boards"), where("authorId", "==", userId), orderBy("createdAt", "desc")); const s = await getDocs(q); const list = s.docs.map(d => ({ id: d.id, ...d.data() })); list.forEach(async (b) => { if (!b.code) { const c = Math.floor(1000 + Math.random() * 9000).toString(); await updateDoc(doc(firestore, "interactive_boards", b.id), { code: c }); b.code = c; } }); setBoards(list); } catch (e) {} };
  const handleBannerUpload = async (e, key) => { const file = e.target.files[0]; if (!file) return; setUploading(true); const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", userConfig.cloudinaryPreset || 'gameedu'); try { const cloudName = userConfig.cloudinaryName || 'dcnsjzq0i'; const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData }); const data = await res.json(); if (data.secure_url) setHomeConfig(prev => ({ ...prev, [key]: data.secure_url })); else alert("Lỗi upload!"); } catch (err) { alert("Lỗi: " + err.message); } finally { setUploading(false); } };
  const saveUserConfig = async (e) => { e.preventDefault(); try { await setDoc(doc(firestore, "user_configs", user.uid), { ...userConfig, email: user.email }); alert("✅ Đã cập nhật Mã Nộp Bài và Cấu hình!"); } catch (e) { alert(e.message); } };
  const saveHomeConfig = async (e) => { e.preventDefault(); try { await setDoc(doc(firestore, "system_config", "homepage"), homeConfig); alert("✅ Đã lưu!"); } catch (e) { alert(e.message); } };
  const handleAddEmail = async (e) => { e.preventDefault(); if (!newEmail.includes('@')) return alert("Email sai!"); try { await addDoc(collection(firestore, "allowed_emails"), { email: newEmail, addedBy: user.email, createdAt: serverTimestamp() }); setAllowedEmails([...allowedEmails, { email: newEmail }]); setNewEmail(''); alert("Đã thêm!"); } catch (e) { alert(e.message); } };
  const handleDeleteEmail = async (id) => { if (!MASTER_EMAILS.includes(user.email)) return alert("Chỉ Admin gốc mới được xóa!"); if(confirm("Xóa?")) { await deleteDoc(doc(firestore, "allowed_emails", id)); setAllowedEmails(p => p.filter(e => e.id !== id)); } };
  const handleCreateBoard = async () => { const title = prompt("Tên chủ đề:"); if(title) { const code = Math.floor(1000 + Math.random() * 9000).toString(); await addDoc(collection(firestore, "interactive_boards"), { title, authorId: user.uid, authorEmail: user.email, code, createdAt: serverTimestamp(), status: 'OPEN' }); fetchBoards(user.uid); } };
  const handleDeleteBoard = async (id) => { if(confirm("Xóa bảng?")) { await deleteDoc(doc(firestore, "interactive_boards", id)); setBoards(p => p.filter(b => b.id !== id)); } };
  const handleRefreshResults = async () => { setIsRefreshing(true); await fetchResults(user.uid); setTimeout(() => setIsRefreshing(false), 500); };
  const handleDeleteQuiz = async (id) => { if(confirm("Xóa đề?")) { await deleteDoc(doc(firestore, "quizzes", id)); setQuizzes(p => p.filter(q => q.id !== id)); } };
  const handleToggleStatus = async (id, st) => { const n = st === 'OPEN' ? 'CLOSED' : 'OPEN'; await updateDoc(doc(firestore, "quizzes", id), { status: n }); setQuizzes(p => p.map(q => q.id === id ? { ...q, status: n } : q)); };
  const handleToggleExamMode = async (id, currentMode) => { const newMode = !currentMode; try { await updateDoc(doc(firestore, "quizzes", id), { isExamActive: newMode }); setQuizzes(p => p.map(q => q.id === id ? { ...q, isExamActive: newMode } : q)); } catch (e) { alert("Lỗi: " + e.message); } };
  const handleExportExcel = () => { const ws = XLSX.utils.json_to_sheet(filteredResults.map((r,i) => ({ "STT": i+1, "Tên": r.studentName, "Lớp": r.studentClass, "Điểm": r.score, "Ngày": r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : '' }))); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data"); XLSX.writeFile(wb, "KetQua.xlsx"); };
  const handleDeleteResults = async () => { if(filterExamId === 'ALL') return alert("Chọn đề để xóa!"); if(confirm("Xóa kết quả?")) { await Promise.all(filteredResults.map(r => deleteDoc(doc(firestore, "exam_results", r.id)))); setResults(p => p.filter(r => !filteredResults.find(fr => fr.id === r.id))); } };
  const handleDeleteAssignment = async (id) => { if(!confirm("Xóa bài này?")) return; await deleteDoc(doc(firestore, "assignments", id)); setAssignments(prev => prev.filter(a => a.id !== id)); };

  const myResults = useMemo(() => results.filter(r => quizzes.some(q => q.id === r.examId)), [results, quizzes]);
  const filteredResults = useMemo(() => myResults.filter(r => (filterExamId === 'ALL' || r.examId === filterExamId) && (filterClass === 'ALL' || r.studentClass === filterClass)), [myResults, filterExamId, filterClass]);
  const uniqueClasses = useMemo(() => [...new Set(myResults.map(r => r.studentClass).filter(Boolean))].sort(), [myResults]);
  const uniqueExams = useMemo(() => quizzes.filter(q => new Set(myResults.map(r => r.examId)).has(q.id)), [quizzes, myResults]);
  const stats = useMemo(() => { if (!filteredResults.length) return { avg: 0, pass: 0, fail: 0 }; const total = filteredResults.reduce((s, r) => s + (parseFloat(r.score)||0), 0); const pass = filteredResults.filter(r => parseFloat(r.score)>=5).length; return { avg: (total/filteredResults.length).toFixed(2), pass, fail: filteredResults.length - pass }; }, [filteredResults]);
  
  const uniqueAssignmentClasses = useMemo(() => { const classes = assignments.map(a => a.className).filter(c => c && c.trim() !== ''); return [...new Set(classes)].sort(); }, [assignments]);
  const filteredAssignments = useMemo(() => { return assignments.filter(a => filterClass === 'ALL' || a.className === filterClass); }, [assignments, filterClass]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-orange-500 selection:text-white flex">
      {/* Sidebar - giữ nguyên */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#020617] text-white flex flex-col border-r border-white/10 shadow-2xl z-50">
        <div className="p-6 border-b border-white/10"><div className="flex items-center gap-3 text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 uppercase tracking-tighter"><Shield fill="currentColor" className="text-orange-500" size={32}/> <span>Edu Arena<br/><span className="text-sm text-white not-italic tracking-widest font-normal">CONNECT</span></span></div></div>
        <nav className="flex-1 p-4 space-y-2">
            <button onClick={() => setActiveTab('LIBRARY')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'LIBRARY' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><Gamepad2 size={20}/> ARENA KHO VŨ KHÍ</button>
            <button onClick={() => setActiveTab('INTERACTIVE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'INTERACTIVE' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><MessageSquare size={20}/> ARENA TƯƠNG TÁC</button>
            <button onClick={() => setActiveTab('RESULTS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'RESULTS' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><BarChart3 size={20}/>ARENA QUẢN LÝ THI</button>
            <button onClick={() => setActiveTab('ASSIGNMENTS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'ASSIGNMENTS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}><FolderOpen size={20}/>ARENA CHẤM BÀI</button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'SETTINGS' ? 'bg-slate-700 text-white border border-white/20' : 'text-slate-400 hover:bg-white/5'}`}><Settings size={20}/>ARENA CẤU HÌNH</button>
        </nav>
        <div className="p-4 border-t border-white/10"><button onClick={() => {signOut(auth); router.push('/')}} className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 py-3 rounded-xl font-bold uppercase text-sm"><LogOut size={18}/> Đăng xuất</button></div>
      </aside>

      <main className="flex-1 ml-64 p-8 overflow-y-auto min-h-screen bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
        
        {/* TAB LIBRARY (Giữ nguyên) */}
        {activeTab === 'LIBRARY' && (<div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><header className="flex justify-between items-center mb-10"><div><h1 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg">Kho Vũ Khí</h1><p className="text-slate-400 mt-1 font-medium">Quản lý các bộ đề</p></div><button onClick={() => router.push('/create-quiz')} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 transition"><Plus size={20}/> Chế tạo đề mới</button></header><div className="grid grid-cols-3 gap-6">{quizzes.map(q=><div key={q.id} className={`bg-[#1e293b]/80 backdrop-blur-md rounded-[2rem] border transition-all duration-300 group overflow-hidden shadow-xl hover:shadow-2xl ${q.isExamActive ? 'border-red-500/50 shadow-red-500/10' : 'border-white/10 hover:border-indigo-500/50'}`}><div className="h-32 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden"><FileText size={48} className="text-indigo-400 group-hover:scale-110 transition-transform duration-500"/><div className="absolute top-4 left-4"><span className="bg-yellow-400 text-black px-2 py-1 rounded font-black text-xs shadow-lg flex items-center gap-1"><Hash size={12}/> {q.code || '---'}</span></div><div className="absolute top-4 right-4 flex flex-col items-end gap-1"><span className={`text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg ${q.status === 'OPEN' ? 'bg-green-500 text-black' : 'bg-slate-700 text-slate-400'}`}>{q.status === 'OPEN' ? 'Game: Mở' : 'Game: Đóng'}</span>{q.isExamActive && (<span className="text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg bg-red-600 text-white animate-pulse">ĐANG THI</span>)}</div></div><div className="p-6"><h3 className="text-xl font-black mb-1 truncate text-white uppercase italic tracking-tight">{q.title}</h3><div className="flex justify-between items-center mb-6"><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{q.questions?.length || 0} Mật lệnh</p><span className="text-slate-500 text-xs">{new Date(q.createdAt?.seconds * 1000).toLocaleDateString()}</span></div><div className="grid grid-cols-5 gap-2"><button onClick={() => handleToggleExamMode(q.id, q.isExamActive)} className={`col-span-2 py-2.5 rounded-xl font-black uppercase italic text-xs shadow transition-all flex items-center justify-center gap-1 ${q.isExamActive ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white'}`}><GraduationCap size={16}/> {q.isExamActive ? 'Dừng Thi' : 'Mở Thi'}</button><button onClick={() => handleToggleStatus(q.id, q.status)} className={`col-span-1 flex items-center justify-center rounded-xl transition-all border ${q.status === 'OPEN' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-400'}`}>{q.status === 'OPEN' ? <Unlock size={18} /> : <Lock size={18} />}</button><button onClick={() => router.push(`/create-quiz?id=${q.id}`)} className="col-span-1 bg-slate-700 hover:bg-indigo-600 text-white rounded-xl transition flex items-center justify-center"><Edit size={16} /></button><button onClick={() => handleDeleteQuiz(q.id)} className="col-span-1 bg-slate-700 hover:bg-red-600 text-white rounded-xl transition flex items-center justify-center"><Trash2 size={16} /></button>
        <button onClick={() => router.push(`/race/${q.id}`)} className="col-span-3 bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black shadow-lg hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 uppercase italic text-xs group-hover:animate-pulse"><Flag size={16} fill="currentColor"/> Biệt Đội</button>
        <button onClick={() => router.push(`/host/${q.id}`)} className="col-span-2 bg-white text-slate-900 py-3 rounded-xl font-black uppercase italic text-xs shadow hover:bg-indigo-50 transition-all flex items-center justify-center gap-1"><Swords size={16}/> Chiến Binh</button>
        <button onClick={() => router.push(`/arcade/${q.id}`)} className="col-span-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-xl font-black uppercase italic text-xs shadow-lg transition-all flex items-center justify-center gap-2"><Gamepad2 size={18}/> Kho Game</button>
        <button onClick={() => router.push(`/host/lightning?id=${q.id}`)} className="col-span-3 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white py-3 rounded-xl font-black uppercase italic text-xs shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all flex items-center justify-center gap-2 group border border-cyan-400/30">
            <Zap size={18} className="text-yellow-300 animate-pulse" fill="currentColor"/> 
            <span className="group-hover:tracking-widest transition-all">Nhanh Như Chớp</span>
        </button>
        </div></div></div>)}</div></div>)}
        
        {/* TAB INTERACTIVE (Giữ nguyên) */}
        {activeTab === 'INTERACTIVE' && (<div className="animate-in fade-in slide-in-from-right-4 duration-500"><header className="flex justify-between items-center mb-10"><div><h1 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">ARENA TƯƠNG TÁC </h1><p className="text-slate-400 mt-1 font-medium">Bảng thảo luận thời gian thực</p></div><button onClick={handleCreateBoard} className="flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-black shadow-lg transition-all hover:scale-105 uppercase italic"><Plus size={20} strokeWidth={3} /> Tạo Chủ Đề Mới</button></header><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{boards.map((board) => (<div key={board.id} className="bg-[#1e293b] rounded-[2rem] border border-white/10 hover:border-orange-500/50 transition-all group overflow-hidden shadow-xl hover:shadow-orange-500/20"><div className="p-8 relative"><div className="absolute top-4 right-4"><span className="bg-cyan-400 text-black px-2 py-1 rounded font-black text-xs shadow-lg flex items-center gap-1"><Hash size={12}/> {board.code || '---'}</span></div><h3 className="text-2xl font-black mb-2 text-white uppercase italic truncate">{board.title}</h3><div className="flex items-center gap-2 mb-6"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${board.status === 'OPEN' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{board.status === 'OPEN' ? 'ĐANG MỞ' : 'ĐÃ KHÓA'}</span><span className="text-slate-500 text-xs font-bold">{new Date(board.createdAt?.seconds * 1000).toLocaleDateString('vi-VN')}</span></div><div className="grid grid-cols-2 gap-3"><button onClick={() => router.push(`/interactive/${board.id}`)} className="col-span-2 bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><Swords size={20}/> Vào Quản Lý</button><button onClick={() => window.open(`/connect/${board.id}`, '_blank')} className="bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1 text-xs"><ExternalLink size={14}/> Link HS</button><button onClick={() => handleDeleteBoard(board.id)} className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1 text-xs border border-red-900"><Trash2 size={14}/> Xóa</button></div></div></div>))}</div>{boards.length === 0 && <div className="text-center py-20 opacity-50"><MessageSquare size={60} className="mx-auto mb-4 text-slate-500"/><p className="text-xl font-bold uppercase tracking-widest text-slate-400">Chưa có chủ đề nào</p></div>}</div>)}
        
        {/* TAB RESULTS (Giữ nguyên) */}
        {activeTab === 'RESULTS' && (<div className="animate-in fade-in slide-in-from-right-4 duration-500"><header className="mb-8"><h1 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">Trung Tâm Chiến Báo</h1><p className="text-slate-400 font-medium">Theo dõi thành tích và xuất báo cáo</p></header><div className="bg-[#1e293b]/80 backdrop-blur border border-white/10 p-6 rounded-[2rem] shadow-xl mb-8"><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"><div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lọc theo Đề thi</label><div className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={16}/><select value={filterExamId} onChange={(e) => setFilterExamId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none appearance-none"><option value="ALL">-- Tất cả chiến dịch --</option>{uniqueExams.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></div></div><div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lọc theo Lớp</label><select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none"><option value="ALL">-- Tất cả đơn vị --</option>{uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="bg-slate-900/50 rounded-xl p-2 flex justify-around items-center border border-white/5"><div className="text-center"><div className="text-[10px] text-slate-400 uppercase font-bold">Trung bình</div><div className="text-xl font-black text-yellow-400">{stats.avg}</div></div><div className="w-px h-8 bg-white/10"></div><div className="text-center"><div className="text-[10px] text-slate-400 uppercase font-bold">Đạt ({'>'}5)</div><div className="text-xl font-black text-green-400">{stats.pass}</div></div><div className="w-px h-8 bg-white/10"></div><div className="text-center"><div className="text-[10px] text-slate-400 uppercase font-bold">Sĩ số</div><div className="text-xl font-black text-white">{filteredResults.length}</div></div></div><div className="flex gap-2"><button onClick={handleExportExcel} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold shadow-lg transition flex items-center justify-center gap-2"><Download size={18}/> Xuất Excel</button><button onClick={handleDeleteResults} className="bg-red-600/20 hover:bg-red-600/80 text-red-500 hover:text-white p-2.5 rounded-xl transition border border-red-600/50" title="Xóa kết quả đang lọc"><Trash2 size={20}/></button><button onClick={handleRefreshResults} className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition shadow-lg" title="Làm mới dữ liệu"><RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} /></button></div></div></div><div className="bg-[#1e293b] rounded-[2rem] shadow-2xl overflow-hidden border border-white/5"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-900 text-slate-400 uppercase text-xs font-bold"><tr><th className="px-6 py-4">STT</th><th className="px-6 py-4">Chiến binh</th><th className="px-6 py-4">Ngày sinh</th><th className="px-6 py-4">Đơn vị (Lớp)</th><th className="px-6 py-4">Chiến dịch</th><th className="px-6 py-4 text-center">Điểm số</th><th className="px-6 py-4 text-right">Thời gian nộp</th></tr></thead><tbody className="divide-y divide-white/5">{filteredResults.length > 0 ? (filteredResults.map((r, i) => (<tr key={r.id} className="hover:bg-white/5 transition"><td className="px-6 py-4 font-mono text-slate-500">{i + 1}</td><td className="px-6 py-4 font-bold text-white">{r.studentName}</td><td className="px-6 py-4 text-slate-300">{r.studentDob}</td><td className="px-6 py-4"><span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded text-xs font-bold uppercase">{r.studentClass}</span></td><td className="px-6 py-4 text-indigo-400 font-bold text-sm max-w-[200px] truncate">{quizzes.find(q => q.id === r.examId)?.title || <span className="text-slate-500 italic">Đề đã xóa</span>}</td><td className="px-6 py-4 text-center"><span className={`text-lg font-black ${parseFloat(r.score) >= 5 ? 'text-green-400' : 'text-red-400'}`}>{r.score}</span></td><td className="px-6 py-4 text-right text-slate-500 text-sm font-mono">{r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '-'}<br/><span className="text-[10px]">{r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString('vi-VN') : ''}</span></td></tr>))) : (<tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 italic">Chưa có dữ liệu chiến đấu nào.</td></tr>)}</tbody></table></div></div></div>)}

        {/* TAB ASSIGNMENTS (Giữ nguyên) */}
        {activeTab === 'ASSIGNMENTS' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <header className="mb-8"><h1 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">Hòm Thư Nộp Bài</h1><p className="text-slate-400 font-medium">Quản lý bài tập nộp từ học sinh</p></header>
                
                <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-white/10 shadow-xl">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex gap-4 items-center">
                            <select onChange={e=>setFilterClass(e.target.value)} value={filterClass} className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 min-w-[200px]">
                                <option value="ALL">-- Tất cả các lớp --</option>
                                {uniqueAssignmentClasses.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            
                            {selectedAssigns.length > 0 && (
                                <button onClick={handleDeleteBulk} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg animate-in fade-in slide-in-from-left-2">
                                    <Trash2 size={18}/> Xóa ({selectedAssigns.length}) bài đã chọn
                                </button>
                            )}
                        </div>
                        <button onClick={() => fetchAssignments(user)} className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition shadow-lg"><RefreshCw size={20}/></button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900 text-slate-400 text-xs font-bold uppercase">
                                <tr>
                                    <th className="p-4 w-10 text-center">
                                        <input type="checkbox" onChange={handleSelectAll} checked={filteredAssignments.length > 0 && selectedAssigns.length === filteredAssignments.length} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                                    </th>
                                    <th className="p-4">TT</th>
                                    <th className="p-4">Tên Nhóm / HS</th>
                                    <th className="p-4">Lớp</th>
                                    <th className="p-4">Loại</th>
                                    <th className="p-4">Thời gian</th>
                                    <th className="p-4">Thao tác</th>
                                    <th className="p-4">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredAssignments.map((a, i) => (
                                    <tr key={a.id} className={`transition ${selectedAssigns.includes(a.id) ? 'bg-blue-900/20' : 'hover:bg-white/5'}`}>
                                        <td className="p-4 text-center">
                                            <input type="checkbox" onChange={() => handleSelectOne(a.id)} checked={selectedAssigns.includes(a.id)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"/>
                                        </td>
                                        <td className="p-4 text-slate-500 font-mono">{i+1}</td>
                                        <td className="p-4 font-bold text-white">{a.name}</td>
                                        <td className="p-4"><span className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-xs font-bold">{a.className}</span></td>
                                        <td className="p-4">{a.type === 'LINK' ? <span className="flex items-center gap-1 text-blue-400"><LinkIcon size={14}/> Link</span> : <span className="flex items-center gap-1 text-orange-400"><FileText size={14}/> File</span>}</td>
                                        <td className="p-4 text-xs text-slate-400">{a.submittedAt ? new Date(a.submittedAt.seconds * 1000).toLocaleString('vi-VN') : '...'}</td>
                                        <td className="p-4">
                                            <a href={a.content} target="_blank" rel="noreferrer" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow flex items-center gap-1 w-fit"><ExternalLink size={12}/> Mở Bài</a>
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => handleDeleteAssignment(a.id)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-full transition"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredAssignments.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-slate-500 italic">Chưa có bài nộp nào</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* TAB SETTINGS (ĐÃ THÊM LOGO UPLOAD) */}
        {activeTab === 'SETTINGS' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl mx-auto pb-10">
                <header className="mb-8"><h1 className="text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">QUẢN TRỊ HỆ THỐNG</h1><p className="text-slate-400 font-medium">Cấu hình API và Quyền truy cập</p></header>
                <div className="grid grid-cols-1 gap-8">
                    {MASTER_EMAILS.includes(user?.email) && (
                        <div className="bg-[#1e293b] p-8 rounded-[2rem] border border-yellow-500/30 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><LayoutTemplate size={120} /></div>
                            <div className="flex items-center gap-3 mb-6 relative z-10"><div className="bg-purple-600 p-2 rounded-lg"><Image size={24} className="text-white"/></div><h2 className="text-xl font-bold uppercase text-white">Giao Diện Trang Chủ</h2></div>
                            <form onSubmit={saveHomeConfig} className="space-y-6 relative z-10">
                                <div className="grid grid-cols-1 gap-4">
                                    {/* UPLOAD LOGO */}
                                    <div>
                                        <label className="block text-xs font-bold text-cyan-400 mb-2 uppercase">Logo / Tiêu đề (Thay thế chữ)</label>
                                        <input type="file" className="hidden" ref={logoTitleInput} onChange={(e)=>handleBannerUpload(e, 'logoTitleImage')}/>
                                        <UploadBox label="Tải ảnh Logo" img={homeConfig.logoTitleImage} onClick={()=>logoTitleInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, logoTitleImage: ''})} loading={uploading}/>
                                    </div>

                                    <div><label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Banner Trên Cùng (1920x300px)</label><input type="file" className="hidden" ref={topBannerInput} onChange={(e)=>handleBannerUpload(e, 'topBanner')}/><UploadBox label="Tải ảnh lên" img={homeConfig.topBanner} onClick={()=>topBannerInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, topBanner: ''})} loading={uploading}/></div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Banner Trái (Dọc)</label><input type="file" className="hidden" ref={leftBannerInput} onChange={(e)=>handleBannerUpload(e, 'leftBanner')}/><UploadBox label="Tải ảnh lên" img={homeConfig.leftBanner} onClick={()=>leftBannerInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, leftBanner: ''})} loading={uploading}/></div>
                                        <div><label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Banner Phải (Dọc)</label><input type="file" className="hidden" ref={rightBannerInput} onChange={(e)=>handleBannerUpload(e, 'rightBanner')}/><UploadBox label="Tải ảnh lên" img={homeConfig.rightBanner} onClick={()=>rightBannerInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, rightBanner: ''})} loading={uploading}/></div>
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center gap-2 transition-transform active:scale-95"><Save size={20}/> Lưu Giao Diện</button>
                            </form>
                        </div>
                    )}
                    {/* Các phần khác giữ nguyên */}
                    <div className="bg-[#1e293b] p-8 rounded-[2rem] border border-white/10 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Key size={120} /></div>
                        <div className="flex items-center gap-3 mb-6 relative z-10"><div className="bg-blue-600 p-2 rounded-lg"><Settings size={24} className="text-white"/></div><h2 className="text-xl font-bold uppercase text-white">Cấu Hình API & MÃ NỘP BÀI</h2></div>
                        <form onSubmit={saveUserConfig} className="space-y-6 relative z-10">
                            <div className="bg-slate-900/50 p-6 rounded-2xl border border-blue-500/30">
                                <h3 className="text-blue-400 font-bold uppercase text-sm mb-4 flex items-center gap-2"><QrCode size={18}/> Mã Nộp Bài Của Bạn</h3>
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-400">Mã này dùng để học sinh nộp bài cho riêng bạn</label>
                                    <input value={userConfig.submissionCode || ''} onChange={e=>setUserConfig({...userConfig, submissionCode: e.target.value.toUpperCase()})} className="w-full bg-slate-900 border-2 border-blue-500/50 p-4 rounded-xl text-white font-black text-xl text-center outline-none focus:border-blue-500 placeholder-slate-700 tracking-widest uppercase" placeholder="VÍ DỤ: TIN10A"/>
                                    <p className="text-[10px] text-slate-500 italic text-center">Hãy cung cấp mã này cho học sinh khi nộp bài tập</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-orange-400 font-bold uppercase text-sm border-b border-white/10 pb-2">Lưu trữ Ảnh (Cloudinary)</h3>
                                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Cloud Name</label><input value={userConfig.cloudinaryName} onChange={e=>setUserConfig({...userConfig, cloudinaryName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 font-mono"/></div>
                                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Upload Preset</label><input value={userConfig.cloudinaryPreset} onChange={e=>setUserConfig({...userConfig, cloudinaryPreset: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 font-mono"/></div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-purple-400 font-bold uppercase text-sm border-b border-white/10 pb-2">Trí tuệ nhân tạo (Gemini)</h3>
                                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Gemini API Key</label><input type="password" value={userConfig.geminiKey} onChange={e=>setUserConfig({...userConfig, geminiKey: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 font-mono"/></div>
                                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Phiên bản Model</label><select value={userConfig.geminiModel} onChange={e=>setUserConfig({...userConfig, geminiModel: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500"><option value="gemini-3-flash-preview">Gemini 3 Flash Preview(Nhanh)</option><option value="gemini-3-pro-preview">Gemini 3 Pro Preview (Ổn định)</option></select></div>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-white/10">
                                <h3 className="text-green-400 font-bold uppercase text-sm mb-4 flex items-center gap-2"><Clock size={16}/> Thời Gian Game Chiến Binh (Giây)</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Trắc nghiệm</label><input type="number" value={userConfig.timeMCQ} onChange={e=>setUserConfig({...userConfig, timeMCQ: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white font-bold text-center focus:border-green-500"/></div>
                                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Đúng/Sai</label><input type="number" value={userConfig.timeTF} onChange={e=>setUserConfig({...userConfig, timeTF: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white font-bold text-center focus:border-green-500"/></div>
                                    <div><label className="block text-xs font-bold text-slate-400 mb-1">Điền từ</label><input type="number" value={userConfig.timeSA} onChange={e=>setUserConfig({...userConfig, timeSA: parseInt(e.target.value)})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white font-bold text-center focus:border-green-500"/></div>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Save size={20}/> Lưu Cấu Hình</button>
                        </form>
                    </div>
                    {MASTER_EMAILS.includes(user?.email) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-[#1e293b] p-8 rounded-[2rem] border border-white/10 shadow-xl h-fit">
                                <div className="flex items-center gap-3 mb-6"><div className="bg-orange-600 p-2 rounded-lg"><UserPlus size={24} className="text-white"/></div><h2 className="text-xl font-bold uppercase text-white">Thêm Giáo Viên</h2></div>
                                <form onSubmit={handleAddEmail} className="space-y-4"><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl focus:border-orange-500 focus:outline-none font-bold" placeholder="vidu: giaovien@gmail.com"/><button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"><Plus size={20}/> Cấp Quyền</button></form>
                            </div>
                            <div className="bg-[#1e293b] p-8 rounded-[2rem] border border-white/10 shadow-xl">
                                <div className="flex items-center gap-3 mb-6"><div className="bg-indigo-600 p-2 rounded-lg"><Users size={24} className="text-white"/></div><h2 className="text-xl font-bold uppercase text-white">Danh Sách</h2></div>
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {MASTER_EMAILS.map((email, idx) => (<div key={`master-${idx}`} className="bg-slate-900/50 p-4 rounded-xl border border-yellow-500/30 flex justify-between items-center"><div className="flex items-center gap-3"><Shield size={18} className="text-yellow-500"/><div><div className="font-bold text-white">{email}</div><div className="text-[10px] text-yellow-500 uppercase font-bold">Admin Gốc</div></div></div><Lock size={16} className="text-slate-500"/></div>))}
                                    {allowedEmails.map((item) => (<div key={item.id} className="bg-slate-900 p-4 rounded-xl border border-white/5 flex justify-between items-center group hover:border-indigo-500/50 transition-colors"><div className="flex items-center gap-3"><CheckCircle size={18} className="text-green-500"/><div><div className="font-bold text-white">{item.email}</div><div className="text-[10px] text-slate-500">Bởi: {item.addedBy || 'System'}</div></div></div><button onClick={() => handleDeleteEmail(item.id)} className="bg-red-900/30 text-red-500 p-2 rounded-lg hover:bg-red-600 hover:text-white transition"><Trash2 size={16}/></button></div>))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>
    </div>
  );
}