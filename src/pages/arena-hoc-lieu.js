import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {Shield, Download, Eye, BookOpen, FileText, Home, Loader2, Layers, FolderOpen, Settings, Zap, Target, AlertTriangle, Code, Cpu, Terminal, Database as DbIcon, Gamepad2 } from 'lucide-react';

import { auth, firestore } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import useAuthStore from '@/store/useAuthStore';

const MASTER_EMAILS = ["luonggioi68@gmail.com"];
const GRADES = ['6', '7', '8', '9', '10', '11', '12', 'HSG'];
const SUBJECTS = ['Tin học', 'Toán học', 'Ngữ văn', 'Tiếng Anh', 'Vật lí', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lí', 'GDCD'];

const TECH_TABS = [
  { id: 'scratch', label: 'Scratch', icon: Gamepad2 },
  { id: 'python', label: 'Python', icon: Terminal },
  { id: 'c_cpp', label: 'C/C++', icon: Code },
  { id: 'sql_web', label: 'SQL_WEB', icon: DbIcon },
  { id: 'ai', label: 'AI', icon: Cpu }
];

const getFileFormatConfig = (doc) => {
  if (doc.isFolder) return { label: 'THƯ MỤC', style: 'bg-amber-950/50 text-amber-400 border-amber-500/30' };
  
  const title = (doc.title || '').toLowerCase();
  const format = doc.fileFormat || 'unknown';

  if (format === 'pdf' || title.includes('.pdf')) return { label: 'PDF', style: 'bg-red-950/50 text-red-400 border-red-500/30' };
  if (format === 'word' || title.includes('.doc') || title.includes('.docx')) return { label: 'WORD', style: 'bg-blue-950/50 text-blue-400 border-blue-500/30' };
  if (format === 'ppt' || title.includes('.ppt') || title.includes('.pptx')) return { label: 'POWERPOINT', style: 'bg-orange-950/50 text-orange-400 border-orange-500/30' };
  if (format === 'excel' || title.includes('.xls') || title.includes('.xlsx')) return { label: 'EXCEL', style: 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30' };
  if (format === 'zip' || title.includes('.zip') || title.includes('.rar')) return { label: 'ZIP / RAR', style: 'bg-purple-950/50 text-purple-400 border-purple-500/30' };
  
  return { label: 'FILE', style: 'bg-cyan-950/50 text-cyan-400 border-cyan-500/30' };
};

export default function PublicHocLieu() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [isTeacher, setIsTeacher] = useState(null); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocSnap = await getDoc(doc(firestore, "users", currentUser.uid));
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};
        const checkRole = userData.role === 'teacher' || MASTER_EMAILS.includes(currentUser.email);
        setIsTeacher(checkRole);
        setUser({ ...currentUser, ...userData });
      } else {
        setIsTeacher(false);
      }
    });
    return () => unsubscribe();
  }, [setUser]);

  const [activeTab, setActiveTab] = useState('dethi'); 
  const [filterGrade, setFilterGrade] = useState('10');
  const [filterSubject, setFilterSubject] = useState('Tin học');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const q = query(collection(firestore, "arena_hoc_lieu"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDocuments(docs);
    } catch (error) {
      console.error("Lỗi tải học liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (isTeacher) fetchDocuments(); 
  }, [isTeacher]);

  const isTechTab = TECH_TABS.some(t => t.id === activeTab);

  const filteredDocs = documents.filter(doc => {
    if (isTechTab) return doc.type === activeTab;
    return doc.grade === filterGrade && doc.subject === filterSubject && doc.type === activeTab;
  });

  if (isTeacher === null) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center relative overflow-hidden">
        <Loader2 className="animate-spin text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,1)]" size={60}/>
      </div>
    );
  }

 if (isTeacher === false) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center flex-col text-center p-4 relative overflow-hidden selection:bg-red-500 selection:text-white">
        <Head><title>Khu Vực Hạn Chế | Arena Edu</title></Head>
        <AlertTriangle className="w-20 h-20 md:w-[100px] md:h-[100px] text-red-500 mb-6 drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-pulse relative z-10"/>
        <h1 className="text-2xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mb-4 uppercase tracking-widest relative z-10">Khu Vực Hạn Chế</h1>
        <p className="text-slate-400 mb-10 font-bold tracking-widest text-xs md:text-sm relative z-10 px-4">Tài liệu tại đây là tuyệt mật. Bạn cần đăng nhập bằng tài khoản Giáo viên.</p>
        <button onClick={() => router.push('/')} className="relative z-10 bg-slate-900/80 hover:bg-cyan-600 text-cyan-400 hover:text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-black transition-all border border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-3 uppercase tracking-widest hover:scale-105 active:scale-95 text-xs md:text-base"><Home size={20}/> Trở Về Căn Cứ</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(220,38,38,0.15),rgba(255,255,255,0))] text-slate-200 font-sans pb-20 relative overflow-hidden">
      <Head><title>Học Liệu Arena | Đỉnh Cao Tri Thức</title></Head>

      <div className="absolute top-40 left-10 w-40 md:w-72 h-40 md:h-72 bg-orange-600/20 rounded-full blur-[80px] pointer-events-none"></div>
      <div className="absolute bottom-40 right-10 w-60 md:w-96 h-60 md:h-96 bg-cyan-600/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* HEADER TỐI ƯU MOBILE */}
      <header className="bg-black/40 backdrop-blur-xl border-b border-orange-500/50 shadow-[0_4px_30px_rgba(249,115,22,0.3)] p-3 md:p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer group" onClick={() => router.push('/')}>
            <div className="relative">
              <Shield className="text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.8)] group-hover:animate-pulse w-8 h-8 md:w-10 md:h-10" fill="currentColor"/> 
            </div>
            <div className="flex flex-col">
              <span className="text-lg md:text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600 uppercase leading-none tracking-wider">
                ARENA <span className="text-white not-italic font-black">HỌC LIỆU</span>
              </span>
              <span className="text-[8px] md:text-[10px] lg:text-xs text-orange-400 font-bold uppercase tracking-[0.2em] mt-1 drop-shadow-[0_0_5px_rgba(249,115,22,0.8)] truncate max-w-[150px] md:max-w-full">
                Đề thi - KHBD - Phụ lục
              </span>
            </div>
          </div>
          
          <div className="flex gap-1.5 md:gap-3">
            <button onClick={() => router.push('/admin/arena-hoc-lieu')} className="bg-red-950/50 hover:bg-red-600 text-red-400 hover:text-white px-2.5 md:px-5 py-2 md:py-2.5 rounded-lg text-[10px] md:text-xs font-black transition-all border border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-1.5 uppercase tracking-widest">
              <Settings size={14} className="animate-spin-slow"/> <span className="hidden sm:inline">Quản Trị</span>
            </button>
            <button onClick={() => router.push('/')} className="bg-slate-900/80 hover:bg-cyan-600 text-cyan-400 hover:text-white px-2.5 md:px-5 py-2 md:py-2.5 rounded-lg text-[10px] md:text-xs font-black transition-all border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5 uppercase tracking-widest">
              <Home size={14}/> <span className="hidden sm:inline">Trang Chủ</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-2 sm:px-4 mt-6 md:mt-12 relative z-10">
        
        {/* BỘ LỌC CHUẨN MOBILE */}
        {!isTechTab && (
          <div className="bg-black/60 backdrop-blur-md p-3 md:p-6 rounded-xl md:rounded-2xl border border-orange-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)] mb-6 md:mb-8 relative overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-4 md:gap-6 items-center">
              <div>
                <label className="flex items-center gap-2 text-[10px] md:text-xs font-black text-orange-400 uppercase mb-2 md:mb-3 tracking-widest">
                  <Zap size={14}/> Chọn Chiến Trường (Khối)
                </label>
                <div className="flex gap-1.5 md:gap-2 flex-wrap">
                  {GRADES.map(g => (
                    <button 
                      key={g} 
                      onClick={() => setFilterGrade(g)} 
                      className={`px-2 md:px-4 py-1 md:py-2 rounded-lg font-black transition-all duration-300 border uppercase tracking-widest text-[9px] md:text-xs flex-1 sm:flex-none text-center ${
                        filterGrade === g 
                        ? (g === 'HSG' ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white border-transparent shadow-[0_0_15px_rgba(225,29,72,0.8)] scale-105' : 'bg-gradient-to-r from-orange-600 to-red-600 text-white border-transparent shadow-[0_0_15px_rgba(239,68,68,0.6)] scale-105')
                        : (g === 'HSG' ? 'bg-red-950/30 border-red-900 text-red-500' : 'bg-[#0f172a] border-slate-700 text-slate-400')
                      }`}
                    >
                      {g === 'HSG' ? 'HSG' : `K${g}`}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-[10px] md:text-xs font-black text-cyan-400 uppercase mb-2 md:mb-3 tracking-widest">
                  <Target size={14}/> Hệ Thống Vũ Khí (Môn)
                </label>
                <select 
                  value={filterSubject} 
                  onChange={(e) => setFilterSubject(e.target.value)} 
                  className="w-full bg-[#0f172a] border border-cyan-500/50 p-2 md:p-3 rounded-lg md:rounded-xl text-white font-black uppercase tracking-widest outline-none focus:border-cyan-400 text-[10px] md:text-sm"
                >
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TABS TRƯỢT NGANG (SCROLLABLE ON MOBILE) */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 md:gap-3 mb-6 md:mb-8 pb-2 justify-start items-center w-full snap-x">
          
          <div className="flex gap-2 shrink-0 snap-start">
            <button onClick={() => setActiveTab('dethi')} className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs transition-all border shrink-0 ${activeTab === 'dethi' ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-transparent shadow-[0_0_15px_rgba(225,29,72,0.6)]' : 'bg-black/50 border-rose-900/50 text-rose-500/70'}`}>
              <FileText size={14} className="md:w-4 md:h-4"/> Đề Thi
            </button>
            <button onClick={() => setActiveTab('khbd')} className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs transition-all border shrink-0 ${activeTab === 'khbd' ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-transparent shadow-[0_0_15px_rgba(79,70,229,0.6)]' : 'bg-black/50 border-indigo-900/50 text-indigo-500/70'}`}>
              <BookOpen size={14} className="md:w-4 md:h-4"/> KHBD
            </button>
            <button onClick={() => setActiveTab('phuluc')} className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl font-black uppercase text-[10px] md:text-xs transition-all border shrink-0 ${activeTab === 'phuluc' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'bg-black/50 border-amber-900/50 text-amber-500/70'}`}>
              <Layers size={14} className="md:w-4 md:h-4"/> Phụ Lục
            </button>
          </div>

          <div className="w-px h-6 bg-white/10 shrink-0 hidden md:block mx-2"></div>

          <div className="flex gap-2 shrink-0 snap-start">
            {TECH_TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)} 
                  className={`flex items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-lg font-black uppercase text-[9px] md:text-xs transition-all border shrink-0 ${
                    activeTab === tab.id 
                    ? 'bg-red-600/20 text-red-500 border-red-500 shadow-[0_0_10px_rgba(220,38,38,0.5)]' 
                    : 'bg-black text-red-700/60 border-red-900/50'
                  }`}
                >
                  <Icon size={12} className="md:w-3 md:h-3"/> {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* BẢNG DỮ LIỆU SMART MOBILE */}
        <div className="bg-black/40 backdrop-blur-xl rounded-xl md:rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-hidden border border-white/10 relative">
          
          {loading && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-20 flex flex-col items-center justify-center">
              <Loader2 size={40} className="text-orange-500 animate-spin" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[500px] lg:min-w-[800px]">
              <thead className="bg-[#0f172a]/80 text-orange-500 uppercase text-[9px] md:text-xs font-black tracking-widest border-b-2 border-orange-500/30">
                <tr>
                  {/* Ẩn cột ID trên Mobile */}
                  <th className="hidden md:table-cell px-4 py-4 w-16 text-center">ID</th>
                  <th className="px-3 md:px-6 py-3 md:py-4">Tên Tài Liệu</th>
                  <th className="px-2 md:px-6 py-3 md:py-4 text-center w-24 md:w-auto">Loại File</th>
                  {/* Ẩn cột Tác Giả trên Mobile (sẽ ghép vào cột Tên) */}
                  <th className="hidden md:table-cell px-4 py-4 text-center">Tác Giả</th>
                  <th className="px-2 md:px-6 py-3 md:py-4 text-center w-20 md:w-48">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredDocs.length > 0 ? (
                  filteredDocs.map((doc, i) => {
                    const formatConfig = getFileFormatConfig(doc);
                    return (
                      <tr key={doc.id} className="hover:bg-orange-500/5 transition-colors group">
                        
                        <td className="hidden md:table-cell px-4 py-5 text-center text-slate-600 font-mono font-black text-sm">
                          {i + 1 < 10 ? `0${i+1}` : i+1}
                        </td>
                        
                        <td className="px-3 md:px-6 py-3 md:py-5">
                          <div className="font-black text-white text-xs md:text-base flex items-center gap-2 md:gap-3">
                            {doc.isFolder ? <FolderOpen size={16} className="text-amber-400 shrink-0 md:w-5 md:h-5" /> : <FileText size={16} className="text-cyan-400 shrink-0 md:w-5 md:h-5" />} 
                            <span className="truncate max-w-[180px] sm:max-w-[250px] md:max-w-[400px]">{doc.title}</span>
                          </div>
                          
                          {/* HIỂN THỊ TÁC GIẢ Ở ĐÂY CHỈ DÀNH CHO MOBILE */}
                          <div className="md:hidden mt-1.5 flex items-center gap-2">
                             <span className="text-[8px] text-slate-500 uppercase tracking-widest">
                               Bởi: <span className="text-cyan-400 font-bold">{doc.authorEmail ? doc.authorEmail.split('@')[0] : 'Ẩn danh'}</span>
                             </span>
                          </div>
                        </td>

                        <td className="px-2 md:px-6 py-3 md:py-5 text-center">
                          <span className={`px-2 md:px-4 py-1 md:py-1.5 rounded text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap border ${formatConfig.style}`}>
                            {formatConfig.label}
                          </span>
                        </td>

                        <td className="hidden md:table-cell px-4 py-5 text-center text-slate-400 text-xs font-bold tracking-widest">
                          <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px]">
                            {doc.authorEmail ? doc.authorEmail.split('@')[0] : 'Ẩn danh'}
                          </span>
                        </td>

                        <td className="px-2 md:px-6 py-3 md:py-5 text-center">
                          <div className="flex justify-center gap-1.5 md:gap-3">
                            {doc.isFolder ? (
                              <a href={`https://drive.google.com/drive/folders/${doc.driveId}`} target="_blank" rel="noreferrer" 
                                 className="bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black px-2 md:px-5 py-1.5 md:py-2 rounded md:rounded-lg flex items-center gap-1 md:gap-2 text-[9px] md:text-xs font-black uppercase tracking-widest border border-amber-500 transition-all">
                                <FolderOpen size={12} className="md:w-4 md:h-4"/> <span className="hidden sm:inline">Open</span>
                              </a>
                            ) : (
                              <>
                                <a href={`https://drive.google.com/file/d/${doc.driveId}/preview`} target="_blank" rel="noreferrer" 
                                   className="bg-cyan-500/10 text-cyan-400 hover:bg-cyan-400 hover:text-black p-1.5 md:p-2.5 rounded md:rounded-lg border border-cyan-500 transition-all" title="Xem trực tuyến">
                                  <Eye size={14} className="md:w-4 md:h-4"/>
                                </a>
                                <a href={`https://drive.google.com/uc?export=download&id=${doc.driveId}`} 
                                   className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-400 hover:text-black p-1.5 md:p-2.5 rounded md:rounded-lg border border-emerald-500 transition-all" title="Tải xuống">
                                  <Download size={14} className="md:w-4 md:h-4"/>
                                </a>
                              </>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center relative">
                      <Shield size={40} className="mx-auto mb-3 text-slate-800"/>
                      <p className="text-slate-600 uppercase font-black tracking-widest text-[10px] md:text-xs">Khu Vực Này Chưa Có Vũ Khí.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Ẩn thanh cuộn dọc mặc định của trình duyệt cho thanh Tab ngang */}
      <style jsx global>{`
        .animate-spin-slow { animation: spin 4s linear infinite; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}