import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '@/store/useAuthStore';
import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged, signOut, updatePassword } from 'firebase/auth'; 
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy, addDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { Flag, Plus, Trash2, LogOut, Edit, Loader2, Shield, Gamepad2, FileText, BarChart3, Download, Search, Swords, Lock, Unlock, RefreshCw, MessageSquare, ExternalLink, Settings, UserPlus, CheckCircle, Save, Key, Users, GraduationCap, Clock, Image, LayoutTemplate, Upload, X, Hash, Link as LinkIcon, FolderOpen, QrCode, CheckSquare, Zap, UserCog, Calendar, AlertTriangle, Layers, Database, Eye, EyeOff, Archive, ArrowRightCircle, Menu } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExpiryAlert from '@/components/ExpiryAlert';

const MASTER_EMAILS = ["luonggioi68@gmail.com"]; 

// Danh sách khối và môn học
const GRADES = ['1', '2', '3', '4', '5','6', '7', '8', '9', '10', '11', '12', 'Khác'];
const SUBJECTS = [
    { id: 'Toán học', name: 'Toán Học', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    { id: 'Ngữ văn', name: 'Ngữ Văn', color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
    { id: 'Tiếng Anh', name: 'Tiếng Anh', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    { id: 'Tin học', name: 'Tin Học', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    { id: 'Vật lí', name: 'Vật Lý', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    { id: 'Hóa học', name: 'Hóa Học', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
    { id: 'Sinh học', name: 'Sinh Học', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    { id: 'Lịch sử', name: 'Lịch Sử', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
    { id: 'Địa lí', name: 'Địa Lý', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    { id: 'Giáo dục công dân', name: 'GDCD', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
    { id: 'Giáo dục kinh tế và pháp luật', name: 'KT & PL', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
    { id: 'Khoa học tự nhiên', name: 'KHTN', color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
    { id: 'Lịch sử và Địa lí', name: 'Sử - Địa', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    { id: 'Công nghệ', name: 'Công Nghệ', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' },
    { id: 'Hoạt động trải nghiệm', name: 'HĐTN', color: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30' },
    { id: 'Tiếng Việt', name: 'Tiếng Việt', color: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/30' },
    { id: 'Giáo dục quốc phòng và an ninh', name: 'GDQP', color: 'text-green-600', bg: 'bg-green-600/10', border: 'border-green-600/30' },
];

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
  
  // [MỚI] State điều khiển Menu trên Mobile
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [quizzes, setQuizzes] = useState([]);
  const [results, setResults] = useState([]);
  const [boards, setBoards] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssigns, setSelectedAssigns] = useState([]);
  
  // State cho Arena Kho Game
  const [repoGrade, setRepoGrade] = useState('10'); 
  const [repoSubject, setRepoSubject] = useState('ALL'); 
  const [selectedRepoItems, setSelectedRepoItems] = useState([]);
  
  const [allowedEmails, setAllowedEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [uploading, setUploading] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  
  const topBannerInput = useRef(null);
  const leftBannerInput = useRef(null);
  const rightBannerInput = useRef(null);
  const logoTitleInput = useRef(null); 

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
  
  const [homeConfig, setHomeConfig] = useState({ topBanner: '', leftBanner: '', rightBanner: '', logoTitleImage: '' });
  
  const [activeTab, setActiveTab] = useState('LIBRARY'); 
  const [filterExamId, setFilterExamId] = useState('ALL');
  const [filterClass, setFilterClass] = useState('ALL');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) { router.push('/'); return; }
      
      let isMaster = MASTER_EMAILS.includes(currentUser.email);
      let myPermission = null;
      let allPermissions = [];

      try {
          const snap = await getDocs(collection(firestore, "allowed_emails"));
          allPermissions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setAllowedEmails(allPermissions);
          myPermission = allPermissions.find(p => p.email === currentUser.email);
      } catch (e) { console.error("Lỗi lấy danh sách quyền:", e); }
      
      if (!isMaster) {
          if (!myPermission) { alert(`Tài khoản chưa được cấp quyền truy cập!`); await signOut(auth); router.push('/'); return; }
          if (myPermission.expiredAt) {
              const expireDate = new Date(myPermission.expiredAt.seconds * 1000);
              const now = new Date();
              if (now > expireDate) { alert(`⛔ TÀI KHOẢN HẾT HẠN!`); await signOut(auth); router.push('/'); return; }
          }
      }
      
      setUser(currentUser);
      
      try {
          const configSnap = await getDoc(doc(firestore, "user_configs", currentUser.uid));
          if (configSnap.exists()) setUserConfig({ ...userConfig, ...configSnap.data() });
          const homeSnap = await getDoc(doc(firestore, "system_config", "homepage"));
          if (homeSnap.exists()) setHomeConfig(homeSnap.data());
      } catch (e) {}
      
      await Promise.all([ fetchQuizzes(currentUser.uid), fetchResults(currentUser.uid), fetchBoards(currentUser.uid), fetchAssignments(currentUser) ]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, setUser]);

  // --- CÁC HÀM FETCH DATA ---
  const fetchAssignments = async (currentUser) => {
      try {
          const u = currentUser || user;
          const s = await getDocs(collection(firestore, "assignments"));
          let allData = s.docs.map(d => ({ id: d.id, ...d.data() }));
          allData.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
          if (!MASTER_EMAILS.includes(u.email)) {
              allData = allData.filter(item => item.teacherEmail && item.teacherEmail.toLowerCase() === u.email.toLowerCase());
          }
          setAssignments(allData);
      } catch (e) { console.error("Lỗi tải bài nộp:", e); }
  };

  const fetchQuizzes = async (userId) => { try { const q = query(collection(firestore, "quizzes"), where("authorId", "==", userId)); const s = await getDocs(q); const list = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds); list.forEach(async (q) => { if (!q.code) { const c = Math.floor(1000 + Math.random() * 9000).toString(); await updateDoc(doc(firestore, "quizzes", q.id), { code: c }); q.code = c; } }); setQuizzes(list); } catch (e) {} };
  const fetchResults = async () => { try { const q = query(collection(firestore, "exam_results"), orderBy("submittedAt", "desc")); const s = await getDocs(q); setResults(s.docs.map(d => ({ id: d.id, ...d.data() }))); } catch (e) {} };
  const fetchBoards = async (userId) => { try { const q = query(collection(firestore, "interactive_boards"), where("authorId", "==", userId), orderBy("createdAt", "desc")); const s = await getDocs(q); const list = s.docs.map(d => ({ id: d.id, ...d.data() })); list.forEach(async (b) => { if (!b.code) { const c = Math.floor(1000 + Math.random() * 9000).toString(); await updateDoc(doc(firestore, "interactive_boards", b.id), { code: c }); b.code = c; } }); setBoards(list); } catch (e) {} };

  // --- LOGIC XỬ LÝ ẢNH & CONFIG ---
  const handleBannerUpload = async (e, key) => { const file = e.target.files[0]; if (!file) return; setUploading(true); const formData = new FormData(); formData.append("file", file); formData.append("upload_preset", userConfig.cloudinaryPreset || 'gameedu'); try { const cloudName = userConfig.cloudinaryName || 'dcnsjzq0i'; const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: formData }); const data = await res.json(); if (data.secure_url) setHomeConfig(prev => ({ ...prev, [key]: data.secure_url })); else alert("Lỗi upload!"); } catch (err) { alert("Lỗi: " + err.message); } finally { setUploading(false); } };
  const saveUserConfig = async (e) => { e.preventDefault(); try { await setDoc(doc(firestore, "user_configs", user.uid), { ...userConfig, email: user.email }); alert("✅ Đã cập nhật Mã Nộp Bài và Cấu hình!"); } catch (e) { alert(e.message); } };
  const saveHomeConfig = async (e) => { e.preventDefault(); try { await setDoc(doc(firestore, "system_config", "homepage"), homeConfig); alert("✅ Đã lưu!"); } catch (e) { alert(e.message); } };

  // --- ĐỔI MẬT KHẨU ---
  const handleChangePassword = async (e) => {
      e.preventDefault();
      if(newPassword.length < 6) return alert("Mật khẩu phải từ 6 ký tự!");
      setIsChangingPass(true);
      try {
          await updatePassword(user, newPassword);
          alert("✅ Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
          setNewPassword('');
          await signOut(auth);
          router.push('/');
      } catch (err) {
          if(err.code === 'auth/requires-recent-login') alert("⚠️ Cần đăng nhập lại mới được đổi mật khẩu!");
          else alert("Lỗi: " + err.message);
      } finally {
          setIsChangingPass(false);
      }
  };

  // --- LOGIC QUẢN LÝ USER ---
  const handleAddEmail = async (e) => {
      e.preventDefault();
      if (!newEmail.includes('@')) return alert("Email sai!");
      const now = new Date(); const expiredDate = new Date(); expiredDate.setFullYear(now.getFullYear() + 1);
      try { const docRef = await addDoc(collection(firestore, "allowed_emails"), { email: newEmail, addedBy: user.email, createdAt: serverTimestamp(), expiredAt: expiredDate }); setAllowedEmails([...allowedEmails, { id: docRef.id, email: newEmail, addedBy: user.email, createdAt: { seconds: now.getTime() / 1000 }, expiredAt: { seconds: expiredDate.getTime() / 1000 } }]); setNewEmail(''); alert("✅ Đã cấp quyền 1 năm!"); } catch (e) { alert(e.message); }
  };
  const handleExtendEmail = async (id, currentExpiredAt) => { if (!confirm("Gia hạn thêm 1 năm cho tài khoản này?")) return; try { let newExp; if (currentExpiredAt && currentExpiredAt.seconds * 1000 > Date.now()) { newExp = new Date(currentExpiredAt.seconds * 1000); } else { newExp = new Date(); } newExp.setFullYear(newExp.getFullYear() + 1); await updateDoc(doc(firestore, "allowed_emails", id), { expiredAt: newExp }); setAllowedEmails(prev => prev.map(item => item.id === id ? { ...item, expiredAt: { seconds: newExp.getTime() / 1000 } } : item)); alert("✅ Đã gia hạn thành công!"); } catch (e) { alert("Lỗi gia hạn: " + e.message); } };
  const handleDeleteEmail = async (id) => { if (!MASTER_EMAILS.includes(user.email)) return alert("Chỉ Admin gốc mới được xóa!"); if(confirm("Xóa giáo viên này khỏi hệ thống?")) { await deleteDoc(doc(firestore, "allowed_emails", id)); setAllowedEmails(p => p.filter(e => e.id !== id)); } };
  const checkStatus = (expiredAt) => { if (!expiredAt) return { text: "Vĩnh viễn", color: "text-green-400", bg: "bg-green-500/20" }; const expDate = new Date(expiredAt.seconds * 1000); const now = new Date(); const diffTime = expDate - now; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); if (diffDays < 0) return { text: "Đã hết hạn", color: "text-red-500", bg: "bg-red-500/20", icon: <AlertTriangle size={14}/> }; if (diffDays <= 30) return { text: `Hết hạn sau ${diffDays} ngày`, color: "text-yellow-400", bg: "bg-yellow-500/20", icon: <AlertTriangle size={14}/> }; return { text: "Đang hoạt động", color: "text-blue-400", bg: "bg-blue-500/20" }; };

  // --- LOGIC KHÁC ---
  const handleCreateBoard = async () => { const title = prompt("Tên chủ đề:"); if(title) { const code = Math.floor(1000 + Math.random() * 9000).toString(); await addDoc(collection(firestore, "interactive_boards"), { title, authorId: user.uid, authorEmail: user.email, code, createdAt: serverTimestamp(), status: 'OPEN' }); fetchBoards(user.uid); } };
  const handleDeleteBoard = async (id) => { if(confirm("Xóa bảng?")) { await deleteDoc(doc(firestore, "interactive_boards", id)); setBoards(p => p.filter(b => b.id !== id)); } };
  const handleRefreshResults = async () => { setIsRefreshing(true); await fetchResults(user.uid); setTimeout(() => setIsRefreshing(false), 500); };
  const handleDeleteQuiz = async (id) => { if(confirm("Xóa đề?")) { await deleteDoc(doc(firestore, "quizzes", id)); setQuizzes(p => p.filter(q => q.id !== id)); } };
  const handleToggleStatus = async (id, st) => { const n = st === 'OPEN' ? 'CLOSED' : 'OPEN'; await updateDoc(doc(firestore, "quizzes", id), { status: n }); setQuizzes(p => p.map(q => q.id === id ? { ...q, status: n } : q)); };
  const handleToggleExamMode = async (id, currentMode) => { const newMode = !currentMode; try { await updateDoc(doc(firestore, "quizzes", id), { isExamActive: newMode }); setQuizzes(p => p.map(q => q.id === id ? { ...q, isExamActive: newMode } : q)); } catch (e) { alert("Lỗi: " + e.message); } };
  const handleExportExcel = () => { const ws = XLSX.utils.json_to_sheet(filteredResults.map((r,i) => ({ "STT": i+1, "Tên": r.studentName, "Lớp": r.studentClass, "Điểm": r.score, "Ngày": r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString() : '' }))); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Data"); XLSX.writeFile(wb, "KetQua.xlsx"); };
  const handleDeleteResults = async () => { if(filterExamId === 'ALL') return alert("Chọn đề để xóa!"); if(confirm("Xóa kết quả?")) { await Promise.all(filteredResults.map(r => deleteDoc(doc(firestore, "exam_results", r.id)))); setResults(p => p.filter(r => !filteredResults.find(fr => fr.id === r.id))); } };
  const handleDeleteAssignment = async (id) => { if(!confirm("Xóa bài này?")) return; await deleteDoc(doc(firestore, "assignments", id)); setAssignments(prev => prev.filter(a => a.id !== id)); };

  const handleSelectAll = (e) => { if (e.target.checked) { setSelectedAssigns(filteredAssignments.map(a => a.id)); } else { setSelectedAssigns([]); } };
  const handleSelectOne = (id) => { if (selectedAssigns.includes(id)) { setSelectedAssigns(selectedAssigns.filter(item => item !== id)); } else { setSelectedAssigns([...selectedAssigns, id]); } };
  const handleDeleteBulk = async () => { if (selectedAssigns.length === 0) return; if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedAssigns.length} bài nộp này không?`)) return; setLoading(true); try { await Promise.all(selectedAssigns.map(id => deleteDoc(doc(firestore, "assignments", id)))); setAssignments(prev => prev.filter(a => !selectedAssigns.includes(a.id))); setSelectedAssigns([]); } catch (e) { console.error(e); alert("Lỗi khi xóa bài: " + e.message); } finally { setLoading(false); } };

  const handleMoveToRepo = async (id) => {
      if(!confirm("Chuyển đề này sang Kho Game?\n- Đề sẽ biến mất khỏi Kho Vũ Khí.\n- Đề sẽ được CÔNG KHAI (Public) cho mọi người thấy.")) return;
      try {
          await updateDoc(doc(firestore, "quizzes", id), { origin: 'GAME_REPO', isPublic: true });
          setQuizzes(prev => prev.map(q => q.id === id ? { ...q, origin: 'GAME_REPO', isPublic: true } : q));
          alert("✅ Đã chuyển sang Kho Game và Công khai thành công!");
      } catch (e) { console.error(e); alert("Lỗi: " + e.message); }
  };

  const handleSelectRepoAll = (e, filteredList) => { if(e.target.checked) { setSelectedRepoItems(filteredList.map(q => q.id)); } else { setSelectedRepoItems([]); } };
  const handleSelectRepoOne = (id) => { if(selectedRepoItems.includes(id)) { setSelectedRepoItems(selectedRepoItems.filter(i => i !== id)); } else { setSelectedRepoItems([...selectedRepoItems, id]); } };
  const handleDeleteRepoBulk = async () => {
    if(selectedRepoItems.length === 0) return;
    if(!confirm(`Xóa vĩnh viễn ${selectedRepoItems.length} đề đã chọn?`)) return;
    setLoading(true);
    try { await Promise.all(selectedRepoItems.map(id => deleteDoc(doc(firestore, "quizzes", id)))); setQuizzes(prev => prev.filter(q => !selectedRepoItems.includes(q.id))); setSelectedRepoItems([]); } catch(e) { alert("Lỗi xóa: " + e.message); } finally { setLoading(false); }
  };
  
  const handleCreateQuizForSubject = () => { router.push(`/create-quiz?grade=${repoGrade}&subject=${repoSubject !== 'ALL' ? repoSubject : ''}&from=GAME_REPO`); };

  const libraryQuizzes = useMemo(() => { return quizzes.filter(q => q.origin !== 'GAME_REPO'); }, [quizzes]);
  const myResults = useMemo(() => results.filter(r => quizzes.some(q => q.id === r.examId)), [results, quizzes]);
  const filteredResults = useMemo(() => myResults.filter(r => (filterExamId === 'ALL' || r.examId === filterExamId) && (filterClass === 'ALL' || r.studentClass === filterClass)), [myResults, filterExamId, filterClass]);
  const uniqueClasses = useMemo(() => [...new Set(myResults.map(r => r.studentClass).filter(Boolean))].sort(), [myResults]);
  const uniqueExams = useMemo(() => quizzes.filter(q => new Set(myResults.map(r => r.examId)).has(q.id)), [quizzes, myResults]);
  const stats = useMemo(() => { if (!filteredResults.length) return { avg: 0, pass: 0, fail: 0 }; const total = filteredResults.reduce((s, r) => s + (parseFloat(r.score)||0), 0); const pass = filteredResults.filter(r => parseFloat(r.score)>=5).length; return { avg: (total/filteredResults.length).toFixed(2), pass, fail: filteredResults.length - pass }; }, [filteredResults]);
  const uniqueAssignmentClasses = useMemo(() => { const classes = assignments.map(a => a.className).filter(c => c && c.trim() !== ''); return [...new Set(classes)].sort(); }, [assignments]);
  const filteredAssignments = useMemo(() => { return assignments.filter(a => filterClass === 'ALL' || a.className === filterClass); }, [assignments, filterClass]);

  const filteredRepoQuizzes = useMemo(() => {
    return quizzes.filter(q => {
        if (q.origin !== 'GAME_REPO') return false;
        const qGrade = q.grade || '10';
        const qSubject = q.subject || 'Khác';
        const matchGrade = repoGrade === 'ALL' || qGrade.toString() === repoGrade.toString();
        const matchSubject = repoSubject === 'ALL' || qSubject === repoSubject;
        return matchGrade && matchSubject;
    });
  }, [quizzes, repoGrade, repoSubject]);

  const isPasswordUser = useMemo(() => user?.providerData?.some(p => p.providerId === 'password'), [user]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white"><Loader2 className="animate-spin" size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-orange-500 selection:text-white flex">
        
      {/* NÚT MỞ MENU TRÊN MOBILE (Nút Hamburger) */}
      <button 
          onClick={() => setIsMobileMenuOpen(true)} 
          className="lg:hidden fixed top-4 left-4 z-40 bg-[#1e293b] p-2 rounded-lg border border-white/10 text-white shadow-lg"
      >
          <Menu size={24} />
      </button>

      {/* LỚP PHỦ ĐEN TRÊN MOBILE KHI MỞ MENU */}
      {isMobileMenuOpen && (
          <div 
              className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
          ></div>
      )}

      {/* SIDEBAR BÊN TRÁI - Giao diện chuẩn Responsive */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-[#020617] text-white flex flex-col border-r border-white/10 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-3 text-xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 uppercase tracking-tighter">
                <Shield fill="currentColor" className="text-orange-500" size={28}/> 
                <span> Arena Edu<br/><span className="text-xs text-white not-italic tracking-widest font-normal">CONNECT</span></span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1">
                <X size={24}/>
            </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button onClick={() => {setActiveTab('LIBRARY'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'LIBRARY' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-white/5'}`}><Gamepad2 size={18}/> ARENA KHO VŨ KHÍ</button>
            <button onClick={() => {setActiveTab('GAME_REPO'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'GAME_REPO' ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20' : 'text-slate-400 hover:bg-white/5'}`}><Database size={18}/> ARENA KHO GAME</button>
            <button onClick={() => {setActiveTab('INTERACTIVE'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'INTERACTIVE' ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:bg-white/5'}`}><MessageSquare size={18}/> ARENA TƯƠNG TÁC</button>
            <button onClick={() => {setActiveTab('RESULTS'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'RESULTS' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-white/5'}`}><BarChart3 size={18}/>ARENA QUẢN LÝ THI</button>
            <button onClick={() => {setActiveTab('ASSIGNMENTS'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'ASSIGNMENTS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 hover:bg-white/5'}`}><FolderOpen size={18}/>ARENA CHẤM BÀI</button>
            <button onClick={() => {setActiveTab('SETTINGS'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm ${activeTab === 'SETTINGS' ? 'bg-slate-700 text-white border border-white/20 shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}><Settings size={18}/>ARENA CẤU HÌNH</button>
            
            {MASTER_EMAILS.includes(user?.email) && (
                <button onClick={() => {setActiveTab('USERS'); setIsMobileMenuOpen(false);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm mt-4 border-t border-white/10 pt-4 ${activeTab === 'USERS' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' : 'text-pink-500/70 hover:bg-white/5'}`}>
                    <UserCog size={18}/> QUẢN LÝ NGƯỜI DÙNG
                </button>
            )}
        </nav>
        
        <div className="p-4 border-t border-white/10">
            <button onClick={() => {signOut(auth); router.push('/')}} className="w-full flex items-center justify-center gap-2 text-red-400 hover:bg-red-500/10 py-3 rounded-xl font-bold uppercase text-xs transition-colors">
                <LogOut size={16}/> Đăng xuất
            </button>
        </div>
      </aside>

      {/* KHUNG NỘI DUNG CHÍNH (MAIN) - Đã tối ưu padding cho Mobile */}
      <main className="flex-1 w-full lg:w-auto h-screen overflow-y-auto p-4 pt-16 lg:p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] relative">
        
        {/* TAB LIBRARY */}
        {activeTab === 'LIBRARY' && (<div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10"><div><h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg">Kho Vũ Khí</h1><p className="text-slate-400 mt-1 font-medium">Quản lý các bộ đề cá nhân</p></div><button onClick={() => router.push('/create-quiz')} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 transition"><Plus size={20}/> Chế tạo đề mới</button></header><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{libraryQuizzes.map(q=><div key={q.id} className={`bg-[#1e293b]/80 backdrop-blur-md rounded-[2rem] border transition-all duration-300 group overflow-hidden shadow-xl hover:shadow-2xl ${q.isExamActive ? 'border-red-500/50 shadow-red-500/10' : 'border-white/10 hover:border-indigo-500/50'}`}><div className="h-32 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden"><FileText size={48} className="text-indigo-400 group-hover:scale-110 transition-transform duration-500"/><div className="absolute top-4 left-4"><span className="bg-yellow-400 text-black px-2 py-1 rounded font-black text-xs shadow-lg flex items-center gap-1"><Hash size={12}/> {q.code || '---'}</span></div><div className="absolute top-4 right-4 flex flex-col items-end gap-1"><span className={`text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg ${q.status === 'OPEN' ? 'bg-green-500 text-black' : 'bg-slate-700 text-slate-400'}`}>{q.status === 'OPEN' ? 'Game: Mở' : 'Game: Đóng'}</span>{q.isExamActive && (<span className="text-[10px] font-black px-2 py-1 rounded uppercase shadow-lg bg-red-600 text-white animate-pulse">ĐANG THI</span>)}</div></div><div className="p-6"><h3 className="text-xl font-black mb-1 truncate text-white uppercase italic tracking-tight">{q.title}</h3><div className="flex justify-between items-center mb-6"><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{q.questions?.length || 0} Mật lệnh</p><span className="text-slate-500 text-xs">{new Date(q.createdAt?.seconds * 1000).toLocaleDateString()}</span></div><div className="grid grid-cols-5 gap-2"><button onClick={() => handleToggleExamMode(q.id, q.isExamActive)} className={`col-span-2 py-2.5 rounded-xl font-black uppercase italic text-xs shadow transition-all flex items-center justify-center gap-1 ${q.isExamActive ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white'}`}><GraduationCap size={16}/> {q.isExamActive ? 'Dừng Thi' : 'Mở Thi'}</button><button onClick={() => handleToggleStatus(q.id, q.status)} className={`col-span-1 flex items-center justify-center rounded-xl transition-all border ${q.status === 'OPEN' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-slate-700/50 text-slate-400'}`}>{q.status === 'OPEN' ? <Unlock size={18} /> : <Lock size={18} />}</button><button onClick={() => router.push(`/create-quiz?id=${q.id}`)} className="col-span-1 bg-slate-700 hover:bg-indigo-600 text-white rounded-xl transition flex items-center justify-center"><Edit size={16} /></button><button onClick={() => handleDeleteQuiz(q.id)} className="col-span-1 bg-slate-700 hover:bg-red-600 text-white rounded-xl transition flex items-center justify-center"><Trash2 size={16} /></button>
        <button onClick={() => router.push(`/race/${q.id}`)} className="col-span-3 bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black shadow-lg hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 uppercase italic text-xs group-hover:animate-pulse"><Flag size={16} fill="currentColor"/> Biệt Đội</button>
        <button onClick={() => router.push(`/host/${q.id}`)} className="col-span-2 bg-white text-slate-900 py-3 rounded-xl font-black uppercase italic text-xs shadow hover:bg-indigo-50 transition-all flex items-center justify-center gap-1"><Swords size={16}/> Chiến Binh</button>
        <button onClick={() => router.push(`/arcade/lobby/${q.id}?from=dashboard`)} className="col-span-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-xl font-black uppercase italic text-xs shadow-lg transition-all flex items-center justify-center gap-2"><Gamepad2 size={18}/> Kho Game</button>
        <button onClick={() => router.push(`/host/lightning?id=${q.id}`)} className="col-span-3 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white py-3 rounded-xl font-black uppercase italic text-xs shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all flex items-center justify-center gap-2 group border border-cyan-400/30">
            <Zap size={18} className="text-yellow-300 animate-pulse" fill="currentColor"/> 
            <span className="group-hover:tracking-widest transition-all">Nhanh Như Chớp</span>
        </button>
        <button onClick={() => handleMoveToRepo(q.id)} className="col-span-5 bg-slate-800 hover:bg-rose-900/50 text-rose-400 hover:text-white py-2 rounded-xl font-bold uppercase text-[10px] flex items-center justify-center gap-2 mt-2 border border-slate-700 hover:border-rose-500/50 transition-all"><Archive size={14}/> Chuyển sang Kho Game</button>
        </div></div></div>)}</div></div>)}
        
        {/* TAB GAME REPO */}
        {activeTab === 'GAME_REPO' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <header className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">ARENA KHO GAME</h1>
                    <p className="text-slate-400 font-medium">Thư viện đề thi quy mô lớn - Phân loại theo Khối & Môn</p>
                </header>

                <div className="bg-[#1e293b] rounded-[2rem] p-4 md:p-6 border border-white/10 shadow-xl mb-8">
                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">1. Chọn Chiến Trường (Khối Lớp)</label>
                        <div className="flex gap-2 flex-wrap">
                            {GRADES.map(g => (
                                <button key={g} onClick={() => setRepoGrade(g)} className={`px-4 md:px-6 py-2 rounded-xl font-black transition-all border-2 ${repoGrade === g ? 'bg-rose-600 text-white border-rose-600 shadow-lg scale-105' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-rose-600 hover:text-white'}`}>{g === 'Khác' ? 'KHÁC' : `KHỐI ${g}`}</button>
                            ))}
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">2. Chọn Loại Vũ Khí (Môn Học)</label>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            <button onClick={() => setRepoSubject('ALL')} className={`p-3 rounded-xl font-bold transition-all border text-sm text-center ${repoSubject === 'ALL' ? 'bg-white text-black border-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'}`}>TẤT CẢ</button>
                            {SUBJECTS.map(s => (
                                <button key={s.id} onClick={() => setRepoSubject(s.id)} className={`p-3 rounded-xl font-bold transition-all border text-sm text-center flex flex-col items-center justify-center gap-1 ${repoSubject === s.id ? `${s.bg} ${s.color} ${s.border} shadow-lg scale-105` : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}>{s.name}</button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-t border-white/5 pt-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="text-sm font-bold text-slate-400">Hiển thị: <span className="text-white">{filteredRepoQuizzes.length}</span> đề</div>
                            {selectedRepoItems.length > 0 && (<button onClick={handleDeleteRepoBulk} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-lg animate-in fade-in"><Trash2 size={14}/> Xóa ({selectedRepoItems.length})</button>)}
                        </div>
                        <button onClick={handleCreateQuizForSubject} className="w-full md:w-auto bg-gradient-to-r from-rose-600 to-orange-600 text-white px-6 py-3 rounded-xl font-black shadow-lg hover:shadow-orange-500/30 transition-all flex items-center justify-center gap-2 uppercase italic text-xs"><Plus size={16} strokeWidth={3}/> Tạo Đề {repoSubject !== 'ALL' ? SUBJECTS.find(s=>s.id===repoSubject)?.name : ''} K{repoGrade}</button>
                    </div>
                </div>

                <div className="bg-[#1e293b] rounded-[2rem] border border-white/10 shadow-xl overflow-hidden min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[800px]">
                            <thead className="bg-slate-900 text-slate-400 text-xs font-bold uppercase sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 w-10 text-center bg-slate-900"><input type="checkbox" onChange={(e) => handleSelectRepoAll(e, filteredRepoQuizzes)} checked={filteredRepoQuizzes.length > 0 && selectedRepoItems.length === filteredRepoQuizzes.length} className="w-4 h-4 rounded border-slate-600 bg-slate-800 cursor-pointer"/></th>
                                    <th className="p-4 bg-slate-900">TT</th>
                                    <th className="p-4 bg-slate-900">Lớp/Khối</th>
                                    <th className="p-4 bg-slate-900">Môn</th>
                                    <th className="p-4 w-1/3 bg-slate-900">Tên Bài / Đề</th>
                                    <th className="p-4 text-center bg-slate-900">Public</th>
                                    <th className="p-4 text-center bg-slate-900">Sửa Đề</th>
                                    <th className="p-4 text-right bg-slate-900">Hành động</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredRepoQuizzes.map((q, i) => (
                                    <tr key={q.id} className={`transition group ${selectedRepoItems.includes(q.id) ? 'bg-rose-900/10' : 'hover:bg-white/5'}`}>
                                        <td className="p-4 text-center"><input type="checkbox" onChange={() => handleSelectRepoOne(q.id)} checked={selectedRepoItems.includes(q.id)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 cursor-pointer"/></td>
                                        <td className="p-4 text-slate-500 font-mono text-xs">{i + 1}</td>
                                        <td className="p-4"><span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-[10px] font-bold">K{q.grade || '10'}</span></td>
                                        <td className="p-4">
                                            {(() => {
                                                const s = SUBJECTS.find(sub => sub.id === q.subject);
                                                return s ? <span className={`${s.bg} ${s.color} border border-transparent px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap`}>{s.name}</span> : <span className="text-slate-500 text-xs">{q.subject || 'Khác'}</span>;
                                            })()}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-white truncate max-w-[300px]" title={q.title}>{q.title}</div>
                                            <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 mt-1"><span>Mã: {q.code}</span><span>• {q.questions?.length || 0} câu</span><span>• {new Date(q.createdAt?.seconds*1000).toLocaleDateString('vi-VN')}</span></div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => handleToggleStatus(q.id, q.status)} className={`p-2 rounded-lg transition-all ${q.status === 'OPEN' ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`} title={q.status === 'OPEN' ? 'Đang mở Public' : 'Đang đóng'}>{q.status === 'OPEN' ? <Eye size={18}/> : <EyeOff size={18}/>}</button>
                                        </td>
                                        <td className="p-4 text-center"><button onClick={() => router.push(`/create-quiz?id=${q.id}`)} className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white p-2 rounded-lg transition border border-indigo-600/30"><Edit size={16}/></button></td>
                                        <td className="p-4 text-right"><button onClick={() => handleDeleteQuiz(q.id)} className="text-slate-600 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-full transition"><Trash2 size={16}/></button></td>
                                    </tr>
                                ))}
                                {filteredRepoQuizzes.length === 0 && <tr><td colSpan="8" className="p-10 text-center text-slate-500 italic">Không tìm thấy dữ liệu cho bộ lọc này.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        
        {/* TAB INTERACTIVE */}
        {activeTab === 'INTERACTIVE' && (<div className="animate-in fade-in slide-in-from-right-4 duration-500"><header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10"><div><h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-300">ARENA TƯƠNG TÁC </h1><p className="text-slate-400 mt-1 font-medium">Bảng thảo luận thời gian thực</p></div><button onClick={handleCreateBoard} className="flex items-center gap-2 bg-white text-slate-900 px-6 py-3 rounded-xl font-black shadow-lg transition-all hover:scale-105 uppercase italic"><Plus size={20} strokeWidth={3} /> Tạo Chủ Đề</button></header><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{boards.map((board) => (<div key={board.id} className="bg-[#1e293b] rounded-[2rem] border border-white/10 hover:border-orange-500/50 transition-all group overflow-hidden shadow-xl hover:shadow-orange-500/20"><div className="p-8 relative"><div className="absolute top-4 right-4"><span className="bg-cyan-400 text-black px-2 py-1 rounded font-black text-xs shadow-lg flex items-center gap-1"><Hash size={12}/> {board.code || '---'}</span></div><h3 className="text-2xl font-black mb-2 text-white uppercase italic truncate pr-16">{board.title}</h3><div className="flex items-center gap-2 mb-6"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${board.status === 'OPEN' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{board.status === 'OPEN' ? 'ĐANG MỞ' : 'ĐÃ KHÓA'}</span><span className="text-slate-500 text-xs font-bold">{new Date(board.createdAt?.seconds * 1000).toLocaleDateString('vi-VN')}</span></div><div className="grid grid-cols-2 gap-3"><button onClick={() => router.push(`/interactive/${board.id}`)} className="col-span-2 bg-gradient-to-r from-orange-600 to-red-600 text-white py-3 rounded-xl font-black uppercase italic shadow-lg flex items-center justify-center gap-2"><Swords size={20}/> Vào Quản Lý</button><button onClick={() => window.open(`/connect/${board.id}`, '_blank')} className="bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1 text-xs"><ExternalLink size={14}/> Link HS</button><button onClick={() => handleDeleteBoard(board.id)} className="bg-red-900/30 hover:bg-red-600 text-red-400 hover:text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1 text-xs border border-red-900"><Trash2 size={14}/> Xóa</button></div></div></div>))}</div>{boards.length === 0 && <div className="text-center py-20 opacity-50"><MessageSquare size={60} className="mx-auto mb-4 text-slate-500"/><p className="text-xl font-bold uppercase tracking-widest text-slate-400">Chưa có chủ đề nào</p></div>}</div>)}
        
        {/* TAB RESULTS */}
        {activeTab === 'RESULTS' && (<div className="animate-in fade-in slide-in-from-right-4 duration-500"><header className="mb-8"><h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">Trung Tâm Chiến Báo</h1><p className="text-slate-400 font-medium">Theo dõi thành tích và xuất báo cáo</p></header><div className="bg-[#1e293b]/80 backdrop-blur border border-white/10 p-4 md:p-6 rounded-[2rem] shadow-xl mb-8"><div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"><div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lọc theo Đề thi</label><div className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={16}/><select value={filterExamId} onChange={(e) => setFilterExamId(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none appearance-none truncate"><option value="ALL">-- Tất cả chiến dịch --</option>{uniqueExams.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}</select></div></div><div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Lọc theo Lớp</label><select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:border-emerald-500 focus:outline-none"><option value="ALL">-- Tất cả đơn vị --</option>{uniqueClasses.map(c => <option key={c} value={c}>{c}</option>)}</select></div><div className="bg-slate-900/50 rounded-xl p-2 flex justify-around items-center border border-white/5"><div className="text-center"><div className="text-[10px] text-slate-400 uppercase font-bold">Trung bình</div><div className="text-xl md:text-2xl font-black text-yellow-400">{stats.avg}</div></div><div className="w-px h-8 bg-white/10"></div><div className="text-center"><div className="text-[10px] text-slate-400 uppercase font-bold">Đạt ({'>'}5)</div><div className="text-xl md:text-2xl font-black text-green-400">{stats.pass}</div></div><div className="w-px h-8 bg-white/10"></div><div className="text-center"><div className="text-[10px] text-slate-400 uppercase font-bold">Sĩ số</div><div className="text-xl md:text-2xl font-black text-white">{filteredResults.length}</div></div></div><div className="flex gap-2"><button onClick={handleExportExcel} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold shadow-lg transition flex items-center justify-center gap-2 text-sm"><Download size={18}/> Excel</button><button onClick={handleDeleteResults} className="bg-red-600/20 hover:bg-red-600/80 text-red-500 hover:text-white p-2.5 rounded-xl transition border border-red-600/50 flex items-center justify-center" title="Xóa kết quả đang lọc"><Trash2 size={20}/></button><button onClick={handleRefreshResults} className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition shadow-lg flex items-center justify-center" title="Làm mới dữ liệu"><RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} /></button></div></div></div><div className="bg-[#1e293b] rounded-[2rem] shadow-2xl overflow-hidden border border-white/5"><div className="overflow-x-auto"><table className="w-full text-left min-w-[700px]"><thead className="bg-slate-900 text-slate-400 uppercase text-xs font-bold"><tr><th className="px-4 md:px-6 py-4">STT</th><th className="px-4 md:px-6 py-4">Chiến binh</th><th className="px-4 md:px-6 py-4">Ngày sinh</th><th className="px-4 md:px-6 py-4">Đơn vị (Lớp)</th><th className="px-4 md:px-6 py-4">Chiến dịch</th><th className="px-4 md:px-6 py-4 text-center">Điểm số</th><th className="px-4 md:px-6 py-4 text-right">Thời gian nộp</th></tr></thead><tbody className="divide-y divide-white/5">{filteredResults.length > 0 ? (filteredResults.map((r, i) => (<tr key={r.id} className="hover:bg-white/5 transition"><td className="px-4 md:px-6 py-4 font-mono text-slate-500">{i + 1}</td><td className="px-4 md:px-6 py-4 font-bold text-white">{r.studentName}</td><td className="px-4 md:px-6 py-4 text-slate-300">{r.studentDob}</td><td className="px-4 md:px-6 py-4"><span className="bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded text-xs font-bold uppercase">{r.studentClass}</span></td><td className="px-4 md:px-6 py-4 text-indigo-400 font-bold text-sm max-w-[150px] md:max-w-[200px] truncate">{quizzes.find(q => q.id === r.examId)?.title || <span className="text-slate-500 italic">Đề đã xóa</span>}</td><td className="px-4 md:px-6 py-4 text-center"><span className={`text-lg font-black ${parseFloat(r.score) >= 5 ? 'text-green-400' : 'text-red-400'}`}>{r.score}</span></td><td className="px-4 md:px-6 py-4 text-right text-slate-500 text-xs md:text-sm font-mono">{r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'}) : '-'}<br/><span className="text-[10px]">{r.submittedAt ? new Date(r.submittedAt.seconds * 1000).toLocaleDateString('vi-VN') : ''}</span></td></tr>))) : (<tr><td colSpan="7" className="px-6 py-12 text-center text-slate-500 italic">Chưa có dữ liệu chiến đấu nào.</td></tr>)}</tbody></table></div></div></div>)}

        {/* TAB ASSIGNMENTS */}
        {activeTab === 'ASSIGNMENTS' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <header className="mb-8"><h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">Hòm Thư Nộp Bài</h1><p className="text-slate-400 font-medium">Quản lý bài tập nộp từ học sinh</p></header>
                
                <div className="bg-[#1e293b] p-4 md:p-6 rounded-[2rem] border border-white/10 shadow-xl">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
                            <select onChange={e=>setFilterClass(e.target.value)} value={filterClass} className="w-full sm:w-auto bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-white outline-none focus:border-blue-500 min-w-[200px]">
                                <option value="ALL">-- Tất cả các lớp --</option>
                                {uniqueAssignmentClasses.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            
                            {selectedAssigns.length > 0 && (
                                <button onClick={handleDeleteBulk} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg animate-in fade-in slide-in-from-left-2">
                                    <Trash2 size={18}/> Xóa ({selectedAssigns.length})
                                </button>
                            )}
                        </div>
                        <button onClick={() => fetchAssignments(user)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-xl transition shadow-lg flex items-center justify-center"><RefreshCw size={20}/></button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[600px]">
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
                                        <td className="p-4 text-slate-500 font-mono text-sm">{i+1}</td>
                                        <td className="p-4 font-bold text-white text-sm md:text-base">{a.name}</td>
                                        <td className="p-4"><span className="bg-blue-900 text-blue-300 px-2 py-1 rounded text-[10px] md:text-xs font-bold">{a.className}</span></td>
                                        <td className="p-4 text-xs md:text-sm">{a.type === 'LINK' ? <span className="flex items-center gap-1 text-blue-400"><LinkIcon size={14}/> Link</span> : <span className="flex items-center gap-1 text-orange-400"><FileText size={14}/> File</span>}</td>
                                        <td className="p-4 text-xs text-slate-400">{a.submittedAt ? new Date(a.submittedAt.seconds * 1000).toLocaleString('vi-VN') : '...'}</td>
                                        <td className="p-4">
                                            <a href={a.content} target="_blank" rel="noreferrer" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow flex items-center justify-center gap-1 w-fit"><ExternalLink size={12}/> Mở Bài</a>
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

        {/* TAB USER MANAGEMENT */}
        {activeTab === 'USERS' && MASTER_EMAILS.includes(user?.email) && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <header className="mb-8">
                    <h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">Quản Lý Đội Ngũ</h1>
                    <p className="text-slate-400 font-medium">Cấp quyền và gia hạn tài khoản giáo viên</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Cột Trái: Form Thêm Mới */}
                    <div className="lg:col-span-1 h-fit">
                        <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-white/10 shadow-xl lg:sticky lg:top-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-pink-600 p-2 rounded-lg"><UserPlus size={24} className="text-white"/></div>
                                <h2 className="text-xl font-bold uppercase text-white">Cấp Quyền Mới</h2>

                            </div>
                            
                            <form onSubmit={handleAddEmail} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Email Giáo Viên</label>
                                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-700 text-white p-4 rounded-xl focus:border-pink-500 focus:outline-none font-bold" placeholder="vidu: giaovien@gmail.com" required/>
                                </div>
                                
                                <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5 text-xs text-slate-400 space-y-2">
                                    <div className="flex justify-between"><span>Ngày đăng ký:</span> <span className="text-white font-bold">{new Date().toLocaleDateString('vi-VN')}</span></div>
                                    <div className="flex justify-between"><span>Hết hạn (Mặc định):</span> <span className="text-pink-400 font-bold">+1 Năm</span></div>
                                </div>

                                <button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-rose-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:scale-[1.02] transition-transform flex items-center justify-center gap-2">
                                    <Plus size={20}/> Xác Nhận
                                </button>
                            </form>
                            <a href="/admin/users" target="_blank" rel="noreferrer" className="mt-6 block text-center text-xs text-slate-500 hover:text-white underline">Quản lí TK GV & HS</a>
                        </div>
                    </div>

                    {/* Cột Phải: Danh Sách */}
                    <div className="lg:col-span-2">
                        <div className="bg-[#1e293b] rounded-[2rem] border border-white/10 shadow-xl overflow-hidden">
                            <div className="p-4 md:p-6 border-b border-white/10 flex justify-between items-center">
                                <h2 className="text-lg md:text-xl font-bold uppercase text-white flex items-center gap-2">
                                    <Users size={20} className="text-pink-500"/> Danh Sách Giáo Viên ({allowedEmails.length})
                                </h2>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[600px]">
                                    <thead className="bg-slate-900 text-slate-400 text-xs font-bold uppercase">
                                        <tr>
                                            <th className="p-4">STT</th>
                                            <th className="p-4">Tài khoản</th>
                                            <th className="p-4">Thời hạn</th>
                                            <th className="p-4 text-center">Trạng thái</th>
                                            <th className="p-4 text-right">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {MASTER_EMAILS.map((email, i) => (
                                            <tr key={`master-${i}`} className="bg-yellow-500/5">
                                                <td className="p-4 text-yellow-500 font-mono">ADMIN</td>
                                                <td className="p-4 font-bold text-white text-sm md:text-base">{email} <span className="text-[10px] bg-yellow-500 text-black px-1 rounded ml-1">MASTER</span></td>
                                                <td className="p-4 text-slate-500 italic text-sm">Vĩnh viễn</td>
                                                <td className="p-4 text-center"><span className="text-green-500 text-[10px] md:text-xs font-bold">Active</span></td>
                                                <td className="p-4 text-right"><Lock size={16} className="ml-auto text-slate-500"/></td>
                                            </tr>
                                        ))}

                                        {allowedEmails.map((item, index) => {
                                            const status = checkStatus(item.expiredAt);
                                            return (
                                                <tr key={item.id} className="hover:bg-white/5 transition group">
                                                    <td className="p-4 text-slate-500 font-mono text-sm">{index + 1}</td>
                                                    <td className="p-4">
                                                        <div className="font-bold text-white text-sm md:text-base">{item.email}</div>
                                                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                                                            <Calendar size={10}/> ĐK: {item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : '---'}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-xs md:text-sm text-slate-300">
                                                        {item.expiredAt ? new Date(item.expiredAt.seconds * 1000).toLocaleDateString('vi-VN') : <span className="text-slate-500 italic">Chưa có hạn</span>}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`${status.color} ${status.bg} px-2 py-1 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1`}>
                                                            {status.icon} {status.text}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => handleExtendEmail(item.id, item.expiredAt)}
                                                            className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition flex items-center gap-1 border border-blue-600/30 whitespace-nowrap"
                                                            title="Gia hạn thêm 1 năm"
                                                        >
                                                            <RefreshCw size={12}/> Gia hạn
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteEmail(item.id)}
                                                            className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-1.5 md:p-2 rounded-lg transition border border-red-600/30"
                                                            title="Xóa tài khoản"
                                                        >
                                                            <Trash2 size={14}/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {allowedEmails.length === 0 && <div className="p-8 text-center text-slate-500 italic">Chưa có giáo viên nào được cấp quyền.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TAB SETTINGS */}
        {activeTab === 'SETTINGS' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl mx-auto pb-10">
                <header className="mb-8"><h1 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter drop-shadow-lg mb-2">QUẢN TRỊ HỆ THỐNG</h1><p className="text-slate-400 font-medium">Cấu hình API và Quyền truy cập</p></header>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    {MASTER_EMAILS.includes(user?.email) && (
                        <div className="bg-[#1e293b] p-6 md:p-8 rounded-[2rem] border border-yellow-500/30 shadow-xl relative overflow-hidden md:col-span-2">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><LayoutTemplate size={120} /></div>
                            <div className="flex items-center gap-3 mb-6 relative z-10"><div className="bg-purple-600 p-2 rounded-lg"><Image size={24} className="text-white"/></div><h2 className="text-lg md:text-xl font-bold uppercase text-white">Giao Diện Trang Chủ</h2></div>
                            <form onSubmit={saveHomeConfig} className="space-y-6 relative z-10">
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-cyan-400 mb-2 uppercase">Logo / Tiêu đề (Thay thế chữ)</label>
                                        <input type="file" className="hidden" ref={logoTitleInput} onChange={(e)=>handleBannerUpload(e, 'logoTitleImage')}/>
                                        <UploadBox label="Tải ảnh Logo" img={homeConfig.logoTitleImage} onClick={()=>logoTitleInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, logoTitleImage: ''})} loading={uploading}/>
                                    </div>

                                    <div><label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Banner Trên Cùng (1920x300px)</label><input type="file" className="hidden" ref={topBannerInput} onChange={(e)=>handleBannerUpload(e, 'topBanner')}/><UploadBox label="Tải ảnh lên" img={homeConfig.topBanner} onClick={()=>topBannerInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, topBanner: ''})} loading={uploading}/></div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Banner Trái (Dọc)</label><input type="file" className="hidden" ref={leftBannerInput} onChange={(e)=>handleBannerUpload(e, 'leftBanner')}/><UploadBox label="Tải ảnh lên" img={homeConfig.leftBanner} onClick={()=>leftBannerInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, leftBanner: ''})} loading={uploading}/></div>
                                        <div><label className="block text-xs font-bold text-purple-400 mb-2 uppercase">Banner Phải (Dọc)</label><input type="file" className="hidden" ref={rightBannerInput} onChange={(e)=>handleBannerUpload(e, 'rightBanner')}/><UploadBox label="Tải ảnh lên" img={homeConfig.rightBanner} onClick={()=>rightBannerInput.current.click()} onClear={()=>setHomeConfig({...homeConfig, rightBanner: ''})} loading={uploading}/></div>
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"><Save size={20}/> Lưu Giao Diện</button>
                            </form>
                        </div>
                    )}
                    
                    <div className="bg-[#1e293b] p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Key size={120} /></div>
                        <div className="flex items-center gap-3 mb-6 relative z-10"><div className="bg-blue-600 p-2 rounded-lg"><Settings size={24} className="text-white"/></div><h2 className="text-lg md:text-xl font-bold uppercase text-white">Cấu Hình API</h2></div>
                        <form onSubmit={saveUserConfig} className="space-y-6 relative z-10">
                            <div className="bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-blue-500/30">
                                <h3 className="text-blue-400 font-bold uppercase text-sm mb-4 flex items-center gap-2"><QrCode size={18}/> Mã Nộp Bài Của Bạn</h3>
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-400">Mã này dùng để học sinh nộp bài cho riêng bạn</label>
                                    <input value={userConfig.submissionCode || ''} onChange={e=>setUserConfig({...userConfig, submissionCode: e.target.value.toUpperCase()})} className="w-full bg-slate-900 border-2 border-blue-500/50 p-4 rounded-xl text-white font-black text-xl text-center outline-none focus:border-blue-500 placeholder-slate-700 tracking-widest uppercase" placeholder="VÍ DỤ: TIN10A"/>
                                    <p className="text-[10px] text-slate-500 italic text-center">Hãy cung cấp mã này cho học sinh khi nộp bài tập</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-orange-400 font-bold uppercase text-sm border-b border-white/10 pb-2">Lưu trữ Ảnh (Cloudinary)</h3>
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">Cloud Name</label><input value={userConfig.cloudinaryName} onChange={e=>setUserConfig({...userConfig, cloudinaryName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"/></div>
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">Upload Preset</label><input value={userConfig.cloudinaryPreset} onChange={e=>setUserConfig({...userConfig, cloudinaryPreset: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"/></div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-purple-400 font-bold uppercase text-sm border-b border-white/10 pb-2">Trí tuệ nhân tạo (Gemini)</h3>
                                <div><label className="block text-xs font-bold text-slate-400 mb-1">Gemini API Key</label><input type="password" value={userConfig.geminiKey} onChange={e=>setUserConfig({...userConfig, geminiKey: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 font-mono text-sm"/></div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Phiên bản Model</label>
                                    <select value={userConfig.geminiModel} onChange={e=>setUserConfig({...userConfig, geminiModel: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl text-white outline-none focus:border-blue-500 text-sm">
                                        <option value="gemini-3-flash-preview">gemini-3-flash-preview(free)</option>
                                        <option value="gemini-3-pro-preview">gemini-3-pro-preview</option>
                                        <option value="gemini-2.0-flash">Gemini 2.0 Flash (Nhanh free)</option>                                        <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Experimental)</option>
                                        <option value="gemini-1.5-pro">Gemini-1.5-pro</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Save size={20}/> Lưu Cấu Hình</button>
                        </form>
                    </div>

                    <div className="bg-[#1e293b] p-6 md:p-8 rounded-[2rem] border border-white/10 shadow-xl relative overflow-hidden h-fit">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Lock size={120} /></div>
                        <div className="flex items-center gap-3 mb-6 relative z-10">
                            <div className="bg-red-600 p-2 rounded-lg"><Key size={24} className="text-white"/></div>
                            <h2 className="text-lg md:text-xl font-bold uppercase text-white">Bảo Mật Tài Khoản</h2>
                        </div>
                        
                        {isPasswordUser ? (
                            <form onSubmit={handleChangePassword} className="space-y-6 relative z-10">
                                <div className="bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-red-500/30">
                                    <label className="block text-xs font-bold text-red-400 mb-2 uppercase">Mật khẩu mới</label>
                                    <input 
                                        type="password" 
                                        value={newPassword} 
                                        onChange={(e) => setNewPassword(e.target.value)} 
                                        placeholder="Nhập mật khẩu mới..."
                                        className="w-full bg-slate-900 border border-slate-700 p-4 rounded-xl text-white font-bold outline-none focus:border-red-500 transition-colors"
                                        required
                                        minLength={6}
                                    />
                                    <p className="text-[10px] text-slate-500 mt-2 italic">* Sau khi đổi mật khẩu thành công, bạn sẽ cần đăng nhập lại.</p>
                                </div>
                                <button type="submit" disabled={isChangingPass} className="w-full bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50">
                                    {isChangingPass ? <Loader2 className="animate-spin"/> : <RefreshCw size={20}/>} Đổi Mật Khẩu
                                </button>
                            </form>
                        ) : (
                            <div className="relative z-10 bg-yellow-500/10 p-4 md:p-6 rounded-2xl border border-yellow-500/30 flex items-start gap-4">
                                <div className="bg-yellow-500/20 p-3 rounded-xl hidden sm:block"><AlertTriangle size={24} className="text-yellow-400"/></div>
                                <div>
                                    <h3 className="text-yellow-400 font-bold uppercase text-sm mb-1">Tính năng không khả dụng</h3>
                                    <p className="text-slate-400 text-xs leading-relaxed">
                                        Tài khoản này được đăng ký qua Google hoặc chưa thiết lập mật khẩu. Bạn không cần đổi mật khẩu tại đây.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </main>
      <ExpiryAlert />
    </div>
  );
}